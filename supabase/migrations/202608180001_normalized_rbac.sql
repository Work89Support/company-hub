-- Company Hub production foundation: normalized entities + database-enforced RBAC.
-- Review in a staging Supabase project before applying to production.

create extension if not exists pgcrypto;

create type public.company_role as enum ('staff', 'lead', 'exec', 'admin');
create type public.task_status as enum ('todo', 'doing', 'review', 'block', 'done');

create table if not exists public.departments (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role public.company_role not null default 'staff',
  department_code text references public.departments(code),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_no bigint generated always as identity unique,
  department_code text not null references public.departments(code),
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  status public.task_status not null default 'todo',
  priority text not null default 'mid' check (priority in ('low','mid','high')),
  creator_id uuid not null references public.profiles(id),
  start_at timestamptz,
  due_at timestamptz,
  sla_minutes integer check (sla_minutes is null or sla_minutes > 0),
  closed_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table if not exists public.task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  minutes integer not null check (minutes > 0),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sops (
  id uuid primary key default gen_random_uuid(),
  department_code text not null references public.departments(code),
  title text not null,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sop_versions (
  id uuid primary key default gen_random_uuid(),
  sop_id uuid not null references public.sops(id) on delete cascade,
  version integer not null,
  content jsonb not null,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sop_id, version)
);

create table if not exists public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  source_task_id uuid references public.tasks(id),
  department_code text not null references public.departments(code),
  title text not null,
  problem text not null default '',
  solution text not null default '',
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  department_code text not null references public.departments(code),
  name text not null,
  target numeric not null,
  weight numeric not null check (weight > 0 and weight <= 1),
  formula text not null,
  source text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.kpi_results (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.kpi_definitions(id),
  period_start date not null,
  period_end date not null,
  actual numeric not null,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','review','approved','locked')),
  entered_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  version integer not null default 1,
  unique (definition_id, period_start, period_end)
);

create or replace function public.my_profile()
returns public.profiles language sql stable security definer set search_path=public
as $$ select * from public.profiles where id = auth.uid() $$;

create or replace function public.can_manage_department(dept text)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.active
      and (p.role in ('exec','admin') or (p.role='lead' and p.department_code=dept))
  )
$$;

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.task_events enable row level security;
alter table public.task_comments enable row level security;
alter table public.time_entries enable row level security;
alter table public.sops enable row level security;
alter table public.sop_versions enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.kpi_definitions enable row level security;
alter table public.kpi_results enable row level security;

create policy "authenticated read departments" on public.departments for select to authenticated using (true);
create policy "read own or managed profiles" on public.profiles for select to authenticated
using (id=auth.uid() or public.can_manage_department(department_code));
create policy "read visible tasks" on public.tasks for select to authenticated
using (
  creator_id=auth.uid()
  or public.can_manage_department(department_code)
  or exists(select 1 from public.task_assignees a where a.task_id=id and a.user_id=auth.uid())
);
create policy "leaders create tasks" on public.tasks for insert to authenticated
with check (creator_id=auth.uid() and public.can_manage_department(department_code));
create policy "leaders update tasks" on public.tasks for update to authenticated
using (public.can_manage_department(department_code))
with check (public.can_manage_department(department_code));
create policy "read visible assignments" on public.task_assignees for select to authenticated
using (user_id=auth.uid() or exists(select 1 from public.tasks t where t.id=task_id and public.can_manage_department(t.department_code)));
create policy "leaders manage assignments" on public.task_assignees for all to authenticated
using (exists(select 1 from public.tasks t where t.id=task_id and public.can_manage_department(t.department_code)))
with check (exists(select 1 from public.tasks t where t.id=task_id and public.can_manage_department(t.department_code)));
create policy "read visible task events" on public.task_events for select to authenticated
using (exists(select 1 from public.tasks t where t.id=task_id));
create policy "append own task events" on public.task_events for insert to authenticated
with check (actor_id=auth.uid() and exists(select 1 from public.tasks t where t.id=task_id));
create policy "read visible comments" on public.task_comments for select to authenticated
using (exists(select 1 from public.tasks t where t.id=task_id));
create policy "write own comments" on public.task_comments for insert to authenticated
with check (author_id=auth.uid() and exists(select 1 from public.tasks t where t.id=task_id));
create policy "read visible time" on public.time_entries for select to authenticated
using (user_id=auth.uid() or exists(select 1 from public.tasks t where t.id=task_id and public.can_manage_department(t.department_code)));
create policy "write own time" on public.time_entries for insert to authenticated
with check (user_id=auth.uid() and exists(select 1 from public.task_assignees a where a.task_id=task_id and a.user_id=auth.uid()));
create policy "read published or managed sops" on public.sops for select to authenticated
using (status='published' or public.can_manage_department(department_code));
create policy "read sop versions" on public.sop_versions for select to authenticated
using (exists(select 1 from public.sops s where s.id=sop_id));
create policy "read published or managed knowledge" on public.knowledge_articles for select to authenticated
using (status='published' or public.can_manage_department(department_code));
create policy "manage knowledge" on public.knowledge_articles for all to authenticated
using (public.can_manage_department(department_code)) with check (public.can_manage_department(department_code));
create policy "read kpi definitions" on public.kpi_definitions for select to authenticated using (true);
create policy "read allowed kpi results" on public.kpi_results for select to authenticated
using (exists(select 1 from public.kpi_definitions d where d.id=definition_id and (public.can_manage_department(d.department_code) or d.department_code=(select department_code from public.profiles where id=auth.uid()))));
create policy "leaders manage kpi results" on public.kpi_results for all to authenticated
using (exists(select 1 from public.kpi_definitions d where d.id=definition_id and public.can_manage_department(d.department_code)))
with check (exists(select 1 from public.kpi_definitions d where d.id=definition_id and public.can_manage_department(d.department_code)));

-- Legacy blob hardening for the current prototype. Staff remain read-only until
-- the frontend is moved to the normalized tables above.
alter table if exists public.company_hub_state enable row level security;
do $$ declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='company_hub_state'
  loop execute format('drop policy if exists %I on public.company_hub_state', p.policyname); end loop;
end $$;
create policy "company hub authenticated read" on public.company_hub_state for select to authenticated using (true);
create policy "company hub managers update" on public.company_hub_state for update to authenticated
using ((auth.jwt()->'app_metadata'->>'company_role') in ('lead','exec','admin'))
with check ((auth.jwt()->'app_metadata'->>'company_role') in ('lead','exec','admin'));
