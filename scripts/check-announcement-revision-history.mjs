import fs from 'node:fs';
import assert from 'node:assert/strict';

const shell=fs.readFileSync(new URL('../prototype/core-app-shell.js',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../prototype/core-app-admin.js',import.meta.url),'utf8');
const cloud=fs.readFileSync(new URL('../prototype/core-app-cloud.js',import.meta.url),'utf8');
const integrity=fs.readFileSync(new URL('../prototype/reporting-integrity.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202611170057_announcement_revision_history.sql',import.meta.url),'utf8');

assert.match(shell,/function openAnnHistory/,'detail view must expose revision history');
assert.match(shell,/editing\.acks=\[\]/,'local edits must require acknowledgement again');
assert.match(admin,/แก้ไขแล้ว \$\{a\.history\.length\} ครั้ง/,'cards must show edited badge');
assert.match(cloud,/announcement_revisions/,'cloud loader must fetch revision history');
assert.match(integrity,/announcement_revisions/,'realtime refresh must watch revision history');
assert.match(migration,/create table if not exists public\.announcement_revisions/,'migration must store revision history');
assert.match(migration,/update public\.announcement_recipients set acknowledged_at=null/,'edits must reset acknowledgement');
assert.match(migration,/changed_by uuid not null/,'history must record editor');
console.log('Announcement revision history regression checks passed.');
