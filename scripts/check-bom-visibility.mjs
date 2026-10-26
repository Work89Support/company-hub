import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db=new PGlite();
await db.exec(`
  create table profiles(
    id uuid primary key,
    department_code text,
    active boolean not null default true
  );
  create table profile_departments(
    profile_id uuid not null references profiles(id) on delete cascade,
    department_code text not null,
    can_manage boolean not null default false,
    primary key(profile_id,department_code)
  );
  create schema auth;
`);

let migration=fs.readFileSync(new URL('../supabase/migrations/202610260051_bom_admin_crm_visibility.sql',import.meta.url),'utf8');
migration=migration.replaceAll('public.','');
await db.exec(migration);

const bom='11111111-1111-4111-8111-111111111111';
const crm='22222222-2222-4222-8222-222222222222';
await db.query(`insert into profiles(id,department_code,active) values($1,'BOM',true),($2,'CRM',true)`,[bom,crm]);

let scopes=(await db.query('select department_code,can_manage from profile_departments where profile_id=$1 order by department_code',[bom])).rows;
assert.deepEqual(scopes,[{department_code:'ADMIN',can_manage:false},{department_code:'CRM',can_manage:false}]);
assert.equal((await db.query('select count(*)::int count from profile_departments where profile_id=$1',[crm])).rows[0].count,0);

await db.query(`delete from profile_departments where profile_id=$1 and department_code='ADMIN'`,[bom]);
assert.equal((await db.query(`select count(*)::int count from profile_departments where profile_id=$1 and department_code='ADMIN'`,[bom])).rows[0].count,1);

await db.query(`update profiles set department_code='HR' where id=$1`,[bom]);
assert.equal((await db.query(`select count(*)::int count from profile_departments where profile_id=$1 and department_code in ('ADMIN','CRM')`,[bom])).rows[0].count,0);

await db.query(`update profiles set department_code='BOM' where id=$1`,[bom]);
assert.equal((await db.query(`select count(*)::int count from profile_departments where profile_id=$1 and department_code in ('ADMIN','CRM')`,[bom])).rows[0].count,2);

console.log('BOM visibility migration passed: ADMIN + CRM read scopes persist and follow BOM membership.');
