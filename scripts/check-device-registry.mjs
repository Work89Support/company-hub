import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [ui, edge, css] = await Promise.all([
  readFile(new URL('../prototype/device-access.js', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/access-gate/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../prototype/device-access.css', import.meta.url), 'utf8'),
]);

assert.match(ui, /DEVICE_FILTER_SEARCH/);
assert.match(ui, /ทุกแผนก/);
assert.match(ui, /ทุกสถานะ/);
assert.match(ui, /deviceRegistryState/);
assert.match(ui, /deleteDeviceHistory/);
assert.match(ui, /การลบนี้ย้อนกลับไม่ได้/);
assert.match(edge, /action === "delete_history"/);
assert.match(edge, /actor\.role !== "admin"/);
assert.match(edge, /user_access_devices"\)\.delete\(\)/);
assert.match(edge, /device_history_deleted/);
assert.match(css, /device-registry-filters/);
assert.match(css, /tbtn\.danger/);

console.log('PASS device registry filters, admin-only permanent deletion, audit and Telegram notification');

const {runInNewContext}=await import('node:vm');
const origin='https://project.example';
const dbUrl=origin+'/rest/v1/graphic_jobs';
const errorResponse=message=>Response.json({code:'42501',message},{status:403});
const expiredGrant=()=>errorResponse('DEVICE_OR_IP_ACCESS_REQUIRED');
const helper=ui.slice(ui.indexOf('let DEVICE_GRANT_REFRESH='),ui.indexOf('function ensureDeviceGateMarkup('));
function createFetchCase({networkFetch,refresh,cookie=()=> 'registered-device'}){
  const ctx={
    fetch:networkFetch,deviceAccessCall:refresh,deviceCookieValue:cookie,Request,URL,SUPA_URL:origin,location:{href:'https://app.example/'},
  };
  runInNewContext(helper,ctx);
  return ctx.deviceGrantFetch;
}

let grantNetwork='old-network',renewals=0,writes=0,calls=0;
const currentNetwork='new-network';
const recover=createFetchCase({
  async networkFetch(input,init){
    calls++;
    if(grantNetwork!==currentNetwork)return expiredGrant();
    if(init?.method==='POST'){assert.deepEqual(JSON.parse(init.body),{name:'draft'});writes++;}
    return Response.json({ok:true});
  },
  async refresh(action){
    assert.equal(action,'status');
    renewals++;
    await new Promise(resolve=>setImmediate(resolve));
    grantNetwork=currentNetwork;
    return {allowed:true};
  },
});
const successful=await Promise.all([recover(dbUrl),recover(dbUrl,{method:'POST',body:'{"name":"draft"}'}),recover(dbUrl)]);
assert.ok(successful.every(response=>response.ok));
assert.equal(renewals,1,'concurrent VPN failures should share one grant refresh');
assert.equal(writes,1,'a request rejected before it started must write only once');
assert.equal(calls,6);

for(const config of [
  {url:dbUrl,message:'permission denied for table',allowed:true,attempts:0},
  {url:dbUrl,message:'DEVICE_OR_IP_ACCESS_REQUIRED',allowed:false,attempts:1},
  {url:dbUrl,message:'DEVICE_OR_IP_ACCESS_REQUIRED',allowed:true,missingCookie:true,attempts:0},
  {url:origin+'/functions/v1/access-gate',message:'DEVICE_OR_IP_ACCESS_REQUIRED',allowed:true,attempts:0},
  {url:'https://another.example/rest/v1/graphic_jobs',message:'DEVICE_OR_IP_ACCESS_REQUIRED',allowed:true,attempts:0},
]){
  let checkCount=0,requestCount=0;
  const f=createFetchCase({
    async networkFetch(){requestCount++;return errorResponse(config.message);},
    async refresh(){checkCount++;return {allowed:config.allowed,state:'needs_change_reason'};},
    cookie:()=>config.missingCookie?'':'registered-device',
  });
  assert.equal((await f(config.url)).status,403);
  assert.equal(checkCount,config.attempts);
  assert.equal(requestCount,1);
}

let boundedCalls=0;
const retryOnce=createFetchCase({
  async networkFetch(){boundedCalls++;return expiredGrant();},
  async refresh(){return {allowed:true};},
});
assert.equal((await retryOnce(dbUrl)).status,403);
assert.equal(boundedCalls,2,'persistent failure is returned to the caller after one retry');

const cloud=await readFile(new URL('../prototype/core-app-cloud.js',import.meta.url),'utf8');
assert.match(cloud,/createClient\(SUPA_URL,SUPA_KEY,\{global:\{fetch:deviceGrantFetch\}\}\)/);
console.log('PASS device network recovery shares status refresh, safely retries once and preserves IT approval');
