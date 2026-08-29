-- Preserve raw imported times, normalize safe decimal/Excel time formats and
-- let department managers verify ambiguous rows without bypassing RLS.

alter table public.daily_activities
  add column if not exists source_start_raw text,
  add column if not exists source_end_raw text,
  add column if not exists verified_by uuid references public.profiles(id),
  add column if not exists verified_at timestamptz,
  add column if not exists verification_note text;

create or replace function public.parse_activity_time(raw_value text)
returns time language plpgsql immutable set search_path=public as $$
declare
  value text := btrim(coalesce(raw_value,''));
  hour_part integer;
  minute_part integer;
  seconds_part integer;
begin
  if value='' then return null; end if;

  -- Standard time supplied by forms/CSV.
  if value ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then
    return value::time;
  end if;

  -- Common Thai spreadsheet entry: 9.30 means 09:30. Only two decimal
  -- digits are accepted; values such as 9.5 stay unverified because they are
  -- ambiguous (09:05 vs 09:30).
  if value ~ '^([01]?[0-9]|2[0-3])\.[0-5][0-9]$' then
    hour_part := split_part(value,'.',1)::integer;
    minute_part := split_part(value,'.',2)::integer;
    return make_time(hour_part,minute_part,0);
  end if;

  -- Excel/Google Sheets fraction of one day, for example 0.375 = 09:00.
  if value ~ '^0?\.[0-9]+$' then
    seconds_part := round(value::numeric*86400);
    if seconds_part>=0 and seconds_part<86400 then
      return (time '00:00' + make_interval(secs=>seconds_part))::time;
    end if;
  end if;

  return null;
exception when others then
  return null;
end $$;

create or replace function public.import_daily_activities(rows_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  item jsonb; dept text; st time; en time; mins integer; flag text;
  imported integer := 0; excluded integer := 0; needs_review integer := 0;
begin
  if not public.is_access_admin() then raise exception 'access administrator permission required'; end if;
  if jsonb_typeof(rows_payload)<>'array' then raise exception 'payload must be an array'; end if;
  if jsonb_array_length(rows_payload)>10000 then raise exception 'maximum 10000 rows per import'; end if;

  for item in select value from jsonb_array_elements(rows_payload) loop
    dept := upper(coalesce(item->>'department_code',''));
    if not exists(select 1 from public.departments where code=dept) then
      raise exception 'unknown department code: %',dept;
    end if;

    st := public.parse_activity_time(item->>'start_time');
    en := public.parse_activity_time(item->>'end_time');
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
    else
      needs_review := needs_review+1;
    end if;

    insert into public.daily_activities(
      source_key,department_code,department_label,group_code,activity_date,
      employee_name,activity,category,start_time,end_time,duration_minutes,
      status,time_flag,source,created_by,source_start_raw,source_end_raw,
      verified_by,verified_at,verification_note
    ) values (
      left(item->>'source_key',200),dept,left(coalesce(item->>'department_label',''),200),
      left(coalesce(item->>'group_code',''),50),(item->>'activity_date')::date,
      left(item->>'employee_name',200),left(item->>'activity',4000),
      left(coalesce(item->>'category',''),200),st,en,mins,
      left(coalesce(item->>'status',''),120),flag,left(coalesce(item->>'source','Company Hub'),120),auth.uid(),
      left(item->>'start_time',120),left(item->>'end_time',120),null,null,null
    )
    on conflict(source_key) do update set
      department_code=excluded.department_code,department_label=excluded.department_label,
      group_code=excluded.group_code,activity_date=excluded.activity_date,
      employee_name=excluded.employee_name,activity=excluded.activity,category=excluded.category,
      start_time=excluded.start_time,end_time=excluded.end_time,duration_minutes=excluded.duration_minutes,
      status=excluded.status,time_flag=excluded.time_flag,source=excluded.source,
      source_start_raw=excluded.source_start_raw,source_end_raw=excluded.source_end_raw,
      verified_by=null,verified_at=null,verification_note=null;
    imported := imported+1;
  end loop;

  return jsonb_build_object(
    'rows',imported,
    'excluded_duration_rows',excluded,
    'needs_time_verification',needs_review
  );
end $$;

create or replace function public.verify_daily_activity_time(
  target_id bigint,
  corrected_start time,
  corrected_end time,
  note text default ''
) returns public.daily_activities
language plpgsql security definer set search_path=public as $$
declare
  row_value public.daily_activities;
  mins integer;
  next_flag text := 'ok';
begin
  select * into row_value from public.daily_activities where id=target_id for update;
  if not found then raise exception 'daily activity not found'; end if;
  if not public.can_manage_department(row_value.department_code) then
    raise exception 'department manager permission required';
  end if;
  if corrected_start is null or corrected_end is null then
    raise exception 'start and end time are required';
  end if;

  mins := round(extract(epoch from (corrected_end-corrected_start))/60);
  if mins < 0 then mins := mins+1440; next_flag := 'overnight'; end if;
  if mins > 960 then raise exception 'duration over 16 hours requires source correction'; end if;

  update public.daily_activities set
    start_time=corrected_start,
    end_time=corrected_end,
    duration_minutes=mins,
    time_flag=next_flag,
    verified_by=auth.uid(),
    verified_at=now(),
    verification_note=left(coalesce(note,''),1000)
  where id=target_id
  returning * into row_value;
  return row_value;
end $$;

revoke all on function public.parse_activity_time(text) from public;
grant execute on function public.parse_activity_time(text) to authenticated;
revoke all on function public.import_daily_activities(jsonb) from public;
grant execute on function public.import_daily_activities(jsonb) to authenticated;
revoke all on function public.verify_daily_activity_time(bigint,time,time,text) from public;
grant execute on function public.verify_daily_activity_time(bigint,time,time,text) to authenticated;

comment on function public.verify_daily_activity_time(bigint,time,time,text) is
  'Manager-only correction with verifier and timestamp audit fields.';
