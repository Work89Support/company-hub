# Company Hub release 20261025-polish-1

## Changes

- Fixed the 390 px layout so the document, top bar, and main content stay within the viewport.
- Loaded Team Accounts sources concurrently instead of waiting for three sequential requests.
- Added consistent numeric and time controls: numeric keyboards, step buttons, common-value choices, and five-minute time steps.
- Kept source rows without employee names in a department review queue. The system does not guess a person for those rows.
- Added an explicit production release marker and cache versions for every changed browser asset.
- Updated release checks to follow the current split-module application instead of the retired single-file layout.

## Verification

- `npm test` passes the static and UI suites.
- Browser measurement at 390 x 844: `innerWidth=390`, `scrollWidth=390`, `topbar=390`, `main=390`.
- The automated chat test covers two distinct users, direct and group rooms, realtime delivery, unread state, floating notifications, stickers, and private attachment primitives.
- A live two-browser chat exchange still requires two authenticated staff sessions and is intentionally not claimed by the automated result.

