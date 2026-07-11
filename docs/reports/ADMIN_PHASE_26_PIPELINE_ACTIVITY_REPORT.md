# Admin Phase 26: Pipeline Board and CRM Activity Timeline

## Files Changed

- `admin/admin.js`
- `admin/admin.css`
- `supabase/phase-26-pipeline-activity.sql`
- `supabase/phase-26-pipeline-activity-setup.md`
- `ADMIN_PHASE_26_PIPELINE_ACTIVITY_REPORT.md`

## SQL Needed

Yes. Phase 26 adds a new idempotent SQL patch:

- `supabase/phase-26-pipeline-activity.sql`

The SQL must be run in Supabase before activity timeline rows can persist.

## SQL Patch Details

The patch creates `public.cms_lead_activity` and does not alter
`supabase/schema.sql`. Existing lead/contact rows are not dropped or modified.

Indexes are added for:

- `lead_id`
- `created_at desc`
- `activity_type`
- `actor_id` when present

## Activity Table Details

`cms_lead_activity` stores:

- lead reference
- actor id/email
- activity type
- changed field
- old value
- new value
- note
- metadata JSON
- created timestamp

Supported activity types:

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

## Pipeline Tab Behavior

Added a new Admin Dashboard tab: `Pipeline`.

It renders board-style columns grouped by pipeline stage:

- New
- Contacted
- Qualified
- Proposal
- Won
- Lost
- Nurture

Each card shows the lead name/email, stage/priority/follow-up badges, assigned
owner, project type, source, created date, and next action preview when present.

Cards use `Open in Leads` to switch to the Leads tab and expand that lead. No
drag-and-drop library or drag behavior was added.

## Board Filters

The Pipeline tab includes filters for:

- priority
- assigned owner search
- overdue follow-ups
- due today
- upcoming follow-ups
- unassigned leads
- show archived toggle

Archived leads are hidden by default.

## Pipeline Summary

The Pipeline tab top area shows summary cards for:

- active leads
- overdue follow-ups
- due today
- high/urgent priority
- unassigned
- won
- lost

No external chart library was added.

## Activity Logging Behavior

Save Pipeline compares the previous lead values with the new payload after the
Supabase update succeeds. It creates activity rows for changed fields:

- stage
- priority
- assigned owner
- follow-up date
- last contacted date
- outcome
- next action
- internal notes

Mark Read, Mark New, Archive, and Unarchive now also insert activity rows after
their existing lead updates succeed.

If activity insert fails, the lead update is not reverted. The UI treats this as
a non-blocking activity-log unavailable state.

## Lead Detail Timeline Behavior

Expanded lead detail now includes `Activity Timeline`.

It shows the latest activity rows for that lead:

- timestamp
- activity label
- actor email
- field name
- old/new value chips
- note when present

If the Phase 26 SQL patch has not been applied, the timeline displays a compact
unavailable note and the Leads tab continues to work.

## Permission Behavior

RLS for `cms_lead_activity`:

- `anon`: no access
- authenticated viewer/editor/owner: `SELECT`
- authenticated editor/owner: `INSERT`
- no UI update/delete policy

Viewer admins cannot save pipeline fields and therefore cannot create activity.
Editor/owner admins can save pipeline fields and create activity rows.

## Security Review

- No secrets were added.
- No service-role key was added to frontend code.
- No external CRM, third-party tracking, or drag-and-drop library was added.
- Activity values are escaped before rendering.
- `old_value`, `new_value`, `note`, and metadata are not rendered raw.
- Metadata is stored but not rendered directly.
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`
  grep hits are existing Edge Function environment references or docs.
- `service_role` and `sb_secret` hits remain existing unsafe-key rejection guards
  and prior docs.
- `Authorization` hits are existing Edge Function request/header handling or docs.
- `innerHTML` hits are existing admin/public render surfaces; new activity and
  board values are escaped before insertion.
- `javascript:` hits remain existing URL guard/block code.

## QA Results

Completed local validation:

- `git status --short` before implementation: clean
- `git diff --stat` before implementation: clean
- `node --check admin/admin.js`: passed
- `node --check js/script.js`: passed
- `node --check js/content-registry.js`: passed
- `git diff --check`: passed with existing CRLF normalization warnings for
  `admin/admin.js` and `admin/admin.css`
- Requested security greps completed:
  `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `service_role`, `sb_secret`, `Authorization`, `innerHTML`, `javascript:`
- Additional working-tree `rg` scan completed so new untracked Phase 26 SQL/docs
  were included in the review.

Manual Supabase persistence QA was not run in this local session because it
requires applying the SQL patch in Supabase and signing in with admin accounts.

## Manual QA Still Needed

After applying `supabase/phase-26-pipeline-activity.sql`:

- Open Admin Dashboard -> Pipeline.
- Confirm columns render.
- Test priority/owner/follow-up/archive filters.
- Open a lead from the Pipeline board.
- Update a pipeline field in Leads.
- Save Pipeline.
- Confirm Activity Timeline shows the change.
- Refresh and confirm activity persists.
- Confirm Leads, Lead Insights, Notification Analytics, admin entry, and contact
  form flows still work.
- Confirm viewer account can read activity but cannot save/create activity if a
  viewer account is available.

## Known Limitations

- Activity logging is frontend-triggered. Direct database edits outside the admin
  UI will not create timeline rows.
- Missing Phase 26 SQL does not block pipeline saves; it only disables timeline
  persistence and shows an unavailable note.
- No drag-and-drop board movement was added in Phase 26.
- Board quick stage changes were not added to avoid expanding the action surface.

## Temporary QA Files Status

No temporary QA files were added.

## Safe To Commit

Yes, after reviewing and applying the SQL patch requirement.

Exact commit command:

```bash
git add admin/admin.js admin/admin.css supabase/phase-26-pipeline-activity.sql supabase/phase-26-pipeline-activity-setup.md ADMIN_PHASE_26_PIPELINE_ACTIVITY_REPORT.md && git commit -m "Add pipeline board and lead activity timeline"
```

## Phase 27

Phase 27 is safe to start after Phase 26 SQL is applied and manual Supabase QA is
complete.

Recommended Phase 27 title: CRM Task Automation and Pipeline Reminders.
