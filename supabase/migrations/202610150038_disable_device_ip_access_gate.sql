-- Company Hub accounts are authorized by active profile, account role and
-- department scope. Device approval and IP allowlists are no longer used.

update public.user_access_policies
set enforce_device = false,
    enforce_ip = false,
    updated_at = now()
where enforce_device or enforce_ip;

update public.user_access_ip_rules
set active = false
where active;

alter table public.user_access_policies
  alter column enforce_device set default false,
  alter column enforce_ip set default false;

create or replace function public.disable_device_ip_access_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.enforce_device := false;
  new.enforce_ip := false;
  return new;
end;
$$;

drop trigger if exists user_access_policy_disable_device_ip
  on public.user_access_policies;
create trigger user_access_policy_disable_device_ip
before insert or update of enforce_device, enforce_ip
on public.user_access_policies
for each row execute function public.disable_device_ip_access_policy();

create or replace function public.disable_ip_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.active := false;
  return new;
end;
$$;

drop trigger if exists user_access_ip_rule_disable
  on public.user_access_ip_rules;
create trigger user_access_ip_rule_disable
before insert or update of active
on public.user_access_ip_rules
for each row execute function public.disable_ip_rule();

comment on table public.user_access_policies is
  'Legacy login-policy records. Device and IP enforcement are disabled; authorization uses active profile, role and department scope.';
