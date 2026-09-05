/* Read the existing RLS-scoped work; names are never treated as login IDs. */
let TEAM_BOARD={department:'',person:'',group:'person',query:'',limit:30};
NAV.teamBoard={ic:'i-grid',t:'บอร์ดทีม / รายคน'};
NAVGROUPS[0].items.splice(1,0,'teamBoard');
for(const roles of [ROLE_ALLOW,SIMPLE_ALLOW])for(const role of Object.keys(roles))if(!roles[role].includes('teamBoard'))roles[role].push('teamBoard');
function teamAccountName(id,fallback){return TASK_PROFILES.find(p=>p.id===id)?.display_name||fallback||'ยังไม่ระบุชื่อ';}
function teamPersonKey(department,name){return 'name:'+JSON.stringify([department,String(name||'').trim()]);}
function teamWorkPeople(work){
 if(work._source==='graphic'){
  const job=GRAPHIC_JOBS.find(j=>j.id===work.id);if(!job)return [];
  const members=gpJobMemberRows(job.id).map(m=>({id:m.profile_id||m.linked_profile_id,name:m.full_name||m.username}));
  if(job.assignee_id||!members.length)members.push({id:job.assignee_id,name:job.assignee_name||'ยังไม่มอบหมาย'});
  return [...new Map(members.map(m=>{const key=m.id?'user:'+m.id:teamPersonKey(work.dept,m.name);return [key,{key,name:teamAccountName(m.id,m.name),linked:!!m.id}];})).values()];
 }
 if(work._source==='activity'){
  const row=work.sourceRow||{};return [{key:row.employee_id?'user:'+row.employee_id:teamPersonKey(work.dept,row.employee_name),name:teamAccountName(row.employee_id,row.employee_name),linked:!!row.employee_id}];
 }
 if(work._source==='issue')return [{key:'team:'+JSON.stringify([work.dept,work.assignee]),name:(work.assignee||'ยังไม่ระบุทีม')+' · ทีมรับผิดชอบ',linked:false}];
 return (work.assignees?.length?work.assignees:[work.assignee||'']).map(id=>({key:id?'user:'+id:teamPersonKey(work.dept,''),name:id?shortName(id):'ยังไม่มอบหมาย',linked:!!id}));
}
function teamBoardRows(){return boardAllWork().filter(w=>(!TEAM_BOARD.department||w.dept===TEAM_BOARD.department)&&(!TEAM_BOARD.person||teamWorkPeople(w).some(p=>p.key===TEAM_BOARD.person))&&(!TEAM_BOARD.query||[w.title,w.desc,...teamWorkPeople(w).map(p=>p.name)].join(' ').toLowerCase().includes(TEAM_BOARD.query.toLowerCase())));}
function openTeamWork(kind,id){
 if(kind==='activity'){const row=ACTIVITY_ROWS.find(r=>String(r.id)===String(id));if(row&&entryCanEdit(row))openActivityEntry(row.id);else openBoardActivity(id);}
 else if(kind==='issue')openProblem(id);else if(kind==='graphic')openGraphicJob(id);else openTask(id);
}
RENDER.teamBoard=function(){
 const departments=DEPTS.filter(d=>canViewDept(d.code));
 if(!departments.some(d=>d.code===TEAM_BOARD.department)){TEAM_BOARD.department=departments.some(d=>d.code===currentDept())?currentDept():(departments[0]?.code||'');TEAM_BOARD.person='';}
 const all=boardAllWork().filter(w=>w.dept===TEAM_BOARD.department);
 const people=new Map();for(const row of all)for(const person of teamWorkPeople(row))people.set(person.key,person);
 if(TEAM_BOARD.person&&!people.has(TEAM_BOARD.person))TEAM_BOARD.person='';
 const rows=teamBoardRows(),groups=TEAM_BOARD.group==='person'?[...people.values()].filter(p=>(!TEAM_BOARD.person||p.key===TEAM_BOARD.person)&&rows.some(w=>teamWorkPeople(w).some(x=>x.key===p.key))).map(p=>({key:p.key,title:p.name,rows:rows.filter(w=>teamWorkPeople(w).some(x=>x.key===p.key))})):Object.entries(STATUS).map(([key,value])=>({key,title:value.t,rows:rows.filter(w=>w.status===key)}));
 main.innerHTML=`${crumb('หน้าแรก','บอร์ดทีม / รายคน')}<div class="page-h"><div><h1>บอร์ดทีม / รายคน</h1><p>เลือกแผนกและชื่อเพื่อดูงาน · กดการ์ดเพื่อบันทึกความคืบหน้า · เห็นเฉพาะข้อมูลตามสิทธิ์</p></div><button class="tbtn primary" onclick="openActivityEntry()">+ บันทึกกิจกรรม</button></div><div class="issue-work-filters">
 <label>แผนก<select class="fin" id="team-dept">${departments.map(d=>`<option value="${esc(d.code)}" ${d.code===TEAM_BOARD.department?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label>
 <label>คน / บัญชี<select class="fin" id="team-person"><option value="">ทุกคน</option>${[...people.values()].map(p=>`<option value="${esc(p.key)}" ${p.key===TEAM_BOARD.person?'selected':''}>${esc(p.name)}${p.key.startsWith('name:')?' · รอเชื่อมบัญชี':''}</option>`).join('')}</select></label>
 <label>จัดคอลัมน์<select class="fin" id="team-group"><option value="person" ${TEAM_BOARD.group==='person'?'selected':''}>แยกรายคน</option><option value="status" ${TEAM_BOARD.group==='status'?'selected':''}>แยกสถานะ</option></select></label>
 <form id="team-search"><label>ค้นหางาน<input class="fin" name="query" value="${esc(TEAM_BOARD.query)}"></label><button class="tbtn">ค้นหา</button></form></div>
 <p role="status">${rows.length} งาน · งานที่มีหลายผู้รับผิดชอบจะแสดงในการ์ดของแต่ละคน โดยยอดรวมไม่นับซ้ำ</p><div class="team-work-board">${groups.map(g=>`<section class="team-work-column"><h3>${esc(g.title)} <small>${g.rows.length}</small></h3>${g.rows.slice(0,TEAM_BOARD.limit).map(w=>`<button class="team-work-card" data-team-kind="${esc(w._source)}" data-team-id="${esc(w.sourceId||w.id)}"><small>${esc(boardSourceLabel(w))} · ${esc(STATUS[w.status]?.t||w.status)}</small><b>${esc(w.title)}</b><span>${esc(teamWorkPeople(w).map(p=>p.name).join(', '))}</span>${w.sourceRow?.activity_date?`<span>${esc(activityDateLabel(w.sourceRow.activity_date))}</span>`:''}${w.desc?`<p>${esc(w.desc)}</p>`:''}</button>`).join('')||'<p class="muted">ไม่มีงานตามตัวกรอง</p>'}${g.rows.length>TEAM_BOARD.limit?`<button class="tbtn" data-team-more>แสดงเพิ่ม (${g.rows.length-TEAM_BOARD.limit})</button>`:''}</section>`).join('')||'<p>ยังไม่มีข้อมูลในแผนกนี้</p>'}</div>`;
 document.getElementById('team-dept').onchange=e=>{TEAM_BOARD.department=e.target.value;TEAM_BOARD.person='';TEAM_BOARD.limit=30;RENDER.teamBoard();};
 document.getElementById('team-person').onchange=e=>{TEAM_BOARD.person=e.target.value;TEAM_BOARD.limit=30;RENDER.teamBoard();};
 document.getElementById('team-group').onchange=e=>{TEAM_BOARD.group=e.target.value;RENDER.teamBoard();};
 document.getElementById('team-search').onsubmit=e=>{e.preventDefault();TEAM_BOARD.query=e.currentTarget.elements.query.value.trim();TEAM_BOARD.limit=30;RENDER.teamBoard();};
 main.querySelectorAll('[data-team-kind]').forEach(b=>b.onclick=()=>openTeamWork(b.dataset.teamKind,b.dataset.teamId));
 main.querySelectorAll('[data-team-more]').forEach(b=>b.onclick=()=>{TEAM_BOARD.limit+=30;RENDER.teamBoard();});
};

const teamReloadActivities=loadActivities;
loadActivities=async function(){await teamReloadActivities();if(VIEW==='teamBoard')RENDER.teamBoard();};
