# Admin Phase 27 CRM Tasks Report

## 1. Files Changed

- `admin/admin.js`
- `admin/admin.css`
- `supabase/phase-27-crm-tasks.sql`
- `supabase/phase-27-crm-tasks-setup.md`
- `ADMIN_PHASE_27_CRM_TASKS_REPORT.md`

## 2. SQL Needed Or Not

SQL is needed for persistence. The frontend handles a missing task table gracefully, but tasks cannot be saved until the Phase 27 SQL patch is applied.

## 3. SQL Patch Details

Created `supabase/phase-27-crm-tasks.sql`.

The patch is idempotent and non-destructive. It creates `public.cms_lead_tasks`, adds indexes, enables RLS, grants authenticated access through role policies, revokes anon access, and expands the Phase 26 `cms_lead_activity` activity type check to include task events when that table exists.

The patch does not alter `supabase/schema.sql` and does not drop existing data.

## 4. Task Table Details

Created `public.cms_lead_tasks` with:

- `id`
- `lead_id`
- `title`
- `description`
- `status`
- `priority`
- `assigned_to`
- `due_at`
- `completed_at`
- `completed_by`
- `created_by`
- `created_by_email`
- `updated_by`
- `updated_by_email`
- `metadata`
- `created_at`
- `updated_at`

Allowed statuses: `open`, `completed`, `cancelled`.

Allowed priorities: `low`, `normal`, `high`, `urgent`.

Indexes cover `lead_id`, `status`, `priority`, `due_at`, `created_at desc`, and `assigned_to`.

## 5. Leads Task Section Behavior

Expanded lead detail now includes `Tasks & Reminders` after pipeline fields and before the Activity Timeline.

It shows open tasks first, marks overdue/today/upcoming/no due date states, and groups completed/cancelled tasks in a compact collapsible section. Editors and owners see a create-task form. Viewers see read-only task content.

## 6. Task Actions

Implemented:

- `createLeadTask(leadId, form)`
- `updateLeadTask(taskId, fields)`
- `completeLeadTask(taskId)`
- `cancelLeadTask(taskId)`
- `reopenLeadTask(taskId)`

Successful changes update local dashboard state and re-render the admin UI. Missing `cms_lead_tasks` is handled with a clear Phase 27 SQL message instead of crashing.

## 7. Tasks Tab Behavior

Added a Dashboard `Tasks` tab with:

- summary cards for open, overdue, due today, upcoming, completed, and high/urgent tasks
- filters for status, priority, assigned owner, and due state
- global task rows with related lead context
- complete, reopen, and open-lead actions
- empty/error states

## 8. Pipeline Integration

Pipeline board lead cards now show a compact task strip when a lead has open tasks:

- open task count
- next open task due date
- overdue indicator when any open task is overdue

## 9. Overview Enhancement

Overview now includes small metrics for:

- Overdue tasks
- Tasks due today

If tasks are not loaded yet, the cards show `-` gracefully.

## 10. Activity Logging Behavior

Task actions attempt to insert `cms_lead_activity` rows:

- `task_created`
- `task_completed`
- `task_cancelled`
- `task_reopened`
- `task_updated`

Activity insert failures are non-blocking and do not revert the task action.

## 11. Permission Behavior

RLS:

- `anon`: no access
- authenticated viewer/editor/owner: `SELECT`
- authenticated editor/owner: `INSERT`
- authenticated editor/owner: `UPDATE`
- authenticated owner: `DELETE`

Frontend:

- viewers can read task UI only
- editors and owners can create/update/complete/cancel/reopen tasks
- no service-role key is used in frontend code

## 12. Security Review

Ran the requested greps:

- `git grep "RESEND_API_KEY"`
- `git grep "RESEND_WEBHOOK_SECRET"`
- `git grep "SUPABASE_SERVICE_ROLE_KEY"`
- `git grep "service_role"`
- `git grep "sb_secret"`
- `git grep "Authorization"`
- `git grep "innerHTML"`
- `git grep "javascript:"`

Findings:

- no actual secret values were added
- no service-role key was added to frontend code
- `service_role` and `sb_secret` frontend hits remain existing unsafe-key rejection guards
- `Authorization` hits remain existing Edge Function/header handling and docs
- `javascript:` hits remain existing URL guard/block code
- task title, description, owner, due date, status, priority, and lead values are escaped before rendering
- task metadata is not rendered raw
- public users cannot read/write tasks through RLS
- no new stored XSS vector was identified

Also ran `rg` against the new Phase 27 files because untracked files are not covered by `git grep`.

## 13. QA Results

Code QA passed:

- `node --check admin/admin.js`
- `node --check js/script.js`
- `node --check js/content-registry.js`
- `git diff --check`

Local manual Supabase persistence QA was not run because the Phase 27 SQL patch has not been applied in this local session and no real admin test account/session was exercised here. The UI handles missing SQL with a clear non-crashing message.

## 14. Known Limitations

- no push notifications in Phase 27
- no email reminders in Phase 27
- no external CRM/task tool integration
- direct database edits to tasks do not create activity rows
- viewer-mode QA still needs a real viewer account
- full persistence QA requires running the SQL patch in Supabase first

## 15. Temporary QA Files Status

No new temporary QA files were created for Phase 27.

Existing tracked `output/playwright/*.png` screenshots were already present and were not modified.

## 16. Safe To Commit

Yes, safe to commit the Phase 27 code and SQL patch.

Production use requires running `supabase/phase-27-crm-tasks.sql` in Supabase after Phase 26.

## 17. Exact Commit Command

```powershell
git add admin/admin.js admin/admin.css supabase/phase-27-crm-tasks.sql supabase/phase-27-crm-tasks-setup.md ADMIN_PHASE_27_CRM_TASKS_REPORT.md; git commit -m "Add CRM lead task reminders"
```

## 18. Phase 28 Safety

Phase 28 is safe to start after committing Phase 27 and applying the Phase 27 SQL patch in Supabase.

## 19. Recommended Phase 28 Title

CRM Reminder Notifications and Task Automation Rules
