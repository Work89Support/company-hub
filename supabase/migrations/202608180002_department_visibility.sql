-- Per-user department visibility and access-management RPC.
-- Apply after 202608180001_normalized_rbac.sql.

insert into public.departments(code,name) values
  ('KPI','แผนก KPI'),('MKT','การตลาด'),('GRAPHIC','กราฟิก'),('CRM','ลูกค้าสัมพันธ์'),
  ('ADMIN','แอดมิน'),('QC','QC Chat'),('FIN','การเงิน'),('BO','Back Office (BC)'),
  ('HR','ทรัพยากรบุคคล'),('AUD123','ออดิทระบบ 123'),('AUDXB','ออดิทระบบ XB'),
  ('BOM','Back Office Mgmt'),('SECRET','เลขานุการ'),('PROG','โปรแกรมเมอร์')
on conflict(code) do update set name=excluded.name;

create table if not exists public.profile_departments (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  department_code text not null references public.departments(code) on delete cascade,
  can_manage boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (profile_id, department_code)
);

alter table public.profile_departments enable row level security;

create table if not exists public.access_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  target_user_id uuid not null references public.profiles(id),
  old_access jsonb not null default '{}'::jsonb,
  new_access jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.access_audit enable row level security;

create or replace function public.is_access_admin()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.profiles where id=auth.uid() and active and role in ('exec','admin'))
$$;

create or replace function public.can_manage_department(dept text)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.active and (
      p.role in ('exec','admin')
      or (p.role='lead' and (p.department_code=dept or exists(
        select 1 from public.profile_departments pd where pd.profile_id=p.id and pd.department_code=dept and pd.can_manage
      )))
    )
  )
$$;

drop policy if exists "read own department visibility" on public.profile_departments;
drop policy if exists "access admins manage department visibility" on public.profile_departments;
create policy "read own department visibility" on public.profile_departments for select to authenticated
using (profile_id=auth.uid() or public.is_access_admin());
create policy "access admins manage department visibility" on public.profile_departments for all to authenticated
using (public.is_access_admin()) with check (public.is_access_admin());
create policy "access admins read access audit" on public.access_audit for select to authenticated
using (public.is_access_admin());

drop policy if exists "access admins insert profiles" on public.profiles;
drop policy if exists "access admins update profiles" on public.profiles;
create policy "access admins insert profiles" on public.profiles for insert to authenticated
with check (public.is_access_admin());
create policy "access admins update profiles" on public.profiles for update to authenticated
using (public.is_access_admin()) with check (public.is_access_admin());

drop policy if exists "read visible tasks" on public.tasks;
create policy "read visible tasks" on public.tasks for select to authenticated
using (
  creator_id=auth.uid()
  or public.can_manage_department(department_code)
  or exists(select 1 from public.task_assignees a where a.task_id=id and a.user_id=auth.uid())
  or exists(select 1 from public.profile_departments pd where pd.profile_id=auth.uid() and pd.department_code=tasks.department_code)
);

drop policy if exists "read published or managed sops" on public.sops;
create policy "read published or visible sops" on public.sops for select to authenticated
using ((status='published' and exists(select 1 from public.profile_departments pd where pd.profile_id=auth.uid() and pd.department_code=sops.department_code)) or public.can_manage_department(department_code));

drop policy if exists "read published or managed knowledge" on public.knowledge_articles;
create policy "read published or visible knowledge" on public.knowledge_articles for select to authenticated
using ((status='published' and exists(select 1 from public.profile_departments pd where pd.profile_id=auth.uid() and pd.department_code=knowledge_articles.department_code)) or public.can_manage_department(department_code));

drop policy if exists "read kpi definitions" on public.kpi_definitions;
create policy "read visible kpi definitions" on public.kpi_definitions for select to authenticated
using (public.can_manage_department(department_code) or exists(select 1 from public.profile_departments pd where pd.profile_id=auth.uid() and pd.department_code=kpi_definitions.department_code));

drop policy if exists "read allowed kpi results" on public.kpi_results;
create policy "read visible kpi results" on public.kpi_results for select to authenticated
using (exists(
  select 1 from public.kpi_definitions d where d.id=definition_id and (
    public.can_manage_department(d.department_code)
    or exists(select 1 from public.profile_departments pd where pd.profile_id=auth.uid() and pd.department_code=d.department_code)
  )
));

-- Keep the temporary JSON prototype aligned with profiles, not stale JWT metadata.
-- Department-grade write isolation is provided by the normalized tables above.
drop policy if exists "company hub managers update" on public.company_hub_state;
create policy "company hub managers update" on public.company_hub_state for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role in ('lead','exec','admin')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role in ('lead','exec','admin')));

create or replace function public.handle_new_company_user()
returns trigger language plpgsql security definer set search_path=public
as $$
declare
  initial_role public.company_role;
  initial_dept text;
begin
  initial_role := case
    when coalesce(new.raw_app_meta_data->>'company_role','') in ('staff','lead','exec','admin')
      then (new.raw_app_meta_data->>'company_role')::public.company_role
    else 'staff'::public.company_role
  end;
  initial_dept := upper(coalesce(new.raw_app_meta_data->>'department','GRAPHIC'));
  if not exists(select 1 from public.departments where code=initial_dept) then initial_dept := 'GRAPHIC'; end if;
  insert into public.profiles(id,email,display_name,role,department_code)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'display_name',''),initial_role,initial_dept)
  on conflict(id) do nothing;
  insert into public.profile_departments(profile_id,department_code,can_manage)
  values(new.id,initial_dept,initial_role in ('lead','exec','admin'))
  on conflict(profile_id,department_code) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created_company_hub on auth.users;
create trigger on_auth_user_created_company_hub
after insert on auth.users for each row execute function public.handle_new_company_user();

-- Backfill existing Auth accounts. Existing app_metadata is honored; otherwise
-- the safe default is staff/GRAPHIC until an access admin changes it.
insert into public.profiles(id,email,display_name,role,department_code)
select u.id,coalesce(u.email,''),coalesce(u.raw_user_meta_data->>'display_name',''),
  case when coalesce(u.raw_app_meta_data->>'company_role','') in ('staff','lead','exec','admin')
    then (u.raw_app_meta_data->>'company_role')::public.company_role else 'staff'::public.company_role end,
  case when exists(select 1 from public.departments d where d.code=upper(coalesce(u.raw_app_meta_data->>'department','GRAPHIC')))
    then upper(coalesce(u.raw_app_meta_data->>'department','GRAPHIC')) else 'GRAPHIC' end
from auth.users u on conflict(id) do nothing;

insert into public.profile_departments(profile_id,department_code,can_manage)
select id,department_code,role in ('lead','exec','admin') from public.profiles
where department_code is not null on conflict(profile_id,department_code) do nothing;

create or replace function public.set_user_access(
  target_user uuid,
  new_role public.company_role,
  new_primary_department text,
  visible_departments text[]
) returns void language plpgsql security definer set search_path=public
as $$
declare caller_role public.company_role; target_role public.company_role; previous_access jsonb;
begin
  select role into caller_role from public.profiles where id=auth.uid() and active;
  select role into target_role from public.profiles where id=target_user and active;
  if caller_role not in ('exec','admin') then raise exception 'insufficient permission'; end if;
  if target_role is null then raise exception 'target user not found or inactive'; end if;
  if target_role='admin' and caller_role<>'admin' then raise exception 'only admin can change admin access'; end if;
  if new_role='admin' and caller_role<>'admin' then raise exception 'only admin can grant admin'; end if;
  if target_user=auth.uid() and new_role not in ('exec','admin') then raise exception 'cannot remove your own access-admin role'; end if;
  if not exists(select 1 from public.departments where code=new_primary_department) then raise exception 'invalid primary department'; end if;

  select jsonb_build_object('role',p.role,'primary_department',p.department_code,'visible_departments',coalesce(jsonb_agg(pd.department_code) filter(where pd.department_code is not null),'[]'::jsonb))
    into previous_access from public.profiles p left join public.profile_departments pd on pd.profile_id=p.id where p.id=target_user group by p.id;
  update public.profiles set role=new_role,department_code=new_primary_department,updated_at=now() where id=target_user;
  delete from public.profile_departments where profile_id=target_user;
  insert into public.profile_departments(profile_id,department_code,can_manage)
  select target_user,d.code,new_role in ('lead','exec','admin')
  from public.departments d
  where d.code=any(array_append(coalesce(visible_departments,'{}'::text[]),new_primary_department))
  on conflict(profile_id,department_code) do update set can_manage=excluded.can_manage;

  insert into public.access_audit(actor_id,target_user_id,old_access,new_access)
  values(auth.uid(),target_user,coalesce(previous_access,'{}'::jsonb),jsonb_build_object('role',new_role,'primary_department',new_primary_department,'visible_departments',visible_departments));
end
$$;

revoke all on function public.set_user_access(uuid,public.company_role,text,text[]) from public;
grant execute on function public.set_user_access(uuid,public.company_role,text,text[]) to authenticated;
