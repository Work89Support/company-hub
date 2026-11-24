-- Device approval is intentionally narrower than the general admin role.
-- Only AMM and Max may review requests. CEO remains exempt. Every other
-- account, including Programmer admins, must request approval for its first
-- device; later devices also require a written reason.
begin;

alter table public.user_access_devices
  add column if not exists request_reason text not null default '';

alter table public.user_access_devices
  drop constraint if exists user_access_devices_request_reason_length,
  add constraint user_access_devices_request_reason_length
    check (char_length(request_reason) <= 500);

create table if not exists public.device_access_approvers(
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  appointed_at timestamptz not null default now(),
  note text not null default ''
);
alter table public.device_access_approvers enable row level security;

delete from public.device_access_approvers;
insert into public.device_access_approvers(profile_id,note)
select p.id,case
  when lower(p.email)='work.ltd89@gmail.com' then 'AMM ผู้ดูแลระบบ'
  else 'คุณแม็ก โปรแกรมเมอร์'
end
from public.profiles p
where p.active and (
  lower(p.email)='work.ltd89@gmail.com'
  or p.id='f53d6369-dd9e-43b5-9971-dd99e4defa4a'::uuid
);

do $$
begin
  if (select count(*) from public.device_access_approvers) <> 2 then
    raise exception 'device approvers must resolve exactly to AMM and Max';
  end if;
end
$$;

update public.user_access_policies policy
set enforce_device=(p.role<>'exec' and not exists(
      select 1 from public.device_access_approvers a where a.profile_id=p.id
    )),
    enforce_ip=false,
    session_minutes=30,
    updated_at=now()
from public.profiles p
where p.id=policy.profile_id;

insert into public.user_access_policies(profile_id,enforce_device,enforce_ip,session_minutes,updated_at)
select p.id,(p.role<>'exec' and not exists(
    select 1 from public.device_access_approvers a where a.profile_id=p.id
  )),false,30,now()
from public.profiles p
where not exists(select 1 from public.user_access_policies policy where policy.profile_id=p.id);

create or replace function public.sync_programmer_admin_access()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.role='admin' and (
    new.department_code='PROG' or coalesce(new.position_title,'') ~* '(programmer|โปรแกรมเมอร์)' or exists(
      select 1 from public.profile_departments pd
      where pd.profile_id=new.id and pd.department_code='PROG'
    )
  ) then
    update auth.users
    set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)
      || jsonb_build_object('company_role','admin','department',new.department_code)
    where id=new.id;

    insert into public.user_access_policies(profile_id,enforce_device,enforce_ip,session_minutes,updated_at)
    values(new.id,not exists(
      select 1 from public.device_access_approvers a where a.profile_id=new.id
    ),false,30,now())
    on conflict(profile_id) do update set
      enforce_device=excluded.enforce_device,enforce_ip=false,session_minutes=30,updated_at=now();
  end if;
  return new;
end
$$;

comment on table public.device_access_approvers is
  'Named device reviewers. This is deliberately separate from role=admin so Programmer admins cannot approve device access.';
comment on column public.user_access_devices.request_reason is
  'Reason supplied by the requester. Additional or replacement devices require at least 10 characters in the Access Gate.';
comment on table public.user_access_devices is
  'Opaque browser installation IDs. Non-exempt accounts use TOTP then wait for AMM or Max approval even for the first browser. Additional browsers require a written reason.';

commit;
