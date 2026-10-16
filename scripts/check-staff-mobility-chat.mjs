import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const source=fs.readFileSync(new URL('../prototype/staff-mobility-chat.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../prototype/staff-mobility-chat.css',import.meta.url),'utf8');
const migration39=fs.readFileSync(new URL('../supabase/migrations/202610150039_department_transfers_and_support_chat.sql',import.meta.url),'utf8');
const migration40=fs.readFileSync(new URL('../supabase/migrations/202610160040_chat_rooms_and_attachments.sql',import.meta.url),'utf8');
const migration41=fs.readFileSync(new URL('../supabase/migrations/202610160041_chat_stickers.sql',import.meta.url),'utf8');
const migration42=fs.readFileSync(new URL('../supabase/migrations/202610160042_chat_web_push.sql',import.meta.url),'utf8');
const pushWorker=fs.readFileSync(new URL('../prototype/chat-push-sw.js',import.meta.url),'utf8');
const pushFunction=fs.readFileSync(new URL('../supabase/functions/chat-push/index.ts',import.meta.url),'utf8');

assert.match(source,/dataset\.originalDepartment/,'primary department changes are guarded');
assert.match(migration39,/create table if not exists public\.employee_department_history/);
for(const token of ['create table if not exists public.chat_rooms','create table if not exists public.chat_room_members','create or replace function public.can_access_chat_room','create or replace function public.create_chat_room','create or replace function public.chat_directory','chat-attachments','file_size_limit','createSignedUrl']){
  assert.ok(migration40.includes(token)||source.includes(token),`missing secure chat feature ${token}`);
}
for(const token of ['support-chat-sidebar','support-chat-rooms','chat-member-list','chat-image-attachment','chat-file-attachment'])assert.ok(css.includes(token),`missing chat UI style ${token}`);
for(const token of ['support-chat-stickers','support-sticker','support-chat-dock','support-chat-peek','support-unread'])assert.ok(css.includes(token),`missing sticker/notification UI ${token}`);
for(const token of ['support-chat-floating','support-chat-float-header','support-chat-float-compose','support-chat-float-rooms-panel'])assert.ok(css.includes(token),`missing floating chat UI ${token}`);
for(const token of ['openSupportChatFloating','supportChatFloatingMinimize','toggleSupportChatFloating','closeSupportChatFloating'])assert.ok(source.includes(token),`missing floating chat behavior ${token}`);
assert.match(migration40,/room members read chat messages/);
assert.match(migration40,/chat members read attachments/);
assert.match(migration40,/10485760/,'attachment limit must remain 10 MB');
assert.match(migration41,/message_type in \('message','problem','update','sticker'\)/);
assert.match(migration41,/support_chat_messages_sticker_key_check/);
for(const token of ['create table if not exists public.chat_push_subscriptions','set_chat_push_subscription_owner','users register own push subscriptions'])assert.ok(migration42.includes(token),`missing Web Push schema ${token}`);
for(const token of ['serviceWorker.register','pushManager.subscribe','chat_push_subscriptions','supportChatDispatchPush'])assert.ok(source.includes(token),`missing Web Push client ${token}`);
assert.match(pushWorker,/self\.addEventListener\('push'/);
assert.match(pushWorker,/notificationclick/);
assert.match(pushFunction,/message\.author_id!==user\.id/,'sender identity must be verified server-side');
assert.match(pushFunction,/chat_room_members/,'private room membership must scope push recipients');

const window=new Window();const {document}=window;
document.body.innerHTML='<main></main><div id="modal"></div>';
const main=document.querySelector('main'),modal=document.getElementById('modal');
let inserted=null,insertedCount=0,toastText='';const rpcCalls=[];
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const publicRoom={id:'00000000-0000-0000-0000-000000000001',name:'ห้องกลาง Company Hub',room_type:'public',updated_at:'2026-10-16T02:00:00Z'};
const directRoom={id:'11111111-1111-1111-1111-111111111111',name:'User Two',room_type:'direct',updated_at:'2026-10-16T03:00:00Z'};
const chatRows=[{id:'m1',room_id:publicRoom.id,author_id:'u2',author_name:'<img src=x onerror=alert(1)>',department_code:'CRM',message_type:'problem',body:'กดแล้ว <script>alert(1)</script>',attachment_path:null,created_at:'2026-10-16T02:00:00Z'}];
function chain(table){
  const state={table,room:''};
  const api={select(){return api;},order(){return api;},eq(_key,value){state.room=value;return api;},limit(){return Promise.resolve(result());},insert(row){inserted=row;insertedCount+=1;return {select(){return this;},single:async()=>({data:{id:'m'+(insertedCount+1),author_name:'Tester',department_code:'CRM',created_at:'2026-10-16T03:00:00Z',...row},error:null})};},then(resolve){return Promise.resolve(result()).then(resolve);}};
  function result(){
    if(table==='chat_rooms')return {data:[directRoom,publicRoom],error:null};
    if(table==='chat_room_members')return {data:[{room_id:directRoom.id,profile_id:'u1'},{room_id:directRoom.id,profile_id:'u2'}],error:null};
    if(table==='support_chat_messages')return {data:chatRows.filter(row=>!state.room||row.room_id===state.room),error:null};
    if(table==='employee_department_history')return {data:[],error:null};
    throw new Error('unexpected table '+table);
  }
  return api;
}
const storageBucket={createSignedUrl:async()=>({data:{signedUrl:'https://example.test/signed'},error:null}),upload:async()=>({data:{path:'ok'},error:null}),remove:async()=>({error:null})};
const channel={on(){return this;},subscribe(){return this;}};
const ctx={window,document,main,modal,requestAnimationFrame:fn=>fn(),setTimeout:()=>0,Intl,Date,Map,Promise,console,crypto:{randomUUID:()=> '22222222-2222-2222-2222-222222222222'},
 NAV:{},NAVGROUPS:[{items:[]},{items:[]},{items:[]}],ROLE_ALLOW:{staff:[],lead:[],exec:[]},SIMPLE_ALLOW:{staff:[],lead:[],exec:[]},RENDER:{},MANUAL:[],VIEW:'supportChat',ORG_TIMEZONE:'Asia/Bangkok',ACCESS_PROFILE:{id:'u1'},ACCESS_USERS:[{id:'u1',display_name:'Tester',email:'t@example.com',department_code:'CRM',position_title:'Staff'}],ACCESS_USERS_READY:true,DEPTS:[{code:'CRM',name:'CRM'},{code:'FIN',name:'Finance'}],
 SB:{from:chain,channel:()=>channel,removeChannel:()=>{},functions:{invoke:async()=>({data:{ok:true},error:null})},storage:{from:()=>storageBucket},rpc:async(name,args)=>{rpcCalls.push([name,args]);if(name==='chat_directory')return {data:[{profile_id:'u2',display_name:'User Two',department_code:'FIN',position_title:'Staff'}],error:null};if(name==='create_chat_room')return {data:directRoom.id,error:null};return {data:null,error:null};}},
 esc,nf:n=>String(n),deptName:code=>({CRM:'CRM',FIN:'Finance'}[code]||code),crumb:()=>'',sourceBadge:()=>'',sic:()=>'',val:id=>document.getElementById(id)?.value||'',toast:text=>{toastText=text;},showModal:html=>{modal.innerHTML=html;},closeModal:()=>{modal.innerHTML='';},loadAccessUsers:async()=>{},confirm:()=>true,openAccessUser:()=>{},saveAccessUser:async()=>{},openManual:async()=>{},onLoggedIn:async()=>{},sbLogout:async()=>{},go:view=>{ctx.VIEW=view;ctx.RENDER[view]?.();}
};
vm.createContext(ctx);vm.runInContext(source,ctx);
assert.equal(ctx.NAV.supportChat.t,'ข้อความ');assert.ok(ctx.ROLE_ALLOW.staff.includes('supportChat'));
ctx.RENDER.supportChat();await ctx.loadSupportChatRooms(true);
assert.equal(main.querySelectorAll('.support-room').length,2,'public and direct rooms render');
assert.equal(main.querySelectorAll('.support-message').length,1);
assert.equal(main.querySelectorAll('.support-message img,.support-message script').length,0,'message content is escaped');
assert.ok(main.textContent.includes('<script>alert(1)</script>'));
document.getElementById('support-chat-body').value='ช่วยตรวจหน้า KPI';
await ctx.sendSupportChatMessage();
assert.equal(inserted.room_id,publicRoom.id);assert.equal(inserted.body,'ช่วยตรวจหน้า KPI');assert.ok(toastText.includes('ส่งข้อความแล้ว'));
await ctx.sendSupportChatSticker('great');
assert.equal(inserted.message_type,'sticker');assert.equal(inserted.body,'great');
assert.ok(main.querySelector('.support-sticker'),'sticker renders as a large visual message');
ctx.supportChatReceive({id:'m3',room_id:directRoom.id,author_id:'u2',author_name:'User Two',department_code:'FIN',message_type:'message',body:'มีข้อความใหม่',created_at:'2026-10-16T04:00:00Z'});
assert.equal(document.querySelector('.support-chat-dock-button b')?.textContent,'1','unread message appears in the bottom dock');
assert.ok(document.querySelector('.support-chat-peek'),'new message shows a Facebook-style bottom peek');
await ctx.openSupportChatFloating(directRoom.id);
assert.ok(document.getElementById('support-chat-floating'),'bottom dock opens a floating messenger without changing page');
assert.ok(document.querySelector('#support-chat-floating .support-room-heading')?.textContent.includes('User Two'),'floating messenger renders the selected room');
ctx.supportChatFloatingMinimize();
assert.ok(document.getElementById('support-chat-floating').classList.contains('minimized'),'floating messenger can be minimized');
ctx.supportChatFloatingMinimize();
ctx.supportChatFloatingRooms(true);
assert.ok(document.querySelector('.support-chat-float-rooms-panel.show'),'floating messenger switches rooms in place');
await ctx.openSupportChatCreate('direct');
modal.querySelector('.chat-member-choice input').checked=true;
await ctx.createSupportChatRoom('direct');
assert.ok(rpcCalls.some(([name,args])=>name==='create_chat_room'&&args.p_member_ids[0]==='u2'));
console.log('PASS secure chat rooms, floating messenger, stickers, bottom peeks, unread badge, direct/group chat and private attachments');
await window.happyDOM.close();
