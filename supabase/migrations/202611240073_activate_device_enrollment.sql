-- Activate device enforcement only after the schema, Edge Function and
-- browser UI have all been deployed and verified.
begin;

update public.user_access_devices
set status='blocked',
    reviewed_at=coalesce(reviewed_at,now()),
    review_note=case when review_note='' then 'รีเซ็ตก่อนเปิดระบบลงทะเบียนอุปกรณ์ v2' else review_note end
where status<>'blocked';

update public.user_access_grants
set revoked_at=coalesce(revoked_at,now())
where revoked_at is null;

update public.user_access_ip_rules set active=false where active;

insert into public.user_access_policies(profile_id,enforce_device,enforce_ip,session_minutes,updated_at)
select p.id,(p.role not in ('exec','admin')),false,30,now()
from public.profiles p
on conflict(profile_id) do update set
  enforce_device=excluded.enforce_device,
  enforce_ip=false,
  session_minutes=30,
  updated_at=now();

alter table public.user_access_policies
  alter column enforce_device set default true,
  alter column enforce_ip set default false,
  alter column session_minutes set default 30;

update public.device_access_config
set enabled=true,activated_at=now(),updated_at=now()
where id=true;

commit;
