-- Extend Telegram task notifications from CEO-only to every active lead account.
begin;

create or replace function public.queue_ceo_assignment_telegram()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  task_row record;
  assignee_name text;
  assigner_name text;
  assigner_role public.company_role;
  assigner_login text;
  sender_label text;
  due_label text;
begin
  select p.display_name,p.role,a.login_name
    into assigner_name,assigner_role,assigner_login
  from public.profiles p
  left join public.company_login_accounts a on a.profile_id=p.id
  where p.id=new.assigned_by and p.active;

  if assigner_role is null or not (
    assigner_role='lead' or lower(coalesce(assigner_login,''))='ceo2026'
  ) then
    return new;
  end if;

  sender_label:=case
    when lower(coalesce(assigner_login,''))='ceo2026' then 'CEO'
    else 'หัวหน้า '||coalesce(assigner_name,'ไม่ทราบชื่อ')
  end;

  select t.task_no,t.title,t.department_code,d.name as department_name,t.due_at
    into task_row
  from public.tasks t
  left join public.departments d on d.code=t.department_code
  where t.id=new.task_id;

  select p.display_name into assignee_name
  from public.profiles p where p.id=new.user_id;

  due_label:=case when task_row.due_at is null then 'ไม่ระบุ'
    else to_char(task_row.due_at at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI') end;

  perform public.queue_telegram_notification(
    'manager_task_assigned',
    new.task_id,
    'manager-assigned:'||new.task_id::text||':'||new.user_id::text||':'||extract(epoch from new.assigned_at)::bigint::text,
    E'📌 '||sender_label||E' มอบหมายงาน\n'||
    'งาน: T-'||task_row.task_no||' '||regexp_replace(task_row.title,E'[\n\r]+',' ','g')||E'\n'||
    'ผู้รับผิดชอบ: '||coalesce(assignee_name,'ไม่ทราบชื่อ')||E'\n'||
    'แผนก: '||coalesce(task_row.department_name,task_row.department_code,'ไม่ระบุ')||E'\n'||
    'กำหนดส่ง: '||due_label||E'\n'||
    'สถานะ: รอรับทราบ'
  );
  return new;
end
$$;

create or replace function public.queue_ceo_completion_telegram()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  assignment_lines text;
  department_name text;
begin
  if new.status<>'done' or old.status='done' then
    return new;
  end if;

  select
    string_agg(
      (case when lower(coalesce(a.login_name,''))='ceo2026'
        then 'CEO'
        else 'หัวหน้า '||manager.display_name
      end)||' → '||assignee.display_name,
      E'\n' order by manager.display_name,assignee.display_name
    ),
    max(d.name)
    into assignment_lines,department_name
  from public.task_assignees ta
  join public.profiles manager on manager.id=ta.assigned_by and manager.active
  join public.profiles assignee on assignee.id=ta.user_id
  left join public.company_login_accounts a on a.profile_id=manager.id
  left join public.departments d on d.code=new.department_code
  where ta.task_id=new.id
    and (manager.role='lead' or lower(coalesce(a.login_name,''))='ceo2026');

  if assignment_lines is null then
    return new;
  end if;

  perform public.queue_telegram_notification(
    'manager_task_completed',
    new.id,
    'manager-completed:'||new.id::text||':'||new.version::text,
    E'✅ งานที่ผู้บริหาร/หัวหน้ามอบหมายเสร็จแล้ว\n'||
    'งาน: T-'||new.task_no||' '||regexp_replace(new.title,E'[\n\r]+',' ','g')||E'\n'||
    assignment_lines||E'\n'||
    'แผนก: '||coalesce(department_name,new.department_code,'ไม่ระบุ')||E'\n'||
    'เสร็จเวลา: '||to_char(coalesce(new.closed_at,clock_timestamp()) at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI')
  );
  return new;
end
$$;

commit;
