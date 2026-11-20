-- Resolve the display name of a task creator without exposing the whole staff
-- directory.  The rows returned here are limited to tasks the caller can
-- already read, including older tasks that do not contain a creator snapshot.

create or replace function public.visible_task_creator_directory()
returns table(
  id uuid,
  display_name text,
  position_title text,
  department_code text
)
language sql
stable
security definer
set search_path=public
as $$
  select distinct p.id,p.display_name,p.position_title,p.department_code
  from public.tasks t
  join public.profiles p on p.id=t.creator_id
  where t.creator_id=auth.uid()
     or public.can_manage_department(t.department_code)
     or public.is_task_assignee(t.id)
     or public.can_view_department(t.department_code)
$$;

revoke all on function public.visible_task_creator_directory() from public;
grant execute on function public.visible_task_creator_directory() to authenticated;
