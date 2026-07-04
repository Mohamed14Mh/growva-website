# Phase 21 — Notification Log Setup Guide

Adds persistent delivery tracking for contact form email notifications.
Every send attempt (success or failure) is logged to `cms_notification_log`.
Log history is visible in the Admin Dashboard → Leads tab (expanded lead detail).

---

## Architecture

```
contact-notify Edge Function
  ├── sends Resend email
  └── writes to cms_notification_log (via service-role client, bypasses RLS)
           ↓
Admin Leads tab → expanded lead detail → notification history (SELECT via user JWT)
```

---

## Step 1 — Run SQL Patch

In the Supabase SQL Editor, run the full contents of:

```
supabase/phase-21-notification-log.sql
```

This creates `cms_notification_log` with RLS, indexes, and constraints.
It is idempotent — safe to run again if partially applied.

Verify success:
```sql
-- Table and RLS on:
SELECT schemaname, tablename, rowsecurity
FROM pg_tables WHERE tablename = 'cms_notification_log';

-- Policies created:
SELECT policyname, cmd, roles
FROM pg_policies WHERE tablename = 'cms_notification_log'
ORDER BY policyname;

-- Should return 2 rows: cms_notification_log_admin_select, cms_notification_log_owner_delete
```

---

## Step 2 — Redeploy the Edge Function

The Edge Function was updated to write logs. Redeploy it:

```bash
supabase functions deploy contact-notify
```

---

## Step 3 — Confirm Service-Role Key is Available

`SUPABASE_SERVICE_ROLE_KEY` is automatically injected into all Supabase Edge Functions.
**You do not need to set it manually.** It is a built-in Edge Function environment variable.

To confirm it is available, check your Edge Function logs after the first invocation:
- If you see `[contact-notify] SUPABASE_SERVICE_ROLE_KEY not available — log skipped`,
  the key is missing — contact Supabase support (very rare).
- If you see no warning and the log table receives a row, it is working correctly.

---

## Step 4 — Verify Secrets Are Still Set

Phase 20 secrets should already be in place. Confirm:

```bash
supabase secrets list
```

Expected entries: `RESEND_API_KEY`, `CONTACT_NOTIFY_TO_EMAIL`, `CONTACT_NOTIFY_FROM_EMAIL`
Optional but recommended: `CONTACT_NOTIFY_WEBHOOK_SECRET`

---

## Step 5 — Test the Edge Function Directly

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/contact-notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-anon-key>" \
  -d '{"record":{"id":"00000000-0000-0000-0000-000000000001","name":"Test","email":"test@example.com","project_type":"Web Design","message":"Test message."},"test":true}'
```

Expected response:
```json
{ "ok": true, "test": true, "retry": false, "logged": true }
```

If `"logged": false`, check Edge Function logs — the `SUPABASE_SERVICE_ROLE_KEY` may not be resolving or the table may not exist yet.

---

## Step 6 — Verify Log Rows Appear

```sql
SELECT id, lead_id, status, event_type, recipient_email, created_at
FROM public.cms_notification_log
ORDER BY created_at DESC
LIMIT 10;
```

After running the test above you should see one row with `status = 'test'`.

---

## Step 7 — Test the Database Webhook

Trigger an INSERT into `cms_contact_submissions` to confirm the webhook fires:

```sql
INSERT INTO public.cms_contact_submissions (name, email, message)
VALUES ('Webhook Test', 'webhook@example.com', 'Testing the webhook pipeline.');
```

Check logs:
```sql
SELECT status, event_type, created_at FROM public.cms_notification_log
ORDER BY created_at DESC LIMIT 3;
```

If the webhook is configured and the function is deployed, you should see a `'sent'` row with `event_type = 'lead_notification'`.

---

## Step 8 — Verify Admin Leads Tab

1. Log in as owner
2. Open Admin Dashboard → Leads tab
3. Click Expand on any lead
4. You should see **Notification history** section showing sent/test/failed badges and timestamps
5. For leads with no notifications yet, "No notification history." is shown
6. The **Retry Notification** button appears for owners only
7. Click Retry — observe sending state, then success/error message and updated log entry

---

## Notification Log Table Schema

```
id                  UUID PK default gen_random_uuid()
lead_id             UUID FK → cms_contact_submissions(id) ON DELETE SET NULL (nullable)
channel             TEXT default 'email'    — CHECK IN ('email')
provider            TEXT default 'resend'   — CHECK IN ('resend')
event_type          TEXT default 'lead_notification'
                    — 'lead_notification' | 'test_notification' | 'retry_notification'
status              TEXT NOT NULL           — CHECK IN ('sent', 'failed', 'skipped', 'test')
recipient_email     TEXT nullable
sender_email        TEXT nullable
subject             TEXT nullable (≤500 chars)
provider_message_id TEXT nullable
error_message       TEXT nullable (≤1000 chars)
metadata            JSONB default '{}'
created_at          TIMESTAMPTZ default now()
```

No `updated_at` — logs are append-only.

---

## RLS Behaviour

| Role | SELECT | INSERT | DELETE |
|------|--------|--------|--------|
| Anon | ✗ | ✗ | ✗ |
| Authenticated viewer | ✓ | ✗ | ✗ |
| Authenticated editor | ✓ | ✗ | ✗ |
| Authenticated owner | ✓ | ✗ | ✓ |
| Edge Function (service-role) | ✓ | ✓ | ✓ |

INSERT is server-side only. The service-role client inside the Edge Function bypasses RLS entirely.

---

## Known Limitations

1. **`SUPABASE_SERVICE_ROLE_KEY` is built-in** — no manual secret setup needed. If it were unavailable for any reason, the email still sends; only logging would be skipped.

2. **Logs cap at 100 rows** in the admin UI query (newest first). Older rows are stored but not shown. For full history, query the DB directly.

3. **Up to 5 log entries per lead** shown in the expanded UI. Older entries for the same lead are stored but not shown.

4. **Retry sends a real email** (not marked [TEST]). Email subject is the same as the original. A blue banner in the email body indicates it is a retry.

5. **Test entries have `lead_id = NULL`** unless you used a real lead as the sample payload (which the test button does by default). If `notificationLogs` loaded before the test ran, the log entry will match the real lead's ID.

6. **No automatic retry on failure** — retry is a manual owner action only.
