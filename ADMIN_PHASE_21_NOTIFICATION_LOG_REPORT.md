# GROWVA CMS Phase 21 — Notification Log + Delivery Tracking Report

## Files Changed

| File | Change |
|------|--------|
| `supabase/phase-21-notification-log.sql` | **NEW** — creates `cms_notification_log` table, indexes, RLS |
| `supabase/functions/contact-notify/index.ts` | Updated — adds `insertLog()`, Resend JSON parsing, retry support, returns `logged` flag |
| `supabase/phase-21-notification-log-setup.md` | **NEW** — deployment and verification guide |
| `admin/admin.js` | +95 lines: `loadNotificationLogs()`, `retryNotification()`, state vars, click handler, notification history in `renderLeadsTab()`, updated `switchDashboardTab` and refresh handler |
| `admin/admin.css` | +55 lines: `.gv-notif-log`, `.gv-notif-log-row`, `.gv-notif-badge` variants, `.gv-notif-err` |
| `ADMIN_PHASE_21_NOTIFICATION_LOG_REPORT.md` | This report |

---

## SQL Patch Details

**File:** `supabase/phase-21-notification-log.sql`
**Must be run:** Yes — creates the log table before the Edge Function can write to it.

### Table: `cms_notification_log`

```sql
id                  UUID         PK, gen_random_uuid()
lead_id             UUID         FK → cms_contact_submissions(id) ON DELETE SET NULL
channel             TEXT         default 'email',  CHECK IN ('email')
provider            TEXT         default 'resend', CHECK IN ('resend')
event_type          TEXT         default 'lead_notification'
status              TEXT         NOT NULL, CHECK IN ('sent','failed','skipped','test')
recipient_email     TEXT
sender_email        TEXT
subject             TEXT         CHECK length ≤ 500
provider_message_id TEXT
error_message       TEXT         CHECK length ≤ 1000
metadata            JSONB        default '{}'
created_at          TIMESTAMPTZ  default now()
```

No `updated_at` — rows are append-only audit records.

`lead_id` uses `ON DELETE SET NULL` — deleting a lead preserves its notification history with a null FK (logs are audit evidence).

### Indexes

- `lead_id` — for per-lead log lookup in admin UI
- `status` — for future filtering
- `created_at DESC` — newest-first queries
- `provider_message_id` WHERE NOT NULL — for Resend delivery webhook (Phase 22+)

### RLS

| Role | SELECT | INSERT | DELETE |
|------|--------|--------|--------|
| Anon | ✗ | ✗ | ✗ |
| Authenticated viewer/editor/owner | ✓ | ✗ | — |
| Authenticated owner | ✓ | ✗ | ✓ |
| Service-role (Edge Function) | ✓ | ✓ | ✓ |

No INSERT RLS policy for authenticated users — log writes are server-side only via the service-role client inside the Edge Function. The service-role client bypasses RLS entirely.

---

## SQL Must Be Run

**Yes.** Must be run in the Supabase SQL Editor before testing. The script is idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).

---

## Edge Function Redeploy Required

**Yes.** The function source changed significantly. Redeploy after commit:

```bash
supabase functions deploy contact-notify
```

---

## Required Secrets

| Secret | Required | Notes |
|--------|----------|-------|
| `RESEND_API_KEY` | Yes | Already set in Phase 20 |
| `CONTACT_NOTIFY_TO_EMAIL` | Yes | Already set in Phase 20 |
| `CONTACT_NOTIFY_FROM_EMAIL` | Yes | Already set in Phase 20 |
| `CONTACT_NOTIFY_WEBHOOK_SECRET` | Recommended | Already set in Phase 20 |
| `SUPABASE_SERVICE_ROLE_KEY` | Built-in | **Automatically injected by Supabase — no manual setup needed** |

No new secrets need to be set manually. `SUPABASE_SERVICE_ROLE_KEY` is a standard Supabase built-in available in every Edge Function environment.

---

## Logging Behavior

The `insertLog()` helper in the Edge Function:
- Uses a service-role Supabase client to INSERT into `cms_notification_log` (bypasses RLS)
- Never throws — logging failures are `console.error`-only; the email send result is always returned to the caller
- If `SUPABASE_SERVICE_ROLE_KEY` is not available (extremely rare), logs a safe warning and skips — email send continues normally
- Does NOT log the full message body — only subject, recipient, sender, event type, status, provider_message_id, and a safe metadata object

### On Success

Inserted row:
- `status = 'sent'` (or `'test'` if `body.test === true`)
- `event_type = 'lead_notification' | 'test_notification' | 'retry_notification'`
- `provider_message_id` = Resend response `id` field if present
- `metadata = { resend_status: 200 }`
- `lead_id` = `record.id` (UUID string) if present, otherwise null

### On Failure

Inserted row:
- `status = 'failed'`
- `error_message` = error description truncated to ≤500 chars
- `metadata = { reason: 'network_error' }` or `{ resend_status: <N> }`
- Email delivery failure is also returned to the caller (502 response)

---

## Resend Response Handling

Improved from Phase 20:
- Resend response JSON is now parsed safely
- `id` field captured as `provider_message_id` in the log row
- Full Resend response body is NOT forwarded to the client — only the HTTP status code is used in error responses
- Non-JSON responses are handled gracefully (ignored; status code is the authority)

Return shape:
- Success: `{ ok: true, test: boolean, retry: boolean, logged: boolean }`
- Failure: `{ error: string, resend_status?: number, logged: boolean }`

---

## Admin Notification History Behavior

**Where:** Dashboard → Leads tab → expanded lead detail (below message, above action buttons)

**Data source:** `notificationLogs` — queried on tab open and refresh (newest 100 rows, ordered `created_at DESC`)

**Per-lead display:** Filters `notificationLogs` by `lead_id === lead.id`, shows newest 5 entries

**Columns shown per log row:**
- Status badge: sent (green) / failed (red) / test (amber) / skipped (grey)
- Timestamp
- Event type (lead_notification / test_notification / retry_notification)
- Error message (first 120 chars, red text) — only shown for `status = 'failed'`

**Empty state:** "No notification history." shown if no matching log rows

**All three roles** (viewer, editor, owner) can see notification history.

---

## Retry Button Behavior

**Location:** Expanded lead detail, bottom of actions area
**Visibility:** Owner role only
**Action:** `data-admin-action="lead-retry-notify"` with `data-lead-id`

**Flow:**
1. `leadRetrying` set to lead ID → button shows "Retrying…" (disabled)
2. `supabaseClient.functions.invoke('contact-notify', { body: { record: lead, retry: true } })`
3. Edge Function sends a real email (no [TEST] prefix), logs a `retry_notification` row
4. `leadRetrying` cleared
5. `loadNotificationLogs()` called to fetch the new row
6. `renderDashboard()` — new log entry appears in history panel
7. `leadsNotifyState` / `leadsNotifyMsg` updated (shown in notify bar at top of tab)

**Retry email:** Same subject as original notification. Blue banner in email body says "Retry notification — manually re-sent from the admin dashboard."

**Guard:** `typeof supabaseClient.functions?.invoke !== 'function'` check prevents crash if client version doesn't support it.

---

## Security Review

### Frontend (admin.js, js/script.js, contact.html, admin.css)

| Check | Result |
|-------|--------|
| `RESEND_API_KEY` in frontend | ✗ None |
| `SUPABASE_SERVICE_ROLE_KEY` in frontend | ✗ None |
| `service_role` hardcoded value in frontend | ✗ None (guard detection code only) |
| `notificationLogs` values in innerHTML | `escapeHtml()` on all fields — ✓ |
| `error_message` in innerHTML | `escapeHtml(String(...).slice(0,120))` — ✓ |
| `event_type` in innerHTML | `escapeHtml(lg.event_type)` — ✓ |
| `created_at` in innerHTML | `escapeHtml(new Date(...).toLocaleString())` — ✓ |
| `notifBadgeHtml` CSS class | Hardcoded map from status string — no user content in class name — ✓ |
| Retry button available to non-owner | `adminProfile?.role === 'owner'` guard — ✓ |
| Retry in Edge Function (test=false, retry=true) | Sends real email, not test email — ✓ |
| `loadNotificationLogs` requires auth | `!supabaseClient \|\| !currentUser \|\| !adminProfile` guard — ✓ |

### Edge Function

| Check | Result |
|-------|--------|
| Secrets via `Deno.env.get()` only | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` only used server-side for log INSERT | ✓ |
| Full Resend response not forwarded to client | ✓ |
| Message body not logged | ✓ (only subject, metadata, status logged) |
| Log failure never prevents email result from returning | ✓ |
| `error_message` truncated to ≤500 chars before log insert | ✓ |
| Public anon cannot INSERT or SELECT notification logs | ✓ (no policy = deny) |

---

## QA Results

### node --check

```
admin/admin.js         — PASS
js/script.js           — PASS
js/content-registry.js — PASS
```

### Deno check

Deno is not installed in this environment. TypeScript reviewed by code inspection:
- `insertLog()` is a standalone async function with full try/catch — cannot throw
- `createClient` import matches Supabase ESM CDN standard pattern
- `body.record` null-checked before use
- `providerMessageId` initialised to `undefined`, checked before assignment
- `record.id` guarded with `typeof record.id === 'string'` before use as FK

### Regression checks

| Feature | Status |
|---------|--------|
| Contact form submission (js/script.js) | Not touched — ✓ |
| Leads tab load, filter, expand, mark, archive | Not touched — ✓ |
| Send Test button | Updated to reload logs after — ✓ |
| Phase 20 notify panel (test button, state display) | Preserved — ✓ |
| Visual Designer, Properties Panel | Not touched — ✓ |
| Content/Style tabs, Save Draft, Publish | Not touched — ✓ |
| Section Builder, Media Library, Visual Control | Not touched — ✓ |
| Preview as Visitor, SEO, GSAP, Lenis, Three.js | Not touched — ✓ |
| Mega menu, mobile menu, public visitor mode | Not touched — ✓ |
| `loadLeads()` function itself | Not modified — loads only leads, logs loaded separately — ✓ |

---

## Known Limitations

1. **Deno check not run** — not installed in this environment. Code reviewed manually.

2. **Test logs may have `lead_id = null`** if no real leads exist when Send Test is clicked. If a real lead is used as the sample (default behavior), `lead_id` is populated and the log shows under that lead's history.

3. **Max 5 log entries shown per lead** in the UI. All entries are stored in the DB. Query the table directly for complete history.

4. **Max 100 log rows fetched** per Leads tab open. High-volume sites may need pagination (Phase 22+).

5. **No automatic retry** — retry is a manual owner action only. Failed sends require owner to click Retry.

6. **`provider_message_id` is not yet used** for delivery confirmation. It is stored for a future Resend webhook (Phase 22+) that would update the log row on bounce/delivery.

7. **No log pruning UI** — owner-level DELETE is RLS-allowed but not exposed in the admin. For log pruning, delete directly via the Supabase DB editor or a future admin action.

8. **`notificationLogsLoading`** state is set but not used to show a loading indicator in the UI — notification history section simply shows last loaded data while reloading.

---

## Temporary QA Files

None created.

---

## Safe to Commit

**Yes** — after SQL patch is run and Edge Function is redeployed.

Code is safe to commit before SQL patch is run. The admin UI gracefully handles an empty/absent `notificationLogs` — the query to `cms_notification_log` will fail (table doesn't exist) and `notificationLogs` stays `[]`, showing "No notification history." for all leads. The rest of the Leads tab is unaffected.

---

## Exact Commit Command

```bash
git add admin/admin.js admin/admin.css supabase/functions/contact-notify/index.ts supabase/phase-21-notification-log.sql supabase/phase-21-notification-log-setup.md ADMIN_PHASE_21_NOTIFICATION_LOG_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 21: Notification log + delivery tracking

- supabase/phase-21-notification-log.sql: cms_notification_log table (id,
  lead_id FK ON DELETE SET NULL, channel, provider, event_type, status,
  recipient/sender email, subject, provider_message_id, error_message,
  metadata jsonb); RLS anon-deny, admin SELECT, owner DELETE; no authenticated
  INSERT (service-role only); 4 indexes including provider_message_id partial
- contact-notify: insertLog() helper uses SUPABASE_SERVICE_ROLE_KEY (built-in,
  no manual setup); logs on send success and failure; never throws; parses
  Resend JSON response to capture provider_message_id; adds retry=true support
  (retry_notification event_type, blue retry banner in email); returns
  { ok, test, retry, logged }
- admin.js: notificationLogs/notificationLogsLoading/leadRetrying state;
  loadNotificationLogs() (SELECT latest 100 log rows); retryNotification()
  owner-only; switchDashboardTab and leads-refresh load logs concurrently;
  sendTestNotification reloads logs after; renderLeadsTab shows notification
  history (up to 5 entries per lead) with status badges, timestamps, event
  type, error text; Retry Notification button (owner-only); escapeHtml on
  all log fields
- admin.css: .gv-notif-log container, row, title, empty, time/type labels,
  .gv-notif-badge variants (sent/failed/test/skip), .gv-notif-err

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 22 Safe to Start

**Yes.** No regressions introduced. All prior phase features intact.

---

## Recommended Phase 22 Title

**Phase 22: Resend Delivery Webhook + Bounce Handling**

Suggested scope:
- New Edge Function: `resend-webhook` — receives Resend delivery webhooks (delivered, bounced, complained, failed events)
- Updates `cms_notification_log` row: set `status = 'failed'` on bounce/complaint, record delivery timestamp in `metadata`
- Uses `provider_message_id` to correlate webhook events to log rows
- Webhook signature verification using Resend's HMAC signature (`svix-signature` header or Resend equivalent)
- Admin Leads tab: update notification badge from `sent` → `delivered` or `bounced` once webhook fires
- New status value `'delivered'` added to the status check constraint via a migration
- Supabase Database Webhook is NOT the right trigger here — use a direct HTTP endpoint registered in the Resend dashboard
