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
  renderAccountDirectory:()=>{},loadAccessUsers:async()=>{},RENDER:{teamAccounts:async()=>{}},VIEW:'graphic',
  canAdminAccess:()=>true,GRAPHIC_READY:true,loadGraphic:async()=>{},
  document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({dataset:{}}),head:{append:()=>{}}},window:{},
  normSp:value=>String(value||'').trim(),val:()=>'',SB:{},toast:()=>{},
  gpMember:()=>({}),confirm:()=>false
};
vm.createContext(context);vm.runInContext(source,context);

context.buildNav();
assert.equal(context.navBuilds,2,'keeps the original navigation builder and refreshes after dynamic loading');
assert(context.ROLE_ALLOW.staff.includes('kpi'),'KPI staff receives the full KPI navigation item');
assert(context.SIMPLE_ALLOW.staff.includes('kpi'),'KPI staff receives the simple KPI navigation item');

context.department='CRM';context.buildNav();
assert(!context.ROLE_ALLOW.staff.includes('kpi'),'non-KPI staff does not retain the KPI item');
assert(!context.SIMPLE_ALLOW.staff.includes('kpi'),'simple navigation follows the same department rule');
assert.equal(context.gpMemberAccounts(),'','Graphic Production no longer renders account administration');
assert.equal(context.navBuilds,3,'refreshes navigation when the module loads after login');

assert.match(source,/const baseTeamAccounts=RENDER\.teamAccounts/,'wraps the central Team Accounts screen');
assert.match(source,/Promise\.all\(\[accessPromise,graphicPromise,baseTeamAccounts\(\)\]\)/,'loads account, access and Graphic sources concurrently');
assert.match(source,/team-graphic-account-links/,'places Graphic account linking in Team Accounts');
assert.match(source,/saveGraphicMemberLinkFromAccounts/,'keeps Trello-to-account linking available centrally');
assert.match(source,/mergeFullAccountRegistry/,'merges every created profile into the Team Accounts register');
assert.match(source,/account-summary-card/,'renders clickable account KPI summary cards');
assert.match(source,/account-table-status/,'supports status filtering in the account table');
assert.match(source,/missing_email/,'tracks accounts that still need an email');
assert.match(source,/@company-hub\.invalid/,'classifies internal authentication addresses separately from real email');
assert.match(source,/ยังไม่มีอีเมลจริง/,'labels missing real contact email clearly');
assert.match(source,/พร้อมเข้าสู่ระบบ/,'separates enabled accounts from accounts ready to sign in');
assert.match(source,/ความพร้อมบัญชีครบ 14 แผนก/,'shows department readiness even when a department has no account');
assert.match(source,/exportPendingAccountActivation/,'exports the activation follow-up queue');
assert.match(source,/telegram-team-settings/,'places Telegram configuration in Team Accounts');
assert.match(source,/save_telegram_notification_settings/,'saves Telegram secrets through the protected RPC');
assert.match(source,/test_telegram_notification_settings/,'provides an explicit Telegram test action');
assert.match(source,/type=\"password\"/,'never renders the Telegram token as plain text');
assert.match(source,/Supabase Vault/,'explains secure token storage to the administrator');

console.log('PASS access consolidation: KPI staff navigation, non-KPI isolation, and one Graphic account administration location');
