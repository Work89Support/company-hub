-- Daily activity register. Personal work records are stored in Supabase and
-- never embedded in the public GitHub Pages bundle.

create table if not exists public.daily_activities (
  id bigint generated always as identity primary key,
  source_key text not null unique,
  department_code text not null references public.departments(code),
  department_label text not null default '',
  group_code text not null default '',
  activity_date date not null,
  employee_name text not null,
  activity text not null,
  category text not null default '',
  start_time time,
  end_time time,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  status text not null default '',
  time_flag text not null default 'ok'
    check (time_flag in ('ok','missing','overnight','excluded_all_day','suspicious')),
  source text not null default 'Company Hub',
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_activities_date_idx
  on public.daily_activities(activity_date desc);
create index if not exists daily_activities_department_status_idx
  on public.daily_activities(department_code,status);
create index if not exists daily_activities_employee_idx
  on public.daily_activities(employee_name,activity_date desc);

create or replace function public.touch_daily_activity_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists daily_activities_touch_updated_at on public.daily_activities;
create trigger daily_activities_touch_updated_at before update on public.daily_activities
for each row execute function public.touch_daily_activity_updated_at();

alter table public.daily_activities enable row level security;

drop policy if exists "read visible daily activities" on public.daily_activities;
create policy "read visible daily activities" on public.daily_activities
for select to authenticated using (public.can_view_department(department_code));

drop policy if exists "create visible daily activities" on public.daily_activities;
create policy "create visible daily activities" on public.daily_activities
for insert to authenticated with check (
  created_by=auth.uid() and public.can_view_department(department_code)
);

drop policy if exists "manage daily activities" on public.daily_activities;
create policy "manage daily activities" on public.daily_activities
for update to authenticated
using (public.can_manage_department(department_code))
with check (public.can_manage_department(department_code));

drop policy if exists "delete daily activities" on public.daily_activities;
create policy "delete daily activities" on public.daily_activities
for delete to authenticated using (public.is_access_admin());

grant select,insert,update,delete on public.daily_activities to authenticated;
grant usage,select on sequence public.daily_activities_id_seq to authenticated;

-- Bulk import is limited to access administrators. It normalizes durations and
-- excludes all-day placeholders so management totals are not inflated.
create or replace function public.import_daily_activities(rows_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  item jsonb; dept text; st time; en time; mins integer; flag text;
  imported integer := 0; excluded integer := 0;
begin
  if not public.is_access_admin() then raise exception 'access administrator permission required'; end if;
  if jsonb_typeof(rows_payload)<>'array' then raise exception 'payload must be an array'; end if;
  if jsonb_array_length(rows_payload)>10000 then raise exception 'maximum 10000 rows per import'; end if;

  for item in select value from jsonb_array_elements(rows_payload) loop
    dept := upper(coalesce(item->>'department_code',''));
    if not exists(select 1 from public.departments where code=dept) then
      raise exception 'unknown department code: %',dept;
    end if;
    begin st := nullif(item->>'start_time','')::time; exception when others then st := null; end;
    begin en := nullif(item->>'end_time','')::time; exception when others then en := null; end;
    mins := null; flag := 'missing';
    if st is not null and en is not null then
      mins := round(extract(epoch from (en-st))/60);
      flag := 'ok';
      if mins < 0 then mins := mins + 1440; flag := 'overnight'; end if;
      if (st=time '00:00' and en>=time '23:58') or lower(coalesce(item->>'employee_name','')) in ('ทุกคน','all') then
        mins := null; flag := 'excluded_all_day'; excluded := excluded+1;
      elsif mins > 960 then
        mins := null; flag := 'suspicious'; excluded := excluded+1;
      end if;
    end if;

    insert into public.daily_activities(
      source_key,department_code,department_label,group_code,activity_date,
      employee_name,activity,category,start_time,end_time,duration_minutes,
      status,time_flag,source,created_by
    ) values (
      left(item->>'source_key',200),dept,left(coalesce(item->>'department_label',''),200),
      left(coalesce(item->>'group_code',''),50),(item->>'activity_date')::date,
      left(item->>'employee_name',200),left(item->>'activity',4000),
      left(coalesce(item->>'category',''),200),st,en,mins,
      left(coalesce(item->>'status',''),120),flag,left(coalesce(item->>'source','Company Hub'),120),auth.uid()
    )
    on conflict(source_key) do update set
      department_code=excluded.department_code,department_label=excluded.department_label,
      group_code=excluded.group_code,activity_date=excluded.activity_date,
      employee_name=excluded.employee_name,activity=excluded.activity,category=excluded.category,
      start_time=excluded.start_time,end_time=excluded.end_time,duration_minutes=excluded.duration_minutes,
      status=excluded.status,time_flag=excluded.time_flag,source=excluded.source;
    imported := imported+1;
  end loop;
  return jsonb_build_object('rows',imported,'excluded_duration_rows',excluded);
end $$;

revoke all on function public.import_daily_activities(jsonb) from public;
grant execute on function public.import_daily_activities(jsonb) to authenticated;

comment on table public.daily_activities is
  'Department-scoped daily work records protected by RLS.';
