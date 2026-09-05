import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
const depts=html.match(/const DEPTS = \[[\s\S]*?\n\];/)[0];
assert.ok(!depts.includes('SECRET'));
let definitions=[],results=[];
const ctx={console,KPI:{},SB:{from(table){return {select(){return this;},eq(){return this;},order(){return this;},then(resolve){resolve({data:table==='kpi_definitions'?definitions:results});}};}}};
vm.createContext(ctx);vm.runInContext(depts+html.match(/let KPI_CATALOG=\{\};[\s\S]*?(?=async function cloudLoadIssues)/)[0],ctx);
definitions=[{id:'one',department_code:'GRAPHIC',name:'A',target:.95,weight:.5,prototype_payload:{unit:'ratio'}},{id:'two',department_code:'GRAPHIC',name:'B',target:.98,weight:.5}];
await ctx.cloudLoadKpis();assert.equal(Object.keys(ctx.KPI).length,0,'missing results must not produce zero score');assert.equal(vm.runInContext('KPI_CATALOG.GRAPHIC.length',ctx),2);
results=[{definition_id:'one',actual:.9,status:'approved',period_start:'2026-09-01',period_end:'2026-09-30'}];
await ctx.cloudLoadKpis();assert.equal(Object.keys(ctx.KPI).length,0,'partial period not scored');
results.push({...results[0],definition_id:'two',status:'draft'});await ctx.cloudLoadKpis();assert.equal(Object.keys(ctx.KPI).length,0,'draft excluded');
results[1].status='approved';results[1].period_end='2026-08-31';await ctx.cloudLoadKpis();assert.equal(Object.keys(ctx.KPI).length,0,'mixed periods excluded');
results[1].period_end='2026-09-30';await ctx.cloudLoadKpis();assert.equal(ctx.KPI.GRAPHIC.length,2);
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
await db.exec("create table departments(code text primary key);insert into departments values('SECRET'),('GRAPHIC');");
for(const t of ['profiles','profile_departments','tasks','daily_activities','operational_issues','graphic_jobs','kpi_definitions'])await db.exec(`create table ${t}(id integer,department_code text,active boolean default true);insert into ${t}(id,department_code) values(1,'SECRET');`);
const migration=fs.readFileSync(new URL('../supabase/migrations/202609050028_retire_secretary_department.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
for(const t of ['profiles','profile_departments','tasks','daily_activities','operational_issues','graphic_jobs','kpi_definitions']){
 assert.equal((await db.query(`select count(*)::int n from ${t}`)).rows[0].n,1);
 await assert.rejects(()=>db.exec(`insert into ${t}(department_code) values('SECRET')`));
 await db.exec(`update ${t} set department_code='SECRET' where id=1;insert into ${t}(id,department_code) values(2,'GRAPHIC');`);
 await assert.rejects(()=>db.exec(`update ${t} set department_code='SECRET' where id=2`));
}
await db.close();console.log('PASS active departments: old records retained, new retired assignments rejected; KPI missing/draft/partial/mixed periods excluded');
