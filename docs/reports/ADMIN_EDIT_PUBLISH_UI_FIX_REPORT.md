# Admin Edit/Publish UI Fix Report

## Root Cause

Two issues made the admin flow feel unreliable:

1. A stale/revoked Supabase auth session could interrupt admin entry. The admin entry path now treats revoked/invalid refresh token failures as logged out, clears stale auth storage where safe, clears loading state, and opens the login modal instead of leaving the ADMIN button stuck.
2. Publish converted draft rows to published rows but did not clear the source draft rows. That left draft counts and publish dialogs showing already-published changes, making refresh/preview behavior look inconsistent.

The admin shell also needed to mount early and remain discoverable for diagnostics. The shell now exists on boot and exposes `.gv-admin-shell`, while `[data-admin-action="open-admin"]` can recreate/mount the shell if needed.

## Files Changed

- `admin/admin.js`
- `admin/admin.css`
- `ADMIN_EDIT_PUBLISH_UI_FIX_REPORT.md`

## Exact Fix

- Added clearer inspector state: Current active, Published, Draft, and Hardcoded values are shown together.
- Preserved the "Draft saved" success message after re-rendering the inspector.
- Added safe diagnostics:
  - `[GROWVA CMS] Draft saved`
  - `[GROWVA CMS] Publish completed`
  - `[GROWVA CMS] Hydrated published content`
- After successful publish, matching draft rows are deleted from `cms_content` for the current `page_path`.
- Mock admin publish now also clears local mock draft rows.
- Updated draft/published row counters after publish cleanup.
- Published cache now prefers returned Supabase rows and falls back to the outgoing payload only if Supabase returns no selected rows.
- Visitor preview restores published text via `setEditableValue()` instead of raw `textContent`, preserving element-specific handling.
- Publish modal adds `admin-publish-dialog-open`, allowing selected-element overlays to be softened/hidden while the modal is open.
- Admin topbar, inspector, modal, selection outlines, and responsive drawer behavior were compacted with CSS-only overrides.

## Edit/Save/Publish Diagnosis

- Save Draft already wrote to the draft row path, but the success feedback was overwritten by the inspector re-render.
- Publish wrote the published row, but stale draft rows remained.
- Preview as Visitor could read stale dashboard-published state before using the fresher in-memory published cache.
- No `/` vs `index.html` path mismatch was found in `getPagePath()` during inspection.

## UI Overlap Fixes

- Topbar is smaller, narrower, and horizontally scrolls controls when needed.
- Inspector is reduced from 420px to 360px desktop width, with tighter padding and internal scrolling.
- Inspector action bar is sticky inside the panel, keeping Save/Reset controls reachable.
- Publish modal is constrained with an internal scroll area and sticky action row.
- Selected element outline and hover badge are quieter.
- Selected highlights and hover badges are hidden or softened when visitor preview or publish modal is active.
- Mobile admin panel behaves like a bottom drawer.

## Preview/Safe Mode Behavior

- Preview as Visitor hides admin topbar, panel, dashboard, edit outlines, hover badge, and selected outline.
- Published preview uses published rows first and falls back to original hardcoded values.
- Safe Mode was not changed. It remains visually present but less crowded due to the compact topbar controls.

## Browser QA Result

Passed automated Chromium QA through Playwright module:

- Opened `http://localhost:5500/contact.html?utm_source=instagram&utm_medium=social&utm_campaign=test_campaign`.
- Cleared stale Supabase auth keys with:
  `Object.keys(localStorage).filter(k => k.includes('supabase') || k.startsWith('sb-')).forEach(k => localStorage.removeItem(k)); sessionStorage.clear(); location.reload();`
- Clicked ADMIN.
- Confirmed `.gv-admin-shell, .admin-shell, [data-admin-shell], [data-admin-panel]` returned an element.
- Confirmed `[data-admin-action="open-admin"]` direct click opens admin UI without stuck `.is-admin-loading`.
- Confirmed no uncaught refresh-token/AuthApiError/session/JWT browser errors.
- In local mock-admin mode, selected the hero title, changed text to `QA EDIT TEST`, saved draft, opened publish dialog, confirmed the draft appeared, published, and entered Visitor Preview with overlays hidden.

Real authenticated Supabase owner publish/refresh QA was not executed because no admin credentials were available in this session. The real code path was inspected and syntax checked.

## Security Review

- `node --check admin/admin.js`: PASS
- `node --check js/script.js`: PASS
- `node --check js/content-registry.js`: PASS
- `git diff --check`: PASS except expected Windows LF-to-CRLF working-copy warnings.
- `git grep "SUPABASE_SERVICE_ROLE_KEY"`: no frontend secret introduced; existing hits are docs or server-side Edge Functions.
- `git grep "service_role"` / `git grep "sb_secret"`: frontend hits are unsafe-key rejection guards only.
- `git grep "RESEND_API_KEY"` / `git grep "Authorization"`: existing docs/server-side Edge Function usage only.
- `git grep "innerHTML"`: existing admin shell/rendering usage; edited user content remains escaped or applied with text-safe helpers.
- `git grep "javascript:"`: existing URL guard/block code only.

## Remaining Limitations

- A credentialed Supabase owner should still run one final real DB smoke test before production rollout: save draft, publish, refresh, and verify the published row hydrates.
- Existing generated reports and Supabase setup docs contain secret-name strings, but no secret values were added.
- `supabase/.temp/linked-project.json` is still untracked and was not touched.

## Safe To Commit

Yes, safe to commit. Use a credentialed Supabase smoke test before production deployment if this branch has not already had one.

## Exact Commit Command

```powershell
git add admin/admin.js admin/admin.css ADMIN_EDIT_PUBLISH_UI_FIX_REPORT.md; git commit -m "Fix admin edit publish UI reliability"
```
