# GROWVA Admin Stability Recovery Report

Date: 2026-07-06

## 1. Root Cause Summary

The CMS text corruption came from plain-text admin fields interacting with animation-generated text wrappers. Public `js/script.js` splits `.hero-title` and `.page-hero-title` text into `.word-clip > .word` spans for headline animation. The admin text reader/writer could treat the first wrapper span as the editable text target, so editing `Work That Performs.` to `MOHAMED` could update only the first generated word span and leave the remaining generated spans in place, producing output like `MOHAMED That Performs.` or similar appended fragments.

There was also an alias-row stability issue: current CMS reads allow both canonical paths such as `work.html` and legacy slash-prefixed paths such as `/work.html`. The row ordering needed to consistently prefer canonical paths and then newest rows.

## 2. Video-Observed Issues

- Admin opened but text editing was unstable.
- Hero/title edits could append old fragments instead of replacing the full field.
- Published content hydration could appear more than once.
- Refresh felt slow because published hydration and auth restore were doing too much repeated work.
- Admin opening without a password was sometimes valid stored-session behavior, but needed to be predictable.
- Admin overlay needed to stay compact and not dominate the page.

## 3. Why Text Duplicated

The public headline animation wraps words in generated spans. The old admin read/write path looked for a child with text and, when there were only a few children, edited that child. On a split headline, that child can be the first `.word-clip`, not the actual source text field.

Fix:

- `getEditableValue()` now detects generated split wrappers and reads a clean full-field value.
- `setEditableValue()` now detects split wrappers and replaces the whole editable field with one clean `textContent` value.
- Applied CMS text marks the element with `data-cms-hydrated` and `data-cms-clean-value`.
- `applyRowToElement()` is idempotent via a row signature and skips reapplying the same value when the DOM already matches.

## 4. Was GSAP/SplitText Involved?

Yes. The project does not use GSAP SplitText specifically in the inspected code, but `js/script.js` has a custom word-level splitter for `.hero-title` and `.page-hero-title`. That splitter was enough to create the same class of issue: generated word spans became the admin editing target instead of the clean field value.

## 5. Why Refresh Was Slow

Previous fixes already reduced duplicate boot hydration. This pass adds a per-page published content hydration guard:

- `publishedHydrationInProgress`
- `publishedHydrationPromise`
- `hydratedPagePaths`
- `lastHydratedAt`

`loadPublishedEdits()` now hydrates once per page unless explicitly forced, has a 10-second fallback, caches rows for the page lifecycle, and logs:

```js
[GROWVA CMS] Hydrated published content { pagePath, count }
```

once per page in the normal boot path.

## 6. Why Admin Opened Without Password

If a valid Supabase session already exists, clicking ADMIN can enter Admin Mode without asking for the password. That is valid stored-session behavior.

Normal public page load should not forcibly open Admin Mode unless `growva_admin_mode_intent` is present. Exit Admin clears the UI intent but keeps the Supabase session. Logout signs out and clears admin intent/navigation state.

## 7. Safe Or Unsafe Behavior?

Valid session + explicit ADMIN click: safe and expected.

Valid session + normal public load with no intent: should not auto-open admin.

Logout + refresh: should not auto-enter admin; clicking ADMIN should show the login modal if no session remains.

## 8. Files Changed

- `admin/admin.js`
- `GROWVA_ADMIN_STABILITY_RECOVERY_REPORT.md`

Existing dirty files from prior phases remain:

- `admin/admin.css`
- `js/script.js`

No HTML, public CSS, Supabase Edge Functions, or SQL files were changed by this recovery pass.

## 9. Exact Fixes

- Added split-text detection for `.word-clip`, `.word`, `.char`, `.line`, `[data-split]`, and `[data-split-text]`.
- Plain text reads now return the clean intended value, not generated animation fragments.
- Plain text writes now replace split headline contents once instead of editing one generated span.
- Added idempotent CMS row application signatures.
- Added hydration guard state and lifecycle cache for published content.
- Fixed alias row preference so canonical `pagePath` wins first, then newest row.
- Upgraded `window.growvaAdminDebug.getCmsState()`.
- Upgraded `window.growvaAdminDebug.listCurrentPageOverrides()` to query current page canonical path plus aliases and return previews only.
- Upgraded `window.growvaAdminDebug.findOverrideByText(text)` to search preview rows.
- Hardened `window.growvaAdminDebug.resetOverride(editKey, status, confirmation)` so it only runs when confirmation exactly equals `RESET_GROWVA_OVERRIDE`.

## 10. Debug Commands

```js
window.GROWVA_ADMIN_DEBUG = true;
window.growvaAdminDebug.getCmsState();
await window.growvaAdminDebug.listCurrentPageOverrides();
await window.growvaAdminDebug.findOverrideByText("MOHAMED");
await window.growvaAdminDebug.findOverrideByText("Work That Performs.00");
```

Safe reset helper:

```js
await window.growvaAdminDebug.resetOverride(
  "PUT_BAD_EDIT_KEY_HERE",
  "published",
  "RESET_GROWVA_OVERRIDE"
);
```

The reset helper requires a valid admin session and does not expose secrets or full tokens.

## 11. Manual SQL Cleanup For Corrupted CMS Rows

Inspect `work.html` rows:

```sql
SELECT id, page_path, edit_key, edit_type, status, value_text, updated_at
FROM public.cms_content
WHERE page_path IN ('work.html', '/work.html')
ORDER BY updated_at DESC;
```

Delete a known bad row by exact edit key:

```sql
DELETE FROM public.cms_content
WHERE page_path IN ('work.html', '/work.html')
  AND edit_key = 'PUT_BAD_EDIT_KEY_HERE'
  AND status IN ('draft', 'published');
```

Update a known bad published row:

```sql
UPDATE public.cms_content
SET value_text = 'Work That Performs.',
    updated_at = now()
WHERE page_path IN ('work.html', '/work.html')
  AND edit_key = 'PUT_BAD_EDIT_KEY_HERE'
  AND status = 'published';
```

Do not use `user_id` for admin profile checks. The admin profile key is `public.admin_profiles.id = auth.users.id`.

## 12. QA Results

Baseline:

- `node --check admin/admin.js`: PASS
- `node --check js/script.js`: PASS
- `node --check js/content-registry.js`: PASS
- `git diff --check`: PASS, with existing LF-to-CRLF warnings only

Browser QA on `http://localhost:5500/work.html`:

- Public page loaded normally.
- Debug state returned canonical path `work.html`, aliases `work.html` and `/work.html`.
- `listCurrentPageOverrides()` found an existing corrupted published row:
  - `edit_key`: `work.page_hero_1.h1.work_that_performs`
  - `valuePreview`: `Work That Performs.00`
- Hydration log appeared once for the page.
- Console had 0 errors and 0 warnings.

Mock admin edit/publish QA on `http://localhost:5500/work.html?mockAdmin=true`:

- Entered Admin Mode.
- Selected the work hero title.
- Inspector read the full clean field value, not only the first generated word.
- Edited to `TEST CLEAN TITLE`.
- Save Draft changed DOM title to exactly `TEST CLEAN TITLE`.
- Publish modal showed exactly `TEST CLEAN TITLE`.
- Confirm Publish left DOM title exactly `TEST CLEAN TITLE`.
- Draft storage cleared after mock publish.

Real Supabase publish/refresh QA was not completed because the real admin password is not available in this Codex session. The existing corrupted Supabase row was intentionally not deleted or overwritten automatically.

## 13. Remaining Risks

- Existing corrupted Supabase rows can still hydrate corrupted text until manually updated/deleted.
- Mock publish is local-memory behavior and does not persist across browser refresh; real Supabase publish must be verified with credentials.
- If future public animation code introduces different generated text wrappers, add their selectors to `hasAnimatedTextSplit()`.
- Some non-headline fields with intentional nested markup may be flattened when edited as plain text; this matches the current text-only CMS safety model.

## 14. Git Commands

```bash
git status
node --check admin/admin.js
node --check js/script.js
node --check js/content-registry.js
git diff --check
git add admin/admin.js admin/admin.css js/script.js GROWVA_ADMIN_STABILITY_RECOVERY_REPORT.md
git commit -m "Stabilize admin CMS editing and hydration"
git push
```

Do not commit:

- `supabase/.temp/`
- secrets
- `node_modules`
- package lock files unless intentionally tracked
