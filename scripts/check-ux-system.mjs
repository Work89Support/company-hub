import fs from 'node:fs';import assert from 'node:assert/strict';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');const window=new Window({url:'https://example.test/'});
const html=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
window.document.write(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));
window.console={...console,warn:()=>{},log:()=>{}};window.confirm=()=>false;window.scrollTo=()=>{};
// One eval preserves top-level lexical bindings across the classic scripts.
const source=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n')+'\n'+['activity-module','native-entry','kpi-work','department-workflows','team-board','company-accounts','reporting-integrity','ux-system'].map(n=>fs.readFileSync(new URL('../prototype/'+n+'.js',import.meta.url),'utf8')).join('\n');
window.eval(source+`\nwindow.reviewAPI={previewAll:async()=>{
 ACCESS_PROFILE={id:'ux-me',department_code:'CRM',display_name:'ทีมตัวอย่าง',active:true};AUTH_DB_ROLE='admin';VISIBLE_DEPTS=DEPTS.map(d=>d.code);MANAGE_DEPTS=DEPTS.map(d=>d.code);USERS['ux-me']={n:'ทีมตัวอย่าง',s:'ท',c:'#2158c8'};
 Object.keys(KPI).forEach(k=>delete KPI[k]);TASKS.splice(0,TASKS.length);PROBLEMS.splice(0,PROBLEMS.length);ANN.splice(0,ANN.length);FEED.splice(0,FEED.length);ACTIVITY_ROWS=[];GRAPHIC_JOBS=[];GRAPHIC_PROJECTS=[];GRAPHIC_READY=true;ACTIVITY_READY=true;IMPLEMENTATION_ACTIONS_READY=true;ACCESS_USERS_READY=true;ACCESS_USERS=[];ACCESS_USER_DEPTS=[];ENTRY_PEOPLE=[];
 TASKS.push({id:'UX-01',dbId:'ux-task-1',title:'ตรวจความครบถ้วนของข้อมูลลูกค้า',dept:'CRM',status:'doing',assignee:'ux-me',assignees:['ux-me'],creator:'ux-me',start:'09-05',due:'09-08',createdAt:'2026-09-05T03:00:00Z',dueAt:'2026-09-08T10:00:00Z',prio:'mid',tags:['ตรวจข้อมูล'],desc:'ตัวอย่างสำหรับตรวจหน้าตาเท่านั้น',spent:2});
 TASK_PROFILES.splice(0,TASK_PROFILES.length,{id:'ux-me',display_name:'ทีมตัวอย่าง',department_code:'CRM',active:true});KPI_CATALOG={CRM:[{id:'ux-kpi',n:'ความถูกต้องของข้อมูลลูกค้า',tg:'98%',tgt:.98,w:1,ac:null,status:'draft',period:'ยังไม่มีผลจริง',metadata:{mapping:{required_fields:'ข้อมูลลูกค้าและหลักฐานการตรวจสอบ'}},formula:'รายการถูกต้อง / รายการทั้งหมด'}]};
 const query=new Proxy({}, {get(target,key){if(key==='then')return resolve=>resolve({data:[],error:null});return ()=>query;}});SB={from:()=>query,rpc:async()=>({data:[{id:'ux-me',display_name:'ทีมตัวอย่าง',department_code:'CRM',active:true}],error:null})};CLOUD=true;
 accountCall=async action=>action==='list'?{accounts:[]}:{username_account:true,personal_name:'ทีมตัวอย่าง',display_name:'ทีมตัวอย่าง (CRM)',contact_email:''};
 for(const key of Object.keys(DATA_HEALTH))DATA_HEALTH[key]={state:'ready',at:Date.now()};
 document.getElementById('loginBg').style.display='none';document.getElementById('overlay').classList.remove('show');buildNav();
 const results=[];for(const view of Object.keys(RENDER)){try{VIEW=view;if(view==='monthly'){REPORT_DRAFT_KEY=integrityDraftKey();REPORT_DRAFT={body:{},version:0};}await RENDER[view]();await Promise.resolve();window.companyUxEnhance();results.push({view,html:document.documentElement.outerHTML,title:main.querySelector('h1')?.textContent||'',error:null});}catch(e){results.push({view,error:e.message});}}
 VIEW='monthly';REPORT_DRAFT_KEY=integrityDraftKey();REPORT_DRAFT={body:{highlight:'ข้อความที่ยังไม่ส่ง'},version:0};RENDER.monthly();const field=document.getElementById('report-highlight');const form=field.closest('form');const submit=form.onsubmit;window.companyUxEnhance();if(field.value!=='ข้อความที่ยังไม่ส่ง'||form.onsubmit!==submit||document.querySelectorAll('.ux-draft-group').length!==3)throw new Error('Draft layout changed field state or handler');
 await openActivityEntry();window.companyUxEnhanceModal();if(!document.getElementById('native-activity-form'))throw new Error('Activity entry form failed');results.push({view:'activity-form',html:document.documentElement.outerHTML,title:'แบบฟอร์มกิจกรรม',error:null});
 return results;
},trackerEvidenceURLs,checkTracker:()=>{
 for(const key of ['tasks','issues','graphic'])DATA_HEALTH[key]={state:'ready'};IMPLEMENTATION_ACTIONS.splice(0,IMPLEMENTATION_ACTIONS.length,{id:'AP-01',title:'แผนตั้งต้น',department_code:'CRM',due_date:'2026-09-01',status:'not_started'});
 TASKS.splice(0,TASKS.length,{id:42,dept:'CRM',title:'งานจริงจากต้นทาง',status:'doing',assignees:[]});GRAPHIC_JOBS=[];PROBLEMS.splice(0,PROBLEMS.length);TRACKER_MODE='actual';TRACKER_SOURCE='';TRACKER_WORK_STATUS='open';TRACKER_WORK_DEPT='';VIEW='tracker';RENDER.tracker();
 if(!main.textContent.includes('งานจริงจากต้นทาง')||main.textContent.includes('แผนตั้งต้น'))throw new Error('Tracker mixed seeded plans with actual work');
 const original=openBoardWork;let opened;openBoardWork=(kind,id)=>opened=[kind,id];main.querySelector('[data-tracker-row]').click();openBoardWork=original;if(opened?.[0]!=='task'||opened[1]!==42)throw new Error('Tracker source link mismatch');
 const sel=main.querySelector('#tracker-work-status');sel.value='done';sel.dispatchEvent(new Event('change'));if(main.querySelector('[data-tracker-row]'))throw new Error('Tracker status filter failed');
 TRACKER_WORK_STATUS='open';TRACKER_MODE='plan';RENDER.tracker();if(!main.textContent.includes('แผนตั้งต้น')||!main.textContent.includes('ไม่ใช่สถานะความพร้อม'))throw new Error('Legacy plan provenance missing');
 TRACKER_MODE='actual';TASKS.splice(0,TASKS.length);IMPLEMENTATION_ACTIONS.splice(0,IMPLEMENTATION_ACTIONS.length);
},setCatalog:v=>{KPI_CATALOG=v;},renderKpiEvidencePanel,workOwner,integrityRange,integrityInRange,integrityDay,integrityOnTime,integrityReadAll,integrityKpiAchievement,dashboardDueAt,integrityReportRows,run:()=>{
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
const m=api.run();
const preview=window.document.createElement('section');preview.className='card pad';window.document.querySelector('#main').append(preview);
api.setCatalog({CRM:[{id:'crm1',n:'ความถูกต้องของข้อมูลลูกค้า',tg:'98%',w:.4},{id:'crm2',n:'การติดตามลูกค้าตรงเวลา',tg:'95%',w:.6}],GRAPHIC:[{id:'g1',n:'On-time Delivery Rate',tg:'95%',w:.3},{id:'g2',n:'Artwork Accuracy',tg:'98%',w:.3},{id:'g3',n:'First Approval / Revision Efficiency',tg:'90%',w:.2},{id:'g4',n:'File Archive Completion',tg:'100%',w:.2}]});
api.renderKpiEvidencePanel(preview,[{definition_id:'g1',graphic_job_id:'sample'}]);
assert.equal(preview.querySelectorAll('.ke-dept').length,2);
assert.equal(preview.querySelectorAll('.ke-item').length,6);
const filter=preview.querySelector('input[type=checkbox]');filter.checked=true;filter.dispatchEvent(new window.Event('change'));assert.equal(preview.querySelectorAll('.ke-item').length,1);
filter.checked=false;filter.dispatchEvent(new window.Event('change'));
const search=preview.querySelector('input[type=search]');search.value='ไม่พบคำนี้';search.dispatchEvent(new window.Event('input'));assert.equal(preview.querySelectorAll('.ke-item').length,0);
search.value='';search.dispatchEvent(new window.Event('input'));
if(process.env.KPI_PREVIEW_PATH)fs.writeFileSync(process.env.KPI_PREVIEW_PATH,'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Tahoma,sans-serif;background:#f3f6fc;color:#1e2d48;padding:32px;line-height:1.5}.card{background:white;border:1px solid #e1e7f1;border-radius:18px;max-width:1160px;margin:auto}*{box-sizing:border-box}</style>'+[...window.document.querySelectorAll('style')].at(-1).outerHTML+'</head><body>'+preview.outerHTML+'</body></html>');
assert.equal(m.activity.length,1);assert.equal(m.activity[0].id,2);assert.equal(m.score,null);assert.equal(api.integrityReportRows(m).filter(r=>r[0]==='activity').length,1);assert.ok(window.document.querySelector('#main').textContent.includes('รอรับรอง'));
api.checkTracker();assert.equal(api.trackerEvidenceURLs('javascript:alert(1) https://example.com/proof').length,1);
const calls=[];const data=Array.from({length:1001},(_,i)=>({id:i}));const r=await api.integrityReadAll(()=>({order(key){calls.push(key);return this;},range(a,b){return Promise.resolve({data:data.slice(a,b+1)});}}));assert.equal(r.data.length,1001);assert.equal(new Set(r.data.map(x=>x.id)).size,1001);assert.equal(calls.length,3);
await assert.rejects(()=>api.integrityReadAll(()=>({order(){return this;},range(){return Promise.resolve({error:new Error('offline')});}})));
const pages=await api.previewAll();assert.equal(pages.filter(r=>r.error).length,0,JSON.stringify(pages.filter(r=>r.error)));assert.ok(pages.length>=21);for(const p of pages)assert.ok(p.title,'Missing page title: '+p.view);
if(process.env.UX_PREVIEW_DIR){fs.mkdirSync(process.env.UX_PREVIEW_DIR,{recursive:true});for(const r of pages){if(r.html)fs.writeFileSync(process.env.UX_PREVIEW_DIR+'/'+r.view+'.html',r.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,''));}}
console.log('PASS UX: '+pages.length+' screens, preserved draft values and submission handler, activity form, source links, filters and script initialization');await window.happyDOM.close();
