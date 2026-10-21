import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
create schema auth;
create role authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.departments(code text primary key,name text,active boolean default true);
create table public.profiles(id uuid primary key,display_name text,email text,department_code text,active boolean,role text);
create table public.profile_departments(profile_id uuid,department_code text,primary key(profile_id,department_code));
create function public.can_view_department(text) returns boolean language sql stable as $$select true$$;
create table public.daily_activities(
 id bigint generated always as identity primary key,
 employee_id uuid,
 employee_name text not null default '',
 department_code text not null,
 is_active boolean not null default true
);
insert into public.departments(code,name) values
 ('HR','ทรัพยากรบุคคล'),('BOM','Back Office Management'),('SC','SC'),('CRM','ลูกค้าสัมพันธ์'),('ADMIN','แอดมิน');
insert into public.profiles(id,display_name,email,department_code,active,role) values
 ('00000000-0000-0000-0000-000000000001','TIN (SC)','t@example.com','SC',true,'staff'),
 ('00000000-0000-0000-0000-000000000002','AM (SC)','a@example.com','SC',true,'staff'),
 ('00000000-0000-0000-0000-000000000003','บอส (ลูกค้าสัมพันธ์)','b@example.com','CRM',true,'staff'),
 ('00000000-0000-0000-0000-000000000004','แก๋ม (ลูกค้าสัมพันธ์)','g@example.com','CRM',true,'staff'),
 ('00000000-0000-0000-0000-000000000005','Buki (Back Office Mgmt)','bu@example.com','BOM',true,'staff'),
 ('00000000-0000-0000-0000-000000000006','Grace (Back Office Mgmt)','gr@example.com','BOM',true,'staff'),
 ('00000000-0000-0000-0000-000000000007','อ๋อม (แอดมิน)','o@example.com','ADMIN',true,'staff'),
 ('00000000-0000-0000-0000-000000000008','ไนซ์ (แอดมิน)','n@example.com','ADMIN',true,'staff');
`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/202610210041_activity_multi_assignees.sql',import.meta.url),'utf8'));

await db.exec(`
insert into public.daily_activities(employee_name,department_code) values
 ('ทุกคน','BOM'),('HR','HR'),('TIN/AM','SC'),('บอส แก๋ม','CRM'),('Buki Grace','BOM'),('อ๋อม/ไนซ์์','ADMIN'),('มิ้นท์ WFH','CRM');
insert into public.daily_activities(employee_id,employee_name,department_code) values
 ('00000000-0000-0000-0000-000000000001','TIN','SC');
`);
const rows=(await db.query(`select d.employee_name,a.assignment_type,a.profile_id,a.source_name from public.daily_activities d join public.activity_assignees a on a.activity_id=d.id order by d.id,a.source_name`)).rows;
const forName=name=>rows.filter(row=>row.employee_name===name);
assert.equal(forName('ทุกคน').length,1);assert.equal(forName('ทุกคน')[0].assignment_type,'department');
assert.equal(forName('HR').length,1);assert.equal(forName('HR')[0].assignment_type,'department');
assert.equal(forName('TIN/AM').length,2);assert.ok(forName('TIN/AM').every(row=>row.profile_id));
assert.equal(forName('บอส แก๋ม').length,2);assert.ok(forName('บอส แก๋ม').every(row=>row.profile_id));
assert.equal(forName('Buki Grace').length,2);assert.ok(forName('Buki Grace').every(row=>row.profile_id));
assert.equal(forName('อ๋อม/ไนซ์์').length,2);assert.ok(forName('อ๋อม/ไนซ์์').every(row=>row.profile_id));
assert.equal(forName('มิ้นท์ WFH').length,1);assert.equal(forName('มิ้นท์ WFH')[0].profile_id,null);
assert.equal(forName('TIN').length,1);assert.equal(forName('TIN')[0].profile_id,'00000000-0000-0000-0000-000000000001');
console.log('PASS activity multi-assignees: department-wide, split names, typo normalization, unresolved preservation and single owner');
await db.close();
