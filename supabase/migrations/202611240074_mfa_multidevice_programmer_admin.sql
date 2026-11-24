-- Multi-device MFA enrollment and permanent administrator-equivalent access
-- for every active Programmer profile, including Max and P when they are in
-- the PROG department or have a PROG department membership.
begin;

create or replace function public.promote_programmer_primary_profile()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.department_code='PROG' or coalesce(new.position_title,'') ~* '(programmer|โปรแกรมเมอร์)' then new.role='admin'; end if;
  return new;
end
$$;

drop trigger if exists profiles_promote_programmer_admin on public.profiles;
create trigger profiles_promote_programmer_admin
before insert or update of department_code,position_title,role on public.profiles
for each row execute function public.promote_programmer_primary_profile();

create or replace function public.promote_programmer_membership_profile()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.department_code='PROG' then
    update public.profiles set role='admin' where id=new.profile_id and role<>'admin';
  end if;
  return new;
end
$$;

drop trigger if exists profile_departments_promote_programmer_admin on public.profile_departments;
create trigger profile_departments_promote_programmer_admin
after insert or update of department_code on public.profile_departments
for each row execute function public.promote_programmer_membership_profile();

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
    values(new.id,false,false,30,now())
    on conflict(profile_id) do update set
      enforce_device=false,enforce_ip=false,session_minutes=30,updated_at=now();
  end if;
  return new;
end
$$;

drop trigger if exists profiles_sync_programmer_admin_access on public.profiles;
create trigger profiles_sync_programmer_admin_access
after insert or update of department_code,position_title,role on public.profiles
for each row execute function public.sync_programmer_admin_access();

update public.profiles p set role='admin'
where p.active and (
  p.department_code='PROG' or coalesce(p.position_title,'') ~* '(programmer|โปรแกรมเมอร์)' or exists(
    select 1 from public.profile_departments pd
    where pd.profile_id=p.id and pd.department_code='PROG'
  )
);

update auth.users u
set raw_app_meta_data=coalesce(u.raw_app_meta_data,'{}'::jsonb)
  || jsonb_build_object('company_role','admin','department',p.department_code)
from public.profiles p
where p.id=u.id and p.active and p.role='admin' and (
  p.department_code='PROG' or coalesce(p.position_title,'') ~* '(programmer|โปรแกรมเมอร์)' or exists(
    select 1 from public.profile_departments pd
    where pd.profile_id=p.id and pd.department_code='PROG'
  )
);

insert into public.user_access_policies(profile_id,enforce_device,enforce_ip,session_minutes,updated_at)
select p.id,false,false,30,now()
from public.profiles p
where p.active and p.role='admin' and (
  p.department_code='PROG' or coalesce(p.position_title,'') ~* '(programmer|โปรแกรมเมอร์)' or exists(
    select 1 from public.profile_departments pd
    where pd.profile_id=p.id and pd.department_code='PROG'
  )
)
on conflict(profile_id) do update set
  enforce_device=false,enforce_ip=false,session_minutes=30,updated_at=now();

comment on table public.user_access_devices is
  'Opaque browser installation IDs. Each non-exempt new browser is approved after the account owner completes TOTP MFA. Multiple approved browsers are allowed; blocked browsers require administrator review.';

commit;
