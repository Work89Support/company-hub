const CACHE_VERSION='company-hub-chat-push-1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch(_error){data={body:event.data?.text()||'มีข้อความใหม่'};}
  const title=data.title||'Company Hub';
  event.waitUntil(self.registration.showNotification(title,{
    body:data.body||'มีข้อความใหม่',icon:'favicon.svg',badge:'favicon.svg',tag:data.tag||'company-hub-chat',renotify:true,
    data:{url:data.url||'index.html',room_id:data.room_id||''},actions:[{action:'open',title:'เปิดข้อความ'}]
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const target=new URL(event.notification.data?.url||'index.html',self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){if(new URL(client.url).pathname.includes('/company-hub/prototype/')){await client.navigate(target);return client.focus();}}
    return self.clients.openWindow(target);
  })());
});
