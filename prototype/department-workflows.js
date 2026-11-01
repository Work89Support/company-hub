/* Familiar entry points; all mutations still use the validated existing flows. */
const DEPARTMENT_WORK_LABELS={SC:'บันทึกงาน SC',ADMIN:'บันทึกงานแอดมิน',GRAPHIC:'บันทึกกิจกรรมกราฟิก',CRM:'บันทึกการติดตามลูกค้า',FIN:'บันทึกงานการเงิน',HR:'บันทึกงานบุคคล',MKT:'บันทึกงานการตลาด',PROG:'บันทึกงานพัฒนา',AIAUTO:'บันทึกงาน AI Automation',QC:'บันทึกการตรวจคุณภาพ',AUD123:'บันทึกงานออดิท',AUDXB:'บันทึกงานออดิท',BO:'บันทึกงาน Back Office',BOM:'บันทึกงานบริหาร',KPI:'บันทึกงานวัดผล'};
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
 box.innerHTML=`<div class="department-start-head"><div><span>เมนูลัด</span><h2>${esc(deptName(code))}</h2></div><p>งานที่ใช้บ่อย</p></div><div class="department-actions"></div>`;
 for(const [title,description,action] of actions){const b=document.createElement('button');b.type='button';b.className='department-action';b.innerHTML=`<span class="department-action-copy"><b>${esc(title)}</b><small>${esc(description)}</small></span><i aria-hidden="true">→</i>`;b.onclick=action;box.lastElementChild.append(b);}main.prepend(box);
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

let ISSUE_WORK_VIEW='register',ISSUE_WORK_FILTER={from:'',to:'',owner:'',team:''},ISSUE_WORK_PAGE=1,ISSUE_SELECTED=new Set();
const ISSUE_REGISTER_COLUMNS=['รหัสเคส','วันที่','เวลา','โปรเจกต์','ประเภท','ปัญหา','ความสำคัญ','ผู้แจ้ง','สถานะ','ทีมรับผิดชอบ','วิธีแก้','สร้างเมื่อ','แก้ไขเมื่อ','ปิดเมื่อ','นาทีที่ใช้แก้'];
function issueTeamProfiles(){return typeof TASK_PROFILES==='undefined'?[]:TASK_PROFILES;}
function issueWorkTeam(p){const people=issueTeamProfiles(),direct=people.find(x=>x.id===p.createdBy),name=String(p.reporter||'').normalize('NFKC').trim().toLowerCase(),byName=!direct&&people.find(x=>String(x.display_name||'').normalize('NFKC').trim().toLowerCase()===name);return (direct||byName)?.team_code||'';}
function issueRegisterRows(){return probFiltered().filter(p=>(!ISSUE_WORK_FILTER.from||p.date>=ISSUE_WORK_FILTER.from)&&(!ISSUE_WORK_FILTER.to||p.date<=ISSUE_WORK_FILTER.to)&&(!ISSUE_WORK_FILTER.owner||p.owner===ISSUE_WORK_FILTER.owner)&&(!ISSUE_WORK_FILTER.team||issueWorkTeam(p)===ISSUE_WORK_FILTER.team)).sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));}
function issueTeamSummaryHTML(rows){
 const teams=[...new Set(issueTeamProfiles().filter(p=>p.department_code==='ADMIN').map(p=>p.team_code).filter(Boolean))].sort();
 return `<div class="issue-team-summary">${teams.map(team=>{const list=rows.filter(p=>issueWorkTeam(p)===team),open=list.filter(p=>p.status!=='Resolved').length;return `<button type="button" class="${ISSUE_WORK_FILTER.team===team?'active':''}" data-issue-team-card="${team}"><b>${team}</b><span>${list.length} เคส</span><small>ค้าง ${open} · ปิดแล้ว ${list.length-open}</small></button>`;}).join('')}</div>`;
}
function issueSelectionChanged(id,checked){if(checked)ISSUE_SELECTED.add(id);else ISSUE_SELECTED.delete(id);RENDER.problems();}
function issueSelectPage(checked){
 const page=issueRegisterRows().slice((ISSUE_WORK_PAGE-1)*50,ISSUE_WORK_PAGE*50).filter(issueCanClose);
 page.forEach(p=>checked?ISSUE_SELECTED.add(p.id):ISSUE_SELECTED.delete(p.id));RENDER.problems();
}
function openBulkIssueClose(){
 const rows=PROBLEMS.filter(p=>ISSUE_SELECTED.has(p.id)&&issueCanClose(p));
 if(!rows.length){toast('เลือกเคสที่บัญชีของคุณมีสิทธิ์ปิดก่อน','info');return;}
 showModal(`<div class="modal-h"><div><span class="tag">ปิดหลายเคส</span><h3>ยืนยันปิด ${rows.length} เคสพร้อมกัน</h3><div class="muted">${rows.map(p=>esc(p.id)).join(' · ')}</div></div><button class="x" onclick="closeModal()">×</button></div><div class="pad"><div class="ai-note"><b>การปิดนี้เป็นรายการเดียวแบบตรวจสอบย้อนหลังได้</b><br><span class="muted">ถ้ามีเคสใดไม่มีสิทธิ์ ระบบจะไม่ปิดทุกเคส เพื่อป้องกันข้อมูลค้างครึ่งชุด</span></div><div class="field"><label>เหตุผลที่ปิดพร้อมกัน *</label><textarea class="fin" id="issueBulkReason" rows="3" maxlength="1000" placeholder="เช่น ปัญหาเดียวกันจาก Provider และตรวจสอบแล้วว่ากลับมาใช้งานปกติ"></textarea></div><div class="field"><label>วิธีแก้ / ผลดำเนินการ *</label><textarea class="fin" id="issueBulkSolution" rows="4" maxlength="4000" placeholder="ระบุสิ่งที่ทำและผลที่ตรวจสอบแล้ว"></textarea></div><label class="ai-note" style="display:flex;gap:9px;align-items:flex-start"><input type="checkbox" id="issueBulkVerified" style="margin-top:3px"><span><b>ยืนยันว่าทดสอบแล้วและวิธีแก้ใช้ได้จริง</b></span></label><button class="tbtn primary" id="issueBulkCloseBtn" onclick="bulkCloseIssues()">ปิด ${rows.length} เคส</button></div>`);
}
async function bulkCloseIssues(){
 const ids=[...ISSUE_SELECTED].filter(id=>{const p=PROBLEMS.find(x=>x.id===id);return p&&issueCanClose(p);}),reason=val('issueBulkReason').trim(),solution=val('issueBulkSolution').trim(),verified=!!document.getElementById('issueBulkVerified')?.checked;
 if(reason.length<5)return toast('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร','info');
 if(!solution)return toast('กรุณาระบุวิธีแก้หรือผลดำเนินการ','info');
 if(!verified)return toast('กรุณายืนยันว่าทดสอบแล้วและใช้ได้จริง','info');
 const btn=document.getElementById('issueBulkCloseBtn');if(btn)btn.disabled=true;
 const result=await SB.rpc('bulk_close_operational_issues',{target_issues:ids,close_reason:reason,resolution_solution:solution,confirm_effective:true});
 if(result.error){if(btn)btn.disabled=false;return toast('ปิดเคสไม่สำเร็จ · '+result.error.message,'info');}
 ISSUE_SELECTED.clear();closeModal();await cloudLoadIssues();RENDER.problems();toast(`ปิดพร้อมกันแล้ว ${result.data?.closed||ids.length} เคส`);
}
function issueWorkTabs(){return `<div class="gp-tabs"><button class="${ISSUE_WORK_VIEW==='register'?'active':''}" onclick="ISSUE_WORK_VIEW='register';RENDER.problems()">ทะเบียนปัญหา</button><button class="${ISSUE_WORK_VIEW==='analysis'?'active':''}" onclick="ISSUE_WORK_VIEW='analysis';RENDER.problems()">สรุปและวิเคราะห์</button></div>`;}
function issueExcelEscape(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));}
function issueExcelCell(value,type='String',style=''){return `<Cell${style?` ss:StyleID="${style}"`:''}><Data ss:Type="${type}">${issueExcelEscape(value)}</Data></Cell>`;}
function downloadIssueExcel(){
 const rows=issueRegisterRows();
 if(!rows.length){toast('ไม่มีเคสตามตัวกรองสำหรับส่งออก','info');return;}
 const header=ISSUE_REGISTER_COLUMNS.map(v=>issueExcelCell(v,'String','Header')).join('');
 const body=rows.map(p=>'<Row>'+
  issueExcelCell(p.id)+issueExcelCell(probDate(p.date))+issueExcelCell(p.time)+issueExcelCell(p.project)+issueExcelCell(p.cat)+issueExcelCell(p.problem)+
  issueExcelCell(PROB_PRIO[p.prio]?.t||p.prio)+issueExcelCell(p.reporter)+issueExcelCell(PROB_ST[p.status]?.t||p.status)+issueExcelCell(p.owner||'ยังไม่ระบุ')+
  issueExcelCell(p.solution||'ยังไม่มีวิธีแก้')+issueExcelCell(p.createdAt?gpDateTime(p.createdAt):'')+issueExcelCell(p.updatedAt?gpDateTime(p.updatedAt):'')+
  issueExcelCell(p.resolvedAt?gpDateTime(p.resolvedAt):'')+issueExcelCell(p.resmin==null?'':Number(p.resmin),p.resmin==null?'String':'Number')+'</Row>').join('');
 const widths=[150,80,70,90,90,360,85,110,90,110,300,120,120,120,90].map(w=>`<Column ss:AutoFitWidth="0" ss:Width="${w}"/>`).join('');
 const xml=`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">
<Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top" ss:WrapText="1"/><Font ss:FontName="Tahoma" ss:Size="10"/></Style><Style ss:ID="Header"><Font ss:FontName="Tahoma" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#245BC8" ss:Pattern="Solid"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style></Styles>
<Worksheet ss:Name="ทะเบียนปัญหา"><Table>${widths}<Row ss:Height="28">${header}</Row>${body}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>
</Workbook>`;
 const blob=new Blob(['\ufeff'+xml],{type:'application/vnd.ms-excel;charset=utf-8'});
 const link=document.createElement('a'),url=URL.createObjectURL(blob);
 link.href=url;link.download=`issue-register-${String(TODAY_ISO).replaceAll('-','')}-${rows.length}.xls`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 toast('ส่งออก Excel '+rows.length+' เคสตามตัวกรองแล้ว');
}
const issueAnalysis=RENDER.problems;
RENDER.problems=function(){
 if(ISSUE_WORK_VIEW==='analysis'){issueAnalysis();main.insertAdjacentHTML('afterbegin',issueWorkTabs());return;}
 const rows=issueRegisterRows(),pages=Math.max(1,Math.ceil(rows.length/50));ISSUE_WORK_PAGE=Math.max(1,Math.min(pages,ISSUE_WORK_PAGE));for(const id of [...ISSUE_SELECTED])if(!PROBLEMS.some(p=>p.id===id&&p.status!=='Resolved'))ISSUE_SELECTED.delete(id);
 const pageRows=rows.slice((ISSUE_WORK_PAGE-1)*50,ISSUE_WORK_PAGE*50),closablePage=pageRows.filter(issueCanClose),allPageSelected=closablePage.length&&closablePage.every(p=>ISSUE_SELECTED.has(p.id));
 const options=(values,selected)=>'<option value="">ทั้งหมด</option>'+values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join('');
 main.innerHTML=`${crumb('หน้าแรก','ทะเบียนปัญหาหน้างาน')}<div class="page-h"><div><h1>ทะเบียนปัญหาหน้างาน</h1><p>ลำดับคอลัมน์ตามชีต Issues เดิม · เปิดรหัสเคสเพื่อติดตาม แก้ไข และยืนยันการปิดเคส</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="tbtn" id="issue-work-export">${sic('i-export')} ส่งออก Excel</button><button class="tbtn primary" onclick="openNewIssue()">+ แจ้งปัญหาใหม่</button></div></div>${issueWorkTabs()}<div class="issue-work-filters">
 <label>วันที่เริ่ม<input class="fin" type="date" data-issue-date="from" value="${esc(ISSUE_WORK_FILTER.from)}"></label><label>ถึงวันที่<input class="fin" type="date" data-issue-date="to" value="${esc(ISSUE_WORK_FILTER.to)}"></label>
 <label>โปรเจกต์<select class="fin" data-issue-filter="project">${options([...new Set(PROBLEMS.map(p=>p.project))].sort(),PF.project)}</select></label>
 <label>สถานะ<select class="fin" data-issue-filter="status">${options(Object.keys(PROB_ST),PF.status)}</select></label>
 <label>ประเภท<select class="fin" data-issue-filter="cat">${options(ISSUE_CATEGORIES,PF.cat)}</select></label>
 <label>ความสำคัญ<select class="fin" data-issue-filter="prio">${options(Object.keys(PROB_PRIO),PF.prio)}</select></label>
 <label>ทีมย่อยผู้แจ้ง<select class="fin" id="issue-work-team">${options([...new Set(issueTeamProfiles().filter(p=>p.department_code==='ADMIN').map(p=>p.team_code).filter(Boolean))].sort(),ISSUE_WORK_FILTER.team)}</select></label><label>ทีมรับผิดชอบ<select class="fin" id="issue-work-owner">${options([...new Set(PROBLEMS.map(p=>p.owner).filter(Boolean))].sort(),ISSUE_WORK_FILTER.owner)}</select></label>
 <form id="issue-work-search"><label>ค้นหาปัญหา / ผู้แจ้ง / รหัส<input class="fin" name="query" value="${esc(PF.q)}"></label><button class="tbtn">ค้นหา</button></form><button class="tbtn" id="issue-work-clear">ล้างตัวกรอง</button></div>
 ${issueTeamSummaryHTML(probFiltered())}
 <p role="status">${rows.length} เคสตามตัวกรอง · ${rows.filter(p=>p.status!=='Resolved').length} เคสยังไม่ปิด · หน้า ${ISSUE_WORK_PAGE}/${pages}</p>
 <div class="issue-bulk-bar"><label><input type="checkbox" id="issue-select-page" ${allPageSelected?'checked':''} ${closablePage.length?'':'disabled'}> เลือกเคสที่ปิดได้ในหน้านี้</label><span>เลือกแล้ว <b>${ISSUE_SELECTED.size}</b> เคส</span><button class="tbtn primary" type="button" id="issue-bulk-open" ${ISSUE_SELECTED.size?'':'disabled'}>ใส่เหตุผลและปิดพร้อมกัน</button></div>
 <div class="issue-risk-legend"><span><i class="low"></i>ต่ำ: พนักงานเจ้าของเคส/ผู้รับผิดชอบ/ทีมเดียวกันปิดได้</span><span><i class="high"></i>กลาง–วิกฤต: หัวหน้าหรือผู้ช่วยหัวหน้าปิด</span></div>
 <div class="issue-register" tabindex="0" aria-label="ทะเบียนปัญหา เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"><table><thead><tr><th scope="col">เลือก</th>${ISSUE_REGISTER_COLUMNS.map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${pageRows.map(p=>`<tr><td><input type="checkbox" data-issue-select="${esc(p.id)}" ${ISSUE_SELECTED.has(p.id)?'checked':''} ${issueCanClose(p)?'':'disabled'} aria-label="เลือก ${esc(p.id)}"></td><td><button class="issue-case-link" data-open-issue="${esc(p.id)}">${esc(p.id)}</button></td><td>${esc(probDate(p.date))}</td><td>${esc(p.time)}</td><td>${esc(p.project)}</td><td>${esc(p.cat)}</td><td class="issue-text">${esc(p.problem)}</td><td>${probPrio(p.prio)}</td><td>${esc(p.reporter)}</td><td>${probStatus(p.status)}</td><td>${esc(p.owner||'ยังไม่ระบุ')}</td><td class="issue-text">${esc(p.solution||'ยังไม่มีวิธีแก้')}</td><td>${p.createdAt?esc(gpDateTime(p.createdAt)):'—'}</td><td>${p.updatedAt?esc(gpDateTime(p.updatedAt)):'—'}</td><td>${p.resolvedAt?esc(gpDateTime(p.resolvedAt)):'—'}</td><td>${p.resmin==null?'—':esc(p.resmin)}</td></tr>`).join('')||'<tr><td colspan="16">ไม่พบเคสตามตัวกรอง</td></tr>'}</tbody></table></div>
 <div class="entry-scope"><button class="tbtn" ${ISSUE_WORK_PAGE<=1?'disabled':''} onclick="ISSUE_WORK_PAGE--;RENDER.problems()">ก่อนหน้า</button><button class="tbtn" ${ISSUE_WORK_PAGE>=pages?'disabled':''} onclick="ISSUE_WORK_PAGE++;RENDER.problems()">ถัดไป</button></div>`;
 const refresh=()=>{ISSUE_WORK_PAGE=1;RENDER.problems();};
 document.getElementById('issue-work-export').onclick=downloadIssueExcel;
 main.querySelectorAll('[data-open-issue]').forEach(b=>b.onclick=()=>openProblem(b.dataset.openIssue));
 main.querySelectorAll('[data-issue-select]').forEach(b=>b.onchange=()=>issueSelectionChanged(b.dataset.issueSelect,b.checked));
 document.getElementById('issue-select-page').onchange=e=>issueSelectPage(e.target.checked);
 document.getElementById('issue-bulk-open').onclick=openBulkIssueClose;
 main.querySelectorAll('[data-issue-team-card]').forEach(b=>b.onclick=()=>{ISSUE_WORK_FILTER.team=ISSUE_WORK_FILTER.team===b.dataset.issueTeamCard?'':b.dataset.issueTeamCard;refresh();});
 main.querySelectorAll('[data-issue-filter]').forEach(s=>s.onchange=()=>{PF[s.dataset.issueFilter]=s.value;refresh();});
 main.querySelectorAll('[data-issue-date]').forEach(s=>s.onchange=()=>{ISSUE_WORK_FILTER[s.dataset.issueDate]=s.value;if(ISSUE_WORK_FILTER.from&&ISSUE_WORK_FILTER.to&&ISSUE_WORK_FILTER.from>ISSUE_WORK_FILTER.to){ISSUE_WORK_FILTER[s.dataset.issueDate==='from'?'to':'from']=s.value;}refresh();});
 document.getElementById('issue-work-team').onchange=e=>{ISSUE_WORK_FILTER.team=e.target.value;refresh();};
 document.getElementById('issue-work-owner').onchange=e=>{ISSUE_WORK_FILTER.owner=e.target.value;refresh();};
 document.getElementById('issue-work-search').onsubmit=e=>{e.preventDefault();PF.q=e.currentTarget.elements.query.value.trim();refresh();};
 document.getElementById('issue-work-clear').onclick=()=>{ISSUE_WORK_FILTER={from:'',to:'',owner:'',team:''};ISSUE_WORK_PAGE=1;clearPF();};
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
