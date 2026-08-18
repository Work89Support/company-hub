# Security & Deployment Checklist

## Before production use

1. Back up the Supabase database and test the migration in
   `supabase/migrations/202608180001_normalized_rbac.sql` on staging.
2. Set each user's `app_metadata.company_role` to `staff`, `lead`, `exec`, or
   `admin`, and set `app_metadata.department` to a department code.
3. Apply the migration and verify RLS with one account for every role.
4. Move frontend reads/writes from the legacy `company_hub_state` JSON row to
   the normalized tables. The migration intentionally makes the legacy blob
   read-only for staff.
5. Configure the Supabase password-reset redirect URL for the GitHub Pages URL.
6. Run the role, concurrency, XSS, mobile, and KPI approval test cases before
   inviting the full company.

## Role behavior in the current page

The authenticated role now comes from Supabase user metadata. The role switch
is hidden during normal use and is available only when the URL contains
`?demo=1`. UI checks improve usability, while RLS remains the security boundary.

## Data migration order

Departments and profiles -> tasks and assignees -> comments/time/events -> SOP
versions and knowledge -> KPI definitions/results. Keep the legacy JSON row as
a read-only backup until row counts and totals have been reconciled.

