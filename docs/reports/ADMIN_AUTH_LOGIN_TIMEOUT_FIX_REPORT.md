# Admin Auth Login Timeout Fix Report

## Root Cause

The local Supabase config was present and the SDK loaded correctly, but the admin login path collapsed too many auth outcomes into generic timeout/failure messaging. The placeholder `admin@growva.local` is a local mock/dev credential, not necessarily a real Supabase Auth user, so using it against real Supabase Auth could look like a broken login instead of a clear "not a real admin user" state.

The entry flow also cleared broad local admin storage on ordinary logged-out entry. That cleanup is now limited to real stale/invalid Supabase auth cases and timeout recovery.

## Files Changed

- `admin/admin.js`
- `ADMIN_AUTH_LOGIN_TIMEOUT_FIX_REPORT.md`

Note: `admin/admin.css` already had pending changes from the previous admin UI task and was not changed for this auth-only fix.

## What Was Fixed

- Added safe debug logging behind `window.GROWVA_ADMIN_DEBUG = true` or `?cmsDebug=true`.
- Added `window.growvaAdminDebug.testSupabase()` for console diagnostics.
- Added specific Supabase config/SDK initialization errors.
- Bounded `getSession()`, `getUser()`, sign-in, and profile restore checks with safe timeouts.
- Login button state now continues to reset in `finally`.
- Wrong credentials now show `Wrong email or password.`
- `admin@growva.local` now shows `This email is not a Supabase admin user. Use a real Supabase Auth user linked to public.admin_profiles.` when Supabase rejects it as invalid.
- Auth success with no role row now shows `Login succeeded, but no admin profile was found in public.admin_profiles.`
- Admin profile lookup remains on `public.admin_profiles`; no `cms_admin_profiles` query was added.
- Stale auth cleanup now removes only Supabase auth keys, not local CMS/mock draft storage.

## How To Test

1. Start local server:
   ```powershell
   python -m http.server 5500
   ```
2. Open:
   ```text
   http://localhost:5500/
   ```
3. Click ADMIN.
4. Try wrong credentials. Expected: a specific wrong-credentials/Supabase auth error, no hang, button resets.
5. Try `admin@growva.local` without `?mockAdmin=true`. Expected: a clear message that it is not a Supabase admin user unless that user really exists in Supabase Auth.
6. Try a real Supabase Auth admin user whose `auth.users.id` has a matching row in `public.admin_profiles`. Expected: enter Admin Mode and show owner/editor/viewer role.
7. Refresh while logged in. Expected: valid session restores; invalid/revoked session is treated as logged out without a stuck button.

## Console Debug Commands

Enable debug logs before reload:

```js
window.GROWVA_ADMIN_DEBUG = true;
location.reload();
```

Run diagnostics:

```js
await window.growvaAdminDebug.testSupabase();
window.growvaAdminDebug.getState();
```

Clear stale Supabase auth storage only:

```js
window.growvaAdminDebug.clearSupabaseAuthStorage();
```

## QA Result

Automated Chromium QA on `http://localhost:5500/` passed:

- Supabase URL: `https://nynyhjjvvfxrpbmwstkq.supabase.co`
- Publishable/anon key present: yes
- Supabase SDK loaded: yes
- Supabase client ready: yes
- `getSession()` worked and returned no logged-in session
- Auth health endpoint returned `200`
- Wrong credentials returned `Wrong email or password.`
- `admin@growva.local` returned the explicit Supabase admin-user guidance
- Submit button reset after failed login
- Admin mode was not entered for failed login
- No browser page errors were thrown

Real admin-user login was not executed because no real Supabase admin credentials were available in this session.

## Remaining Known Issue

To fully complete production verification, sign in with a real Supabase Auth user whose UUID is present in `public.admin_profiles` with role `owner`, `editor`, or `viewer`.

## Commands Run

```powershell
node --check admin/admin.js
node --check js/script.js
node --check js/content-registry.js
git diff --check
```

`git diff --check` only reported the existing Windows LF-to-CRLF working-copy warnings.
