-- Cut the prototype over from one shared JSON blob to department-scoped rows.
-- The original prototype object is retained per row during the transition so
-- no legacy assignee, checklist, tag, or SOP content is lost.

alter table public.tasks add column if not exists legacy_key text;
alter table public.tasks add column if not exists prototype_payload jsonb not null default '{}'::jsonb;
create unique index if not exists tasks_legacy_key_uidx on public.tasks(legacy_key) where legacy_key is not null;

alter table public.sops add column if not exists legacy_key text;
alter table public.sops add column if not exists prototype_payload jsonb not null default '{}'::jsonb;
create unique index if not exists sops_legacy_key_uidx on public.sops(legacy_key) where legacy_key is not null;

alter table public.knowledge_articles add column if not exists legacy_key text;
alter table public.knowledge_articles add column if not exists prototype_payload jsonb not null default '{}'::jsonb;
create unique index if not exists knowledge_legacy_key_uidx on public.knowledge_articles(legacy_key) where legacy_key is not null;

alter table public.kpi_definitions add column if not exists legacy_key text;
alter table public.kpi_definitions add column if not exists prototype_payload jsonb not null default '{}'::jsonb;
create unique index if not exists kpi_definitions_legacy_key_uidx on public.kpi_definitions(legacy_key) where legacy_key is not null;

create table if not exists public.company_hub_legacy_archive (
  id bigint generated always as identity primary key,
  archived_by uuid references public.profiles(id),
  payload jsonb not null,
  archived_at timestamptz not null default now()
);
alter table public.company_hub_legacy_archive enable row level security;

create or replace function public.prototype_mmdd(value text)
returns timestamptz language plpgsql stable set search_path=public
as $$
declare y integer; m integer; d integer;
begin
  if value is null or value !~ '^[0-1][0-9]-[0-3][0-9]$' then return null; end if;
  y := extract(year from timezone('Asia/Bangkok',now()))::integer;
  m := split_part(value,'-',1)::integer;
  d := split_part(value,'-',2)::integer;
  return make_timestamptz(y,m,d,0,0,0,'Asia/Bangkok');
exception when others then return null;
end
$$;

create or replace function public.sync_normalized_workspace(workspace jsonb)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  caller public.profiles%rowtype;
  item jsonb; old_payload jsonb; safe_payload jsonb;
  dept text; record_key text; item_status public.task_status;
  task_row_id uuid; definition_row_id uuid;
  task_count integer := 0; knowledge_count integer := 0;
  sop_count integer := 0; kpi_count integer := 0;
  manager boolean; visible boolean;
  period_first date := date_trunc('month',timezone('Asia/Bangkok',now()))::date;
  period_last date := (date_trunc('month',timezone('Asia/Bangkok',now())) + interval '1 month - 1 day')::date;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into caller from public.profiles where id=auth.uid() and active;
  if caller.id is null then raise exception 'active profile required'; end if;
  if pg_column_size(workspace)>5242880 then raise exception 'workspace payload is too large'; end if;

  for item in select value from jsonb_array_elements(coalesce(workspace->'tasks','[]'::jsonb)) loop
    dept := upper(coalesce(item->>'dept',''));
    record_key := left(coalesce(item->>'id',''),80);
    if record_key='' or not exists(select 1 from public.departments d where d.code=dept) then
      raise exception 'invalid task identity or department';
    end if;
    manager := caller.role in ('exec','admin') or public.can_manage_department(dept);
    visible := manager or caller.department_code=dept or exists(
      select 1 from public.profile_departments pd where pd.profile_id=caller.id and pd.department_code=dept
    );
    select t.prototype_payload into old_payload from public.tasks t where t.legacy_key=record_key;
    if old_payload is null and not manager then raise exception 'only a manager can create task %',record_key; end if;
    if old_payload is not null and not manager then
      if caller.role<>'staff' or not visible then raise exception 'task permission denied for %',record_key; end if;
      if coalesce(item->>'status','todo')='done' and coalesce(old_payload->>'status','todo')<>'done' then
        raise exception 'staff cannot close task %',record_key;
      end if;
      safe_payload := old_payload || jsonb_build_object(
        'status',item->'status','spent',item->'spent','solution',item->'solution',
        'sub',item->'sub','log',item->'log','ontime',item->'ontime'
      );
    else safe_payload := item;
    end if;
    if coalesce(safe_payload->>'status','todo') not in ('todo','doing','review','block','done') then
      raise exception 'invalid task status';
    end if;
    item_status := (safe_payload->>'status')::public.task_status;
    insert into public.tasks(
      department_code,title,description,status,priority,creator_id,start_at,due_at,
      sla_minutes,closed_at,legacy_key,prototype_payload,updated_at
    ) values (
      dept,left(coalesce(safe_payload->>'title','งาน'),300),coalesce(safe_payload->>'desc',''),item_status,
      case when safe_payload->>'prio' in ('low','mid','high') then safe_payload->>'prio' else 'mid' end,
      caller.id,public.prototype_mmdd(safe_payload->>'start'),public.prototype_mmdd(safe_payload->>'due'),
      case when (safe_payload->'sla'->>'n')~'^[0-9]+$' then (safe_payload->'sla'->>'n')::integer *
        case when safe_payload->'sla'->>'unit'='hr' then 60 else 1440 end else null end,
      case when item_status='done' then now() else null end,record_key,safe_payload,now()
    ) on conflict (legacy_key) where legacy_key is not null do update set
      department_code=excluded.department_code,title=excluded.title,description=excluded.description,
      status=excluded.status,priority=excluded.priority,start_at=excluded.start_at,due_at=excluded.due_at,
      sla_minutes=excluded.sla_minutes,
      closed_at=case when excluded.status='done' then coalesce(public.tasks.closed_at,now()) else null end,
      prototype_payload=excluded.prototype_payload,updated_at=now(),version=public.tasks.version+1
    returning id into task_row_id;
    if old_payload is distinct from safe_payload then
      insert into public.task_events(task_id,actor_id,event_type,payload)
      values(task_row_id,caller.id,'prototype_sync',jsonb_build_object('legacy_key',record_key));
    end if;
    task_count := task_count+1;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(workspace->'knowledge','[]'::jsonb)) loop
    dept:=upper(coalesce(item->>'dept','')); record_key:=left(coalesce(item->>'id',''),80);
    manager:=caller.role in ('exec','admin') or public.can_manage_department(dept);
    if not manager then continue; end if;
    select t.id into task_row_id from public.tasks t where t.legacy_key=item->>'from';
    insert into public.knowledge_articles(
      source_task_id,department_code,title,problem,solution,status,created_by,approved_by,
      legacy_key,prototype_payload,updated_at
    ) values (
      task_row_id,dept,coalesce(item->>'title',record_key),coalesce(item->>'problem',''),
      coalesce(item->>'solution',''),'published',caller.id,caller.id,record_key,item,now()
    ) on conflict (legacy_key) where legacy_key is not null do update set
      source_task_id=excluded.source_task_id,department_code=excluded.department_code,title=excluded.title,
      problem=excluded.problem,solution=excluded.solution,status='published',approved_by=caller.id,
      prototype_payload=excluded.prototype_payload,updated_at=now();
    knowledge_count:=knowledge_count+1;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(workspace->'sops','[]'::jsonb)) loop
    dept:=upper(coalesce(item->>'dept','')); record_key:=left(coalesce(item->>'id',''),80);
    manager:=caller.role in ('exec','admin') or public.can_manage_department(dept);
    if not manager then continue; end if;
    insert into public.sops(department_code,title,status,created_by,legacy_key,prototype_payload)
    values(dept,coalesce(item->>'title',record_key),'published',caller.id,record_key,item)
    on conflict (legacy_key) where legacy_key is not null do update set
      department_code=excluded.department_code,title=excluded.title,status='published',
      prototype_payload=excluded.prototype_payload
    returning id into task_row_id;
    insert into public.sop_versions(sop_id,version,content,approved_by,approved_at)
    values(task_row_id,1,item,caller.id,now())
    on conflict(sop_id,version) do update set content=excluded.content,approved_by=caller.id,approved_at=now();
    sop_count:=sop_count+1;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(workspace->'kpi_definitions','[]'::jsonb)) loop
    dept:=upper(coalesce(item->>'dept','')); record_key:=left(coalesce(item->>'key',''),80);
    manager:=caller.role in ('exec','admin') or public.can_manage_department(dept);
    if not manager then continue; end if;
    insert into public.kpi_definitions(
      department_code,name,target,weight,formula,source,legacy_key,prototype_payload
    ) values (
      dept,coalesce(item->'item'->>'n',record_key),coalesce((item->'item'->>'tgt')::numeric,100),
      coalesce((item->'item'->>'w')::numeric,0.2),'prototype achievement formula','Company Hub',
      record_key,item
    ) on conflict (legacy_key) where legacy_key is not null do update set
      department_code=excluded.department_code,name=excluded.name,target=excluded.target,weight=excluded.weight,
      prototype_payload=excluded.prototype_payload,active=true
    returning id into definition_row_id;
    if item->'item'->>'ac' is not null then
      insert into public.kpi_results(definition_id,period_start,period_end,actual,status,entered_by,approved_by,approved_at)
      values(definition_row_id,period_first,period_last,(item->'item'->>'ac')::numeric,'approved',caller.id,caller.id,now())
      on conflict(definition_id,period_start,period_end) do update set
        actual=excluded.actual,status='approved',entered_by=caller.id,approved_by=caller.id,
        approved_at=now(),version=public.kpi_results.version+1;
    end if;
    kpi_count:=kpi_count+1;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(workspace->'kpi_actuals','[]'::jsonb)) loop
    select d.id,d.department_code into definition_row_id,dept from public.kpi_definitions d where d.legacy_key=item->>'key';
    if definition_row_id is null then continue; end if;
    manager:=caller.role in ('exec','admin') or public.can_manage_department(dept);
    if not manager then continue; end if;
    insert into public.kpi_results(definition_id,period_start,period_end,actual,status,entered_by)
    values(definition_row_id,period_first,period_last,(item->>'actual')::numeric,'draft',caller.id)
    on conflict(definition_id,period_start,period_end) do update set
      actual=excluded.actual,status='draft',entered_by=caller.id,approved_by=null,approved_at=null,
      version=public.kpi_results.version+1;
  end loop;

  return jsonb_build_object('tasks',task_count,'knowledge',knowledge_count,'sops',sop_count,'kpis',kpi_count);
end
$$;

create or replace function public.bootstrap_normalized_workspace(seed jsonb)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare caller_role public.company_role; legacy jsonb; result jsonb;
begin
  select role into caller_role from public.profiles where id=auth.uid() and active;
  if caller_role not in ('exec','admin') then raise exception 'access admin required'; end if;
  select data into legacy from public.company_hub_state where id='main' for update;
  legacy:=coalesce(legacy,'{}'::jsonb);
  if jsonb_array_length(coalesce(legacy->'TASKS','[]'::jsonb))>0 then
    insert into public.company_hub_legacy_archive(archived_by,payload) values(auth.uid(),legacy);
  end if;
  result:=public.sync_normalized_workspace(jsonb_build_object(
    'tasks',coalesce(legacy->'TASKS','[]'::jsonb),
    'knowledge',coalesce(legacy->'KB','[]'::jsonb),
    'sops',coalesce(seed->'sops','[]'::jsonb),
    'kpi_definitions',coalesce(seed->'kpi_definitions','[]'::jsonb)
  ));
  update public.company_hub_state set
    data=legacy-'TASKS'-'KB'-'KPI_ACT',updated_at=now(),updated_by=auth.uid()::text
  where id='main';
  return result;
end
$$;

revoke all on function public.sync_normalized_workspace(jsonb) from public;
revoke all on function public.bootstrap_normalized_workspace(jsonb) from public;
grant execute on function public.sync_normalized_workspace(jsonb) to authenticated;
grant execute on function public.bootstrap_normalized_workspace(jsonb) to authenticated;

-- After cutover the shared blob contains only collaboration/preferences, never
-- task, SOP, knowledge, or KPI records.
drop policy if exists "company hub authenticated read" on public.company_hub_state;
create policy "company hub authenticated read" on public.company_hub_state for select to authenticated
using (true);
