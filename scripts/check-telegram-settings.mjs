import assert from 'node:assert/strict';
import fs from 'node:fs';

const notificationSql=fs.readFileSync(new URL('../supabase/migrations/202610270052_ceo_telegram_notifications.sql',import.meta.url),'utf8');
const settingsSql=fs.readFileSync(new URL('../supabase/migrations/202610270053_telegram_team_settings.sql',import.meta.url),'utf8');
const leadSql=fs.readFileSync(new URL('../supabase/migrations/202610270054_lead_telegram_notifications.sql',import.meta.url),'utf8');

assert.match(notificationSql,/queue_ceo_assignment_telegram/,'CEO assignment trigger is installed');
assert.match(notificationSql,/queue_ceo_completion_telegram/,'CEO completion trigger is installed');
assert.match(notificationSql,/company-hub-summary-0600-bkk/,'06:00 Thailand summary is scheduled');
assert.match(notificationSql,/company-hub-summary-1800-bkk/,'18:00 Thailand summary is scheduled');
assert.match(notificationSql,/vault\.decrypted_secrets/,'dispatcher reads protected Telegram secrets from Vault');
assert.doesNotMatch(notificationSql,/8982051368|AA[A-Za-z0-9_-]{20,}/,'no Telegram token is committed in the migration');

assert.match(settingsSql,/actor\.role not in \('admin','exec'\)/,'only administrators and executives can read or save settings');
assert.match(settingsSql,/save_telegram_notification_settings/,'secure settings RPC exists');
assert.match(settingsSql,/test_telegram_notification_settings/,'explicit test RPC exists');
assert.match(settingsSql,/vault\.update_secret/,'token rotation updates Vault instead of app tables');
assert.doesNotMatch(settingsSql,/'bot_token'\s*,\s*(clean_token|decrypted_secret)/i,'RPC never returns the decrypted token');

assert.match(leadSql,/assigner_role='lead'/,'every active lead assignment enters the Telegram queue');
assert.match(leadSql,/manager\.role='lead'/,'completion notices include tasks assigned by any lead');
assert.match(leadSql,/lower\(coalesce\(assigner_login,''\)\)='ceo2026'/,'CEO notifications remain enabled');
assert.match(leadSql,/sender_label\|\|E' มอบหมายงาน/,'lead assignment message identifies the manager');
assert.match(leadSql,/manager-completed:/,'completion messages remain deduplicated');

console.log('PASS Telegram settings: protected Vault storage, CEO events, group test, and Thailand schedules');
