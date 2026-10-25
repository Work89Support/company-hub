/* Graphic Production usability: personal board, account-backed owners, brief images and editable delivery links. */
(function(){
  const FILE_LABEL={reference:'ภาพอ้างอิง / บรีฟ',final:'ไฟล์ Final'};
  const originalOpenGraphicJob=openGraphicJob;
  const originalOpenGraphicBrief=openGraphicBrief;

  GF.scope=GF.scope||'';
  GF.profileId=GF.profileId||'';
  function gpProfile(id){return GRAPHIC_PEOPLE.find(p=>p.id===id)||{};}
  function gpProfileName(id){const p=gpProfile(id);return p.display_name||p.email||'';}
  function gpAssigneeSearchText(profile){
    return [profile.display_name,profile.email,profile.position_title,profile.department_code,deptName(profile.department_code)].filter(Boolean).join(' ').normalize('NFKC').toLowerCase();
  }
  function gpAssigneeOptions(selected=''){
    return `<option value="">ยังไม่มอบหมาย</option>${GRAPHIC_PEOPLE.map(p=>{const name=p.display_name||p.email;return `<option value="${p.id}" data-name="${esc(name)}" data-assignee-search="${esc(gpAssigneeSearchText(p))}" ${selected===p.id?'selected':''}>${esc(name)}${p.email&&p.email!==name?` · ${esc(p.email)}`:''}</option>`;}).join('')}`;
  }
  function gpAssigneeControl(selectId,selected='',change=''){
    return `<div class="gp-assignee-search"><label for="${selectId}Search">ค้นหาชื่อผู้รับผิดชอบ</label><small id="${selectId}SearchResult">ทั้งหมด ${GRAPHIC_PEOPLE.length} คน</small><input class="fin" type="search" id="${selectId}Search" placeholder="พิมพ์ชื่อหรืออีเมล" autocomplete="off" oninput="gpFilterAssigneeSelect('${selectId}',this.value)"></div><select class="fin" id="${selectId}" ${change?`onchange="${change}"`:''}>${gpAssigneeOptions(selected)}</select>`;
  }
  window.gpFilterAssigneeSelect=function(selectId,query=''){
    const select=document.getElementById(selectId);if(!select)return;const q=String(query||'').normalize('NFKC').toLowerCase().trim();let visible=0;
    [...select.options].forEach(option=>{if(!option.value)return;const show=!q||String(option.dataset.assigneeSearch||'').includes(q);option.hidden=!show;if(show)visible++;});
    const result=document.getElementById(selectId+'SearchResult');if(result)result.textContent=q?`พบ ${visible} คน`:`ทั้งหมด ${visible} คน`;
  };
  function gpNormalizePerson(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^\p{L}\p{N}]+/gu,'');}
  function gpJobAssignedToProfile(job,id){if(!id)return false;if(job.assignee_id===id)return true;return gpJobMemberRows(job.id).some(m=>(m.profile_id||m.linked_profile_id)===id);}
  const jobFreshness=typeof gpFreshness==='function'?gpFreshness:function(job){if(job.status==='done')return'history';const updated=Date.parse(job.trello_last_activity_at||job.updated_at||job.created_at||'');return Number.isFinite(updated)&&Date.now()-updated>30*86400000?'stale':'current';};
  function gpScope(){
    const id=ACCESS_PROFILE?.id||'';
    if(GF.profileId!==id){GF.profileId=id;GF.scope='';GF.person='';GF.project='';}
    if(GF.scope)return GF.scope;
    return AUTH_DB_ROLE==='staff'&&currentDept()==='GRAPHIC'?'mine':'all';
  }
  gpJobPeople=function(job){
    const memberNames=gpJobMemberRows(job.id).map(m=>gpProfileName(m.profile_id||m.linked_profile_id)||m.full_name||m.username),direct=gpProfileName(job.assignee_id);
    const names=[direct,job.assignee_name,...memberNames].flatMap(x=>String(x||'').split(',')).map(x=>x.trim()).filter(Boolean);
    return [...new Set(names)];
  };
  gpMatchesGlobal=function(job){
    if(gpScope()==='mine'&&!gpJobAssignedToProfile(job,ACCESS_PROFILE?.id))return false;
    const people=gpJobPeople(job);
    if(GF.freshness&&jobFreshness(job)!==GF.freshness)return false;
    if(GF.person==='__UNASSIGNED__'&&people.length)return false;
    if(GF.person&&GF.person!=='__UNASSIGNED__'&&!people.includes(GF.person))return false;
    let start=Date.parse(gpJobStartAt(job)),end=Date.parse(gpJobEndAt(job));
    if(!Number.isFinite(start)&&Number.isFinite(end))start=end;if(!Number.isFinite(end)&&Number.isFinite(start))end=start;
    if(Number.isFinite(start)&&Number.isFinite(end)&&start>end)[start,end]=[end,start];
    if(GF.dateFrom&&Number.isFinite(end)&&end<new Date(GF.dateFrom+'T00:00:00').getTime())return false;
    if(GF.dateTo&&Number.isFinite(start)&&start>new Date(GF.dateTo+'T23:59:59.999').getTime())return false;
    return true;
  };
  gpGlobalVisible=function(){return GRAPHIC_JOBS.filter(gpMatchesGlobal);};
  gpVisible=function(){const q=GF.q.toLowerCase();return gpGlobalVisible().filter(j=>(!GF.project||j.project_id===GF.project)&&(!GF.status||j.status===GF.status)&&(!q||[j.title,j.brief,j.requester_name,j.assignee_name,gpProject(j.project_id).name].join(' ').toLowerCase().includes(q)));};
  window.gpSetScope=function(scope){GF.scope=scope;GF.person='';GF.project='';GF.status='';GF.q='';GP_VISIBLE_LIMITS={};RENDER.graphic();};
  gpFilterBar=function(){
    const range=gpDataRange(),people=gpPersonOptions(),scope=gpGlobalVisible(),mode=gpScope(),counts={current:0,stale:0,history:0};
    GRAPHIC_JOBS.forEach(job=>counts[jobFreshness(job)]++);
    const activeFilters=[GF.freshness&&GF.freshness!=='current',GF.dateFrom,GF.dateTo,GF.person].filter(Boolean).length;
    return `<div class="gp-board-controls"><div class="gp-scope-switch" role="group" aria-label="ขอบเขตงาน"><button class="${mode==='mine'?'active':''}" onclick="gpSetScope('mine')">งานของฉัน</button><button class="${mode==='all'?'active':''}" onclick="gpSetScope('all')">งานทั้งหมดในทีม</button></div><details class="gp-filter-drawer"><summary>ตัวกรอง${activeFilters?` <span>${activeFilters}</span>`:''}</summary><div class="gp-global-filter"><div class="field"><label>ชุดงาน</label><select class="fin" onchange="gpSet('freshness',this.value)"><option value="current" ${GF.freshness==='current'?'selected':''}>งานปัจจุบัน (${nf(counts.current)})</option><option value="stale" ${GF.freshness==='stale'?'selected':''}>ค้างเกิน 30 วัน (${nf(counts.stale)})</option><option value="history" ${GF.freshness==='history'?'selected':''}>ประวัติเสร็จแล้ว (${nf(counts.history)})</option><option value="" ${!GF.freshness?'selected':''}>ทั้งหมด (${nf(GRAPHIC_JOBS.length)})</option></select></div><div class="field"><label>วันที่เริ่มต้น</label><input class="fin" type="date" value="${esc(GF.dateFrom)}" onchange="gpSetDate('dateFrom',this.value)"></div><div class="field"><label>วันที่สิ้นสุด</label><input class="fin" type="date" value="${esc(GF.dateTo)}" onchange="gpSetDate('dateTo',this.value)"></div><div class="field person"><label>ผู้รับผิดชอบ</label><select class="fin" onchange="gpSet('person',this.value)"><option value="">ทุกคน</option><option value="__UNASSIGNED__" ${GF.person==='__UNASSIGNED__'?'selected':''}>ยังไม่มอบหมาย</option>${people.map(name=>`<option value="${esc(name)}" ${GF.person===name?'selected':''}>${esc(name)}</option>`).join('')}</select></div><button class="tbtn sm" onclick="gpClearFilters()">ล้างตัวกรอง</button></div></details><div class="gp-filter-summary">${mode==='mine'?'งานที่ผูกกับบัญชีคุณ · ':''}${nf(scope.length)} จาก ${nf(GRAPHIC_JOBS.length)} งาน${range?` · ${gpDate(range.from)} – ${gpDate(range.to)}`:''}</div></div>`;
  };
  RENDER.graphic=function(){
    if(!GRAPHIC_READY){main.innerHTML=`${crumb('หน้าแรก','Graphic Production')}<div class="page-h"><div><h1>Graphic Production</h1><p>กำลังโหลดงานจากฐานข้อมูล…</p></div></div>`;loadGraphic();return;}
    main.classList.toggle('graphic-board-view',GF.tab==='board');
    const all=gpGlobalVisible(),active=all.filter(x=>x.status!=='done'),review=all.filter(x=>x.status==='review'),late=all.filter(gpLate),monthDone=all.filter(x=>x.status==='done'&&x.completed_at&&new Date(x.completed_at).getMonth()===new Date().getMonth()),revs=all.reduce((s,x)=>s+x.revision_count,0);
    const tabs=[['dashboard','ภาพรวม'],['board','บอร์ดงาน'],['monthly','งานรายเดือน'],['projects','ทีม / ผู้รับผิดชอบ']];
    main.innerHTML=`${crumb('หน้าแรก','Graphic Production')}<div class="page-h gp-page-h"><div><div class="gp-page-kicker">GRAPHIC WORKSPACE</div><h1>Graphic Production</h1><p>รับบรีฟ · ผลิต · ตรวจงาน · แก้ไข · ส่งมอบ</p>${sourceBadge('live','LIVE',`${nf(all.length)} งานในมุมมองนี้`)}</div><div class="gp-page-actions"><button class="tbtn primary" onclick="openGraphicBrief()">+ เพิ่มการ์ด</button></div></div><div class="gp-tabs">${tabs.map(x=>`<button class="${GF.tab===x[0]?'active':''}" onclick="gpTab('${x[0]}')">${x[1]}</button>`).join('')}</div>${gpFilterBar()}<div class="gp-kpis"><div class="gp-kpi"><span>กำลังเดิน</span><b>${active.length}</b></div><div class="gp-kpi"><span>รอตรวจ</span><b>${review.length}</b></div><div class="gp-kpi"><span>เกินกำหนด</span><b style="color:${late.length?'var(--red)':'inherit'}">${late.length}</b></div><div class="gp-kpi"><span>เสร็จเดือนนี้</span><b>${monthDone.length}</b></div><div class="gp-kpi"><span>รอบแก้</span><b>${revs}</b></div></div><div id="gpBody"></div>`;
    if(GF.tab==='dashboard')renderGraphicDashboard();else if(GF.tab==='monthly')renderGraphicMonthly();else if(GF.tab==='projects')renderGraphicProjects();else renderGraphicBoard();
  };

  function canEditJob(job){
    return !!job&&(canManageGraphic()||job.created_by===ACCESS_PROFILE?.id||gpJobAssignedToProfile(job,ACCESS_PROFILE?.id));
  }
  function safeFileName(name){return String(name||'file').normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(-120)||'file';}
  function suggestedLinkName(job,type,url){
    if(type==='final')return `${job?.title||'งานกราฟิก'} · Final`;
    try{const u=new URL(url);return `${job?.title||'งานกราฟิก'} · ${u.hostname.replace(/^www\./,'')}`;}catch{return job?.title||'ไฟล์อ้างอิง';}
  }
  function personCard(profile,rows){
    const active=rows.filter(j=>j.status!=='done'),review=active.filter(j=>j.status==='review').length,late=active.filter(gpLate).length;
    const name=profile.display_name||profile.email;
    return `<button class="gp-person-card" onclick="gpOpenPerson('${esc(name)}')"><span class="gp-person-avatar">${esc(name.slice(0,2))}</span><span><b>${esc(name)}</b><small>${active.length} งานค้าง · รอตรวจ ${review}${late?` · เกินกำหนด ${late}`:''}</small></span></button>`;
  }
  window.gpOpenPerson=function(name){GF.scope='all';GF.person=name;GF.project='';GF.status='';GF.q='';GF.tab='board';GP_VISIBLE_LIMITS={};RENDER.graphic();};
  renderGraphicProjects=function(){
    const box=document.getElementById('gpBody');if(!box)return;
    const all=GRAPHIC_JOBS,profiles=GRAPHIC_PEOPLE.map(p=>({p,rows:all.filter(j=>gpJobAssignedToProfile(j,p.id))}));
    const legacy=gpPersonOptions().filter(name=>!profiles.some(x=>gpNormalizePerson(x.p.display_name||x.p.email)===gpNormalizePerson(name)));
    box.innerHTML=`<section class="gp-people-section"><div class="gp-import"><b>งานแยกตามผู้รับผิดชอบ</b><div class="muted" style="font-size:11.5px;margin-top:4px">ชื่อที่ผูกบัญชี Company Hub แล้วจะแสดงเป็นงานของคนนั้นโดยตรง</div></div><div class="gp-person-grid">${profiles.map(({p,rows})=>personCard(p,rows)).join('')}</div>${legacy.length?`<div class="gp-unmatched"><b>ชื่อจาก Trello ที่ยังไม่ผูกบัญชี:</b> ${legacy.map(esc).join(', ')}</div>`:''}</section><div class="gp-import" style="margin-top:14px"><b>บอร์ดตามโปรเจกต์</b></div><div class="gp-projects">${GRAPHIC_PROJECTS.map(p=>{const rows=gpGlobalVisible().filter(x=>x.project_id===p.id);return `<div class="gp-project clickable" role="button" tabindex="0" onclick="gpOpenProject('${p.id}')"><div class="gp-meta"><span class="tag">${esc(p.workstream.toUpperCase())}</span><span>${rows.length} งาน</span></div><h3>${esc(p.name)}</h3><div class="muted" style="font-size:11px">ค้าง ${rows.filter(x=>x.status!=='done').length} · เสร็จ ${rows.filter(x=>x.status==='done').length}</div></div>`;}).join('')}</div>${gpMemberAccounts()}`;
  };

  function briefImagePreview(){
    const input=document.getElementById('gbImages'),box=document.getElementById('gbImagePreview');if(!input||!box)return;
    box.replaceChildren();for(const file of [...input.files].slice(0,6)){const item=document.createElement('div');item.className='gp-brief-thumb';const img=document.createElement('img');img.alt=file.name;img.src=URL.createObjectURL(file);img.onload=()=>URL.revokeObjectURL(img.src);const name=document.createElement('small');name.textContent=file.name;item.append(img,name);box.append(item);}
  }
  window.gpBriefImagePreview=briefImagePreview;
  openGraphicBrief=function(){
    originalOpenGraphicBrief();
    const brief=document.getElementById('gbBrief')?.closest('.field');if(!brief)return;
    const assignee=document.getElementById('gbAssignee'),assigneeField=assignee?.closest('.field');
    if(assigneeField)assigneeField.innerHTML=`<label>ผู้รับผิดชอบ</label>${gpAssigneeControl('gbAssignee',assignee.value)}`;
    const images=document.createElement('div');images.className='field';images.innerHTML=`<label>ภาพตัวอย่างประกอบบรีฟ</label><input class="fin" id="gbImages" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onchange="gpBriefImagePreview()"><small>แนบได้สูงสุด 6 ภาพ ภาพละไม่เกิน 10 MB ผู้รับบรีฟจะเห็นภาพในการ์ดได้ทันที</small><div id="gbImagePreview" class="gp-brief-previews"></div>`;brief.after(images);
  };

  async function uploadReferenceImages(job,files){
    const inserted=[];
    for(const file of [...files].slice(0,6)){
      if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)||file.size>10485760)throw new Error(`ไฟล์ ${file.name} ไม่ใช่ภาพที่รองรับหรือเกิน 10 MB`);
      const path=`${job}/${ACCESS_PROFILE.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const up=await SB.storage.from('graphic-job-files').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});if(up.error)throw up.error;
      const row=await SB.from('graphic_job_files').insert({job_id:job,name:file.name,url:`storage://${path}`,file_type:'reference',storage_path:path,mime_type:file.type,size_bytes:file.size}).select().single();
      if(row.error){await SB.storage.from('graphic-job-files').remove([path]);throw row.error;}inserted.push(row.data);
    }
    GRAPHIC_FILES.push(...inserted);return inserted;
  }
  window.uploadGraphicReferenceImages=uploadReferenceImages;

  createGraphicJob=async function(){
    const title=normSp(val('gbTitle')),brief=normSp(val('gbBrief')),due=val('gbDue'),images=[...(document.getElementById('gbImages')?.files||[])];
    if(!title||!brief||!due){toast('กรุณากรอกชื่อ บรีฟ และกำหนดส่ง','info');return;}
    const ae=document.getElementById('gbAssignee'),aid=ae.value,an=aid?(ae.options[ae.selectedIndex].dataset.name||ae.options[ae.selectedIndex].text):'',btn=document.getElementById('gbSave');btn.disabled=true;
    try{
      const row={title,brief,project_id:val('gbProject')||null,work_type:val('gbType'),requester_name:normSp(val('gbRequester')),assignee_id:aid||null,assignee_name:an,due_at:new Date(due).toISOString(),priority:val('gbPrio'),dimensions:normSp(val('gbDim')),channel:normSp(val('gbChannel')),status:val('gbType')==='monthly'?'monthly':'intake',source:'Company Hub'};
      const r=await SB.from('graphic_jobs').insert(row).select().single();if(r.error)throw r.error;GRAPHIC_JOBS.unshift(r.data);
      const checks=(val('gbChecks')||'').split('\n').map(normSp).filter(Boolean);if(checks.length){const cr=await SB.from('graphic_job_checklist_items').insert(checks.map((name,i)=>({job_id:r.data.id,title:name,position:i}))).select();if(cr.error)throw cr.error;GRAPHIC_CHECKS.push(...cr.data);}
      if(images.length)await uploadReferenceImages(r.data.id,images);
      closeModal();GF.scope=aid===ACCESS_PROFILE?.id?'mine':GF.scope;RENDER.graphic();toast(`สร้างงาน G-${r.data.job_no}${images.length?' พร้อมภาพบรีฟ '+images.length+' ภาพ':''} แล้ว`);
    }catch(e){btn.disabled=false;toast('สร้างงานไม่สำเร็จ · '+(e.message||e),'info');}
  };

  async function signedFileUrl(file,download=false){
    if(!file.storage_path)return gpSafeHttpUrl(file.url);
    const r=await SB.storage.from('graphic-job-files').createSignedUrl(file.storage_path,600,download?{download:file.name}:undefined);if(r.error)throw r.error;return r.data?.signedUrl||'';
  }
  window.openGraphicFile=async function(id){const file=GRAPHIC_FILES.find(f=>f.id===id);if(!file)return;try{const url=await signedFileUrl(file,true);if(url)window.open(url,'_blank','noopener');}catch(e){toast('เปิดไฟล์ไม่สำเร็จ · '+(e.message||e),'info');}};
  async function hydratePrivatePreviews(){
    for(const img of document.querySelectorAll('[data-graphic-storage]')){const file=GRAPHIC_FILES.find(f=>f.id===img.dataset.graphicStorage);if(!file)continue;try{img.src=await signedFileUrl(file);}catch{img.remove();}}
  }
  function enhanceJobModal(id){
    const job=GRAPHIC_JOBS.find(j=>j.id===id),files=gpJobFiles(id),editable=canEditJob(job),pad=document.querySelector('#modal .pad');if(!pad)return;
    const fileField=[...pad.querySelectorAll('.field')].find(x=>x.querySelector('label')?.textContent.startsWith('ไฟล์งาน'));
    if(fileField){
      const rows=[...fileField.querySelectorAll('.gp-file-row')];rows.forEach((row,i)=>{const f=files[i];if(!f)return;const tag=row.querySelector('.tag');if(tag)tag.textContent=FILE_LABEL[f.file_type]||f.file_type;const link=row.querySelector('a');if(f.storage_path&&link){const b=document.createElement('button');b.className='gp-file-link';b.textContent=f.name||'เปิดภาพ';b.onclick=()=>openGraphicFile(f.id);link.replaceWith(b);const img=document.createElement('img');img.className='gp-file-preview gp-file-preview-large';img.dataset.graphicStorage=f.id;row.prepend(img);}if(editable){const actions=document.createElement('div');actions.className='gp-file-actions';actions.innerHTML=`<button class="tbtn sm" onclick="editGraphicFile('${f.id}')">แก้ไข</button><button class="tbtn sm danger" onclick="deleteGraphicFile('${f.id}')">ลบ</button>`;row.append(actions);}});
      fileField.querySelector('#gjFileType option[value="working"]')?.remove();
      const fileType=fileField.querySelector('#gjFileType');if(fileType)fileType.querySelectorAll('option').forEach(o=>o.textContent=FILE_LABEL[o.value]||o.textContent);
      if(editable){fileField.insertAdjacentHTML('beforeend',`<div class="gp-upload-box"><label>แนบภาพอ้างอิงเพิ่ม</label><input class="fin" id="gjImages" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><button class="tbtn sm" onclick="uploadGraphicJobImages('${id}')">อัปโหลดภาพ</button></div>`);}
    }
    if(canManageGraphic()){
      const owner=[...pad.querySelectorAll('.field')].find(x=>x.querySelector('label')?.textContent==='ผู้รับผิดชอบ');
      if(owner)owner.innerHTML=`<label>ผู้รับผิดชอบ</label>${gpAssigneeControl('gjAssignee',job.assignee_id||'',`updateGraphicAssignee('${id}',this.value)`)}<small>มอบหมายด้วยบัญชีจริง เพื่อให้ปรากฏใน “งานของฉัน”</small>`;
    }
    hydratePrivatePreviews();
  }
  openGraphicJob=async function(id){await originalOpenGraphicJob(id);enhanceJobModal(id);};

  window.uploadGraphicJobImages=async function(job){const input=document.getElementById('gjImages');if(!input?.files?.length){toast('กรุณาเลือกภาพ','info');return;}try{await uploadReferenceImages(job,input.files);await openGraphicJob(job);toast('แนบภาพอ้างอิงแล้ว');}catch(e){toast('แนบภาพไม่สำเร็จ · '+(e.message||e),'info');}};
  window.updateGraphicAssignee=async function(job,id){const j=GRAPHIC_JOBS.find(x=>x.id===job),p=gpProfile(id);try{const r=await SB.from('graphic_jobs').update({assignee_id:id||null,assignee_name:id?(p.display_name||p.email):''}).eq('id',job).select().single();if(r.error)throw r.error;Object.assign(j,r.data);await openGraphicJob(job);toast('อัปเดตผู้รับผิดชอบแล้ว');}catch(e){toast('มอบหมายไม่สำเร็จ · '+(e.message||e),'info');}};
  window.editGraphicFile=function(id){const f=GRAPHIC_FILES.find(x=>x.id===id);if(!f)return;showModal(`<div class="modal-h"><div><h3>แก้ไขไฟล์ / ลิงก์</h3><div class="muted">แก้ชื่อและประเภทได้โดยไม่ต้องส่งซ้ำ</div></div><button class="x" onclick="openGraphicJob('${f.job_id}')">×</button></div><div class="pad"><div class="field"><label>ชื่อไฟล์ / ชื่องาน</label><input class="fin" id="geFileName" value="${esc(f.name||'')}"></div>${f.storage_path?'':`<div class="field"><label>ลิงก์</label><input class="fin" id="geFileUrl" type="url" value="${esc(f.url||'')}"></div>`}<div class="field"><label>ประเภท</label><select class="fin" id="geFileType"><option value="reference" ${f.file_type==='reference'?'selected':''}>ภาพอ้างอิง / บรีฟ</option><option value="final" ${f.file_type==='final'?'selected':''}>ไฟล์ Final</option></select></div><button class="tbtn primary" onclick="saveGraphicFileEdit('${id}')">บันทึกการแก้ไข</button></div>`);};
  window.saveGraphicFileEdit=async function(id){const f=GRAPHIC_FILES.find(x=>x.id===id),patch={name:normSp(val('geFileName')),file_type:val('geFileType')};if(!f)return;if(!f.storage_path){patch.url=normSp(val('geFileUrl'));if(!gpSafeHttpUrl(patch.url)){toast('กรุณาใส่ลิงก์ http/https','info');return;}}try{const r=await SB.from('graphic_job_files').update(patch).eq('id',id).select().single();if(r.error)throw r.error;Object.assign(f,r.data);await openGraphicJob(f.job_id);toast('แก้ไขไฟล์แล้ว');}catch(e){toast('แก้ไขไฟล์ไม่สำเร็จ · '+(e.message||e),'info');}};
  window.deleteGraphicFile=async function(id){const f=GRAPHIC_FILES.find(x=>x.id===id);if(!f||!confirm(`ลบ “${f.name||'ไฟล์นี้'}” ออกจากงานใช่หรือไม่?`))return;try{const r=await SB.from('graphic_job_files').delete().eq('id',id);if(r.error)throw r.error;if(f.storage_path)await SB.storage.from('graphic-job-files').remove([f.storage_path]);GRAPHIC_FILES=GRAPHIC_FILES.filter(x=>x.id!==id);await openGraphicJob(f.job_id);toast('ลบไฟล์แล้ว');}catch(e){toast('ลบไฟล์ไม่สำเร็จ · '+(e.message||e),'info');}};

  addGraphicCheck=async function(job){const title=normSp(val('gjCheck'));if(!title)return;try{const r=await SB.from('graphic_job_checklist_items').insert({job_id:job,title,position:gpJobChecks(job).length}).select().single();if(r.error)throw r.error;GRAPHIC_CHECKS.push(r.data);await openGraphicJob(job);toast('เพิ่ม Checklist แล้ว');}catch(e){toast('เพิ่ม Checklist ไม่สำเร็จ · '+(e.message||e),'info');}};
  toggleGraphicCheck=async function(id,done){try{const r=await SB.from('graphic_job_checklist_items').update({done}).eq('id',id).select().single();if(r.error)throw r.error;const i=GRAPHIC_CHECKS.findIndex(x=>x.id===id);GRAPHIC_CHECKS[i]=r.data;}catch(e){toast('อัปเดต Checklist ไม่สำเร็จ · '+(e.message||e),'info');}};
  addGraphicFile=async function(job){const url=normSp(val('gjFileUrl')),type=val('gjFileType'),j=GRAPHIC_JOBS.find(x=>x.id===job),name=normSp(val('gjFileName'))||suggestedLinkName(j,type,url);if(!gpSafeHttpUrl(url)){toast('กรุณาใส่ลิงก์ http/https','info');return;}try{const r=await SB.from('graphic_job_files').insert({job_id:job,name,url,file_type:type}).select().single();if(r.error)throw r.error;GRAPHIC_FILES.push(r.data);await openGraphicJob(job);toast('เพิ่ม'+(type==='final'?'ไฟล์ Final':'ภาพอ้างอิง')+'แล้ว');}catch(e){toast('เพิ่มไฟล์ไม่สำเร็จ · '+(e.message||e),'info');}};
  document.documentElement.dataset.graphicWorkflowV2='ready';
})();
