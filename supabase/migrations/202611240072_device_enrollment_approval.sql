-- Browser-device enrollment for Company Hub.
-- The first browser is self-enrolled after the user confirms the warning.
-- A replacement browser requires a department lead or system administrator.
-- Executive and administrator accounts are exempt from approval, but are
-- still registered and audited.
begin;

drop trigger if exists user_access_policy_disable_device_ip
  on public.user_access_policies;
drop function if exists public.disable_device_ip_access_policy();

alter table public.user_access_devices
  add column if not exists request_kind text not null default 'initial'
    check (request_kind in ('initial','replacement','exempt')),
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text not null default '',
  add column if not exists user_agent text not null default '';

create table if not exists public.device_access_config(
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.device_access_config(id,enabled) values(true,false)
on conflict(id) do nothing;
alter table public.device_access_config enable row level security;

create index if not exists user_access_devices_pending_review_idx
  on public.user_access_devices(status,requested_at desc)
  where status='pending';

comment on table public.user_access_devices is
  'Opaque browser installation IDs. First device is user-confirmed; replacement devices require lead/admin approval. No MAC address or hardware fingerprint is stored.';
comment on column public.user_access_devices.request_kind is
  'initial=self-enrolled first browser, replacement=approval required, exempt=executive/admin automatic registration';

commit;
