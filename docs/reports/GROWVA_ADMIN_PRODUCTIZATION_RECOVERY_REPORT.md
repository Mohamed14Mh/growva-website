# GROWVA Admin Productization Recovery Report

## 1. Problems observed from video/user report
- ADMIN could hang or behave inconsistently when the browser had stale Supabase auth state.
- A revoked refresh token could interrupt the admin entry check instead of falling back to login.
- Admin shell diagnostics were unreliable unless the shell had already mounted.
- Dashboard navigation was too technical for a simple page/edit/publish workflow.
- Inspector actions were visually heavy and did not make draft/publish/reset state obvious.
- Image controls were hard to discover, especially on pages with CSS-generated visuals or no real image source.
- Existing published CMS data can still contain corrupted rows from earlier split-text editing bugs.

## 2. Root causes
- A stale/revoked Supabase auth session could interrupt the admin entry flow, while the admin shell was not mounted early enough for reliable open-admin diagnostics.
- Session/profile checks needed to treat revoked/invalid refresh token failures as logged-out state instead of propagating auth errors.
- The old dashboard surfaced advanced diagnostics as primary UI rather than a Shopify-like pages/current-page/media/publish path.
- Split/animated text required clean canonical values and idempotent hydration guards so edits replace full fields once.

## 3. Files changed
- `admin/admin.js`
- `admin/admin.css`
- `js/script.js`
- `GROWVA_ADMIN_PRODUCTIZATION_RECOVERY_REPORT.md`

`js/content-registry.js` was syntax-checked but not changed.

## 4. Auth/session behavior fixed
- `openAdminEntry()` now ensures the admin shell exists before session checks.
- Revoked/invalid refresh token, `AuthApiError`, missing session, invalid JWT/session refresh, and profile-check auth failures are handled as logged-out states.
- Stale Supabase auth keys are cleared with `clearSupabaseAuthStorage()` when safe.
- Admin mode intent is cleared for invalid sessions.
- ADMIN loading classes and `aria-busy` are cleared in `finally`.
- Login modal opens after failed session restore instead of leaving the ADMIN button stuck.
- Existing restore timeout/fallback behavior remains in place.

## 5. Cross-page behavior fixed
- `js/script.js` preserves normal public navigation for visitors.
- When admin mode or admin intent is active, navigation sets `sessionStorage.growva_admin_nav_pending = "1"`.
- Admin boot consumes nav pending and restores admin mode only when a valid admin session/intent exists.
- Exit Admin clears admin intent and returns to visitor mode; Logout signs out and clears admin UI state.

## 6. CMS text corruption fix
- Editable text uses clean full-field values instead of split animation fragments.
- Hydrated values mark clean state on the editable element so repeated applies do not append or duplicate text.
- Split/animated wrapper spans are treated defensively and not used as the canonical editable target.

## 7. Hydration/performance fix
- Published hydration is guarded by in-progress/promise/path/signature state.
- Page path aliases are read safely and de-duplicated by `edit_key`.
- Public render does not wait on admin auth.
- Hydration logs are limited; debug detail is available through `window.GROWVA_ADMIN_DEBUG`.

## 8. Dashboard simplification
Primary dashboard tabs are now:
- Overview
- Pages
- Current Page
- Media
- Publish Center
- Advanced

Pages lists 54 site pages grouped as main, service, work category, and work project pages. Current Page lists sections, editable text, images, and buttons/links. Existing CRM, Leads, Notifications, Media Library, Section Builder, Visual Editor, Tasks, and Control Center remain available under Advanced.

## 9. Inspector simplification
- Text/image inspectors show current, draft, published, and hardcoded/default state.
- Main actions are visible: Save Draft, Publish This Field/Image, Reset Draft, Revert to Published.
- Technical edit keys are kept under details-style UI instead of dominating the first view.
- The panel remains compact and scrollable.

## 10. Image editing/media status
- Added current-page image inventory through dashboard Media and debug helper.
- Editable images show preview and replacement/media-library controls when supported.
- Non-editable images are listed with reasons.
- Pages with no real image fields show that status instead of hiding the missing capability.

## 11. Debug commands
Browser console helpers:

```js
window.growvaAdminDebug.getCmsState()
await window.growvaAdminDebug.listCurrentPageOverrides()
await window.growvaAdminDebug.findOverrideByText("Work That Performs.00")
window.growvaAdminDebug.listCurrentPageImages()
await window.growvaAdminDebug.resetOverride("work.page_hero_1.h1.work_that_performs", "published", "RESET_GROWVA_OVERRIDE")
```

The reset helper requires an active admin session and exact confirmation.

## 12. SQL cleanup for corrupted rows
Inspect `work.html` rows:

```sql
SELECT id, page_path, edit_key, edit_type, status, value_text, value_json, updated_at
FROM public.cms_content
WHERE page_path IN ('work.html', '/work.html')
ORDER BY updated_at DESC;
```

If the bad published row is confirmed:

```sql
UPDATE public.cms_content
SET value_text = 'Work That Performs.',
    updated_at = now()
WHERE page_path IN ('work.html', '/work.html')
  AND edit_key = 'work.page_hero_1.h1.work_that_performs'
  AND status = 'published';
```

Prior QA found the affected edit key as `work.page_hero_1.h1.work_that_performs`; current local QA saw an existing published override value of `TEST CLEAN TITLE`, so review the table before running cleanup.

## 13. QA results
- `node --check admin/admin.js`: pass.
- `node --check js/script.js`: pass.
- `node --check js/content-registry.js`: pass.
- Browser QA on `contact.html?utm_source=instagram&utm_medium=social&utm_campaign=test_campaign`:
  - Cleared stale Supabase local/session storage before testing.
  - ADMIN click mounted `.gv-admin-shell` with `data-admin-shell="true"`.
  - Login modal opened while logged out.
  - ADMIN button did not remain in `is-admin-loading`.
  - Exact `document.querySelector('[data-admin-action="open-admin"]').click()` path opened admin UI with no hang.
  - Console showed only one CMS hydration info line, no uncaught auth error.
- Mock admin QA on `work.html?mockAdmin=true`:
  - Mock sign-in entered admin mode.
  - Dashboard showed Overview, Pages, Current Page, Media, Publish Center, Advanced.
  - Pages tab listed 54 page cards.
  - Current Page tab listed 144 editable rows.
  - Media tab showed page image/media status.
  - Advanced preserved 16 existing technical modules.
  - Inspector selection from Current Page opened the compact actions: Save Draft, Publish This Field, Reset Draft, Revert to Published.

Real Supabase admin credentials were not available in this session, so real login, real publish, and cross-page restoration with a real Supabase JWT should be smoke-tested by an authorized admin before production deployment.

## 14. Remaining risks
- Existing Supabase `cms_content` rows may still contain old corrupted values until reviewed/reset.
- Mock admin cannot fully prove real Supabase RLS/write behavior.
- CSS-generated visuals without real `img`/inline background sources remain non-editable by design and are reported as such.
- `supabase/.temp/linked-project.json` is untracked and must not be committed.

## 15. Git commands
Safe to commit after reviewing the diff and excluding `supabase/.temp` plus unrelated historical reports.

Exact commit command:

```bash
git add admin/admin.js admin/admin.css js/script.js GROWVA_ADMIN_PRODUCTIZATION_RECOVERY_REPORT.md
git commit -m "Productize and stabilize GROWVA admin CMS"
git push
```
