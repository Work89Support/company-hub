-- Add AI Automation as the fourteenth active department and move the sole
-- production administrator from Programmer to the new primary department.
begin;

insert into public.departments(code,name,active,reporting_parent_code)
values ('AIAUTO','AI Automation',true,null)
on conflict(code) do update set name=excluded.name,active=true,reporting_parent_code=null;

do $$
declare target_id uuid;
begin
  select id into strict target_id
  from public.profiles
  where active and role='admin' and email='work.ltd89@gmail.com';

  update public.profiles
  set department_code='AIAUTO',
      position_title=case when trim(coalesce(position_title,''))='' then 'AI Automation' else position_title end,
      updated_at=now()
  where id=target_id;

  delete from public.profile_departments
  where profile_id=target_id and department_code='PROG';

  insert into public.profile_departments(profile_id,department_code,can_manage)
  values(target_id,'AIAUTO',true)
  on conflict(profile_id,department_code)
  do update set can_manage=excluded.can_manage;
end $$;

commit;
