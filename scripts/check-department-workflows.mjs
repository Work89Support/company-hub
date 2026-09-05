import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');const window=new Window();const document=window.document;
document.body.innerHTML='<main id="main"></main><div id="modal"></div>';
const main=document.getElementById('main'),modal=document.getElementById('modal');let opened='',analysis=0;
const escape=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const ctx={document,main,ACCESS_PROFILE:{department_code:'ADMIN'},currentDept:()=>ctx.ACCESS_PROFILE.department_code,deptName:x=>x,esc:escape,crumb:()=>'',GF:{tab:'board'},
 SIMPLE_ALLOW:{staff:[]},ROLE_ALLOW:{staff:['activity','problems']},GP_STATUS:Object.fromEntries(['intake','doing','review','done','monthly','brief','revision'].map(k=>[k,{t:k}])),
 RENDER:{dash(){main.innerHTML='';},myTasks(){main.innerHTML='';},graphic(){main.innerHTML='<div class="page-h"><p></p></div>';},problems(){analysis++;main.innerHTML='analysis';}},
 go(v){opened=v;},openGraphicBrief(){opened='brief';},openActivityEntry(){opened='activity';},openProblem(id){opened=id;},gpJobFiles:()=>[{}],gpJobCard:j=>`<div class="gp-job"><h4>${escape(j.title)}</h4></div>`,
 ISSUE_DEFAULT_OWNER:{Payment:'Payment',System:'IT'},ISSUE_CATEGORIES:['Payment','System'],PROB_ST:{Open:{},'In Progress':{},Resolved:{}},PROB_PRIO:{High:{},Low:{}},
 PF:{project:'',status:'',cat:'',prio:'',q:''},PROBLEMS:Array.from({length:75},(_,i)=>({id:'ISS-'+i,date:i<30?'2026-09-04':'2026-09-05',time:'10:00',project:'P',cat:'Payment',problem:i===0?'<img src=x onerror=alert(1)>':'รายการ '+i,prio:'High',reporter:'ทีม',status:'Open',owner:i<30?'Admin':'IT',solution:'',resmin:0})),
 probFiltered(){return ctx.PROBLEMS.filter(p=>(!ctx.PF.q||p.problem.includes(ctx.PF.q))&&(!ctx.PF.status||p.status===ctx.PF.status));},probDate:x=>x,probPrio:escape,probStatus:escape,gpDateTime:x=>x,
 clearPF(){ctx.PF={project:'',status:'',cat:'',prio:'',q:''};ctx.RENDER.problems();},
 openNewIssue(){modal.innerHTML='<div class="pad"><div class="field"><select id="newIssueCategory"><option>Payment</option><option>System</option></select></div><div class="field"><textarea id="newIssueProblem"></textarea></div><details open><summary>เสริม</summary><div class="field"><textarea id="newIssueImpact"></textarea></div></details><div class="ai-note"></div><button id="newIssueSaveBtn"></button></div>';}
};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../prototype/department-workflows.js',import.meta.url),'utf8'),ctx);
ctx.RENDER.problems();assert.equal(main.querySelectorAll('thead th').length,15);assert.equal(main.querySelectorAll('tbody tr').length,50);
assert.equal(analysis,0,'register opens without analytics');assert.equal(main.querySelectorAll('img').length,0,'source text is escaped');
document.getElementById('issue-work-owner').value='Admin';document.getElementById('issue-work-owner').dispatchEvent(new window.Event('change'));
assert.equal(main.querySelectorAll('tbody tr').length,30);assert.equal(main.querySelectorAll('img').length,0);
main.querySelector('[data-open-issue]').click();assert.ok(opened.startsWith('ISS-'));
document.getElementById('issue-work-clear').click();assert.equal(main.querySelectorAll('tbody tr').length,50);
ctx.openNewIssue();assert.equal(document.getElementById('newIssueOwner').value,'Payment');assert.equal(document.querySelector('details').open,false);assert.equal(document.getElementById('newIssueImpact').closest('details'),null,'required impact stays visible');
const category=document.getElementById('newIssueCategory');category.value='System';category.dispatchEvent(new window.Event('change'));assert.equal(document.getElementById('newIssueOwner').value,'IT');
const owner=document.getElementById('newIssueOwner');owner.value='Support';owner.dispatchEvent(new window.Event('change'));category.value='Payment';category.dispatchEvent(new window.Event('change'));assert.equal(owner.value,'Support','explicit owner choice survives category changes');
ctx.RENDER.dash();assert.equal(main.querySelectorAll('.department-action').length,3);assert.ok(main.textContent.includes('แจ้งปัญหาหน้างาน'));
ctx.ACCESS_PROFILE.department_code='FIN';ctx.RENDER.myTasks();assert.ok(main.textContent.includes('บันทึกงานการเงิน'));assert.ok(!main.textContent.includes('เปิดบอร์ดงานกราฟิก'));
ctx.ACCESS_PROFILE.department_code='GRAPHIC';ctx.RENDER.dash();assert.ok(main.textContent.includes('เปิดบอร์ดงานกราฟิก'));assert.equal(ctx.GP_STATUS.review.t,'ส่งงาน (ตรวจสอบ)');
assert.ok(ctx.gpJobCard({id:'a',title:'test'}).includes('tabindex="0"'));
console.log('PASS department entry points, 15-column register, pagination/filtering, safe text, owner selection, visible required fields and Trello card keyboard access');await window.happyDOM.close();
