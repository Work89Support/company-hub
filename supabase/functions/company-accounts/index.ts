import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(18))).map(x=>x.toString(16).padStart(2,'0')).join('');
const clean=(v:unknown)=>String(v??'').normalize('NFC').trim().replace(/\s+/g,' ');
function checked<T>(r:{data:T,error:unknown}):T{if(r.error)throw new Error('DATABASE_OPERATION_FAILED');return r.data;}
function required<T>(r:{data:T,error:unknown}):NonNullable<T>{const value=checked(r);if(value==null)throw new Error('REQUIRED_ROW_MISSING');return value;}
export default {fetch:async(request:Request)=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers});
 if(request.method!=='POST')return json({error:'method not allowed'},405);
 try{
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 if(!url||!anon||!key)return json({error:'ระบบบัญชียังไม่พร้อม'},503);
 const client=()=>createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const raw=await request.text();if(raw.length>10000)return json({error:'ข้อมูลยาวเกินไป'},400);
 const b=JSON.parse(raw),action=String(b.action||''),ip=(request.headers.get('x-forwarded-for')||'').split(',')[0].trim().replace(/^::ffff:/,'');
 if(!ip)return json({error:'ไม่พบข้อมูลการเชื่อมต่อ'},400);
 if(action==='login'){
  const login=clean(b.login).toLowerCase(),password=String(b.password||'');
  if(!login||login.length>254||!password||password.length>1024)return json({error:'ชื่อหรือรหัสผ่านไม่ถูกต้อง'},401);
  for(const [bucket,max] of [[await hash('ip:'+ip),60],[await hash('name:'+login),12]] as const){
   if(!checked(await admin.rpc('consume_company_login_attempt',{p_bucket:bucket,p_max:max})))return json({error:'ลองหลายครั้งเกินไป กรุณารอ 10 นาที'},429);
  }
  const account=checked(await admin.from('company_login_accounts').select('profile_id,credential_lock,credentials_valid_after').eq('login_name',login).maybeSingle());
  // Directory names are stored lower-case; display labels live in profiles.
  const profile=account?checked(await admin.from('profiles').select('email,active').eq('id',account.profile_id).maybeSingle()):null;
  const email=profile?.active&&!account?.credential_lock?profile.email:'invalid-login@company-hub.invalid';
  const signed=await client().auth.signInWithPassword({email,password});
  if(signed.error||!signed.data.session||!profile?.active)return json({error:'ชื่อหรือรหัสผ่านไม่ถูกต้อง'},401);
  return json({session:signed.data.session});
 }
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const verified=await client().auth.getUser(token);if(verified.error||!verified.data.user)return json({error:'กรุณาเข้าสู่ระบบใหม่'},401);
 const user=verified.data.user;
 // Decode only after Auth has verified the exact token above.
 const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))),iat=Number(claims.iat||0);
 const actor=required(await admin.from('profiles').select('id,active,role,display_name,department_code').eq('id',user.id).single());
 if(!actor.active)return json({error:'บัญชีนี้ถูกปิดใช้งาน'},403);
 const account=checked(await admin.from('company_login_accounts').select('*').eq('profile_id',user.id).maybeSingle());
 if(account&&(iat<account.credentials_valid_after||account.credential_lock))return json({error:'กรุณาเข้าสู่ระบบด้วยรหัสล่าสุด หรือติดต่อผู้ดูแล'},401);
 if(action==='status')return json({username_account:!!account,display_name:actor.display_name,login_name:account?.login_name,contact_email:account?.contact_email||'',personal_name:account?.personal_name,must_change_password:!!account?.must_change_password});
 if(action==='password'){
  if(account?.must_change_password&&Date.parse(account.initial_code_expires_at)<Date.now())return json({error:'รหัสครั้งแรกหมดอายุ ให้ผู้ดูแลออกรหัสใหม่'},403);
  if(!account)return json({error:'บัญชีอีเมลให้ใช้การเปลี่ยนรหัสของระบบเดิม'},400);
  const password=String(b.password||''),current=String(b.current_password||'');
  if(password.length<12||password.length>128||password===current)return json({error:'ตั้งรหัสใหม่ 12–128 ตัวอักษรและต่างจากรหัสเดิม'},400);
  const auth=await client().auth.signInWithPassword({email:user.email!,password:current});if(auth.error)return json({error:'รหัสปัจจุบันไม่ถูกต้อง'},403);
  if(!account.must_change_password&&!checked(await admin.rpc('edge_access_allowed',{p_profile_id:user.id,p_ip:ip})))return json({error:'เครื่องหรือ IP ไม่ได้รับอนุญาต'},403);
  const lock=crypto.randomUUID();checked(await admin.rpc('begin_company_credential_change',{p_profile:user.id,p_lock:lock,p_reset:false,p_revision:account.credential_version}));
  const changed=await admin.auth.admin.updateUserById(user.id,{password});if(changed.error)throw new Error('PASSWORD_CHANGE_FAILED');
  checked(await admin.rpc('finish_company_credential_change',{p_profile:user.id,p_lock:lock,p_pending:false}));
  return json({ok:true,sign_in_again:true});
 }
 if(!checked(await admin.rpc('company_credentials_ready',{p_profile:user.id,p_iat:iat}))||!checked(await admin.rpc('edge_access_allowed',{p_profile_id:user.id,p_ip:ip})))return json({error:'เครื่องหรือบัญชียังไม่ได้รับอนุญาต'},403);
 if(!['admin','exec'].includes(actor.role))return json({error:'เฉพาะผู้ดูแลหรือผู้บริหาร'},403);
 if(action==='list')return json({accounts:checked(await admin.from('company_login_accounts').select('profile_id,login_name,contact_email,must_change_password,source_key').order('login_name'))});
 if(action==='reset'){
  const target=required(await admin.from('company_login_accounts').select('profile_id,login_name,credential_version').eq('profile_id',b.profile_id).single());
  const targetProfile=required(await admin.from('profiles').select('role,active').eq('id',target.profile_id).single());
  if(target.profile_id===user.id||!targetProfile.active||targetProfile.role==='admin'&&actor.role!=='admin')return json({error:'ไม่สามารถรีเซ็ตบัญชีนี้ได้'},403);
  checked(await admin.from('access_audit').insert({actor_id:user.id,target_user_id:target.profile_id,old_access:{},new_access:{action:'username_password_reset_requested'}}));
  const lock=crypto.randomUUID(),password=secret();checked(await admin.rpc('begin_company_credential_change',{p_profile:target.profile_id,p_lock:lock,p_reset:true,p_revision:target.credential_version}));
  const changed=await admin.auth.admin.updateUserById(target.profile_id,{password});if(changed.error)throw new Error('RESET_FAILED');
  checked(await admin.rpc('finish_company_credential_change',{p_profile:target.profile_id,p_lock:lock,p_pending:true}));
  return json({ok:true,login_name:target.login_name,initial_password:password});
 }
 if(action==='provision'){
  const name=clean(b.name),dept=clean(b.department_code);
  if(name.length<1||name.length>100||/[\r\n\x00-\x1f]/.test(String(b.name))||['ทุกคน','all','hr','buki grace','บอส แก๋ม'].includes(name.toLowerCase())||name.includes('/'))return json({error:'ต้องเป็นชื่อบุคคลเดียว'},400);
  const department=required(await admin.from('departments').select('code,name').eq('code',dept).single());
  const source=checked(await admin.from('daily_activities').select('id,employee_id').eq('department_code',dept).eq('employee_name',name).limit(1000))??[];
  const members=dept==='GRAPHIC'?checked(await admin.from('graphic_trello_members').select('trello_member_id,linked_profile_id').eq('full_name',name))??[]:[];
  if(!source.length&&!members.length)return json({error:'ไม่พบชื่อนี้ในข้อมูลต้นทาง'},400);
  if(source.some((r:any)=>r.employee_id)||members.some((r:any)=>r.linked_profile_id))return json({error:'ชื่อนี้มีการเชื่อมบัญชีแล้ว ให้ใช้บัญชีเดิม'},409);
  const display=name+' ('+department.name+')',login=display.toLowerCase(),sourceKey=await hash(dept+'\x1f'+name);
  const existing=checked(await admin.from('company_login_accounts').select('profile_id,login_name').eq('source_key',sourceKey).maybeSingle());
  if(existing)return json({existing:true,...existing});
  const same=checked(await admin.from('profiles').select('id').eq('department_code',dept).in('display_name',[name,display]).limit(1))??[];
  if(same.length)return json({error:'มีบัญชีชื่อนี้แล้ว ต้องจับคู่บัญชีเดิม'},409);
  const password=secret(),email=crypto.randomUUID()+'@company-hub.invalid';
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:display}});
  if(created.error||!created.data.user)throw new Error('CREATE_FAILED');
  const id=created.data.user.id;
  // Default profile is inactive until the private directory and scope exist.
  // Credentials are only returned once the whole provision operation succeeds.
  try{
   checked(await admin.from('profiles').upsert({id,email,display_name:display,role:'staff',department_code:dept,active:false,position_title:''}));
   checked(await admin.from('company_login_accounts').insert({profile_id:id,login_name:login,source_key:sourceKey,personal_name:name,created_by:user.id}));
   checked(await admin.from('profile_departments').insert({profile_id:id,department_code:dept,can_manage:false}));
   checked(await admin.from('user_access_policies').insert({profile_id:id,enforce_device:true,enforce_ip:false,session_minutes:5,updated_by:user.id}));
   checked(await admin.rpc('link_company_source_owner',{p_profile:id,p_name:name,p_dept:dept}));
   checked(await admin.from('access_audit').insert({actor_id:user.id,target_user_id:id,old_access:{},new_access:{action:'username_account_created',role:'staff',department_code:dept}}));
   checked(await admin.from('profiles').update({active:true}).eq('id',id));
  }catch(error){await admin.from('profiles').update({active:false}).eq('id',id);throw error;}
  return json({ok:true,profile_id:id,login_name:display,initial_password:password});
 }
 return json({error:'ไม่รองรับคำสั่งนี้'},400);
 }catch{return json({error:'ทำรายการไม่สำเร็จ หากเป็นการเปลี่ยนรหัส กรุณาให้ผู้ดูแลออกรหัสใหม่ ห้ามส่งซ้ำทันที'},400);}
}};
