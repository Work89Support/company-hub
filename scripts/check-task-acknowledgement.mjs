import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';

const migration=fs.readFileSync(new URL('../supabase/migrations/202610250046_task_assignment_acknowledgements.sql',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../prototype/core-app-shell.js',import.meta.url),'utf8');
const cloud=fs.readFileSync(new URL('../prototype/core-app-cloud.js',import.meta.url),'utf8');
assert.match(shell,/function acknowledgeTask\(id\)/);
assert.match(shell,/SB\.rpc\('acknowledge_my_task'/);
assert.match(shell,/การรับทราบงาน/);
assert.match(cloud,/acknowledged_at/);
assert.match(cloud,/taskAcknowledgementUi\(t\)/);

const db=new PGlite();
await db.exec(`
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table profiles(id uuid primary key,active boolean not null default true);
create table tasks(id uuid primary key);
create table task_assignees(task_id uuid references tasks(id),user_id uuid references profiles(id),assigned_by uuid references profiles(id),assigned_at timestamptz default now(),primary key(task_id,user_id));
create table task_events(id bigint generated always as identity primary key,task_id uuid references tasks(id),actor_id uuid references profiles(id),event_type text,payload jsonb default '{}',created_at timestamptz default now());
grant usage on schema public,auth to authenticated;
`);
await db.exec(migration);
const assignee='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',task='00000000-0000-4000-8000-000000000010';
await db.query('insert into profiles(id) values($1),($2)',[assignee,other]);
await db.query('insert into tasks(id) values($1)',[task]);
await db.query('insert into task_assignees(task_id,user_id,assigned_by) values($1,$2,$2)',[task,assignee]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
await assert.rejects(()=>db.query('select acknowledge_my_task($1)',[task]),/task assignment required/);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[assignee]);
const first=(await db.query('select acknowledge_my_task($1) acknowledged_at',[task])).rows[0].acknowledged_at;
const second=(await db.query('select acknowledge_my_task($1) acknowledged_at',[task])).rows[0].acknowledged_at;
assert.equal(String(second),String(first),'acknowledgement timestamp must be stable');
assert.equal((await db.query("select count(*)::int n from task_events where event_type='assignment_acknowledged'")).rows[0].n,1,'event must be written once');
console.log('PASS assigned user can acknowledge once; unassigned users are rejected and the event is audited');
await db.close();
