-- Finish the eight accounts interrupted by the legacy GRAPHIC scope conflict.
-- Existing passwords are not changed; an administrator must issue a new initial code.
begin;
create table if not exists company_accounts_backup_20260905.incomplete_graphic_profiles as
select p.* from public.profiles p join public.company_login_accounts a on a.profile_id=p.id
where not p.active and p.department_code='GRAPHIC' and a.must_change_password
and a.created_at::date=date '2026-09-05';
revoke all on company_accounts_backup_20260905.incomplete_graphic_profiles from public,anon,authenticated;
do $$ declare r record; begin
 for r in select p.id,a.personal_name,a.created_by from public.profiles p
 join public.company_login_accounts a on a.profile_id=p.id
 where not p.active and p.role='staff' and p.department_code='GRAPHIC' and a.must_change_password
 and a.created_at::date=date '2026-09-05'
 and not exists(select 1 from public.user_access_policies x where x.profile_id=p.id)
 loop
  if not exists(select 1 from public.graphic_trello_members where full_name=r.personal_name) then raise exception 'source identity missing'; end if;
  insert into public.user_access_policies(profile_id,enforce_device,enforce_ip,session_minutes,updated_by) values(r.id,true,false,5,r.created_by);
  perform public.link_company_source_owner(r.id,r.personal_name,'GRAPHIC');
  insert into public.access_audit(actor_id,target_user_id,old_access,new_access) values(r.created_by,r.id,'{}','{"action":"username_account_recovered_requires_code","role":"staff","department_code":"GRAPHIC"}');
  update public.profiles set active=true where id=r.id;
 end loop;
end $$;
commit;
