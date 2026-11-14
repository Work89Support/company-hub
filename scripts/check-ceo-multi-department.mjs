import fs from 'node:fs';
import assert from 'node:assert/strict';

const entry=fs.readFileSync(new URL('../prototype/entry-wizard.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../prototype/core-app-shell.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../prototype/ux-system.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');

assert.match(entry,/multiple=AUTH_DB_ROLE==='exec'&&manageable\.length>1/,'Multi-department assignment must remain CEO/executive-only');
assert.match(entry,/data-task-department/,'CEO department checkboxes are missing');
assert.match(entry,/departments\.filter\(department=>!taskAssigneesForDepartment\(department\)\.length\)/,'Every selected department must have an assignee');
assert.match(entry,/for\(const department of departments\)\{created\.push\(await createTask/,'Selected departments must create separately scoped tasks');
assert.match(entry,/batchId,departments/,'Department tasks must retain a shared batch reference');
assert.match(shell,/assignment_batch_id:d\.batchId/,'Task payload is missing its batch identifier');
assert.match(shell,/scopeMatch=!PICK_MULTI_DEPTS\.length/,'Assignee picker is not constrained to selected departments');
assert.match(css,/\.task-department-grid/,'Multi-department layout styles are missing');
assert.match(html,/company-hub-release" content="20261114-task-timer-from-ack-1"/,'Release marker is stale');
assert.match(html,/core-app-shell\.js\?v=20261114-task-timer-from-ack-1/,'Assignee scope cache key is stale');

console.log('PASS CEO multi-department assignment: executive gate, scoped people, per-department tasks, shared batch and release cache keys');
