/* Shared creation flow. Existing save functions remain the only database writers. */
(function(){
 if(window.COMPANY_ENTRY_WIZARD)return;window.COMPANY_ENTRY_WIZARD=true;
 const titles=['ข้อมูลงาน','ผู้รับผิดชอบและเวลา','รายละเอียดเพิ่มเติม','ตรวจทานก่อนบันทึก'];
 const field=(id,label,input)=>`<div class="field"><label for="${id}">${label}</label>${input}</div>`;
 function wizard(kind,groups,save,required=[]){
  const root=document.getElementById('modal'),body=root.querySelector(':scope > .pad');if(!body||root.querySelector('.entry-wizard'))return;
  root.querySelector('.ux-form-guide')?.remove();
  const controls=()=>[...body.querySelectorAll('input[id],select[id],textarea[id]')].filter(x=>!x.closest('#pickerBox'));
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
  function errors(){
   const out={};for(const id of required){const el=document.getElementById(id);if(el&&!el.disabled&&!el.value.trim())out[id]='กรุณากรอกช่องนี้';}
   for(const el of controls()){if(el.disabled||el.type==='checkbox'||!el.value)continue;if(!el.validity.valid)out[el.id]=el.validationMessage||'กรุณาตรวจรูปแบบข้อมูล';}
   if(kind==='activity'){const v={};for(const el of controls())v[el.id.replace('entry-','')]=el.type==='checkbox'?el.checked:el.value;Object.assign(out,Object.fromEntries(Object.entries(entryValidate(v)).map(([k,v])=>['entry-'+k,v])));}
   if(kind==='task'&&!PICK.size)out.pickerBox='กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน';
   return out;
  }
  function validate(index){
   const entries=Object.entries(errors()).filter(([id])=>index==null||panels[index].contains(document.getElementById(id)));
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
    const dl=document.createElement('dl');for(const el of controls().filter(x=>p.contains(x))){if(el.closest('[hidden]')?.classList.contains('field')&&!el.value)continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=el.labels?.[0]?.textContent||el.closest('.field')?.querySelector('label')?.textContent||el.id;dd.textContent=el.tagName==='SELECT'?(el.selectedOptions[0]?.textContent||'ยังไม่ระบุ'):el.type==='checkbox'?(el.checked?'ใช่':'ไม่ใช่'):(el.value||'ยังไม่ระบุ');dl.append(dt,dd);}
    if(kind==='task'&&i===1){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent='ผู้รับผิดชอบ';dd.textContent=[...PICK].map(shortName).join(', ');dl.append(dt,dd);}card.append(dl);review.append(card);
   });
  }
  function show(index,clear=true){step=index;panels.forEach((p,i)=>p.hidden=i!==step);review.hidden=step!==3;primary.hidden=step!==3;next.hidden=step===3;back.hidden=step===0;if(clear)error.hidden=true;buttons.forEach((b,i)=>{b.disabled=saving||i>step;b.setAttribute('aria-current',i===step?'step':'false');});status.textContent=`ขั้นตอน ${step+1} จาก 4 · ${titles[step]}`;if(step===3)summary();body.scrollTop=0;}
  back.onclick=()=>show(step-1);next.onclick=()=>{if(validate(step))show(step+1);};
  draft.onclick=()=>{try{const values=Object.fromEntries(controls().map(el=>[el.id,el.type==='checkbox'?el.checked:el.value]));sessionStorage.setItem(key,JSON.stringify({values,pick:kind==='task'?[...PICK]:[],savedAt:Date.now()}));toast('เก็บฉบับร่างในเบราว์เซอร์นี้แล้ว ยังไม่ส่งเข้าระบบ');}catch{error.hidden=false;error.textContent='เก็บฉบับร่างไม่ได้ กรุณาคงหน้าต่างนี้ไว้';}};
  let stored;try{stored=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
  if(stored){const resume=document.createElement('button');resume.type='button';resume.className='tbtn wizard-resume';resume.textContent='กรอกต่อจากฉบับร่างในเบราว์เซอร์นี้';resume.onclick=()=>{for(const el of controls()){if(el.disabled||!(el.id in stored.values))continue;if(el.type==='checkbox')el.checked=!!stored.values[el.id];else if(el.tagName!=='SELECT'||[...el.options].some(o=>o.value===stored.values[el.id]))el.value=stored.values[el.id];el.dispatchEvent(new Event('change',{bubbles:true}));}if(kind==='task'){PICK=new Set((stored.pick||[]).filter(id=>ASSIGNABLE.includes(id)));renderPicker();}resume.remove();show(0);};body.prepend(resume);}
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
  const dept=manageable.includes(currentDept())?currentDept():manageable[0];PICK=new Set();
  showModal(`<div class="modal-h"><div><h3>เพิ่มงานใหม่</h3><p class="muted">กรอกทีละส่วน แล้วตรวจทานก่อนส่งให้ผู้รับผิดชอบ</p></div><button class="x" onclick="closeModal()">×</button></div><div class="pad"><div data-task-step="0">${field('f_title','ชื่องาน *','<input class="fin" id="f_title" maxlength="300">')}${field('f_dept','แผนก *',`<select class="fin" id="f_dept">${DEPTS.filter(d=>manageable.includes(d.code)).map(d=>`<option value="${esc(d.code)}" ${d.code===dept?'selected':''}>${esc(d.name)}</option>`).join('')}</select>`)}</div><div data-task-step="1">${field('f_due','กำหนดส่ง *','<input class="fin" type="date" id="f_due">')}${field('f_prio','ความสำคัญ',`<select class="fin" id="f_prio">${Object.keys(PRIO).map(k=>`<option value="${k}" ${k==='mid'?'selected':''}>${esc(PRIO[k].t)}</option>`).join('')}</select>`)}${field('f_sla_n','ระยะเวลาดำเนินการ *','<input class="fin" type="number" min="1" id="f_sla_n" value="1">')}${field('f_sla_u','หน่วยเวลา','<select class="fin" id="f_sla_u"><option value="day">วัน</option><option value="hr">ชั่วโมง</option></select>')}<div class="field"><label>ผู้รับผิดชอบ *</label><div id="pickerBox"></div></div></div><div data-task-step="2">${field('f_desc','รายละเอียดงาน','<textarea class="fin" id="f_desc" rows="5"></textarea>')}<p class="muted">เพิ่มหลักฐานและแท็ก KPI จากรายละเอียดงานหลังสร้างรายการ</p></div><button id="wizard-task-save" class="tbtn primary">สร้างงาน</button></div>`);
  renderPicker();wizard('task',node=>Number(node.dataset.taskStep||0),()=>submitCompose(),['f_title','f_dept','f_due']);
 };
})();
