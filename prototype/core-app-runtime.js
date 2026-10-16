/* ============================================================
   MODALS
============================================================ */

/* ============================================================
   ศูนย์ปัญหา (Problem Management) — รับแจ้งและวิเคราะห์ใน Company Hub
============================================================ */
const PROBLEMS = [];
const PROB_SRC = {file:'Supabase · operational_issues', asof:'กำลังโหลดข้อมูล Production ตามสิทธิ์', n:0};
const PROB_PRIO = {Critical:{t:'วิกฤต',c:'#d64545',o:4}, High:{t:'สูง',c:'#e8971b',o:3}, Medium:{t:'กลาง',c:'#2563eb',o:2}, Low:{t:'ต่ำ',c:'#67769a',o:1}};
const PROB_ST = {Open:{t:'ยังไม่แก้',c:'#d64545'}, 'In Progress':{t:'กำลังแก้',c:'#e8971b'}, Resolved:{t:'แก้แล้ว',c:'#0b7a5a'}};
const ISSUE_PROJECTS=['3X','MC8','MR9','UR9','PS8','FR8','AT4','SK8','7M','Overall'];
const ISSUE_CATEGORIES=['Payment','Website','System','Customer','Network','Provider','Other'];
const ISSUE_IMPACT_SCOPES={unknown:'ยังประเมินไม่ได้',single_customer:'ลูกค้า 1 ราย',multiple_customers:'ลูกค้าหลายราย',project:'ทั้งโปรเจกต์',multiple_projects:'หลายโปรเจกต์',companywide:'ทั้งบริษัท'};
const ISSUE_DEFAULT_OWNER={Payment:'Payment',Website:'IT',System:'IT',Customer:'Admin',Network:'IT',Provider:'Support',Other:'Admin'};
let PF={project:'',cat:'',prio:'',status:'',solution:'',quality:'',q:''};
function setPF(k,v){PF[k]=(PF[k]===v?'':v);RENDER.problems();}
function clearPF(){PF={project:'',cat:'',prio:'',status:'',solution:'',quality:'',q:''};RENDER.problems();}
function probPrio(p){const m=PROB_PRIO[p]||{t:p,c:'#888'};return `<span class="tag" style="background:${m.c}22;color:${m.c};border-color:${m.c}55">${m.t}</span>`;}
function probStatus(s){const m=PROB_ST[s]||{t:s,c:'#888'};return `<span class="tag" style="background:${m.c}22;color:${m.c};border-color:${m.c}55">${m.t}</span>`;}
function probDate(d){return d?d.split('-').reverse().join('/'):'-';}
function probResT(m){if(m==null||m==='')return '-';if(m<60)return Math.round(m)+' น.';const h=m/60;return (h>=100?Math.round(h):h.toFixed(1))+' ชม.';}
function hasIssueSolution(p){return !!String(p.solution||'').trim();}
function probFiltered(){return PROBLEMS.filter(p=>(!PF.project||p.project===PF.project)&&(!PF.cat||p.cat===PF.cat)&&(!PF.prio||p.prio===PF.prio)&&(!PF.status||p.status===PF.status)&&(!PF.solution||(PF.solution==='yes'?hasIssueSolution(p):!hasIssueSolution(p)))&&(!PF.quality||(PF.quality==='review'?(p.qualityFlags||[]).length:!(p.qualityFlags||[]).length))&&(!PF.q||(p.problem+' '+p.solution+' '+p.reporter+' '+p.id).toLowerCase().includes(PF.q.toLowerCase())));}
function probCounts(list,key){const o={};list.forEach(p=>{const k=p[key]||'(ไม่ระบุ)';o[k]=(o[k]||0)+1;});return Object.entries(o).sort((a,b)=>b[1]-a[1]);}
function probBars(pairs,total,click,colorFn){const max=Math.max(1,...pairs.map(x=>x[1]));return pairs.map(([k,v])=>`<div class="kpirow" style="grid-template-columns:120px 1fr 42px;cursor:pointer" onclick="${click(k)}"><div class="nm" style="font-size:12px">${k}</div><div class="bar"><i style="width:${Math.round(v/max*100)}%;background:${colorFn?colorFn(k):'#2563eb'}"></i></div><div class="score" style="font-size:12px">${v}</div></div>`).join('');}
function probAvgHrs(list){const r=list.filter(p=>typeof p.resmin==='number'&&p.status==='Resolved');if(!r.length)return 0;return (r.reduce((s,p)=>s+p.resmin,0)/r.length/60);}
function issueLocalNow(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ORG_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()),o={};parts.forEach(x=>o[x.type]=x.value);return {date:`${o.year}-${o.month}-${o.day}`,time:`${o.hour==='24'?'00':o.hour}:${o.minute}`};}
function issueNumberOrNull(id){const raw=val(id);return raw===''?null:Number(raw);}
function openNewIssue(){
  if(!ACCESS_PROFILE){toast('กรุณาเข้าสู่ระบบก่อนแจ้งปัญหา','info');return;}
  const now=issueLocalNow(),reporter=ACCESS_PROFILE.display_name||ACCESS_PROFILE.email||'';
  showModal(`<div class="modal-h"><div><span class="tag" style="background:#2158c822;color:#2158c8">รับแจ้งปัญหาใหม่</span><h3 style="margin-top:7px">แจ้งปัญหาหน้างาน</h3><div class="muted">ผู้แจ้ง ${esc(reporter)} · ระบบจะสร้างรหัสเคสให้อัตโนมัติ</div></div><button class="x" onclick="closeModal()">×</button></div><div class="pad">
    <div class="ai-note" style="margin-top:0"><b>1 · ข้อมูลจำเป็น</b><br><span class="muted">ระบุเหตุการณ์และผลกระทบให้ครบ เพื่อให้ทีมรับผิดชอบเริ่มแก้ได้</span></div>
    <div class="two"><div class="field"><label>วันที่เกิดปัญหา *</label><input class="fin" type="date" id="newIssueDate" value="${now.date}"></div><div class="field"><label>เวลา *</label><input class="fin" type="time" id="newIssueTime" value="${now.time}"></div></div>
    <div class="two"><div class="field"><label>โปรเจกต์ *</label><select class="fin" id="newIssueProject">${ISSUE_PROJECTS.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div><div class="field"><label>ประเภทปัญหา *</label><select class="fin" id="newIssueCategory">${ISSUE_CATEGORIES.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></div></div>
    <div class="field"><label>รายละเอียดปัญหา *</label><textarea class="fin" id="newIssueProblem" maxlength="4000" rows="4" placeholder="เกิดอะไรขึ้น · ช่องทางใดใช้งานไม่ได้ · เริ่มตั้งแต่เมื่อไร"></textarea></div>
    <div class="two"><div class="field"><label>ความสำคัญ *</label><select class="fin" id="newIssuePriority">${Object.entries(PROB_PRIO).sort((a,b)=>b[1].o-a[1].o).map(([k,m])=>`<option value="${k}" ${k==='Medium'?'selected':''}>${m.t}</option>`).join('')}</select></div><div class="field"><label>ขอบเขตผลกระทบ *</label><select class="fin" id="newIssueImpactScope">${Object.entries(ISSUE_IMPACT_SCOPES).map(([k,t])=>`<option value="${k}">${t}</option>`).join('')}</select></div></div>
    <details style="margin-top:12px" open><summary style="cursor:pointer;font-weight:700">2 · ผลกระทบและข้อมูลช่วยวิเคราะห์</summary><div style="padding-top:12px">
      <div class="two"><div class="field"><label>ระบบ/บริการที่กระทบ</label><input class="fin" id="newIssueService" maxlength="200" placeholder="เช่น AZPAY, 12PAY, Callback"></div><div class="field"><label>ผู้ให้บริการ</label><input class="fin" id="newIssueProvider" maxlength="200" placeholder="ถ้ามี"></div></div>
      <div class="field"><label>สรุปผลกระทบ *</label><textarea class="fin" id="newIssueImpact" maxlength="2000" rows="2" placeholder="ลูกค้าทำรายการอะไรไม่ได้ หรือกระทบทีมใด"></textarea></div>
      <div class="two"><div class="field"><label>จำนวนลูกค้าที่กระทบ</label><input class="fin" type="number" min="0" step="1" id="newIssueCustomers"></div><div class="field"><label>จำนวนรายการที่กระทบ</label><input class="fin" type="number" min="0" step="1" id="newIssueTransactions"></div></div>
      <div class="field"><label>มูลค่าที่กระทบโดยประมาณ (บาท)</label><input class="fin" type="number" min="0" step="0.01" id="newIssueFinancial"></div>
    </div></details>
    <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">3 · การรับมือเบื้องต้นและหลักฐาน</summary><div style="padding-top:12px">
      <div class="field"><label>วิธีรับมือชั่วคราว</label><textarea class="fin" id="newIssueWorkaround" maxlength="4000" rows="3" placeholder="เช่น เติมมือ เปลี่ยนช่องทาง หรือประสานผู้ให้บริการ"></textarea></div>
      <div class="field"><label>ลิงก์หลักฐาน</label><input class="fin" type="url" id="newIssueEvidence" maxlength="2000" placeholder="https://..."></div>
    </div></details>
    <div class="ai-note"><b>หลังบันทึก:</b> สถานะจะเป็น “ยังไม่แก้” และส่งให้ ${esc(ISSUE_DEFAULT_OWNER.Payment)} หรือทีมตามประเภทปัญหา หัวหน้าจะเป็นผู้ยืนยันวิธีแก้ก่อนปิดเคส</div>
    <button class="tbtn primary" id="newIssueSaveBtn" onclick="saveNewIssue()">บันทึกและส่งให้ทีมแก้ไข</button>
  </div>`);
}
async function saveNewIssue(){
  if(!SB||!ACCESS_PROFILE)return toast('ยังเชื่อมต่อฐานข้อมูลไม่ได้','info');
  const date=val('newIssueDate'),time=val('newIssueTime'),project=val('newIssueProject'),category=val('newIssueCategory'),problem=val('newIssueProblem').trim();
  if(!date||!time||!project||!category||!problem){toast('กรุณากรอกวันที่ เวลา โปรเจกต์ ประเภท และรายละเอียดปัญหา','info');return;}
  const evidence=val('newIssueEvidence').trim();if(evidence&&!/^https?:\/\//i.test(evidence)){toast('ลิงก์หลักฐานต้องขึ้นต้นด้วย http:// หรือ https://','info');return;}
  const payload={department_code:'ADMIN',occurred_at:new Date(`${date}T${time}:00+07:00`).toISOString(),project_code:project,category,problem,priority:val('newIssuePriority'),reporter:ACCESS_PROFILE.display_name||ACCESS_PROFILE.email||'',status:'Open',owner_team:val('newIssueOwner')||ISSUE_DEFAULT_OWNER[category]||'Admin',service_name:val('newIssueService').trim(),provider_name:val('newIssueProvider').trim(),impact_scope:val('newIssueImpactScope'),impact_summary:val('newIssueImpact').trim(),affected_customer_count:issueNumberOrNull('newIssueCustomers'),affected_transaction_count:issueNumberOrNull('newIssueTransactions'),financial_impact:issueNumberOrNull('newIssueFinancial'),workaround:val('newIssueWorkaround').trim(),evidence_url:evidence,source:'Company Hub'};
  const btn=document.getElementById('newIssueSaveBtn');if(btn)btn.disabled=true;
  try{const r=await SB.from('operational_issues').insert(payload).select('id').single();if(r.error)throw r.error;closeModal();await cloudLoadIssues();RENDER.problems();toast('รับแจ้ง '+r.data.id+' แล้ว');openProblem(r.data.id);}catch(e){if(btn)btn.disabled=false;toast((/service_name|impact_scope|schema cache/i.test(e.message||''))?'ยังไม่ได้รัน Migration 017':('บันทึกไม่สำเร็จ · '+(e.message||'')),'info');}
}
function probCause(p){
  if(p.rootCause)return p.rootCause;
  const s=((p.cat||'')+' '+(p.problem||'')).toLowerCase();
  if(/ปิดปรับปรุง|ปิดให้บริการ|ยอดเต็ม|provider|ผู้ให้บริการ|ธนาคารปิด/.test(s))return 'ผู้ให้บริการ / ช่องทางปิด';
  if(/ฝาก|ถอน|payment|callback|ออโต้|อัตโนมัติ|timeout/.test(s))return 'ธุรกรรมไม่เข้าอัตโนมัติ';
  if(/ยอดเงิน|ยอดหาย|เงินไม่เข้า|รายการลูกค้า|เดิมพัน/.test(s))return 'ยอดเงิน / รายการลูกค้า';
  if(/network|เครือข่าย|โดเมน|domain|link|ลิงก์|เข้าเว็บ/.test(s))return 'เครือข่าย / เว็บไซต์';
  return p.cat||'อื่น ๆ';
}
function probApproach(p){const s=((p.solution||'')+' '+(p.preventive||'')).toLowerCase();if(!s.trim())return 'ยังไม่มีแนวทางแก้';if(/แจ้ง|ประสาน|provider|ผู้ให้บริการ|ธนาคาร/.test(s))return 'ประสานผู้ให้บริการ';if(/manual|แมนนวล|ดำเนินการเอง|ปรับยอด/.test(s))return 'ดำเนินการ Manual';if(/ตรวจ|monitor|เฝ้า|ติดตาม/.test(s))return 'ตรวจสอบและติดตาม';return 'แก้ตามขั้นตอนหน้างาน';}
function probGroup(list,fn){const o={};list.forEach(p=>{const k=fn(p);(o[k]||(o[k]=[])).push(p);});return Object.entries(o).sort((a,b)=>b[1].length-a[1].length);}
function problemAnalysisHTML(all){
  const causes=probGroup(all,probCause),approaches=probGroup(all,probApproach),solved=all.filter(hasIssueSolution),missing=all.length-solved.length,max=Math.max(1,...causes.map(x=>x[1].length));
  const ready=causes.filter(([,rows])=>rows.length>=2&&rows.some(hasIssueSolution)).slice(0,6);
  return `<div class="flowline"><div class="flowstep"><b>1 · รับแจ้งปัญหา</b><span>${nf(all.length)} เคสจากหน้างาน</span></div><div class="flowstep"><b>2 · วิเคราะห์สาเหตุ</b><span>${nf(causes.length)} กลุ่มสาเหตุ</span></div><div class="flowstep"><b>3 · แก้ไขและป้องกันซ้ำ</b><span>${nf(solved.length)} เคสมีวิธีแก้</span></div><div class="flowstep"><b>4 · จัดทำ SOP</b><span>${nf(ready.length)} กลุ่มพร้อมทำคู่มือ</span></div></div>
  <div class="problem-insights"><div class="card"><div class="card-h"><h3>${sic('i-pie')} สาเหตุที่เกิดบ่อย</h3></div><div class="pad">${causes.slice(0,6).map(([k,v])=>`<div class="insight-row"><div class="head"><b>${esc(k)}</b><span>${nf(v.length)} เคส</span></div><div class="bar"><i style="width:${Math.max(4,v.length/max*100)}%;background:var(--primary)"></i></div></div>`).join('')}</div></div>
  <div class="card"><div class="card-h"><h3>${sic('i-bulb')} แนวทางแก้ไข</h3></div><div class="pad">${approaches.slice(0,6).map(([k,v])=>`<div class="insight-row"><div class="head"><b>${esc(k)}</b><span>${nf(v.length)}</span></div></div>`).join('')}<div class="ai-note"><b>ความพร้อม:</b> มีวิธีแก้ ${nf(solved.length)} · ยังขาด ${nf(missing)}</div></div></div>
  <div class="card wide"><div class="card-h"><h3>${sic('i-book')} เคสพร้อมจัดทำคู่มือ</h3><span class="act">เกิดซ้ำ ≥ 2 และมีวิธีแก้</span></div><div class="pad">${ready.map(([cause,rows])=>{const sample=rows.find(hasIssueSolution)||rows[0];return `<div class="sop-ready"><div><b>${esc(cause)}</b><div class="muted" style="font-size:11px">${nf(rows.length)} เคส · มีวิธีแก้ ${nf(rows.filter(hasIssueSolution).length)} · ตัวอย่าง ${esc(sample.id)}</div></div><button class="tbtn sm" onclick="openProblem('${esc(sample.id)}')">เปิดเคส</button></div>`;}).join('')||'<span class="muted">ยังไม่มีกลุ่มที่ผ่านเกณฑ์</span>'}</div></div></div>`;
}
RENDER.problems=function(){
  const all=PROBLEMS, list=probFiltered();
  const open=all.filter(p=>p.status!=='Resolved').length, resolved=all.filter(p=>p.status==='Resolved').length;
  const withSolution=all.filter(hasIssueSolution).length, withoutSolution=all.length-withSolution;
  const verifiedCount=all.filter(p=>p.verified).length,impactReady=all.filter(p=>p.impactScope&&p.impactScope!=='unknown').length,missingOwner=all.filter(p=>!p.owner).length;
  const qualityReview=all.filter(p=>(p.qualityFlags||[]).length).length,dates=all.map(p=>p.date).filter(Boolean).sort(),dateRange=dates.length?`${probDate(dates[0])} – ${probDate(dates[dates.length-1])}`:'ไม่มีข้อมูล';
  const crit=all.filter(p=>p.prio==='Critical'||p.prio==='High').length;
  const avg=probAvgHrs(all);
  const projColor=k=>'#2158c8';
  const catColor=k=>({Payment:'#0b7a75',System:'#c77d3a',Website:'#2f8fe6',Customer:'#00a878',Network:'#6d4c9f',Provider:'#c2557a',Other:'#67769a'}[k]||'#2563eb');
  const prioColor=k=>(PROB_PRIO[k]||{}).c||'#2563eb';
  const stColor=k=>(PROB_ST[k]||{}).c||'#2563eb';
  const opt=(cur,v,label)=>`<option value="${v}" ${cur===v?'selected':''}>${label}</option>`;
  main.innerHTML=`${crumb('หน้าแรก','ศูนย์ปัญหา')}
  <div class="page-h"><div><h1>ศูนย์ปัญหา (Problem Management)</h1><p>รับแจ้ง · ประเมินผลกระทบ · แก้ไข · ยืนยันผล · จัดทำ SOP ในระบบเดียว · ${PROB_SRC.n} เคส</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="tbtn primary" onclick="openNewIssue()">+ แจ้งปัญหาใหม่</button><button class="tbtn" onclick="openTalkPopup('สรุปปัญหาหน้างานและสาเหตุหลัก')">${sic('i-chat')} ถาม AI เรื่องปัญหา</button></div></div>
  <div class="stats" style="margin-bottom:14px">
    <div class="stat accent click" onclick="clearPF()"><div class="lbl">ปัญหาทั้งหมด</div><div class="val">${all.length}</div><div class="sub">ทุกโปรเจกต์</div><div class="icn">${sic('i-warning')}</div></div>
    <div class="stat click" onclick="setPF('status','Open')"><div class="lbl">ยังไม่แก้ (Open)</div><div class="val" style="color:var(--red)">${open}</div><div class="sub down">ต้องติดตาม</div></div>
    <div class="stat click" onclick="setPF('status','Resolved')"><div class="lbl">แก้แล้ว</div><div class="val" style="color:var(--green)">${resolved}</div><div class="sub up">${Math.round(resolved/all.length*100)}%</div></div>
    <div class="stat click" onclick="setPF('prio','Critical')"><div class="lbl">วิกฤต + สูง</div><div class="val" style="color:var(--amber)">${crit}</div><div class="sub muted">ความสำคัญสูง</div></div>
    <div class="stat"><div class="lbl">เวลาแก้เฉลี่ย</div><div class="val">${avg.toFixed(1)}<span style="font-size:14px"> ชม.</span></div><div class="sub muted">เฉพาะที่แก้แล้ว</div></div>
  </div>
  <div class="stats" style="margin-bottom:14px;grid-template-columns:repeat(4,minmax(180px,1fr))">
    <div class="stat click" onclick="setPF('solution','yes')"><div class="lbl">✓ มีวิธีแก้แล้ว</div><div class="val" style="color:var(--green)">${nf(withSolution)}</div><div class="sub up">คลิกดูเคสและวิธีแก้</div></div>
    <div class="stat click" onclick="setPF('solution','no')"><div class="lbl">ยังไม่มีวิธีแก้</div><div class="val" style="color:var(--red)">${nf(withoutSolution)}</div><div class="sub down">ต้องวิเคราะห์/บันทึกผลดำเนินการ</div></div>
    <div class="stat"><div class="lbl">ยืนยันใช้ได้จริง</div><div class="val" style="color:var(--green)">${nf(verifiedCount)}</div><div class="sub muted">หัวหน้าตรวจผลแล้ว</div></div>
    <div class="stat click" onclick="setPF('quality','review')"><div class="lbl">ต้องตรวจคุณภาพข้อมูล</div><div class="val" style="color:${qualityReview?'var(--amber)':'var(--green)'}">${nf(qualityReview)}</div><div class="sub ${missingOwner?'down':'up'}">ไม่ระบุ Owner ${nf(missingOwner)} · คลิกดู</div></div>
  </div>
  ${sourceBadge('live','PRODUCTION ISSUE DATA',`${nf(all.length)} เคส · ${dateRange} · กรกฎาคม ${nf(all.filter(p=>p.sourceSheet==='3X'||p.sourceSheet==='FR8').length)} · สิงหาคม ${nf(all.filter(p=>p.sourceSheet==='Issues').length)}`)}
  ${problemAnalysisHTML(all)}
  <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
    <div class="card"><div class="card-h"><h3>${sic('i-board')} ปัญหาตามโปรเจกต์</h3><span class="act">คลิกเพื่อกรอง</span></div><div class="pad">${probBars(probCounts(all,'project'),all.length,k=>`setPF('project','${k}')`,projColor)}</div></div>
    <div class="card"><div class="card-h"><h3>${sic('i-pie')} ปัญหาตามหมวด</h3><span class="act">คลิกเพื่อกรอง</span></div><div class="pad">${probBars(probCounts(all,'cat'),all.length,k=>`setPF('cat','${k}')`,catColor)}</div></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:14px">
    <div class="card"><div class="card-h"><h3>${sic('i-target')} ตามความสำคัญ</h3></div><div class="pad">${probBars(probCounts(all,'prio').sort((a,b)=>(PROB_PRIO[b[0]]||{o:0}).o-(PROB_PRIO[a[0]]||{o:0}).o),all.length,k=>`setPF('prio','${k}')`,prioColor)}</div></div>
    <div class="card"><div class="card-h"><h3>${sic('i-check')} ตามสถานะ</h3></div><div class="pad">${probBars(probCounts(all,'status'),all.length,k=>`setPF('status','${k}')`,stColor)}</div></div>
  </div>
  <div class="card"><div class="card-h"><h3>${sic('i-warning')} รายการปัญหา</h3><span class="act">${list.length} / ${all.length} เคส</span></div>
    <div class="pad" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;border-bottom:1px solid var(--line-2)">
      <div class="fsel"><label>โปรเจกต์</label><select onchange="PF.project=this.value;RENDER.problems()">${opt(PF.project,'','ทั้งหมด')}${[...new Set(all.map(p=>p.project))].map(v=>opt(PF.project,v,v)).join('')}</select></div>
      <div class="fsel"><label>หมวด</label><select onchange="PF.cat=this.value;RENDER.problems()">${opt(PF.cat,'','ทั้งหมด')}${[...new Set(all.map(p=>p.cat))].map(v=>opt(PF.cat,v,v)).join('')}</select></div>
      <div class="fsel"><label>ความสำคัญ</label><select onchange="PF.prio=this.value;RENDER.problems()">${opt(PF.prio,'','ทั้งหมด')}${Object.keys(PROB_PRIO).map(v=>opt(PF.prio,v,PROB_PRIO[v].t)).join('')}</select></div>
      <div class="fsel"><label>สถานะ</label><select onchange="PF.status=this.value;RENDER.problems()">${opt(PF.status,'','ทั้งหมด')}${Object.keys(PROB_ST).map(v=>opt(PF.status,v,PROB_ST[v].t)).join('')}</select></div>
      <div class="fsel"><label>วิธีแก้</label><select onchange="PF.solution=this.value;RENDER.problems()">${opt(PF.solution,'','ทั้งหมด')}${opt(PF.solution,'yes','มีวิธีแก้แล้ว')}${opt(PF.solution,'no','ยังไม่มีวิธีแก้')}</select></div>
      <div class="fsel"><label>คุณภาพข้อมูล</label><select onchange="PF.quality=this.value;RENDER.problems()">${opt(PF.quality,'','ทั้งหมด')}${opt(PF.quality,'review','ต้องตรวจ')}${opt(PF.quality,'ready','พร้อมใช้')}</select></div>
      <div class="fsel" style="flex:1;min-width:160px"><label>ค้นหา</label><input class="fin" value="${PF.q}" placeholder="ค้นหาปัญหา / ผู้แจ้ง / รหัส" oninput="PF.q=this.value;clearTimeout(window._pfq);window._pfq=setTimeout(RENDER.problems,250)"></div>
      <button class="tbtn sm" onclick="clearPF()">ล้างตัวกรอง</button>
    </div>
    <div style="overflow-x:auto"><table class="datatable" style="width:100%;min-width:940px">
      <tr><th>วันที่</th><th>โปรเจกต์</th><th>หมวด</th><th>ปัญหา</th><th>ความสำคัญ</th><th>สถานะ</th><th>วิธีแก้</th><th>ผู้รับผิดชอบ</th><th>เวลาแก้</th></tr>
      ${list.slice().sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).slice(0,300).map(p=>`<tr style="cursor:pointer" onclick="openProblem('${p.id}')">
        <td style="white-space:nowrap">${probDate(p.date)}<div class="muted" style="font-size:10.5px">${(p.time||'').slice(0,5)}</div></td>
        <td><b>${p.project}</b></td><td>${p.cat}</td>
        <td style="max-width:320px">${(p.problem||'').slice(0,90)}${(p.problem||'').length>90?'…':''}</td>
        <td>${probPrio(p.prio)}</td><td>${probStatus(p.status)}</td><td>${hasIssueSolution(p)?'<span class="tag" style="color:var(--green)">✓ มีวิธีแก้</span>':'<span class="tag" style="color:var(--red)">ยังไม่มี</span>'}</td><td>${p.owner||'-'}</td><td style="white-space:nowrap">${probResT(p.resmin)}</td></tr>`).join('')||'<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:26px">ไม่พบปัญหาที่ตรงกับตัวกรอง</td></tr>'}
    </table></div>
    <div class="pad muted" style="font-size:11px">ที่มา: ${PROB_SRC.file} · แสดงล่าสุด ${Math.min(300,list.length)} รายการ · คลิกแถวเพื่อดูรายละเอียด</div>
  </div>`;
};
const ISSUE_SOLUTION_TYPES={unresolved:'ยังไม่ได้แก้',temporary:'วิธีแก้ชั่วคราว',reuse:'ใช้วิธีแก้เดิม',onsite:'แก้ตามขั้นตอนหน้างาน',provider:'ประสานผู้ให้บริการ',permanent:'แก้ถาวร',new_sop:'สร้าง/ปรับ SOP'};
function issueEsc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function issueReferenceCandidates(p){
  return PROBLEMS.filter(x=>x.id!==p.id&&x.solution).sort((a,b)=>{
    const as=(a.cat===p.cat?4:0)+(a.project===p.project?2:0)+(a.verified?1:0),bs=(b.cat===p.cat?4:0)+(b.project===p.project?2:0)+(b.verified?1:0);
    return bs-as||((b.date||'').localeCompare(a.date||''));
  }).slice(0,60);
}
function issueSolutionTypeChanged(){const b=document.getElementById('issueRefBox');if(b)b.style.display=val('issueSolutionType')==='reuse'?'block':'none';}
function issueReferenceChanged(){
  const id=val('issueReferenceId'),src=PROBLEMS.find(x=>x.id===id),preview=document.getElementById('issueRefPreview');
  if(preview)preview.innerHTML=src?`<button class="tbtn sm" type="button" onclick="openIssueReference('issue','${src.id}')">เปิดเคสต้นทาง ↗</button> <button class="tbtn sm" type="button" onclick="useIssueSolution('${src.id}')">นำวิธีแก้นี้มาใช้</button><div class="ai-note" style="margin-top:8px">${issueEsc(src.solution)}</div>`:'';
}
function useIssueSolution(id){const src=PROBLEMS.find(x=>x.id===id),el=document.getElementById('issueSolution');if(src&&el){el.value=src.solution;toast('นำวิธีแก้จาก '+id+' มาให้แล้ว');}}
function openIssueReference(type,id){if(type==='issue')openProblem(id);else if(type==='sop')openSOP(id);else if(type==='knowledge')openKB(id);}
function openProblem(id){
  const p=PROBLEMS.find(x=>x.id===id);if(!p)return;
  const refs=issueReferenceCandidates(p),type=p.solutionType||(p.solution?'permanent':'unresolved');
  const selectedRef=p.referenceType==='issue'?p.referenceId:'';
  const impact=[p.impactScope&&p.impactScope!=='unknown'?ISSUE_IMPACT_SCOPES[p.impactScope]:null,p.service,p.provider,p.impact].filter(Boolean),canEdit=canAdminAccess()||(AUTH_DB_ROLE==='lead'&&MANAGE_DEPTS.includes(p.dept||'ADMIN'));
  showModal(`<div class="modal-h"><div><div style="margin-bottom:6px"><span class="tag" style="background:#2158c822;color:#2158c8;border-color:#2158c855">${issueEsc(p.project)}</span> ${probPrio(p.prio)} ${probStatus(p.status)} ${hasIssueSolution(p)?'<span class="tag" style="color:var(--green)">✓ มีวิธีแก้แล้ว</span>':'<span class="tag" style="color:var(--red)">ยังไม่มีวิธีแก้</span>'} ${p.verified?'<span class="tag" style="background:#0b7a5a22;color:#0b7a5a;border-color:#0b7a5a55">✓ ยืนยันใช้ได้จริง</span>':''}</div>
    <h3>${issueEsc(p.cat)} — ${issueEsc(p.project)}</h3><div class="muted" style="font-size:11.5px">${issueEsc(p.id)} · แจ้งโดย ${issueEsc(p.reporter||'-')} · ${probDate(p.date)} ${(p.time||'').slice(0,5)}</div></div><button class="x" onclick="closeModal()">×</button></div>
  <div class="pad">
    <div class="field"><label>รายละเอียดปัญหา</label><div class="v">${issueEsc(p.problem||'-')}</div></div>
    ${impact.length||p.affectedCustomers!=null||p.affectedTransactions!=null||p.financialImpact!=null?`<div class="ai-note"><b>ผลกระทบ:</b> ${impact.map(issueEsc).join(' · ')||'มีข้อมูลเชิงตัวเลข'}<br><span class="muted">ลูกค้า ${p.affectedCustomers==null?'—':nf(p.affectedCustomers)} · รายการ ${p.affectedTransactions==null?'—':nf(p.affectedTransactions)} · มูลค่า ${p.financialImpact==null?'—':('฿'+Number(p.financialImpact).toLocaleString('th-TH'))}</span>${p.workaround?`<br><b>รับมือเบื้องต้น:</b> ${issueEsc(p.workaround)}`:''}${p.evidenceUrl?`<br><a href="${issueEsc(p.evidenceUrl)}" target="_blank" rel="noopener">เปิดหลักฐาน ↗</a>`:''}</div>`:''}
    <div class="two"><div class="field"><label>สถานะ</label><select class="fin" id="issueStatus" ${canEdit?'':'disabled'}><option value="Open" ${p.status==='Open'?'selected':''}>ยังไม่แก้</option><option value="In Progress" ${p.status==='In Progress'?'selected':''}>กำลังแก้</option><option value="Resolved" ${p.status==='Resolved'?'selected':''}>แก้แล้ว</option></select></div>
      <div class="field"><label>ผู้รับผิดชอบ</label><input class="fin" id="issueOwner" value="${issueEsc(p.owner||'')}" ${canEdit?'':'disabled'}></div></div>
    <div class="field"><label>สาเหตุราก (Root cause)</label><input class="fin" id="issueRootCause" maxlength="500" value="${issueEsc(p.rootCause||'')}" placeholder="ระบุสาเหตุที่ตรวจสอบแล้ว" ${canEdit?'':'disabled'}></div>
    <div class="field"><label>ประเภทวิธีแก้</label><select class="fin" id="issueSolutionType" onchange="issueSolutionTypeChanged()" ${canEdit?'':'disabled'}>${Object.entries(ISSUE_SOLUTION_TYPES).map(([k,v])=>`<option value="${k}" ${type===k?'selected':''}>${v}</option>`).join('')}</select></div>
    <div id="issueRefBox" class="field" style="display:${type==='reuse'?'block':'none'}"><label>ลิงก์ไปวิธีแก้เดิม (บังคับเมื่อเลือกใช้วิธีแก้เดิม)</label><select class="fin" id="issueReferenceId" onchange="issueReferenceChanged()"><option value="">— เลือกเคสที่มีวิธีแก้ —</option>${refs.map(x=>`<option value="${x.id}" ${selectedRef===x.id?'selected':''}>${x.id} · ${issueEsc(x.project)} · ${issueEsc((x.problem||'').slice(0,75))}</option>`).join('')}</select><div id="issueRefPreview"></div></div>
    <div class="field"><label>วิธีแก้ / ผลดำเนินการ</label><textarea class="fin" id="issueSolution" maxlength="4000" rows="5">${issueEsc(p.solution||'')}</textarea></div>
    <div class="field"><label>แนวทางป้องกันไม่ให้เกิดซ้ำ</label><textarea class="fin" id="issuePreventive" maxlength="4000" rows="3">${issueEsc(p.preventive||'')}</textarea></div>
    <div class="field"><label>เวลาแก้ (นาที)</label><input class="fin" type="number" min="0" step="1" id="issueResolutionMinutes" value="${p.resmin==null?'':p.resmin}"></div>
    <label class="ai-note" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer"><input type="checkbox" id="issueVerified" style="margin-top:3px" ${p.verified?'checked':''}><span><b>ยืนยันว่าทดสอบแล้วและวิธีแก้นี้ใช้ได้จริง</b><br><span class="muted">จะเลือกสถานะ “แก้แล้ว” ได้ต่อเมื่อกรอกวิธีแก้และติ๊กยืนยันข้อนี้</span></span></label>
    ${p.referenceType&&p.referenceId?`<div class="field" style="margin-top:12px"><button class="tbtn sm" onclick="openIssueReference('${p.referenceType}','${p.referenceId}')">เปิดแหล่งอ้างอิง ↗</button></div>`:''}
    ${canEdit?`<button class="tbtn primary" id="issueSaveBtn" style="margin-top:12px" onclick="saveIssueFollowup('${p.id}')">บันทึกการติดตาม</button>`:'<div class="ai-note">คุณติดตามเคสของตนเองได้ แต่การเปลี่ยนสถานะและยืนยันวิธีแก้เป็นสิทธิ์หัวหน้า/Admin</div>'}
  </div>`);
  if(selectedRef)setTimeout(issueReferenceChanged,0);
}
async function saveIssueFollowup(id){
  const p=PROBLEMS.find(x=>x.id===id);if(!p)return;
  const status=val('issueStatus'),solutionType=val('issueSolutionType'),solution=(val('issueSolution')||'').trim(),verified=!!document.getElementById('issueVerified')?.checked;
  const referenceId=solutionType==='reuse'?val('issueReferenceId'):'';
  if(status==='Resolved'&&!solution){toast('กรุณากรอกวิธีแก้ก่อนปิดเคส','info');return;}
  if(status==='Resolved'&&!verified){toast('ต้องยืนยันว่าทดสอบแล้วและใช้ได้จริง','info');return;}
  if(solutionType==='reuse'&&!referenceId){toast('กรุณาเลือกเคสวิธีแก้เดิมที่จะอ้างอิง','info');return;}
  if(!SB||!CLOUD){toast('ยังไม่เชื่อมฐานข้อมูล จึงยังบันทึกไม่ได้','info');return;}
  const btn=document.getElementById('issueSaveBtn');if(btn)btn.disabled=true;
  const minsRaw=val('issueResolutionMinutes'),payload={target_issue:id,next_status:status,next_owner:val('issueOwner'),next_root_cause:val('issueRootCause'),next_solution_type:solutionType,next_solution:solution,next_preventive_action:val('issuePreventive'),next_resolution_minutes:minsRaw===''?null:Number(minsRaw),next_reference_type:referenceId?'issue':'',next_reference_id:referenceId,confirm_effective:verified};
  try{
    const res=await SB.rpc('save_verified_issue_resolution',payload);if(res.error)throw res.error;
    Object.assign(p,{status,owner:payload.next_owner,rootCause:payload.next_root_cause,solutionType,solution,preventive:payload.next_preventive_action,resmin:payload.next_resolution_minutes,referenceType:payload.next_reference_type,referenceId,verified:status==='Resolved'&&verified,verifiedAt:res.data&&res.data.solution_verified_at});
    toast('บันทึกแล้ว'+(p.verified?' · ยืนยันว่าใช้ได้จริง':'') );refresh();openProblem(id);
  }catch(e){toast('บันทึกไม่สำเร็จ: '+(e.message||e),'info');if(btn)btn.disabled=false;}
}
function probAnswer(q){
  const s=q.toLowerCase(); let list=PROBLEMS.slice(); const parts=[];
  const proj=[...new Set(PROBLEMS.map(p=>p.project))].find(v=>s.includes(v.toLowerCase()));
  if(proj){list=list.filter(p=>p.project===proj);parts.push('โปรเจกต์ '+proj);}
  if(/payment|เพย|ฝาก|ถอน|pm/.test(s)){list=list.filter(p=>p.cat==='Payment');parts.push('หมวด Payment');}
  else if(/system|ระบบ|callback/.test(s)){list=list.filter(p=>p.cat==='System');parts.push('หมวด System');}
  let onlyOpen=false;
  if(/ยังไม่แก้|ค้าง|open|ยังไม่ได้แก้|ยังไม่เสร็จ/.test(s)){list=list.filter(p=>p.status!=='Resolved');onlyOpen=true;parts.push('สถานะยังไม่แก้');}
  if(/ไม่มีวิธีแก้|ยังไม่มีแนวทาง|ขาดวิธีแก้/.test(s)){const missing=list.filter(p=>!hasIssueSolution(p));return `<b>เคสที่ยังไม่มีวิธีแก้ ${nf(missing.length)} เคส</b><div style="margin-top:8px">${missing.slice(0,10).map(p=>`• <b>${esc(p.id)}</b> ${esc(p.project)} — ${esc((p.problem||'').slice(0,100))}`).join('<br>')||'ไม่พบเคสที่ขาดวิธีแก้'}</div><div style="margin-top:8px"><button class="tbtn sm" onclick="clearPF();PF.solution='no';go('problems')">เปิดรายการ →</button></div>`;}
  if(/สาเหตุ|root cause|เกิดจากอะไร|เพราะอะไร/.test(s)){const rows=probGroup(list,probCause).slice(0,8);return `<b>สาเหตุปัญหาหลักจาก ${nf(list.length)} เคส</b><table class="datatable" style="width:100%;margin-top:8px"><tr><th>สาเหตุ</th><th>เคส</th><th>ยังไม่แก้</th></tr>${rows.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${nf(v.length)}</td><td>${nf(v.filter(p=>p.status!=='Resolved').length)}</td></tr>`).join('')}</table>`;}
  if(/แนวทางแก้|วิธีแก้|แก้อย่างไร|solution/.test(s)){const rows=probGroup(list,probApproach).slice(0,8),withSolution=list.filter(hasIssueSolution).length;return `<b>แนวทางแก้จาก ${nf(list.length)} เคส</b><table class="datatable" style="width:100%;margin-top:8px"><tr><th>แนวทาง</th><th>เคส</th></tr>${rows.map(([k,v])=>`<tr><td>${esc(k)}</td><td>${nf(v.length)}</td></tr>`).join('')}</table><div style="margin-top:8px">มีวิธีแก้ ${nf(withSolution)} เคส · ยังขาด ${nf(list.length-withSolution)} เคส</div>`;}
  const open=list.filter(p=>p.status!=='Resolved').length, res=list.filter(p=>p.status==='Resolved').length;
  const avg=probAvgHrs(list);
  const byProj=probCounts(list,'project').slice(0,5), byCat=probCounts(list,'cat').slice(0,5);
  const title=parts.length?('ปัญหา ('+parts.join(' · ')+')'):'สรุปปัญหาทั้งหมด';
  return `<b>${title}: ${list.length} เคส</b> · ยังไม่แก้ ${open} · แก้แล้ว ${res} · เวลาแก้เฉลี่ย ${avg.toFixed(1)} ชม.
    <span class="q">SELECT project,cat,status,COUNT(*) FROM issues${parts.length?" WHERE "+parts.join(' AND '):''} GROUP BY ...</span>
    <table class="datatable" style="width:100%"><tr><th>โปรเจกต์</th><th>เคส</th></tr>${byProj.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    <div style="margin-top:6px">หมวดที่พบบ่อย: ${byCat.map(([k,v])=>k+' ('+v+')').join(' · ')}</div>
    <div style="margin-top:8px"><button class="tbtn sm" onclick="${onlyOpen?"clearPF();PF.status='Open';":"clearPF();"}${proj?`PF.project='${proj}';`:''}go('problems')">เปิดศูนย์ปัญหา →</button></div>`;
}


