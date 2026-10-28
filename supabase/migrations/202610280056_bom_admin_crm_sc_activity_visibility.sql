-- BOM needs read-only visibility across its own work plus ADMIN, CRM and SC.
-- Migration 051 provisioned ADMIN/CRM scopes, but the later activity participant
-- policy intentionally stayed narrower.  Extend only BOM read access here so
-- other staff departments keep their existing participant-only activity scope.
begin;

insert into public.profile_departments(profile_id,department_code,can_manage)
select p.id,d.department_code,false
from public.profiles p
cross join (values ('ADMIN'::text),('CRM'::text),('SC'::text)) as d(department_code)
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
    values(new.id,'ADMIN',false),(new.id,'CRM',false),(new.id,'SC',false)
    on conflict(profile_id,department_code) do nothing;
  elsif tg_op='UPDATE'
    and old.department_code='BOM'
    and (not new.active or new.department_code is distinct from 'BOM') then
    delete from public.profile_departments
    where profile_id=new.id
      and department_code in ('ADMIN','CRM','SC')
      and not can_manage;
  end if;
  return new;
end
$$;

create or replace function public.restore_bom_read_visibility_after_delete()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if old.department_code in ('ADMIN','CRM','SC')
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

create or replace function public.can_read_daily_activity(target_activity_id bigint)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from public.daily_activities d
    join public.profiles p on p.id=auth.uid() and p.active
    where d.id=target_activity_id and d.is_active and (
      d.employee_id=p.id
      or p.role in ('exec','admin')
      or (p.role='lead' and public.can_view_department(d.department_code))
      or (
        p.department_code='BOM'
        and d.department_code in ('ADMIN','CRM','SC')
        and exists(
          select 1 from public.profile_departments pd
          where pd.profile_id=p.id and pd.department_code=d.department_code
        )
      )
      or exists(
        select 1 from public.activity_assignees a
        where a.activity_id=d.id and (
          a.profile_id=p.id
          or (
            a.assignment_type='department'
            and (
              p.department_code=a.department_code
              or exists(
                select 1 from public.profile_departments pd
                where pd.profile_id=p.id and pd.department_code=a.department_code
              )
            )
          )
        )
      )
    )
  )
$$;

grant execute on function public.can_read_daily_activity(bigint) to authenticated;

commit;
