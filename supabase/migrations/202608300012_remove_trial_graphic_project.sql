-- Remove the retired trial Graphic board and prevent it from being imported again.

do $$
declare
  trial_projects uuid[];
  removed_jobs integer := 0;
begin
  select coalesce(array_agg(id),'{}'::uuid[])
    into trial_projects
  from public.graphic_projects
  where trello_board_id='WpmJKvNo'
     or lower(trim(name))='(center) ทดลอง';

  delete from public.graphic_jobs
  where project_id=any(trial_projects);
  get diagnostics removed_jobs = row_count;

  delete from public.graphic_projects
  where id=any(trial_projects);

  raise notice 'Removed trial Graphic project(s) and % related job(s)',removed_jobs;
end $$;

create or replace function public.reject_retired_graphic_project()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.trello_board_id='WpmJKvNo'
     or lower(trim(new.name))='(center) ทดลอง' then
    raise exception 'The retired trial Graphic project cannot be imported';
  end if;
  return new;
end $$;

drop trigger if exists reject_retired_graphic_project_trigger on public.graphic_projects;
create trigger reject_retired_graphic_project_trigger
before insert or update on public.graphic_projects
for each row execute function public.reject_retired_graphic_project();

comment on function public.reject_retired_graphic_project() is
  'Blocks the retired Trello trial board WpmJKvNo from Graphic Production.';
