-- Operational issue register for the Admin department.
-- The source records are imported separately so incident details never live in
-- the public GitHub Pages bundle or in this public migration file.

create table if not exists public.operational_issues (
  id text primary key check (id ~ '^ISS-[A-Za-z0-9-]+$') default (
    'ISS-' || to_char(timezone('Asia/Bangkok', clock_timestamp()), 'YYYYMMDD-HH24MISSMS')
    || '-' || substr(gen_random_uuid()::text, 1, 4)
  ),
  department_code text not null default 'ADMIN' references public.departments(code),
  occurred_at timestamptz not null default now(),
  project_code text not null,
  category text not null,
  problem text not null,
  priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High', 'Critical')),
  reporter text not null default '',
  status text not null default 'Open'
    check (status in ('Open', 'In Progress', 'Resolved')),
  owner_team text not null default '',
  solution text not null default '',
  resolution_minutes numeric check (resolution_minutes is null or resolution_minutes >= 0),
  source text not null default 'Company Hub',
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_issues_occurred_at_idx
  on public.operational_issues (occurred_at desc);
create index if not exists operational_issues_department_status_idx
  on public.operational_issues (department_code, status);

create or replace function public.touch_operational_issue_updated_at()
returns trigger language plpgsql set search_path=public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists operational_issues_touch_updated_at on public.operational_issues;
create trigger operational_issues_touch_updated_at
before update on public.operational_issues
for each row execute function public.touch_operational_issue_updated_at();

alter table public.operational_issues enable row level security;

drop policy if exists "read visible operational issues" on public.operational_issues;
create policy "read visible operational issues" on public.operational_issues
for select to authenticated
using (public.can_view_department(department_code));

drop policy if exists "report visible operational issues" on public.operational_issues;
create policy "report visible operational issues" on public.operational_issues
for insert to authenticated
with check (
  created_by=auth.uid()
  and public.can_view_department(department_code)
);

drop policy if exists "manage operational issues" on public.operational_issues;
create policy "manage operational issues" on public.operational_issues
for update to authenticated
using (public.can_manage_department(department_code))
with check (public.can_manage_department(department_code));

drop policy if exists "delete operational issues" on public.operational_issues;
create policy "delete operational issues" on public.operational_issues
for delete to authenticated
using (public.is_access_admin());

grant select, insert, update, delete on public.operational_issues to authenticated;

comment on table public.operational_issues is
  'Admin operational incidents, protected by department visibility and manager RLS.';
