-- A visible editor of a Graphic Production card may delete it after explicit
-- confirmation in the UI. This covers the creator, direct/multi assignees and
-- department managers while preserving server-side enforcement through RLS.
begin;

drop policy if exists "delete managed graphic jobs" on public.graphic_jobs;
drop policy if exists "delete editable graphic jobs" on public.graphic_jobs;
create policy "delete editable graphic jobs" on public.graphic_jobs
for delete to authenticated
using (public.can_edit_graphic_job(id));

commit;
