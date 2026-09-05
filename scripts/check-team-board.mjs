import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');const window=new Window(),document=window.document;
document.body.innerHTML='<main></main>';const main=document.querySelector('main');let opened,visible=['CRM','FIN','GRAPHIC'];
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const activity=(id,dept,name,uid)=>({_source:'activity',id:'ACT-'+id,sourceId:String(id),dept,title:'งาน '+id,status:'todo',sourceRow:{id,employee_name:name,employee_id:uid,activity_date:'2026-09-05'}});
let data=[activity(1,'CRM','ชื่อเดิม','u1'),activity(2,'CRM','ชื่อใหม่'),activity(3,'FIN','ชื่อใหม่'),{_source:'graphic',id:'g1',sourceId:'g1',dept:'GRAPHIC',title:'ภาพ',status:'doing'},...Array.from({length:31},(_,i)=>activity(i+10,'CRM','อีกคน'))];
data[1].title='<img src=x onerror=alert(1)>';
const ctx={document,main,NAV:{},NAVGROUPS:[{items:[]}],ROLE_ALLOW:{staff:[]},SIMPLE_ALLOW:{staff:[]},TASK_PROFILES:[{id:'u1',display_name:'ชื่อใหม่'}],RENDER:{},VIEW:'teamBoard',loadActivities:async()=>{},
 DEPTS:['CRM','FIN','GRAPHIC'].map(code=>({code,name:code})),canViewDept:code=>visible.includes(code),currentDept:()=> 'CRM',
 boardAllWork:()=>data.filter(w=>visible.includes(w.dept)),GRAPHIC_JOBS:[{id:'g1',assignee_id:'u1',assignee_name:'ชื่อเก่า'}],gpJobMemberRows:()=>[{linked_profile_id:'u1',full_name:'ชื่อเก่า'},{full_name:'บุคคลสอง'}],
 STATUS:{todo:{t:'รอทำ'},doing:{t:'กำลังทำ'}},esc,crumb:()=>'',boardSourceLabel:w=>w._source,activityDateLabel:x=>x,shortName:x=>x,
 ACTIVITY_ROWS:[{id:1}],entryCanEdit:()=>true,openActivityEntry:id=>{opened=['activity',id];},openBoardActivity:id=>{opened=['read',id];},openGraphicJob:id=>{opened=['graphic',id];},openProblem:id=>{opened=['issue',id];},openTask:id=>{opened=['task',id];}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../prototype/team-board.js',import.meta.url),'utf8'),ctx);
ctx.RENDER.teamBoard();assert.equal(main.querySelectorAll('.team-work-column').length,3,'linked and legacy identities stay separate');assert.equal(main.querySelectorAll('img').length,0);
assert.equal(main.querySelectorAll('.team-work-card').length,32,'large groups paginate');main.querySelector('[data-team-more]').click();assert.equal(main.querySelectorAll('.team-work-card').length,33);
main.querySelector('[data-team-id="1"]').click();assert.deepEqual(opened,['activity',1]);
const select=(id,value)=>{const el=document.getElementById(id);el.value=value;el.dispatchEvent(new window.Event('change'));};
select('team-person','user:u1');assert.equal(main.querySelectorAll('.team-work-card').length,1);assert.ok(main.querySelector('h3').textContent.includes('ชื่อใหม่'),'current account name wins');
select('team-dept','FIN');assert.equal(main.querySelectorAll('.team-work-card').length,1);assert.equal(main.querySelector('.team-work-card').dataset.teamId,'3');
select('team-dept','GRAPHIC');assert.equal(main.querySelectorAll('.team-work-column').length,2,'linked Trello assignee deduplicates');assert.ok(main.textContent.includes('1 งาน'),'multi-assignee total is unique');main.querySelector('.team-work-card').click();assert.deepEqual(opened,['graphic','g1']);
select('team-group','status');assert.equal(main.querySelectorAll('.team-work-card').length,1);
visible=['FIN'];await ctx.loadActivities();assert.equal(document.getElementById('team-dept').value,'FIN','revoked department selection is reset');assert.equal(main.querySelectorAll('.team-work-card').length,1);
console.log('PASS team board: separate legacy/account identities, current names, permissions, source routing, multi-assignee totals, pagination and escaped text');await window.happyDOM.close();
