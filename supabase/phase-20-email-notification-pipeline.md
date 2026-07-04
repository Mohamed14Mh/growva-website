# Phase 20 — Email Notification Pipeline Setup Guide

Sends an email notification to the admin team whenever a new contact form lead is submitted.

---

## Architecture

```
visitor submits contact form
        ↓
cms_contact_submissions (INSERT)
        ↓
Supabase Database Webhook  →  Edge Function: contact-notify  →  Resend API  →  admin inbox
```

The Edge Function is also callable directly from the admin dashboard (owner-only) via a **Send Test** button.

---

## Files

| File | Purpose |
|------|---------|
| `supabase/functions/contact-notify/index.ts` | Edge Function source (TypeScript/Deno) |
| `supabase/phase-20-email-notification-pipeline.md` | This setup guide |
| `admin/admin.js` | Owner-only test button + state management |
| `admin/admin.css` | Notify bar styles |

No SQL migration required for Phase 20.

---

## Step 1 — Supabase CLI Setup

Install the Supabase CLI if not already installed:
```bash
npm install -g supabase
```

Link your project (run once):
```bash
supabase login
supabase link --project-ref <your-project-ref>
```

---

## Step 2 — Deploy the Edge Function

```bash
supabase functions deploy contact-notify
```

The function will be available at:
```
https://<project-ref>.supabase.co/functions/v1/contact-notify
```

---

## Step 3 — Set Required Secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
supabase secrets set CONTACT_NOTIFY_TO_EMAIL=team@yourdomain.com
supabase secrets set CONTACT_NOTIFY_FROM_EMAIL=noreply@yourdomain.com
```

**RESEND_API_KEY** — obtain from https://resend.com/api-keys
**CONTACT_NOTIFY_TO_EMAIL** — the inbox that receives new lead notifications
**CONTACT_NOTIFY_FROM_EMAIL** — must be a verified domain/address in your Resend account

> These secrets are stored in Supabase's encrypted secret store and are NEVER exposed to client code.

---

## Step 4 — Set Webhook Secret (Recommended for Production)

Generate a random secret:
```bash
openssl rand -hex 32
```

Set it:
```bash
supabase secrets set CONTACT_NOTIFY_WEBHOOK_SECRET=<generated-secret>
```

This secret must be included in every Database Webhook request as the header:
```
x-contact-notify-secret: <generated-secret>
```

If `CONTACT_NOTIFY_WEBHOOK_SECRET` is NOT set, the function accepts all POST requests. This is acceptable for local development but should be secured in production.

---

## Step 5 — Create the Database Webhook

In your Supabase Dashboard:

1. Go to **Database → Webhooks**
2. Click **Create a new hook**
3. Configure:
   - **Name:** `contact_notify_on_insert`
   - **Table:** `public.cms_contact_submissions`
   - **Events:** ✓ Insert
   - **HTTP Method:** POST
   - **URL:** `https://<project-ref>.supabase.co/functions/v1/contact-notify`
4. Add HTTP headers:
   ```
   Content-Type: application/json
   x-contact-notify-secret: <your-CONTACT_NOTIFY_WEBHOOK_SECRET-value>
   ```
5. Save

> The webhook sends the full row payload in the Supabase webhook format:
> `{ "type": "INSERT", "table": "cms_contact_submissions", "record": { ...row... } }`

---

## Email Behavior

**Subject:**
```
New GROWVA lead: {name} — {project_type}
```

**Body includes:**
- Lead name, email (clickable mailto link), company, project type, budget, page path, received timestamp
- Full message text (HTML and plain text)
- `reply_to` set to lead's email if it passes format validation

**Fields truncated for safety:**
- name → 200 chars, email → 320 chars, company → 200 chars
- project_type → 100 chars, budget → 100 chars, message → 2000 chars, page_path → 200 chars

**HTML escape:** All lead field values are HTML-escaped before injection into the email body. No XSS risk from stored lead data.

---

## Test Notification (Admin Dashboard)

The Leads tab shows a **Send Test** button for owners only.

- Clicking it calls `supabaseClient.functions.invoke('contact-notify', { body: { record: <sample>, test: true } })`
- Uses the most recent unarchived lead as sample payload, or a synthetic placeholder if no leads exist
- Email subject is prefixed with `[TEST]`
- A yellow banner in the email body indicates it is a test

**Auth:** The Supabase JS client automatically sends the user's JWT. When `CONTACT_NOTIFY_WEBHOOK_SECRET` is set, the test path verifies the JWT via Supabase Auth instead of the secret header.

---

## Webhook Secret Validation

| Scenario | Behaviour |
|----------|-----------|
| Secret set + correct header | ✓ Allowed |
| Secret set + missing/wrong header (non-test) | 401 Unauthorized |
| Secret set + test=true + valid user JWT | ✓ Allowed |
| Secret set + test=true + no/invalid JWT | 401 Unauthorized |
| Secret not set | ✓ Allowed (all requests) |

---

## Event Filtering

| Payload | Behaviour |
|---------|-----------|
| `type: "INSERT"`, `table: "cms_contact_submissions"` | ✓ Sends email |
| `type: "UPDATE"` or `"DELETE"` | Ignored (200) |
| Different table name | Ignored (200) |
| Missing `record` | 400 error |

---

## Notification Log

No separate notification log table is created in Phase 20.

**Delivery debugging:** Use the Resend dashboard (https://resend.com/emails) and Supabase Edge Function logs (Dashboard → Edge Functions → contact-notify → Logs).

If a persistent log is needed in a future phase, create `cms_notification_log` with columns: `id`, `lead_id`, `channel`, `status` CHECK ('sent','failed'), `provider`, `error_message`, `created_at`.

---

## cURL Test Commands

**Direct test (no webhook secret):**
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/contact-notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-anon-key>" \
  -d '{"record":{"name":"Test","email":"test@example.com","project_type":"Web Design","message":"Test message."},"test":true}'
```

Expected success response:
```json
{ "ok": true, "test": true }
```

**Webhook simulation (with secret):**
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/contact-notify \
  -H "Content-Type: application/json" \
  -H "x-contact-notify-secret: <your-secret>" \
  -d '{"type":"INSERT","table":"cms_contact_submissions","record":{"name":"Jane Smith","email":"jane@example.com","project_type":"Branding","message":"We need a full rebrand."}}'
```

**Wrong secret (expect 401):**
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/contact-notify \
  -H "Content-Type: application/json" \
  -H "x-contact-notify-secret: wrong-secret" \
  -d '{"record":{}}'
```

Expected: `{ "error": "Unauthorized" }` with HTTP 401

**Non-INSERT event (expect ignored):**
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/contact-notify \
  -H "Content-Type: application/json" \
  -H "x-contact-notify-secret: <your-secret>" \
  -d '{"type":"UPDATE","table":"cms_contact_submissions","record":{}}'
```

Expected: `{ "ignored": true, "reason": "not an INSERT event" }` with HTTP 200

---

## Resend Domain Verification

For reliable email delivery:
1. Go to https://resend.com/domains
2. Add and verify your sending domain
3. Set `CONTACT_NOTIFY_FROM_EMAIL` to an address on that verified domain (e.g. `noreply@yourdomain.com`)

Do NOT use a free email provider (Gmail, Yahoo, etc.) as the `from` address — it will fail SPF/DKIM checks.

---

## Security Checklist

- [x] `RESEND_API_KEY` lives only in Supabase secrets — not in any frontend file
- [x] No service-role key used or exposed
- [x] Lead field values HTML-escaped in email body
- [x] Lead email validated before use as `reply_to`
- [x] All fields truncated before email insertion
- [x] Webhook secret optional but documented for production
- [x] Test path requires valid Supabase auth session when secret is configured
- [x] Non-INSERT events silently ignored
- [x] Admin test button is owner-only (JS guard + auth guard in function)
- [x] `leadsNotifyMsg` passed through `escapeHtml()` before innerHTML use
