# Phase 22: Resend Delivery Webhook Setup

This phase adds a server-side Resend webhook endpoint that updates
`cms_notification_log` as delivery lifecycle events arrive.

## 1. Apply SQL patch

Run this file in the Supabase SQL Editor:

```sql
supabase/phase-22-resend-delivery-webhook.sql
```

It extends the existing Phase 21 status constraint and adds nullable lifecycle
timestamp columns:

- `delivered_at`
- `bounced_at`
- `complained_at`
- `opened_at`
- `clicked_at`
- `last_event_at`

The patch is idempotent and does not recreate or delete existing log rows.

## 2. Deploy Edge Function

```bash
supabase functions deploy resend-webhook --no-verify-jwt
```

`--no-verify-jwt` is required because Resend calls this endpoint server-to-server
without a Supabase user JWT. The function authenticates with the
`x-resend-webhook-secret` header instead.

## 3. Set required secret

```bash
supabase secrets set RESEND_WEBHOOK_SECRET=<strong-random-secret>
```

The function also uses Supabase-provided `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` at runtime. Do not put either value in frontend files.

## 4. Configure Resend Dashboard webhook

URL:

```text
https://<project-ref>.supabase.co/functions/v1/resend-webhook
```

Header:

```text
x-resend-webhook-secret: <same-value-as-RESEND_WEBHOOK_SECRET>
```

Events to enable, depending on the Resend UI names available:

- sent
- delivered
- bounced
- complained
- failed
- opened
- clicked

Expected event names include `email.sent`, `email.delivered`,
`email.bounced`, `email.complained`, `email.failed`, `email.opened`, and
`email.clicked`.

## 5. Test payload examples

Delivered:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/resend-webhook \
  -H "Content-Type: application/json" \
  -H "x-resend-webhook-secret: <secret>" \
  -d '{
    "type": "email.delivered",
    "data": {
      "email_id": "<provider_message_id-from-cms_notification_log>",
      "created_at": "2026-07-05T12:00:00Z",
      "to": ["admin@example.com"],
      "subject": "New GROWVA lead"
    }
  }'
```

Bounced:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/resend-webhook \
  -H "Content-Type: application/json" \
  -H "x-resend-webhook-secret: <secret>" \
  -d '{
    "type": "email.bounced",
    "data": {
      "email_id": "<provider_message_id-from-cms_notification_log>",
      "reason": "Mailbox unavailable",
      "bounce": { "type": "permanent" }
    }
  }'
```

## 6. Verify database updates

```sql
SELECT status, provider_message_id, metadata, created_at, last_event_at
FROM public.cms_notification_log
ORDER BY created_at DESC
LIMIT 10;
```

For a matched delivery event, the existing row should update instead of creating
a new orphan row.

## Limitations

- This first production-safe version uses a shared secret header because the
  exact Resend/Svix signature configuration is not implemented here.
- Unknown events update a matched log row to `unknown`; events without a
  matching `provider_message_id` are ignored with HTTP 200.
- The function stores only safe selected provider fields in `metadata`, not the
  full raw webhook payload.
