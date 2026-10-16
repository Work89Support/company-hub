import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../prototype/access-consolidation.js',import.meta.url),'utf8');
const context={
  ACCESS_PROFILE:{id:'kpi-user'},ACCESS_USER_DEPTS:[],
  ROLE_ALLOW:{staff:['myTasks']},SIMPLE_ALLOW:{staff:['myTasks']},
  currentDept:()=>context.department,
  buildNav:()=>{context.navBuilds+=1;},navBuilds:0,department:'KPI',
  gpMemberAccounts:()=>'<button onclick="saveGraphicMemberLink(\'trello-1\')">เชื่อม</button>',
  RENDER:{teamAccounts:async()=>{}},VIEW:'graphic',
  canAdminAccess:()=>true,GRAPHIC_READY:true,loadGraphic:async()=>{},
  document:{getElementById:()=>null,createElement:()=>({})},window:{},
  normSp:value=>String(value||'').trim(),val:()=>'',SB:{},toast:()=>{},
  gpMember:()=>({}),confirm:()=>false
};
vm.createContext(context);vm.runInContext(source,context);

context.buildNav();
assert.equal(context.navBuilds,1,'keeps the original navigation builder');
assert(context.ROLE_ALLOW.staff.includes('kpi'),'KPI staff receives the full KPI navigation item');
assert(context.SIMPLE_ALLOW.staff.includes('kpi'),'KPI staff receives the simple KPI navigation item');

context.department='CRM';context.buildNav();
assert(!context.ROLE_ALLOW.staff.includes('kpi'),'non-KPI staff does not retain the KPI item');
assert(!context.SIMPLE_ALLOW.staff.includes('kpi'),'simple navigation follows the same department rule');
assert.equal(context.gpMemberAccounts(),'','Graphic Production no longer renders account administration');

assert.match(source,/const baseTeamAccounts=RENDER\.teamAccounts/,'wraps the central Team Accounts screen');
assert.match(source,/team-graphic-account-links/,'places Graphic account linking in Team Accounts');
assert.match(source,/saveGraphicMemberLinkFromAccounts/,'keeps Trello-to-account linking available centrally');

console.log('PASS access consolidation: KPI staff navigation, non-KPI isolation, and one Graphic account administration location');
