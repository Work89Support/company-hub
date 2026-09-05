import fs from 'node:fs';import assert from 'node:assert/strict';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');const window=new Window({url:'https://example.test/'});
const html=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
window.document.write(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
window.console={...console,warn:()=>{},log:()=>{}};window.confirm=()=>false;window.scrollTo=()=>{};
// One eval preserves top-level lexical bindings across the classic scripts.
const source=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n')+'\n'+['activity-module','native-entry','kpi-work','department-workflows','team-board','company-accounts','reporting-integrity'].map(n=>fs.readFileSync(new URL('../prototype/'+n+'.js',import.meta.url),'utf8')).join('\n');
window.eval(source+`\nwindow.reviewAPI={workOwner,integrityRange,integrityInRange,integrityDay,integrityOnTime,integrityReadAll,integrityKpiAchievement,dashboardDueAt,integrityReportRows,run:()=>{
 ACCESS_PROFILE={id:'me',department_code:'CRM',active:true};AUTH_DB_ROLE='admin';VISIBLE_DEPTS=['CRM','GRAPHIC'];
 TASKS.length=0;GRAPHIC_JOBS=[];ACTIVITY_ROWS=[{id:1,department_code:'CRM',activity_date:'2020-01-01',activity:'old'},{id:2,department_code:'CRM',activity_date:bangkokTodayISO(),activity:'new'}];ACTIVITY_READY=true;PROBLEMS.length=0;
 KPI_CATALOG.CRM=[{id:'historical',tgt:10,w:1,metadata:{},period:'2026-09-01 – 2026-09-30',ac:5,pct:50,status:'approved'}];INTEGRITY_KPI_HISTORY=[{definition_id:'historical',period_start:'2026-08-01',period_end:'2026-08-31',actual:8,status:'approved'}];if(integrityScore(['CRM'],integrityRange('month','2026-08'))!==80)throw new Error('historical KPI period mismatch');KPI_CATALOG={};INTEGRITY_KPI_HISTORY=[];
 REP_PERIOD='today';const m=integrityReportModel();RENDER.reports();return m;
}};`);
const api=window.reviewAPI;
assert.equal(api.workOwner({_source:'graphic',assignee:'12345678-1234-1234-1234-123456789abc'}),'ยังไม่มอบหมาย');
assert.equal(api.workOwner({_source:'graphic',assignee:'ทีมออกแบบ'}),'ทีมออกแบบ');
assert.deepEqual(JSON.parse(JSON.stringify(api.integrityRange('month','2024-02'))),{from:'2024-02-01',to:'2024-02-29'});
assert.deepEqual(JSON.parse(JSON.stringify(api.integrityRange('quarter','2026-12'))),{from:'2026-10-01',to:'2026-12-31'});
assert.equal(api.integrityDay('2026-09-04T18:00:00Z'),'2026-09-05');
assert.equal(api.dashboardDueAt({due:'2026-09-05'}).toISOString(),'2026-09-05T16:59:59.999Z');assert.equal(api.dashboardDueAt({due:'09-05'}),null);
assert.equal(api.integrityOnTime([{status:'done'}]).rate,null);assert.equal(api.integrityOnTime([{status:'done',dueAt:'2026-09-05T12:00:00Z',completedAt:'2026-09-05T11:00:00Z'},{status:'done'}]).rate,100);
assert.equal(api.integrityKpiAchievement(.9,1),90);assert.equal(api.integrityKpiAchievement(null,1),null);assert.equal(api.integrityKpiAchievement(0,0),null);assert.equal(api.integrityKpiAchievement(2,1,{direction:'lower'}),50);
const m=api.run();assert.equal(m.activity.length,1);assert.equal(m.activity[0].id,2);assert.equal(m.score,null);assert.equal(api.integrityReportRows(m).filter(r=>r[0]==='activity').length,1);assert.ok(window.document.querySelector('#main').textContent.includes('รอรับรอง'));
const calls=[];const data=Array.from({length:1001},(_,i)=>({id:i}));const r=await api.integrityReadAll(()=>({order(key){calls.push(key);return this;},range(a,b){return Promise.resolve({data:data.slice(a,b+1)});}}));assert.equal(r.data.length,1001);assert.equal(new Set(r.data.map(x=>x.id)).size,1001);assert.equal(calls.length,3);
await assert.rejects(()=>api.integrityReadAll(()=>({order(){return this;},range(){return Promise.resolve({error:new Error('offline')});}})));
console.log('PASS reporting UI: full script initialization, Bangkok boundaries, leap month/quarter, report/export parity, unknown denominators, 1001-row pagination, error propagation');await window.happyDOM.close();
