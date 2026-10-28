import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite();
await db.exec(`
create schema auth;create role authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table departments(code text primary key,name text,active boolean default true);
create table profiles(id uuid primary key,display_name text,email text,department_code text,active boolean,role text);
create table profile_departments(profile_id uuid,department_code text,primary key(profile_id,department_code));
create function can_view_department(text) returns boolean language sql stable as $$select true$$;
create function can_manage_department(text) returns boolean language sql stable as $$select false$$;
create function parse_activity_time(text) returns time language plpgsql immutable as $$begin return nullif($1,'')::time;exception when others then return null;end$$;
create table daily_activities(
 id bigint generated always as identity primary key,employee_id uuid,employee_name text not null default '',department_code text not null,
 activity_date date not null,status text not null default 'In Progress',start_time time,end_time time,duration_minutes integer,time_flag text default 'missing',is_active boolean default true
);
insert into departments(code,name) values('BOM','Back Office Management'),('FIN','การเงิน');
insert into profiles values
 ('00000000-0000-0000-0000-000000000001','BOM One','bom@example.com','BOM',true,'staff'),
 ('00000000-0000-0000-0000-000000000002','BOM Two','bom2@example.com','BOM',true,'staff'),
 ('00000000-0000-0000-0000-000000000003','Finance One','fin@example.com','FIN',true,'staff');
`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/202610210041_activity_multi_assignees.sql',import.meta.url),'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/migrations/202610280055_activity_collaboration_sessions.sql',import.meta.url),'utf8'));
await db.exec(`
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into daily_activities(employee_id,employee_name,department_code,activity_date,status,start_time,end_time,duration_minutes,time_flag)
values('00000000-0000-0000-0000-000000000001','BOM One','BOM',current_date-2,'Completed','09:00','15:00',360,'ok');
`);
const activity=(await db.query('select id from daily_activities')).rows[0].id;
const contributors=['00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'];
const iso=days=>new Date(Date.now()-days*86400000).toISOString().slice(0,10);
const sessions=[
 {profile_id:'00000000-0000-0000-0000-000000000001',work_date:iso(2),start_time:'09:00',end_time:'15:00',overnight:false,note:'วิเคราะห์รอบแรก'},
 {profile_id:'00000000-0000-0000-0000-000000000002',work_date:iso(1),start_time:'08:00',end_time:'16:00',overnight:false,note:'ตรวจข้อมูล'},
 {profile_id:'00000000-0000-0000-0000-000000000003',work_date:iso(0),start_time:'10:00',end_time:'18:00',overnight:false,note:'วิเคราะห์การเงิน'},
];
await db.query('select save_activity_collaboration($1,$2,$3)',[activity,contributors,JSON.stringify(sessions)]);
assert.equal((await db.query('select count(*)::int n from activity_assignees where activity_id=$1',[activity])).rows[0].n,3,'one activity credits three contributors');
assert.equal((await db.query('select count(*)::int n from activity_work_sessions where activity_id=$1',[activity])).rows[0].n,3,'multi-day sessions are retained');
const summary=(await db.query('select duration_minutes,time_flag from daily_activities where id=$1',[activity])).rows[0];
assert.equal(summary.duration_minutes,1320,'6 + 8 + 8 hours accumulate beyond the former 16-hour total limit');
assert.equal(summary.time_flag,'ok');
console.log('PASS collaborative activities: cross-department contributors, one submitter and multi-day totals above 16 hours');
await db.close();
