import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=name=>fs.readFileSync(new URL('../prototype/'+name,import.meta.url),'utf8');
const html=read('index.html');
const ux=read('ux-system.js');
const cloud=read('core-app-cloud.js');
const reporting=read('reporting-integrity.js');

assert.doesNotMatch(ux,/connected-systems\.js/,'Connected systems page is still loaded by the UI');
assert.doesNotMatch(cloud,/connectedSystems|ผลประเมินทีมจากระบบเชื่อมต่อ/,'Manual still exposes the removed team evaluation page');
assert.doesNotMatch(html,/connected-systems\.js/,'HTML still loads the removed team evaluation page');
assert.match(html,/company-hub-release" content="20261114-remove-team-evaluation-1"/,'Release marker is stale');
assert.match(reporting,/ux-system\.js\?v=20261114-remove-team-evaluation-1/,'UX cache key is stale');

console.log('PASS team evaluation page, shortcut and manual entry are removed from the loaded UI');
