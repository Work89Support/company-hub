-- Link daily supervision to real Company Hub entries across activities, issues and board tasks.
begin;

drop function if exists public.daily_supervision_rows(date);
create function public.daily_supervision_rows(p_work_date date default ((now() at time zone 'Asia/Bangkok')::date))
returns table(
  profile_id uuid,display_name text,email text,department_code text,position_title text,
  last_seen_at timestamptz,last_page text,is_online boolean,activity_count bigint,
  completed_activity_count bigint,open_task_count bigint,completed_task_count bigint,
  review_status text,review_note text,reviewer_name text,reviewed_at timestamptz,
  issue_count bigint,created_task_count bigint,entry_count bigint,completed_entry_count bigint,
  latest_entry_at timestamptz
) language sql stable security definer set search_path=public as $$
  with me as (select * from public.profiles where id=auth.uid() and active),
  people as (
    select p.* from public.profiles p,me
    where p.active and (
      p.id=auth.uid()
      or me.role in ('admin','exec')
      or (me.role='lead' and public.can_manage_department(p.department_code))
    )
  ), activity_entries as (
    select d.created_by employee_id,count(*) activity_count,
      count(*) filter(where lower(coalesce(d.status,'')) like '%completed%' or d.status ilike '%เสร็จ%') completed_count,
      max(d.created_at) latest_at
    from public.daily_activities d
    where d.source='Company Hub' and d.created_by is not null and d.is_active
      and (d.created_at at time zone 'Asia/Bangkok')::date=p_work_date
      and coalesce(d.activity,'') not ilike '%ทดสอบ%'
    group by d.created_by
  ), issue_entries as (
    select i.created_by employee_id,count(*) issue_count,
      count(*) filter(where lower(coalesce(i.status,'')) in ('closed','resolved','done','complete','completed') or i.status ilike '%ปิด%' or i.status ilike '%เสร็จ%') completed_count,
      max(i.created_at) latest_at
    from public.operational_issues i
    where i.source='Company Hub' and i.created_by is not null
      and (i.created_at at time zone 'Asia/Bangkok')::date=p_work_date
      and coalesce(i.problem,'') not ilike '%ทดสอบ%'
    group by i.created_by
  ), created_tasks as (
    select t.creator_id employee_id,count(*) created_task_count,
      count(*) filter(where t.status='done') completed_count,max(t.created_at) latest_at
    from public.tasks t
    where t.creator_id is not null and (t.created_at at time zone 'Asia/Bangkok')::date=p_work_date
      and coalesce(t.title,'') not ilike '%ทดสอบ%'
    group by t.creator_id
  ), assigned_task_counts as (
    select ta.user_id employee_id,
      count(distinct t.id) filter(where t.status<>'done') open_count,
      count(distinct t.id) filter(where t.status='done') completed_count
    from public.tasks t join public.task_assignees ta on ta.task_id=t.id
    where (t.updated_at at time zone 'Asia/Bangkok')::date=p_work_date
    group by ta.user_id
  )
  select p.id,p.display_name,p.email,p.department_code,p.position_title,ep.last_seen_at,ep.last_page,
    coalesce(ep.last_seen_at>now()-interval '3 minutes',false),
    coalesce(a.activity_count,0),coalesce(a.completed_count,0),
    coalesce(tc.open_count,0),coalesce(tc.completed_count,0),r.status,r.note,reviewer.display_name,r.reviewed_at,
    coalesce(i.issue_count,0),coalesce(ct.created_task_count,0),
    coalesce(a.activity_count,0)+coalesce(i.issue_count,0)+coalesce(ct.created_task_count,0),
    coalesce(a.completed_count,0)+coalesce(i.completed_count,0)+coalesce(ct.completed_count,0),
    greatest(a.latest_at,i.latest_at,ct.latest_at)
  from people p
  left join public.employee_presence ep on ep.profile_id=p.id
  left join activity_entries a on a.employee_id=p.id
  left join issue_entries i on i.employee_id=p.id
  left join created_tasks ct on ct.employee_id=p.id
  left join assigned_task_counts tc on tc.employee_id=p.id
  left join public.daily_work_reviews r on r.employee_id=p.id and r.department_code=p.department_code and r.work_date=p_work_date
  left join public.profiles reviewer on reviewer.id=r.reviewer_id
  order by p.department_code,p.display_name,p.email
$$;

create or replace function public.daily_supervision_entries(p_work_date date,p_employee uuid)
returns table(
  entry_type text,entry_id text,title text,detail text,status text,department_code text,
  occurred_at timestamptz,route_id text
) language plpgsql stable security definer set search_path=public as $$
declare caller public.profiles; target public.profiles;
begin
  select * into caller from public.profiles where id=auth.uid() and active;
  select * into target from public.profiles where id=p_employee and active;
  if caller.id is null or target.id is null then raise exception 'profile not found'; end if;
  if caller.id<>target.id and caller.role not in ('admin','exec') and not (caller.role='lead' and public.can_manage_department(target.department_code)) then
    raise exception 'permission denied';
  end if;
  return query
    select e.entry_type,e.entry_id,e.title,e.detail,e.entry_status,e.entry_department,e.entry_occurred_at,e.route_id
    from (
    select 'activity'::text as entry_type,d.id::text as entry_id,d.activity as title,
      concat_ws(' · ',nullif(d.category,''),nullif(d.result_note,''),nullif(d.operational_issue,'')) as detail,
      coalesce(d.status,'') as entry_status,d.department_code as entry_department,d.created_at as entry_occurred_at,d.id::text as route_id
    from public.daily_activities d
    where d.source='Company Hub' and d.created_by=p_employee and d.is_active
      and (d.created_at at time zone 'Asia/Bangkok')::date=p_work_date
      and coalesce(d.activity,'') not ilike '%ทดสอบ%'
    union all
    select 'issue'::text,i.id,i.problem,
      concat_ws(' · ',nullif(i.category,''),nullif(i.project_code,''),nullif(i.solution,'')),
      coalesce(i.status,''),i.department_code,i.created_at,i.id
    from public.operational_issues i
    where i.source='Company Hub' and i.created_by=p_employee
      and (i.created_at at time zone 'Asia/Bangkok')::date=p_work_date
      and coalesce(i.problem,'') not ilike '%ทดสอบ%'
    union all
    select 'task'::text,t.id::text,t.title,coalesce(t.description,''),t.status::text,t.department_code,t.created_at,'T-'||t.task_no::text
    from public.tasks t
    where t.creator_id=p_employee and (t.created_at at time zone 'Asia/Bangkok')::date=p_work_date
      and coalesce(t.title,'') not ilike '%ทดสอบ%'
    ) e
    order by e.entry_occurred_at desc;
end
$$;

revoke all on function public.daily_supervision_rows(date),public.daily_supervision_entries(date,uuid) from public;
grant execute on function public.daily_supervision_rows(date),public.daily_supervision_entries(date,uuid) to authenticated;

comment on function public.daily_supervision_entries(date,uuid) is 'Real Company Hub activity, issue and task entries for one employee and Bangkok work date, excluding test-labelled rows.';
commit;
