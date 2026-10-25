-- Each assignee acknowledges a task independently. The server records the
-- authenticated user and time so the value cannot be forged by the browser.
begin;

alter table public.task_assignees
  add column if not exists acknowledged_at timestamptz;

create index if not exists task_assignees_pending_ack_idx
  on public.task_assignees(user_id,assigned_at)
  where acknowledged_at is null;

create or replace function public.acknowledge_my_task(p_task uuid)
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare result timestamptz; did_ack boolean:=false;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='authentication required'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then
    raise exception using errcode='42501',message='active profile required';
  end if;

  update public.task_assignees
     set acknowledged_at=clock_timestamp()
   where task_id=p_task and user_id=auth.uid() and acknowledged_at is null
   returning acknowledged_at into result;

  if result is null then
    select acknowledged_at into result from public.task_assignees
     where task_id=p_task and user_id=auth.uid();
  else
    did_ack:=true;
  end if;

  if result is null then
    raise exception using errcode='42501',message='task assignment required';
  end if;

  if did_ack then
    insert into public.task_events(task_id,actor_id,event_type,payload)
    values(p_task,auth.uid(),'assignment_acknowledged',jsonb_build_object('acknowledged_at',result));
  end if;
  return result;
end
$$;

revoke all on function public.acknowledge_my_task(uuid) from public;
grant execute on function public.acknowledge_my_task(uuid) to authenticated;
comment on function public.acknowledge_my_task(uuid) is
  'Records the authenticated assignee acknowledgement once and returns its timestamp.';

commit;
