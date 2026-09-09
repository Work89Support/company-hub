/* Native, read-only source results. Source credentials never enter Company Hub. */
(function(){
 if(window.COMPANY_CONNECTED_SYSTEMS)return;window.COMPANY_CONNECTED_SYSTEMS=true;
 const sources={audit:{name:'Audit',origin:'https://work89support.github.io',url:'https://work89support.github.io/Audit-Reconciliation-Control/company-hub.html',home:'https://work89support.github.io/Audit-Reconciliation-Control/#/exceptions'},domainwatch:{name:'Domainwatch',origin:'https://domain-watch-app-sandy.vercel.app',url:'https://domain-watch-app-sandy.vercel.app/api/company-hub',home:'https://domain-watch-app-sandy.vercel.app/incidents'}};
 const groups={AUD123:{name:'ออดิทส่วนกลาง',source:'audit'},ADMIN:{name:'แอดมิน',source:'domainwatch'},PROG:{name:'IT / โปรแกรมเมอร์',source:'domainwatch'}};
 const cache={};let active='AUD123',pending=null,identity=null,page=0,company='',person='',notice='';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let from=today.slice(0,7)+'-01',to=today;
 const safe=x=>esc(String(x??''));
 const allowed=()=>Object.keys(groups).filter(k=>canViewDept(k));
 function resetIdentity(){const id=ACCESS_PROFILE?.id||null;if(id!==identity){Object.keys(cache).forEach(k=>delete cache[k]);pending=null;identity=id;company='';person='';page=0;}}
 function rowsFor(data){return (data?.rows||[]).filter(r=>active!=='PROG'||!r.id.startsWith('MOBILE:')).map(r=>({...r,personId:active==='AUD123'?r.ownerId:active==='ADMIN'?r.adminId:r.itId,person:active==='AUD123'?r.owner:active==='ADMIN'?r.admin:r.it,minutes:active==='ADMIN'?r.adminMin:active==='PROG'?r.itMin:null}));}
 function current(){resetIdentity();return cache[groups[active]?.source];}
 NAV.connectedSystems={t:'ผลระบบตามแผนก',ic:'i-grid'};
 const navGroup=NAVGROUPS.find(g=>g.label==='วัดผล & รายงาน');if(navGroup&&!navGroup.items.includes('connectedSystems'))navGroup.items.push('connectedSystems');
 for(const roles of [ROLE_ALLOW,SIMPLE_ALLOW])for(const allow of Object.values(roles))if(!allow.includes('connectedSystems'))allow.push('connectedSystems');
 function connect(){
  resetIdentity();if(!ACCESS_PROFILE||!allowed().includes(active))return;
  if(!from||!to||Date.parse(to)<Date.parse(from)||Date.parse(to)-Date.parse(from)>31*86400000){notice='เลือกช่วงวันที่ไม่เกิน 32 วัน';RENDER.connectedSystems();return;}
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
  const d=m.data;if(!d||d.version!==1||d.from!==p.from||d.to!==p.to||!Array.isArray(d.rows)||d.rows.length>10002||!Number.isFinite(Date.parse(d.fetchedAt)))return;
  if(!d.rows.every(r=>r&&typeof r.id==='string'&&typeof r.title==='string'))return;
  cache[p.source]=d;pending=null;company='';person='';page=0;notice='เชื่อมผลจริงเรียบร้อยแล้ว';
  if(VIEW==='connectedSystems')RENDER.connectedSystems();
 });
 RENDER.connectedSystems=function(){
  resetIdentity();if(!ACCESS_PROFILE){main.innerHTML='<p>กรุณาเข้าสู่ Company Hub ก่อนดูผล</p>';return;}
  const access=allowed();if(!access.includes(active))active=access[0];
  if(!active){main.innerHTML='<section class="card cr-empty"><h2>ผลระบบตามแผนก</h2><p>ส่วนนี้ใช้กับออดิทส่วนกลาง แอดมิน และ IT / โปรแกรมเมอร์ ตามสิทธิ์แผนกของคุณ</p></section>';return;}
  const s=sources[groups[active].source],data=current(),valid=data&&data.from===from&&data.to===to;
  const all=valid?[...new Map(rowsFor(data).map(r=>[r.id,r])).values()]:[],companies=[...new Set([...all.map(r=>r.company),...(valid?data.runs||[]:[]).map(r=>r.company)].filter(Boolean))].sort();
  const people=new Map(all.filter(r=>!company||r.company===company).map(r=>[r.personId||'unassigned',r.person||'ยังไม่มอบหมาย']));
  const rows=all.filter(r=>(!company||r.company===company)&&(!person||(r.personId||'unassigned')===person));
  const values=rows.map(r=>r.minutes).filter(n=>typeof n==='number'&&Number.isFinite(n));
  const average=values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)+' นาที':'—';
  const count=x=>valid?nf(x):'—';
  const runs=(valid?data.runs||[]:[]).filter(r=>!company||r.company===company);
  const metrics=active==='AUD123'?[['เคสผิดปกติ',count(rows.length)],['รอชี้แจง',count(rows.filter(r=>r.waiting).length)],['ปิด / รับรองแล้ว',count(rows.filter(r=>r.closed).length)],['รอบตรวจ',person?'—':count(runs.length)]]:[['เหตุการณ์',count(rows.length)],['เคสยังไม่ปิด',count(rows.filter(r=>!r.closed&&r.status!=='PAUSED').length)],['ปิดแล้ว',count(rows.filter(r=>r.closed).length)],['เวลาเฉลี่ยที่บันทึก',valid?average:'—']];
  page=Math.max(0,Math.min(page,Math.ceil(rows.length/25)-1));
  main.innerHTML=`${crumb('หน้าแรก','ผลระบบตามแผนก')}<div class="page-h"><div><h1>ผลระบบตามแผนก</h1><p>ผลงานจริงจากต้นทาง แยกหน้าที่และผู้รับผิดชอบ</p></div></div>
  <nav class="cr-tabs" aria-label="แผนก">${access.map(k=>`<button data-department="${k}" class="${active===k?'selected':''}" aria-pressed="${active===k}">${groups[k].name}<small>${sources[groups[k].source].name}</small></button>`).join('')}</nav>
  <section class="card cr-panel"><div class="cr-heading"><div><h2>${groups[active].name}</h2><p>${valid?'อ่านผลเมื่อ '+safe(new Date(data.fetchedAt).toLocaleString('th-TH')):'ยังไม่ได้เชื่อมผลสำหรับช่วงวันที่นี้'} · ตามสิทธิ์บัญชี ${s.name}</p></div><button class="tbtn primary" id="cr-connect">${valid?'อัปเดตผล':'เชื่อมผลจริง'}</button></div>
  <div class="cr-filters"><label>ตั้งแต่<input id="cr-from" type="date" value="${safe(from)}"></label><label>ถึง<input id="cr-to" type="date" value="${safe(to)}"></label><label>บริษัท<select id="cr-company"><option value="">ทุกบริษัทที่มีสิทธิ์</option>${companies.map(c=>`<option ${c===company?'selected':''} value="${safe(c)}">${safe(c)}</option>`).join('')}</select></label><label>ผู้รับผิดชอบต้นทาง<select id="cr-person"><option value="">ทุกคน</option>${[...people].map(([id,n])=>`<option ${person===id?'selected':''} value="${safe(id)}">${safe(n)}</option>`).join('')}</select></label></div>
  ${notice?`<p role="status" class="cr-notice">${safe(notice)}</p>`:''}
  ${valid&&data.partial?'<p class="cr-warning">ข้อมูลถึงขีดจำกัดการอ่าน ยอดด้านล่างเป็นเฉพาะรายการที่โหลดได้ กรุณาลดช่วงวันที่เพื่อดูยอดครบ</p>':''}
  <div class="cr-metrics">${metrics.map(([label,value])=>`<article><span>${label}</span><strong>${value}</strong></article>`).join('')}</div>
  ${valid&&Array.isArray(data.links)?`<div class="cr-note"><strong>สถานะลิงก์ที่เฝ้าดู ณ เวลาอ่านผล (ทุกบริษัทที่บัญชีต้นทางมีสิทธิ์ ไม่กรองตามวันหรือบุคคล)</strong><p>${data.links.map(x=>safe(x.status)+' '+nf(x.count)+' ลิงก์').join(' · ')}</p></div>`:''}
  <p class="cr-note">ผลต้นทางเป็นหลักฐานประกอบ ยังไม่รวมเข้าคะแนน KPI ที่หัวหน้ารับรอง · ชื่อและรหัสบุคคลอ้างอิง ${s.name} ไม่จับคู่บัญชีจากชื่อซ้ำ</p>
  ${!valid?`<div class="cr-empty"><h3>เชื่อมบัญชี ${s.name} เพื่ออ่านผล</h3><p>กดเชื่อมผลจริง แล้วกดส่งผลในหน้าต่างต้นทาง ผลจะแสดงเป็นตารางที่นี่</p><a href="${s.home}" target="_blank" rel="noopener noreferrer">เข้าสู่ระบบ ${s.name} ↗</a></div>`:!rows.length?'<div class="cr-empty">ไม่พบรายการในช่วงวันที่และตัวกรองที่เลือก</div>':`<div class="cr-table"><table><thead><tr><th>งาน / เคส</th><th>บริษัท</th><th>ผู้รับผิดชอบ</th><th>สถานะต้นทาง</th><th>${active==='AUD123'?'วันที่งาน':'เวลา (นาที)'}</th></tr></thead><tbody>${rows.slice(page*25,page*25+25).map(r=>`<tr><td><strong>${safe(r.title)}</strong><small>${safe(r.id)} · ${safe(r.date?.slice(0,10))}</small></td><td>${safe(r.company||'ไม่ระบุ')}</td><td>${safe(r.person||'ยังไม่มอบหมาย')}</td><td><span class="cr-status ${r.closed?'done':''}">${safe(r.status)}</span></td><td>${active==='AUD123'?safe(r.date):typeof r.minutes==='number'?nf(r.minutes):'ยังไม่มีค่าที่เปิดดูได้'}</td></tr>`).join('')}</tbody></table></div><div class="cr-pagination"><button class="tbtn" id="cr-prev" ${page===0?'disabled':''}>ก่อนหน้า</button><span>${page*25+1}–${Math.min(rows.length,page*25+25)} จาก ${nf(rows.length)}</span><button class="tbtn" id="cr-next" ${(page+1)*25>=rows.length?'disabled':''}>ถัดไป</button></div>`}
  ${valid&&active==='AUD123'&&!person?`<details class="cr-runs"><summary>ผลจับคู่แยกบริษัทและรอบวัน (${runs.length} รอบ)</summary><div class="cr-table"><table><thead><tr><th>วันที่</th><th>บริษัท</th><th>สถานะรอบ</th><th>จับคู่ได้</th></tr></thead><tbody>${runs.map(r=>`<tr><td>${safe(r.date)}</td><td>${safe(r.company)}</td><td>${safe(r.status)}</td><td>${r.matched==null?'ยังไม่มีผล':nf(r.matched)}</td></tr>`).join('')}</tbody></table></div></details>`:''}
  </section>`;
  main.querySelectorAll('[data-department]').forEach(b=>b.onclick=()=>{active=b.dataset.department;company='';person='';page=0;notice='';RENDER.connectedSystems();});
  main.querySelector('#cr-connect').onclick=connect;
  for(const key of ['from','to','company','person'])main.querySelector('#cr-'+key).onchange=e=>{if(key==='from')from=e.target.value;if(key==='to')to=e.target.value;if(key==='company'){company=e.target.value;person='';}if(key==='person')person=e.target.value;page=0;notice='';RENDER.connectedSystems();};
  const prev=main.querySelector('#cr-prev'),next=main.querySelector('#cr-next');if(prev)prev.onclick=()=>{page--;RENDER.connectedSystems();};if(next)next.onclick=()=>{page++;RENDER.connectedSystems();};
 };
 const dashboard=RENDER.dash;RENDER.dash=function(...args){resetIdentity();const r=dashboard(...args);if(ACCESS_PROFILE&&allowed().length&&!document.getElementById('connected-shortcut')){const box=document.createElement('section');box.id='connected-shortcut';box.className='card cr-heading';box.innerHTML='<div><h3>ผลระบบตามแผนก</h3><p>ผลออดิท และเคสแอดมิน / IT จากระบบต้นทาง</p></div><button class="tbtn primary">ดูผลจริง →</button>';box.querySelector('button').onclick=()=>go('connectedSystems');main.append(box);}return r;};
 const css=document.createElement('style');css.textContent=`.cr-tabs{display:flex;gap:12px;margin:20px 0;flex-wrap:wrap}.cr-tabs button{flex:1;min-width:150px;padding:18px;border:1px solid var(--line);border-radius:14px;background:white;font:inherit;text-align:left;cursor:pointer;color:var(--ink)}.cr-tabs button.selected{background:#edf4ff;border-color:#3575de;box-shadow:0 3px 12px #2457c515}.cr-tabs small,.cr-table small{display:block;color:var(--muted);margin-top:5px;font-size:12px}.cr-heading{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:24px}.cr-heading h2{margin:0;font-size:22px}.cr-heading p,.cr-note{color:var(--muted);font-size:13px}.cr-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:0 24px 24px}.cr-filters label{font-size:13px;color:var(--muted)}.cr-filters input,.cr-filters select{display:block;width:100%;margin-top:8px;border:1px solid var(--line);padding:11px;border-radius:9px;background:white;font:inherit;color:var(--ink)}.cr-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:0 24px}.cr-metrics article{background:#f5f8ff;border:1px solid #e1eafa;border-radius:13px;padding:20px}.cr-metrics span{display:block;font-size:13px;color:var(--muted)}.cr-metrics strong{display:block;margin-top:10px;font-size:28px;color:#204ca3}.cr-note,.cr-notice,.cr-warning{margin:20px 24px;line-height:1.7}.cr-notice{background:#edf4ff;padding:14px;border-radius:10px}.cr-warning{background:#fff3d5;padding:14px}.cr-empty{padding:40px;text-align:center;color:var(--muted);line-height:1.8}.cr-table{overflow:auto;padding:0 24px}.cr-table table{width:100%;border-collapse:collapse}.cr-table th{text-align:left;background:#f8faff;font-size:12px;color:var(--muted)}.cr-table td,.cr-table th{padding:16px 12px;border-bottom:1px solid #edf0f6}.cr-table td{font-size:13px}.cr-status{display:inline-block;padding:5px 9px;border-radius:8px;background:#fff3d5;white-space:nowrap}.cr-status.done{background:#e5f6ef;color:#237554}.cr-pagination{display:flex;justify-content:flex-end;gap:16px;align-items:center;padding:20px 24px}.cr-runs{margin:24px}.cr-runs summary{cursor:pointer;font-weight:600}.cr-heading#connected-shortcut{margin-top:20px}@media(max-width:700px){.cr-filters,.cr-metrics{grid-template-columns:1fr 1fr}.cr-heading{align-items:flex-start;flex-direction:column}.cr-metrics strong{font-size:23px}.cr-table{padding:0 12px}}`;
 document.head.append(css);buildNav();if(VIEW==='dash')RENDER.dash();
})();
