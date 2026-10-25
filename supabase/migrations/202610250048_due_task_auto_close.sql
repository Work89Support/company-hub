-- Auto-close new/future tasks at their deadline while preserving already-overdue legacy work.
begin;

alter table public.tasks add column if not exists auto_close_enabled boolean not null default false;
update public.tasks set auto_close_enabled=true
 where status<>'done' and due_at is not null and due_at>clock_timestamp();
alter table public.tasks alter column auto_close_enabled set default true;

create or replace function public.enable_task_auto_close_on_due_change()
returns trigger language plpgsql set search_path=public
as $$
begin
  if new.due_at is not null and (tg_op='INSERT' or new.due_at is distinct from old.due_at) then
    new.auto_close_enabled:=true;
  end if;
  return new;
end
$$;
drop trigger if exists enable_task_auto_close_on_due_change on public.tasks;
create trigger enable_task_auto_close_on_due_change before insert or update of due_at on public.tasks
for each row execute function public.enable_task_auto_close_on_due_change();

alter table public.task_assignee_workspaces drop constraint if exists task_assignee_workspaces_status_check;
alter table public.task_assignee_workspaces add constraint task_assignee_workspaces_status_check
check (status in ('todo','doing','review','block','done'));

create or replace function public.update_my_task_workspace(p_task uuid,p_status text,p_progress integer,p_note text)
returns public.task_assignee_workspaces
language plpgsql security definer set search_path=public
as $$
declare result public.task_assignee_workspaces;
begin
  if p_status not in ('todo','doing','review','block','done') then raise exception 'invalid status'; end if;
  if p_progress not between 0 and 100 then raise exception 'invalid progress'; end if;
  if p_status='done' then p_progress:=100; end if;
  update public.task_assignee_workspaces
     set status=p_status,progress_percent=p_progress,update_note=left(trim(coalesce(p_note,'')),5000),updated_at=clock_timestamp()
   where task_id=p_task and user_id=auth.uid()
   returning * into result;
  if result.task_id is null then raise exception using errcode='42501',message='acknowledged assignment required'; end if;
  insert into public.task_events(task_id,actor_id,event_type,payload)
  values(p_task,auth.uid(),'assignee_workspace_updated',jsonb_build_object('status',p_status,'progress_percent',p_progress,'self_checked',p_status='done'));
  return result;
end
$$;

create or replace function public.auto_close_due_tasks()
returns integer language plpgsql security definer set search_path=public
as $$
declare affected integer;
begin
  with due as (
    update public.tasks t set
      status='done',closed_at=clock_timestamp(),updated_at=clock_timestamp(),version=t.version+1,
      prototype_payload=jsonb_set(coalesce(t.prototype_payload,'{}'::jsonb),'{auto_closed}','true'::jsonb,true)
    where t.auto_close_enabled and t.status<>'done' and t.due_at is not null and t.due_at<=clock_timestamp()
    returning t.id,t.creator_id,t.due_at
  ), logged as (
    insert into public.task_events(task_id,actor_id,event_type,payload)
    select id,creator_id,'task_auto_closed',jsonb_build_object('due_at',due_at,'closed_by_system',true) from due
    returning 1
  ) select count(*)::integer into affected from logged;
  return affected;
end
$$;

revoke all on function public.auto_close_due_tasks() from public;
grant execute on function public.auto_close_due_tasks() to service_role;

commit;

create extension if not exists pg_cron;
do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='company-hub-auto-close-due-tasks' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('company-hub-auto-close-due-tasks','*/5 * * * *','select public.auto_close_due_tasks();');
end
$$;
