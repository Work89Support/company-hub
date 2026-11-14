-- Persist a reliable work timer from the assignee's explicit start until self-check completion.
begin;
alter table public.task_assignee_workspaces add column if not exists completed_at timestamptz;
update public.task_assignee_workspaces
   set completed_at=coalesce(completed_at,updated_at)
 where status='done' and completed_at is null;

create or replace function public.update_my_task_workspace(p_task uuid,p_status text,p_progress integer,p_note text)
returns public.task_assignee_workspaces language plpgsql security definer set search_path=public as $$
declare current_row public.task_assignee_workspaces; result public.task_assignee_workspaces;
begin
  if p_status not in ('todo','doing','review','block','done') then raise exception 'invalid status'; end if;
  if p_progress not between 0 and 100 then raise exception 'invalid progress'; end if;
  select * into current_row from public.task_assignee_workspaces
   where task_id=p_task and user_id=auth.uid() for update;
  if current_row.task_id is null then raise exception using errcode='42501',message='กรุณากดรับทราบงานก่อน'; end if;
  if current_row.started_at is null and p_status<>'doing' then
    raise exception using errcode='23514',message='กรุณากดสถานะกำลังดำเนินการก่อนเลือกสถานะอื่น';
  end if;
  if current_row.started_at is not null and p_status='todo' then
    raise exception using errcode='23514',message='งานที่เริ่มแล้วไม่สามารถย้อนเป็นยังไม่เริ่ม';
  end if;
  if p_status='done' then p_progress:=100; end if;
  update public.task_assignee_workspaces set status=p_status,
    started_at=case when p_status='doing' then coalesce(started_at,clock_timestamp()) else started_at end,
    completed_at=case when p_status='done' then coalesce(completed_at,clock_timestamp()) else null end,
    progress_percent=p_progress,update_note=left(trim(coalesce(p_note,'')),5000),updated_at=clock_timestamp()
   where task_id=p_task and user_id=auth.uid() returning * into result;
  insert into public.task_events(task_id,actor_id,event_type,payload)
  values(p_task,auth.uid(),'assignee_workspace_updated',jsonb_build_object(
    'status',p_status,'progress_percent',p_progress,'started_at',result.started_at,
    'completed_at',result.completed_at,'self_checked',p_status='done'));
  return result;
end $$;

revoke all on function public.update_my_task_workspace(uuid,text,integer,text) from public;
grant execute on function public.update_my_task_workspace(uuid,text,integer,text) to authenticated;
commit;
