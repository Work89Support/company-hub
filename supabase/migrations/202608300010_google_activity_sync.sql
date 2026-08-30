-- Traceable Google Sheets sync for daily activities.
-- Keeps stale source rows for audit while exposing only the current snapshot.

alter table public.daily_activities
  add column if not exists result_note text,
  add column if not exists completed_date date,
  add column if not exists worksite text,
  add column if not exists operational_issue text,
  add column if not exists source_document_id text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists source_hash text,
  add column if not exists source_date_raw text,
  add column if not exists data_quality_flags text[] not null default '{}',
  add column if not exists sync_batch text,
  add column if not exists sync_status text not null default 'active',
  add column if not exists is_active boolean not null default true,
  add column if not exists synced_at timestamptz;

alter table public.daily_activities
  drop constraint if exists daily_activities_sync_status_check;
alter table public.daily_activities
  add constraint daily_activities_sync_status_check
  check (sync_status in ('active','stale'));

create index if not exists daily_activities_active_date_idx
  on public.daily_activities(is_active,activity_date desc);
create index if not exists daily_activities_source_location_idx
  on public.daily_activities(source_document_id,source_sheet,source_row);
create index if not exists daily_activities_quality_gin_idx
  on public.daily_activities using gin(data_quality_flags);

create table if not exists public.activity_sync_runs (
  id bigint generated always as identity primary key,
  batch_key text not null unique,
  source text not null default 'Google Sheets Team Sync',
  active_rows integer not null,
  stale_rows integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.activity_sync_runs enable row level security;
drop policy if exists "read activity sync runs" on public.activity_sync_runs;
create policy "read activity sync runs" on public.activity_sync_runs
for select to authenticated using (public.is_access_admin());
grant select on public.activity_sync_runs to authenticated;

create or replace function public.import_daily_activities(rows_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  item jsonb;
  dept text;
  st time;
  en time;
  completed date;
  mins integer;
  flag text;
  flags text[];
  imported integer := 0;
  excluded integer := 0;
  needs_review integer := 0;
  quality_rows integer := 0;
begin
  if not public.is_access_admin() then raise exception 'access administrator permission required'; end if;
  if jsonb_typeof(rows_payload)<>'array' then raise exception 'payload must be an array'; end if;
  if jsonb_array_length(rows_payload)>10000 then raise exception 'maximum 10000 rows per import'; end if;

  for item in select value from jsonb_array_elements(rows_payload) loop
    dept := upper(coalesce(item->>'department_code',''));
    if not exists(select 1 from public.departments where code=dept) then
      raise exception 'unknown department code: %',dept;
    end if;
    if coalesce(item->>'source_key','')='' then raise exception 'source_key is required'; end if;
    if coalesce(item->>'activity_date','')='' then raise exception 'activity_date is required'; end if;
    if coalesce(item->>'activity','')='' then raise exception 'activity is required'; end if;

    st := public.parse_activity_time(item->>'start_time');
    en := public.parse_activity_time(item->>'end_time');
    begin completed := nullif(item->>'completed_date','')::date; exception when others then completed := null; end;
    select coalesce(array_agg(value),'{}'::text[]) into flags
      from jsonb_array_elements_text(coalesce(item->'data_quality_flags','[]'::jsonb));
    if cardinality(flags)>0 then quality_rows := quality_rows+1; end if;

    mins := null;
    flag := 'missing';
    if st is not null and en is not null then
      mins := round(extract(epoch from (en-st))/60);
      flag := 'ok';
      if mins < 0 then mins := mins+1440; flag := 'overnight'; end if;
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
      result_note,completed_date,worksite,operational_issue,source_document_id,
      source_sheet,source_row,source_hash,source_date_raw,data_quality_flags,
      sync_batch,sync_status,is_active,synced_at
    ) values (
      left(item->>'source_key',200),dept,left(coalesce(item->>'department_label',''),200),
      left(coalesce(item->>'group_code',''),50),(item->>'activity_date')::date,
      left(coalesce(item->>'employee_name',''),200),left(item->>'activity',4000),
      left(coalesce(item->>'category',''),200),st,en,mins,
      left(coalesce(item->>'status',''),120),flag,left(coalesce(item->>'source','Google Sheets Team Sync'),120),auth.uid(),
      left(coalesce(item->>'source_start_raw',item->>'start_time'),120),
      left(coalesce(item->>'source_end_raw',item->>'end_time'),120),
      left(coalesce(item->>'result_note',''),4000),completed,left(coalesce(item->>'worksite',''),500),
      left(coalesce(item->>'operational_issue',''),4000),left(coalesce(item->>'source_document_id',''),200),
      left(coalesce(item->>'source_sheet',''),200),nullif(item->>'source_row','')::integer,
      left(coalesce(item->>'source_hash',''),64),left(coalesce(item->>'source_date_raw',''),120),flags,
      left(coalesce(item->>'sync_batch',''),120),'active',true,now()
    )
    on conflict(source_key) do update set
      department_code=excluded.department_code,department_label=excluded.department_label,
      group_code=excluded.group_code,activity_date=excluded.activity_date,
      employee_name=excluded.employee_name,activity=excluded.activity,category=excluded.category,
      start_time=excluded.start_time,end_time=excluded.end_time,duration_minutes=excluded.duration_minutes,
      status=excluded.status,time_flag=excluded.time_flag,source=excluded.source,
      source_start_raw=excluded.source_start_raw,source_end_raw=excluded.source_end_raw,
      result_note=excluded.result_note,completed_date=excluded.completed_date,
      worksite=excluded.worksite,operational_issue=excluded.operational_issue,
      source_document_id=excluded.source_document_id,source_sheet=excluded.source_sheet,
      source_row=excluded.source_row,source_hash=excluded.source_hash,
      source_date_raw=excluded.source_date_raw,data_quality_flags=excluded.data_quality_flags,
      sync_batch=excluded.sync_batch,sync_status='active',is_active=true,synced_at=now(),
      verified_by=case
        when daily_activities.start_time is not distinct from excluded.start_time
         and daily_activities.end_time is not distinct from excluded.end_time
        then daily_activities.verified_by else null end,
      verified_at=case
        when daily_activities.start_time is not distinct from excluded.start_time
         and daily_activities.end_time is not distinct from excluded.end_time
        then daily_activities.verified_at else null end,
      verification_note=case
        when daily_activities.start_time is not distinct from excluded.start_time
         and daily_activities.end_time is not distinct from excluded.end_time
        then daily_activities.verification_note else null end;
    imported := imported+1;
  end loop;

  return jsonb_build_object(
    'rows',imported,
    'quality_rows',quality_rows,
    'excluded_duration_rows',excluded,
    'needs_time_verification',needs_review
  );
end $$;

create or replace function public.finalize_daily_activity_sync(
  active_source_keys jsonb,
  batch_key text,
  batch_summary jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  active_count integer;
  current_count integer;
  missing_count integer;
  stale_count integer;
begin
  if not public.is_access_admin() then raise exception 'access administrator permission required'; end if;
  if jsonb_typeof(active_source_keys)<>'array' then raise exception 'active_source_keys must be an array'; end if;
  active_count := jsonb_array_length(active_source_keys);
  select count(*) into current_count from public.daily_activities where is_active;
  if active_count < greatest(100,ceil(current_count*0.75)::integer) then
    raise exception 'active key list is unexpectedly small: % of %',active_count,current_count;
  end if;
  select count(*) into missing_count
  from jsonb_array_elements_text(active_source_keys) k
  where not exists(select 1 from public.daily_activities d where d.source_key=k.value);
  if missing_count>0 then raise exception '% active source keys were not imported',missing_count; end if;

  update public.daily_activities d
  set is_active=false,sync_status='stale',sync_batch=left(batch_key,120),updated_at=now()
  where d.is_active
    and d.source in ('Daily Activity Import','Google Sheets Team Sync')
    and not exists(select 1 from jsonb_array_elements_text(active_source_keys) k where k.value=d.source_key);
  get diagnostics stale_count=row_count;

  update public.daily_activities d
  set is_active=true,sync_status='active',sync_batch=left(batch_key,120)
  where exists(select 1 from jsonb_array_elements_text(active_source_keys) k where k.value=d.source_key);

  insert into public.activity_sync_runs(batch_key,active_rows,stale_rows,summary,created_by)
  values(left($2,120),active_count,stale_count,coalesce(batch_summary,'{}'::jsonb),auth.uid())
  on conflict on constraint activity_sync_runs_batch_key_key do update set
    active_rows=excluded.active_rows,stale_rows=excluded.stale_rows,
    summary=excluded.summary,created_by=auth.uid(),created_at=now();

  return jsonb_build_object('active_rows',active_count,'stale_rows',stale_count,'batch_key',batch_key);
end $$;

drop policy if exists "read visible daily activities" on public.daily_activities;
create policy "read visible daily activities" on public.daily_activities
for select to authenticated using (is_active and public.can_view_department(department_code));

revoke all on function public.import_daily_activities(jsonb) from public;
grant execute on function public.import_daily_activities(jsonb) to authenticated;
revoke all on function public.finalize_daily_activity_sync(jsonb,text,jsonb) from public;
grant execute on function public.finalize_daily_activity_sync(jsonb,text,jsonb) to authenticated;

comment on function public.finalize_daily_activity_sync(jsonb,text,jsonb) is
  'Marks rows absent from a complete Google Sheets snapshot as stale without deleting audit history.';
