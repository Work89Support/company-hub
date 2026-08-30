-- Production-only cutover: archive and remove prototype rows, then separate
-- per-department visibility from management permissions.

insert into public.company_hub_legacy_archive(archived_by,payload)
select null,jsonb_build_object(
  'reason','production_only_cutover_202608300012',
  'tasks',coalesce((select jsonb_agg(to_jsonb(t)) from public.tasks t where t.legacy_key is not null),'[]'::jsonb),
  'sops',coalesce((select jsonb_agg(to_jsonb(s)) from public.sops s where s.legacy_key is not null and s.source_issue_id is null),'[]'::jsonb),
  'knowledge',coalesce((select jsonb_agg(to_jsonb(k)) from public.knowledge_articles k where k.legacy_key is not null),'[]'::jsonb),
  'kpi_definitions',coalesce((select jsonb_agg(to_jsonb(d)) from public.kpi_definitions d where d.legacy_key is not null),'[]'::jsonb),
  'shared_state',coalesce((select data from public.company_hub_state where id='main'),'{}'::jsonb)
)
where exists(select 1 from public.tasks where legacy_key is not null)
   or exists(select 1 from public.sops where legacy_key is not null and source_issue_id is null)
   or exists(select 1 from public.knowledge_articles where legacy_key is not null)
   or exists(select 1 from public.kpi_definitions where legacy_key is not null);

delete from public.kpi_results
where definition_id in (select id from public.kpi_definitions where legacy_key is not null);
delete from public.kpi_definitions where legacy_key is not null;

delete from public.sop_versions
where sop_id in (select id from public.sops where legacy_key is not null and source_issue_id is null);
delete from public.sops where legacy_key is not null and source_issue_id is null;

delete from public.knowledge_articles where legacy_key is not null;
delete from public.task_comments where task_id in (select id from public.tasks where legacy_key is not null);
delete from public.time_entries where task_id in (select id from public.tasks where legacy_key is not null);
delete from public.task_assignees where task_id in (select id from public.tasks where legacy_key is not null);
delete from public.task_events where task_id in (select id from public.tasks where legacy_key is not null);
delete from public.tasks where legacy_key is not null;

update public.company_hub_state
set data=coalesce(data,'{}'::jsonb)-'TASKS'-'KB'-'KPI_ACT'-'ANN'-'GROUPS'-'REPORT_EDITS'-'CARRIED',
    updated_at=now(),updated_by='migration-012'
where id='main';

drop function if exists public.set_user_access(uuid,public.company_role,text,text[]);

create or replace function public.set_user_access(
  target_user uuid,
  new_role public.company_role,
  new_primary_department text,
  visible_departments text[],
  managed_departments text[],
  new_active boolean
) returns void language plpgsql security definer set search_path=public as $$
declare
  caller_role public.company_role;
  target_role public.company_role;
  previous_access jsonb;
  visible text[];
  managed text[];
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

  select coalesce(array_agg(distinct d.code),'{}'::text[]) into visible
  from public.departments d
  where d.code=any(array_append(coalesce(visible_departments,'{}'::text[]),new_primary_department));
  select coalesce(array_agg(distinct d.code),'{}'::text[]) into managed
  from public.departments d
  where new_role='lead' and d.code=any(coalesce(managed_departments,'{}'::text[])) and d.code=any(visible);

  select jsonb_build_object(
    'role',p.role,'active',p.active,'primary_department',p.department_code,
    'departments',coalesce(jsonb_agg(jsonb_build_object('code',pd.department_code,'can_manage',pd.can_manage))
      filter(where pd.department_code is not null),'[]'::jsonb)
  ) into previous_access
  from public.profiles p left join public.profile_departments pd on pd.profile_id=p.id
  where p.id=target_user group by p.id;

  update public.profiles set role=new_role,department_code=new_primary_department,active=new_active,updated_at=now()
  where id=target_user;
  delete from public.profile_departments where profile_id=target_user;
  insert into public.profile_departments(profile_id,department_code,can_manage)
  select target_user,u.code,new_role='lead' and u.code=any(managed)
  from unnest(case when new_role in ('exec','admin') then array[new_primary_department] else visible end) as u(code)
  on conflict(profile_id,department_code) do update set can_manage=excluded.can_manage;

  insert into public.access_audit(actor_id,target_user_id,old_access,new_access)
  values(auth.uid(),target_user,coalesce(previous_access,'{}'::jsonb),jsonb_build_object(
    'role',new_role,'active',new_active,'primary_department',new_primary_department,
    'visible_departments',visible,'managed_departments',managed
  ));
end
$$;

revoke all on function public.set_user_access(uuid,public.company_role,text,text[],text[],boolean) from public;
grant execute on function public.set_user_access(uuid,public.company_role,text,text[],text[],boolean) to authenticated;

comment on function public.set_user_access(uuid,public.company_role,text,text[],text[],boolean)
is 'Production RBAC: independently configures role, active state, visible departments and lead-managed departments.';
