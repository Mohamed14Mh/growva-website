# Phase 28 CRM Reminder Automation Setup

## SQL Needed

Yes. Run this patch after Phase 27:

```sql
supabase/phase-28-crm-reminder-automation.sql
```

The patch is idempotent and non-destructive. It does not alter
`supabase/schema.sql`.

## SQL Patch Details

The patch adds reminder and automation fields to `public.cms_lead_tasks`:

- `reminder_enabled boolean default true`
- `reminder_sent_at timestamptz`
- `reminder_count integer default 0`
- `last_reminder_error text`
- `automation_source text`

It also expands `cms_lead_activity` activity types for:

- `task_reminder_sent`
- `task_reminder_failed`
- `automation_task_created`
- `automation_task_skipped_duplicate`
- `suggested_task_created`

RLS remains inherited from Phase 27:

- anon has no task access
- viewer/editor/owner can select
- editor/owner can update task reminder state
- owner can delete

## Edge Function Deploy

Phase 28 creates a manual-only Edge Function:

```powershell
supabase functions deploy task-reminder-notify --no-verify-jwt
```

`--no-verify-jwt` is used because the function verifies the caller JWT itself,
then checks `admin_profiles` for editor/owner role before sending.

## Required Secrets

Existing secrets are reused:

- `RESEND_API_KEY`
- `CONTACT_NOTIFY_TO_EMAIL`
- `CONTACT_NOTIFY_FROM_EMAIL`

Built-in Supabase values are used server-side:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not put any of these values in frontend files.

## Manual Reminders

Editors and owners see `Send Reminder` on open tasks. The admin UI calls:

```js
supabaseClient.functions.invoke('task-reminder-notify', {
  body: { task_id }
})
```

The Edge Function:

1. accepts POST only
2. verifies the Supabase user JWT
3. checks the caller is editor or owner
4. reads the task and lead server-side
5. sends an email through Resend to `CONTACT_NOTIFY_TO_EMAIL`
6. updates task reminder state
7. logs `task_reminder_sent` or `task_reminder_failed`
8. writes a `cms_notification_log` row when possible

Viewers cannot send reminders.

## Automation Rules

When an editor/owner saves a lead pipeline stage change, the admin UI creates
one suggested follow-up task automatically:

- `contacted`: `Follow up with lead`, due in 2 days
- `qualified`: `Prepare proposal`, due in 3 days
- `proposal`: `Follow up on proposal`, due in 3 days
- `won`: `Onboarding next steps`, due in 1 day
- `lost`: `Record loss reason`, due today
- `nurture`: `Nurture follow-up`, due in 14 days

Each automation task uses `automation_source = stage:<stage>`.

## Duplicate Prevention

Before creating an automation task, the admin UI checks:

- currently loaded open tasks
- Supabase for an open task with the same `lead_id`, `title`, and
  `automation_source`

If one exists, no new task is created and `automation_task_skipped_duplicate`
is logged.

## Tasks Tab Insights

The Tasks tab now shows:

- overdue tasks
- due today tasks
- reminders sent
- reminder failures
- automation-created tasks
- tasks without due date

It also includes a filter for automation/reminder state.

## How To Test

1. Run the Phase 28 SQL patch.
2. Deploy `task-reminder-notify`.
3. Open the Admin Dashboard.
4. Open Tasks tab and confirm reminder/automation summary cards appear.
5. Create overdue, due-today, upcoming, and no-due-date tasks.
6. Click `Send Reminder` on an open task.
7. Confirm the task shows reminder sent state.
8. Confirm Activity Timeline logs `Task reminder sent`.
9. Change a lead stage and save Pipeline.
10. Confirm one automation-created task appears.
11. Save the same stage again and confirm no duplicate is created.
12. Confirm viewer accounts cannot send reminders, if a viewer test account is available.

## Limitations

- No scheduled reminders are created in Phase 28.
- No hourly or daily background job is installed.
- Manual reminder email delivery requires the Edge Function deploy and existing
  Resend/contact secrets.
- Automation is triggered by admin pipeline saves, not direct database edits.

## Future Scheduled Reminder Plan

A later phase can add scheduled reminders safely by using a controlled
Supabase scheduled Edge Function or cron integration that:

- scans only open tasks with due reminders
- rate-limits sends
- records idempotency keys in task metadata or a dedicated automation log
- respects `reminder_enabled`
- updates `reminder_count`, `reminder_sent_at`, and `last_reminder_error`
