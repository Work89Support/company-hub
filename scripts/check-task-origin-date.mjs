import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const data=fs.readFileSync(new URL('../prototype/core-app-data.js',import.meta.url),'utf8');
const views=fs.readFileSync(new URL('../prototype/core-app-views.js',import.meta.url),'utf8');
const cloud=fs.readFileSync(new URL('../prototype/core-app-cloud.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../prototype/core-app-shell.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/202611140067_task_origin_and_date_normalization.sql',import.meta.url),'utf8');

const ctx={console,Intl,Date,TODAY_ISO:'2026-11-14'};vm.createContext(ctx);
vm.runInContext(`${data}\nthis.testNormalize=normalizeTaskDateInput;this.testFmt=fmtDate;`,ctx);
assert.equal(ctx.testNormalize('2569-12-31'),'2026-12-31','Buddhist year becomes Gregorian');
assert.equal(ctx.testNormalize('0002-12-29'),'2026-12-29','two-digit Safari year uses the active year');
assert.equal(ctx.testNormalize('1800-01-01'),'','implausible years are rejected');
assert.match(ctx.testFmt('2569-12-31',true),/ธ\.ค\. 69$/,'legacy Buddhist date displays as 2569, not year 3112');
assert.match(views,/นำเข้าจาก Google Sheets/);
assert.match(views,/นำเข้าจาก Trello/);
assert.match(views,/_originSource:j\.source\|\|''/);
assert.match(views,/return t\?\._source==='task'\?'สร้างใน Company Hub'/);
assert.match(views,/\$\{origin\} โดย \$\{shortName\(t\.creator\)\}/);
assert.match(cloud,/directoryProfiles\.filter\(p=>p\.active!==false\)/,'inactive profiles stay out of assignment lists');
assert.match(cloud,/directoryProfiles\.forEach/,'inactive historical names remain resolvable');
assert.match(shell,/source_system:'company_hub'/,'new native tasks record provenance');
assert.match(migration,/extract\(year from due_at\) between 2400 and 2700/);
assert.match(migration,/extract\(year from start_at\) between 1 and 99/);
console.log('task origin and date checks passed');
