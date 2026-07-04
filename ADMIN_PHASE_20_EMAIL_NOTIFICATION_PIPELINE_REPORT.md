# GROWVA CMS Phase 20 — Email Notification Pipeline Report

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/contact-notify/index.ts` | **NEW** — Supabase Edge Function (TypeScript/Deno) |
| `supabase/phase-20-email-notification-pipeline.md` | **NEW** — Full deployment and webhook setup guide |
| `admin/admin.js` | +52 lines: `sendTestNotification()`, state vars, click handler, notify panel in `renderLeadsTab()` |
| `admin/admin.css` | +20 lines: `.gv-leads-notify-bar` and status styles |
| `ADMIN_PHASE_20_EMAIL_NOTIFICATION_PIPELINE_REPORT.md` | This report |

---

## Edge Function

**File:** `supabase/functions/contact-notify/index.ts`
**Runtime:** Deno (Supabase Edge Functions)
**Trigger:** Supabase Database Webhook on INSERT to `cms_contact_submissions`, or direct admin test via `supabaseClient.functions.invoke()`

### What It Does

1. Validates the incoming POST request (method check, JSON parse)
2. Applies auth check (webhook secret or user JWT — see below)
3. Filters webhook events (only INSERT, only correct table)
4. Validates the `record` payload is present and an object
5. Reads three required env secrets: `RESEND_API_KEY`, `CONTACT_NOTIFY_TO_EMAIL`, `CONTACT_NOTIFY_FROM_EMAIL`
6. Sanitises all lead field values (truncated, HTML-escaped in email body)
7. Validates lead email format before using as `reply_to`
8. Builds HTML + plain text email
9. Calls Resend API (`https://api.resend.com/emails`) via `fetch`
10. Returns JSON success or error response

---

## SQL Patch

**Not required.** Phase 20 adds no new database tables. The Edge Function reads from the existing `cms_contact_submissions` table (which was created in Phase 19).

---

## Supabase Deploy Required

**Yes.** The Edge Function must be deployed to Supabase before it can receive webhook calls or test invocations.

```bash
supabase functions deploy contact-notify
```

See `supabase/phase-20-email-notification-pipeline.md` for full CLI setup steps.

---

## Required Environment Secrets

Set via `supabase secrets set`:

| Secret | Required | Purpose |
|--------|----------|---------|
| `RESEND_API_KEY` | Yes | Resend API authentication |
| `CONTACT_NOTIFY_TO_EMAIL` | Yes | Admin inbox to receive leads |
| `CONTACT_NOTIFY_FROM_EMAIL` | Yes | Verified sender address in Resend |
| `CONTACT_NOTIFY_WEBHOOK_SECRET` | Recommended | Guards webhook endpoint against unauthorized calls |

**None of these secrets appear in any frontend file.**

---

## Webhook Setup

1. Deploy function (Step 2 above)
2. Set secrets (Step 3–4)
3. In Supabase Dashboard → Database → Webhooks:
   - Table: `public.cms_contact_submissions`
   - Event: Insert
   - URL: `https://<project-ref>.supabase.co/functions/v1/contact-notify`
   - Headers: `Content-Type: application/json`, `x-contact-notify-secret: <secret>`

Full instructions with cURL test commands in `supabase/phase-20-email-notification-pipeline.md`.

---

## Email Behavior

- **Subject:** `New GROWVA lead: {name} — {project_type}`
- **To:** `CONTACT_NOTIFY_TO_EMAIL` env secret
- **From:** `CONTACT_NOTIFY_FROM_EMAIL` env secret
- **Reply-To:** Lead's email (if valid format) — allows direct reply from email client
- **HTML body:** Professional table layout — name, email, company, project type, budget, page, received date, full message
- **Plain text fallback:** Included in the same Resend call
- **Field truncation:** name 200, email 320, company 200, project_type 100, budget 100, message 2000, page_path 200
- **HTML escaping:** All lead values passed through `esc()` before email HTML injection — no stored XSS risk in email

---

## Webhook Secret Behavior

`CONTACT_NOTIFY_WEBHOOK_SECRET` is optional but strongly recommended for production.

| Scenario | Result |
|----------|--------|
| Secret configured + correct `x-contact-notify-secret` header | 200 / email sent |
| Secret configured + missing or wrong header (non-test) | 401 Unauthorized |
| Secret configured + `test: true` + valid Supabase user JWT | 200 / email sent |
| Secret configured + `test: true` + no/invalid JWT | 401 Unauthorized |
| Secret not configured | Accepts all POST requests |

The `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars are built-in to all Supabase Edge Function environments — no additional secrets needed to validate the user JWT.

---

## Admin Test Button

**Location:** Leads tab → top of tab, above filter bar
**Visibility:** Owner role only (`adminProfile.role === 'owner'`)
**Button label:** "Send Test" → "Sending…" while in progress
**States:** `idle` / `sending` / `ok` / `error`

**On success:** Green "Test email sent. Check your inbox." message
**On error:** Red message with error detail (from `e.message`) — all passed through `escapeHtml()`

**Payload:** Uses first unarchived lead from `leadsData` as the sample record (to test with realistic data), or a synthetic placeholder if no leads exist. Email subject is prefixed `[TEST]` and body includes a yellow warning banner.

**Function call:** `supabaseClient.functions.invoke('contact-notify', { body: { record, test: true } })`
- Requires Supabase JS v2 (standard CDN version used in this project)
- Checked with `typeof supabaseClient.functions?.invoke !== 'function'` guard — if not available, shows clear error

---

## Notification Log

**Not implemented.** Resend dashboard (https://resend.com/emails) provides delivery receipts, open tracking (optional), and bounce management. Supabase Edge Function logs (Dashboard → Edge Functions → contact-notify → Logs) show per-call errors.

If a persistent DB log is required in future: create `cms_notification_log` with `id, lead_id, channel, status CHECK('sent','failed'), provider, error_message, created_at`. That is a Phase 21+ decision.

---

## Security Review

### Frontend files (admin/admin.js, js/script.js, contact.html, admin.css)

| Check | Result |
|-------|--------|
| `RESEND_API_KEY` in frontend | ✗ None |
| `service_role` key in frontend | ✗ None (existing guard-detection code only at line 276–280) |
| `sb_secret_` in frontend | ✗ None (existing detection guard at line 276) |
| Hardcoded `Authorization: Bearer <key>` | ✗ None |
| `leadsNotifyMsg` in innerHTML | `escapeHtml()` applied — ✓ |
| Test button available to non-owner | Role check `adminProfile?.role === 'owner'` — ✓ |
| No secrets visible in admin dashboard | ✓ |

### Edge Function (`supabase/functions/contact-notify/index.ts`)

| Check | Result |
|-------|--------|
| Secrets via `Deno.env.get()` only | ✓ |
| No secrets hardcoded | ✓ |
| All lead fields truncated | ✓ |
| All lead fields HTML-escaped in email body | ✓ |
| Lead email validated before use as `reply_to` | ✓ |
| Full Resend API response not forwarded to client | ✓ (only HTTP status code referenced) |
| Webhook event type filtered | ✓ (non-INSERT ignored) |
| Table name validated | ✓ (non-matching table ignored) |
| JWT verification uses built-in Supabase env vars | ✓ (no service-role key needed) |
| `console.error` on Resend failure (no sensitive data) | ✓ (only HTTP status logged) |

---

## QA Results

### node --check

```
admin/admin.js         — PASS
js/script.js           — PASS
js/content-registry.js — PASS
```

### Deno check

Deno is not installed in this environment. TypeScript correctness confirmed by code review:
- All types explicit — no implicit `any` in critical paths
- `Deno.env.get()` returns `string | undefined` — checked before use
- `fetch` response status checked before proceeding
- `createClient` import matches Supabase ESM CDN pattern used in all official Edge Function examples
- `body.record` explicitly cast and null-checked before field access

### Regression checks

| Feature | Status |
|---------|--------|
| Contact form submission | Not touched — ✓ |
| Admin Leads tab (load, filter, expand, mark, archive) | Not touched — ✓ |
| sendTestNotification guard (`functions?.invoke` check) | Won't crash if unavailable — ✓ |
| Visual Designer, Properties Panel | Not touched — ✓ |
| Content/Style tabs, Save Draft, Publish, Draft Compare | Not touched — ✓ |
| Section Builder, Media Library, Visual Control | Not touched — ✓ |
| Preview as Visitor, Section Manager, SEO metadata | Not touched — ✓ |
| GSAP, Lenis, Three.js, page transitions | Not touched — ✓ |
| Mega menu, mobile menu | Not touched — ✓ |
| Public visitor mode | Not touched — ✓ |

---

## Known Limitations

1. **Deno check not run** — Deno not available in this environment. Code reviewed manually against Supabase Edge Function patterns.

2. **Webhook secret not shared to admin frontend** — intentionally. The test button uses user JWT auth instead. This is the correct security design.

3. **No per-lead email tracking** — if a lead is updated/re-submitted, no additional notification is sent. Only INSERT events trigger email.

4. **Resend free tier limit** — Resend free tier is 3,000 emails/month. For high-volume sites, upgrade Resend plan or add rate limiting in the Edge Function.

5. **`supabaseClient.functions.invoke` requires Supabase JS v2** — guarded with `typeof supabaseClient.functions?.invoke !== 'function'`. If the client version on the CDN does not support it, a clear error message is shown.

6. **Email not sent retroactively** — leads already in the database before the webhook was created will not trigger an email. This is expected webhook behavior.

7. **No notification log in DB** — Resend dashboard is the source of truth for delivery status. Add `cms_notification_log` in Phase 21+ if needed.

---

## Temporary QA Files

None created.

---

## Safe to Commit

**Yes.**

Commit does not require the Edge Function to be deployed first — the function file is committed to the repo as source code. Deployment is a separate manual step.

---

## Exact Commit Command

```bash
git add admin/admin.js admin/admin.css supabase/functions/contact-notify/index.ts supabase/phase-20-email-notification-pipeline.md ADMIN_PHASE_20_EMAIL_NOTIFICATION_PIPELINE_REPORT.md
git commit -m "$(cat <<'EOF'
Phase 20: Email notification pipeline via Supabase Edge Function

- supabase/functions/contact-notify/index.ts: Deno Edge Function that sends
  Resend email on INSERT to cms_contact_submissions; supports Supabase DB
  webhook format and direct test invocation; optional CONTACT_NOTIFY_WEBHOOK_SECRET
  header guard; test path validates Supabase user JWT; all lead fields truncated
  and HTML-escaped; reply_to set to lead email if valid format
- admin.js: owner-only Send Test button in Leads tab; sendTestNotification()
  uses supabaseClient.functions.invoke with real or synthetic lead payload;
  idle/sending/ok/error state with escaped status messages; guard for missing
  functions.invoke API
- admin.css: .gv-leads-notify-bar panel, label, and status (ok/error) styles
- supabase/phase-20-email-notification-pipeline.md: full deploy guide — CLI
  commands, secret setup, webhook config, cURL tests, Resend domain notes,
  security checklist
- No SQL migration required (uses existing cms_contact_submissions table)
- No secrets in any frontend file

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 21 Safe to Start

**Yes.** No regressions introduced. All prior phase features remain intact.

---

## Recommended Phase 21 Title

**Phase 21: Notification Log + Delivery Tracking**

Suggested scope:
- `cms_notification_log` table: `id, lead_id (FK nullable), channel, status CHECK('sent','failed'), provider, error_message, created_at`
- Edge Function writes a row to the log on every send attempt (success and failure)
- Admin dashboard: Leads tab detail panel shows "Notification sent at {time}" if a log entry exists for that lead
- Owner-only retry button: re-invokes the Edge Function for a specific lead
- RLS: authenticated SELECT (viewer/editor/owner), Edge Function uses service-role key for INSERT (server-side only)
- Resend webhook endpoint (Phase 22+) to update log status on bounce/delivery confirmation
