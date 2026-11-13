/* Shared creation flow. Existing save functions remain the only database writers. */
(function(){
 if(window.COMPANY_ENTRY_WIZARD)return;window.COMPANY_ENTRY_WIZARD=true;
 const titles=['ข้อมูลงาน','ผู้รับผิดชอบและเวลา','รายละเอียดเพิ่มเติม','ตรวจทานก่อนบันทึก'];
 const field=(id,label,input)=>`<div class="field"><label for="${id}">${label}</label>${input}</div>`;
 function taskSelectedDepartments(){const boxes=[...document.querySelectorAll('[data-task-department]')];return boxes.length?boxes.filter(box=>box.checked).map(box=>box.value):[val('f_dept')].filter(Boolean);}
 function taskDepartmentField(manageable,selected,multiple){
  if(!multiple)return field('f_dept','แผนก *',`<select class="fin" id="f_dept" onchange="PICK_MULTI_DEPTS=[this.value];setAssigneeDepartment(this.value)">${DEPTS.filter(d=>manageable.includes(d.code)).map(d=>`<option value="${esc(d.code)}" ${d.code===selected?'selected':''}>${esc(d.name)}</option>`).join('')}</select>`);
  return `<div class="field"><label id="f_dept_label">แผนก * <span class="muted">เลือกได้หลายแผนก</span></label><input type="hidden" id="f_dept" value="${esc(selected)}"><div id="f_dept_multi" class="task-department-grid" role="group" aria-labelledby="f_dept_label">${DEPTS.filter(d=>manageable.includes(d.code)).map(d=>`<label class="task-department-option"><input type="checkbox" data-task-department value="${esc(d.code)}" ${d.code===selected?'checked':''} onchange="syncTaskDepartments()"><span>${esc(d.name)}</span></label>`).join('')}</div><small class="muted">ระบบจะแยกงานให้แต่ละแผนกภายใต้ชุดคำสั่งเดียวกัน เพื่อให้สิทธิ์และรายงานของแต่ละทีมถูกต้อง</small></div>`;
 }
 function syncTaskDepartments(){
  const departments=taskSelectedDepartments(),hidden=document.getElementById('f_dept');if(hidden)hidden.value=departments[0]||'';
  PICK_MULTI_DEPTS=departments;if(PICK_DEPT&&!departments.includes(PICK_DEPT))PICK_DEPT='';
  PICK=new Set([...PICK].filter(assigneeInDepartmentScope));renderPicker();
 }
 window.syncTaskDepartments=syncTaskDepartments;
 function taskAssigneesForDepartment(department){return [...PICK].filter(id=>assigneeDepartments(id).includes(department));}
 async function submitTaskWizard(){
  const departments=taskSelectedDepartments();if(departments.length<=1)return submitCompose();
  const title=normSp(val('f_title'));if(!title)throw new Error('กรุณาระบุหัวข้องาน');
  const missing=departments.filter(department=>!taskAssigneesForDepartment(department).length);if(missing.length)throw new Error('กรุณาเลือกผู้รับผิดชอบของแผนก '+missing.map(deptName).join(', '));
  const due=val('f_due')||addFrom(TODAY_ISO,5),sla={n:Math.max(1,parseInt(val('f_sla_n'))||1),unit:val('f_sla_u')||'day'},batchId=`CEO-${Date.now()}-${String(ACCESS_PROFILE?.id||'').slice(0,8)}`,created=[];
  try{for(const department of departments){created.push(await createTask({title,dept:department,assignees:taskAssigneesForDepartment(department),prio:val('f_prio'),due,sla,desc:val('f_desc'),tags:['งานใหม่','หลายแผนก'],batchId,departments}));}}
  catch(error){if(!created.length)throw error;closeModal();F.dept='';go('board');toast(`สร้างได้ ${created.length} จาก ${departments.length} แผนก · ${error.message||error}`,'info');return;}
  closeModal();F.dept='';go('board');toast(`สร้างงานชุดเดียวกัน ${created.length} แผนก · ส่ง ${fmtDate(due)}`);
 }
 function wizard(kind,groups,save,required=[]){
  const root=document.getElementById('modal'),body=root.querySelector(':scope > .pad');if(!body||root.querySelector('.entry-wizard'))return;
  root.querySelector('.ux-form-guide')?.remove();
  const controls=()=>[...body.querySelectorAll('input[id],select[id],textarea[id]')].filter(x=>!x.closest('#pickerBox')&&!(kind==='task'&&x.type==='hidden'));
  const primary=body.querySelector('#entry-save,#gbSave,#newIssueSaveBtn,#wizard-task-save');if(!primary)return;
  const footer=body.querySelector('.ux-modal-actions')||document.createElement('div');footer.className='ux-modal-actions wizard-actions';
  primary.type='button';primary.removeAttribute('onclick');primary.onclick=null;primary.textContent='ยืนยันและบันทึก';
  const cancel=footer.querySelector('.ux-modal-cancel');if(cancel)cancel.remove();
  const nav=document.createElement('nav');nav.className='entry-wizard';nav.setAttribute('aria-label','ขั้นตอนเพิ่มงาน');
  const status=document.createElement('p');status.className='wizard-status';status.setAttribute('aria-live','polite');
  root.querySelector('.modal-h').after(nav);nav.after(status);
  const panels=titles.slice(0,3).map((title,i)=>{const section=document.createElement('section');section.className='wizard-panel';section.dataset.step=i;const h=document.createElement('h4');h.textContent=`${i+1} · ${title}`;section.append(h);return section;});
  for(const node of [...body.children]){if(node===footer||node===primary)continue;let index=groups(node);if(index===null)continue;panels[index??0].append(node);}
  panels.forEach(p=>body.append(p));const review=document.createElement('section');review.className='wizard-review';body.append(review);
  const error=document.createElement('p');error.className='entry-error-summary';error.setAttribute('role','alert');error.hidden=true;body.prepend(error);
  const back=document.createElement('button'),next=document.createElement('button'),draft=document.createElement('button');
  for(const b of [back,next,draft]){b.type='button';b.className='tbtn';}
  back.textContent='ย้อนกลับ';next.textContent='ถัดไป';next.classList.add('primary');draft.textContent='เก็บฉบับร่าง';
  footer.replaceChildren(primary,back,draft,next);body.append(footer);
  body.querySelectorAll('button').forEach(b=>b.type='button');if(body.tagName==='FORM')body.noValidate=true;
  let step=0,saving=false;const key='company-entry-draft-v1:'+ACCESS_PROFILE?.id+':'+kind;
  const buttons=titles.map((title,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`${i+1}. ${title}`;b.onclick=()=>{if(i<step&&!saving)show(i);};nav.append(b);return b;});
  function errors(index=null){
   const out={};for(const id of required){const el=document.getElementById(id);if(el&&!el.disabled&&!el.value.trim())out[id]='กรุณากรอกช่องนี้';}
   for(const el of controls()){if(el.disabled||el.type==='checkbox'||!el.value)continue;if(!el.validity.valid)out[el.id]=el.validationMessage||'กรุณาตรวจรูปแบบข้อมูล';}
   if(kind==='activity'){const v={};for(const el of controls())v[el.id.replace('entry-','')]=el.type==='checkbox'?el.checked:el.value;const activityErrors=entryValidate(v);if(index===0){delete activityErrors.start_time;delete activityErrors.end_time;delete activityErrors.status;}if(index===1){for(const key of ['activity','category'])delete activityErrors[key];}Object.assign(out,Object.fromEntries(Object.entries(activityErrors).map(([k,v])=>['entry-'+k,v])));}
   if(kind==='issue'){const scope=document.getElementById('newIssueImpactScope');if(scope&&(!scope.value||scope.value==='unknown'))out.newIssueImpactScope='กรุณาเลือกขอบเขตผลกระทบ';}
   if(kind==='task'){
    const departments=taskSelectedDepartments();if(!departments.length)out.f_dept='กรุณาเลือกอย่างน้อย 1 แผนก';
    const missing=departments.filter(department=>!taskAssigneesForDepartment(department).length);if(!PICK.size)out.pickerBox='กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน';else if(missing.length)out.pickerBox='กรุณาเลือกผู้รับผิดชอบของแผนก '+missing.map(deptName).join(', ');
   }
   return out;
  }
  function validate(index){
   const entries=Object.entries(errors(index)).filter(([id])=>index==null||panels[index].contains(document.getElementById(id))||(kind==='activity'&&['entry-start_time','entry-end_time'].includes(id)&&panels[index].querySelector('#entry-work-sessions')));
   controls().forEach(el=>el.removeAttribute('aria-invalid'));error.hidden=!entries.length;
   if(!entries.length)return true;
   error.textContent=entries.map(([id,msg])=>{const el=document.getElementById(id);el?.setAttribute('aria-invalid','true');const label=el?.closest('.field')?.querySelector('label')?.textContent||'';return label+' — '+msg;}).join(' · ');
   const target=document.getElementById(entries[0][0]),owner=panels.findIndex(p=>p.contains(target));if(owner>=0&&owner!==step)show(owner,false);
   for(let parent=target?.parentElement;parent&&parent!==body;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
   target?.focus();return false;
  }
  function summary(){
   review.replaceChildren();const h=document.createElement('h4');h.textContent='ตรวจข้อมูลอีกครั้ง ก่อนยืนยันสร้างรายการ';review.append(h);
   panels.forEach((p,i)=>{const card=document.createElement('article');card.className='wizard-review-card';const title=document.createElement('h4');title.textContent=titles[i];const edit=document.createElement('button');edit.type='button';edit.className='tbtn';edit.textContent='แก้ไขส่วนนี้';edit.onclick=()=>show(i);card.append(title,edit);
    const dl=document.createElement('dl');if(kind==='task'&&i===0&&document.querySelector('[data-task-department]')){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='แผนก';dd.textContent=taskSelectedDepartments().map(deptName).join(', ')||'ยังไม่ระบุ';dl.append(dt,dd);}for(const el of controls().filter(x=>p.contains(x))){if(el.closest('[hidden]')?.classList.contains('field')&&!el.value)continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=el.labels?.[0]?.textContent||el.closest('.field')?.querySelector('label')?.textContent||el.id;dd.textContent=el.tagName==='SELECT'?(el.selectedOptions[0]?.textContent||'ยังไม่ระบุ'):el.type==='checkbox'?(el.checked?'ใช่':'ไม่ใช่'):(el.value||'ยังไม่ระบุ');dl.append(dt,dd);}
    if(kind==='task'&&i===1){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='ผู้รับผิดชอบ';dd.textContent=[...PICK].map(shortName).join(', ');dl.append(dt,dd);}card.append(dl);review.append(card);
   });
  }
  function show(index,clear=true){step=index;panels.forEach((p,i)=>p.hidden=i!==step);review.hidden=step!==3;primary.hidden=step!==3;next.hidden=step===3;back.hidden=step===0;if(clear)error.hidden=true;buttons.forEach((b,i)=>{b.disabled=saving||i>step;b.setAttribute('aria-current',i===step?'step':'false');});status.textContent=`ขั้นตอน ${step+1} จาก 4 · ${titles[step]}`;if(step===3)summary();body.scrollTop=0;}
  back.onclick=()=>show(step-1);next.onclick=()=>{if(validate(step))show(step+1);};
  draft.onclick=()=>{try{const values=Object.fromEntries(controls().map(el=>[el.id,el.type==='checkbox'?el.checked:el.value]));sessionStorage.setItem(key,JSON.stringify({values,pick:kind==='task'?[...PICK]:[],departments:kind==='task'?taskSelectedDepartments():[],savedAt:Date.now()}));toast('เก็บฉบับร่างในเบราว์เซอร์นี้แล้ว ยังไม่ส่งเข้าระบบ');}catch{error.hidden=false;error.textContent='เก็บฉบับร่างไม่ได้ กรุณาคงหน้าต่างนี้ไว้';}};
  let stored;try{stored=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
  if(stored){const resume=document.createElement('button');resume.type='button';resume.className='tbtn wizard-resume';resume.textContent='กรอกต่อจากฉบับร่างในเบราว์เซอร์นี้';resume.onclick=()=>{for(const el of controls()){if(el.disabled||!(el.id in stored.values))continue;if(el.type==='checkbox')el.checked=!!stored.values[el.id];else if(el.tagName!=='SELECT'||[...el.options].some(o=>o.value===stored.values[el.id]))el.value=stored.values[el.id];el.dispatchEvent(new Event('change',{bubbles:true}));}if(kind==='task'){const departments=stored.departments||[];if(departments.length)document.querySelectorAll('[data-task-department]').forEach(box=>box.checked=departments.includes(box.value));PICK_MULTI_DEPTS=taskSelectedDepartments();PICK=new Set((stored.pick||[]).filter(id=>ASSIGNABLE.includes(id)&&assigneeInDepartmentScope(id)));syncTaskDepartments();}resume.remove();show(0);};body.prepend(resume);}
  primary.onclick=async()=>{if(saving||!validate(null))return;saving=true;[primary,back,next,draft,...buttons].forEach(b=>b.disabled=true);primary.textContent='กำลังบันทึก…';try{await save();if(!body.isConnected||!overlay.classList.contains('show'))sessionStorage.removeItem(key);}catch(e){error.hidden=false;error.textContent=e.message||'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';}finally{saving=false;if(body.isConnected){[primary,back,next,draft].forEach(b=>b.disabled=false);primary.textContent='ยืนยันและบันทึก';show(step,false);}}};
  body.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();if(!saving){if(step<3)next.click();else primary.click();}},true);
  body.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'&&e.target.type!=='checkbox'){e.preventDefault();if(step<3)next.click();}},true);
  window.companyUxEnhanceModal();root.querySelector('.ux-form-guide')?.remove();show(0);
 }
 const activity=openActivityEntry;openActivityEntry=async function(id){await activity(...arguments);if(id!=null)return;const f=document.getElementById('native-activity-form');if(!f)return;const pair=f.querySelector('#entry-department_code').closest('.two');pair.replaceWith(...pair.children);let index=0;wizard('activity',node=>{if(node.tagName==='H4'){index=Math.min(2,Number(node.textContent.match(/\d+/)?.[0]||1)-1);node.hidden=true;}if(node.querySelector('#entry-employee_id,#entry-activity_date'))return 1;return index;},()=>f.onsubmit({preventDefault(){}}));};
 const graphic=openGraphicBrief;openGraphicBrief=function(){graphic(...arguments);wizard('graphic',node=>node.querySelector('#gbRequester,#gbAssignee,#gbDue')?1:node.querySelector('#gbDim,#gbChannel,#gbChecks')?2:0,()=>createGraphicJob(),['gbTitle','gbBrief','gbDue']);};
 const issue=openNewIssue;openNewIssue=function(){issue(...arguments);wizard('issue',node=>node.querySelector('#newIssueDate,#newIssueOwner,#newIssuePriority')?1:node.tagName==='DETAILS'?2:0,()=>saveNewIssue(),['newIssueDate','newIssueTime','newIssueProject','newIssueCategory','newIssueProblem','newIssueImpact','newIssueOwner']);};
 openCompose=function(){
  const manageable=canAdminAccess()?visibleDepartmentCodes():MANAGE_DEPTS;if(CLOUD&&!manageable.length){toast('ไม่มีสิทธิ์สร้างงานในแผนก','info');return;}
  const dept=manageable.includes(currentDept())?currentDept():manageable[0],multiple=AUTH_DB_ROLE==='exec'&&manageable.length>1;PICK=new Set();PICK_QUERY='';PICK_DEPT=multiple?'':dept;PICK_POSITION='';PICK_MULTI_DEPTS=[dept];
  showModal(`<div class="modal-h"><div><h3>เพิ่มงานใหม่</h3><p class="muted">กรอกทีละส่วน แล้วตรวจทานก่อนส่งให้ผู้รับผิดชอบ</p></div><button class="x" onclick="closeModal()">×</button></div><div class="pad"><div data-task-step="0">${field('f_title','ชื่องาน *','<input class="fin" id="f_title" maxlength="300">')}${taskDepartmentField(manageable,dept,multiple)}</div><div data-task-step="1">${field('f_due','กำหนดส่ง *','<input class="fin" type="date" id="f_due">')}${field('f_prio','ความสำคัญ',`<select class="fin" id="f_prio">${Object.keys(PRIO).map(k=>`<option value="${k}" ${k==='mid'?'selected':''}>${esc(PRIO[k].t)}</option>`).join('')}</select>`)}${field('f_sla_n','ระยะเวลาดำเนินการ *','<input class="fin" type="number" min="1" id="f_sla_n" value="1">')}${field('f_sla_u','หน่วยเวลา','<select class="fin" id="f_sla_u"><option value="day">วัน</option><option value="hr">ชั่วโมง</option></select>')}<div class="field"><label>ผู้รับผิดชอบ *</label><div id="pickerBox"></div></div></div><div data-task-step="2">${field('f_desc','รายละเอียดงาน','<textarea class="fin" id="f_desc" rows="5"></textarea>')}<p class="muted">เพิ่มหลักฐานและแท็ก KPI จากรายละเอียดงานหลังสร้างรายการ</p></div><button id="wizard-task-save" class="tbtn primary">สร้างงาน</button></div>`);
  renderPicker();wizard('task',node=>Number(node.dataset.taskStep||0),()=>submitTaskWizard(),['f_title','f_dept','f_due']);
 };
})();
