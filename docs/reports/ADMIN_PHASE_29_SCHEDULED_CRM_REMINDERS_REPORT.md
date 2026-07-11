# Admin Phase 29 Scheduled CRM Reminders Report

## 1. Files Changed

- `admin/admin.js`
- `admin/admin.css`
- `supabase/phase-29-scheduled-crm-reminders.sql`
- `supabase/phase-29-scheduled-crm-reminders-setup.md`
- `supabase/functions/crm-reminder-sweep/index.ts`
- `ADMIN_PHASE_29_SCHEDULED_CRM_REMINDERS_REPORT.md`

## 2. SQL Needed Or Not

SQL is needed.

## 3. SQL Patch Details

Created `supabase/phase-29-scheduled-crm-reminders.sql`.

The patch creates:

- `public.cms_crm_reminder_runs`
- `public.cms_crm_reminder_run_items`

It adds run/run-item indexes, enables RLS, gives authenticated admin roles read access, gives owner delete access for pruning, denies anon, and expands `cms_lead_activity` activity types for scheduled reminder events.

The patch is idempotent, does not drop data, and does not alter `supabase/schema.sql`.

## 4. Edge Function Created Or Not

Created `supabase/functions/crm-reminder-sweep/index.ts`.

## 5. Deploy Required Or Not

Deploy is required:

```powershell
supabase functions deploy crm-reminder-sweep --no-verify-jwt
```

## 6. Required Secrets

New required secret:

- `CRM_REMINDER_SWEEP_SECRET`

Existing required secrets:

- `RESEND_API_KEY`
- `CONTACT_NOTIFY_TO_EMAIL`
- `CONTACT_NOTIFY_FROM_EMAIL`

Built-in Supabase values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 7. Reminder Sweep Behavior

The sweep scans server-side for open CRM tasks where:

- `status = open`
- `reminder_enabled = true`
- `due_at` is not null
- `due_at` is overdue or due today

It returns safe JSON with `run_id`, `total_candidates`, `total_sent`, `total_skipped`, and `total_failed`.

## 8. Digest Email Behavior

The sweep sends one digest email per run to `CONTACT_NOTIFY_TO_EMAIL`.

The digest groups:

- overdue tasks
- due-today tasks

Each task row includes escaped lead/task values: lead name/email/company, task title, priority, due date, and assigned owner.

## 9. Duplicate Prevention

The sweep skips any candidate task with `reminder_sent_at` inside the last 24 hours.

Skipped tasks are logged as run items with reason `Reminder sent within the last 24 hours.`

## 10. Run Log Behavior

`cms_crm_reminder_runs` records each sweep.

`cms_crm_reminder_run_items` records sent/skipped/failed task outcomes.

If the run-log insert fails, the Edge Function returns a safe error telling the admin to run the Phase 29 SQL patch.

## 11. Tasks Tab Controls

Tasks tab now includes a `Reminder automation` panel with:

- `Run Reminder Sweep` button for editor/owner
- last run time/status
- sent/skipped/failed counts
- overdue task count
- due-today task count
- reminders sent in last 24h
- reminder failures
- recent compact run list

Viewers do not see the run button.

## 12. Activity Timeline Integration

Added labels for:

- `task_scheduled_reminder_sent`
- `task_scheduled_reminder_failed`
- `reminder_sweep_run`
- `reminder_sweep_failed`

The sweep inserts per-task scheduled reminder activity rows for sent/failed task reminders.

Metadata is not rendered raw.

## 13. Scheduled Setup Docs

Created `supabase/phase-29-scheduled-crm-reminders-setup.md`.

It documents:

- SQL patch steps
- deploy command
- `CRM_REMINDER_SWEEP_SECRET` setup
- manual run testing
- scheduled endpoint/header
- recommended daily cadence
- not more frequent than hourly
- duplicate prevention
- optional pg_cron sketch that is not enabled by default

## 14. Permission Behavior

Manual mode:

- requires authenticated Supabase JWT
- verifies `admin_profiles.role` is `owner` or `editor`

Scheduled mode:

- requires `x-crm-reminder-secret`
- verifies against `CRM_REMINDER_SWEEP_SECRET`

Database:

- anon cannot access run logs
- viewer/editor/owner can read run logs
- owner can delete logs for pruning
- frontend does not write run logs directly

## 15. Security Review

Ran:

- `git grep "RESEND_API_KEY"`
- `git grep "CRM_REMINDER_SWEEP_SECRET"`
- `git grep "RESEND_WEBHOOK_SECRET"`
- `git grep "SUPABASE_SERVICE_ROLE_KEY"`
- `git grep "service_role"`
- `git grep "sb_secret"`
- `git grep "Authorization"`
- `git grep "innerHTML"`
- `git grep "javascript:"`

Also ran `rg` against the new Phase 29 files because untracked files are not covered by `git grep`.

Findings:

- no actual secret values committed
- no service-role key in frontend
- no Resend key in frontend
- sweep secret appears only as Edge Function env read and docs placeholder
- task and lead values are escaped in admin UI and digest HTML
- metadata is not rendered raw
- viewer cannot run sweeps
- editor/owner can run manual sweeps
- scheduled mode requires secret header
- public cannot access run logs
- no stored XSS risk identified

## 16. QA Results

Passed:

- `node --check admin/admin.js`
- `node --check js/script.js`
- `node --check js/content-registry.js`
- `git diff --check`

Edge Function TypeScript check:

- `deno check supabase/functions/task-reminder-notify/index.ts` was not run because Deno is not installed.
- `deno check supabase/functions/crm-reminder-sweep/index.ts` was not run because Deno is not installed.

Manual Supabase QA was not run locally because the Phase 29 SQL patch was not applied, `CRM_REMINDER_SWEEP_SECRET` was not set here, and `crm-reminder-sweep` was not deployed here.

## 17. Known Limitations

- no scheduler is enabled automatically
- scheduled setup must be configured explicitly after deploy
- the sweep sends one digest email per run, not one email per task
- duplicate prevention uses a 24-hour task-level reminder window
- viewer role QA requires a real viewer account

## 18. Temporary QA Files Status

No new temporary QA files were created.

## 19. Safe To Commit

Yes, safe to commit.

Before production use, run the Phase 29 SQL patch, set `CRM_REMINDER_SWEEP_SECRET`, and deploy `crm-reminder-sweep`.

## 20. Phase 30 Safety

Phase 30 is safe to start after committing Phase 29 and applying/deploying the Phase 29 Supabase pieces.

## 21. Recommended Phase 30 Title

CRM Automation Observability and Reminder Reliability Dashboard
