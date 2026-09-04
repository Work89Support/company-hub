/* Native input and actionable completeness queues, after activity-module.js. */
let ENTRY_PEOPLE=[],ENTRY_SCOPE='mine',ENTRY_NOTICE_USER='';
const ENTRY_STATUS={'In Progress':'กำลังทำ','Completed':'เสร็จแล้ว','Blocked':'ติดปัญหา'};
NAV.completeness={ic:'i-warning',t:'ข้อมูลที่ต้องเติม'};
NAVGROUPS[0].items.push('completeness');
for(const r of Object.keys(ROLE_ALLOW)){ROLE_ALLOW[r].push('completeness');SIMPLE_ALLOW[r].push('completeness');}
function entryCanEdit(r){return !!ACCESS_PROFILE&&(r.employee_id===ACCESS_PROFILE.id||canManageActivity(r));}
function entryState(r){return /Completed|เสร็จ/i.test(r.status||'')?'Completed':/block|ติด|ปัญหา/i.test(r.status||'')?'Blocked':/progress|doing|กำลัง/i.test(r.status||'')?'In Progress':'';}
function entryMissing(r){
 const m=[],s=entryState(r);
 if(!r.employee_id)m.push('บัญชีเจ้าของรายการ');
 if(!String(r.activity||'').trim())m.push('รายละเอียดกิจกรรม');
 if(!String(r.category||'').trim())m.push('ประเภทงาน');
 if(!r.activity_date)m.push('วันที่ทำงาน');
 if(!s)m.push('สถานะ');
 if(!r.start_time)m.push('เวลาเริ่ม');
 if(s==='Completed'){
  if(!r.end_time)m.push('เวลาจบ');if(!r.completed_date)m.push('วันที่เสร็จ');if(!String(r.result_note||'').trim())m.push('ผลลัพธ์');
 }
 if(s==='Blocked'&&!String(r.operational_issue||'').trim())m.push('ปัญหาที่ติดขัด');
 if(['suspicious','overnight','excluded_all_day'].includes(r.time_flag))m.push('ยืนยันช่วงเวลาทำงาน');
 if(activityQualityFlags(r).some(f=>['corrected_date','unexpected_year'].includes(f)))m.push('ยืนยันวันที่');
 return [...new Set(m)];
}
function entryValidate(v){
 const e={};
 for(const [key,label] of Object.entries({department_code:'แผนก',employee_id:'เจ้าของรายการ',activity_date:'วันที่ทำงาน',activity:'รายละเอียดกิจกรรม',category:'ประเภทงาน',start_time:'เวลาเริ่ม',status:'สถานะ'}))if(!String(v[key]||'').trim())e[key]='กรุณาระบุ'+label;
 if(v.status&&!ENTRY_STATUS[v.status])e.status='กรุณาเลือกสถานะ';
 if(v.activity_date&&v.activity_date>bangkokTodayISO())e.activity_date='วันที่ทำงานต้องไม่เป็นอนาคต';
 if(v.status==='Completed')for(const [k,label] of Object.entries({end_time:'เวลาจบ',completed_date:'วันที่เสร็จ',result_note:'ผลลัพธ์'}))if(!String(v[k]||'').trim())e[k]='งานเสร็จต้องระบุ'+label;
 if(v.status==='Blocked'&&!String(v.operational_issue||'').trim())e.operational_issue='กรุณาบอกปัญหาที่ทำให้งานติดขัด';
 if(v.completed_date&&(v.completed_date<v.activity_date||v.completed_date>bangkokTodayISO()||(v.overnight&&v.completed_date===v.activity_date)))e.completed_date='วันที่เสร็จต้องอยู่ระหว่างวันที่ทำงานและวันนี้';
 const time=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'');
 if(v.start_time&&!time(v.start_time))e.start_time='เวลาเริ่มไม่ถูกต้อง';
 if(v.end_time&&!time(v.end_time))e.end_time='เวลาจบไม่ถูกต้อง';
 if(time(v.start_time)&&time(v.end_time)){
  const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  const n=minutes(v.end_time)-minutes(v.start_time)+(v.overnight?1440:0);
  if(n<=0||n>960)e.end_time='ช่วงเวลาต้องมากกว่า 0 และไม่เกิน 16 ชั่วโมง ตรวจเวลาหรือเลือกข้ามวัน';
 }
 return e;
}
function entryErrors(errors,prefix='entry-'){
 document.querySelectorAll('[data-entry-error]').forEach(x=>x.remove());
 document.querySelectorAll('[aria-invalid="true"]').forEach(x=>{x.removeAttribute('aria-invalid');x.removeAttribute('aria-describedby');});
 for(const [k,msg] of Object.entries(errors)){
  const el=document.getElementById(prefix+k);if(!el)continue;
  el.setAttribute('aria-invalid','true');const error=document.createElement('div');error.dataset.entryError='true';error.className='entry-error';error.id=prefix+k+'-error';error.textContent=msg;el.setAttribute('aria-describedby',error.id);el.after(error);
 }
 const box=document.getElementById('entry-errors');if(box){box.textContent=Object.values(errors).join(' · ');box.hidden=!Object.keys(errors).length;}
 document.getElementById(prefix+Object.keys(errors)[0])?.focus();
 return Object.keys(errors).length>0;
}
function entryField(key,label,value='',type='text',max=4000){return `<div class="field"><label for="entry-${key}">${label}</label>${type==='textarea'?`<textarea class="fin" id="entry-${key}" rows="3" maxlength="${max}">${esc(value)}</textarea>`:`<input class="fin" id="entry-${key}" type="${type}" maxlength="${max}" value="${esc(value)}">`}</div>`;}
async function openActivityEntry(id){
 const r=id?ACTIVITY_ROWS.find(x=>String(x.id)===String(id)):null;
 if(!ACCESS_PROFILE||(id&&(!r||!entryCanEdit(r))))return;
 const people=await SB.rpc('activity_entry_people');if(people.error){toast('เปิดแบบฟอร์มไม่ได้ · '+people.error.message,'info');return;}ENTRY_PEOPLE=people.data||[];
 const department=r?.department_code||currentDept(),state=r?entryState(r):'In Progress';
 const departments=DEPTS.filter(d=>d.code===department||(!r&&(canAdminAccess()||MANAGE_DEPTS.includes(d.code))));
 const pending=r?entryMissing(r):[];
 showModal(`<div class="modal-h"><div><h3>${r?'เติมข้อมูล / แก้ไขกิจกรรม':'บันทึกกิจกรรมใหม่'}</h3><div class="muted">${r?'รายการ #'+esc(r.id):'เจ้าของรายการผูกกับบัญชีผู้ใช้'} · ${AUTH_DB_ROLE==='staff'?'แก้ไขได้เฉพาะของคุณ':'จัดการตามสิทธิ์แผนก'}</div></div><button class="x" onclick="closeModal()">×</button></div><form class="pad" id="native-activity-form"><div id="entry-errors" class="entry-error-summary" role="alert" hidden></div>${pending.length?`<div class="ai-note"><b>ข้อมูลที่ต้องเติม:</b> ${pending.map(esc).join(' · ')}</div>`:''}<h4>1 · เจ้าของและรายละเอียดงาน</h4><div class="two"><div class="field"><label for="entry-department_code">แผนก *</label><select id="entry-department_code" class="fin" ${r?'disabled':''} onchange="entryOwnerOptions()">${departments.map(d=>`<option value="${esc(d.code)}" ${d.code===department?'selected':''}>${esc(d.name)}</option>`).join('')}</select></div><div class="field"><label for="entry-employee_id">บัญชีเจ้าของรายการ *</label><select class="fin" id="entry-employee_id"></select>${r&&!r.employee_id?`<small>ชื่อเดิม: ${esc(r.employee_name||'ไม่ระบุ')} — ให้หัวหน้าจับคู่บัญชีจริง</small>`:''}</div></div>${entryField('activity_date','วันที่ทำงาน *',r?.activity_date||bangkokTodayISO(),'date')}${entryField('activity','รายละเอียดกิจกรรม *',r?.activity||'','textarea')}${entryField('category','ประเภทงาน *',r?.category||'','text',200)}${entryField('worksite','เว็บ / สถานที่ / โครงการ (ถ้ามี)',r?.worksite||'','text',500)}<h4>2 · เวลาและความคืบหน้า</h4><div class="two">${entryField('start_time','เวลาเริ่ม *',(r?.start_time||'').slice(0,5),'time')}${entryField('end_time','เวลาจบ (บังคับเมื่องานเสร็จ)',(r?.end_time||'').slice(0,5),'time')}</div><label><input type="checkbox" id="entry-overnight" ${r?.end_time&&r.end_time<r.start_time?'checked':''}> เวลาจบเป็นวันถัดไป</label><div class="field"><label for="entry-status">สถานะ *</label><select class="fin" id="entry-status"><option value="">เลือกสถานะ</option>${Object.entries(ENTRY_STATUS).map(([k,v])=>`<option value="${k}" ${state===k?'selected':''}>${v}</option>`).join('')}</select></div><h4>3 · ผลลัพธ์และปัญหา</h4>${entryField('completed_date','วันที่เสร็จ (บังคับเมื่องานเสร็จ)',r?.completed_date||'','date')}${entryField('result_note','ผลลัพธ์ / หลักฐานการทำงาน (บังคับเมื่องานเสร็จ)',r?.result_note||'','textarea')}${entryField('operational_issue','ปัญหาที่ติดขัด (บังคับเมื่อเลือกติดปัญหา)',r?.operational_issue||'','textarea')}<button class="tbtn primary" id="entry-save" type="submit">ตรวจข้อมูลและบันทึก</button></form>`);
 entryOwnerOptions(r?.employee_id||(!r?ACCESS_PROFILE.id:''));
 if(r&&canManageActivity(r)){const b=document.createElement('button');b.type='button';b.className='tbtn';b.textContent='มอบหมายให้เจ้าของเติมข้อมูล';b.onclick=async()=>{const owner=val('entry-employee_id');if(!owner){entryErrors({employee_id:'เลือกบัญชีที่จะให้เติมข้อมูลก่อน'});return;}b.disabled=true;try{const result=await SB.rpc('assign_activity_owner',{p_id:r.id,p_expected_revision:r.entry_revision,p_owner:owner});if(result.error)throw result.error;closeModal();await loadActivities();if(VIEW==='completeness')RENDER.completeness();toast('มอบหมายแล้ว เจ้าของจะเห็นรายการที่ต้องเติมเมื่อเปิดระบบ');}catch(e){b.disabled=false;const box=document.getElementById('entry-errors');box.hidden=false;box.textContent=e.message;}};document.getElementById('entry-employee_id').after(b);}

 const requestId=crypto.randomUUID();document.getElementById('native-activity-form').onsubmit=async ev=>{ev.preventDefault();await saveActivityEntry(r,requestId);};
}
function entryOwnerOptions(selected=''){
 const dept=val('entry-department_code'),select=document.getElementById('entry-employee_id');
 const manager=canAdminAccess()||MANAGE_DEPTS.includes(dept);
 select.innerHTML='<option value="">เลือกบัญชีเจ้าของรายการ</option>'+ENTRY_PEOPLE.filter(p=>p.department_code===dept&&(manager||p.id===ACCESS_PROFILE.id)).map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.display_name)}</option>`).join('');
 if(!manager){select.value=ACCESS_PROFILE.id;select.disabled=true;}
}
async function saveActivityEntry(row,requestId){
 const v={request_id:requestId};for(const k of ['department_code','employee_id','activity_date','activity','category','start_time','end_time','status','completed_date','result_note','worksite','operational_issue'])v[k]=val('entry-'+k).trim();v.overnight=!!document.getElementById('entry-overnight').checked;
 if(entryErrors(entryValidate(v)))return;
 const btn=document.getElementById('entry-save');btn.disabled=true;
 try{const r=await SB.rpc('save_activity_entry',{p_id:row?.id||null,p_expected_revision:row?.entry_revision??null,p_entry:v});if(r.error)throw r.error;closeModal();await loadActivities();if(VIEW==='completeness')RENDER.completeness();else if(VIEW==='activity')RENDER.activity();toast('บันทึกข้อมูลครบแล้ว');}
 catch(e){btn.disabled=false;const b=document.getElementById('entry-errors');b.hidden=false;b.textContent=e.message||'บันทึกไม่สำเร็จ กรุณาลองใหม่';}
}
function issueEntryMissing(p){const m=[];if(!p.problem?.trim())m.push('รายละเอียดปัญหา');if(!p.impact?.trim())m.push('สรุปผลกระทบ');if(!p.impactScope||p.impactScope==='unknown')m.push('ขอบเขตผลกระทบ');if(!p.owner?.trim())m.push('ทีมรับผิดชอบ');if(p.status==='Resolved'){if(!p.solution?.trim())m.push('วิธีแก้');if(p.resmin==null)m.push('ระยะเวลาแก้ไข');if(!p.verified)m.push('หัวหน้ายืนยันผล');}return m;}
function issueEntryCanEdit(p){return canAdminAccess()||(AUTH_DB_ROLE==='lead'&&MANAGE_DEPTS.includes(p.dept))||p.createdBy===ACCESS_PROFILE?.id;}
function entryQueue(){return {activities:ACTIVITY_ROWS.filter(r=>entryCanEdit(r)&&entryMissing(r).length&&(ENTRY_SCOPE!=='mine'||r.employee_id===ACCESS_PROFILE?.id)),issues:PROBLEMS.filter(p=>issueEntryCanEdit(p)&&issueEntryMissing(p).length&&(ENTRY_SCOPE!=='mine'||p.createdBy===ACCESS_PROFILE?.id))};}
RENDER.completeness=function(){
 const q=entryQueue();main.innerHTML=`${crumb('หน้าแรก','ข้อมูลที่ต้องเติม')}<div class="page-h"><div><h1>ข้อมูลที่ต้องเติม</h1><p>เติมข้อมูลที่ขาดก่อนส่งงานเสร็จ ข้อมูลของทีมแสดงเฉพาะขอบเขตที่คุณจัดการได้</p></div><button class="tbtn primary" onclick="openActivityEntry()">+ บันทึกกิจกรรม</button></div><div class="entry-scope"><button class="tbtn ${ENTRY_SCOPE==='mine'?'primary':''}" onclick="ENTRY_SCOPE='mine';RENDER.completeness()">ของฉัน</button>${AUTH_DB_ROLE!=='staff'?`<button class="tbtn ${ENTRY_SCOPE==='team'?'primary':''}" onclick="ENTRY_SCOPE='team';RENDER.completeness()">ทีมที่ฉันจัดการ</button>`:''}</div><div class="ai-note">กิจกรรม ${nf(q.activities.length)} รายการ · ปัญหา ${nf(q.issues.length)} เคส${q.activities.some(r=>!r.employee_id)?'<br>รายการเก่าที่ยังไม่ผูกบัญชี: หัวหน้าต้องเลือกเจ้าของจริงก่อนพนักงานจะเห็นและเติมข้อมูลได้':''}</div><h3>กิจกรรม — เจ้าของ / เวลา / ผลลัพธ์</h3><div class="entry-list">${q.activities.slice(0,100).map(r=>`<div class="card pad"><b>${esc(r.employee_name||'ยังไม่ระบุเจ้าของ')} · ${activityDateLabel(r.activity_date)}</b><p>${esc(r.activity)}</p><div class="entry-error">ขาด: ${entryMissing(r).map(esc).join(' · ')}</div><button class="tbtn" onclick="openActivityEntry('${r.id}')">เติมข้อมูล</button></div>`).join('')||'<p>ไม่มีข้อมูลกิจกรรมที่ต้องเติมในขอบเขตนี้</p>'}</div>${q.activities.length>100?'<p>แสดง 100 รายการแรก เมื่อเติมแล้วรายการถัดไปจะเลื่อนขึ้นมา</p>':''}<h3>ปัญหา — ข้อมูลรับแจ้ง / ผลกระทบ / การปิดเคส</h3><div class="entry-list">${q.issues.slice(0,100).map(p=>`<div class="card pad"><b>${esc(p.id)} · ${esc(p.project)}</b><p>${esc(p.problem)}</p><div class="entry-error">ขาด: ${issueEntryMissing(p).map(esc).join(' · ')}</div><button class="tbtn" onclick="openIssueEntry('${esc(p.id)}')">เติมข้อมูลรับแจ้ง</button><button class="tbtn" onclick="openProblem('${esc(p.id)}')">ติดตาม / ยืนยันผล</button></div>`).join('')||'<p>ไม่มีข้อมูลปัญหาที่ต้องเติมในขอบเขตนี้</p>'}</div>`;
};
function entryNotice(){
 if(!ACCESS_PROFILE||!ACTIVITY_READY)return;
 const previous=ENTRY_SCOPE;ENTRY_SCOPE=AUTH_DB_ROLE==='staff'?'mine':'team';const q=entryQueue();ENTRY_SCOPE=previous;
 const total=q.activities.length+q.issues.length;NAV.completeness.t='ข้อมูลที่ต้องเติม'+(total?' ('+total+')':'');buildNav();
 if(total&&ENTRY_NOTICE_USER!==ACCESS_PROFILE.id){ENTRY_NOTICE_USER=ACCESS_PROFILE.id;showModal(`<div class="modal-h"><h3>มีข้อมูลที่ต้องเติม ${nf(total)} รายการ</h3></div><div class="pad"><p>กิจกรรม ${nf(q.activities.length)} รายการ และปัญหา ${nf(q.issues.length)} เคส ยังมีข้อมูลไม่ครบ กรุณาตรวจและเติมในส่วนที่คุณรับผิดชอบ</p><button class="tbtn primary" onclick="closeModal();ENTRY_SCOPE=AUTH_DB_ROLE==='staff'?'mine':'team';go('completeness')">เปิดรายการที่ต้องเติม</button><button class="tbtn" onclick="closeModal()">รับทราบ — ติดตามต่อที่เมนูข้อมูลที่ต้องเติม</button></div>`);}
}
const entryLoadActivities=loadActivities;
loadActivities=async function(){await entryLoadActivities();entryNotice();};
async function openIssueEntry(id){
 const p=PROBLEMS.find(x=>x.id===id);if(!p||!issueEntryCanEdit(p))return;
 showModal(`<div class="modal-h"><div><h3>เติมรายละเอียดรับแจ้ง</h3><p>${esc(p.id)} · ${esc(p.reporter)}</p></div><button class="x" onclick="closeModal()">×</button></div><form class="pad" id="issue-entry-form"><div id="entry-errors" role="alert" class="entry-error-summary" hidden></div><div class="ai-note">ข้อมูลรับแจ้งแก้ได้โดยผู้แจ้งหรือหัวหน้าที่ดูแล การปิดเคสและยืนยันวิธีแก้เป็นสิทธิ์หัวหน้า</div>${entryField('problem','รายละเอียดปัญหา *',p.problem,'textarea')}<div class="field"><label for="entry-impact_scope">ขอบเขตผลกระทบ *</label><select id="entry-impact_scope" class="fin">${Object.entries(ISSUE_IMPACT_SCOPES).map(([k,v])=>`<option value="${k}" ${p.impactScope===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div>${entryField('impact_summary','สรุปผลกระทบ *',p.impact,'textarea',2000)}${entryField('service_name','ระบบ / บริการ (ถ้ามี)',p.service,'text',200)}${entryField('provider_name','ผู้ให้บริการ (ถ้ามี)',p.provider,'text',200)}${entryField('workaround','การรับมือเบื้องต้น (ถ้ามี)',p.workaround,'textarea')}${entryField('evidence_url','ลิงก์หลักฐาน (ถ้ามี)',p.evidenceUrl,'url',2000)}<button class="tbtn primary" id="entry-save" type="submit">ตรวจข้อมูลและบันทึก</button></form>`);
 document.getElementById('issue-entry-form').onsubmit=async ev=>{
  ev.preventDefault();const data={};for(const k of ['problem','impact_scope','impact_summary','service_name','provider_name','workaround','evidence_url'])data[k]=val('entry-'+k).trim();
  const errors={};if(!data.problem)errors.problem='กรุณาระบุรายละเอียดปัญหา';if(!data.impact_summary)errors.impact_summary='กรุณาสรุปผลกระทบ';if(!data.impact_scope||data.impact_scope==='unknown')errors.impact_scope='กรุณาเลือกขอบเขตผลกระทบ';if(data.evidence_url&&!/^https?:\/\//i.test(data.evidence_url))errors.evidence_url='ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://';
  if(entryErrors(errors))return;const btn=document.getElementById('entry-save');btn.disabled=true;
  try{const res=await SB.rpc('save_issue_intake_details',{p_id:p.id,p_expected_updated_at:p.updatedAt,p_details:data});if(res.error)throw res.error;closeModal();await cloudLoadIssues();entryNotice();if(VIEW==='completeness')RENDER.completeness();else if(VIEW==='problems')RENDER.problems();toast('เติมข้อมูลรับแจ้งแล้ว');}catch(e){btn.disabled=false;const box=document.getElementById('entry-errors');box.hidden=false;box.textContent=e.message;}
 };
}
const entryOpenProblem=openProblem;
openProblem=function(id){entryOpenProblem(id);const p=PROBLEMS.find(x=>x.id===id);if(!p)return;const canManage=canAdminAccess()||(AUTH_DB_ROLE==='lead'&&MANAGE_DEPTS.includes(p.dept));if(!canManage)for(const field of ['issueReferenceId','issueSolution','issuePreventive','issueResolutionMinutes','issueVerified']){const el=document.getElementById(field);if(el)el.disabled=true;}
 if(issueEntryCanEdit(p)){const save=document.getElementById('issueStatus')?.closest('.pad');if(save){const b=document.createElement('button');b.type='button';b.className='tbtn';b.textContent='เติม / แก้ไขรายละเอียดรับแจ้ง';b.onclick=()=>openIssueEntry(id);save.prepend(b);}}
};
const entrySaveIssueFollowup=saveIssueFollowup;
saveIssueFollowup=async function(id){const errors={};if(!val('issueOwner').trim())errors.Owner='กรุณาระบุทีมรับผิดชอบ';if(val('issueStatus')==='Resolved'){const p=PROBLEMS.find(x=>x.id===id);if(p&&(!p.impact?.trim()||p.impactScope==='unknown')){toast('กรุณาเติมรายละเอียดรับแจ้งและผลกระทบก่อนปิดเคส','info');openIssueEntry(id);return;}if(!val('issueResolutionMinutes')||!Number.isFinite(Number(val('issueResolutionMinutes')))||Number(val('issueResolutionMinutes'))<0)errors.ResolutionMinutes='กรุณาระบุเวลาแก้เป็นนาที (0 ได้)';if(['','unresolved'].includes(val('issueSolutionType')))errors.SolutionType='กรุณาระบุประเภทวิธีแก้';}if(entryErrors(errors,'issue'))return;await entrySaveIssueFollowup(id);await cloudLoadIssues();entryNotice();};
const entrySaveNewIssue=saveNewIssue;
saveNewIssue=async function(){const errors={};for(const [k,label] of Object.entries({Date:'วันที่',Time:'เวลา',Project:'โปรเจกต์',Category:'ประเภทปัญหา',Problem:'รายละเอียดปัญหา',Impact:'สรุปผลกระทบ'}))if(!val('newIssue'+k).trim())errors[k]='กรุณาระบุ'+label;if(val('newIssueImpactScope')==='unknown')errors.ImpactScope='กรุณาเลือกขอบเขตผลกระทบ';for(const k of ['Customers','Transactions','Financial']){const raw=val('newIssue'+k);if(raw!==''&&(!Number.isFinite(Number(raw))||Number(raw)<0||(k!=='Financial'&&!Number.isInteger(Number(raw)))))errors[k]='กรุณาระบุจำนวนที่ถูกต้องตั้งแต่ 0 ขึ้นไป';}if(entryErrors(errors,'newIssue'))return;await entrySaveNewIssue();};
