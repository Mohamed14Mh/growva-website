# ADMIN PHASE 4 DASHBOARD REPORT

Date: 2026-07-02

## Scope

Phase 4 adds a premium CMS Dashboard inside the existing static Admin Mode. This is a UX and admin workflow layer only.

No Supabase schema, RLS policy, data file, media upload, section builder, global publish, React/Vite/Next build step, or public-site redesign was added.

## Files Changed

- `admin/admin.js`
- `admin/admin.css`
- `ADMIN_PHASE_4_DASHBOARD_REPORT.md`

## Dashboard Added

Added a `CMS Dashboard` button to the existing admin top bar.

Added an isolated admin overlay with:

- Overview
- Current Page Drafts
- Published Content
- Revision/Audit Log
- Role & Session
- System Health

The dashboard is rendered under the existing admin root with `data-admin-ui="true"` and `data-lenis-prevent` so public cursor, page-transition, magnetic, and smooth-scroll interactions do not treat it as normal site content.

## Draft And Published Content UX

Current page drafts now show row-level actions:

- Focus
- Apply
- Inspector
- Delete Draft

Published content rows now show:

- Focus
- Compare
- Copy

All row actions are scoped to the current page path.

## Publish Flow

The old direct publish confirmation was replaced by a safer publish review modal.

Before publishing, owners now see:

- Current page path
- Draft count
- Current-page-only scope warning
- A compact list of draft rows to be published

Publishing still uses the existing current-page `cms_content` upsert flow and remains owner-only. A best-effort `cms_publish_log` insert and `cms_audit_log` `publish_page` entry were added after successful publish.

## Unsaved Inspector Protection

The inspector now tracks dirty state after field edits.

Warnings were added for:

- Closing the inspector with unsaved changes
- Switching from Edit Mode to Preview Mode with unsaved changes
- Exiting Admin Mode with unsaved changes

Canceling the warning now preserves Edit Mode and the current selected field.

## CMS Debug Extension

`?cmsDebug=true` now includes dashboard state in the debug payload:

- `dashboard_open`
- `dashboard_tab`
- `dashboard_draft_rows`
- `dashboard_published_rows`
- `dashboard_audit_rows`
- `health_check_result`

## Admin UI Isolation

Dashboard and publish-confirm UI use admin-only selectors and attributes:

- `.gv-admin-dashboard`
- `.gv-admin-confirm`
- `data-admin-ui="true"`
- `data-admin-action`
- `data-lenis-prevent`

The new controls route through the existing admin click handler, which prevents default navigation and stops propagation for admin actions.

## Responsive Behavior

The dashboard uses a fixed overlay shell on desktop and collapses to a single-column, viewport-bounded layout on mobile.

Row action groups stack cleanly on small screens, and the publish modal actions become full-width touch targets.

## Validation Results

Passed:

- `node --check admin/admin.js`
- `node --check js/script.js`
- `node --check js/content-registry.js`
- Local browser validation on `http://127.0.0.1:4173/index.html?cmsDebug=true`
- Visitor mode starts outside Admin Mode
- Supabase-authenticated owner path exercised with a local fake Supabase client
- Admin login opens existing Admin Mode
- Edit Mode selects editable content
- Unsaved inspector warning appears
- Canceling the warning keeps Edit Mode active
- Save Draft remains clickable and saves through the existing draft path
- CMS Dashboard opens
- Overview tab renders metrics
- Current Page Drafts tab renders draft rows
- Published Content tab renders published rows
- Revision/Audit Log tab renders existing audit rows
- Role & Session tab renders owner role/session details
- System Health tab runs a health check
- Publish button opens the safer review modal
- Publish Current Page completes and records `publish_page` audit data
- Dashboard remains usable at mobile width
- Exit Admin returns the page to visitor mode
- No console errors during the browser validation flow

## Not Included In Phase 4

Per the phase constraints, this pass does not include:

- Image upload
- Media library
- Section builder
- Full JSON page rendering
- Global publish across all pages
- Supabase schema or RLS changes
- Public visitor-mode redesign
