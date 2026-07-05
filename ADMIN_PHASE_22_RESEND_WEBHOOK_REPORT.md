# Admin Phase 22: Resend Delivery Webhook Report

## Files Changed

- `supabase/phase-22-resend-delivery-webhook.sql`
- `supabase/functions/resend-webhook/index.ts`
- `supabase/phase-22-resend-webhook-setup.md`
- `admin/admin.js`
- `admin/admin.css`
- `ADMIN_PHASE_22_RESEND_WEBHOOK_REPORT.md`

## SQL Patch Details

Created an idempotent SQL patch that extends `cms_notification_log.status` from
the Phase 21 values to:

- `sent`
- `test`
- `failed`
- `skipped`
- `delivered`
- `bounced`
- `complained`
- `opened`
- `clicked`
- `unknown`

The patch preserves existing rows, does not recreate the table, and adds nullable
lifecycle timestamp columns for operational visibility.

## SQL Must Be Run

Yes. Run `supabase/phase-22-resend-delivery-webhook.sql` before relying on
delivery webhook updates. Without it, statuses such as `delivered` and `bounced`
will violate the Phase 21 status constraint.

## Edge Function Deploy Required

Yes. Deploy with:

```bash
supabase functions deploy resend-webhook --no-verify-jwt
```

## Required Secrets

- `RESEND_WEBHOOK_SECRET`

The function also uses Supabase runtime values `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. These remain server-side only.

## resend-webhook Behavior

- Accepts `POST` only.
- Requires `x-resend-webhook-secret` to match `RESEND_WEBHOOK_SECRET`.
- Parses Resend-style delivery events defensively.
- Extracts `provider_message_id` from common payload fields including
  `data.email_id`, `data.id`, `email_id`, `message_id`, and fallback `id`.
- Updates the existing `cms_notification_log` row matching `provider_message_id`.
- Returns HTTP 200 ignored responses for missing or unmatched message IDs.

## Event Mapping

- `email.sent` -> `sent`
- `email.delivered` -> `delivered`
- `email.bounced` / `bounce` -> `bounced`
- `email.complained` / `complaint` -> `complained`
- `email.failed` / `failure` -> `failed`
- `email.opened` / `open` -> `opened`
- `email.clicked` / `click` -> `clicked`
- Unrecognized matched events -> `unknown`

## DB Update Strategy

The webhook updates the matched log row in place. It merges existing metadata
with:

- `latest_resend_event`
- `raw_event_type`
- `webhook_received_at`
- selected safe provider details
- a capped `resend_events` history array

It does not store the full raw provider payload in the admin-rendered data path.

## Admin UI Changes

The Leads tab notification history now reads the Phase 22 lifecycle columns when
available, falls back gracefully if the SQL patch has not been applied, and shows
badges for delivered, bounced, complained, opened, clicked, and unknown events.

Failed, bounced, and complained statuses show a short reason from
`error_message` or safe metadata when available.

## Security Review

- No Resend API key was added to frontend files.
- No webhook secret value was committed.
- No service-role key value was committed.
- The webhook requires a server-side shared secret header.
- Updates use `SUPABASE_SERVICE_ROLE_KEY` only inside the Edge Function.
- Public users still cannot update `cms_notification_log`; no client-side update
  path was added.
- Admin UI renders webhook-derived fields through existing escaping.
- `git grep`/`rg` audit found `RESEND_WEBHOOK_SECRET` only in the new Edge
  Function and documentation/report placeholders.
- `RESEND_API_KEY` remains in the existing `contact-notify` Edge Function and
  setup docs only.
- Existing `sb_secret`, `service_role`, `innerHTML`, and `javascript:` hits are
  known guard code, admin rendering surfaces with escaped values, or prior
  reports/docs; no new frontend secret exposure was added.

## QA Results

Completed local checks:

- `node --check admin/admin.js` - passed
- `node --check js/script.js` - passed
- `node --check js/content-registry.js` - passed
- `git diff --check` - passed, with existing CRLF normalization warnings for
  `admin/admin.js` and `admin/admin.css`
- Deno was not available locally, so these were not run:
  `deno check supabase/functions/contact-notify/index.ts` and
  `deno check supabase/functions/resend-webhook/index.ts`

Manual production QA requires applying the SQL patch, deploying the function,
setting `RESEND_WEBHOOK_SECRET`, and sending Resend test events.

## Known Limitations

- Resend/Svix signature verification is not implemented in this phase. The
  production-safe fallback is a required shared secret header.
- Unknown event payloads are intentionally handled defensively and may map to
  `unknown` until real provider samples are observed.

## Temporary QA Files

No temporary QA files were added.

## Safe To Commit

Yes, after reviewing the SQL patch/deploy requirement. The database patch must be
run before production webhook events can update to new statuses.

## Phase 23

Phase 23 is safe to start after SQL patch application, function deployment, and
one delivered/bounced webhook smoke test pass against the real Supabase project.

Recommended Phase 23 title: Notification Analytics and Deliverability Insights.
