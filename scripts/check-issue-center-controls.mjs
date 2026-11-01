import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime=fs.readFileSync(new URL('../prototype/core-app-runtime.js',import.meta.url),'utf8');
const cloud=fs.readFileSync(new URL('../prototype/core-app-cloud.js',import.meta.url),'utf8');
const workflow=fs.readFileSync(new URL('../prototype/department-workflows.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../prototype/department-workflows.css',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../supabase/migrations/202611010056_issue_center_controls.sql',import.meta.url),'utf8');
const hotfixSql=fs.readFileSync(new URL('../supabase/migrations/202611010057_issue_bulk_close_reason_fix.sql',import.meta.url),'utf8');

for(const token of [
  "SB.storage.from('issue-evidence').upload",
  "SB.from('issue_attachments').insert",
  'issueCanClose(p)',
  'ระดับกลาง/สูง/วิกฤต',
  'newIssueFiles',
  'issueEvidenceGallery'
])assert.ok(runtime.includes(token),`runtime missing ${token}`);

for(const token of ['ISSUE_ATTACHMENTS.length=0','issue_attachments','closeReason:r.close_reason'])assert.ok(cloud.includes(token),`cloud loader missing ${token}`);
for(const token of ['ISSUE_SELECTED=new Set()','bulk_close_operational_issues','issue-team-summary','ทีมย่อยผู้แจ้ง','ใส่เหตุผลและปิดพร้อมกัน'])assert.ok(workflow.includes(token),`workflow missing ${token}`);
for(const token of ['.issue-evidence-gallery','.issue-bulk-bar','.issue-team-summary'])assert.ok(css.includes(token),`styles missing ${token}`);
for(const token of ['20261101-issue-center-1','core-app-runtime.js?v=20261101-issue-center-1'])assert.ok(index.includes(token),`release marker missing ${token}`);

for(const token of [
  'create table if not exists public.issue_attachments',
  "values (\n  'issue-evidence'",
  'create or replace function public.can_close_operational_issue',
  "issue.priority='Low'",
  "caller.role in ('exec','admin')",
  'public.can_manage_department(issue.department_code)',
  'create or replace function public.bulk_close_operational_issues',
  'if not public.can_close_operational_issue(issue)',
  'insert into public.issue_bulk_actions',
  'close_reason=trim($2)'
])assert.ok(sql.includes(token),`migration missing ${token}`);

for(const token of [
  'create or replace function public.bulk_close_operational_issues',
  'close_reason=trim($2)',
  'resolution_minutes=coalesce(resolution_minutes',
  "values(caller.id,'resolve',clean_ids,trim($2),trim(resolution_solution))"
])assert.ok(hotfixSql.includes(token),`hotfix migration missing ${token}`);
assert.ok(!hotfixSql.includes('close_reason=trim(close_reason)'),'hotfix must not use the ambiguous close_reason argument name');

assert.ok(!sql.includes('@gmail.com'),'migration must not publish employee email addresses');
console.log('PASS issue image evidence, risk-based closure, audited bulk close, team grouping and cache release checks');
