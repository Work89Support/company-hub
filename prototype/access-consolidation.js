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

  const baseTeamAccounts=RENDER.teamAccounts;
  RENDER.teamAccounts=async function(){
    await baseTeamAccounts();
    if(VIEW!=='teamAccounts'||!canAdminAccess())return;
    try{
      if(!GRAPHIC_READY)await loadGraphic();
      if(VIEW!=='teamAccounts')return;
      const directory=document.getElementById('account-directory');
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
