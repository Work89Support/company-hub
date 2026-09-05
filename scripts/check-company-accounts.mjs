import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync(new URL('../supabase/functions/company-accounts/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace('export default','globalThis.handler=');
let role='staff',active=true,pending=true,old=false,verified=true,allowed=true,calls=[],rate=true,expired=false;
const payload={iat:1000},token='x.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.x';
const make=()=>({from(table){let filters={};const query={select(){return query;},eq(k,v){filters[k]=v;return query;},single(){return query;},maybeSingle(){return query;},order(){return query;},then(resolve){let data=table==='profiles'?{id:'u1',role,active,email:'internal@company-hub.invalid',display_name:'คน (ทีม)',department_code:'CRM'}:{profile_id:'u1',must_change_password:pending,credentials_valid_after:old?2000:0,credential_version:0,initial_code_expires_at:expired?'2000-01-01':'2099-01-01',login_name:'คน (ทีม)'};return Promise.resolve({data,error:null}).then(resolve);}};return query;},
 rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='consume_company_login_attempt'?rate:name==='company_credentials_ready'?!pending:name==='edge_access_allowed'?allowed:null,error:null};},
 auth:{getUser:async()=>({data:{user:verified?{id:'u1',email:'internal@company-hub.invalid'}:null},error:verified?null:{}}),signInWithPassword:async()=>({data:{session:{access_token:'secret'}},error:null}),admin:{updateUserById:async()=>{calls.push(['updatePassword']);return {error:null};}}}});
const ctx={createClient:make,Deno:{env:{get:()=> 'configured'}},crypto:globalThis.crypto,TextEncoder,Response,Request,Uint8Array,atob,console};vm.createContext(ctx);vm.runInContext(stripTypeScriptTypes(source),ctx);
const send=(action,extra={})=>ctx.handler.fetch(new Request('https://edge.test',{method:'POST',headers:{authorization:'Bearer '+token,'x-forwarded-for':'127.0.0.1'},body:JSON.stringify({action,...extra})}));
assert.equal((await send('status')).status,200);assert.equal((await send('list')).status,403,'pending account cannot list');
assert.equal((await send('password',{password:'short',current_password:'old'})).status,400);
assert.equal((await send('password',{password:'new-password-long',current_password:'old-password-long'})).status,200);
assert.deepEqual(calls.filter(([name])=>['begin_company_credential_change','updatePassword','finish_company_credential_change'].includes(name)).map(([name])=>name),['begin_company_credential_change','updatePassword','finish_company_credential_change']);
expired=true;assert.equal((await send('password',{password:'new-password-long',current_password:'old-password-long'})).status,403,'expired code cannot set password');expired=false;
old=true;assert.equal((await send('password',{password:'new-password-long',current_password:'old-password-long'})).status,401,'old JWT cannot reset');old=false;
pending=false;assert.equal((await send('list')).status,403,'staff cannot list or provision');assert.equal((await send('provision',{name:'คน',department_code:'CRM'})).status,403);
role='admin';allowed=false;assert.equal((await send('list')).status,403,'admin still requires device gate');allowed=true;assert.equal((await send('list')).status,200);
verified=false;assert.equal((await send('reset',{profile_id:'other'})).status,401);verified=true;active=false;assert.equal((await send('status')).status,403);active=true;
rate=false;assert.equal((await send('login',{login:'คน (ทีม)',password:'secret'})).status,429,'persistent rate limit consulted');
console.log('PASS account Edge: authentication, stale JWT, pending setup, device gate, staff/admin separation, password validation and serialized operations');
// Simulate the production Auth trigger, which pre-creates a department scope.
for(const dept of ['GRAPHIC','CRM']){
 const scopes=new Map();let newProfile=null,metadata;
 ctx.createClient=()=>({auth:{getUser:async()=>({data:{user:{id:'admin'}}}),admin:{createUser:async body=>{metadata=body.app_metadata;const initial=metadata?.department||'GRAPHIC';scopes.set(initial,false);return {data:{user:{id:'new'}}};}}},rpc:async(name,args)=>{if(name==='link_company_source_owner')assert.equal(args.p_name,'บุคคล  WFH');return {data:true,error:null};},from(table){let operation='select',values,filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},neq(k,v){filters['not_'+k]=v;return q},in(){filters.existing=true;return q},limit(){return q},single(){return q},maybeSingle(){return q},insert(v){operation='insert';values=v;return q},upsert(v){operation='upsert';values=v;return q},update(v){operation='update';values=v;return q},delete(){operation='delete';return q},then(resolve){let data=null,error=null;
 if(operation==='select'){if(table==='profiles')data=filters.existing?[]:{id:'admin',active:true,role:'admin'};else if(table==='departments')data={code:dept,name:dept};else if(table==='daily_activities'){assert.equal(filters.employee_name,'บุคคล  WFH');data=[{id:1,employee_id:null}];}else if(table==='graphic_trello_members')data=[{trello_member_id:'m',linked_profile_id:null}];}
 else if(table==='profiles'){newProfile={...newProfile,...values};}
 else if(table==='profile_departments'){if(operation==='delete'){for(const key of scopes.keys())if(key!==filters.not_department_code)scopes.delete(key);}else if(operation==='insert'&&scopes.has(values.department_code)){error={message:'duplicate scope'};}else scopes.set(values.department_code,values.can_manage);}
 return Promise.resolve({data,error}).then(resolve);}};return q;}});
 const result=await send('provision',{name:'บุคคล  WFH',department_code:dept});assert.equal(result.status,200);assert.equal(metadata.department,dept);assert.equal(metadata.company_role,'staff');assert.deepEqual([...scopes.entries()],[[dept,false]]);assert.equal(newProfile.active,true);
}
console.log('PASS provision with real-trigger behavior: one staff department, no duplicate GRAPHIC scope');
