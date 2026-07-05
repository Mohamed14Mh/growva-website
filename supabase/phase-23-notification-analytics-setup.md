# Phase 23: Notification Analytics Setup

Phase 23 adds Admin Dashboard analytics for `cms_notification_log`.

## SQL

No new SQL is required.

The dashboard reads the existing RLS-protected `cms_notification_log` table and
computes analytics client-side for authenticated admin users.

Required earlier patches:

- `supabase/phase-21-notification-log.sql`
- `supabase/phase-22-resend-delivery-webhook.sql`

## Data Strategy

The admin client loads the latest 500 notification log rows ordered by
`created_at DESC`.

Analytics are computed in `admin/admin.js` from those rows:

- status counts
- delivery/failure/engagement rates
- recent delivery issues
- last 24 hours / 7 days / 30 days activity

This avoids adding a reporting view or database function for a small operational
dashboard. RLS remains authoritative because the browser can only read what the
authenticated admin role is allowed to read.

## Dashboard Verification

1. Log in to Admin Mode.
2. Open `CMS Dashboard`.
3. Open the `Notifications` tab.
4. Confirm metrics render for the latest notification logs.
5. Click `Refresh Notifications`.
6. Expand a lead in the `Leads` tab and confirm notification history still works.

## Database Verification

```sql
SELECT status, event_type, recipient_email, provider_message_id, created_at, last_event_at
FROM public.cms_notification_log
ORDER BY created_at DESC
LIMIT 10;
```

Expected statuses after Phase 22:

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

## Known Limitations

- Analytics are based on the latest 500 rows, not all historical rows.
- The tab is operational reporting, not a long-term analytics warehouse.
- Open/click rates depend on whether Resend emits those events and whether the
  webhook is configured to receive them.
- If a delivery lifecycle event overwrites a row status, the dashboard reflects
  the current status of that row rather than a full event ledger.
