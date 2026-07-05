# Admin Phase 23: Notification Analytics Report

## Files Changed

- `admin/admin.js`
- `admin/admin.css`
- `supabase/phase-23-notification-analytics-setup.md`
- `ADMIN_PHASE_23_NOTIFICATION_ANALYTICS_REPORT.md`

## SQL Needed

No new SQL was added for Phase 23.

The Notifications tab uses the existing `cms_notification_log` table created in
Phase 21 and extended in Phase 22.

## Analytics Data Strategy

Analytics are computed client-side from the latest 500 `cms_notification_log`
rows that the authenticated admin can read through existing RLS policies.

This keeps the phase small, avoids adding a reporting view, and preserves the
existing Supabase security model.

## Notifications Tab Behavior

Added a new `Notifications` dashboard tab. When opened, it loads notification
logs if needed and renders:

- health summary
- refresh button
- metric cards
- rate cards
- status breakdown
- recent delivery issues
- recent activity summary

It includes loading, empty, and error states.

## Metrics Implemented

- Total notifications
- Sent
- Delivered
- Failed
- Bounced
- Complained
- Opened
- Clicked
- Unknown

## Rates Implemented

- Delivery rate
- Failure rate
- Engagement rate

Rates show `—` when the denominator is zero and use at most one decimal place.

## Recent Issues Behavior

Recent delivery issues show the latest `failed`, `bounced`, `complained`, and
`unknown` rows. Each row includes status, recipient, event type, timestamp, and a
safe reason from `error_message` or selected metadata if available.

## Timeline / Activity Summary

Added client-side summaries for:

- last 24 hours
- last 7 days
- last 30 days

Each range shows total notifications, delivered count, and issue count.

## Overview Enhancement

The Overview tab now shows:

- Notification health
- Failed notifications

If notification logs are not loaded yet, these display `—` gracefully.

## Security Review

- No Resend API key was added to frontend files.
- No service-role key was added to frontend files.
- No webhook secret value was added to frontend files.
- Notification values rendered in admin UI are escaped.
- Raw metadata is not rendered directly.
- Analytics use existing authenticated admin `SELECT` access only.
- Public visitor mode has no path to notification analytics.
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`
  grep hits are existing Edge Function environment references or documentation
  placeholders only.
- `service_role` and `sb_secret` hits remain the existing frontend unsafe-key
  rejection guards and prior reports/docs.
- `innerHTML` hits are existing admin/public render surfaces; new notification
  analytics values are escaped with `escapeHtml()`.
- `javascript:` hits are existing URL guard/block code.

## QA Results

Completed:

- `node --check admin/admin.js` - passed
- `node --check js/script.js` - passed
- `node --check js/content-registry.js` - passed
- `git diff --check` - passed, with existing CRLF normalization warnings for
  `admin/admin.js` and `admin/admin.css`
- Requested security greps completed:
  `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `service_role`, `sb_secret`, `Authorization`, `innerHTML`, `javascript:`

Manual browser QA still requires a logged-in admin session with real
`cms_notification_log` rows.

## Known Limitations

- Analytics are limited to the latest 500 rows.
- This is an operational dashboard, not a long-term analytics warehouse.
- Engagement rate depends on Resend open/click webhook availability.
- Current-status aggregation reflects the latest status stored on each log row,
  not a separate immutable event stream.

## Temporary QA Files

No temporary QA files were added.

## Safe To Commit

Yes, after reviewing the working diff and running the listed validation checks.

## Phase 24

Phase 24 is safe to start after manual dashboard QA in an authenticated admin
session.

Recommended Phase 24 title: Lead Source Attribution and Conversion Reporting.
