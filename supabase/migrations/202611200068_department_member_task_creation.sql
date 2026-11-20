-- Allow every active member to create work in departments they can see.
-- Staff-created work remains self-assigned; managers retain department-wide
-- assignment control. This keeps creation available to non-manager positions
-- without allowing staff to assign or modify another employee's work.
begin;

drop policy if exists "leaders create tasks" on public.tasks;
drop policy if exists "members create tasks in visible departments" on public.tasks;
create policy "members create tasks in visible departments"
on public.tasks for insert to authenticated
with check (
  creator_id=auth.uid()
  and public.can_view_department(department_code)
);

create or replace function public.can_manage_task_assignment(target_task uuid,target_user uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id=target_task and (
      public.can_manage_department(t.department_code)
      or (t.creator_id=auth.uid() and target_user=auth.uid())
    )
  )
$$;

revoke all on function public.can_manage_task_assignment(uuid,uuid) from public;
grant execute on function public.can_manage_task_assignment(uuid,uuid) to authenticated;

drop policy if exists "leaders manage assignments" on public.task_assignees;
drop policy if exists "managers or self creators manage assignments" on public.task_assignees;
create policy "managers or self creators manage assignments"
on public.task_assignees for all to authenticated
using (public.can_manage_task_assignment(task_id,user_id))
with check (public.can_manage_task_assignment(task_id,user_id));

commit;
