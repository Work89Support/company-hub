import fs from 'node:fs';
import vm from 'node:vm';

const file = new URL('../prototype/index.html', import.meta.url);
const html = fs.readFileSync(file, 'utf8');
const activity = fs.readFileSync(new URL('../prototype/activity-module.js', import.meta.url), 'utf8');
const migration15 = fs.readFileSync(new URL('../supabase/migrations/202608300015_profile_roles_and_reporting.sql', import.meta.url), 'utf8');
const checks = [
  ['production activity module is loaded', /<script src="activity-module\.js\?v=[^"]+"><\/script>/],
  ['Graphic navigation entry', /graphic:\{ic:'i-grid',t:'Graphic Production'\}/],
  ['Graphic navigation group', /items:\['dash','myTasks','board','graphic'/],
  ['Graphic renderer', /RENDER\.graphic\s*=\s*function/],
  ['Graphic database loader', /async function loadGraphic\(/],
  ['Graphic pagination', /GP_COLUMN_PAGE_SIZE\s*=\s*30/],
  ['Graphic realtime refresh', /table:'graphic_jobs'/],
  ['Dashboard includes Graphic jobs', /function dashboardAllWork\(\)/],
  ['Production board unifies RLS-visible sources', /function boardAllWork\(\)[\s\S]*boardActivityRows\(\)[\s\S]*boardIssueRows\(\)/],
  ['Production board routes each source to its real detail', /function openBoardWork\(source,id\)[\s\S]*openBoardActivity[\s\S]*openProblem/],
  ['Department board no longer reads only demo TASKS', /RENDER\.board=function\(deptFilter\)[\s\S]*base=boardAllWork\(\)/],
  ['Board refreshes when activity data changes', /if\(VIEW==='board'\)RENDER\.board\(BOARD_DEPT\)/],
  ['Dashboard prevents empty NaN percent', /donePct=all\.length\?/],
  ['Employee access management page', /RENDER\.users\s*=\s*function/],
  ['Employee invitation through Edge Function', /invite-company-user/],
  ['Employee access update through audited RPC', /SB\.rpc\('set_user_access'/],
  ['Inactive accounts fail closed', /if\(!ACCESS_PROFILE\.active\)throw new Error/],
  ['Graphic account profile', /async function loadAuthenticatedProfile\(/],
  ['Activity renderer', /RENDER\.activity\s*=\s*function/],
  ['Activity KPI cards have production layout styles', /\.activity-kpis\{display:grid;grid-template-columns:repeat\(6/],
  ['Activity page has responsive mobile layout', /@media\(max-width:560px\)\{\.activity-kpis,\.activity-filters/],
  ['Operational issue loader', /async function cloudLoadIssues\(/],
  ['Verified issue save', /save_verified_issue_resolution/],
  ['Talk to Data popup', /Talk to Data/],
  ['Talk to Data floating button is available on every page', /class="talk-fab"[\s\S]*onclick="openTalkPopup\(\)"/],
  ['Talk to Data popup keeps current page context', /function talkContextQuestions\(\)[\s\S]*VIEW==='problems'/],
  ['Talk to Data calls the production Edge Function', /SB\.functions\.invoke\('talk-to-data'/],
  ['Problem Center shows solution coverage', /มีวิธีแก้แล้ว[\s\S]*ยังไม่มีวิธีแก้/],
  ['Problem Center solution filter', /PF\.solution==='yes'\?hasIssueSolution/],
  ['Problem Center analysis-to-SOP flow', /function problemAnalysisHTML\(all\)[\s\S]*จัดทำ SOP/],
  ['Strict database admin role', /function canAdminAccess\(\)\{return \['exec','admin'\]\.includes\(AUTH_DB_ROLE\);\}/],
  ['Navigation has stable view targets', /data-view="\$\{k\}"/],
  ['Production fails closed without Supabase', /Production fail-closed/],
  ['Reports include Graphic and Daily Activity', /\[ Daily Activity \]/],
  ['Company Scorecard aggregates every production source', /function reportDeptMetrics\([\s\S]*work\.length\+activity\.length\+problem\.length/],
  ['Company Scorecard opens real department data', /function openReportDepartment\(code\)/],
  ['Operational issues retain department ownership', /id:r\.id,dept:r\.department_code\|\|''/],
  ['Employee profile includes position', /position_title/],
];

const failed = checks.filter(([, pattern]) => !pattern.test(html));
if (/^\+/m.test(html)) failed.push(['No accidental diff markers', /^\+/m]);
if (/ROLE_META\.lead\.dept/.test(activity)) failed.push(['Activity management must not use fixed lead department', /ROLE_META\.lead\.dept/]);
if (!/MANAGE_DEPTS\.includes\(row\.department_code\)/.test(activity)) failed.push(['Activity management follows explicit managed departments', /MANAGE_DEPTS/]);
if (!/pd\.can_manage/.test(migration15) || /p\.department_code=dept/.test(migration15)) failed.push(['Database management permission is explicit', /can_manage_department/]);
if (/id="roleSwitch"|function resetDemo|function sendAuto/.test(html)) failed.push(['No role-switch or demo action in production UI', /roleSwitch|resetDemo|sendAuto/]);

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((source) => source.trim());
try {
  scripts.forEach((source, index) => new vm.Script(source, { filename: `prototype-inline-${index + 1}.js` }));
} catch (error) {
  console.error('FAIL: Prototype JavaScript syntax');
  console.error(error.message);
  process.exit(1);
}

if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL: ${name}`));
  process.exit(1);
}

console.log(`PASS: ${checks.length} critical prototype checks and ${scripts.length} inline script syntax check`);
