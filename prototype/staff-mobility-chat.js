/* Department transfers + shared support room (pilot). */
NAV.supportChat={ic:'i-chat',t:'แชทแจ้งปัญหา'};
if(!NAVGROUPS[0].items.includes('supportChat'))NAVGROUPS[0].items.push('supportChat');
for(const role of Object.keys(ROLE_ALLOW)){
  if(!ROLE_ALLOW[role].includes('supportChat'))ROLE_ALLOW[role].push('supportChat');
}
for(const role of Object.keys(SIMPLE_ALLOW)){
  if(!SIMPLE_ALLOW[role].includes('supportChat'))SIMPLE_ALLOW[role].push('supportChat');
}


const mobilityOpenAccessUserBase=openAccessUser;
openAccessUser=function(profileId){
  mobilityOpenAccessUserBase(profileId);
  const departmentInput=document.getElementById('editUserDept');
  const saveButton=document.getElementById('saveAccessBtn');
  if(!departmentInput||!saveButton)return;
  departmentInput.dataset.originalDepartment=departmentInput.value||'';
  if(!departmentInput.parentElement.querySelector('[data-transfer-help]')){
    const help=document.createElement('div');help.dataset.transferHelp='1';help.className='muted';help.style.cssText='font-size:10.5px;margin-top:5px';help.textContent='หากต้องเปลี่ยนแผนก ให้ใช้ปุ่ม “ย้ายแผนก” เพื่อเก็บประวัติ';departmentInput.after(help);
  }
  if(!document.getElementById('department-transfer-actions')){
    const actions=document.createElement('div');actions.id='department-transfer-actions';actions.className='modal-actions';
    const history=document.createElement('button');history.type='button';history.className='tbtn';history.textContent='ประวัติแผนก';history.onclick=()=>openDepartmentHistory(profileId);
    const transfer=document.createElement('button');transfer.type='button';transfer.className='tbtn';transfer.textContent='ย้ายแผนก';transfer.onclick=()=>openDepartmentTransfer(profileId);
    saveButton.before(actions);actions.append(history,transfer,saveButton);
  }
};
const mobilitySaveAccessUserBase=saveAccessUser;
saveAccessUser=async function(profileId){
  const departmentInput=document.getElementById('editUserDept');
  if(departmentInput&&departmentInput.value!==departmentInput.dataset.originalDepartment){toast('กรุณาใช้ปุ่ม “ย้ายแผนก” เพื่อเก็บประวัติสังกัดเดิม','info');return;}
  return mobilitySaveAccessUserBase(profileId);
};
const mobilityOpenManualBase=openManual;
openManual=async function(...args){
  await mobilityOpenManualBase(...args);
  const heading=document.querySelector('.help-head h3');if(heading)heading.textContent=heading.textContent.replace(/เวอร์ชัน .*$/, 'เวอร์ชัน 15 ต.ค. 2569');
  const updated=document.querySelector('.help-head span');if(updated)updated.textContent=updated.textContent.replace(/ปรับปรุงล่าสุด .*? ·/, 'ปรับปรุงล่าสุด 15 ต.ค. 2569 ·');
};

let SUPPORT_CHAT_ROWS=[];
let SUPPORT_CHAT_READY=false;
let SUPPORT_CHAT_LOADING=false;
let SUPPORT_CHAT_CHANNEL=null;

function supportChatTime(value){
  if(!value)return '';
  try{return new Intl.DateTimeFormat('th-TH',{timeZone:ORG_TIMEZONE,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
  catch(e){return String(value);}
}
function supportChatTypeLabel(type){return type==='update'?'อัปเดตผล':'แจ้งปัญหา';}
function renderSupportChatMessages(){
  const list=document.getElementById('support-chat-list');if(!list)return;
  if(!SUPPORT_CHAT_ROWS.length){
    list.innerHTML='<div class="support-chat-empty"><b>ยังไม่มีข้อความ</b><span>เริ่มแจ้งปัญหาหรือส่งอัปเดตให้ทุกคนเห็นได้จากช่องด้านล่าง</span></div>';
    return;
  }
  list.innerHTML=SUPPORT_CHAT_ROWS.map(row=>{
    const mine=row.author_id===ACCESS_PROFILE?.id;
    return `<article class="support-message ${mine?'mine':''}" data-message-id="${esc(row.id)}">
      <div class="support-message-head"><b>${esc(row.author_name||'ผู้ใช้งาน')}</b><span>${esc(deptName(row.department_code)||row.department_code||'-')}</span><time>${esc(supportChatTime(row.created_at))}</time></div>
      <div class="support-message-type ${row.message_type==='update'?'update':''}">${supportChatTypeLabel(row.message_type)}</div>
      <p>${esc(row.body).replace(/\n/g,'<br>')}</p>
    </article>`;
  }).join('');
  requestAnimationFrame(()=>{list.scrollTop=list.scrollHeight;});
}
async function loadSupportChat(force=false){
  if(!SB||SUPPORT_CHAT_LOADING||SUPPORT_CHAT_READY&&!force)return;
  SUPPORT_CHAT_LOADING=true;
  try{
    const result=await SB.from('support_chat_messages')
      .select('id,author_id,author_name,department_code,message_type,body,created_at')
      .order('created_at',{ascending:false}).limit(300);
    if(result.error)throw result.error;
    SUPPORT_CHAT_ROWS=(result.data||[]).slice().reverse();SUPPORT_CHAT_READY=true;
    subscribeSupportChat();renderSupportChatMessages();
  }catch(error){
    const list=document.getElementById('support-chat-list');
    if(list)list.innerHTML=`<div class="support-chat-empty error"><b>ยังเปิดห้องแชทไม่ได้</b><span>${esc(error.message||'กรุณาให้ผู้ดูแลติดตั้ง Migration 039 แล้วลองใหม่')}</span></div>`;
  }finally{SUPPORT_CHAT_LOADING=false;}
}
function subscribeSupportChat(){
  if(!SB||SUPPORT_CHAT_CHANNEL)return;
  SUPPORT_CHAT_CHANNEL=SB.channel('company-support-chat')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'support_chat_messages'},payload=>{
      const row=payload.new;if(!row||SUPPORT_CHAT_ROWS.some(x=>x.id===row.id))return;
      SUPPORT_CHAT_ROWS.push(row);if(VIEW==='supportChat')renderSupportChatMessages();
    }).subscribe();
}
async function sendSupportChatMessage(){
  const input=document.getElementById('support-chat-body');
  const type=val('support-chat-type')||'problem';
  const body=(input?.value||'').trim();
  if(!body){toast('กรุณาพิมพ์รายละเอียดก่อนส่ง','info');input?.focus();return;}
  if(body.length>2000){toast('ข้อความยาวเกิน 2,000 ตัวอักษร','info');return;}
  const button=document.getElementById('support-chat-send');button.disabled=true;
  try{
    const result=await SB.from('support_chat_messages').insert({author_id:ACCESS_PROFILE.id,message_type:type,body}).select().single();
    if(result.error)throw result.error;
    if(result.data&&!SUPPORT_CHAT_ROWS.some(x=>x.id===result.data.id))SUPPORT_CHAT_ROWS.push(result.data);
    input.value='';renderSupportChatMessages();toast('ส่งข้อความแล้ว ทุกคนในระบบมองเห็น');
  }catch(error){toast('ส่งข้อความไม่สำเร็จ · '+(error.message||error),'info');}
  finally{button.disabled=false;}
}
function supportChatKeydown(event){
  if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendSupportChatMessage();}
}
RENDER.supportChat=function(){
  main.innerHTML=`${crumb('หน้าแรก','แชทแจ้งปัญหา')}
    <div class="page-h"><div><h1>แชทแจ้งปัญหา</h1><p>ห้องกลาง Company Hub · ผู้ใช้งานที่เปิดใช้งานทุกคนเห็นข้อความร่วมกัน</p>${sourceBadge('live','SUPABASE REALTIME','ข้อความใหม่แสดงอัตโนมัติ')}</div><button class="tbtn sm" onclick="loadSupportChat(true)">↻ โหลดใหม่</button></div>
    <div class="support-chat-notice"><b>เวอร์ชันทดสอบ</b><span>ใช้แจ้งปัญหาการใช้งานและติดตามผล ห้ามส่งรหัสผ่าน ข้อมูลลูกค้า หรือข้อมูลการเงินในห้องกลาง</span></div>
    <section class="card support-chat-card">
      <div id="support-chat-list" class="support-chat-list" aria-live="polite"><div class="support-chat-empty"><b>กำลังโหลดข้อความ…</b></div></div>
      <div class="support-chat-compose">
        <select id="support-chat-type" class="fin" aria-label="ประเภทข้อความ"><option value="problem">แจ้งปัญหา</option><option value="update">อัปเดตผล</option></select>
        <textarea id="support-chat-body" class="fin" maxlength="2000" rows="2" placeholder="พิมพ์ปัญหา ขั้นตอนที่ทำ และสิ่งที่ต้องการให้ช่วย…" onkeydown="supportChatKeydown(event)"></textarea>
        <button id="support-chat-send" class="tbtn primary" onclick="sendSupportChatMessage()">ส่งข้อความ</button>
      </div><div class="support-chat-hint">Enter เพื่อส่ง · Shift + Enter เพื่อขึ้นบรรทัดใหม่</div>
    </section>`;
  renderSupportChatMessages();loadSupportChat();
};

async function openDepartmentHistory(profileId){
  const user=ACCESS_USERS.find(x=>x.id===profileId);if(!user)return;
  showModal(`<div class="modal-h"><div><h3>${sic('i-users')} ประวัติการย้ายแผนก</h3><div class="muted" style="font-size:11.5px">${esc(user.display_name||user.email)}</div></div><button class="x" onclick="closeModal()">×</button></div><div class="pad"><div id="department-history-list" class="department-history-list"><div class="ai-note">กำลังโหลดประวัติ…</div></div></div>`);
  const holder=document.getElementById('department-history-list');
  try{
    const result=await SB.from('employee_department_history')
      .select('id,department_code,position_title,role,assigned_from,assigned_until,transfer_reason,created_at')
      .eq('profile_id',profileId).order('assigned_from',{ascending:false});
    if(result.error)throw result.error;
    const rows=result.data||[];
    holder.innerHTML=rows.length?rows.map((row,index)=>`<div class="department-history-row ${!row.assigned_until?'current':''}">
      <div class="department-history-dot"></div><div><div><b>${esc(deptName(row.department_code))}</b> <span class="pill">${row.assigned_until?'สิ้นสุดแล้ว':'ปัจจุบัน'}</span></div>
      <div class="muted">${esc(row.position_title||'-')} · ${esc(row.assigned_from)} ถึง ${esc(row.assigned_until||'ปัจจุบัน')}</div>
      ${row.transfer_reason?`<div class="department-history-reason">เหตุผล: ${esc(row.transfer_reason)}</div>`:''}</div></div>`).join(''):'<div class="ai-note">ยังไม่มีประวัติ ระบบจะสร้างรายการปัจจุบันเมื่อรัน Migration 039</div>';
  }catch(error){holder.innerHTML=`<div class="ai-note">โหลดประวัติไม่สำเร็จ · ${esc(error.message||error)}</div>`;}
}
function openDepartmentTransfer(profileId){
  const user=ACCESS_USERS.find(x=>x.id===profileId);if(!user)return;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:ORG_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  showModal(`<div class="modal-h"><div><h3>${sic('i-users')} ย้ายแผนก</h3><div class="muted" style="font-size:11.5px">${esc(user.display_name||user.email)} · จาก ${esc(deptName(user.department_code))}</div></div><button class="x" onclick="closeModal()">×</button></div><div class="pad">
    <div class="ai-note"><b>ข้อมูลเดิมไม่ถูกย้ายตาม</b> งาน กิจกรรม ปัญหา และ KPI ที่บันทึกในแผนกเดิมจะยังอยู่ในแผนกเดิม ระบบจะเปลี่ยนเฉพาะสังกัดปัจจุบันและเก็บประวัติช่วงเวลา</div>
    <div class="two"><div class="field"><label>แผนกใหม่ *</label><select class="fin" id="transferNewDept">${DEPTS.filter(d=>d.code!==user.department_code).map(d=>`<option value="${d.code}">${esc(d.name)}</option>`).join('')}</select></div><div class="field"><label>วันที่มีผล *</label><input class="fin" id="transferDate" type="date" max="${today}" value="${today}"></div></div>
    <div class="field"><label>ตำแหน่งในแผนกใหม่ *</label><input class="fin" id="transferPosition" maxlength="120" value="${esc(user.position_title||'')}"></div>
    <div class="field"><label>เหตุผลการย้าย *</label><textarea class="fin" id="transferReason" maxlength="500" rows="3" placeholder="เช่น ปรับโครงสร้างทีม หรือเปลี่ยนหน้าที่รับผิดชอบ"></textarea></div>
    <label class="transfer-keep"><input type="checkbox" id="transferKeepOld"> ยังคงให้มองเห็นแผนกเดิม <span class="muted">(ใช้เฉพาะผู้ที่ต้องทำงานข้ามแผนก)</span></label>
    <div class="modal-actions"><button class="tbtn" onclick="openDepartmentHistory('${profileId}')">ดูประวัติ</button><button id="transferDepartmentSave" class="tbtn primary" onclick="saveDepartmentTransfer('${profileId}')">ยืนยันการย้าย</button></div>
  </div>`);
}
async function saveDepartmentTransfer(profileId){
  const newDepartment=val('transferNewDept'),effectiveDate=val('transferDate'),position=(val('transferPosition')||'').trim(),reason=(val('transferReason')||'').trim(),keepOld=document.getElementById('transferKeepOld').checked;
  if(!newDepartment||!effectiveDate||!position||reason.length<3){toast('กรุณากรอกแผนก วันที่ ตำแหน่ง และเหตุผลให้ครบ','info');return;}
  const user=ACCESS_USERS.find(x=>x.id===profileId);
  if(!confirm(`ย้าย ${user?.display_name||'พนักงาน'} จาก ${deptName(user?.department_code)} ไป ${deptName(newDepartment)} โดยมีผล ${effectiveDate} ใช่หรือไม่?`))return;
  const button=document.getElementById('transferDepartmentSave');button.disabled=true;
  try{
    const result=await SB.rpc('transfer_employee_department',{p_profile_id:profileId,p_new_department:newDepartment,p_effective_date:effectiveDate,p_reason:reason,p_new_position_title:position,p_keep_old_visibility:keepOld});
    if(result.error)throw result.error;
    closeModal();ACCESS_USERS_READY=false;await loadAccessUsers(true);toast('ย้ายแผนกแล้ว และเก็บประวัติแผนกเดิมไว้');
  }catch(error){button.disabled=false;toast('ย้ายแผนกไม่สำเร็จ · '+(error.message||error),'info');}
}

MANUAL.push({id:'support-chat',ic:'i-chat',tt:'แชทแจ้งปัญหา',img:null,html:`<p>ห้องกลางสำหรับแจ้งปัญหาการใช้งาน Company Hub ทุกบัญชีที่เปิดใช้งานเห็นข้อความร่วมกัน</p><ol><li>เลือก <b>แจ้งปัญหา</b> หรือ <b>อัปเดตผล</b></li><li>ระบุหน้าที่พบปัญหา ขั้นตอนที่ทำ และผลที่เกิดขึ้น แล้วกด <b>ส่งข้อความ</b></li><li>ห้ามส่งรหัสผ่าน ข้อมูลลูกค้า หรือข้อมูลการเงินในห้องกลาง</li></ol>`});
MANUAL.push({id:'department-transfer',ic:'i-users',tt:'ย้ายแผนกและดูประวัติ',img:null,html:`<p>ผู้บริหารหรือผู้ดูแลระบบใช้เมนูจัดการพนักงานเพื่อย้ายสังกัด</p><ol><li>เลือกพนักงานแล้วกด <b>ย้ายแผนก</b></li><li>ระบุแผนกใหม่ วันที่มีผล ตำแหน่ง และเหตุผล</li><li>งานและข้อมูลที่เคยบันทึกยังอยู่ในแผนกเดิม ส่วนสิทธิ์ปัจจุบันเปลี่ยนไปยังแผนกใหม่</li><li>กด <b>ประวัติแผนก</b> เพื่อตรวจช่วงเวลาย้อนหลัง</li></ol>`});
