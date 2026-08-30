import fs from 'node:fs';
import vm from 'node:vm';

const file = new URL('../prototype/index.html', import.meta.url);
const html = fs.readFileSync(file, 'utf8');
const activity = fs.readFileSync(new URL('../prototype/activity-module.js', import.meta.url), 'utf8');
const migration15 = fs.readFileSync(new URL('../supabase/migrations/202608300015_profile_roles_and_reporting.sql', import.meta.url), 'utf8');
const checks = [
  ['Graphic navigation entry', /graphic:\{ic:'i-grid',t:'Graphic Production'\}/],
  ['Graphic navigation group', /items:\['dash','myTasks','board','graphic'/],
  ['Graphic renderer', /RENDER\.graphic\s*=\s*function/],
  ['Graphic database loader', /async function loadGraphic\(/],
  ['Graphic pagination', /GP_COLUMN_PAGE_SIZE\s*=\s*30/],
  ['Graphic realtime refresh', /table:'graphic_jobs'/],
  ['Dashboard includes Graphic jobs', /function dashboardAllWork\(\)/],
  ['Dashboard prevents empty NaN percent', /donePct=all\.length\?/],
  ['Employee access management page', /RENDER\.users\s*=\s*function/],
  ['Employee invitation through Edge Function', /invite-company-user/],
  ['Employee access update through audited RPC', /SB\.rpc\('set_user_access'/],
  ['Inactive accounts fail closed', /if\(!ACCESS_PROFILE\.active\)throw new Error/],
  ['Graphic account profile', /async function loadAuthenticatedProfile\(/],
  ['Activity renderer', /RENDER\.activity\s*=\s*function/],
  ['Operational issue loader', /async function cloudLoadIssues\(/],
  ['Verified issue save', /save_verified_issue_resolution/],
  ['Talk to Data popup', /Talk to Data/],
  ['Strict database admin role', /function canAdminAccess\(\)\{return \['exec','admin'\]\.includes\(AUTH_DB_ROLE\);\}/],
  ['Navigation has stable view targets', /data-view="\$\{k\}"/],
  ['Production fails closed without Supabase', /Production fail-closed/],
  ['Reports include Graphic and Daily Activity', /\[ Daily Activity \]/],
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
