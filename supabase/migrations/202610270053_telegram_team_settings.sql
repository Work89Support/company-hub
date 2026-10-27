-- Secure Team Settings RPCs for the Company Hub Telegram notification channel.
begin;

create or replace function public.get_telegram_notification_settings()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor public.profiles;
  token_ready boolean;
  group_chat_id text;
  queue_counts jsonb;
begin
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null or actor.role not in ('admin','exec') then
    raise insufficient_privilege using message='เฉพาะผู้ดูแลหรือผู้บริหาร';
  end if;

  select exists(
    select 1 from vault.decrypted_secrets
    where name='company_hub_telegram_bot_token' and nullif(decrypted_secret,'') is not null
  ) into token_ready;

  select decrypted_secret into group_chat_id
  from vault.decrypted_secrets
  where name='company_hub_telegram_group_chat_id'
  order by created_at desc limit 1;

  select jsonb_build_object(
    'queued',count(*) filter(where status='queued'),
    'failed',count(*) filter(where status='failed'),
    'dispatched',count(*) filter(where status='dispatched')
  ) into queue_counts
  from public.telegram_notification_queue;

  return jsonb_build_object(
    'token_configured',token_ready,
    'group_chat_id',coalesce(group_chat_id,''),
    'enabled',token_ready and nullif(group_chat_id,'') is not null,
    'summary_times',jsonb_build_array('06:00','18:00'),
    'timezone','Asia/Bangkok',
    'queue',queue_counts
  );
end
$$;

create or replace function public.save_telegram_notification_settings(
  p_bot_token text,
  p_group_chat_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor public.profiles;
  clean_token text:=trim(coalesce(p_bot_token,''));
  clean_chat_id text:=trim(coalesce(p_group_chat_id,''));
  token_secret_id uuid;
  chat_secret_id uuid;
  token_changed boolean:=false;
begin
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null or actor.role not in ('admin','exec') then
    raise insufficient_privilege using message='เฉพาะผู้ดูแลหรือผู้บริหาร';
  end if;

  if clean_chat_id !~ '^-[0-9]{5,20}$' then
    raise exception 'Group Chat ID ต้องขึ้นต้นด้วยเครื่องหมายลบและตามด้วยตัวเลข';
  end if;
  if clean_token<>'' and clean_token !~ '^[0-9]{6,12}:[A-Za-z0-9_-]{30,100}$' then
    raise exception 'รูปแบบ Telegram Bot Token ไม่ถูกต้อง';
  end if;

  select id into token_secret_id from vault.secrets
  where name='company_hub_telegram_bot_token'
  order by created_at desc limit 1;
  if clean_token<>'' then
    if token_secret_id is null then
      perform vault.create_secret(clean_token,'company_hub_telegram_bot_token','Company Hub Telegram bot token');
    else
      perform vault.update_secret(token_secret_id,clean_token,'company_hub_telegram_bot_token','Company Hub Telegram bot token');
    end if;
    token_changed:=true;
  elsif token_secret_id is null then
    raise exception 'กรุณากรอก Telegram Bot Token';
  end if;

  select id into chat_secret_id from vault.secrets
  where name='company_hub_telegram_group_chat_id'
  order by created_at desc limit 1;
  if chat_secret_id is null then
    perform vault.create_secret(clean_chat_id,'company_hub_telegram_group_chat_id','Company Hub Telegram group chat id');
  else
    perform vault.update_secret(chat_secret_id,clean_chat_id,'company_hub_telegram_group_chat_id','Company Hub Telegram group chat id');
  end if;

  insert into public.access_audit(actor_id,target_user_id,old_access,new_access)
  values(
    actor.id,
    actor.id,
    '{}'::jsonb,
    jsonb_build_object(
      'action','telegram_notification_settings_updated',
      'token_changed',token_changed,
      'group_chat_id',clean_chat_id,
      'summary_times',jsonb_build_array('06:00','18:00'),
      'timezone','Asia/Bangkok'
    )
  );

  return jsonb_build_object(
    'ok',true,
    'token_configured',true,
    'group_chat_id',clean_chat_id,
    'enabled',true
  );
end
$$;

create or replace function public.test_telegram_notification_settings()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor public.profiles;
  queued_id bigint;
  dispatched_count integer;
begin
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null or actor.role not in ('admin','exec') then
    raise insufficient_privilege using message='เฉพาะผู้ดูแลหรือผู้บริหาร';
  end if;

  queued_id:=public.queue_telegram_notification(
    'telegram_settings_test',
    null,
    'telegram-settings-test:'||gen_random_uuid()::text,
    E'🔔 [ทดสอบระบบ] Company Hub เชื่อม Telegram สำเร็จ\n'||
    'ผู้ทดสอบ: '||actor.display_name||E'\n'||
    'กลุ่มนี้จะได้รับแจ้งเตือนเมื่อ CEO มอบหมายงาน เมื่องานเสร็จ และสรุปรวมเวลา 06:00 / 18:00 น.'
  );
  dispatched_count:=public.dispatch_telegram_notifications(20);

  insert into public.access_audit(actor_id,target_user_id,old_access,new_access)
  values(actor.id,actor.id,'{}'::jsonb,jsonb_build_object('action','telegram_notification_test_queued','queue_id',queued_id));

  return jsonb_build_object('ok',true,'queue_id',queued_id,'dispatched',dispatched_count);
end
$$;

revoke all on function public.get_telegram_notification_settings() from public,anon;
revoke all on function public.save_telegram_notification_settings(text,text) from public,anon;
revoke all on function public.test_telegram_notification_settings() from public,anon;
grant execute on function public.get_telegram_notification_settings() to authenticated;
grant execute on function public.save_telegram_notification_settings(text,text) to authenticated;
grant execute on function public.test_telegram_notification_settings() to authenticated;

commit;
