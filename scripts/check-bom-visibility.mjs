import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db=new PGlite();
await db.exec(`
  create table profiles(
    id uuid primary key,
    department_code text,
    role text not null default 'staff',
    active boolean not null default true
  );
  create table profile_departments(
    profile_id uuid not null references profiles(id) on delete cascade,
    department_code text not null,
    can_manage boolean not null default false,
    primary key(profile_id,department_code)
  );
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('app.uid',true),'')::uuid
  $$;
  create table daily_activities(
    id bigint primary key,
    employee_id uuid references profiles(id),
    department_code text not null,
    is_active boolean not null default true
  );
  create table activity_assignees(
    activity_id bigint not null references daily_activities(id),
    assignment_type text not null,
    profile_id uuid,
    department_code text
  );
  create function can_view_department(target_department text) returns boolean
  language sql stable as $$
    select exists(
      select 1 from profiles p where p.id=auth.uid() and p.active and (
        p.department_code=target_department
        or exists(select 1 from profile_departments pd where pd.profile_id=p.id and pd.department_code=target_department)
      )
    )
  $$;
`);

for(const file of ['202610260051_bom_admin_crm_visibility.sql','202610280056_bom_admin_crm_sc_activity_visibility.sql']){
  let migration=fs.readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
  migration=migration.replaceAll('public.','').replace('grant execute on function can_read_daily_activity(bigint) to authenticated;','');
  await db.exec(migration);
}

const bom='11111111-1111-4111-8111-111111111111';
const crm='22222222-2222-4222-8222-222222222222';
await db.query(`insert into profiles(id,department_code,active) values($1,'BOM',true),($2,'CRM',true)`,[bom,crm]);

let scopes=(await db.query('select department_code,can_manage from profile_departments where profile_id=$1 order by department_code',[bom])).rows;
assert.deepEqual(scopes,[{department_code:'ADMIN',can_manage:false},{department_code:'CRM',can_manage:false},{department_code:'SC',can_manage:false}]);
assert.equal((await db.query('select count(*)::int count from profile_departments where profile_id=$1',[crm])).rows[0].count,0);

await db.query(`delete from profile_departments where profile_id=$1 and department_code='ADMIN'`,[bom]);
assert.equal((await db.query(`select count(*)::int count from profile_departments where profile_id=$1 and department_code='ADMIN'`,[bom])).rows[0].count,1);

await db.query(`update profiles set department_code='HR' where id=$1`,[bom]);
assert.equal((await db.query(`select count(*)::int count from profile_departments where profile_id=$1 and department_code in ('ADMIN','CRM','SC')`,[bom])).rows[0].count,0);

await db.query(`update profiles set department_code='BOM' where id=$1`,[bom]);
assert.equal((await db.query(`select count(*)::int count from profile_departments where profile_id=$1 and department_code in ('ADMIN','CRM','SC')`,[bom])).rows[0].count,3);

await db.query(`insert into daily_activities(id,employee_id,department_code) values(1,$1,'CRM'),(2,$1,'ADMIN'),(3,$1,'SC'),(4,$1,'HR')`,[crm]);
await db.query(`select set_config('app.uid',$1,false)`,[bom]);
for(const id of [1,2,3])assert.equal((await db.query('select can_read_daily_activity($1) allowed',[id])).rows[0].allowed,true);
assert.equal((await db.query('select can_read_daily_activity(4) allowed')).rows[0].allowed,false);

console.log('BOM visibility migration passed: ADMIN + CRM + SC read scopes persist and expose only the requested activity departments.');
