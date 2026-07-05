# Admin Phase 24: Lead Attribution Report

## Files Changed

- `js/script.js`
- `admin/admin.js`
- `admin/admin.css`
- `supabase/phase-24-lead-attribution.sql`
- `supabase/phase-24-lead-attribution-setup.md`
- `ADMIN_PHASE_24_LEAD_ATTRIBUTION_REPORT.md`

## SQL Needed

Yes. Phase 24 adds a non-destructive SQL patch:

- `supabase/phase-24-lead-attribution.sql`

## SQL Patch Details

The patch adds nullable attribution fields to `cms_contact_submissions`:

- `landing_page`
- `referrer`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `attribution_json`

It also adds indexes for source, page path, project type, and UTM campaign.
RLS policies are preserved.

## Attribution Capture Behavior

The public contact form captures first-party attribution only:

- current path plus query string
- session landing page
- document referrer
- UTM parameters
- source derived from UTM source, referrer host, or `direct`

No third-party tracking scripts, manual IP collection, or fingerprinting were
added.

If the SQL patch is not applied yet, the form falls back to the old Phase 19
insert payload only for missing-column/schema-cache errors.

## Leads Tab Attribution Behavior

Expanded lead details now include a compact Attribution section with:

- Source
- Landing page
- Page path
- Referrer
- UTM source / medium / campaign
- UTM term / content

Missing values show `Not captured`.

## Lead Insights Tab Behavior

Added a `Lead Insights` dashboard tab with:

- refresh button
- total/new/archived/recent lead metrics
- top source
- top page
- top project type
- top campaign
- lightweight bar rows for top sources, pages, project types, and campaigns
- leads over time summary

## Metrics Implemented

- Total leads
- New leads
- Archived leads
- Leads last 7 days
- Leads last 30 days
- Top source
- Top page
- Top project type
- Top campaign
- Last 24 hours / 7 days / 30 days activity

## Overview Enhancement

The Overview tab now includes:

- Leads last 7 days
- Top source

These show `-` when leads have not loaded yet.

## Privacy / Security Review

- No secrets were added.
- No service-role key was added to frontend code.
- No external analytics or third-party tracking script was added.
- Attribution values are escaped before rendering in the admin UI.
- Raw `attribution_json` is not rendered directly.
- Public visitors still have INSERT-only access through existing RLS.
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`
  grep hits are existing Edge Function environment references or documentation
  placeholders only.
- `service_role` and `sb_secret` hits remain existing unsafe-key rejection guards
  and prior reports/docs.
- `innerHTML` hits are existing admin/public render surfaces; Phase 24
  attribution values pass through `escapeHtml()`.
- `javascript:` hits remain existing URL guard/block code.

## QA Results

Completed local validation:

- `node --check admin/admin.js` - passed
- `node --check js/script.js` - passed
- `node --check js/content-registry.js` - passed
- `git diff --check` - passed, with existing CRLF normalization warnings for
  `admin/admin.js`, `admin/admin.css`, and `js/script.js`
- Requested security greps completed:
  `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
  `service_role`, `sb_secret`, `Authorization`, `innerHTML`, `javascript:`

Manual QA requires applying the SQL patch and submitting a test lead with UTM
parameters.

## Known Limitations

- Insights are based on the latest 500 lead rows.
- Historical leads do not have Phase 24 attribution fields populated.
- `sessionStorage` may be unavailable in strict privacy modes.
- This is operational reporting, not a full analytics warehouse.

## Temporary QA Files

No temporary QA files were added.

## Safe To Commit

Yes, after reviewing the SQL patch requirement.

## Phase 25

Phase 25 can start after SQL patch application and manual UTM submission QA.

Recommended Phase 25 title: Lead Pipeline Workflow and Follow-up Tracking.
