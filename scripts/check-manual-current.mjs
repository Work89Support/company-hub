import fs from 'node:fs';
import assert from 'node:assert/strict';

const page=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
const world=fs.readFileSync(new URL('../prototype/company-world.js',import.meta.url),'utf8');
const manualSource=page+'\n'+world;
const integrity=fs.readFileSync(new URL('../prototype/reporting-integrity.js',import.meta.url),'utf8');
const images=JSON.parse(fs.readFileSync(new URL('../prototype/manual-images.json',import.meta.url),'utf8'));
const manualIds=[...manualSource.matchAll(/\{id:'([^']+)',ic:/g)].map(match=>match[1]);
const textOnlyIds=[...manualSource.matchAll(/\{id:'([^']+)',ic:[^\n]+?img:null/g)].map(match=>match[1]);
const required=['intro','world','loginAccess','account','teamAccounts','dash','myTasks','teamBoard','board','task','compose','graphic','timeline','activity','completeness','problems','kpi','reports','monthly','tracker','connectedSystems','ann','ack','org','users','sop','kb','talk','extra'];

for(const id of required)assert.ok(manualIds.includes(id),'คู่มือขาดหัวข้อ '+id);
assert.equal(new Set(manualIds).size,manualIds.length,'คู่มือมีรหัสหัวข้อซ้ำ');
assert.deepEqual(textOnlyIds.sort(),['extra','intro','loginAccess','world'],'หน้าฟังก์ชันในคู่มือต้องมีภาพปัจจุบันหรือเป็นฟังก์ชันใหม่ที่มีคำอธิบายครบ');
for(const [,key] of page.matchAll(/img:'([^']+)'/g))assert.ok(String(images[key]||'').startsWith('data:image/'),'คู่มือขาดภาพ '+key);
assert.ok(page.includes('คู่มือ Company Hub · เวอร์ชัน 16 ต.ค. 2569'));
assert.ok(page.includes('manual-images.json?v=20261012-current-manual'));
assert.ok(page.includes('reporting-integrity.js?v=20261016-chat-rooms-1'));
assert.match(integrity,/document\.getElementById\('data-health'\)\?\.remove\(\);if\(failed\)/,'สถานะข้อมูลปกติต้องไม่แสดงบนหน้าผู้ใช้');

console.log(`PASS manual: ${manualIds.length} current sections, every referenced image is embedded, healthy source diagnostics hidden`);
