import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../prototype/activity-module.js',import.meta.url),'utf8');
assert.match(source,/ACTIVITY_RANGE_MODE='month'/,'activity page defaults to the current month');
assert.match(source,/คิวตรวจข้อมูลแบบกลุ่ม/,'activity page exposes a grouped review queue');
assert.match(source,/exportActivityReviewQueue/,'activity review queue can be exported');

function context(overrides={}){
  const main={innerHTML:''};
  const ctx={
    console:{...console,error(){}},Date,Intl,Set,Map,Promise,location:{protocol:'file:'},main,
    NAV:{},NAVGROUPS:[{items:[]}],ROLE_ALLOW:{staff:[]},SIMPLE_ALLOW:{staff:[]},RENDER:{dash(){},board(){},timeline(){}},
    VIEW:'activity',SB:null,CLOUD:false,ACCESS_PROFILE:null,AUTH_DB_ROLE:'staff',MANAGE_DEPTS:[],DEPTS:[],BOARD_DEPT:'',
    esc:value=>String(value??''),crumb:()=>'',buildNav(){},ask(){},onLoggedIn:async()=>false,
    ...overrides
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  return {ctx,main};
}

{
  const {ctx,main}=context();
  ctx.RENDER.activity();
  assert.match(main.innerHTML,/กรุณาเปิดผ่าน URL ระบบจริง/);
  assert.match(main.innerHTML,/work89support\.github\.io\/company-hub/);
  assert.doesNotMatch(main.innerHTML,/กำลังโหลดข้อมูลตามสิทธิ์ของคุณ/,'local file must not stay loading forever');
}

{
  let calls=0,resolveRows;
  const pending=new Promise(resolve=>{resolveRows=resolve;});
  const {ctx}=context({location:{protocol:'https:'},VIEW:'dash',SB:{},sbAllRows:async()=>{calls++;return pending;}});
  const first=ctx.loadActivities();
  const second=ctx.loadActivities();
  assert.equal(calls,4,'one activity, assignee, attachment and work-session request are shared across concurrent renders');
  resolveRows({data:[],error:null});
  await Promise.all([first,second]);
}

{
  const {ctx,main}=context({location:{protocol:'https:'},SB:{},sbAllRows:async()=>({data:null,error:new Error('network unavailable')})});
  await ctx.loadActivities();
  assert.match(main.innerHTML,/โหลดข้อมูลกิจกรรมไม่สำเร็จ/);
  assert.match(main.innerHTML,/ลองโหลดอีกครั้ง/);
}

console.log('PASS activity loading, local-file guidance, duplicate request guard and retry state');
