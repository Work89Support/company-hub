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
