# GROWVA CMS — Production Security Audit Report (Phase 31)

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/crm-reminder-sweep/index.ts` | **FIX** — `leadLabel()` result now wrapped in `esc()` in `renderTaskRows()` |
| `supabase/phase-31-security-hardening.sql` | **NEW** — `REVOKE ALL FROM anon` on `cms_notification_log` (defense-in-depth) |
| `supabase/phase-31-security-hardening-setup.md` | **NEW** — deployment guide for SQL patch |
| `PRODUCTION_SECURITY_AUDIT_REPORT.md` | This report |

No changes to `admin/admin.js`, `admin/admin.css`, `admin/supabase-config.js`, `js/script.js`, `js/content-registry.js`, or any HTML files.

---

## 1. Secrets Audit

### Results

| Pattern | Files Searched | Hits | Classification |
|---------|---------------|------|----------------|
| `sb_secret` | `*.js`, `*.html`, `*.css` | 1 | Safe — detection guard in `isUnsafeSupabaseKey()` |
| `service_role` | `*.js`, `*.html`, `*.css` | 3 | Safe — string detection guards only (`startsWith`, `includes`, JWT role check) |
| `SUPABASE_SERVICE_ROLE_KEY` | `*.js`, `*.html`, `*.css` | 0 | None |
| `RESEND_API_KEY` | `*.js`, `*.html`, `*.css` | 0 | None |
| `RESEND_WEBHOOK_SECRET` | `*.js`, `*.html`, `*.css` | 0 | None |
| `CRM_REMINDER_SWEEP_SECRET` | `*.js`, `*.html`, `*.css` | 0 | None |
| `CONTACT_NOTIFY_WEBHOOK_SECRET` | `*.js`, `*.html`, `*.css` | 0 | None |
| `Bearer ` | `*.js`, `*.html`, `*.css` | 0 | None (Edge Functions only, server-side) |
| `Authorization` | `*.js`, `*.html`, `*.css` | 0 | None (Edge Functions only, server-side) |
| `api_key`, `secret` | `*.js`, `*.html`, `*.css` | 2 | Safe — comments only in `supabase-config.js` |

### Verdict: PASS — No secrets leaked in any frontend file.

`admin/supabase-config.js` contains the Supabase publishable anon key (`sb_publishable_...`) which is designed to be public and safe when combined with strict RLS policies. This is not a secret.

All secrets (`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_WEBHOOK_SECRET`, `CRM_REMINDER_SWEEP_SECRET`, `CONTACT_NOTIFY_WEBHOOK_SECRET`) are accessed only via `Deno.env.get()` inside Edge Functions.

---

## 2. Frontend XSS / Rendering Audit

### Scope

Reviewed all `innerHTML`, `insertAdjacentHTML`, and template literal renders for user-controlled content in:
- `admin/admin.js` (16 `innerHTML` call sites, 343 `escapeHtml()` usages)
- `js/script.js`
- `js/content-registry.js`

### Results

| Render site | User data involved | Escaped | Verdict |
|-------------|-------------------|---------|---------|
| Lead name, email, company | Yes | `escapeHtml()` | ✅ PASS |
| Lead message preview (`msgPreview`) | Yes | `escapeHtml()` applied at definition | ✅ PASS |
| Lead internal_notes, next_action | Yes | `escapeHtml()` | ✅ PASS |
| Attribution fields (referrer, UTM params) | Yes | `escapeHtml()` in `renderLeadAttributionHtml` | ✅ PASS |
| Activity timeline old_value, new_value, note | Yes | `escapeHtml()` in `renderLeadActivityTimeline` | ✅ PASS |
| Task title, description, assigned_to | Yes | `escapeHtml()` in `renderTaskRow` | ✅ PASS |
| Notification log status, event_type, error_message | Yes | `escapeHtml()` applied | ✅ PASS |
| Control Center issue titles, descriptions | Yes | `escapeHtml()` in `renderControlCenterTab` | ✅ PASS |
| Status badge CSS classes | Yes | Hardcoded map from status string (no user value in class) | ✅ PASS |
| Severity badge CSS classes | Yes | Hardcoded map (no user value in class) | ✅ PASS |
| Form status messages in `script.js` | Error strings | `textContent` (not innerHTML) | ✅ PASS |
| Chapter labels in `script.js` | Hardcoded array + counter | Static only | ✅ PASS |
| vdBuildOverlay `innerHTML` | None | Static string | ✅ PASS |

### Dangerous patterns checked

| Pattern | Result |
|---------|--------|
| `javascript:` | Found only as guard/filter (`if startsWith 'javascript:'`) |
| `onerror=`, `onclick=`, `onload=` | Not found in frontend files |
| `outerHTML` with user data | Not found |
| `eval()` | Not found |
| `document.write()` | Not found |
| `insertAdjacentHTML` | Not found |

### Verdict: PASS — No stored XSS vector identified in admin or public frontend.

---

## 3. RLS Audit

### Tables Audited

| Table | RLS Enabled | Anon | Viewer SELECT | Editor INSERT/UPDATE | Owner | Service-role INSERT |
|-------|------------|------|--------------|---------------------|-------|---------------------|
| `admin_profiles` | ✅ | ✗ | Own row only | ✗ | Full manage | — |
| `cms_content` | ✅ | Published SELECT | All SELECT | Draft INSERT/UPDATE | Full publish | — |
| `cms_audit_log` | ✅ | ✗ | ✗ | INSERT | SELECT, INSERT | — |
| `cms_publish_log` | ✅ | ✗ | ✗ | ✗ | Full | — |
| `cms_contact_submissions` | ✅ | INSERT only | SELECT | SELECT + UPDATE | SELECT + UPDATE + DELETE | — |
| `cms_notification_log` | ✅ | ✗ (no policy + REVOKE after Phase 31) | SELECT | SELECT | SELECT + DELETE | ✅ (crm-reminder-sweep, contact-notify) |
| `cms_lead_activity` | ✅ | ✗ (REVOKE ALL) | SELECT | SELECT + INSERT | SELECT + INSERT | ✅ (task-reminder-notify) |
| `cms_lead_tasks` | ✅ | ✗ (REVOKE ALL) | SELECT | SELECT + INSERT + UPDATE | SELECT + INSERT + UPDATE + DELETE | ✅ (task-reminder-notify) |
| `cms_crm_reminder_runs` | ✅ | ✗ (REVOKE ALL) | SELECT | SELECT | SELECT + DELETE | ✅ (crm-reminder-sweep) |
| `cms_crm_reminder_run_items` | ✅ | ✗ (REVOKE ALL) | SELECT | SELECT | SELECT + DELETE | ✅ (crm-reminder-sweep) |

### Policy Correctness

- ✅ All policies use `public.current_admin_role()` — no policy references the non-existent `cms_admin_profiles`
- ✅ All policies correctly scope role checks to `'owner'`, `'editor'`, `'viewer'` via `public.admin_profiles`
- ✅ No viewer-accessible tables permit viewer INSERT or UPDATE
- ✅ No table permits anon SELECT on admin/CRM data
- ✅ `cms_contact_submissions` anon INSERT is intentional (public contact form)

### Gaps Addressed (Phase 31 SQL)

**`cms_notification_log` missing `REVOKE ALL FROM anon`:**
Phase 21 created the table with RLS enabled and no anon policies (correct by design — RLS denies anon access). However, unlike Phase 26/27/29 tables, it lacked an explicit `REVOKE ALL FROM anon`. Added in Phase 31 SQL. RLS already provided full protection; this is defense-in-depth for consistency.

### Verdict: PASS — All RLS policies are correct. One defense-in-depth REVOKE added.

---

## 4. Edge Function Security Audit

### `contact-notify`

| Check | Result |
|-------|--------|
| POST-only | ✅ |
| Invalid JSON handled | ✅ |
| Required secrets checked | ✅ (`RESEND_API_KEY`, `CONTACT_NOTIFY_TO_EMAIL`, `CONTACT_NOTIFY_FROM_EMAIL`) |
| Webhook secret (optional): constant-time compare | ✅ |
| Test/retry: JWT verified via anon client | ✅ |
| Role-check for test/retry | ✅ (JWT must resolve to valid session) |
| `SUPABASE_SERVICE_ROLE_KEY` server-side only | ✅ |
| No raw secrets logged | ✅ |
| HTML email escaping of lead fields | ✅ (`esc()` applied to all lead values) |
| Resend response not forwarded | ✅ |
| `provider_message_id` captured | ✅ |
| Log never prevents email result from returning | ✅ |
| HTTP method guard returns 405 | ✅ |

### `resend-webhook`

| Check | Result |
|-------|--------|
| POST-only | ✅ |
| `RESEND_WEBHOOK_SECRET` required (returns 500 if not configured) | ✅ |
| Constant-time secret comparison | ✅ (`constantTimeEqual`) |
| Invalid JSON handled | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` server-side only | ✅ |
| No raw secrets or provider keys logged | ✅ |
| `safeProviderDetails` strips sensitive fields, truncates all values | ✅ |
| HTTP method guard returns 405 | ✅ |

### `task-reminder-notify`

| Check | Result |
|-------|--------|
| POST-only | ✅ |
| JWT required (returns 401 if missing) | ✅ |
| Role check: owner/editor only (returns 403 for viewer) | ✅ |
| UUID validation for `task_id` | ✅ |
| Task status validation (only open tasks) | ✅ |
| `reminder_enabled` check | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` server-side only | ✅ |
| HTML email escaping of task/lead fields | ✅ (`esc()` applied) |
| Resend response not forwarded to client | ✅ |
| HTTP method guard returns 405 | ✅ |

### `crm-reminder-sweep`

| Check | Result |
|-------|--------|
| POST-only | ✅ |
| Scheduled path: constant-time secret compare, 401 if secret missing | ✅ |
| Manual path: JWT + role check (owner/editor, returns 403 for viewer) | ✅ |
| No path bypasses auth | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` server-side only | ✅ |
| `esc()` in HTML email on task fields | ✅ |
| Duplicate prevention (24h cooldown) | ✅ |
| HTML email lead name escape | **FIXED** (was missing `esc()` around `leadLabel()`) |
| Run item logging preserves audit trail | ✅ |
| HTTP method guard returns 405 | ✅ |

### Fix Applied: HTML injection in `crm-reminder-sweep` digest emails

**File:** `supabase/functions/crm-reminder-sweep/index.ts`

**Issue:** In `renderTaskRows()`, the lead name/email/lead_id was assembled via `leadLabel()` which calls `text()` (truncate-only, no HTML escape). The result was inserted directly into the HTML email body `<td>` without escaping.

An attacker with control over a lead's `name` field (e.g., by submitting a crafted contact form) could inject HTML markup into the CRM reminder digest email sent to the site owner. While most email clients do not execute JavaScript, this could enable phishing links, spoofed content, or malformed email rendering.

**Fix:** Wrapped `leadLabel(lead, task)` in `esc()` in `renderTaskRows()`:
```typescript
// Before:
const leadLine = [
  leadLabel(lead, task),   // ← not HTML-escaped
  ...
].filter(Boolean).join(' / ');

// After:
const leadLine = [
  esc(leadLabel(lead, task)),   // ← properly escaped
  ...
].filter(Boolean).join(' / ');
```

**CVSS estimate:** Low–Medium (requires contact form access, affects only admin email content, no RCE).

### Verdict: PASS after fix. One real HTML injection issue found and fixed.

---

## 5. Admin Auth Audit

| Check | Result |
|-------|--------|
| Stale/revoked token detection (`classifySupabaseError`, `isRevokedOrInvalidAuthSessionError`) | ✅ |
| `handleAdminAuthSessionFailure` clears session and prompts re-login | ✅ |
| Viewer cannot mutate CRM/content (role checks in every mutating function) | ✅ |
| RLS is the authoritative security gate | ✅ (client-side role checks are clarity-layer only) |
| `canAdminEdit()` returns false without a real authenticated profile | ✅ |
| Unsafe anon key detection (`isUnsafeSupabaseKey`) guards against service-role key in config | ✅ |
| Mock admin mode (`?mockAdmin=true`) — see warning below | ⚠️ |

### Warning: Mock Admin Mode

`admin.js` contains a development mock mode activated via `?mockAdmin=true` in the URL combined with `localStorage.setItem('growva_admin_session', 'true')`. When active:
- The admin UI enters owner-mode without a real Supabase session
- All actual DB operations fail because there is no valid JWT (RLS blocks them)
- Visual Designer drafts stored in localStorage are readable/writable

**Risk in production:** Low. RLS prevents any CRM data from being read or written. The admin UI appears to load but all data queries return empty results. However, this mode should be disabled in production.

**Recommended production action:** Serve `admin/admin.js` in a way that strips the mock admin code path, or block `?mockAdmin=true` at the web server/CDN layer. The mock mode is intentionally included for local development.

---

## 6. Production Config Review

| Item | Status |
|------|--------|
| `admin/supabase-config.js` — anon key only | ✅ |
| No service-role key anywhere in frontend | ✅ |
| Edge Function URLs not hardcoded (Supabase SDK invoke used) | ✅ |
| `PLACEHOLDER_URL`/`PLACEHOLDER_KEY` in admin.js — legitimate dev defaults | ✅ |
| Contact form works on production path (`/contact.html`) | ✅ |
| Admin loads on all pages (checks `data-admin-entry` at init) | ✅ |
| `CONTACT_NOTIFY_WEBHOOK_SECRET` — optional but strongly recommended | ⚠️ See below |

### Production Warning: Unguarded webhook path

If `CONTACT_NOTIFY_WEBHOOK_SECRET` is NOT set in Supabase Edge Function secrets, any POST to the `contact-notify` Edge Function URL (without `test=true` or `retry=true`) will trigger a real email delivery attempt. An attacker who discovers the function URL could use it to spam the admin inbox.

**Recommended action:** Set `CONTACT_NOTIFY_WEBHOOK_SECRET` via `supabase secrets set CONTACT_NOTIFY_WEBHOOK_SECRET=<value>`. Once set, the function requires either the secret header (webhooks) or a valid admin JWT (test/retry). This is documented in the Phase 20 setup guide.

---

## Issues Found

| # | Severity | Location | Description |
|---|----------|----------|-------------|
| 1 | **Medium** | `crm-reminder-sweep/index.ts` | `leadLabel()` result not HTML-escaped in `renderTaskRows()` — HTML injection in digest emails |
| 2 | **Low** | `phase-21-notification-log.sql` | Missing `REVOKE ALL FROM anon` on `cms_notification_log` — defense-in-depth gap |
| 3 | Warning | `admin/admin.js` | Mock admin mode bypasses client-side auth UI (RLS still blocks actual data access) |
| 4 | Warning | `contact-notify` | `CONTACT_NOTIFY_WEBHOOK_SECRET` optional; omitting it allows unguarded email sends |

---

## Issues Fixed

| # | Fix |
|---|-----|
| 1 | `renderTaskRows()` in `crm-reminder-sweep/index.ts` — added `esc()` around `leadLabel()` |
| 2 | `supabase/phase-31-security-hardening.sql` — `REVOKE ALL ON cms_notification_log FROM anon` |

---

## Remaining Warnings (not fixed in code — require config/deployment action)

| Warning | Recommended Action |
|---------|--------------------|
| Mock admin mode accessible via URL param | Block `?mockAdmin=true` at web server/CDN; or accept as dev-only risk since RLS blocks all data access |
| `CONTACT_NOTIFY_WEBHOOK_SECRET` not enforced | Set this secret in Supabase dashboard: `supabase secrets set CONTACT_NOTIFY_WEBHOOK_SECRET=<strong-random-value>` |

---

## SQL to Run

**File:** `supabase/phase-31-security-hardening.sql`

**Required:** Yes — adds defense-in-depth `REVOKE ALL FROM anon` on `cms_notification_log`.

**Idempotent:** Yes — safe to run multiple times.

```sql
REVOKE ALL ON public.cms_notification_log FROM anon;
```

See `supabase/phase-31-security-hardening-setup.md` for verification steps.

---

## Edge Functions Changed

**Changed:** `supabase/functions/crm-reminder-sweep/index.ts`

**Redeploy required:** Yes.

```bash
supabase functions deploy crm-reminder-sweep
```

No other Edge Functions changed.

---

## QA Results

### node --check

```
admin/admin.js         — PASS
js/script.js           — PASS
js/content-registry.js — PASS
```

### git diff --check

```
PASS (LF/CRLF line-ending normalization warning — not a code issue)
```

### Deno check

Deno not installed in this environment. Edge Function reviewed by code inspection:
- `esc()` function defined and used throughout `crm-reminder-sweep/index.ts`
- Change is a one-line substitution (`esc(leadLabel(...))` wrapping — no new imports or types needed)
- TypeScript types unchanged

### Regression checks

| Feature | Status |
|---------|--------|
| Contact form submission | `js/script.js` not touched — ✅ |
| Lead capture, Attribution | Not touched — ✅ |
| Notification Analytics, Notification log | Not touched — ✅ |
| Lead Insights, Pipeline Board | Not touched — ✅ |
| Activity Timeline | Not touched — ✅ |
| Tasks tab, Reminders | Not touched — ✅ |
| Manual task reminder (task-reminder-notify) | Not touched — ✅ |
| Scheduled reminder sweep (crm-reminder-sweep) | Digest email HTML escaping fixed; behavior unchanged — ✅ |
| Resend webhook (resend-webhook) | Not touched — ✅ |
| Admin Leads tab (all actions) | Not touched — ✅ |
| Retry Notification, Send Test | Not touched — ✅ |
| Mark Read/New, Archive/Unarchive | Not touched — ✅ |
| Admin login, stale auth handling | Not touched — ✅ |
| Visual Designer, Properties Panel | Not touched — ✅ |
| Content/Style tabs, Save Draft, Publish | Not touched — ✅ |
| Section Builder, Media Library | Not touched — ✅ |
| Draft Compare, Preview as Visitor | Not touched — ✅ |
| Control Center tab | Not touched — ✅ |
| SEO, GSAP, Lenis, Three.js, page transitions | Not touched — ✅ |
| Mega menu, mobile menu, public visitor mode | Not touched — ✅ |

---

## Temporary Files

None created.

---

## Safe to Commit

**Yes** — after SQL patch is run and `crm-reminder-sweep` is redeployed.

The HTML injection fix in `crm-reminder-sweep` is a security improvement with no behavior change for correct lead data. The SQL patch adds only a privilege REVOKE (never blocks legitimate access since RLS already blocked it).

---

## Exact Commit Command

```bash
git add supabase/functions/crm-reminder-sweep/index.ts supabase/phase-31-security-hardening.sql supabase/phase-31-security-hardening-setup.md PRODUCTION_SECURITY_AUDIT_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 31: Final security, RLS, and production hardening

- crm-reminder-sweep/index.ts: fix HTML injection in digest emails —
  renderTaskRows() was using leadLabel() (truncate-only) without esc()
  in the HTML email body; an attacker controlling lead.name via the
  contact form could inject arbitrary HTML into the admin reminder
  digest email; fix: wrap leadLabel() with esc() in the leadLine
  assembly
- phase-31-security-hardening.sql: REVOKE ALL ON cms_notification_log
  FROM anon — defense-in-depth; RLS already blocked anon access (no
  anon policy = deny), but explicit REVOKE brings this table into
  consistency with Phase 26/27/29 tables that already have explicit
  REVOKE FROM anon
- Security audit result: no secrets leaked in frontend; all admin
  innerHTML user-content paths use escapeHtml(); all RLS policies
  verified correct; all Edge Function auth paths verified

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 32 Safe to Start

**Yes** — no regressions introduced. All prior phase features intact.

---

## Recommended Phase 32 Title

**Phase 32: Admin Dashboard UI/UX Polish and Mobile Responsiveness**

Suggested scope:
- Audit admin panel layout on mobile/tablet viewports
- Fix any overflow or clipped elements in Pipeline board, Tasks, Leads on small screens
- Improve loading state skeletons for slow connections
- Add keyboard navigation support for dashboard tabs
- Improve empty states with actionable call-to-action links
- Consider a toast/snackbar notification system to replace inline status messages
