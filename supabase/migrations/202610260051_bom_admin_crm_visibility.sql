-- BOM staff can read BOM, ADMIN and CRM work without receiving management
-- permission in ADMIN or CRM.  The shared department visibility helper is
-- already used by tasks, daily activities and operational issues.
begin;

insert into public.profile_departments(profile_id,department_code,can_manage)
select p.id,d.department_code,false
from public.profiles p
cross join (values ('ADMIN'::text),('CRM'::text)) as d(department_code)
where p.active and p.department_code='BOM'
on conflict(profile_id,department_code) do nothing;

create or replace function public.sync_bom_read_visibility()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.active and new.department_code='BOM' then
    insert into public.profile_departments(profile_id,department_code,can_manage)
    values(new.id,'ADMIN',false),(new.id,'CRM',false)
    on conflict(profile_id,department_code) do nothing;
  elsif tg_op='UPDATE'
    and old.department_code='BOM'
    and (not new.active or new.department_code is distinct from 'BOM') then
    delete from public.profile_departments
    where profile_id=new.id
      and department_code in ('ADMIN','CRM')
      and not can_manage;
  end if;
  return new;
end
$$;

drop trigger if exists profiles_sync_bom_read_visibility on public.profiles;
create trigger profiles_sync_bom_read_visibility
after insert or update of department_code,active
on public.profiles
for each row execute function public.sync_bom_read_visibility();

create or replace function public.restore_bom_read_visibility_after_delete()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.department_code in ('ADMIN','CRM')
    and exists(
      select 1 from public.profiles p
      where p.id=old.profile_id and p.active and p.department_code='BOM'
    ) then
    insert into public.profile_departments(profile_id,department_code,can_manage)
    values(old.profile_id,old.department_code,false)
    on conflict(profile_id,department_code) do nothing;
  end if;
  return old;
end
$$;

drop trigger if exists profile_departments_restore_bom_read_visibility
on public.profile_departments;
create trigger profile_departments_restore_bom_read_visibility
after delete on public.profile_departments
for each row execute function public.restore_bom_read_visibility_after_delete();

commit;
