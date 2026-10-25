/* ============================================================
   บันทึกกิจกรรม (Daily Activity) — นำเข้าจาก 4 ไฟล์กลุ่ม (Google Sheets) · ล้าง/normalize แล้ว
============================================================ */
const ACTS=window.ACTIVITY_SEED||[]; /* Externalized to keep the main document deploy-safe. */
const ACT_SRC={files:'4 ไฟล์กลุ่มตามผังองค์กร (Google Sheets)',asof:'20–29 ส.ค. 2026 (ช่วงทดลองใช้จริง)',n:ACTS.length};
const ACT_GC={ '01':'#2158c8','02':'#00a878','03':'#e8971b','04':'#7a53e0' };
const ACT_ST={'เสร็จ (Completed)':'#0b7a5a','กำลังทำ (In Progress)':'#e8971b','รอข้อมูล (Waiting)':'#2563eb','ค้าง / เลื่อน (Pending)':'#c0392b','ยกเลิก (Cancelled)':'#67769a'};
let AF={dept:'',status:'',q:'',flag:''};
function setAF(k,v){AF[k]=(AF[k]===v?'':v);RENDER.activity();}
function clearAF(){AF={dept:'',status:'',q:'',flag:''};RENDER.activity();}
function actFiltered(){return ACTS.filter(a=>(!AF.dept||a.dp===AF.dept)&&(!AF.status||a.s===AF.status)&&(!AF.flag||(AF.flag==='check'?a.tf==='check':a.tf!=='ok'))&&(!AF.q||((a.a+' '+a.e+' '+a.dp).toLowerCase().includes(AF.q.toLowerCase()))));}
function actCounts(list,key){const o={};list.forEach(a=>{const k=a[key]||'(ไม่ระบุ)';o[k]=(o[k]||0)+1;});return Object.entries(o).sort((x,y)=>y[1]-x[1]);}
function actHours(list){return list.reduce((s,a)=>s+(typeof a.du==='number'?a.du:0),0);}
function actBars(pairs,click,colorFn){const max=Math.max(1,...pairs.map(x=>x[1]));return pairs.map(([k,v])=>`<div class="kpirow" style="grid-template-columns:150px 1fr 42px;cursor:pointer" onclick="${click(k)}"><div class="nm" style="font-size:12px">${k}</div><div class="bar"><i style="width:${Math.round(v/max*100)}%;background:${colorFn?colorFn(k):'#2563eb'}"></i></div><div class="score" style="font-size:12px">${v}</div></div>`).join('');}
RENDER.activity=function(){
  const all=ACTS,list=actFiltered();
  const hours=Math.round(actHours(all));
  const people=new Set(all.map(a=>a.e).filter(Boolean)).size;
  const days=new Set(all.map(a=>a.d).filter(Boolean)).size;
  const flagged=all.filter(a=>a.tf!=='ok').length;
  const deptKey=a=>a.dp;
  const dcolor=k=>{const a=all.find(x=>x.dp===k);return a?ACT_GC[a.g]:'#2563eb';};
  const scolor=k=>ACT_ST[k]||'#2563eb';
  const topEmp=Object.entries(all.reduce((o,a)=>{if(a.e){o[a.e]=o[a.e]||{c:0,h:0};o[a.e].c++;o[a.e].h+=(typeof a.du==='number'?a.du:0);}return o;},{})).map(([k,v])=>[k,v]).sort((x,y)=>y[1].h-x[1].h).slice(0,8);
  const empMax=Math.max(1,...topEmp.map(x=>x[1].h));
  const opt=(cur,v,l)=>`<option value="${v}" ${cur===v?'selected':''}>${l}</option>`;
  const depts=[...new Set(all.map(a=>a.dp))];
  main.innerHTML=`${crumb('หน้าแรก','บันทึกกิจกรรม')}
  <div class="page-h"><div><h1>บันทึกกิจกรรม (Daily Activity)</h1><p>รวมกิจกรรมประจำวันที่ทีมกรอกใน ${ACT_SRC.files} · ${ACT_SRC.n} รายการ · ล้างข้อมูลแล้ว · ${ACT_SRC.asof}</p></div>
    <div style="display:flex;gap:8px"><button class="tbtn" onclick="openTalkPopup('สรุปกิจกรรมและชั่วโมงที่นับได้')">${sic('i-chat')} ถาม AI เรื่องกิจกรรม</button></div></div>
  <div class="stats" style="margin-bottom:14px">
    <div class="stat accent click" onclick="clearAF()"><div class="lbl">กิจกรรมทั้งหมด</div><div class="val">${all.length}</div><div class="sub">ทุกแผนก</div><div class="icn">${sic('i-check')}</div></div>
    <div class="stat"><div class="lbl">ชั่วโมงรวม (คำนวณได้)</div><div class="val">${hours}</div><div class="sub muted">เฉพาะแถวเวลาถูกต้อง</div></div>
    <div class="stat"><div class="lbl">จำนวนพนักงาน</div><div class="val">${people}</div><div class="sub muted">${days} วันที่มีข้อมูล</div></div>
    <div class="stat click" onclick="setAF('flag','all')"><div class="lbl">ต้องตรวจเวลา</div><div class="val" style="color:var(--amber)">${flagged}</div><div class="sub muted">เวลาแปลง/กำกวม</div></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
    <div class="card"><div class="card-h"><h3>${sic('i-board')} กิจกรรมตามแผนก</h3><span class="act">คลิกเพื่อกรอง</span></div><div class="pad">${actBars(actCounts(all,'dp'),k=>`setAF('dept','${k.replace(/'/g,"")}')`,dcolor)}</div></div>
    <div class="card"><div class="card-h"><h3>${sic('i-users')} พนักงาน (ชั่วโมงสูงสุด)</h3><span class="act">Top 8</span></div><div class="pad">${topEmp.map(([k,v])=>`<div class="kpirow" style="grid-template-columns:120px 1fr 64px"><div class="nm" style="font-size:12px">${k}</div><div class="bar"><i style="width:${Math.round(v.h/empMax*100)}%;background:#2158c8"></i></div><div class="score" style="font-size:11.5px">${Math.round(v.h)}ชม./${v.c}</div></div>`).join('')}</div></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
    <div class="card"><div class="card-h"><h3>${sic('i-pie')} ตามประเภทงาน</h3></div><div class="pad">${actBars(actCounts(all,'c'),k=>`clearAF()`,k=>'#0b7a75')}</div></div>
    <div class="card"><div class="card-h"><h3>${sic('i-check')} ตามสถานะ</h3></div><div class="pad">${actBars(actCounts(all,'s'),k=>`setAF('status','${k.replace(/'/g,"")}')`,scolor)}</div></div>
  </div>
  <div class="card"><div class="card-h"><h3>${sic('i-board')} รายการกิจกรรม</h3><span class="act">${list.length} / ${all.length}</span></div>
    <div class="pad" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;border-bottom:1px solid var(--line-2)">
      <div class="fsel"><label>แผนก</label><select onchange="AF.dept=this.value;RENDER.activity()">${opt(AF.dept,'','ทั้งหมด')}${depts.map(v=>opt(AF.dept,v,v)).join('')}</select></div>
      <div class="fsel"><label>สถานะ</label><select onchange="AF.status=this.value;RENDER.activity()">${opt(AF.status,'','ทั้งหมด')}${Object.keys(ACT_ST).map(v=>opt(AF.status,v,v)).join('')}</select></div>
      <div class="fsel" style="flex:1;min-width:160px"><label>ค้นหา</label><input class="fin" value="${AF.q}" placeholder="ค้นหากิจกรรม / ชื่อ" oninput="AF.q=this.value;clearTimeout(window._afq);window._afq=setTimeout(RENDER.activity,250)"></div>
      <button class="tbtn sm" onclick="clearAF()">ล้างตัวกรอง</button>
    </div>
    <div style="overflow-x:auto"><table class="datatable" style="width:100%;min-width:900px">
      <tr><th>วันที่</th><th>แผนก</th><th>ผู้บันทึก</th><th>กิจกรรม</th><th>ประเภท</th><th>เวลา</th><th>ชม.</th><th>สถานะ</th></tr>
      ${list.slice().sort((a,b)=>(b.d+(b.st||'')).localeCompare(a.d+(a.st||''))).slice(0,300).map(a=>`<tr>
        <td style="white-space:nowrap">${a.d?a.d.split('-').reverse().join('/'):'-'}</td>
        <td style="font-size:11.5px">${a.dp}</td><td style="white-space:nowrap">${a.e||'-'}</td>
        <td style="max-width:340px">${a.a||''}</td><td style="font-size:11.5px">${(a.c||'').replace(/\s*\(.*\)/,'')}</td>
        <td style="white-space:nowrap;font-size:11.5px">${a.st||'-'}${a.en?'–'+a.en:''}${a.tf!=='ok'?' <span title="เวลาแปลง/กำกวม" style="color:var(--amber)">⚠</span>':''}</td>
        <td>${typeof a.du==='number'?a.du:'-'}</td><td style="font-size:11.5px">${(a.s||'').replace(/\s*\(.*\)/,'')||'-'}</td></tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">ไม่พบรายการ</td></tr>'}
    </table></div>
    <div class="pad muted" style="font-size:11px">ที่มา: ${ACT_SRC.files} · ล้างข้อมูล/เติมวันที่/แปลงเวลาแล้ว · ⚠ = เวลาแปลงจากทศนิยม ควรตรวจ · แสดงล่าสุด ${Math.min(300,list.length)} รายการ</div>
  </div>`;
};
function actAnswer(q){
  const s=q.toLowerCase();let list=ACTS.slice();const parts=[];
  const dep=[...new Set(ACTS.map(a=>a.dp))].find(v=>s.includes(v.toLowerCase().split(' ')[0]));
  if(dep){list=list.filter(a=>a.dp===dep);parts.push(dep);}
  const emp=[...new Set(ACTS.map(a=>a.e))].filter(Boolean).find(v=>v&&s.includes(v.toLowerCase()));
  if(emp){list=list.filter(a=>a.e===emp);parts.push('พนักงาน '+emp);}
  const hours=Math.round(actHours(list));
  const byd=actCounts(list,'dp').slice(0,6);
  const title=parts.length?('กิจกรรม ('+parts.join(' · ')+')'):'สรุปกิจกรรมทั้งหมด';
  return `<b>${title}: ${list.length} รายการ</b> · ชั่วโมงรวม ${hours} ชม. · ${new Set(list.map(a=>a.e).filter(Boolean)).size} คน
    <span class="q">SELECT dept,COUNT(*),SUM(hours) FROM daily_activity${parts.length?' WHERE …':''} GROUP BY dept</span>
    <table class="datatable" style="width:100%"><tr><th>แผนก</th><th>รายการ</th></tr>${byd.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    <div style="margin-top:8px"><button class="tbtn sm" onclick="clearAF();${dep?`AF.dept='${dep.replace(/'/g,'')}';`:''}go('activity')">เปิดหน้าบันทึกกิจกรรม →</button></div>`;
}

function showModal(html){modal.innerHTML=html;overlay.classList.add('show');}
function closeModal(){overlay.classList.remove('show');}
function openTask(id){
  const t=TASKS.find(x=>x.id===id);if(!t)return;const sop=SOPS.find(s=>s.id===t.sop),edit=canManageTaskUi(t),progress=canProgressTaskUi(t),logTime=!CLOUD||isMyTaskAssignee(t);
  const allowedStatus=edit?Object.keys(STATUS):['todo','doing','review','block'];
  const sSel=progress?`<div class="statusbtns">${allowedStatus.map(s=>`<button class="stbtn ${t.status===s?'active':''}" style="--c:${STATUS[s].c}" onclick="setTaskStatus('${t.id}','${s}')">${t.status===s?'● ':''}${STATUS[s].t}</button>`).join('')}</div>`:statusPill(t.status);
  const aBox=`<div style="display:flex;align-items:center;gap:8px;padding-top:4px">${avStack(assigneesOf(t))}<span style="font-size:12.5px">${assigneesOf(t).map(shortName).join(', ')||'ยังไม่มอบหมาย'}</span>${edit?`<button class="tbtn sm" style="margin-left:auto" onclick="openAssigneePicker('${t.id}')">แก้ / เพิ่มคน</button>`:''}</div>`;
  const pSel=edit?`<div class="statusbtns">${Object.keys(PRIO).map(pk=>`<button class="stbtn ${t.prio===pk?'active':''}" style="--c:${PRIO[pk].c}" onclick="setPrio('${t.id}','${pk}')">${PRIO[pk].t}</button>`).join('')}</div>`:prioPill(t.prio);
  const dl=Math.round((DFROM(t.due)-DFROM(TODAY_ISO))/86400000);
  const dueNote=t.status==='done'?'ปิดงานแล้ว':dl>0?('เหลืออีก '+dl+' วัน'):dl===0?'ครบกำหนดวันนี้':('เกินกำหนด '+(-dl)+' วัน');
  const dueColor=t.status==='done'?'var(--green)':dl<0?'var(--red)':dl===0?'var(--amber)':'var(--muted)';
  const _sla=slaOf(t);
  const _slaNote=_sla.unit==='day'?`นับจากวันเริ่ม ${fmtDate(t.start)} ควรเสร็จภายใน ${fmtDate(addFrom(t.start,_sla.n))}`+(addFrom(t.start,_sla.n)>t.due?' · กระชั้นกว่ากำหนดส่ง':''):`ต้องเสร็จภายใน ${_sla.n} ชั่วโมงหลังเริ่มงาน`;
  showModal(`<div class="modal-h"><div><div style="margin-bottom:6px">${deptPill(t.dept)} ${statusPill(t.status)} ${prioPill(t.prio)}</div>
    <h3>${t.title}</h3><div class="muted" style="font-size:11.5px">${t.id} · สั่งโดย ${shortName(t.creator)}</div></div><button class="x" onclick="closeModal()">×</button></div>
  <div class="pad">
    <div class="field"><label>รายละเอียดงาน</label><div class="v">${t.desc||'-'}</div></div>
    <div class="field" style="margin-top:6px"><label>${progress?'สถานะ (ผู้รับงานอัปเดตความคืบหน้า / หัวหน้าปิดงาน)':'สถานะ'}</label>${sSel}</div>
    <div class="field"><label>ความสำคัญ</label>${pSel}</div>
    <div class="field"><label>ผู้รับผิดชอบ (${assigneesOf(t).length} คน)</label>${aBox}</div>
    <div class="two">
      <div class="field"><label>กำหนดส่ง</label>
        <input type="date" class="fin" value="${d2(t.due)}" ${edit?'':'disabled'} onchange="setDue('${t.id}',this.value)">
        <div style="font-size:11px;margin-top:4px;color:${dueColor}">เริ่ม ${fmtDate(t.start)} · ${dueNote}</div></div>
      <div class="field"><label>เวลาที่ใช้ (ชม.)</label>
        <div style="display:flex;gap:6px;align-items:center"><b>${t.spent||0}</b><span class="muted">ชม. รวม</span>
          ${logTime?`<input type="number" min="0.1" step="0.5" class="fin" id="spent_${t.id}" placeholder="เพิ่มครั้งนี้" style="max-width:105px"><button class="tbtn sm" onclick="setSpent('${t.id}')">+ บันทึก</button><button class="tbtn sm" onclick="addSpent('${t.id}',1)">+1 ชม.</button>`:'<span class="muted" style="font-size:11px">ผู้รับงานเป็นผู้ลงเวลา</span>'}</div></div>
    </div>
    <div class="field"><label>ระยะเวลาดำเนินการที่กำหนด (SLA)</label>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="number" min="1" class="fin" id="sla_n_${t.id}" value="${_sla.n}" ${edit?'':'disabled'} style="max-width:80px">
        <select class="fin" id="sla_u_${t.id}" ${edit?'':'disabled'} style="max-width:110px"><option value="day" ${_sla.unit==='day'?'selected':''}>วัน</option><option value="hr" ${_sla.unit==='hr'?'selected':''}>ชั่วโมง</option></select>
        ${edit?`<button class="tbtn sm" onclick="setSla('${t.id}')">บันทึก</button>`:''}</div>
      <div class="muted" style="font-size:11px;margin-top:4px">${_slaNote}</div></div>
    <div class="field"><label>แท็ก</label><span>${t.tags.map(x=>`<span class="tag">${x}</span>`).join('')||'-'}</span></div>

    <div class="field"><label>งานย่อย / มอบต่อ (Delegation) — คลิกเพื่อเปลี่ยนสถานะงานย่อย</label>
      ${(t.sub||[]).map((s,i)=>`<div class="sub-item" ${edit?`onclick="toggleSub('${t.id}',${i})" title="คลิกเพื่อเปลี่ยนสถานะ"`:''}><span class="mini" style="background:${u(s.who).c}">${u(s.who).s}</span><div style="flex:1">${s.t} <span class="muted" style="font-size:11px">· ${shortName(s.who)}</span></div>${statusPill(s.st)}${edit?'<span class="cyc">↻ เปลี่ยน</span>':''}</div>`).join('')||'<div class="muted" style="font-size:12px">ยังไม่มีงานย่อย</div>'}
      ${edit?`<div style="display:flex;gap:6px;margin-top:8px">
        <input class="fin" id="subName" placeholder="ชื่องานย่อยที่มอบต่อ" style="flex:1">
        <select class="fin" id="subWho" style="width:110px">${assigneeOptions(t.assignee)}</select>
        <button class="tbtn" onclick="addSub('${t.id}')">+ มอบต่อ</button></div>`:''}</div>

    ${sop?`<div class="field"><label>SOP ที่ผูกกับงานนี้ — ${sop.title}</label>
      ${sop.steps.slice(0,4).map((s,i)=>`<div class="step"><span class="n">${i+1}</span>${s}</div>`).join('')}
      <a style="font-size:11.5px;color:var(--blue-700);cursor:pointer" onclick="openSOP('${sop.id}')">ดู SOP เต็ม →</a></div>`:''}

    ${t.solution?`<div class="field"><label>✅ วิธีแก้ปัญหา (บันทึกลงคลังความรู้แล้ว)</label><div class="ai-note">${t.solution}</div></div>`:
      `<div class="field"><label>วิธีแก้ปัญหา / ผลการดำเนินงาน</label><textarea id="solIn" rows="2" placeholder="พิมพ์วิธีแก้ แล้วกด 'อนุมัติ/ปิดงาน' → ระบบเก็บเข้าคลังความรู้อัตโนมัติ"></textarea></div>`}
    <div style="display:flex;gap:8px;margin-top:2px;flex-wrap:wrap">
      ${!t.solution?`<button class="tbtn" onclick="saveSolution('${t.id}')">${sic('i-save')} บันทึกวิธีแก้</button>`:''}
      ${edit&&t.status!=='done'?`<button class="tbtn primary" style="background:var(--green);border-color:var(--green)" onclick="closeTaskWithSolution('${t.id}')">✓ อนุมัติ/ปิดงาน</button>`:''}
      ${edit&&t.status==='done'?`<button class="tbtn" onclick="setTaskStatus('${t.id}','doing')">↩ เปิดงานใหม่</button>`:''}</div>

    <div class="field" style="margin-top:14px"><label>ความเคลื่อนไหว / ความคิดเห็น</label>
      <div style="display:flex;gap:6px;margin-bottom:8px"><input class="fin" id="cmtIn" placeholder="เขียนความคิดเห็น..." style="flex:1" onkeydown="if(event.key==='Enter')addComment('${t.id}')"><button class="tbtn" onclick="addComment('${t.id}')">ส่ง</button></div>
      ${(t.log||[]).map(l=>`<div class="logline"><span class="mini" style="background:${u(l.who).c}">${u(l.who).s}</span><div><b style="font-weight:500;font-size:12px">${shortName(l.who)}</b> <span class="muted" style="font-size:11px">· ${l.time}</span><div style="font-size:12px">${l.txt}</div></div></div>`).join('')||'<div class="muted" style="font-size:12px">ยังไม่มีความเคลื่อนไหว</div>'}</div>
  </div>`);
}
function openDoc(id){const d=DOCS.find(x=>x.id===id);if(!d)return;
  showModal(`<div class="modal-h"><div><span class="pill" style="background:var(--blue-800)">ระเบียบ · ${d.rev}</span><h3 style="margin-top:6px">${d.title}</h3><div class="muted" style="font-size:11.5px">${d.en} · หน่วยงานเจ้าของ: ${d.owner}</div></div><button class="x" onclick="closeModal()">×</button></div>
  <div class="pad">${d.sections.map(s=>`<div class="field"><label style="font-size:12.5px;color:var(--blue-700);font-weight:500">${s.h}</label>${s.items.map(it=>`<div class="step"><span style="color:var(--blue-500);font-weight:700">•</span><div style="flex:1">${it}</div></div>`).join('')}</div>`).join('')}
  <div class="ai-note">${sic('i-doc')} เอกสารต้นฉบับ: <b>ระเบียบการประชุมติดตามผลประจำเดือน.pdf</b> — เก็บใน โฟลเดอร์ บริษัท/รายงานเพิ่มเติม/08.08.2026</div></div>`);}
const auditXbReference = {id:"SOP-AXB",dept:"AUDXB",title:"Workflow ออดิทระบบ XB",v:"1.0",goal:"ตรวจบัญชีฝาก-ถอนให้สัมพันธ์กันระหว่าง STM และ BO, ค้นหาความผิดปกติ, รวบรวมความเสียหาย (ระบบ XB)",duties:["ตรวจบัญชีฝาก-ถอนของทุกบริษัทในเครือ (ระบบ XB)", "ตรวจความสัมพันธ์รายการ STM กับ BO/หน้าหลังบ้าน", "ค้นหารายการผิดปกติ + ส่งหัวหน้าแอดมินชี้แจงพร้อมหลักฐาน", "บันทึกความเสียหายจากการทำงานของพนักงาน", "สรุปยอดความเสียหายรายเดือนส่งการเงิน/บุคคล"],steps:["รับไฟล์ประจำวันจาก E-mail: STM ฝาก-ถอน, ไฟล์ชี้แจง, BO", "ตรวจความครบถ้วน: STM Copy ลง Excel ได้ + BO ถูกต้อง", "จัด STM/BO เรียงเวลาให้ตรงกัน แยกยอดรับเข้า/โอนออก", "เทียบรายการฝาก-ถอนและยอดรวม STM กับ BO", "หายอดไม่ตรง + ตรวจ Note/ไฟล์ชี้แจง", "ขอชี้แจง + หลักฐานตามขั้นตอน (Exception Handling)", "บันทึกความเสียหาย → ตรวจทาน → สรุปรายเดือน (มี AI ช่วยวิเคราะห์ความเสี่ยง)"],tools:["Excel", "E-mail (รับไฟล์ STM/BO/ชี้แจง)", "BO / หน้าหลังบ้าน", "ระบบ PM: AZPAY, 12PAY, ATP, MYPAY"],issues:["บางบัญชีใช้ทั้งฝากและถอนในบัญชีเดียว → แยกยอดโอนเข้า/ออกก่อนเทียบ BO", "ATP/MYPAY ต้องกรอง “ซอยยอดถอนที่ PM ตีกลับ” ออกก่อนตรวจ", "ยอดข้ามวัน 23:58–23:59 → ตรวจวัน/เวลาละเอียด", "ถอน USDT / ยืมเงินระหว่างบริษัท → ต้องมีไฟล์ชี้แจง", "STM/BO ผิดบริษัทหรือไม่ครบ → ขอใหม่ทันที"],ai:["ช่วยค้นหายอดไม่ตรง", "วิเคราะห์ความเสี่ยงการทุจริต + แนวโน้มข้อผิดพลาด", "Dashboard เปรียบเทียบความเสียหายรายเดือน/ไตรมาส/ปี", "แสดง % การเปลี่ยนแปลง", "⚠️ คนอนุมัติ: ผลวิเคราะห์เรื่องทุจริต / ประเมินพนักงาน"]};
const centralAuditSop=SOPS.find(s=>s.id==="SOP-A123");
centralAuditSop.goal='ตรวจบัญชีฝาก-ถอนทุกระบบของบริษัทในเครือจากทีมออดิทส่วนกลาง โดยระบุระบบและบริษัทในแต่ละงาน พร้อมตรวจหลักฐาน ติดตามข้อผิดปกติ และสรุปความเสียหาย';
centralAuditSop.steps.push(...auditXbReference.steps.map(t=>"กรณีตรวจระบบ XB: "+t));
centralAuditSop.issues.push(...auditXbReference.issues);
const programmerSop=SOPS.find(s=>s.id==='SOP-PROG');
programmerSop.collaboration=[
 'BA/PO/Requester: ยืนยัน Requirement, Business Rule, Acceptance Criteria และ Change Request; Programmer วิเคราะห์ทางเทคนิคและประเมินผลกระทบ',
 'QA/UAT: Programmer ส่ง Test Note/Test Data/Known Limitation และแก้ Defect; QA ทดสอบอิสระและ Business ยืนยันการใช้งาน',
 'DevOps/Infrastructure: Programmer เตรียม Build, Migration, Config, Dependency และ Rollback; DevOps ดูแล Environment/Deploy; Programmer ทำ Smoke Test',
 'Support/Operation: ระบุเวลา ผู้ใช้ ขั้นตอน ภาพและ Impact; Programmer Reproduce และแยก Code/Data/Config/Infra/Requirement ก่อนส่งต่อ Owner',
 'Data/BI/Business: ยืนยัน Metric, Source, Date Range, Timezone, Filter และ Expected Result; Programmer ตรวจ Query/ยอด/Performance/Export',
 'Marketing/Web: ให้ Content, Domain, Account และ Requirement; Programmer แก้ Code/Integration ในขอบเขต และผู้ขอยืนยันผล'
];
programmerSop.scopeNote='KPI 10 ข้อ: งานที่รับผิดชอบเอง 70% / งานร่วม 30% · Achievement = Actual ÷ Target สูงสุด 120% · คะแนนรวม ≥100 ยอดเยี่ยม, ≥90 ดีเยี่ยม, ≥80 ดีมาก, ≥70 ดี, ≥60 พอใช้ · เวลารอหน่วยงานอื่นต้องบันทึก Blocker และหลักฐานแจ้งผู้เกี่ยวข้อง ให้ผู้รับรองตรวจการยกเว้น · SLA ต้องตกลงตามนโยบายบริษัท';
function openSOP(id){
  const s=SOPS.find(x=>x.id===(id==='SOP-AXB'?'SOP-A123':id));if(!s)return;
  const sec=(label,ic,arr)=>arr&&arr.length?`<div class="field"><label>${sic(ic)} ${label}</label>${arr.map(x=>`<div class="step2">${x}</div>`).join('')}</div>`:'';
  showModal(`<div class="modal-h"><div><div style="margin-bottom:6px">${deptPill(s.dept)}</div><h3>${s.title}</h3>
    <div class="muted" style="font-size:11.5px">เวอร์ชัน ${s.v} · สรุปจากเอกสาร SOP ฉบับจริง${s.dept==='PROG'?' · ต้นฉบับยังไม่ระบุวันที่เริ่มใช้':''}</div></div><button class="x" onclick="closeModal()">×</button></div>
    <div class="pad">
    ${s.goal?`<div class="ai-note" style="margin-bottom:12px">${sic('i-target')} <b>เป้าหมาย:</b> ${s.goal}</div>`:''}
    ${sec('หน้าที่หลัก','i-clipboard',s.duties)}
    <div class="field"><label>${sic('i-board')} ขั้นตอนการทำงาน (Workflow)</label>
    ${s.steps.map((st,i)=>`<div class="step"><span class="n">${i+1}</span><div style="flex:1">${st}</div></div>`).join('')}</div>
    ${sec('การทำงานร่วมกับส่วนงานอื่น','i-users',s.collaboration)}
    ${s.scopeNote?`<p class="ai-note">${esc(s.scopeNote)}</p>`:''}
    ${sec('เครื่องมือที่ใช้','i-briefcase',s.tools)}
    ${sec('จุดผิดพลาด / ปัญหาที่พบ → วิธีแก้','i-warning',s.issues)}
    ${sec('AI / Automation ช่วยได้','i-sparkle',s.ai)}
    <div class="ai-note">เปิดงานจริง → แท็ก KPI ที่เกี่ยวข้อง → แนบผลและหลักฐานตาม SOP → ให้หัวหน้าตรวจรับรองผลรายเดือน จำนวนแท็กไม่ใช่คะแนน KPI</div></div>`);
}
function openKB(id){
  const k=KB.find(x=>x.id===id);if(!k)return;
  showModal(`<div class="modal-h"><div><div style="margin-bottom:6px">${deptPill(k.dept)}</div><h3>${k.title}</h3>
    <div class="muted" style="font-size:11.5px">${k.id} · สร้างจากงาน ${k.from}</div></div><button class="x" onclick="closeModal()">×</button></div>
    <div class="pad"><div class="field"><label>ปัญหา</label><div class="v">${k.problem}</div></div>
    <div class="field"><label>✅ วิธีแก้</label><div class="ai-note">${k.solution}</div></div>
    <div class="field"><label>แท็ก</label>${k.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div></div>`);
}
function openCompose(){
  const manageable=canAdminAccess()?visibleDepartmentCodes():MANAGE_DEPTS;
  if(CLOUD&&!manageable.length){toast('บัญชีนี้ดูงานได้ แต่ไม่มีสิทธิ์สร้างงาน กรุณาให้ผู้ดูแลเพิ่มสิทธิ์ “จัดการแผนก”','info');return;}
  const defDept=isExecutiveRole()?(manageable.includes('GRAPHIC')?'GRAPHIC':manageable[0]):(MANAGE_DEPTS.includes(currentDept())?currentDept():manageable[0]);
  showModal(`<div class="modal-h"><div><h3>${sic('i-sparkle')} สร้างงานด้วย AI</h3><div class="muted" style="font-size:11.5px">พิมพ์สั้น ๆ AI จะจัดรูปให้อ่านง่าย แล้วกดสร้าง</div></div><button class="x" onclick="closeModal()">×</button></div>
  <div class="pad">
    <div class="field"><label>สั่งงานแบบสั้น (พิมพ์หรือพูดก็ได้)</label><textarea id="cmpIn" rows="2">ทำแบนเนอร์โปรฯ ฝากครั้งแรกให้ 3XBET ส่งศุกร์นี้</textarea></div>
    <div style="display:flex;gap:8px"><button class="tbtn" onclick="voiceDictate('cmpIn')">${sic('i-mic')} พูดใส่</button><button class="tbtn primary" onclick="aiCompose('${defDept}')">🤖 ให้ AI จัดรูปงาน</button></div>
    <div id="cmpOut" style="margin-top:14px"></div></div>`);
}
function aiCompose(defDept){
  const raw=normSp(val('cmpIn'))||'งานใหม่';
  const a=analyzeCommand(raw); if(defDept&&!/แบนเนอร์|ออกแบบ|โทร|คอนเทนต์|เบิก|แชท|ตรวจ/.test(raw.toLowerCase()))a.dept=defDept;
  PICK=new Set([a.assignee]);PICK_QUERY='';PICK_DEPT=a.dept;PICK_POSITION='';
  document.getElementById('cmpOut').innerHTML=`
    <div class="ai-note"><b>${sic('i-chat')} AI วิเคราะห์ให้แล้ว:</b> แผนก <b>${deptName(a.dept)}</b> · ความสำคัญ <b>${PRIO[a.prio].t}</b> · กำหนดส่ง <b>${fmtDate(a.due)}</b> · แนะนำ <b>${shortName(a.assignee)}</b> (ว่างสุดในทีม)</div>
    <div class="two" style="margin-top:12px">
      <div class="field"><label>หัวข้องาน</label><input class="fin" id="f_title" value="${a.title}"></div>
      <div class="field"><label>แผนก</label><select class="fin" id="f_dept">${deptOptions(a.dept)}</select></div></div>
    <div class="field"><label>รายละเอียด</label><textarea class="fin" id="f_desc" rows="2">${a.desc}</textarea></div>
    <div class="two">
      <div class="field"><label>ความสำคัญ</label><select class="fin" id="f_prio">${Object.keys(PRIO).map(pk=>`<option value="${pk}" ${a.prio===pk?'selected':''}>${PRIO[pk].t}</option>`).join('')}</select></div>
      <div class="field"><label>กำหนดส่ง</label><input type="date" class="fin" id="f_due" value="${d2(a.due)}"></div></div>
    <div class="field"><label>ระยะเวลาดำเนินการ (SLA) — ต้องเสร็จภายใน</label><div style="display:flex;gap:6px"><input type="number" min="1" class="fin" id="f_sla_n" value="${a.sla.n}" style="max-width:90px"><select class="fin" id="f_sla_u" style="max-width:120px"><option value="day">วัน</option><option value="hr">ชั่วโมง</option></select></div></div>
    <div class="field"><label>ผู้รับผิดชอบ — เลือกได้หลายคน หรือกดทั้งกลุ่ม</label><div id="pickerBox"></div></div>
    <div class="field"><label>Checklist (AI แตกจาก SOP ${deptName(a.dept)})</label>${a.checklist.map((c,i)=>`<div class="step"><span class="n">${i+1}</span>${c}</div>`).join('')}</div>
    ${a.kb?`<div class="ai-note">${sic('i-chat')} เกี่ยวข้อง: SOP ${deptName(a.dept)} · บทความ ${a.kb.id} (${a.kb.title})</div>`:''}
    <button class="tbtn primary" style="margin-top:12px" onclick="submitCompose()">✓ สร้างงานนี้</button>`;
  renderPicker();
}
async function submitCompose(){
  const title=normSp(val('f_title'));if(!title){toast('กรุณาระบุหัวข้องาน','info');return;}
  if(!PICK.size){toast('กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน','info');return;}
  const due=val('f_due')||addFrom(TODAY_ISO,5);const assignees=[...PICK];
  const sla={n:Math.max(1,parseInt(val('f_sla_n'))||1),unit:val('f_sla_u')||'day'};
  try{const t=await createTask({title,dept:val('f_dept'),assignees,prio:val('f_prio'),due,sla,desc:val('f_desc'),tags:['งานใหม่']});
    closeModal();F.dept='';go('board');toast('สร้างงาน '+t.id+' ให้ '+assignees.length+' คน (ส่ง '+fmtDate(due)+')');
  }catch(e){toast('สร้างงานไม่สำเร็จ · '+(e.message||e),'info');}
}

/* ===== Persistence (localStorage) ===== */
const LS_KEY='companyhub_state_v1';
const SEED_VERSION=2;
/* KPI Actual รายเดือน (เฉพาะทีมที่มี Target) */
function kpiActuals(){const o={};Object.keys(KPI).forEach(c=>{if(KPI[c].some(k=>k.tgt!=null))o[c]=KPI[c].map(k=>k.tgt!=null?k.ac:null);});return o;}
function applyKpiActuals(o){if(!o)return;Object.keys(o).forEach(c=>{if(KPI[c])o[c].forEach((v,i)=>{if(v!=null&&KPI[c][i]&&KPI[c][i].tgt!=null)KPI[c][i].ac=v;});});}
/* Production stores department data in normalized RLS tables.  The shared
   object is version metadata only, never tasks, KPI, announcements or KB. */
function stateBlob(){return {V:SEED_VERSION};}
function applyStateObject(s){if(!s)return;
  if(!CLOUD){
    if(s.TASKS){TASKS.length=0;TASKS.push(...s.TASKS);}if(s.KB){KB.length=0;KB.push(...s.KB);}
    if(s.ANN){ANN.length=0;ANN.push(...s.ANN);}if(s.GROUPS){GROUPS.length=0;GROUPS.push(...s.GROUPS);}
    if(typeof s.ANN_SEQ==='number')ANN_SEQ=s.ANN_SEQ;if(s.REPORT_EDITS)REPORT_EDITS=s.REPORT_EDITS;if(Array.isArray(s.CARRIED))CARRIED=s.CARRIED;
    applyKpiActuals(s.KPI_ACT);recalcKPI();
  }}
function saveState(){var blob=stateBlob();
  try{localStorage.setItem(LS_KEY,JSON.stringify(blob));}catch(e){}
  /* Production writes go to normalized tables only. */}
function loadState(){try{var s=JSON.parse(localStorage.getItem(LS_KEY)||'null');applyStateObject(s);}catch(e){}}

/* ===== Supabase (ฐานข้อมูลกลาง + ล็อกอิน) ===== */
const SUPA_URL='https://mfvbggjwqgeaoezlgiqo.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mdmJnZ2p3cWdlYW9lemxnaXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2ODMxNDYsImV4cCI6MjEwMjI1OTE0Nn0.1Oo8hhqdxJ97j5N6bQBXNsdaeurnq7-QJv_atikNeYs';
let SB=null,CLOUD=false,SB_UID=null,_sbSaveT=null,_sbApplying=false,_cloudStarted=false;
function cloudEnabled(){return !!(SUPA_URL&&SUPA_KEY&&window.supabase&&window.supabase.createClient);}
let LOGIN_PREVIOUS_FOCUS=null;
function loginBackground(active){
  for(const node of [document.querySelector('.app'),document.getElementById('overlay'),document.querySelector('.talk-fab'),document.querySelector('.help-win')].filter(Boolean)){
    if(active){node.inert=true;node.setAttribute('aria-hidden','true');}
    else{node.inert=false;node.removeAttribute('aria-hidden');}
  }
  document.body.classList.toggle('login-open',active);
}
function loginFocusable(root){return [...root.querySelectorAll('input:not([hidden]):not([disabled]),select:not([hidden]):not([disabled]),button:not([hidden]):not([disabled]),a[href],[tabindex="0"]')].filter(node=>node.getClientRects().length);}
function prepareLoginDialog(root){
  if(root.dataset.a11yReady)return;root.dataset.a11yReady='true';
  root.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const items=loginFocusable(root),first=items[0],last=items.at(-1);if(!first){event.preventDefault();root.focus();return;}
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===root)){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
}
function showLogin(){var l=document.getElementById('loginBg');if(!l)return;prepareLoginDialog(l);if(l.style.display==='none')LOGIN_PREVIOUS_FOCUS=document.activeElement;l.style.display='flex';loginBackground(true);requestAnimationFrame(()=>{const preferred=l.querySelector('#sbEmail:not([hidden]),input:not([hidden]),select:not([hidden]),button:not([hidden])');preferred?.focus({preventScroll:true});});}
function hideLogin(){var l=document.getElementById('loginBg');if(!l)return;l.style.display='none';loginBackground(false);if(LOGIN_PREVIOUS_FOCUS?.isConnected)LOGIN_PREVIOUS_FOCUS.focus({preventScroll:true});LOGIN_PREVIOUS_FOCUS=null;}
function setLoginBusy(busy,label='กำลังเข้าสู่ระบบ…'){
  const button=document.getElementById('sbLoginBtn');if(!button)return;
  if(busy){button.dataset.idleLabel=button.textContent;button.dataset.busyLabel=label;button.textContent=label;button.disabled=true;button.setAttribute('aria-busy','true');}
  else{if(button.textContent===button.dataset.busyLabel)button.textContent=button.dataset.idleLabel||'เข้าสู่ระบบ';button.disabled=false;button.removeAttribute('aria-busy');delete button.dataset.busyLabel;}
}
async function sbInit(){
  if(!cloudEnabled()){
    showLogin();
    const er=document.getElementById('sbErr');if(er)er.textContent='ยังเชื่อมต่อ Supabase ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วโหลดหน้าใหม่';
    return;                                    /* Production fail-closed: ห้ามเปิดข้อมูล local/demo */
  }
  try{
    SB=window.supabase.createClient(SUPA_URL,SUPA_KEY);
    showLogin();  /* แสดงหน้าล็อกอินทันที กันไม่ให้เข้าถึงระบบก่อนยืนยันตัวตน */
    SB.auth.onAuthStateChange(function(_e,sess){ if(sess&&sess.user) onLoggedIn(sess); });
    var r=await SB.auth.getSession();
    if(r&&r.data&&r.data.session){ onLoggedIn(r.data.session); } else { showLogin(); }
  }catch(e){ console.warn('supabase init',e); }
}
async function onLoggedIn(session){
  if(_cloudStarted)return false; _cloudStarted=true;
  CLOUD=true; SB_UID=(session.user&&(session.user.email||session.user.id))||'user';
  const accessOk=await loadAuthenticatedProfile(session);
  if(!accessOk){_cloudStarted=false;CLOUD=false;SB_UID=null;return false;}
  hideLogin();
  var lo=document.getElementById('logoutBtn'); if(lo)lo.style.display='flex';
  await Promise.all([cloudLoad(),canViewDept('GRAPHIC')?loadGraphic():Promise.resolve()]);
  try{ SB.channel('ch_state').on('postgres_changes',{event:'*',schema:'public',table:'company_hub_state',filter:'id=eq.main'},function(p){
    if(p&&p.new&&p.new.data&&p.new.updated_by!==SB_UID){ _sbApplying=true; try{applyStateObject(p.new.data);}finally{_sbApplying=false;} refresh(); }
  }).subscribe(); }catch(e){}
  try{let graphicT;const reloadGraphic=()=>{clearTimeout(graphicT);graphicT=setTimeout(loadGraphic,350);};SB.channel('ch_graphic').on('postgres_changes',{event:'*',schema:'public',table:'graphic_jobs'},reloadGraphic).on('postgres_changes',{event:'*',schema:'public',table:'graphic_job_files'},reloadGraphic).on('postgres_changes',{event:'*',schema:'public',table:'graphic_job_checklist_items'},reloadGraphic).subscribe();}catch(e){}
  try{let actionT;const reloadActions=()=>{clearTimeout(actionT);actionT=setTimeout(async()=>{await cloudLoadImplementationActions();if(VIEW==='tracker')RENDER.tracker();else if(VIEW==='dash')RENDER.dash();else if(VIEW==='reports')RENDER.reports();else if(VIEW==='monthly')RENDER.monthly();},350);};SB.channel('ch_actions').on('postgres_changes',{event:'*',schema:'public',table:'implementation_actions'},reloadActions).subscribe();}catch(e){}
  buildNav(); refresh();
  toast('เชื่อมฐานข้อมูลกลางแล้ว · เข้าสู่ระบบ: '+SB_UID);
  return true;
}
async function loadAuthenticatedProfile(session){
  try{
    const [profile,departments]=await Promise.all([
      SB.from('profiles').select('id,email,display_name,position_title,role,department_code,active').eq('id',session.user.id).maybeSingle(),
      SB.from('profile_departments').select('department_code,can_manage').eq('profile_id',session.user.id)
    ]);
    if(profile.error)throw profile.error;
    if(!profile.data)throw new Error('บัญชีนี้ยังไม่ได้รับสิทธิ์ Company Hub');
    ACCESS_PROFILE=profile.data;
    if(!ACCESS_PROFILE.active)throw new Error('บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
    AUTH_DB_ROLE=ACCESS_PROFILE.role||'staff';
    VISIBLE_DEPTS=(departments.data||[]).map(x=>x.department_code);
    MANAGE_DEPTS=(departments.data||[]).filter(x=>x.can_manage).map(x=>x.department_code);
    ROLE=isExecutiveRole()?'exec':AUTH_DB_ROLE==='lead'?'lead':'staff';
    if(ROLE_META[ROLE])ROLE_META[ROLE].dept=ACCESS_PROFILE.department_code||'';
    const label=AUTH_DB_ROLE==='admin'?'ผู้ดูแลระบบ':AUTH_DB_ROLE==='exec'?'ผู้บริหาร':AUTH_DB_ROLE==='lead'?'หัวหน้างาน':'พนักงาน';
    sideName.textContent=ACCESS_PROFILE.display_name||ACCESS_PROFILE.email||SB_UID;
    sideRole.textContent=label+(ACCESS_PROFILE.department_code?' — '+deptName(ACCESS_PROFILE.department_code):'');
    sideAvatar.textContent=(ACCESS_PROFILE.display_name||ACCESS_PROFILE.email||'U').slice(0,1).toUpperCase();
    topAvatar.textContent=sideAvatar.textContent;
    return true;
  }catch(e){console.warn('profile load:',e.message||e);ACCESS_PROFILE=null;AUTH_DB_ROLE='staff';VISIBLE_DEPTS=[];MANAGE_DEPTS=[];try{await SB.auth.signOut();}catch(_e){}showLogin();toast(e.message||'ไม่สามารถตรวจสอบสิทธิ์ได้','info');return false;}
}
async function cloudLoad(){
  try{
    TASKS.length=0;KB.length=0;ANN.length=0;GROUPS.length=0;FEED.length=0;
    const loaders=[cloudLoadTasks(),cloudLoadKnowledge(),cloudLoadAnnouncements(),cloudLoadKpis(),cloudLoadIssues(),cloudLoadImplementationActions()];
    if(canAdminAccess())loaders.push((async()=>{const res=await SB.from('company_hub_state').select('data').eq('id','main').maybeSingle();if(res.error)console.warn('cloud metadata:',res.error.message);})());
    await Promise.all(loaders);
  }catch(e){console.warn(e);}
}
async function cloudLoadAnnouncements(){
  if(!SB)return;ANN.length=0;
  try{
    const [ann,recipients,comments]=await Promise.all([
      integrityReadAll(()=>SB.from('announcements').select('id,creator_id,title,body,starts_on,ends_on,pinned,created_at'),["id"]),
      integrityReadAll(()=>SB.from('announcement_recipients').select('announcement_id,profile_id,acknowledged_at'),["announcement_id", "profile_id"]),
      integrityReadAll(()=>SB.from('announcement_comments').select('announcement_id,author_id,body,created_at'),["id"]),
    ]);
    if(ann.error)throw ann.error;if(recipients.error)throw recipients.error;if(comments.error)throw comments.error;
    const recBy=new Map(),ackBy=new Map(),commentBy=new Map();
    if(!recipients.error)(recipients.data||[]).forEach(x=>{if(!recBy.has(x.announcement_id))recBy.set(x.announcement_id,[]);recBy.get(x.announcement_id).push(x.profile_id);if(x.acknowledged_at){if(!ackBy.has(x.announcement_id))ackBy.set(x.announcement_id,[]);ackBy.get(x.announcement_id).push(x.profile_id);}});
    if(!comments.error)(comments.data||[]).sort((a,b)=>a.created_at.localeCompare(b.created_at)).forEach(x=>{if(!commentBy.has(x.announcement_id))commentBy.set(x.announcement_id,[]);commentBy.get(x.announcement_id).push({who:x.author_id,text:x.body,time:new Date(x.created_at).toLocaleString('th-TH',{timeZone:ORG_TIMEZONE,dateStyle:'short',timeStyle:'short'})});});
    (ann.data||[]).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.created_at.localeCompare(a.created_at)).forEach(x=>{const audienceIds=recBy.get(x.id)||[];ANN.push({id:x.id,dbId:x.id,who:x.creator_id,pin:x.pinned,title:x.title,body:x.body,time:new Date(x.created_at).toLocaleString('th-TH',{timeZone:ORG_TIMEZONE,dateStyle:'short',timeStyle:'short'}),audience:audienceIds.length?audienceIds.map(shortName).join(', '):'ทั้งบริษัท',from:x.starts_on,until:x.ends_on||'',audienceIds,acks:ackBy.get(x.id)||[],comments:commentBy.get(x.id)||[]});});
  }catch(e){console.warn('announcement load:',e.message||e);throw e;}
}
async function cloudLoadKnowledge(){
  if(!SB)return;KB.length=0;
  try{const r=await SB.from('knowledge_articles').select('id,source_task_id,department_code,title,problem,solution,status,prototype_payload,created_at,updated_at').order('updated_at',{ascending:false});if(r.error)throw r.error;(r.data||[]).forEach((x,i)=>KB.push({id:'KB-'+String(i+1).padStart(3,'0'),dbId:x.id,dept:x.department_code,title:x.title,problem:x.problem||'',solution:x.solution||'',from:x.source_task_id||'',tags:Array.isArray(x.prototype_payload?.tags)?x.prototype_payload.tags:[],status:x.status}));}catch(e){console.warn('knowledge load:',e.message||e);throw e;}
}
async function cloudLoadTasks(){
  if(!SB)return;
  TASKS_READY=false;TASKS.length=0;TASK_PROFILES.length=0;
  try{
    const [tasks,assignments,profiles,timeEntries,comments,people]=await Promise.all([
      integrityReadAll(()=>SB.from('tasks').select('id,task_no,department_code,title,description,status,priority,creator_id,start_at,due_at,sla_minutes,closed_at,prototype_payload,created_at,updated_at'),["id"]),
      integrityReadAll(()=>SB.from('task_assignees').select('task_id,user_id,assigned_at'),["task_id", "user_id"]),
      integrityReadAll(()=>SB.from('profiles').select('id,email,display_name,position_title,role,department_code,active').eq('active',true),["id"]),
      integrityReadAll(()=>SB.from('time_entries').select('task_id,user_id,minutes,note,created_at'),["id"]),
      integrityReadAll(()=>SB.from('task_comments').select('task_id,author_id,body,created_at'),["id"]),
      SB.rpc('activity_entry_people'),
    ]);
    if(timeEntries.error)throw timeEntries.error;if(comments.error)throw comments.error;if(tasks.error)throw tasks.error;if(assignments.error)throw assignments.error;if(profiles.error)throw profiles.error;
    if(people.error)throw people.error;
    const directory=new Map((profiles.data||[]).map(p=>[p.id,{...p,department_codes:[p.department_code]}]));
    for(const p of people.data||[]){const existing=directory.get(p.id)||{...p,active:true,department_codes:[]};existing.department_codes=[...new Set([...existing.department_codes,p.department_code])];directory.set(p.id,existing);}
    TASK_PROFILES.push(...directory.values());
    TASK_PROFILES.forEach((p,i)=>{const name=p.display_name||p.email||'ผู้ใช้',colors=['#2563eb','#0f766e','#7c3aed','#c2410c','#be185d','#0369a1'];USERS[p.id]={n:name,s:name.slice(0,1).toUpperCase(),c:colors[i%colors.length]};});
    ASSIGNABLE=TASK_PROFILES.filter(p=>canAdminAccess()||(p.department_codes||[p.department_code]).some(d=>MANAGE_DEPTS.includes(d))||p.id===ACCESS_PROFILE?.id).map(p=>p.id);
    const byTask=new Map();(assignments.data||[]).forEach(a=>{if(!byTask.has(a.task_id))byTask.set(a.task_id,[]);byTask.get(a.task_id).push(a.user_id);});
    const spent=new Map();if(!timeEntries.error)(timeEntries.data||[]).forEach(x=>spent.set(x.task_id,(spent.get(x.task_id)||0)+Number(x.minutes||0)));
    const taskLog=new Map();if(!comments.error)(comments.data||[]).forEach(x=>{if(!taskLog.has(x.task_id))taskLog.set(x.task_id,[]);taskLog.get(x.task_id).push({who:x.author_id,txt:x.body,time:new Date(x.created_at).toLocaleString('th-TH',{timeZone:ORG_TIMEZONE,dateStyle:'short',timeStyle:'short'})});});
    (tasks.data||[]).forEach(row=>{const people=byTask.get(row.id)||[],payload=row.prototype_payload||{},start=row.start_at?String(row.start_at).slice(0,10):'',due=row.due_at?String(row.due_at).slice(0,10):'';TASKS.push({id:'T-'+row.task_no,dbId:row.id,dept:row.department_code,title:row.title,creator:row.creator_id,assignee:people[0]||'',assignees:people,status:row.status,prio:row.priority,createdAt:row.created_at,startAt:row.start_at,dueAt:row.due_at,completedAt:row.closed_at,start,due,spent:Math.round((spent.get(row.id)||0)/6)/10,ontime:!!row.closed_at&&!!row.due_at&&new Date(row.closed_at)<=new Date(row.due_at),sla:row.sla_minutes?{n:row.sla_minutes%1440===0?row.sla_minutes/1440:row.sla_minutes/60,unit:row.sla_minutes%1440===0?'day':'hr'}:null,tags:Array.isArray(payload.tags)?payload.tags:[],sop:payload.sop||sopForDept(row.department_code),desc:row.description||'',sub:Array.isArray(payload.sub)?payload.sub:[],solution:payload.solution_proposal||'',log:taskLog.get(row.id)||[],_payload:payload,_source:'task'});});
    TASKS_READY=true;
  }catch(e){console.warn('task load:',e.message||e);TASKS.length=0;TASKS_READY=false;throw e;}
}
async function cloudLoadImplementationActions(){
  if(!SB)return;
  IMPLEMENTATION_ACTIONS.length=0;SOP_RECORDS.length=0;IMPLEMENTATION_ACTIONS_READY=false;
  try{
    const [actions,sops]=await Promise.all([
      integrityReadAll(()=>SB.from('implementation_actions').select('id,title,detail,department_code,owner_label,owner_user_id,phase,start_date,due_date,status,priority,success_measure,evidence,source_document,updated_at'),["id"]),
      integrityReadAll(()=>SB.from('sops').select('id,department_code,title,status,created_at'),["id"]),
    ]);
    if(actions.error)throw actions.error;if(sops.error)throw sops.error;
    IMPLEMENTATION_ACTIONS.push(...(actions.data||[]));
    if(!sops.error)SOP_RECORDS.push(...(sops.data||[]));
    IMPLEMENTATION_ACTIONS_READY=true;
  }catch(e){console.warn('implementation action load:',e.message||e);throw e;}
}
let KPI_CATALOG={};
async function cloudLoadKpis(){
  KPI_CATALOG={};
  if(!SB)return;
  Object.keys(KPI).forEach(code=>delete KPI[code]);
  try{
    const [definitions,results]=await Promise.all([
      integrityReadAll(()=>SB.from('kpi_definitions').select('id,department_code,name,target,weight,formula,source,active,prototype_payload').eq('active',true),["id"]),
      integrityReadAll(()=>SB.from('kpi_results').select('definition_id,period_start,period_end,actual,status'),["id"]),
    ]);
    if(definitions.error)throw definitions.error;if(results.error)throw results.error;
    const latest=new Map();(results.data||[]).sort((a,b)=>b.period_end.localeCompare(a.period_end)).forEach(row=>{if(!latest.has(row.definition_id))latest.set(row.definition_id,row);});
    (definitions.data||[]).forEach(def=>{
      if(!DEPTS.some(d=>d.code===def.department_code))return;
      const result=latest.get(def.id),target=Number(def.target),actual=result?Number(result.actual):null,weight=Number(def.weight);
      if(!KPI_CATALOG[def.department_code])KPI_CATALOG[def.department_code]=[];
      KPI_CATALOG[def.department_code].push({id:def.id,n:def.name,tg:def.prototype_payload?.unit==='ratio'?`${Number(def.target)*100}%`:String(def.target),tgt:target,w:weight,ac:actual,pct:integrityKpiAchievement(actual,target,def.prototype_payload||{}),formula:def.formula,source:def.source,metadata:def.prototype_payload||{},period:result?`${result.period_start} – ${result.period_end}`:'ยังไม่มีผลจริง',status:result?.status||'draft'});
    });
    for(const [code,rows] of Object.entries(KPI_CATALOG)){
      if(rows.length && rows.every(k=>k.ac!==null && k.pct!==null && ['approved','locked'].includes(k.status) && k.period===rows[0].period) && Math.abs(rows.reduce((s,k)=>s+k.w,0)-1)<0.000001)KPI[code]=rows;
    }
    const accepted=Object.values(KPI).map(rows=>rows[0].period).sort();
    const newest=accepted.at(-1);for(const code of Object.keys(KPI))if(KPI[code][0].period!==newest)delete KPI[code];
  }catch(e){KPI_CATALOG={};console.warn('kpi load:',e.message||e);Object.keys(KPI).forEach(code=>delete KPI[code]);throw e;}
}
async function cloudLoadIssues(){
  if(!SB)return;
  try{
    PROBLEMS.length=0;
    const baseFields='id,created_by,created_at,updated_at,department_code,occurred_at,project_code,category,problem,priority,reporter,status,owner_team,solution,resolution_minutes,root_cause,preventive_action,solution_type,solution_reference_type,solution_reference_id,solution_verified,solution_verified_by,solution_verified_at';
    const extraFields='owner_profile_id,service_name,provider_name,impact_scope,impact_summary,affected_customer_count,affected_transaction_count,financial_impact,workaround,evidence_url,acknowledged_at,resolved_at,source_sheet,source_row,data_quality_flags';
    let res;try{res=await integrityReadAll(()=>SB.from('operational_issues').select(baseFields+','+extraFields));}catch(error){if(!/column|schema cache/i.test(error.message||''))throw error;res=await integrityReadAll(()=>SB.from('operational_issues').select(baseFields));}
    if(res.error)throw res.error;
    if(!res.data||!res.data.length){PROB_SRC.file='Supabase · operational_issues';PROB_SRC.asof='ไม่มีข้อมูลตามสิทธิ์';PROB_SRC.n=0;return;}
    const bangkokDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'});
    const bangkokTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    const rows=res.data.map(r=>{const at=new Date(r.occurred_at);return {
      id:r.id,dept:r.department_code||'',ownerProfileId:r.owner_profile_id||null,createdBy:r.created_by,createdAt:r.created_at,updatedAt:r.updated_at,date:bangkokDate.format(at),time:bangkokTime.format(at),project:r.project_code,cat:r.category,problem:r.problem,prio:r.priority,reporter:r.reporter,status:r.status,owner:r.owner_team,solution:r.solution,resmin:r.resolution_minutes==null?null:Number(r.resolution_minutes),rootCause:r.root_cause||'',preventive:r.preventive_action||'',solutionType:r.solution_type||'',referenceType:r.solution_reference_type||'',referenceId:r.solution_reference_id||'',verified:!!r.solution_verified,verifiedBy:r.solution_verified_by||'',verifiedAt:r.solution_verified_at||'',service:r.service_name||'',provider:r.provider_name||'',impactScope:r.impact_scope||'unknown',impact:r.impact_summary||'',affectedCustomers:r.affected_customer_count==null?null:Number(r.affected_customer_count),affectedTransactions:r.affected_transaction_count==null?null:Number(r.affected_transaction_count),financialImpact:r.financial_impact==null?null:Number(r.financial_impact),workaround:r.workaround||'',evidenceUrl:r.evidence_url||'',acknowledgedAt:r.acknowledged_at||'',resolvedAt:r.resolved_at||'',sourceSheet:r.source_sheet||'',sourceRow:r.source_row||null,qualityFlags:r.data_quality_flags||[]
    };});
    PROBLEMS.length=0;PROBLEMS.push(...rows);PROB_SRC.file='Supabase · operational_issues';PROB_SRC.asof='อัปเดตจากฐานข้อมูลกลาง';PROB_SRC.n=rows.length;
  }catch(e){console.warn('issue load:',e.message||e);throw e;}
}
async function sbLogin(){
  if(!SB){toast('ยังเชื่อมต่อฐานข้อมูลไม่ได้','info');return;}
  var em=(val('sbEmail')||'').trim(), pw=val('sbPass')||'';
  var er=document.getElementById('sbErr'); if(er)er.textContent='';
  if(!em||!pw){if(er)er.textContent='กรุณากรอกชื่อหรืออีเมลและรหัสผ่าน';return;}
  var btn=document.getElementById('sbLoginBtn'); setLoginBusy(true);
  try{ var res=await SB.auth.signInWithPassword({email:em,password:pw});
    if(res.error){ if(er)er.textContent='เข้าสู่ระบบไม่สำเร็จ: '+res.error.message; }
  }catch(e){ if(er)er.textContent='ผิดพลาด: '+e.message; }
  setLoginBusy(false);
}
async function sbLogout(){ try{ if(SB) await SB.auth.signOut(); }catch(e){} location.reload(); }

/* ===== Theme ===== */
function applyTheme(d){document.body.classList.toggle('dark',d);const b=document.getElementById('themeBtn');if(b)b.innerHTML=`<svg class="svic"><use href="#${d?'i-sun':'i-moon'}"></use></svg>`;}
function toggleTheme(){const d=!document.body.classList.contains('dark');applyTheme(d);try{localStorage.setItem('ch_theme',d?'dark':'light');}catch(e){}}

/* ===== INIT ===== */
loadState();
recalcKPI();
try{applyTheme(localStorage.getItem('ch_theme')==='dark');}catch(e){}
try{SIMPLE=localStorage.getItem('ch_simple')==='1';}catch(e){}document.body.classList.toggle('simple',SIMPLE);
ROLE='staff';nav.innerHTML='';deptNav.innerHTML='';deptLabel.style.display='none';main.innerHTML='<div class="card pad"><b>กำลังตรวจสอบสิทธิ์บัญชี…</b><div class="muted" style="margin-top:6px">ระบบจะแสดงเฉพาะข้อมูล Production ที่บัญชีนี้ได้รับอนุญาต</div></div>';showLogin();
if(document.readyState==='complete'){sbInit();}else{window.addEventListener('load',function(){setTimeout(sbInit,0);});}

/* ==== MANUAL (images + window) ==== */
let MANUAL_IMG=null,_manualImageLoad=null;
async function loadManualImages(){
  if(MANUAL_IMG)return MANUAL_IMG;
  if(!_manualImageLoad)_manualImageLoad=fetch('manual-images.json?v=20261012-current-manual',{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('โหลดภาพคู่มือไม่สำเร็จ');return r.json();}).then(data=>(MANUAL_IMG=data));
  try{return await _manualImageLoad;}catch(error){console.warn(error);MANUAL_IMG={};return MANUAL_IMG;}
}
const MANUAL=[
{id:'intro',ic:'i-briefcase',tt:'ภาพรวม & บทบาทผู้ใช้',img:null,html:`<p>Company Hub คือศูนย์รวมงานองค์กร รวม Graphic Production · Daily Activity · ปัญหาหน้างาน · รายงาน ไว้ที่เดียว</p><ol><li><b>สิทธิ์มาจากบัญชีจริง</b>: พนักงาน · หัวหน้างาน · ผู้บริหาร · ผู้ดูแลระบบ ผู้ใช้ไม่สามารถสลับ Role เอง</li><li>เมนูและรายชื่อแผนกจะแสดงเฉพาะสิทธิ์ที่ผู้ดูแลกำหนด</li><li>ปุ่มขวาบน: พูดสั่ง · เพิ่มงานใหม่ · กระดิ่งแจ้งเตือน · สลับโหมดมืด · คู่มือ</li></ol>`},
{id:'loginAccess',ic:'i-check',tt:'เข้าสู่ระบบและตั้งรหัสครั้งแรก',img:null,html:`<p>ขั้นตอนก่อนเริ่มใช้งานจริงเป็นรายบุคคล</p><ol><li>กรอกชื่อผู้ใช้ Company Hub หรืออีเมลที่ลงทะเบียน หากฝ่ายการเงินใช้อีเมลร่วม ระบบจะให้เลือกชื่อก่อนกรอกรหัสผ่าน</li><li>บัญชีใหม่ต้องเปลี่ยนรหัสครั้งแรกก่อนเปิดข้อมูลงาน</li><li>เข้าใช้ได้จากทุกเครื่องโดยไม่ต้องรอผู้ดูแลอนุมัติ</li><li>เมื่อเข้าได้แล้ว ให้เปิด <b>บัญชีของฉัน</b> เพื่อตรวจชื่อ แผนก ตำแหน่ง และสิทธิ์</li></ol>`},
{id:'account',ic:'i-user',tt:'บัญชีของฉัน',img:'account',html:`<p>ตรวจสอบข้อมูลตัวตน แผนก ตำแหน่ง สิทธิ์ และวิธีเข้าสู่ระบบของตนเองได้จากหน้าเดียว</p><ol><li>ส่วนบนแสดง <b>ชื่อ สถานะ แผนกหลัก ตำแหน่ง และสิทธิ์</b> ที่ระบบใช้จริง</li><li>บัญชีชื่อผู้ใช้ Company Hub แก้ชื่อและอีเมลติดต่อ รวมถึงเปลี่ยนรหัสผ่านของตนเองได้</li><li>บัญชีอีเมลเดิมใช้ข้อมูลล็อกอินเดิม หากต้องแก้ชื่อ อีเมล รหัสผ่าน หรือแผนก ให้ติดต่อผู้ดูแลเพื่อตรวจสอบตัวตน</li><li>การแก้ข้อมูลบัญชีไม่ลบงานหรือประวัติ เพราะรายการเดิมผูกกับรหัสบัญชีภายใน</li></ol>`},
{id:'teamAccounts',ic:'i-users',tt:'บัญชีทีม (ผู้ดูแล)',img:'teamAccounts',html:`<p>ผู้ดูแลจัดการพนักงานแบบตาราง แบ่งตามแผนกเพื่อค้นหาและตรวจสอบได้ง่าย</p><ol><li>ดูจำนวนบัญชีทั้งหมด เปิดใช้งาน พร้อมเข้าสู่ระบบ รอตั้งรหัส และปิดใช้งาน โดยแยกความหมายชัดเจน</li><li>แผงความพร้อมแสดงครบ 14 แผนก แผนกที่ยังไม่มีบัญชีจะแสดง 0 และกดกรองได้</li><li>ส่งออกรายชื่อผู้รอตั้งรหัสเป็น CSV เพื่อติดตามการเปิดใช้งาน</li><li>หนึ่งคนอยู่ได้หลายแผนก ป้ายแผนกทั้งหมดจะแสดงในแถวเดียวกัน</li><li>กดป้ายสถานะหรือ <b>ข้อมูล / สถานะ</b> เพื่อแก้อีเมล เปิดหรือปิดบัญชี ปรับตำแหน่งและสิทธิ์ ประวัติงานเดิมจะไม่ถูกลบ</li><li>อีเมลเดียวใช้ร่วมกันได้หลายชื่อ ระบบจะให้เลือกชื่อก่อนกรอกรหัสผ่าน</li><li><b>พร้อมใช้/รอตั้งรหัส</b> เปลี่ยนตามการตั้งรหัสอัตโนมัติ หากต้องออกรหัสใหม่ให้กด <b>ออกรหัสใหม่</b> หลังยืนยันเจ้าของบัญชี</li></ol>`},
{id:'dash',ic:'i-dash',tt:'แดชบอร์ด / ภาพรวม',img:'dash',html:`<p>ภาพรวมสถานะทั้งหมดในหน้าเดียว ทุกกล่องกดเข้าไปดูต่อได้</p><ol><li><b>ไทล์สถิติด้านบน</b> (คะแนน KPI รวม · งานทั้งหมด · งานติดปัญหา · งานเกินกำหนด) — กดที่ไทล์เพื่อกระโดดไปดูรายการที่กรองไว้ให้</li><li><b>กราฟ</b> สัดส่วนสถานะงาน · งานตามแผนก · แนวโน้ม KPI</li><li><b>คะแนน KPI รายแผนก</b> แถบสีบอกระดับ เขียว/เหลือง/แดง</li><li><b>ต้องดำเนินการ</b> และ <b>แผนกที่ต้องจับตา</b> รวมสิ่งที่ต้องรีบดู กดเปิดได้ทันที</li></ol>`},
{id:'myTasks',ic:'i-check',tt:'งานของฉัน / พื้นที่ทำงาน',img:'myTasks',html:`<p>รวมงานที่บัญชีของคุณรับผิดชอบและสิ่งที่ต้องดำเนินการในวันนี้</p><ol><li>สลับดูงานค้าง เลยกำหนด ยังไม่มีวันส่ง และปัญหาที่ยังไม่ปิด</li><li>หัวหน้าสลับระหว่าง <b>ของฉัน</b> และทุกแผนกที่มีสิทธิ์ได้</li><li>คลิกรายการเพื่อเปิดต้นทางจริง ระบบไม่รวมงานต่างแหล่งเป็นรายการเดียวโดยอัตโนมัติ</li></ol>`},
{id:'teamBoard',ic:'i-grid',tt:'บอร์ดทีม / รายคน',img:'teamBoard',html:`<p>ดูงานแยกตามแผนกและบุคคลตามสิทธิ์ของบัญชี</p><ol><li>เลือกแผนก ชื่อ รูปแบบคอลัมน์ และสถานะงาน</li><li>งานที่มีผู้รับผิดชอบหลายคนจะแสดงในกริดของแต่ละคน แต่ยอดรวมไม่นับซ้ำ</li><li>กดการ์ดเพื่ออัปเดตจากรายการต้นทาง และใช้ปุ่มบันทึกกิจกรรมเมื่อต้องเพิ่มผลงาน</li></ol>`},
{id:'board',ic:'i-board',tt:'บอร์ดงาน',img:'board',html:`<p>บอร์ดงานสไตล์ Monday จัดกลุ่มตามแผนก</p><ol><li><b>ตัวกรอง</b>: ค้นหา (รหัส/ชื่อ/แท็ก) · แผนก · สถานะ · ความสำคัญ · ผู้รับผิดชอบ · ช่วงเวลา · ตั้งแต่–ถึง</li><li><b>จัดกลุ่ม</b> และ <b>เรียงลำดับ</b> ปรับได้ทางขวา</li><li>กด <b>+ งานใหม่</b> เพื่อสร้างงาน หรือ <b>ส่งออก</b> เป็นไฟล์</li><li><b>คลิกที่งาน</b> เพื่อเปิดรายละเอียด</li></ol>`},
{id:'task',ic:'i-clipboard',tt:'รายละเอียดงาน',img:'task',html:`<p>หน้ารายละเอียดงาน — ทำงานได้จริงทุกปุ่ม</p><ol><li><b>เปลี่ยนสถานะ</b> กดปุ่มสีสถานะ (ยังไม่เริ่ม → กำลังทำ → รอตรวจ → เสร็จ / ติดปัญหา)</li><li><b>กำหนดส่ง</b> และ <b>เวลาที่ใช้</b> แก้ได้ ระบบบอก เหลือกี่วัน / เกินกำหนด ให้</li><li><b>SLA (ระยะเวลาดำเนินการ)</b> แสดงไว้ ถ้าเกินจะไฮไลต์เตือน</li><li><b>งานย่อย / มอบต่อ</b> แตกงานและมอบให้คนอื่นได้</li><li>ปิดงานพร้อมกรอก <b>วิธีแก้ปัญหา</b> ระบบบันทึกเข้า <b>คลังความรู้</b> อัตโนมัติ · คอมเมนต์ใต้งานได้</li></ol>`},
{id:'compose',ic:'i-sparkle',tt:'สร้างงานด้วย AI',img:'compose',html:`<p>ให้ AI ช่วยจัดรูปงานให้อ่านง่าย</p><ol><li>พิมพ์สั้นๆ ว่าต้องการอะไร หรือกด <b>พูดใส่</b> (ภาษาไทย)</li><li>กด <b>ให้ AI จัดรูปงาน</b> — AI จะเดา <b>แผนก · ความสำคัญ · กำหนดส่ง · ผู้รับผิดชอบ · เช็กลิสต์</b> ให้</li><li>ตรวจ/แก้แล้วกด <b>สร้างงาน</b> เข้าบอร์ด</li></ol>`},
{id:'graphic',ic:'i-grid',tt:'Graphic Production',img:'graphic',html:`<p>ติดตามงานกราฟิกจากการรับบรีฟจนส่งมอบในมุมมองบอร์ดและโปรเจกต์</p><ol><li>สร้างบรีฟพร้อมหัวข้อ รายละเอียด วันส่ง โปรเจกต์ ไฟล์ และผู้รับผิดชอบ</li><li>เปลี่ยนสถานะ ตรวจเช็กลิสต์ ดูไฟล์ และคอมเมนต์ในงาน</li><li>ตัวกรอง <b>ชุดงาน</b> แยกงานปัจจุบัน งานค้างเกิน 30 วัน ประวัติเสร็จแล้ว และทั้งหมด</li><li>ตัวกรองบุคคล สถานะ วันที่ และโปรเจกต์ช่วยค้นหารายการจริงโดยไม่เปลี่ยนข้อมูลต้นทาง</li></ol>`},
{id:'timeline',ic:'i-calendar',tt:'ไทม์ไลน์',img:'timeline',html:`<p>เรียงงานตามวันเริ่มและกำหนดส่งเพื่อดูภาระงานในช่วงเวลา</p><ol><li>กรองตามแผนก สถานะ ผู้รับผิดชอบ และวันที่</li><li>คลิกงานเพื่อเปิดรายละเอียดต้นทาง</li><li>งานที่ขาดวันส่งจะไม่ถูกสมมติวันและควรแก้จากหน้าข้อมูลที่ต้องเติม</li></ol>`},
{id:'activity',ic:'i-clipboard',tt:'บันทึกกิจกรรม',img:'activity',html:`<p>บันทึกผลงานประจำวันโดยเลือกเจ้าของ แผนก วันที่ รายละเอียด ประเภท และสถานะ</p><ol><li>หน้าเริ่มต้นแสดงเดือนปัจจุบัน และสลับเป็น วันนี้ เดือนนี้ หรือทั้งหมดได้</li><li>คิวตรวจข้อมูลแบบกลุ่มแสดงยอดแยกแผนก กดเพื่อกรองและส่งออก CSV ได้</li><li>ฟอร์มแบ่งเป็นขั้นตอนและมีหน้าตรวจทานก่อนส่ง</li><li>สถานะเสร็จ ติดปัญหา และรอตรวจจะแสดงช่องผลลัพธ์หรือปัญหาที่เกี่ยวข้องตามจริง</li><li>กิจกรรมที่ข้อมูลไม่ครบจะเข้าคิว <b>ข้อมูลที่ต้องเติม</b> และยังไม่ใช้ประเมิน KPI</li></ol>`},
{id:'completeness',ic:'i-warning',tt:'ข้อมูลที่ต้องเติม',img:'completeness',html:`<p>คิวตรวจความครบถ้วนของรายการเดิม เช่น เจ้าของ เวลา สถานะ ผลลัพธ์ วันส่ง หรือรายละเอียดปัญหา ระบบนำรายการที่ขาดช่องบังคับมาแสดงให้อัตโนมัติ</p><ol><li>กดเติมข้อมูลเพื่อเปิดรายการเดิม ไม่ต้องสร้างกิจกรรมซ้ำ</li><li>เมื่อข้อมูลครบ รายการจะออกจากคิวโดยอัตโนมัติ</li><li>ถ้ากำลังรอเอกสารหรือข้อมูลจากคนอื่น ให้สร้างงานและมอบหมายในบอร์ดงาน หรือแจ้งที่ศูนย์ปัญหา หน้านี้ไม่ใช่คิวขอเอกสาร</li><li>ตัวอย่าง: ตรวจ STM แล้วพบว่าเอกสารไม่ครบ ให้บันทึกรายการเดิมเป็น “ติดปัญหา” พร้อมระบุสิ่งที่ขาด และสร้างงานมอบหมายให้ Admin หากต้องติดตามผู้รับผิดชอบ เมื่อได้รับครบจึงกลับมาปิดกิจกรรมเดิมพร้อมเวลาและผลลัพธ์</li></ol>`},
{id:'kpi',ic:'i-target',tt:'KPI แดชบอร์ด (กรอกผลรายเดือน)',img:'kpi',html:`<p>สกอร์การ์ด KPI จริงของทุกทีม กรอกผลรายเดือนได้เอง</p><ol><li>เลือกเดือนและดูผลตามสิทธิ์ของผู้ใช้</li><li><b>KPI Admin</b> แยกชุดพนักงาน · รอง/ผู้ช่วยหัวหน้า/หัวหน้า · บริหารแอดมิน ระบบเลือกชุดตามตำแหน่ง</li><li>ผู้ประเมินกรอกคะแนนทุกข้อและแนบคำอธิบายหรือลิงก์หลักฐาน แล้วส่งให้ผู้ตรวจรับ</li><li>ผู้ตรวจรับส่งกลับหรือรับรองผลได้ ผู้ประเมินห้ามรับรองผลของตนเอง</li><li>หากผลไม่โปร่งใส ทีมบริหาร/KPI ทำผลเป็นโมฆะโดยระบุข้อเท็จจริง ระบบเก็บประวัติเดิมและเริ่มประเมินใหม่โดยผู้เป็นกลาง</li><li>เกณฑ์ Admin: A 90–100 · B 80–89 · C 70–79 · D ต่ำกว่า 70</li></ol>`},
{id:'reports',ic:'i-report',tt:'รายงานสรุป',img:'reports',html:`<p>สรุปผลเชิงบริหาร กรองและ Export ได้</p><ol><li>กรองตาม <b>แผนก / กลุ่มงาน / ช่วงเวลา</b></li><li>ดู <b>Scorecard</b> เทียบทุกแผนก + แนวโน้มคะแนน</li><li>กด Export เป็นไฟล์เพื่อส่งต่อ</li></ol>`},
{id:'monthly',ic:'i-doc',tt:'รายงานประจำเดือน',img:'monthly',html:`<p>แบบฟอร์มรายงานผลการดำเนินงานประจำเดือน 9 หัวข้อ กรอกอัตโนมัติ + แก้ได้</p><ol><li>เลือก <b>เดือน / แผนก / กลุ่ม</b> ด้านบน ระบบดึงข้อมูลมากรอกให้</li><li>หัวข้อที่มีป้าย <b>แก้ไขได้</b> พิมพ์เพิ่ม/แก้ข้อความได้ (รวม 9. หมายเหตุเพิ่มเติม)</li><li>Export เป็น <b>Word / Excel / PDF</b> ได้</li></ol>`},
{id:'tracker',ic:'i-clipboard',tt:'Action Tracker',img:'tracker',html:`<p>ติดตามมติประชุม แผน UAT 7 วัน และ Action Plan 30 วันจากฐานข้อมูลจริง</p><ol><li>คลิกรายการเพื่ออัปเดต <b>สถานะ ผลตรวจ และลิงก์หลักฐาน</b></li><li>ระบบเตือนงานเกินกำหนด ติดปัญหา 3X ค้าง และจำนวน SOP</li><li>กรองตามเดือน กลุ่ม แผนก และ Owner ได้</li></ol>`},
{id:'connectedSystems',ic:'i-grid',tt:'ผลประเมินทีมจากระบบเชื่อมต่อ',img:'connectedSystems',html:`<p>สรุปผลระดับทีมจาก Audit Reconciliation Control และ DomainWatch โดยไม่ฝังหน้าระบบอื่น</p><ol><li>เลือกเดือนและแผนกที่ได้รับสิทธิ์เพื่อดูจำนวนงาน สถานะ และตัวชี้วัดระดับทีม</li><li>เมื่อเชื่อมแล้ว ระบบจำผลล่าสุดแยกตามบัญชีบนอุปกรณ์นี้ 24 ชั่วโมง พร้อมแสดงเวลาอัปเดตล่าสุด</li><li>ข้อมูลที่ยังเชื่อมไม่สำเร็จจะแสดงขีดหรือข้อความรอเชื่อม ไม่ตีความเป็นศูนย์</li><li>กด <b>ดึงผลล่าสุด</b> เมื่อต้องการอ่านข้อมูลใหม่จากระบบต้นทาง</li><li>หน้านี้ไม่สร้างหรืออนุมัติคะแนน KPI รายบุคคล</li></ol>`},
{id:'problems',ic:'i-warning',tt:'ศูนย์ปัญหา',img:'problems',html:`<p>รูปแบบรับแจ้งอ้างอิงการใช้งานเดือนสิงหาคม แต่เพิ่มข้อมูลสำหรับวิเคราะห์และทำ SOP</p><ol><li>พนักงานกด <b>แจ้งปัญหาใหม่</b> แล้วกรอกวันที่ เวลา โปรเจกต์ ประเภท รายละเอียด และความสำคัญ</li><li>ส่วนผลกระทบใช้บันทึกบริการ ผู้ให้บริการ จำนวนลูกค้า จำนวนรายการ และมูลค่าที่กระทบ</li><li>ระบบส่ง Owner เบื้องต้นตามประเภทปัญหา พนักงานติดตามเคสของตนเองได้</li><li>หัวหน้า/Admin ระบุ Root cause วิธีแก้ แนวทางป้องกัน และยืนยันผลก่อนปิดเคส</li></ol>`},
{id:'ann',ic:'i-megaphone',tt:'ประกาศ / สั่งงาน',img:'ann',html:`<p>ประกาศหรือสั่งงานถึงหลายคนพร้อมกัน</p><ol><li>เลือกผู้รับได้ <b>หลายคน / ทั้งกลุ่ม / ทั้งบริษัท</b> (ตั้งกลุ่มไว้ล่วงหน้าได้)</li><li>กำหนด <b>ช่วงเวลามีผล</b> (ตั้งแต่–ถึง) สถานะ: กำลังใช้ / ยังไม่เริ่ม / หมดอายุ</li><li>ปักหมุดประกาศสำคัญได้</li></ol>`},
{id:'ack',ic:'i-bell',tt:'รับทราบ & ตอบกลับประกาศ',img:'ack',html:`<p>ระบบยืนยันการรับทราบประกาศ</p><ol><li>ผู้รับเห็น <b>ป็อปอัพ</b> ให้กด <b>รับทราบ</b> (กระดิ่งบนสุดเด้งจำนวนค้าง)</li><li>ผู้ประกาศเห็นว่า <b>ใครรับทราบแล้ว</b> ตามสิทธิ์</li><li><b>ตอบกลับ</b> ประกาศได้เหมือนคอมเมนต์</li></ol>`},
{id:'org',ic:'i-org',tt:'แผนผังองค์กร',img:'org',html:`<p>โครงสร้างปัจจุบันประกอบด้วย 4 กลุ่มงาน 14 แผนก</p><ol><li>ใช้ดูความสัมพันธ์ของกลุ่มงาน แผนก และระดับตำแหน่ง</li><li>รายชื่อทีมที่ยกเลิกจะไม่แสดงในโครงสร้างปัจจุบัน</li><li>ผังเป็นข้อมูลอ้างอิง ส่วนสิทธิ์จริงตรวจจากบัญชีและแผนกที่ผูกไว้</li></ol>`},
{id:'users',ic:'i-users',tt:'จัดการพนักงาน เครื่อง และ IP',img:'users',html:`<p>เมนูสำหรับผู้ดูแลตรวจข้อมูลพนักงาน สิทธิ์ แผนก อุปกรณ์ และกฎ IP</p><ol><li>แก้ชื่อ ตำแหน่ง บทบาท แผนกหลัก และแผนกเพิ่มเติม</li><li>ตรวจเครื่องที่รออนุมัติและอนุมัติเฉพาะเครื่องของพนักงานที่ยืนยันแล้ว</li><li>การแก้ข้อมูลสิทธิ์และความปลอดภัยบันทึกแยกกันเพื่อลดการเปลี่ยนโดยไม่ตั้งใจ</li></ol>`},
{id:'sop',ic:'i-book',tt:'คลัง SOP / ระเบียบ',img:'sop',html:`<p>คลังคู่มือปฏิบัติงาน (SOP) และเอกสารกลาง/ระเบียบ</p><ol><li>เปิดดู SOP รายแผนก (ขั้นตอนการทำงาน)</li><li>มี <b>ระเบียบการประชุมติดตามผลประจำเดือน</b> และแบบฟอร์มให้เปิดในระบบ</li><li>SOP ผูกกับงานของแผนกอัตโนมัติ</li></ol>`},
{id:'kb',ic:'i-bulb',tt:'คลังความรู้',img:'kb',html:`<p>คลังความรู้สร้างเองจากการปิดงาน</p><ol><li>ทุกครั้งที่ปิดงานพร้อม <b>วิธีแก้ปัญหา</b> ระบบเก็บเป็นบทความอัตโนมัติ</li><li>ค้นหา/เปิดอ่านเพื่อไม่ต้องแก้ปัญหาซ้ำ</li></ol>`},
{id:'talk',ic:'i-chat',tt:'Talk to Data',img:'talk',html:`<p>ถามข้อมูลภายในด้วยภาษาคน (ดึงจากฐานข้อมูลภายในเท่านั้น)</p><ol><li>พิมพ์หรือกดไมค์ถาม เช่น งานติดปัญหามีกี่งาน · คะแนน KPI กราฟิกเท่าไร</li><li>ระบบตอบพร้อมตาราง เฉพาะข้อมูลในองค์กร</li></ol>`},
{id:'extra',ic:'i-mic',tt:'ฟีเจอร์เสริม',img:null,html:`<ol><li><b>สั่งด้วยเสียง</b> (ปุ่มพูดสั่ง) — พูดภาษาไทย เช่น ไปบอร์ด · กรองแผนกกราฟิก · สร้างงาน…</li><li><b>โหมดมืด</b> — ปุ่มพระจันทร์บนสุด</li><li><b>มือถือ</b> — กดปุ่มเมนู (สามขีด) เพื่อเปิดเมนู</li><li><b>ข้อมูล Production</b> ถูกบันทึกใน Supabase และจำกัดการมองเห็นด้วย Role/RLS ไม่มีโหมดรีเซ็ตข้อมูลตัวอย่าง</li></ol>`},
];
let _hlp=null,_spyLock=0;
async function buildManual(){ if(_hlp) return; await loadManualImages();
  const nav=MANUAL.map((s,i)=>`<button data-sec="${s.id}" onclick="gotoManual('${s.id}')"><span class="num">${i+1}</span>${sic(s.ic)}<span>${s.tt}</span></button>`).join('');
  const content=MANUAL.map(s=>`<div class="help-sec" id="hsec-${s.id}"><h4>${sic(s.ic)} ${s.tt}</h4>${s.html}${s.img?`<img class="help-img" src="${MANUAL_IMG[s.img]}" alt="${s.tt}"><div class="help-cap">ภาพหน้าจอเวอร์ชันปัจจุบัน · ใช้ข้อมูลตัวอย่างในการทดสอบ — ${s.tt}</div>`:''}</div>`).join('');
  const w=document.createElement('div'); w.className='help-win'; w.id='helpWin';
  w.innerHTML=`<div class="help-head" id="helpHead"><h3>${sic('i-book')} คู่มือ Company Hub · เวอร์ชัน 16 ต.ค. 2569</h3><span style="font-size:11px;opacity:.85">ปรับปรุงล่าสุด 16 ต.ค. 2569 · ลากเพื่อย้าย</span><button class="hx" onclick="closeManual()">×</button></div><div class="help-main"><div class="help-nav" id="helpNav">${nav}</div><div class="help-content" id="helpContent">${content}</div></div>`;
  document.body.appendChild(w); _hlp=w;
  const head=w.querySelector('#helpHead'); let dx=0,dy=0,drag=false;
  const start=(cx,cy,t)=>{if(t&&t.classList&&t.classList.contains('hx'))return;const r=w.getBoundingClientRect();w.style.left=r.left+'px';w.style.top=r.top+'px';w.style.transform='none';dx=cx-r.left;dy=cy-r.top;drag=true;};
  const move=(cx,cy)=>{if(!drag)return;let x=Math.max(6,Math.min(window.innerWidth-120,cx-dx)),y=Math.max(6,Math.min(window.innerHeight-56,cy-dy));w.style.left=x+'px';w.style.top=y+'px';};
  head.addEventListener('mousedown',e=>{start(e.clientX,e.clientY,e.target);e.preventDefault();});
  window.addEventListener('mousemove',e=>move(e.clientX,e.clientY));
  window.addEventListener('mouseup',()=>drag=false);
  head.addEventListener('touchstart',e=>{const t=e.touches[0];start(t.clientX,t.clientY,e.target);},{passive:true});
  window.addEventListener('touchmove',e=>{if(!drag)return;const t=e.touches[0];move(t.clientX,t.clientY);},{passive:true});
  window.addEventListener('touchend',()=>drag=false);
  const cont=w.querySelector('#helpContent');
  cont.addEventListener('scroll',()=>{if(Date.now()<_spyLock)return;let cur=MANUAL[0].id;for(const s of MANUAL){const el=document.getElementById('hsec-'+s.id);if(el&&el.offsetTop-cont.scrollTop<=64)cur=s.id;}setManualActive(cur);});
  setManualActive(MANUAL[0].id);
}
function setManualActive(id){if(!_hlp)return;_hlp.querySelectorAll('.help-nav button').forEach(b=>b.classList.toggle('active',b.dataset.sec===id));}
function gotoManual(id){const el=document.getElementById('hsec-'+id),cont=document.getElementById('helpContent');if(el&&cont)cont.scrollTo({top:Math.max(0,el.offsetTop-8),behavior:'smooth'});setManualActive(id);_spyLock=Date.now()+800;}
async function openManual(){await buildManual();_hlp.classList.add('show');const c=_hlp.querySelector('#helpContent');if(c)c.scrollTop=0;setManualActive(MANUAL[0].id);}
function closeManual(){if(_hlp)_hlp.classList.remove('show');}

