import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});

type PushSubscriptionRow={id:string;profile_id:string;endpoint:string;p256dh:string;auth:string};

async function deliver(admin:any,message:any,room:any,senderId:string){
  let query=admin.from('chat_push_subscriptions')
    .select('id,profile_id,endpoint,p256dh,auth,profiles!inner(active)')
    .eq('enabled',true).eq('profiles.active',true).neq('profile_id',senderId);
  if(room.room_type!=='public'){
    const {data:members,error:membersError}=await admin.from('chat_room_members').select('profile_id').eq('room_id',room.id).neq('profile_id',senderId);
    if(membersError)throw membersError;
    const memberIds=(members||[]).map((row:any)=>row.profile_id);
    if(!memberIds.length)return {sent:0,disabled:0};
    query=query.in('profile_id',memberIds);
  }
  const {data,error}=await query;if(error)throw error;
  const sticker:{[key:string]:string}={like:'👍',love:'😍',thanks:'🙏',great:'🎉',ok:'👌',done:'✅',fight:'✌️',laugh:'😂',wow:'🤩',idea:'💡',please:'🥺',cheer:'💙'};
  const preview=message.message_type==='sticker'?`ส่งสติ๊กเกอร์ ${sticker[message.body]||'😊'}`:message.attachment_path?(String(message.attachment_mime||'').startsWith('image/')?'ส่งรูปภาพ':'ส่งไฟล์ '+(message.attachment_name||'')):String(message.body||'มีข้อความใหม่').replace(/\s+/g,' ').slice(0,120);
  const payload=JSON.stringify({title:room.room_type==='public'?'ห้องกลาง Company Hub':room.name||'ข้อความใหม่',body:`${message.author_name||'ผู้ใช้งาน'}: ${preview}`,room_id:room.id,url:`/company-hub/prototype/index.html?chatRoom=${encodeURIComponent(room.id)}`,tag:`company-hub-chat-${room.id}`});
  let sent=0,disabled=0;
  await Promise.all((data||[]).map(async(row:PushSubscriptionRow)=>{
    try{
      await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},payload,{TTL:86400,urgency:'high'});sent++;
    }catch(error:any){
      if(error?.statusCode===404||error?.statusCode===410){await admin.from('chat_push_subscriptions').update({enabled:false}).eq('id',row.id);disabled++;return;}
      console.error('push delivery failed',row.id,error?.statusCode||error?.message||error);
    }
  }));
  return {sent,disabled};
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'method not allowed'},405);
  try{
    const authorization=req.headers.get('Authorization')||'';
    if(!authorization.startsWith('Bearer '))return json({error:'authentication required'},401);
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublic=Deno.env.get('CHAT_VAPID_PUBLIC_KEY')!,vapidPrivate=Deno.env.get('CHAT_VAPID_PRIVATE_KEY')!;
    if(!vapidPublic||!vapidPrivate)return json({error:'push service is not configured'},503);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
    const {data:{user},error:userError}=await userClient.auth.getUser();
    if(userError||!user)return json({error:'invalid session'},401);
    const {message_id}=await req.json();if(!message_id)return json({error:'message_id is required'},400);
    const admin=createClient(url,service,{auth:{persistSession:false}});
    const {data:message,error:messageError}=await admin.from('support_chat_messages').select('id,room_id,author_id,author_name,message_type,body,attachment_path,attachment_name,attachment_mime').eq('id',message_id).maybeSingle();
    if(messageError)throw messageError;if(!message||message.author_id!==user.id)return json({error:'message not found'},404);
    const {data:room,error:roomError}=await admin.from('chat_rooms').select('id,name,room_type').eq('id',message.room_id).single();if(roomError)throw roomError;
    webpush.setVapidDetails('mailto:work.ltd89@gmail.com',vapidPublic,vapidPrivate);
    const result=await deliver(admin,message,room,user.id);
    return json({ok:true,...result});
  }catch(error:any){console.error(error);return json({error:error?.message||'push delivery failed'},500);}
});
