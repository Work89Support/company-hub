-- Daily presence, auditable work access, and supervisor end-of-day review.
-- Presence means recent Company Hub activity. Missing entries never imply absence.
begin;

create table if not exists public.employee_presence (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  session_started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_page text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.work_audit_events (
  id bigint generated always as identity primary key,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('view','create','edit','delete','review')),
  entity_type text not null check (entity_type in ('task','graphic_job','activity','issue','daily_review','page')),
  entity_id text not null default '',
  department_code text references public.departments(code),
  page_key text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  event_at timestamptz not null default now()
);
create index if not exists work_audit_actor_time_idx on public.work_audit_events(actor_profile_id,event_at desc);
create index if not exists work_audit_department_time_idx on public.work_audit_events(department_code,event_at desc);

create table if not exists public.daily_work_reviews (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  department_code text not null references public.departments(code),
  reviewer_id uuid not null references public.profiles(id),
  status text not null check (status in ('approved','needs_followup')),
  has_daily_entry boolean not null default false,
  outstanding_reviewed boolean not null default false,
  completed_evidence_checked boolean not null default false,
  employee_summary_confirmed boolean not null default false,
  note text not null default '' check (char_length(note)<=2000),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(work_date,employee_id,department_code)
);
create index if not exists daily_work_reviews_date_dept_idx on public.daily_work_reviews(work_date desc,department_code);

alter table public.employee_presence enable row level security;
alter table public.work_audit_events enable row level security;
alter table public.daily_work_reviews enable row level security;

drop policy if exists employee_presence_read on public.employee_presence;
create policy employee_presence_read on public.employee_presence for select to authenticated using (
  profile_id=auth.uid() or exists(
    select 1 from public.profiles target
    where target.id=profile_id and (
      public.can_manage_department(target.department_code)
      or exists(select 1 from public.profiles me where me.id=auth.uid() and me.active and me.role in ('admin','exec'))
    )
  )
);

drop policy if exists work_audit_read on public.work_audit_events;
create policy work_audit_read on public.work_audit_events for select to authenticated using (
  actor_profile_id=auth.uid()
  or (department_code is not null and public.can_manage_department(department_code))
  or exists(select 1 from public.profiles me where me.id=auth.uid() and me.active and me.role in ('admin','exec'))
);

drop policy if exists daily_work_reviews_read on public.daily_work_reviews;
create policy daily_work_reviews_read on public.daily_work_reviews for select to authenticated using (
  employee_id=auth.uid() or reviewer_id=auth.uid() or public.can_manage_department(department_code)
);

create or replace function public.touch_employee_presence(p_page text default '')
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'inactive account'; end if;
  insert into public.employee_presence(profile_id,session_started_at,last_seen_at,last_page,updated_at)
  values(auth.uid(),now(),now(),left(coalesce(p_page,''),80),now())
  on conflict(profile_id) do update set
    last_seen_at=now(),last_page=excluded.last_page,updated_at=now(),
    session_started_at=case when public.employee_presence.last_seen_at<now()-interval '30 minutes' then now() else public.employee_presence.session_started_at end;
end $$;

create or replace function public.record_work_view(p_entity_type text,p_entity_id text,p_department text,p_page text default '')
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_entity_type not in ('task','graphic_job','activity','issue','page') then raise exception 'invalid entity type'; end if;
  if p_department is not null and not public.can_view_department(p_department) then raise exception 'permission denied'; end if;
  insert into public.work_audit_events(actor_profile_id,event_type,entity_type,entity_id,department_code,page_key)
  values(auth.uid(),'view',p_entity_type,left(coalesce(p_entity_id,''),160),p_department,left(coalesce(p_page,''),80));
end $$;

create or replace function public.audit_work_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare row_id text; dept text; kind text;
begin
  if auth.uid() is null then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  row_id:=coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id','');
  dept:=coalesce(to_jsonb(new)->>'department_code',to_jsonb(old)->>'department_code');
  kind:=case tg_table_name when 'tasks' then 'task' when 'graphic_jobs' then 'graphic_job' when 'daily_activities' then 'activity' else 'issue' end;
  insert into public.work_audit_events(actor_profile_id,event_type,entity_type,entity_id,department_code,page_key)
  values(auth.uid(),case tg_op when 'INSERT' then 'create' when 'DELETE' then 'delete' else 'edit' end,kind,row_id,dept,'');
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists tasks_work_audit on public.tasks;
create trigger tasks_work_audit after insert or update or delete on public.tasks for each row execute function public.audit_work_change();
drop trigger if exists graphic_jobs_work_audit on public.graphic_jobs;
create trigger graphic_jobs_work_audit after insert or update or delete on public.graphic_jobs for each row execute function public.audit_work_change();
drop trigger if exists daily_activities_work_audit on public.daily_activities;
create trigger daily_activities_work_audit after insert or update or delete on public.daily_activities for each row execute function public.audit_work_change();
drop trigger if exists operational_issues_work_audit on public.operational_issues;
create trigger operational_issues_work_audit after insert or update or delete on public.operational_issues for each row execute function public.audit_work_change();

create or replace function public.daily_supervision_rows(p_work_date date default ((now() at time zone 'Asia/Bangkok')::date))
returns table(
  profile_id uuid,display_name text,email text,department_code text,position_title text,
  last_seen_at timestamptz,last_page text,is_online boolean,activity_count bigint,
  completed_activity_count bigint,open_task_count bigint,completed_task_count bigint,
  review_status text,review_note text,reviewer_name text,reviewed_at timestamptz
) language sql stable security definer set search_path=public as $$
  with me as (select * from public.profiles where id=auth.uid() and active),
  people as (
    select p.* from public.profiles p,me
    where p.active and (
      p.id=auth.uid()
      or me.role in ('admin','exec')
      or (me.role='lead' and public.can_manage_department(p.department_code))
    )
  ), acts as (
    select coalesce(d.employee_id,a.profile_id) employee_id,count(distinct d.id) activity_count,
      count(distinct d.id) filter(where lower(coalesce(d.status,'')) like '%completed%' or d.status like '%เสร็จ%') completed_count
    from public.daily_activities d left join public.activity_assignees a on a.activity_id=d.id and a.profile_id is not null
    where d.activity_date=p_work_date and d.is_active
    group by coalesce(d.employee_id,a.profile_id)
  ), task_counts as (
    select ta.user_id employee_id,
      count(distinct t.id) filter(where t.status<>'done') open_count,
      count(distinct t.id) filter(where t.status='done') completed_count
    from public.tasks t join public.task_assignees ta on ta.task_id=t.id
    where (t.updated_at at time zone 'Asia/Bangkok')::date=p_work_date
    group by ta.user_id
  )
  select p.id,p.display_name,p.email,p.department_code,p.position_title,ep.last_seen_at,ep.last_page,
    coalesce(ep.last_seen_at>now()-interval '3 minutes',false),coalesce(a.activity_count,0),coalesce(a.completed_count,0),
    coalesce(tc.open_count,0),coalesce(tc.completed_count,0),r.status,r.note,reviewer.display_name,r.reviewed_at
  from people p
  left join public.employee_presence ep on ep.profile_id=p.id
  left join acts a on a.employee_id=p.id
  left join task_counts tc on tc.employee_id=p.id
  left join public.daily_work_reviews r on r.employee_id=p.id and r.department_code=p.department_code and r.work_date=p_work_date
  left join public.profiles reviewer on reviewer.id=r.reviewer_id
  order by p.department_code,p.display_name,p.email
$$;

create or replace function public.save_daily_work_review(
  p_work_date date,p_employee uuid,p_department text,p_status text,
  p_has_daily_entry boolean,p_outstanding_reviewed boolean,p_completed_evidence_checked boolean,
  p_employee_summary_confirmed boolean,p_note text
) returns public.daily_work_reviews language plpgsql security definer set search_path=public as $$
declare target public.profiles; out_row public.daily_work_reviews;
begin
  select * into target from public.profiles where id=p_employee and active;
  if target.id is null or target.department_code<>p_department then raise exception 'employee or department not found'; end if;
  if not public.can_manage_department(p_department) then raise exception 'permission denied'; end if;
  if p_status not in ('approved','needs_followup') then raise exception 'invalid review status'; end if;
  if p_status='approved' and not (p_has_daily_entry and p_outstanding_reviewed and p_completed_evidence_checked and p_employee_summary_confirmed) then
    raise exception 'complete every checklist item before approval';
  end if;
  insert into public.daily_work_reviews(work_date,employee_id,department_code,reviewer_id,status,has_daily_entry,outstanding_reviewed,completed_evidence_checked,employee_summary_confirmed,note,reviewed_at,updated_at)
  values(p_work_date,p_employee,p_department,auth.uid(),p_status,p_has_daily_entry,p_outstanding_reviewed,p_completed_evidence_checked,p_employee_summary_confirmed,left(trim(coalesce(p_note,'')),2000),now(),now())
  on conflict(work_date,employee_id,department_code) do update set reviewer_id=auth.uid(),status=excluded.status,
    has_daily_entry=excluded.has_daily_entry,outstanding_reviewed=excluded.outstanding_reviewed,
    completed_evidence_checked=excluded.completed_evidence_checked,employee_summary_confirmed=excluded.employee_summary_confirmed,
    note=excluded.note,reviewed_at=now(),updated_at=now()
  returning * into out_row;
  insert into public.work_audit_events(actor_profile_id,event_type,entity_type,entity_id,department_code,page_key,metadata)
  values(auth.uid(),'review','daily_review',out_row.id::text,p_department,'supervision',jsonb_build_object('status',p_status,'work_date',p_work_date));
  return out_row;
end $$;

revoke insert,update,delete on public.employee_presence,public.work_audit_events,public.daily_work_reviews from authenticated;
grant select on public.employee_presence,public.work_audit_events,public.daily_work_reviews to authenticated;
revoke all on function public.touch_employee_presence(text),public.record_work_view(text,text,text,text),public.daily_supervision_rows(date),public.save_daily_work_review(date,uuid,text,text,boolean,boolean,boolean,boolean,text) from public;
grant execute on function public.touch_employee_presence(text),public.record_work_view(text,text,text,text),public.daily_supervision_rows(date),public.save_daily_work_review(date,uuid,text,text,boolean,boolean,boolean,boolean,text) to authenticated;

comment on table public.employee_presence is 'Recent Company Hub activity; online means seen within three minutes and is not an attendance record.';
comment on table public.work_audit_events is 'Minimal work access log: actor, action, entity id, department, page, and timestamp; no work body snapshots.';
comment on table public.daily_work_reviews is 'Supervisor end-of-day checklist and approval per employee and primary department.';
commit;
