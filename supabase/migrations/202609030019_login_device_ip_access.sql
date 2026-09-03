-- Company Hub login hardening: department RLS remains the source of truth,
-- while an Edge Function grants short-lived API access only to approved
-- devices and IP/CIDR ranges. Existing users remain unenforced until an
-- administrator enables either switch, preventing an accidental lockout.

create table if not exists public.user_access_policies (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  enforce_device boolean not null default false,
  enforce_ip boolean not null default false,
  session_minutes integer not null default 5 check (session_minutes between 2 and 60),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_access_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_key_hash text not null check (length(device_key_hash)=64),
  device_label text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','blocked')),
  first_seen_ip inet,
  last_seen_ip inet,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  unique(profile_id,device_key_hash)
);

create table if not exists public.user_access_ip_rules (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  allowed_network inet not null,
  label text not null default '',
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(profile_id,allowed_network)
);

create table if not exists public.user_access_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.user_access_devices(id) on delete cascade,
  ip_address inet not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(profile_id,device_id)
);

create table if not exists public.login_access_audit (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  device_id uuid references public.user_access_devices(id) on delete set null,
  ip_address inet,
  result text not null check (result in ('allowed','denied')),
  reason text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists user_access_devices_profile_status_idx
  on public.user_access_devices(profile_id,status);
create index if not exists user_access_ip_rules_profile_active_idx
  on public.user_access_ip_rules(profile_id,active);
create index if not exists user_access_grants_active_idx
  on public.user_access_grants(profile_id,expires_at) where revoked_at is null;
create index if not exists login_access_audit_profile_created_idx
  on public.login_access_audit(profile_id,created_at desc);

alter table public.user_access_policies enable row level security;
alter table public.user_access_devices enable row level security;
alter table public.user_access_ip_rules enable row level security;
alter table public.user_access_grants enable row level security;
alter table public.login_access_audit enable row level security;

revoke all on public.user_access_policies,public.user_access_devices,
  public.user_access_ip_rules,public.user_access_grants,public.login_access_audit
  from anon,authenticated;
grant select on public.user_access_policies,public.user_access_devices,
  public.user_access_ip_rules,public.login_access_audit to authenticated;

drop policy if exists "access admins read login policies" on public.user_access_policies;
create policy "access admins read login policies" on public.user_access_policies
for select to authenticated using (profile_id=auth.uid() or public.is_access_admin());

drop policy if exists "access admins read devices" on public.user_access_devices;
create policy "access admins read devices" on public.user_access_devices
for select to authenticated using (profile_id=auth.uid() or public.is_access_admin());

drop policy if exists "access admins read IP rules" on public.user_access_ip_rules;
create policy "access admins read IP rules" on public.user_access_ip_rules
for select to authenticated using (profile_id=auth.uid() or public.is_access_admin());

drop policy if exists "access admins read login audit" on public.login_access_audit;
create policy "access admins read login audit" on public.login_access_audit
for select to authenticated using (profile_id=auth.uid() or public.is_access_admin());

-- Called only with the server-side service role by the access-gate function.
create or replace function public.evaluate_login_access(
  p_profile_id uuid,
  p_device_key_hash text,
  p_device_label text,
  p_ip text,
  p_user_agent text default ''
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  account_active boolean;
  policy_device boolean := false;
  policy_ip boolean := false;
  grant_minutes integer := 5;
  parsed_ip inet;
  device_row public.user_access_devices%rowtype;
  device_ok boolean;
  ip_ok boolean;
  decision boolean;
  decision_reason text;
  grant_expiry timestamptz;
begin
  if p_profile_id is null or p_device_key_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('allowed',false,'reason','ข้อมูลเครื่องไม่ถูกต้อง');
  end if;
  begin
    parsed_ip := nullif(trim(p_ip),'')::inet;
  exception when others then
    return jsonb_build_object('allowed',false,'reason','ไม่สามารถตรวจสอบ IP ของเครื่องได้');
  end;

  select p.active into account_active from public.profiles p where p.id=p_profile_id;
  if coalesce(account_active,false)=false then
    return jsonb_build_object('allowed',false,'reason','บัญชีถูกปิดใช้งานหรือยังไม่ได้รับสิทธิ์');
  end if;

  select ap.enforce_device,ap.enforce_ip,ap.session_minutes
  into policy_device,policy_ip,grant_minutes
  from public.user_access_policies ap where ap.profile_id=p_profile_id;
  policy_device := coalesce(policy_device,false);
  policy_ip := coalesce(policy_ip,false);
  grant_minutes := coalesce(grant_minutes,5);

  insert into public.user_access_devices(profile_id,device_key_hash,device_label,first_seen_ip,last_seen_ip)
  values(p_profile_id,p_device_key_hash,left(coalesce(p_device_label,''),120),parsed_ip,parsed_ip)
  on conflict(profile_id,device_key_hash) do update set
    device_label=case when excluded.device_label<>'' then excluded.device_label else public.user_access_devices.device_label end,
    last_seen_ip=excluded.last_seen_ip,last_seen_at=now()
  returning * into device_row;

  device_ok := not policy_device or device_row.status='approved';
  ip_ok := not policy_ip or exists(
    select 1 from public.user_access_ip_rules r
    where r.profile_id=p_profile_id and r.active and parsed_ip <<= r.allowed_network
  );
  decision := device_ok and ip_ok;
  decision_reason := case
    when policy_device and device_row.status='blocked' then 'เครื่องนี้ถูกบล็อก'
    when policy_device and device_row.status<>'approved' then 'เครื่องนี้รอผู้ดูแลอนุมัติ'
    when policy_ip and not ip_ok then 'IP นี้อยู่นอกช่วงที่อนุญาต'
    else 'ผ่านการตรวจบัญชี แผนก เครื่อง และ IP'
  end;

  if decision then
    grant_expiry := now() + make_interval(mins=>grant_minutes);
    insert into public.user_access_grants(profile_id,device_id,ip_address,expires_at,last_seen_at,revoked_at)
    values(p_profile_id,device_row.id,parsed_ip,grant_expiry,now(),null)
    on conflict(profile_id,device_id) do update set
      ip_address=excluded.ip_address,expires_at=excluded.expires_at,last_seen_at=now(),revoked_at=null;
  else
    update public.user_access_grants set revoked_at=now()
    where profile_id=p_profile_id and device_id=device_row.id and revoked_at is null;
  end if;

  if not exists(
    select 1 from public.login_access_audit a
    where a.profile_id=p_profile_id and a.device_id=device_row.id
      and a.result=case when decision then 'allowed' else 'denied' end
      and a.reason=decision_reason and a.created_at>now()-interval '15 minutes'
  ) then
    insert into public.login_access_audit(profile_id,device_id,ip_address,result,reason,user_agent)
    values(p_profile_id,device_row.id,parsed_ip,case when decision then 'allowed' else 'denied' end,
      decision_reason,left(coalesce(p_user_agent,''),300));
  end if;

  return jsonb_build_object(
    'allowed',decision,'reason',decision_reason,'detected_ip',host(parsed_ip),
    'device_status',device_row.status,'expires_at',grant_expiry,
    'enforce_device',policy_device,'enforce_ip',policy_ip
  );
end
$$;
revoke all on function public.evaluate_login_access(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.evaluate_login_access(uuid,text,text,text,text) to service_role;

create or replace function public.edge_access_allowed(p_profile_id uuid,p_ip text)
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare
  policy_device boolean := false;
  policy_ip boolean := false;
  parsed_ip inet;
begin
  begin parsed_ip:=nullif(trim(p_ip),'')::inet; exception when others then return false; end;
  select ap.enforce_device,ap.enforce_ip into policy_device,policy_ip
  from public.user_access_policies ap where ap.profile_id=p_profile_id;
  policy_device:=coalesce(policy_device,false);policy_ip:=coalesce(policy_ip,false);
  if not policy_device and not policy_ip then return true; end if;
  if policy_ip and not exists(
    select 1 from public.user_access_ip_rules r
    where r.profile_id=p_profile_id and r.active and parsed_ip <<= r.allowed_network
  ) then return false; end if;
  return exists(
    select 1 from public.user_access_grants g
    where g.profile_id=p_profile_id and g.revoked_at is null
      and g.expires_at>now() and g.ip_address=parsed_ip
  );
end
$$;
revoke all on function public.edge_access_allowed(uuid,text) from public,anon,authenticated;
grant execute on function public.edge_access_allowed(uuid,text) to service_role;

-- This pre-request check covers every PostgREST query, including policies that
-- grant access by ownership and therefore do not call can_view_department().
create or replace function public.check_company_access()
returns void language plpgsql stable security definer set search_path=''
as $$
declare
  policy_device boolean := false;
  policy_ip boolean := false;
  forwarded_ip text;
  request_ip inet;
begin
  if auth.role()<>'authenticated' then return; end if;
  select ap.enforce_device,ap.enforce_ip into policy_device,policy_ip
  from public.user_access_policies ap where ap.profile_id=auth.uid();
  policy_device:=coalesce(policy_device,false);policy_ip:=coalesce(policy_ip,false);
  if not policy_device and not policy_ip then return; end if;

  forwarded_ip:=split_part(coalesce(coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)->>'x-forwarded-for',''),',',1);
  begin request_ip:=trim(forwarded_ip)::inet;
  exception when others then raise insufficient_privilege using message='CLIENT_IP_UNAVAILABLE'; end;

  if policy_ip and not exists(
    select 1 from public.user_access_ip_rules r
    where r.profile_id=auth.uid() and r.active and request_ip <<= r.allowed_network
  ) then
    raise insufficient_privilege using message='IP_NOT_ALLOWED';
  end if;

  -- Every enforced session must be refreshed by Access Gate and used from the
  -- same source IP. This prevents a copied JWT being replayed from elsewhere.
  if not exists(
    select 1 from public.user_access_grants g
    where g.profile_id=auth.uid() and g.revoked_at is null and g.expires_at>now()
      and g.ip_address=request_ip
  ) then
    raise insufficient_privilege using message='DEVICE_OR_IP_ACCESS_REQUIRED';
  end if;
end
$$;
revoke all on function public.check_company_access() from public,anon,authenticated;
grant execute on function public.check_company_access() to anon,authenticated,service_role;
alter role authenticator set pgrst.db_pre_request = 'public.check_company_access';
notify pgrst, 'reload config';

create or replace function public.set_user_login_policy(
  target_user uuid,
  new_enforce_device boolean,
  new_enforce_ip boolean,
  new_session_minutes integer,
  allowed_cidrs text[]
) returns void language plpgsql security definer set search_path=''
as $$
declare
  cidr_value text;
  parsed_network inet;
begin
  if not public.is_access_admin() then raise exception 'access administrator permission required'; end if;
  if not exists(select 1 from public.profiles where id=target_user) then raise exception 'target user not found'; end if;
  if new_session_minutes not between 2 and 60 then raise exception 'session minutes must be between 2 and 60'; end if;

  if new_enforce_device and not exists(
    select 1 from public.user_access_devices where profile_id=target_user and status='approved'
  ) then raise exception 'approve at least one device before enabling device lock'; end if;
  if new_enforce_ip and coalesce(cardinality(allowed_cidrs),0)=0 then
    raise exception 'add at least one IP or CIDR before enabling IP lock';
  end if;

  insert into public.user_access_policies(profile_id,enforce_device,enforce_ip,session_minutes,updated_by,updated_at)
  values(target_user,new_enforce_device,new_enforce_ip,new_session_minutes,auth.uid(),now())
  on conflict(profile_id) do update set enforce_device=excluded.enforce_device,
    enforce_ip=excluded.enforce_ip,session_minutes=excluded.session_minutes,
    updated_by=excluded.updated_by,updated_at=now();

  delete from public.user_access_ip_rules where profile_id=target_user;
  foreach cidr_value in array coalesce(allowed_cidrs,'{}'::text[]) loop
    if trim(cidr_value)<>'' then
      begin parsed_network:=trim(cidr_value)::inet;
      exception when others then raise exception 'invalid IP/CIDR: %',cidr_value; end;
      insert into public.user_access_ip_rules(profile_id,allowed_network,label,created_by)
      values(target_user,parsed_network,'ตั้งค่าจาก Company Hub',auth.uid())
      on conflict(profile_id,allowed_network) do update set active=true;
    end if;
  end loop;
  update public.user_access_grants set revoked_at=now() where profile_id=target_user and revoked_at is null;
end
$$;
revoke all on function public.set_user_login_policy(uuid,boolean,boolean,integer,text[]) from public;
grant execute on function public.set_user_login_policy(uuid,boolean,boolean,integer,text[]) to authenticated;

create or replace function public.set_user_device_status(target_device uuid,new_status text)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_access_admin() then raise exception 'access administrator permission required'; end if;
  if new_status not in ('pending','approved','blocked') then raise exception 'invalid device status'; end if;
  update public.user_access_devices set status=new_status,
    approved_by=case when new_status='approved' then auth.uid() else null end,
    approved_at=case when new_status='approved' then now() else null end
  where id=target_device;
  if not found then raise exception 'device not found'; end if;
  if new_status<>'approved' then
    update public.user_access_grants set revoked_at=now() where device_id=target_device and revoked_at is null;
  end if;
end
$$;
revoke all on function public.set_user_device_status(uuid,text) from public;
grant execute on function public.set_user_device_status(uuid,text) to authenticated;

comment on table public.user_access_policies is 'Per-user production login enforcement. Enable only after allowed devices/IP ranges are configured.';
comment on table public.user_access_devices is 'Opaque browser installation IDs hashed by the access-gate Edge Function; no hardware fingerprint is stored.';
comment on function public.check_company_access() is 'PostgREST pre-request gate. Department visibility remains enforced separately by RLS.';
