-- Collaborative activity entry: one submitted record can credit several people
-- across visible departments and accumulate work over several dated sessions.
begin;

create table if not exists public.activity_work_sessions (
  id bigint generated always as identity primary key,
  activity_id bigint not null references public.daily_activities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  work_date date not null,
  start_time time not null,
  end_time time,
  overnight boolean not null default false,
  duration_minutes integer,
  note text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(activity_id,profile_id,work_date,start_time),
  check (duration_minutes is null or duration_minutes between 1 and 1440),
  check (length(note)<=1000)
);

create index if not exists activity_work_sessions_activity_idx
  on public.activity_work_sessions(activity_id,work_date,start_time);
create index if not exists activity_work_sessions_profile_idx
  on public.activity_work_sessions(profile_id,work_date desc);

alter table public.activity_work_sessions enable row level security;
drop policy if exists "read visible activity work sessions" on public.activity_work_sessions;
create policy "read visible activity work sessions" on public.activity_work_sessions
for select to authenticated using (public.can_read_daily_activity(activity_id));
grant select on public.activity_work_sessions to authenticated;
revoke insert,update,delete on public.activity_work_sessions from authenticated;

-- The picker may show people in every department the caller is allowed to see.
-- This enables an authorised BOM user to credit Finance or another visible team.
create or replace function public.activity_entry_people()
returns table(id uuid,display_name text,department_code text)
language sql stable security definer set search_path=public as $$
 select distinct p.id,coalesce(nullif(trim(p.display_name),''),p.email),m.department_code
 from public.profiles p
 cross join lateral (
   select p.department_code
   union select pd.department_code from public.profile_departments pd where pd.profile_id=p.id
 ) m
 join public.departments d on d.code=m.department_code and d.active
 where p.active
 and exists(select 1 from public.profiles c where c.id=auth.uid() and c.active)
 and (p.id=auth.uid() or public.can_view_department(m.department_code))
 order by 2,3
$$;
revoke all on function public.activity_entry_people() from public;
grant execute on function public.activity_entry_people() to authenticated;

create or replace function public.save_activity_collaboration(
  p_activity_id bigint,
  p_contributor_ids uuid[],
  p_sessions jsonb
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  caller public.profiles%rowtype;
  item public.daily_activities%rowtype;
  contributor uuid;
  person public.profiles%rowtype;
  session jsonb;
  session_profile uuid;
  session_day date;
  session_start time;
  session_end time;
  session_overnight boolean;
  session_minutes integer;
  total_minutes integer:=0;
  open_sessions integer:=0;
  first_start time;
  first_end time;
  session_count integer:=0;
  allowed_ids uuid[];
begin
  select * into caller from public.profiles where id=auth.uid() and active;
  select * into item from public.daily_activities where id=p_activity_id and is_active for update;
  if caller.id is null or item.id is null then raise exception 'ไม่พบงานหรือบัญชีที่ใช้งานได้'; end if;
  if not (item.employee_id=caller.id or public.can_manage_department(item.department_code)) then
    raise exception 'เฉพาะเจ้าของงานหรือหัวหน้าที่ดูแลจึงแก้ผู้ร่วมทำและเวลาได้';
  end if;
  if jsonb_typeof(coalesce(p_sessions,'[]'::jsonb))<>'array' then raise exception 'รูปแบบช่วงเวลาทำงานไม่ถูกต้อง'; end if;

  allowed_ids:=array(select distinct x from unnest(array_append(coalesce(p_contributor_ids,'{}'::uuid[]),item.employee_id)) x where x is not null);
  if cardinality(allowed_ids)>50 then raise exception 'ผู้ร่วมทำต้องไม่เกิน 50 คน'; end if;
  foreach contributor in array allowed_ids loop
    select p.* into person from public.profiles p
    where p.id=contributor and p.active and exists(
      select 1 from (
        select p.department_code as code
        union select pd.department_code from public.profile_departments pd where pd.profile_id=p.id
      ) membership where contributor=caller.id or public.can_view_department(membership.code)
    );
    if person.id is null then raise exception 'มีผู้ร่วมทำที่อยู่นอกสิทธิ์การมองเห็นของคุณ'; end if;
  end loop;

  delete from public.activity_work_sessions where activity_id=item.id;
  for session in select value from jsonb_array_elements(coalesce(p_sessions,'[]'::jsonb)) loop
    session_profile:=nullif(session->>'profile_id','')::uuid;
    session_day:=nullif(session->>'work_date','')::date;
    session_start:=public.parse_activity_time(session->>'start_time');
    session_end:=public.parse_activity_time(session->>'end_time');
    session_overnight:=coalesce((session->>'overnight')::boolean,false);
    if session_profile is null or not (session_profile=any(allowed_ids)) then raise exception 'ผู้บันทึกเวลาไม่ได้อยู่ในรายชื่อผู้ร่วมทำ'; end if;
    if session_day is null or session_day<item.activity_date or session_day>(now() at time zone 'Asia/Bangkok')::date then
      raise exception 'วันที่ทำงานแต่ละช่วงต้องอยู่ตั้งแต่วันเริ่มงานถึงวันนี้';
    end if;
    if session_start is null then raise exception 'กรุณาระบุเวลาเริ่มของทุกช่วง'; end if;
    session_minutes:=null;
    if session_end is not null then
      session_minutes:=round(extract(epoch from (session_end-session_start))/60)::integer;
      if session_overnight then session_minutes:=session_minutes+1440; end if;
      if session_minutes<=0 or session_minutes>1440 then raise exception 'แต่ละช่วงเวลาต้องมากกว่า 0 และไม่เกิน 24 ชั่วโมง'; end if;
      total_minutes:=total_minutes+session_minutes;
    else
      open_sessions:=open_sessions+1;
    end if;
    if first_start is null then first_start:=session_start;first_end:=session_end;end if;
    insert into public.activity_work_sessions(activity_id,profile_id,work_date,start_time,end_time,overnight,duration_minutes,note,created_by)
    values(item.id,session_profile,session_day,session_start,session_end,session_overnight,session_minutes,left(trim(coalesce(session->>'note','')),1000),caller.id);
    session_count:=session_count+1;
  end loop;
  if session_count=0 then raise exception 'กรุณาเพิ่มช่วงเวลาทำงานอย่างน้อย 1 ช่วง'; end if;
  if item.status='Completed' and open_sessions>0 then raise exception 'งานเสร็จแล้วต้องมีเวลาจบครบทุกช่วง'; end if;

  update public.daily_activities
  set start_time=first_start,
      end_time=case when session_count=1 then first_end else first_end end,
      duration_minutes=case when open_sessions>0 then null else total_minutes end,
      time_flag=case when open_sessions>0 then 'missing' else 'ok' end
  where id=item.id;

  -- The activity update trigger restores the primary owner. Add the selected
  -- collaborators afterwards, without duplicating the activity or KPI count.
  delete from public.activity_assignees where activity_id=item.id and profile_id is distinct from item.employee_id;
  foreach contributor in array allowed_ids loop
    if contributor=item.employee_id then continue; end if;
    select * into person from public.profiles where id=contributor;
    insert into public.activity_assignees(activity_id,assignment_key,assignment_type,profile_id,department_code,source_name,display_name)
    values(item.id,'person:'||contributor,'person',contributor,person.department_code,coalesce(person.display_name,person.email),coalesce(person.display_name,person.email))
    on conflict(activity_id,assignment_key) do update set
      profile_id=excluded.profile_id,department_code=excluded.department_code,display_name=excluded.display_name;
  end loop;
  return jsonb_build_object('activity_id',item.id,'contributors',cardinality(allowed_ids),'sessions',session_count,'duration_minutes',case when open_sessions>0 then null else total_minutes end);
end $$;
revoke all on function public.save_activity_collaboration(bigint,uuid[],jsonb) from public;
grant execute on function public.save_activity_collaboration(bigint,uuid[],jsonb) to authenticated;

comment on table public.activity_work_sessions is
  'Per-person dated time segments for collaborative activities; one submitted activity may span people, departments and days.';

commit;
