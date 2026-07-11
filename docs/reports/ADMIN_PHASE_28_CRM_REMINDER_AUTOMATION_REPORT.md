# Admin Phase 28 CRM Reminder Automation Report

## 1. Files Changed

- `admin/admin.js`
- `admin/admin.css`
- `supabase/phase-28-crm-reminder-automation.sql`
- `supabase/phase-28-crm-reminder-automation-setup.md`
- `supabase/functions/task-reminder-notify/index.ts`
- `ADMIN_PHASE_28_CRM_REMINDER_AUTOMATION_REPORT.md`

## 2. SQL Needed Or Not

SQL is needed.

Phase 27 task data could support basic due-state display, but Phase 28 manual reminders and automation filtering are safer with explicit task fields instead of only metadata.

## 3. SQL Patch Details

Created `supabase/phase-28-crm-reminder-automation.sql`.

The patch adds to `public.cms_lead_tasks`:

- `reminder_enabled boolean default true`
- `reminder_sent_at timestamptz`
- `reminder_count integer default 0`
- `last_reminder_error text`
- `automation_source text`

It also adds indexes for `reminder_sent_at` and `automation_source`, and expands `cms_lead_activity` allowed activity types for Phase 28 reminder/automation events.

The patch is idempotent, preserves data, preserves existing RLS, and does not alter `supabase/schema.sql`.

## 4. Edge Function Created Or Not

Created `supabase/functions/task-reminder-notify/index.ts`.

It is manual-only and does not create any scheduler or background job.

## 5. Deploy Required Or Not

Deploy is required for manual reminder emails:

```powershell
supabase functions deploy task-reminder-notify --no-verify-jwt
```

The function verifies JWT and editor/owner role internally.

## 6. Required Secrets

Existing secrets are reused:

- `RESEND_API_KEY`
- `CONTACT_NOTIFY_TO_EMAIL`
- `CONTACT_NOTIFY_FROM_EMAIL`

Built-in Supabase values are used server-side:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

No secrets were added to frontend files.

## 7. Reminder Controls Behavior

Open tasks now show reminder states:

- due state: overdue, due today, upcoming, no due date
- reminder sent
- reminder failed
- automation-created

Editors and owners see `Send Reminder` on open tasks. Viewers do not.

The button calls `task-reminder-notify`, then reloads tasks, activity, and notification logs.

## 8. Automation Rules Behavior

Pipeline stage changes can auto-create one follow-up task:

- `contacted`: `Follow up with lead`, due in 2 days
- `qualified`: `Prepare proposal`, due in 3 days
- `proposal`: `Follow up on proposal`, due in 3 days
- `won`: `Onboarding next steps`, due in 1 day
- `lost`: `Record loss reason`, due today
- `nurture`: `Nurture follow-up`, due in 14 days

Automation is triggered only by editor/owner pipeline saves.

## 9. Duplicate Prevention

Before inserting an automation task, the admin UI checks:

- loaded open tasks
- Supabase for an open task with the same `lead_id`, `title`, and `automation_source`

If a duplicate exists, no task is created and `automation_task_skipped_duplicate` is logged.

## 10. Tasks Tab Insights

Tasks tab now includes automation/reminder summary metrics:

- overdue tasks
- due today
- reminders sent
- reminder failures
- automation-created tasks
- tasks without due date

It also adds a filter for automation-created, manual, reminder sent, and reminder failed tasks.

## 11. Activity Timeline Integration

Added readable labels for:

- `task_reminder_sent`
- `task_reminder_failed`
- `automation_task_created`
- `automation_task_skipped_duplicate`
- `suggested_task_created`

Metadata is not rendered raw.

## 12. Permission Behavior

Frontend:

- viewer: read-only, cannot send reminders
- editor/owner: can send reminders and trigger automation through pipeline save

Edge Function:

- POST only
- requires Supabase user JWT
- verifies `admin_profiles.role` is `editor` or `owner`
- reads/writes task, lead, activity, and notification log server-side only

Database:

- anon has no access to task reminder data
- Phase 27 task RLS remains in force

## 13. Security Review

Ran:

- `git grep "RESEND_API_KEY"`
- `git grep "RESEND_WEBHOOK_SECRET"`
- `git grep "SUPABASE_SERVICE_ROLE_KEY"`
- `git grep "service_role"`
- `git grep "sb_secret"`
- `git grep "Authorization"`
- `git grep "innerHTML"`
- `git grep "javascript:"`

Also ran `rg` against new Phase 28 files because untracked files are not covered by `git grep`.

Findings:

- no actual secret values committed
- no service-role key in frontend
- no Resend API key in frontend
- new `RESEND_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` hits are server-side Edge Function env reads or setup docs
- reminders require authenticated editor/owner
- task title/description/assigned values are escaped in admin UI
- Edge Function email HTML escapes task and lead values
- activity/reminder labels are escaped
- metadata is not rendered raw
- viewer cannot send reminders
- public cannot access reminder data through RLS
- no new stored XSS risk identified

## 14. QA Results

Passed:

- `node --check admin/admin.js`
- `node --check js/script.js`
- `node --check js/content-registry.js`
- `git diff --check`

Edge Function TypeScript check:

- `deno check supabase/functions/task-reminder-notify/index.ts` was not run because Deno is not installed in this environment.

Manual Supabase QA was not run locally because the Phase 28 SQL patch was not applied here and the Edge Function was not deployed here.

## 15. Known Limitations

- no scheduled reminders
- no hourly/daily background jobs
- manual reminder email requires deploying `task-reminder-notify`
- automation runs only on admin pipeline saves, not direct database edits
- viewer permission QA requires a real viewer account

## 16. Temporary QA Files Status

No new temporary QA files were created.

## 17. Safe To Commit

Yes, safe to commit.

Before production use, run the Phase 28 SQL patch and deploy the Edge Function.

## 18. Phase 29 Safety

Phase 29 is safe to start after committing Phase 28, running the SQL patch, and deploying `task-reminder-notify`.

## 19. Recommended Phase 29 Title

Scheduled CRM Reminder Delivery and Automation Reliability
