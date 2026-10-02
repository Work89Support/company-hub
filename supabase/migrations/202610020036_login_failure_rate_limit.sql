-- Allow an office NAT to serve 100 legitimate sign-ins without weakening the
-- per-account brute-force limit. The Edge Function consumes counters only when
-- authentication fails and uses this function to reject already-blocked traffic
-- before it reaches Auth.
create or replace function public.company_login_attempt_allowed(p_bucket text,p_max integer)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
 select not exists(
  select 1
  from public.company_login_limits
  where bucket=p_bucket
    and expires_at>=now()
    and attempts>=p_max
 )
$$;

create or replace function public.clear_company_login_attempt(p_bucket text)
returns void
language sql
security definer
set search_path=''
as $$
 delete from public.company_login_limits where bucket=p_bucket
$$;

revoke all on function public.company_login_attempt_allowed(text,integer) from public,anon,authenticated;
revoke all on function public.clear_company_login_attempt(text) from public,anon,authenticated;
grant execute on function public.company_login_attempt_allowed(text,integer) to service_role;
grant execute on function public.clear_company_login_attempt(text) to service_role;
