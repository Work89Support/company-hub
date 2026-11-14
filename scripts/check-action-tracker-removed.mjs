import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=name=>fs.readFileSync(new URL('../prototype/'+name,import.meta.url),'utf8');
const html=read('index.html');
const data=read('core-app-data.js');
const shell=read('core-app-shell.js');
const views=read('core-app-views.js');
const admin=read('core-app-admin.js');
const cloud=read('core-app-cloud.js');

assert.doesNotMatch(data,/tracker:\{ic:'i-clipboard',t:'Action Tracker'/,'Action Tracker still exists in navigation metadata');
assert.doesNotMatch(shell,/items:\[[^\]]*'tracker'|(?:lead|exec):\[[^\]]*'tracker'/,'Action Tracker still exists in a role menu');
assert.doesNotMatch(views,/go\('tracker'\)|เปิด Action Tracker|Go-live Control · Action Plan/,'Dashboard still links to Action Tracker');
assert.doesNotMatch(admin,/go\('tracker'\)|ดูรายการงานจริงได้ที่ Action Tracker/,'Knowledge or activity surfaces still link to Action Tracker');
assert.doesNotMatch(cloud,/id:'tracker',ic:'i-clipboard',tt:'Action Tracker'/,'Manual still exposes Action Tracker');
assert.match(shell,/if\(v==='tracker'\)v=homeView\(\)/,'Stale Action Tracker navigation is not redirected');
assert.match(html,/company-hub-release" content="20261114-remove-action-tracker-1"/,'Release marker is stale');

console.log('PASS Action Tracker menu, dashboard shortcuts and manual entry are removed');
