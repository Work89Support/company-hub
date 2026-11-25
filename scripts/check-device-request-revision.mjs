import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { Window } from 'happy-dom';

const edge = await readFile(new URL('../supabase/functions/access-gate/index.ts', import.meta.url), 'utf8');
const ui = await readFile(new URL('../prototype/device-access.js', import.meta.url), 'utf8');
const employee = 'employee';
const reviewer = 'reviewer';
const deviceKey = 'a'.repeat(24);
const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deviceKey));
const deviceHash = Buffer.from(hashBuffer).toString('hex');
const firstDevice = { id: 'first', profile_id: employee, status: 'approved' };
const secondDevice = {
  id: '11111111-1111-1111-1111-111111111111', profile_id: employee, device_key_hash: deviceHash,
  status: 'pending', request_kind: 'replacement', request_reason: 'เหตุผลที่กรอกผิด',
  device_label: 'Windows · Chrome', requested_at: '2026-11-25T01:00:00Z',
};
const devices = [firstDevice, secondDevice];
const notifications = [];
const audit = [];
const grants = [];
let signedIn = employee;
const admin = {
  from(table) {
    const query = {
      where: {}, fields: null, updateFields: null,
      select(_fields, options) { this.fields = options; return this; },
      eq(key, value) { this.where[key] = value; return this; },
      update(fields) { this.updateFields = fields; return this; },
      insert(row) { assert.equal(table, 'login_access_audit'); audit.push(row); return {}; },
      upsert(row) { assert.equal(table, 'user_access_grants'); grants.push(row); return {}; },
      matching() { return devices.filter(row => Object.entries(this.where).every(([key, value]) => row[key] === value)); },
      maybeSingle() {
        if (table === 'profiles') return { data: { id: this.where.id, active: true, role: 'staff' } };
        if (table === 'device_access_config') return { data: { enabled: true } };
        if (table === 'device_access_approvers') return { data: this.where.profile_id === reviewer ? {} : null };
        assert.equal(table, 'user_access_devices');
        const [row] = this.matching();
        if (row && this.updateFields) Object.assign(row, this.updateFields);
        return { data: row ? { ...row } : null };
      },
      then(resolve) {
        const rows = this.matching();
        if (this.updateFields) rows.forEach(row => Object.assign(row, this.updateFields));
        return resolve({ count: rows.length });
      },
    };
    return query;
  },
  rpc(name, payload) {
    if (name === 'queue_telegram_notification') notifications.push(payload);
    return { data: true };
  },
};
const sandbox = {
  Response, crypto, TextEncoder, atob, console,
  Deno: { env: { get: name => name } },
  createClient: (_url, key) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? admin : {
    auth: { getUser: async () => ({ data: { user: { id: signedIn } } }) },
  },
};
runInNewContext(stripTypeScriptTypes(edge.replace(/^import .*;$/gm, '').replace('export default {', 'self.edge = {')), {
  ...sandbox, self: sandbox,
});
async function request(actor, action, extra = {}) {
  signedIn = actor;
  const response = await sandbox.edge.fetch(new Request('https://example.test/access-gate', {
    method: 'POST',
    headers: { authorization: 'Bearer x.eyJpYXQiOjF9.x', 'x-forwarded-for': '192.0.2.1' },
    body: JSON.stringify({ action, device_id: deviceKey, ...extra }),
  }));
  return response.json();
}
const review = (decision, review_note, actor = reviewer, requested_at = secondDevice.requested_at) =>
  request(actor, 'review', { decision, review_note, requested_at, device_record_id: secondDevice.id });

assert.equal((await review('return', 'แก้เหตุผล', employee)).allowed, false);
assert.equal((await review('return', '')).allowed, false);
assert.equal((await review('return', 'ระบุเหตุผลที่ต้องใช้สองเครื่อง')).allowed, true);
assert.equal((await review('approve', 'กดจากหน้าค้าง')).allowed, false);
const returned = await request(employee, 'status');
assert.equal(returned.state, 'revision_requested');
assert.equal(returned.review_note, 'ระบุเหตุผลที่ต้องใช้สองเครื่อง');
assert.equal((await request(employee, 'request_change', { request_reason: 'สั้น' })).state, 'revision_requested');

const revisedReason = 'ใช้เครื่องที่สองสำหรับทำงานจากบ้าน';
const oldTimestamp = secondDevice.requested_at;
assert.equal((await request(employee, 'request_change', { request_reason: revisedReason })).state, 'pending');
assert.equal(secondDevice.request_reason, revisedReason);
assert.equal(grants.length, 0);
assert.equal((await review('approve', '', reviewer, oldTimestamp)).allowed, false);
assert.equal((await review('reject', 'กรุณาติดต่อ IT')).allowed, true);
assert.equal((await request(employee, 'request_change', { request_reason: revisedReason })).state, 'blocked');
assert.equal((await review('reopen', '')).allowed, true);
assert.equal((await request(employee, 'status')).state, 'revision_requested');
assert.equal((await request(employee, 'request_change', { request_reason: revisedReason })).state, 'pending');
assert.equal((await review('approve', 'ใช้เป็นเครื่องสำรอง')).allowed, true);
assert.equal((await request(employee, 'status')).review_note, 'ใช้เป็นเครื่องสำรอง');
assert.equal(grants.length, 1);
assert.equal(firstDevice.status, 'approved');
assert.equal(grants[0].device_id, secondDevice.id);

secondDevice.status = 'blocked';
secondDevice.review_note = 'เพิกถอนสิทธิ์';
assert.equal((await review('reopen', '')).allowed, false);
secondDevice.review_note = 'ปฏิเสธคำขออุปกรณ์';
assert.equal((await review('reopen', '')).allowed, true);
assert.ok(audit.some(row => row.reason.includes('เหตุผลที่กรอกผิด')));
assert.equal(notifications.filter(row => row.p_type === 'device_approval_requested').length, 2);

const window = new Window({ url: 'https://example.test' });
const context = {
  document: window.document,
  navigator: window.navigator,
  requestAnimationFrame: () => {},
  clearTimeout: () => {},
  loginBackground: () => {},
  NAV: {}, NAVGROUPS: [], ROLE_ALLOW: { lead: [], exec: [] }, RENDER: {},
  esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
};
runInNewContext(ui + '\nshowDeviceGate("revision_requested",{review_note:"<img>",request_reason:"เดิม"});', context);
assert.equal(window.document.getElementById('deviceChangeReason').value, 'เดิม');
assert.equal(window.document.getElementById('deviceGatePrimary').textContent, 'ส่งคำขอใหม่');
assert.equal(window.document.querySelector('#deviceGateCard img'), null);
console.log('PASS device correction, legacy reopening, revocation, fresh approval, audit and employee dialog');
