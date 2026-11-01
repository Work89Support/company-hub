-- Store operational subteams separately from the primary department.
-- Roster assignments are managed in Production and are intentionally not
-- committed to this public repository.

alter table public.profiles
  add column if not exists team_code text not null default '';

alter table public.profiles
  drop constraint if exists profiles_team_code_check;

alter table public.profiles
  add constraint profiles_team_code_check
  check (team_code in ('', 'X1', 'X5', 'X8'));

create index if not exists profiles_department_team_idx
  on public.profiles(department_code, team_code)
  where active;
