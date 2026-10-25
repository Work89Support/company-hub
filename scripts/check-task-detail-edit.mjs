import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';

const migration=fs.readFileSync(new URL('../supabase/migrations/202610250045_task_creator_detail_edit.sql',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../prototype/core-app-shell.js',import.meta.url),'utf8');
const cloud=fs.readFileSync(new URL('../prototype/core-app-cloud.js',import.meta.url),'utf8');
assert.match(shell,/function canEditTaskDetails\(t\)[\s\S]*ACCESS_PROFILE\?\.id===t\.creator/);
assert.match(shell,/SB\.rpc\('update_own_task_details'/);
assert.match(cloud,/canEditTaskDetails\(t\)\?`<button[\s\S]*แก้ไขรายละเอียด/);
assert.match(migration,/task_creator_details_guard/);

const db=new PGlite();
await db.exec(`
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table profiles(id uuid primary key,active boolean not null default true);
create table tasks(id uuid primary key default gen_random_uuid(),title text not null,description text not null default '',creator_id uuid not null references profiles(id),status text not null default 'todo',updated_at timestamptz default now(),version integer not null default 1);
grant usage on schema public,auth to authenticated;
`);
await db.exec(migration);
const creator='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',task='00000000-0000-4000-8000-000000000010';
await db.query('insert into profiles(id) values($1),($2)',[creator,other]);
await db.query('insert into tasks(id,title,description,creator_id) values($1,$2,$3,$4)',[task,'ชื่อเดิม','รายละเอียดเดิม',creator]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
await assert.rejects(()=>db.query('update tasks set description=$1 where id=$2',['แก้โดยคนอื่น',task]),/only the task creator/);
await assert.rejects(()=>db.query('select update_own_task_details($1,$2,$3)',[task,'คนอื่นแก้','ไม่ได้']),/only the task creator/);
await db.query('update tasks set status=$1 where id=$2',['doing',task]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[creator]);
await db.query('select update_own_task_details($1,$2,$3)',[task,'ชื่อใหม่','รายละเอียดใหม่']);
const row=(await db.query('select title,description,status,version from tasks where id=$1',[task])).rows[0];
assert.deepEqual(row,{title:'ชื่อใหม่',description:'รายละเอียดใหม่',status:'doing',version:2});
console.log('PASS task title and description are editable only by the creator; manager fields remain independent');
await db.close();
