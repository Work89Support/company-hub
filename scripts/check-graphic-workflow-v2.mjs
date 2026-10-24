import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../prototype/graphic-production-v2.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202610230042_graphic_personal_workflow.sql',import.meta.url),'utf8');

new vm.Script(source,{filename:'graphic-production-v2.js'});
assert.match(source,/GF\.scope=GF\.scope\|\|''/,'graphic filter state includes personal scope');
assert.match(html,/graphic-production-v2\.js\?v=20261024-trello-board-3/,'production page loads the workflow enhancement');
assert.match(html,/department-workflows\.css\?v=20261024-trello-board-3/,'production page loads the compact Trello-style board');
assert.match(source,/gp-filter-drawer/,'advanced filters are tucked into a compact drawer');
assert.match(source,/main\.classList\.toggle\('graphic-board-view',GF\.tab==='board'\)/,'board mode activates compact board styles');
assert.match(source,/งานของฉัน/);
assert.match(source,/งานทั้งหมดในทีม/);
assert.match(source,/accept="image\/jpeg,image\/png,image\/webp,image\/gif"/);
assert.match(source,/deleteGraphicFile/);
assert.match(source,/saveGraphicFileEdit/);
assert.match(source,/updateGraphicAssignee/);
assert.doesNotMatch(source,/<option value="working">/,'new links no longer offer unfinished working files');
assert.match(migration,/create or replace function public\.can_edit_graphic_job/);
assert.match(migration,/graphic_job_members/,'linked Trello members are valid editors');
assert.match(migration,/graphic-job-files/,'private image bucket is provisioned');
assert.match(migration,/not exists\(select 1 from public\.profiles p where p\.id=m\.linked_profile_id and p\.active\)/,'inactive profile links are cleared');

console.log('PASS Graphic Production personal scope, account ownership, checklist permissions, private brief images and editable delivery links');
