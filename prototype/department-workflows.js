/* Familiar entry points; all mutations still use the validated existing flows. */
const DEPARTMENT_WORK_LABELS={ADMIN:'บันทึกงานแอดมิน',GRAPHIC:'บันทึกกิจกรรมกราฟิก',CRM:'บันทึกการติดตามลูกค้า',FIN:'บันทึกงานการเงิน',HR:'บันทึกงานบุคคล',MKT:'บันทึกงานการตลาด',PROG:'บันทึกงานพัฒนา',QC:'บันทึกการตรวจคุณภาพ',AUD123:'บันทึกงานออดิท',AUDXB:'บันทึกงานออดิท',BO:'บันทึกงาน Back Office',BOM:'บันทึกงานบริหาร',KPI:'บันทึกงานวัดผล'};
function departmentStart(){
 if(!ACCESS_PROFILE||document.getElementById('department-start'))return;
 const code=currentDept(),box=document.createElement('section');box.id='department-start';box.className='department-start';
 const actions=code==='GRAPHIC'?[
  ['เปิดบอร์ดงานกราฟิก','ดูการ์ดและลากเปลี่ยนสถานะ',()=>{GF.tab='board';go('graphic');}],
  ['เพิ่มการ์ด / รับบรีฟ','รายละเอียด ผู้รับผิดชอบ และกำหนดส่ง',openGraphicBrief]
 ]:code==='ADMIN'?[
  ['แจ้งปัญหาหน้างาน','วันที่ โปรเจกต์ ปัญหา และทีมรับผิดชอบ',openNewIssue],
  ['ทะเบียนปัญหา','ค้นหา ติดตาม และเปิดเคสเพื่อแก้ไข',()=>{ISSUE_WORK_VIEW='register';go('problems');}]
 ]:[
  [DEPARTMENT_WORK_LABELS[code]||'บันทึกกิจกรรม','งานที่ทำ เวลา สถานะ และผลลัพธ์',()=>openActivityEntry()],
  ['บอร์ดทีม / รายคน','เลือกคน ดูการ์ด และเปิดงานเพื่ออัปเดต',()=>go('teamBoard')]
 ];
 actions.push(['ข้อมูลที่ต้องเติม','ตรวจรายการที่ยังไม่ครบตามสิทธิ์ของคุณ',()=>go('completeness')]);
 box.innerHTML=`<div><h2>เริ่มงาน · ${esc(deptName(code))}</h2><p>เลือกสิ่งที่ต้องการทำ</p></div><div class="department-actions"></div>`;
 for(const [title,description,action] of actions){const b=document.createElement('button');b.type='button';b.className='department-action';b.innerHTML=`<b>${esc(title)}</b><span>${esc(description)}</span>`;b.onclick=action;box.lastElementChild.append(b);}main.prepend(box);
}
for(const view of ['dash','myTasks']){const render=RENDER[view];RENDER[view]=function(...args){const result=render(...args);departmentStart();return result;};}
for(const role of Object.keys(SIMPLE_ALLOW))for(const view of ['activity','problems'])if(ROLE_ALLOW[role]?.includes(view)&&!SIMPLE_ALLOW[role].includes(view))SIMPLE_ALLOW[role].push(view);

// Keep database status keys, using the established Trello team's list vocabulary.
Object.entries({intake:'งานใหม่ (ยังไม่เริ่มทำ)',doing:'งานที่กำลังทำ',review:'ส่งงาน (ตรวจสอบ)',done:'ดำเนินการแล้ว',monthly:'งานรายเดือน',brief:'งานการตลาด',revision:'กำลังแก้ไข'}).forEach(([key,title])=>GP_STATUS[key].t=title);
const familiarGraphic=RENDER.graphic;
RENDER.graphic=function(){familiarGraphic();if(GF.tab==='board'){main.classList.add('graphic-board-view');main.querySelector('.page-h p')?.replaceChildren(document.createTextNode('เลือกบอร์ด → เปิดการ์ด → ทำ Checklist / แนบไฟล์ → ส่งตรวจ · ลากการ์ดหรือใช้ปุ่มสถานะในรายละเอียดได้'));}else main.classList.remove('graphic-board-view');};
const familiarCard=gpJobCard;
gpJobCard=function(j){
 const attachments=gpJobFiles(j.id).length;
 return familiarCard(j).replace('class="gp-job"',`class="gp-job" role="button" tabindex="0" aria-label="${esc(j.title)}" onkeydown="if(event.target===this&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openGraphicJob('${j.id}')}"`)
  .replace('</h4>',`</h4>${attachments?`<div class="gp-meta">ไฟล์แนบ ${attachments}</div>`:''}`);
};

let ISSUE_WORK_VIEW='register',ISSUE_WORK_FILTER={from:'',to:'',owner:''},ISSUE_WORK_PAGE=1;
const ISSUE_REGISTER_COLUMNS=['รหัสเคส','วันที่','เวลา','โปรเจกต์','ประเภท','ปัญหา','ความสำคัญ','ผู้แจ้ง','สถานะ','ทีมรับผิดชอบ','วิธีแก้','สร้างเมื่อ','แก้ไขเมื่อ','ปิดเมื่อ','นาทีที่ใช้แก้'];
function issueRegisterRows(){return probFiltered().filter(p=>(!ISSUE_WORK_FILTER.from||p.date>=ISSUE_WORK_FILTER.from)&&(!ISSUE_WORK_FILTER.to||p.date<=ISSUE_WORK_FILTER.to)&&(!ISSUE_WORK_FILTER.owner||p.owner===ISSUE_WORK_FILTER.owner)).sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));}
function issueWorkTabs(){return `<div class="gp-tabs"><button class="${ISSUE_WORK_VIEW==='register'?'active':''}" onclick="ISSUE_WORK_VIEW='register';RENDER.problems()">ทะเบียนปัญหา</button><button class="${ISSUE_WORK_VIEW==='analysis'?'active':''}" onclick="ISSUE_WORK_VIEW='analysis';RENDER.problems()">สรุปและวิเคราะห์</button></div>`;}
const issueAnalysis=RENDER.problems;
RENDER.problems=function(){
 if(ISSUE_WORK_VIEW==='analysis'){issueAnalysis();main.insertAdjacentHTML('afterbegin',issueWorkTabs());return;}
 const rows=issueRegisterRows(),pages=Math.max(1,Math.ceil(rows.length/50));ISSUE_WORK_PAGE=Math.max(1,Math.min(pages,ISSUE_WORK_PAGE));
 const options=(values,selected)=>'<option value="">ทั้งหมด</option>'+values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
 main.innerHTML=`${crumb('หน้าแรก','ทะเบียนปัญหาหน้างาน')}<div class="page-h"><div><h1>ทะเบียนปัญหาหน้างาน</h1><p>ลำดับคอลัมน์ตามชีต Issues เดิม · เปิดรหัสเคสเพื่อติดตาม แก้ไข และยืนยันการปิดเคส</p></div><button class="tbtn primary" onclick="openNewIssue()">+ แจ้งปัญหาใหม่</button></div>${issueWorkTabs()}<div class="issue-work-filters">
 <label>วันที่เริ่ม<input class="fin" type="date" data-issue-date="from" value="${esc(ISSUE_WORK_FILTER.from)}"></label><label>ถึงวันที่<input class="fin" type="date" data-issue-date="to" value="${esc(ISSUE_WORK_FILTER.to)}"></label>
 <label>โปรเจกต์<select class="fin" data-issue-filter="project">${options([...new Set(PROBLEMS.map(p=>p.project))].sort(),PF.project)}</select></label>
 <label>สถานะ<select class="fin" data-issue-filter="status">${options(Object.keys(PROB_ST),PF.status)}</select></label>
 <label>ประเภท<select class="fin" data-issue-filter="cat">${options(ISSUE_CATEGORIES,PF.cat)}</select></label>
 <label>ความสำคัญ<select class="fin" data-issue-filter="prio">${options(Object.keys(PROB_PRIO),PF.prio)}</select></label>
 <label>ทีมรับผิดชอบ<select class="fin" id="issue-work-owner">${options([...new Set(PROBLEMS.map(p=>p.owner).filter(Boolean))].sort(),ISSUE_WORK_FILTER.owner)}</select></label>
 <form id="issue-work-search"><label>ค้นหาปัญหา / ผู้แจ้ง / รหัส<input class="fin" name="query" value="${esc(PF.q)}"></label><button class="tbtn">ค้นหา</button></form><button class="tbtn" id="issue-work-clear">ล้างตัวกรอง</button></div>
 <p role="status">${rows.length} เคสตามตัวกรอง · ${rows.filter(p=>p.status!=='Resolved').length} เคสยังไม่ปิด · หน้า ${ISSUE_WORK_PAGE}/${pages}</p>
 <div class="issue-register" tabindex="0" aria-label="ทะเบียนปัญหา เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"><table><thead><tr>${ISSUE_REGISTER_COLUMNS.map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${rows.slice((ISSUE_WORK_PAGE-1)*50,ISSUE_WORK_PAGE*50).map(p=>`<tr><td><button class="issue-case-link" data-open-issue="${esc(p.id)}">${esc(p.id)}</button></td><td>${esc(probDate(p.date))}</td><td>${esc(p.time)}</td><td>${esc(p.project)}</td><td>${esc(p.cat)}</td><td class="issue-text">${esc(p.problem)}</td><td>${probPrio(p.prio)}</td><td>${esc(p.reporter)}</td><td>${probStatus(p.status)}</td><td>${esc(p.owner||'ยังไม่ระบุ')}</td><td class="issue-text">${esc(p.solution||'ยังไม่มีวิธีแก้')}</td><td>${p.createdAt?esc(gpDateTime(p.createdAt)):'—'}</td><td>${p.updatedAt?esc(gpDateTime(p.updatedAt)):'—'}</td><td>${p.resolvedAt?esc(gpDateTime(p.resolvedAt)):'—'}</td><td>${p.resmin==null?'—':esc(p.resmin)}</td></tr>`).join('')||'<tr><td colspan="15">ไม่พบเคสตามตัวกรอง</td></tr>'}</tbody></table></div>
 <div class="entry-scope"><button class="tbtn" ${ISSUE_WORK_PAGE<=1?'disabled':''} onclick="ISSUE_WORK_PAGE--;RENDER.problems()">ก่อนหน้า</button><button class="tbtn" ${ISSUE_WORK_PAGE>=pages?'disabled':''} onclick="ISSUE_WORK_PAGE++;RENDER.problems()">ถัดไป</button></div>`;
 const refresh=()=>{ISSUE_WORK_PAGE=1;RENDER.problems();};
 main.querySelectorAll('[data-open-issue]').forEach(b=>b.onclick=()=>openProblem(b.dataset.openIssue));
 main.querySelectorAll('[data-issue-filter]').forEach(s=>s.onchange=()=>{PF[s.dataset.issueFilter]=s.value;refresh();});
 main.querySelectorAll('[data-issue-date]').forEach(s=>s.onchange=()=>{ISSUE_WORK_FILTER[s.dataset.issueDate]=s.value;if(ISSUE_WORK_FILTER.from&&ISSUE_WORK_FILTER.to&&ISSUE_WORK_FILTER.from>ISSUE_WORK_FILTER.to){ISSUE_WORK_FILTER[s.dataset.issueDate==='from'?'to':'from']=s.value;}refresh();});
 document.getElementById('issue-work-owner').onchange=e=>{ISSUE_WORK_FILTER.owner=e.target.value;refresh();};
 document.getElementById('issue-work-search').onsubmit=e=>{e.preventDefault();PF.q=e.currentTarget.elements.query.value.trim();refresh();};
 document.getElementById('issue-work-clear').onclick=()=>{ISSUE_WORK_FILTER={from:'',to:'',owner:''};ISSUE_WORK_PAGE=1;clearPF();};
};
const familiarIssueEntry=openNewIssue;
openNewIssue=function(){
 familiarIssueEntry();const category=document.getElementById('newIssueCategory');if(!category)return;
 const impact=document.getElementById('newIssueImpact').closest('.field'),problem=document.getElementById('newIssueProblem').closest('.field');problem.after(impact);
 document.querySelectorAll('#modal details').forEach(d=>d.open=false);
 const field=document.createElement('div');field.className='field';field.innerHTML=`<label for="newIssueOwner">ทีมรับผิดชอบ *</label><select class="fin" id="newIssueOwner">${['Admin','IT','Payment','Support','Developer','Marketing','Other'].map(o=>`<option value="${o}">${o}</option>`).join('')}</select><small>เลือกทีมตามช่อง Owner ในชีตเดิม</small>`;
 impact.after(field);const owner=document.getElementById('newIssueOwner');owner.value=ISSUE_DEFAULT_OWNER[category.value]||'Admin';let chosen=false;owner.onchange=()=>chosen=true;category.addEventListener('change',()=>{if(!chosen)owner.value=ISSUE_DEFAULT_OWNER[category.value]||'Admin';});
 const submit=document.getElementById('newIssueSaveBtn');const note=submit.previousElementSibling;if(note?.classList.contains('ai-note'))note.textContent='บันทึกเป็น Open ให้ทีมที่เลือกติดตามต่อ ส่วนการปิดเคสให้หัวหน้ายืนยันวิธีแก้และผลลัพธ์';
};
