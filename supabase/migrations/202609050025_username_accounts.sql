-- Private username directory. Contact email is not an authenticated identity.
begin;
create table public.company_login_accounts (
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 login_name text not null check(char_length(login_name) between 3 and 180),
 source_key text not null unique,
 personal_name text not null check(char_length(personal_name) between 1 and 100),
 initial_code_expires_at timestamptz not null default now()+interval '7 days',
 contact_email text check(contact_email is null or (char_length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 must_change_password boolean not null default true,
 credentials_valid_after bigint not null default 0,
 credential_version integer not null default 0,
 credential_lock uuid,
 credential_lock_until timestamptz,
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create unique index company_login_name_unique on public.company_login_accounts(lower(login_name));
alter table public.company_login_accounts enable row level security;
revoke all on public.company_login_accounts from public,anon,authenticated;
grant all on public.company_login_accounts to service_role;

create table public.company_login_limits (
 bucket text primary key, attempts integer not null, expires_at timestamptz not null
);
alter table public.company_login_limits enable row level security;
revoke all on public.company_login_limits from public,anon,authenticated;
grant all on public.company_login_limits to service_role;
create function public.consume_company_login_attempt(p_bucket text,p_max integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 delete from public.company_login_limits where expires_at<now()-interval '1 hour';
 insert into public.company_login_limits values(p_bucket,1,now()+interval '10 minutes')
 on conflict(bucket) do update set attempts=case when company_login_limits.expires_at<now() then 1 else company_login_limits.attempts+1 end,
 expires_at=case when company_login_limits.expires_at<now() then now()+interval '10 minutes' else company_login_limits.expires_at end
 returning attempts into n;
 return n<=p_max;
end $$;
revoke all on function public.consume_company_login_attempt(text,integer) from public,anon,authenticated;
grant execute on function public.consume_company_login_attempt(text,integer) to service_role;

create function public.company_credentials_ready(p_profile uuid,p_iat bigint)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.company_login_accounts a where a.profile_id=p_profile
 and (a.must_change_password or a.credential_lock is not null or coalesce(p_iat,0)<a.credentials_valid_after))
$$;
revoke all on function public.company_credentials_ready(uuid,bigint) from public,anon,authenticated;
grant execute on function public.company_credentials_ready(uuid,bigint) to service_role;

-- Preserve the established device/IP check and add first-password/token fencing.
alter function public.check_company_access() rename to check_company_device_access;
create function public.check_company_access()
returns void language plpgsql stable security definer set search_path='' as $$
begin
 perform public.check_company_device_access();
 if auth.role()='authenticated' and not public.company_credentials_ready(auth.uid(),(auth.jwt()->>'iat')::bigint) then
  raise insufficient_privilege using message='PASSWORD_SETUP_OR_NEW_LOGIN_REQUIRED';
 end if;
end $$;
revoke all on function public.check_company_access() from public,anon,authenticated;
-- PostgREST invokes the pre-request function as the authenticated role.
grant execute on function public.check_company_access() to authenticated,anon;

-- Serialize password changes across Auth and Postgres. A failed operation stays
-- locked/pending; only a new administrator reset can recover it after timeout.
create function public.begin_company_credential_change(p_profile uuid,p_lock uuid,p_reset boolean,p_revision integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.company_login_accounts set credential_version=credential_version+1,credential_lock=p_lock,credential_lock_until=now()+interval '15 minutes',must_change_password=true,
 credentials_valid_after=greatest(credentials_valid_after,ceil(extract(epoch from clock_timestamp()))::bigint)
 where profile_id=p_profile and credential_version=p_revision and (credential_lock is null or (p_reset and credential_lock_until<now()));
 if not found then raise exception 'credential operation in progress'; end if;
end $$;
create function public.finish_company_credential_change(p_profile uuid,p_lock uuid,p_pending boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.company_login_accounts set credential_version=credential_version+1,credential_lock=null,credential_lock_until=null,must_change_password=p_pending,initial_code_expires_at=now()+interval '7 days',
 credentials_valid_after=greatest(credentials_valid_after,ceil(extract(epoch from clock_timestamp()))::bigint)
 where profile_id=p_profile and credential_lock=p_lock;
 if not found then raise exception 'credential operation superseded'; end if;
end $$;
revoke all on function public.begin_company_credential_change(uuid,uuid,boolean,integer),public.finish_company_credential_change(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.begin_company_credential_change(uuid,uuid,boolean,integer),public.finish_company_credential_change(uuid,uuid,boolean) to service_role;

create function public.update_company_account_details(p_name text,p_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare clean_name text:=regexp_replace(normalize(trim(p_name),NFC),'\s+',' ','g'); clean_email text:=nullif(lower(trim(p_email)),''); next_login text; dept_name text;
begin
 perform public.check_company_access();
 if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise insufficient_privilege; end if;
 if clean_name is null or char_length(clean_name) not between 1 and 100 or clean_name ~ '[[:cntrl:]]' then raise exception 'กรุณาระบุชื่อ 1–100 ตัวอักษร'; end if;
 select d.name into dept_name from public.profiles p join public.departments d on d.code=p.department_code where p.id=auth.uid();
 next_login:=clean_name||' ('||dept_name||')';
 update public.company_login_accounts set personal_name=clean_name,login_name=lower(next_login),contact_email=clean_email where profile_id=auth.uid();
 if not found then raise exception 'บัญชีนี้ยังไม่ได้เปิดใช้ชื่อสำหรับเข้าสู่ระบบ'; end if;
 update public.profiles set display_name=next_login,updated_at=now() where id=auth.uid();
 return jsonb_build_object('display_name',next_login,'contact_email',clean_email);
end $$;
revoke all on function public.update_company_account_details(text,text) from public,anon;
grant execute on function public.update_company_account_details(text,text) to authenticated;
-- Realtime and Storage do not execute PostgREST's pre-request hook.
create function public.my_company_credentials_ready()
returns boolean language sql stable security definer set search_path='' as $$
 select public.company_credentials_ready(auth.uid(),(auth.jwt()->>'iat')::bigint)
$$;
revoke all on function public.my_company_credentials_ready() from public,anon;
grant execute on function public.my_company_credentials_ready() to authenticated;
do $$ declare r record; begin
 for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.relkind='r' and c.relrowsecurity and (n.nspname='public' or (n.nspname='storage' and c.relname='objects')) loop
  execute format('create policy company_password_ready on %I.%I as restrictive for all to authenticated using ((select public.my_company_credentials_ready())) with check ((select public.my_company_credentials_ready()))',r.nspname,r.relname);
 end loop;
end $$;
create function public.link_company_source_owner(p_profile uuid,p_name text,p_dept text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.company_login_accounts a join public.profiles p on p.id=a.profile_id where p.id=p_profile and p.department_code=p_dept) then raise exception 'account missing'; end if;
 if exists(select 1 from public.daily_activities where department_code=p_dept and employee_name=p_name and employee_id is not null and employee_id<>p_profile) then raise exception 'source already assigned'; end if;
 update public.daily_activities set employee_id=p_profile where department_code=p_dept and employee_name=p_name and employee_id is null;
 if p_dept='GRAPHIC' then
  if exists(select 1 from public.graphic_trello_members where full_name=p_name and linked_profile_id is not null and linked_profile_id<>p_profile) then raise exception 'member already assigned'; end if;
  update public.graphic_trello_members set linked_profile_id=p_profile,account_status='linked',updated_at=now() where full_name=p_name and linked_profile_id is null;
  update public.graphic_job_members set profile_id=p_profile where trello_member_id in (select trello_member_id from public.graphic_trello_members where linked_profile_id=p_profile) and profile_id is null;
 end if;
end $$;
revoke all on function public.link_company_source_owner(uuid,text,text) from public,anon,authenticated;
grant execute on function public.link_company_source_owner(uuid,text,text) to service_role;
create function public.sync_company_login_department()
returns trigger language plpgsql security definer set search_path='' as $$
declare person text; department text;
begin
 if new.department_code is distinct from old.department_code then
  select personal_name into person from public.company_login_accounts where profile_id=new.id;
  if person is not null then
   select name into department from public.departments where code=new.department_code;
   if department is null then raise exception 'username account requires a department'; end if;
   new.display_name:=person||' ('||department||')';
   update public.company_login_accounts set login_name=lower(new.display_name) where profile_id=new.id;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.sync_company_login_department() from public,anon,authenticated;
create trigger sync_company_login_department before update of department_code on public.profiles for each row execute function public.sync_company_login_department();
commit;
