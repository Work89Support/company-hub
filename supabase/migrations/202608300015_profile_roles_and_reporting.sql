-- Production role hardening and employee-position support.
-- Management permission is explicit: a lead manages only departments whose
-- profile_departments.can_manage flag is true. Visibility remains independent.

alter table public.profiles
  add column if not exists position_title text not null default '';

create or replace function public.can_manage_department(dept text)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.active and (
      p.role in ('exec','admin')
      or (p.role='lead' and exists(
        select 1 from public.profile_departments pd
        where pd.profile_id=p.id
          and pd.department_code=dept
          and pd.can_manage
      ))
    )
  )
$$;

-- Shared prototype state is metadata only and must not expose legacy demo data.
update public.company_hub_state
set data=jsonb_build_object('V',coalesce(data->'V','"2"'::jsonb)),
    updated_at=now(),updated_by='migration-015'
where id='main';

drop policy if exists "company hub authenticated read" on public.company_hub_state;
drop policy if exists "company hub managers update" on public.company_hub_state;
drop policy if exists "access admins read company hub metadata" on public.company_hub_state;
drop policy if exists "access admins update company hub metadata" on public.company_hub_state;
create policy "access admins read company hub metadata" on public.company_hub_state
for select to authenticated using (public.is_access_admin());
-- There is intentionally no authenticated UPDATE policy. Production entities
-- are written to normalized tables; allowing an older frontend to update this
-- row could restore archived demo payloads.

drop function if exists public.set_user_access(uuid,public.company_role,text,text[],text[],boolean);

create or replace function public.set_user_access(
  target_user uuid,
  new_role public.company_role,
  new_primary_department text,
  visible_departments text[],
  managed_departments text[],
  new_active boolean,
  new_position_title text
) returns void language plpgsql security definer set search_path=public as $$
declare
  caller_role public.company_role;
  target_role public.company_role;
  previous_access jsonb;
  visible text[];
  managed text[];
  clean_position text;
begin
  select role into caller_role from public.profiles where id=auth.uid() and active;
  select role into target_role from public.profiles where id=target_user;
  if caller_role not in ('exec','admin') then raise exception 'insufficient permission'; end if;
  if target_role is null then raise exception 'target user not found'; end if;
  if target_role='admin' and caller_role<>'admin' then raise exception 'only admin can change admin access'; end if;
  if new_role='admin' and caller_role<>'admin' then raise exception 'only admin can grant admin'; end if;
  if target_user=auth.uid() and (not new_active or new_role not in ('exec','admin')) then
    raise exception 'cannot disable or remove your own access-admin role';
  end if;
  if not exists(select 1 from public.departments where code=new_primary_department) then
    raise exception 'invalid primary department';
  end if;
  clean_position := left(trim(coalesce(new_position_title,'')),120);
  if clean_position='' then raise exception 'position title is required'; end if;

  select coalesce(array_agg(distinct d.code),'{}'::text[]) into visible
  from public.departments d
  where d.code=any(array_append(coalesce(visible_departments,'{}'::text[]),new_primary_department));
  select coalesce(array_agg(distinct d.code),'{}'::text[]) into managed
  from public.departments d
  where new_role='lead'
    and d.code=any(coalesce(managed_departments,'{}'::text[]))
    and d.code=any(visible);

  select jsonb_build_object(
    'role',p.role,'active',p.active,'position_title',p.position_title,
    'primary_department',p.department_code,
    'departments',coalesce(jsonb_agg(jsonb_build_object('code',pd.department_code,'can_manage',pd.can_manage))
      filter(where pd.department_code is not null),'[]'::jsonb)
  ) into previous_access
  from public.profiles p left join public.profile_departments pd on pd.profile_id=p.id
  where p.id=target_user group by p.id;

  update public.profiles
  set role=new_role,department_code=new_primary_department,position_title=clean_position,
      active=new_active,updated_at=now()
  where id=target_user;
  delete from public.profile_departments where profile_id=target_user;
  insert into public.profile_departments(profile_id,department_code,can_manage)
  select target_user,u.code,new_role='lead' and u.code=any(managed)
  from unnest(case when new_role in ('exec','admin') then array[new_primary_department] else visible end) as u(code)
  on conflict(profile_id,department_code) do update set can_manage=excluded.can_manage;

  insert into public.access_audit(actor_id,target_user_id,old_access,new_access)
  values(auth.uid(),target_user,coalesce(previous_access,'{}'::jsonb),jsonb_build_object(
    'role',new_role,'active',new_active,'position_title',clean_position,
    'primary_department',new_primary_department,
    'visible_departments',visible,'managed_departments',managed
  ));
end
$$;

revoke all on function public.set_user_access(uuid,public.company_role,text,text[],text[],boolean,text) from public;
grant execute on function public.set_user_access(uuid,public.company_role,text,text[],text[],boolean,text) to authenticated;

comment on function public.set_user_access(uuid,public.company_role,text,text[],text[],boolean,text)
is 'Production RBAC: configures position, role, active state, visible departments and explicitly managed departments.';

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
  initial_dept := coalesce(nullif(new.raw_app_meta_data->>'department',''),'GRAPHIC');
  if not exists(select 1 from public.departments where code=initial_dept) then initial_dept := 'GRAPHIC'; end if;
  insert into public.profiles(id,email,display_name,position_title,role,department_code,active)
  values(
    new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'display_name',''),
    left(coalesce(new.raw_user_meta_data->>'position_title',''),120),initial_role,initial_dept,true
  )
  on conflict(id) do update set
    email=excluded.email,
    display_name=case when excluded.display_name<>'' then excluded.display_name else public.profiles.display_name end,
    position_title=case when excluded.position_title<>'' then excluded.position_title else public.profiles.position_title end,
    updated_at=now();
  insert into public.profile_departments(profile_id,department_code,can_manage)
  values(new.id,initial_dept,false)
  on conflict(profile_id,department_code) do nothing;
  return new;
end
$$;
