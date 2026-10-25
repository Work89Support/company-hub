import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const native=fs.readFileSync(new URL('../prototype/native-entry.js',import.meta.url),'utf8');
const activity=fs.readFileSync(new URL('../prototype/activity-module.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../prototype/native-entry.css',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202610250050_activity_completion_and_files.sql',import.meta.url),'utf8');

new vm.Script(native);
new vm.Script(activity);

for(const token of [
  "set completed_date=activity_date",
  "status ~* '(completed|เสร็จ)'",
  'create table if not exists public.activity_files',
  'create or replace function public.can_contribute_daily_activity',
  'create or replace function public.add_activity_file',
  'create or replace function public.delete_my_activity_file',
  "'activity-files','activity-files',false,10485760",
  'public.can_read_daily_activity(activity_id)',
]) assert.ok(migration.includes(token),`missing migration guard: ${token}`);

for(const token of [
  "id=\"entry-files\" type=\"file\" multiple",
  "SB.storage.from('activity-files').upload",
  "SB.rpc('add_activity_file'",
  "SB.rpc('delete_my_activity_file'",
  "createSignedUrl(file.storage_path,300",
  "files.length?'\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e07\u0e32\u0e19\u0e41\u0e25\u0e30\u0e41\u0e19\u0e1a\u0e44\u0e1f\u0e25\u0e4c\u0e41\u0e25\u0e49\u0e27'",
]) assert.ok(native.includes(token),`missing activity file UI: ${token}`);

for(const token of [
  "sbAllRows('activity_files','created_at',true)",
  'activity_files:filesByActivity.get(String(row.id))||[]',
  "table:'activity_files'",
  '📎 ${nf(files.length)} ไฟล์',
]) assert.ok(activity.includes(token),`missing activity file loading: ${token}`);

assert.match(css,/\.entry-file-row/);
assert.match(css,/body\.dark \.entry-file-row/);
console.log('PASS historical completion-date backfill and private in-activity file attachments');
