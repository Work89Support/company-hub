/* Login credentials live in Supabase Auth; work ownership always stays on UUID. */
let ACCOUNT_STATUS=null,ACCOUNT_STARTING=false,ACCOUNT_CANDIDATES=[],ACCOUNT_INITIAL_CODES=[],ACCOUNT_BATCH_RUNNING=false,ACCOUNT_BOOTSTRAP_PLAN=null,ACCOUNT_LIST=[],ACCOUNT_DIRECTORY_DEPT='',ACCOUNT_DIRECTORY_QUERY='';
function accountHasRealEmail(value){
 const email=String(value||'').trim().toLowerCase();
 return !!email&&!email.endsWith('@company-hub.invalid');
}
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
// The login modal is rendered after this module loads, so use delegated input
// handling to keep the email-first flow active every time the dialog opens.
document.addEventListener('input',event=>{if(event.target?.id==='sbEmail')clearAccountEmailChoice();});
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
     for(const row of ACCOUNT_EMAIL_CHOICE.accounts){const option=document.createElement('option');option.value=row.login_name;const duties=[row.position_title,(row.department_codes||[row.department_code]).join(', ')].filter(Boolean).join(' · ');option.textContent=row.display_name+(duties?' · '+duties:'');select.append(option);}
     select.onchange=()=>{const pass=document.getElementById('sbPass');pass.value='';pass.hidden=!select.value;if(select.value)pass.focus();};
     label.append(select);document.getElementById('sbPass').before(label);document.getElementById('sbPass').hidden=true;
    }else if(ACCOUNT_EMAIL_CHOICE.mode==='single'){
     const row=ACCOUNT_EMAIL_CHOICE.accounts[0],duties=[row.position_title,(row.department_codes||[row.department_code]).join(', ')].filter(Boolean).join(' · ');
     const note=document.createElement('p');note.id='account-login-choice';note.textContent='บัญชี: '+row.display_name+(duties?' · '+duties:'');
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
 const profile=ACCESS_PROFILE||{},display=info.display_name||profile.display_name||'ผู้ใช้งาน',position=profile.position_title||'พนักงาน',role=ACCESS_ROLE_LABEL?.[profile.role]||profile.role||'พนักงาน';
 const departments=[...new Set((profile.department_codes||VISIBLE_DEPTS||[profile.department_code]).filter(Boolean))],primary=profile.department_code||currentDept();
 const departmentChips=(departments.length?departments:[primary]).filter(Boolean).map(code=>`<span style="--dept-color:${esc(deptColor(code))}">${esc(deptName(code))}</span>`).join('')||'<span class="missing">ยังไม่กำหนดแผนก</span>';
 const initials=display.trim().slice(0,1).toUpperCase()||'CH';
 const hero=`${crumb('หน้าแรก','บัญชีของฉัน')}<section class="account-profile-hero"><div class="account-hero-avatar">${esc(initials)}</div><div class="account-hero-copy"><span class="account-eyebrow">MY COMPANY HUB</span><h1>${esc(display)}</h1><p>${esc(position)}</p><div class="account-hero-depts">${departmentChips}</div></div><div class="account-hero-state"><span class="account-status ${profile.active===false?'inactive':'ready'}">${profile.active===false?'ปิดใช้งาน':'พร้อมใช้งาน'}</span></div></section><section class="account-meta-grid"><article><span>แผนกหลัก</span><b>${esc(primary?deptName(primary):'ยังไม่กำหนด')}</b><small>${departments.length>1?`ทำงานร่วม ${departments.length} แผนก`:'แผนกที่สังกัดปัจจุบัน'}</small></article><article><span>ตำแหน่ง</span><b>${esc(position)}</b><small>ตำแหน่งในโครงสร้างองค์กร</small></article><article><span>สิทธิ์ระบบ</span><b>${esc(role)}</b><small>กำหนดเมนูและขอบเขตข้อมูล</small></article><article><span>วิธีเข้าสู่ระบบ</span><b>${info.username_account?'ชื่อผู้ใช้ Company Hub':'อีเมลเดิม'}</b><small>${info.username_account?'เปลี่ยนรหัสผ่านได้ด้วยตนเอง':'ติดต่อผู้ดูแลเมื่อแก้ข้อมูลล็อกอิน'}</small></article></section>`;
 if(!info.username_account){main.innerHTML=hero+`<section class="account-info-grid"><article class="card pad"><div class="account-card-head"><span class="account-card-icon">ID</span><div><h3>ข้อมูลบัญชี</h3><p>ข้อมูลที่ระบบใช้แสดงตัวตนและผูกประวัติงาน</p></div></div><dl class="account-detail-list"><div><dt>ชื่อที่แสดง</dt><dd>${esc(display)}</dd></div><div><dt>อีเมล</dt><dd>${esc(info.contact_email||profile.email||'ไม่พบอีเมล')}</dd></div><div><dt>รหัสบัญชีภายใน</dt><dd>${esc(profile.id||'เชื่อมกับบัญชีเดิม')}</dd></div></dl></article><article class="card pad account-security-card"><div class="account-card-head"><span class="account-card-icon secure">✓</span><div><h3>การเข้าใช้และความปลอดภัย</h3><p>บัญชีอีเมลเดิม</p></div></div><div class="account-security-note"><b>บัญชีนี้ใช้อีเมลเดิม</b><p>สำหรับการแก้ชื่อ อีเมล รหัสผ่าน หรือแผนก ให้ติดต่อผู้ดูแลเพื่อตรวจสอบตัวตน งานและประวัติเดิมจะไม่สูญหาย</p></div><ul class="account-check-list"><li>เข้าใช้ได้จากทุกเครื่องโดยไม่ตรวจ IP</li><li>เห็นข้อมูลตามสิทธิ์และแผนกเท่านั้น</li><li>ประวัติงานผูกกับรหัสบัญชีภายใน</li></ul></article></section>`;return;}
 const name=info.personal_name||info.display_name.replace(/ \([^()]+\)$/,'');
 main.innerHTML=hero+`<section class="account-info-grid"><form id="account-details" class="card pad account-form-card"><div class="account-card-head"><span class="account-card-icon">ID</span><div><h3>ชื่อและอีเมล</h3><p>แก้ข้อมูลติดต่อโดยไม่กระทบประวัติงาน</p></div></div><label>ชื่อ<input class="fin" name="display" maxlength="100" required value="${esc(name)}"></label><p class="account-field-help">ชื่อเข้าใช้ปัจจุบัน: ${esc(info.display_name)} · เปลี่ยนชื่อแล้วงานเดิมยังอยู่ครบ</p><label>อีเมล (ใส่ภายหลังได้)<input class="fin" type="email" name="email" maxlength="254" value="${esc(info.contact_email||'')}"></label><p class="account-field-help">ใช้สำหรับติดต่อและรองรับการเชื่อมบัญชีในอนาคต</p><p role="alert"></p><button class="tbtn primary">บันทึกชื่อและอีเมล</button></form><form id="account-password" class="card pad account-security-card"><div class="account-card-head"><span class="account-card-icon secure">✓</span><div><h3>เปลี่ยนรหัสผ่าน</h3><p>ตั้งรหัสเฉพาะของคุณอย่างน้อย 12 ตัวอักษร</p></div></div>${accountPasswordFields()}</form></section>`;
 const form=document.getElementById('account-details');form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const r=await SB.rpc('update_company_account_details',{p_name:form.elements.display.value,p_email:form.elements.email.value});if(r.error)throw r.error;ACCESS_PROFILE.display_name=r.data.display_name;const profile=TASK_PROFILES.find(p=>p.id===ACCESS_PROFILE.id);if(profile)profile.display_name=r.data.display_name;if(USERS[ACCESS_PROFILE.id])USERS[ACCESS_PROFILE.id].n=r.data.display_name;toast('บันทึกแล้ว งานเดิมยังผูกกับบัญชีนี้');RENDER.account();}catch(e){form.querySelector('[role=alert]').textContent=e.message;}finally{button.disabled=false;}};
 bindAccountPassword(document.getElementById('account-password'));
 }catch(e){main.textContent=e.message;}
};
function accountShowCode(result){
 showModal(`<div class="modal-h"><h3>รหัสเข้าครั้งแรก</h3><button class="x" onclick="closeModal()">×</button></div><div class="pad"><p>บัญชี: <b>${esc(result.login_name)}</b></p><p>ส่งรหัสนี้ให้เจ้าของบัญชีเป็นการส่วนตัว ระบบจะแสดงครั้งนี้ครั้งเดียว รหัสมีอายุ 7 วัน และบังคับตั้งรหัสใหม่ก่อนเปิดงาน</p><code data-initial-code style="overflow-wrap:anywhere">${esc(result.initial_password)}</code><p>บัญชีเข้าใช้ได้จากทุกเครื่องทันที</p></div>`);
}
function accountInitialPasswordOptions(){
 const input=document.getElementById('account-custom-initial-password');
 if(!input||input.value==='')return {};
 if(input.value.length<12||input.value.length>128||!input.reportValidity())throw new Error('รหัสแรกเข้าที่กำหนดเองต้องมี 12–128 ตัวอักษร');
 return {initial_password:input.value};
}
function accountDepartmentCodes(profile){return [...new Set([profile?.department_code,...(profile?.department_codes||[]),...(ACCESS_USER_DEPTS||[]).filter(row=>row.profile_id===profile?.id).map(row=>row.department_code)].filter(Boolean))];}
function renderAccountDirectory(){
 const host=document.getElementById('account-directory');if(!host)return;
 const byId=new Map((ACCESS_USERS||[]).map(profile=>[profile.id,profile])),emailCounts=new Map();
 for(const account of ACCOUNT_LIST)if(accountHasRealEmail(account.contact_email)){const key=account.contact_email.toLowerCase();emailCounts.set(key,(emailCounts.get(key)||0)+1);}
 const rows=ACCOUNT_LIST.map(account=>{const profile=byId.get(account.profile_id)||{},departments=accountDepartmentCodes(profile);return {...account,profile,departments};}).filter(row=>(!ACCOUNT_DIRECTORY_DEPT||row.departments.includes(ACCOUNT_DIRECTORY_DEPT))&&(!ACCOUNT_DIRECTORY_QUERY||[row.login_name,row.contact_email,row.profile.display_name,row.profile.position_title].some(value=>String(value||'').toLowerCase().includes(ACCOUNT_DIRECTORY_QUERY))));
 const available=DEPTS||[];
 host.innerHTML=`<div class="account-filters"><label>ค้นหาชื่อหรืออีเมล<input class="fin" id="account-table-search" value="${esc(ACCOUNT_DIRECTORY_QUERY)}" placeholder="พิมพ์ชื่อ อีเมล หรือตำแหน่ง"></label><label>แผนก<select class="fin" id="account-table-dept"><option value="">ทุกแผนก</option>${available.map(dept=>`<option value="${esc(dept.code)}" ${ACCOUNT_DIRECTORY_DEPT===dept.code?'selected':''}>${esc(dept.name)}</option>`).join('')}</select></label><label>บัญชีที่แสดง<div class="fin" style="display:flex;align-items:center">${rows.length} บัญชี</div></label></div>${available.filter(dept=>!ACCOUNT_DIRECTORY_DEPT||dept.code===ACCOUNT_DIRECTORY_DEPT).map(dept=>{const deptRows=rows.filter(row=>row.departments.includes(dept.code));if(!deptRows.length)return ACCOUNT_DIRECTORY_DEPT===dept.code?`<section class="account-dept-section" style="--dept-color:${esc(deptColor(dept.code))}"><header class="account-dept-title"><span></span><h3>${esc(dept.name)}</h3><b>0 คน</b></header><div class="account-empty"><b>แผนกนี้ยังไม่มีบัญชี</b><br><span>เพิ่มพนักงานหรือย้ายแผนกจากปุ่ม “สร้างบัญชีและนำเข้ารายชื่อ” ด้านบน</span></div></section>`:'';return `<section class="account-dept-section" style="--dept-color:${esc(deptColor(dept.code))}"><header class="account-dept-title"><span></span><h3>${esc(dept.name)}</h3><b>${deptRows.length} คน</b></header><div class="account-sheet"><table><thead><tr><th>ชื่อ / บัญชี</th><th>อีเมล</th><th>ตำแหน่ง</th><th>แผนกที่ดูแล</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${deptRows.map(row=>{const hasEmail=accountHasRealEmail(row.contact_email),shared=hasEmail&&emailCounts.get(row.contact_email.toLowerCase())>1;return `<tr class="${row.profile.active===false?'account-row-inactive':''}"><td><b>${esc(row.profile.display_name||row.login_name)}</b><small>${esc(row.login_name||'-')}</small></td><td><b class="${shared?'account-shared':''}">${esc(hasEmail?row.contact_email:'ยังไม่มีอีเมลจริง')}</b><small>${shared?'ใช้อีเมลร่วม':hasEmail?'อีเมลบัญชี':'รอกรอกอีเมลจริง'}</small></td><td><b>${esc(row.profile.position_title||'พนักงาน')}</b><small>${esc(ACCESS_ROLE_LABEL?.[row.profile.role]||row.profile.role||'พนักงาน')}</small></td><td><div class="account-dept-chips">${row.departments.map(code=>`<span style="--dept-color:${esc(deptColor(code))}">${esc(deptName(code))}</span>`).join('')}</div></td><td><button type="button" class="account-status ${row.profile.active===false?'inactive':row.must_change_password?'pending':'ready'}" data-account-status="${esc(row.profile_id)}" title="กดเพื่อเปลี่ยนสถานะบัญชี">${row.profile.active===false?'ปิดใช้':row.must_change_password?'รอตั้งรหัส':'พร้อมใช้'}</button></td><td><div class="account-actions"><button class="tbtn sm" data-account-duties="${esc(row.profile_id)}">ข้อมูล / สถานะ</button><button class="tbtn sm" data-account-reset="${esc(row.profile_id)}">ออกรหัสใหม่</button></div></td></tr>`;}).join('')}</tbody></table></div></section>`;}).join('')||'<div class="account-empty">ไม่พบบัญชีตามตัวกรอง</div>'}`;
 document.getElementById('account-table-dept').onchange=event=>{ACCOUNT_DIRECTORY_DEPT=event.target.value;renderAccountDirectory();};
 document.getElementById('account-table-search').oninput=event=>{ACCOUNT_DIRECTORY_QUERY=event.target.value.trim().toLowerCase();renderAccountDirectory();};
 const openAccountSettings=async(button,profileId)=>{button.disabled=true;try{await loadAccessUsers(true);openAccessUser(profileId);}catch(error){toast(error.message,'info');}finally{button.disabled=false;}};
 host.querySelectorAll('[data-account-duties]').forEach(button=>button.onclick=()=>openAccountSettings(button,button.dataset.accountDuties));
 host.querySelectorAll('[data-account-status]').forEach(button=>button.onclick=()=>openAccountSettings(button,button.dataset.accountStatus));
 host.querySelectorAll('[data-account-reset]').forEach(button=>button.onclick=async()=>{if(!confirm('ออกรหัสใหม่ให้บัญชีนี้? รหัสและการเข้าสู่ระบบเดิมจะใช้ไม่ได้'))return;button.disabled=true;try{accountShowCode(await accountCall('reset',{profile_id:button.dataset.accountReset}));}catch(error){document.getElementById('account-admin-error').textContent=error.message;}finally{button.disabled=false;}});
}
RENDER.teamAccounts=async function(){
 if(!canAdminAccess()){main.textContent='เฉพาะผู้ดูแลหรือผู้บริหาร';return;}
 main.innerHTML='<p>กำลังโหลดบัญชีทีม…</p>';
 try{const {accounts}=await accountCall('list');if(VIEW!=='teamAccounts')return;ACCOUNT_LIST=accounts||[];
 main.innerHTML=`${crumb('หน้าแรก','บัญชีทีม')}<h1>บัญชีทีม</h1><p>จัดการรายชื่อแบบตาราง แยกแผนก ตำแหน่ง อีเมล และสถานะบัญชีให้ตรวจสอบได้ในหน้าเดียว</p><details class="card pad account-create-panel"><summary><b>สร้างบัญชีและนำเข้ารายชื่อ</b><span>สำหรับผู้ดูแลระบบ</span></summary><div class="account-create-body"><label>รหัสแรกเข้าสำหรับบัญชีใหม่ในรอบนี้ (ไม่บังคับ)<input class="fin" id="account-custom-initial-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" placeholder="เว้นว่างเพื่อสุ่มแยกรายคน"></label><p>กำหนดเองได้ 12–128 ตัวอักษร ทุกบัญชีต้องเปลี่ยนรหัสเมื่อเข้าครั้งแรก</p><button class="tbtn primary" id="account-live-roster">ดูรายชื่อจากงานในระบบ</button> <button class="tbtn" id="account-create-reviewed" disabled>สร้างบัญชีชื่อที่ตรวจผ่าน</button><p id="account-batch-status" role="status"></p><div id="account-initial-codes"></div><details><summary>นำเข้ารายชื่อที่ตรวจไว้เพิ่มเติม</summary><label>เปิดไฟล์รายชื่อที่เตรียมไว้ (.json)<input type="file" id="account-roster" accept="application/json,.json"></label></details><details><summary>เปิดใช้บัญชีจากแผนอีเมลที่ตรวจแล้ว</summary><label>ไฟล์แผนบัญชี (.json)<input type="file" id="account-bootstrap-plan" accept="application/json,.json"></label><button class="tbtn" id="account-bootstrap-apply" disabled>ตรวจและเปิดใช้บัญชีทั้งหมด</button><p id="account-bootstrap-status" role="status"></p></details><div id="account-candidates"></div></div></details><section class="account-summary"><div><b>${ACCOUNT_LIST.length}</b><span>บัญชีทั้งหมด</span></div><div><b>${ACCOUNT_LIST.filter(row=>!row.must_change_password).length}</b><span>พร้อมใช้</span></div><div><b>${ACCOUNT_LIST.filter(row=>row.must_change_password).length}</b><span>รอตั้งรหัส</span></div><div><b>${new Set(ACCOUNT_LIST.map(row=>row.contact_email?.toLowerCase()).filter(Boolean)).size}</b><span>อีเมลที่ลงไว้</span></div></section><div id="account-directory"></div><p id="account-admin-error" role="alert"></p>`;
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
 const status=document.getElementById('account-bootstrap-status'),button=document.getElementById('account-bootstrap-apply');
 let passwordOptions;try{passwordOptions=accountInitialPasswordOptions();if(!passwordOptions.initial_password)throw new Error('กรอกรหัสแรกเข้าก่อนเปิดใช้บัญชี');}catch(error){status.textContent=error.message;return;}
 const source=[...(ACCOUNT_BOOTSTRAP_PLAN?.existing||[]),...(ACCOUNT_BOOTSTRAP_PLAN?.new||[])],rows=source.map(r=>({profile_id:r.profile_id||'',display_name:r.display_name,personal_name:r.personal_name||r.source_name||r.display_name.replace(/ \([^()]+\)$/,''),contact_email:r.email,primary_department:r.primary_department,department_codes:r.department_codes||[r.primary_department],position_title:(r.position_titles||['พนักงาน']).join(' / '),role:r.role||'staff',source_aliases:(r.source_rows||[]).map(x=>({department_code:x.department_code,name:String(x.name||'').replace(/\s*\(.*/,'').trim()})).filter(x=>x.name&&x.department_code)}));
 if(!rows.length||!confirm(`เปิดใช้ ${rows.length} บัญชีและออกรหัสครั้งแรกใหม่ทั้งหมด? รหัสเดิมจะใช้ไม่ได้ และบัญชีจะเข้าใช้ได้จากทุกเครื่อง`))return;
 button.disabled=true;let done=0,failed=[];
 try{for(let offset=0;offset<rows.length;offset+=20){const result=await accountCall('bootstrap-roster',{initial_password:passwordOptions.initial_password,rows:rows.slice(offset,offset+20)});for(const row of result.results||[]){if(row.ok)done++;else failed.push(row);}status.textContent=`ดำเนินการ ${Math.min(offset+20,rows.length)} / ${rows.length} · สำเร็จ ${done} · ต้องตรวจ ${failed.length}`;}if(!failed.length)status.textContent=`เปิดใช้และออกรหัสใหม่สำเร็จ ${done} บัญชี · เข้าใช้ได้จากทุกเครื่อง`;else status.textContent=`สำเร็จ ${done} บัญชี · ต้องตรวจเพิ่ม ${failed.length}: ${failed.slice(0,5).map(r=>r.login_name).join(', ')}`;}catch(error){status.textContent=`หยุดหลังสำเร็จ ${done} บัญชี: ${error.message}`;}finally{document.getElementById('account-custom-initial-password').value='';button.disabled=false;}}
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
 if(!confirm('สร้าง '+rows.length+' บัญชีจากรายชื่อที่ตรวจผ่าน โดยให้สิทธิ์พนักงานเฉพาะแผนก และเข้าใช้ได้จากทุกเครื่อง?'))return;
 ACCOUNT_BATCH_RUNNING=true;document.getElementById('account-live-roster').disabled=true;document.getElementById('account-roster').disabled=true;renderAccountCandidates();let done=0,failed=0;
 const status=document.getElementById('account-batch-status');
 for(const row of rows){try{const result=await accountCall('provision',{name:row.source_name,department_code:row.department_code,department_codes:row.department_codes||[row.department_code],position_title:row.position_title||'พนักงาน',...passwordOptions});if(result.initial_password){ACCOUNT_INITIAL_CODES.push(result);renderInitialAccountCodes();}row.created=true;done++;}catch(e){row.review_notes=e.message;row.review_status='review_identity';failed++;}status.textContent='ดำเนินการแล้ว '+(done+failed)+' / '+rows.length+' · สำเร็จ '+done+' · ต้องตรวจเพิ่ม '+failed;}
 if(passwordOptions)delete passwordOptions.initial_password;
 const initialInput=document.getElementById('account-custom-initial-password');if(initialInput)initialInput.value='';
 ACCOUNT_BATCH_RUNNING=false;document.getElementById('account-live-roster').disabled=false;document.getElementById('account-roster').disabled=false;renderAccountCandidates();
}
