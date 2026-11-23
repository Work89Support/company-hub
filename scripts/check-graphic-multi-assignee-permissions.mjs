import fs from 'node:fs';
import assert from 'node:assert/strict';

const sql=fs.readFileSync(new URL('../supabase/migrations/202611230071_graphic_multi_assignee_edit_permissions.sql',import.meta.url),'utf8');

assert.match(sql,/update public\.graphic_trello_members[\s\S]+linked_profile_id=r\.profile_id/,'deterministic Trello member links are repaired');
assert.match(sql,/update public\.graphic_job_members jm[\s\S]+profile_id=m\.linked_profile_id/,'job members inherit verified profile links');
assert.match(sql,/jm\.profile_id=a\.id/,'direct secondary assignees can edit');
assert.match(sql,/tm\.linked_profile_id=a\.id/,'linked Trello assignees can edit');
assert.match(sql,/jsonb_array_elements_text\([\s\S]+jsonb_typeof\(j\.source_payload->'assignee_profile_ids'\)='array'/,'native Company Hub multi-assignees can edit safely when the payload field is an array');
assert.match(sql,/lower\(btrim\(tm\.email\)\)=lower\(btrim\(a\.email\)\)/,'verified matching email can recover an imported member link');
assert.match(sql,/and 1=\([\s\S]+select count\(\*\) from public\.profiles px/,'display-name fallback requires a unique active Graphic profile');
assert.match(sql,/if not public\.can_edit_graphic_job\(target_job\) then raise exception 'permission denied'/,'status movement uses the complete multi-assignee permission');
assert.match(sql,/with check \(created_by=auth\.uid\(\) and public\.can_edit_graphic_job\(job_id\)\)/,'file insert RLS uses the complete multi-assignee permission');
assert.doesNotMatch(sql,/or public\.can_view_department\(j\.department_code\)/,'view-only department access never becomes edit access');

console.log('PASS Graphic Production secondary assignees can upload files and move cards without granting unrelated users edit rights');
