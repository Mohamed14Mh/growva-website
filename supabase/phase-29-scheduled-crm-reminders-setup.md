# Phase 29 Scheduled CRM Reminders Setup

## SQL Patch

Run this patch after Phase 28:

```sql
supabase/phase-29-scheduled-crm-reminders.sql
```

The patch creates:

- `public.cms_crm_reminder_runs`
- `public.cms_crm_reminder_run_items`

It also expands `cms_lead_activity` activity types for scheduled reminder
events.

The patch is idempotent and does not alter `supabase/schema.sql`.

## Edge Function Deploy

Deploy the sweep function:

```powershell
supabase functions deploy crm-reminder-sweep --no-verify-jwt
```

`--no-verify-jwt` is used because the function supports both manual admin JWT
verification and scheduled secret-header verification internally.

## Secret Setup

Set the Phase 29 sweep secret:

```powershell
supabase secrets set CRM_REMINDER_SWEEP_SECRET=<generated-secret>
```

Required existing secrets:

- `RESEND_API_KEY`
- `CONTACT_NOTIFY_TO_EMAIL`
- `CONTACT_NOTIFY_FROM_EMAIL`

Built-in Supabase values used server-side:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not put any of these values in frontend files.

## Manual Run Testing

1. Run the Phase 29 SQL patch.
2. Deploy `crm-reminder-sweep`.
3. Open Admin Dashboard.
4. Open the Tasks tab.
5. Create one overdue open task.
6. Create one task due today.
7. Create one upcoming task.
8. Click `Run Reminder Sweep`.
9. Confirm one digest email arrives at `CONTACT_NOTIFY_TO_EMAIL`.
10. Confirm `reminder_sent_at` and `reminder_count` update for due/overdue tasks.
11. Confirm `cms_crm_reminder_runs` has a completed run.
12. Confirm `cms_crm_reminder_run_items` has sent/skipped/failed item rows.
13. Run the sweep again immediately and confirm duplicate prevention skips tasks
    reminded in the last 24 hours.

## Scheduled Setup Option

Phase 29 does not enable an automatic scheduler by default.

If the project supports Supabase scheduled functions, pg_cron, or an external
trusted scheduler, call:

```text
https://<project-ref>.supabase.co/functions/v1/crm-reminder-sweep
```

Required method and header:

```text
POST
x-crm-reminder-secret: <CRM_REMINDER_SWEEP_SECRET>
```

Recommended cadence:

- once per day in the morning
- never more frequent than hourly

Duplicate prevention skips any task with `reminder_sent_at` inside the last 24
hours, so repeated calls should not send repeated reminder emails for the same
task.

## Optional pg_cron Sketch

Do not run this unless the project already has `pg_cron` and `pg_net` enabled
and you are ready to manage the secret safely.

```sql
-- Example only. Do not enable automatically.
-- SELECT cron.schedule(
--   'growva-crm-reminder-sweep',
--   '0 8 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://<project-ref>.supabase.co/functions/v1/crm-reminder-sweep',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-crm-reminder-secret', '<CRM_REMINDER_SWEEP_SECRET>'
--     ),
--     body := jsonb_build_object('scheduled', true)
--   );
--   $$
-- );
```

## How Duplicate Prevention Works

The sweep selects open tasks where:

- `reminder_enabled = true`
- `due_at` is not null
- `due_at` is overdue or due today

It skips any candidate whose `reminder_sent_at` is less than 24 hours old. Sent
tasks are updated with:

- `reminder_sent_at`
- incremented `reminder_count`
- cleared `last_reminder_error`

## How To Verify DB

```sql
SELECT *
FROM public.cms_crm_reminder_runs
ORDER BY created_at DESC
LIMIT 10;

SELECT *
FROM public.cms_crm_reminder_run_items
ORDER BY created_at DESC
LIMIT 50;
```

## Known Limitations

- The default Phase 29 setup is manual-only until a scheduler is explicitly
  configured.
- The sweep sends one digest email per run, not one email per task.
- Scheduled mode requires `CRM_REMINDER_SWEEP_SECRET`.
- Viewer role behavior requires a viewer account to test manually.
