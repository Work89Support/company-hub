import fs from 'node:fs';
import assert from 'node:assert/strict';

const shell=fs.readFileSync(new URL('../prototype/core-app-shell.js',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../prototype/core-app-admin.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202611170056_announcement_edit_delete.sql',import.meta.url),'utf8');

assert.match(shell,/const canManageAnnouncement=a=>!!a&&\(a\.who===me\(\)\|\|canAdminAccess\(\)\)/);
assert.match(shell,/function openAnnForm\(id=''\)/);
assert.match(shell,/SB\.rpc\('update_announcement'/);
assert.match(shell,/function confirmDeleteAnn\(id\)/);
assert.match(shell,/SB\.rpc\('delete_announcement'/);
assert.match(admin,/event\.stopPropagation\(\);openAnnForm/);
assert.match(admin,/event\.stopPropagation\(\);confirmDeleteAnn/);
assert.match(migration,/create or replace function public\.can_manage_announcement/);
assert.match(migration,/a\.creator_id=actor\.id or actor\.role in \('exec','admin'\)/);
assert.match(migration,/Preserve acknowledgement timestamps/);
assert.match(migration,/create or replace function public\.delete_announcement/);
console.log('PASS announcement edit/delete is limited to creators and executive administrators');
