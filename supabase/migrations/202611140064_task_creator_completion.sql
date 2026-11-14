-- Selectable task completion: auto-close after every assignee finishes, or creator review.
begin;
create or replace function public.enforce_task_completion_mode()
returns trigger language plpgsql security definer set search_path=public as $$
declare close_mode text:=coalesce(old.prototype_payload->>'close_mode','manual_creator'); incomplete integer;
begin
  if old.status is not distinct from new.status then return new; end if;
  if new.status='done' then
    if current_setting('app.task_auto_close',true)='1' then return new; end if;
    if auth.uid() is null then return new; end if;
    if close_mode='auto_assignees' then
      raise exception using errcode='42501',message='งานนี้ปิดอัตโนมัติเมื่อผู้รับทุกคนกดเสร็จสิ้น';
    end if;
    if old.creator_id is distinct from auth.uid() then
      raise exception using errcode='42501',message='เฉพาะผู้มอบหมายงานเท่านั้นที่ปิดงานได้';
    end if;
    select count(*)::integer into incomplete
    from public.task_assignees a left join public.task_assignee_workspaces w
      on w.task_id=a.task_id and w.user_id=a.user_id
    where a.task_id=old.id and coalesce(w.status,'todo')<>'done';
    if incomplete>0 then
      raise exception using errcode='23514',message=format('ปิดงานไม่ได้: ยังมีผู้รับ %s คนที่ไม่ได้กดเสร็จสิ้น',incomplete);
    end if;
  elsif old.status='done' and auth.uid() is not null and old.creator_id is distinct from auth.uid() then
    raise exception using errcode='42501',message='เฉพาะผู้มอบหมายงานเท่านั้นที่เปิดงานใหม่ได้';
  end if;
  return new;
end $$;
drop trigger if exists task_creator_completion on public.tasks;
drop trigger if exists task_completion_mode on public.tasks;
create trigger task_completion_mode before update of status on public.tasks
for each row execute function public.enforce_task_completion_mode();

create or replace function public.finish_task_after_assignee_update()
returns trigger language plpgsql security definer set search_path=public as $$
declare task_row public.tasks%rowtype; remaining integer; close_mode text;
begin
  if new.status<>'done' or old.status='done' then return new; end if;
  select * into task_row from public.tasks where id=new.task_id for update;
  insert into public.task_events(task_id,actor_id,event_type,payload)
  values(new.task_id,new.user_id,'assignee_completed',jsonb_build_object(
    'creator_id',task_row.creator_id,'close_mode',coalesce(task_row.prototype_payload->>'close_mode','manual_creator'),
    'completed_at',new.completed_at,'notify_assigner',true));
  if task_row.status='done' then return new; end if;
  close_mode:=coalesce(task_row.prototype_payload->>'close_mode','manual_creator');
  select count(*)::integer into remaining
  from public.task_assignees a left join public.task_assignee_workspaces w
    on w.task_id=a.task_id and w.user_id=a.user_id
  where a.task_id=new.task_id and coalesce(w.status,'todo')<>'done';
  if remaining=0 and close_mode='auto_assignees' then
    perform set_config('app.task_auto_close','1',true);
    update public.tasks set status='done',closed_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1,
      prototype_payload=jsonb_set(coalesce(prototype_payload,'{}'::jsonb),'{auto_closed_by_assignees}','true'::jsonb,true)
    where id=new.task_id and status<>'done';
    insert into public.task_events(task_id,actor_id,event_type,payload)
    values(new.task_id,task_row.creator_id,'task_auto_closed_after_assignees',jsonb_build_object(
      'closed_by_system',true,'completed_by',new.user_id));
  elsif remaining=0 then
    update public.tasks set status='review',updated_at=clock_timestamp(),version=version+1
    where id=new.task_id and status not in ('review','done');
    insert into public.task_events(task_id,actor_id,event_type,payload)
    values(new.task_id,new.user_id,'task_ready_for_creator_review',jsonb_build_object(
      'creator_id',task_row.creator_id,'notify_assigner',true,'all_assignees_completed',true));
  end if;
  return new;
end $$;
drop trigger if exists task_finish_after_assignee_update on public.task_assignee_workspaces;
create trigger task_finish_after_assignee_update after update of status on public.task_assignee_workspaces
for each row execute function public.finish_task_after_assignee_update();
commit;
