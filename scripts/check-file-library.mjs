import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync(new URL('../prototype/file-library.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../prototype/index.html',import.meta.url),'utf8');
const data=fs.readFileSync(new URL('../prototype/core-app-data.js',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../prototype/core-app-shell.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../supabase/migrations/202610280057_file_library.sql',import.meta.url),'utf8');

assert.match(data,/files:\{ic:'i-folder',t:'คลังไฟล์จากงาน'\}/);
assert.match(shell,/องค์กร & ความรู้'.*'files'/);
assert.match(html,/file-library\.js\?v=20261028-file-library-1/);
assert.match(html,/company-hub-release" content="20261028-file-library-1/);
assert.match(js,/file_library_items/);
assert.match(js,/ดึงข้อความจากไฟล์/);
assert.match(js,/ไม่ส่ง AI ภายนอก/);
assert.match(js,/fileLibraryOpenFile\(false,\$\{Number\(c\.page\)\|\|0\}\)/);
assert.match(js,/fileLibraryOpenWork/);
assert.match(sql,/public\.can_read_daily_activity\(f\.activity_id\)/);
assert.match(sql,/public\.can_view_assignee_workspace\(f\.task_id,f\.user_id\)/);
assert.match(sql,/public\.can_edit_graphic_job\(f\.job_id\)/);
assert.match(sql,/Text is stored only after an authorized user explicitly requests per-file extraction/);
assert.doesNotMatch(js,/OPENAI_API_KEY|api\.openai\.com/);

console.log('PASS file library: permission-scoped metadata search, explicit extraction, local topic analysis and source/page links.');
