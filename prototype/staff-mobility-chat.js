/* Department transfers + shared support room (pilot). */
NAV.supportChat={ic:'i-chat',t:'ข้อความ'};
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
  const heading=document.querySelector('.help-head h3');if(heading)heading.textContent=heading.textContent.replace(/เวอร์ชัน .*$/, 'เวอร์ชัน 16 ต.ค. 2569');
  const updated=document.querySelector('.help-head span');if(updated)updated.textContent=updated.textContent.replace(/ปรับปรุงล่าสุด .*? ·/, 'ปรับปรุงล่าสุด 16 ต.ค. 2569 ·');
};

let SUPPORT_CHAT_ROWS=[];
let SUPPORT_CHAT_ROOMS=[];
let SUPPORT_CHAT_MEMBERS=[];
let SUPPORT_CHAT_DIRECTORY=[];
let SUPPORT_CHAT_ROOM_ID='';
let SUPPORT_CHAT_LOADING=false;
let SUPPORT_CHAT_CHANNEL=null;
let SUPPORT_CHAT_GLOBAL_CHANNEL=null;
let SUPPORT_CHAT_PENDING_FILE=null;
const SUPPORT_CHAT_ATTACHMENT_URLS=new Map();
const SUPPORT_CHAT_UNREAD=new Map();
let SUPPORT_CHAT_PEEKS=[];
let SUPPORT_CHAT_AUDIO=null;
let SUPPORT_CHAT_AUDIO_READY=false;
const SUPPORT_CHAT_PUBLIC_ROOM='00000000-0000-0000-0000-000000000001';
const SUPPORT_CHAT_MAX_FILE=10*1024*1024;
const SUPPORT_CHAT_STICKERS=[
  {key:'like',emoji:'👍',label:'ถูกใจ'},{key:'love',emoji:'😍',label:'ชอบมาก'},
  {key:'thanks',emoji:'🙏',label:'ขอบคุณ'},{key:'great',emoji:'🎉',label:'ยอดเยี่ยม'},
  {key:'ok',emoji:'👌',label:'โอเค'},{key:'done',emoji:'✅',label:'เรียบร้อย'},
  {key:'fight',emoji:'✌️',label:'สู้ ๆ'},{key:'laugh',emoji:'😂',label:'ขำ'},
  {key:'wow',emoji:'🤩',label:'ว้าว'},{key:'idea',emoji:'💡',label:'ไอเดียดี'},
  {key:'please',emoji:'🥺',label:'รบกวนด้วย'},{key:'cheer',emoji:'💙',label:'ส่งกำลังใจ'}
];

function supportChatTime(value){
  if(!value)return '';
  try{return new Intl.DateTimeFormat('th-TH',{timeZone:ORG_TIMEZONE,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
  catch(e){return String(value);}
}
function supportChatTypeLabel(type){return type==='problem'?'แจ้งปัญหา':type==='update'?'อัปเดตผล':'';}
function supportChatSticker(key){return SUPPORT_CHAT_STICKERS.find(item=>item.key===key)||null;}
function supportChatCurrentRoom(){return SUPPORT_CHAT_ROOMS.find(row=>row.id===SUPPORT_CHAT_ROOM_ID)||null;}
function supportChatMemberIds(roomId){return SUPPORT_CHAT_MEMBERS.filter(row=>row.room_id===roomId).map(row=>row.profile_id);}
function supportChatPerson(profileId){return SUPPORT_CHAT_DIRECTORY.find(row=>row.profile_id===profileId)||null;}
function supportChatRoomTitle(room){
  if(!room)return 'เลือกห้องสนทนา';
  if(room.room_type==='public')return 'ห้องกลาง Company Hub';
  if(room.room_type==='direct'){
    const other=supportChatMemberIds(room.id).find(id=>id!==ACCESS_PROFILE?.id),person=supportChatPerson(other);
    return person?.display_name||room.name||'แชทส่วนตัว';
  }
  return room.name||'กลุ่มสนทนา';
}
function supportChatRoomSubtitle(room){
  if(!room)return '';
  if(room.room_type==='public')return 'ทุกบัญชีที่เปิดใช้งาน';
  const count=supportChatMemberIds(room.id).length;
  return room.room_type==='direct'?'สนทนาส่วนตัว':`${nf(count)} สมาชิก`;
}
function supportChatRoomIcon(room){return room?.room_type==='public'?'🏢':room?.room_type==='direct'?'👤':'👥';}
function supportChatBytes(value){
  const n=Number(value)||0;if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`;
}
function supportChatIsImage(row){return String(row.attachment_mime||'').startsWith('image/');}
function supportChatAttachment(row){
  if(!row.attachment_path)return '';
  const url=SUPPORT_CHAT_ATTACHMENT_URLS.get(row.attachment_path),name=esc(row.attachment_name||'ไฟล์แนบ'),size=supportChatBytes(row.attachment_size);
  if(supportChatIsImage(row))return `<button class="chat-image-attachment" data-path="${esc(row.attachment_path)}" data-name="${name}" onclick="supportChatOpenAttachment(this.dataset.path,this.dataset.name)" aria-label="เปิดรูป ${name}">${url?`<img src="${esc(url)}" alt="${name}">`:'<span>กำลังโหลดรูป…</span>'}<small>${name} · ${size}</small></button>`;
  return `<button class="chat-file-attachment" data-path="${esc(row.attachment_path)}" data-name="${name}" onclick="supportChatOpenAttachment(this.dataset.path,this.dataset.name)"><span>📎</span><span><b>${name}</b><small>${size||'ไฟล์แนบ'}</small></span><em>ดาวน์โหลด</em></button>`;
}
async function hydrateSupportChatAttachments(){
  const missing=SUPPORT_CHAT_ROWS.filter(row=>row.attachment_path&&!SUPPORT_CHAT_ATTACHMENT_URLS.has(row.attachment_path));
  if(!missing.length)return;
  let changed=false;
  await Promise.all(missing.map(async row=>{
    const result=await SB.storage.from('chat-attachments').createSignedUrl(row.attachment_path,3600);
    if(result.data?.signedUrl){SUPPORT_CHAT_ATTACHMENT_URLS.set(row.attachment_path,result.data.signedUrl);changed=true;}
  }));
  if(changed&&VIEW==='supportChat')renderSupportChatMessages(false);
}
async function supportChatOpenAttachment(path,name){
  let url=SUPPORT_CHAT_ATTACHMENT_URLS.get(path);
  if(!url){const result=await SB.storage.from('chat-attachments').createSignedUrl(path,300,{download:name});if(result.error){toast('เปิดไฟล์ไม่สำเร็จ · '+result.error.message,'info');return;}url=result.data?.signedUrl;}
  if(url)window.open(url,'_blank','noopener');
}
function renderSupportChatMessages(scroll=true){
  const list=document.getElementById('support-chat-list');if(!list)return;
  if(!SUPPORT_CHAT_ROOM_ID){list.innerHTML='<div class="support-chat-empty"><b>เลือกห้องสนทนา</b><span>เลือกห้องด้านซ้ายหรือสร้างกลุ่มใหม่</span></div>';return;}
  if(!SUPPORT_CHAT_ROWS.length){list.innerHTML='<div class="support-chat-empty"><b>ยังไม่มีข้อความ</b><span>เริ่มบทสนทนาด้วยข้อความ รูปภาพ หรือไฟล์ได้เลย</span></div>';return;}
  list.innerHTML=SUPPORT_CHAT_ROWS.map(row=>{
    const mine=row.author_id===ACCESS_PROFILE?.id,type=supportChatTypeLabel(row.message_type),sticker=row.message_type==='sticker'?supportChatSticker(row.body):null;
    return `<article class="support-message ${mine?'mine':''} ${sticker?'sticker':''}" data-message-id="${esc(row.id)}">
      <div class="support-message-head"><b>${esc(row.author_name||'ผู้ใช้งาน')}</b><span>${esc(deptName(row.department_code)||row.department_code||'-')}</span><time>${esc(supportChatTime(row.created_at))}</time></div>
      ${type?`<div class="support-message-type ${row.message_type==='update'?'update':''}">${type}</div>`:''}
      ${sticker?`<div class="support-sticker" role="img" aria-label="สติ๊กเกอร์ ${esc(sticker.label)}"><span>${sticker.emoji}</span><small>${esc(sticker.label)}</small></div>`:row.body?`<p>${esc(row.body).replace(/\n/g,'<br>')}</p>`:''}${supportChatAttachment(row)}
    </article>`;
  }).join('');
  if(scroll)requestAnimationFrame(()=>{list.scrollTop=list.scrollHeight;});
  hydrateSupportChatAttachments();
}
function renderSupportChatRooms(){
  const holder=document.getElementById('support-chat-rooms');if(!holder)return;
  const q=(document.getElementById('support-chat-search')?.value||'').trim().toLowerCase();
  const rooms=SUPPORT_CHAT_ROOMS.filter(room=>(supportChatRoomTitle(room)+' '+supportChatRoomSubtitle(room)).toLowerCase().includes(q));
  holder.innerHTML=rooms.length?rooms.map(room=>{const unread=SUPPORT_CHAT_UNREAD.get(room.id)||0;return `<button class="support-room ${room.id===SUPPORT_CHAT_ROOM_ID?'active':''}" onclick="selectSupportChatRoom('${esc(room.id)}')"><span class="support-room-avatar">${supportChatRoomIcon(room)}</span><span><b>${esc(supportChatRoomTitle(room))}</b><small>${esc(supportChatRoomSubtitle(room))}</small></span>${unread?`<strong class="support-unread">${unread>99?'99+':unread}</strong>`:'<i>›</i>'}</button>`;}).join(''):'<div class="support-room-empty">ไม่พบห้องสนทนา</div>';
}
function renderSupportChatHeader(){
  const holder=document.getElementById('support-chat-room-head'),room=supportChatCurrentRoom();if(!holder)return;
  holder.innerHTML=room?`<div class="support-room-heading"><span>${supportChatRoomIcon(room)}</span><div><b>${esc(supportChatRoomTitle(room))}</b><small>${esc(supportChatRoomSubtitle(room))} · ข้อความแบบ Realtime</small></div></div>`:'<div class="support-room-heading"><span>💬</span><div><b>เลือกห้องสนทนา</b></div></div>';
}
async function loadSupportChatDirectory(){
  const result=await SB.rpc('chat_directory');if(result.error)throw result.error;SUPPORT_CHAT_DIRECTORY=result.data||[];
}
async function loadSupportChatRooms(force=false){
  if(SUPPORT_CHAT_LOADING&&!force)return;SUPPORT_CHAT_LOADING=true;
  try{
    const [roomsResult,membersResult]=await Promise.all([
      SB.from('chat_rooms').select('id,name,room_type,created_by,created_at,updated_at').order('updated_at',{ascending:false}),
      SB.from('chat_room_members').select('room_id,profile_id,member_role,joined_at')
    ]);
    if(roomsResult.error)throw roomsResult.error;if(membersResult.error)throw membersResult.error;
    SUPPORT_CHAT_ROOMS=roomsResult.data||[];SUPPORT_CHAT_MEMBERS=membersResult.data||[];
    await loadSupportChatDirectory();
    if(!SUPPORT_CHAT_ROOMS.some(row=>row.id===SUPPORT_CHAT_ROOM_ID))SUPPORT_CHAT_ROOM_ID=SUPPORT_CHAT_ROOMS.find(row=>row.id===SUPPORT_CHAT_PUBLIC_ROOM)?.id||SUPPORT_CHAT_ROOMS[0]?.id||'';
    renderSupportChatRooms();renderSupportChatHeader();subscribeSupportChat();
    if(VIEW==='supportChat')await loadSupportChatMessages();
  }catch(error){
    const list=document.getElementById('support-chat-list');if(list)list.innerHTML=`<div class="support-chat-empty error"><b>ยังเปิดระบบแชทไม่ได้</b><span>${esc(error.message||'กรุณาให้ผู้ดูแลติดตั้ง Migration 040 แล้วลองใหม่')}</span></div>`;
  }finally{SUPPORT_CHAT_LOADING=false;}
}
async function loadSupportChatMessages(){
  if(!SUPPORT_CHAT_ROOM_ID){SUPPORT_CHAT_ROWS=[];renderSupportChatMessages();return;}
  const result=await SB.from('support_chat_messages').select('id,room_id,author_id,author_name,department_code,message_type,body,attachment_path,attachment_name,attachment_mime,attachment_size,created_at').eq('room_id',SUPPORT_CHAT_ROOM_ID).order('created_at',{ascending:true}).limit(300);
  if(result.error)throw result.error;SUPPORT_CHAT_ROWS=result.data||[];supportChatMarkRead(SUPPORT_CHAT_ROOM_ID);renderSupportChatMessages();subscribeSupportChat();
}
function subscribeSupportChat(){
  if(SUPPORT_CHAT_GLOBAL_CHANNEL)return;
  SUPPORT_CHAT_GLOBAL_CHANNEL=SB.channel('company-chat-notifications-'+(ACCESS_PROFILE?.id||'user'))
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'support_chat_messages'},payload=>supportChatReceive(payload.new))
    .subscribe();
}
function supportChatPreview(row){
  const sticker=row.message_type==='sticker'?supportChatSticker(row.body):null;
  if(sticker)return `ส่งสติ๊กเกอร์ ${sticker.emoji}`;
  if(row.attachment_path)return row.attachment_mime?.startsWith('image/')?'ส่งรูปภาพ':'ส่งไฟล์ '+(row.attachment_name||'');
  return String(row.body||'มีข้อความใหม่').replace(/\s+/g,' ').slice(0,90);
}
function supportChatMarkRead(roomId){
  if(!roomId)return;SUPPORT_CHAT_UNREAD.delete(roomId);SUPPORT_CHAT_PEEKS=SUPPORT_CHAT_PEEKS.filter(item=>item.room_id!==roomId);renderSupportChatRooms();renderSupportChatDock();
}
function supportChatUnreadTotal(){return [...SUPPORT_CHAT_UNREAD.values()].reduce((sum,value)=>sum+value,0);}
function supportChatPrepareAudio(){
  if(SUPPORT_CHAT_AUDIO_READY)return;try{const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;SUPPORT_CHAT_AUDIO=new AudioContext();if(SUPPORT_CHAT_AUDIO.state==='suspended')SUPPORT_CHAT_AUDIO.resume();SUPPORT_CHAT_AUDIO_READY=true;}catch(_error){}
}
function supportChatPlaySound(){
  if(!SUPPORT_CHAT_AUDIO_READY||!SUPPORT_CHAT_AUDIO)return;try{const osc=SUPPORT_CHAT_AUDIO.createOscillator(),gain=SUPPORT_CHAT_AUDIO.createGain();osc.type='sine';osc.frequency.setValueAtTime(620,SUPPORT_CHAT_AUDIO.currentTime);gain.gain.setValueAtTime(.0001,SUPPORT_CHAT_AUDIO.currentTime);gain.gain.exponentialRampToValueAtTime(.075,SUPPORT_CHAT_AUDIO.currentTime+.01);gain.gain.exponentialRampToValueAtTime(.0001,SUPPORT_CHAT_AUDIO.currentTime+.16);osc.connect(gain);gain.connect(SUPPORT_CHAT_AUDIO.destination);osc.start();osc.stop(SUPPORT_CHAT_AUDIO.currentTime+.18);}catch(_error){}
}
function supportChatSystemNotification(row,room){
  if(typeof Notification==='undefined'||Notification.permission!=='granted'||document.visibilityState==='visible')return;
  try{const notification=new Notification(supportChatRoomTitle(room),{body:`${row.author_name||'ผู้ใช้งาน'}: ${supportChatPreview(row)}`,tag:'company-hub-chat-'+row.room_id,renotify:true,icon:'favicon.svg'});notification.onclick=()=>{window.focus();supportChatOpenRoom(row.room_id);notification.close();};}catch(_error){}
}
async function enableSupportChatNotifications(){
  if(typeof Notification==='undefined'){toast('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนบนเครื่อง','info');return;}
  const permission=await Notification.requestPermission();renderSupportChatNotificationButton();toast(permission==='granted'?'เปิดแจ้งเตือนบนเครื่องแล้ว':'ยังไม่ได้อนุญาตการแจ้งเตือน','info');
}
function renderSupportChatNotificationButton(){
  const button=document.getElementById('support-chat-notification-button');if(!button)return;
  const granted=typeof Notification!=='undefined'&&Notification.permission==='granted';button.textContent=granted?'🔔 แจ้งเตือนแล้ว':'🔔 เปิดแจ้งเตือนบนเครื่อง';button.classList.toggle('enabled',granted);
}
function supportChatReceive(row){
  if(!row||row.author_id===ACCESS_PROFILE?.id)return;
  const room=SUPPORT_CHAT_ROOMS.find(item=>item.id===row.room_id);if(!room)return;
  room.updated_at=row.created_at||new Date().toISOString();SUPPORT_CHAT_ROOMS.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
  const viewing=VIEW==='supportChat'&&SUPPORT_CHAT_ROOM_ID===row.room_id&&document.visibilityState==='visible';
  if(viewing){if(!SUPPORT_CHAT_ROWS.some(item=>item.id===row.id))SUPPORT_CHAT_ROWS.push(row);supportChatMarkRead(row.room_id);renderSupportChatMessages();return;}
  SUPPORT_CHAT_UNREAD.set(row.room_id,(SUPPORT_CHAT_UNREAD.get(row.room_id)||0)+1);
  SUPPORT_CHAT_PEEKS=[row,...SUPPORT_CHAT_PEEKS.filter(item=>item.room_id!==row.room_id)].slice(0,3);
  renderSupportChatRooms();renderSupportChatDock();supportChatPlaySound();supportChatSystemNotification(row,room);
}
function supportChatDismissPeek(roomId,event){event?.stopPropagation();SUPPORT_CHAT_PEEKS=SUPPORT_CHAT_PEEKS.filter(item=>item.room_id!==roomId);renderSupportChatDock();}
function supportChatOpenRoom(roomId){
  supportChatMarkRead(roomId);SUPPORT_CHAT_ROOM_ID='';SUPPORT_CHAT_ROWS=[];go('supportChat');requestAnimationFrame(()=>selectSupportChatRoom(roomId));
}
function renderSupportChatDock(){
  let dock=document.getElementById('support-chat-dock');if(!dock){dock=document.createElement('aside');dock.id='support-chat-dock';dock.className='support-chat-dock';dock.setAttribute('aria-live','polite');document.body.append(dock);}
  const total=supportChatUnreadTotal();dock.innerHTML=`<div class="support-chat-peeks">${SUPPORT_CHAT_PEEKS.map(row=>{const room=SUPPORT_CHAT_ROOMS.find(item=>item.id===row.room_id);return `<button class="support-chat-peek" onclick="supportChatOpenRoom('${esc(row.room_id)}')"><span class="support-chat-peek-avatar">${supportChatRoomIcon(room)}</span><span><b>${esc(supportChatRoomTitle(room))}</b><small>${esc(row.author_name||'ข้อความใหม่')} · ${esc(supportChatPreview(row))}</small></span><i onclick="supportChatDismissPeek('${esc(row.room_id)}',event)" aria-label="ปิด">×</i></button>`;}).join('')}</div><button class="support-chat-dock-button" onclick="go('supportChat')" title="เปิดข้อความ">${sic('i-chat')}<span>ข้อความ</span>${total?`<b>${total>99?'99+':total}</b>`:''}</button>`;
  const title=document.title.replace(/^\(\d+\)\s*/, '');document.title=total?`(${total}) ${title}`:title;
}
async function initializeSupportChatNotifications(){
  if(!ACCESS_PROFILE)return;document.addEventListener('pointerdown',supportChatPrepareAudio,{once:true});renderSupportChatDock();await loadSupportChatRooms(true);
}
async function selectSupportChatRoom(roomId){
  if(roomId===SUPPORT_CHAT_ROOM_ID&&SUPPORT_CHAT_ROWS.length){supportChatMarkRead(roomId);return;}SUPPORT_CHAT_ROOM_ID=roomId;SUPPORT_CHAT_ROWS=[];SUPPORT_CHAT_PENDING_FILE=null;supportChatMarkRead(roomId);
  renderSupportChatRooms();renderSupportChatHeader();renderSupportChatPendingFile();
  const list=document.getElementById('support-chat-list');if(list)list.innerHTML='<div class="support-chat-empty"><b>กำลังโหลดข้อความ…</b></div>';
  try{await loadSupportChatMessages();}catch(error){if(list)list.innerHTML=`<div class="support-chat-empty error">${esc(error.message||error)}</div>`;}
}
function supportChatSearchRooms(){renderSupportChatRooms();}
function chooseSupportChatFile(input){
  const file=input?.files?.[0]||null;input.value='';if(!file)return;
  if(file.size>SUPPORT_CHAT_MAX_FILE){toast('ไฟล์ต้องมีขนาดไม่เกิน 10 MB','info');return;}
  const allowed=['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','text/csv','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'];
  if(!allowed.includes(file.type)){toast('รองรับรูปภาพ PDF Word Excel PowerPoint ZIP และไฟล์ข้อความ','info');return;}
  SUPPORT_CHAT_PENDING_FILE=file;renderSupportChatPendingFile();
}
function renderSupportChatPendingFile(){
  const holder=document.getElementById('support-chat-pending');if(!holder)return;
  holder.innerHTML=SUPPORT_CHAT_PENDING_FILE?`<span>📎 ${esc(SUPPORT_CHAT_PENDING_FILE.name)} · ${supportChatBytes(SUPPORT_CHAT_PENDING_FILE.size)}</span><button onclick="removeSupportChatFile()">×</button>`:'';
  holder.classList.toggle('show',!!SUPPORT_CHAT_PENDING_FILE);
}
function removeSupportChatFile(){SUPPORT_CHAT_PENDING_FILE=null;renderSupportChatPendingFile();}
function toggleSupportChatStickers(force){
  const picker=document.getElementById('support-chat-stickers');if(!picker)return;
  const open=typeof force==='boolean'?force:!picker.classList.contains('show');picker.classList.toggle('show',open);
  document.getElementById('support-chat-sticker-button')?.setAttribute('aria-expanded',String(open));
}
async function sendSupportChatSticker(key){
  const sticker=supportChatSticker(key);if(!sticker||!SUPPORT_CHAT_ROOM_ID)return;
  const button=document.querySelector(`[data-sticker="${key}"]`);if(button)button.disabled=true;
  try{
    const payload={room_id:SUPPORT_CHAT_ROOM_ID,author_id:ACCESS_PROFILE.id,message_type:'sticker',body:key};
    const result=await SB.from('support_chat_messages').insert(payload).select().single();if(result.error)throw result.error;
    if(result.data&&!SUPPORT_CHAT_ROWS.some(row=>row.id===result.data.id))SUPPORT_CHAT_ROWS.push(result.data);
    toggleSupportChatStickers(false);renderSupportChatMessages();renderSupportChatRooms();
  }catch(error){toast('ส่งสติ๊กเกอร์ไม่สำเร็จ · '+(error.message||error),'info');}finally{if(button)button.disabled=false;}
}
async function uploadSupportChatFile(file,roomId){
  const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-100)||'attachment';
  const path=`${roomId}/${ACCESS_PROFILE.id}/${crypto.randomUUID()}-${safe}`;
  const result=await SB.storage.from('chat-attachments').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
  if(result.error)throw result.error;return path;
}
async function sendSupportChatMessage(){
  const input=document.getElementById('support-chat-body'),type=val('support-chat-type')||'message',body=(input?.value||'').trim(),file=SUPPORT_CHAT_PENDING_FILE;
  if(!SUPPORT_CHAT_ROOM_ID){toast('กรุณาเลือกห้องสนทนา','info');return;}
  if(!body&&!file){toast('พิมพ์ข้อความหรือเลือกไฟล์ก่อนส่ง','info');input?.focus();return;}
  if(body.length>2000){toast('ข้อความยาวเกิน 2,000 ตัวอักษร','info');return;}
  const button=document.getElementById('support-chat-send');button.disabled=true;let uploadedPath='';
  try{
    if(file)uploadedPath=await uploadSupportChatFile(file,SUPPORT_CHAT_ROOM_ID);
    const payload={room_id:SUPPORT_CHAT_ROOM_ID,author_id:ACCESS_PROFILE.id,message_type:type,body};
    if(file)Object.assign(payload,{attachment_path:uploadedPath,attachment_name:file.name,attachment_mime:file.type,attachment_size:file.size});
    const result=await SB.from('support_chat_messages').insert(payload).select().single();if(result.error)throw result.error;
    if(result.data&&!SUPPORT_CHAT_ROWS.some(x=>x.id===result.data.id))SUPPORT_CHAT_ROWS.push(result.data);
    input.value='';SUPPORT_CHAT_PENDING_FILE=null;renderSupportChatPendingFile();renderSupportChatMessages();renderSupportChatRooms();toast('ส่งข้อความแล้ว');
  }catch(error){
    if(uploadedPath)await SB.storage.from('chat-attachments').remove([uploadedPath]);
    toast('ส่งข้อความไม่สำเร็จ · '+(error.message||error),'info');
  }finally{button.disabled=false;}
}
function supportChatKeydown(event){if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendSupportChatMessage();}}
function supportChatFilterPeople(){
  const q=(document.getElementById('chat-member-search')?.value||'').trim().toLowerCase();
  document.querySelectorAll('.chat-member-choice').forEach(row=>row.hidden=!row.dataset.search.includes(q));
}
function supportChatToggleMember(input,mode){
  if(mode==='direct'&&input.checked)document.querySelectorAll('.chat-member-choice input').forEach(other=>{if(other!==input)other.checked=false;});
}
async function openSupportChatCreate(mode){
  if(!SUPPORT_CHAT_DIRECTORY.length){try{await loadSupportChatDirectory();}catch(error){toast('โหลดรายชื่อไม่สำเร็จ · '+error.message,'info');return;}}
  const direct=mode==='direct';
  showModal(`<div class="modal-h"><div><h3>${direct?'👤 เริ่มแชทส่วนตัว':'👥 สร้างกลุ่มสนทนา'}</h3><div class="muted" style="font-size:11.5px">${direct?'เลือกคนที่ต้องการคุย 1 คน':'ตั้งชื่อกลุ่มและเลือกสมาชิกที่ต้องการ'}</div></div><button class="x" onclick="closeModal()">×</button></div><div class="pad chat-create-modal">
    ${direct?'':`<div class="field"><label>ชื่อกลุ่ม *</label><input class="fin" id="chat-room-name" maxlength="80" placeholder="เช่น ทีมเปิดระบบ Company Hub"></div>`}
    <div class="field"><label>ค้นหาสมาชิก</label><input class="fin" id="chat-member-search" placeholder="ชื่อ แผนก หรือตำแหน่ง" oninput="supportChatFilterPeople()"></div>
    <div class="chat-member-list">${SUPPORT_CHAT_DIRECTORY.map(person=>{const search=(person.display_name+' '+deptName(person.department_code)+' '+(person.position_title||'')).toLowerCase();return `<label class="chat-member-choice" data-search="${esc(search)}"><input type="checkbox" value="${esc(person.profile_id)}" onchange="supportChatToggleMember(this,'${direct?'direct':'group'}')"><span class="chat-member-avatar">${esc((person.display_name||'?').slice(0,1))}</span><span><b>${esc(person.display_name)}</b><small>${esc(deptName(person.department_code))} · ${esc(person.position_title||'พนักงาน')}</small></span></label>`;}).join('')}</div>
    <div class="modal-actions"><button class="tbtn" onclick="closeModal()">ยกเลิก</button><button id="chat-room-create" class="tbtn primary" onclick="createSupportChatRoom('${direct?'direct':'group'}')">${direct?'เริ่มสนทนา':'สร้างกลุ่ม'}</button></div>
  </div>`);
}
async function createSupportChatRoom(mode){
  const memberIds=[...document.querySelectorAll('.chat-member-choice input:checked')].map(input=>input.value),name=mode==='direct'?'':(val('chat-room-name')||'').trim();
  if(mode==='direct'&&memberIds.length!==1){toast('กรุณาเลือกคนที่ต้องการคุย 1 คน','info');return;}
  if(mode==='group'&&(!name||!memberIds.length)){toast('กรุณาตั้งชื่อกลุ่มและเลือกสมาชิกอย่างน้อย 1 คน','info');return;}
  const button=document.getElementById('chat-room-create');button.disabled=true;
  try{
    const result=await SB.rpc('create_chat_room',{p_room_type:mode,p_name:name,p_member_ids:memberIds});if(result.error)throw result.error;
    closeModal();SUPPORT_CHAT_ROOM_ID=result.data;await loadSupportChatRooms(true);toast(mode==='direct'?'เปิดแชทส่วนตัวแล้ว':'สร้างกลุ่มแล้ว');
  }catch(error){button.disabled=false;toast('สร้างห้องไม่สำเร็จ · '+(error.message||error),'info');}
}
RENDER.supportChat=function(){
  main.innerHTML=`${crumb('หน้าแรก','ข้อความ')}
    <div class="page-h"><div><h1>ข้อความ</h1><p>คุยส่วนตัว สร้างกลุ่ม ส่งสติ๊กเกอร์ และส่งไฟล์ตามสิทธิ์ของสมาชิก</p>${sourceBadge('live','SUPABASE REALTIME','ข้อความใหม่แสดงอัตโนมัติ')}</div><div class="support-chat-actions"><button id="support-chat-notification-button" class="tbtn sm" onclick="enableSupportChatNotifications()">🔔 เปิดแจ้งเตือนบนเครื่อง</button><button class="tbtn sm" onclick="loadSupportChatRooms(true)">↻ โหลดใหม่</button></div></div>
    <div class="support-chat-notice"><b>พื้นที่สื่อสารภายใน</b><span>รูปและไฟล์เปิดได้เฉพาะสมาชิกในห้อง ห้ามส่งรหัสผ่านหรือข้อมูลลับที่ไม่เกี่ยวข้องกับงาน</span></div>
    <section class="card support-chat-app">
      <aside class="support-chat-sidebar"><div class="support-chat-sidebar-head"><div><b>แชท</b><small>Company Hub</small></div><button title="สร้างกลุ่ม" onclick="openSupportChatCreate('group')">＋</button></div>
        <div class="support-chat-new"><button onclick="openSupportChatCreate('direct')">👤 ข้อความใหม่</button><button onclick="openSupportChatCreate('group')">👥 สร้างกลุ่ม</button></div>
        <label class="support-chat-search"><span>⌕</span><input id="support-chat-search" placeholder="ค้นหาห้องหรือชื่อคน" oninput="supportChatSearchRooms()"></label>
        <div id="support-chat-rooms" class="support-chat-rooms"><div class="support-room-empty">กำลังโหลดห้อง…</div></div>
      </aside>
      <div class="support-chat-main"><header id="support-chat-room-head" class="support-chat-room-head"></header>
        <div id="support-chat-list" class="support-chat-list" aria-live="polite"><div class="support-chat-empty"><b>กำลังโหลดข้อความ…</b></div></div>
        <div id="support-chat-pending" class="support-chat-pending"></div>
        <div id="support-chat-stickers" class="support-chat-stickers" role="dialog" aria-label="เลือกสติ๊กเกอร์"><div><b>เลือกสติ๊กเกอร์</b><button onclick="toggleSupportChatStickers(false)" aria-label="ปิด">×</button></div><section>${SUPPORT_CHAT_STICKERS.map(item=>`<button data-sticker="${item.key}" onclick="sendSupportChatSticker('${item.key}')" title="${esc(item.label)}"><span>${item.emoji}</span><small>${esc(item.label)}</small></button>`).join('')}</section></div>
        <div class="support-chat-compose"><button class="support-attach" onclick="document.getElementById('support-chat-file').click()" title="แนบรูปหรือไฟล์">📎</button><button id="support-chat-sticker-button" class="support-attach support-sticker-button" onclick="toggleSupportChatStickers()" title="ส่งสติ๊กเกอร์" aria-expanded="false">😊</button><input id="support-chat-file" type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.csv,.zip,.docx,.xlsx,.pptx" onchange="chooseSupportChatFile(this)">
          <select id="support-chat-type" class="fin" aria-label="ประเภทข้อความ"><option value="message">ข้อความ</option><option value="problem">แจ้งปัญหา</option><option value="update">อัปเดตผล</option></select>
          <textarea id="support-chat-body" class="fin" maxlength="2000" rows="2" placeholder="เขียนข้อความ…" onkeydown="supportChatKeydown(event)"></textarea>
          <button id="support-chat-send" class="tbtn primary" onclick="sendSupportChatMessage()">ส่ง</button>
        </div><div class="support-chat-hint">สติ๊กเกอร์และแจ้งเตือนแบบ Realtime · ไฟล์ไม่เกิน 10 MB · Enter เพื่อส่ง</div>
      </div>
    </section>`;
  renderSupportChatRooms();renderSupportChatHeader();renderSupportChatMessages(false);renderSupportChatNotificationButton();loadSupportChatRooms();
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

const supportChatOnLoggedInBase=onLoggedIn;
onLoggedIn=async function(...args){const result=await supportChatOnLoggedInBase(...args);if(ACCESS_PROFILE)initializeSupportChatNotifications();return result;};
const supportChatLogoutBase=sbLogout;
sbLogout=async function(...args){
  if(SUPPORT_CHAT_GLOBAL_CHANNEL&&SB.removeChannel)SB.removeChannel(SUPPORT_CHAT_GLOBAL_CHANNEL);SUPPORT_CHAT_GLOBAL_CHANNEL=null;SUPPORT_CHAT_UNREAD.clear();SUPPORT_CHAT_PEEKS=[];document.getElementById('support-chat-dock')?.remove();
  return supportChatLogoutBase(...args);
};
if(ACCESS_PROFILE)setTimeout(initializeSupportChatNotifications,0);

MANUAL.push({id:'support-chat',ic:'i-chat',tt:'ข้อความ สติ๊กเกอร์ และการแจ้งเตือน',img:null,html:`<p>ระบบสนทนาภายใน Company Hub รองรับห้องกลาง กลุ่ม และแชทส่วนตัวแบบ Realtime</p><ol><li>กด <b>ข้อความใหม่</b> แล้วเลือกคน 1 คน หรือกด <b>สร้างกลุ่ม</b> เพื่อเลือกสมาชิกหลายคน</li><li>กด 😊 เพื่อเลือกสติ๊กเกอร์ หรือกด 📎 เพื่อแนบรูปและไฟล์ขนาดไม่เกิน 10 MB</li><li>เมื่อมีข้อความใหม่ ระบบจะแสดงการ์ดที่แถบล่าง พร้อมตัวเลขข้อความที่ยังไม่ได้เปิดและเสียงแจ้งเตือน</li><li>กด <b>เปิดแจ้งเตือนบนเครื่อง</b> เพื่อรับ Browser Notification เมื่อสลับไปแท็บอื่น โดยต้องอนุญาตผ่านเบราว์เซอร์ก่อน</li><li>ข้อความ กลุ่ม และไฟล์เปิดได้เฉพาะผู้ที่มีสิทธิ์ในห้องนั้น</li></ol>`});
MANUAL.push({id:'department-transfer',ic:'i-users',tt:'ย้ายแผนกและดูประวัติ',img:null,html:`<p>ผู้บริหารหรือผู้ดูแลระบบใช้เมนูจัดการพนักงานเพื่อย้ายสังกัด</p><ol><li>เลือกพนักงานแล้วกด <b>ย้ายแผนก</b></li><li>ระบุแผนกใหม่ วันที่มีผล ตำแหน่ง และเหตุผล</li><li>งานและข้อมูลที่เคยบันทึกยังอยู่ในแผนกเดิม ส่วนสิทธิ์ปัจจุบันเปลี่ยนไปยังแผนกใหม่</li><li>กด <b>ประวัติแผนก</b> เพื่อตรวจช่วงเวลาย้อนหลัง</li></ol>`});
