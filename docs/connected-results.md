# Department source results

Company Hub displays read-only source results in native cards and tables, under “ผลระบบตามแผนก”. Department visibility uses the existing `canViewDept` rules: AUD123, ADMIN and PROG. This feature does not create or approve KPI scores.

## Connection and scope

The user selects a date range (up to 32 days), opens a source connection window and chooses “แสดงผลใน Company Hub”. Audit uses its existing authenticated Supabase client and RLS. Domainwatch uses its existing session, password-change and IP restrictions plus incident/KPI permissions. No source session, password, token or raw financial evidence is transferred. The receiving window checks the exact origin, window reference, one-time nonce, active Hub account and requested dates.

Results remain in memory for the current Hub page/account. Reloading requires another read. This is an on-demand snapshot, not a background synchronization service. The time shown is the retrieval time. Source users are identified by source IDs; no email/name auto-merge or automatic ownership assignment is performed.

Audit exports compact exceptions for the completed committed runs in the selected operating days, plus non-archived run summaries. It paginates 1,000 rows at a time. A 100,000-case or 1,000-job cap is explicitly marked incomplete. It excludes archived jobs and does not treat still-running reconciliation results as complete. Missing ownership is “ยังไม่มอบหมาย”.

Domainwatch exports central and mobile incidents detected within the Bangkok date range. ADMIN shows both sources; PROG shows central incidents only because mobile incidents do not have an IT owner in the source schema. Response minutes follow source KPI permissions, and missing/inaccessible values remain null. Current monitored-link counts are separately labeled as a current snapshot, not date/person-filtered. Each source is capped at 5,001 incidents and marked partial when reached. PAUSED is neither closed nor open.

## Validation

- Existing 23-screen UX regression suite passed, including native data handoff, origin rejection, account cache separation, department separation, disconnected/null states and no embedded screens.
- Domainwatch TypeScript check passed without database migration or build side effects.
- Audit pagination test passed for 2,501 rows across three pages, excluding archived and uncommitted jobs.
- GitHub Pages checks and Domainwatch Vercel deployment passed.
- Live Domainwatch handoff verified: 496 monitored UP links, no incidents returned for 1–9 September 2026. No demo business data was created.
- Live Audit handoff verified: 12,065 cases with no partial flag, 74 non-archived rounds in 1–9 September 2026. AT4 filter returned 573 cases and 8 rounds. All returned case assignments were empty; no user was inferred.
