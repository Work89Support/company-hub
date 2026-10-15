/* Company World: a lightweight 2.5D company map and personal avatar builder. */
(function(){
  const GROUPS_WORLD=[
    {code:'01',title:'Corporate & Governance',th:'บริหารและกำกับองค์กร',depts:['KPI','FIN','HR','BO','BOM']},
    {code:'02',title:'Creative Studio',th:'คอนเทนต์และการตลาด',depts:['MKT','GRAPHIC']},
    {code:'03',title:'Technology Lab',th:'เทคโนโลยีและลูกค้าสัมพันธ์',depts:['PROG','CRM','AIAUTO']},
    {code:'04',title:'Operations Center',th:'ปฏิบัติการและคุณภาพ',depts:['ADMIN','QC','AUD123','SC']},
  ];
  const AVATAR_OPTIONS={
    preset:[1,2,3,4,5,6],
    skin:['#f6d2b8','#edbd9a','#d99d72','#b97850','#75452f'],
    hair:['#2f2928','#55392d','#805039','#a55b43','#d0a276'],
    shirt:['#2563eb','#7c3aed','#0f9b7a','#e77820','#dd4664','#34445f'],
    hairStyle:['เรียบ','แสกข้าง','สั้น','ยาว'],
    accessory:['ไม่มี','แว่น','หูฟัง','หมวก'],
    pose:['ทำงาน','ยืน','โบกมือ','ประชุม'],
  };
  const WORLD_AGENT_LIMIT=18;
  let WORLD_DEPT='',WORLD_AGENT_SCOPE='',AVATAR_DRAFT=null;
  const worldAvatarKey=()=>`companyhub_avatar_${ACCESS_PROFILE?.id||'preview'}`;
  function defaultAvatar(){const dept=DEPTS.find(d=>d.code===currentDept());return {preset:1,skin:'#f6d2b8',hair:'#2f2928',shirt:dept?.color||'#2563eb',hairStyle:'แสกข้าง',accessory:'ไม่มี',pose:'ทำงาน'};}
  function companyAvatar(){try{return {...defaultAvatar(),...JSON.parse(localStorage.getItem(worldAvatarKey())||'{}')}}catch(_e){return defaultAvatar();}}
  function avatarCurrent(){return AVATAR_DRAFT||companyAvatar();}
  function avatarStyle(config){return `--skin:${esc(config.skin)};--hair:${esc(config.hair)};--shirt:${esc(config.shirt)}`;}
  const avatarClass=(group,value)=>{
    const maps={
      hairStyle:{'เรียบ':'hair-flat','แสกข้าง':'hair-side','สั้น':'hair-short','ยาว':'hair-long'},
      accessory:{'ไม่มี':'accessory-none','แว่น':'accessory-glasses','หูฟัง':'accessory-headset','หมวก':'accessory-hat'},
      pose:{'ทำงาน':'pose-work','ยืน':'pose-stand','โบกมือ':'pose-wave','ประชุม':'pose-meeting'},
    };
    return maps[group]?.[value]||Object.values(maps[group]||{})[0]||'';
  };
  function avatarMarkup(config,large=false){const classes=[avatarClass('hairStyle',config.hairStyle),avatarClass('accessory',config.accessory),avatarClass('pose',config.pose)].join(' '),preset=Number(config.preset)||1;return `<div class="world-avatar has-3d ${classes}${large?' large':''}" style="${avatarStyle(config)}" aria-label="ตัวละคร 3D แบบที่ ${preset}"><img class="avatar-3d" src="assets/avatars/avatar-${preset}.png" alt="" aria-hidden="true"><i class="av-head"></i><i class="av-body"></i><i class="av-arm av-arm-left"></i><i class="av-arm av-arm-right"></i><i class="av-accessory"></i></div>`;}
  function worldStatusFor(personId){
    const rows=dashboardAllWork().filter(t=>t.status!=='done'&&(assigneesOf(t).includes(personId)||t.creator===personId));
    if(rows.some(t=>t.status==='block'))return 'blocked';
    if(rows.some(t=>t.status==='review'))return 'waiting';
    if(rows.some(t=>t.status==='doing'))return 'working';
    return rows.length?'working':'done';
  }
  function worldCurrentTask(personId){
    const rows=dashboardAllWork().filter(task=>task.status!=='done'&&(assigneesOf(task).includes(personId)||task.creator===personId));
    return rows.find(task=>task.status==='block')||rows.find(task=>task.status==='review')||rows.find(task=>task.status==='doing')||rows[0]||null;
  }
  function worldPersonMini(person,index){
    const cfg=person.id===ACCESS_PROFILE?.id?companyAvatar():{...defaultAvatar(),skin:AVATAR_OPTIONS.skin[index%AVATAR_OPTIONS.skin.length],hair:AVATAR_OPTIONS.hair[(index+2)%AVATAR_OPTIONS.hair.length],shirt:deptColor(person.department_code||currentDept())};
    const status=worldStatusFor(person.id);
    const preset=person.id===ACCESS_PROFILE?.id?(Number(cfg.preset)||1):(index%6)+1;
    return `<span class="world-person ${status}" style="${avatarStyle(cfg)}" title="${esc(person.display_name||'สมาชิกทีม')} · ${status==='blocked'?'ติดปัญหา':status==='waiting'?'รอตรวจ':status==='working'?'กำลังทำงาน':'พร้อมรับงาน'}"><img src="assets/avatars/avatar-${preset}.png" alt=""><i class="status"></i></span>`;
  }
  function worldPeople(group){
    const visible=new Set(visibleDepartmentCodes()),rows=(TASK_PROFILES||[]).filter(p=>(p.department_codes||[p.department_code]).some(d=>group.depts.includes(d)&&visible.has(d))).slice(0,4);
    if(ACCESS_PROFILE&&group.depts.includes(currentDept())&&!rows.some(p=>p.id===ACCESS_PROFILE.id))rows.unshift(ACCESS_PROFILE);
    return rows.slice(0,4).map(worldPersonMini).join('');
  }
  const WORLD_DEPT_ROUTES={
    '01':{turnLeft:43,turnTop:50,destLeft:36,destTop:35},
    '02':{turnLeft:57,turnTop:50,destLeft:64,destTop:35},
    '03':{turnLeft:43,turnTop:56,destLeft:35,destTop:61},
    '04':{turnLeft:57,turnTop:56,destLeft:65,destTop:61},
  };
  const WORLD_ROUTE_OFFSETS=[{x:-1.4,y:0},{x:1.2,y:1.2},{x:0,y:-1},{x:2,y:-.6}];
  function worldPersonDepartment(person){
    const codes=person.department_codes||[person.department_code];
    return codes.find(code=>canViewDept(code))||codes[0]||currentDept();
  }
  function worldDepartmentRoute(dept,index){
    const group=GROUPS_WORLD.find(item=>item.depts.includes(dept))?.code||'03',base=WORLD_DEPT_ROUTES[group],offset=WORLD_ROUTE_OFFSETS[index%WORLD_ROUTE_OFFSETS.length];
    return {startLeft:49+(index%3-1)*1.2,startTop:86+(index%2)*1.2,centerLeft:50,centerTop:55,turnLeft:base.turnLeft,turnTop:base.turnTop,destLeft:base.destLeft+offset.x,destTop:base.destTop+offset.y,duration:12+(index%4)*1.4,delay:-(index*2.1)};
  }
  function worldRouteMap(){return `<svg class="world-route-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="route-main" d="M50 88 L50 55"/><path class="route-01" d="M50 55 L43 50 L36 35"/><path class="route-02" d="M50 55 L57 50 L64 35"/><path class="route-03" d="M50 55 L43 56 L35 61"/><path class="route-04" d="M50 55 L57 56 L65 61"/></svg>`;}
  function worldCanSeeEveryDepartment(){return AUTH_DB_ROLE==='exec'||AUTH_DB_ROLE==='admin';}
  function worldPeopleRows(){
    const visible=new Set(visibleDepartmentCodes()),scope=worldCanSeeEveryDepartment()?(WORLD_AGENT_SCOPE||'all'):'allowed';
    const allowed=scope==='department'&&WORLD_DEPT?new Set([WORLD_DEPT]):visible;
    const rows=(TASK_PROFILES||[]).filter(person=>person.is_active!==false&&(person.department_codes||[person.department_code]).some(code=>allowed.has(code)&&visible.has(code)));
    const priority={blocked:0,waiting:1,working:2,done:3};
    rows.sort((a,b)=>(priority[worldStatusFor(a.id)]??9)-(priority[worldStatusFor(b.id)]??9)||String(a.display_name||'').localeCompare(String(b.display_name||''),'th'));
    if(ACCESS_PROFILE&&allowed.has(currentDept())&&!rows.some(person=>person.id===ACCESS_PROFILE.id))rows.unshift(ACCESS_PROFILE);
    return {rows,total:rows.length,shown:Math.min(rows.length,WORLD_AGENT_LIMIT),scope};
  }
  function worldAgentScopeBar(){
    const info=worldPeopleRows(),canAll=worldCanSeeEveryDepartment(),scope=canAll?(WORLD_AGENT_SCOPE||'all'):'allowed';
    return `<section class="world-agent-scope" aria-label="ขอบเขตการแสดงพนักงาน"><div><b>${canAll?(scope==='all'?'ผู้บริหาร · ทุกแผนก':deptName(WORLD_DEPT)):'เฉพาะแผนกตามสิทธิ์ของคุณ'}</b><span>สมาชิก ${nf(info.total)} คน · แสดงบนแผนที่ ${nf(info.shown)} คน${info.total>WORLD_AGENT_LIMIT?' · เน้นผู้มีงานปัจจุบัน':''}</span></div>${canAll?`<div><button class="tbtn ${scope==='all'?'primary':''}" onclick="companyWorldAgentScope('all')">ทุกแผนก</button><button class="tbtn ${scope==='department'?'primary':''}" onclick="companyWorldAgentScope('department')">แผนกที่เลือก</button></div>`:''}</section>`;
  }
  function companyWorldAgentScope(scope){WORLD_AGENT_SCOPE=worldCanSeeEveryDepartment()&&scope==='all'?'all':'department';RENDER.world();}
  window.companyWorldAgentScope=companyWorldAgentScope;
  function worldMovingPeople(){
    const people=worldPeopleRows(),rows=people.rows.slice(0,WORLD_AGENT_LIMIT);
    return `<div class="world-people-live" aria-label="สมาชิกทีมบนแผนที่">${rows.map((person,index)=>{
      const status=worldStatusFor(person.id),task=worldCurrentTask(person.id),dept=worldPersonDepartment(person),route=worldDepartmentRoute(dept,index),preset=person.id===ACCESS_PROFILE?.id?(Number(companyAvatar().preset)||1):(index%6)+1;
      const statusText=status==='blocked'?'ติดปัญหา':status==='waiting'?'รอตรวจ':status==='working'?'กำลังทำงาน':'พร้อมรับงาน';
      const motionText=status==='working'?`กำลังเดินไป ${deptName(dept)}`:`${deptName(dept)} · ${statusText}`;
      const showLabel=person.id===ACCESS_PROFILE?.id||index<6||status==='blocked';
      return `<button type="button" class="world-walker ${status} ${showLabel?'show-label':''}" style="--start-left:${route.startLeft}%;--start-top:${route.startTop}%;--center-left:${route.centerLeft}%;--center-top:${route.centerTop}%;--turn-left:${route.turnLeft}%;--turn-top:${route.turnTop}%;--dest-left:${route.destLeft}%;--dest-top:${route.destTop}%;--motion-duration:${route.duration}s;--motion-delay:${route.delay}s" onclick="companyWorldSelect('${esc(dept)}')" aria-label="${esc(person.display_name||'สมาชิกทีม')} · ${esc(motionText)}"><img src="assets/avatars/avatar-${preset}.png" alt=""><span>${esc(person.display_name||'สมาชิกทีม')}<small>${esc(task?.title||statusText)}</small><em>${esc(motionText)}</em></span><i aria-hidden="true"></i></button>`;
    }).join('')}</div>`;
  }
  function worldTaskRows(){return dashboardAllWork().filter(t=>canViewDept(t.dept));}
  function worldOwnRows(){const id=typeof me==='function'?me():ACCESS_PROFILE?.id;return worldTaskRows().filter(t=>assigneesOf(t).includes(id)||t.creator===id);}
  function worldDeptSummary(code){
    const rows=worldTaskRows().filter(t=>t.dept===code),issues=(PROBLEMS||[]).filter(p=>p.dept===code&&!(typeof reportIssueResolved==='function'?reportIssueResolved(p):['Closed','Resolved','closed','resolved'].includes(p.status)));
    return {all:rows.length,open:rows.filter(t=>t.status!=='done').length,doing:rows.filter(t=>t.status==='doing').length,blocked:rows.filter(t=>t.status==='block').length,issues:issues.length};
  }
  function worldDeptButton(code){const allowed=canViewDept(code),s=worldDeptSummary(code);return `<button class="world-dept ${WORLD_DEPT===code?'active':''} ${allowed?'':'locked'}" onclick="event.stopPropagation();companyWorldSelect('${code}')" title="${allowed?`${s.open} งานที่ยังไม่เสร็จ`:'ไม่มีสิทธิ์เปิดข้อมูลงาน'}"><span>${allowed?'●':'🔒'}</span>${esc(deptName(code))}</button>`;}
  function worldZone(group){return `<section class="world-zone ${group.depts.includes(WORLD_DEPT)?'selected':''}" data-group="${group.code}" aria-label="${esc(group.th)}"><div class="world-zone-head"><span class="world-zone-no">${group.code}</span><div><h2>${esc(group.title)}</h2><small>${esc(group.th)}</small></div></div><div class="world-building"><div class="world-people">${worldPeople(group)}</div></div><div class="world-depts">${group.depts.map(worldDeptButton).join('')}</div></section>`;}
  function companyWorldSelect(code){
    if(!canViewDept(code)){toast('บัญชีนี้ไม่มีสิทธิ์เปิดข้อมูลงานของ '+deptName(code),'info');return;}
    WORLD_DEPT=code;if(worldCanSeeEveryDepartment())WORLD_AGENT_SCOPE='department';RENDER.world();
  }
  window.companyWorldSelect=companyWorldSelect;
  function openWorldDepartment(){if(!WORLD_DEPT)WORLD_DEPT=currentDept()||visibleDepartmentCodes()[0];goBoardFiltered({dept:WORLD_DEPT});}
  window.openWorldDepartment=openWorldDepartment;
  function worldProfile(){
    const cfg=companyAvatar(),own=worldOwnRows(),active=own.filter(t=>t.status!=='done'),blocked=active.filter(t=>t.status==='block'),selected=WORLD_DEPT||currentDept(),summary=worldDeptSummary(selected),current=blocked[0]||active.find(t=>t.status==='doing')||active[0];
    const name=ACCESS_PROFILE?.display_name||'บัญชีของฉัน',position=ACCESS_PROFILE?.position_title||(AUTH_DB_ROLE==='lead'?'หัวหน้าแผนก':AUTH_DB_ROLE==='exec'?'ผู้บริหาร':AUTH_DB_ROLE==='admin'?'ผู้ดูแลระบบ':'พนักงาน');
    return `<aside class="world-panel"><section class="world-profile"><div class="world-profile-top">${avatarMarkup(cfg)}<div><h3>${esc(name)}</h3><p>${esc(deptName(currentDept()))} · ${esc(position)}</p><span class="world-state">${current?(current.status==='block'?'ติดปัญหา':'กำลังทำงาน'):'พร้อมรับงาน'}</span></div></div><div class="world-now"><b>${current?'งานที่กำลังทำ':'ยังไม่มีงานที่กำลังทำ'}</b><p>${current?esc(current.title):'เมื่อได้รับมอบหมาย ตัวละครจะแสดงสถานะบนแผนที่อัตโนมัติ'}</p>${current?`<div class="world-progress"><i style="width:${current.status==='review'?'80':current.status==='doing'?'55':current.status==='block'?'35':'20'}%"></i></div>`:''}</div><div class="world-view-actions" style="margin-top:12px"><button class="tbtn primary" onclick="go('myTasks')">งานของฉัน</button><button class="tbtn" onclick="go('account')">ปรับตัวละคร</button></div></section><section class="world-summary"><h3 style="margin:0 0 10px">${esc(deptName(selected))}</h3><div class="world-mini-stats"><div class="world-mini-stat"><strong>${summary.open}</strong><span>งานที่ยังไม่เสร็จ</span></div><div class="world-mini-stat"><strong>${summary.doing}</strong><span>กำลังดำเนินการ</span></div><div class="world-mini-stat"><strong>${summary.blocked}</strong><span>ติดปัญหา</span></div><div class="world-mini-stat"><strong>${summary.issues}</strong><span>ปัญหาที่ยังไม่ปิด</span></div></div><button class="tbtn" style="width:100%;margin-top:12px" onclick="openWorldDepartment()">เปิดพื้นที่แผนก →</button></section><div class="world-legend"><span><i class="working"></i>กำลังทำงาน</span><span><i class="waiting"></i>รอตรวจ</span><span><i class="blocked"></i>ติดปัญหา</span></div></aside>`;
  }
  function worldQuickCards(){
    const own=worldOwnRows(),open=own.filter(t=>t.status!=='done'),waiting=open.filter(t=>t.status==='review'),blocked=open.filter(t=>t.status==='block');
    const selected=WORLD_DEPT||currentDept(),summary=worldDeptSummary(selected);
    return `<section class="world-quick-cards" aria-label="สถานะงานสำคัญ"><button class="world-quick-card blue" onclick="go('myTasks')"><span class="world-quick-icon">✓</span><span><small>งานของฉัน</small><strong>${open.length} งาน</strong><em>${waiting.length} งานรอตรวจ</em></span><b>›</b></button><button class="world-quick-card amber" onclick="go('completeness')"><span class="world-quick-icon">▰</span><span><small>ข้อมูลที่ต้องเติม</small><strong>${waiting.length} รายการ</strong><em>ตรวจและเติมข้อมูลให้ครบ</em></span><b>›</b></button><button class="world-quick-card red" onclick="go('problems')"><span class="world-quick-icon">!</span><span><small>ปัญหา</small><strong>${blocked.length+summary.issues} รายการ</strong><em>งานติดขัดและเคสที่ยังเปิด</em></span><b>›</b></button><button class="world-quick-card violet" onclick="go('kpi')"><span class="world-quick-icon">▥</span><span><small>KPI</small><strong>ดูผลล่าสุด</strong><em>ตามสิทธิ์ของบัญชีนี้</em></span><b>›</b></button></section>`;
  }
  RENDER.world=function(){
    if(!WORLD_DEPT||!canViewDept(WORLD_DEPT))WORLD_DEPT=currentDept()||visibleDepartmentCodes()[0]||'';
    main.innerHTML=`${crumb('หน้าแรก','แผนที่บริษัท')}<div class="company-world"><header class="world-hero"><div><span class="world-kicker">COMPANY HUB WORLD · 4 กลุ่มงาน · 14 แผนก</span><h1>แผนที่บริษัท</h1><p>เชื่อมโยงทุกคน ทุกแผนก สู่เป้าหมายเดียวกัน</p></div><div class="world-motto"><b>“สถานที่ทำงาน<br>ที่มากกว่าการทำงาน”</b><span>Better People · Brighter Tomorrow</span></div><div class="world-view-actions"><button class="tbtn" onclick="go('dash')">ดูแดชบอร์ดเดิม</button><button class="tbtn primary" onclick="go('myTasks')">เปิดงานของฉัน</button></div></header>${worldAgentScopeBar()}<div class="world-layout"><section class="world-map" aria-label="แผนที่บริษัท 4 กลุ่มงาน"><div class="world-campus">${GROUPS_WORLD.map(worldZone).join('')}</div><div class="world-center"><div><b>CH</b>Company Hub</div></div>${worldRouteMap()}${worldMovingPeople()}${worldProfile()}</section></div>${worldQuickCards()}</div>`;
  };
  function avatarChoice(kind,value,label){const cfg=avatarCurrent(),isColor=['skin','hair','shirt'].includes(kind);return `<button type="button" class="avatar-choice ${cfg[kind]===value?'selected':''} ${isColor?'avatar-swatch':''}" style="${isColor?`background:${esc(value)}`:''}" aria-label="${esc(label||value)}" title="${esc(label||value)}" onclick="companyAvatarChoose('${kind}','${value}')">${isColor?'':esc(label||value)}</button>`;}
  function avatarPresetChoice(value){const cfg=avatarCurrent();return `<button type="button" class="avatar-preset-choice ${Number(cfg.preset)===value?'selected':''}" aria-label="เลือกตัวละคร 3D แบบที่ ${value}" onclick="companyAvatarChoose('preset',${value})"><img src="assets/avatars/avatar-${value}.png" alt="ตัวละครแบบที่ ${value}"></button>`;}
  function renderAvatarEditor(){
    const old=document.getElementById('company-avatar-editor');if(old)old.remove();const cfg=avatarCurrent(),host=document.createElement('section');host.id='company-avatar-editor';host.className='avatar-editor';host.innerHTML=`<div class="avatar-stage"><div class="avatar-stage-badge"><b>${esc(deptName(currentDept()))}</b><span>${esc(ACCESS_PROFILE?.position_title||'พนักงาน')} · ตัวละครเคลื่อนไหว</span></div><div class="avatar-platform"></div>${avatarMarkup(cfg,true)}<div class="avatar-motion-hint" aria-hidden="true"><span>หายใจ</span><span>โบกมือ</span><span>เดินบนแผนที่</span></div><button class="tbtn" style="position:absolute;left:18px;bottom:18px" onclick="go('world')">ดูบนแผนที่บริษัท</button></div><div class="avatar-controls"><div class="avatar-controls-head"><div><span>ตัวละครของฉัน</span><h2>เลือกตัวละคร 3D</h2></div><button class="tbtn" onclick="companyAvatarRandom()">สุ่มตัวละคร</button></div><div class="avatar-preset-grid">${AVATAR_OPTIONS.preset.map(avatarPresetChoice).join('')}</div><div class="avatar-row"><label>สีประจำแผนก</label><div class="avatar-options">${AVATAR_OPTIONS.shirt.map(v=>avatarChoice('shirt',v)).join('')}</div></div><div class="avatar-preview-note"><b>${esc(deptName(currentDept()))}</b> · ${esc(ACCESS_PROFILE?.position_title||'พนักงาน')}<br>ตัวละครจะขยับแบบพักและแสดงบนแผนที่ โดยตำแหน่ง การเดิน และสีสถานะจะเปลี่ยนตามงานจริง</div><div class="avatar-editor-actions"><button class="tbtn" onclick="companyAvatarReset()">คืนค่าเริ่มต้น</button><button class="tbtn primary" onclick="companyAvatarSave()">บันทึกตัวละคร</button></div></div>`;
    const title=main.querySelector('h1'),hero=title?.closest('.account-profile-hero');if(hero)hero.insertAdjacentElement('afterend',host);else if(title)title.insertAdjacentElement('afterend',host);else main.prepend(host);
  }
  function companyAvatarChoose(kind,value){AVATAR_DRAFT={...avatarCurrent(),[kind]:value};renderAvatarEditor();}
  function companyAvatarRandom(){companyAvatarChoose('preset',1+Math.floor(Math.random()*AVATAR_OPTIONS.preset.length));}
  function companyAvatarSave(){localStorage.setItem(worldAvatarKey(),JSON.stringify(avatarCurrent()));AVATAR_DRAFT=null;toast('บันทึกตัวละครแล้ว · พร้อมแสดงบนแผนที่บริษัท');}
  function companyAvatarReset(){AVATAR_DRAFT=defaultAvatar();renderAvatarEditor();toast('คืนค่าตัวละครตามสีแผนกแล้ว · กดบันทึกเพื่อยืนยัน');}
  window.companyAvatarChoose=companyAvatarChoose;window.companyAvatarRandom=companyAvatarRandom;window.companyAvatarSave=companyAvatarSave;window.companyAvatarReset=companyAvatarReset;
  const originalAccount=RENDER.account;
  RENDER.account=async function(){await originalAccount();if(VIEW==='account')renderAvatarEditor();};
  NAV.world={ic:'i-org',t:'แผนที่บริษัท'};
  NAVGROUPS[0].items.unshift('world');
  for(const role of Object.keys(ROLE_ALLOW))ROLE_ALLOW[role].unshift('world');
  for(const role of Object.keys(SIMPLE_ALLOW))SIMPLE_ALLOW[role].unshift('world');
  Object.values(ROLE_META).forEach(meta=>meta.home='world');
  MANUAL.splice(1,0,{id:'world',ic:'i-org',tt:'แผนที่บริษัทและตัวละคร',img:null,html:'<p>หน้าแรกแบบแผนที่บริษัท 3D แบ่งเป็น 4 กลุ่มงาน 14 แผนก โดยป้าย ตัวเลข และสถานะตัวละครมาจากข้อมูลระบบ</p><ol><li>ตัวละครที่กำลังทำงานจะเดินจากทางเข้า ผ่านลานกลาง ไปยังแผนกตามงานจริง ส่วนสถานะรอตรวจ ติดปัญหา และพร้อมรับงานจะแสดงท่าทางและสีแตกต่างกัน</li><li>พนักงานและหัวหน้าเห็นเฉพาะสมาชิกในแผนกตามสิทธิ์ ผู้บริหารและผู้ดูแลระบบเลือกดูทุกแผนกหรือแผนกเดียวได้</li><li>แผนที่แสดงพร้อมกันสูงสุด 18 คน โดยเรียงผู้ติดปัญหา รอตรวจ และกำลังทำงานก่อน เพื่อไม่ให้หน้าจอแน่น</li><li>ป้ายเหนือตัวละครแสดงชื่อ งานปัจจุบัน และปลายทาง โดยจำกัดตามสิทธิ์ที่บัญชีมองเห็น</li><li>แตะตัวละครเพื่อเปิดข้อมูลสรุปของแผนกตามสิทธิ์</li><li>เปิด <b>บัญชีของฉัน</b> เพื่อเลือกตัวละคร 3D และสีประจำแผนก แล้วกดบันทึกตัวละคร</li></ol>'});
  const originalLoggedIn=onLoggedIn;
  onLoggedIn=async function(session){const ok=await originalLoggedIn(session);if(ok)go('world');return ok;};
})();
