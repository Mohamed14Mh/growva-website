# Phase 26 Pipeline Activity Setup

## SQL Patch

Run this file in the Supabase SQL Editor after Phase 25:

```sql
supabase/phase-26-pipeline-activity.sql
```

The patch is idempotent and non-destructive. It creates a new activity table and
does not alter `supabase/schema.sql` or existing lead rows.

## Table Created

`public.cms_lead_activity`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `lead_id uuid references public.cms_contact_submissions(id) on delete cascade`
- `actor_id uuid`
- `actor_email text`
- `activity_type text`
- `field_name text`
- `old_value text`
- `new_value text`
- `note text`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`

Indexes:

- `lead_id`
- `created_at desc`
- `activity_type`
- `actor_id` when present

## RLS Behavior

- `anon`: no access.
- authenticated viewer/editor/owner: `SELECT`.
- authenticated editor/owner: `INSERT`.
- no UI update/delete policy is added.

The patch uses the existing `public.current_admin_role()` helper and does not
reference `cms_admin_profiles`.

## Activity Types

- `pipeline_updated`
- `stage_changed`
- `priority_changed`
- `assigned_to_changed`
- `follow_up_changed`
- `last_contacted_changed`
- `outcome_changed`
- `next_action_changed`
- `internal_note_added`
- `archived`
- `unarchived`
- `marked_read`
- `marked_new`

## How Activity Logging Works

When an editor or owner saves pipeline fields, the admin UI compares the previous
lead values with the new payload after the Supabase update succeeds. Changed
important fields create activity rows with:

- `actor_id`
- `actor_email`
- activity type
- field name
- old value
- new value
- note for internal note changes

Mark Read, Mark New, Archive, and Unarchive also create activity rows after the
existing lead update succeeds.

If activity insert fails because the SQL patch has not been applied yet, the
pipeline update remains saved and the UI shows a non-blocking unavailable state.

## Pipeline Tab

The Admin Dashboard now includes a `Pipeline` tab. It shows:

- summary cards for active leads, overdue, due today, high/urgent, unassigned,
  won, and lost
- board columns grouped by pipeline stage
- compact lead cards with priority, follow-up state, owner, project type, source,
  and next action
- an `Open in Leads` action that switches to the Leads tab and expands the lead

There is no drag-and-drop in Phase 26.

## Board Filters

The Pipeline tab supports:

- priority filter
- owner search
- overdue follow-up
- due today
- upcoming follow-up
- unassigned
- show archived toggle

Archived leads are hidden by default.

## Lead Timeline

Expanded Leads tab details now include `Activity Timeline`. It shows:

- timestamp
- activity label
- actor email
- field name
- old/new value chips
- note when present

All values are escaped before rendering.

## Testing

1. Run `supabase/phase-26-pipeline-activity.sql`.
2. Sign in as an editor or owner.
3. Open Admin Dashboard -> Pipeline and confirm columns render.
4. Open a board card with `Open in Leads`.
5. Update stage, priority, follow-up, next action, or internal notes.
6. Save Pipeline.
7. Confirm the Activity Timeline shows the change.
8. Refresh and confirm activity persists.
9. Test board filters.
10. Confirm viewer account can read but cannot save or insert activity.

## Known Limitations

- Activity logging is frontend-triggered in Phase 26. Direct database edits made
  outside the admin UI will not create timeline rows.
- Missing activity SQL does not block pipeline saves; it only disables timeline
  persistence until the patch is applied.
- No drag-and-drop board movement is included in this phase.
