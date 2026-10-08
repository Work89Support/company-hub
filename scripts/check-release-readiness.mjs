import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
const ux=fs.readFileSync(new URL('../prototype/ux-system.css',import.meta.url),'utf8');
const workflows=fs.readFileSync(new URL('../prototype/department-workflows.css',import.meta.url),'utf8');

function literal(name){
  const match=html.match(new RegExp(`const\\s+${name}\\s*=\\s*([\\s\\S]*?);\\s*\\n`));
  assert.ok(match,`Missing ${name}`);
  return Function(`"use strict";return (${match[1]})`)();
}

function rgb(hex){
  const value=hex.replace('#','');
  return [0,2,4].map(i=>parseInt(value.slice(i,i+2),16)/255);
}
function luminance(hex){
  return rgb(hex).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4)
    .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
}
function contrast(a,b){
  const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return (hi+.05)/(lo+.05);
}

const nav=literal('NAV');
const roleAllow=literal('ROLE_ALLOW');
const simpleAllow=literal('SIMPLE_ALLOW');
const allViews=Object.keys(nav);

for(const role of ['staff','lead','exec']){
  assert.ok(roleAllow[role]?.length,`${role} has no full navigation`);
  assert.ok(simpleAllow[role]?.length,`${role} has no simple navigation`);
  assert.ok(simpleAllow[role].every(view=>roleAllow[role].includes(view)),`${role} simple mode exposes a hidden view`);
  assert.equal(new Set(roleAllow[role]).size,roleAllow[role].length,`${role} navigation has duplicate items`);
  assert.ok(roleAllow[role].every(view=>allViews.includes(view)),`${role} references an unknown view`);
}
assert.ok(roleAllow.staff.includes('myTasks'),'Staff must have a personal work entry point');
assert.ok(!roleAllow.staff.includes('users'),'Staff must not see employee administration');
assert.ok(roleAllow.lead.includes('kpi')&&roleAllow.lead.includes('reports'),'Lead needs KPI and reporting');
assert.ok(!roleAllow.lead.includes('users'),'Lead must not see employee administration by default');
assert.ok(roleAllow.exec.includes('users'),'Executive/admin shell needs employee administration');
assert.match(html,/if\(!CLOUD\|\|!canAdminAccess\(\)\)allow=allow\.filter\(k=>k!==['"]users['"]\)/,'User administration needs a live admin gate');
assert.match(html,/if\(!canViewDept\(['"]GRAPHIC['"]\)\)allow=allow\.filter\(k=>k!==['"]graphic['"]\)/,'Graphic navigation needs a department gate');

assert.ok(contrast('#182338','#ffffff')>=7,'Primary light text contrast regressed');
assert.ok(contrast('#53617a','#ffffff')>=4.5,'Secondary light text contrast regressed');
assert.ok(contrast('#e8eef8','#16213a')>=7,'Primary dark text contrast regressed');
assert.ok(contrast('#b6c1d6','#16213a')>=4.5,'Secondary dark text contrast regressed');
assert.match(html,/body\.dark\s*\{/,'Dark theme tokens are missing');
assert.match(ux,/prefers-reduced-motion/,'Reduced-motion support is missing');

assert.match(html,/<meta name="viewport" content="width=device-width, initial-scale=1\.0"/,'Responsive viewport is missing');
assert.match(ux,/@media\(max-width:600px\)[\s\S]*min-width:44px[\s\S]*height:44px/,'Mobile header targets must be at least 44px');
assert.match(ux,/@media\(max-width:600px\)[\s\S]*grid-template-columns:minmax\(0,1fr\)/,'Mobile summary must collapse to one column');
assert.match(ux,/@media\(max-width:600px\)[\s\S]*font-size:16px/,'Mobile form controls must avoid browser zoom');
assert.match(ux,/max-height:calc\(100dvh - 16px\)/,'Mobile modal must fit the dynamic viewport');
assert.match(workflows,/scroll-snap-type:x proximity/,'Wide workflow boards need contained horizontal navigation');
assert.match(ux,/overflow-wrap:anywhere/,'Long text needs a wrapping fallback');
assert.match(ux,/clamp\(23px,2\.2vw,30px\)/,'Page titles need a zoom-friendly fluid scale');

console.log('PASS release readiness: role menu matrix, authorization gates, contrast, mobile targets, responsive modal and text resilience');
