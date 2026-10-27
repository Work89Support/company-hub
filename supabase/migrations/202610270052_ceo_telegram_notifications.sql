-- CEO task notifications and twice-daily department summaries for the Company Hub Telegram group.
begin;

create extension if not exists pg_net with schema extensions;

create table if not exists public.telegram_notification_queue (
  id bigint generated always as identity primary key,
  notification_type text not null,
  task_id uuid references public.tasks(id) on delete set null,
  dedupe_key text not null unique,
  message_text text not null check (char_length(message_text) between 1 and 4096),
  status text not null default 'queued' check (status in ('queued','failed','dispatched')),
  attempts integer not null default 0,
  request_id bigint,
  last_error text,
  created_at timestamptz not null default clock_timestamp(),
  dispatched_at timestamptz
);

create index if not exists telegram_notification_queue_pending_idx
  on public.telegram_notification_queue(status,created_at)
  where status in ('queued','failed');

alter table public.telegram_notification_queue enable row level security;
revoke all on public.telegram_notification_queue from public,anon,authenticated;
grant all on public.telegram_notification_queue to service_role;

create or replace function public.queue_telegram_notification(
  p_type text,
  p_task uuid,
  p_dedupe_key text,
  p_message text
)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare queued_id bigint;
begin
  insert into public.telegram_notification_queue(notification_type,task_id,dedupe_key,message_text)
  values(left(trim(p_type),80),p_task,left(trim(p_dedupe_key),300),left(trim(p_message),4096))
  on conflict(dedupe_key) do nothing
  returning id into queued_id;
  return queued_id;
end
$$;

revoke all on function public.queue_telegram_notification(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.queue_telegram_notification(text,uuid,text,text) to service_role;

create or replace function public.queue_ceo_assignment_telegram()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  task_row record;
  assignee_name text;
  ceo_profile uuid;
  due_label text;
begin
  select a.profile_id into ceo_profile
  from public.company_login_accounts a
  where lower(a.login_name)='ceo2026'
  limit 1;

  if ceo_profile is null or new.assigned_by<>ceo_profile then
    return new;
  end if;

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
    'ceo_task_assigned',
    new.task_id,
    'ceo-assigned:'||new.task_id::text||':'||new.user_id::text||':'||extract(epoch from new.assigned_at)::bigint::text,
    E'📌 CEO มอบหมายงาน\n'||
    'งาน: T-'||task_row.task_no||' '||regexp_replace(task_row.title,E'[\n\r]+',' ','g')||E'\n'||
    'ผู้รับผิดชอบ: '||coalesce(assignee_name,'ไม่ทราบชื่อ')||E'\n'||
    'แผนก: '||coalesce(task_row.department_name,task_row.department_code,'ไม่ระบุ')||E'\n'||
    'กำหนดส่ง: '||due_label||E'\n'||
    'สถานะ: รอรับทราบ'
  );
  return new;
end
$$;

drop trigger if exists queue_ceo_assignment_telegram on public.task_assignees;
create trigger queue_ceo_assignment_telegram
after insert on public.task_assignees
for each row execute function public.queue_ceo_assignment_telegram();

create or replace function public.queue_ceo_completion_telegram()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  assignee_names text;
  department_name text;
begin
  if new.status<>'done' or old.status='done' then
    return new;
  end if;

  select string_agg(p.display_name,', ' order by p.display_name),max(d.name)
    into assignee_names,department_name
  from public.task_assignees ta
  join public.profiles p on p.id=ta.user_id
  join public.company_login_accounts ceo on ceo.profile_id=ta.assigned_by and lower(ceo.login_name)='ceo2026'
  left join public.departments d on d.code=new.department_code
  where ta.task_id=new.id;

  if assignee_names is null then
    return new;
  end if;

  perform public.queue_telegram_notification(
    'ceo_task_completed',
    new.id,
    'ceo-completed:'||new.id::text||':'||new.version::text,
    E'✅ งานที่ CEO มอบหมายเสร็จแล้ว\n'||
    'งาน: T-'||new.task_no||' '||regexp_replace(new.title,E'[\n\r]+',' ','g')||E'\n'||
    'ผู้รับผิดชอบ: '||assignee_names||E'\n'||
    'แผนก: '||coalesce(department_name,new.department_code,'ไม่ระบุ')||E'\n'||
    'เสร็จเวลา: '||to_char(coalesce(new.closed_at,clock_timestamp()) at time zone 'Asia/Bangkok','DD/MM/YYYY HH24:MI')
  );
  return new;
end
$$;

drop trigger if exists queue_ceo_completion_telegram on public.tasks;
create trigger queue_ceo_completion_telegram
after update of status on public.tasks
for each row execute function public.queue_ceo_completion_telegram();

create or replace function public.queue_department_task_summary(p_period text)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  thai_today date:=(clock_timestamp() at time zone 'Asia/Bangkok')::date;
  period_key text:=case when lower(p_period)='morning' then 'morning' else 'evening' end;
  period_label text:=case when lower(p_period)='morning' then '06:00' else '18:00' end;
  department_lines text;
  pending_total bigint;
  completed_total bigint;
begin
  with per_department as (
    select
      t.department_code,
      coalesce(d.name,t.department_code,'ไม่ระบุ') as department_name,
      count(*) filter(where t.status<>'done') as pending_count,
      count(*) filter(where t.status='done' and (coalesce(t.closed_at,t.updated_at) at time zone 'Asia/Bangkok')::date=thai_today) as completed_count
    from public.tasks t
    left join public.departments d on d.code=t.department_code
    group by t.department_code,d.name
  )
  select
    string_agg('• '||department_name||': ค้าง '||pending_count||' | สำเร็จวันนี้ '||completed_count,E'\n' order by department_name),
    coalesce(sum(pending_count),0),
    coalesce(sum(completed_count),0)
  into department_lines,pending_total,completed_total
  from per_department
  where pending_count>0 or completed_count>0;

  return public.queue_telegram_notification(
    'department_task_summary',
    null,
    'department-summary:'||thai_today::text||':'||period_key,
    E'📊 สรุปงาน Company Hub รอบ '||period_label||E' น.\n'||
    'วันที่ '||to_char(thai_today,'DD/MM/YYYY')||E'\n\n'||
    coalesce(department_lines,'ยังไม่มีงานในระบบ')||E'\n\n'||
    'รวมค้าง: '||pending_total||' งาน'||E'\n'||
    'รวมสำเร็จวันนี้: '||completed_total||' งาน'
  );
end
$$;

revoke all on function public.queue_department_task_summary(text) from public,anon,authenticated;
grant execute on function public.queue_department_task_summary(text) to service_role;

create or replace function public.dispatch_telegram_notifications(p_limit integer default 20)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  bot_token text;
  group_chat_id text;
  item record;
  outbound_request_id bigint;
  dispatched_count integer:=0;
begin
  select decrypted_secret into bot_token
  from vault.decrypted_secrets
  where name='company_hub_telegram_bot_token'
  order by created_at desc limit 1;

  select decrypted_secret into group_chat_id
  from vault.decrypted_secrets
  where name='company_hub_telegram_group_chat_id'
  order by created_at desc limit 1;

  if nullif(bot_token,'') is null or nullif(group_chat_id,'') is null then
    raise exception 'Telegram secrets are not configured';
  end if;

  for item in
    select q.id,q.message_text
    from public.telegram_notification_queue q
    where q.status in ('queued','failed') and q.attempts<5
    order by q.created_at,q.id
    limit greatest(1,least(coalesce(p_limit,20),100))
    for update skip locked
  loop
    begin
      select net.http_post(
        url:='https://api.telegram.org/bot'||bot_token||'/sendMessage',
        headers:='{"Content-Type":"application/json"}'::jsonb,
        body:=jsonb_build_object(
          'chat_id',group_chat_id,
          'text',item.message_text,
          'disable_web_page_preview',true
        ),
        timeout_milliseconds:=10000
      ) into outbound_request_id;

      update public.telegram_notification_queue
      set status='dispatched',attempts=attempts+1,request_id=outbound_request_id,
          dispatched_at=clock_timestamp(),last_error=null
      where id=item.id;
      dispatched_count:=dispatched_count+1;
    exception when others then
      update public.telegram_notification_queue
      set status='failed',attempts=attempts+1,last_error=left(sqlerrm,1000)
      where id=item.id;
    end;
  end loop;
  return dispatched_count;
end
$$;

revoke all on function public.dispatch_telegram_notifications(integer) from public,anon,authenticated;
grant execute on function public.dispatch_telegram_notifications(integer) to service_role;

commit;

create extension if not exists pg_cron;
do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='company-hub-telegram-dispatch' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('company-hub-telegram-dispatch','* * * * *','select public.dispatch_telegram_notifications(20);');

  select jobid into existing_job from cron.job where jobname='company-hub-summary-0600-bkk' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('company-hub-summary-0600-bkk','0 23 * * *','select public.queue_department_task_summary(''morning'');');

  select jobid into existing_job from cron.job where jobname='company-hub-summary-1800-bkk' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('company-hub-summary-1800-bkk','0 11 * * *','select public.queue_department_task_summary(''evening'');');
end
$$;
