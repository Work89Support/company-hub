/* Login credentials live in Supabase Auth; work ownership always stays on UUID. */
let ACCOUNT_STATUS=null,ACCOUNT_STARTING=false,ACCOUNT_CANDIDATES=[],ACCOUNT_INITIAL_CODES=[],ACCOUNT_BATCH_RUNNING=false;
NAV.account={ic:'i-user',t:'บัญชีของฉัน'};NAV.teamAccounts={ic:'i-users',t:'บัญชีทีม'};
NAVGROUPS[2].items.push('account','teamAccounts');
for(const table of [ROLE_ALLOW,SIMPLE_ALLOW])for(const role of Object.keys(table)){table[role].push('account');if(role==='exec')table[role].push('teamAccounts');}
async function accountCall(action,body={},token){
 if(token===undefined)token=(await SB.auth.getSession()).data.session?.access_token;
 const response=await fetch(SUPA_URL+'/functions/v1/company-accounts',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPA_KEY,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,...body}),cache:'no-store'});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'ระบบบัญชียังไม่พร้อม');return result;
}
const accountEmailLogin=sbLogin;
sbLogin=async function(){
 const login=val('sbEmail').trim();if(login.includes('@')&&!login.endsWith(')'))return accountEmailLogin();
 const button=document.getElementById('sbLoginBtn'),error=document.getElementById('sbErr');button.disabled=true;error.textContent='';
 try{const result=await accountCall('login',{login,password:val('sbPass')},null);const r=await SB.auth.setSession(result.session);if(r.error)throw r.error;document.getElementById('sbPass').value='';}
 catch(e){error.textContent=e.message;}finally{button.disabled=false;}
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
 if(!info.username_account){main.innerHTML='<h1>บัญชีของฉัน</h1><p>บัญชีนี้ใช้อีเมลเดิม สำหรับชื่อและรหัสผ่านให้ติดต่อผู้ดูแล</p>';return;}
 const name=info.personal_name||info.display_name.replace(/ \([^()]+\)$/,'');
 main.innerHTML=`${crumb('หน้าแรก','บัญชีของฉัน')}<h1>บัญชีของฉัน</h1><p>ชื่อเข้าสู่ระบบ: <b>${esc(info.display_name)}</b></p><div class="two"><form id="account-details" class="card pad"><h3>ชื่อและอีเมล</h3><label>ชื่อ<input class="fin" name="display" maxlength="100" required value="${esc(name)}"></label><p>แผนก: ${esc(deptName(currentDept()))} · เปลี่ยนชื่อแล้วใช้ชื่อใหม่เข้าสู่ระบบ งานเดิมยังอยู่ครบ</p><label>อีเมล (ใส่ภายหลังได้)<input class="fin" type="email" name="email" maxlength="254" value="${esc(info.contact_email)}"></label><p>ยังไม่ใช้ช่องนี้ล็อกอินหรือรีเซ็ตรหัส ต้องยืนยันอีเมลก่อนเชื่อมในอนาคต</p><p role="alert"></p><button class="tbtn primary">บันทึกชื่อและอีเมล</button></form><form id="account-password" class="card pad"><h3>เปลี่ยนรหัสผ่าน</h3>${accountPasswordFields()}</form></div>`;
 const form=document.getElementById('account-details');form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const r=await SB.rpc('update_company_account_details',{p_name:form.elements.display.value,p_email:form.elements.email.value});if(r.error)throw r.error;ACCESS_PROFILE.display_name=r.data.display_name;const profile=TASK_PROFILES.find(p=>p.id===ACCESS_PROFILE.id);if(profile)profile.display_name=r.data.display_name;if(USERS[ACCESS_PROFILE.id])USERS[ACCESS_PROFILE.id].n=r.data.display_name;toast('บันทึกแล้ว งานเดิมยังผูกกับบัญชีนี้');RENDER.account();}catch(e){form.querySelector('[role=alert]').textContent=e.message;}finally{button.disabled=false;}};
 bindAccountPassword(document.getElementById('account-password'));
 }catch(e){main.textContent=e.message;}
};
function accountShowCode(result){
 showModal(`<div class="modal-h"><h3>รหัสเข้าครั้งแรก</h3><button class="x" onclick="closeModal()">×</button></div><div class="pad"><p>บัญชี: <b>${esc(result.login_name)}</b></p><p>ส่งรหัสนี้ให้เจ้าของบัญชีเป็นการส่วนตัว ระบบจะแสดงครั้งนี้ครั้งเดียว รหัสมีอายุ 7 วัน และบังคับตั้งรหัสใหม่ก่อนเปิดงาน</p><code data-initial-code style="overflow-wrap:anywhere">${esc(result.initial_password)}</code><p>ผู้ดูแลต้องอนุมัติเครื่องในหน้าจัดการพนักงานก่อนเข้าใช้งานตามนโยบายเดิม</p></div>`);
}
RENDER.teamAccounts=async function(){
 if(!canAdminAccess()){main.textContent='เฉพาะผู้ดูแลหรือผู้บริหาร';return;}
 main.innerHTML='<p>กำลังโหลดบัญชีทีม…</p>';
 try{const {accounts}=await accountCall('list');if(VIEW!=='teamAccounts')return;
 main.innerHTML=`${crumb('หน้าแรก','บัญชีทีม')}<h1>บัญชีทีม</h1><p>บัญชีใหม่เป็นพนักงานของแผนกเดียว ใช้ชื่อ (แผนก) และเพิ่มอีเมลภายหลังได้</p><section class="card pad"><h3>สร้างจากรายชื่อเดิม</h3><button class="tbtn primary" id="account-live-roster">ดูรายชื่อจากงานในระบบ</button> <button class="tbtn" id="account-create-reviewed" disabled>สร้างบัญชีชื่อที่ตรวจผ่าน</button><p id="account-batch-status" role="status"></p><div id="account-initial-codes"></div><details><summary>นำเข้ารายชื่อที่ตรวจไว้เพิ่มเติม</summary><label>เปิดไฟล์รายชื่อที่เตรียมไว้ (.json)<input type="file" id="account-roster" accept="application/json,.json"></label></details><p>ตรวจชื่อทีละคนก่อนสร้าง ชื่อกลุ่มและชื่อใกล้เคียงจะไม่ถูกสร้างอัตโนมัติ</p><div id="account-candidates"></div></section><div class="card pad"><h3>บัญชีที่สร้างแล้ว (${accounts.length})</h3>${accounts.map(a=>`<div class="account-row"><span>${esc(a.login_name)} · ${a.must_change_password?'รอตั้งรหัส':'พร้อมใช้'}${a.contact_email?' · '+esc(a.contact_email):''}</span><button class="tbtn" data-account-reset="${esc(a.profile_id)}">ออกรหัสใหม่</button></div>`).join('')||'<p>ยังไม่มีบัญชีแบบชื่อ</p>'}</div><p id="account-admin-error" role="alert"></p>`;
 main.querySelectorAll('[data-account-reset]').forEach(button=>button.onclick=async()=>{if(!confirm('ออกรหัสใหม่ให้บัญชีนี้? รหัสและการเข้าสู่ระบบเดิมจะใช้ไม่ได้'))return;button.disabled=true;try{accountShowCode(await accountCall('reset',{profile_id:button.dataset.accountReset}));}catch(e){document.getElementById('account-admin-error').textContent=e.message;}finally{button.disabled=false;}});
 document.getElementById('account-live-roster').onclick=loadLiveAccountCandidates;
 document.getElementById('account-create-reviewed').onclick=createReviewedAccounts;
 renderInitialAccountCodes();
 document.getElementById('account-roster').onchange=async e=>{try{const file=e.target.files[0];if(!file||file.size>1000000)throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 1 MB');const rows=JSON.parse(await file.text());if(!Array.isArray(rows)||rows.length>500)throw new Error('รูปแบบรายชื่อไม่ถูกต้อง');ACCOUNT_CANDIDATES=rows;renderAccountCandidates();}catch(e){document.getElementById('account-admin-error').textContent=e.message;}};
 if(ACCOUNT_CANDIDATES.length)renderAccountCandidates();
 }catch(e){main.textContent=e.message;}
};
function renderAccountCandidates(){
 const bulk=document.getElementById('account-create-reviewed');if(bulk)bulk.disabled=ACCOUNT_BATCH_RUNNING||!ACCOUNT_CANDIDATES.some(r=>r.review_status!=='review_identity'&&!r.created);
 const box=document.getElementById('account-candidates');box.innerHTML=ACCOUNT_CANDIDATES.map((r,i)=>`<div class="account-row"><span>${esc(r.display_name)} ${r.review_status==='review_identity'?'· ต้องตรวจชื่อ: '+esc(r.review_notes):''}</span><button class="tbtn" data-account-create="${i}" ${r.review_status==='review_identity'||r.created||ACCOUNT_BATCH_RUNNING?'disabled':''}>${r.created?'สร้างแล้ว':'สร้างบัญชีนี้'}</button></div>`).join('');
 box.querySelectorAll('[data-account-create]').forEach(button=>button.onclick=async()=>{const row=ACCOUNT_CANDIDATES[Number(button.dataset.accountCreate)];button.disabled=true;try{const result=await accountCall('provision',{name:row.source_name,department_code:row.department_code});if(result.existing){toast('มีบัญชีนี้แล้ว ใช้รายการบัญชีที่สร้างแล้ว');}else{accountShowCode(result);}row.created=true;button.textContent='สร้างแล้ว';}catch(e){document.getElementById('account-admin-error').textContent=e.message;button.disabled=false;}});
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
 const rows=ACCOUNT_CANDIDATES.filter(r=>r.review_status!=='review_identity'&&!r.created);if(ACCOUNT_BATCH_RUNNING||!rows.length)return;
 if(!confirm('สร้าง '+rows.length+' บัญชีจากรายชื่อที่ตรวจผ่าน โดยให้สิทธิ์พนักงานเฉพาะแผนก และต้องอนุมัติเครื่องก่อนใช้งาน?'))return;
 ACCOUNT_BATCH_RUNNING=true;document.getElementById('account-live-roster').disabled=true;document.getElementById('account-roster').disabled=true;renderAccountCandidates();let done=0,failed=0;
 const status=document.getElementById('account-batch-status');
 for(const row of rows){try{const result=await accountCall('provision',{name:row.source_name,department_code:row.department_code});if(result.initial_password){ACCOUNT_INITIAL_CODES.push(result);renderInitialAccountCodes();}row.created=true;done++;}catch(e){row.review_notes=e.message;row.review_status='review_identity';failed++;}status.textContent='ดำเนินการแล้ว '+(done+failed)+' / '+rows.length+' · สำเร็จ '+done+' · ต้องตรวจเพิ่ม '+failed;}
 ACCOUNT_BATCH_RUNNING=false;document.getElementById('account-live-roster').disabled=false;document.getElementById('account-roster').disabled=false;renderAccountCandidates();
}
