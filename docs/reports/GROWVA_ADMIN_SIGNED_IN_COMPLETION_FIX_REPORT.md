# GROWVA Admin SIGNED_IN Completion Fix Report

**Date:** 2026-07-06
**File changed:** `admin/admin.js`

---

## Root Cause

**The `onAuthStateChange(SIGNED_IN)` auto-completion block checked `modal.classList.contains('is-visible')` — but the modal uses `is-open`, not `is-visible`.**

`openModal()` adds `is-open` (line 3294). `is-visible` is only used on the login error `<p>` element. The SIGNED_IN auto-completion condition was therefore always `false`. Even when Supabase fired `SIGNED_IN`, loaded the profile successfully, and had a valid `owner` row in `public.admin_profiles`, the code never reached `enterAdminMode()`.

**Secondary cause: `!loginInProgress` guard on the SIGNED_IN handler.**

The handler also checked `!loginInProgress`. During the 25s timeout wait, `loginInProgress` is `true`. If `SIGNED_IN` fires within the 25s window (which it does when Supabase takes 20-30s to respond), the guard would have prevented `completeAdminLoginFromUser` from running even if the `is-visible` bug had been fixed.

---

## Why `auth_state_change` and `admin-profile-start` Were Seen But Admin Mode Did Not Enter

The debug logs showed:
- `auth_state_change` — `onAuthStateChange(SIGNED_IN)` fired correctly
- `admin-profile-start` — `loadAdminProfile` was called correctly and found the `owner` profile

But after `loadAdminProfile` returned `true`, execution hit:
```js
if (
  profileLoaded &&
  event === 'SIGNED_IN' &&
  !loginInProgress &&            // ← loginInProgress was true
  !document.body.classList.contains('admin-mode') &&
  modal && modal.classList.contains('is-visible')   // ← WRONG CLASS: always false
) {
  // This block never ran
  enterAdminMode();
}
```

Both conditions were `false`, so `enterAdminMode()` was never called. The profile was loaded into memory but the UI was never updated.

---

## Files Changed

| File | Change |
|------|--------|
| `admin/admin.js` | Auth completion flow — no CMS/VD/pipeline/public code touched |
| `GROWVA_ADMIN_SIGNED_IN_COMPLETION_FIX_REPORT.md` | **NEW** — this report |

---

## New Completion Flow

### `completeAdminLoginFromUser(user, source)` — new shared function

A single authoritative function that handles admin mode entry from any path:

```
completeAdminLoginFromUser(user, source)
  → deduplicates via adminLoginCompletionPromise
  → skips if already in admin-mode with valid profile
  → loadAdminProfile(user) with 10s timeout
  → if allowed:
      setLoginError('')
      clearAdminEntryLoadingState()
      closeModal() if modal.classList.contains('is-open')
      enterAdminMode() if not already active
      setAdminModeIntent()
      return { ok: true, reason: 'completed', profile }
  → if no profile:
      setLoginError('Login succeeded, but no admin profile was found...')
      return { ok: false, reason: 'no_profile', message }
  → finalizes: adminLoginCompletionPromise = null
```

Called from:
- `onAuthStateChange(SIGNED_IN)` — fires when Supabase completes authentication
- `handleLoginSubmit` — after `signInWithPassword` returns with `data.user`
- `testAuthLogin` — debug diagnostic
- `forceCompleteLogin` — debug manual trigger

### `onAuthStateChange(SIGNED_IN)` — fixed

- Removed `!loginInProgress` guard
- Removed wrong `is-visible` modal class check
- Removed all inline enter-admin logic
- Now calls `completeAdminLoginFromUser(session.user, 'auth-state-change')` unconditionally
- `TOKEN_REFRESHED`, `INITIAL_SESSION`, and other events still call `loadAdminProfile` only (do not enter admin mode)

### `handleLoginSubmit` — fixed

**On sign-in timeout:**
1. `loginInProgress = false` — released early so `onAuthStateChange(SIGNED_IN)` can run
2. Button text → "Connecting...", button stays disabled
3. Shows: "Sign-in is taking longer than expected (Supabase may be starting up). Waiting..."
4. Polls for up to 15s for `admin-mode` class on body
5. If admin mode entered (via `onAuthStateChange` → `completeAdminLoginFromUser`): clears error, `loginOpened = true`, button stays hidden
6. If still not entered after 15s: shows timeout error, re-enables button

**On sign-in success:**
1. `loginInProgress = false` released before completion
2. Calls `completeAdminLoginFromUser(data.user, 'login-submit')`
3. The `adminLoginCompletionPromise` dedup ensures that even if `onAuthStateChange(SIGNED_IN)` is running concurrently, `enterAdminMode()` is called exactly once

---

## Debug Commands

Enable debug logs (no reload required):
```js
window.GROWVA_ADMIN_DEBUG = true;
```

Full login diagnostic (pass real password):
```js
await window.growvaAdminDebug.testAuthLogin("mohamedabdelm964@gmail.com", "YOUR_PASSWORD");
```

Returns extended result including:
- `authStateSignedInSeen: true/false` — whether SIGNED_IN was observed
- `adminModeEntered: true/false` — whether `admin-mode` class was on body
- `profileFound: true/false` — whether profile row was found
- `profileRole: "owner"|"editor"|"viewer"|null`
- If sign-in timed out but admin mode entered: `ok: true, stage: "auth_state_completed_after_timeout"`

Get current auth state:
```js
window.growvaAdminDebug.getState();
```

Force-complete login from existing session (if modal stuck):
```js
await window.growvaAdminDebug.forceCompleteLogin();
```

This reads the current Supabase session. If a valid session exists (e.g. from a background sign-in that completed but didn't enter admin mode), it calls `completeAdminLoginFromUser` directly and enters admin mode.

Verify admin mode entered:
```js
document.body.classList.contains('admin-mode');       // → true
window.growvaAdminDebug.getState().hasSession;         // → true
window.growvaAdminDebug.getState().hasProfile;         // → true
window.growvaAdminDebug.getState().profileRole;        // → "owner"
```

---

## Expected Browser QA Flow

1. Open `http://localhost:5500/`
2. `window.GROWVA_ADMIN_DEBUG = true;`
3. Click ADMIN → login modal opens
4. Submit credentials (`mohamedabdelm964@gmail.com` + real password)

**If Supabase responds within 25s:**
- Modal closes, admin dashboard opens
- `document.body.classList.contains('admin-mode')` → `true`

**If Supabase takes 25-40s (free-tier wake-up):**
- Button shows "Connecting...", error shows "Sign-in is taking longer than expected..."
- Console shows: `auth_state_signed_in_seen` → `complete_admin_login_start` → `complete_admin_login_entered`
- Admin dashboard opens automatically (no re-click needed)
- `document.body.classList.contains('admin-mode')` → `true`

**If still stuck after 40s:**
```js
await window.growvaAdminDebug.forceCompleteLogin();
// Should return { ok: true, reason: 'completed' }
```

---

## Debug Log Reference

| Log key | When it fires |
|---------|--------------|
| `login_submit_start` | User clicks "Enter Admin Mode" |
| `signin_start` | `signInWithPassword` called |
| `signin_timeout_waiting_for_auth_state` | 25s timeout fired, waiting for SIGNED_IN |
| `auth_state_signed_in_seen` | `onAuthStateChange(SIGNED_IN)` received |
| `complete_admin_login_start` | `completeAdminLoginFromUser` invoked |
| `complete_admin_login_profile_found` | `loadAdminProfile` found valid role |
| `complete_admin_login_entered` | `enterAdminMode()` called |
| `complete_admin_login_failed` | Profile missing, invalid role, or error |

---

## QA Results

| Check | Result |
|-------|--------|
| `node --check admin/admin.js` | PASS |
| `node --check js/script.js` | PASS |
| `node --check js/content-registry.js` | PASS |
| `git diff --check` | PASS (LF→CRLF warning only) |
| Service-role key in frontend | None — PASS |
| Password logged to console | None — PASS |
| Tokens logged to console | None — PASS |
| New `innerHTML` with user content | None — PASS |

---

## Remaining Risks

1. **`INITIAL_SESSION` also fires on page load with valid session.** When there's a stored session, `onAuthStateChange(INITIAL_SESSION)` fires during boot. The handler now routes `SIGNED_IN` to `completeAdminLoginFromUser` and all other events (including `INITIAL_SESSION`) to `loadAdminProfile` only. This correctly avoids auto-opening admin on `INITIAL_SESSION` — the boot flow handles that separately.

2. **Duplicate concurrent calls during fast sign-in.** If `signInWithPassword` returns quickly AND `SIGNED_IN` fires before `completeAdminLoginFromUser(data.user, 'login-submit')` returns: the `adminLoginCompletionPromise` dedup ensures only one call proceeds; the second awaits and gets the same result.

3. **Supabase project paused (>40s cold start).** If the project needs >40s to respond, the 15s post-timeout wait in both `handleLoginSubmit` and `testAuthLogin` will exhaust. The user will need to use `forceCompleteLogin()` after the session becomes active, or manually unpause at `https://supabase.com/dashboard`.

4. **RLS on `admin_profiles` SELECT.** `loadAdminProfile` queries `admin_profiles` using the user's JWT. If no SELECT policy exists for `authenticated` role, the query returns no row (treated as "no profile"). See SQL section in `GROWVA_ADMIN_AUTH_REAL_LOGIN_FIX_REPORT.md`.

---

## Git Commands

```bash
git status
node --check admin/admin.js
node --check js/script.js
node --check js/content-registry.js
git diff --check
git add admin/admin.js GROWVA_ADMIN_SIGNED_IN_COMPLETION_FIX_REPORT.md
git commit -m "$(cat <<'EOF'
Fix admin SIGNED_IN completion: wrong modal class, loginInProgress guard

Root cause: onAuthStateChange(SIGNED_IN) handler checked
modal.classList.contains('is-visible') but the modal uses 'is-open'.
Both that check and !loginInProgress being true simultaneously blocked
enterAdminMode() even though Supabase authenticated the user and
loadAdminProfile found the owner row. Admin mode never entered.

Fixes:
- completeAdminLoginFromUser(user, source): new shared function used by
  onAuthStateChange(SIGNED_IN), handleLoginSubmit, testAuthLogin, and
  forceCompleteLogin; deduplicates via adminLoginCompletionPromise;
  guards against double-entry; loads profile, closes modal (correct
  'is-open' class), enters admin mode, sets intent
- onAuthStateChange: SIGNED_IN now calls completeAdminLoginFromUser
  unconditionally — no loginInProgress guard, no modal class check;
  TOKEN_REFRESHED/INITIAL_SESSION still use loadAdminProfile only
- handleLoginSubmit: on timeout, releases loginInProgress early and
  polls 15s for SIGNED_IN completion; on success, calls
  completeAdminLoginFromUser instead of loadAdminProfile directly
- testAuthLogin: on timeout, waits 15s for auth state; returns
  ok:true/stage:'auth_state_completed_after_timeout' if admin mode entered
- forceCompleteLogin debug helper: reads current session, calls
  completeAdminLoginFromUser — allows manual recovery when UI stuck
- Added debug logs: login_submit_start, signin_start,
  signin_timeout_waiting_for_auth_state, auth_state_signed_in_seen,
  complete_admin_login_start/profile_found/entered/failed

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push
```

**Do not commit:**
- `supabase/.temp/linked-project.json`
- Any `.env` or secrets file
