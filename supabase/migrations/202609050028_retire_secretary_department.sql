-- Retire the department without deleting historical records or changing owners.
begin;
alter table public.departments add column if not exists active boolean not null default true;
update public.departments set active=false where code='SECRET';
update public.kpi_definitions set active=false where department_code='SECRET';
create or replace function public.require_active_department_assignment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  -- Existing historical rows can still be maintained; new assignments cannot use retired departments.
  if TG_OP='UPDATE' then
    if new.department_code is not distinct from old.department_code then return new; end if;
  end if;
  if new.department_code is not null and not exists(select 1 from public.departments where code=new.department_code and active) then
    raise exception 'แผนกนี้ปิดใช้งานแล้ว กรุณาเลือกแผนกปัจจุบัน' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.require_active_department_assignment() from public;
do $$
declare t text;
begin
  foreach t in array array['profiles','profile_departments','tasks','daily_activities','operational_issues','graphic_jobs','kpi_definitions'] loop
    execute format('drop trigger if exists require_active_department_assignment on public.%I',t);
    execute format('create trigger require_active_department_assignment before insert or update of department_code on public.%I for each row execute function public.require_active_department_assignment()',t);
  end loop;
end $$;
commit;
