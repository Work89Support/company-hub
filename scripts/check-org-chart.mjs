import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
const data=fs.readFileSync(new URL('../prototype/core-app-data.js',import.meta.url),'utf8');
const match=data.match(/const ORG=([\s\S]*?);\s*\nconst FEED/);
assert.ok(match,'Missing organization chart data');
const groups=Function(`"use strict";return (${match[1]})`)();

const expected={
  '01':['BOM','FIN','HR','KPI','BO'],
  '02':['MKT','GRAPHIC'],
  '03':['PROG','CRM','AIAUTO'],
  '04':['SC','ADMIN','QC','AUD123'],
};

assert.equal(groups.length,4,'Organization chart must contain four work groups');
for(const group of groups){
  assert.deepEqual(group.teams.map(team=>team.dept),expected[group.code],`Group ${group.code} department order or membership is incorrect`);
}
assert.equal(groups.flatMap(group=>group.teams).length,14,'Organization chart must contain fourteen departments');
assert.doesNotMatch(match[1],/Secret Team|Recheck|เลขานุการ|ซีเคร็ท/,'Removed departments must not return to the organization chart');
assert.match(match[1],/ออดิทระบบ \(ส่วนกลาง\)/,'Central Audit must be represented as one shared department');
assert.match(match[1],/AI Automation/,'AI Automation must be represented in Technology & Customer');
assert.match(match[1],/Data provider \(BC\)/,'Data provider (BC) must use the approved organization name');

const departments=Function(`"use strict";return (${data.match(/const DEPTS = (\[[\s\S]*?\]);/)[1]})`)();
assert.equal(departments.length,14,'Sidebar and forms must expose fourteen active departments');
assert.equal(departments.filter(department=>department.code==='AIAUTO').length,1,'AI Automation must use one stable department code');

console.log('PASS organization chart: 4 groups, 14 current departments, no removed teams');
