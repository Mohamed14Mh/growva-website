# Phase 24: Lead Attribution Setup

Phase 24 adds first-party lead attribution and Admin Dashboard reporting.

## SQL

Run this patch in Supabase SQL Editor:

```sql
supabase/phase-24-lead-attribution.sql
```

It adds nullable attribution columns to `cms_contact_submissions`:

- `landing_page`
- `referrer`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `attribution_json`

The patch is idempotent and does not drop or rewrite existing leads. Existing
RLS policies remain in place: public visitors can insert only; authenticated
admin roles can select.

## Fields Captured

The public contact form captures:

- current page path plus query string
- session landing page
- `document.referrer`
- UTM parameters from the current URL
- source, using `utm_source`, then referrer host, then `direct`
- existing user agent field, unchanged from Phase 19

No IP address is collected manually. No fingerprinting or third-party analytics
script was added.

## Backward Compatibility

If the SQL patch has not been applied yet, the form retries with the old Phase 19
insert shape only when Supabase reports missing-column/schema-cache errors.

## Test With UTM URL

Open:

```text
/contact.html?utm_source=instagram&utm_medium=social&utm_campaign=test_campaign
```

Submit a test lead, then verify:

```sql
SELECT name, source, page_path, landing_page, referrer,
       utm_source, utm_medium, utm_campaign, created_at
FROM public.cms_contact_submissions
ORDER BY created_at DESC
LIMIT 10;
```

Expected:

- `source = instagram`
- `utm_source = instagram`
- `utm_medium = social`
- `utm_campaign = test_campaign`
- `page_path` includes the query string

## Dashboard Verification

1. Log in to Admin Mode.
2. Open `CMS Dashboard`.
3. Open `Leads`, expand a lead, and review the Attribution section.
4. Open `Lead Insights`.
5. Confirm totals, top sources, top pages, project types, and campaign rows.
6. Click `Refresh Leads`.

## Query Limits

The dashboard reads the latest 500 lead rows ordered by `created_at DESC` and
computes insights client-side. This is intended for operational reporting, not a
long-term analytics warehouse.

## Known Limitations

- Attribution starts from the first page remembered in `sessionStorage`.
- Visitors with strict privacy settings may block `sessionStorage`; in that case
  landing page falls back to the current contact page.
- Historical leads submitted before Phase 24 will not have the new attribution
  columns populated.
