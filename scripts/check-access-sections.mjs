import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const {Window}=await import(process.env.DOM_MODULE||'happy-dom');
const w=new Window(),d=w.document;
d.body.innerHTML='<div id="modal"></div>';
const calls=[];
const ctx={document:d,confirm:()=>true,setTimeout:fn=>fn(),sic:()=>'',esc:v=>String(v??''),AUTH_DB_ROLE:'admin',ACCESS_PROFILE:{id:'admin'},ACCESS_USERS:[{id:'employee',display_name:'คนทดสอบ',email:'internal@company-hub.invalid',position_title:'Staff',role:'staff',department_code:'FIN',active:true}],ACCOUNT_LIST:[{profile_id:'employee',contact_email:'old@example.com'}],
 accessRowsFor:()=>[{department_code:'FIN',can_manage:false}],accessRoleOptions:()=>'<option value="staff">พนักงาน</option>',accessDepartmentOptions:()=>'<option value="FIN">การเงิน</option>',accessDepartmentChecks:()=>'',syncAccessRoleForm:()=>{},showModal:html=>{d.getElementById('modal').innerHTML=html;},
 val:k=>d.getElementById(k)?.value||'',normSp:s=>s.trim(),selectedAccessValues:()=>['FIN'],SB:{rpc:async(n,a)=>{calls.push([n,a]);return {}; }},accountCall:async(action,body)=>{calls.push([action,body]);return {ok:true,...body};},closeModal(){},toast(){},loadAccessUsers:async()=>{},renderAccountDirectory(){},VIEW:'teamAccounts',sbLogout:async()=>{}};
const s=fs.readFileSync(new URL('../prototype/core-app-admin.js',import.meta.url),'utf8');
vm.createContext(ctx);vm.runInContext(s.slice(s.indexOf('const ACCESS_LEVEL_LABELS'),s.indexOf('function accessRowsFor')),ctx);vm.runInContext(s.slice(s.indexOf('function openAccessUser(id){'),s.indexOf('RENDER.users=function()')),ctx);
assert.equal(ctx.accessPersonLevel({position_title:'Graphic Designer · หัวหน้า 3',role:'lead'}),'lead');assert.equal(ctx.accessPersonLevel({position_title:'Admin · รอง 2',role:'staff'}),'staff');assert.equal(ctx.accessPersonLevel({position_title:'พนักงาน',role:'staff'}),'staff');assert.equal(ctx.accessPositionBase('Graphic Designer · หัวหน้า 3'),'Graphic Designer');assert.equal(ctx.accessPositionWithLevel('Graphic Designer · หัวหน้า 1'),'Graphic Designer');
ctx.openAccessUser('employee');assert.equal(d.getElementById('editUserEmail').value,'old@example.com','account modal exposes the real contact email');assert.ok(d.getElementById('modal').textContent.includes('อีเมลสำหรับเข้าสู่ระบบ'));assert.equal(d.getElementById('editUserLevel'),null,'account modal no longer exposes numbered hierarchy');assert.ok(d.getElementById('editUserRole'),'account modal exposes only the user type selector');
await ctx.saveAccessUser('employee');assert.deepEqual(calls.map(call=>call[0]),['set_user_access'],'unchanged email only updates duties');assert.equal(calls[0][1].new_position_title,'Staff','legacy hierarchy is removed from the position');
d.getElementById('saveAccessBtn').disabled=false;d.getElementById('editUserEmail').value=' New@Example.com ';await ctx.saveAccessUser('employee');assert.deepEqual(calls.slice(-2).map(call=>call[0]),['set_user_access','update-contact-email'],'changed email is saved through the protected account function');assert.equal(ctx.ACCOUNT_LIST[0].contact_email,'new@example.com');
assert.ok(s.includes("new_active:document.getElementById('editUserActive').value==='true'"),'status selector writes the chosen active state');
for(const label of ['หัวหน้า 1','หัวหน้า 2','หัวหน้า 3','รอง 1','รอง 2','รอง 3','ยังไม่กำหนดระดับ'])assert.ok(!s.includes(label),`numbered hierarchy removed: ${label}`);
assert.ok(s.includes('ประเภทผู้ใช้งาน'),'employee directory uses the simplified user type');assert.ok(s.includes('ACCESS_USER_LEVEL'),'employee directory keeps the simplified head/staff filter');
assert.ok(!s.includes('set_user_login_policy'),'employee UI cannot re-enable a device or IP gate');
assert.ok(!s.includes('set_user_device_status'),'employee UI has no device approval flow');
console.log('PASS access updates include editable login email and keep role and department scope free of device/IP gates');
await w.happyDOM.close();
