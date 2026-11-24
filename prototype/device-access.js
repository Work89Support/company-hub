const DEVICE_COOKIE_NAME='companyhub_device_v2';
const DEVICE_COOKIE_SECONDS=31536000;
let DEVICE_GATE_WAITER=null,DEVICE_GATE_STATE=null,DEVICE_GATE_BUSY=false,DEVICE_HEARTBEAT=null;
let DEVICE_REQUESTS=[],DEVICE_REQUESTS_LOADING=false;

NAV.devices={ic:'i-check',t:'อนุมัติอุปกรณ์'};
const deviceOrgGroup=NAVGROUPS.find(group=>group.label==='องค์กร & ความรู้');
if(deviceOrgGroup&&!deviceOrgGroup.items.includes('devices'))deviceOrgGroup.items.splice(1,0,'devices');
for(const role of ['lead','exec'])if(!ROLE_ALLOW[role].includes('devices'))ROLE_ALLOW[role].push('devices');

function deviceCookieValue(){
  const prefix=DEVICE_COOKIE_NAME+'=';
  return document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith(prefix))?.slice(prefix.length)||'';
}
function deviceAccessId(){
  let value=deviceCookieValue();
  if(!/^[0-9a-f-]{20,80}$/i.test(value)){
    value=globalThis.crypto?.randomUUID?.()||`${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
    document.cookie=`${DEVICE_COOKIE_NAME}=${value}; Max-Age=${DEVICE_COOKIE_SECONDS}; Path=/; Secure; SameSite=Strict`;
  }
  return value;
}
function deviceAccessLabel(){
  const ua=navigator.userAgent||'',platform=navigator.userAgentData?.platform||navigator.platform||'';
  const os=/iPhone|iPad|iPod/i.test(ua)?'iPhone/iPad':/Android/i.test(ua)?'Android':/Mac/i.test(platform+ua)?'Mac':/Windows/i.test(platform+ua)?'Windows':/Linux/i.test(platform+ua)?'Linux':'อุปกรณ์';
  const browser=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':/Firefox\//.test(ua)?'Firefox':'Browser';
  return `${os} · ${browser}`;
}
async function deviceAccessCall(action,extra={}){
  const result=await SB.functions.invoke('access-gate',{body:{action,device_id:deviceAccessId(),device_label:deviceAccessLabel(),...extra}});
  if(result.error){
    let detail=null;try{detail=await result.error.context?.clone?.().json();}catch(_e){}
    throw new Error(detail?.error||detail?.reason||result.error.message||'ตรวจสอบอุปกรณ์ไม่สำเร็จ');
  }
  if(result.data?.error)throw new Error(result.data.error);
  return result.data||{};
}
function ensureDeviceGateMarkup(){
  let root=document.getElementById('deviceGateBg');if(root)return root;
  root=document.createElement('div');root.id='deviceGateBg';root.className='device-gate-bg';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','deviceGateTitle');root.innerHTML='<div class="device-gate-card" id="deviceGateCard" tabindex="-1"></div>';
  document.body.appendChild(root);return root;
}
function deviceGateCopy(state){
  if(state==='needs_initial_confirmation')return {icon:'🔐',title:'ลงทะเบียนอุปกรณ์เครื่องแรก',body:'ระบบจะผูกบัญชีของคุณกับอุปกรณ์และเบราว์เซอร์นี้ หลังจากยืนยันแล้ว หากเปลี่ยนเครื่อง เปลี่ยนเบราว์เซอร์ หรือล้าง Cookie/ข้อมูลเว็บไซต์ คุณจะต้องส่งคำขออนุมัติอุปกรณ์ใหม่',note:'กรุณาตรวจสอบว่าเป็นอุปกรณ์ที่คุณใช้งานประจำก่อนยืนยัน',action:'confirm_initial',button:'ยืนยันและลงทะเบียนเครื่องนี้'};
  if(state==='needs_change_confirmation')return {icon:'📱',title:'ตรวจพบอุปกรณ์ใหม่',body:'บัญชีนี้มีอุปกรณ์ที่ลงทะเบียนแล้ว การใช้งานจากเครื่องหรือเบราว์เซอร์ใหม่นี้ต้องได้รับการอนุมัติก่อน',note:'พนักงานให้หัวหน้าแผนกหรือผู้ดูแลอนุมัติ ส่วนหัวหน้าแผนกต้องให้ผู้ดูแลระบบอนุมัติ ระบบจะแจ้งคำขอเข้า Telegram กลุ่มเดิม',action:'request_change',button:'ส่งคำขออนุมัติอุปกรณ์'};
  if(state==='pending')return {icon:'⏳',title:'กำลังรออนุมัติอุปกรณ์',body:'ระบบส่งคำขอและแจ้ง Telegram แล้ว เมื่อหัวหน้าแผนกหรือผู้ดูแลอนุมัติ ให้กดตรวจสอบอีกครั้ง',note:'ยังไม่สามารถเปิดข้อมูลงานได้จนกว่าจะได้รับอนุมัติ',action:'retry',button:'ตรวจสอบอีกครั้ง'};
  return {icon:'⛔',title:'อุปกรณ์นี้ยังใช้งานไม่ได้',body:DEVICE_GATE_STATE?.reason||'อุปกรณ์นี้ถูกปฏิเสธหรือยกเลิกสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ',note:'หากเป็นการเปลี่ยนเครื่องโดยถูกต้อง กรุณาให้ผู้ดูแลตรวจสอบรายการอุปกรณ์',action:'logout',button:'ออกจากระบบ'};
}
function showDeviceGate(state,data={}){
  DEVICE_GATE_STATE={state,...data};const copy=deviceGateCopy(state),root=ensureDeviceGateMarkup(),card=root.querySelector('#deviceGateCard');
  const login=document.getElementById('loginBg');if(login)login.style.display='none';loginBackground(true);root.style.display='flex';
  card.innerHTML=`<div class="device-gate-icon">${copy.icon}</div><h2 id="deviceGateTitle">${copy.title}</h2><p>${copy.body}</p><div class="device-gate-note">${copy.note}<br><b>อุปกรณ์:</b> ${esc(deviceAccessLabel())}</div><div id="deviceGateError" class="device-gate-error" role="alert"></div><div class="device-gate-actions"><button class="tbtn primary" id="deviceGatePrimary" onclick="deviceGateAction('${copy.action}')">${copy.button}</button>${copy.action!=='logout'?'<button class="tbtn" onclick="deviceGateLogout()">ออกจากระบบ</button>':''}</div>`;
  requestAnimationFrame(()=>card.focus({preventScroll:true}));
}
function hideDeviceGate(){const root=document.getElementById('deviceGateBg');if(root)root.style.display='none';}
function finishDeviceGate(){hideDeviceGate();const waiter=DEVICE_GATE_WAITER;DEVICE_GATE_WAITER=null;DEVICE_GATE_STATE=null;if(waiter)waiter(true);}
async function deviceGateAction(action){
  if(action==='logout')return deviceGateLogout();if(DEVICE_GATE_BUSY)return;DEVICE_GATE_BUSY=true;
  const button=document.getElementById('deviceGatePrimary'),error=document.getElementById('deviceGateError');if(error)error.textContent='';if(button){button.disabled=true;button.textContent='กำลังตรวจสอบ…';}
  try{const data=await deviceAccessCall(action==='retry'?'status':action);if(data.allowed){finishDeviceGate();return;}showDeviceGate(data.state||'blocked',data);}
  catch(e){if(error)error.textContent=e.message||String(e);if(button){button.disabled=false;button.textContent=action==='retry'?'ตรวจสอบอีกครั้ง':'ลองใหม่';}}
  finally{DEVICE_GATE_BUSY=false;}
}
async function deviceGateLogout(){try{await SB?.auth?.signOut();}catch(_e){}location.reload();}
async function ensureDeviceAccess(){
  const data=await deviceAccessCall('status');if(data.allowed){startDeviceHeartbeat();return true;}
  showDeviceGate(data.state||'blocked',data);return new Promise(resolve=>{DEVICE_GATE_WAITER=resolve;});
}
function startDeviceHeartbeat(){
  clearInterval(DEVICE_HEARTBEAT);DEVICE_HEARTBEAT=setInterval(async()=>{try{const data=await deviceAccessCall('status');if(!data.allowed){clearInterval(DEVICE_HEARTBEAT);await SB.auth.signOut();location.reload();}}catch(error){console.warn('device heartbeat',error.message||error);}},5*60*1000);
}

async function loadDeviceRequests(render=true){
  if(!['lead','admin'].includes(AUTH_DB_ROLE)){DEVICE_REQUESTS=[];return;}
  DEVICE_REQUESTS_LOADING=true;try{const data=await deviceAccessCall('list_pending');DEVICE_REQUESTS=data.requests||[];}catch(error){toast('โหลดคำขออุปกรณ์ไม่สำเร็จ · '+(error.message||error),'info');}finally{DEVICE_REQUESTS_LOADING=false;if(render&&VIEW==='devices')RENDER.devices();buildNav();}
}
async function reviewDeviceRequest(id,decision){
  const label=decision==='approve'?'อนุมัติ':'ปฏิเสธ';if(!confirm(`${label}คำขออุปกรณ์นี้ใช่หรือไม่?`))return;
  try{const data=await deviceAccessCall('review',{device_record_id:id,decision});if(!data.allowed)throw new Error(data.error||'ดำเนินการไม่สำเร็จ');toast(label+'คำขออุปกรณ์แล้ว');await loadDeviceRequests(true);}catch(error){toast(label+'ไม่สำเร็จ · '+(error.message||error),'info');}
}
RENDER.devices=function(){
  if(!['lead','admin'].includes(AUTH_DB_ROLE)){main.innerHTML=`${crumb('หน้าแรก','อนุมัติอุปกรณ์')}<div class="card pad">บัญชีนี้ไม่มีสิทธิ์อนุมัติอุปกรณ์</div>`;return;}
  if(DEVICE_REQUESTS_LOADING){main.innerHTML=`${crumb('หน้าแรก','อนุมัติอุปกรณ์')}<div class="card pad">กำลังโหลดคำขอ…</div>`;return;}
  const rows=DEVICE_REQUESTS;
  main.innerHTML=`${crumb('หน้าแรก','อนุมัติอุปกรณ์')}<div class="page-h"><div><h1>คำขอเปลี่ยนอุปกรณ์</h1><p>พนักงานให้หัวหน้าแผนกหรือผู้ดูแลอนุมัติ · หัวหน้าแผนกให้ผู้ดูแลระบบอนุมัติ</p></div><button class="tbtn" onclick="loadDeviceRequests(true)">↻ โหลดใหม่</button></div>${rows.length?`<div class="device-request-list">${rows.map(row=>`<article class="device-request-card"><div><h3>${esc(row.profile.display_name||row.profile.email)}</h3><div class="device-request-meta">${esc(row.profile.position_title||'ไม่ระบุตำแหน่ง')} · ${esc(deptName(row.profile.department_code))}<br><b>อุปกรณ์ใหม่:</b> ${esc(row.device_label)}<br><b>ขอเมื่อ:</b> ${new Date(row.requested_at).toLocaleString('th-TH',{timeZone:ORG_TIMEZONE})}</div></div><div class="device-request-actions"><button class="tbtn primary" onclick="reviewDeviceRequest('${row.id}','approve')">✓ อนุมัติ</button><button class="tbtn" onclick="reviewDeviceRequest('${row.id}','reject')">ปฏิเสธ</button></div></article>`).join('')}</div>`:'<div class="device-request-empty">✓ ไม่มีคำขออุปกรณ์ที่รออนุมัติ</div>'}`;
};
