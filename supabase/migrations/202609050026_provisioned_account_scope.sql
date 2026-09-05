-- Correct only newly provisioned username accounts still awaiting first setup.
-- The legacy Auth trigger added GRAPHIC when createUser omitted app_metadata.
begin;
create schema if not exists company_accounts_backup_20260905;
revoke all on schema company_accounts_backup_20260905 from public,anon,authenticated;
create table if not exists company_accounts_backup_20260905.provisioned_department_scopes as
select d.* from public.profile_departments d
join public.company_login_accounts a on a.profile_id=d.profile_id
where a.must_change_password;
revoke all on company_accounts_backup_20260905.provisioned_department_scopes from public,anon,authenticated;
delete from public.profile_departments d using public.profiles p,public.company_login_accounts a
where d.profile_id=p.id and a.profile_id=p.id and a.must_change_password
and p.role='staff' and p.department_code is not null and d.department_code<>p.department_code;
commit;
