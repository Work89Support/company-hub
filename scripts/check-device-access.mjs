import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../prototype/index.html');
const ui = read('../prototype/device-access.js');
const css = read('../prototype/device-access.css');
const cloud = read('../prototype/core-app-cloud.js');
const shell = read('../prototype/core-app-shell.js');
const edge = read('../supabase/functions/access-gate/index.ts');
const prepare = read('../supabase/migrations/202611240072_device_enrollment_approval.sql');
const activate = read('../supabase/migrations/202611240073_activate_device_enrollment.sql');

const checks = [
  ['release loads device UI before cloud startup', /device-access\.js[\s\S]*core-app-cloud\.js/, html],
  ['first login explains and confirms browser enrollment', /needs_initial_confirmation[\s\S]*ยืนยันและลงทะเบียนเครื่องนี้/, ui],
  ['replacement asks for approval', /needs_change_confirmation[\s\S]*ส่งคำขออนุมัติอุปกรณ์/, ui],
  ['opaque ID is kept in a strict secure cookie', /Max-Age=.*Secure; SameSite=Strict/, ui],
  ['browser gate runs before protected profile load', /ensureDeviceAccess\(session\)[\s\S]*loadAuthenticatedProfile\(session\)/, cloud],
  ['lead/admin approval view exists', /RENDER\.devices[\s\S]*reviewDeviceRequest/, ui],
  ['approval navigation is hidden from other roles', /lead','admin'[\s\S]*devices/, shell],
  ['device key is hashed server side', /crypto\.subtle\.digest\("SHA-256"/, edge],
  ['CEO and admin are exempt', /actor\.role === "exec" \|\| actor\.role === "admin"/, edge],
  ['lead can approve staff in managed department', /actor\.role === "lead" && target\.role === "staff"/, edge],
  ['self approval is blocked', /ไม่สามารถอนุมัติอุปกรณ์ของตนเอง/, edge],
  ['head device requires admin', /เครื่องของหัวหน้าแผนกต้องให้ผู้ดูแลระบบอนุมัติ/, edge],
  ['requests and outcomes use existing Telegram queue', /queue_telegram_notification[\s\S]*dispatch_telegram_notifications/, edge],
  ['rollout is prepared disabled', /device_access_config[\s\S]*enabled boolean not null default false/, prepare],
  ['activation enforces staff and lead but exempts exec/admin', /p\.role not in \('exec','admin'\)/, activate],
  ['device screen is blocking and responsive', /position:fixed[\s\S]*z-index:[6-9][0-9]{3}[\s\S]*@media\(max-width:640px\)/, css],
];
const failed=checks.filter(([,pattern,source])=>!pattern.test(source));
try { new vm.Script(ui,{filename:'device-access.js'}); } catch(error){ console.error('FAIL: device-access.js syntax'); console.error(error.message); process.exit(1); }
if(failed.length){failed.forEach(([name])=>console.error('FAIL: '+name));process.exit(1);}
console.log(`PASS: ${checks.length} device enrollment and approval checks`);
