/* Keep department access and account administration in one predictable place. */
(function(){
  function isKpiDepartmentMember(){
    const profileId=ACCESS_PROFILE?.id;
    return currentDept()==='KPI'||(ACCESS_USER_DEPTS||[]).some(row=>row.profile_id===profileId&&row.department_code==='KPI');
  }

  function syncKpiNavigation(){
    const allowed=isKpiDepartmentMember();
    for(const table of [ROLE_ALLOW,SIMPLE_ALLOW]){
      const items=table.staff||[],index=items.indexOf('kpi');
      if(allowed&&index<0)items.push('kpi');
      if(!allowed&&index>=0)items.splice(index,1);
    }
  }

  const baseBuildNav=buildNav;
  buildNav=function(){syncKpiNavigation();return baseBuildNav();};

  const graphicAccountPanel=gpMemberAccounts;
  gpMemberAccounts=function(){return'';};

  let ACCOUNT_REGISTRY=[],ACCOUNT_DIRECTORY_STATUS='';
  const baseRenderAccountDirectory=renderAccountDirectory;

  function isRealAccountEmail(value){
    const email=String(value||'').trim().toLowerCase();
    return !!email&&!email.endsWith('@company-hub.invalid');
  }

  function accountRegistryStatus(row){
    const profile=(ACCESS_USERS||[]).find(item=>item.id===row.profile_id)||{};
    if(profile.active===false)return'inactive';
    if(row.must_change_password===true)return'pending';
    return'active';
  }

  function mergeFullAccountRegistry(){
    const byProfile=new Map((ACCOUNT_LIST||[]).map(row=>[row.profile_id,{...row}]));
    for(const profile of ACCESS_USERS||[]){
      const existing=byProfile.get(profile.id);
      if(existing){
        if(!isRealAccountEmail(existing.contact_email)&&isRealAccountEmail(profile.email))existing.contact_email=profile.email;
        else if(!isRealAccountEmail(existing.contact_email))existing.contact_email='';
        continue;
      }
      byProfile.set(profile.id,{profile_id:profile.id,login_name:profile.display_name||(isRealAccountEmail(profile.email)?profile.email:profile.id),contact_email:isRealAccountEmail(profile.email)?profile.email:'',must_change_password:null,source_key:'profile'});
    }
    ACCOUNT_REGISTRY=[...byProfile.values()];ACCOUNT_LIST=ACCOUNT_REGISTRY;
  }

  function accountRegistryMatches(row){
    const state=accountRegistryStatus(row);
    if(!ACCOUNT_DIRECTORY_STATUS)return true;
    if(ACCOUNT_DIRECTORY_STATUS==='enabled')return state!=='inactive';
    if(ACCOUNT_DIRECTORY_STATUS==='missing_email')return !isRealAccountEmail(row.contact_email);
    return state===ACCOUNT_DIRECTORY_STATUS;
  }

  renderAccountDirectory=function(){
    const full=ACCOUNT_REGISTRY.length?ACCOUNT_REGISTRY:ACCOUNT_LIST;
    ACCOUNT_LIST=full.filter(accountRegistryMatches);
    try{baseRenderAccountDirectory();}
    finally{ACCOUNT_LIST=full;}
    document.querySelectorAll('[data-account-reset]').forEach(button=>{const row=full.find(item=>item.profile_id===button.dataset.accountReset);if(row?.source_key==='profile'){button.disabled=true;button.textContent='บัญชีอีเมลเดิม';button.title='บัญชีนี้ไม่ได้ใช้รหัสผ่าน Company Hub';}});
    const filters=document.querySelector('.account-filters');
    if(filters&&!document.getElementById('account-table-status')){
      const label=document.createElement('label');label.textContent='สถานะบัญชี';
      label.innerHTML+=`<select class="fin" id="account-table-status"><option value="">ทุกสถานะ</option><option value="enabled">เปิดใช้งานในระบบ</option><option value="active">พร้อมเข้าสู่ระบบ</option><option value="pending">รอตั้งรหัส</option><option value="inactive">ปิดใช้งาน</option><option value="missing_email">ยังไม่มีอีเมลจริง</option></select>`;
      filters.append(label);const select=document.getElementById('account-table-status');select.value=ACCOUNT_DIRECTORY_STATUS;select.onchange=event=>{ACCOUNT_DIRECTORY_STATUS=event.target.value;renderAccountRegistrySummary();renderAccountDirectory();};
    }
  };

  function renderAccountRegistrySummary(){
    const host=document.querySelector('.account-summary');if(!host)return;
    const counts={all:ACCOUNT_REGISTRY.length,enabled:0,active:0,pending:0,inactive:0,missing_email:0};
    for(const row of ACCOUNT_REGISTRY){const state=accountRegistryStatus(row);if(state==='inactive')counts.inactive++;else counts.enabled++;if(state==='active')counts.active++;if(state!=='inactive'&&row.must_change_password===true)counts.pending++;if(!isRealAccountEmail(row.contact_email))counts.missing_email++;}
    const cards=[['','all','บัญชีทั้งหมด'],['enabled','enabled','เปิดใช้งาน'],['active','active','พร้อมเข้าสู่ระบบ'],['pending','pending','รอตั้งรหัส'],['inactive','inactive','ปิดใช้งาน'],['missing_email','missing_email','ยังไม่มีอีเมลจริง']];
    host.innerHTML=cards.map(([filter,key,label])=>`<button type="button" class="account-summary-card ${ACCOUNT_DIRECTORY_STATUS===filter?'active':''}" onclick="setAccountDirectoryStatus('${filter}')"><b>${counts[key]}</b><span>${label}</span></button>`).join('');
    let readiness=document.getElementById('account-department-readiness');
    if(!readiness){readiness=document.createElement('section');readiness.id='account-department-readiness';readiness.className='account-department-readiness';host.after(readiness);}
    const profileIds=new Set(ACCOUNT_REGISTRY.map(row=>row.profile_id));
    const byDept=new Map(DEPTS.map(dept=>[dept.code,0]));
    for(const row of ACCESS_USER_DEPTS||[])if(profileIds.has(row.profile_id)&&byDept.has(row.department_code))byDept.set(row.department_code,byDept.get(row.department_code)+1);
    readiness.innerHTML=`<div class="account-readiness-head"><div><b>ความพร้อมบัญชีครบ 14 แผนก</b><span>คลิกเพื่อกรองรายชื่อ · แผนกที่ยังไม่มีบัญชีจะแสดงเป็น 0</span></div><button type="button" class="tbtn sm" onclick="exportPendingAccountActivation()">ส่งออกรายชื่อรอตั้งรหัส</button></div><div class="account-readiness-grid">${DEPTS.map(dept=>`<button type="button" class="${byDept.get(dept.code)?'':'missing'}" onclick="setAccountDepartmentFilter('${dept.code}')"><span>${esc(dept.name)}</span><b>${byDept.get(dept.code)||0}</b></button>`).join('')}</div>`;
  }

  window.setAccountDirectoryStatus=function(status){ACCOUNT_DIRECTORY_STATUS=status;renderAccountRegistrySummary();renderAccountDirectory();};
  window.exportPendingAccountActivation=function(){const byId=new Map((ACCESS_USERS||[]).map(profile=>[profile.id,profile])),rows=ACCOUNT_REGISTRY.filter(row=>accountRegistryStatus(row)==='pending').map(row=>{const profile=byId.get(row.profile_id)||{},departments=[...new Set((ACCESS_USER_DEPTS||[]).filter(item=>item.profile_id===row.profile_id).map(item=>deptName(item.department_code)))];return [profile.display_name||row.login_name,row.contact_email||'',departments.join(' | '),profile.position_title||'',profile.active===false?'ปิดใช้งาน':'รอตั้งรหัส'];});downloadRows([['ชื่อ','อีเมล','แผนก','ตำแหน่ง','สถานะ'],...rows],`company-hub-pending-activation-${new Date().toISOString().slice(0,10)}.csv`);};
  window.setAccountDepartmentFilter=function(code){const select=document.getElementById('account-table-dept');if(select){select.value=code;select.dispatchEvent(new Event('change',{bubbles:true}));}else toast('เลือกแผนก '+deptName(code)+' จากตัวกรองด้านล่าง','info');};

  if(!document.querySelector('style[data-account-registry]')){
    const style=document.createElement('style');style.dataset.accountRegistry='1';style.textContent='.account-summary{grid-template-columns:repeat(6,minmax(112px,1fr))}.account-summary>button.account-summary-card{display:flex;align-items:baseline;gap:8px;padding:13px 15px;background:var(--surface);border:1px solid var(--line);border-radius:12px;text-align:left;cursor:pointer}.account-summary>button.account-summary-card:hover,.account-summary>button.account-summary-card.active{border-color:var(--blue-500);background:var(--blue-50);box-shadow:0 0 0 2px color-mix(in srgb,var(--blue-500) 12%,transparent)}.account-summary-card b{font-size:23px;color:var(--blue-800)}.account-summary-card span{font-size:11px;color:var(--muted)}.account-filters{grid-template-columns:minmax(240px,1.5fr) repeat(4,minmax(150px,.7fr))}.account-department-readiness{margin:14px 0 18px;padding:15px;background:var(--surface);border:1px solid var(--line);border-radius:14px}.account-readiness-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.account-readiness-head span{font-size:11px;color:var(--muted)}.account-readiness-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:7px}.account-readiness-grid button{display:flex;justify-content:space-between;gap:8px;border:1px solid var(--line);background:var(--blue-50);padding:8px 10px;border-radius:9px;color:var(--ink)}.account-readiness-grid button.missing{border-color:#fecaca;background:#fff5f5;color:#b42318}.account-readiness-grid button b{color:inherit}@media(max-width:900px){.account-summary{grid-template-columns:repeat(2,1fr)}.account-filters{grid-template-columns:1fr}.account-readiness-head{align-items:flex-start;flex-direction:column}}';document.head.append(style);
  }
  if(!document.querySelector('style[data-telegram-settings]')){
    const style=document.createElement('style');style.dataset.telegramSettings='1';style.textContent='.telegram-settings{margin:18px 0}.telegram-settings-head{display:flex;gap:13px;align-items:flex-start;padding-bottom:15px;border-bottom:1px solid var(--line)}.telegram-settings-icon{width:44px;height:44px;display:grid;place-items:center;flex:none;border-radius:13px;background:#e9f5ff;color:#168bd2;font-size:22px}.telegram-settings-head h2{margin:2px 0 4px;font-size:18px}.telegram-settings-head p{margin:0;max-width:780px;color:var(--muted);font-size:12px;line-height:1.7}.telegram-settings-status{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 0 2px;color:var(--muted);font-size:11px}.telegram-settings-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.telegram-setting-field label{display:block;margin-top:10px;font-size:11px;color:var(--muted)}.telegram-setting-field .fin{margin-top:5px}.telegram-field-help{margin:5px 0 0;color:var(--muted);font-size:10.5px}.telegram-settings-actions{grid-column:1/-1;display:flex;align-items:center;gap:9px;flex-wrap:wrap}.telegram-settings-actions [role=status]{color:var(--muted);font-size:11px}.dark .telegram-settings-icon{background:#15364c;color:#65c4ff}@media(max-width:900px){.telegram-settings-form{grid-template-columns:1fr}.telegram-settings-actions{grid-column:1}}';document.head.append(style);
  }

  function teamGraphicAccountPanel(){
    return graphicAccountPanel()
      .replaceAll('saveGraphicMemberLink(', 'saveGraphicMemberLinkFromAccounts(')
      .replaceAll('inviteGraphicMember(', 'inviteGraphicMemberFromAccounts(');
  }

  window.saveGraphicMemberLinkFromAccounts=async function(id){
    const email=normSp(val('gmEmail_'+id)),profile=val('gmProfile_'+id)||null;
    try{
      const result=await SB.rpc('set_graphic_trello_member_link',{p_trello_member_id:id,p_email:email||null,p_profile_id:profile});
      if(result.error)throw result.error;
      toast('บันทึกการเชื่อมสมาชิกแล้ว');
      GRAPHIC_READY=false;await loadGraphic();await RENDER.teamAccounts();
    }catch(error){toast('บันทึกไม่สำเร็จ · '+(error.message||''),'info');}
  };

  window.inviteGraphicMemberFromAccounts=async function(id){
    const member=gpMember(id),email=normSp(val('gmEmail_'+id));
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('กรุณากรอกอีเมลจริงของสมาชิกก่อน','info');return;}
    if(!confirm(`ส่งคำเชิญสร้างบัญชี Company Hub ไปที่ ${email} ใช่หรือไม่?`))return;
    try{
      const result=await SB.functions.invoke('invite-company-user',{body:{email,display_name:member.full_name||member.username,position_title:'Graphic Designer',role:'staff',department_code:'GRAPHIC',visible_departments:['GRAPHIC'],managed_departments:[],trello_member_id:id}});
      if(result.error)throw result.error;if(result.data?.error)throw new Error(result.data.error);
      toast('ส่งคำเชิญและสร้างบัญชีแล้ว');
      GRAPHIC_READY=false;await loadGraphic();await RENDER.teamAccounts();
    }catch(error){toast('สร้างบัญชีไม่สำเร็จ · '+(error.message||'ตรวจ Edge Function'),'info');}
  };

  function telegramSettingsShell(){
    return `<section class="telegram-settings card pad" id="telegram-team-settings"><div class="telegram-settings-head"><div class="telegram-settings-icon" aria-hidden="true">✈</div><div><span class="account-eyebrow">TEAM NOTIFICATIONS</span><h2>การแจ้งเตือน Telegram</h2><p>สำหรับส่งแจ้งเตือนเฉพาะกลุ่ม Company Hub เมื่อ CEO มอบหมายงาน งานเสร็จ และสรุปภาพรวมตามเวลา</p></div></div><div id="telegram-settings-body"><p class="muted">กำลังตรวจสอบการเชื่อมต่อ…</p></div></section>`;
  }

  function renderTelegramSettings(settings){
    const host=document.getElementById('telegram-settings-body');if(!host)return;
    const ready=!!settings?.enabled,tokenReady=!!settings?.token_configured,chatId=settings?.group_chat_id||'';
    host.innerHTML=`<div class="telegram-settings-status"><span class="account-status ${ready?'ready':'pending'}">${ready?'พร้อมส่งแจ้งเตือน':'ยังตั้งค่าไม่ครบ'}</span><span>สรุปรายวัน 06:00 และ 18:00 น. · เวลาไทย</span></div><form id="telegram-settings-form" class="telegram-settings-form"><div class="telegram-setting-field"><label>Telegram Bot Token<input class="fin" name="token" type="password" autocomplete="new-password" maxlength="120" placeholder="${tokenReady?'ตั้งค่าแล้ว · เว้นว่างเพื่อใช้ Token เดิม':'วาง Token ที่ได้จาก BotFather'}"></label><p class="telegram-field-help">Token จะส่งตรงเข้า Supabase Vault และจะไม่แสดงกลับมาบนหน้าระบบ</p></div><div class="telegram-setting-field"><label>Group Chat ID<input class="fin" name="chat_id" inputmode="numeric" maxlength="24" required value="${esc(chatId)}" placeholder="เช่น -5327928253"></label><p class="telegram-field-help">ใช้สำหรับกลุ่มรับแจ้งเตือนเท่านั้น ไม่ส่งเข้าห้องส่วนตัว</p></div><div class="telegram-settings-actions"><button class="tbtn primary" type="submit">บันทึกการเชื่อมต่อ</button><button class="tbtn" type="button" id="telegram-test-send" ${ready?'':'disabled'}>ส่งข้อความทดสอบ</button><span role="status" aria-live="polite"></span></div></form>`;
    const form=document.getElementById('telegram-settings-form'),status=form.querySelector('[role=status]');
    form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;status.textContent='กำลังบันทึก…';try{const result=await SB.rpc('save_telegram_notification_settings',{p_bot_token:form.elements.token.value,p_group_chat_id:form.elements.chat_id.value});if(result.error)throw result.error;form.elements.token.value='';status.textContent='บันทึกแล้ว';toast('ตั้งค่า Telegram แล้ว');await loadTelegramSettings();}catch(error){status.textContent=error.message||'บันทึกไม่สำเร็จ';}finally{button.disabled=false;}};
    document.getElementById('telegram-test-send').onclick=async event=>{const button=event.currentTarget;button.disabled=true;status.textContent='กำลังส่งข้อความทดสอบ…';try{const result=await SB.rpc('test_telegram_notification_settings');if(result.error)throw result.error;status.textContent='ส่งเข้าคิวแล้ว กรุณาตรวจกลุ่ม Company hub';toast('ส่งข้อความทดสอบแล้ว');}catch(error){status.textContent=error.message||'ส่งทดสอบไม่สำเร็จ';}finally{button.disabled=false;}};
  }

  async function loadTelegramSettings(){
    const host=document.getElementById('telegram-settings-body');if(!host)return;
    try{const result=await SB.rpc('get_telegram_notification_settings');if(result.error)throw result.error;renderTelegramSettings(result.data||{});}
    catch(error){host.innerHTML=`<p class="entry-error" role="alert">โหลดการตั้งค่า Telegram ไม่สำเร็จ · ${esc(error.message||'')}</p>`;}
  }

  const baseTeamAccounts=RENDER.teamAccounts;
  RENDER.teamAccounts=async function(){
    const accessPromise=canAdminAccess()?loadAccessUsers(true):Promise.resolve();
    const graphicPromise=canAdminAccess()&&!GRAPHIC_READY?loadGraphic():Promise.resolve();
    await Promise.all([accessPromise,graphicPromise,baseTeamAccounts()]);
    if(VIEW!=='teamAccounts'||!canAdminAccess())return;
    try{
      mergeFullAccountRegistry();renderAccountRegistrySummary();renderAccountDirectory();
      const directory=document.getElementById('account-directory');
      if(directory&&!document.getElementById('telegram-team-settings')){
        directory.insertAdjacentHTML('beforebegin',telegramSettingsShell());
        await loadTelegramSettings();
      }
      if(directory&&!document.getElementById('team-graphic-account-links')){
        const section=document.createElement('section');section.id='team-graphic-account-links';
        section.innerHTML=`<div class="account-section-heading"><div><span>แหล่งข้อมูลภายนอก</span><h2>เชื่อมบัญชีทีมกราฟิก</h2><p>จัดการสมาชิกจาก Trello และบัญชี Company Hub ในหน้าบัญชีทีมเพียงจุดเดียว</p></div></div>${teamGraphicAccountPanel()}`;
        directory.after(section);
      }
    }catch(error){
      const target=document.getElementById('account-admin-error');if(target)target.textContent='โหลดรายชื่อทีมกราฟิกไม่สำเร็จ · '+(error.message||'');
    }
  };

  // The module is loaded dynamically; refresh navigation if login finished first.
  if(ACCESS_PROFILE)buildNav();
})();
