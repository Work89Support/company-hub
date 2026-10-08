# Company Hub release candidate review — 8 October 2026

## Decision

The current local working tree is a release candidate after the approved QA fixes. It has not been deployed. Production remains unchanged until a separate deployment instruction is given.

## Fixed in this candidate

- Clarified the product title, page description, social metadata and favicon.
- Added a documented design system for color, typography, spacing, radius, components and page structure.
- Improved shared page hierarchy, spacing, cards, filters, status labels and touch targets.
- Improved dense boards and tables with contained horizontal navigation on narrow screens.
- Improved the activity form error message so employees are not shown migration or raw database instructions.
- Converted the sign-in surface to an accessible modal with a focus trap, background isolation, alert messaging, busy state and focus restoration.
- Improved mobile modal sizing, one-column summaries, 44-pixel touch targets and 16-pixel form text.
- Added regression coverage for menu visibility by role, live authorization gates, light/dark contrast, mobile layout and text resilience.

## Automated verification

`npm test` covers static/syntax checks, the native activity entry flow, login accessibility, role/menu rules, mobile and dark-mode safeguards, graphic pagination, KPI work, company accounts, 23 rendered screens, team board, access/security separation, department workflows, reporting integrity, the activity wizard, active KPI rules and central Audit/Programmer migrations.

The dependency audit reports zero known vulnerabilities at the time of this review.

## Verified scope and remaining live checks

The fixes and simulated user flows are verified locally. A real production RLS session for Staff, Lead and Executive/Admin is still not verified because the QA rule prohibits using real accounts and real customer data. Local visual browsing was also unavailable because the browser policy blocks `file://` pages. These items require safe test accounts and a served preview or staging URL.

The local branch has diverged from `origin/main` and the working tree contains earlier unrelated QA assets and data files. No automatic merge, commit, push or deployment was performed, so those existing changes were not mixed into a release without review.

## Release sequence

1. Reconcile the local branch with `origin/main` in a clean release branch while preserving only reviewed changes.
2. Run `npm test` again on that exact release commit.
3. Test Staff, Lead and Executive/Admin with synthetic accounts against staging, including RLS denial cases.
4. Check the main flows at 390 px mobile width, 200% text zoom and dark mode in a real browser.
5. Deploy only after explicit approval, then run a production smoke test without creating real business records.
