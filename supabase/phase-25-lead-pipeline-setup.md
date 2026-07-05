# Phase 25 Lead Pipeline Setup

## SQL Patch

Run this file in the Supabase SQL Editor after Phase 19 and Phase 24:

```sql
supabase/phase-25-lead-pipeline.sql
```

The patch is idempotent and non-destructive. It does not recreate
`cms_contact_submissions`, does not drop data, and does not modify
`supabase/schema.sql`.

## Fields Added

The patch adds these lightweight CRM fields to `cms_contact_submissions`:

- `pipeline_stage text default 'new'`
- `priority text default 'normal'`
- `assigned_to text`
- `follow_up_at timestamptz`
- `last_contacted_at timestamptz`
- `outcome text`
- `next_action text`
- `internal_notes text`
- `pipeline_updated_at timestamptz default now()`

Allowed `pipeline_stage` values:

- `new`
- `contacted`
- `qualified`
- `proposal`
- `won`
- `lost`
- `nurture`

Allowed `priority` values:

- `low`
- `normal`
- `high`
- `urgent`

## RLS Behavior

Existing Phase 19 RLS is preserved:

- Public `anon` visitors can insert contact submissions.
- Authenticated admin viewer/editor/owner roles can select leads.
- Authenticated editor/owner roles can update leads through the existing admin update policy.
- The existing broad admin update policy is not narrowed in this patch to avoid breaking Mark Read/New, Archive/Unarchive, Retry Notification, and existing Leads tab behavior.

Phase 25 hardens the public insert policy so anonymous visitors cannot set
internal CRM fields. Public inserts must keep:

- `pipeline_stage = 'new'`
- `priority = 'normal'`
- `assigned_to`, `follow_up_at`, `last_contacted_at`, `outcome`, `next_action`, and `internal_notes` as `NULL`

The frontend never exposes service-role keys and only sends pipeline fields from
the Save Pipeline action.

## Using The Pipeline Workflow

1. Sign in to the admin dashboard.
2. Open the `Leads` tab.
3. Expand a lead.
4. Use the `Pipeline` section to set stage, priority, owner, follow-up date,
   last contacted date, outcome, next action, and internal notes.
5. Click `Save Pipeline`.

Viewer users see the pipeline fields in read-only mode. Editor and owner users
can save pipeline changes.

## Testing Follow-up Filters

In the Leads tab:

1. Set one lead's follow-up date to yesterday and save.
2. Set one lead's follow-up date to today and save.
3. Set one lead's follow-up date to a future date and save.
4. Use the Follow-up filter:
   - `Overdue`
   - `Due today`
   - `Upcoming`
   - `Unassigned`
5. Combine with Stage, Priority, and Owner filters to confirm results narrow
   correctly.

## Known Limitations

- Phase 25 keeps the pipeline inside the existing Leads tab. A separate Pipeline
  board is recommended for Phase 26.
- Admin UPDATE authorization still uses the existing broad editor/owner RLS
  policy from Phase 19; field-level update restriction is enforced by the admin
  UI payload.
- Historical leads receive default `pipeline_stage`, `priority`, and
  `pipeline_updated_at` values when the SQL patch is run.
- Manual persistence QA requires applying the SQL patch in Supabase.
