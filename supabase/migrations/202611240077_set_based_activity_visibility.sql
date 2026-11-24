-- Resolve activity-page statement timeouts for non-admin users.
--
-- The previous SELECT policies called can_read_daily_activity() once per row
-- on four independently paginated tables.  That helper re-read the caller,
-- activity and assignments every time, so department leads could exceed the
-- database statement timeout even though their access was valid.  Calculate
-- the caller's complete visible activity-id set once per statement instead.

create or replace function public.visible_daily_activity_ids()
returns table(activity_id bigint)
language sql
stable
security definer
set search_path=public
as $$
  with caller as materialized (
    select p.id,p.role,p.department_code
    from public.profiles p
    where p.id=auth.uid() and p.active
  ),
  caller_departments as materialized (
    select c.department_code
    from caller c
    where c.department_code is not null
    union
    select pd.department_code
    from public.profile_departments pd
    join caller c on c.id=pd.profile_id
  ),
  assigned_activities as materialized (
    select distinct a.activity_id
    from public.activity_assignees a
    cross join caller c
    where a.profile_id=c.id
       or (
         a.assignment_type='department'
         and exists(
           select 1
           from caller_departments cd
           where cd.department_code=a.department_code
         )
       )
  )
  select d.id
  from public.daily_activities d
  cross join caller c
  where d.is_active and (
    d.employee_id=c.id
    or c.role in ('exec','admin')
    or (
      c.role='lead'
      and exists(
        select 1
        from caller_departments cd
        where cd.department_code=d.department_code
      )
    )
    or (
      c.department_code='BOM'
      and d.department_code in ('ADMIN','CRM','SC')
      and exists(
        select 1
        from public.profile_departments pd
        where pd.profile_id=c.id
          and pd.department_code=d.department_code
      )
    )
    or exists(
      select 1
      from assigned_activities aa
      where aa.activity_id=d.id
    )
  )
$$;

revoke all on function public.visible_daily_activity_ids() from public;
grant execute on function public.visible_daily_activity_ids() to authenticated;

-- Change one relation per transaction.  Activity loading touches the parent
-- and child tables concurrently; holding DDL locks on multiple relations in a
-- single transaction can deadlock with those live reads.
begin;
drop policy if exists "read visible daily activities" on public.daily_activities;
create policy "read visible daily activities" on public.daily_activities
for select to authenticated
using (id in (select activity_id from public.visible_daily_activity_ids()));
commit;

begin;
drop policy if exists "read visible activity assignees" on public.activity_assignees;
create policy "read visible activity assignees" on public.activity_assignees
for select to authenticated
using (activity_id in (select activity_id from public.visible_daily_activity_ids()));
commit;

begin;
drop policy if exists "activity participants read files" on public.activity_files;
create policy "activity participants read files" on public.activity_files
for select to authenticated
using (activity_id in (select activity_id from public.visible_daily_activity_ids()));
commit;

begin;
drop policy if exists "read visible activity work sessions" on public.activity_work_sessions;
create policy "read visible activity work sessions" on public.activity_work_sessions
for select to authenticated
using (activity_id in (select activity_id from public.visible_daily_activity_ids()));
commit;

comment on function public.visible_daily_activity_ids() is
  'Set-based activity visibility used by RLS to avoid per-row permission checks and statement timeouts.';
