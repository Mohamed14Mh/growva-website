# Phase 27 CRM Tasks Setup

## SQL Patch

Run this file in the Supabase SQL Editor after Phase 26:

```sql
supabase/phase-27-crm-tasks.sql
```

The patch is idempotent and non-destructive. It creates a task/reminder table,
adds indexes and RLS policies, and expands `cms_lead_activity` activity types for
task events when the Phase 26 activity table exists.

## Table Created

`public.cms_lead_tasks`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `lead_id uuid references public.cms_contact_submissions(id) on delete cascade`
- `title text not null`
- `description text`
- `status text default 'open'`
- `priority text default 'normal'`
- `assigned_to text`
- `due_at timestamptz`
- `completed_at timestamptz`
- `completed_by uuid`
- `created_by uuid`
- `created_by_email text`
- `updated_by uuid`
- `updated_by_email text`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `lead_id`
- `status`
- `priority`
- `due_at`
- `created_at desc`
- `assigned_to`

## RLS Behavior

- `anon`: no access.
- authenticated viewer/editor/owner: `SELECT`.
- authenticated editor/owner: `INSERT`.
- authenticated editor/owner: `UPDATE`.
- authenticated owner: `DELETE`.

The patch uses `public.current_admin_role()` and does not reference
`cms_admin_profiles`.

## Task Statuses And Priorities

Allowed statuses:

- `open`
- `completed`
- `cancelled`

Allowed priorities:

- `low`
- `normal`
- `high`
- `urgent`

## Tasks Tab

The Admin Dashboard `Tasks` tab shows:

- open task count
- overdue count
- due today count
- upcoming count
- completed count
- high/urgent count
- status, priority, owner, and due-date filters
- global task rows with related lead information
- complete, reopen, and open-lead actions

## Lead Task Section

Expanded lead detail now includes `Tasks & Reminders`.

Editors and owners can create tasks with:

- title
- description
- priority
- assigned owner
- due date/time

Open tasks are shown first. Completed and cancelled tasks are grouped into a
compact collapsible section. Viewers can read tasks but cannot create or update
them.

## Activity Logging

Task actions create `cms_lead_activity` rows when the Phase 26 activity table is
available:

- `task_created`
- `task_completed`
- `task_cancelled`
- `task_reopened`
- `task_updated`

If activity logging fails, the task action is not reverted.

## Testing Overdue / Today / Upcoming

1. Create a task due yesterday and confirm it appears as overdue.
2. Create a task due today and confirm it appears as due today.
3. Create a task due tomorrow or later and confirm it appears as upcoming.
4. Complete and reopen a task.
5. Confirm the Tasks tab filters match the expected groups.
6. Confirm Pipeline cards show open task count and overdue task indicator.

## Known Limitations

- No push notifications or email reminders are sent in Phase 27.
- Task activity logging is frontend-triggered; direct database edits will not
  create activity rows.
- Missing Phase 27 SQL disables task persistence but does not break Leads or
  Pipeline tabs.
- Viewer role behavior requires a viewer account to test manually.
