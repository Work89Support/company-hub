-- XB has no people, memberships, work, or KPI history. No rights/work rows move.
begin;
do $$ declare t text; n bigint; begin
 foreach t in array array['profiles','profile_departments','tasks','daily_activities','operational_issues','graphic_jobs','sops','knowledge_articles','implementation_actions'] loop
  execute format('select count(*) from public.%I where department_code=''AUDXB''',t) into n;
  if n<>0 then raise exception 'XB has rows in %, review before consolidation',t;end if;
 end loop;
 if exists(select 1 from kpi_results r join kpi_definitions d on d.id=r.definition_id where d.department_code='AUDXB') or exists(select 1 from kpi_work_links l join kpi_definitions d on d.id=l.definition_id where d.department_code='AUDXB') then raise exception 'XB has KPI history';end if;
end $$;
create schema if not exists department_backup_20260909;
revoke all on schema department_backup_20260909 from public,anon,authenticated;
create table if not exists department_backup_20260909.audit_rows(table_name text primary key, rows jsonb not null);
alter table department_backup_20260909.audit_rows enable row level security;
do $$ declare t text;begin
 foreach t in array array['departments','profiles','kpi_definitions'] loop
 execute format('insert into department_backup_20260909.audit_rows select %L,coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x where %I in (''AUD123'',''AUDXB'') on conflict do nothing',t,t,case when t='departments' then 'code' else 'department_code' end);
 end loop;
end $$;
update departments set name='ออดิทระบบ (ส่วนกลาง)' where code='AUD123';
update profiles set display_name=replace(display_name,'(ออดิทระบบ 123)','(ออดิทระบบส่วนกลาง)') where department_code='AUD123';
update kpi_definitions set active=false where department_code='AUDXB';
update kpi_definitions set formula=replace(formula,'รายงานระบบ 123/BO','รายงานระบบที่ตรวจ/BO'),prototype_payload=prototype_payload||jsonb_build_object('scope','ออดิทระบบส่วนกลาง ครอบคลุมทุกระบบ') where department_code='AUD123' and active;
update departments set active=false,reporting_parent_code='AUD123' where code='AUDXB';
commit;
