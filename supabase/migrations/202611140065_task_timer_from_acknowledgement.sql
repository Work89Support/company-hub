-- Count assignee elapsed time from acknowledgement until completion.
begin;

update public.task_assignee_workspaces
   set started_at=acknowledged_at
 where acknowledged_at is not null
   and started_at is distinct from acknowledged_at;

create or replace function public.acknowledge_my_task(p_task uuid)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare result timestamptz; did_ack boolean:=false;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='authentication required'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then
    raise exception using errcode='42501',message='active profile required';
  end if;
  update public.task_assignees set acknowledged_at=clock_timestamp()
   where task_id=p_task and user_id=auth.uid() and acknowledged_at is null
   returning acknowledged_at into result;
  if result is null then
    select acknowledged_at into result from public.task_assignees where task_id=p_task and user_id=auth.uid();
  else did_ack:=true;
  end if;
  if result is null then raise exception using errcode='42501',message='task assignment required'; end if;

  insert into public.task_assignee_workspaces(task_id,user_id,acknowledged_at,started_at)
  values(p_task,auth.uid(),result,result)
  on conflict(task_id,user_id) do update set acknowledged_at=excluded.acknowledged_at,
    started_at=coalesce(task_assignee_workspaces.started_at,excluded.started_at);
  if did_ack then
    insert into public.task_events(task_id,actor_id,event_type,payload)
    values(p_task,auth.uid(),'assignment_acknowledged',jsonb_build_object(
      'acknowledged_at',result,'timer_started_at',result));
  end if;
  return result;
end $$;

create or replace function public.update_my_task_workspace(p_task uuid,p_status text,p_progress integer,p_note text)
returns public.task_assignee_workspaces language plpgsql security definer set search_path=public as $$
declare current_row public.task_assignee_workspaces; result public.task_assignee_workspaces;
begin
  if p_status not in ('todo','doing','review','block','done') then raise exception 'invalid status'; end if;
  if p_progress not between 0 and 100 then raise exception 'invalid progress'; end if;
  select * into current_row from public.task_assignee_workspaces
   where task_id=p_task and user_id=auth.uid() for update;
  if current_row.task_id is null then raise exception using errcode='42501',message='กรุณากดรับทราบงานก่อน'; end if;
  if current_row.status='todo' and p_status<>'doing' then
    raise exception using errcode='23514',message='กรุณากดสถานะกำลังดำเนินการก่อนเลือกสถานะอื่น';
  end if;
  if current_row.status<>'todo' and p_status='todo' then
    raise exception using errcode='23514',message='งานที่เริ่มแล้วไม่สามารถย้อนเป็นยังไม่เริ่ม';
  end if;
  if p_status='done' then p_progress:=100; end if;
  update public.task_assignee_workspaces set status=p_status,
    started_at=coalesce(started_at,acknowledged_at,clock_timestamp()),
    completed_at=case when p_status='done' then coalesce(completed_at,clock_timestamp()) else null end,
    progress_percent=p_progress,update_note=left(trim(coalesce(p_note,'')),5000),updated_at=clock_timestamp()
   where task_id=p_task and user_id=auth.uid() returning * into result;
  insert into public.task_events(task_id,actor_id,event_type,payload)
  values(p_task,auth.uid(),'assignee_workspace_updated',jsonb_build_object(
    'status',p_status,'progress_percent',p_progress,'started_at',result.started_at,
    'completed_at',result.completed_at,'timer_origin','acknowledgement','self_checked',p_status='done'));
  return result;
end $$;

create or replace function public.task_assignment_gate(p_task uuid)
returns table(total integer,acknowledged integer,started integer,ready_to_close boolean)
language sql stable security definer set search_path=public as $$
  select count(*)::integer,
    count(*) filter(where a.acknowledged_at is not null)::integer,
    count(*) filter(where coalesce(w.status,'todo')<>'todo')::integer,
    (count(*)=0 or (count(*)=count(*) filter(where a.acknowledged_at is not null)
      and count(*)=count(*) filter(where coalesce(w.status,'todo')<>'todo')))
  from public.task_assignees a left join public.task_assignee_workspaces w
    on w.task_id=a.task_id and w.user_id=a.user_id where a.task_id=p_task
$$;

revoke all on function public.acknowledge_my_task(uuid) from public;
grant execute on function public.acknowledge_my_task(uuid) to authenticated;
revoke all on function public.update_my_task_workspace(uuid,text,integer,text) from public;
grant execute on function public.update_my_task_workspace(uuid,text,integer,text) to authenticated;
revoke all on function public.task_assignment_gate(uuid) from public;
grant execute on function public.task_assignment_gate(uuid) to authenticated,service_role;
commit;
