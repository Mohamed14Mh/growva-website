# Admin Phase 25: Lead Pipeline Workflow and Follow-up Tracking

## Files Changed

- `admin/admin.js`
- `admin/admin.css`
- `supabase/phase-25-lead-pipeline.sql`
- `supabase/phase-25-lead-pipeline-setup.md`
- `ADMIN_PHASE_25_LEAD_PIPELINE_REPORT.md`

## SQL Needed

Yes. Phase 25 adds a non-destructive SQL patch:

- `supabase/phase-25-lead-pipeline.sql`

The SQL must be run in the Supabase SQL Editor before pipeline values can persist.

## SQL Patch Details

The patch adds CRM pipeline fields to `cms_contact_submissions` without
recreating or dropping the table. It preserves existing rows, backfills defaults
for existing leads, adds check constraints for stage/priority, and adds indexes
for pipeline filtering.

The public anon insert policy is recreated so public contact-form submissions
cannot set internal CRM fields. Existing authenticated admin SELECT/UPDATE RLS
behavior is preserved.

## Pipeline Fields Added

- `pipeline_stage`
- `priority`
- `assigned_to`
- `follow_up_at`
- `last_contacted_at`
- `outcome`
- `next_action`
- `internal_notes`
- `pipeline_updated_at`

Allowed stages: `new`, `contacted`, `qualified`, `proposal`, `won`, `lost`,
`nurture`.

Allowed priorities: `low`, `normal`, `high`, `urgent`.

## Leads Tab Pipeline Behavior

Expanded lead details now include a compact Pipeline section with:

- stage dropdown
- priority dropdown
- assigned owner input
- follow-up datetime input
- last contacted datetime input
- outcome input
- next action textarea
- internal notes textarea
- Save Pipeline button

The save action sends only pipeline fields and `pipeline_updated_at`. It does not
overwrite contact info, attribution fields, notification fields, status, or
archive state. Saved values update `leadsData` locally after Supabase confirms
the update.

## Filters Added

The Leads tab keeps the existing All/New/Read/Archived filters and adds compact
pipeline filters for:

- stage
- priority
- assigned owner text search
- overdue follow-up
- due today
- upcoming follow-up
- unassigned leads

Filters are applied with the `Apply` button and cleared with `Reset`.

## Follow-up Indicators

Lead rows now show compact badges for:

- pipeline stage
- priority
- follow-up state: overdue, today, upcoming, or no follow-up

Rows also show assigned owner and a short next-action preview when present.

## Summary Behavior

The Leads tab now includes a compact pipeline summary showing:

- counts by stage
- counts by priority
- overdue follow-up count
- due today count
- upcoming follow-up count
- unassigned lead count

Simple CSS bars are used for stage and priority counts. No external chart
library was added.

## Permission Behavior

- Public visitors: can submit the contact form, but the SQL policy prevents them
  from setting internal pipeline fields.
- Viewer admins: can read pipeline fields in disabled/read-only mode.
- Editor admins: can update pipeline fields through Save Pipeline.
- Owner admins: can update pipeline fields and retain existing owner/admin
  behaviors.

Existing Phase 19 RLS has a broad editor/owner UPDATE policy for admin lead
operations. Phase 25 documents and preserves it to avoid breaking Mark Read/New,
Archive/Unarchive, Retry Notification, and existing Leads tab actions. The admin
UI sends only pipeline fields for Save Pipeline.

## Security Review

- No secrets were added.
- No service-role key was added to frontend code.
- No external CRM or tracking tools were added.
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`
  grep hits are existing Edge Function environment variable references or docs.
- `service_role` and `sb_secret` hits remain existing unsafe-key rejection guards
  and prior docs.
- `Authorization` hits are existing Edge Function request/header handling or docs.
- `javascript:` hits remain existing URL guard/block code.
- `innerHTML` hits are existing admin/public render surfaces; Phase 25 pipeline,
  next action, outcome, owner, and internal notes values are escaped before
  rendering.
- Viewer mode disables pipeline inputs and hides the save action.
- Public anon inserts are constrained by RLS to default/null internal pipeline
  values.

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
- Additional working-tree `rg` scan completed so new untracked Phase 25 SQL/docs
  were included in the review.

Manual Supabase persistence QA was not run in this local session because it
requires applying the SQL patch in Supabase and signing in with admin accounts.

## Manual QA Still Needed

After applying `supabase/phase-25-lead-pipeline.sql`:

- Open Admin Dashboard -> Leads.
- Expand a lead.
- Update stage, priority, follow-up date, next action, and internal notes.
- Save Pipeline.
- Refresh and confirm values persist.
- Test pipeline filters.
- Confirm viewer account read-only behavior if a viewer account is available.
- Confirm contact form submission, notification logs, Lead Insights, Notification
  Analytics, admin entry/login, and stale auth handling still work.

## Known Limitations

- The optional standalone Pipeline dashboard tab was not added in Phase 25 to
  keep the change scoped; the pipeline workflow lives inside the Leads tab.
- Field-level UPDATE restriction is enforced by the UI payload while existing
  broad editor/owner RLS remains in place for compatibility.
- Historical leads get default `new`/`normal` pipeline values when the SQL patch
  runs.
- Manual role/persistence testing requires a Supabase project with the patch
  applied.

## Temporary QA Files Status

No temporary QA files were added.

## Safe To Commit

Yes, after reviewing and applying the SQL patch requirement.

Exact commit command:

```bash
git add admin/admin.js admin/admin.css supabase/phase-25-lead-pipeline.sql supabase/phase-25-lead-pipeline-setup.md ADMIN_PHASE_25_LEAD_PIPELINE_REPORT.md && git commit -m "Add lead pipeline workflow"
```

## Phase 26

Phase 26 is safe to start after Phase 25 SQL is applied and manual Supabase QA is
complete.

Recommended Phase 26 title: Pipeline Board and CRM Activity Timeline.
