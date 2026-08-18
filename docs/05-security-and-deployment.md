# Security & Deployment Checklist

## Before production use

1. Back up the Supabase database and test the migration in
   `supabase/migrations/202608180001_normalized_rbac.sql` on staging.
2. Set each user's `app_metadata.company_role` to `staff`, `lead`, `exec`, or
   `admin`, and set `app_metadata.department` to a department code.
3. Apply the migration and verify RLS with one account for every role.
   Then apply `202608180002_department_visibility.sql` and promote the first
   administrator in SQL before opening the access-management page:

   ```sql
   update public.profiles set role='admin' where email='YOUR_ADMIN_EMAIL';
   ```
4. Move frontend reads/writes from the legacy `company_hub_state` JSON row to
   the normalized tables by applying
   `202608180003_normalized_workspace_cutover.sql`. On the first admin load the
   previous blob is archived, Task/SOP/Knowledge/KPI data is written as
   department-scoped rows, and those keys are removed from the shared blob.
5. Configure the Supabase password-reset redirect URL for the GitHub Pages URL.
6. Run the role, concurrency, XSS, mobile, and KPI approval test cases before
   inviting the full company.

## Role behavior in the current page

The authenticated role now comes from Supabase user metadata. The role switch
is hidden during normal use and is available only when the URL contains
`?demo=1`. UI checks improve usability, while RLS remains the security boundary.

After the visibility migration is applied, `profiles` becomes the primary role
source. Executives/admins see **จัดการสิทธิ์ผู้ใช้** and can set a role,
primary department, and any additional visible departments for existing Auth
accounts. Executives/admins see all departments; other roles see only their
primary and explicitly assigned departments.

## Data migration order

Departments and profiles -> tasks and assignees -> comments/time/events -> SOP
versions and knowledge -> KPI definitions/results. Keep the legacy JSON row as
a read-only backup until row counts and totals have been reconciled. Migration
003 also keeps an immutable copy in `company_hub_legacy_archive` before the
shared row is sanitized.

## Normalized cutover verification

After the first admin login, verify that `tasks`, `sops`,
`knowledge_articles`, `kpi_definitions`, and `kpi_results` contain rows. The
`company_hub_state.data` object must no longer contain `TASKS`, `KB`, or
`KPI_ACT`. The frontend now uses `sync_normalized_workspace` for writes; that
function re-checks the caller role and department on the database before every
upsert.
