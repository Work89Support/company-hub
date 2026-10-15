import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const source=fs.readFileSync(new URL('../prototype/staff-mobility-chat.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202610150039_department_transfers_and_support_chat.sql',import.meta.url),'utf8');

assert.match(source,/dataset\.originalDepartment/,'primary department changes are guarded');
assert.match(source,/ใช้ปุ่ม “ย้ายแผนก” เพื่อเก็บประวัติสังกัดเดิม/);
assert.match(migration,/create table if not exists public\.employee_department_history/);
assert.match(migration,/create unique index if not exists employee_department_history_one_current/);
assert.match(migration,/create or replace function public\.transfer_employee_department/);
assert.match(migration,/only admin can transfer an admin account/);
assert.match(migration,/create table if not exists public\.support_chat_messages/);
assert.match(migration,/alter publication supabase_realtime add table public\.support_chat_messages/);
assert.match(migration,/new\.author_id := auth\.uid\(\)/,'chat author is taken from the authenticated session');

const window=new Window();const {document}=window;
document.body.innerHTML='<main></main><div id="modal"></div>';
const main=document.querySelector('main'),modal=document.getElementById('modal');
const rpcCalls=[];let inserted=null,toastText='';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const chatRows=[{id:'m1',author_id:'u2',author_name:'<img src=x onerror=alert(1)>',department_code:'CRM',message_type:'problem',body:'กดแล้ว <script>alert(1)</script>',created_at:'2026-10-15T02:00:00Z'}];
function query(table){
  if(table==='support_chat_messages')return {
    select(){return this;},order(){return this;},limit:async()=>({data:chatRows,error:null}),
    insert(row){inserted=row;return {select(){return this;},single:async()=>({data:{id:'m2',author_id:'u1',author_name:'Tester',department_code:'CRM',created_at:'2026-10-15T03:00:00Z',...row},error:null})};}
  };
  if(table==='employee_department_history')return {select(){return this;},eq(){return this;},order:async()=>({data:[],error:null})};
  throw new Error('unexpected table '+table);
}
const channel={on(){return this;},subscribe(){return this;}};
const ctx={window,document,main,modal,requestAnimationFrame:fn=>fn(),Intl,Date,console,
 NAV:{},NAVGROUPS:[{items:[]},{items:[]},{items:[]}],ROLE_ALLOW:{staff:[],lead:[],exec:[]},SIMPLE_ALLOW:{staff:[],lead:[],exec:[]},RENDER:{},MANUAL:[],VIEW:'supportChat',ORG_TIMEZONE:'Asia/Bangkok',ACCESS_PROFILE:{id:'u1'},ACCESS_USERS:[{id:'u1',display_name:'Tester',email:'t@example.com',department_code:'CRM',position_title:'Staff'}],ACCESS_USERS_READY:true,DEPTS:[{code:'CRM',name:'CRM'},{code:'FIN',name:'Finance'}],
 SB:{from:query,channel:()=>channel,rpc:async(name,args)=>{rpcCalls.push([name,args]);return {error:null};}},
 esc,deptName:code=>({CRM:'CRM',FIN:'Finance'}[code]||code),crumb:()=>'',sourceBadge:()=>'',sic:()=>'',val:id=>document.getElementById(id)?.value||'',toast:text=>{toastText=text;},showModal:html=>{modal.innerHTML=html;},closeModal:()=>{modal.innerHTML='';},loadAccessUsers:async()=>{},confirm:()=>true,openAccessUser:()=>{},saveAccessUser:async()=>{},openManual:async()=>{}
};
vm.createContext(ctx);vm.runInContext(source,ctx);
assert.ok(ctx.ROLE_ALLOW.staff.includes('supportChat'));
assert.ok(ctx.SIMPLE_ALLOW.staff.includes('supportChat'));
assert.equal(ctx.MANUAL.length,2);

ctx.RENDER.supportChat();await ctx.loadSupportChat();
assert.equal(main.querySelectorAll('.support-message').length,1);
assert.equal(main.querySelectorAll('img,script').length,0,'chat content is escaped');
assert.ok(main.textContent.includes('<script>alert(1)</script>'));
document.getElementById('support-chat-body').value='ช่วยตรวจหน้า KPI';
document.getElementById('support-chat-type').value='problem';
await ctx.sendSupportChatMessage();
assert.equal(inserted.author_id,'u1');assert.equal(inserted.message_type,'problem');assert.equal(inserted.body,'ช่วยตรวจหน้า KPI');
assert.ok(toastText.includes('ทุกคน'));

ctx.openDepartmentTransfer('u1');
document.getElementById('transferNewDept').value='FIN';
document.getElementById('transferDate').value='2026-10-15';
document.getElementById('transferPosition').value='Finance staff';
document.getElementById('transferReason').value='ย้ายตามโครงสร้างใหม่';
await ctx.saveDepartmentTransfer('u1');
assert.equal(rpcCalls[0][0],'transfer_employee_department');
assert.equal(rpcCalls[0][1].p_new_department,'FIN');
assert.equal(rpcCalls[0][1].p_reason,'ย้ายตามโครงสร้างใหม่');

console.log('PASS department transfer history, shared chat access, escaped content and transfer RPC');
await window.happyDOM.close();
