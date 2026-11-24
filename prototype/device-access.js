const DEVICE_COOKIE_NAME='companyhub_device_v2';
const DEVICE_COOKIE_SECONDS=31536000;
let DEVICE_GATE_WAITER=null,DEVICE_GATE_STATE=null,DEVICE_GATE_BUSY=false,DEVICE_HEARTBEAT=null,DEVICE_PENDING_POLL=null;
let DEVICE_REQUESTS=[],DEVICE_REGISTRY=[],DEVICE_REGISTRY_SUMMARY={total:0,registered:0,pending:0,never_registered:0,inactive_history:0},DEVICE_REQUESTS_LOADING=false,DEVICE_CAN_REVIEW=false,DEVICE_VIEW_TAB='pending',DEVICE_FILTER_SEARCH='',DEVICE_FILTER_DEPT='',DEVICE_FILTER_STATUS='';

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
  if(state==='needs_initial_request')return {icon:'📱',title:'ลงทะเบียนอุปกรณ์เครื่องนี้',body:'อุปกรณ์เครื่องนี้ยังไม่ได้ลงทะเบียน กรุณาส่งคำขอให้ IT อนุมัติ',note:'ผู้อนุมัติมีเฉพาะคุณแม็ก คุณพี และ AMM เมื่ออนุมัติแล้วเข้าใช้งานได้ทันที',action:'request_initial',button:'ส่งคำขอลงทะเบียน'};
  if(state==='needs_change_reason')return {icon:'📱',title:'ระบุเหตุผลที่เปลี่ยนเครื่อง',body:'บัญชีนี้มีอุปกรณ์ใช้งานอยู่แล้ว กรุณาชี้แจงเหตุผลก่อนส่งคำขอ',note:'เหตุผลจะแสดงต่อผู้อนุมัติและส่งแจ้งใน Telegram',action:'request_change',button:'ส่งคำขอเปลี่ยนเครื่อง'};
  if(state==='pending')return {icon:'⏳',title:'รอ IT อนุมัติ',body:DEVICE_GATE_STATE?.reason||'ส่งคำขอแล้ว กรุณารอคุณแม็ก คุณพี หรือ AMM อนุมัติ',note:DEVICE_GATE_STATE?.request_reason?`เหตุผลที่ส่ง: ${DEVICE_GATE_STATE.request_reason}`:'ระบบจะตรวจสอบสถานะให้อัตโนมัติ เมื่ออนุมัติแล้วเข้าใช้งานได้ทันที',action:'retry',button:'ตรวจสอบอีกครั้ง'};
  return {icon:'⛔',title:'อุปกรณ์นี้ยังใช้งานไม่ได้',body:DEVICE_GATE_STATE?.reason||'อุปกรณ์นี้ถูกปฏิเสธหรือยกเลิกสิทธิ์ กรุณาติดต่อผู้ดูแลระบบ',note:'หากเป็นการเปลี่ยนเครื่องโดยถูกต้อง กรุณาให้ผู้ดูแลตรวจสอบรายการอุปกรณ์',action:'logout',button:'ออกจากระบบ'};
}
function showDeviceGate(state,data={}){
  DEVICE_GATE_STATE={state,...data};const copy=deviceGateCopy(state),root=ensureDeviceGateMarkup(),card=root.querySelector('#deviceGateCard');
  const login=document.getElementById('loginBg');if(login)login.style.display='none';loginBackground(true);root.style.display='flex';
  const reason=state==='needs_change_reason'?`<label class="device-change-reason">เหตุผลที่ต้องเพิ่มหรือเปลี่ยนเครื่อง<textarea id="deviceChangeReason" maxlength="500" rows="4" placeholder="เช่น โทรศัพท์เครื่องเดิมเสียและส่งซ่อม จึงต้องใช้อุปกรณ์สำรอง"></textarea><small>อย่างน้อย 10 ตัวอักษร · ระบบบันทึกในประวัติและแจ้ง Telegram</small></label>`:'';
  card.innerHTML=`<div class="device-gate-icon">${copy.icon}</div><h2 id="deviceGateTitle">${copy.title}</h2><p>${copy.body}</p><div class="device-gate-note">${copy.note}<br><b>อุปกรณ์:</b> ${esc(deviceAccessLabel())}</div>${reason}<div id="deviceGateError" class="device-gate-error" role="alert"></div><div class="device-gate-actions"><button class="tbtn primary" id="deviceGatePrimary" onclick="deviceGateAction('${copy.action}')">${copy.button}</button>${copy.action!=='logout'?'<button class="tbtn" onclick="deviceGateLogout()">ออกจากระบบ</button>':''}</div>`;
  clearTimeout(DEVICE_PENDING_POLL);if(state==='pending')DEVICE_PENDING_POLL=setTimeout(()=>deviceGateAction('retry'),5000);
  requestAnimationFrame(()=>card.focus({preventScroll:true}));
}
function hideDeviceGate(){clearTimeout(DEVICE_PENDING_POLL);const root=document.getElementById('deviceGateBg');if(root)root.style.display='none';}
function finishDeviceGate(){hideDeviceGate();const waiter=DEVICE_GATE_WAITER;DEVICE_GATE_WAITER=null;DEVICE_GATE_STATE=null;if(waiter)waiter(true);}
async function deviceGateAction(action){
  if(action==='logout')return deviceGateLogout();if(DEVICE_GATE_BUSY)return;DEVICE_GATE_BUSY=true;
  const button=document.getElementById('deviceGatePrimary'),error=document.getElementById('deviceGateError');if(error)error.textContent='';if(button){button.disabled=true;button.textContent='กำลังตรวจสอบ…';}
  try{const requestReason=action==='request_change'?String(document.getElementById('deviceChangeReason')?.value||'').trim():'';if(action==='request_change'&&requestReason.length<10)throw new Error('กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร');const data=await deviceAccessCall(action==='retry'?'status':action,{request_reason:requestReason});if(data.allowed){startDeviceHeartbeat();finishDeviceGate();return;}showDeviceGate(data.state||'blocked',data);}
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
  DEVICE_REQUESTS_LOADING=true;try{const [pending,registry]=await Promise.all([deviceAccessCall('list_pending'),deviceAccessCall('list_registry')]);DEVICE_CAN_REVIEW=Boolean(pending.can_review);DEVICE_REQUESTS=pending.requests||[];DEVICE_REGISTRY=registry.registry||[];DEVICE_REGISTRY_SUMMARY=registry.summary||{total:0,registered:0,pending:0,never_registered:0,inactive_history:0};}catch(error){toast('โหลดทะเบียนอุปกรณ์ไม่สำเร็จ · '+(error.message||error),'info');}finally{DEVICE_REQUESTS_LOADING=false;if(render&&VIEW==='devices')RENDER.devices();buildNav();}
}
async function reviewDeviceRequest(id,decision){
  const row=DEVICE_REQUESTS.find(item=>item.id===id),label=decision==='approve'?'อนุมัติและเปิดใช้งาน':'ปฏิเสธ',reason=row?.request_reason||'ไม่ระบุ';if(!confirm(`${label}คำขออุปกรณ์นี้ใช่หรือไม่?\n\nเหตุผลของผู้ขอ: ${reason}`))return;
  try{const data=await deviceAccessCall('review',{device_record_id:id,decision});if(!data.allowed)throw new Error(data.error||'ดำเนินการไม่สำเร็จ');toast(label+'แล้ว');await loadDeviceRequests(true);}catch(error){toast(label+'ไม่สำเร็จ · '+(error.message||error),'info');}
}
function deviceRegistryState(row){
  if(row.devices.some(d=>d.status==='approved'))return 'registered';
  if(row.devices.some(d=>d.status==='pending'))return 'pending';
  return row.devices.length?'inactive':'never';
}
async function deleteDeviceHistory(id,profileName,status){
  if(AUTH_DB_ROLE!=='admin'){toast('เฉพาะผู้ดูแลระบบเท่านั้นที่ลบประวัติได้','info');return;}
  const active=status==='approved';
  const warning=active?'\n\nเครื่องนี้กำลังใช้งานอยู่ หลังลบผู้ใช้จะต้องลงทะเบียนเครื่องใหม่ทันที':'';
  if(!confirm(`ลบประวัติอุปกรณ์ของ ${profileName} จริงหรือไม่?${warning}\n\nการลบนี้ย้อนกลับไม่ได้`))return;
  try{const data=await deviceAccessCall('delete_history',{device_record_id:id});if(!data.allowed)throw new Error(data.error||'ลบประวัติไม่สำเร็จ');toast('ลบประวัติอุปกรณ์แล้ว');await loadDeviceRequests(true);}catch(error){toast('ลบประวัติไม่สำเร็จ · '+(error.message||error),'info');}
}
RENDER.devices=function(){
  if(!['lead','admin'].includes(AUTH_DB_ROLE)){main.innerHTML=`${crumb('หน้าแรก','อนุมัติอุปกรณ์')}<div class="card pad">บัญชีนี้ไม่มีสิทธิ์อนุมัติอุปกรณ์</div>`;return;}
  if(DEVICE_REQUESTS_LOADING){main.innerHTML=`${crumb('หน้าแรก','อนุมัติอุปกรณ์')}<div class="card pad">กำลังโหลดคำขอ…</div>`;return;}
  if(!DEVICE_CAN_REVIEW)DEVICE_VIEW_TAB='registry';
  const rows=DEVICE_REQUESTS,s=DEVICE_REGISTRY_SUMMARY;
  const pendingHtml=rows.length?`<div class="device-request-list">${rows.map(row=>`<article class="device-request-card"><div><h3>${esc(row.profile.display_name||row.profile.email)}</h3><div class="device-request-meta">${esc(row.profile.position_title||'ไม่ระบุตำแหน่ง')} · ${esc(deptName(row.profile.department_code))}<br><b>อุปกรณ์ใหม่:</b> ${esc(row.device_label)}<br><b>ประเภท:</b> ${row.request_kind==='initial'?'ลงทะเบียนเครื่องแรก':'เพิ่ม/เปลี่ยนเครื่อง'}<br><b>ขอเมื่อ:</b> ${new Date(row.requested_at).toLocaleString('th-TH',{timeZone:ORG_TIMEZONE})}</div><div class="device-request-reason"><b>เหตุผลของผู้ขอ</b><span>${esc(row.request_reason||'ไม่ระบุ')}</span></div></div><div class="device-request-actions"><button class="tbtn primary" onclick="reviewDeviceRequest('${row.id}','approve')">✓ อนุมัติและเปิดใช้งาน</button><button class="tbtn" onclick="reviewDeviceRequest('${row.id}','reject')">ปฏิเสธ</button></div></article>`).join('')}</div>`:'<div class="device-request-empty">✓ ไม่มีคำขออุปกรณ์ที่รออนุมัติ</div>';
  const statusLabel={approved:'ใช้งานอยู่',pending:'รออนุมัติ',blocked:'ยกเลิก/ปฏิเสธ'};
  const departments=[...new Set(DEVICE_REGISTRY.map(row=>row.profile.department_code).filter(Boolean))].sort((a,b)=>deptName(a).localeCompare(deptName(b),'th'));
  const needle=DEVICE_FILTER_SEARCH.trim().toLocaleLowerCase('th');
  const filtered=DEVICE_REGISTRY.filter(row=>{
    const hay=`${row.profile.display_name||''} ${row.profile.email||''} ${row.profile.position_title||''}`.toLocaleLowerCase('th');
    return (!needle||hay.includes(needle))&&(!DEVICE_FILTER_DEPT||row.profile.department_code===DEVICE_FILTER_DEPT)&&(!DEVICE_FILTER_STATUS||deviceRegistryState(row)===DEVICE_FILTER_STATUS);
  });
  const personLabel={registered:'ลงทะเบียนแล้ว',pending:'รออนุมัติ',inactive:'มีประวัติ แต่ไม่มีเครื่องใช้งาน',never:'ยังไม่เคยลงทะเบียน'};
  const registryHtml=`<div class="device-registry-summary"><div><span>พนักงานในขอบเขต</span><b>${s.total||0}</b></div><div><span>ลงทะเบียนแล้ว</span><b>${s.registered||0}</b></div><div><span>รออนุมัติ</span><b>${s.pending||0}</b></div><div><span>ไม่มีเครื่องใช้งาน</span><b>${(s.inactive_history||0)+(s.never_registered||0)}</b></div><div><span>ยังไม่เคยลงทะเบียน</span><b>${s.never_registered||0}</b></div></div><div class="device-registry-filters"><input value="${esc(DEVICE_FILTER_SEARCH)}" placeholder="ค้นหาชื่อ อีเมล หรือตำแหน่ง" oninput="DEVICE_FILTER_SEARCH=this.value" onkeydown="if(event.key==='Enter'){event.preventDefault();RENDER.devices()}"><select onchange="DEVICE_FILTER_DEPT=this.value;RENDER.devices()"><option value="">ทุกแผนก</option>${departments.map(code=>`<option value="${esc(code)}" ${DEVICE_FILTER_DEPT===code?'selected':''}>${esc(deptName(code))}</option>`).join('')}</select><select onchange="DEVICE_FILTER_STATUS=this.value;RENDER.devices()"><option value="">ทุกสถานะ</option><option value="registered" ${DEVICE_FILTER_STATUS==='registered'?'selected':''}>ลงทะเบียนแล้ว</option><option value="pending" ${DEVICE_FILTER_STATUS==='pending'?'selected':''}>รออนุมัติ</option><option value="inactive" ${DEVICE_FILTER_STATUS==='inactive'?'selected':''}>มีประวัติ แต่ไม่มีเครื่องใช้งาน</option><option value="never" ${DEVICE_FILTER_STATUS==='never'?'selected':''}>ยังไม่เคยลงทะเบียน</option></select><button class="tbtn primary" onclick="RENDER.devices()">ค้นหา</button><button class="tbtn" onclick="DEVICE_FILTER_SEARCH='';DEVICE_FILTER_DEPT='';DEVICE_FILTER_STATUS='';RENDER.devices()">ล้างตัวกรอง</button></div><div class="device-filter-count">แสดง ${filtered.length} จาก ${DEVICE_REGISTRY.length} คน</div><div class="device-registry-list">${filtered.map(row=>{const state=deviceRegistryState(row),profileName=row.profile.display_name||row.profile.email;return `<details class="device-registry-person" ${state==='pending'?'open':''}><summary><span><b>${esc(profileName)}</b><small>${esc(row.profile.position_title||'ไม่ระบุตำแหน่ง')} · ${esc(deptName(row.profile.department_code))}</small></span><span class="device-person-state ${state==='registered'?'ok':state==='pending'?'wait':'none'}">${personLabel[state]}</span></summary>${row.devices.length?`<div class="device-person-devices">${row.devices.map(d=>`<div class="device-record"><div><b>${esc(d.device_label||'ไม่ระบุอุปกรณ์')}</b><small>${esc(d.request_kind==='initial'?'เครื่องแรก':d.request_kind==='replacement'?'เปลี่ยนเครื่อง':'ยกเว้นการอนุมัติ')} · ขอเมื่อ ${new Date(d.requested_at).toLocaleString('th-TH',{timeZone:ORG_TIMEZONE})}</small></div><div class="device-record-actions"><span class="device-record-status ${esc(d.status)}">${statusLabel[d.status]||esc(d.status)}</span>${AUTH_DB_ROLE==='admin'?`<button class="tbtn danger" onclick="event.preventDefault();deleteDeviceHistory('${d.id}',decodeURIComponent('${encodeURIComponent(profileName)}'),'${esc(d.status)}')">ลบประวัติ</button>`:''}</div></div>`).join('')}</div>`:'<div class="device-person-empty">ยังไม่มีประวัติลงทะเบียนอุปกรณ์</div>'}</details>`}).join('')||'<div class="device-request-empty">ไม่พบพนักงานที่ตรงกับตัวกรอง</div>'}</div>`;
  main.innerHTML=`${crumb('หน้าแรก','อนุมัติอุปกรณ์')}<div class="page-h"><div><h1>อนุมัติและทะเบียนอุปกรณ์</h1><p>${DEVICE_CAN_REVIEW?'คุณแม็ก คุณพี และ AMM เท่านั้นที่อนุมัติอุปกรณ์':'บัญชีนี้ดูทะเบียนได้ แต่ไม่มีสิทธิ์อนุมัติอุปกรณ์'} · หัวหน้าเห็นทะเบียนพนักงานในแผนกที่ตนดูแล</p></div><button class="tbtn" onclick="loadDeviceRequests(true)">↻ โหลดใหม่</button></div><div class="device-tabs">${DEVICE_CAN_REVIEW?`<button class="tbtn ${DEVICE_VIEW_TAB==='pending'?'primary':''}" onclick="DEVICE_VIEW_TAB='pending';RENDER.devices()">คำขอรออนุมัติ ${rows.length?`(${rows.length})`:''}</button>`:''}<button class="tbtn ${DEVICE_VIEW_TAB==='registry'?'primary':''}" onclick="DEVICE_VIEW_TAB='registry';RENDER.devices()">ทะเบียนพนักงาน</button></div>${DEVICE_VIEW_TAB==='pending'?pendingHtml:registryHtml}`;
};
