# GROWVA Admin Cross-Page Session + Button Fix Report

## Root Cause

Stale/revoked Supabase auth session data could interrupt the admin entry flow during `getSession()`, `getUser()`, or profile lookup. When that happened, the ADMIN button path could fall back inconsistently or leave the UI waiting on auth refresh behavior instead of treating the user as logged out.

The admin shell also needed to be mounted early enough for reliable open-admin diagnostics across pages. Without early shell mounting and stable diagnostic selectors, `document.querySelector('.gv-admin-shell, .admin-shell, [data-admin-shell], [data-admin-panel]')` was not a dependable cross-page signal.

## Files Changed

- `admin/admin.js`
- `js/script.js`
- `admin/admin.css` remains modified from the prior admin/publish UI usability pass.
- `GROWVA_ADMIN_CROSS_PAGE_SESSION_PUBLISH_UI_FIX_REPORT.md`

## Exact Fix

- Added centralized `restoreAdminSession()` handling for Supabase session restore.
- Added defensive handling for revoked/invalid refresh token errors, `AuthApiError`, missing sessions, JWT/session refresh failures, profile lookup failures, and timeouts.
- Revoked/invalid Supabase sessions are treated as logged out, clear Supabase auth storage only, clear admin intent, and open the login modal instead of throwing or hanging.
- Timeout failures no longer clear Supabase auth storage on first failure; they return a retryable restore result.
- ADMIN button loading state is cleared in all open-admin outcomes.
- Added persistent admin intent via `growva_admin_mode_intent`, set only after valid Supabase admin profile restore and admin mode entry.
- Added cross-page admin navigation handoff via `growva_admin_nav_pending`.
- Kept admin shell self-mounting on boot and before admin entry; diagnostic selectors include `.gv-admin-shell`, `[data-admin-shell]`, and `[data-admin-panel]`.
- Added page-path read aliases so CMS reads tolerate `contact.html` and `/contact.html` style rows while writes continue using canonical `pagePath`.
- Removed anon-key prefix exposure from admin debug state.

## QA Result

Passed:

- Cleared stale Supabase auth keys in browser storage.
- Opened `http://localhost:5500/contact.html?utm_source=instagram&utm_medium=social&utm_campaign=test_campaign`.
- Clicked visible ADMIN button.
- Login/admin modal opened with no stuck `is-admin-loading`.
- Ran diagnostic selector query; returned `.gv-admin-root.gv-admin-shell`, not null.
- Ran `document.querySelector('[data-admin-action="open-admin"]').click()`; it opened admin login UI with no hang.
- Console check: 0 errors, 0 warnings.

Syntax checks passed:

- `node --check admin/admin.js`
- `node --check js/script.js`
- `node --check js/content-registry.js`

`git diff --stat`:

```text
admin/admin.css | 215 ++++++++++++++-
admin/admin.js  | 791 +++++++++++++++++++++++++++++++++++++++++++++++++-------
js/script.js    |   4 +
3 files changed, 920 insertions(+), 90 deletions(-)
```

Authenticated dashboard restore could not be fully verified without real Supabase admin credentials, but the stale-cleared logged-out path now opens the login modal cleanly and does not block admin entry diagnostics.

## Safe To Commit

Safe to commit the intended admin/CMS files. Do not commit `supabase/.temp/linked-project.json` unless it is intentionally meant to be tracked.

Exact commit command:

```bash
git add admin/admin.js admin/admin.css js/script.js GROWVA_ADMIN_CROSS_PAGE_SESSION_PUBLISH_UI_FIX_REPORT.md
git commit -m "Fix admin session restore and cross-page entry"
```
