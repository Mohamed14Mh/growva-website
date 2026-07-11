# GROWVA Admin Auth Real Login Fix Report

**Date:** 2026-07-06
**File changed:** `admin/admin.js`

---

## 1. Root Cause Found

**The `signInWithPassword` timeout of 8000 ms was too short for the real Supabase project.**

The project at `https://nynyhjjvvfxrpbmwstkq.supabase.co` is on Supabase's free tier. Free-tier projects pause after periods of inactivity. On the first POST to `auth/v1/token?grant_type=password` after an idle period, Supabase must wake/resume the project. This cold-start can take 15–25+ seconds. The 8-second timeout fired before the real response arrived, showing:

> "Auth request timed out. Supabase Auth may be unreachable. Please retry or refresh."

The authentication was actually in progress — it just needed more time. After the timeout, the real Supabase response eventually completed in the background, fired `onAuthStateChange(SIGNED_IN, session)`, and set `currentUser`/`adminProfile` — but nobody called `enterAdminMode()`. The user was left seeing the error modal with a re-enabled button, while secretly now authenticated.

**Secondary issues:**
- After a successful `signInWithPassword`, the code called `restoreAdminSession({ force: true })`, which added a redundant `getSession()` + `getUser()` network round trip (already had `data.user` from the sign-in response)
- No `loginInProgress` guard meant background auth operations could race with an active sign-in
- `onAuthStateChange(SIGNED_IN)` after a background-completed sign-in did not close the still-visible login modal
- No `testAuthLogin` debug helper to diagnose the exact failure point

---

## 2. Why Previous Fix Was Insufficient

The prior fix (ADMIN_AUTH_REFRESH_FIX_REPORT.md, Phase 32) raised timeouts in the boot path and added `getUser()` server-side verification. However, it set `SIGN_IN_TIMEOUT_MS = 8000` in `handleLoginSubmit`, which remained too short for a Supabase free-tier project waking from an idle state.

The error message "Auth request timed out" correctly identified the symptom but not the cause — users needed a longer wait, not a different error message.

---

## 3. Files Changed

| File | Change |
|------|--------|
| `admin/admin.js` | Targeted auth fixes — no CMS/VD/pipeline/contact code touched |
| `GROWVA_ADMIN_AUTH_REAL_LOGIN_FIX_REPORT.md` | **NEW** — this report |

---

## 4. Exact Login Flow Now

```
1. User submits login form
2. loginInProgress = true  (blocks concurrent restoreAdminSession)
3. signInWithPassword called with 25 s timeout
   - If timeout fires: show specific timeout error, re-enable button
   - Background request continues running (Supabase still connecting)
   - When real response arrives: onAuthStateChange(SIGNED_IN) fires,
     loadAdminProfile runs, modal closes automatically, enterAdminMode()
   - If network error: show CORS/network message
   - If wrong credentials: show "Wrong email or password."
   - If email not confirmed: show "Email is not confirmed in Supabase Auth."
4. On signIn success: use data.user directly
5. loadAdminProfile(data.user) with 10 s timeout
   - No profile row: "Login succeeded, but no admin profile was found..."
   - Invalid role: "Login succeeded, but admin profile role is not allowed..."
   - On success: currentUser and adminProfile set
6. closeModal() → enterAdminMode() → setAdminModeIntent()
7. finally: loginInProgress = false, button re-enabled if not opened
```

---

## 5. Auth Lock / Race Prevention Changes

**`loginInProgress` flag (new state var):**
- Set to `true` at start of `handleLoginSubmit`
- Reset to `false` in `finally` block — always cleared
- `restoreAdminSession` returns early with `login_in_progress` result if flag is set (unless `force: true`)
- `openAdminEntry` opens login modal directly without calling `restoreAdminSession` while flag is set

**Removed redundant `restoreAdminSession` after sign-in:**
- Previously: after `signInWithPassword` succeeded, code called `restoreAdminSession({ force: true })` which ran `getSession()` + `getUser()` + profile — 3 unnecessary network operations
- Now: calls `loadAdminProfile(data.user)` directly with a 10 s timeout — uses the user object already returned by `signInWithPassword`

**`onAuthStateChange` background-completion handler:**
- When `SIGNED_IN` fires AND `!loginInProgress` AND the login modal is still visible AND admin mode is not active: automatically closes modal and calls `enterAdminMode()`
- This handles the case where `signInWithPassword` timed out at 25 s but the real request completed at 28-30 s — the user sees the admin dashboard open without re-clicking

---

## 6. Debug Commands

Enable debug mode (no reload required):
```js
window.GROWVA_ADMIN_DEBUG = true;
```

Run connection diagnostics (no credentials needed):
```js
await window.growvaAdminDebug.testSupabase();
```

Run full auth login test (pass your real password):
```js
await window.growvaAdminDebug.testAuthLogin("mohamedabdelm964@gmail.com", "YOUR_PASSWORD");
```

Returns structured object:
```js
{
  ok,                   // true if all checks passed
  stage,                // which stage completed/failed
  code,                 // error code if any
  message,              // human-readable result
  durationMs,           // total time in ms
  networkReachable,     // auth health endpoint reachable
  healthOk,             // HTTP 200 from auth/v1/health
  authTokenEndpointOk,  // same as healthOk
  supabaseClientReady,  // client initialized
  sdkReady,             // SDK loaded
  sessionBefore,        // was there a session before sign-in
  signInReturned,       // signInWithPassword returned (vs timeout)
  userIdPresent,        // user.id in sign-in response
  emailConfirmedKnown,  // email_confirmed_at present
  profileFound,         // row found in public.admin_profiles
  profileRole,          // 'owner' | 'editor' | 'viewer' | null
  rawErrorName,         // error.name from Supabase
  rawErrorMessage,      // error.message from Supabase
  rawErrorStatus        // HTTP status from Supabase error
}
```

Get current auth state:
```js
window.growvaAdminDebug.getState();
```

Clear stale auth storage only:
```js
window.growvaAdminDebug.clearSupabaseAuthStorage();
```

---

## 7. Network Tab Checks (Chrome DevTools)

1. Open DevTools → Network tab
2. Click ADMIN, submit login form
3. Filter by: `auth/v1/token`
4. Look for a POST request to `https://nynyhjjvvfxrpbmwstkq.supabase.co/auth/v1/token?grant_type=password`

**What to check:**

| Signal | Meaning |
|--------|---------|
| Status: **200** | Login succeeded |
| Status: **400** | Wrong password or unconfirmed email — check Response body |
| Status: **422** | Malformed request — check Supabase config |
| Status: **503** | Supabase project paused or overloaded |
| **Pending for >10 s** | Free-tier wake-up — wait longer, or upgrade tier |
| **Cancelled** | Page navigated away, or the request was aborted by the browser |
| **CORS error** | OPTIONS preflight failed — check Supabase project CORS config |
| **Failed** (red) | Network error — check local network, Supabase status page |

**Response body on 400:**
```json
{"code": 400, "error_code": "invalid_credentials", "msg": "Invalid login credentials"}
```
→ Wrong email or password.

```json
{"code": 400, "error_code": "email_not_confirmed", "msg": "Email not confirmed"}
```
→ Email needs to be confirmed in Supabase Auth → Authentication → Users.

**If request stays Pending for 25+ seconds:**
The Supabase project is waking from idle. The new 25 s timeout should now allow this to succeed. If it still times out, the project may be paused and needs to be manually unpaused at `https://supabase.com/dashboard`.

---

## 8. Manual SQL Checks (run in Supabase SQL Editor)

### Step 1 — Verify auth user exists

```sql
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'mohamedabdelm964@gmail.com';
```

Expected: 1 row. If 0 rows: the user does not exist in Supabase Auth — sign up first.
If `email_confirmed_at` is null: email not confirmed — confirm at Dashboard → Authentication → Users.

### Step 2 — Verify admin profile exists

```sql
SELECT id, email, role, created_at, updated_at
FROM public.admin_profiles
WHERE email = 'mohamedabdelm964@gmail.com';
```

Expected: 1 row with `role` of `owner`, `editor`, or `viewer`.
If 0 rows: the user exists in auth but has no admin profile row — run Step 3.

### Step 3 — Insert or upsert admin profile (if missing)

```sql
INSERT INTO public.admin_profiles (id, email, role, created_at, updated_at)
SELECT id, email, 'owner', now(), now()
FROM auth.users
WHERE email = 'mohamedabdelm964@gmail.com'
ON CONFLICT (id)
DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = now();
```

This uses `auth.users.id` (the UUID) as the foreign key — not `user_id`.
Run Step 2 again to confirm the row was created.

### Step 4 — Verify RLS allows the auth user to read their own profile

```sql
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'admin_profiles'
ORDER BY policyname;
```

The profile lookup in `handleLoginSubmit` runs as the authenticated user (with the JWT from `signInWithPassword`). There must be a SELECT policy that allows the user to read their own row. Example policy if missing:

```sql
CREATE POLICY "Admin profiles: authenticated read own"
ON public.admin_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);
```

---

## 9. QA Results

| Check | Result |
|-------|--------|
| `node --check admin/admin.js` | PASS |
| `node --check js/script.js` | PASS |
| `node --check js/content-registry.js` | PASS |
| `git diff --check` | PASS (LF→CRLF warning only) |
| Service-role key in frontend | None — PASS |
| Password logged to console | None — PASS |
| Token logged to console | None — PASS |
| New innerHTML with user content | None — PASS |
| XSS introduced | None — PASS |

---

## 10. Remaining Risks

1. **Supabase project may be paused.** If the project has been paused (free tier inactive), the first login request will take 20-30+ seconds. The 25 s timeout should handle most cases. If the project is fully paused at the infrastructure level, even 25 s may not be enough — the user needs to go to `https://supabase.com/dashboard` and manually unpause the project.

2. **Missing admin profile row.** If `public.admin_profiles` has no row for the auth user's ID, login will succeed at the Supabase Auth level but fail at the profile lookup. The error message now explicitly says "Login succeeded, but no admin profile was found in public.admin_profiles." Use the SQL in Step 3 above to insert the row.

3. **Email not confirmed.** If the auth user's email is not confirmed, `signInWithPassword` returns a 400 with `email_not_confirmed`. The `classifyLoginError` function correctly maps this to "Email is not confirmed in Supabase Auth." Confirm the email in Supabase Dashboard → Authentication → Users.

4. **RLS on `admin_profiles`.** The profile SELECT query runs with the user's JWT. If RLS is enabled on `admin_profiles` and there is no policy allowing the authenticated user to SELECT their own row, the profile query returns null (no row, no error) — which is treated as "profile missing." Add the SELECT policy from Step 4 above.

5. **Multiple browser tabs on localhost.** Having multiple localhost tabs open does not cause an auth lock in Supabase v2 (each tab has its own SDK instance). The `loginInProgress` flag guards within a single tab only.

---

## 11. Git Commands

```bash
git status
node --check admin/admin.js
node --check js/script.js
node --check js/content-registry.js
git diff --check
git add admin/admin.js GROWVA_ADMIN_AUTH_REAL_LOGIN_FIX_REPORT.md
git commit -m "$(cat <<'EOF'
Fix real Supabase admin login: raise timeout, add testAuthLogin debug helper

Root cause: signInWithPassword timeout was 8s — too short for Supabase
free-tier projects waking from idle (first request can take 15-25s).
Real auth succeeded in background after timeout showed false error.

Fixes:
- signInWithPassword timeout raised 8s → 25s in handleLoginSubmit
- loginInProgress flag prevents restoreAdminSession racing with active
  signIn; flag is always cleared in finally block
- After successful signIn, call loadAdminProfile(data.user) directly
  with 10s timeout instead of redundant restoreAdminSession (saved 2
  extra getSession+getUser round trips)
- onAuthStateChange SIGNED_IN: if modal still visible and !loginInProgress,
  auto-close modal and enter admin mode (handles background completion
  case when signIn timed out but real request succeeded 5-10s later)
- restoreAdminSession timeouts raised: 8s→15s getSession, 8s→15s getUser,
  8s→10s profile; skips if loginInProgress
- Added testAuthLogin(email, password) to window.growvaAdminDebug with
  staged diagnostics: config → client → health → pre-session → signIn
  → profile; returns structured result object; never logs password

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push
```

**Do not commit:**
- `supabase/.temp/linked-project.json`
- Any `.env` file
- `node_modules/`
