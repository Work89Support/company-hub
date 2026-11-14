-- Mandatory assignment workflow: acknowledge -> start -> close.
begin;
alter table public.task_assignee_workspaces add column if not exists started_at timestamptz;
update public.task_assignee_workspaces set started_at=coalesce(updated_at,acknowledged_at)
 where started_at is null and status<>'todo';

create or replace function public.task_assignment_gate(p_task uuid)
returns table(total integer,acknowledged integer,started integer,ready_to_close boolean)
language sql stable security definer set search_path=public as $$
  select count(*)::integer,
    count(*) filter(where a.acknowledged_at is not null)::integer,
    count(*) filter(where w.started_at is not null)::integer,
    (count(*)=0 or (count(*)=count(*) filter(where a.acknowledged_at is not null)
      and count(*)=count(*) filter(where w.started_at is not null)))
  from public.task_assignees a left join public.task_assignee_workspaces w
    on w.task_id=a.task_id and w.user_id=a.user_id where a.task_id=p_task
$$;

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
    progress_percent=p_progress,update_note=left(trim(coalesce(p_note,'')),5000),updated_at=clock_timestamp()
   where task_id=p_task and user_id=auth.uid() returning * into result;
  insert into public.task_events(task_id,actor_id,event_type,payload)
  values(p_task,auth.uid(),'assignee_workspace_updated',jsonb_build_object('status',p_status,'progress_percent',p_progress,'started_at',result.started_at,'self_checked',p_status='done'));
  return result;
end $$;

create or replace function public.update_my_task_progress(p_task uuid,p_status public.task_status)
returns public.tasks language plpgsql security definer set search_path=public as $$
declare result public.tasks%rowtype; workspace public.task_assignee_workspaces;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active) then raise exception using errcode='42501',message='active profile required'; end if;
  if not public.is_task_assignee(p_task) then raise exception using errcode='42501',message='task assignment required'; end if;
  if p_status='done' then raise exception using errcode='42501',message='manager approval required to close a task'; end if;
  select * into workspace from public.task_assignee_workspaces where task_id=p_task and user_id=auth.uid() for update;
  if workspace.task_id is null then raise exception using errcode='42501',message='กรุณากดรับทราบงานก่อน'; end if;
  if p_status='doing' then
    update public.task_assignee_workspaces set status='doing',started_at=coalesce(started_at,clock_timestamp()),updated_at=clock_timestamp()
     where task_id=p_task and user_id=auth.uid();
  elsif workspace.started_at is null then
    raise exception using errcode='23514',message='กรุณากดสถานะกำลังดำเนินการก่อนเลือกสถานะอื่น';
  elsif p_status='todo' then
    raise exception using errcode='23514',message='งานที่เริ่มแล้วไม่สามารถย้อนเป็นยังไม่เริ่ม';
  end if;
  update public.tasks set status=p_status,closed_at=null,updated_at=clock_timestamp(),version=version+1
   where id=p_task returning * into result;
  if result.id is null then raise exception 'task not found'; end if;
  insert into public.task_events(task_id,actor_id,event_type,payload)
  values(p_task,auth.uid(),'assignee_progress',jsonb_build_object('status',p_status));
  return result;
end $$;

create or replace function public.enforce_task_close_assignment_gate()
returns trigger language plpgsql security definer set search_path=public as $$
declare gate record;
begin
  if new.status='done' and old.status is distinct from new.status then
    select * into gate from public.task_assignment_gate(old.id);
    if not gate.ready_to_close then raise exception using errcode='23514',message=format(
      'ปิดงานไม่ได้: ผู้รับผิดชอบต้องรับทราบและกดกำลังดำเนินการให้ครบ (%s/%s รับทราบ, %s/%s เริ่มงาน)',gate.acknowledged,gate.total,gate.started,gate.total);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists task_close_assignment_gate on public.tasks;
create trigger task_close_assignment_gate before update of status on public.tasks
for each row execute function public.enforce_task_close_assignment_gate();

create or replace function public.auto_close_due_tasks()
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  with eligible as (
    select t.id from public.tasks t where t.auto_close_enabled and t.status<>'done'
      and t.due_at is not null and t.due_at<=clock_timestamp()
      and (select g.ready_to_close from public.task_assignment_gate(t.id) g)
  ), due as (
    update public.tasks t set status='done',closed_at=clock_timestamp(),updated_at=clock_timestamp(),version=t.version+1,
      prototype_payload=jsonb_set(coalesce(t.prototype_payload,'{}'::jsonb),'{auto_closed}','true'::jsonb,true)
    from eligible e where t.id=e.id returning t.id,t.creator_id,t.due_at
  ), logged as (
    insert into public.task_events(task_id,actor_id,event_type,payload)
    select id,creator_id,'task_auto_closed',jsonb_build_object('due_at',due_at,'closed_by_system',true) from due returning 1
  ) select count(*)::integer into affected from logged;
  return affected;
end $$;
revoke all on function public.task_assignment_gate(uuid) from public;
grant execute on function public.task_assignment_gate(uuid) to authenticated,service_role;
commit;
