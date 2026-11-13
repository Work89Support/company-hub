/* Graphic Production usability: personal board, account-backed owners, brief images and editable delivery links. */
(function(){
  const FILE_LABEL={reference:'ภาพอ้างอิง / บรีฟ',final:'ไฟล์ Final'};
  const originalOpenGraphicJob=openGraphicJob;
  const originalOpenGraphicBrief=openGraphicBrief;
  const originalGpJobCard=gpJobCard;
  const originalDashboardGraphicRows=dashboardGraphicRows;

  GF.scope=GF.scope||'';
  GF.profileId=GF.profileId||'';
  GF.freshness=GF.freshness||'current';
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
  function gpStoredAssigneeIds(job){return Array.isArray(job?.source_payload?.assignee_profile_ids)?job.source_payload.assignee_profile_ids.filter(Boolean):[];}
  function gpJobAssigneeIds(job){return [...new Set([job?.assignee_id,...gpStoredAssigneeIds(job),...gpJobMemberRows(job?.id).map(m=>m.profile_id||m.linked_profile_id)].filter(Boolean))];}
  function gpSelectedAssigneeIds(groupId){return [...document.querySelectorAll(`[data-gp-assignee-group="${groupId}"] input[type="checkbox"]:checked`)].map(input=>input.value).filter(Boolean);}
  function gpAssigneeMultiControl(groupId,selected=[]){
    const chosen=new Set(selected.filter(Boolean));
    return `<div class="gp-assignee-multi" data-gp-assignee-group="${groupId}"><div class="gp-assignee-search"><label for="${groupId}Search">ค้นหาผู้รับผิดชอบ</label><small id="${groupId}SearchResult">เลือกแล้ว ${chosen.size} จาก ${GRAPHIC_PEOPLE.length} คน</small><input class="fin" type="search" id="${groupId}Search" placeholder="พิมพ์ชื่อหรืออีเมล" autocomplete="off" oninput="gpFilterAssigneeMulti('${groupId}',this.value)"></div><div class="gp-assignee-person-grid">${GRAPHIC_PEOPLE.map(p=>{const name=p.display_name||p.email;return `<label class="gp-assignee-person" data-assignee-search="${esc(gpAssigneeSearchText(p))}" style="${chosen.has(p.id)?'background:var(--blue-50);border-color:var(--blue-400)':''}"><input type="checkbox" value="${p.id}" ${chosen.has(p.id)?'checked':''} onchange="gpAssigneeMultiChanged('${groupId}')"><span class="gp-person-avatar">${esc(name.slice(0,2))}</span><span><b>${esc(name)}</b><small>${esc(p.position_title||'พนักงาน')} · ${esc(deptName(p.department_code)||'ยังไม่กำหนดแผนก')}</small></span></label>`;}).join('')}</div><small class="muted">เลือกได้หลายคน · คนแรกเป็นผู้รับผิดชอบหลักเพื่อรองรับข้อมูลเดิม</small></div>`;
  }
  window.gpFilterAssigneeMulti=function(groupId,query=''){
    const root=document.querySelector(`[data-gp-assignee-group="${groupId}"]`);if(!root)return;const q=String(query||'').normalize('NFKC').toLowerCase().trim();let visible=0;
    root.querySelectorAll('.gp-assignee-person').forEach(row=>{const show=!q||String(row.dataset.assigneeSearch||'').includes(q);row.hidden=!show;if(show)visible++;});
    const result=document.getElementById(groupId+'SearchResult'),selected=gpSelectedAssigneeIds(groupId).length;if(result)result.textContent=`เลือกแล้ว ${selected} คน${q?` · พบ ${visible} คน`:` จาก ${GRAPHIC_PEOPLE.length} คน`}`;
  };
  window.gpAssigneeMultiChanged=function(groupId){const root=document.querySelector(`[data-gp-assignee-group="${groupId}"]`);if(!root)return;root.querySelectorAll('.gp-assignee-person').forEach(row=>{const checked=row.querySelector('input')?.checked;row.style.background=checked?'var(--blue-50)':'';row.style.borderColor=checked?'var(--blue-400)':'';});gpFilterAssigneeMulti(groupId,document.getElementById(groupId+'Search')?.value||'');};
  function gpNormalizePerson(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^\p{L}\p{N}]+/gu,'');}
  function gpNormalizeBriefInput(value){return String(value==null?'':value).replace(/\r\n?/g,'\n').trim();}
  function gpBriefText(value){const text=gpNormalizeBriefInput(value);if(!text||text.includes('\n'))return text;return /^(?:\d+[.)]|[-•])(?:\s|$)/.test(text)?text.replace(/\s+(?=(?:\d+[.)]|[-•])(?:\s|$))/g,'\n'):text;}
  function gpJobAssignedToProfile(job,id){return !!id&&gpJobAssigneeIds(job).includes(id);}
  const jobFreshness=typeof gpFreshness==='function'?gpFreshness:function(job){const updated=Date.parse(job.status==='done'?(job.completed_at||job.updated_at||job.trello_last_activity_at||job.created_at||''):(job.trello_last_activity_at||job.updated_at||job.created_at||''));if(job.status==='done')return Number.isFinite(updated)&&Date.now()-updated<=30*86400000?'current':'history';if(job.source!=='Trello')return'current';return Number.isFinite(updated)&&Date.now()-updated>30*86400000?'stale':'current';};
  function gpScope(){
    const id=ACCESS_PROFILE?.id||'';
    if(GF.profileId!==id){GF.profileId=id;GF.scope='';GF.person='';GF.project='';}
    if(GF.scope)return GF.scope;
    return AUTH_DB_ROLE==='staff'&&currentDept()==='GRAPHIC'?'mine':'all';
  }
  gpJobPeople=function(job){
    const memberNames=gpJobMemberRows(job.id).map(m=>gpProfileName(m.profile_id||m.linked_profile_id)||m.full_name||m.username),selectedNames=gpJobAssigneeIds(job).map(gpProfileName),direct=gpProfileName(job.assignee_id);
    const names=[direct,job.assignee_name,...selectedNames,...memberNames].flatMap(x=>String(x||'').split(',')).map(x=>x.trim()).filter(Boolean);
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
  function gpImageLike(file){return !!file&&(!!file.storage_path||String(file.mime_type||'').startsWith('image/')||/(?:\/|\b)(?:image|[^/?#]+\.(?:png|jpe?g|webp|gif))(?:[?#]|$)/i.test(file.preview_url||file.url||''));}
  function gpImageFile(jobId){return gpJobFiles(jobId).find(gpImageLike)||null;}
  window.graphicPreviewFallback=function(img){
    if(!img?.isConnected)return;const link=img.dataset.previewLink||'',large=img.classList.contains('gp-cover-lg'),file=img.classList.contains('gp-file-preview');
    const box=document.createElement(link?'a':'div');box.className=`gp-image-unavailable ${large?'is-large':''} ${file?'is-file':''}`;box.textContent=file?'ดูไฟล์':'ภาพเดิมจาก Trello เปิดไม่ได้';
    if(link){box.href=link;box.target='_blank';box.rel='noopener';box.title='เปิดไฟล์ต้นทาง';box.onclick=e=>e.stopPropagation();}
    img.replaceWith(box);
  };
  gpJobCard=function(job){
    let html=originalGpJobCard(job);if(job.cover_url)return html;
    const file=gpImageFile(job.id);if(!file)return html;
    const source=file.storage_path?'':(file.preview_url||file.url||''),storage=file.storage_path?` data-graphic-storage="${esc(file.id)}"`:'';
    const image=`<img class="gp-cover"${storage}${source?` src="${esc(source)}"`:''} data-preview-link="${esc(file.url||source)}" alt="ภาพอ้างอิง ${esc(file.name||job.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="graphicPreviewFallback(this)">`;
    return html.replace(/(<div class="gp-job"[^>]*>)/,`$1${image}`);
  };
  gpVisible=function(){const q=GF.q.toLowerCase();return gpGlobalVisible().filter(j=>(!GF.project||j.project_id===GF.project)&&(!GF.status||j.status===GF.status)&&(!q||[j.title,j.brief,j.requester_name,j.assignee_name,gpProject(j.project_id).name].join(' ').toLowerCase().includes(q)));};
  window.gpSetScope=function(scope){GF.scope=scope;GF.person='';GF.project='';GF.status='';GF.q='';GP_VISIBLE_LIMITS={};RENDER.graphic();};
  gpFilterBar=function(){
    const range=gpDataRange(),people=gpPersonOptions(),scope=gpGlobalVisible(),mode=gpScope(),counts={current:0,stale:0,history:0};
    GRAPHIC_JOBS.forEach(job=>counts[jobFreshness(job)]++);
    const activeFilters=[GF.freshness&&GF.freshness!=='current',GF.dateFrom,GF.dateTo,GF.person].filter(Boolean).length;
    return `<div class="gp-board-controls"><div class="gp-scope-switch" role="group" aria-label="ขอบเขตงาน"><button class="${mode==='mine'?'active':''}" onclick="gpSetScope('mine')">งานของฉัน</button><button class="${mode==='all'?'active':''}" onclick="gpSetScope('all')">งานทั้งหมดในทีม</button></div><details class="gp-filter-drawer"><summary>ตัวกรอง${activeFilters?` <span>${activeFilters}</span>`:''}</summary><div class="gp-global-filter"><div class="field"><label>ชุดงาน</label><select class="fin" onchange="gpSet('freshness',this.value)"><option value="current" ${GF.freshness==='current'?'selected':''}>งานปัจจุบันและเพิ่งเสร็จ (${nf(counts.current)})</option><option value="stale" ${GF.freshness==='stale'?'selected':''}>ค้างเกิน 30 วัน (${nf(counts.stale)})</option><option value="history" ${GF.freshness==='history'?'selected':''}>เสร็จเกิน 30 วัน (${nf(counts.history)})</option><option value="" ${!GF.freshness?'selected':''}>ทั้งหมด (${nf(GRAPHIC_JOBS.length)})</option></select></div><div class="field"><label>วันที่เริ่มต้น</label><input class="fin" type="date" value="${esc(GF.dateFrom)}" onchange="gpSetDate('dateFrom',this.value)"></div><div class="field"><label>วันที่สิ้นสุด</label><input class="fin" type="date" value="${esc(GF.dateTo)}" onchange="gpSetDate('dateTo',this.value)"></div><div class="field person"><label>ผู้รับผิดชอบ</label><select class="fin" onchange="gpSet('person',this.value)"><option value="">ทุกคน</option><option value="__UNASSIGNED__" ${GF.person==='__UNASSIGNED__'?'selected':''}>ยังไม่มอบหมาย</option>${people.map(name=>`<option value="${esc(name)}" ${GF.person===name?'selected':''}>${esc(name)}</option>`).join('')}</select></div><button class="tbtn sm" onclick="gpClearFilters()">ล้างตัวกรอง</button><small>งาน Trello ที่ไม่มีความเคลื่อนไหวเกิน 30 วันยังเปิดดูได้ แต่ไม่นับเป็นงานค้างปัจจุบันบนหน้าแรก/KPI · งานที่เพิ่งเสร็จจะแสดงในคอลัมน์ดำเนินการแล้ว 30 วัน</small></div></details><div class="gp-filter-summary">${mode==='mine'?'งานที่ผูกกับบัญชีคุณ · ':''}${nf(scope.length)} จาก ${nf(GRAPHIC_JOBS.length)} งาน${range?` · ${gpDate(range.from)} – ${gpDate(range.to)}`:''}</div></div>`;
  };
  RENDER.graphic=function(){
    if(!GRAPHIC_READY){main.innerHTML=`${crumb('หน้าแรก','Graphic Production')}<div class="page-h"><div><h1>Graphic Production</h1><p>กำลังโหลดงานจากฐานข้อมูล…</p></div></div>`;loadGraphic();return;}
    main.classList.toggle('graphic-board-view',GF.tab==='board');
    const all=gpGlobalVisible(),active=all.filter(x=>x.status!=='done'),review=all.filter(x=>x.status==='review'),late=all.filter(gpLate),monthDone=all.filter(x=>x.status==='done'&&x.completed_at&&new Date(x.completed_at).getMonth()===new Date().getMonth()),revs=all.reduce((s,x)=>s+x.revision_count,0);
    const tabs=[['dashboard','ภาพรวม'],['board','บอร์ดงาน'],['monthly','งานรายเดือน'],['projects','ทีม / ผู้รับผิดชอบ']];
    main.innerHTML=`${crumb('หน้าแรก','Graphic Production')}<div class="page-h gp-page-h"><div><div class="gp-page-kicker">GRAPHIC WORKSPACE</div><h1>Graphic Production</h1><p>รับบรีฟ · ผลิต · ตรวจงาน · แก้ไข · ส่งมอบ</p>${sourceBadge('live','LIVE',`${nf(all.length)} งานในมุมมองนี้`)}</div><div class="gp-page-actions"><button class="tbtn primary" onclick="openGraphicBrief()">+ เพิ่มการ์ด</button></div></div><div class="gp-tabs">${tabs.map(x=>`<button class="${GF.tab===x[0]?'active':''}" onclick="gpTab('${x[0]}')">${x[1]}</button>`).join('')}</div>${gpFilterBar()}<div class="gp-kpis"><div class="gp-kpi"><span>กำลังเดิน</span><b>${active.length}</b></div><div class="gp-kpi"><span>รอตรวจ</span><b>${review.length}</b></div><div class="gp-kpi"><span>เกินกำหนด</span><b style="color:${late.length?'var(--red)':'inherit'}">${late.length}</b></div><div class="gp-kpi"><span>เสร็จเดือนนี้</span><b>${monthDone.length}</b></div><div class="gp-kpi"><span>รอบแก้</span><b>${revs}</b></div></div><div id="gpBody"></div>`;
    if(GF.tab==='dashboard')renderGraphicDashboard();else if(GF.tab==='monthly')renderGraphicMonthly();else if(GF.tab==='projects')renderGraphicProjects();else renderGraphicBoard();
    queueMicrotask(hydratePrivatePreviews);
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
    const all=gpGlobalVisible(),profiles=GRAPHIC_PEOPLE.map(p=>({p,rows:all.filter(j=>gpJobAssignedToProfile(j,p.id))})),visibleNames=[...new Set(all.flatMap(gpJobPeople))];
    const legacy=visibleNames.filter(name=>!profiles.some(x=>gpNormalizePerson(x.p.display_name||x.p.email)===gpNormalizePerson(name)));
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
    if(assigneeField)assigneeField.innerHTML=`<label>ผู้รับผิดชอบ</label><input type="hidden" id="gbAssignee" value="">${gpAssigneeMultiControl('gbAssignees',assignee.value?[assignee.value]:[])}`;
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
    const title=normSp(val('gbTitle')),brief=gpNormalizeBriefInput(val('gbBrief')),due=val('gbDue'),images=[...(document.getElementById('gbImages')?.files||[])];
    if(!title||!brief||!due){toast('กรุณากรอกชื่อ บรีฟ และกำหนดส่ง','info');return;}
    const assigneeIds=gpSelectedAssigneeIds('gbAssignees'),aid=assigneeIds[0]||'',names=assigneeIds.map(gpProfileName).filter(Boolean),an=names.join(', '),btn=document.getElementById('gbSave');btn.disabled=true;
    try{
      const row={title,brief,project_id:val('gbProject')||null,work_type:val('gbType'),requester_name:normSp(val('gbRequester')),assignee_id:aid||null,assignee_name:an,due_at:new Date(due).toISOString(),priority:val('gbPrio'),dimensions:normSp(val('gbDim')),channel:normSp(val('gbChannel')),status:val('gbType')==='monthly'?'monthly':'intake',source:'Company Hub',source_payload:{assignee_profile_ids:assigneeIds}};
      const r=await SB.from('graphic_jobs').insert(row).select().single();if(r.error)throw r.error;GRAPHIC_JOBS.unshift(r.data);
      const checks=(val('gbChecks')||'').split('\n').map(normSp).filter(Boolean);if(checks.length){const cr=await SB.from('graphic_job_checklist_items').insert(checks.map((name,i)=>({job_id:r.data.id,title:name,position:i}))).select();if(cr.error)throw cr.error;GRAPHIC_CHECKS.push(...cr.data);}
      if(images.length)await uploadReferenceImages(r.data.id,images);
      closeModal();GF.scope=assigneeIds.includes(ACCESS_PROFILE?.id)?'mine':GF.scope;RENDER.graphic();toast(`สร้างงาน G-${r.data.job_no}${assigneeIds.length?` · ผู้รับผิดชอบ ${assigneeIds.length} คน`:''}${images.length?' พร้อมภาพบรีฟ '+images.length+' ภาพ':''} แล้ว`);
    }catch(e){btn.disabled=false;toast('สร้างงานไม่สำเร็จ · '+(e.message||e),'info');}
  };

  async function signedFileUrl(file,download=false){
    if(!file.storage_path)return gpSafeHttpUrl(file.url);
    const r=await SB.storage.from('graphic-job-files').createSignedUrl(file.storage_path,600,download?{download:file.name}:undefined);if(r.error)throw r.error;return r.data?.signedUrl||'';
  }
  window.openGraphicFile=async function(id){const file=GRAPHIC_FILES.find(f=>f.id===id);if(!file)return;try{const url=await signedFileUrl(file,true);if(url)window.open(url,'_blank','noopener');}catch(e){toast('เปิดไฟล์ไม่สำเร็จ · '+(e.message||e),'info');}};
  async function hydratePrivatePreviews(){
    for(const img of document.querySelectorAll('[data-graphic-storage]')){const file=GRAPHIC_FILES.find(f=>f.id===img.dataset.graphicStorage);if(!file)continue;try{img.src=await signedFileUrl(file);if(!img.src)graphicPreviewFallback(img);}catch{graphicPreviewFallback(img);}}
  }
  function enhanceJobModal(id){
    const job=GRAPHIC_JOBS.find(j=>j.id===id),files=gpJobFiles(id),checks=gpJobChecks(id),editable=canEditJob(job),pad=document.querySelector('#modal .pad');if(!pad)return;
    const fileField=[...pad.querySelectorAll('.field')].find(x=>x.querySelector('label')?.textContent.startsWith('ไฟล์งาน'));
    if(fileField){
      const rows=[...fileField.querySelectorAll('.gp-file-row')];rows.forEach((row,i)=>{const f=files[i];if(!f)return;const tag=row.querySelector('.tag');if(tag)tag.textContent=FILE_LABEL[f.file_type]||f.file_type;const link=row.querySelector('a');if(f.storage_path&&link){const b=document.createElement('button');b.className='gp-file-link';b.textContent=f.name||'เปิดภาพ';b.onclick=()=>openGraphicFile(f.id);link.replaceWith(b);const img=document.createElement('img');img.className='gp-file-preview gp-file-preview-large';img.dataset.graphicStorage=f.id;img.dataset.previewLink=f.url||'';img.onerror=()=>graphicPreviewFallback(img);row.prepend(img);}else if(gpImageLike(f)&&!row.querySelector('img')){const img=document.createElement('img');img.className='gp-file-preview gp-file-preview-large';img.src=f.preview_url||f.url;img.alt=`ภาพตัวอย่าง ${f.name||'ไฟล์งาน'}`;img.referrerPolicy='no-referrer';img.dataset.previewLink=f.url||img.src;img.onerror=()=>graphicPreviewFallback(img);row.prepend(img);}if(editable){const actions=document.createElement('div');actions.className='gp-file-actions';actions.innerHTML=`<button class="tbtn sm" onclick="editGraphicFile('${f.id}')">แก้ไข</button><button class="tbtn sm danger" onclick="deleteGraphicFile('${f.id}')">ลบ</button>`;row.append(actions);}});
      const fileType=fileField.querySelector('#gjFileType');if(fileType){fileType.value='final';fileType.hidden=true;fileType.setAttribute('aria-hidden','true');fileType.insertAdjacentHTML('afterend','<span class="tag">ลิงก์ที่เพิ่มจะบันทึกเป็นไฟล์ Final</span>');}
      if(editable){fileField.insertAdjacentHTML('beforeend',`<div class="gp-upload-box"><label>แนบภาพอ้างอิงเพิ่ม</label><input class="fin" id="gjImages" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple><button class="tbtn sm" onclick="uploadGraphicJobImages('${id}')">อัปโหลดภาพ</button></div>`);}
    }
    const checklistField=[...pad.querySelectorAll('.field')].find(x=>x.querySelector('label')?.textContent==='Checklist');
    if(checklistField&&editable){
      const rows=[...checklistField.querySelectorAll('label.checkbox')];
      rows.forEach((row,i)=>{const item=checks[i];if(!item)return;row.classList.add('gp-check-row');row.insertAdjacentHTML('beforeend',`<span class="gp-check-actions"><button type="button" class="tbtn sm" onclick="event.preventDefault();event.stopPropagation();editGraphicCheck('${item.id}')">แก้ไข</button><button type="button" class="tbtn sm danger" onclick="event.preventDefault();event.stopPropagation();deleteGraphicCheck('${item.id}')">ลบ</button></span>`);});
    }
    if(canManageGraphic()){
      const owner=[...pad.querySelectorAll('.field')].find(x=>x.querySelector('label')?.textContent==='ผู้รับผิดชอบ');
      if(owner)owner.innerHTML=`<label>ผู้รับผิดชอบ</label>${gpAssigneeMultiControl('gjAssignees',gpJobAssigneeIds(job))}<button type="button" class="tbtn primary sm" style="margin-top:10px" onclick="updateGraphicAssignees('${id}')">บันทึกผู้รับผิดชอบ</button><small>เลือกได้หลายคน ทุกคนจะเห็นงานนี้ใน “งานของฉัน”</small>`;
      pad.insertAdjacentHTML('beforeend',`<div class="gp-delete-zone"><div><b>นำการ์ดนี้ออก</b><small>เฉพาะหัวหน้า/ผู้ดูแลกราฟิก · งานจาก Trello อาจกลับมาอีกหากยังอยู่ที่ต้นทาง</small></div><button type="button" class="tbtn danger" onclick="confirmDeleteGraphicJob('${id}')">ลบการ์ดงาน</button></div>`);
    }
    hydratePrivatePreviews();
  }
  openGraphicJob=async function(id){
    await originalOpenGraphicJob(id);
    const job=GRAPHIC_JOBS.find(item=>item.id===id),briefField=[...document.querySelectorAll('#modal .field')].find(field=>field.querySelector('label')?.textContent.trim()==='บรีฟ');
    const briefValue=briefField?.querySelector('.v');if(briefValue&&job)briefValue.textContent=gpBriefText(job.brief)||'-';
    enhanceJobModal(id);
  };

  window.uploadGraphicJobImages=async function(job){const input=document.getElementById('gjImages');if(!input?.files?.length){toast('กรุณาเลือกภาพ','info');return;}try{await uploadReferenceImages(job,input.files);await openGraphicJob(job);toast('แนบภาพอ้างอิงแล้ว');}catch(e){toast('แนบภาพไม่สำเร็จ · '+(e.message||e),'info');}};
  window.updateGraphicAssignees=async function(job){const j=GRAPHIC_JOBS.find(x=>x.id===job),ids=gpSelectedAssigneeIds('gjAssignees'),names=ids.map(gpProfileName).filter(Boolean),payload={...(j?.source_payload||{}),assignee_profile_ids:ids};try{const r=await SB.from('graphic_jobs').update({assignee_id:ids[0]||null,assignee_name:names.join(', '),source_payload:payload}).eq('id',job).select().single();if(r.error)throw r.error;Object.assign(j,r.data);await openGraphicJob(job);toast(`อัปเดตผู้รับผิดชอบ ${ids.length} คนแล้ว`);}catch(e){toast('มอบหมายไม่สำเร็จ · '+(e.message||e),'info');}};
  window.editGraphicFile=function(id){const f=GRAPHIC_FILES.find(x=>x.id===id);if(!f)return;showModal(`<div class="modal-h"><div><h3>แก้ไข${f.storage_path?'ภาพอ้างอิง':'ไฟล์ Final'}</h3><div class="muted">แก้ชื่อ${f.storage_path?'':'และลิงก์'}ได้โดยไม่ต้องส่งซ้ำ</div></div><button class="x" onclick="openGraphicJob('${f.job_id}')">×</button></div><div class="pad"><div class="field"><label>ชื่อไฟล์ / ชื่องาน</label><input class="fin" id="geFileName" value="${esc(f.name||'')}"></div>${f.storage_path?'':`<div class="field"><label>ลิงก์</label><input class="fin" id="geFileUrl" type="url" value="${esc(f.url||'')}"></div>`}<div class="ai-note">ประเภท: ${f.storage_path?'ภาพอ้างอิง / บรีฟ':'ไฟล์ Final'}</div><button class="tbtn primary" onclick="saveGraphicFileEdit('${id}')">บันทึกการแก้ไข</button></div>`);};
  window.saveGraphicFileEdit=async function(id){const f=GRAPHIC_FILES.find(x=>x.id===id);if(!f)return;const patch={name:normSp(val('geFileName')),file_type:f.storage_path?'reference':'final'};if(!f.storage_path){patch.url=normSp(val('geFileUrl'));if(!gpSafeHttpUrl(patch.url)){toast('กรุณาใส่ลิงก์ http/https','info');return;}}try{const r=await SB.from('graphic_job_files').update(patch).eq('id',id).select().single();if(r.error)throw r.error;Object.assign(f,r.data);await openGraphicJob(f.job_id);toast('แก้ไขไฟล์แล้ว');}catch(e){toast('แก้ไขไฟล์ไม่สำเร็จ · '+(e.message||e),'info');}};
  window.deleteGraphicFile=async function(id){const f=GRAPHIC_FILES.find(x=>x.id===id);if(!f||!confirm(`ลบ “${f.name||'ไฟล์นี้'}” ออกจากงานใช่หรือไม่?`))return;try{const r=await SB.from('graphic_job_files').delete().eq('id',id);if(r.error)throw r.error;if(f.storage_path)await SB.storage.from('graphic-job-files').remove([f.storage_path]);GRAPHIC_FILES=GRAPHIC_FILES.filter(x=>x.id!==id);await openGraphicJob(f.job_id);toast('ลบไฟล์แล้ว');}catch(e){toast('ลบไฟล์ไม่สำเร็จ · '+(e.message||e),'info');}};

  window.confirmDeleteGraphicJob=function(id){
    const job=GRAPHIC_JOBS.find(x=>x.id===id);if(!job||!canManageGraphic()){toast('เฉพาะหัวหน้า/ผู้ดูแลกราฟิกเท่านั้นที่ลบการ์ดได้','info');return;}
    const privateFiles=gpJobFiles(id).filter(file=>file.storage_path);
    if(privateFiles.length){toast(`งานนี้มีภาพแนบ ${privateFiles.length} ไฟล์ กรุณาลบภาพแนบก่อนลบการ์ด เพื่อไม่ให้มีไฟล์ตกค้าง`,'info');return;}
    showModal(`<div class="modal-h"><div><h3>ยืนยันลบการ์ด G-${job.job_no}</h3><div class="muted">${esc(job.title)}</div></div><button class="x" onclick="openGraphicJob('${id}')">×</button></div><div class="pad"><div class="gp-delete-warning"><b>ลบแล้วกู้คืนจาก Company Hub ไม่ได้</b><span>Checklist ลิงก์ และประวัติของการ์ดนี้จะถูกลบตามไปด้วย${job.source==='Trello'?' · การ์ดนี้มาจาก Trello และอาจถูกนำเข้ากลับมาอีกหากยังไม่ลบหรือปิดที่ต้นทาง':''}</span></div><label class="checkbox gp-delete-confirm"><input id="gpDeleteConfirm" type="checkbox" onchange="document.getElementById('gpDeleteButton').disabled=!this.checked"> ยืนยันว่าตรวจสอบการ์ดถูกต้องแล้ว</label><div class="ux-modal-actions"><button class="tbtn" onclick="openGraphicJob('${id}')">ยกเลิก</button><button id="gpDeleteButton" class="tbtn danger" disabled onclick="deleteGraphicJob('${id}')">ลบการ์ดงาน</button></div></div>`);
  };
  window.deleteGraphicJob=async function(id){
    const job=GRAPHIC_JOBS.find(x=>x.id===id),button=document.getElementById('gpDeleteButton');if(!job||!canManageGraphic())return;if(button)button.disabled=true;
    try{const result=await SB.from('graphic_jobs').delete().eq('id',id).select('id').single();if(result.error)throw result.error;GRAPHIC_JOBS=GRAPHIC_JOBS.filter(x=>x.id!==id);GRAPHIC_FILES=GRAPHIC_FILES.filter(x=>x.job_id!==id);GRAPHIC_CHECKS=GRAPHIC_CHECKS.filter(x=>x.job_id!==id);GRAPHIC_JOB_MEMBERS=GRAPHIC_JOB_MEMBERS.filter(x=>x.job_id!==id);closeModal();RENDER.graphic();toast(`ลบการ์ด G-${job.job_no} แล้ว`);}catch(e){if(button)button.disabled=false;toast('ลบการ์ดไม่สำเร็จ · '+(e.message||e),'info');}
  };

  addGraphicCheck=async function(job){const title=normSp(val('gjCheck'));if(!title)return;try{const r=await SB.from('graphic_job_checklist_items').insert({job_id:job,title,position:gpJobChecks(job).length}).select().single();if(r.error)throw r.error;GRAPHIC_CHECKS.push(r.data);await openGraphicJob(job);toast('เพิ่ม Checklist แล้ว');}catch(e){toast('เพิ่ม Checklist ไม่สำเร็จ · '+(e.message||e),'info');}};
  toggleGraphicCheck=async function(id,done){try{const r=await SB.from('graphic_job_checklist_items').update({done}).eq('id',id).select().single();if(r.error)throw r.error;const i=GRAPHIC_CHECKS.findIndex(x=>x.id===id);GRAPHIC_CHECKS[i]=r.data;}catch(e){toast('อัปเดต Checklist ไม่สำเร็จ · '+(e.message||e),'info');}};
  window.editGraphicCheck=function(id){const item=GRAPHIC_CHECKS.find(x=>x.id===id);if(!item)return;showModal(`<div class="modal-h"><div><h3>แก้ไข Checklist</h3><div class="muted">แก้รายการที่พิมพ์ผิดได้ทันที</div></div><button class="x" onclick="openGraphicJob('${item.job_id}')">×</button></div><div class="pad"><div class="field"><label>รายการ</label><input class="fin" id="geCheckTitle" value="${esc(item.title||'')}" maxlength="500"></div><button class="tbtn primary" onclick="saveGraphicCheckEdit('${id}')">บันทึกการแก้ไข</button></div>`);};
  window.saveGraphicCheckEdit=async function(id){const item=GRAPHIC_CHECKS.find(x=>x.id===id),title=normSp(val('geCheckTitle'));if(!item||!title){toast('กรุณาระบุรายการ','info');return;}try{const r=await SB.from('graphic_job_checklist_items').update({title}).eq('id',id).select().single();if(r.error)throw r.error;Object.assign(item,r.data);await openGraphicJob(item.job_id);toast('แก้ไข Checklist แล้ว');}catch(e){toast('แก้ไข Checklist ไม่สำเร็จ · '+(e.message||e),'info');}};
  window.deleteGraphicCheck=async function(id){const item=GRAPHIC_CHECKS.find(x=>x.id===id);if(!item||!confirm(`ลบ Checklist “${item.title}” ใช่หรือไม่?`))return;try{const r=await SB.from('graphic_job_checklist_items').delete().eq('id',id);if(r.error)throw r.error;GRAPHIC_CHECKS=GRAPHIC_CHECKS.filter(x=>x.id!==id);await openGraphicJob(item.job_id);toast('ลบ Checklist แล้ว');}catch(e){toast('ลบ Checklist ไม่สำเร็จ · '+(e.message||e),'info');}};
  addGraphicFile=async function(job){const url=normSp(val('gjFileUrl')),type='final',j=GRAPHIC_JOBS.find(x=>x.id===job),name=normSp(val('gjFileName'))||suggestedLinkName(j,type,url);if(!gpSafeHttpUrl(url)){toast('กรุณาใส่ลิงก์ http/https','info');return;}try{const r=await SB.from('graphic_job_files').insert({job_id:job,name,url,file_type:type}).select().single();if(r.error)throw r.error;GRAPHIC_FILES.push(r.data);await openGraphicJob(job);toast('เพิ่มไฟล์ Final แล้ว');}catch(e){toast('เพิ่มไฟล์ไม่สำเร็จ · '+(e.message||e),'info');}};
  dashboardGraphicRows=function(){return originalDashboardGraphicRows().filter(row=>{const job=GRAPHIC_JOBS.find(item=>item.id===row.id);return !job||jobFreshness(job)!=='stale';});};
  document.documentElement.dataset.graphicWorkflowV2='ready';
})();
