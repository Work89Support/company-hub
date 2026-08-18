-- Break the tasks <-> task_assignees RLS recursion introduced by policies
-- that selected from each other.  These narrow helpers run as the migration
-- owner and expose booleans only, so callers never bypass row-level access.

create or replace function public.can_view_department(target_department text)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id=auth.uid() and p.active and (
      p.role in ('exec','admin')
      or p.department_code=target_department
      or exists (
        select 1 from public.profile_departments pd
        where pd.profile_id=p.id and pd.department_code=target_department
      )
    )
  )
$$;

create or replace function public.is_task_assignee(target_task uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.task_assignees a
    where a.task_id=target_task and a.user_id=auth.uid()
  )
$$;

create or replace function public.can_manage_task(target_task uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id=target_task and public.can_manage_department(t.department_code)
  )
$$;

create or replace function public.can_view_task(target_task uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id=target_task and (
      t.creator_id=auth.uid()
      or public.can_manage_department(t.department_code)
      or public.is_task_assignee(t.id)
      or public.can_view_department(t.department_code)
    )
  )
$$;

revoke all on function public.can_view_department(text) from public;
revoke all on function public.is_task_assignee(uuid) from public;
revoke all on function public.can_manage_task(uuid) from public;
revoke all on function public.can_view_task(uuid) from public;
grant execute on function public.can_view_department(text) to authenticated;
grant execute on function public.is_task_assignee(uuid) to authenticated;
grant execute on function public.can_manage_task(uuid) to authenticated;
grant execute on function public.can_view_task(uuid) to authenticated;

drop policy if exists "read visible tasks" on public.tasks;
create policy "read visible tasks" on public.tasks for select to authenticated
using (
  creator_id=auth.uid()
  or public.can_manage_department(department_code)
  or public.is_task_assignee(id)
  or public.can_view_department(department_code)
);

drop policy if exists "read visible assignments" on public.task_assignees;
create policy "read visible assignments" on public.task_assignees for select to authenticated
using (public.can_view_task(task_id));

drop policy if exists "leaders manage assignments" on public.task_assignees;
create policy "leaders manage assignments" on public.task_assignees for all to authenticated
using (public.can_manage_task(task_id))
with check (public.can_manage_task(task_id));

drop policy if exists "read visible task events" on public.task_events;
create policy "read visible task events" on public.task_events for select to authenticated
using (public.can_view_task(task_id));

drop policy if exists "append own task events" on public.task_events;
create policy "append own task events" on public.task_events for insert to authenticated
with check (actor_id=auth.uid() and public.can_view_task(task_id));

drop policy if exists "read visible comments" on public.task_comments;
create policy "read visible comments" on public.task_comments for select to authenticated
using (public.can_view_task(task_id));

drop policy if exists "write own comments" on public.task_comments;
create policy "write own comments" on public.task_comments for insert to authenticated
with check (author_id=auth.uid() and public.can_view_task(task_id));

drop policy if exists "read visible time" on public.time_entries;
create policy "read visible time" on public.time_entries for select to authenticated
using (user_id=auth.uid() or public.can_manage_task(task_id));

drop policy if exists "write own time" on public.time_entries;
create policy "write own time" on public.time_entries for insert to authenticated
with check (user_id=auth.uid() and public.is_task_assignee(task_id));

