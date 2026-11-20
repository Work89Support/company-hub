-- Confirmed department heads on 2026-11-20.
-- Keep their existing additional visibility while granting management only
-- for the stated primary department.
begin;

do $$
declare
  target record;
  matched_accounts integer;
begin
  select count(*) into matched_accounts
  from public.company_login_accounts cla
  join public.profiles p on p.id=cla.profile_id
  where lower(cla.contact_email) in (
    'work.qualitycontrol@gmail.com',
    'spicybabycarrot@gmail.com'
  );

  if matched_accounts <> 2 then
    raise exception 'Expected exactly 2 confirmed head accounts, found %', matched_accounts;
  end if;

  for target in
    select p.id,cla.contact_email,
      case lower(cla.contact_email)
        when 'work.qualitycontrol@gmail.com' then 'KPI'
        when 'spicybabycarrot@gmail.com' then 'GRAPHIC'
      end as department_code
    from public.company_login_accounts cla
    join public.profiles p on p.id=cla.profile_id
    where lower(cla.contact_email) in (
      'work.qualitycontrol@gmail.com',
      'spicybabycarrot@gmail.com'
    )
  loop
    update public.profiles
    set role='lead',
        department_code=target.department_code,
        position_title='หัวหน้า',
        active=true,
        updated_at=now()
    where id=target.id;

    update public.profile_departments
    set can_manage=false
    where profile_id=target.id;

    insert into public.profile_departments(profile_id,department_code,can_manage)
    values(target.id,target.department_code,true)
    on conflict(profile_id,department_code)
    do update set can_manage=true;

    update auth.users
    set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)
      || jsonb_build_object(
        'company_role','lead',
        'department',target.department_code
      )
    where id=target.id;
  end loop;
end
$$;

commit;
