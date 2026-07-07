# GROWVA Admin Session Persistence And Editor UX Fix Report

## 1. Root cause of session loss after navigation
The real helpers existed, but full-page navigation could still lose Admin Mode because the Supabase auth-state listener treated any no-session event as logout.

On a static full reload, Supabase can emit startup events before boot finishes restoring the stored session/profile. The previous listener cleared `growva_admin_mode_intent` when `!session`, even if the event was not explicit `SIGNED_OUT`. That could erase the admin intent before boot decided whether to restore Admin Mode on the new page.

## 2. Where Supabase storage was cleared or restore failed
`clearSupabaseAuthStorage()` now records:
- source
- reason
- keys removed count
- key names only, never token values
- current path/page path

Storage clearing is now reserved for explicit invalid/revoked refresh/JWT token failures or a user-triggered debug clear. Normal `no_session`, timeout, and navigation restore paths do not clear Supabase auth storage.

The invalid-session classifier was narrowed so plain `AuthApiError` and plain `session missing` are not enough to wipe storage. Missing session is handled as logged-out/no-session and clears only admin intent when appropriate.

## 3. Files changed
- `admin/admin.js`
- `js/script.js`
- `GROWVA_ADMIN_SESSION_PERSISTENCE_AND_EDITOR_UX_FIX_REPORT.md`

Existing modified files from prior work remain:
- `admin/admin.css`
- `ADMIN_ADMIN_BUTTON_FIX_REPORT.md`

`js/content-registry.js` was checked but not edited.

## 4. Auth/session behavior after fix
- Login success still sets `growva_admin_mode_intent = "1"` after a real profile is loaded.
- Public navigation sets `sessionStorage.growva_admin_nav_pending = "1"` when `admin-mode` or admin intent is active.
- Navigation also writes `growva_admin_last_navigation_handoff` with safe metadata.
- New page boot reads intent/nav handoff, restores Supabase session/profile, and enters Admin Mode if valid.
- `INITIAL_SESSION` or other no-session startup events no longer clear admin intent.
- `getSession` no-session does not clear Supabase auth storage.
- `getUser` missing-session clears admin intent only.
- Invalid/revoked refresh token errors clear Supabase auth storage and admin intent.

## 5. Exit Admin vs Logout behavior
Exit Admin:
- clears `growva_admin_mode_intent`
- clears `growva_admin_nav_pending`
- hides admin UI
- does not call `signOut`
- does not clear Supabase auth storage

Logout:
- calls `supabase.auth.signOut()`
- clears admin intent/navigation state
- exits admin UI
- after refresh, ADMIN should show login modal unless a new valid session exists

## 6. Card sub-field inspector fix
Card/group/section-like selections now open a sub-field inspector instead of defaulting to one generic card textarea.

The inspector shows:
- "Editable fields inside this card/section" style rows
- field label
- type
- value preview
- status
- Edit
- Save Draft
- Publish Field

If no nested editable fields exist, it shows:

```text
No separate editable fields found inside this card.
```

## 7. Link editing fix/status
Link/button editing remains implemented through `value_json`:

```json
{ "label": "...", "href": "...", "target": "...", "rel": "..." }
```

Allowed URLs:
- `http`
- `https`
- `mailto`
- `tel`
- relative paths
- `.html` paths
- hash links

`javascript:` URLs are rejected.

## 8. Image editing fix/status
Image inspector remains available for editable image/background fields:
- preview
- URL input
- alt text
- Save Draft
- Publish Image
- Media Library handoff

Upload is only enabled when Supabase, an authenticated owner/editor, and a non-file URL context are available. Otherwise the upload button is disabled and says:

```text
Upload not configured yet
```

## 9. Debug commands
Enable logs:

```js
window.GROWVA_ADMIN_DEBUG = true;
location.reload();
```

Trace persistence:

```js
await window.growvaAdminDebug.traceSessionPersistence()
```

Real readiness:

```js
window.growvaAdminDebug.assertRealAdminReady()
```

Full checklist:

```js
await window.growvaAdminDebug.runRealQaChecklist()
```

Clear only admin intent:

```js
window.growvaAdminDebug.clearAdminIntentOnly()
```

Storage clear trace:

```js
window.growvaAdminDebug.getState().lastAuthStorageClear
```

## 10. Real QA results
Static checks passed:

```bash
node --check admin/admin.js
node --check js/script.js
node --check js/content-registry.js
git diff --check
```

`git diff --check` passed with line-ending normalization warnings only.

Browser diagnostic QA without credentials:
- Opened `http://localhost:5500/work.html`.
- Verified `selfTest().ok === true`.
- Verified `traceSessionPersistence()` exists.
- Simulated admin intent/nav pending in an isolated browser context.
- Navigated to `http://localhost:5500/process.html`.
- Boot ran one auth restore attempt.
- `lastSessionRestoreResult.reason === "no_session"`.
- `authStorageClearCalls === 0`.
- a fake `sb-*` debug key remained present, proving no no-session storage wipe occurred.
- `clearAdminIntentOnly()` cleared intent/nav pending while preserving Supabase storage.
- No page errors.

Real Supabase owner/editor QA was not completed because no real admin credentials/session were available in this Codex browser context. Therefore final success for real cross-page persistence, save draft, publish, Exit Admin, and Logout cannot be claimed yet.

## 11. Remaining risks
- Real owner/editor login must still verify restore on `work.html`, `process.html`, and `work/shopify-stores.html`.
- Real save/publish still needs RLS verification.
- Existing browser tabs may need hard refresh to load the patched `admin/admin.js`.
- Existing corrupted CMS rows from old text-editing bugs may still need manual cleanup.

## 12. Git commands
Verification commands:

```bash
git status
node --check admin/admin.js
node --check js/script.js
node --check js/content-registry.js
git diff --check
```

Commit/push command is intentionally withheld until the real browser QA with a valid owner/editor session passes.
