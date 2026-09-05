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
