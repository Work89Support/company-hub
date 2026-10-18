/* ===== REPORTS (new) ===== */
let REP_PERIOD='week';
RENDER.reports=function(){
  const isExec=isExecutiveRole(),depts=reportDepts();
  const scope=reportScope(),activities=reportActivityRows(depts),issues=reportIssueRows(depts),graphic=scope.filter(t=>t._source==='graphic');
  const deptMetrics=depts.map(c=>reportDeptMetrics(c,scope,activities,issues)),deptsWithData=deptMetrics.filter(m=>m.total>0).length;
  const activityHours=activities.reduce((sum,row)=>sum+activityCountedDuration(row),0);
  const done=scope.filter(t=>t.status==='done'),ontime=done.filter(t=>t.ontime).length;
  const codes=depts.filter(c=>KPI[c]);
  const overall=codes.length?Math.round(codes.reduce((s,c)=>s+deptScore(c),0)/codes.length):null;
  const blocked=scope.filter(t=>t.status==='block'||(t._deadline!==false&&dashboardIsOverdue(t)));
  const kbList=KB.filter(k=>depts.includes(k.dept));
  const graphicStatusRows=Object.entries(STATUS).map(([key,meta])=>({label:meta.t,v:graphic.filter(t=>t.status===key).length,color:meta.c})).filter(x=>x.v);
  const unit=REP_DEPT?(REP_DEPT==='MKT'?'การตลาด + Graphic Production':reportingDeptName(REP_DEPT)):REP_GROUP?('กลุ่ม '+GROUP_NAME[REP_GROUP]):(!isExec?reportingDeptName(currentDept()):'ภาพรวมบริษัท');
  const pname={today:'วันนี้',week:'สัปดาห์นี้',month:'เดือนนี้',quarter:'ไตรมาสนี้'}[REP_PERIOD];
  const opt=(cur,v,txt)=>`<option value="${v}" ${cur===v?'selected':''}>${txt}</option>`;
  main.innerHTML=`${crumb('หน้าแรก','รายงานสรุป')}
  <div class="page-h"><div><h1>รายงานสรุป${isExec?'ผู้บริหาร':'ทีม'}</h1><p>สรุปผลการดำเนินงานเชิงตัวเลข · ${unit} · ${pname}</p></div></div>
  <div class="rep-head">
    <div class="seg">${['today','week','month','quarter'].map(p=>`<button class="${REP_PERIOD===p?'active':''}" onclick="REP_PERIOD='${p}';RENDER.reports()">${{today:'วันนี้',week:'สัปดาห์',month:'เดือน',quarter:'ไตรมาส'}[p]}</button>`).join('')}</div>
    <div style="display:flex;gap:8px">
      <button class="tbtn sm" onclick="printReport()">${sic('i-doc')} PDF</button>
      <button class="tbtn sm" onclick="exportReportExcel()">${sic('i-grid')} Excel</button>
      <button class="tbtn sm primary" onclick="copyReportSummary()">${sic('i-send')} คัดลอกสรุป</button></div>
  </div>
  <div class="filterbar" style="margin-bottom:14px">
    <div class="fsel"><label>กลุ่มงาน (แผนผัง)</label><select onchange="REP_GROUP=this.value;REP_DEPT='';RENDER.reports()">${opt(REP_GROUP,'','ทุกกลุ่ม')}${Object.keys(GROUP_NAME).map(g=>opt(REP_GROUP,g,GROUP_NAME[g])).join('')}</select></div>
    <div class="fsel"><label>แผนก</label><select onchange="REP_DEPT=this.value;RENDER.reports()">${opt(REP_DEPT,'',isExec?'ทั้งบริษัท':'ทุกแผนกที่มีสิทธิ์')}${DEPTS.filter(x=>visibleDepartmentCodes().includes(x.code)&&(!REP_GROUP||deptGroup(x.code)===REP_GROUP)).map(x=>opt(REP_DEPT,x.code,x.name)).join('')}</select></div>
    ${(REP_GROUP||REP_DEPT)?`<button class="tbtn sm" onclick="REP_GROUP='';REP_DEPT='';RENDER.reports()">ล้างตัวกรอง</button>`:''}
    <span style="margin-left:auto;font-size:12px" class="muted">กำลังสรุป: <b style="color:var(--blue-700)">${unit}</b></span>
  </div>
  <div class="exec-summary" style="margin-bottom:14px">
    <b>${sic('i-chat')} บทสรุปจากข้อมูลจริง:</b> ${pname} · <b>${unit}</b>${overall==null?' · ยังไม่ได้ตั้ง KPI Production':` ทำคะแนน KPI <b>${overall}/100</b> (เกณฑ์: ${scoreLabel(overall)})`}.
    ข้อมูลจริงครอบคลุม <b>${deptsWithData}/${depts.length}</b> แผนก · งาน Production <b>${scope.length}</b> งาน (Graphic <b>${graphic.length}</b>) · ปิดแล้ว <b>${done.length}</b> งาน · Daily Activity <b>${activities.length}</b> รายการ / <b>${nf(activityHours.toFixed(1))}</b> ชม. · ปัญหาหน้างาน <b>${issues.length}</b> เคส.
    จุดที่ต้องติดตาม: ${blocked.length?blocked.map(t=>t.title).join(' · '):'ไม่มีงานติดปัญหา/เกินกำหนด'}.
    องค์ความรู้ที่บันทึก ${kbList.length} เรื่อง · Action Plan ค้าง <b>${IMPLEMENTATION_ACTIONS.filter(a=>a.status!=='done').length}</b> รายการ.
  </div>
  <div class="stats" style="margin-bottom:14px">
    <div class="stat accent click" onclick="go('graphic')"><div class="lbl">Graphic Production</div><div class="val">${graphic.length}</div><div class="sub">รวมทุกสถานะที่มีสิทธิ์เห็น</div><span class="go">ดู Graphic →</span></div>
    <div class="stat click" onclick="go('activity')"><div class="lbl">Daily Activity</div><div class="val">${activities.length}</div><div class="sub muted">${nf(activityHours.toFixed(1))} ชั่วโมงที่นับได้</div><span class="go">ดูกิจกรรม →</span></div>
    <div class="stat"><div class="lbl">ส่งตรงเวลา</div><div class="val" style="color:${done.length&&ontime/done.length>=.9?'var(--green)':'var(--amber)'}">${done.length?Math.round(ontime/done.length*100):0}%</div><div class="sub muted">On-time rate</div></div>
    <div class="stat click" onclick="go('kb')"><div class="lbl">องค์ความรู้ใหม่</div><div class="val">${kbList.length}</div><div class="sub muted">บทความเข้า KB</div><span class="go">ดูคลัง →</span></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
    <div class="card"><div class="card-h"><h3>${sic('i-pie')} สัดส่วนสถานะงาน</h3><span class="act">${unit}</span></div><div class="pad">${statusDonutBlock(scope)}</div></div>
    <div class="card"><div class="card-h"><h3>${sic('i-board')} Graphic Production ตามสถานะ</h3><span class="act">${nf(graphic.length)} งาน</span></div><div class="pad">${graphicStatusRows.length?hbars(graphicStatusRows):'<div class="muted">ไม่มีข้อมูล Graphic ตามสิทธิ์</div>'}</div></div>
  </div>
  <div class="card" style="margin-bottom:14px"><div class="card-h"><h3>${sic('i-trophy')} Company Scorecard ${depts.length>1?'รายแผนก':deptName(depts[0])}</h3><span class="act">รวมงาน · กิจกรรม · ปัญหาจากฐานข้อมูลจริง</span></div>
    <table><thead><tr><th>แผนก</th><th>คะแนน KPI</th><th>รายการรวม</th><th>เสร็จ/ปิดแล้ว</th><th>ต้องติดตาม</th><th>ชั่วโมงที่นับได้</th><th>แหล่งข้อมูล</th></tr></thead>
    <tbody>${deptMetrics.map(m=>{const c=m.code,s=KPI[c]?deptScore(c):null;
      return `<tr onclick="openReportDepartment('${c}')" style="cursor:pointer"><td><b style="font-weight:500">${reportingDeptName(c)}</b></td>
      <td style="color:${s==null?'var(--muted)':scoreColor(s)};font-weight:600">${s==null?'—':s+'/100'}</td><td><b>${nf(m.total)}</b></td><td>${nf(m.completed)}</td>
      <td style="color:${m.followup?'var(--red)':'inherit'}">${nf(m.followup)}</td><td>${m.activity.length?nf(m.hours.toFixed(1)):'—'}</td>
      <td>${m.sources.length?`<span class="pill" style="background:var(--blue-700)">${m.sources.join(' · ')}</span>`:'<span class="muted">ยังไม่มีข้อมูลจริง</span>'}</td></tr>`;}).join('')}
    </tbody></table></div>
  <div class="grid" style="grid-template-columns:1fr 1fr">
    <div class="card"><div class="card-h"><h3>${sic('i-block')} ปัญหาที่ต้องติดตาม (${unit})</h3></div><div class="pad">
      ${blocked.map(t=>`<div class="feed-item" style="cursor:pointer" onclick="openDashboardWork('${t._source}','${t.id}')"><span class="fi" style="background:#fde7ea">⚠</span><div style="flex:1"><b style="font-weight:500">${t.title}</b><div class="muted" style="font-size:11px">${t._source==='graphic'?'G-'+t.jobNo:t.id} · ${deptName(t.dept)} · ${STATUS[t.status].t}</div></div></div>`).join('')||'<div class="muted">ไม่มี</div>'}</div></div>
    <div class="card"><div class="card-h"><h3>${sic('i-bulb')} องค์ความรู้ (${unit})</h3></div><div class="pad">
      ${kbList.map(k=>`<div class="feed-item" style="cursor:pointer" onclick="openKB('${k.id}')"><span class="fi" style="background:#e6f7f1">💡</span><div style="flex:1"><b style="font-weight:500">${k.title}</b><div class="muted" style="font-size:11px">${k.id} · ${deptName(k.dept)} · จาก ${k.from}</div></div></div>`).join('')||'<div class="muted">ยังไม่มี</div>'}</div></div>
  </div>`;
};

function scopeKey(){return REP_DEPT||(REP_GROUP?('grp'+REP_GROUP):(isExecutiveRole()?'company':currentDept()));}
function getEdit(k,def){const o=REPORT_EDITS[scopeKey()]||{};return (o[k]!==undefined&&o[k]!=='')?o[k]:def;}
function setEdit(k,v){(REPORT_EDITS[scopeKey()]=REPORT_EDITS[scopeKey()]||{})[k]=v;saveState();toast('บันทึกการแก้ไขแล้ว');}
function monthlyData(){
  const isExec=isExecutiveRole(),depts=reportDepts();
  const allWork=dashboardAllWork();
  const base=REP_MONTH==='09'?allWork.filter(t=>t._source==='graphic'?String(t.dueAt||'').startsWith('2026-09'):CARRIED.includes(t.id)):allWork;
  const scope=base.filter(t=>depts.includes(t.dept));
  const codes=depts.filter(c=>KPI[c]);
  const score=Math.round(codes.reduce((s,c)=>s+deptScore(c),0)/(codes.length||1));
  const done=scope.filter(t=>t.status==='done'),blocked=scope.filter(t=>t.status==='block');
  const overdue=scope.filter(t=>t._deadline!==false&&dashboardIsOverdue(t)),open=scope.filter(t=>t.status!=='done');
  const company=depts.length>1;
  const unit=REP_DEPT?(REP_DEPT==='MKT'?'การตลาด + Graphic Production':reportingDeptName(REP_DEPT)):REP_GROUP?('กลุ่ม '+GROUP_NAME[REP_GROUP]):(!isExec?reportingDeptName(currentDept()):'ภาพรวมบริษัท');
  const monthLabel=REP_MONTH==='09'?'กันยายน 2569':'สิงหาคม 2569';
  const d={isExec,depts,dept:depts[0],scope,codes,score,done,blocked,overdue,open,unit,company,monthLabel};
  d.dHighlight='ปิดงานสำเร็จ '+done.length+' งาน · คะแนน KPI รวม '+score+'/100 ('+scoreLabel(score)+')';
  d.dUrgent=blocked.length?blocked.map(t=>t.title).join(' · '):'ไม่มี';
  d.dDecision=overdue.length?('งานเกินกำหนด '+overdue.length+' รายการ ขอแนวทาง/ทรัพยากรเพิ่ม'):'—';
  d.dSupportOther='ประสานข้อมูล/ทรัพยากรตามงานที่ติดปัญหา';
  d.dSupportExec=(overdue.length||blocked.length)?'อนุมัติแนวทางแก้ไข/ทรัพยากรเพิ่มเติม':'—';
  return d;
}
const gyrScore=s=>{const g=s>=90?['Green','var(--green)']:s>=75?['Yellow','var(--amber)']:['Red','var(--red)'];return '<span class="gyr" style="background:'+g[1]+'">'+g[0]+'</span>';};
const gyrKpi=pc=>{const g=pc>=100?['Green','var(--green)']:pc>=85?['Yellow','var(--amber)']:['Red','var(--red)'];return '<span class="gyr" style="background:'+g[1]+'">'+g[0]+'</span>';};
function mKpiRows(d,exp){return d.company
  ? d.codes.map(c=>{const s=deptScore(c);const g=s>=95?'Green':s>=80?'Yellow':'Red';return `<tr><td>${deptName(c)}</td><td>—</td><td>${s==null?'รอรับรอง':s+'/100'}</td><td>${exp?g:gyrScore(s)}</td><td>${scoreLabel(s,c)}</td></tr>`;}).join('')
  : (KPI[d.dept]?KPI[d.dept].map(k=>{const g=k.pct>=95?'Green':k.pct>=80?'Yellow':'Red';return `<tr><td>${k.n}</td><td>${k.tg}</td><td>${acDisp(k)}</td><td>${exp?g:gyrKpi(k.pct)}</td><td>${kpiStatus(k.pct).t}</td></tr>`;}).join(''):'<tr><td colspan="5">—</td></tr>');}
function mMile(d){return d.done.length?d.done.map((t,i)=>`<tr><td>${i+1}</td><td>${t._source==='graphic'?`G-${t.jobNo} · `:''}${t.title}</td><td>${t.solution?t.solution.slice(0,70):(t._source==='graphic'?'Graphic Production ส่งมอบแล้ว':'สำเร็จตามเป้า')}</td><td>เสร็จ</td></tr>`).join(''):'<tr><td colspan="4">—</td></tr>';}
function mProb(d){const rows=[...d.blocked,...d.overdue.filter(t=>t.status!=='block')];return rows.length?rows.map((t,i)=>`<tr><td>${i+1}</td><td>${t.title}</td><td>${t.desc?t.desc.slice(0,55):'อยู่ระหว่างวิเคราะห์'}</td><td>${t.prio==='high'?'สูง':'ปานกลาง'}</td><td>${t.status==='block'?'Red':'Yellow'}</td></tr>`).join(''):'<tr><td colspan="5">ไม่มี</td></tr>';}
function mAct(d){const meeting=IMPLEMENTATION_ACTIONS.filter(a=>a.status!=='done'&&(!a.department_code||d.depts.includes(a.department_code)));const work=d.open.slice(0,Math.max(0,20-meeting.length));const rows=[...meeting.map(a=>({title:`${a.id} · ${a.title}`,owner:a.owner_label,due:a.due_date,status:(ACTION_STATUS[a.status]||ACTION_STATUS.not_started).t})),...work.map(t=>({title:(t._source==='graphic'?`G-${t.jobNo} · `:'')+t.title,owner:workOwner(t),due:t.due?fmtDate(t.due):'—',status:STATUS[t.status].t}))];return rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.title)}</td><td>${esc(r.owner)}</td><td>${esc(r.due)}</td><td>${esc(r.status)}</td></tr>`).join(''):'<tr><td colspan="5">—</td></tr>';}
function mNext(d){const r=d.scope.filter(t=>t.status==='todo').slice(0,10);return r.length?r.map((t,i)=>`<tr><td>${i+1}</td><td>${t._source==='graphic'?`G-${t.jobNo} · `:''}${t.title}</td><td>${workOwner(t)}</td><td>${t.due?fmtDate(t.due):'—'}</td></tr>`).join(''):'<tr><td colspan="4">กำหนดในที่ประชุม</td></tr>';}
function repFilterBar(){const opt=(cur,v,txt)=>`<option value="${v}" ${cur===v?'selected':''}>${txt}</option>`;
  return `<div class="filterbar" style="margin-bottom:12px">
    <div class="fsel"><label>เดือน</label><select onchange="REP_MONTH=this.value;RENDER.monthly()">${opt(REP_MONTH,'08','สิงหาคม 2569')}${opt(REP_MONTH,'09','กันยายน 2569 (งานยกมา)')}</select></div>
    <div class="fsel"><label>กลุ่มงาน (แผนผัง)</label><select onchange="REP_GROUP=this.value;REP_DEPT='';RENDER.monthly()">${opt(REP_GROUP,'','ทุกกลุ่ม')}${Object.keys(GROUP_NAME).map(g=>opt(REP_GROUP,g,GROUP_NAME[g])).join('')}</select></div>
    <div class="fsel"><label>แผนก</label><select onchange="REP_DEPT=this.value;RENDER.monthly()">${opt(REP_DEPT,'',isExecutiveRole()?'ทั้งบริษัท':'ทุกแผนกที่มีสิทธิ์')}${DEPTS.filter(x=>visibleDepartmentCodes().includes(x.code)&&(!REP_GROUP||deptGroup(x.code)===REP_GROUP)).map(x=>opt(REP_DEPT,x.code,x.name)).join('')}</select></div>
    ${(REP_GROUP||REP_DEPT||REP_MONTH!=='08')?`<button class="tbtn sm" onclick="REP_GROUP='';REP_DEPT='';REP_MONTH='08';RENDER.monthly()">ล้างตัวกรอง</button>`:''}
  </div>`;}
RENDER.monthly=function(){
  const d=monthlyData();const score=d.score;const gyr=score>=90?{t:'Green',c:'var(--green)'}:score>=75?{t:'Yellow',c:'var(--amber)'}:{t:'Red',c:'var(--red)'};
  const ta=(k,def,rows)=>`<textarea class="fin" rows="${rows||2}" onchange="setEdit('${k}',this.value)" style="margin-top:2px">${getEdit(k,def)}</textarea>`;
  main.innerHTML=`${crumb('หน้าแรก','รายงานประจำเดือน')}
  <div class="rep-head">
    <div><b style="font-size:14px">แบบฟอร์มรายงานผลการดำเนินงานประจำเดือน</b><div class="muted" style="font-size:11.5px">🔄 ดึงข้อมูลอัตโนมัติ · แก้ไขข้อความได้ · ${d.unit} · ${d.monthLabel}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="tbtn sm" onclick="printReport()">${sic('i-doc')} PDF</button><button class="tbtn sm" onclick="exportMonthlyWord()">${sic('i-doc')} Word</button><button class="tbtn sm" onclick="exportMonthlyExcel()">${sic('i-grid')} Excel</button><button class="tbtn sm primary" onclick="copyReportSummary()">✉️ คัดลอกสรุปเข้าที่ประชุม</button></div>
  </div>
  ${repFilterBar()}
  <div class="rpt">
    <h2>รายงานผลการดำเนินงานประจำเดือน</h2>
    <div class="rsub">Monthly Performance Report · ใช้ประกอบ Monthly Performance Review Meeting</div>
    <div class="rmeta">
      <div>เดือน / ปี: <b>${d.monthLabel}</b></div><div>หน่วยงาน: <b>${d.unit}</b></div>
      <div>ผู้รายงาน: <b>${esc(ACCESS_PROFILE?.display_name||ACCESS_PROFILE?.email||'')}</b></div><div>ตำแหน่ง: <b>${esc(ACCESS_PROFILE?.position_title||(AUTH_DB_ROLE==='admin'?'ผู้ดูแลระบบ':AUTH_DB_ROLE==='exec'?'ผู้บริหาร':AUTH_DB_ROLE==='lead'?'หัวหน้างาน':'พนักงาน'))}</b></div>
      <div>วันที่รายงาน: <b>${new Date().toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})}</b></div>
      <div>สถานะภาพรวม: <span class="gyr" style="background:${gyr.c}">${gyr.t}</span> (${score}/100)</div>
    </div>
    <h3>1. Executive Summary <span style="font-size:10px;color:var(--muted);font-weight:400">✎ แก้ไขได้</span></h3>
    <label style="font-size:11px;color:var(--muted)">ผลงานเด่นของเดือน</label>${ta('highlight',d.dHighlight)}
    <label style="font-size:11px;color:var(--muted)">ประเด็นที่ต้องเร่งแก้ไข</label>${ta('urgent',d.dUrgent)}
    <label style="font-size:11px;color:var(--muted)">เรื่องที่ต้องการการตัดสินใจจากผู้บริหาร</label>${ta('decision',d.dDecision)}
    <h3>2. KPI / Target vs Actual</h3>
    <table><thead><tr><th>KPI / ตัวชี้วัด${d.company?' (รายแผนก)':''}</th><th>Target</th><th>Actual</th><th>Status</th><th>หมายเหตุ</th></tr></thead><tbody>${mKpiRows(d)}</tbody></table>
    <h3>3. ผลงานสำคัญประจำเดือน (Milestones)</h3>
    <table><thead><tr><th>#</th><th>งาน / Milestone</th><th>ผลลัพธ์</th><th>สถานะ</th></tr></thead><tbody>${mMile(d)}</tbody></table>
    <h3>4. ปัญหา / ความเสี่ยง / สาเหตุ</h3>
    <table><thead><tr><th>#</th><th>Issue / Risk</th><th>สาเหตุ (Root Cause)</th><th>ผลกระทบ</th><th>สถานะ</th></tr></thead><tbody>${mProb(d)}</tbody></table>
    <h3>5. Corrective Action / Action Plan</h3>
    <table><thead><tr><th>#</th><th>Action</th><th>Owner</th><th>Due Date</th><th>Status</th></tr></thead><tbody>${mAct(d)}</tbody></table>
    <h3>6. แผนและเป้าหมายเดือนถัดไป</h3>
    <table><thead><tr><th>#</th><th>แผนงาน / เป้าหมาย</th><th>Owner</th><th>Due Date</th></tr></thead><tbody>${mNext(d)}</tbody></table>
    <h3>7. Support Required / Management Decision <span style="font-size:10px;color:var(--muted);font-weight:400">✎ แก้ไขได้</span></h3>
    <label style="font-size:11px;color:var(--muted)">สิ่งที่ต้องการจากฝ่ายอื่น</label>${ta('supportOther',d.dSupportOther)}
    <label style="font-size:11px;color:var(--muted)">สิ่งที่ต้องการจาก Executive Board</label>${ta('supportExec',d.dSupportExec)}
    <label style="font-size:11px;color:var(--muted)">มติ/ข้อสั่งการของผู้บริหาร</label>${ta('resolution','(บันทึกในที่ประชุม)')}
    <h3>8. สรุป Action หลังประชุม <span style="font-size:10px;color:var(--muted);font-weight:400">✎ แก้ไขได้</span></h3>
    ${ta('post','1) ____________  Owner: ____  Due: __/__  Status: ____\n2) ____________  Owner: ____  Due: __/__  Status: ____',4)}
    <h3>9. หมายเหตุเพิ่มเติม <span style="font-size:10px;color:var(--muted);font-weight:400">✎ แก้ไขได้</span></h3>
    <label style="font-size:11px;color:var(--muted)">บันทึกข้อมูลเพิ่มเติม / ข้อสังเกต / สิ่งที่ต้องติดตามเป็นพิเศษ</label>${ta('note','',4)}
    <div class="muted" style="font-size:11px;margin-top:12px;text-align:center">อ้างอิงแบบฟอร์ม: แบบฟอร์มรายงานผลการดำเนินงานประจำเดือน · จัดทำโดยระบบ Company Hub</div>
  </div>`;
};
function monthlyStaticHTML(){
  const d=monthlyData();const score=d.score;const gyr=score>=90?['Green','#00a878']:score>=75?['Yellow','#e8971b']:['Red','#e2445c'];
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const nl=s=>esc(s).replace(/\n/g,'<br>');
  const css="body{font-family:'Tahoma','TH Sarabun New',sans-serif;color:#182338;font-size:12pt}h2{text-align:center;color:#1a49a6;margin:0}h3{color:#1a49a6;border-left:4px solid #1a49a6;padding-left:8px;margin:16px 0 6px;font-size:13pt}table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #ccd;padding:5px 7px;font-size:10pt;text-align:left;vertical-align:top}th{background:#e7effc}";
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset="utf-8"><style>${css}</style></head><body>
  <h2>รายงานผลการดำเนินงานประจำเดือน</h2>
  <p style="text-align:center;color:#666;font-size:9pt">Monthly Performance Report · ใช้ประกอบ Monthly Performance Review Meeting</p>
  <table><tr><td>เดือน / ปี</td><td><b>${d.monthLabel}</b></td><td>หน่วยงาน</td><td><b>${esc(d.unit)}</b></td></tr>
  <tr><td>ผู้รายงาน</td><td><b>${esc(ACCESS_PROFILE?.display_name||ACCESS_PROFILE?.email||'')}</b></td><td>ตำแหน่ง</td><td><b>${esc(ACCESS_PROFILE?.position_title||(AUTH_DB_ROLE==='admin'?'ผู้ดูแลระบบ':AUTH_DB_ROLE==='exec'?'ผู้บริหาร':AUTH_DB_ROLE==='lead'?'หัวหน้างาน':'พนักงาน'))}</b></td></tr>
  <tr><td>สถานะภาพรวม</td><td><b style="color:${gyr[1]}">${gyr[0]} (${score}/100)</b></td><td>รอบประชุม</td><td><b>ประจำเดือน</b></td></tr></table>
  <h3>1. Executive Summary</h3>
  <p><b>ผลงานเด่นของเดือน:</b> ${nl(getEdit('highlight',d.dHighlight))}</p>
  <p><b>ประเด็นที่ต้องเร่งแก้ไข:</b> ${nl(getEdit('urgent',d.dUrgent))}</p>
  <p><b>เรื่องที่ต้องการการตัดสินใจจากผู้บริหาร:</b> ${nl(getEdit('decision',d.dDecision))}</p>
  <h3>2. KPI / Target vs Actual</h3>
  <table><tr><th>KPI / ตัวชี้วัด</th><th>Target</th><th>Actual</th><th>Status</th><th>หมายเหตุ</th></tr>${mKpiRows(d,true)}</table>
  <h3>3. ผลงานสำคัญประจำเดือน</h3><table><tr><th>#</th><th>งาน / Milestone</th><th>ผลลัพธ์</th><th>สถานะ</th></tr>${mMile(d)}</table>
  <h3>4. ปัญหา / ความเสี่ยง / สาเหตุ</h3><table><tr><th>#</th><th>Issue / Risk</th><th>Root Cause</th><th>ผลกระทบ</th><th>สถานะ</th></tr>${mProb(d)}</table>
  <h3>5. Corrective Action / Action Plan</h3><table><tr><th>#</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th></tr>${mAct(d)}</table>
  <h3>6. แผนและเป้าหมายเดือนถัดไป</h3><table><tr><th>#</th><th>แผนงาน / เป้าหมาย</th><th>Owner</th><th>Due</th></tr>${mNext(d)}</table>
  <h3>7. Support Required / Management Decision</h3>
  <p><b>สิ่งที่ต้องการจากฝ่ายอื่น:</b> ${nl(getEdit('supportOther',d.dSupportOther))}</p>
  <p><b>สิ่งที่ต้องการจาก Executive Board:</b> ${nl(getEdit('supportExec',d.dSupportExec))}</p>
  <p><b>มติ/ข้อสั่งการของผู้บริหาร:</b> ${nl(getEdit('resolution','(บันทึกในที่ประชุม)'))}</p>
  <h3>8. สรุป Action หลังประชุม</h3><p>${nl(getEdit('post',''))||'—'}</p>
  <h3>9. หมายเหตุเพิ่มเติม</h3><p>${nl(getEdit('note',''))||'—'}</p>
  </body></html>`;
}
function downloadBlob(content,name,mime){const blob=new Blob(['﻿'+content],{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();toast('ส่งออกไฟล์ '+name+' แล้ว');}
function exportMonthlyWord(){downloadBlob(monthlyStaticHTML(),'รายงานประจำเดือน-'+scopeKey()+'.doc','application/msword');}
function exportMonthlyExcel(){
  const d=monthlyData();const rows=[['รายงานผลการดำเนินงานประจำเดือน'],['เดือน',d.monthLabel],['หน่วยงาน',d.unit],['ผู้รายงาน',ACCESS_PROFILE?.display_name||ACCESS_PROFILE?.email||''],[]];
  rows.push(['[ KPI / Target vs Actual ]']);
  if(d.company){rows.push(['แผนก','คะแนน','สถานะ']);d.codes.forEach(c=>rows.push([deptName(c),deptScore(c)+'/100',scoreLabel(deptScore(c),c)]));}
  else if(KPI[d.dept]){rows.push(['KPI','Target','Actual','Achievement','ระดับผล']);KPI[d.dept].forEach(k=>rows.push([k.n,k.tg,acDisp(k),k.pct+'%',kpiStatus(k.pct).t]));}
  rows.push([],['[ Action Plan (งานที่ยังไม่เสร็จ) ]'],['Action','Owner','Due','Status']);
  IMPLEMENTATION_ACTIONS.filter(a=>a.status!=='done'&&(!a.department_code||d.depts.includes(a.department_code))).forEach(a=>rows.push([a.id+' · '+a.title,a.owner_label,a.due_date,(ACTION_STATUS[a.status]||ACTION_STATUS.not_started).t]));
  d.open.forEach(t=>rows.push([(t._source==='graphic'?'G-'+t.jobNo+' · ':'')+t.title,workOwner(t),t.due?fmtDate(t.due):'',STATUS[t.status].t]));
  rows.push([],['[ Milestones ]'],['งาน','ผลลัพธ์']);
  d.done.forEach(t=>rows.push([t.title,t.solution||'สำเร็จตามเป้า']));
  rows.push([],['[ หมายเหตุเพิ่มเติม ]'],[getEdit('note','')||'—']);
  downloadRows(rows,'monthly-report-'+scopeKey()+'.csv');
}

/* ===== Action Tracker (มติประชุมและแผนควบคุม Go-live) ===== */
const ACTION_STATUS={not_started:{t:'ยังไม่เริ่ม',c:'var(--muted)'},in_progress:{t:'กำลังทำ',c:'var(--sky)'},review:{t:'รอตรวจ',c:'var(--amber)'},blocked:{t:'ติดปัญหา',c:'var(--red)'},done:{t:'เสร็จ',c:'var(--green)'}};
function trackerStatus(t){const m=ACTION_STATUS[t.status]||ACTION_STATUS.not_started;if(t.status!=='done'&&t.due_date<new Date().toISOString().slice(0,10))return['เกินกำหนด','var(--red)'];return[m.t,m.c];}
function trackerRows(){return IMPLEMENTATION_ACTIONS.filter(t=>{const head=/Lead|Head|หัวหน้า|Admin|Executive/i.test(t.owner_label||'');return (!TRACK_MONTH||String(t.due_date||'').slice(5,7)===TRACK_MONTH)&&(!TRACK_GROUP||deptGroup(t.department_code)===TRACK_GROUP)&&(!TRACK_DEPT||t.department_code===TRACK_DEPT)&&(!TRACK_LEVEL||(TRACK_LEVEL==='head'?head:!head));});}
function actionDaysOver(t){if(t.status==='done')return 0;const due=new Date(t.due_date+'T23:59:59+07:00'),now=new Date();return due<now?Math.ceil((now-due)/86400000):0;}
function canManageImplementationAction(t){return canAdminAccess()||(AUTH_DB_ROLE==='lead'&&t.department_code&&MANAGE_DEPTS.includes(t.department_code));}
function actionPhaseLabel(p){return {go_live:'Go-live',adoption:'Adoption',structure:'Structure',improvement:'Improvement',uat_week_1:'UAT 7 วัน'}[p]||p;}
function openImplementationAction(id){const a=IMPLEMENTATION_ACTIONS.find(x=>x.id===id);if(!a)return;const edit=canManageImplementationAction(a);showModal(`<div class="modal-h"><div><span class="tag">${esc(a.id)} · ${esc(actionPhaseLabel(a.phase))}</span><h3 style="margin-top:7px">${esc(a.title)}</h3><div class="muted">${esc(a.owner_label||'ยังไม่ระบุ Owner')} · ${a.department_code?esc(reportingDeptName(a.department_code)):'ภาพรวมบริษัท'}</div></div><button class="x" onclick="closeModal()">×</button></div><div class="pad"><div class="field"><label>รายละเอียด</label><div class="v">${esc(a.detail||'-')}</div></div><div class="field"><label>เกณฑ์สำเร็จ</label><div class="v">${esc(a.success_measure||'-')}</div></div><div class="two"><div class="field"><label>เริ่ม</label><div class="v">${esc(a.start_date)}</div></div><div class="field"><label>กำหนดเสร็จ</label><div class="v">${esc(a.due_date)}</div></div></div><div class="field"><label>สถานะ</label><select class="fin" id="iaStatus" ${edit?'':'disabled'}>${Object.entries(ACTION_STATUS).map(([v,m])=>`<option value="${v}" ${a.status===v?'selected':''}>${m.t}</option>`).join('')}</select></div><div class="field"><label>หลักฐาน / ผลตรวจ</label><textarea class="fin" id="iaEvidence" rows="4" ${edit?'':'disabled'} placeholder="ลิงก์ ยอดที่ตรวจ ผล UAT หรือสาเหตุที่ค้าง">${esc(a.evidence||'')}</textarea></div>${edit?`<button class="tbtn primary" onclick="saveImplementationAction('${a.id}')">บันทึกผลติดตาม</button>`:'<div class="ai-note">บัญชีนี้มีสิทธิ์ดูอย่างเดียว</div>'}</div>`);}
async function saveImplementationAction(id){if(!SB)return;const a=IMPLEMENTATION_ACTIONS.find(x=>x.id===id);if(!a||!canManageImplementationAction(a))return;const status=val('iaStatus'),evidence=val('iaEvidence').trim();try{const r=await SB.from('implementation_actions').update({status,evidence}).eq('id',id).select().single();if(r.error)throw r.error;Object.assign(a,r.data);closeModal();RENDER.tracker();toast('บันทึก '+id+' แล้ว');}catch(e){toast('บันทึกไม่สำเร็จ · '+(e.message||''),'info');}}
RENDER.tracker=function(){
  const rows=trackerRows(),opt=(cur,v,txt)=>`<option value="${v}" ${cur===v?'selected':''}>${txt}</option>`;
  const done=rows.filter(t=>t.status==='done').length,blocked=rows.filter(t=>t.status==='blocked').length,overdue=rows.filter(actionDaysOver).length,progress=rows.length?Math.round(done/rows.length*100):0;
  const x3=PROBLEMS.filter(p=>String(p.project||'').toUpperCase()==='3X'),x3open=x3.filter(p=>!reportIssueResolved(p)).length;
  main.innerHTML=`${crumb('หน้าแรก','Action Tracker')}
  <div class="page-h"><div><h1>Action Tracker · Go-live</h1><p>มติประชุม · UAT 7 วัน · Action Plan 30 วัน · เก็บผลตรวจใน Supabase</p>${sourceBadge('live','MEETING ACTIONS → SUPABASE','ไม่เกี่ยวกับขั้นตอนนำเข้า Google Sheets')}</div><button class="tbtn" onclick="exportTrackerExcel()">${sic('i-grid')} Excel</button></div>
  <div class="stats" style="margin-bottom:14px"><div class="stat accent"><div class="lbl">ความคืบหน้า</div><div class="val">${progress}%</div><div class="sub">เสร็จ ${done}/${rows.length}</div></div><div class="stat"><div class="lbl">เกินกำหนด</div><div class="val" style="color:var(--red)">${overdue}</div><div class="sub">ต้องระบุสาเหตุ/หลักฐาน</div></div><div class="stat"><div class="lbl">ติดปัญหา</div><div class="val" style="color:var(--amber)">${blocked}</div><div class="sub">รอผู้บริหารปลดล็อก</div></div><div class="stat click" onclick="PF.project='3X';go('problems')"><div class="lbl">3X Focus</div><div class="val">${x3open}</div><div class="sub">ค้างจาก ${x3.length} เคส · SOP ${SOP_RECORDS.length}</div><span class="go">ดูเคส →</span></div></div>
  <div class="filterbar">
    <div class="fsel"><label>เดือนกำหนดเสร็จ</label><select onchange="TRACK_MONTH=this.value;RENDER.tracker()">${opt(TRACK_MONTH,'','ทุกเดือน')}${opt(TRACK_MONTH,'09','กันยายน 2569')}</select></div>
    <div class="fsel"><label>กลุ่มงาน (แผนผัง)</label><select onchange="TRACK_GROUP=this.value;TRACK_DEPT='';RENDER.tracker()">${opt(TRACK_GROUP,'','ทุกกลุ่ม')}${Object.keys(GROUP_NAME).map(g=>opt(TRACK_GROUP,g,GROUP_NAME[g])).join('')}</select></div>
    <div class="fsel"><label>แผนก</label><select onchange="TRACK_DEPT=this.value;RENDER.tracker()">${opt(TRACK_DEPT,'','ทุกแผนก')}${DEPTS.filter(x=>!TRACK_GROUP||deptGroup(x.code)===TRACK_GROUP).map(x=>opt(TRACK_DEPT,x.code,x.name)).join('')}</select></div>
    <div class="fsel"><label>ระดับตำแหน่ง</label><select onchange="TRACK_LEVEL=this.value;RENDER.tracker()">${opt(TRACK_LEVEL,'','ทุกระดับ')}${opt(TRACK_LEVEL,'head','หัวหน้างาน')}${opt(TRACK_LEVEL,'staff','พนักงาน')}</select></div>
    ${(TRACK_GROUP||TRACK_DEPT||TRACK_LEVEL)?`<button class="tbtn sm" onclick="TRACK_GROUP='';TRACK_DEPT='';TRACK_LEVEL='';RENDER.tracker()">ล้าง</button>`:''}</div>
  <div class="resultline">แสดง ${rows.length} Action จากรายงานประชุม${TRACK_GROUP?' · '+GROUP_NAME[TRACK_GROUP]:''}${TRACK_DEPT?' · '+reportingDeptName(TRACK_DEPT):''}</div>
  ${(!rows.length)?`<div class="card pad" style="text-align:center;color:var(--muted);padding:36px">${IMPLEMENTATION_ACTIONS_READY?'ไม่พบ Action ตามตัวกรอง':'กำลังโหลด Action Plan หรือยังไม่ได้รัน Migration 016'}</div>`:`
  <div class="board"><table><thead><tr><th>ID</th><th>Phase</th><th>แผนกรายงาน</th><th>Action Item</th><th>Owner</th><th>Due</th><th>Status</th><th>Priority</th><th>เกิน(วัน)</th><th>หลักฐาน</th></tr></thead>
  <tbody>${rows.map(t=>{const s=trackerStatus(t),ov=actionDaysOver(t);return `<tr onclick="openImplementationAction('${t.id}')"><td><b>${t.id}</b></td><td>${esc(actionPhaseLabel(t.phase))}</td><td>${t.department_code?esc(reportingDeptName(t.department_code)):'ภาพรวมบริษัท'}</td><td><b style="font-weight:500">${esc(t.title)}</b></td><td>${esc(t.owner_label||'-')}</td><td>${esc(t.due_date)}</td><td><span class="gyr" style="background:${s[1]}">${s[0]}</span></td><td>${esc(t.priority)}</td><td style="color:${ov>0?'var(--red)':'inherit'}">${ov||'-'}</td><td>${t.evidence?'✓':'—'}</td></tr>`;}).join('')}</tbody>
  <tfoot><tr><td colspan="10">รวม ${rows.length} Action</td></tr></tfoot></table></div>`}`;
};
function exportTrackerExcel(){
  const rows=trackerRows(),out=[['ID','Phase','Reporting Department','Action Item','Detail','Owner','Start Date','Due Date','Status','Priority','Days Overdue','Success Measure','Evidence']];
  rows.forEach(t=>{const s=trackerStatus(t);out.push([t.id,actionPhaseLabel(t.phase),t.department_code?reportingDeptName(t.department_code):'ภาพรวมบริษัท',t.title,t.detail,t.owner_label,t.start_date,t.due_date,s[0],t.priority,actionDaysOver(t),t.success_measure,t.evidence]);});
  downloadRows(out,'meeting-action-plan-'+(TRACK_MONTH||'all')+'.csv');
}

/* ===== จัดการพนักงาน / สิทธิ์การเข้าถึง (Production RBAC) ===== */
const ACCESS_ROLE_LABEL={staff:'พนักงาน',lead:'หัวหน้างาน',exec:'ผู้บริหาร',admin:'ผู้ดูแลระบบ'};
function accessRowsFor(id){return ACCESS_USER_DEPTS.filter(x=>x.profile_id===id);}
function accessDeptNames(id,managed=false){const rows=accessRowsFor(id).filter(x=>!managed||x.can_manage);return rows.map(x=>deptName(x.department_code)).join(', ')||'-';}
function accessRoleOptions(selected){return Object.entries(ACCESS_ROLE_LABEL).filter(([r])=>r!=='admin'||AUTH_DB_ROLE==='admin').map(([r,t])=>`<option value="${r}" ${selected===r?'selected':''}>${t}</option>`).join('');}
function accessDepartmentOptions(selected){return DEPTS.map(d=>`<option value="${d.code}" ${selected===d.code?'selected':''}>${esc(d.name)}</option>`).join('');}
function accessDepartmentChecks(prefix,selected=[],managed=[]){return DEPTS.map(d=>`<label style="display:flex;gap:7px;align-items:center;font-size:12px;padding:6px 8px;border:1px solid var(--line);border-radius:8px"><input type="checkbox" data-access-visible="${prefix}" value="${d.code}" ${selected.includes(d.code)?'checked':''}> <span style="flex:1">${esc(d.name)}</span><input type="checkbox" data-access-manage="${prefix}" value="${d.code}" ${managed.includes(d.code)?'checked':''} title="หัวหน้าจัดการแผนกนี้"> <small>จัดการ</small></label>`).join('');}
function selectedAccessValues(attr,prefix){return [...document.querySelectorAll(`[${attr}="${prefix}"]:checked`)].map(x=>x.value);}
function syncAccessRoleForm(prefix){const role=val(prefix+'Role');const primary=val(prefix+'Dept');const manage=document.querySelectorAll(`[data-access-manage="${prefix}"]`);manage.forEach(x=>{x.disabled=role!=='lead';if(role!=='lead')x.checked=false;});const primaryVisible=document.querySelector(`[data-access-visible="${prefix}"][value="${primary}"]`);if(primaryVisible){primaryVisible.checked=true;primaryVisible.disabled=true;}document.querySelectorAll(`[data-access-visible="${prefix}"]`).forEach(x=>{if(x.value!==primary)x.disabled=role==='exec'||role==='admin';if(role==='exec'||role==='admin')x.checked=true;});}
async function loadAccessUsers(force=false){
  if(!SB||!canAdminAccess()||ACCESS_USERS_LOADING||ACCESS_USERS_READY&&!force)return;
  ACCESS_USERS_LOADING=true;
  try{
    const [profiles,depts]=await Promise.all([SB.from('profiles').select('id,email,display_name,position_title,role,department_code,active,created_at,updated_at').order('display_name'),SB.from('profile_departments').select('profile_id,department_code,can_manage')]);
    if(profiles.error)throw profiles.error;if(depts.error)throw depts.error;
    ACCESS_USERS=profiles.data||[];ACCESS_USER_DEPTS=depts.data||[];ACCESS_USERS_READY=true;
  }catch(e){toast('โหลดบัญชีไม่สำเร็จ · '+(e.message||''),'info');}
  finally{ACCESS_USERS_LOADING=false;if(VIEW==='users')RENDER.users();}
}
function openInviteUser(){
  if(!canAdminAccess())return;
  showModal(`<div class="modal-h"><div><h3>${sic('i-users')} เพิ่มพนักงาน</h3><div class="muted" style="font-size:11.5px">ระบบจะส่งลิงก์ตั้งรหัสผ่านไปยังอีเมลพนักงาน</div></div><button class="x" onclick="closeModal()">×</button></div><div class="pad">
    <div class="two"><div class="field"><label>ชื่อที่แสดง *</label><input class="fin" id="newUserName" maxlength="120" placeholder="ชื่อพนักงาน"></div><div class="field"><label>อีเมล *</label><input class="fin" id="newUserEmail" type="email" placeholder="name@company.com"></div></div>
    <div class="field"><label>ตำแหน่งงาน *</label><input class="fin" id="newUserPosition" maxlength="120" placeholder="เช่น Graphic Designer, Admin Officer, Team Lead"></div>
    <div class="two"><div class="field"><label>Role *</label><select class="fin" id="newUserRole" onchange="syncAccessRoleForm('newUser')">${accessRoleOptions('staff')}</select></div><div class="field"><label>แผนกหลัก *</label><select class="fin" id="newUserDept" onchange="syncAccessRoleForm('newUser')">${accessDepartmentOptions('GRAPHIC')}</select></div></div>
    <div class="field"><label>แผนกที่มองเห็น <span class="muted">· ช่อง “จัดการ” ใช้เฉพาะ Role หัวหน้างาน</span></label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px">${accessDepartmentChecks('newUser',['GRAPHIC'],[])}</div></div>
    <div class="ai-note"><b>สิทธิ์ข้อมูล:</b> ผู้บริหารมองเห็นทุกแผนกอัตโนมัติ · พนักงานเห็นเฉพาะแผนกที่กำหนด · บัญชีเข้าใช้ได้จากทุกเครื่อง</div>
    <button class="tbtn primary" id="inviteUserBtn" onclick="inviteAccessUser()">ส่งคำเชิญสร้างบัญชี</button></div>`);setTimeout(()=>syncAccessRoleForm('newUser'),0);
}
async function inviteAccessUser(){
  const email=normSp(val('newUserEmail')).toLowerCase(),display=normSp(val('newUserName')),position=normSp(val('newUserPosition')),role=val('newUserRole'),department=val('newUserDept');
  if(!display||!position||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('กรุณากรอกชื่อ ตำแหน่ง และอีเมลให้ถูกต้อง','info');return;}
  if(!confirm(`ส่งคำเชิญสร้างบัญชีให้ ${email} ใช่หรือไม่?`))return;
  const btn=document.getElementById('inviteUserBtn');btn.disabled=true;
  try{const r=await SB.functions.invoke('invite-company-user',{body:{email,display_name:display,position_title:position,role,department_code:department,visible_departments:selectedAccessValues('data-access-visible','newUser'),managed_departments:selectedAccessValues('data-access-manage','newUser'),enforce_device:false,enforce_ip:false,allowed_ip_cidrs:[]}});if(r.error)throw r.error;if(r.data&&r.data.error)throw new Error(r.data.error);closeModal();ACCESS_USERS_READY=false;await loadAccessUsers(true);toast('ส่งคำเชิญไปที่ '+email+'แล้ว');}catch(e){btn.disabled=false;toast('สร้างบัญชีไม่สำเร็จ · '+(e.message||''),'info');}
}
function openAccessUser(id){
  const user=ACCESS_USERS.find(x=>x.id===id);if(!user)return;const rows=accessRowsFor(id),visible=rows.map(x=>x.department_code),managed=rows.filter(x=>x.can_manage).map(x=>x.department_code),self=id===ACCESS_PROFILE?.id;
  const roster=typeof ACCOUNT_LIST!=='undefined'?ACCOUNT_LIST.find(x=>x.profile_id===id):null,rawEmail=roster?.contact_email||user.email||'',shownEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)&&!/@company-hub\.invalid$/i.test(rawEmail)?rawEmail:'ยังไม่มีอีเมลจริง',editableEmail=shownEmail==='ยังไม่มีอีเมลจริง'?'':shownEmail;
  if(user.role==='admin'&&AUTH_DB_ROLE!=='admin'){showModal(`<div class="modal-h"><div><h3>${sic('i-users')} บัญชีผู้ดูแลระบบ</h3><div class="muted" style="font-size:11.5px">${esc(shownEmail)}</div></div><button class="x" onclick="closeModal()">×</button></div><div class="pad"><div class="ai-note">เฉพาะผู้ดูแลระบบเท่านั้นที่แก้สิทธิ์บัญชี Admin ได้</div><button class="tbtn" onclick="closeModal()">ปิด</button></div>`);return;}
  showModal(`<div class="modal-h"><div><h3>${sic('i-users')} ตั้งค่าพนักงาน</h3><div class="muted" style="font-size:11.5px">${esc(shownEmail)}${self?' · บัญชีของคุณ':''}</div></div><button class="x" onclick="closeModal()">×</button></div><div class="pad">
    <div class="two"><div class="field"><label>ชื่อที่แสดง</label><input class="fin" value="${esc(user.display_name||'')}" disabled></div><div class="field"><label>อีเมลสำหรับเข้าสู่ระบบ</label><input class="fin" id="editUserEmail" type="email" maxlength="254" value="${esc(editableEmail)}" placeholder="name@example.com" ${roster?'':'disabled'}><div class="muted" style="font-size:10.5px;margin-top:5px">${roster?'แก้ไขได้โดยไม่กระทบงาน ประวัติ หรือสิทธิ์เดิม · อีเมลเดียวใช้หลายบัญชีได้':'บัญชีอีเมลแบบเดิมต้องแก้ผ่านระบบยืนยันตัวตน'}</div></div></div>
    <div class="field"><label>ตำแหน่งงาน</label><input class="fin" id="editUserPosition" maxlength="120" value="${esc(user.position_title||'')}" placeholder="ตำแหน่งงานจริง"></div>
    <div class="two"><div class="field"><label>Role</label><select class="fin" id="editUserRole" onchange="syncAccessRoleForm('editUser')">${accessRoleOptions(user.role)}</select></div><div class="field"><label>แผนกหลัก</label><select class="fin" id="editUserDept" onchange="syncAccessRoleForm('editUser')">${accessDepartmentOptions(user.department_code)}</select></div></div>
    <div class="field"><label>แผนกที่มองเห็น <span class="muted">· ติ๊ก “จัดการ” สำหรับแผนกที่หัวหน้าดูแล</span></label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px">${accessDepartmentChecks('editUser',visible,managed)}</div></div>
    <div class="field"><label>สถานะบัญชี</label><select class="fin" id="editUserActive"><option value="true" ${user.active?'selected':''}>เปิดใช้งาน</option><option value="false" ${!user.active?'selected':''}>ปิดใช้งาน</option></select><div class="muted" style="font-size:10.5px;margin-top:5px">ปิดใช้แล้วจะเข้าสู่ระบบไม่ได้ แต่ประวัติงานเดิมยังคงอยู่ · สถานะ “พร้อมใช้/รอตั้งรหัส” คำนวณจากการตั้งรหัสอัตโนมัติ</div></div>
    ${self?'<div class="ai-note">ระบบจะไม่ยอมให้คุณปิดบัญชีหรือลดสิทธิ์ผู้ดูแลของตัวเอง</div>':''}
    <button class="tbtn primary" id="saveAccessBtn" onclick="saveAccessUser('${id}')">บันทึกข้อมูลและสิทธิ์</button></div>`);
  setTimeout(()=>syncAccessRoleForm('editUser'),0);
}
async function saveAccessUser(id){
  const btn=document.getElementById('saveAccessBtn');if(btn.disabled)return;
  const position=normSp(val('editUserPosition')),emailInput=document.getElementById('editUserEmail'),email=emailInput?val('editUserEmail').trim().toLowerCase():null;
  if(!position){toast('กรุณาระบุตำแหน่งงาน','info');return;}
  if(email!==null&&email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('กรุณากรอกอีเมลให้ถูกต้อง หรือเว้นว่างหากยังไม่มีอีเมล','info');return;}
  const args={target_user:id,new_role:val('editUserRole'),new_primary_department:val('editUserDept'),visible_departments:selectedAccessValues('data-access-visible','editUser'),managed_departments:selectedAccessValues('data-access-manage','editUser'),new_active:document.getElementById('editUserActive').value==='true',new_position_title:position};
  const roster=typeof ACCOUNT_LIST!=='undefined'?ACCOUNT_LIST.find(x=>x.profile_id===id):null,oldEmail=(roster?.contact_email||'').trim().toLowerCase(),emailChanged=email!==null&&email!==oldEmail;
  if(!confirm(`ยืนยันการแก้ไข${emailChanged?'อีเมล ':''}แผนก หน้าที่ และสิทธิ์ของบัญชีนี้?`))return;
  btn.disabled=true;
  try{const r=await SB.rpc('set_user_access',args);if(r.error)throw r.error;
    if(emailChanged){try{await accountCall('update-contact-email',{profile_id:id,contact_email:email});if(roster)roster.contact_email=email;}catch(emailError){btn.disabled=false;toast('บันทึกสิทธิ์แล้ว แต่อีเมลไม่สำเร็จ · '+(emailError.message||''),'info');return;}}
    closeModal();toast(emailChanged?'บันทึกอีเมลและสิทธิ์แล้ว':'บันทึกแผนก / หน้าที่แล้ว');
    if(id===ACCESS_PROFILE?.id){await sbLogout();return;}
    try{await loadAccessUsers(true);if(typeof renderAccountDirectory==='function'&&typeof VIEW!=='undefined'&&VIEW==='teamAccounts')renderAccountDirectory();}catch(e){toast('บันทึกแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ กรุณาโหลดใหม่','info');}
  }catch(e){btn.disabled=false;toast('บันทึกไม่สำเร็จ · '+(e.message||''),'info');}
}
RENDER.users=function(){
  if(!CLOUD||!canAdminAccess()){main.innerHTML=`${crumb('หน้าแรก','จัดการพนักงาน')}<div class="card pad">บัญชีนี้ไม่มีสิทธิ์จัดการพนักงาน</div>`;return;}
  if(!ACCESS_USERS_READY){main.innerHTML=`${crumb('หน้าแรก','จัดการพนักงาน')}<div class="card pad">กำลังโหลดบัญชีและสิทธิ์…</div>`;loadAccessUsers();return;}
  const q=ACCESS_USER_Q.toLowerCase(),list=ACCESS_USERS.filter(u=>!q||[u.display_name,u.position_title,u.email,u.role,deptName(u.department_code)].join(' ').toLowerCase().includes(q));const active=ACCESS_USERS.filter(x=>x.active).length;
  main.innerHTML=`${crumb('หน้าแรก','จัดการพนักงาน')}<div class="page-h"><div><h1>จัดการพนักงาน & สิทธิ์</h1><p>สร้างบัญชี · กำหนด Role · แผนกที่มองเห็น · สิทธิ์หัวหน้างาน</p>${sourceBadge('live','SUPABASE AUTH + RLS','จัดการจาก Company Hub โดยไม่ต้องเปิด Supabase Dashboard')}</div><button class="tbtn primary" onclick="openInviteUser()">+ เพิ่มพนักงาน</button></div>
  <div class="stats" style="margin-bottom:14px"><div class="stat"><div class="lbl">บัญชีทั้งหมด</div><div class="val">${ACCESS_USERS.length}</div></div><div class="stat"><div class="lbl">ใช้งานได้</div><div class="val" style="color:var(--green)">${active}</div></div><div class="stat"><div class="lbl">ปิดใช้งาน</div><div class="val" style="color:var(--red)">${ACCESS_USERS.length-active}</div></div><div class="stat"><div class="lbl">หัวหน้า/ผู้บริหาร</div><div class="val">${ACCESS_USERS.filter(x=>['lead','exec','admin'].includes(x.role)).length}</div></div></div>
  <div class="card pad" style="margin-bottom:16px"><h3>ความพร้อมเข้าใช้งาน</h3><p>บัญชีที่เปิดใช้งาน <b>${active}</b> บัญชี · เข้าใช้ได้จากทุกเครื่อง</p><p class="muted">สิทธิ์ข้อมูลยังคงแยกตาม Role แผนกที่มองเห็น และแผนกที่หัวหน้าจัดการ</p></div>
  <div class="filterbar"><div class="searchbox" style="flex:1"><span>🔍</span><input value="${esc(ACCESS_USER_Q)}" placeholder="ค้นหาชื่อ ตำแหน่ง อีเมล Role หรือแผนก" oninput="ACCESS_USER_Q=this.value;RENDER.users()"></div><button class="tbtn sm" onclick="loadAccessUsers(true)">↻ โหลดใหม่</button></div>
  <div class="board"><table><thead><tr><th>พนักงาน / ตำแหน่ง</th><th>Role</th><th>แผนกหลัก</th><th>แผนกที่มองเห็น</th><th>แผนกที่จัดการ</th><th>สถานะ</th></tr></thead><tbody>${list.map(u=>`<tr onclick="openAccessUser('${u.id}')"><td><b>${esc(u.display_name||u.email)}</b><div class="muted" style="font-size:11px">${esc(u.position_title||'ยังไม่ระบุตำแหน่ง')} · ${esc(u.email)}${u.id===ACCESS_PROFILE?.id?' · คุณ':''}</div></td><td><span class="pill" style="background:var(--blue-700)">${ACCESS_ROLE_LABEL[u.role]||u.role}</span></td><td>${deptName(u.department_code)}</td><td>${['exec','admin'].includes(u.role)?'ทุกแผนก':esc(accessDeptNames(u.id))}</td><td>${u.role==='lead'?esc(accessDeptNames(u.id,true)):'-'}</td><td><span class="pill" style="background:${u.active?'var(--green)':'var(--red)'}">${u.active?'ใช้งาน':'ปิดใช้งาน'}</span></td></tr>`).join('')}</tbody><tfoot><tr><td colspan="6">แสดง ${list.length} บัญชี · คลิกแถวเพื่อแก้ไขสิทธิ์</td></tr></tfoot></table></div>`;
};

RENDER.org=function(){
  main.innerHTML=`${crumb('หน้าแรก','แผนผังองค์กร')}
  <div class="page-h"><div><h1>แผนผังองค์กร (Company Chart)</h1><p>โครงสร้างใช้งานจริง แบ่งตามกลุ่มงานและแผนกในระบบ</p></div></div>
  <div style="display:flex;justify-content:center;margin-bottom:6px"><div class="execbox"><b style="font-size:15px">Executive Board</b><div style="font-size:11.5px;opacity:.85">บอร์ดบริหาร</div></div></div>
  <div class="org-summary"><div class="chip"><b>4</b> กลุ่มงาน</div><div class="chip"><b>14</b> แผนก</div><div class="chip">ออดิทระบบเป็นส่วนกลาง</div></div>
  <div class="orggrid">
    ${ORG.map(g=>`<div class="orgcol">
      <div class="orghead" style="background:${g.color}"><div class="c">กลุ่ม ${g.code}</div><b>${g.title}</b><div class="th">${g.th}</div><div class="org-count">${g.teams.length} แผนก</div></div>
      <div style="padding-bottom:4px">${g.teams.map(t=>`<div class="orgteam${t.dept?' hlink':''}" ${t.dept?`onclick="goBoardFiltered({dept:'${t.dept}'})" title="ดูงานของ ${t.name}"`:''}><b><span>${t.name}</span>${t.dept?'<span style="font-size:10px;color:var(--blue-700);font-weight:500;white-space:nowrap">ดูงาน →</span>':''}</b><div class="tsub">${t.th}</div>
        ${t.roles?`<div style="margin-top:6px">${t.roles.map(r=>`<div class="orgrole"><span class="dot" style="background:${g.color}"></span>${r}</div>`).join('')}</div>`:''}
      </div>`).join('')}</div>
    </div>`).join('')}
  </div>
  <div class="muted" style="font-size:11px;margin-top:12px">ข้อมูลตามแผนกที่เปิดใช้งานใน Company Hub · คลิกการ์ดแผนกเพื่อดูงานตามสิทธิ์ของบัญชี</div>`;
};
RENDER.sop=function(){
  const q=F.q.toLowerCase();
  const list=SOPS.filter(s=>(!F.dept||s.dept===F.dept)&&(!q||s.title.toLowerCase().includes(q)||deptName(s.dept).toLowerCase().includes(q)));
  main.innerHTML=`${crumb('หน้าแรก','คลัง SOP')}
  <div class="page-h"><div><h1>คลัง SOP / คู่มือ & เอกสารกลาง</h1><p>ระเบียบ · แบบฟอร์ม · คู่มือปฏิบัติงานของทุกแผนก</p></div></div>
  <div class="sect-title" style="margin-top:2px">${sic('i-folder')} เอกสารกลาง / ระเบียบ & แบบฟอร์ม</div>
  <div class="tiles" style="margin-bottom:18px">
    ${DOCS.map(doc=>`<div class="tile" onclick="openDoc('${doc.id}')"><span class="pill" style="background:var(--blue-800);margin-bottom:8px">ระเบียบ · ${doc.rev}</span><h4>${doc.title}</h4><div class="meta">${doc.en} · ${doc.owner}</div><div style="margin-top:8px;font-size:12px;color:var(--blue-700)">เปิดอ่าน →</div></div>`).join('')}
    <div class="tile" onclick="go('monthly')"><span class="pill" style="background:var(--green);margin-bottom:8px">แบบฟอร์ม</span><h4>แบบฟอร์มรายงานผลการดำเนินงานประจำเดือน</h4><div class="meta">กรอกอัตโนมัติ · Export Word/Excel/PDF</div><div style="margin-top:8px;font-size:12px;color:var(--blue-700)">เปิดฟอร์ม →</div></div>
    <div class="tile" onclick="go('tracker')"><span class="pill" style="background:var(--sky);margin-bottom:8px">ทะเบียนจริง</span><h4>Action Tracker (มติประชุมและ Action Plan)</h4><div class="meta">ติดตามเจ้าของงาน · กำหนดส่ง · หลักฐาน · สถานะ · แยกกลุ่ม/แผนก/ระดับ</div><div style="margin-top:8px;font-size:12px;color:var(--blue-700)">เปิดทะเบียน →</div></div>
  </div>
  <div class="sect-title">${sic('i-book')} คู่มือปฏิบัติงาน (SOP)</div>
  ${filterBarLite('ค้นหาคู่มือ SOP')}
  <div class="resultline">แสดง ${list.length} จาก ${SOPS.length} คู่มือ</div>
  ${list.length?`<div class="tiles">${list.map(s=>`<div class="tile" onclick="openSOP('${s.id}')">
    <span class="pill" style="background:${deptColor(s.dept)};margin-bottom:8px">${deptName(s.dept)}</span>
    <h4>${s.title}</h4><div class="meta">เวอร์ชัน ${s.v} · ${s.steps.length} ขั้นตอน</div>
    <div style="margin-top:10px;font-size:12px;color:var(--blue-700)">ดูขั้นตอน →</div></div>`).join('')}</div>`:'<div class="card pad" style="text-align:center;color:var(--muted);padding:36px">ไม่พบคู่มือที่ตรงกับตัวกรอง</div>'}`;
};
RENDER.kb=function(){
  const q=F.q.toLowerCase();
  const list=KB.filter(k=>(!F.dept||k.dept===F.dept)&&(!q||k.title.toLowerCase().includes(q)||k.problem.toLowerCase().includes(q)||k.tags.join(' ').toLowerCase().includes(q)));
  main.innerHTML=`${crumb('หน้าแรก','คลังความรู้')}
  <div class="page-h"><div><h1>คลังความรู้ (Knowledge Base)</h1><p>วิธีแก้ปัญหาที่ระบบเก็บอัตโนมัติจากการปิดงาน · ค้นหาและใช้ซ้ำได้</p></div></div>
  ${filterBarLite('ค้นหาปัญหา / วิธีแก้ / แท็ก')}
  <div class="ai-note" style="margin-bottom:12px">${sic('i-bulb')} บทความเหล่านี้ถูกสร้างอัตโนมัติจากช่อง "วิธีแก้ปัญหา" ตอนปิดงาน แล้ว AI ช่วยสรุปให้อ่านง่าย</div>
  <div class="resultline">แสดง ${list.length} จาก ${KB.length} บทความ</div>
  ${list.length?`<div class="tiles">${list.map(k=>`<div class="tile" onclick="openKB('${k.id}')">
    <span class="pill" style="background:${deptColor(k.dept)};margin-bottom:8px">${deptName(k.dept)}</span>
    <h4>${k.title}</h4><div class="meta">${k.id} · จากงาน ${k.from}</div>
    <p style="font-size:12px;color:#43506e;margin-top:8px;font-weight:300">${k.problem}</p>
    <div style="margin-top:8px">${k.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div></div>`).join('')}</div>`:'<div class="card pad" style="text-align:center;color:var(--muted);padding:36px">ไม่พบบทความที่ตรงกับตัวกรอง</div>'}`;
};
RENDER.ann=function(){
  main.innerHTML=`${crumb('หน้าแรก','ประกาศ & อัปเดต')}
  <div class="page-h"><div><h1>ประกาศ & บอร์ดอัปเดต</h1><p>บอร์ดกลางของบริษัท — ประกาศจากผู้บริหาร/หัวหน้า และความเคลื่อนไหวงาน</p></div>
    ${['lead','exec','admin'].includes(AUTH_DB_ROLE)?'<button class="tbtn primary" onclick="openAnnForm()">+ ประกาศใหม่</button>':''}</div>
  <div class="grid" style="grid-template-columns:1.4fr 1fr">
    <div class="card"><div class="card-h"><h3>${sic('i-megaphone')} ประกาศ</h3></div><div class="pad">
      ${ANN.map(a=>{const st=annStatus(a);const aud=annAudienceIds(a);const ack=(a.acks||[]).length;const meNeed=aud.includes(me())&&!(a.acks||[]).includes(me())&&st.t!=='หมดอายุ';return `<div class="ann ${a.pin?'pin':''}" style="cursor:pointer" onclick="openAnn('${a.id}')"><div class="who" style="background:${u(a.who).c}">${u(a.who).s}</div>
        <div style="flex:1"><h4>${a.pin?'📌 ':''}${a.title} <span class="pill" style="background:${st.c};font-size:10px">${st.t}</span></h4><div class="body">${a.body}</div>
        <div class="time">${shortName(a.who)} · ${a.time} · 📨 ${a.audience||'ทั้งบริษัท'}${a.from?` · 🗓 ${fmtDate(a.from)}${a.until?('–'+fmtDate(a.until)):''}`:''}</div>
        <div style="margin-top:6px;font-size:11.5px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="color:var(--green)">✓ รับทราบ ${ack}/${aud.length}</span><span class="muted">💬 ตอบกลับ ${(a.comments||[]).length}</span>${meNeed?'<span class="pill" style="background:var(--amber);font-size:10px">คุณยังไม่รับทราบ — คลิกเพื่อรับทราบ</span>':''}</div></div></div>`;}).join('')}</div></div>
    <div class="card"><div class="card-h"><h3>${sic('i-bell')} ${CLOUD?'ความเคลื่อนไหวในรอบใช้งานนี้':'ฟีดงานรวม'}</h3></div><div class="pad">
      ${FEED.filter(f=>!CLOUD||(f.live&&f.account===ACCESS_PROFILE?.id)).map(f=>`<div class="feed-item"><span class="fi" style="background:${f.c}">${f.ic}</span><div style="flex:1">${f.t}<div class="muted" style="font-size:10.5px">${f.time}</div></div></div>`).join('')||'<p class="muted">ยังไม่มีความเคลื่อนไหวในรอบใช้งานนี้ · ดูรายการงานจริงได้ที่ Action Tracker</p>'}</div></div>
  </div>`;
};
RENDER.talk=function(){
  main.innerHTML=`${crumb('หน้าแรก','Talk to Data')}
  <div class="page-h"><div><h1>Talk to Data</h1><p>ถามข้อมูลจากฐานข้อมูลภายในของเราเท่านั้น · ตอบเป็นภาษาไทยพร้อมกราฟ/ตาราง</p></div></div>
  <div class="card pad chat">
    <div class="chat-body" id="chatBody">
      <div class="msg a">สวัสดีค่ะ 👋 ถามข้อมูลงาน/KPI/ลูกค้าได้เลย ระบบจะดึงเฉพาะจากฐานข้อมูลภายในของเรา<br>
        <div style="margin-top:8px">${['เดือนนี้แต่ละแผนกทำ KPI ได้เท่าไหร่','งานติดปัญหาตอนนี้มีอะไรบ้าง','กราฟิกส่งงานตรงเวลากี่เปอร์เซ็นต์'].map(q=>`<span class="chip" onclick="ask('${q}')">${q}</span>`).join('')}</div></div>
    </div>
    <div class="chat-in"><input id="chatInput" placeholder="พิมพ์คำถาม... หรือกดไมค์เพื่อพูด" onkeydown="if(event.key==='Enter')ask(this.value)"><button class="tbtn" title="ถามด้วยเสียง" onclick="voiceDictate('chatInput')">🎤</button><button class="tbtn primary" onclick="ask(document.getElementById('chatInput').value)">ส่ง</button></div>
  </div>`;
};
function ask(q){
  if(!q||!q.trim())return;
  const body=document.getElementById('chatBody'),inp=document.getElementById('chatInput');if(inp)inp.value='';
  body.insertAdjacentHTML('beforeend',`<div class="msg u">${q}</div>`);
  let ans='';
  if(/กิจกรรม|ชั่วโมง|พนักงาน.*ทำ|ใครทำ|activity|บันทึกงาน/.test(q)){
    ans=actAnswer(q);
  }else if(/ปัญหา|problem|เคส|incident|payment|callback|โปรเจกต์|ยังไม่แก้/.test(q)){
    ans=probAnswer(q);
  }else if(/kpi|เท่าไหร่|แผนก/.test(q)){
    ans=`<b>คะแนน KPI รายแผนก (เดือนนี้)</b><span class="q">SELECT dept, AVG(score) FROM kpi_records WHERE month='2026-08' GROUP BY dept</span>
      <table class="datatable" style="width:100%"><tr><th>แผนก</th><th>คะแนน</th></tr>
      ${Object.keys(KPI).map(c=>`<tr><td>${deptName(c)}</td><td style="color:${scoreColor(deptScore(c))}">${deptScore(c)}/100</td></tr>`).join('')}</table>`;
  }else if(/ติดปัญหา|block|ค้าง/.test(q)){
    const b=TASKS.filter(t=>t.status==='block'||t.status==='review');
    ans=`<b>งานที่ต้องจับตา (ติดปัญหา/รอตรวจ) มี ${b.length} งาน</b><span class="q">SELECT * FROM tasks WHERE status IN ('block','review')</span>
      ${b.map(t=>`• <b>${t.id}</b> ${t.title} — ${STATUS[t.status].t} (${deptName(t.dept)})`).join('<br>')}`;
  }else if(/ตรงเวลา|กราฟิก|graphic/.test(q)){
    ans=`แผนกกราฟิกส่งงานตรงเวลา <b style="color:var(--amber)">84%</b> (เป้า ≥90%) ต่ำกว่าเป้าเล็กน้อย<span class="q">SELECT on_time_rate FROM kpi WHERE dept='GRAPHIC'</span>สาเหตุหลักจากงานเร่งแทรกและแก้หลายรอบ — มีวิธีลดใน KB-05`;
  }else{ans=`พบข้อมูลที่เกี่ยวข้องในระบบ ${TASKS.length} งาน และ ${KB.length} บทความความรู้<span class="q">SELECT ... FROM internal_db /* ข้อมูลภายในเท่านั้น */</span>ลองถามเจาะจง เช่น "งานของ CRM วันนี้"`;}
  setTimeout(()=>{body.insertAdjacentHTML('beforeend',`<div class="msg a">${ans}</div>`);body.scrollTop=body.scrollHeight;},250);
  body.scrollTop=body.scrollHeight;
}

/* Talk to Data — production popup available from every page. */
let TALK_HISTORY=[];
function talkContextQuestions(){
  if(VIEW==='problems')return ['เคสไหนยังไม่มีวิธีแก้','สาเหตุปัญหาหลักคืออะไร','แนวทางแก้ที่ใช้บ่อย','กลุ่มไหนพร้อมทำ SOP'];
  if(VIEW==='graphic')return ['งานกราฟิกที่ต้องติดตามมีอะไรบ้าง','ใครมีภาระงานสูง','งานไหนเกินกำหนด'];
  if(VIEW==='activity')return ['สรุปกิจกรรมและชั่วโมงที่นับได้','แผนกไหนมีชั่วโมงสูงสุด','มีรายการเวลาผิดปกติกี่รายการ'];
  if(VIEW==='kpi'||VIEW==='reports')return ['KPI แผนกไหนต่ำกว่าเป้า','สรุปผลงานและความเสี่ยง','ผู้บริหารควรตัดสินใจอะไรวันนี้'];
  return ['สรุปข้อมูลสำคัญของหน้านี้','มีอะไรต้องติดตามเร่งด่วน','ช่วยเสนอแนะสิ่งที่ควรทำต่อ'];
}
function talkCurrentFilters(){if(VIEW==='graphic'&&typeof GF!=='undefined')return {...GF};if(VIEW==='problems')return {...PF};if(VIEW==='activity'&&typeof ACTIVITY_FILTER!=='undefined')return {...ACTIVITY_FILTER};if((VIEW==='board'||VIEW==='myTasks')&&typeof F!=='undefined')return {...F};return {};}
function clearTalkHistory(bodyId='chatBody'){TALK_HISTORY=[];const body=document.getElementById(bodyId);if(body)body.innerHTML='<div class="msg a">ล้างบทสนทนาแล้ว — เริ่มถามเรื่องใหม่ได้เลย</div>';}
function openTalkPopup(prefill=''){
  const qs=talkContextQuestions();
  showModal(`<div class="talk-popup"><div class="modal-h"><div><h3>${sic('i-chat')} Talk to Data</h3><div class="muted" style="font-size:11.5px">ถามได้จากทุกหน้า · สรุปข้อมูลจริงตามสิทธิ์โดยไม่เสียค่า AI</div>${sourceBadge('live','COMPANY DATA','คำนวณอัตโนมัติด้วยกฎของระบบ')}</div><div style="display:flex;gap:6px;align-items:center"><button class="tbtn sm" onclick="clearTalkHistory('talkPopBody')">ล้างบทสนทนา</button><button class="x" onclick="closeModal()">×</button></div></div><div class="pad chat"><div class="chat-body" id="talkPopBody"><div class="msg a">กำลังดูหน้า <b>${esc((NAV[VIEW]&&NAV[VIEW].t)||VIEW)}</b> — ถามต่อได้เลย<div style="margin-top:8px">${qs.map(q=>`<span class="chip" data-q="${esc(q)}" onclick="ask(this.dataset.q,'talkPopBody','talkPopInput')">${esc(q)}</span>`).join('')}</div></div></div><div class="chat-in"><input id="talkPopInput" value="${esc(prefill)}" placeholder="ถามข้อมูล สรุปสถานะ หรือขอรายการติดตาม..." onkeydown="if(event.key==='Enter')ask(this.value,'talkPopBody','talkPopInput')"><button class="tbtn" onclick="voiceDictate('talkPopInput')">🎙️</button><button class="tbtn primary" onclick="ask(document.getElementById('talkPopInput').value,'talkPopBody','talkPopInput')">ส่ง</button></div></div></div>`);
  if(prefill)setTimeout(()=>ask(prefill,'talkPopBody','talkPopInput'),80);
}
function talkRuleAnswer(q){
  if(/กิจกรรม|ชั่วโมง|พนักงาน.*ทำ|ใครทำ|activity|บันทึกงาน/i.test(q))return actAnswer(q);
  if(/ปัญหา|problem|เคส|incident|payment|callback|โปรเจกต์|ยังไม่แก้|วิธีแก้|สาเหตุ|sop|คู่มือ/i.test(q))return probAnswer(q);
  if(/kpi|เท่าไหร่|แผนก/i.test(q))return `<b>คะแนน KPI รายแผนก</b><table class="datatable" style="width:100%"><tr><th>แผนก</th><th>คะแนน</th></tr>${Object.keys(KPI).map(c=>`<tr><td>${deptName(c)}</td><td style="color:${scoreColor(deptScore(c))}">${deptScore(c)}/100</td></tr>`).join('')}</table>`;
  return `AI ยังวิเคราะห์คำถามนี้ไม่ได้ แต่ยังถามเรื่อง KPI ปัญหา วิธีแก้ และกิจกรรมได้`;
}
ask=async function(q,bodyId='chatBody',inputId='chatInput'){
  q=String(q||'').trim();if(!q)return;const body=document.getElementById(bodyId),inp=document.getElementById(inputId);if(!body)return;if(inp)inp.value='';
  const loadingId='talkLoad_'+Date.now();body.insertAdjacentHTML('beforeend',`<div class="msg u">${esc(q)}</div><div class="msg a" id="${loadingId}">กำลังอ่านและวิเคราะห์ข้อมูลตามสิทธิ์ของคุณ…</div>`);body.scrollTop=body.scrollHeight;
  const prior=TALK_HISTORY.slice(-8);TALK_HISTORY.push({role:'user',content:q});
  try{
    if(!SB||!SB.functions)throw new Error('ยังไม่ได้เชื่อมต่อ AI backend');
    const result=await SB.functions.invoke('talk-to-data',{body:{question:q,view:VIEW,filters:talkCurrentFilters(),history:prior}});
    if(result.error){let detail='';try{const payload=await result.error.context.clone().json();detail=String(payload&&payload.error||'');}catch(_error){}throw new Error(detail||result.error.message||'ระบบสรุปข้อมูลไม่สำเร็จ');}if(!result.data||result.data.error)throw new Error((result.data&&result.data.error)||'ระบบไม่ส่งคำตอบกลับมา');
    const a=result.data.answer||{},section=(title,rows)=>Array.isArray(rows)&&rows.length?`<div style="margin-top:9px"><b>${title}</b><ul>${rows.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
    const node=document.getElementById(loadingId);if(node)node.innerHTML=`<div>${esc(a.answer||'ไม่พบคำตอบจากระบบ')}</div>${section('ข้อมูลเชิงลึก',a.insights)}${section('ข้อเสนอแนะ',a.recommendations)}${section('ข้อจำกัดของข้อมูล',a.caveats)}${Array.isArray(a.sources)?a.sources.map(s=>`<span class="tag">${esc(s)}</span>`).join(''):''}`;
    TALK_HISTORY.push({role:'assistant',content:String(a.answer||'').slice(0,1800)});
  }catch(error){
    const node=document.getElementById(loadingId);if(node)node.innerHTML=`${talkRuleAnswer(q)}<span class="q">ใช้คำตอบสำรองจากข้อมูลในหน้าเว็บ · ${esc(error&&error.message?error.message:'ลองใหม่')}</span>`;
  }
  TALK_HISTORY=TALK_HISTORY.slice(-16);body.scrollTop=body.scrollHeight;
};
RENDER.talk=function(){const qs=talkContextQuestions();main.innerHTML=`${crumb('หน้าแรก','Talk to Data')}<div class="page-h"><div><h1>Talk to Data</h1><p>ถามและสรุปข้อมูลจริงจากระบบโดยไม่เสียค่า AI</p>${sourceBadge('live','COMPANY DATA','คำนวณอัตโนมัติด้วยกฎของระบบ')}</div><button class="tbtn" onclick="clearTalkHistory()">ล้างบทสนทนา</button></div><div class="card pad chat"><div class="chat-body" id="chatBody"><div class="msg a">สวัสดีค่ะ 👋 ระบบจะสรุปจากข้อมูลที่คุณมีสิทธิ์เห็น<div style="margin-top:8px">${qs.map(q=>`<span class="chip" data-q="${esc(q)}" onclick="ask(this.dataset.q)">${esc(q)}</span>`).join('')}</div></div></div><div class="chat-in"><input id="chatInput" placeholder="ถามข้อมูล สรุปสถานะ หรือขอรายการติดตาม..." onkeydown="if(event.key==='Enter')ask(this.value)"><button class="tbtn" onclick="voiceDictate('chatInput')">🎙️</button><button class="tbtn primary" onclick="ask(document.getElementById('chatInput').value)">ส่ง</button></div></div>`;};

