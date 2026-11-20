import assert from 'node:assert/strict';
import fs from 'node:fs';

const data=fs.readFileSync(new URL('../prototype/core-app-data.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../prototype/core-app-shell.js',import.meta.url),'utf8');
const cloud=fs.readFileSync(new URL('../prototype/core-app-cloud.js',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../prototype/entry-wizard.js',import.meta.url),'utf8');
const policy=fs.readFileSync(new URL('../supabase/migrations/202611200068_department_member_task_creation.sql',import.meta.url),'utf8');
const leads=fs.readFileSync(new URL('../supabase/migrations/202611200069_piglett_babycarrot_leads.sql',import.meta.url),'utf8');

assert.match(data,/function creatableDepartmentCodes\(\)\{return visibleDepartmentCodes\(\);\}/,'task creation must follow visible department membership');
assert.match(shell,/creatableDepartmentCodes\(\)\.includes\(dept\)/,'task creation must remain scoped to a visible department');
assert.match(entry,/const manageable=creatableDepartmentCodes\(\)/,'wizard must use the member task scope');
assert.match(cloud,/const manageable=creatableDepartmentCodes\(\)/,'legacy and AI creation must use the same scope');
assert.match(entry,/multiple=AUTH_DB_ROLE==='exec'&&manageable\.length>1/,'multi-department creation must remain executive-only');
assert.match(policy,/creator_id=auth\.uid\(\)[\s\S]*public\.can_view_department\(department_code\)/,'database insert policy must require ownership and visible department access');
assert.match(policy,/t\.creator_id=auth\.uid\(\) and target_user=auth\.uid\(\)/,'staff creators may assign only themselves');
assert.match(leads,/work\.qualitycontrol@gmail\.com[\s\S]*then 'KPI'/,'Piglett must be the KPI lead');
assert.match(leads,/spicybabycarrot@gmail\.com[\s\S]*then 'GRAPHIC'/,'Babycarrot must be the Graphic lead');
assert.match(leads,/set role='lead'/,'confirmed heads must receive the lead role');

console.log('PASS department member task creation and confirmed lead assignments');
