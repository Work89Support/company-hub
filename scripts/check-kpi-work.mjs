import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let html='',closed=false,stored=[],fail=false,lastRpc;
const elements={'work-kpi-form':{},'work-kpi-save':{disabled:false},'work-kpi-error':{textContent:''}};
const ownActivity={id:'own-activity',department_code:'AIAUTO',employee_id:'amm-profile',activity:'Audit Reconciliation Control',activity_date:'2026-09-29',employee_name:'AMM',updated_at:'2026-09-29T10:00:00Z'};
const ctx={console,ACCESS_PROFILE:{id:'amm-profile',department_code:'AIAUTO'},ACTIVITY_ROWS:[],TASKS:[],GRAPHIC_JOBS:[],PROBLEMS:[],entryCanEdit:()=>true,canManageGraphic:()=>false,SB:{from(table){return {select(){return this;},eq(){return this;},order(){return this;},limit(){return this;},then(resolve){resolve({data:table==='kpi_definitions'?[{id:'kpi-1',name:'<img src=x>',target:95,source:'Sheet'}]:table==='daily_activities'?[ownActivity]:stored.map(definition_id=>({definition_id}))});}};},async rpc(name,args){lastRpc={name,args};if(fail)return {error:{message:'permission denied'}};stored=[...args.p_definitions];return {data:stored};}},
 document:{getElementById:id=>elements[id],querySelectorAll:()=>[{value:'kpi-1'}]},showModal:s=>{html=s;},closeModal:()=>{closed=true;},toast(){},esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),deptName:x=>x,
 openActivityEntry(){},openTask(){},openGraphicJob(){},openProblem(){},RENDER:{},VIEW:'activity'};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../prototype/kpi-work.js',import.meta.url),'utf8'),ctx);
const candidates=await ctx.kpiEvidenceCandidates();
assert.equal(candidates.length,1,'signed-in person activity must be fetched even when shared activity cache is empty');
assert.equal(new Set(candidates.map(row=>row.id)).size,candidates.length,'profile and department reads must not duplicate evidence');
assert.equal(candidates[0].department,'AIAUTO');assert.equal(candidates[0].title,'Audit Reconciliation Control');
ctx.ACTIVITY_ROWS.splice(0,ctx.ACTIVITY_ROWS.length,...Array.from({length:301},(_,i)=>({
 id:`other-${i}`,department_code:'ADMIN',employee_id:`other-${i}`,activity:`Other ${i}`,
 activity_date:'2026-10-25',employee_name:'Other',updated_at:`2026-10-25T12:${String(i%60).padStart(2,'0')}:00Z`
})));
const capped=await ctx.kpiEvidenceCandidates();
assert.equal(capped.length,300,'evidence picker remains capped');
assert.ok(capped.some(row=>row.id==='own-activity'),'signed-in person evidence must survive the 300-row cap');
assert.equal(capped[0].id,'own-activity','signed-in person evidence must be prioritized');
for(const kind of ['activity','task','graphic','issue']){
 closed=false;stored=[];await ctx.openWorkKpis(kind,'work-1','ADMIN');
 assert.ok(html.includes('&lt;img src=x&gt;'),'source text must be escaped');
 await elements['work-kpi-form'].onsubmit({preventDefault(){}});
 assert.equal(lastRpc.name,'save_work_kpi_tags');assert.equal(lastRpc.args.p_kind,kind);assert.equal(lastRpc.args.p_id,'work-1');assert.ok(closed);assert.deepEqual(stored,['kpi-1']);
 closed=false;fail=true;await ctx.openWorkKpis(kind,'work-1','ADMIN');await elements['work-kpi-form'].onsubmit({preventDefault(){}});
 assert.equal(closed,false);assert.equal(elements['work-kpi-error'].textContent,'permission denied');assert.equal(elements['work-kpi-save'].disabled,false);fail=false;
}
console.log('PASS KPI UI: four entry types, saved tag readback, denied writes stay open, safe source rendering');
