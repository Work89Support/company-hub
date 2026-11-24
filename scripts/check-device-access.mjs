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
const mfaAdmin = read('../supabase/migrations/202611240074_mfa_multidevice_programmer_admin.sql');

const checks = [
  ['release loads device UI before cloud startup', /device-access\.js[\s\S]*core-app-cloud\.js/, html],
  ['new devices require MFA identity verification', /needs_mfa[\s\S]*ยืนยันตัวตน 2FA[\s\S]*beginDeviceMfa/, ui],
  ['TOTP enrollment and challenge are implemented', /auth\.mfa\.enroll[\s\S]*auth\.mfa\.challenge[\s\S]*auth\.mfa\.verify/, ui],
  ['opaque ID is kept in a strict secure cookie', /Max-Age=.*Secure; SameSite=Strict/, ui],
  ['browser gate runs before protected profile load', /ensureDeviceAccess\(session\)[\s\S]*loadAuthenticatedProfile\(session\)/, cloud],
  ['lead/admin approval view exists', /RENDER\.devices[\s\S]*reviewDeviceRequest/, ui],
  ['approval navigation is hidden from other roles', /lead','admin'[\s\S]*devices/, shell],
  ['device key is hashed server side', /crypto\.subtle\.digest\("SHA-256"/, edge],
  ['CEO and admin are exempt', /actor\.role === "exec" \|\| actor\.role === "admin"/, edge],
  ['only admin can approve every device request', /actor\.role !== "admin"[\s\S]*เฉพาะผู้ดูแลระบบเท่านั้นที่อนุมัติอุปกรณ์ได้/, edge],
  ['self approval is blocked', /ไม่สามารถอนุมัติอุปกรณ์ของตนเอง/, edge],
  ['lead cannot see pending approval actions', /actor\.role === "lead"[\s\S]*requests: \[\]/, edge],
  ['AAL2 registers the current device', /aal !== "aal2"[\s\S]*state: "needs_mfa"[\s\S]*status: "approved"[\s\S]*เจ้าของบัญชียืนยัน 2FA/, edge],
  ['MFA registration notifies Telegram', /device_mfa_registered[\s\S]*ยืนยัน 2FA และเพิ่มอุปกรณ์/, edge],
  ['requests and outcomes use existing Telegram queue', /queue_telegram_notification[\s\S]*dispatch_telegram_notifications/, edge],
  ['rollout is prepared disabled', /device_access_config[\s\S]*enabled boolean not null default false/, prepare],
  ['activation enforces staff and lead but exempts exec/admin', /p\.role not in \('exec','admin'\)/, activate],
  ['all Programmer profiles are promoted to admin', /department_code='PROG'[\s\S]*role='admin'/, mfaAdmin],
  ['future Programmer profiles stay admin equivalent', /profiles_promote_programmer_admin[\s\S]*profile_departments_promote_programmer_admin/, mfaAdmin],
  ['device screen is blocking and responsive', /position:fixed[\s\S]*z-index:[6-9][0-9]{3}[\s\S]*@media\(max-width:640px\)/, css],
];
const failed=checks.filter(([,pattern,source])=>!pattern.test(source));
if(/แทนที่ด้วยอุปกรณ์ที่อนุมัติใหม่/.test(edge))failed.push(['approving another device must not revoke existing devices']);
try { new vm.Script(ui,{filename:'device-access.js'}); } catch(error){ console.error('FAIL: device-access.js syntax'); console.error(error.message); process.exit(1); }
if(failed.length){failed.forEach(([name])=>console.error('FAIL: '+name));process.exit(1);}
console.log(`PASS: ${checks.length} device enrollment and approval checks`);
