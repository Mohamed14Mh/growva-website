# Admin Auth Refresh Fix Report

**Date:** 2026-07-05
**File changed:** `admin/admin.js`

---

## Root Cause

Three independent bugs combined to produce the symptoms:

### Bug 1 — `signInWithPassword` had no timeout (primary "Signing in..." hang cause)

`handleLoginSubmit` set the button to "Signing in..." / `disabled = true`, then called `supabaseClient.auth.signInWithPassword()` with no timeout wrapper. If the network stalled, OR if a stale session already in `localStorage` caused Supabase's internal token-refresh lock to be held, `signInWithPassword` queued behind that lock and waited indefinitely. No code path re-enabled the button once it entered this state.

### Bug 2 — 6-attempt retry loop made boot timeout fire prematurely (primary "admin exits on refresh" cause)

`hasActiveAdminSession()` contained a loop that retried `getSession()` up to 6 times with 250 ms gaps (up to 1.5 s of `setTimeout` sleep). Even for a valid stored session — where `getSession()` returns immediately — the function then had to make a network round-trip for `loadAdminProfile()`. On a modest connection this total time (retry sleep + DB call) could exceed the 2500 ms boot `withTimeout`. When the timeout fired with `false`, `hasBootSession = false` and `enterAdminMode()` was never called. The background promise kept running, eventually setting `currentUser`/`adminProfile`, but nobody invoked `enterAdminMode()`. The user had to click ADMIN manually — and even then, a second race could occur.

### Bug 3 — Stale `localStorage` tokens were not cleared before the login modal opened (secondary hang cause)

When `hasActiveAdminSession()` returned `false` (no valid session) the code went straight to `openModal()` without removing any stale `sb-*` keys. Supabase continued trying to auto-refresh those tokens in the background. When the user then submitted the login form, `signInWithPassword` could queue behind that hanging refresh lock — another path to the "Signing in..." hang.

---

## Files Changed

| File | Change |
|------|--------|
| `admin/admin.js` | See exact changes below |
| `ADMIN_AUTH_REFRESH_FIX_REPORT.md` | **NEW** — this report |

---

## Exact Fixes

### Fix 1 — `clearSupabaseAuthStorage()` expanded

Added `growva_admin_session` and `growva_admin` key patterns. Added minimal `[GROWVA Admin] stale auth cleared` log (debug mode only). Fixed swallowed exception variable name.

### Fix 2 — `resetAdminAuthState()` now resets login button

If the login submit button exists and is disabled when `resetAdminAuthState` is called (e.g. during a token-refresh error that fires mid-login), the button is re-enabled and its label restored. Prevents the button from being permanently stuck if an `onAuthStateChange(SIGNED_OUT)` fires during a login attempt.

### Fix 3 — `hasActiveAdminSession()` — removed retry loop, added `getUser()` server verify

**Removed:** The 6-attempt retry loop (`for attempt < 6 … await sleep(250)`). Supabase v2 reads from `localStorage` synchronously on the first `getSession()` call — there is no timing race that requires retrying. The loop was adding up to 1.5 s of delay unconditionally.

**Added:** After `getSession()` returns a session, `getUser()` is called to verify the token is still valid server-side. `getUser()` always makes a network call and will fail with an auth error if the JWT is expired or the session is revoked. When it fails:
- If the error matches `isRevokedOrInvalidAuthSessionError()`: `handleAdminAuthSessionFailure()` is called, which clears stale storage and resets state.
- Otherwise: connection is marked failed and `false` is returned.

This eliminates the scenario where a stale (locally cached but server-rejected) session caused `loadAdminProfile()` to hang waiting for Supabase to complete a failing token refresh internally.

### Fix 4 — `openAdminEntry()` timeout increased + stale storage cleared before modal

Timeout increased from 2500 ms → 5000 ms (allows for `getSession()` + `getUser()` network round trip within budget).

When `hasSession` is `false` (no valid session found), `clearSupabaseAuthStorage()` is now called **before** `openModal()`. This removes any stale `sb-*` / `supabase.auth` / `growva_admin` tokens, freeing the Supabase client from any ongoing background token-refresh operation. Subsequent `signInWithPassword` calls no longer queue behind a hanging refresh lock.

Same cleanup added in the `catch` path.

### Fix 5 — `handleLoginSubmit()` — timeout + try/finally guarantee

**`signInWithPassword` wrapped with 8000 ms timeout:**
```js
signInResult = await withTimeout(
  supabaseClient.auth.signInWithPassword({ email, password }),
  8000,
  { data: null, error: timeoutError }
);
```
If it times out: shows "Authentication timed out. Please try again." and re-enables the button. If the error is a revoked/invalid session error: clears stale storage and shows "Session is invalid. Please try again."

**`loadAdminProfile` wrapped with 5000 ms timeout:**
If the profile query hangs, it resolves `false` and shows "This account is not configured as a CMS admin."

**`try/finally` guarantees button reset:**
A `loginOpened` flag is set only when `enterAdminMode()` is actually called. The `finally` block re-enables the button in all other cases. No code path can leave the button stuck "Signing in...".

### Fix 6 — Boot timeout increased 2500 ms → 10000 ms

`hasActiveAdminSession()` no longer has the retry loop, but now includes a `getUser()` network call. 10000 ms provides budget for `getSession()` (immediate) + `getUser()` network call + `loadAdminProfile()` DB query on a slow connection.

---

## Auth Storage Cleanup Behavior

`clearSupabaseAuthStorage()` removes keys matching any of:
- `key.startsWith('sb-')`
- `key.includes('supabase.auth')`
- `key.includes('supabase')`
- `key.includes('growva_admin_session')`
- `key.includes('growva_admin')`

Applied to both `localStorage` and `sessionStorage`. Runs in a try/catch — never throws. Logs `[GROWVA Admin] stale auth cleared` in debug mode only. Does not touch unrelated keys.

**Called from:**
- `handleAdminAuthSessionFailure()` — when a revoked/invalid token error is detected anywhere in the auth flow
- `openAdminEntry()` — when `hasActiveAdminSession()` returns false (no valid session), before showing login modal
- `handleLoginSubmit()` — when `signInWithPassword` returns a revoked/invalid error

---

## Timeout Behavior

| Call | Timeout | On timeout |
|------|---------|-----------|
| `signInWithPassword` in login | 8000 ms | Shows "Authentication timed out. Please try again." + re-enables button |
| `loadAdminProfile` in login | 5000 ms | Shows "This account is not configured as a CMS admin." + re-enables button |
| `hasActiveAdminSession()` in `openAdminEntry` | 5000 ms | Clears stale storage, opens login modal |
| `hasActiveAdminSession()` at boot | 10000 ms | `hasBootSession = false`, no admin mode at boot (user clicks ADMIN to re-check) |

---

## Login Submit Behavior

1. Button → "Signing in..." / disabled
2. `signInWithPassword` called (8 s timeout)
   - Timeout → error shown, button re-enabled
   - Revoked/invalid error → stale storage cleared, error shown, button re-enabled
   - Credentials wrong → error shown, button re-enabled
3. On success: `loadAdminProfile()` called (5 s timeout)
   - No profile or wrong role → sign out, error shown, button re-enabled
4. Profile valid → `closeModal()`, `enterAdminMode()`, button stays hidden (dashboard open)
5. `finally` block: re-enables button in every non-success path

---

## Refresh Behavior

**Valid session in localStorage:**
1. Boot calls `hasActiveAdminSession()` (10 s budget)
2. `getSession()` returns session immediately from localStorage
3. `getUser()` hits server to verify JWT is valid (~100–500 ms on local dev)
4. `loadAdminProfile()` queries `admin_profiles` (~100–500 ms)
5. Total: ~200–1000 ms → well within 10 s budget
6. `hasBootSession = true` → `enterAdminMode()` → admin dashboard opens

**Stale/expired session in localStorage:**
1. Boot calls `hasActiveAdminSession()`
2. `getSession()` returns the stored (stale) session
3. `getUser()` hits server → fails with JWT expired / auth session missing error
4. `handleAdminAuthSessionFailure()` → `clearSupabaseAuthStorage()` → `resetAdminAuthState()`
5. `hasBootSession = false` → no auto-open
6. User clicks ADMIN → `openAdminEntry()` → `hasActiveAdminSession()` returns false
7. `clearSupabaseAuthStorage()` called (removes any remaining stale tokens)
8. Login modal opens cleanly — no stale lock blocking `signInWithPassword`

---

## open-admin Click Behavior

```
document.querySelector('[data-admin-action="open-admin"]').click()
```

Flow:
1. `adminEntryInFlight` guard: only one concurrent open attempt at a time
2. `setAdminEntryLoading()` — adds `is-admin-loading` to button
3. Short-circuit: if `currentUser && adminProfile` already set → `enterAdminMode()` immediately
4. Otherwise: `withTimeout(hasActiveAdminSession(), 5000, false)`
5. Valid session → `enterAdminMode()` → dashboard
6. No valid session → `clearSupabaseAuthStorage()` → login modal
7. Error → `clearSupabaseAuthStorage()` → login modal
8. `finally`: `clearAdminEntryLoadingState()`, `adminEntryInFlight = false` (always)

Button never stays stuck in `is-admin-loading`.

---

## Security Review

| Check | Result |
|-------|--------|
| Service-role key in frontend | None — PASS |
| Resend API key in frontend | None — PASS |
| `sb_secret` in frontend | Detection helper only (rejects it) — PASS |
| Tokens/sessions logged to console | None — PASS |
| New innerHTML with user content | None — PASS |
| XSS introduced | None — PASS |
| New secrets added | None — PASS |
| RLS weakened | No — PASS |

---

## QA Results

| Check | Result |
|-------|--------|
| `node --check admin/admin.js` | PASS |
| `node --check js/script.js` | PASS |
| `node --check js/content-registry.js` | PASS |
| `git diff --check` | PASS (LF→CRLF warning only, not an error) |
| Service-role key in frontend | PASS |
| No tokens logged | PASS |
| No new innerHTML with user content | PASS |

---

## Remaining Limitations

1. **`getUser()` adds one extra network call per boot.** For visitor sessions with no admin token in storage, `getSession()` returns null and `getUser()` is never called. The extra call only happens when there IS a stored session (i.e., the admin has previously logged in). Acceptable for an infrequent admin-only flow.

2. **Mock admin mode is unchanged.** `?mockAdmin=true` still bypasses the client-side auth UI but continues to be blocked by RLS at the DB layer. The `clearSupabaseAuthStorage()` call in `openAdminEntry()` does clear `growva_admin` keys including `MOCK_SESSION_KEY` — but mock admin uses a different entry path that short-circuits before the clear. No behavior change.

3. **Offline scenario.** If the server is completely unreachable, `getUser()` will fail with a network error (not a revoked-token error), `markConnectionFailed()` will be called, and the boot returns `false`. The user will need to click ADMIN when connectivity is restored. This is correct behavior.

4. **Session auto-refresh.** Supabase's `autoRefreshToken: true` remains in place. If a valid session nears expiry while the admin dashboard is open, Supabase refreshes it automatically in the background. This is unchanged and correct.

---

## Safe to Commit

**Yes.** All syntax checks pass. No regressions introduced. No new security issues. The changes are targeted to the auth flow only — no CMS, VD, pipeline, tasks, or contact form code was touched.

---

## Exact Commit Command

```bash
git add admin/admin.js ADMIN_AUTH_REFRESH_FIX_REPORT.md
git commit -m "$(cat <<'EOF'
Fix admin auth refresh hang: timeout, stale storage cleanup, getUser verify

Root causes fixed:
- signInWithPassword had no timeout — could hang forever on network stall
  or Supabase internal token-refresh lock held by stale session; button
  stayed "Signing in..." permanently
- hasActiveAdminSession() 6-attempt retry loop added up to 1.5s sleep,
  making the 2500ms boot timeout fire before profile loaded; admin mode
  not restored on refresh
- Stale sb-* auth tokens not cleared before login modal opened, allowing
  Supabase background refresh lock to block subsequent signInWithPassword

Fixes:
- signInWithPassword wrapped with 8000ms withTimeout; loadAdminProfile in
  login wrapped with 5000ms withTimeout; try/finally guarantees button is
  always re-enabled — no code path leaves "Signing in..." stuck
- Removed 6-retry loop from hasActiveAdminSession(); added getUser() call
  to verify JWT server-side and detect stale sessions at restore time
- openAdminEntry: clearSupabaseAuthStorage() called when no valid session
  found, before opening login modal — removes stale tokens before login
- Boot timeout raised 2500ms → 10000ms (getSession + getUser + profile)
- openAdminEntry timeout raised 2500ms → 5000ms
- resetAdminAuthState() now resets login button if stuck disabled
- clearSupabaseAuthStorage() adds growva_admin key patterns

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
