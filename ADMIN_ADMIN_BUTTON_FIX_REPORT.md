# Admin Button Fix Report

## Root Cause

The admin entry flow could be interrupted by a stale or revoked Supabase auth session stored in browser localStorage/sessionStorage. When Supabase session refresh failed, the session/profile check could throw or mark the connection as failed before the admin entry fallback opened the login modal. At the same time, the admin shell was not mounted early enough to make open-admin diagnostics reliable before a click.

## Files Changed

- `admin/admin.js`
- `ADMIN_ADMIN_BUTTON_FIX_REPORT.md`

## Exact Fix

- Added defensive Supabase auth error classification for revoked refresh tokens, invalid refresh tokens, `AuthApiError`, missing auth sessions, JWT/session expiration, and session refresh failures.
- Added safe cleanup for Supabase-owned browser auth storage keys only: keys containing `supabase` or starting with `sb-`.
- Added a shared admin auth reset path that clears `currentUser` and `adminProfile`, keeps the configured Supabase client usable, updates the topbar, and treats the user as logged out.
- Wrapped `getSession()` retries and `loadAdminProfile()` checks so stale auth failures return `false` instead of throwing uncaught errors.
- Kept the admin entry session timeout fallback at 2500ms and added the same bounded check to boot auto-session detection.
- Ensured admin entry buttons always clear `is-admin-loading` and `aria-busy` in the open-admin `finally` path.
- Kept the admin shell self-mounting fix:
  - `ensureRoot()` creates the root on boot.
  - The root exposes `.gv-admin-shell` and `data-admin-shell`.
  - The inspector exposes `data-admin-panel`.
  - Clicking `[data-admin-action="open-admin"]` calls `ensureRoot()` before session checks.

## QA Result

- Cleared stale browser auth state before retesting:
  - `Object.keys(localStorage).filter(k => k.includes('supabase') || k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));`
  - `sessionStorage.clear();`
  - `location.reload();`
- Opened `http://localhost:5500/contact.html?utm_source=instagram&utm_medium=social&utm_campaign=test_campaign`.
- Clicked the `ADMIN` button.
- Result: admin login modal opened, admin shell was mounted, and the button did not hang in loading state.
- Verified `document.querySelector('.gv-admin-shell, .admin-shell, [data-admin-shell], [data-admin-panel]')` returned an element.
- Ran `document.querySelector('[data-admin-action=open-admin]').click()` from the browser context.
- Result: admin UI remained/opened successfully with no hang and no loading state.
- Browser console check: `0` errors, `0` warnings.

## Static Checks

- `node --check admin/admin.js`: passed
- `node --check js/script.js`: passed
- `node --check js/content-registry.js`: passed
- `git diff --stat`: `admin/admin.js | 158 +++++++++++++++++++++++++++++++++++++++++++++++++--------`

## Safe To Commit

Yes. The fix is scoped to the admin entry/session handling in `admin/admin.js` plus this report.

Exact commit command:

```bash
git add admin/admin.js ADMIN_ADMIN_BUTTON_FIX_REPORT.md && git commit -m "Fix admin entry stale auth handling"
```
