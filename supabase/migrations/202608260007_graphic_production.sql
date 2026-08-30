-- Graphic Production: brief intake, production board, review cycle and Trello import.

create table if not exists public.graphic_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  workstream text not null default 'center',
  trello_board_id text unique,
  trello_url text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_jobs (
  id uuid primary key default gen_random_uuid(),
  job_no bigint generated always as identity unique,
  department_code text not null default 'GRAPHIC' references public.departments(code),
  project_id uuid references public.graphic_projects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  brief text not null default '',
  work_type text not null default 'general',
  status text not null default 'intake'
    check (status in ('intake','brief','doing','review','revision','monthly','done')),
  priority text not null default 'mid'
    check (priority in ('low','mid','high','urgent')),
  requester_name text not null default '',
  assignee_name text not null default '',
  assignee_id uuid references public.profiles(id) on delete set null,
  reviewer_name text not null default '',
  due_at timestamptz,
  quantity integer not null default 1 check (quantity > 0),
  dimensions text not null default '',
  channel text not null default '',
  revision_count integer not null default 0 check (revision_count >= 0),
  source text not null default 'Company Hub',
  trello_card_id text unique,
  trello_list_id text,
  trello_url text not null default '',
  source_payload jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references public.profiles(id),
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.graphic_jobs(id) on delete cascade,
  name text not null default '',
  url text not null,
  file_type text not null default 'reference'
    check (file_type in ('reference','working','final')),
  source_id text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (job_id, source_id)
);

create table if not exists public.graphic_job_checklist_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.graphic_jobs(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position numeric not null default 0,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, source_id)
);

create table if not exists public.graphic_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.graphic_jobs(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  note text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists graphic_jobs_status_due_idx on public.graphic_jobs(status,due_at);
create index if not exists graphic_jobs_project_idx on public.graphic_jobs(project_id,updated_at desc);
create index if not exists graphic_job_events_job_idx on public.graphic_job_events(job_id,created_at desc);

create or replace function public.touch_graphic_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists graphic_projects_touch_updated_at on public.graphic_projects;
create trigger graphic_projects_touch_updated_at before update on public.graphic_projects
for each row execute function public.touch_graphic_updated_at();
drop trigger if exists graphic_jobs_touch_updated_at on public.graphic_jobs;
create trigger graphic_jobs_touch_updated_at before update on public.graphic_jobs
for each row execute function public.touch_graphic_updated_at();
drop trigger if exists graphic_checklist_touch_updated_at on public.graphic_job_checklist_items;
create trigger graphic_checklist_touch_updated_at before update on public.graphic_job_checklist_items
for each row execute function public.touch_graphic_updated_at();

alter table public.graphic_projects enable row level security;
alter table public.graphic_jobs enable row level security;
alter table public.graphic_job_files enable row level security;
alter table public.graphic_job_checklist_items enable row level security;
alter table public.graphic_job_events enable row level security;

create policy "read visible graphic projects" on public.graphic_projects for select to authenticated
using (public.can_view_department('GRAPHIC'));
create policy "manage graphic projects" on public.graphic_projects for all to authenticated
using (public.can_manage_department('GRAPHIC')) with check (public.can_manage_department('GRAPHIC'));

create policy "read visible graphic jobs" on public.graphic_jobs for select to authenticated
using (public.can_view_department(department_code));
create policy "create visible graphic jobs" on public.graphic_jobs for insert to authenticated
with check (created_by=auth.uid() and public.can_view_department(department_code));
create policy "update assigned or managed graphic jobs" on public.graphic_jobs for update to authenticated
using (assignee_id=auth.uid() or created_by=auth.uid() or public.can_manage_department(department_code))
with check (assignee_id=auth.uid() or created_by=auth.uid() or public.can_manage_department(department_code));
create policy "delete managed graphic jobs" on public.graphic_jobs for delete to authenticated
using (public.can_manage_department(department_code));

create policy "read graphic files" on public.graphic_job_files for select to authenticated
using (exists(select 1 from public.graphic_jobs j where j.id=job_id));
create policy "write graphic files" on public.graphic_job_files for insert to authenticated
with check (created_by=auth.uid() and exists(select 1 from public.graphic_jobs j where j.id=job_id));
create policy "manage graphic files" on public.graphic_job_files for update to authenticated
using (exists(select 1 from public.graphic_jobs j where j.id=job_id and (j.assignee_id=auth.uid() or j.created_by=auth.uid() or public.can_manage_department(j.department_code))))
with check (exists(select 1 from public.graphic_jobs j where j.id=job_id and (j.assignee_id=auth.uid() or j.created_by=auth.uid() or public.can_manage_department(j.department_code))));
create policy "delete graphic files" on public.graphic_job_files for delete to authenticated
using (exists(select 1 from public.graphic_jobs j where j.id=job_id and (j.created_by=auth.uid() or public.can_manage_department(j.department_code))));

create policy "read graphic checklist" on public.graphic_job_checklist_items for select to authenticated
using (exists(select 1 from public.graphic_jobs j where j.id=job_id));
create policy "write graphic checklist" on public.graphic_job_checklist_items for all to authenticated
using (exists(select 1 from public.graphic_jobs j where j.id=job_id and (j.assignee_id=auth.uid() or j.created_by=auth.uid() or public.can_manage_department(j.department_code))))
with check (exists(select 1 from public.graphic_jobs j where j.id=job_id and (j.assignee_id=auth.uid() or j.created_by=auth.uid() or public.can_manage_department(j.department_code))));

create policy "read graphic events" on public.graphic_job_events for select to authenticated
using (exists(select 1 from public.graphic_jobs j where j.id=job_id));
create policy "append graphic events" on public.graphic_job_events for insert to authenticated
with check (actor_id=auth.uid() and exists(select 1 from public.graphic_jobs j where j.id=job_id));

create or replace function public.graphic_status_from_trello(list_name text)
returns text language sql immutable as $$
  select case
    when lower(coalesce(list_name,'')) ~ 'done|เสร็จ|ดำเนินการแล้ว' then 'done'
    when lower(coalesce(list_name,'')) ~ 'monthly|รายเดือน|ประจำเดือน' then 'monthly'
    when lower(coalesce(list_name,'')) ~ 'revision|แก้ไข|แก้งาน' then 'revision'
    when lower(coalesce(list_name,'')) ~ 'review|ตรวจ|ส่งงาน' then 'review'
    when lower(coalesce(list_name,'')) ~ 'doing|กำลังทำ' then 'doing'
    when lower(coalesce(list_name,'')) ~ 'marketing|การตลาด' then 'brief'
    else 'intake' end
$$;

create or replace function public.move_graphic_job(target_job uuid, next_status text, event_note text default '')
returns public.graphic_jobs language plpgsql security definer set search_path=public as $$
declare current_job public.graphic_jobs%rowtype; result public.graphic_jobs%rowtype;
begin
  if next_status not in ('intake','brief','doing','review','revision','monthly','done') then raise exception 'invalid status'; end if;
  select * into current_job from public.graphic_jobs where id=target_job;
  if current_job.id is null then raise exception 'job not found'; end if;
  if not (current_job.assignee_id=auth.uid() or current_job.created_by=auth.uid() or public.can_manage_department(current_job.department_code)) then raise exception 'permission denied'; end if;
  update public.graphic_jobs set status=next_status,
    revision_count=revision_count + case when next_status='revision' and status<>'revision' then 1 else 0 end,
    started_at=case when next_status='doing' then coalesce(started_at,now()) else started_at end,
    submitted_at=case when next_status='review' then now() else submitted_at end,
    completed_at=case when next_status='done' then now() else null end
  where id=target_job returning * into result;
  insert into public.graphic_job_events(job_id,actor_id,event_type,note,payload)
  values(target_job,auth.uid(),'status_changed',left(coalesce(event_note,''),2000),jsonb_build_object('from',current_job.status,'to',next_status));
  return result;
end $$;

create or replace function public.import_trello_graphic_board(board_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare board_id text; board_name text; project_row uuid; list_row jsonb; card_row jsonb;
  checklist_row jsonb; item_row jsonb; attachment_row jsonb; job_row uuid; list_name text;
  list_names jsonb := '{}'::jsonb; imported integer := 0; checklist_count integer := 0; file_count integer := 0;
begin
  if not public.can_manage_department('GRAPHIC') then raise exception 'GRAPHIC manager permission required'; end if;
  if pg_column_size(board_payload)>20971520 then raise exception 'Trello export is larger than 20 MB'; end if;
  board_id:=left(coalesce(nullif(board_payload->>'shortLink',''),board_payload->>'id',''),120); board_name:=left(coalesce(board_payload->>'name',''),200);
  if board_id='' or board_name='' then raise exception 'invalid Trello board export'; end if;
  insert into public.graphic_projects(name,workstream,trello_board_id,trello_url)
  values(board_name,case when lower(board_name) like '%ui%' then 'ui' when lower(board_name) like '%rca%' then 'rca' else 'center' end,board_id,coalesce(board_payload->>'url',''))
  on conflict(trello_board_id) do update set name=excluded.name,workstream=excluded.workstream,trello_url=excluded.trello_url,active=true
  returning id into project_row;
  for list_row in select value from jsonb_array_elements(coalesce(board_payload->'lists','[]'::jsonb)) loop
    list_names:=list_names || jsonb_build_object(list_row->>'id',list_row->>'name');
  end loop;
  for card_row in select value from jsonb_array_elements(coalesce(board_payload->'cards','[]'::jsonb)) loop
    if coalesce((card_row->>'closed')::boolean,false) then continue; end if;
    list_name:=coalesce(list_names->>(card_row->>'idList'),'');
    insert into public.graphic_jobs(project_id,title,brief,status,priority,requester_name,due_at,source,trello_card_id,trello_list_id,trello_url,source_payload,created_by)
    values(project_row,left(coalesce(nullif(card_row->>'name',''),'งานจาก Trello'),300),coalesce(card_row->>'desc',''),public.graphic_status_from_trello(list_name),
      case when coalesce(card_row->'labels','[]'::jsonb)::text ~* 'urgent|\u0e14\u0e48\u0e27\u0e19' then 'urgent' else 'mid' end,
      board_name,case when coalesce(card_row->>'due','')='' then null else (card_row->>'due')::timestamptz end,'Trello',left(card_row->>'id',160),card_row->>'idList',coalesce(card_row->>'url',''),card_row,auth.uid())
    on conflict(trello_card_id) do update set project_id=excluded.project_id,title=excluded.title,brief=excluded.brief,status=excluded.status,due_at=excluded.due_at,trello_list_id=excluded.trello_list_id,trello_url=excluded.trello_url,source_payload=excluded.source_payload
    returning id into job_row;
    imported:=imported+1;
    for attachment_row in select value from jsonb_array_elements(coalesce(card_row->'attachments','[]'::jsonb)) loop
      if coalesce(attachment_row->>'url','')<>'' then
        insert into public.graphic_job_files(job_id,name,url,file_type,source_id,created_by)
        values(job_row,left(coalesce(attachment_row->>'name','ไฟล์จาก Trello'),300),attachment_row->>'url','reference',left(attachment_row->>'id',160),auth.uid())
        on conflict(job_id,source_id) do update set name=excluded.name,url=excluded.url;
        file_count:=file_count+1;
      end if;
    end loop;
  end loop;
  for checklist_row in select value from jsonb_array_elements(coalesce(board_payload->'checklists','[]'::jsonb)) loop
    select id into job_row from public.graphic_jobs where trello_card_id=checklist_row->>'idCard';
    if job_row is null then continue; end if;
    for item_row in select value from jsonb_array_elements(coalesce(checklist_row->'checkItems','[]'::jsonb)) loop
      insert into public.graphic_job_checklist_items(job_id,title,done,position,source_id)
      values(job_row,left(coalesce(item_row->>'name','รายการ'),500),item_row->>'state'='complete',coalesce((item_row->>'pos')::numeric,0),left(item_row->>'id',160))
      on conflict(job_id,source_id) do update set title=excluded.title,done=excluded.done,position=excluded.position;
      checklist_count:=checklist_count+1;
    end loop;
  end loop;
  insert into public.graphic_job_events(job_id,actor_id,event_type,note,payload)
  select j.id,auth.uid(),'trello_import','',jsonb_build_object('board_id',board_id) from public.graphic_jobs j where j.project_id=project_row and j.source='Trello'
  and not exists(select 1 from public.graphic_job_events e where e.job_id=j.id and e.event_type='trello_import');
  return jsonb_build_object('project_id',project_row,'board',board_name,'jobs',imported,'checklist_items',checklist_count,'files',file_count);
end $$;

grant select,insert,update,delete on public.graphic_projects,public.graphic_jobs,public.graphic_job_files,public.graphic_job_checklist_items to authenticated;
grant select,insert on public.graphic_job_events to authenticated;
grant usage,select on sequence public.graphic_jobs_job_no_seq to authenticated;
grant execute on function public.move_graphic_job(uuid,text,text) to authenticated;
grant execute on function public.import_trello_graphic_board(jsonb) to authenticated;

insert into public.graphic_projects(name,workstream,trello_board_id,trello_url) values
  ('(7M) JAMEMIE (UI)','ui','ZhzWqtn1','https://trello.com/b/ZhzWqtn1'),
  ('(center) Hanbyul','center','7N1UIMLb','https://trello.com/b/7N1UIMLb'),
  ('(Center) JAMEMIE','center','Zq1VivwS','https://trello.com/b/Zq1VivwS'),
  ('(center) P','center','4AOOFsQ8','https://trello.com/b/4AOOFsQ8'),
  ('(center) S','center','QUcmFooZ','https://trello.com/b/QUcmFooZ'),
  ('(center) tangmo','center','CsxQxBKh','https://trello.com/b/CsxQxBKh'),
  ('(center) JK','center','adzpIT5G','https://trello.com/b/adzpIT5G'),
  ('(RCA) JAMEMIE','rca','HOoRkBHO','https://trello.com/b/HOoRkBHO')
on conflict(trello_board_id) do update set name=excluded.name,workstream=excluded.workstream,trello_url=excluded.trello_url;

comment on table public.graphic_jobs is 'End-to-end Graphic Production jobs with department RLS and Trello source identity.';
