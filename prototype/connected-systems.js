/* Native, read-only source results. Source credentials never enter Company Hub. */
(function(){
 if(window.COMPANY_CONNECTED_SYSTEMS)return;window.COMPANY_CONNECTED_SYSTEMS=true;
 const sources={audit:{name:'Audit',origin:'https://work89support.github.io',url:'https://work89support.github.io/Audit-Reconciliation-Control/company-hub.html?v=20260909-hub-pages',home:'https://work89support.github.io/Audit-Reconciliation-Control/#/exceptions'},domainwatch:{name:'Domainwatch',origin:'https://domain-watch-app-sandy.vercel.app',url:'https://domain-watch-app-sandy.vercel.app/api/company-hub',home:'https://domain-watch-app-sandy.vercel.app/incidents'}};
 const groups={AUD123:{name:'ออดิทส่วนกลาง',source:'audit'},ADMIN:{name:'แอดมิน',source:'domainwatch'},PROG:{name:'IT / โปรแกรมเมอร์',source:'domainwatch'}};
 const cache={};let active='AUD123',pending=null,identity=null,page=0,company='',notice='';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let from=today.slice(0,7)+'-01',to=today;
 const safe=x=>esc(String(x??''));
 const allowed=()=>Object.keys(groups).filter(k=>canViewDept(k));
 function resetIdentity(){const id=ACCESS_PROFILE?.id||null;if(id!==identity){Object.keys(cache).forEach(k=>delete cache[k]);pending=null;identity=id;company='';page=0;}}
 function rowsFor(data){return (data?.rows||[]).filter(r=>active!=='PROG'||!r.id.startsWith('MOBILE:')).map(r=>({...r,minutes:active==='ADMIN'?r.adminMin:active==='PROG'?r.itMin:null}));}
 function summary(rows){
  const closed=rows.filter(r=>r.closed===true).length,paused=rows.filter(r=>!r.closed&&r.status==='PAUSED').length;
  const minutes=rows.map(r=>r.minutes).filter(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0);
  return {total:rows.length,closed,paused,open:rows.length-closed-paused,waiting:rows.filter(r=>r.waiting===true).length,
   rate:rows.length?(closed/rows.length*100).toFixed(1):null,
   average:minutes.length?(minutes.reduce((a,b)=>a+b,0)/minutes.length).toFixed(1):null,timed:minutes.length};
 }
 function current(){resetIdentity();return cache[groups[active]?.source];}
 NAV.connectedSystems={t:'ผลประเมินทีม',ic:'i-grid'};
 const navGroup=NAVGROUPS.find(g=>g.label==='วัดผล & รายงาน');if(navGroup&&!navGroup.items.includes('connectedSystems'))navGroup.items.push('connectedSystems');
 for(const roles of [ROLE_ALLOW,SIMPLE_ALLOW])for(const allow of Object.values(roles))if(!allow.includes('connectedSystems'))allow.push('connectedSystems');
 function connect(){
  resetIdentity();if(!ACCESS_PROFILE||!allowed().includes(active))return;
  if(!from||!to||to>today||Date.parse(to)<Date.parse(from)||Date.parse(to)-Date.parse(from)>31*86400000){notice='เลือกช่วงวันที่ไม่เกิน 32 วัน';RENDER.connectedSystems();return;}
  const source=groups[active].source,s=sources[source],nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  const range=new URLSearchParams({from,to}),url=source==='audit'?`${s.url}#${range}&nonce=${nonce}`:`${s.url}?${range}#nonce=${nonce}`;
  const win=window.open(url,'_blank','popup,width=680,height=620');
  if(!win){notice='เบราว์เซอร์ปิดกั้นหน้าต่างเชื่อมบัญชี กรุณาอนุญาตป็อปอัพแล้วลองอีกครั้ง';}
  else{pending={win,nonce,source,identity,from,to,started:Date.now()};notice='กด “แสดงผลใน Company Hub” ที่หน้าต่างเชื่อมบัญชี แล้วผลจะปรากฏที่หน้านี้';}
  RENDER.connectedSystems();
 }
 window.addEventListener('message',event=>{
  resetIdentity();const p=pending,m=event.data;
  if(!p||Date.now()-p.started>300000||event.source!==p.win||event.origin!==sources[p.source].origin||m?.type!=='company-hub-results'||m.nonce!==p.nonce||m.source!==p.source||p.identity!==ACCESS_PROFILE?.id)return;
  const d=m.data;if(!d||d.version!==1||d.from!==p.from||d.to!==p.to||!Array.isArray(d.rows)||d.rows.length>100000||!Number.isFinite(Date.parse(d.fetchedAt)))return;
  if(!d.rows.every(r=>r&&typeof r.id==='string'&&typeof r.title==='string'))return;
  cache[p.source]=d;pending=null;company='';page=0;notice='เชื่อมผลจริงเรียบร้อยแล้ว';
  if(VIEW==='connectedSystems')RENDER.connectedSystems();
 });
 RENDER.connectedSystems=function(){
  resetIdentity();if(!ACCESS_PROFILE){main.innerHTML='<p>กรุณาเข้าสู่ Company Hub ก่อนดูผล</p>';return;}
  const access=allowed();if(!access.includes(active))active=access[0];
  if(!active){main.innerHTML='<section class="card cr-empty"><h2>ผลประเมินทีม</h2><p>แสดงผลตามสิทธิ์ของทีมออดิท แอดมิน และ IT / โปรแกรมเมอร์</p></section>';return;}
  const s=sources[groups[active].source],data=current(),valid=data&&data.from===from&&data.to===to,audit=active==='AUD123';
  const all=valid?[...new Map(rowsFor(data).map(r=>[r.id,r])).values()]:[];
  const allRuns=valid?[...new Map((data.runs||[]).map(r=>[r.id||JSON.stringify(r),r])).values()]:[];
  const companyName=r=>r.company||'ไม่ระบุบริษัท';
  const companies=[...new Set([...all,...allRuns].map(companyName))].sort();
  const rows=all.filter(r=>!company||companyName(r)===company),runs=allRuns.filter(r=>!company||companyName(r)===company),stats=summary(rows);
  const count=x=>valid?nf(x):'—';
  const metrics=audit?[['รอบตรวจ',count(runs.length)],['เคสผิดปกติ',count(stats.total)],['รอชี้แจง',count(stats.waiting)],['ปิด / รับรองแล้ว',count(stats.closed)]]:[['เหตุการณ์ทั้งหมด',count(stats.total)],['ยังไม่ปิด',count(stats.open)],['ปิดแล้ว',count(stats.closed)],['พักดำเนินการ',count(stats.paused)]];
  const companyRows=companies.filter(c=>!company||c===company).map(c=>({name:c,...summary(all.filter(r=>companyName(r)===c)),runs:allRuns.filter(r=>companyName(r)===c).length}));
  page=Math.max(0,Math.min(page,Math.ceil(rows.length/25)-1));
  main.innerHTML=`${crumb('หน้าแรก','ผลประเมินทีม')}<div class="page-h"><div><h1>ผลประเมินทีม</h1><p>ภาพรวมผลงานรายเดือนจาก Audit และ Domainwatch</p></div></div>
  <nav class="cr-tabs" aria-label="ทีม">${access.map(k=>`<button data-department="${k}" class="${active===k?'selected':''}" aria-pressed="${active===k}">${groups[k].name}<small>${sources[groups[k].source].name}</small></button>`).join('')}</nav>
  <section class="card cr-panel"><div class="cr-heading"><div><h2>${groups[active].name}</h2><p>${safe(from)} – ${safe(to)} · ${valid?'อ่านผลเมื่อ '+safe(new Date(data.fetchedAt).toLocaleString('th-TH')):'รอเชื่อมผลจริง'} · ตามสิทธิ์บัญชี ${s.name}</p></div><button class="tbtn primary" id="cr-connect">${valid?'อัปเดตผลทีม':'เชื่อมผลจริง'}</button></div>
  <div class="cr-filters"><label>เดือนประเมิน<input id="cr-month" type="month" max="${today.slice(0,7)}" value="${safe(from.slice(0,7))}"></label><label>ตั้งแต่<input id="cr-from" type="date" value="${safe(from)}"></label><label>ถึง<input id="cr-to" type="date" max="${today}" value="${safe(to)}"></label><label>บริษัท<select id="cr-company"><option value="">ทุกบริษัทที่มีสิทธิ์</option>${companies.map(c=>`<option ${c===company?'selected':''} value="${safe(c)}">${safe(c)}</option>`).join('')}</select></label></div>
  ${notice?`<p role="status" class="cr-notice">${safe(notice)}</p>`:''}
  ${valid&&data.partial?'<p role="status" class="cr-warning">ข้อมูลบางส่วน — ยังใช้สรุปทั้งทีมไม่ได้ กรุณาลดช่วงวันที่แล้วเชื่อมผลใหม่</p>':''}
  <div class="cr-metrics">${metrics.map(([label,value])=>`<article><span>${label}</span><strong>${value}</strong></article>`).join('')}</div>
  ${valid?`<div class="cr-team-summary"><article><span>สัดส่วนเคสที่ปิด${data.partial?' (เฉพาะข้อมูลที่โหลด)':''}</span><strong>${stats.rate===null?'ไม่มีเคสในช่วงนี้':stats.rate+'%'}</strong>${stats.rate===null?'':`<progress max="100" value="${stats.rate}" aria-label="สัดส่วนเคสที่ปิด"></progress>`}<small>${nf(stats.closed)} จาก ${nf(stats.total)} เคส · เป็นสัดส่วนผลงาน ไม่ใช่คะแนน KPI</small></article>${audit?`<article><span>เคสที่ยังไม่ปิด</span><strong>${nf(stats.total-stats.closed)} เคส</strong><small>รอชี้แจง ${nf(stats.waiting)} เคส · สถานะอ้างอิงต้นทาง</small></article>`:`<article><span>เวลาเฉลี่ยที่บันทึกของทีม</span><strong>${stats.average===null?'ยังไม่มีข้อมูลเวลา':stats.average+' นาที'}</strong><small>คำนวณจาก ${nf(stats.timed)} / ${nf(stats.total)} เคสที่มีค่าเวลา · ${active==='ADMIN'?'เวลาฝั่งแอดมิน':'เวลาฝั่ง IT (ไม่รวมเคสมือถือ)'}</small></article>`}</div>`:''}
  ${!valid?`<div class="cr-empty"><h3>เชื่อมบัญชี ${s.name} เพื่ออ่านผลทีม</h3><p>เลือกเดือนแล้วกดเชื่อมผลจริง จากนั้นกด “แสดงผลใน Company Hub” ที่หน้าต่างต้นทาง</p><a href="${s.home}" target="_blank" rel="noopener noreferrer">เข้าสู่ระบบ ${s.name} ↗</a></div>`:!companyRows.length?'<div class="cr-empty">ไม่พบข้อมูลในช่วงนี้ ยังไม่มีผลสำหรับประเมินทีม</div>':`<div class="cr-company-summary"><h3>สรุปแยกบริษัท</h3><div class="cr-table"><table><thead><tr><th>บริษัท</th><th>${audit?'รอบตรวจ':'เหตุการณ์'}</th>${audit?'<th>เคสผิดปกติ</th>':''}<th>ปิดแล้ว</th><th>${audit?'รอชี้แจง':'ยังไม่ปิด / พัก'}</th><th>สัดส่วนปิด</th>${audit?'':'<th>เวลาเฉลี่ย / จำนวนที่มีเวลา</th>'}</tr></thead><tbody>${companyRows.map(r=>`<tr><td><strong>${safe(r.name)}</strong></td><td>${nf(audit?r.runs:r.total)}</td>${audit?`<td>${nf(r.total)}</td>`:''}<td>${nf(r.closed)}</td><td>${audit?nf(r.waiting):nf(r.open)+' / '+nf(r.paused)}</td><td>${r.rate===null?'—':r.rate+'%'}</td>${audit?'':`<td>${r.average===null?'—':r.average+' นาที'}<small>${nf(r.timed)} / ${nf(r.total)} เคส</small></td>`}</tr>`).join('')}</tbody></table></div></div>`}
  ${valid&&rows.length?`<details class="cr-runs"><summary>ดูเคสประกอบผลทีม (${nf(rows.length)} เคส)</summary><div class="cr-table"><table><thead><tr><th>งาน / เคส</th><th>บริษัท</th><th>สถานะต้นทาง</th><th>${audit?'วันที่งาน':'เวลา (นาที)'}</th></tr></thead><tbody>${rows.slice(page*25,page*25+25).map(r=>`<tr><td><strong>${safe(r.title)}</strong><small>${safe(r.id)} · ${safe(r.date?.slice(0,10))}</small></td><td>${safe(companyName(r))}</td><td>${safe(r.status)}</td><td>${audit?safe(r.date):typeof r.minutes==='number'&&Number.isFinite(r.minutes)&&r.minutes>=0?nf(r.minutes):'—'}</td></tr>`).join('')}</tbody></table></div><div class="cr-pagination"><button class="tbtn" id="cr-prev" ${page===0?'disabled':''}>ก่อนหน้า</button><span>${page*25+1}–${Math.min(rows.length,page*25+25)} จาก ${nf(rows.length)}</span><button class="tbtn" id="cr-next" ${(page+1)*25>=rows.length?'disabled':''}>ถัดไป</button></div></details>`:''}
  ${valid&&audit?`<details class="cr-runs"><summary>ผลจับคู่จากรอบตรวจ (${nf(runs.length)} รอบ)</summary><div class="cr-table"><table><thead><tr><th>วันที่</th><th>บริษัท</th><th>สถานะรอบ</th><th>จับคู่ได้</th></tr></thead><tbody>${runs.map(r=>`<tr><td>${safe(r.date)}</td><td>${safe(companyName(r))}</td><td>${safe(r.status)}</td><td>${r.matched==null?'ยังไม่มีผล':nf(r.matched)}</td></tr>`).join('')}</tbody></table></div></details>`:''}
  ${valid&&Array.isArray(data.links)?`<details class="cr-runs"><summary>สถานะลิงก์ปัจจุบัน (ทุกบริษัทที่มีสิทธิ์)</summary><p>ภาพรวม ณ เวลาอ่านผล ไม่กรองตามเดือนหรือบริษัทด้านบน</p><p>${data.links.map(x=>safe(x.status)+' '+nf(x.count)+' ลิงก์').join(' · ')}</p></details>`:''}
  <p class="cr-note">ข้อมูลแสดงเป็นภาพรวมทีมตามสิทธิ์บัญชีต้นทาง ไม่มีการให้คะแนนรายบุคคล · ผลจะอ่านใหม่เมื่อกดอัปเดตหรือเปิดหน้าใหม่</p>
  </section>`;
  main.querySelectorAll('[data-department]').forEach(b=>b.onclick=()=>{active=b.dataset.department;company='';page=0;notice='';RENDER.connectedSystems();});
  main.querySelector('#cr-connect').onclick=connect;
  main.querySelector('#cr-month').onchange=e=>{const month=e.target.value;if(!/^\d{4}-\d{2}$/.test(month)||month>today.slice(0,7))return;from=month+'-01';const [year,m]=month.split('-').map(Number);const last=month+'-'+String(new Date(Date.UTC(year,m,0)).getUTCDate()).padStart(2,'0');to=last>today?today:last;page=0;notice='';RENDER.connectedSystems();};
  for(const key of ['from','to','company'])main.querySelector('#cr-'+key).onchange=e=>{if(key==='from')from=e.target.value;if(key==='to')to=e.target.value;if(key==='company')company=e.target.value;page=0;notice='';RENDER.connectedSystems();};
  const prev=main.querySelector('#cr-prev'),next=main.querySelector('#cr-next');if(prev)prev.onclick=()=>{page--;RENDER.connectedSystems();main.querySelector('.cr-runs').open=true;};if(next)next.onclick=()=>{page++;RENDER.connectedSystems();main.querySelector('.cr-runs').open=true;};
 };
 const dashboard=RENDER.dash;RENDER.dash=function(...args){resetIdentity();const r=dashboard(...args);if(ACCESS_PROFILE&&allowed().length&&!document.getElementById('connected-shortcut')){const box=document.createElement('section');box.id='connected-shortcut';box.className='card cr-heading';box.innerHTML='<div><h3>ผลประเมินทีม</h3><p>ผลออดิท และเคสแอดมิน / IT จากระบบต้นทาง</p></div><button class="tbtn primary">ดูผลจริง →</button>';box.querySelector('button').onclick=()=>go('connectedSystems');main.append(box);}return r;};
 const css=document.createElement('style');css.textContent=`.cr-team-summary{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px}.cr-team-summary article{padding:22px;background:#f6faf9;border:1px solid #dcebe5;border-radius:14px}.cr-team-summary span,.cr-team-summary small{display:block;color:var(--muted);line-height:1.7}.cr-team-summary strong{display:block;font-size:26px;margin:8px 0;color:#176747}.cr-team-summary progress{width:100%;height:12px;accent-color:#23835d}.cr-company-summary h3{margin:24px}.cr-panel{overflow:hidden}.cr-tabs{display:flex;gap:12px;margin:20px 0;flex-wrap:wrap}.cr-tabs button{flex:1;min-width:150px;padding:18px;border:1px solid var(--line);border-radius:14px;background:white;font:inherit;text-align:left;cursor:pointer;color:var(--ink)}.cr-tabs button.selected{background:#edf4ff;border-color:#3575de;box-shadow:0 3px 12px #2457c515}.cr-tabs small,.cr-table small{display:block;color:var(--muted);margin-top:5px;font-size:12px}.cr-heading{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:24px}.cr-heading h2{margin:0;font-size:22px}.cr-heading p,.cr-note{color:var(--muted);font-size:13px}.cr-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:0 24px 24px}.cr-filters label{font-size:13px;color:var(--muted)}.cr-filters input,.cr-filters select{display:block;width:100%;margin-top:8px;border:1px solid var(--line);padding:11px;border-radius:9px;background:white;font:inherit;color:var(--ink)}.cr-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:0 24px}.cr-metrics article{background:#f5f8ff;border:1px solid #e1eafa;border-radius:13px;padding:20px}.cr-metrics span{display:block;font-size:13px;color:var(--muted)}.cr-metrics strong{display:block;margin-top:10px;font-size:28px;color:#204ca3}.cr-note,.cr-notice,.cr-warning{margin:20px 24px;line-height:1.7}.cr-notice{background:#edf4ff;padding:14px;border-radius:10px}.cr-warning{background:#fff3d5;padding:14px}.cr-empty{padding:40px;text-align:center;color:var(--muted);line-height:1.8}.cr-table{overflow:auto;padding:0 24px}.cr-table table{width:100%;border-collapse:collapse}.cr-table th{text-align:left;background:#f8faff;font-size:12px;color:var(--muted)}.cr-table td,.cr-table th{padding:16px 12px;border-bottom:1px solid #edf0f6}.cr-table td{font-size:13px}.cr-status{display:inline-block;padding:5px 9px;border-radius:8px;background:#fff3d5;white-space:nowrap}.cr-status.done{background:#e5f6ef;color:#237554}.cr-pagination{display:flex;justify-content:flex-end;gap:16px;align-items:center;padding:20px 24px}.cr-runs{margin:24px}.cr-runs summary{cursor:pointer;font-weight:600}.cr-heading#connected-shortcut{margin-top:20px}@media(max-width:700px){.cr-team-summary{grid-template-columns:1fr;margin:16px;}.cr-filters,.cr-metrics{grid-template-columns:1fr 1fr}.cr-heading{align-items:flex-start;flex-direction:column}.cr-metrics strong{font-size:23px}.cr-table{padding:0 12px}}`;
 document.head.append(css);buildNav();if(VIEW==='dash')RENDER.dash();
})();

