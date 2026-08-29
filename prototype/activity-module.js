/* Daily Activity module — loaded after the core application. */
let ACTIVITY_ROWS=[];
let ACTIVITY_READY=false;
let ACTIVITY_FILTER={department:'',status:'',query:'',flag:'',from:'',to:''};

NAV.activity={ic:'i-clipboard',t:'บันทึกกิจกรรม'};
if(!NAVGROUPS[0].items.includes('activity')) NAVGROUPS[0].items.push('activity');
for(const role of Object.keys(ROLE_ALLOW)){
  if(!ROLE_ALLOW[role].includes('activity')) ROLE_ALLOW[role].push('activity');
  if(!SIMPLE_ALLOW[role].includes('activity')) SIMPLE_ALLOW[role].push('activity');
}

function activityDuration(row){return row.duration_minutes==null?null:Number(row.duration_minutes)/60;}
function activityDateLabel(value){
  if(!value)return '-';
  const d=new Date(value+'T00:00:00');
  return d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
}
function activityTime(value){return value?String(value).slice(0,5):'-';}
function activityVisibleRows(){
  const q=ACTIVITY_FILTER.query.trim().toLowerCase();
  return ACTIVITY_ROWS.filter(r=>(!ACTIVITY_FILTER.department||r.department_code===ACTIVITY_FILTER.department)
    &&(!ACTIVITY_FILTER.status||r.status===ACTIVITY_FILTER.status)
    &&(!ACTIVITY_FILTER.flag||r.time_flag===ACTIVITY_FILTER.flag)
    &&(!ACTIVITY_FILTER.from||r.activity_date>=ACTIVITY_FILTER.from)
    &&(!ACTIVITY_FILTER.to||r.activity_date<=ACTIVITY_FILTER.to)
    &&(!q||[r.employee_name,r.activity,r.category,r.department_label].some(v=>String(v||'').toLowerCase().includes(q))));
}
function activitySet(key,value){ACTIVITY_FILTER[key]=value;RENDER.activity();}
function activityClear(){ACTIVITY_FILTER={department:'',status:'',query:'',flag:'',from:'',to:''};RENDER.activity();}

async function loadActivities(){
  if(DEMO_MODE&&!SB){ACTIVITY_ROWS=[];ACTIVITY_READY=true;if(VIEW==='activity')RENDER.activity();return;}
  if(!SB)return;
  try{
    const result=await sbAllRows('daily_activities','activity_date',false);
    if(result.error)throw result.error;
    ACTIVITY_ROWS=result.data||[];
    ACTIVITY_READY=true;
    if(VIEW==='activity')RENDER.activity();
  }catch(error){
    ACTIVITY_READY=false;
    if(VIEW==='activity') main.innerHTML=`${crumb('หน้าแรก','บันทึกกิจกรรม')}<div class="ai-note"><b>ยังเปิดข้อมูลกิจกรรมไม่ได้</b><br>กรุณารัน Migration 008 · ${esc(error.message||'')}</div>`;
  }
}

RENDER.activity=function(){
  if(!ACTIVITY_READY){
    main.innerHTML=`${crumb('หน้าแรก','บันทึกกิจกรรม')}<div class="page-h"><div><h1>บันทึกกิจกรรม</h1><p>กำลังโหลดข้อมูลตามสิทธิ์ของคุณ…</p></div></div>`;
    loadActivities();return;
  }
  const rows=activityVisibleRows();
  const departments=[...new Map(ACTIVITY_ROWS.map(r=>[r.department_code,r.department_label||deptName(r.department_code)])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'th'));
  const statuses=[...new Set(ACTIVITY_ROWS.map(r=>r.status).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
  const people=new Set(rows.map(r=>r.employee_name)).size;
  const hours=rows.reduce((sum,r)=>sum+(activityDuration(r)||0),0);
  const completed=rows.filter(r=>/Completed|เสร็จ/i.test(r.status)).length;
  const flagged=rows.filter(r=>r.time_flag!=='ok'&&r.time_flag!=='missing').length;
  main.innerHTML=`${crumb('หน้าแรก','บันทึกกิจกรรม')}
    <div class="page-h"><div><h1>บันทึกกิจกรรม</h1><p>ข้อมูลหน้างานจริงจากฐานข้อมูล · การมองเห็นจำกัดตามแผนกและสิทธิ์</p></div></div>
    <div class="activity-kpis">
      <div class="activity-kpi"><div>รายการที่เห็น</div><div class="n">${nf(rows.length)}</div><div class="sub">ตามตัวกรองปัจจุบัน</div></div>
      <div class="activity-kpi"><div>พนักงาน</div><div class="n">${nf(people)}</div><div class="sub">รายชื่อไม่ซ้ำ</div></div>
      <div class="activity-kpi"><div>เวลาที่นับได้</div><div class="n">${nf(hours.toFixed(1))}</div><div class="sub">ชั่วโมง · ตัดเวลาผิดปกติแล้ว</div></div>
      <div class="activity-kpi"><div>เสร็จ / ต้องตรวจเวลา</div><div class="n">${nf(completed)} / ${nf(flagged)}</div><div class="sub">รายการ</div></div>
    </div>
    <div class="card pad">
      <div class="activity-filters">
        <div class="field"><label>แผนก</label><select class="fin" onchange="activitySet('department',this.value)"><option value="">ทั้งหมดที่มีสิทธิ์</option>${departments.map(([code,label])=>`<option value="${esc(code)}" ${ACTIVITY_FILTER.department===code?'selected':''}>${esc(label)}</option>`).join('')}</select></div>
        <div class="field"><label>สถานะ</label><select class="fin" onchange="activitySet('status',this.value)"><option value="">ทั้งหมด</option>${statuses.map(s=>`<option ${ACTIVITY_FILTER.status===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>ตรวจเวลา</label><select class="fin" onchange="activitySet('flag',this.value)"><option value="">ทั้งหมด</option><option value="overnight" ${ACTIVITY_FILTER.flag==='overnight'?'selected':''}>ข้ามวัน</option><option value="excluded_all_day" ${ACTIVITY_FILTER.flag==='excluded_all_day'?'selected':''}>ไม่นับทั้งวัน</option><option value="suspicious" ${ACTIVITY_FILTER.flag==='suspicious'?'selected':''}>ผิดปกติ</option><option value="missing" ${ACTIVITY_FILTER.flag==='missing'?'selected':''}>เวลาไม่ครบ</option></select></div>
        <div class="field"><label>ตั้งแต่</label><input type="date" class="fin" value="${ACTIVITY_FILTER.from}" onchange="activitySet('from',this.value)"></div>
        <div class="field"><label>ถึง</label><input type="date" class="fin" value="${ACTIVITY_FILTER.to}" onchange="activitySet('to',this.value)"></div>
        <div class="field grow"><label>ค้นหา</label><input class="fin" value="${esc(ACTIVITY_FILTER.query)}" placeholder="ชื่อพนักงาน / กิจกรรม / หมวด" oninput="ACTIVITY_FILTER.query=this.value;clearTimeout(window._activityQ);window._activityQ=setTimeout(()=>RENDER.activity(),200)"></div>
        <button class="tbtn" onclick="activityClear()">ล้างตัวกรอง</button>
      </div>
      <div class="activity-scroll"><table class="activity-table"><thead><tr><th>วันที่</th><th>แผนก</th><th>พนักงาน</th><th>กิจกรรม</th><th>หมวด</th><th>เวลา</th><th>ชม.</th><th>สถานะ</th></tr></thead><tbody>
      ${rows.slice(0,1000).map(r=>`<tr><td class="nowrap">${activityDateLabel(r.activity_date)}</td><td>${esc(r.department_label||deptName(r.department_code))}</td><td class="nowrap"><b>${esc(r.employee_name)}</b></td><td class="work">${esc(r.activity)}</td><td>${esc(r.category||'-')}</td><td class="nowrap">${activityTime(r.start_time)}–${activityTime(r.end_time)}</td><td>${activityDuration(r)==null?'<span class="muted">-</span>':activityDuration(r).toFixed(2)}${r.time_flag!=='ok'&&r.time_flag!=='missing'?`<br><span class="activity-flag">${esc(r.time_flag)}</span>`:''}</td><td>${esc(r.status||'-')}</td></tr>`).join('')}
      </tbody></table>${rows.length?`<div class="muted" style="font-size:11px;margin-top:9px">แสดง ${nf(Math.min(rows.length,1000))} จาก ${nf(rows.length)} รายการ</div>`:'<div class="activity-empty">ไม่พบข้อมูลตามตัวกรอง</div>'}</div>
    </div>`;
};

function activityAnswer(question){
  const q=String(question||'').toLowerCase();
  if(!/กิจกรรม|activity|ชั่วโมง|เวลาทำงาน|พนักงาน/.test(q))return null;
  const rows=activityVisibleRows(), hours=rows.reduce((s,r)=>s+(activityDuration(r)||0),0);
  const byDept={}; rows.forEach(r=>{const k=r.department_label||r.department_code;byDept[k]=(byDept[k]||0)+(activityDuration(r)||0);});
  const top=Object.entries(byDept).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return `พบ <b>${nf(rows.length)}</b> กิจกรรม จาก <b>${nf(new Set(rows.map(r=>r.employee_name)).size)}</b> คน รวมเวลาที่ตรวจสอบแล้ว <b>${nf(hours.toFixed(1))} ชั่วโมง</b>${top.length?`<br><br><b>ชั่วโมงสูงสุดตามแผนก</b><br>${top.map(([k,v],i)=>`${i+1}. ${esc(k)} — ${nf(v.toFixed(1))} ชม.`).join('<br>')}`:''}`;
}

const coreAsk=ask;
ask=function(question,bodyId,inputId){
  const answer=activityAnswer(question);
  if(!answer)return coreAsk(question,bodyId,inputId);
  const body=document.getElementById(bodyId||'chatBody'), input=document.getElementById(inputId||'chatInput');
  if(!body)return;
  const safe=esc(String(question||'').trim()); if(!safe)return;
  body.insertAdjacentHTML('beforeend',`<div class="msg u">${safe}</div><div class="msg a">${answer}<div class="src">แหล่งข้อมูล: daily_activities · จำกัดตามสิทธิ์แผนก</div></div>`);
  if(input)input.value=''; body.scrollTop=body.scrollHeight;
};

const coreOnLoggedIn=onLoggedIn;
onLoggedIn=async function(session){
  await coreOnLoggedIn(session);
  await loadActivities();
  try{let timer;SB.channel('ch_daily_activities').on('postgres_changes',{event:'*',schema:'public',table:'daily_activities'},()=>{clearTimeout(timer);timer=setTimeout(loadActivities,350);}).subscribe();}catch(error){}
  buildNav(); if(VIEW==='activity')RENDER.activity();
};

if(DEMO_MODE){
  const databaseCanAdminAccess=canAdminAccess;
  canAdminAccess=function(){return ROLE==='exec'||databaseCanAdminAccess();};
  const databaseAccessRender=RENDER.access;
  RENDER.access=function(){
    if(SB)return databaseAccessRender();
    const samples=[
      ['ผู้บริหาร','exec','ทุกแผนก','ดูภาพรวมและกำหนดสิทธิ์'],
      ['หัวหน้ากราฟิก','lead','กราฟิก','ดูและจัดการทีมกราฟิก'],
      ['หัวหน้า Admin','lead','Admin','ดูปัญหาหน้างานและกิจกรรม Admin'],
      ['พนักงานกราฟิก','staff','กราฟิก','งานตนเองและข้อมูลแผนก']
    ];
    main.innerHTML=`${crumb('หน้าแรก','จัดการสิทธิ์ผู้ใช้')}<div class="page-h"><div><h1>จัดการสิทธิ์ผู้ใช้</h1><p>ตัวอย่างมุมมองผู้บริหาร · ข้อมูลจริงจะแสดงหลังเข้าสู่ระบบ</p></div></div><div class="card pad"><div class="ai-note" style="margin-bottom:12px"><b>หลักการ:</b> สิทธิ์ประกอบด้วยบทบาท + แผนกหลัก + แผนกที่มองเห็น + สิทธิ์จัดการ</div><div class="board"><table><thead><tr><th>ตัวอย่างผู้ใช้</th><th>บทบาท</th><th>ขอบเขต</th><th>สิ่งที่ทำได้</th></tr></thead><tbody>${samples.map(r=>`<tr><td><b>${esc(r[0])}</b></td><td>${roleLabel(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}</tbody></table></div></div>`;
  };
  const databaseLoadGraphic=loadGraphic;
  loadGraphic=async function(){
    if(!SB){GRAPHIC_JOBS=[];GRAPHIC_PROJECTS=[];GRAPHIC_FILES=[];GRAPHIC_CHECKS=[];GRAPHIC_PEOPLE=[];GRAPHIC_READY=true;if(VIEW==='graphic')RENDER.graphic();return;}
    return databaseLoadGraphic();
  };
  const databaseLoadIssues=loadIssues;
  loadIssues=async function(){
    if(!SB){PROBLEMS.length=0;ISSUES_READY=true;if(VIEW==='problems')RENDER.problems();return;}
    return databaseLoadIssues();
  };
  loadActivities();
}

const coreTalkContextQuestions=talkContextQuestions;
talkContextQuestions=function(){
  if(VIEW==='activity')return ['สรุปกิจกรรมและชั่วโมงที่นับได้','แผนกไหนมีชั่วโมงสูงสุด','มีรายการเวลาผิดปกติกี่รายการ'];
  return coreTalkContextQuestions();
};

buildNav();
