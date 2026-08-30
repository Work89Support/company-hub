/* Daily Activity module — loaded after the core application. */
let ACTIVITY_ROWS=[];
let ACTIVITY_READY=false;
let ACTIVITY_FILTER={department:'',status:'',query:'',flag:'',quality:'',from:'',to:''};
let ACTIVITY_PAGE=1;
const ACTIVITY_PAGE_SIZE=100;

NAV.activity={ic:'i-clipboard',t:'บันทึกกิจกรรม'};
if(!NAVGROUPS[0].items.includes('activity')) NAVGROUPS[0].items.push('activity');
for(const role of Object.keys(ROLE_ALLOW)){
  if(!ROLE_ALLOW[role].includes('activity')) ROLE_ALLOW[role].push('activity');
  if(!SIMPLE_ALLOW[role].includes('activity')) SIMPLE_ALLOW[role].push('activity');
}

function activityDuration(row){return row.duration_minutes==null?null:Number(row.duration_minutes)/60;}
function activityCountedDuration(row){return row.time_flag==='ok'?(activityDuration(row)||0):0;}
function activityDateLabel(value){
  if(!value)return '-';
  const d=new Date(value+'T00:00:00');
  return d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
}
function activityTime(value){return value?String(value).slice(0,5):'-';}
function activityQualityFlags(row){
  if(Array.isArray(row.data_quality_flags))return row.data_quality_flags;
  if(typeof row.data_quality_flags==='string')return row.data_quality_flags.replace(/^\{|\}$/g,'').split(',').map(v=>v.replace(/^"|"$/g,'').trim()).filter(Boolean);
  return [];
}
const ACTIVITY_REVIEW_FLAGS=new Set(['missing_employee','missing_status','missing_start_time','missing_end_time','start_invalid_time','end_invalid_time','corrected_date','unexpected_year']);
function activityReviewFlags(row){return activityQualityFlags(row).filter(flag=>ACTIVITY_REVIEW_FLAGS.has(flag));}
const ACTIVITY_QUALITY_LABELS={missing_employee:'ไม่มีชื่อพนักงาน',missing_status:'ไม่มีสถานะ',missing_start_time:'ไม่มีเวลาเริ่ม',missing_end_time:'ไม่มีเวลาจบ',corrected_date:'แก้ปีวันที่',date_range_end:'ใช้วันสิ้นสุดกะ',inherited_date:'ใช้วันที่แถวก่อน',start_invalid_time:'เวลาเริ่มไม่ถูกต้อง',end_invalid_time:'เวลาจบไม่ถูกต้อง'};
function activityQualityLabel(flag){return ACTIVITY_QUALITY_LABELS[flag]||String(flag||'').replaceAll('_',' ');}
const ACTIVITY_EXPECTED_SOURCES=[
  ['BOM','ทีมบริหาร (Management)'],['FIN','การเงิน (Finance)'],['AUD123','ออดิท (Audit)'],['HR','ทรัพยากรบุคคล (HR)'],['KPI','ทีม KPI'],['SECRET','เลขานุการ (Secret)'],
  ['GRAPHIC','Content Creative'],['MKT','การตลาด (Marketing)'],['PROG','Programmer'],['CRM','ลูกค้าสัมพันธ์ (CRM)'],
  ['ADMIN','แอดมิน (Admin) X8'],['ADMIN','แอดมิน (Admin) X5'],['ADMIN','แอดมิน (Admin) X1'],['QC','QC (ตรวจสอบคุณภาพ)'],['BO','Data Provider']
];
function activityReadinessData(){
  const adminView=['admin','exec'].includes(AUTH_DB_ROLE),expected=adminView?ACTIVITY_EXPECTED_SOURCES:[...new Map(ACTIVITY_ROWS.map(r=>[String(r.source_sheet||r.department_label||r.department_code).trim(),[r.department_code,String(r.source_sheet||r.department_label||r.department_code).trim()]])).values()];
  return expected.map(([code,sheet])=>{const rows=ACTIVITY_ROWS.filter(r=>r.department_code===code&&String(r.source_sheet||'').trim()===sheet.trim());const dates=rows.map(r=>r.activity_date).filter(Boolean).sort();const review=rows.filter(r=>activityReviewFlags(r).length>0).length;return {code,sheet,rows:rows.length,from:dates[0]||'',to:dates.at(-1)||'',review,state:rows.length?'ready':'missing'};});
}
function activityReadinessBlock(executive=false){
  const data=activityReadinessData(),missing=data.filter(x=>x.state==='missing').length,ready=data.length-missing;
  return `<div class="card" style="margin-top:16px"><div class="card-h"><h3>${sic('i-clipboard')} ความพร้อมข้อมูลรายแผนก</h3><span class="act">พร้อม ${nf(ready)} · ขาด ${nf(missing)}</span></div><div class="pad"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:9px">${data.map(x=>`<button class="tbtn" style="height:auto;min-height:74px;text-align:left;justify-content:flex-start;padding:11px;border-color:${x.state==='missing'?'#fecaca':'#bbf7d0'};background:${x.state==='missing'?'#fff7f7':'#f7fff9'}" onclick="ACTIVITY_FILTER.department='${esc(x.code)}';ACTIVITY_PAGE=1;go('activity')"><span style="width:100%"><b>${esc(x.sheet)}</b><br><span style="color:${x.state==='missing'?'var(--red)':'var(--green)'}">${x.state==='missing'?'ยังไม่มีบันทึกจริง':nf(x.rows)+' กิจกรรม'}</span>${x.rows?`<br><small class="muted">${activityDateLabel(x.from)}–${activityDateLabel(x.to)} · ตรวจ ${nf(x.review)}</small>`:(x.code==='GRAPHIC'?'<br><small class="muted">งาน Graphic อยู่ในโมดูล Production แยกต่างหาก</small>':'')}</span></button>`).join('')}</div>${executive&&missing?`<div class="ai-note" style="margin-top:12px"><b>ข้อควรระวัง:</b> แผนกที่ขึ้นว่า “ยังไม่มีบันทึกจริง” จะไม่ถูกนำไปตีความว่าผลงานเป็นศูนย์</div>`:''}</div></div>`;
}
function activityVisibleRows(){
  const q=ACTIVITY_FILTER.query.trim().toLowerCase();
  return ACTIVITY_ROWS.filter(r=>(!ACTIVITY_FILTER.department||r.department_code===ACTIVITY_FILTER.department)
    &&(!ACTIVITY_FILTER.status||r.status===ACTIVITY_FILTER.status)
    &&(!ACTIVITY_FILTER.flag||r.time_flag===ACTIVITY_FILTER.flag)
    &&(!ACTIVITY_FILTER.quality||(ACTIVITY_FILTER.quality==='review'?activityReviewFlags(r).length>0:activityQualityFlags(r).includes(ACTIVITY_FILTER.quality)))
    &&(!ACTIVITY_FILTER.from||r.activity_date>=ACTIVITY_FILTER.from)
    &&(!ACTIVITY_FILTER.to||r.activity_date<=ACTIVITY_FILTER.to)
    &&(!q||[r.employee_name,r.activity,r.category,r.department_label,r.worksite,r.operational_issue,r.result_note].some(v=>String(v||'').toLowerCase().includes(q))));
}
function activitySet(key,value){ACTIVITY_FILTER[key]=value;ACTIVITY_PAGE=1;RENDER.activity();}
function activityClear(){ACTIVITY_FILTER={department:'',status:'',query:'',flag:'',quality:'',from:'',to:''};ACTIVITY_PAGE=1;RENDER.activity();}
function activityPage(page){ACTIVITY_PAGE=Math.max(1,page);RENDER.activity();document.querySelector('.activity-scroll')?.scrollIntoView({behavior:'smooth',block:'start'});}
function canManageActivity(row){return AUTH_DB_ROLE==='admin'||AUTH_DB_ROLE==='exec'||(AUTH_DB_ROLE==='lead'&&(ROLE_META.lead.dept===row.department_code||MANAGE_DEPTS.includes(row.department_code)));}
function openActivityTime(id){
  const row=ACTIVITY_ROWS.find(r=>String(r.id)===String(id));if(!row||!canManageActivity(row))return;
  showModal(`<div class="modal-h"><div><h3>ตรวจและยืนยันเวลา</h3><div class="muted" style="font-size:11.5px">${esc(row.employee_name)} · ${activityDateLabel(row.activity_date)} · ${esc(row.department_label||deptName(row.department_code))}</div></div><button class="x" onclick="closeModal()">×</button></div><div class="pad"><div class="ai-note"><b>ค่าต้นทาง:</b> ${esc(row.source_start_raw||'(ไม่มีค่าเดิม)')} – ${esc(row.source_end_raw||'(ไม่มีค่าเดิม)')}<br><span class="muted">รายการที่นำเข้าก่อน Migration 009 อาจไม่มีค่าต้นทาง ให้ตรวจจากชีตเดิมก่อนยืนยัน</span></div><div class="two" style="margin-top:14px"><div class="field"><label>เวลาเริ่มที่ถูกต้อง</label><input class="fin" id="avStart" type="time" value="${activityTime(row.start_time)==='-'?'':activityTime(row.start_time)}"></div><div class="field"><label>เวลาสิ้นสุดที่ถูกต้อง</label><input class="fin" id="avEnd" type="time" value="${activityTime(row.end_time)==='-'?'':activityTime(row.end_time)}"></div></div><div class="field"><label>หมายเหตุ / หลักฐานอ้างอิง</label><textarea class="fin" id="avNote" rows="3" placeholder="เช่น ตรวจจาก Google Sheet ต้นทางแล้ว"></textarea></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="tbtn" onclick="closeModal()">ยกเลิก</button><button class="tbtn primary" id="avSave" onclick="saveActivityTime('${esc(row.id)}')">ยืนยันเวลา</button></div></div>`);
}
async function saveActivityTime(id){
  const start=val('avStart'),end=val('avEnd'),note=normSp(val('avNote'));if(!start||!end){toast('กรุณาระบุเวลาเริ่มและสิ้นสุด','info');return;}
  const btn=document.getElementById('avSave');if(btn){btn.disabled=true;btn.textContent='กำลังบันทึก…';}
  try{const result=await SB.rpc('verify_daily_activity_time',{target_id:Number(id),corrected_start:start,corrected_end:end,note});if(result.error)throw result.error;const index=ACTIVITY_ROWS.findIndex(r=>String(r.id)===String(id));if(index>=0)ACTIVITY_ROWS[index]=result.data;closeModal();RENDER.activity();toast('ยืนยันเวลาและบันทึกผู้ตรวจแล้ว');}
  catch(error){if(btn){btn.disabled=false;btn.textContent='ยืนยันเวลา';}toast('บันทึกไม่สำเร็จ · '+(error.message||'กรุณารัน Migration 009'),'info');}
}

async function loadActivities(){
  if(!SB)return;
  try{
    const result=await sbAllRows('daily_activities','activity_date',false);
    if(result.error)throw result.error;
    ACTIVITY_ROWS=(result.data||[]).filter(row=>row.is_active!==false);
    ACTIVITY_READY=true;
    if(VIEW==='activity')RENDER.activity();
    if(VIEW==='dash')RENDER.dash();
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
  const hours=rows.reduce((sum,r)=>sum+activityCountedDuration(r),0);
  const completed=rows.filter(r=>/Completed|เสร็จ/i.test(r.status)).length;
  const flagged=rows.filter(r=>r.time_flag!=='ok').length;
  const qualityRows=rows.filter(r=>activityReviewFlags(r).length>0).length;
  const flagCounts=rows.reduce((o,r)=>(o[r.time_flag]=(o[r.time_flag]||0)+1,o),{});
  const pages=Math.max(1,Math.ceil(rows.length/ACTIVITY_PAGE_SIZE));
  if(ACTIVITY_PAGE>pages)ACTIVITY_PAGE=pages;
  const from=(ACTIVITY_PAGE-1)*ACTIVITY_PAGE_SIZE,pageRows=rows.slice(from,from+ACTIVITY_PAGE_SIZE);
  main.innerHTML=`${crumb('หน้าแรก','บันทึกกิจกรรม')}
    <div class="page-h"><div><h1>บันทึกกิจกรรม</h1><p>ข้อมูลหน้างานจริงจาก Google Sheets → Supabase · การมองเห็นจำกัดตามแผนกและสิทธิ์</p>${sourceBadge('live','GOOGLE SHEETS → SUPABASE','แสดง snapshot จริงล่าสุด · เก็บรหัสชีต แท็บ แถว และผลตรวจคุณภาพ')}</div></div>
    <div class="activity-kpis">
      <div class="activity-kpi"><div>รายการที่เห็น</div><div class="n">${nf(rows.length)}</div><div class="sub">ตามตัวกรองปัจจุบัน</div></div>
      <div class="activity-kpi"><div>พนักงาน</div><div class="n">${nf(people)}</div><div class="sub">รายชื่อไม่ซ้ำ</div></div>
      <div class="activity-kpi"><div>เวลาที่นับได้</div><div class="n">${nf(hours.toFixed(1))}</div><div class="sub">ชั่วโมง · นับเฉพาะ time_flag = ok</div></div>
      <div class="activity-kpi"><div>เสร็จ</div><div class="n">${nf(completed)}</div><div class="sub">รายการ</div></div>
      <div class="activity-kpi review"><div>ต้องตรวจเวลา</div><div class="n">${nf(flagged)}</div><div class="sub">ไม่ครบ ${nf(flagCounts.missing||0)} · ข้ามวัน ${nf(flagCounts.overnight||0)} · ผิดปกติ ${nf(flagCounts.suspicious||0)} · ไม่นับ ${nf(flagCounts.excluded_all_day||0)}</div></div>
      <div class="activity-kpi quality"><div>ต้องตรวจข้อมูล</div><div class="n">${nf(qualityRows)}</div><div class="sub">ชื่อ · สถานะ · วันที่ · รูปแบบเวลา</div></div>
    </div>
    ${activityReadinessBlock(false)}
    <div class="card pad">
      <div class="activity-filters">
        <div class="field"><label>แผนก</label><select class="fin" onchange="activitySet('department',this.value)"><option value="">ทั้งหมดที่มีสิทธิ์</option>${departments.map(([code,label])=>`<option value="${esc(code)}" ${ACTIVITY_FILTER.department===code?'selected':''}>${esc(label)}</option>`).join('')}</select></div>
        <div class="field"><label>สถานะ</label><select class="fin" onchange="activitySet('status',this.value)"><option value="">ทั้งหมด</option>${statuses.map(s=>`<option ${ACTIVITY_FILTER.status===s?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>ตรวจเวลา</label><select class="fin" onchange="activitySet('flag',this.value)"><option value="">ทั้งหมด</option><option value="overnight" ${ACTIVITY_FILTER.flag==='overnight'?'selected':''}>ข้ามวัน</option><option value="excluded_all_day" ${ACTIVITY_FILTER.flag==='excluded_all_day'?'selected':''}>ไม่นับทั้งวัน</option><option value="suspicious" ${ACTIVITY_FILTER.flag==='suspicious'?'selected':''}>ผิดปกติ</option><option value="missing" ${ACTIVITY_FILTER.flag==='missing'?'selected':''}>เวลาไม่ครบ</option></select></div>
        <div class="field"><label>คุณภาพข้อมูล</label><select class="fin" onchange="activitySet('quality',this.value)"><option value="">ทั้งหมด</option><option value="review" ${ACTIVITY_FILTER.quality==='review'?'selected':''}>มีจุดต้องตรวจ</option><option value="missing_employee" ${ACTIVITY_FILTER.quality==='missing_employee'?'selected':''}>ไม่มีชื่อพนักงาน</option><option value="missing_status" ${ACTIVITY_FILTER.quality==='missing_status'?'selected':''}>ไม่มีสถานะ</option><option value="corrected_date" ${ACTIVITY_FILTER.quality==='corrected_date'?'selected':''}>แก้ปีวันที่</option><option value="date_range_end" ${ACTIVITY_FILTER.quality==='date_range_end'?'selected':''}>วันที่เป็นช่วงกะ</option></select></div>
        <div class="field"><label>ตั้งแต่</label><input type="date" class="fin" value="${ACTIVITY_FILTER.from}" onchange="activitySet('from',this.value)"></div>
        <div class="field"><label>ถึง</label><input type="date" class="fin" value="${ACTIVITY_FILTER.to}" onchange="activitySet('to',this.value)"></div>
        <div class="field grow"><label>ค้นหา</label><input class="fin" value="${esc(ACTIVITY_FILTER.query)}" placeholder="ชื่อพนักงาน / กิจกรรม / หมวด" oninput="ACTIVITY_FILTER.query=this.value;ACTIVITY_PAGE=1;clearTimeout(window._activityQ);window._activityQ=setTimeout(()=>RENDER.activity(),200)"></div>
        <button class="tbtn" onclick="activityClear()">ล้างตัวกรอง</button>
      </div>
      <div class="activity-scroll"><table class="activity-table"><thead><tr><th>วันที่</th><th>แผนก / เว็บ</th><th>พนักงาน</th><th>กิจกรรม / ผลลัพธ์</th><th>หมวด</th><th>เวลา / ตรวจ</th><th>ชม.</th><th>สถานะ / คุณภาพ</th></tr></thead><tbody>
      ${pageRows.map(r=>{const quality=activityReviewFlags(r);return `<tr><td class="nowrap">${activityDateLabel(r.activity_date)}</td><td>${esc(r.department_label||deptName(r.department_code))}${r.worksite?`<br><span class="muted">${esc(r.worksite)}</span>`:''}</td><td class="nowrap"><b>${esc(r.employee_name||'ไม่ระบุ')}</b></td><td class="work">${esc(r.activity)}${r.result_note?`<br><span class="muted">ผลลัพธ์: ${esc(r.result_note)}</span>`:''}${r.operational_issue?`<br><span class="activity-issue">ปัญหา: ${esc(r.operational_issue)}</span>`:''}</td><td>${esc(r.category||'-')}</td><td class="nowrap">${activityTime(r.start_time)}–${activityTime(r.end_time)}${r.time_flag!=='ok'&&canManageActivity(r)?`<br><button class="tbtn sm" style="margin-top:5px" onclick="openActivityTime('${esc(r.id)}')">ตรวจ/แก้เวลา</button>`:''}</td><td>${activityDuration(r)==null?'<span class="muted">-</span>':activityDuration(r).toFixed(2)}${r.time_flag!=='ok'?`<br><span class="activity-flag">${esc(r.time_flag)}</span>`:''}</td><td>${esc(r.status||'-')}${quality.length?`<br><span class="activity-quality" title="${esc(quality.map(activityQualityLabel).join(' · '))}">${nf(quality.length)} จุดต้องตรวจ</span>`:''}</td></tr>`}).join('')}
      </tbody></table>${rows.length?`<div class="activity-pages"><span>แสดง ${nf(from+1)}–${nf(Math.min(from+ACTIVITY_PAGE_SIZE,rows.length))} จาก ${nf(rows.length)} รายการ</span><div><button class="tbtn sm" ${ACTIVITY_PAGE<=1?'disabled':''} onclick="activityPage(${ACTIVITY_PAGE-1})">← ก่อนหน้า</button><span>หน้า ${nf(ACTIVITY_PAGE)} / ${nf(pages)}</span><button class="tbtn sm" ${ACTIVITY_PAGE>=pages?'disabled':''} onclick="activityPage(${ACTIVITY_PAGE+1})">ถัดไป →</button></div></div>`:'<div class="activity-empty">ไม่พบข้อมูลตามตัวกรอง</div>'}</div>
    </div>`;
};

function activityAnswer(question){
  const q=String(question||'').toLowerCase();
  if(!/กิจกรรม|activity|ชั่วโมง|เวลาทำงาน|พนักงาน/.test(q))return null;
  const rows=activityVisibleRows(), hours=rows.reduce((s,r)=>s+activityCountedDuration(r),0),review=rows.filter(r=>r.time_flag!=='ok'),quality=rows.filter(r=>activityReviewFlags(r).length>0);
  const byDept={}; rows.forEach(r=>{const k=r.department_label||r.department_code;byDept[k]=(byDept[k]||0)+activityCountedDuration(r);});
  const top=Object.entries(byDept).sort((a,b)=>b[1]-a[1]).slice(0,5);
  return `พบ <b>${nf(rows.length)}</b> กิจกรรม จาก <b>${nf(new Set(rows.map(r=>r.employee_name).filter(Boolean)).size)}</b> คน รวมเวลาที่ผ่านการตรวจ <b>${nf(hours.toFixed(1))} ชั่วโมง</b> · ต้องตรวจเวลา <b>${nf(review.length)} รายการ</b> · ต้องตรวจข้อมูล <b>${nf(quality.length)} รายการ</b>${top.length?`<br><br><b>ชั่วโมงสูงสุดตามแผนก</b><br>${top.map(([k,v],i)=>`${i+1}. ${esc(k)} — ${nf(v.toFixed(1))} ชม.`).join('<br>')}`:''}`;
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

const coreTalkContextQuestions=talkContextQuestions;
talkContextQuestions=function(){
  if(VIEW==='activity')return ['สรุปกิจกรรมและชั่วโมงที่นับได้','แผนกไหนมีชั่วโมงสูงสุด','มีรายการเวลาผิดปกติกี่รายการ'];
  return coreTalkContextQuestions();
};

buildNav();
