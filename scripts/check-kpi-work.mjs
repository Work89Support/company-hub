import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let html='',closed=false,stored=[],fail=false,lastRpc;
const elements={'work-kpi-form':{},'work-kpi-save':{disabled:false},'work-kpi-error':{textContent:''}};
const ctx={console,SB:{from(table){return {select(){return this;},eq(){return this;},order(){return this;},then(resolve){resolve({data:table==='kpi_definitions'?[{id:'kpi-1',name:'<img src=x>',target:95,source:'Sheet'}]:stored.map(definition_id=>({definition_id}))});}};},async rpc(name,args){lastRpc={name,args};if(fail)return {error:{message:'permission denied'}};stored=[...args.p_definitions];return {data:stored};}},
 document:{getElementById:id=>elements[id],querySelectorAll:()=>[{value:'kpi-1'}]},showModal:s=>{html=s;},closeModal:()=>{closed=true;},toast(){},esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),deptName:x=>x,
 openActivityEntry(){},openTask(){},openGraphicJob(){},openProblem(){},RENDER:{},VIEW:'activity'};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../prototype/kpi-work.js',import.meta.url),'utf8'),ctx);
for(const kind of ['activity','task','graphic','issue']){
 closed=false;stored=[];await ctx.openWorkKpis(kind,'work-1','ADMIN');
 assert.ok(html.includes('&lt;img src=x&gt;'),'source text must be escaped');
 await elements['work-kpi-form'].onsubmit({preventDefault(){}});
 assert.equal(lastRpc.name,'save_work_kpi_tags');assert.equal(lastRpc.args.p_kind,kind);assert.equal(lastRpc.args.p_id,'work-1');assert.ok(closed);assert.deepEqual(stored,['kpi-1']);
 closed=false;fail=true;await ctx.openWorkKpis(kind,'work-1','ADMIN');await elements['work-kpi-form'].onsubmit({preventDefault(){}});
 assert.equal(closed,false);assert.equal(elements['work-kpi-error'].textContent,'permission denied');assert.equal(elements['work-kpi-save'].disabled,false);fail=false;
}
console.log('PASS KPI UI: four entry types, saved tag readback, denied writes stay open, safe source rendering');
