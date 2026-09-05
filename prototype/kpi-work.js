/* Links use database IDs and source RLS. Tagging evidence never awards a score. */
const KPI_WORK_COLUMNS={activity:'activity_id',task:'task_id',graphic:'graphic_job_id',issue:'issue_id'};
async function openWorkKpis(kind,id,department){
 if(!SB||!KPI_WORK_COLUMNS[kind])return;
 try{
  const [defs,links]=await Promise.all([
   SB.from('kpi_definitions').select('id,name,target,source').eq('department_code',department).eq('active',true).order('name'),
   SB.from('kpi_work_links').select('definition_id').eq(KPI_WORK_COLUMNS[kind],id)
  ]);
  if(defs.error)throw defs.error;if(links.error)throw links.error;
  const expected=(links.data||[]).map(x=>x.definition_id),definitions=defs.data||[];
  showModal(`<div class="modal-h"><h3>แท็ก KPI · ${esc(deptName(department))}</h3><button class="x" onclick="closeModal()">×</button></div><form class="pad" id="work-kpi-form"><p>เลือกตัวชี้วัดที่งานนี้เป็นหลักฐานประกอบ การแท็กไม่เพิ่มคะแนนหรืออนุมัติผล KPI อัตโนมัติ</p><div id="work-kpi-error" role="alert" class="entry-error"></div>${definitions.length?definitions.map(d=>`<label class="card pad" style="display:block;margin-bottom:8px"><input type="checkbox" name="work-kpi" value="${esc(d.id)}" ${expected.includes(d.id)?'checked':''}> ${esc(d.name)}<small style="display:block">เป้าหมาย ${esc(d.target)} · ${esc(d.source)}</small></label>`).join(''):'<p>ยังไม่มีตัวชี้วัดที่เปิดใช้งานของแผนกนี้ ให้หัวหน้าตรวจและเพิ่มตัวชี้วัดก่อน</p>'}<button class="tbtn primary" id="work-kpi-save" ${definitions.length?'':'disabled'}>บันทึกแท็ก KPI</button></form>`);
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
const kpiOpenActivity=openActivityEntry;
openActivityEntry=async function(id){await kpiOpenActivity(id);const r=ACTIVITY_ROWS.find(x=>String(x.id)===String(id));if(r&&entryCanEdit(r))workKpiButton('activity',r.id,r.department_code);};
const kpiOpenTask=openTask;
openTask=function(id){kpiOpenTask(id);const t=TASKS.find(x=>x.id===id);if(t?.dbId&&(canManageTaskUi(t)||isMyTaskAssignee(t)))workKpiButton('task',t.dbId,t.dept);};
const kpiOpenGraphic=openGraphicJob;
openGraphicJob=async function(id){await kpiOpenGraphic(id);const j=GRAPHIC_JOBS.find(x=>x.id===id);if(j&&(j.assignee_id===ACCESS_PROFILE?.id||j.created_by===ACCESS_PROFILE?.id||canManageGraphic()))workKpiButton('graphic',j.id,j.department_code);};
const kpiOpenIssue=openProblem;
openProblem=function(id){kpiOpenIssue(id);const p=PROBLEMS.find(x=>x.id===id);if(p&&issueEntryCanEdit(p))workKpiButton('issue',p.id,p.dept);};
RENDER.kpi=function(){
 main.innerHTML=`${crumb('หน้าแรก','KPI')}<div class="page-h"><div><h1>KPI และหลักฐานงาน</h1><p>แท็กจากหน้ารายละเอียดกิจกรรม งาน กราฟิก หรือปัญหา แล้วตรวจหลักฐานที่บันทึกจริงด้านล่าง</p></div></div>`;
 for(const [code,definitions] of Object.entries(KPI)){
  const group=document.createElement('section');group.className='card pad';
  group.innerHTML=`<h3>${esc(deptName(code))}</h3>`+definitions.map(d=>`<p><b>${esc(d.n)}</b><br>เป้า ${esc(d.tg)} · น้ำหนัก ${esc(d.w)} · ${d.period==='ยังไม่มีผลจริง'?'ยังไม่มีผลจริง — ยังไม่คำนวณคะแนน':`Actual ${esc(d.ac)} · ${esc(d.period)} · สถานะ ${esc(d.status)}`}</p>`).join('');main.append(group);
 }
 const box=document.createElement('section');box.className='card pad';box.id='kpi-work-report';box.innerHTML='<h3>งานที่แท็ก KPI</h3><p>กำลังอ่านหลักฐานตามสิทธิ์ของคุณ…</p>';main.prepend(box);
 loadWorkKpiReport(box);
};
async function loadWorkKpiReport(box){
 try{
  const links=await sbAllRows('kpi_work_links','id');if(links.error)throw links.error;
  const rows=links.data||[],definitions=Object.values(KPI).flat();
  if(!box.isConnected)return;
  box.innerHTML='<h3>งานที่แท็ก KPI</h3><p>จำนวนหลักฐานที่คุณมีสิทธิ์เห็นทั้งหมด แยกจากคะแนนและผลจริงที่หัวหน้ารับรอง</p>'+definitions.map(d=>{
   const evidence=rows.filter(x=>x.definition_id===d.id);
   return `<details><summary>${esc(d.n)} · ${evidence.length} งาน</summary>${evidence.map(x=>`<div>${x.activity_id?'กิจกรรม #'+esc(x.activity_id):x.task_id?'งาน '+esc(x.task_id):x.graphic_job_id?'กราฟิก '+esc(x.graphic_job_id):'ปัญหา '+esc(x.issue_id)}</div>`).join('')||'<p>ยังไม่มีงานที่แท็ก</p>'}</details>`;
  }).join('');
 }catch(e){box.textContent='อ่านหลักฐาน KPI ไม่สำเร็จ · '+e.message;}
}
