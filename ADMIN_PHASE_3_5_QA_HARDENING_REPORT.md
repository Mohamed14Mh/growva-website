# Admin Phase 3.5 QA Hardening Report

## Files Changed

- `admin/admin.js`
- `ADMIN_PHASE_3_5_QA_HARDENING_REPORT.md`

No Supabase schema, data files, visual redesign, image upload, section builder, dashboard, revision UI, global publish, React, Vite, or Next.js work was added.

## Key Safety Audit Result

Searched the project for:

- `sb_secret_`
- `service_role`
- `SUPABASE_SERVICE_ROLE`
- `secretKey`
- `service key`

No client-side Supabase secret or service-role key was found.

The current `admin/supabase-config.js` uses a Supabase `sb_publishable_...` key, not a secret key. This is appropriate for browser use only when Supabase RLS policies remain strict.

Phase 3.5 added a runtime guard that disables Supabase initialization when the configured key:

- starts with `sb_secret_`
- contains service-role wording
- is a legacy JWT whose decoded role is `service_role` or `supabase_admin`

When unsafe, the Admin modal shows:

`Unsafe Supabase key detected. Use publishable/anon key only.`

Login and database writes are disabled in that state.

## Page Path Normalization Result

The CMS page path logic was hardened to continue returning normalized relative paths, not full URLs.

Validated targets include:

- `index.html`
- `services.html`
- `work.html`
- nested service pages
- nested work category pages
- nested work project pages such as `work/shopify-stores/noor-perfumery.html`
- localhost/Live Server style URLs
- GitHub Pages subpath deployments via script-root detection
- `file://` paths without blocking the site

If the site is opened through `file://`, Admin UI now shows a non-blocking warning:

`For best CMS behavior, use Live Server or a deployed URL.`

## Supabase Status Behavior

Admin status now resolves to one of the expected minimal states:

- `Supabase connected - owner`
- `Supabase connected - editor`
- `Supabase connected - viewer`
- `Supabase not configured`
- `Unsafe key detected`
- `Supabase connection failed`
- `Logged out`

The top bar uses this state, and the inspector also displays current connection status.

## Role Behavior

- Owner: can save drafts, reset drafts, and publish the current page.
- Editor: can save/reset drafts, but publish is denied with a clear message.
- Viewer: can inspect fields, but save/reset/publish are denied with clear messages.
- Logged out: cannot enter real Admin Mode.
- Unsafe key: cannot initialize Supabase or log in.

RLS remains the source of truth; client-side role checks are UX hardening only.

## Save / Publish / Reset Hardening

Added:

- double-click/in-flight guards for Save Draft, Reset Field, and Publish
- disabled button states during active operations
- clearer success and failure messages
- catch blocks for Supabase Auth/query/mutation failures
- fail-closed behavior for session lookup errors
- best-effort audit/publish-log writes so a log failure does not corrupt content state
- publish confirmation now says it publishes this page only
- reset continues to delete draft rows only, never published rows

## Published Load Safety

Public published-content loading remains separate from Admin Mode.

Behavior:

- skips silently when Supabase is missing or not configured
- loads only `cms_content` rows for the current normalized `page_path`
- applies only matching `[data-edit-key]` elements
- skips missing DOM fields safely
- uses `textContent` for user-entered text
- does not inject arbitrary HTML
- applies `href` only from trusted `value_json.href` values that are internal or `https://`

## Debug Mode

Append:

```text
?cmsDebug=true
```

When enabled, the console logs:

- normalized `page_path`
- page id
- editable field count
- Supabase configured yes/no
- unsafe key detected yes/no
- connection status
- current role
- published rows loaded count
- draft rows loaded count
- whether the page is opened through `file://`

Without `?cmsDebug=true`, the CMS stays quiet in normal visitor mode.

## GitHub Pages Readiness

HTML script paths were not changed in this phase. The existing relative script loading remains valid for:

- root pages
- `services/*` pages
- `work/*` pages
- `work/*/*` project pages
- GitHub Pages project subpaths

## RLS / Policy Manual Test Checklist

Use the Supabase SQL editor and dashboard to verify:

1. Public logged-out visitor can `select` only `cms_content` rows where `status = 'published'`.
2. Logged-out visitor cannot insert/update/delete draft rows.
3. Viewer can sign in and read admin content but cannot insert/update/delete drafts.
4. Editor can insert/update/delete draft rows.
5. Editor cannot insert/update published rows.
6. Owner can publish by upserting `status = 'published'` rows.
7. Owner can read publish/audit logs.
8. No service-role or secret key exists in any client-side file.

No schema changes were made. No obvious Phase 3.5 schema rewrite was required from this audit.

## Validation Completed

- `node --check admin/admin.js`
- `node --check js/script.js`
- `node --check js/content-registry.js`
- 54/54 HTML pages verified with Supabase CDN, config, and admin script in the correct order.
- Key scan found no actual secret/service-role key in client-side config.
- Browser QA with Supabase stub passed:
  - normal visitor published load
  - `?cmsDebug=true` debug log
  - owner login
  - edit mode
  - save draft
  - double-click save guard
  - publish current page only
  - reset draft only
  - logout
  - public visitor reload sees published content
  - editor publish denied
  - viewer save denied
  - nested project page path/content load
  - unsafe key warning and login disable
  - mobile Admin entry
  - mega menu
  - page transition
  - no console/page errors in the QA run

## Known Limitations

- Live RLS enforcement still must be manually tested in the actual Supabase project.
- The client can improve UX, but cannot replace database RLS.
- Rich text still renders as plain text.
- Draft rows remain after publishing by design.
- No revision-history UI, media workflow, dashboard, or global publish exists yet.

## Recommended Phase 4 Prompt Title

`Phase 4: CMS Dashboard, Draft Overview, Revision History, and Safer Content Workflows`
