/* Links use database IDs and source RLS. Tagging evidence never awards a score. */
const KPI_WORK_COLUMNS={activity:'activity_id',task:'task_id',graphic:'graphic_job_id',issue:'issue_id'};
async function openWorkKpis(kind,id,department){
 if(!SB||!KPI_WORK_COLUMNS[kind])return;
 try{
  const [defs,links]=await Promise.all([
   SB.from('kpi_definitions').select('id,name,target,weight,formula,source,prototype_payload').eq('department_code',department).eq('active',true).order('name'),
   SB.from('kpi_work_links').select('definition_id').eq(KPI_WORK_COLUMNS[kind],id)
  ]);
  if(defs.error)throw defs.error;if(links.error)throw links.error;
  const expected=(links.data||[]).map(x=>x.definition_id),definitions=defs.data||[];
  showModal(`<div class="modal-h"><h3>แท็ก KPI · ${esc(deptName(department))}</h3><button class="x" onclick="closeModal()">×</button></div><form class="pad" id="work-kpi-form"><p>เลือกตัวชี้วัดที่งานนี้เป็นหลักฐานประกอบ การแท็กไม่เพิ่มคะแนนหรืออนุมัติผล KPI อัตโนมัติ</p><div id="work-kpi-error" role="alert" class="entry-error"></div>${definitions.length?definitions.map(d=>`<label class="card pad" style="display:block;margin-bottom:8px"><input type="checkbox" name="work-kpi" value="${esc(d.id)}" ${expected.includes(d.id)?'checked':''}> ${esc(d.name)}<small style="display:block">เป้าหมาย ${esc(kpiTargetDisplay(d))} · ${esc(d.source)}</small>${kpiDefinitionDetails(d)}</label>`).join(''):'<p>ยังไม่มีตัวชี้วัดที่เปิดใช้งานของแผนกนี้ ให้หัวหน้าตรวจและเพิ่มตัวชี้วัดก่อน</p>'}<button class="tbtn primary" id="work-kpi-save" ${definitions.length?'':'disabled'}>บันทึกแท็ก KPI</button></form>`);
  document.getElementById('work-kpi-form').onsubmit=async event=>{
   event.preventDefault();const button=document.getElementById('work-kpi-save');button.disabled=true;
   const selected=[...document.querySelectorAll('input[name="work-kpi"]:checked')].map(x=>x.value);
   try{
    const saved=await SB.rpc('save_work_kpi_tags',{p_kind:kind,p_id:String(id),p_expected:expected,p_definitions:selected});if(saved.error)throw saved.error;
    const check=await SB.from('kpi_work_links').select('definition_id').eq(KPI_WORK_COLUMNS[kind],id);if(check.error)throw check.error;
    if(JSON.stringify((check.data||[]).map(x=>x.definition_id).sort())!==JSON.stringify(selected.sort()))throw new Error('ข้อมูลแท็กเปลี่ยนระหว่างบันทึก กรุณาเปิดรายการตรวจอีกครั้ง');
    closeModal();toast('บันทึกและตรวจสอบแท็ก KPI แล้ว');if(VIEW==='kpi')RENDER.kpi();
   }catch(e){document.getElementById('work-kpi-error').textContent=e.message;button.disabled=false;}
  };
 }catch(e){toast('เปิดแท็ก KPI ไม่สำเร็จ · '+e.message,'info');}
}
function workKpiButton(kind,id,department){
 const host=document.querySelector('.modal-h');if(!host||host.querySelector('[data-work-kpi]'))return;
 const button=document.createElement('button');button.type='button';button.className='tbtn';button.dataset.workKpi='true';button.textContent='แท็ก KPI';button.onclick=()=>{if(document.getElementById('native-activity-form')){toast('บันทึกกิจกรรมก่อน แล้วระบบจะเปิดหน้าแท็ก KPI ให้','info');return;}openWorkKpis(kind,id,department);};host.append(button);
}
function kpiAddActivityCandidate(rows,seen,r){
 if(!r?.id||!r.department_code||seen.has(`activity:${r.id}`))return;
 seen.add(`activity:${r.id}`);
 rows.push({kind:'activity',id:r.id,department:r.department_code,title:r.activity||'กิจกรรม',meta:`กิจกรรม · ${r.activity_date||'-'} · ${r.employee_name||'-'}`,date:r.updated_at||r.activity_date||''});
}
async function kpiEvidenceCandidates(){
 const rows=[];
 const seen=new Set();
 if(typeof ACTIVITY_ROWS!=='undefined')for(const r of ACTIVITY_ROWS){if(typeof entryCanEdit==='function'&&entryCanEdit(r))kpiAddActivityCandidate(rows,seen,r);}
 // The shared activity loader is capped and can omit the signed-in person's older work.
 // Always fetch that person's activities explicitly so "My work" can be used as KPI evidence.
 if(SB&&ACCESS_PROFILE?.id){
  const own=await SB.from('daily_activities').select('id,department_code,activity,activity_date,employee_name,updated_at').eq('employee_id',ACCESS_PROFILE.id).order('activity_date',{ascending:false}).limit(300);
  if(own.error)throw own.error;
  for(const r of own.data||[])kpiAddActivityCandidate(rows,seen,r);
 }
 if(typeof TASKS!=='undefined')for(const t of TASKS){if(t?.dbId&&t.dept&&(typeof canManageTaskUi!=='function'||canManageTaskUi(t)||isMyTaskAssignee(t)))rows.push({kind:'task',id:t.dbId,department:t.dept,title:t.title||'งาน',meta:`งานมอบหมาย · ${t.due||'ยังไม่ระบุกำหนด'}`,date:t.updatedAt||t.dueAt||t.due||''});}
 if(typeof GRAPHIC_JOBS!=='undefined')for(const j of GRAPHIC_JOBS){if(j?.id&&j.department_code&&(j.assignee_id===ACCESS_PROFILE?.id||j.created_by===ACCESS_PROFILE?.id||canManageGraphic()))rows.push({kind:'graphic',id:j.id,department:j.department_code,title:j.title||j.job_no||'งานกราฟิก',meta:`Graphic · ${j.job_no||'-'} · ${j.status||'-'}`,date:j.updated_at||j.created_at||''});}
 if(typeof PROBLEMS!=='undefined')for(const p of PROBLEMS){if(p?.id&&p.dept&&typeof issueEntryCanEdit==='function'&&issueEntryCanEdit(p))rows.push({kind:'issue',id:p.id,department:p.dept,title:p.problem||p.id,meta:`ปัญหา · ${p.project||'-'} · ${p.status||'-'}`,date:p.updatedAt||p.date||''});}
 return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,300);
}
async function openKpiEvidencePicker(){
 let candidates=[];
 try{candidates=await kpiEvidenceCandidates();}catch(error){toast('โหลดงานสำหรับหลักฐาน KPI ไม่สำเร็จ · '+error.message,'info');return;}
 const departments=[...new Set(candidates.map(row=>row.department))].sort((a,b)=>deptName(a).localeCompare(deptName(b),'th'));
 showModal(`<div class="modal-h"><div><h3>เพิ่มหลักฐาน KPI จากงานจริง</h3><p class="muted">เลือกกิจกรรม งาน กราฟิก หรือปัญหาที่คุณรับผิดชอบ แล้วผูกกับตัวชี้วัดของแผนก</p></div><button class="x" onclick="closeModal()">×</button></div><div class="pad"><div class="two"><label class="field"><span>ค้นหา</span><input class="fin" id="kpi-evidence-query" placeholder="ชื่องาน ผู้รับผิดชอบ หรือรหัส"></label><label class="field"><span>แผนก</span><select class="fin" id="kpi-evidence-dept"><option value="">ทุกแผนกที่มีสิทธิ์</option>${departments.map(code=>`<option value="${esc(code)}">${esc(deptName(code))}</option>`).join('')}</select></label></div><p class="muted">การผูกงานเป็นหลักฐานประกอบเท่านั้น ยังไม่เพิ่มคะแนนจนกว่าหัวหน้าจะตรวจและรับรองผล</p><div id="kpi-evidence-list"></div></div>`);
 const render=()=>{
  const query=(document.getElementById('kpi-evidence-query')?.value||'').trim().toLowerCase(),department=document.getElementById('kpi-evidence-dept')?.value||'';
  const visible=candidates.filter(row=>(!department||row.department===department)&&(!query||`${row.title} ${row.meta} ${row.id}`.toLowerCase().includes(query))).slice(0,100),host=document.getElementById('kpi-evidence-list');
  host.innerHTML=visible.map((row,index)=>`<article class="card pad" style="margin:10px 0"><div style="display:flex;justify-content:space-between;gap:14px;align-items:center"><div><b>${esc(row.title)}</b><small style="display:block;color:var(--muted);margin-top:5px">${esc(deptName(row.department))} · ${esc(row.meta)}</small></div><button class="tbtn primary sm" data-kpi-candidate="${index}">เลือกเป็นหลักฐาน</button></div></article>`).join('')||'<div class="ai-note">ไม่พบงานที่คุณมีสิทธิ์ผูกเป็นหลักฐาน กรุณาบันทึกงานหรือกิจกรรมก่อน</div>';
  host.querySelectorAll('[data-kpi-candidate]').forEach(button=>button.onclick=()=>{const row=visible[Number(button.dataset.kpiCandidate)];closeModal();openWorkKpis(row.kind,row.id,row.department);});
 };
 document.getElementById('kpi-evidence-query').oninput=render;document.getElementById('kpi-evidence-dept').onchange=render;render();
}
const kpiOpenActivity=openActivityEntry;
openActivityEntry=async function(id){await kpiOpenActivity(id);const r=ACTIVITY_ROWS.find(x=>String(x.id)===String(id));if(r&&entryCanEdit(r))workKpiButton('activity',r.id,r.department_code);};
const kpiOpenTask=openTask;
openTask=function(id){kpiOpenTask(id);const t=TASKS.find(x=>x.id===id);if(t?.dbId&&(canManageTaskUi(t)||isMyTaskAssignee(t)))workKpiButton('task',t.dbId,t.dept);};
const kpiOpenGraphic=openGraphicJob;
openGraphicJob=async function(id){await kpiOpenGraphic(id);const j=GRAPHIC_JOBS.find(x=>x.id===id);if(j&&(j.assignee_id===ACCESS_PROFILE?.id||j.created_by===ACCESS_PROFILE?.id||canManageGraphic()))workKpiButton('graphic',j.id,j.department_code);};
const kpiOpenIssue=openProblem;
openProblem=function(id){kpiOpenIssue(id);const p=PROBLEMS.find(x=>x.id===id);if(p&&issueEntryCanEdit(p))workKpiButton('issue',p.id,p.dept);};
RENDER.kpi=function(){
 main.innerHTML=`${crumb('หน้าแรก','KPI')}<div class="page-h"><div><h1>KPI และหลักฐานงาน</h1><p>ผูกกิจกรรม งาน กราฟิก หรือปัญหากับ KPI แล้วส่งให้หัวหน้าตรวจและรับรองผล</p></div><button class="tbtn primary" id="kpi-add-evidence">+ เพิ่มหลักฐาน KPI</button></div>`;
 document.getElementById('kpi-add-evidence').onclick=openKpiEvidencePicker;
 for(const [code,definitions] of Object.entries(typeof KPI_CATALOG==='undefined'?KPI:KPI_CATALOG)){
  const group=document.createElement('section');group.className='card pad';
  group.innerHTML=`<h3>${esc(deptName(code))}</h3>`+definitions.map(d=>`<p><b>${esc(d.n)}</b><br>เป้า ${esc(d.tg)} · น้ำหนัก ${esc(Math.round(d.w*100))}% · ${d.period==='ยังไม่มีผลจริง'?'ยังไม่มีผลจริง — ยังไม่คำนวณคะแนน':`Actual ${esc(acDisp(d))} · ${esc(d.period)} · สถานะ ${esc(d.status)}`}${kpiDefinitionDetails({formula:d.formula,prototype_payload:d.metadata})}</p>`).join('');main.append(group);
 }
 const missing=DEPTS.filter(d=>canViewDept(d.code)&&!(KPI_CATALOG[d.code]?.length));
 if(missing.length){const notice=document.createElement('section');notice.className='card pad';notice.innerHTML='<h3>แผนกที่ต้องเติมเกณฑ์ KPI</h3><p>'+missing.map(d=>esc(d.name)).join(' · ')+'</p><p>หัวหน้าต้องระบุชื่อตัวชี้วัด สูตร เป้าหมาย น้ำหนัก รอบประเมิน และหลักฐาน ก่อนเริ่มวัดผล ไม่ถือเป็นคะแนนศูนย์</p>';main.append(notice);}
 const box=document.createElement('section');box.className='card pad';box.id='kpi-work-report';box.innerHTML='<h3>งานที่แท็ก KPI</h3><p>กำลังอ่านหลักฐานตามสิทธิ์ของคุณ…</p>';main.prepend(box);
 loadWorkKpiReport(box);
};
async function loadWorkKpiReport(box){
 try{
  const links=await sbAllRows('kpi_work_links','id');if(links.error)throw links.error;
  const rows=links.data||[],definitions=Object.values(typeof KPI_CATALOG==='undefined'?KPI:KPI_CATALOG).flat();
  if(!box.isConnected)return;
  box.innerHTML='<h3>งานที่แท็ก KPI</h3><p>จำนวนหลักฐานที่คุณมีสิทธิ์เห็นทั้งหมด แยกจากคะแนนและผลจริงที่หัวหน้ารับรอง</p>'+definitions.map(d=>{
   const evidence=rows.filter(x=>x.definition_id===d.id);
   return `<details><summary>${esc(d.n)} · ${evidence.length} งาน</summary>${evidence.map(x=>`<div>${x.activity_id?'กิจกรรม #'+esc(x.activity_id):x.task_id?'งาน '+esc(x.task_id):x.graphic_job_id?'กราฟิก '+esc(x.graphic_job_id):'ปัญหา '+esc(x.issue_id)}</div>`).join('')||'<p>ยังไม่มีงานที่แท็ก</p>'}</details>`;
  }).join('');
 }catch(e){box.textContent='อ่านหลักฐาน KPI ไม่สำเร็จ · '+e.message;}
}

function kpiTargetDisplay(d){return d.prototype_payload?.unit==='ratio'?`${Math.round(Number(d.target)*10000)/100}%`:String(d.target??'');}
function kpiDefinitionDetails(d){
 const m=d.prototype_payload||{},mapping=m.mapping||{};
 return `<div style="font-size:12px;margin:8px 0;line-height:1.7">${m.category?`<div><b>กลุ่ม:</b> ${esc(m.category)}</div>`:''}${m.sop_reference?`<div><b>SOP:</b> ${esc(m.sop_reference)}</div>`:''}${m.achievement_cap?`<div><b>คะแนน:</b> Actual ÷ Target × น้ำหนัก × 100 · Achievement สูงสุด ${Number(m.achievement_cap)*100}%</div>`:''}${m.assessment_rule?`<div><b>หลักการรับรอง:</b> ${esc(m.assessment_rule)}</div>`:''}${d.formula?`<div><b>สูตร:</b> ${esc(d.formula)}</div>`:''}${mapping.required_fields?`<div><b>ข้อมูลที่ต้องกรอก/แนบ:</b> ${esc(mapping.required_fields)}</div>`:''}${mapping.gap?`<div><b>ก่อนรับรองผล:</b> ${esc(mapping.gap)}</div>`:''}${m.unit==='ratio'?'<div>เก็บผลเป็นสัดส่วน เช่น 18/20 = 90% · หากไม่มีรายการในรอบ ให้หัวหน้าตรวจว่าไม่เกี่ยวข้องหรือข้อมูลขาด ห้ามแทนด้วย 0 หรือ 100%</div>':''}</div>`;
}
