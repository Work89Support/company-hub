-- One activity remains one record while ownership can include a whole
-- department or several named people. Imported source text stays untouched.
begin;

create table if not exists public.activity_assignees (
  id bigint generated always as identity primary key,
  activity_id bigint not null references public.daily_activities(id) on delete cascade,
  assignment_key text not null,
  assignment_type text not null check (assignment_type in ('person','department')),
  profile_id uuid references public.profiles(id),
  department_code text not null references public.departments(code),
  source_name text not null default '',
  display_name text not null default '',
  created_at timestamptz not null default now(),
  unique(activity_id,assignment_key),
  check (
    (assignment_type='department' and profile_id is null)
    or assignment_type='person'
  )
);

create index if not exists activity_assignees_profile_idx
  on public.activity_assignees(profile_id,activity_id);
create index if not exists activity_assignees_department_idx
  on public.activity_assignees(department_code,activity_id);

create or replace function public.activity_normalize_name(value text)
returns text language sql immutable set search_path=public as $$
  select lower(trim(regexp_replace(replace(coalesce(value,''),'์์','์'),'\s+',' ','g')))
$$;

create or replace function public.activity_match_profile(target_department text,target_name text)
returns uuid language plpgsql stable security definer set search_path=public as $$
declare matched uuid; matches integer;
begin
  select min(p.id::text)::uuid,count(*) into matched,matches
  from public.profiles p
  where p.active
    and (
      p.department_code=target_department
      or exists(select 1 from public.profile_departments pd where pd.profile_id=p.id and pd.department_code=target_department)
    )
    and public.activity_normalize_name(regexp_replace(p.display_name,'\s*\([^)]*\)\s*$','','g'))
      = public.activity_normalize_name(target_name);
  return case when matches=1 then matched else null end;
end $$;

create or replace function public.sync_daily_activity_assignees(target_activity_id bigint)
returns void language plpgsql security definer set search_path=public as $$
declare
  item public.daily_activities%rowtype;
  cleaned text;
  department_name text;
  parts text[];
  token text;
  matched uuid;
  first_match uuid;
  second_match uuid;
  is_multiple boolean:=false;
  canonical_name text;
begin
  select * into item from public.daily_activities where id=target_activity_id;
  delete from public.activity_assignees where activity_id=target_activity_id;
  if item.id is null or not item.is_active then return; end if;

  if item.employee_id is not null then
    select coalesce(nullif(trim(display_name),''),email,item.employee_name) into canonical_name
    from public.profiles where id=item.employee_id;
    insert into public.activity_assignees(activity_id,assignment_key,assignment_type,profile_id,department_code,source_name,display_name)
    values(item.id,'person:'||item.employee_id,'person',item.employee_id,item.department_code,item.employee_name,coalesce(canonical_name,item.employee_name));
    return;
  end if;

  cleaned:=public.activity_normalize_name(item.employee_name);
  if cleaned='' then return; end if;
  select public.activity_normalize_name(name) into department_name from public.departments where code=item.department_code;
  if cleaned in ('ทุกคน','all','ทั้งแผนก')
     or cleaned=public.activity_normalize_name(item.department_code)
     or cleaned=department_name then
    insert into public.activity_assignees(activity_id,assignment_key,assignment_type,department_code,source_name,display_name)
    values(item.id,'department:'||item.department_code,'department',item.department_code,item.employee_name,'ทุกคนในแผนก '||item.department_code);
    return;
  end if;

  if item.employee_name ~ '(/|,|&|\+|[[:space:]]และ[[:space:]])' then
    parts:=regexp_split_to_array(item.employee_name,'\s*(?:/|,|&|\+|[[:space:]]และ[[:space:]])\s*');
    is_multiple:=cardinality(parts)>1;
  else
    parts:=regexp_split_to_array(trim(item.employee_name),'\s+');
    if cardinality(parts)=2 then
      first_match:=public.activity_match_profile(item.department_code,parts[1]);
      second_match:=public.activity_match_profile(item.department_code,parts[2]);
      is_multiple:=first_match is not null and second_match is not null and first_match<>second_match;
    end if;
  end if;

  if is_multiple then
    foreach token in array parts loop
      token:=trim(token);
      if token='' then continue; end if;
      matched:=public.activity_match_profile(item.department_code,token);
      select coalesce(nullif(trim(display_name),''),email,token) into canonical_name
      from public.profiles where id=matched;
      insert into public.activity_assignees(activity_id,assignment_key,assignment_type,profile_id,department_code,source_name,display_name)
      values(
        item.id,
        case when matched is null then 'name:'||public.activity_normalize_name(token) else 'person:'||matched end,
        'person',matched,item.department_code,token,coalesce(canonical_name,token)
      ) on conflict(activity_id,assignment_key) do nothing;
    end loop;
    return;
  end if;

  matched:=public.activity_match_profile(item.department_code,item.employee_name);
  select coalesce(nullif(trim(display_name),''),email,item.employee_name) into canonical_name
  from public.profiles where id=matched;
  insert into public.activity_assignees(activity_id,assignment_key,assignment_type,profile_id,department_code,source_name,display_name)
  values(
    item.id,
    case when matched is null then 'name:'||cleaned else 'person:'||matched end,
    'person',matched,item.department_code,item.employee_name,coalesce(canonical_name,item.employee_name)
  );
end $$;

create or replace function public.daily_activity_assignees_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.sync_daily_activity_assignees(new.id);
  return new;
end $$;

drop trigger if exists daily_activity_sync_assignees on public.daily_activities;
create trigger daily_activity_sync_assignees
after insert or update of employee_id,employee_name,department_code,is_active
on public.daily_activities for each row
execute function public.daily_activity_assignees_trigger();

select public.sync_daily_activity_assignees(id)
from public.daily_activities
where is_active;

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
      or exists(
        select 1 from public.activity_assignees a
        where a.activity_id=d.id and (
          a.profile_id=p.id
          or (
            a.assignment_type='department'
            and (
              p.department_code=a.department_code
              or exists(select 1 from public.profile_departments pd where pd.profile_id=p.id and pd.department_code=a.department_code)
            )
          )
        )
      )
    )
  )
$$;

alter table public.activity_assignees enable row level security;
drop policy if exists "read visible activity assignees" on public.activity_assignees;
create policy "read visible activity assignees" on public.activity_assignees
for select to authenticated using (public.can_read_daily_activity(activity_id));

drop policy if exists "read visible daily activities" on public.daily_activities;
create policy "read visible daily activities" on public.daily_activities
for select to authenticated using (public.can_read_daily_activity(id));

grant select on public.activity_assignees to authenticated;
revoke insert,update,delete on public.activity_assignees from authenticated;
revoke all on function public.activity_match_profile(text,text) from public;
revoke all on function public.sync_daily_activity_assignees(bigint) from public;
grant execute on function public.activity_normalize_name(text) to authenticated;
grant execute on function public.can_read_daily_activity(bigint) to authenticated;

comment on table public.activity_assignees is
  'Multi-owner routing for one daily activity; department assignments do not duplicate the activity or KPI totals.';

commit;
