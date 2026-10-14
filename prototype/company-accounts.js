/* Login credentials live in Supabase Auth; work ownership always stays on UUID. */
let ACCOUNT_STATUS=null,ACCOUNT_STARTING=false,ACCOUNT_CANDIDATES=[],ACCOUNT_INITIAL_CODES=[],ACCOUNT_BATCH_RUNNING=false,ACCOUNT_BOOTSTRAP_PLAN=null;
let ACCOUNT_LIST=[],ACCOUNT_TABLE_QUERY='',ACCOUNT_TABLE_DEPT='',ACCOUNT_TABLE_STATUS='';
NAV.account={ic:'i-user',t:'บัญชีของฉัน'};NAV.teamAccounts={ic:'i-users',t:'บัญชีทีม'};
NAVGROUPS[2].items.push('account','teamAccounts');
for(const table of [ROLE_ALLOW,SIMPLE_ALLOW])for(const role of Object.keys(table)){table[role].push('account');if(role==='exec')table[role].push('teamAccounts');}
async function accountCall(action,body={},token){
 if(token===undefined)token=(await SB.auth.getSession()).data.session?.access_token;
 const response=await fetch(SUPA_URL+'/functions/v1/company-accounts',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPA_KEY,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,...body}),cache:'no-store'});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'ระบบบัญชียังไม่พร้อม');return result;
}
const accountEmailLogin=sbLogin;
let ACCOUNT_EMAIL_CHOICE=null;
function clearAccountEmailChoice(){
 ACCOUNT_EMAIL_CHOICE=null;document.getElementById('account-login-choice')?.remove();
 const input=document.getElementById('sbEmail'),pass=document.getElementById('sbPass'),button=document.getElementById('sbLoginBtn');
 if(!input||!pass||!button)return;
 const email=input.value.includes('@')&&!input.value.trim().endsWith(')');
 pass.value='';pass.hidden=email;button.textContent=email?'ถัดไป':'เข้าสู่ระบบ';
}
// The login modal is rendered after this module loads, so use delegated input\n// handling to keep the email-first flow active every time the dialog opens.\ndocument.addEventListener('input',event=>{if(event.target?.id==='sbEmail')clearAccountEmailChoice();});
sbLogin=async function(){
 const login=val('sbEmail').trim(),isEmail=login.includes('@')&&!login.endsWith(')');
 const button=document.getElementById('sbLoginBtn'),error=document.getElementById('sbErr');setLoginBusy(true,isEmail&&!ACCOUNT_EMAIL_CHOICE?'กำลังค้นหาบัญชี…':'กำลังเข้าสู่ระบบ…');error.textContent='';
 try{
  let target=login;
  if(isEmail){
   const email=login.toLowerCase();
   if(ACCOUNT_EMAIL_CHOICE?.email!==email){
    const result=await accountCall('lookup-email',{email},null);
    if(val('sbEmail').trim().toLowerCase()!==email)return;
    const accounts=result.mode==='single'&&result.account?[result.account]:(result.accounts||[]);
    ACCOUNT_EMAIL_CHOICE={email,mode:result.mode||'',accounts};
    document.getElementById('account-login-choice')?.remove();
    if(ACCOUNT_EMAIL_CHOICE.mode==='choose_name'){
     const label=document.createElement('label');label.id='account-login-choice';label.textContent='อีเมลนี้มีหลายบัญชี · เลือกชื่อและตำแหน่งของคุณ';
     const select=document.createElement('select');select.className='fin';select.id='account-login-person';select.setAttribute('aria-label','เลือกชื่อของคุณ');
     const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='เลือกชื่อก่อนกรอกรหัสผ่าน';select.append(placeholder);
     for(const row of ACCOUNT_EMAIL_CHOICE.accounts){const option=document.createElement('option');option.value=row.login_name;const duties=[row.position_title,(row.department_codes||[row.department_code]).map(deptName).join(', ')].filter(Boolean).join(' · ');option.textContent=row.display_name+(duties?' · '+duties:'');select.append(option);}
     select.onchange=()=>{const pass=document.getElementById('sbPass');pass.value='';pass.hidden=!select.value;if(select.value)pass.focus();};
     label.append(select);document.getElementById('sbPass').before(label);document.getElementById('sbPass').hidden=true;
    }else if(ACCOUNT_EMAIL_CHOICE.mode==='single'){
     const row=ACCOUNT_EMAIL_CHOICE.accounts[0],duties=[row.position_title,(row.department_codes||[row.department_code]).map(deptName).join(', ')].filter(Boolean).join(' · ');const note=document.createElement('p');note.id='account-login-choice';note.textContent='บัญชี: '+row.display_name+(duties?' · '+duties:'');
     document.getElementById('sbPass').before(note);document.getElementById('sbPass').hidden=false;document.getElementById('sbPass').focus();
    }else{document.getElementById('sbPass').hidden=false;error.textContent='หากเป็นบัญชีอีเมลเดิม ให้กรอกรหัสผ่านเพื่อเข้าสู่ระบบ';}
    document.getElementById('sbPass').value='';button.textContent='เข้าสู่ระบบ';return;
   }
   if(!ACCOUNT_EMAIL_CHOICE.accounts.length){await accountEmailLogin();return;}
   if(ACCOUNT_EMAIL_CHOICE.mode==='single')target=ACCOUNT_EMAIL_CHOICE.accounts[0].login_name;
   else target=document.getElementById('account-login-person')?.value;
   if(!target){error.textContent='เลือกชื่อของคุณก่อน';return;}
  }
  if(!val('sbPass')){error.textContent='กรอกรหัสผ่านของบัญชีที่เลือก';return;}
  const result=await accountCall('login',{login:target,password:val('sbPass'),...(isEmail?{email:login.toLowerCase()}:{})},null);
  const r=await SB.auth.setSession(result.session);if(r.error)throw r.error;clearAccountEmailChoice();
 }catch(e){error.textContent=e.message;}finally{setLoginBusy(false);}
};
const accountOriginalLoggedIn=onLoggedIn;
onLoggedIn=async function(session){
 if(ACCOUNT_STARTING||_cloudStarted)return false;ACCOUNT_STARTING=true;
 try{ACCOUNT_STATUS=await accountCall('status',{},session.access_token);
  if(ACCOUNT_STATUS.must_change_password){showLogin();renderFirstPassword(session);return false;}
  return await accountOriginalLoggedIn(session);
 }catch(e){showLogin();document.getElementById('sbErr').textContent=e.message;return false;}
 finally{ACCOUNT_STARTING=false;}
};
function accountPasswordFields(){return '<label>รหัสปัจจุบัน / รหัสครั้งแรก<input class="fin" name="current" type="password" autocomplete="current-password" required></label><label>รหัสใหม่ (12–128 ตัวอักษร)<input class="fin" name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><label>ยืนยันรหัสใหม่<input class="fin" name="confirm" type="password" autocomplete="new-password" required></label><p class="login-err" role="alert"></p><button class="tbtn primary" type="submit">ตั้งรหัสใหม่</button>';}
function bindAccountPassword(form,token){form.onsubmit=async e=>{e.preventDefault();const f=form.elements,error=form.querySelector('[role=alert]'),button=form.querySelector('button');error.textContent='';if(f.password.value!==f.confirm.value){error.textContent='ยืนยันรหัสผ่านไม่ตรงกัน';return;}button.disabled=true;
 try{await accountCall('password',{current_password:f.current.value,password:f.password.value},token);form.reset();await SB.auth.signOut();location.reload();}
 catch(e){error.textContent=e.message;}finally{button.disabled=false;}};}
function renderFirstPassword(session){
 const card=document.querySelector('#loginBg .login-card');card.innerHTML=`<h2>ตั้งรหัสผ่านของคุณ</h2><p>${esc(ACCOUNT_STATUS.display_name)}</p><p>เปลี่ยนรหัสครั้งแรกก่อนเปิดข้อมูลงาน เมื่อตั้งแล้วให้เข้าสู่ระบบอีกครั้ง</p><form id="first-password">${accountPasswordFields()}</form><button class="tbtn" onclick="sbLogout()">ออกจากระบบ</button><div id="sbErr" role="alert"></div>`;
 bindAccountPassword(document.getElementById('first-password'),session.access_token);
}
RENDER.account=async function(){
 main.innerHTML='<p>กำลังเปิดบัญชี…</p>';
 try{const info=await accountCall('status');if(VIEW!=='account')return;
 const profile=ACCESS_PROFILE||{},display=info.display_name||profile.display_name||profile.email||'บัญชีผู้ใช้',name=info.personal_name||display.replace(/ \([^()]+\)$/,''),contact=info.contact_email||profile.email||'',roleCode=profile.role||(typeof AUTH_DB_ROLE!=='undefined'?AUTH_DB_ROLE:'staff'),role=(typeof ACCESS_ROLE_LABEL!=='undefined'&&ACCESS_ROLE_LABEL[roleCode])||roleCode||'พนักงาน',position=profile.position_title||'ยังไม่ระบุตำแหน่ง';
 const visibleCodes=typeof VISIBLE_DEPTS!=='undefined'&&Array.isArray(VISIBLE_DEPTS)?VISIBLE_DEPTS:[],departmentCodes=[...new Set([profile.department_code,currentDept(),...visibleCodes].filter(Boolean))],departments=departmentCodes.length?departmentCodes.map(code=>`<span style="--dept-color:${deptColor(code)}">${esc(deptName(code))}</span>`).join(''):'<span class="missing">ยังไม่กำหนดแผนก</span>',initial=(name||display).trim().slice(0,1).toLocaleUpperCase('th')||'U';
 const method=info.username_account?'ชื่อผู้ใช้ Company Hub':'อีเมลเดิม',accountState=profile.active===false?'ปิดใช้งาน':'พร้อมใช้งาน';
 const hero=`${crumb('หน้าแรก','บัญชีของฉัน')}<section class="account-profile-hero"><div class="account-hero-avatar" aria-hidden="true">${esc(initial)}</div><div class="account-hero-copy"><span class="account-eyebrow">บัญชีผู้ใช้งาน</span><h1>${esc(display)}</h1><p>${esc(position)} · ${esc(role)}</p><div class="account-hero-depts">${departments}</div></div><div class="account-hero-state"><span class="account-status ${profile.active===false?'inactive':'ready'}">${accountState}</span><button class="tbtn sm" type="button" onclick="openManual().then(()=>gotoManual('account'))">เปิดคู่มือบัญชี</button></div></section>`;
 const summary=`<section class="account-meta-grid" aria-label="สรุปบัญชี"><article><span>แผนกหลัก</span><b>${esc(deptName(profile.department_code||currentDept()))}</b></article><article><span>ตำแหน่ง / สิทธิ์</span><b>${esc(position)}</b><small>${esc(role)}</small></article><article><span>วิธีเข้าสู่ระบบ</span><b>${esc(method)}</b></article><article><span>สถานะบัญชี</span><b>${esc(accountState)}</b><small>ข้อมูลและสิทธิ์ผูกกับบัญชีนี้</small></article></section>`;
 if(!info.username_account){main.innerHTML=`${hero}${summary}<div class="account-info-grid"><section class="card pad account-info-card"><div class="account-card-head"><span class="account-card-icon">ID</span><div><h3>ข้อมูลบัญชี</h3><p>ข้อมูลที่ใช้ระบุตัวตนในระบบ</p></div></div><dl class="account-detail-list"><div><dt>ชื่อที่แสดง</dt><dd>${esc(display)}</dd></div><div><dt>อีเมลเข้าใช้</dt><dd>${esc(contact||'ยังไม่พบอีเมล')}</dd></div><div><dt>แผนกที่มองเห็น</dt><dd><div class="account-hero-depts">${departments}</div></dd></div></dl></section><section class="card pad account-security-card"><div class="account-card-head"><span class="account-card-icon secure">✓</span><div><h3>การเข้าสู่ระบบและความปลอดภัย</h3><p>บัญชีนี้ใช้ระบบอีเมลเดิม</p></div></div><div class="account-security-note"><b>เข้าสู่ระบบด้วยอีเมลที่ลงทะเบียน</b><p>หากต้องการเปลี่ยนชื่อ อีเมล รหัสผ่าน หรือแผนก ให้แจ้งผู้ดูแลระบบเพื่อยืนยันตัวตนก่อนแก้ไข</p></div><ul class="account-check-list"><li>สิทธิ์การมองเห็นอ้างอิงตามแผนกและบทบาท</li><li>งานเดิมยังผูกกับบัญชีนี้ครบถ้วน</li><li>ไม่ต้องสร้างบัญชีใหม่เมื่อเปลี่ยนแปลงข้อมูล</li></ul></section></div>`;return;}
 main.innerHTML=`${hero}${summary}<div class="account-info-grid"><form id="account-details" class="card pad account-form-card"><div class="account-card-head"><span class="account-card-icon">ID</span><div><h3>ชื่อและอีเมลติดต่อ</h3><p>แก้ไขข้อมูลของบัญชีนี้ได้โดยไม่กระทบงานเดิม</p></div></div><label>ชื่อที่แสดง<input class="fin" name="display" maxlength="100" required value="${esc(name)}"></label><p class="account-field-help">ชื่อเข้าใช้จะแสดงร่วมกับแผนกหลัก งานและประวัติยังอยู่ครบ</p><label>อีเมลติดต่อ (ไม่บังคับ)<input class="fin" type="email" name="email" maxlength="254" value="${esc(info.contact_email)}"></label><p class="account-field-help">อีเมลนี้ยังไม่ใช้ล็อกอินหรือกู้รหัสผ่านโดยอัตโนมัติ</p><p role="alert"></p><button class="tbtn primary">บันทึกข้อมูลบัญชี</button></form><form id="account-password" class="card pad account-form-card"><div class="account-card-head"><span class="account-card-icon secure">✓</span><div><h3>เปลี่ยนรหัสผ่าน</h3><p>ตั้งรหัสเฉพาะตัวและเก็บเป็นความลับ</p></div></div>${accountPasswordFields()}</form></div>`;
 const form=document.getElementById('account-details');form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const r=await SB.rpc('update_company_account_details',{p_name:form.elements.display.value,p_email:form.elements.email.value});if(r.error)throw r.error;ACCESS_PROFILE.display_name=r.data.display_name;const profile=TASK_PROFILES.find(p=>p.id===ACCESS_PROFILE.id);if(profile)profile.display_name=r.data.display_name;if(USERS[ACCESS_PROFILE.id])USERS[ACCESS_PROFILE.id].n=r.data.display_name;toast('บันทึกแล้ว งานเดิมยังผูกกับบัญชีนี้');RENDER.account();}catch(e){form.querySelector('[role=alert]').textContent=e.message;}finally{button.disabled=false;}};
 bindAccountPassword(document.getElementById('account-password'));
 }catch(e){main.textContent=e.message;}
};
function accountShowCode(result){
 showModal(`<div class="modal-h"><h3>รหัสเข้าครั้งแรก</h3><button class="x" onclick="closeModal()">×</button></div><div class="pad"><p>บัญชี: <b>${esc(result.login_name)}</b></p><p>ส่งรหัสนี้ให้เจ้าของบัญชีเป็นการส่วนตัว ระบบจะแสดงครั้งนี้ครั้งเดียว รหัสมีอายุ 7 วัน และบังคับตั้งรหัสใหม่ก่อนเปิดงาน</p><code data-initial-code style="overflow-wrap:anywhere">${esc(result.initial_password)}</code><p>ผู้ดูแลต้องอนุมัติเครื่องในหน้าจัดการพนักงานก่อนเข้าใช้งานตามนโยบายเดิม</p></div>`);
}
function accountInitialPasswordOptions(){
 const input=document.getElementById('account-custom-initial-password');
 if(!input||input.value==='')return {};
 if(input.value.length<12||input.value.length>128||!input.reportValidity())throw new Error('รหัสแรกเข้าที่กำหนดเองต้องมี 12–128 ตัวอักษร');
 return {initial_password:input.value};
}
function accountDirectoryProfile(account){return (typeof ACCESS_USERS!=='undefined'&&ACCESS_USERS.find(p=>p.id===account.profile_id))||null;}
function accountDirectoryDepartments(account){
 const profile=accountDirectoryProfile(account),rows=typeof ACCESS_USER_DEPTS!=='undefined'?ACCESS_USER_DEPTS.filter(x=>x.profile_id===account.profile_id):[];
 return [...new Set([profile?.department_code,...rows.map(x=>x.department_code)].filter(Boolean))];
}
function accountDirectoryState(account){const profile=accountDirectoryProfile(account);if(profile&&profile.active===false)return'inactive';return account.must_change_password?'pending':'ready';}
function accountDirectoryRows(){
 const q=ACCOUNT_TABLE_QUERY.trim().toLocaleLowerCase('th'),emailCounts=new Map();
 for(const account of ACCOUNT_LIST){const email=String(account.contact_email||'').trim().toLowerCase();if(email)emailCounts.set(email,(emailCounts.get(email)||0)+1);}
 return ACCOUNT_LIST.map(account=>{const profile=accountDirectoryProfile(account),departments=accountDirectoryDepartments(account),primary=profile?.department_code||departments[0]||'OTHER',state=accountDirectoryState(account);return {account,profile,departments,primary,state,sharedEmail:!!account.contact_email&&emailCounts.get(String(account.contact_email).trim().toLowerCase())>1};})
  .filter(row=>(!ACCOUNT_TABLE_DEPT||row.departments.includes(ACCOUNT_TABLE_DEPT))&&(!ACCOUNT_TABLE_STATUS||row.state===ACCOUNT_TABLE_STATUS)&&(!q||[row.account.login_name,row.account.contact_email,row.profile?.display_name,row.profile?.position_title,...row.departments.map(deptName)].join(' ').toLocaleLowerCase('th').includes(q)))
  .sort((a,b)=>(DEPTS.findIndex(d=>d.code===a.primary)-DEPTS.findIndex(d=>d.code===b.primary))||String(a.profile?.display_name||a.account.login_name).localeCompare(String(b.profile?.display_name||b.account.login_name),'th'));
}
function accountStateBadge(state){const map={ready:['พร้อมใช้','ready'],pending:['รอตั้งรหัส','pending'],inactive:['ปิดใช้งาน','inactive']},item=map[state]||map.pending;return `<span class="account-status ${item[1]}">${item[0]}</span>`;}
function accountDirectoryTable(rows){return `<div class="account-sheet"><table><thead><tr><th>ชื่อ / ชื่อเข้าใช้</th><th>อีเมล</th><th>แผนกที่รับผิดชอบ</th><th>ตำแหน่ง / สิทธิ์</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${rows.map(({account,profile,departments,state,sharedEmail})=>`<tr><td><b>${esc(profile?.display_name||account.login_name)}</b><small>${esc(account.login_name)}</small></td><td>${account.contact_email?`<span>${esc(account.contact_email)}</span>${sharedEmail?'<small class="account-shared">อีเมลใช้ร่วม</small>':''}`:'<span class="muted">ยังไม่กรอก</span>'}</td><td><div class="account-dept-chips">${departments.length?departments.map(code=>`<span style="--dept-color:${deptColor(code)}">${esc(deptName(code))}</span>`).join(''):'<span class="missing">ยังไม่กำหนด</span>'}</div></td><td><b>${esc(profile?.position_title||'ยังไม่ระบุตำแหน่ง')}</b><small>${esc((typeof ACCESS_ROLE_LABEL!=='undefined'&&ACCESS_ROLE_LABEL[profile?.role])||profile?.role||'พนักงาน')}</small></td><td>${accountStateBadge(state)}</td><td><div class="account-actions"><button class="tbtn sm" data-account-duties="${esc(account.profile_id)}">แก้แผนก / หน้าที่</button><button class="tbtn sm" data-account-reset="${esc(account.profile_id)}">ออกรหัสใหม่</button></div></td></tr>`).join('')}</tbody></table></div>`;}
function bindAccountDirectoryActions(){
 main.querySelectorAll('[data-account-duties]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await loadAccessUsers(true);openAccessUser(button.dataset.accountDuties);}catch(e){toast(e.message,'info');}finally{button.disabled=false;}});
 main.querySelectorAll('[data-account-reset]').forEach(button=>button.onclick=async()=>{if(!confirm('ออกรหัสใหม่ให้บัญชีนี้? รหัสและการเข้าสู่ระบบเดิมจะใช้ไม่ได้'))return;button.disabled=true;try{accountShowCode(await accountCall('reset',{profile_id:button.dataset.accountReset}));}catch(e){document.getElementById('account-admin-error').textContent=e.message;}finally{button.disabled=false;}});
}
function renderAccountDirectory(){
 const box=document.getElementById('account-directory');if(!box)return;const rows=accountDirectoryRows(),ready=ACCOUNT_LIST.filter(a=>accountDirectoryState(a)==='ready').length,pending=ACCOUNT_LIST.filter(a=>accountDirectoryState(a)==='pending').length,inactive=ACCOUNT_LIST.filter(a=>accountDirectoryState(a)==='inactive').length;
 const groups=[];if(ACCOUNT_TABLE_DEPT){const dept=DEPTS.find(d=>d.code===ACCOUNT_TABLE_DEPT);if(rows.length)groups.push({code:ACCOUNT_TABLE_DEPT,name:dept?.name||ACCOUNT_TABLE_DEPT,rows});}else{for(const dept of DEPTS){const deptRows=rows.filter(row=>row.primary===dept.code);if(deptRows.length)groups.push({code:dept.code,name:dept.name,rows:deptRows});}const other=rows.filter(row=>!DEPTS.some(d=>d.code===row.primary));if(other.length)groups.push({code:'OTHER',name:'ยังไม่ระบุแผนก',rows:other});}
 box.innerHTML=`<div class="account-summary"><div><b>${ACCOUNT_LIST.length}</b><span>บัญชีทั้งหมด</span></div><div><b>${ready}</b><span>พร้อมใช้</span></div><div><b>${pending}</b><span>รอตั้งรหัส</span></div><div><b>${inactive}</b><span>ปิดใช้งาน</span></div></div><div class="account-filters"><label>ค้นหาชื่อหรืออีเมล<input class="fin" id="account-table-query" value="${esc(ACCOUNT_TABLE_QUERY)}" placeholder="พิมพ์ชื่อ ชื่อเข้าใช้ หรืออีเมล"></label><label>แผนก<select class="fin" id="account-table-dept"><option value="">ทุกแผนก</option>${DEPTS.map(d=>`<option value="${d.code}" ${ACCOUNT_TABLE_DEPT===d.code?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label><label>สถานะ<select class="fin" id="account-table-status"><option value="">ทุกสถานะ</option><option value="ready" ${ACCOUNT_TABLE_STATUS==='ready'?'selected':''}>พร้อมใช้</option><option value="pending" ${ACCOUNT_TABLE_STATUS==='pending'?'selected':''}>รอตั้งรหัส</option><option value="inactive" ${ACCOUNT_TABLE_STATUS==='inactive'?'selected':''}>ปิดใช้งาน</option></select></label></div><div class="resultline">พบ ${rows.length} จาก ${ACCOUNT_LIST.length} บัญชี · แบ่งตามแผนกหลัก</div>${groups.map(group=>`<section class="account-dept-section"><div class="account-dept-title" style="--dept-color:${deptColor(group.code)}"><span></span><h3>${esc(group.name)}</h3><b>${group.rows.length} คน</b></div>${accountDirectoryTable(group.rows)}</section>`).join('')||'<div class="card pad account-empty">ไม่พบบัญชีตามตัวกรอง</div>'}`;
 document.getElementById('account-table-query').oninput=e=>{ACCOUNT_TABLE_QUERY=e.target.value;renderAccountDirectory();};
 document.getElementById('account-table-dept').onchange=e=>{ACCOUNT_TABLE_DEPT=e.target.value;renderAccountDirectory();};
 document.getElementById('account-table-status').onchange=e=>{ACCOUNT_TABLE_STATUS=e.target.value;renderAccountDirectory();};
 bindAccountDirectoryActions();
}
RENDER.teamAccounts=async function(){
 if(!canAdminAccess()){main.textContent='เฉพาะผู้ดูแลหรือผู้บริหาร';return;}
 main.innerHTML='<p>กำลังโหลดบัญชีทีม…</p>';
 try{const {accounts}=await accountCall('list');if(VIEW!=='teamAccounts')return;
 ACCOUNT_LIST=accounts||[];if(typeof loadAccessUsers==='function')await loadAccessUsers();if(VIEW!=='teamAccounts')return;
 main.innerHTML=`${crumb('หน้าแรก','บัญชีทีม')}<div class="page-h account-page-head"><div><h1>บัญชีทีม</h1><p>จัดการรายชื่อแบบตาราง แบ่งตามแผนกหลัก · หนึ่งบัญชีอยู่ได้หลายแผนก</p></div><button class="tbtn primary" onclick="document.getElementById('account-create-panel').open=true;document.getElementById('account-create-panel').scrollIntoView({behavior:'smooth'})">+ สร้างบัญชี</button></div><details class="card pad account-create-panel" id="account-create-panel"><summary><b>สร้างบัญชีจากรายชื่อเดิม</b><span>เปิดเมื่อเพิ่มพนักงานใหม่</span></summary><div class="account-create-body"><label>รหัสแรกเข้าสำหรับบัญชีในรอบนี้<input class="fin" id="account-custom-initial-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><p>กำหนดได้ 12–128 ตัวอักษร และต้องเปลี่ยนเมื่อเข้าครั้งแรก</p><button class="tbtn primary" id="account-live-roster">ดูรายชื่อจากงานในระบบ</button> <button class="tbtn" id="account-create-reviewed" disabled>สร้างบัญชีชื่อที่ตรวจผ่าน</button><p id="account-batch-status" role="status"></p><div id="account-initial-codes"></div><details><summary>นำเข้ารายชื่อที่ตรวจไว้เพิ่มเติม</summary><label>ไฟล์รายชื่อ (.json)<input type="file" id="account-roster" accept="application/json,.json"></label></details><details><summary>เปิดใช้บัญชีจากแผนอีเมลที่ตรวจแล้ว</summary><p>สร้างบัญชีที่ขาด อัปเดตอีเมล/ตำแหน่ง/แผนก ออกรหัสใหม่ทั้งหมด และยังไม่ล็อก IP</p><label>ไฟล์แผนบัญชี (.json)<input type="file" id="account-bootstrap-plan" accept="application/json,.json"></label><button class="tbtn" id="account-bootstrap-apply" disabled>ตรวจและเปิดใช้บัญชีทั้งหมด</button><p id="account-bootstrap-status" role="status"></p></details><div id="account-candidates"></div></div></details><section id="account-directory"></section><p id="account-admin-error" role="alert"></p>`;
 renderAccountDirectory();
 document.getElementById('account-live-roster').onclick=loadLiveAccountCandidates;
 document.getElementById('account-create-reviewed').onclick=createReviewedAccounts;
 renderInitialAccountCodes();
 document.getElementById('account-roster').onchange=async e=>{try{const file=e.target.files[0];if(!file||file.size>1000000)throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 1 MB');const rows=JSON.parse(await file.text());if(!Array.isArray(rows)||rows.length>500)throw new Error('รูปแบบรายชื่อไม่ถูกต้อง');ACCOUNT_CANDIDATES=rows;renderAccountCandidates();}catch(e){document.getElementById('account-admin-error').textContent=e.message;}};
 document.getElementById('account-bootstrap-plan').onchange=async e=>{const status=document.getElementById('account-bootstrap-status'),apply=document.getElementById('account-bootstrap-apply');try{const file=e.target.files[0];if(!file||file.size>1000000)throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 1 MB');const plan=JSON.parse(await file.text()),rows=[...(plan.existing||[]),...(plan.new||[])];if(!rows.length||rows.length>500||rows.some(r=>!r.display_name||!r.email||!r.primary_department))throw new Error('รูปแบบแผนบัญชีไม่ถูกต้อง');ACCOUNT_BOOTSTRAP_PLAN=plan;apply.disabled=false;status.textContent=`ตรวจพบ ${rows.length} บัญชี · เดิม ${(plan.existing||[]).length} · ใหม่ ${(plan.new||[]).length}`;}catch(error){ACCOUNT_BOOTSTRAP_PLAN=null;apply.disabled=true;status.textContent=error.message;}};
 document.getElementById('account-bootstrap-apply').onclick=applyAccountBootstrapPlan;
 if(ACCOUNT_CANDIDATES.length)renderAccountCandidates();
 }catch(e){main.textContent=e.message;}
};
async function applyAccountBootstrapPlan(){
 const status=document.getElementById('account-bootstrap-status'),button=document.getElementById('account-bootstrap-apply');let options;try{options=accountInitialPasswordOptions();if(!options.initial_password)throw new Error('กรอกรหัสแรกเข้าก่อนเปิดใช้บัญชี');}catch(error){status.textContent=error.message;return;}
 const source=[...(ACCOUNT_BOOTSTRAP_PLAN?.existing||[]),...(ACCOUNT_BOOTSTRAP_PLAN?.new||[])],rows=source.map(r=>({profile_id:r.profile_id||'',display_name:r.display_name,personal_name:r.personal_name||r.source_name||r.display_name.replace(/ \([^()]+\)$/,''),contact_email:r.email,primary_department:r.primary_department,department_codes:r.department_codes||[r.primary_department],position_title:(r.position_titles||['พนักงาน']).join(' / '),role:r.role||'staff',source_aliases:(r.source_rows||[]).map(x=>({department_code:x.department_code,name:String(x.name||'').replace(/\s*\(.*/,'').trim()})).filter(x=>x.name&&x.department_code)}));
 if(!rows.length||!confirm(`เปิดใช้ ${rows.length} บัญชีและออกรหัสแรกเข้าใหม่ทั้งหมด? รหัสเดิมจะใช้ไม่ได้ และ IP Lock จะยังปิดอยู่`))return;
 button.disabled=true;let done=0,failed=[];try{for(let i=0;i<rows.length;i+=20){const result=await accountCall('bootstrap-roster',{initial_password:options.initial_password,rows:rows.slice(i,i+20)});for(const row of result.results||[]){if(row.ok)done++;else failed.push(row);}status.textContent=`ดำเนินการ ${Math.min(i+20,rows.length)} / ${rows.length} · สำเร็จ ${done} · ต้องตรวจ ${failed.length}`;}status.textContent=failed.length?`สำเร็จ ${done} บัญชี · ต้องตรวจ ${failed.length}: ${failed.slice(0,5).map(r=>r.login_name).join(', ')}`:`เปิดใช้และออกรหัสใหม่สำเร็จ ${done} บัญชี · IP Lock ปิด`;}catch(error){status.textContent=`หยุดหลังสำเร็จ ${done} บัญชี: ${error.message}`;}finally{document.getElementById('account-custom-initial-password').value='';button.disabled=false;}}
function openAccountDuties(index){
 const row=ACCOUNT_CANDIDATES[index];if(!row||row.created||row.review_status==='review_identity'||ACCOUNT_BATCH_RUNNING)return;
 const chosen=new Set(row.department_codes||[row.department_code]);chosen.add(row.department_code);
 showModal(`<div class="modal-h"><div><h3>แผนกและหน้าที่ของ ${esc(row.source_name)}</h3><p>หนึ่งคนใช้บัญชีเดียว เลือกได้หลายแผนก</p></div><button class="x" onclick="closeModal()">×</button></div><form id="account-duties" class="pad"><p><b>แผนกหลัก:</b> ${esc(deptName(row.department_code))} · อ้างอิงรายชื่อต้นทาง</p><label>หน้าที่ / ตำแหน่ง (ระบุหลายหน้าที่ได้)<input class="fin" name="position" maxlength="120" required placeholder="เช่น พนักงานการเงิน / ผู้ประสานงาน KPI" value="${esc(row.position_title||'')}"></label><fieldset style="margin:18px 0;border:1px solid var(--line);padding:16px;border-radius:12px"><legend>แผนกที่ปฏิบัติงาน · เลือกได้หลายข้อ</legend><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">${DEPTS.map(d=>`<label><input type="checkbox" name="department" value="${esc(d.code)}" ${chosen.has(d.code)?'checked':''} ${d.code===row.department_code?'disabled':''}> ${esc(d.name)}${d.code===row.department_code?' (หลัก)':''}</label>`).join('')}</div></fieldset><p>บัญชีใหม่เป็นพนักงานในแผนกที่เลือก หากต้องเป็นหัวหน้า ให้กำหนดสิทธิ์จัดการรายแผนกใน “แผนก / หน้าที่” หลังสร้าง</p><p>หากบุคคลนี้มีบัญชีแล้ว ให้แก้แผนกของบัญชีเดิม ไม่ต้องสร้างบัญชีเพิ่ม</p><p role="alert"></p><button class="tbtn" type="button" id="account-save-duties">เก็บไว้สร้างพร้อมรายชื่อที่ตรวจแล้ว</button> <button class="tbtn primary" type="submit">สร้าง 1 บัญชีตามหน้าที่ที่เลือก</button></form>`);
 const form=document.getElementById('account-duties');
 const collect=()=>{if(!form.reportValidity())return false;row.department_codes=[...new Set([row.department_code,...Array.from(form.querySelectorAll('input[name=department]:checked'),e=>e.value)])];row.position_title=form.elements.position.value.trim();if(!row.position_title)return false;row.duties_reviewed=true;return true;};
 document.getElementById('account-save-duties').onclick=()=>{if(collect()){closeModal();renderAccountCandidates();}};
 form.onsubmit=async e=>{e.preventDefault();if(!collect())return;const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{const result=await accountCall('provision',{name:row.source_name,department_code:row.department_code,department_codes:row.department_codes,position_title:row.position_title,...accountInitialPasswordOptions()});row.created=true;closeModal();renderAccountCandidates();if(result.existing)toast('มีบัญชีแล้ว ให้แก้หน้าที่จากบัญชีเดิม');else accountShowCode(result);}catch(error){form.querySelector('[role=alert]').textContent=error.message;buttons.forEach(b=>b.disabled=false);}};
}
function renderAccountCandidates(){
 const bulk=document.getElementById('account-create-reviewed');if(bulk)bulk.disabled=ACCOUNT_BATCH_RUNNING||!ACCOUNT_CANDIDATES.some(r=>r.review_status!=='review_identity'&&!r.created&&r.duties_reviewed);
 const box=document.getElementById('account-candidates');box.innerHTML=ACCOUNT_CANDIDATES.map((r,i)=>`<div class="account-row"><span>${esc(r.display_name)} ${r.review_status==='review_identity'?'· ต้องตรวจชื่อ: '+esc(r.review_notes):''}</span><button class="tbtn" data-account-create="${i}" ${r.review_status==='review_identity'||r.created||ACCOUNT_BATCH_RUNNING?'disabled':''}>${r.created?'สร้างแล้ว':'เลือกหน้าที่ / สร้างบัญชี'}</button></div>`).join('');
 box.querySelectorAll('[data-account-create]').forEach(button=>button.onclick=()=>openAccountDuties(Number(button.dataset.accountCreate)));
}

const accountCloseModal=closeModal;
closeModal=function(){if(modal.querySelector('[data-initial-code]'))modal.replaceChildren();return accountCloseModal();};

function liveAccountCandidates(activities,members){
 const map=new Map(),add=(name,dept,linked)=>{name=String(name||'').trim();if(!name)return;const key=JSON.stringify([dept,name]),row=map.get(key)||{source_name:name,department_code:dept,display_name:name+' ('+deptName(dept)+')',linked:false};row.linked||=!!linked;map.set(key,row);};
 activities.forEach(r=>add(r.employee_name,r.department_code,r.employee_id));members.forEach(r=>add(r.full_name||r.username,'GRAPHIC',r.linked_profile_id));
 const rows=[...map.values()],normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[\p{S}\p{Z}]/gu,'').replace(/([\u0e31-\u0e4e])\1+/g,'$1').replace(/\u0e3a/g,'');
 const similar=(a,b)=>{a=normalize(a);b=normalize(b);if(a===b||a.replace(/[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e]/g,'')===b.replace(/[\u0e31\u0e34-\u0e3a\u0e47-\u0e4e]/g,''))return true;if(!/[ก-๙]/.test(a+b))return false;if(Math.min(a.length,b.length)>=4&&(a.includes(b)||b.includes(a)))return true;if(Math.min(a.length,b.length)<5||Math.abs(a.length-b.length)>1)return false;let i=0,j=0,edits=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return edits+(a.length-i)+(b.length-j)<=1;};
 return rows.filter(r=>!r.linked).map(r=>{const notes=[];if(['ทุกคน','all','hr','buki grace','บอส แก๋ม','graphic 123'].includes(r.source_name.toLowerCase())||r.source_name.includes('/'))notes.push('ชื่อกลุ่มหรือหลายคน');const variants=rows.filter(x=>x!==r&&x.department_code===r.department_code&&similar(x.source_name,r.source_name));if(variants.length)notes.push('ชื่อใกล้เคียง: '+variants.map(x=>x.source_name).join(', '));return {...r,review_status:notes.length?'review_identity':'ready',review_notes:notes.join(' · ')};}).sort((a,b)=>(a.department_code+a.source_name).localeCompare(b.department_code+b.source_name,'th'));
}
async function loadLiveAccountCandidates(){
 const status=document.getElementById('account-batch-status');status.textContent='กำลังตรวจรายชื่อจากข้อมูลงาน…';
 try{await loadActivities();if(canViewDept('GRAPHIC'))await loadGraphic();if(!ACTIVITY_READY)throw new Error('โหลดกิจกรรมไม่สำเร็จ');ACCOUNT_CANDIDATES=liveAccountCandidates(ACTIVITY_ROWS,GRAPHIC_MEMBERS);renderAccountCandidates();status.textContent=ACCOUNT_CANDIDATES.length+' รายชื่อ · ต้องตรวจชื่อ '+ACCOUNT_CANDIDATES.filter(r=>r.review_status==='review_identity').length+' รายชื่อ';}catch(e){status.textContent=e.message;}
}
function renderInitialAccountCodes(){
 const box=document.getElementById('account-initial-codes');if(!box||!ACCOUNT_INITIAL_CODES.length)return;
 box.innerHTML='<h3>รหัสครั้งแรกที่สร้างรอบนี้</h3><p>แสดงครั้งเดียวในหน้านี้ คัดลอกไว้ส่งให้เจ้าของเป็นการส่วนตัวก่อนปิดหรือรีเฟรช</p><button class="tbtn" id="copy-account-codes">คัดลอกรายชื่อและรหัส</button><table><thead><tr><th>ชื่อเข้าใช้</th><th>รหัสครั้งแรก</th></tr></thead><tbody>'+ACCOUNT_INITIAL_CODES.map(r=>'<tr><td>'+esc(r.login_name)+'</td><td><code>'+esc(r.initial_password)+'</code></td></tr>').join('')+'</tbody></table>';
 document.getElementById('copy-account-codes').onclick=async()=>{try{await navigator.clipboard.writeText(ACCOUNT_INITIAL_CODES.map(r=>r.login_name+'\t'+r.initial_password).join('\n'));toast('คัดลอกแล้ว กรุณาส่งแยกให้แต่ละเจ้าของบัญชี');}catch{toast('คัดลอกไม่สำเร็จ กรุณาเลือกข้อความในตาราง');}};
}
async function createReviewedAccounts(){
 const rows=ACCOUNT_CANDIDATES.filter(r=>r.review_status!=='review_identity'&&!r.created&&r.duties_reviewed);if(ACCOUNT_BATCH_RUNNING||!rows.length)return;
 let passwordOptions;try{passwordOptions=accountInitialPasswordOptions();}catch(error){document.getElementById('account-batch-status').textContent=error.message;return;}
 if(!confirm('สร้าง '+rows.length+' บัญชีจากรายชื่อที่ตรวจผ่าน โดยให้สิทธิ์พนักงานเฉพาะแผนก และต้องอนุมัติเครื่องก่อนใช้งาน?'))return;
 ACCOUNT_BATCH_RUNNING=true;document.getElementById('account-live-roster').disabled=true;document.getElementById('account-roster').disabled=true;renderAccountCandidates();let done=0,failed=0;
 const status=document.getElementById('account-batch-status');
 for(const row of rows){try{const result=await accountCall('provision',{name:row.source_name,department_code:row.department_code,department_codes:row.department_codes||[row.department_code],position_title:row.position_title||'พนักงาน',...passwordOptions});if(result.initial_password){ACCOUNT_INITIAL_CODES.push(result);renderInitialAccountCodes();}row.created=true;done++;}catch(e){row.review_notes=e.message;row.review_status='review_identity';failed++;}status.textContent='ดำเนินการแล้ว '+(done+failed)+' / '+rows.length+' · สำเร็จ '+done+' · ต้องตรวจเพิ่ม '+failed;}
 if(passwordOptions)delete passwordOptions.initial_password;
 const initialInput=document.getElementById('account-custom-initial-password');if(initialInput)initialInput.value='';
 ACCOUNT_BATCH_RUNNING=false;document.getElementById('account-live-roster').disabled=false;document.getElementById('account-roster').disabled=false;renderAccountCandidates();
}
