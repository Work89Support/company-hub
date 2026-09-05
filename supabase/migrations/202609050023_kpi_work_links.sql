-- KPI evidence is an association with real work, not an automatic KPI score.
begin;
create table public.kpi_work_links (
 id bigint generated always as identity primary key,
 definition_id uuid not null references public.kpi_definitions(id),
 activity_id bigint references public.daily_activities(id),
 task_id uuid references public.tasks(id),
 graphic_job_id uuid references public.graphic_jobs(id),
 issue_id text references public.operational_issues(id),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 check(num_nonnulls(activity_id,task_id,graphic_job_id,issue_id)=1)
);
create unique index kpi_activity_unique on public.kpi_work_links(definition_id,activity_id);
create unique index kpi_task_unique on public.kpi_work_links(definition_id,task_id);
create unique index kpi_graphic_unique on public.kpi_work_links(definition_id,graphic_job_id);
create unique index kpi_issue_unique on public.kpi_work_links(definition_id,issue_id);
-- Invoker functions respect the source tables' existing row visibility.
create function public.kpi_work_department(a bigint,t uuid,g uuid,i text,editing boolean default false)
returns text language sql stable security invoker set search_path=public as $$
 select department_code from (
  select department_code from daily_activities where id=a and is_active and
   (not editing or employee_id=auth.uid() or can_manage_department(department_code))
  union all select department_code from tasks where id=t and
   (not editing or can_manage_department(department_code) or exists(select 1 from task_assignees where task_id=t and user_id=auth.uid()))
  union all select department_code from graphic_jobs where id=g and
   (not editing or assignee_id=auth.uid() or created_by=auth.uid() or can_manage_department(department_code))
  union all select department_code from operational_issues where id=i and
   (not editing or created_by=auth.uid() or can_manage_department(department_code))
 ) work limit 1
$$;
revoke all on function public.kpi_work_department(bigint,uuid,uuid,text,boolean) from public;
grant execute on function public.kpi_work_department(bigint,uuid,uuid,text,boolean) to authenticated;
alter table public.kpi_work_links enable row level security;
create policy "read visible work KPI links" on public.kpi_work_links for select to authenticated
 using(public.kpi_work_department(activity_id,task_id,graphic_job_id,issue_id,false) is not null);
create policy "tag owned work with department KPI" on public.kpi_work_links for insert to authenticated
 with check(created_by=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and active)
 and exists(select 1 from public.kpi_definitions d where d.id=definition_id and d.active and
 d.department_code=public.kpi_work_department(activity_id,task_id,graphic_job_id,issue_id,true)));
create policy "remove tags from owned work" on public.kpi_work_links for delete to authenticated
 using(exists(select 1 from public.profiles where id=auth.uid() and active) and
 public.kpi_work_department(activity_id,task_id,graphic_job_id,issue_id,true) is not null);
grant select,insert,delete on public.kpi_work_links to authenticated;
grant usage,select on sequence public.kpi_work_links_id_seq to authenticated;
-- A transaction protects against partial saves and two editors overwriting tags.
create function public.save_work_kpi_tags(p_kind text,p_id text,p_expected uuid[],p_definitions uuid[])
returns setof public.kpi_work_links language plpgsql security invoker set search_path=public as $$
declare a bigint;t uuid;g uuid;i text;current_tags uuid[];wanted uuid[];dept text;
begin
 if not exists(select 1 from profiles where id=auth.uid() and active) then raise exception 'กรุณาเข้าสู่ระบบด้วยบัญชีที่เปิดใช้งาน';end if;
 if p_expected is null or p_definitions is null or cardinality(p_definitions)>30 then raise exception 'Invalid KPI selection';end if;
 case p_kind when 'activity' then a:=p_id::bigint;when 'task' then t:=p_id::uuid;
 when 'graphic' then g:=p_id::uuid;when 'issue' then i:=p_id;else raise exception 'Unknown work type';end case;
 perform pg_advisory_xact_lock(hashtextextended(p_kind||':'||p_id,0));
 dept:=public.kpi_work_department(a,t,g,i,true);
 if dept is null then raise exception 'ไม่มีสิทธิ์แท็ก KPI ในงานนี้';end if;
 select coalesce(array_agg(definition_id order by definition_id),'{}') into current_tags from kpi_work_links
 where activity_id=a or task_id=t or graphic_job_id=g or issue_id=i;
 if current_tags is distinct from (select coalesce(array_agg(x order by x),'{}') from unnest(p_expected) x) then
 raise exception 'แท็กถูกแก้ไขแล้ว กรุณาเปิดรายการใหม่';end if;
 select coalesce(array_agg(distinct x order by x),'{}') into wanted from unnest(p_definitions) x;
 if exists(select 1 from unnest(wanted) x where not exists(select 1 from kpi_definitions d where d.id=x and d.active and d.department_code=dept)) then
 raise exception 'กรุณาเลือก KPI ที่เปิดใช้งานของแผนกนี้';end if;
 delete from kpi_work_links where (activity_id=a or task_id=t or graphic_job_id=g or issue_id=i) and not(definition_id=any(wanted));
 insert into kpi_work_links(definition_id,activity_id,task_id,graphic_job_id,issue_id)
 select x,a,t,g,i from unnest(wanted) x where not(x=any(current_tags));
 return query select * from kpi_work_links where activity_id=a or task_id=t or graphic_job_id=g or issue_id=i;
end $$;
revoke all on function public.save_work_kpi_tags(text,text,uuid[],uuid[]) from public;
grant execute on function public.save_work_kpi_tags(text,text,uuid[],uuid[]) to authenticated;
commit;
