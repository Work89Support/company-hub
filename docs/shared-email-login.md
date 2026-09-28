# Verified deployment — 2026-09-15

Supabase company-accounts deployed successfully. Reloaded editor source equals corrected full source (13,240 JS characters; local FNV-1a 3047441020, SHA-256 bde37ed57ce8947f1873da0da01047c4f28f43251af29564388d78a62fa4a4f7). Frontend enabled at commit 60a350b61acdb8b9046c26dca078c9e148adec48; index script cache version updated at 810f97bc7a058e2cb99cda7f95da50643a7ac5b0. Production script URL company-accounts.js?v=20260915-shared-email verified.

Live browser verification: existing Bonnie email returns Bonnie (QC Chat) / QC. Submitting without name displays the choose-name validation. Selecting Bonnie reveals the password field. No real password entered; no real sign-in/session-isolation test, new account creation, roster mapping, or password changes in this deployment. Unit Edge and UI suites passed. New finance identities and other missing directory contact-email mappings remain separate work, not implicitly completed by enabling lookup.

Historical notes below:

# Shared email sign-in

User confirmed on 2026-09-14 that the finance pairs are separate people. Do not merge by contact_email. Auth UUID and internal Auth identity remain per account.

Current rule: only Finance (`FIN`) may share one contact email across multiple people. The flow for that case is email lookup -> explicit name selection -> selected account password. An email linked to exactly one active account goes directly to its password field without a name selector. Multiple active accounts outside Finance are rejected as a directory-data error and must be corrected by an administrator.

Active directory entries only, bounded results, persistent IP/email lookup limits. Login revalidates contact email against the resolved directory account. Existing email-only Auth login retains its fallback when no username-directory account exists. Changing email resets the resolved account/password; selection never changes a signed-in session.

Tests: account UI and Edge tests passed locally, including selection required, selected login forwarded, mismatch rejected, lookup throttled, and first-password gate.

Deployment attempt 2026-09-14: feature commit 5f5610bdb9706d913ae5ec3cf03ee1c491e18af2 reached GitHub Pages. Supabase deployment did not show success; a fresh editor still showed the old backend. Restored production tree through fast-forward commit 5b5f9b438a2c62efa93307cc0969ff09cf62a99c to preserve existing email sign-in. Local feature code is retained. Next: reconnect Supabase, deploy backend, re-publish frontend, verify lookup and distinct account sessions. No account creation or password resets performed. New production accounts have not been created in this task. A common initial password does not distinguish people before they change it; each must finish first-time setup before independent-account access is considered verified.


Follow-up 2026-09-14: user reconnected Supabase. Existing editor draft (13,260 chars) contains lookup-email. Deploy confirmation submitted; UI showed Deploying updates. Subsequent read-only status inspection was blocked by automatic approval review due to model capacity (not a code/deployment error). Backend deployment result remains unknown. Frontend remains restored to old login. Next action is read-only verification of backend deployment status/code, then republish feature tree 22fc67a49af8f6ace38ec6123c0626add7e4252a only if current main still matches rollback commit 5b5f9b438a2c62efa93307cc0969ff09cf62a99c. No new accounts or password changes.

Retry 2026-09-14 after user authorization: fresh Company Hub editor verified old server source (11,855 characters, lookup-email absent). Prepared source (13,260 chars) submitted. Deploying updates returned to the confirmation dialog without success or error; screenshot and error logs provided no failure reason. No frontend re-publication. Prepared browser tab handed to user to try the deploy button directly. Backend outcome of last attempt remains unverified.

Root cause confirmed from user screenshot: browser draft was corrupted by JavaScript String.replace replacement-string expansion of $& inside the inserted regex replacement literal. This substituted the matched login block header into the lookup code. Local source and GitHub feature source are valid; local Edge parser tests and UI tests pass. Prior session diagnosis was incorrect. Deploy exact complete local source without text replacement, then copy editor content back and compare SHA-256 before publishing. Current browser access was blocked by approval reviewer model-capacity error. No deployment or frontend republish performed after this diagnosis.
