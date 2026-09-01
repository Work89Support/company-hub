-- Employee-friendly problem intake and source trace for July/August records.
-- This migration is independent from the existing Graphic and Daily Activity
-- import pipelines and does not alter their tables, functions, or source keys.

alter table public.operational_issues
  add column if not exists service_name text not null default ''
    check (char_length(service_name) <= 200),
  add column if not exists provider_name text not null default ''
    check (char_length(provider_name) <= 200),
  add column if not exists impact_scope text not null default 'unknown'
    check (impact_scope in ('unknown','single_customer','multiple_customers','project','multiple_projects','companywide')),
  add column if not exists impact_summary text not null default ''
    check (char_length(impact_summary) <= 2000),
  add column if not exists affected_customer_count integer
    check (affected_customer_count is null or affected_customer_count >= 0),
  add column if not exists affected_transaction_count integer
    check (affected_transaction_count is null or affected_transaction_count >= 0),
  add column if not exists financial_impact numeric
    check (financial_impact is null or financial_impact >= 0),
  add column if not exists workaround text not null default ''
    check (char_length(workaround) <= 4000),
  add column if not exists evidence_url text not null default ''
    check (char_length(evidence_url) <= 2000),
  add column if not exists acknowledged_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists source_document_id text not null default '',
  add column if not exists source_sheet text not null default '',
  add column if not exists source_row integer,
  add column if not exists source_key text,
  add column if not exists source_payload jsonb not null default '{}'::jsonb,
  add column if not exists data_quality_flags text[] not null default '{}'::text[];

create unique index if not exists operational_issues_source_key_uidx
  on public.operational_issues(source_key)
  where source_key is not null and source_key<>'';
create index if not exists operational_issues_analysis_idx
  on public.operational_issues(project_code,category,status,occurred_at desc);
create index if not exists operational_issues_impact_idx
  on public.operational_issues(impact_scope,priority,status);

create or replace function public.track_operational_issue_timestamps()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='In Progress' and new.acknowledged_at is null then
    new.acknowledged_at=now();
  end if;
  if new.status='Resolved' and old.status is distinct from 'Resolved' then
    new.resolved_at=coalesce(new.resolved_at,now());
  elsif new.status<>'Resolved' then
    new.resolved_at=null;
  end if;
  return new;
end
$$;

drop trigger if exists operational_issues_track_timestamps on public.operational_issues;
create trigger operational_issues_track_timestamps
before update on public.operational_issues
for each row execute function public.track_operational_issue_timestamps();

-- Any active employee may report an Admin operational issue. They can read
-- their own submissions; managers continue to see the department through RLS.
drop policy if exists "read visible operational issues" on public.operational_issues;
create policy "read visible operational issues" on public.operational_issues
for select to authenticated using (
  created_by=auth.uid() or public.can_view_department(department_code)
);

drop policy if exists "report visible operational issues" on public.operational_issues;
create policy "report visible operational issues" on public.operational_issues
for insert to authenticated with check (
  created_by=auth.uid()
  and department_code='ADMIN'
  and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active)
);

comment on column public.operational_issues.source_key is
  'Stable idempotency key for imported incident rows, independent from other import pipelines.';
comment on column public.operational_issues.data_quality_flags is
  'Source-data issues such as missing owner, unresolved time, or ambiguous duration.';
