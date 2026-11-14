-- Notify the Company Hub Telegram group as soon as each assignee finishes.
-- This is intentionally independent from the parent task close/review state.
begin;

create or replace function public.queue_manager_assignee_completion_notice(
  p_task_id uuid,
  p_user_id uuid,
  p_completed_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  task_no bigint;
  task_title text;
  department_code text;
  department_name text;
  close_mode text;
  assignee_name text;
  assigner_name text;
  assigner_role public.company_role;
  assigner_login text;
  sender_label text;
  parent_status_label text;
  queued_id bigint;
begin
  select
    t.task_no,t.title,t.department_code,
    coalesce(t.prototype_payload->>'close_mode','manual_creator'),
    d.name,
    assignee.display_name,
    manager.display_name,manager.role,a.login_name
  into
    task_no,task_title,department_code,close_mode,department_name,
    assignee_name,assigner_name,assigner_role,assigner_login
  from public.tasks t
  join public.task_assignees ta
    on ta.task_id=t.id and ta.user_id=p_user_id
  join public.profiles assignee on assignee.id=p_user_id
  join public.profiles manager on manager.id=ta.assigned_by and manager.active
  left join public.company_login_accounts a on a.profile_id=manager.id
  left join public.departments d on d.code=t.department_code
  where t.id=p_task_id;

  if task_no is null or assigner_role is null or not (
    assigner_role='lead' or lower(coalesce(assigner_login,''))='ceo2026'
  ) then
    return null;
  end if;

  sender_label:=case
    when lower(coalesce(assigner_login,''))='ceo2026' then 'CEO'
    else 'หัวหน้า '||coalesce(assigner_name,'ไม่ทราบชื่อ')
  end;
  parent_status_label:=case
    when close_mode='auto_assignees' then 'ระบบจะปิดอัตโนมัติเมื่อผู้รับทุกคนเสร็จ'
    else 'รอผู้มอบหมายตรวจ/ปิดงาน'
  end;

  queued_id:=public.queue_telegram_notification(
    'manager_assignee_completed',
    p_task_id,
    'manager-assignee-completed:'||p_task_id::text||':'||p_user_id::text||':'||
      extract(epoch from p_completed_at)::bigint::text,
    E'✅ ผู้รับผิดชอบกดเสร็จสิ้นแล้ว\n'||
    'งาน: T-'||task_no||' '||regexp_replace(task_title,E'[\n\r]+',' ','g')||E'\n'||
    'ผู้มอบหมาย: '||sender_label||E'\n'||
    'ผู้ทำ: '||coalesce(assignee_name,'ไม่ทราบชื่อ')||E'\n'||
    'แผนก: '||coalesce(department_name,department_code,'ไม่ระบุ')||E'\n'||
    'เสร็จเวลา: '||to_char(p_completed_at at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI')||E'\n'||
    'สถานะงานหลัก: '||parent_status_label
  );
  return queued_id;
end
$$;

revoke all on function public.queue_manager_assignee_completion_notice(uuid,uuid,timestamptz)
  from public,anon,authenticated;
grant execute on function public.queue_manager_assignee_completion_notice(uuid,uuid,timestamptz)
  to service_role;

create or replace function public.queue_manager_assignee_completion_telegram()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status<>'done' then
    return new;
  end if;
  if tg_op='UPDATE' and old.status='done' then
    return new;
  end if;

  perform public.queue_manager_assignee_completion_notice(
    new.task_id,new.user_id,coalesce(new.completed_at,new.updated_at,clock_timestamp()));
  return new;
end
$$;

drop trigger if exists queue_manager_assignee_completion_telegram on public.task_assignee_workspaces;
create trigger queue_manager_assignee_completion_telegram
after insert or update of status on public.task_assignee_workspaces
for each row execute function public.queue_manager_assignee_completion_telegram();

-- Backfill only completed assignees whose parent task is still open/review.
-- The queue's unique dedupe key makes this safe to re-run.
do $$
declare item record;
begin
  for item in
    select w.task_id,w.user_id,coalesce(w.completed_at,w.updated_at,clock_timestamp()) as completed_at
    from public.task_assignee_workspaces w
    join public.tasks t on t.id=w.task_id
    join public.task_assignees ta on ta.task_id=w.task_id and ta.user_id=w.user_id
    join public.profiles manager on manager.id=ta.assigned_by and manager.active
    left join public.company_login_accounts a on a.profile_id=manager.id
    where w.status='done' and t.status<>'done'
      and (manager.role='lead' or lower(coalesce(a.login_name,''))='ceo2026')
  loop
    perform public.queue_manager_assignee_completion_notice(
      item.task_id,item.user_id,item.completed_at);
  end loop;
end
$$;

commit;
