import fs from 'node:fs';
import assert from 'node:assert/strict';

const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const migration=fs.readFileSync(new URL('../supabase/migrations/202610110037_admin_kpi_governance.sql',import.meta.url),'utf8');
const frontend=fs.readFileSync(new URL('../prototype/kpi-admin-evaluation.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');

await db.exec(`
create role authenticated;
create schema auth;
create type company_role as enum ('staff','lead','exec','admin');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table departments(code text primary key,name text not null);
create table profiles(
 id uuid primary key,email text not null,display_name text not null default '',role company_role not null default 'staff',
 department_code text references departments(code),position_title text not null default '',active boolean not null default true
);
create function can_manage_department(dept text) returns boolean language sql stable security definer as $$
 select exists(select 1 from profiles where id=auth.uid() and active and (role in ('admin','exec') or (role='lead' and department_code=dept)))
$$;
create function my_company_credentials_ready() returns boolean language sql stable security definer as $$select true$$;
insert into departments values('ADMIN','Admin'),('KPI','KPI');
grant usage on schema public,auth to authenticated;
grant select on profiles,departments to authenticated;
`);

await db.exec(migration);
const totals=await db.query(`select scorecard_code,count(*)::int item_count,sum(max_score)::int total from kpi_scorecard_items group by scorecard_code order by scorecard_code`);
assert.deepEqual(totals.rows,[
 {scorecard_code:'ADMIN-LEAD-2026',item_count:30,total:100},
 {scorecard_code:'ADMIN-MGMT-2026',item_count:30,total:100},
 {scorecard_code:'ADMIN-STAFF-2026',item_count:22,total:100},
]);
assert.equal((await db.query('select count(*)::int n from kpi_scorecards where active')).rows[0].n,3);
assert.equal((await db.query("select count(*)::int n from kpi_policy_notices where code='ADMIN-KPI-2026-10-11' and active")).rows[0].n,1);
assert.match(migration,/p_evaluatee=p_reviewer/,'reviewer must differ from evaluatee');
assert.match(migration,/coalesce\(assignment\.evaluator_id,auth\.uid\(\)\)/,'assigned evaluator must be preserved');
assert.match(migration,/ลิงก์หลักฐานต้องเริ่มด้วย http:\/\/ หรือ https:\/\//,'evidence URL validation must exist in database');
assert.match(migration,/ผู้ประเมินห้ามอนุมัติผลของตนเอง/,'self-approval must be blocked');
assert.match(migration,/discipline_requires_fact_finding/,'discipline requires fact finding');
assert.match(frontend,/ADMIN_KPI_STATUS/);
assert.match(frontend,/adminKpiCanReview/);
assert.match(frontend,/voidAdminKpi/);
assert.match(frontend,/adminKpiSetView\('admin'\)/,'KPI page must offer a focused Admin evaluation view');
assert.match(frontend,/adminKpiSetView\('evidence'\)/,'KPI page must keep cross-department evidence in a separate view');
assert.match(frontend,/#main:not\(\.admin-kpi-evidence-view\)>\.admin-kpi-legacy/,'legacy KPI sections must be hidden in the default focused view');
assert.match(frontend,/\^https\?:\\\/\\\/\\S\+\$/i,'evidence URL validation must exist in UI');
assert.match(index,/kpi-admin-evaluation\.js\?v=20261011-admin-kpi-ux/,'KPI module must be loaded by production page');

const ids={staff:'00000000-0000-4000-8000-000000000001',evaluator:'00000000-0000-4000-8000-000000000002',reviewer:'00000000-0000-4000-8000-000000000003',admin:'00000000-0000-4000-8000-000000000004'};
await db.exec(`insert into profiles(id,email,display_name,role,department_code,position_title) values
 ('${ids.staff}','staff@example.test','Staff','staff','ADMIN','พนักงาน Admin'),
 ('${ids.evaluator}','evaluator@example.test','Evaluator','lead','ADMIN','ผู้ช่วยหัวหน้า'),
 ('${ids.reviewer}','reviewer@example.test','Reviewer','lead','ADMIN','หัวหน้า'),
 ('${ids.admin}','admin@example.test','Admin','admin','ADMIN','บริหารแอดมิน');`);
const login=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
await login(ids.admin);
await db.query("select set_admin_kpi_assignment($1,$2,$3,'ADMIN-STAFF-2026','2026-10-01')",[ids.staff,ids.evaluator,ids.reviewer]);
const evaluation=(await db.query("select x.* from start_admin_kpi_evaluation($1,'2026-10-01') x",[ids.staff])).rows[0];
assert.equal(evaluation.evaluator_id,ids.evaluator,'an admin starting a round must preserve the assigned evaluator');
assert.equal(evaluation.reviewer_id,ids.reviewer);
await assert.rejects(()=>db.query("select set_admin_kpi_assignment($1,$2,$1,'ADMIN-STAFF-2026','2026-11-01')",[ids.staff,ids.evaluator]),'reviewer cannot be the evaluatee');

const items=(await db.query("select id,max_score from kpi_scorecard_items where scorecard_code='ADMIN-STAFF-2026' order by sort_order")).rows;
const payload=items.map(item=>({item_id:item.id,score:Number(item.max_score),evidence_note:'ตรวจจากรายงานจริงและหลักฐานที่แนบครบถ้วน',evidence_urls:[]}));
await login(ids.evaluator);
const evaluatorView=(await db.query('select auth.uid() actor,evaluator_id,status,version from kpi_evaluations where id=$1',[evaluation.id])).rows[0];
assert.equal(evaluatorView.actor,ids.evaluator);
assert.equal(evaluatorView.evaluator_id,ids.evaluator);
assert.equal(evaluatorView.status,'draft');
assert.equal(Number(evaluatorView.version),Number(evaluation.version));
assert.equal((await db.query('select version=$2::integer matches from kpi_evaluations where id=$1',[evaluation.id,Number(evaluatorView.version)])).rows[0].matches,true);
const saved=(await db.query('select x.* from save_admin_kpi_draft($1,$2::jsonb,$3,$4::integer) x',[evaluation.id,JSON.stringify(payload),'ผลการปฏิบัติงานประจำเดือน',Number(evaluatorView.version)])).rows[0];
const submitted=(await db.query('select x.* from submit_admin_kpi_evaluation($1,$2) x',[evaluation.id,saved.version])).rows[0];
assert.equal(Number(submitted.total_score),100);
assert.equal(submitted.grade,'A');
await assert.rejects(()=>db.query("select review_admin_kpi_evaluation($1,'approve','',$2)",[evaluation.id,submitted.version]),'evaluator cannot approve own score');

await login(ids.reviewer);
const approved=(await db.query("select x.* from review_admin_kpi_evaluation($1,'approve','',$2) x",[evaluation.id,submitted.version])).rows[0];
assert.equal(approved.status,'approved');
await login(ids.admin);
const voided=(await db.query('select x.* from void_admin_kpi_evaluation($1,$2,$3) x',[evaluation.id,'ตรวจพบข้อเท็จจริงว่ากระบวนการประเมินไม่เป็นกลาง ต้องประเมินใหม่',approved.version])).rows[0];
assert.equal(voided.status,'voided');
assert.equal((await db.query('select count(*)::int n from kpi_evaluation_audit where evaluation_id=$1',[evaluation.id])).rows[0].n,5);
console.log('PASS Admin KPI: three position scorecards, 100 points each, evaluator separation, evidence, review, void and audit controls');
await db.close();
