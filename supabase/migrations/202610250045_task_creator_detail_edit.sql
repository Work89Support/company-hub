-- Only the task creator may change the task title or description.
-- Managers keep their existing status, deadline, priority and assignment controls.
begin;

create or replace function public.enforce_task_creator_details()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.creator_id is distinct from old.creator_id then
    raise exception using errcode='42501',message='task creator cannot be changed';
  end if;
  if (new.title is distinct from old.title or new.description is distinct from old.description)
     and auth.uid() is not null and auth.uid()<>old.creator_id then
    raise exception using errcode='42501',message='only the task creator can edit title or description';
  end if;
  return new;
end $$;

drop trigger if exists task_creator_details_guard on public.tasks;
create trigger task_creator_details_guard before update on public.tasks
for each row execute function public.enforce_task_creator_details();

create or replace function public.update_own_task_details(p_task uuid,p_title text,p_description text default '')
returns public.tasks language plpgsql security definer set search_path=public as $$
declare clean_title text:=trim(coalesce(p_title,'')); clean_description text:=trim(coalesce(p_description,'')); out_row public.tasks;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and active) then
    raise exception using errcode='42501',message='active account required';
  end if;
  if clean_title='' or char_length(clean_title)>300 then raise exception 'title must contain 1 to 300 characters'; end if;
  if char_length(clean_description)>20000 then raise exception 'description must not exceed 20000 characters'; end if;
  update public.tasks set title=clean_title,description=clean_description,updated_at=now(),version=version+1
  where id=p_task and creator_id=auth.uid()
  returning * into out_row;
  if out_row.id is null then raise exception using errcode='42501',message='only the task creator can edit title or description'; end if;
  return out_row;
end $$;

revoke all on function public.update_own_task_details(uuid,text,text) from public;
grant execute on function public.update_own_task_details(uuid,text,text) to authenticated;
comment on function public.update_own_task_details(uuid,text,text) is 'Edits title and description only when auth.uid is the task creator.';
commit;
