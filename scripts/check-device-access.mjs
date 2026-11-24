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
const namedApprovers = read('../supabase/migrations/202611240075_device_reason_and_named_approvers.sql');
const pApprover = read('../supabase/migrations/202611240076_add_p_device_approver.sql');

const checks = [
  ['release loads device UI before cloud startup', /device-access\.js[\s\S]*core-app-cloud\.js/, html],
  ['first and later devices request IT approval without TOTP', /request_initial[\s\S]*needs_initial_request[\s\S]*request_change[\s\S]*needs_change_reason/, edge],
  ['Authenticator MFA is absent from the active device flow', /auth\.mfa|needs_mfa|ยืนยันตัวตน 2FA/, ui, true],
  ['opaque ID is kept in a strict secure cookie', /Max-Age=.*Secure; SameSite=Strict/, ui],
  ['browser gate runs before protected profile load', /ensureDeviceAccess\(session\)[\s\S]*loadAuthenticatedProfile\(session\)/, cloud],
  ['lead/admin approval view exists', /RENDER\.devices[\s\S]*reviewDeviceRequest/, ui],
  ['approval navigation is hidden from other roles', /lead','admin'[\s\S]*devices/, shell],
  ['device key is hashed server side', /crypto\.subtle\.digest\("SHA-256"/, edge],
  ['only CEO and named device approvers are exempt', /actor\.role === "exec" \|\| deviceApprover/, edge],
  ['only Max, P and AMM can approve device requests', /isDeviceApprover[\s\S]*เฉพาะคุณแม็ก คุณพี หรือ AMM/, edge],
  ['self approval is blocked', /ไม่สามารถอนุมัติอุปกรณ์ของตนเอง/, edge],
  ['non-approvers cannot see pending approval actions', /canReview = await isDeviceApprover[\s\S]*!canReview[\s\S]*requests: \[\]/, edge],
  ['named IT approval immediately approves the requested device', /decision === "approve"[\s\S]*status: "approved"[\s\S]*IT อนุมัติและเปิดใช้งานอุปกรณ์/, edge],
  ['waiting clients poll and enter immediately after approval', /state==='pending'[\s\S]*DEVICE_PENDING_POLL=setTimeout\(\(\)=>deviceGateAction\('retry'\),5000\)/, ui],
  ['background device load refreshes an open device page', /finally\{DEVICE_REQUESTS_LOADING=false;if\(VIEW==='devices'\)RENDER\.devices\(\);buildNav\(\);\}/, ui],
  ['replacement requests require a written reason', /needs_change_reason[\s\S]*requestReason\.length < 10[\s\S]*request_reason: requestReason/, edge],
  ['device requests notify Telegram with their reason', /device_approval_requested[\s\S]*เหตุผล: \$\{requestReason\}/, edge],
  ['requests and outcomes use existing Telegram queue', /queue_telegram_notification[\s\S]*dispatch_telegram_notifications/, edge],
  ['rollout is prepared disabled', /device_access_config[\s\S]*enabled boolean not null default false/, prepare],
  ['activation enforces staff and lead but exempts exec/admin', /p\.role not in \('exec','admin'\)/, activate],
  ['all Programmer profiles are promoted to admin', /department_code='PROG'[\s\S]*role='admin'/, mfaAdmin],
  ['future Programmer profiles stay admin equivalent', /profiles_promote_programmer_admin[\s\S]*profile_departments_promote_programmer_admin/, mfaAdmin],
  ['Programmer admins still require device approval', /device_access_approvers[\s\S]*enforce_device[\s\S]*sync_programmer_admin_access/, namedApprovers],
  ['named approvers resolve exactly to AMM and Max', /work\.ltd89@gmail\.com[\s\S]*f53d6369-dd9e-43b5-9971-dd99e4defa4a[\s\S]*count\(\*\)[\s\S]*<> 2/, namedApprovers],
  ['P is the third and final named approver', /a0ce29ce-ab88-4fb1-b8f6-28a3cb9ec587[\s\S]*count\(\*\)[\s\S]*<> 3[\s\S]*AMM, Max and P/, pApprover],
  ['device screen is blocking and responsive', /position:fixed[\s\S]*z-index:[6-9][0-9]{3}[\s\S]*@media\(max-width:640px\)/, css],
];
const failed=checks.filter(([,pattern,source,negated])=>negated?pattern.test(source):!pattern.test(source));
if(/แทนที่ด้วยอุปกรณ์ที่อนุมัติใหม่/.test(edge))failed.push(['approving another device must not revoke existing devices']);
if(/auth\.mfa|needs_mfa|aal2|activation_code|redeem_code|รหัส 6 หลัก/.test(ui+edge))failed.push(['active device approval flow must not contain MFA or activation codes']);
try { new vm.Script(ui,{filename:'device-access.js'}); } catch(error){ console.error('FAIL: device-access.js syntax'); console.error(error.message); process.exit(1); }
if(failed.length){failed.forEach(([name])=>console.error('FAIL: '+name));process.exit(1);}
console.log(`PASS: ${checks.length} device enrollment and approval checks`);
