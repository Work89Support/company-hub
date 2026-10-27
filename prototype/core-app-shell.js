/* ============================================================
   INTERACTIVE STATE (ทำให้ทุกปุ่มทำงานจริง — in-memory)
============================================================ */
let ASSIGNABLE=['a','b','c','d','e','f','lead_gr','lead_crm','lead_mkt'];
const me=()=>ACCESS_PROFILE?.id||ROLE_META[ROLE].u;
const annAudienceIds=a=>(a.audienceIds&&a.audienceIds.length)?a.audienceIds:ASSIGNABLE;
const nextAnnId=()=>'A'+(++ANN_SEQ);
function pendingAcks(){return ANN.filter(a=>annStatus(a).t!=='หมดอายุ'&&annAudienceIds(a).includes(me())&&!(a.acks||[]).includes(me()));}
function updateBell(){const el=document.getElementById('bell');if(!el)return;const n=pendingAcks().length;el.innerHTML='<svg class="svic"><use href="#i-bell"></use></svg>'+(n?` <span style="background:var(--red);color:#fff;border-radius:20px;padding:0 6px;font-size:10px">${n}</span>`:'');}
async function ackAnn(id){const a=ANN.find(x=>x.id===id);if(!a)return;a.acks=a.acks||[];
  if(CLOUD&&a.dbId){try{const r=await SB.from('announcement_recipients').update({acknowledged_at:new Date().toISOString()}).eq('announcement_id',a.dbId).eq('profile_id',ACCESS_PROFILE.id);if(r.error)throw r.error;}catch(e){toast('บันทึกรับทราบไม่สำเร็จ · '+(e.message||e),'info');return;}}
  if(!a.acks.includes(me())){a.acks.push(me());logFeed('✅','#e6f7f1',`<b>${shortName(me())}</b> รับทราบประกาศ: ${a.title}`);toast('รับทราบประกาศแล้ว');}
  updateBell();saveState();
  if(document.getElementById('ackpop')){ if(pendingAcks().length) showAckPopup(); else { closeModal(); if(VIEW==='ann')RENDER.ann(); } }
  else if(document.getElementById('anndetail')){ openAnn(id); }
  else if(VIEW==='ann')RENDER.ann();
}
function showAckPopup(manual){
  const list=pendingAcks();
  if(!list.length){ if(manual)toast('ไม่มีประกาศที่ต้องรับทราบ 🎉'); return; }
  showModal(`<div class="modal-h"><div><h3>${sic('i-bell')} ประกาศที่ต้องรับทราบ (${list.length})</h3><div class="muted" style="font-size:11.5px">กรุณากดรับทราบ เพื่อให้ผู้ประกาศทราบ</div></div><button class="x" onclick="closeModal()">×</button></div>
  <div class="pad" id="ackpop">${list.map(a=>`<div class="feed-item" style="align-items:flex-start;border-bottom:1px solid var(--line-2);padding-bottom:10px"><span class="fi" style="background:${u(a.who).c};color:#fff">${u(a.who).s}</span>
    <div style="flex:1"><b style="font-weight:500">${a.pin?'📌 ':''}${a.title}</b><div class="muted" style="font-size:11px">${shortName(a.who)} · ${a.time}</div><div style="font-size:12.5px;margin-top:3px">${a.body}</div>
    <div style="margin-top:7px;display:flex;gap:6px"><button class="tbtn sm primary" onclick="ackAnn('${a.id}')">✓ รับทราบ</button><button class="tbtn sm" onclick="openAnn('${a.id}')">เปิดอ่าน / ตอบกลับ</button></div></div></div>`).join('')}</div>`);
}
function openAnn(id){const a=ANN.find(x=>x.id===id);if(!a)return;const st=annStatus(a);
  const aud=annAudienceIds(a),ack=a.acks||[],pend=aud.filter(x=>!ack.includes(x));
  const canSee=a.who===me()||isExecutiveRole()||AUTH_DB_ROLE==='lead';const iRecip=aud.includes(me()),iAck=ack.includes(me());
  showModal(`<div class="modal-h"><div><div style="margin-bottom:4px"><span class="pill" style="background:${st.c}">${st.t}</span></div><h3>${a.pin?'📌 ':''}${a.title}</h3>
    <div class="muted" style="font-size:11.5px">${shortName(a.who)} · ${a.time} · 📨 ${a.audience||'ทั้งบริษัท'}${a.from?` · 🗓 มีผล ${fmtDate(a.from)}${a.until?(' – '+fmtDate(a.until)):' (ไม่มีสิ้นสุด)'}`:''}</div></div><button class="x" onclick="closeModal()">×</button></div>
  <div class="pad" id="anndetail">
    <div class="v" style="font-size:13.5px;line-height:1.65">${a.body}</div>
    ${iRecip?(iAck?`<div class="ai-note" style="margin-top:12px">✅ คุณรับทราบประกาศนี้แล้ว</div>`:`<button class="tbtn primary" style="margin-top:12px" onclick="ackAnn('${a.id}')">✓ กดรับทราบ</button>`):`<div class="muted" style="margin-top:12px;font-size:12px">คุณไม่ได้อยู่ในผู้รับของประกาศนี้</div>`}
    <div class="field" style="margin-top:14px"><label>สถานะการรับทราบ — ${ack.length}/${aud.length} คน</label>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">${ack.length?avStack(ack):'<span class="muted" style="font-size:12px">ยังไม่มีใครรับทราบ</span>'}</div>
      ${canSee?`<div style="font-size:12px"><b style="font-weight:500;color:var(--green)">✓ รับทราบแล้ว:</b> ${ack.map(shortName).join(', ')||'-'}</div>
        <div style="font-size:12px;margin-top:3px"><b style="font-weight:500;color:var(--amber)">⏳ ยังไม่รับทราบ:</b> ${pend.map(shortName).join(', ')||'ครบทุกคนแล้ว 🎉'}</div>`:`<div class="muted" style="font-size:11px">* เฉพาะผู้ประกาศ / หัวหน้า / ผู้บริหาร เห็นรายชื่อ</div>`}
    </div>
    <div class="field"><label>ตอบกลับประกาศ (${(a.comments||[]).length})</label>
      <div style="display:flex;gap:6px;margin-bottom:8px"><input class="fin" id="annCmt_${a.id}" placeholder="เขียนตอบกลับ..." style="flex:1" onkeydown="if(event.key==='Enter')addAnnComment('${a.id}')"><button class="tbtn" title="พูด" onclick="voiceDictate('annCmt_${a.id}')">🎤</button><button class="tbtn primary" onclick="addAnnComment('${a.id}')">ส่ง</button></div>
      ${(a.comments||[]).map(cm=>`<div class="logline"><span class="mini" style="background:${u(cm.who).c}">${u(cm.who).s}</span><div><b style="font-weight:500;font-size:12px">${shortName(cm.who)}</b> <span class="muted" style="font-size:11px">· ${cm.time}</span><div style="font-size:12.5px">${cm.text}</div></div></div>`).join('')||'<div class="muted" style="font-size:12px">ยังไม่มีการตอบกลับ</div>'}
    </div>
  </div>`);
}
async function addAnnComment(id){const a=ANN.find(x=>x.id===id);const v=normSp(val('annCmt_'+id));if(!v)return;
  if(CLOUD&&a.dbId){try{const r=await SB.from('announcement_comments').insert({announcement_id:a.dbId,author_id:ACCESS_PROFILE.id,body:v});if(r.error)throw r.error;}catch(e){toast('ตอบกลับไม่สำเร็จ · '+(e.message||e),'info');return;}}
  a.comments=a.comments||[];a.comments.push({who:me(),text:v,time:'เมื่อสักครู่'});
  logFeed('💬','#eef2ff',`<b>${shortName(me())}</b> ตอบกลับประกาศ: ${a.title}`);saveState();toast('ตอบกลับแล้ว');
  if(VIEW==='ann')RENDER.ann();openAnn(id);}
const sopForDept=c=>c==='GRAPHIC'?'SOP-GR':('SOP-'+c);
const val=id=>{const el=document.getElementById(id);return el?el.value:'';};
function toast(msg,type='ok'){
  const wrap=document.getElementById('toast');const d=document.createElement('div');
  d.className='toast-item'+(type==='info'?' info':'');d.innerHTML=(type==='info'?'ℹ️ ':'✅ ')+msg;wrap.appendChild(d);
  setTimeout(()=>{d.style.opacity='0';setTimeout(()=>d.remove(),300);},2600);
}
function refresh(){RENDER[VIEW](BOARD_DEPT);if(typeof saveState==='function')saveState();}
function nextTaskId(){const nums=TASKS.map(t=>Number(String(t.id).split('-').pop())).filter(Number.isFinite);return 'T-'+((nums.length?Math.max(...nums):0)+1);}
function logFeed(ic,c,txt){FEED.unshift({u:ROLE_META[ROLE].u,ic,c,t:txt,time:'เมื่อสักครู่',live:CLOUD,account:ACCESS_PROFILE?.id});}

function canCreateTask(dept){return !!SB&&!!ACCESS_PROFILE&&(canAdminAccess()||(AUTH_DB_ROLE==='lead'&&MANAGE_DEPTS.includes(dept)));}
function canManageTaskUi(t){return !!t&&(canAdminAccess()||(AUTH_DB_ROLE==='lead'&&MANAGE_DEPTS.includes(t.dept)));}
function isMyTaskAssignee(t){return !!t&&!!ACCESS_PROFILE&&assigneesOf(t).includes(ACCESS_PROFILE.id);}
function canProgressTaskUi(t){return canManageTaskUi(t)||isMyTaskAssignee(t);}
function canEditTaskDetails(t){return !!t&&(!CLOUD||ACCESS_PROFILE?.id===t.creator);}
function taskAcknowledgements(t){return t?.acknowledgements&&typeof t.acknowledgements==='object'?t.acknowledgements:{};}
function taskWorkspaces(t){return t?.assigneeWorkspaces&&typeof t.assigneeWorkspaces==='object'?t.assigneeWorkspaces:{};}
function taskWorkspaceFiles(t){return Array.isArray(t?.assigneeFiles)?t.assigneeFiles:[];}
const TASK_WORK_STATUS={todo:'ยังไม่เริ่ม',doing:'กำลังทำ',review:'ส่งตรวจ',block:'ติดปัญหา',done:'ตรวจแล้ว · เสร็จแล้ว'};
function taskAcknowledgementUi(t){
  const assignees=assigneesOf(t),acks=taskAcknowledgements(t),mine=ACCESS_PROFILE?.id&&acks[ACCESS_PROFILE.id],myWorkspace=ACCESS_PROFILE?.id&&taskWorkspaces(t)[ACCESS_PROFILE.id],acked=assignees.filter(id=>acks[id]);
  const rows=assignees.map(id=>`<span class="task-ack-person ${acks[id]?'is-acked':''}">${acks[id]?'✓':'○'} ${esc(shortName(id))}${acks[id]?` <small>${new Date(acks[id]).toLocaleString('th-TH',{timeZone:ORG_TIMEZONE,dateStyle:'short',timeStyle:'short'})}</small>`:''}</span>`).join('');
  const action=isMyTaskAssignee(t)?(mine&&myWorkspace?`<span class="task-ack-mine">✓ คุณรับทราบแล้ว ${new Date(mine).toLocaleString('th-TH',{timeZone:ORG_TIMEZONE,dateStyle:'short',timeStyle:'short'})}</span>`:`<button class="tbtn primary task-ack-button" id="taskAckButton" onclick="acknowledgeTask('${t.id}')">${mine?'เปิดงานย่อยส่วนตัว':'✓ รับทราบงาน'}</button>`):'';
  return `<div class="task-ack-box"><div class="task-ack-head"><div><b>การรับทราบงาน</b><small>${acked.length}/${assignees.length} คนรับทราบแล้ว</small></div>${action}</div><div class="task-ack-people">${rows||'<span class="muted">ยังไม่มีผู้รับผิดชอบ</span>'}</div></div>`;
}
function taskAssigneeWorkspaceUi(t){
  const acks=taskAcknowledgements(t),spaces=taskWorkspaces(t),files=taskWorkspaceFiles(t),canOverview=canManageTaskUi(t)||t.creator===ACCESS_PROFILE?.id;
  if(!assigneesOf(t).length)return '';
  const cards=assigneesOf(t).map(uid=>{
    const space=spaces[uid],mine=uid===ACCESS_PROFILE?.id,visible=mine||canOverview;
    if(!visible)return '';
    if(!acks[uid]||!space)return `<div class="task-work-card is-pending"><div class="task-work-title"><b>${esc(shortName(uid))}</b><span>รอรับทราบ</span></div><small>งานย่อยส่วนตัวจะเปิดหลังผู้รับกดรับทราบงาน</small></div>`;
    const personFiles=files.filter(f=>f.user_id===uid),status=space.status||'todo',progress=Number(space.progress_percent||0);
    const editor=mine?`<div class="task-work-editor"><label>สถานะ<select class="fin" id="taskWorkStatus_${t.id}">${Object.entries(TASK_WORK_STATUS).map(([k,v])=>`<option value="${k}" ${status===k?'selected':''}>${v}</option>`).join('')}</select></label><label>ความคืบหน้า<div class="task-progress-entry"><input class="fin" id="taskWorkProgress_${t.id}" type="number" min="0" max="100" step="5" value="${progress}"><span>%</span></div></label><label class="task-work-note">อัปเดตงาน<textarea class="fin" id="taskWorkNote_${t.id}" maxlength="5000" rows="3" placeholder="สรุปสิ่งที่ทำ ปัญหา หรือสิ่งที่รอตรวจ">${esc(space.update_note||'')}</textarea></label><button class="tbtn primary" id="taskWorkSave_${t.id}" onclick="saveTaskAssigneeWorkspace('${t.id}')">บันทึกอัปเดต</button></div>`:`<div class="task-work-note-read">${esc(space.update_note||'ยังไม่มีข้อความอัปเดต')}</div>`;
    const fileRows=personFiles.map(f=>`<div class="task-work-file"><button class="gp-file-link" onclick="openTaskAssigneeFile('${f.id}')">📎 ${esc(f.file_name)}</button><small>${Math.max(1,Math.round(Number(f.size_bytes||0)/1024))} KB</small>${mine?`<button class="tbtn sm danger" onclick="deleteTaskAssigneeFile('${t.id}','${f.id}')">ลบ</button>`:''}</div>`).join('')||'<small class="muted">ยังไม่มีไฟล์แนบ</small>';
    const uploader=mine?`<div class="task-work-upload"><input type="file" id="taskWorkFile_${t.id}" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/zip,.docx,.xlsx,.pptx"><button class="tbtn" id="taskWorkUpload_${t.id}" onclick="uploadTaskAssigneeFile('${t.id}')">แนบไฟล์</button></div>`:'';
    return `<div class="task-work-card"><div class="task-work-title"><div><b>${esc(shortName(uid))}</b><small>รับทราบ ${new Date(space.acknowledged_at).toLocaleString('th-TH',{timeZone:ORG_TIMEZONE,dateStyle:'short',timeStyle:'short'})}</small></div><span class="task-work-status is-${status}">${TASK_WORK_STATUS[status]||status}</span></div><div class="task-work-progress"><i style="width:${progress}%"></i></div><small class="task-work-percent">${progress}%</small>${editor}<div class="task-work-files"><b>ไฟล์ของ ${esc(shortName(uid))}</b>${fileRows}${uploader}</div></div>`;
  }).join('');
  return `<div class="field task-workspaces"><div class="task-workspace-head"><div><label>งานย่อยรายคน</label><small>ผู้รับแต่ละคนอัปเดตและแนบไฟล์ของตัวเองหลังรับทราบงาน</small></div></div><div class="task-work-grid">${cards||'<div class="muted">คุณไม่มีสิทธิ์ดูงานย่อยของผู้รับคนอื่น</div>'}</div></div>`;
}
async function acknowledgeTask(id){
  const t=TASKS.find(x=>x.id===id);if(!t||!isMyTaskAssignee(t)){toast('รับทราบได้เฉพาะผู้ที่ได้รับมอบหมาย','info');return;}
  if(taskAcknowledgements(t)[ACCESS_PROFILE.id]&&taskWorkspaces(t)[ACCESS_PROFILE.id]){toast('คุณรับทราบงานนี้แล้ว','info');return;}
  const button=document.getElementById('taskAckButton');if(button){button.disabled=true;button.textContent='กำลังบันทึก…';}
  try{
    let acknowledgedAt=new Date().toISOString();
    if(CLOUD&&t.dbId){const result=await SB.rpc('acknowledge_my_task',{p_task:t.dbId});if(result.error)throw result.error;acknowledgedAt=result.data||acknowledgedAt;}
    t.acknowledgements={...taskAcknowledgements(t),[ACCESS_PROFILE.id]:acknowledgedAt};
    (t.log=t.log||[]).unshift({who:ACCESS_PROFILE.id,txt:'รับทราบงาน',time:new Date(acknowledgedAt).toLocaleString('th-TH',{timeZone:ORG_TIMEZONE,dateStyle:'short',timeStyle:'short'})});
    if(CLOUD)await cloudLoadTasks();toast('รับทราบงานแล้ว และเปิดงานย่อยส่วนตัวให้แล้ว');refresh();openTask(id);
  }catch(e){toast('บันทึกรับทราบไม่สำเร็จ · '+(e.message||e),'info');if(button){button.disabled=false;button.textContent='✓ รับทราบงาน';}}
}
async function saveTaskAssigneeWorkspace(id){
  const t=TASKS.find(x=>x.id===id);if(!t||!isMyTaskAssignee(t)||!taskAcknowledgements(t)[ACCESS_PROFILE.id]){toast('ต้องรับทราบงานก่อนอัปเดตงานย่อย','info');return;}
  const status=val('taskWorkStatus_'+id);let progress=Number(val('taskWorkProgress_'+id));const note=val('taskWorkNote_'+id).trim(),button=document.getElementById('taskWorkSave_'+id);if(status==='done')progress=100;
  if(!TASK_WORK_STATUS[status]||!Number.isInteger(progress)||progress<0||progress>100){toast('กรุณาระบุสถานะและความคืบหน้า 0–100%','info');return;}
  if(button){button.disabled=true;button.textContent='กำลังบันทึก…';}
  try{
    if(CLOUD&&t.dbId){const result=await SB.rpc('update_my_task_workspace',{p_task:t.dbId,p_status:status,p_progress:progress,p_note:note});if(result.error)throw result.error;await cloudLoadTasks();}
    else t.assigneeWorkspaces={...taskWorkspaces(t),[ACCESS_PROFILE.id]:{...(taskWorkspaces(t)[ACCESS_PROFILE.id]||{}),status,progress_percent:progress,update_note:note,acknowledged_at:taskAcknowledgements(t)[ACCESS_PROFILE.id]}};
    toast('อัปเดตงานย่อยแล้ว');refresh();openTask(id);
  }catch(e){toast('อัปเดตงานย่อยไม่สำเร็จ · '+(e.message||e),'info');if(button){button.disabled=false;button.textContent='บันทึกอัปเดต';}}
}
function taskFileRowById(fileId){for(const t of TASKS){const row=taskWorkspaceFiles(t).find(f=>f.id===fileId);if(row)return row;}return null;}
async function openTaskAssigneeFile(fileId){
  const row=taskFileRowById(fileId);if(!row)return;
  const result=await SB.storage.from('task-assignee-files').createSignedUrl(row.storage_path,300,{download:row.file_name});
  if(result.error){toast('เปิดไฟล์ไม่สำเร็จ · '+result.error.message,'info');return;}window.open(result.data.signedUrl,'_blank','noopener');
}
async function uploadTaskAssigneeFile(id){
  const t=TASKS.find(x=>x.id===id),input=document.getElementById('taskWorkFile_'+id),file=input?.files?.[0],button=document.getElementById('taskWorkUpload_'+id);
  if(!t||!file)return toast('กรุณาเลือกไฟล์','info');if(file.size>10485760)return toast('ไฟล์ต้องไม่เกิน 10 MB','info');
  const safe=file.name.normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(-120)||'attachment';const path=`${t.dbId}/${ACCESS_PROFILE.id}/${Date.now()}-${safe}`;
  if(button){button.disabled=true;button.textContent='กำลังแนบ…';}
  try{
    const uploaded=await SB.storage.from('task-assignee-files').upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false,cacheControl:'3600'});if(uploaded.error)throw uploaded.error;
    const saved=await SB.rpc('set_my_task_file',{p_task:t.dbId,p_path:path,p_name:file.name,p_mime:file.type||'',p_size:file.size});if(saved.error){await SB.storage.from('task-assignee-files').remove([path]);throw saved.error;}
    await cloudLoadTasks();toast('แนบไฟล์ในงานย่อยแล้ว');openTask(id);
  }catch(e){toast('แนบไฟล์ไม่สำเร็จ · '+(e.message||e),'info');if(button){button.disabled=false;button.textContent='แนบไฟล์';}}
}
async function deleteTaskAssigneeFile(taskId,fileId){
  const row=taskFileRowById(fileId);if(!row)return;
  try{const removed=await SB.rpc('delete_my_task_file',{p_file:fileId});if(removed.error)throw removed.error;const storage=await SB.storage.from('task-assignee-files').remove([removed.data]);if(storage.error)throw storage.error;await cloudLoadTasks();toast('ลบไฟล์แล้ว');openTask(taskId);}catch(e){toast('ลบไฟล์ไม่สำเร็จ · '+(e.message||e),'info');}
}
function openTaskDetailsEditor(id){
  const t=TASKS.find(x=>x.id===id);if(!t)return;
  if(!canEditTaskDetails(t)){toast('แก้ไขชื่อและรายละเอียดได้เฉพาะผู้สร้างงาน','info');return;}
  showModal(`<div class="modal-h"><div><h3>แก้ไขข้อมูลงาน</h3><div class="muted" style="font-size:11.5px">${esc(t.id)} · เฉพาะผู้สร้างงานเท่านั้น</div></div><button class="x" onclick="openTask('${t.id}')">×</button></div>
    <div class="pad"><div class="field"><label for="taskEditTitle">ชื่องาน *</label><input class="fin" id="taskEditTitle" maxlength="300" value="${esc(t.title)}"></div>
    <div class="field"><label for="taskEditDescription">รายละเอียดงาน</label><textarea class="fin" id="taskEditDescription" rows="9" maxlength="20000">${esc(t.desc||'')}</textarea></div>
    <div class="ux-modal-actions"><button class="tbtn" onclick="openTask('${t.id}')">ยกเลิก</button><button class="tbtn primary" id="taskDetailSave" onclick="saveTaskDetails('${t.id}')">บันทึกการแก้ไข</button></div></div>`);
}
async function saveTaskDetails(id){
  const t=TASKS.find(x=>x.id===id);if(!t)return;
  if(!canEditTaskDetails(t)){toast('แก้ไขชื่อและรายละเอียดได้เฉพาะผู้สร้างงาน','info');return;}
  const title=val('taskEditTitle').trim(),description=val('taskEditDescription').trim(),button=document.getElementById('taskDetailSave');
  if(!title){toast('กรุณาระบุชื่องาน','info');document.getElementById('taskEditTitle')?.focus();return;}
  if(title.length>300||description.length>20000){toast('ข้อมูลยาวเกินขนาดที่กำหนด','info');return;}
  if(title===t.title&&description===(t.desc||'')){toast('ข้อมูลยังไม่มีการเปลี่ยนแปลง','info');return;}
  if(button){button.disabled=true;button.textContent='กำลังบันทึก…';}
  try{
    if(CLOUD&&t.dbId){const result=await SB.rpc('update_own_task_details',{p_task:t.dbId,p_title:title,p_description:description});if(result.error)throw result.error;}
    t.title=title;t.desc=description;toast('บันทึกชื่อและรายละเอียดงานแล้ว');refresh();openTask(id);
  }catch(e){toast('แก้ไขรายละเอียดไม่สำเร็จ · '+(e.message||e),'info');if(button){button.disabled=false;button.textContent='บันทึกการแก้ไข';}}
}
function taskSlaMinutes(s){if(!s)return null;return Math.max(1,Number(s.n)||1)*(s.unit==='hr'?60:1440);}
async function createTask(d){
  const assignees=(d.assignees&&d.assignees.length)?d.assignees:(d.assignee?[d.assignee]:['a']);
  if(CLOUD){
    if(!canCreateTask(d.dept))throw new Error('บัญชีนี้ไม่มีสิทธิ์สร้างงานในแผนก '+deptName(d.dept));
    const payload={tags:d.tags||[],sop:sopForDept(d.dept),sub:[]};
    const inserted=await SB.from('tasks').insert({department_code:d.dept,title:normSp(d.title)||'งานใหม่',description:normSp(d.desc),status:'todo',priority:d.prio||'mid',creator_id:ACCESS_PROFILE.id,start_at:TODAY_ISO+'T00:00:00+07:00',due_at:(d.due||addFrom(TODAY_ISO,5))+'T23:59:59+07:00',sla_minutes:taskSlaMinutes(d.sla),prototype_payload:payload}).select('id,task_no').single();
    if(inserted.error)throw inserted.error;
    const validAssignees=assignees.filter(id=>TASK_PROFILES.some(p=>p.id===id));
    if(validAssignees.length){const assigned=await SB.from('task_assignees').insert(validAssignees.map(user_id=>({task_id:inserted.data.id,user_id,assigned_by:ACCESS_PROFILE.id})));if(assigned.error)throw assigned.error;}
    await cloudLoadTasks();
    return TASKS.find(t=>t.dbId===inserted.data.id);
  }
  const t={id:nextTaskId(),dept:d.dept,title:normSp(d.title)||'งานใหม่',creator:ROLE_META[ROLE].u,assignee:assignees[0],assignees,
    status:'todo',prio:d.prio||'mid',start:TODAY_ISO,due:d.due||addFrom(TODAY_ISO,5),spent:0,ontime:true,sla:d.sla||null,
    tags:d.tags||[],sop:sopForDept(d.dept),desc:normSp(d.desc),sub:[],log:[{who:ROLE_META[ROLE].u,txt:'สร้างงาน',time:'เมื่อสักครู่'}]};
  TASKS.unshift(t);
  logFeed('🆕','#eef2ff',`<b>${shortName(t.creator)}</b> สร้างงาน <b>${t.id}</b> ${t.title} · มอบ ${assignees.map(shortName).join(', ')}`);
  return t;
}
async function cloudUpdateTask(t,changes){if(!CLOUD||!t.dbId)return;const r=await SB.from('tasks').update(changes).eq('id',t.dbId).select('id').single();if(r.error)throw r.error;}
async function setTaskStatus(id,st){const t=TASKS.find(x=>x.id===id);if(!t||t.status===st)return;
  if(CLOUD&&!canProgressTaskUi(t)){toast('คุณไม่มีสิทธิ์อัปเดตงานนี้','info');return;}
  if(CLOUD&&!canManageTaskUi(t)&&st==='done'){toast('ผู้รับงานส่งตรวจได้ แต่การปิดงานต้องให้หัวหน้าอนุมัติ','info');return;}
  try{if(CLOUD&&!canManageTaskUi(t)){const r=await SB.rpc('update_my_task_progress',{p_task:t.dbId,p_status:st});if(r.error)throw r.error;}else{const changes={status:st,closed_at:st==='done'?new Date().toISOString():null};if(st!=='done'&&t._payload?.auto_closed)changes.prototype_payload={...t._payload,auto_closed:false};await cloudUpdateTask(t,changes);}}catch(e){toast('อัปเดตสถานะไม่สำเร็จ · '+(e.message||e),'info');return;}
  t.status=st;(t.log=t.log||[]).unshift({who:ROLE_META[ROLE].u,txt:'เปลี่ยนสถานะเป็น '+STATUS[st].t,time:'เมื่อสักครู่'});
  logFeed('🔄','#eef2ff',`<b>${shortName(ROLE_META[ROLE].u)}</b> เปลี่ยน <b>${id}</b> เป็น ${STATUS[st].t}`);
  toast('อัปเดต '+id+' → '+STATUS[st].t);refresh();openTask(id);}
function setAssignee(id,v){const t=TASKS.find(x=>x.id===id);t.assignee=v;
  toast('เปลี่ยนผู้รับผิดชอบเป็น '+shortName(v));refresh();openTask(id);}
async function setPrio(id,v){const t=TASKS.find(x=>x.id===id);try{await cloudUpdateTask(t,{priority:v});}catch(e){toast('ปรับความสำคัญไม่สำเร็จ · '+(e.message||e),'info');return;}t.prio=v;toast('ปรับความสำคัญเป็น '+PRIO[v].t);refresh();openTask(id);}
async function setDue(id,v){const t=TASKS.find(x=>x.id===id);if(!v)return;const start=d2(v)<d2(t.start)?v:t.start;try{await cloudUpdateTask(t,{due_at:v+'T23:59:59+07:00',start_at:start?d2(start)+'T00:00:00+07:00':null});}catch(e){toast('เปลี่ยนกำหนดส่งไม่สำเร็จ · '+(e.message||e),'info');return;}t.due=v;t.start=start;t.ontime=!dashboardIsOverdue(t);toast('เปลี่ยนกำหนดส่งเป็น '+fmtDate(t.due));refresh();openTask(id);}
async function recordTaskTime(id,h){const t=TASKS.find(x=>x.id===id),hours=Math.round(Math.max(0,Number(h)||0)*10)/10;if(!hours){toast('กรุณาระบุเวลาที่ต้องการเพิ่ม','info');return;}
  if(CLOUD){if(!isMyTaskAssignee(t)){toast('ลงเวลาได้เฉพาะงานที่มอบหมายให้คุณ','info');return;}try{const r=await SB.from('time_entries').insert({task_id:t.dbId,user_id:ACCESS_PROFILE.id,minutes:Math.round(hours*60),note:'บันทึกผ่าน Company Hub'});if(r.error)throw r.error;}catch(e){toast('บันทึกเวลาไม่สำเร็จ · '+(e.message||e),'info');return;}}
  t.spent=Math.round(((t.spent||0)+hours)*10)/10;toast('บันทึกเวลา +'+hours+' ชม. (รวม '+t.spent+' ชม.)');refresh();openTask(id);}
function setSpent(id){return recordTaskTime(id,val('spent_'+id));}
function addSpent(id,h){return recordTaskTime(id,h);}
async function setSla(id){const t=TASKS.find(x=>x.id===id),sla={n:Math.max(1,parseInt(val('sla_n_'+id))||1),unit:val('sla_u_'+id)||'day'};try{await cloudUpdateTask(t,{sla_minutes:taskSlaMinutes(sla)});}catch(e){toast('บันทึก SLA ไม่สำเร็จ · '+(e.message||e),'info');return;}t.sla=sla;toast('บันทึกระยะเวลาดำเนินการ '+slaText(t));refresh();openTask(id);}
function taskPayload(t,extra={}){return {...(t._payload||{}),tags:t.tags||[],sop:t.sop||sopForDept(t.dept),sub:t.sub||[],...extra};}
async function saveTaskPayload(t,extra={}){if(CLOUD&&t.dbId){const payload=taskPayload(t,extra);await cloudUpdateTask(t,{prototype_payload:payload});t._payload=payload;}}
async function addSub(id){
  const name=val('subName').trim(),who=val('subWho');
  if(!name){toast('กรุณาระบุชื่องานย่อยก่อน','info');return;}
  const t=TASKS.find(x=>x.id===id);if(CLOUD&&!canManageTaskUi(t)){toast('เฉพาะหัวหน้าหรือผู้ดูแลเท่านั้นที่มอบงานย่อยได้','info');return;}t.sub.push({t:name,who,st:'todo'});
  try{await saveTaskPayload(t);}catch(e){t.sub.pop();toast('บันทึกงานย่อยไม่สำเร็จ · '+(e.message||e),'info');return;}
  logFeed('🔀','#eef2ff',`<b>${shortName(ROLE_META[ROLE].u)}</b> มอบงานย่อยใน <b>${id}</b> ให้ ${shortName(who)}`);
  toast('มอบงานต่อให้ '+shortName(who)+' แล้ว');refresh();openTask(id);}
async function toggleSub(id,i){const t=TASKS.find(x=>x.id===id),o=['todo','doing','review','done'];if(CLOUD&&!canManageTaskUi(t)){toast('เฉพาะหัวหน้าหรือผู้ดูแลเท่านั้นที่เปลี่ยนงานย่อยได้','info');return;}
  const before=t.sub[i].st;t.sub[i].st=o[(o.indexOf(t.sub[i].st)+1)%o.length];try{await saveTaskPayload(t);}catch(e){t.sub[i].st=before;toast('อัปเดตงานย่อยไม่สำเร็จ · '+(e.message||e),'info');return;}saveState();openTask(id);}
async function saveSolution(id){const t=TASKS.find(x=>x.id===id),sol=val('solIn').trim();
  if(!sol){toast('ยังไม่ได้กรอกวิธีแก้','info');return;}if(CLOUD&&t.dbId){try{if(canManageTaskUi(t)){const r=await SB.from('knowledge_articles').insert({source_task_id:t.dbId,department_code:t.dept,title:t.title,problem:t.desc||t.title,solution:sol,status:'review',created_by:ACCESS_PROFILE.id,prototype_payload:{tags:t.tags||[]}});if(r.error)throw r.error;await saveTaskPayload(t,{solution_proposal:sol});}else{const r=await SB.rpc('submit_my_task_solution',{p_task:t.dbId,p_solution:sol});if(r.error)throw r.error;}await cloudLoadKnowledge();}catch(e){toast('บันทึกวิธีแก้ไม่สำเร็จ · '+(e.message||e),'info');return;}}t.solution=sol;saveState();toast('บันทึกวิธีแก้เข้าคิวตรวจคลังความรู้แล้ว');openTask(id);}
async function closeTaskWithSolution(id){
  const t=TASKS.find(x=>x.id===id),sol=(val('solIn')||t.solution||'').trim(),before=t.status;t.status='done';
  if(CLOUD&&t.dbId){try{await cloudUpdateTask(t,{status:'done',closed_at:new Date().toISOString()});if(sol&&!t.solution){const r=await SB.from('knowledge_articles').insert({source_task_id:t.dbId,department_code:t.dept,title:t.title,problem:t.desc||t.title,solution:sol,status:'review',created_by:ACCESS_PROFILE.id,prototype_payload:{tags:t.tags||[]}});if(r.error)throw r.error;await cloudLoadKnowledge();}if(sol)await saveTaskPayload(t,{solution_proposal:sol});t.solution=sol;toast(sol?'ปิดงานแล้ว และส่งวิธีแก้เข้าคิวตรวจคลังความรู้':'ปิดงาน '+id+' แล้ว');closeModal();refresh();return;}catch(e){t.status=before;toast('ปิดงานไม่สำเร็จ · '+(e.message||e),'info');return;}}
  if(sol){t.solution=sol;const kbid='KB-'+String(KB.length+9).padStart(2,'0');
    KB.unshift({id:kbid,dept:t.dept,title:t.title.length>44?t.title.slice(0,44)+'…':t.title,problem:t.desc||t.title,solution:sol,from:t.id,tags:t.tags});
    logFeed('✅','#e6f7f1',`<b>${shortName(ROLE_META[ROLE].u)}</b> ปิดงาน <b>${id}</b> + บันทึก ${kbid} ลงคลังความรู้`);
    toast('ปิดงานแล้ว + สร้างบทความ '+kbid+' ในคลังความรู้');
  }else{logFeed('✅','#e6f7f1',`<b>${shortName(ROLE_META[ROLE].u)}</b> ปิดงาน <b>${id}</b>`);toast('ปิดงาน '+id+' แล้ว');}
  closeModal();refresh();}
async function addComment(id){const v=val('cmtIn').trim();if(!v)return;
  const t=TASKS.find(x=>x.id===id);if(CLOUD&&t.dbId){try{const r=await SB.from('task_comments').insert({task_id:t.dbId,author_id:ACCESS_PROFILE.id,body:v});if(r.error)throw r.error;}catch(e){toast('เพิ่มความคิดเห็นไม่สำเร็จ · '+(e.message||e),'info');return;}}
  (t.log=t.log||[]).unshift({who:ACCESS_PROFILE?.id||ROLE_META[ROLE].u,txt:v,time:'เมื่อสักครู่'});
  logFeed('💬','#eef2ff',`<b>${shortName(ROLE_META[ROLE].u)}</b> คอมเมนต์ใน <b>${id}</b>`);
  saveState();toast('เพิ่มความคิดเห็นแล้ว');openTask(id);}
function assigneeOptions(sel){return ASSIGNABLE.map(a=>`<option value="${a}" ${sel===a?'selected':''}>${shortName(a)}</option>`).join('');}
function deptOptions(sel){const allowed=CLOUD&&!canAdminAccess()?DEPTS.filter(d=>MANAGE_DEPTS.includes(d.code)):DEPTS;return allowed.map(d=>`<option value="${d.code}" ${sel===d.code?'selected':''}>${d.name}</option>`).join('');}

/* Announcements */
function openAnnForm(){PICK=new Set();PICK_QUERY='';PICK_DEPT='';PICK_POSITION='';showModal(`<div class="modal-h"><div><h3>${sic('i-megaphone')} ประกาศ / สั่งการใหม่</h3><div class="muted" style="font-size:11.5px">เลือกผู้รับได้หลายคน / ทั้งกลุ่ม / ทั้งบริษัท</div></div><button class="x" onclick="closeModal()">×</button></div>
  <div class="pad">
    <div class="field"><label>หัวข้อ</label><input class="fin" id="annT" placeholder="เช่น ปรับเป้าหมายทีมสัปดาห์นี้"></div>
    <div class="field"><label>รายละเอียด (พิมพ์หรือพูด)</label><textarea class="fin" id="annB" rows="3" placeholder="เนื้อหาประกาศ"></textarea>
      <button class="tbtn sm" style="margin-top:6px" onclick="voiceDictate('annB')">${sic('i-mic')} พูดใส่</button></div>
    <div class="two"><div class="field"><label>มีผลตั้งแต่</label><input type="date" class="fin" id="annFrom" value="${TODAY_ISO}"></div>
      <div class="field"><label>ถึงวันที่ (เว้นว่าง = ไม่มีกำหนดสิ้นสุด)</label><input type="date" class="fin" id="annUntil"></div></div>
    <label class="checkbox" style="margin-bottom:12px"><input type="checkbox" id="annPin"> 📌 ปักหมุดไว้ด้านบน</label>
    <div class="field"><label>ส่งถึง (เลือกกลุ่ม/หลายคน — ไม่เลือก = ทั้งบริษัท)</label><div id="pickerBox"></div></div>
    <button class="tbtn primary" onclick="postAnn()">${sic('i-megaphone')} โพสต์ & แจ้งเตือน</button></div>`);renderPicker();}
async function postAnn(){const t=normSp(val('annT'));
  if(!t){toast('กรุณาใส่หัวข้อประกาศ','info');return;}
  const sel=[...PICK];const all=(!sel.length||sel.length>=ASSIGNABLE.length),targetIds=all?[...ASSIGNABLE]:sel;
  const audience=all?(canAdminAccess()?'ทั้งบริษัท':'ทุกคนในแผนกที่จัดการ'):sel.map(shortName).join(', ');
  const from=val('annFrom')||TODAY_ISO,until=val('annUntil')||'';
  if(CLOUD){try{const r=await SB.rpc('post_announcement',{p_title:t,p_body:normSp(val('annB')),p_starts_on:from,p_ends_on:until||null,p_pinned:document.getElementById('annPin').checked,p_recipients:targetIds});if(r.error)throw r.error;await cloudLoadAnnouncements();}catch(e){toast('โพสต์ประกาศไม่สำเร็จ · '+(e.message||e),'info');return;}}
  else ANN.unshift({id:nextAnnId(),who:me(),pin:document.getElementById('annPin').checked,title:t,body:normSp(val('annB')),time:'เมื่อสักครู่',audience,from,until,audienceIds:targetIds,acks:[],comments:[]});
  logFeed('📢','#eef2ff',`<b>${shortName(me())}</b> ประกาศ: ${t} → ${audience}`);
  closeModal();toast('โพสต์ประกาศ & แจ้งเตือนถึง '+(all?'ทั้งบริษัท':sel.length+' คน'));go('ann');}

/* Export */
function downloadRows(rows,name){
  const esc=v=>{v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  const csv=rows.map(r=>r.map(esc).join(',')).join('\r\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  toast('ส่งออกไฟล์ '+name+' ('+(rows.length-1>0?rows.length-1:0)+' บรรทัด) แล้ว');}
function taskRows(list){const rows=[['รหัส','งาน','แผนก','ผู้รับผิดชอบ','ผู้สั่ง','สถานะ','ความสำคัญ','เริ่ม','กำหนดส่ง','เวลาที่ใช้(ชม.)','งานย่อย','แท็ก']];
  list.forEach(t=>rows.push([t.id,t.title,deptName(t.dept),assigneesOf(t).map(shortName).join(' | '),shortName(t.creator),STATUS[t.status].t,PRIO[t.prio].t,t.start,t.due,t.spent,(t.sub||[]).length,(t.tags||[]).join(' | ')]));return rows;}
function downloadCSV(list,name){downloadRows(taskRows(list),name);}
function reportDepts(){
  const allowed=visibleDepartmentCodes();
  if(REP_DEPT&&allowed.includes(REP_DEPT)){
    // มติที่ประชุม: Graphic Production ยังเป็นแผนกและ RLS แยกเหมือนเดิม
    // แต่เมื่อเลือกรายงาน Marketing ต้องรวมยอด Graphic ที่บัญชีนั้นมีสิทธิ์เห็นด้วย
    return REP_DEPT==='MKT'?['MKT','GRAPHIC'].filter(c=>allowed.includes(c)):[REP_DEPT];
  }
  if(REP_GROUP)return allowed.filter(c=>DEPT_GROUP[c]===REP_GROUP);
  return allowed;
}
function reportScope(){const d=reportDepts();return dashboardAllWork().filter(t=>d.includes(t.dept));}
function workOwner(t){return t._source==='graphic'?(t.assignee||'ยังไม่มอบหมาย'):assigneesOf(t).map(shortName).join(' | ');}
function reportActivityRows(depts=reportDepts()){return ACTIVITY_READY?ACTIVITY_ROWS.filter(r=>depts.includes(r.department_code)):[];}
function reportIssueRows(depts=reportDepts()){return PROBLEMS.filter(p=>p.dept&&depts.includes(p.dept));}
function reportActivityDone(row){return /เสร็จ|completed|done/i.test(String(row.status||''));}
function reportActivityNeedsFollowup(row){return !reportActivityDone(row)&&/รอ|ค้าง|เลื่อน|pending|waiting|block|ปัญหา/i.test(String(row.status||''));}
function reportIssueResolved(row){return /resolved|closed|ปิด|แก้แล้ว|เสร็จ/i.test(String(row.status||''));}
function reportDeptMetrics(code,scope=reportScope(),activities=reportActivityRows(),issues=reportIssueRows()){
  const work=scope.filter(t=>t.dept===code),activity=activities.filter(r=>r.department_code===code),problem=issues.filter(p=>p.dept===code);
  const workDone=work.filter(t=>t.status==='done'),activityDone=activity.filter(reportActivityDone),issueDone=problem.filter(reportIssueResolved);
  const workFollowup=work.filter(t=>t.status==='block'||dashboardIsOverdue(t)).length;
  const activityFollowup=activity.filter(reportActivityNeedsFollowup).length;
  const issueFollowup=problem.filter(p=>!reportIssueResolved(p)).length;
  const hours=activity.reduce((sum,row)=>sum+activityCountedDuration(row),0);
  return {code,work,activity,problem,total:work.length+activity.length+problem.length,completed:workDone.length+activityDone.length+issueDone.length,followup:workFollowup+activityFollowup+issueFollowup,hours,
    sources:[work.length&&`งาน ${nf(work.length)}`,activity.length&&`กิจกรรม ${nf(activity.length)}`,problem.length&&`ปัญหา ${nf(problem.length)}`].filter(Boolean)};
}
function openReportDepartment(code){
  if(code==='GRAPHIC'&&GRAPHIC_JOBS.length){GF.project='';GF.status='';go('graphic');return;}
  if(ACTIVITY_READY&&ACTIVITY_ROWS.some(r=>r.department_code===code)){ACTIVITY_FILTER.department=code;ACTIVITY_PAGE=1;go('activity');return;}
  if(PROBLEMS.some(p=>p.dept===code)){PF.project='';PF.cat='';PF.prio='';PF.status='';PF.q='';go('problems');return;}
  openDashboardDepartment(code);
}
function exportCurrent(){
  const base=VIEW==='myTasks'?myTasks():boardAllWork();
  const list=applyFilters(base);
  if(!list.length){toast('ไม่มีงานให้ส่งออก (ลองล้างตัวกรอง)','info');return;}
  downloadCSV(list,(VIEW==='myTasks'?'my-tasks':'tasks')+'-'+list.length+'.csv');}
function exportReportExcel(){
  const scope=reportScope(),activities=reportActivityRows(),issues=reportIssueRows();const rows=[];
  rows.push(['รายงานสรุป Company Hub']);rows.push(['ช่วง',{today:'วันนี้',week:'สัปดาห์นี้',month:'เดือนนี้',quarter:'ไตรมาสนี้'}[REP_PERIOD]]);rows.push(['จัดทำโดย',ACCESS_PROFILE?.display_name||ACCESS_PROFILE?.email||'']);rows.push([]);
  rows.push(['[ Scorecard รายแผนก ]']);
  rows.push(['แผนก','คะแนน KPI','รายการรวม','งาน Production','Daily Activity','ปัญหาหน้างาน','เสร็จ/ปิดแล้ว','ต้องติดตาม','ชั่วโมงที่นับได้','แหล่งข้อมูล']);
  reportDepts().forEach(c=>{const m=reportDeptMetrics(c,scope,activities,issues);
    rows.push([deptName(c),KPI[c]?deptScore(c)+'/100':'ยังไม่ตั้ง KPI',m.total,m.work.length,m.activity.length,m.problem.length,m.completed,m.followup,m.hours.toFixed(2),m.sources.join(' | ')||'ยังไม่มีข้อมูล']);});
  rows.push([]);rows.push(['[ รายการงานทั้งหมด รวม Graphic Production ]']);
  rows.push(['แหล่ง','รหัส','งาน','แผนก','ผู้รับผิดชอบ','สถานะ','ความสำคัญ','กำหนดส่ง']);
  scope.forEach(t=>rows.push([t._source==='graphic'?'Graphic Production':'Board',t._source==='graphic'?('G-'+t.jobNo):t.id,t.title,deptName(t.dept),workOwner(t),STATUS[t.status]?.t||t.status,PRIO[t.prio]?.t||t.prio,t.dueAt||t.due||'']));
  rows.push([]);rows.push(['[ Daily Activity ]']);rows.push(['วันที่','แผนก','พนักงาน','กิจกรรม','สถานะ','ชั่วโมง','ผลตรวจเวลา']);
  activities.forEach(a=>rows.push([a.activity_date,deptName(a.department_code),a.employee_name,a.activity,a.status,activityCountedDuration(a).toFixed(2),a.time_flag]));
  downloadRows(rows,'report-'+REP_PERIOD+'.csv');}
function printReport(){toast('เปิดหน้าต่างพิมพ์ / บันทึกเป็น PDF');setTimeout(()=>window.print(),200);}
function copyReportSummary(){const d=reportDepts(),work=reportScope(),activities=reportActivityRows(d),issues=reportIssueRows(d),graphic=work.filter(t=>t._source==='graphic');const text=`Company Hub: ${d.map(deptName).join(', ')} | งาน ${work.length} | Graphic ${graphic.length} | กิจกรรม ${activities.length} | ปัญหาหน้างาน ${issues.length}`;navigator.clipboard?.writeText(text).then(()=>toast('คัดลอกสรุปแล้ว')).catch(()=>toast('ไม่สามารถคัดลอกได้','info'));}

/* ===== Date filter helper ===== */
const d2=s=>s?(String(s).length===10?String(s):TODAY_ISO.slice(0,4)+'-'+s):'';

/* ===== Voice command (Web Speech API) ===== */
function speechOK(){return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;}
function makeRec(){const R=window.SpeechRecognition||window.webkitSpeechRecognition;const r=new R();r.lang='th-TH';r.interimResults=false;r.maxAlternatives=1;return r;}
function voiceCommand(){
  if(!speechOK()){toast('เบราว์เซอร์นี้ไม่รองรับสั่งงานด้วยเสียง — แนะนำใช้ Google Chrome','info');return;}
  const r=makeRec(),btn=document.getElementById('micBtn');
  toast('🎤 กำลังฟัง... พูดคำสั่งได้เลย เช่น "สร้างงาน..." "ไปบอร์ด" "กรองแผนกกราฟิก" "ส่งออก"','info');
  btn.classList.add('listening');
  r.onresult=e=>interpretCommand(e.results[0][0].transcript);
  r.onerror=()=>toast('ไม่ได้ยินเสียง หรือยังไม่ได้อนุญาตไมโครโฟน','info');
  r.onend=()=>btn.classList.remove('listening');
  r.start();
}
function interpretCommand(txt){
  toast('🎙️ ได้ยิน: "'+txt+'"');const s=txt.toLowerCase();
  const dep=DEPTS.find(d=>s.includes(d.name.toLowerCase())||s.includes(d.code.toLowerCase()));
  if(/สร้างงาน|เพิ่มงาน|มอบงาน|สั่งงาน/.test(s)){openCompose();setTimeout(()=>{const el=document.getElementById('cmpIn');if(el){el.value=normSp(txt);aiCompose(isExecutiveRole()?'GRAPHIC':currentDept());}},150);return;}
  if(/ติดปัญหา|มีปัญหา|ค้าง/.test(s)){clearAllFilters();F.status='block';go('board');toast('กรองงานติดปัญหา');return;}
  if(/รอตรวจ|รออนุมัติ/.test(s)){clearAllFilters();F.status='review';go('board');toast('กรองงานรอตรวจ');return;}
  if(/รายงาน|สรุป/.test(s)){go('reports');return;}
  if(/ภาพรวม|แดชบอร์ด|หน้าแรก/.test(s)){go('dash');return;}
  if(/ไทม์ไลน์|ปฏิทิน|timeline/.test(s)){go('timeline');return;}
  if(/คลังความรู้|ความรู้|knowledge/.test(s)){go('kb');return;}
  if(/คู่มือ|sop|ขั้นตอน/.test(s)){go('sop');return;}
  if(/ประกาศ/.test(s)){go('ann');return;}
  if(/ถามข้อมูล|talk|วิเคราะห์/.test(s)){go('talk');return;}
  if(/ส่งออก|export|ดาวน์โหลด/.test(s)){go('board');setTimeout(exportCurrent,200);return;}
  if(dep&&/กรอง|แผนก|ดู/.test(s)){F.dept=dep.code;go('board');toast('กรองแผนก '+dep.name);return;}
  if(dep){F.dept=dep.code;go('board');toast('กรองแผนก '+dep.name);return;}
  F.q=txt;go('board');toast('ค้นหา: '+txt);
}
function voiceDictate(targetId){
  if(!speechOK()){toast('เบราว์เซอร์นี้ไม่รองรับเสียง — ใช้ Chrome','info');return;}
  const r=makeRec();toast('🎤 กำลังฟัง... พูดรายละเอียดงาน','info');
  r.onresult=e=>{const el=document.getElementById(targetId);if(el)el.value=(el.value?el.value+' ':'')+e.results[0][0].transcript;};
  r.start();
}

/* ===== ผู้รับผิดชอบหลายคน + กลุ่ม (People Picker) ===== */
const assigneesOf=t=>(t.assignees&&t.assignees.length)?t.assignees:[t.assignee];
function avStack(ids){return `<span style="display:inline-flex;vertical-align:middle">${ids.slice(0,4).map((id,i)=>`<span class="mini" style="background:${u(id).c};margin-left:${i?-8:0}px;border:2px solid #fff">${esc(u(id).s)}</span>`).join('')}${ids.length>4?`<span class="mini" style="background:#9aa7bd;margin-left:-8px;border:2px solid #fff">+${ids.length-4}</span>`:''}</span>`;}
let PICK=new Set();
let PICK_QUERY='';
let PICK_DEPT='';
let PICK_POSITION='';
function assigneeProfile(id){return TASK_PROFILES.find(x=>x.id===id)||{};}
function assigneeDepartments(id){const p=assigneeProfile(id);return [...new Set((p.department_codes||[p.department_code]).filter(Boolean))];}
function assigneePositionKey(id){
  const p=assigneeProfile(id);
  return typeof accessPersonLevel==='function'?accessPersonLevel(p):(['lead','exec','admin'].includes(p.role)?'lead':'staff');
}
function assigneePositionLabel(id){
  const type=assigneePositionKey(id);
  return type==='lead'?'หัวหน้า':'พนักงาน';
}
function assigneeDepartmentOptions(){
  const present=new Set(ASSIGNABLE.flatMap(assigneeDepartments));
  return DEPTS.filter(d=>present.has(d.code)).map(d=>`<option value="${esc(d.code)}" ${PICK_DEPT===d.code?'selected':''}>${esc(d.name)}</option>`).join('');
}
function assigneePositionOptions(){
  const seen=new Map();
  ASSIGNABLE.filter(id=>!PICK_DEPT||assigneeDepartments(id).includes(PICK_DEPT)).forEach(id=>seen.set(assigneePositionKey(id),assigneePositionLabel(id)));
  return [...seen.entries()].sort((a,b)=>a[1].localeCompare(b[1],'th')).map(([value,label])=>`<option value="${esc(value)}" ${PICK_POSITION===value?'selected':''}>${esc(label)}</option>`).join('');
}
function assigneeSearchText(id){
  const p=assigneeProfile(id),departments=assigneeDepartments(id);
  return [shortName(id),p.display_name,p.email,p.position_title,assigneePositionLabel(id),...departments,...departments.map(deptName)].filter(Boolean).join(' ').normalize('NFKC').toLowerCase();
}
function filterAssigneePicker(query=''){
  PICK_QUERY=String(query||'').normalize('NFKC').toLowerCase().trim();
  const rows=[...document.querySelectorAll('#pickerBox [data-assignee-search]')];let visible=0;
  rows.forEach(row=>{const queryMatch=!PICK_QUERY||row.dataset.assigneeSearch.includes(PICK_QUERY),deptMatch=!PICK_DEPT||row.dataset.assigneeDepartments.split('|').includes(PICK_DEPT),positionMatch=!PICK_POSITION||row.dataset.assigneePosition===PICK_POSITION,show=queryMatch&&deptMatch&&positionMatch;row.hidden=!show;if(show)visible++;});
  const result=document.getElementById('pickerSearchResult');if(result)result.textContent=`แสดง ${visible} จาก ${rows.length} คน`;
  const empty=document.getElementById('pickerSearchEmpty');if(empty)empty.hidden=visible>0;
}
function setAssigneeDepartment(value){PICK_DEPT=value;PICK_POSITION='';renderPicker();}
function setAssigneePosition(value){PICK_POSITION=value;filterAssigneePicker(PICK_QUERY);}
function renderPicker(){
  const box=document.getElementById('pickerBox');if(!box)return;const sel=[...PICK];
  box.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <b style="font-weight:500;font-size:12.5px">เลือกแล้ว ${sel.length} คน</b>
      ${sel.length?avStack(sel):'<span class="muted" style="font-size:12px">ยังไม่เลือก</span>'}
      ${sel.length?`<button class="tbtn sm" style="margin-left:auto" onclick="PICK.clear();renderPicker()">ล้าง</button>`:''}</div>
    <div style="margin-bottom:6px">${GROUPS.map(g=>`<button class="chip" onclick="pickGroup('${g.id}')">＋ ${g.name} (${g.members.length})</button>`).join('')}<button class="chip" onclick="pickVisiblePeople()">＋ เลือกทั้งหมดตามตัวกรอง</button></div>
    <div style="display:flex;gap:6px;margin:6px 0 8px"><input class="fin" id="grpName" placeholder="ตั้งชื่อกลุ่มจากคนที่เลือก" style="flex:1;padding:6px 10px"><button class="tbtn sm" onclick="saveGroupFromPick()">${sic('i-save')} บันทึกกลุ่ม</button></div>
    <div class="assignee-filterbar">
      <label>1. แผนก<select class="fin" id="assigneeDepartment" onchange="setAssigneeDepartment(this.value)"><option value="">ทุกแผนก</option>${assigneeDepartmentOptions()}</select></label>
      <label>2. ประเภทผู้ใช้งาน<select class="fin" id="assigneePosition" onchange="setAssigneePosition(this.value)"><option value="">ทั้งหมด</option>${assigneePositionOptions()}</select></label>
    </div>
    <div class="assignee-search"><label for="assigneeSearch">3. ค้นหาชื่อหรืออีเมล</label><input class="fin" type="search" id="assigneeSearch" value="${esc(PICK_QUERY)}" placeholder="พิมพ์ชื่อหรืออีเมล" autocomplete="off" oninput="filterAssigneePicker(this.value)"><small id="pickerSearchResult"></small></div>
    <div class="assignee-person-grid">
      ${ASSIGNABLE.map(a=>{const departments=assigneeDepartments(a);return `<label class="checkbox assignee-person" data-assignee-id="${esc(a)}" data-assignee-search="${esc(assigneeSearchText(a))}" data-assignee-departments="${esc(departments.join('|'))}" data-assignee-position="${esc(assigneePositionKey(a))}" style="${PICK.has(a)?'background:var(--blue-50);border-color:var(--blue-400)':''}"><input type="checkbox" ${PICK.has(a)?'checked':''} onchange="pickToggle('${a}')"><span class="mini" style="background:${u(a).c}">${u(a).s}</span><span><b>${esc(shortName(a))}</b><small>${esc(assigneePositionLabel(a))} · ${esc(departments.map(deptName).join(', ')||'ยังไม่กำหนดแผนก')}</small></span></label>`;}).join('')}
    </div><div id="pickerSearchEmpty" class="muted" hidden style="padding:12px 0;text-align:center">ไม่พบรายชื่อตามคำค้น</div>`;
  filterAssigneePicker(PICK_QUERY);
}
function pickToggle(id){PICK.has(id)?PICK.delete(id):PICK.add(id);renderPicker();}
function pickGroup(gid){const g=groupById(gid);g.members.forEach(m=>PICK.add(m));renderPicker();toast('เพิ่ม '+g.name+' ('+g.members.length+' คน)');}
function pickVisiblePeople(){const ids=[...document.querySelectorAll('#pickerBox [data-assignee-id]:not([hidden])')].map(row=>row.dataset.assigneeId);ids.forEach(id=>PICK.add(id));renderPicker();toast('เลือกเพิ่มตามตัวกรอง '+ids.length+' คน');}
function pickAllPeople(){pickVisiblePeople();}
function saveGroupFromPick(){if(PICK.size<2){toast('เลือกอย่างน้อย 2 คนเพื่อตั้งกลุ่ม','info');return;}const name=normSp(val('grpName'));if(!name){toast('กรุณาตั้งชื่อกลุ่ม','info');return;}GROUPS.push({id:'g'+GROUPS.length,name,dept:null,members:[...PICK]});saveState();renderPicker();toast('บันทึกกลุ่ม "'+name+'" ('+PICK.size+' คน) แล้ว');}
function openAssigneePicker(taskId){
  const t=TASKS.find(x=>x.id===taskId);PICK=new Set(assigneesOf(t));PICK_QUERY='';PICK_DEPT=t.dept||'';PICK_POSITION='';
  showModal(`<div class="modal-h"><div><h3>เลือกผู้รับผิดชอบ</h3><div class="muted" style="font-size:11.5px">${t.id} · เลือกได้หลายคน หรือทั้งกลุ่ม</div></div><button class="x" onclick="openTask('${taskId}')">×</button></div>
    <div class="pad"><div id="pickerBox"></div><button class="tbtn primary" style="margin-top:12px" onclick="saveAssignees('${taskId}')">บันทึกผู้รับผิดชอบ</button></div>`);renderPicker();}
async function saveAssignees(id){const t=TASKS.find(x=>x.id===id);if(!PICK.size){toast('เลือกอย่างน้อย 1 คน','info');return;}
  const selected=[...PICK];if(CLOUD&&t.dbId){try{const current=new Set(assigneesOf(t)),toAdd=selected.filter(x=>!current.has(x)),toRemove=[...current].filter(x=>!selected.includes(x));if(toAdd.length){const added=await SB.from('task_assignees').insert(toAdd.map(user_id=>({task_id:t.dbId,user_id,assigned_by:ACCESS_PROFILE.id})));if(added.error)throw added.error;}if(toRemove.length){const removed=await SB.from('task_assignees').delete().eq('task_id',t.dbId).in('user_id',toRemove);if(removed.error)throw removed.error;}}catch(e){toast('บันทึกผู้รับผิดชอบไม่สำเร็จ · '+(e.message||e),'info');return;}}
  t.assignees=selected;t.assignee=t.assignees[0];
  logFeed('👥','#eef2ff',`<b>${shortName(ROLE_META[ROLE].u)}</b> ตั้งผู้รับผิดชอบ <b>${id}</b>: ${t.assignees.map(shortName).join(', ')}`);
  toast('บันทึกผู้รับผิดชอบ '+t.assignees.length+' คน');refresh();openTask(id);}

/* ===== AI วิเคราะห์คำสั่ง (เก่งขึ้น) ===== */
function addDays(n){const d=DFROM(TODAY_ISO);d.setDate(d.getDate()+n);return dateISO(d);}
function nextWeekday(target){const d=DFROM(TODAY_ISO);let diff=(target-d.getDay()+7)%7;if(diff===0)diff=7;d.setDate(d.getDate()+diff);return dateISO(d);}
function analyzeCommand(raw){
  const s=raw.toLowerCase();
  const dmap=[['GRAPHIC',/แบนเนอร์|ออกแบบ|กราฟิก|โลโก้|วิดีโอ|ภาพ|อาร์ต|โมชั่น/],['CRM',/โทร|ลูกค้า|retention|วินแบ็ก|win-?back|ดูแลลูกค้า|เติมเงิน/],['MKT',/คอนเทนต์|โพสต์|แคมเปญ|การตลาด|โฆษณา|engagement|โปรโมชั่น/],['FIN',/เบิก|โอน|การเงิน|สรุปเดือน|กระทบยอด|เงินสด/],['ADMIN',/แชท|ตอบลูกค้า|เคส|แอดมิน/],['QC',/ตรวจแชท|คุณภาพ|นายหน้า|บัญชีหน้าเว็บ|qc/]];
  let dept='GRAPHIC';for(const[c,re]of dmap){if(re.test(s)){dept=c;break;}}
  let prio='mid';if(/ด่วน|เร่ง|ทันที|วันนี้/.test(s))prio='high';else if(/ไม่เร่ง|เมื่อว่าง|ไม่รีบ/.test(s))prio='low';
  let due=addDays(5);const wd={'อาทิตย์':0,'จันทร์':1,'อังคาร':2,'พุธ':3,'พฤหัส':4,'ศุกร์':5,'เสาร์':6};const mIn=s.match(/ภายใน\s*(\d+)\s*วัน/);
  if(/วันนี้/.test(s))due=addDays(0);else if(/พรุ่งนี้/.test(s))due=addDays(1);else if(/มะรืน/.test(s))due=addDays(2);
  else if(/สัปดาห์หน้า/.test(s))due=addDays(7);else if(/สิ้นเดือน/.test(s)){const d=DFROM(TODAY_ISO);d.setMonth(d.getMonth()+1,0);due=dateISO(d);}else if(mIn)due=addDays(+mIn[1]);
  else{for(const k in wd){if(s.includes(k)){due=nextWeekday(wd[k]);break;}}}
  let title=normSp(raw.replace(/ส่ง\s*(วันนี้|พรุ่งนี้|มะรืน|สัปดาห์หน้า|สิ้นเดือน|ภายใน\s*\d+\s*วัน)/g,'').replace(/(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์)นี้?/g,'').replace(/ภายใน\s*\d+\s*วัน|ด่วนที่สุด|เร่งด่วน|ด่วน/g,''))||raw;
  const grp=GROUPS.find(g=>g.dept===dept);const members=CLOUD?TASK_PROFILES.filter(p=>(p.department_codes||[p.department_code]).includes(dept)).map(p=>p.id):(grp?grp.members:['a']);
  const load=id=>TASKS.filter(t=>assigneesOf(t).includes(id)&&t.status!=='done').length;
  const assignee=members.slice().sort((a,b)=>load(a)-load(b))[0]||ACCESS_PROFILE?.id||ASSIGNABLE[0]||'';
  const sop=SOPS.find(x=>x.dept===dept);const checklist=sop?sop.steps.slice(0,4):['ดำเนินการ','ตรวจสอบ','ส่งอนุมัติ'];
  const desc='ดำเนินการ "'+title+'" ตามมาตรฐานแผนก'+deptName(dept)+' พร้อมตรวจสอบความถูกต้องก่อนส่ง';
  const kb=KB.find(k=>k.dept===dept);
  const slaN=Math.max(1,Math.round((DFROM(due)-DFROM(TODAY_ISO))/86400000));
  return {title,dept,prio,due,assignee,checklist,desc,kb,sla:{n:slaN,unit:'day'}};
}


/* ============================================================
   SHELL
============================================================ */
function setRole(r){
  ROLE=r; F={q:'',source:'',dept:'',status:'',prio:'',assignee:'',period:'',dateFrom:'',dateTo:'',reportFrom:'',reportTo:'',group:'dept',sort:'due',dir:1};
  REP_GROUP='';REP_DEPT='';REP_MONTH='08';TRACK_GROUP='';TRACK_DEPT='';TRACK_LEVEL='';TRACK_MONTH='08';
  const m=ROLE_META[r], usr=u(m.u);
  sideAvatar.textContent=usr.s; topAvatar.textContent=usr.s;
  sideName.textContent=shortName(m.u); sideRole.textContent=m.label;
  buildNav(); go(m.home); updateBell();
  setTimeout(()=>showAckPopup(false),400);
}
/* ===== Navigation groups + Simple mode ===== */
const NAVGROUPS=[
 {label:'งาน', items:['dash','myTasks','board','graphic','timeline','problems','activity']},
 {label:'วัดผล & รายงาน', items:['kpi','reports','monthly','tracker']},
 {label:'องค์กร & ความรู้', items:['org','users','sop','kb','ann','talk']},
];
const ROLE_ALLOW={
 staff:['myTasks','board','graphic','problems','activity','org','sop','kb','ann','talk'],
 lead:['dash','myTasks','board','graphic','timeline','problems','activity','kpi','reports','monthly','tracker','org','sop','kb','ann','talk'],
 exec:['dash','board','graphic','timeline','problems','activity','kpi','reports','monthly','tracker','org','users','sop','kb','ann','talk'],
};
const SIMPLE_ALLOW={
 staff:['myTasks','board','graphic','ann'],
 lead:['dash','board','graphic','kpi','reports','ann'],
 exec:['dash','board','graphic','kpi','reports','ann'],
};
let SIMPLE=false;
function toggleSimple(){SIMPLE=!SIMPLE;try{localStorage.setItem('ch_simple',SIMPLE?'1':'0')}catch(e){}document.body.classList.toggle('simple',SIMPLE);
  const allow=(SIMPLE?SIMPLE_ALLOW:ROLE_ALLOW)[ROLE]||[];
  if(!allow.includes(VIEW)){go(allow.includes('dash')?'dash':(allow[0]||'board'));}else{buildNav();}
  toast(SIMPLE?'เปิดโหมดง่าย — แสดงเฉพาะเมนูหลัก':'แสดงทุกเมนูแล้ว');}
function buildNav(){
  let allow=(SIMPLE?SIMPLE_ALLOW:ROLE_ALLOW)[ROLE]||Object.keys(NAV);
  if(!canViewDept('GRAPHIC'))allow=allow.filter(k=>k!=='graphic');
  if(!CLOUD||!canAdminAccess())allow=allow.filter(k=>k!=='users');
  let html=`<button type="button" class="navitem simpletgl" onclick="toggleSimple()"><span class="ic">${sic(SIMPLE?'i-grid':'i-check')}</span>${SIMPLE?'โหมดครบ (ทุกเมนู)':'โหมดง่าย (เมนูหลัก)'}</button>`;
  NAVGROUPS.forEach(g=>{
    const its=g.items.filter(k=>allow.includes(k));
    if(!its.length)return;
    if(!SIMPLE) html+=`<div class="navgroup">${g.label}</div>`;
    html+=its.map(k=>{
      const badge=k==='myTasks'?`<span class="badge">${myTasks().filter(t=>t.status!=='done').length}</span>`:'';
      return `<button type="button" class="navitem ${k===VIEW?'active':''}" data-view="${k}" onclick="navGo('${k}')"><span class="ic">${sic(NAV[k].ic)}</span>${NAV[k].t}${badge}</button>`;
    }).join('');
  });
  nav.innerHTML=html;
  const visibleCodes=new Set(visibleDepartmentCodes());
  const visibleDeptList=DEPTS.filter(d=>visibleCodes.has(d.code));
  deptLabel.style.display=visibleDeptList.length?'':'none';
  deptNav.innerHTML=visibleDeptList.map(d=>`<button type="button" class="navitem" style="padding:6px 12px" onclick="goBoardFiltered({dept:'${d.code}'})"><span class="ic" style="color:${d.color}">●</span>${d.name}</button>`).join('');
}
function go(v,arg){main.classList.remove('graphic-board-view');VIEW=v;if(v==='board')BOARD_DEPT=arg||'';document.body.classList.remove('nav-open');buildNav();updateBell();window.scrollTo(0,0);RENDER[v](arg);if(typeof saveState==='function')saveState();}
function navGo(v){F={...F,q:'',source:v==='timeline'?'work':'',dept:'',status:'',prio:'',assignee:'',period:'',dateFrom:'',dateTo:'',reportFrom:'',reportTo:''};go(v);}
function myTasks(){const m=ROLE_META[ROLE].u;if(isExecutiveRole())return TASKS;return TASKS.filter(t=>assigneesOf(t).includes(m)||t.creator===m);}
function crumb(...parts){return `<div class="crumb">${parts.map((p,i)=>i===parts.length-1?`<b>${p}</b>`:p).join(' / ')}</div>`;}

/* ============================================================
   CHART HELPERS
============================================================ */
function donut(data,total,centerLabel){
  const R=54,C=2*Math.PI*R;let off=0;const segs=data.filter(d=>d.value>0).map(d=>{
    const frac=d.value/(total||1),len=frac*C,s=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${d.color}" stroke-width="20" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;off+=len;return s;}).join('');
  return `<svg width="140" height="140" viewBox="0 0 140 140">${segs}
    <text x="70" y="66" text-anchor="middle" font-size="26" font-weight="600" fill="#182338">${total}</text>
    <text x="70" y="86" text-anchor="middle" font-size="11" fill="#67769a">${centerLabel}</text></svg>`;
}
function goBoardFiltered(o={}){F={...F,q:'',source:'',dept:'',status:'',prio:'',assignee:'',period:'',dateFrom:'',dateTo:'',reportFrom:'',reportTo:''};Object.assign(F,o);go('board');}
function hbars(rows,unit=''){const max=Math.max(...rows.map(r=>r.v),1);
  return rows.map(r=>`<div class="hbar${r.click?' hlink':''}" ${r.click?`onclick="${r.click}" title="ดูรายละเอียด"`:''}><span style="display:flex;align-items:center;gap:6px">${r.dot?`<span class="dot" style="background:${r.dot}"></span>`:''}${r.label}</span>
    <span class="track"><i style="width:${Math.max(r.v/max*100,2)}%;${r.color?`background:${r.color}`:''}"></i></span>
    <span class="num">${nf(r.v)}${unit}</span></div>`).join('');
}
function sparkline(pts,w=260,h=64){
  const max=Math.max(...pts),min=Math.min(...pts)-2,rng=(max-min)||1;
  const step=w/(pts.length-1);
  const xy=pts.map((p,i)=>[i*step,h-((p-min)/rng)*(h-10)-5]);
  const line=xy.map((c,i)=>(i?'L':'M')+c[0].toFixed(1)+' '+c[1].toFixed(1)).join(' ');
  const area=line+` L${w} ${h} L0 ${h} Z`;
  const dots=xy.map(c=>`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3.5" fill="#2158c8"/>`).join('');
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2158c8" stop-opacity=".18"/><stop offset="1" stop-color="#2158c8" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#g)"/><path d="${line}" fill="none" stroke="#2158c8" stroke-width="2"/>${dots}</svg>`;
}
function statusCounts(list){const c={todo:0,doing:0,review:0,block:0,done:0};list.forEach(t=>c[t.status]++);return c;}
function statusDonutBlock(list,dashboard=false){
  const c=statusCounts(list),total=list.length;
  const data=Object.keys(c).map(k=>({key:k,label:STATUS[k].t,value:c[k],color:STATUS[k].c}));
  return `<div class="donut-wrap">${donut(data,total,'งานทั้งหมด')}
    <div style="flex:1;min-width:150px">${data.map(d=>`<div class="legrow" onclick="${dashboard?`openDashboardStatus('${d.key}')`:`goBoardFiltered({status:'${d.key}'})`}" title="ดูงานสถานะนี้" style="display:flex;align-items:center;gap:8px;font-size:12.5px">
      <span class="dot" style="background:${d.color}"></span><span style="flex:1">${d.label}</span><b>${d.value}</b>
      <span class="muted" style="width:38px;text-align:right">${total?Math.round(d.value/total*100):0}%</span></div>`).join('')}</div></div>`;
}

/* ============================================================
   FILTER SYSTEM
============================================================ */
function applyFilters(list){
  let r=list.filter(t=>{
    if(F.q){const q=F.q.toLowerCase();if(!(t.title.toLowerCase().includes(q)||t.id.toLowerCase().includes(q)||t.tags.join(' ').toLowerCase().includes(q)))return false;}
    if(F.source==='work'&&!['task','graphic'].includes(t._source))return false;
    if(F.source&&F.source!=='work'&&t._source!==F.source)return false;
    if(F.dept&&t.dept!==F.dept)return false;
    if(F.status&&t.status!==F.status)return false;
    if(F.prio&&t.prio!==F.prio)return false;
    if(F.assignee&&t.assignee!==F.assignee)return false;
    if(F.period==='today'&&d2(t.due)!==TODAY_ISO)return false;
    if(F.period==='overdue'&&!dashboardIsOverdue(t))return false;
    if(F.period==='active'&&t.status==='done')return false;
    if(F.period==='missingDue'&&(t._deadline===false||t.status==='done'||dashboardDueAt(t)))return false;
    if(F.reportFrom&&!integrityInRange(integrityWorkDate(t),{from:F.reportFrom,to:F.reportTo}))return false;
    if(F.dateFrom&&d2(t.due)<F.dateFrom)return false;
    if(F.dateTo&&d2(t.start)>F.dateTo)return false;
    return true;
  });
  const key=F.sort;
  r.sort((a,b)=>{let x,y;
    if(key==='prio'){const o={high:0,mid:1,low:2};x=o[a.prio];y=o[b.prio];}
    else if(key==='status'){const o=Object.keys(STATUS);x=o.indexOf(a.status);y=o.indexOf(b.status);}
    else if(key==='spent'){x=a.spent;y=b.spent;}
    else {x=a[key];y=b[key];}
    return (x>y?1:x<y?-1:0)*F.dir;});
  return r;
}
function activeFilterChips(){
  const chips=[];
  const add=(k,label,val)=>chips.push(`<button class="fchip"><b>${label}:</b> ${val} <span class="rm" onclick="clearFilter('${k}')">✕</span></button>`);
  if(F.q)add('q','ค้นหา',F.q);
  if(F.source)add('source','ประเภท',F.source==='work'?'งานตามกำหนด':boardSourceLabel({_source:F.source}));
  if(F.dept)add('dept','แผนก',deptName(F.dept));
  if(F.status)add('status','สถานะ',STATUS[F.status].t);
  if(F.prio)add('prio','ความสำคัญ',PRIO[F.prio].t);
  if(F.assignee)add('assignee','ผู้รับผิดชอบ',shortName(F.assignee));
  if(F.period)add('period','ช่วง',{today:'วันนี้',overdue:'เกินกำหนด',active:'ที่ยังไม่เสร็จ'}[F.period]);
  if(F.dateFrom)add('dateFrom','ตั้งแต่',fmtDate(F.dateFrom));
  if(F.dateTo)add('dateTo','ถึง',fmtDate(F.dateTo));
  if(!chips.length)return '';
  return `<div class="chips">${chips.join('')}<button class="fchip" style="background:#fde7ea;color:#b01a30" onclick="clearAllFilters()">ล้างทั้งหมด</button></div>`;
}
function setF(k,v){F[k]=v;RENDER[VIEW](BOARD_DEPT);}
function clearFilter(k){F[k]='';RENDER[VIEW](BOARD_DEPT);}
function clearAllFilters(){F={...F,q:'',source:VIEW==='timeline'?'work':'',dept:'',status:'',prio:'',assignee:'',period:'',dateFrom:'',dateTo:'',reportFrom:'',reportTo:''};RENDER[VIEW](BOARD_DEPT);}
function toggleSort(k){if(F.sort===k)F.dir*=-1;else{F.sort=k;F.dir=1;}RENDER[VIEW](BOARD_DEPT);}
function filterBarLite(ph){
  const opt=(cur,v,txt)=>`<option value="${v}" ${cur===v?'selected':''}>${txt}</option>`;
  return `<div class="filterbar">
    <div class="fsearch"><input placeholder="${ph||'ค้นหา'}" value="${F.q}" oninput="F.q=this.value;clearTimeout(window._t);window._t=setTimeout(()=>RENDER[VIEW](),250)"></div>
    <div class="fsel"><label>แผนก</label><select onchange="setF('dept',this.value)">${opt(F.dept,'','ทั้งหมด')}${DEPTS.map(d=>opt(F.dept,d.code,d.name)).join('')}</select></div>
    ${(F.q||F.dept)?`<button class="tbtn sm" onclick="clearAllFilters()">ล้างตัวกรอง</button>`:''}
  </div>`;
}

function filterBar(lockDept){
  const assignees=[...new Set((VIEW==='myTasks'?myTasks():boardAllWork()).map(t=>t.assignee).filter(Boolean))];
  const opt=(cur,val,txt)=>`<option value="${esc(val)}" ${cur===val?'selected':''}>${esc(txt)}</option>`;
  return `<div class="filterbar">
    <div class="fsearch"><input placeholder="ค้นหางาน / รหัส / แท็ก" value="${F.q}" oninput="F.q=this.value;clearTimeout(window._t);window._t=setTimeout(()=>RENDER[VIEW](BOARD_DEPT),250)"></div>
    <div class="fsel"><label>ประเภทข้อมูล</label><select onchange="setF('source',this.value)">${opt(F.source,'','ทั้งหมด')}${opt(F.source,'work','งานตามกำหนด')}${opt(F.source,'graphic','Graphic Production')}${opt(F.source,'task','งานที่มอบหมาย')}${opt(F.source,'issue','ศูนย์ปัญหา')}${opt(F.source,'activity','บันทึกกิจกรรม')}</select></div>
    ${lockDept?'':`<div class="fsel"><label>แผนก</label><select onchange="setF('dept',this.value)">${opt(F.dept,'','ทั้งหมด')}${DEPTS.map(d=>opt(F.dept,d.code,d.name)).join('')}</select></div>`}
    <div class="fsel"><label>สถานะ</label><select onchange="setF('status',this.value)">${opt(F.status,'','ทั้งหมด')}${Object.keys(STATUS).map(s=>opt(F.status,s,STATUS[s].t)).join('')}</select></div>
    <div class="fsel"><label>ความสำคัญ</label><select onchange="setF('prio',this.value)">${opt(F.prio,'','ทั้งหมด')}${Object.keys(PRIO).map(p=>opt(F.prio,p,PRIO[p].t)).join('')}</select></div>
    <div class="fsel"><label>ผู้รับผิดชอบ</label><select onchange="setF('assignee',this.value)">${opt(F.assignee,'','ทุกคน')}${assignees.map(a=>opt(F.assignee,a,shortName(a))).join('')}</select></div>
    <div class="fsel"><label>ช่วง</label><select onchange="setF('period',this.value)">${opt(F.period,'','ทั้งหมด')}${opt(F.period,'today','วันนี้')}${opt(F.period,'active','ยังไม่เสร็จ')}${opt(F.period,'overdue','เกินกำหนด')}</select></div>
    <div class="fsel fsel-date"><label>วันที่เริ่ม</label><input type="date" class="fdate" value="${F.dateFrom}" onchange="F.dateFrom=this.value;RENDER[VIEW](BOARD_DEPT)"></div>
    <div class="fsel fsel-date"><label>วันที่สิ้นสุด</label><input type="date" class="fdate" value="${F.dateTo}" onchange="F.dateTo=this.value;RENDER[VIEW](BOARD_DEPT)"></div>
    <button class="tbtn sm" onclick="exportCurrent()">${sic('i-export')} ส่งออก</button>
    <div class="fdiv"></div>
    <div class="fsel"><label>จัดกลุ่ม</label><select onchange="setF('group',this.value)">${opt(F.group,'dept','ตามแผนก')}${opt(F.group,'status','ตามสถานะ')}${opt(F.group,'assignee','ตามผู้รับผิดชอบ')}${opt(F.group,'none','ไม่จัดกลุ่ม')}</select></div>
    <div class="fsel"><label>เรียง</label><select onchange="setF('sort',this.value)">${opt(F.sort,'due','กำหนดส่ง')}${opt(F.sort,'prio','ความสำคัญ')}${opt(F.sort,'status','สถานะ')}${opt(F.sort,'spent','เวลาที่ใช้')}</select></div>
    <button class="tbtn sm" onclick="F.dir*=-1;RENDER[VIEW](BOARD_DEPT)">${F.dir>0?'▲':'▼'}</button>
  </div>`;
}

function boardDateSummary(list){
  const iso=v=>{const s=String(v||'').slice(0,10),y=String(TODAY_ISO||'').slice(0,4)||String(new Date().getFullYear());return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:/^\d{2}-\d{2}$/.test(s)?`${y}-${s}`:'';};
  const dates=list.flatMap(t=>[iso(t.start),iso(t.due)]).filter(Boolean).sort();
  const from=F.dateFrom||dates[0]||'',to=F.dateTo||dates[dates.length-1]||'';
  const text=from||to?`${from?fmtDate(from,true):'วันแรก'} – ${to?fmtDate(to,true):'วันล่าสุด'}`:'ยังไม่มีวันที่ในรายการ';
  const mode=F.dateFrom||F.dateTo?'ช่วงวันที่ที่เลือก':'ช่วงวันที่ของรายการที่แสดง';
  return `<div class="board-date-summary" role="status"><span>${sic('i-calendar')} ${mode}</span><strong>${esc(text)}</strong><small>วันเริ่มและวันส่งแสดงแยกในตารางด้านล่าง</small></div>`;
}

