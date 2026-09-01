import fs from 'node:fs';
import vm from 'node:vm';

const file = new URL('../prototype/index.html', import.meta.url);
const html = fs.readFileSync(file, 'utf8');
const activity = fs.readFileSync(new URL('../prototype/activity-module.js', import.meta.url), 'utf8');
const migration15 = fs.readFileSync(new URL('../supabase/migrations/202608300015_profile_roles_and_reporting.sql', import.meta.url), 'utf8');
const migration16 = fs.readFileSync(new URL('../supabase/migrations/202609010016_meeting_action_plan.sql', import.meta.url), 'utf8');
const migration17 = fs.readFileSync(new URL('../supabase/migrations/202609010017_issue_intake_and_source_trace.sql', import.meta.url), 'utf8');
const migration18 = fs.readFileSync(new URL('../supabase/migrations/202609010018_assignee_task_progress.sql', import.meta.url), 'utf8');
const issueImporter = fs.readFileSync(new URL('./prepare_operational_issue_import.py', import.meta.url), 'utf8');
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
  ['Problem Center data-quality filter', /PF\.quality==='review'\?\(p\.qualityFlags\|\|\[\]\)\.length/],
  ['Problem Center analysis-to-SOP flow', /function problemAnalysisHTML\(all\)[\s\S]*จัดทำ SOP/],
  ['Employee problem intake form', /function openNewIssue\(\)[\s\S]*บันทึกและส่งให้ทีมแก้ไข/],
  ['Problem intake persists analysis fields', /function saveNewIssue\(\)[\s\S]*impact_scope[\s\S]*affected_transaction_count[\s\S]*workaround/],
  ['Issue loader supports pre-migration fallback', /extraFields[\s\S]*if\(res\.error&&\/column\|schema cache/],
  ['Strict database admin role', /function canAdminAccess\(\)\{return \['exec','admin'\]\.includes\(AUTH_DB_ROLE\);\}/],
  ['Navigation has stable view targets', /data-view="\$\{k\}"/],
  ['Production fails closed without Supabase', /Production fail-closed/],
  ['Reports include Graphic and Daily Activity', /\[ Daily Activity \]/],
  ['Company Scorecard aggregates every production source', /function reportDeptMetrics\([\s\S]*work\.length\+activity\.length\+problem\.length/],
  ['Company Scorecard opens real department data', /function openReportDepartment\(code\)/],
  ['Operational issues retain department ownership', /id:r\.id,dept:r\.department_code\|\|''/],
  ['Employee profile includes position', /position_title/],
  ['Meeting Action Tracker loads normalized production rows', /async function cloudLoadImplementationActions\(\)[\s\S]*implementation_actions/],
  ['Meeting Action Tracker persists status and evidence', /function saveImplementationAction\(id\)[\s\S]*update\(\{status,evidence\}\)/],
  ['Marketing report includes permitted Graphic rows', /REP_DEPT==='MKT'\?\['MKT','GRAPHIC'\]/],
  ['Executive dashboard shows rollout stop criteria', /Go-live Control[\s\S]*เกณฑ์หยุด/],
  ['Timeline uses the current Bangkok date', /const TODAY_ISO=bangkokTodayISO\(\),TODAY_MMDD=TODAY_ISO\.slice\(5\)/],
  ['Timeline explains start, due, status, and today marker', /วิธีอ่าน:[\s\S]*เส้นแดง = วันนี้[\s\S]*งานที่ต้องจัดการก่อน/],
  ['Timeline separates event dates from real deadlines', /_deadline:false[\s\S]*ไม่นับวันที่เกิดปัญหา\/วันที่บันทึก/],
  ['Normalized task creation writes to Supabase', /async function createTask\([\s\S]*SB\.from\('tasks'\)\.insert/],
  ['Assignees record additive time entries', /async function recordTaskTime\([\s\S]*SB\.from\('time_entries'\)\.insert/],
  ['Task comments reload from Supabase', /SB\.from\('task_comments'\)\.select/],
  ['Production announcements reload from Supabase', /async function cloudLoadAnnouncements\([\s\S]*SB\.from\('announcements'\)/],
  ['Timeline lists unscheduled work and lets Graphic managers set a due date', /รายการที่ต้องกำหนดวัน[\s\S]*openGraphicDue/],
];

const failed = checks.filter(([, pattern]) => !pattern.test(html));
if (/^\+/m.test(html)) failed.push(['No accidental diff markers', /^\+/m]);
if (/ROLE_META\.lead\.dept/.test(activity)) failed.push(['Activity management must not use fixed lead department', /ROLE_META\.lead\.dept/]);
if (!/MANAGE_DEPTS\.includes\(row\.department_code\)/.test(activity)) failed.push(['Activity management follows explicit managed departments', /MANAGE_DEPTS/]);
if (!/pd\.can_manage/.test(migration15) || /p\.department_code=dept/.test(migration15)) failed.push(['Database management permission is explicit', /can_manage_department/]);
if (!/create table if not exists public\.implementation_actions/.test(migration16) || !/enable row level security/.test(migration16)) failed.push(['Meeting actions must be normalized and RLS protected', /implementation_actions/]);
if (!/reporting_parent_code='MKT'/.test(migration16)) failed.push(['Graphic reports under Marketing without changing source ownership', /reporting_parent_code/]);
if (!/source_key/.test(migration17) || !/created_by=auth\.uid\(\)/.test(migration17)) failed.push(['Issue intake needs idempotent source trace and employee RLS', /source_key/]);
if (!/update_my_task_progress/.test(migration18) || !/manager approval required/.test(migration18)) failed.push(['Assignee progress is constrained by a database RPC', /update_my_task_progress/]);
if (!/can_view_announcement/.test(migration18) || !/announcement_recipients enable row level security/.test(migration18)) failed.push(['Announcements are normalized and RLS protected', /can_view_announcement/]);
if (!/on conflict\(id\) do update/.test(issueImporter) || !/TEST_RE/.test(issueImporter)) failed.push(['Issue import must be idempotent and exclude test rows', /on conflict|TEST_RE/]);
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
