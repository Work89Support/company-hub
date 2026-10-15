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

comment on table public.user_access_policies is
  'Legacy login-policy records. Device and IP enforcement are disabled; authorization uses active profile, role and department scope.';
