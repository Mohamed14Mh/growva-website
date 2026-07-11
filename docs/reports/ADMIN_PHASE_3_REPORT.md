# GROWVA Admin Phase 3 Report

## Scope

Phase 3 replaces default mock persistence with Supabase Auth and persistent text/content editing while keeping the site static HTML/CSS/JS and GitHub Pages compatible.

No React, Vite, Next.js, server backend, image upload, section builder, or visual redesign was added.

## Files Created

- `admin/supabase-config.example.js`
- `admin/supabase-config.js`
- `supabase/schema.sql`
- `SUPABASE_SETUP_GUIDE.md`
- `ADMIN_PHASE_3_REPORT.md`

## Files Modified

- `admin/admin.js`
- `admin/admin.css`
- all 54 HTML pages

Each HTML page now loads, in order:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src=".../admin/supabase-config.js"></script>
<script src=".../admin/admin.js"></script>
```

Relative config paths are adjusted for nested pages.

## Supabase Tables

Defined in `supabase/schema.sql`:

- `admin_profiles`
- `cms_content`
- `cms_publish_log`
- `cms_audit_log`

The schema also adds:

- `public.current_admin_role()`
- `updated_at` trigger helper
- RLS on all CMS/admin tables
- public published-content read policy
- authenticated admin read policy
- editor/owner draft insert, update, and delete policies
- owner-only published insert/update policies
- owner publish-log policies
- audit-log insert/read policies

## Auth Behavior

- Default mock auth is disabled.
- Supabase Auth is used when `admin/supabase-config.js` contains real values and the CDN client is available.
- Login calls `supabase.auth.signInWithPassword()`.
- Session persistence is handled by Supabase.
- Admin mode only opens after the authenticated user is found in `admin_profiles`.
- User roles supported: `owner`, `editor`, `viewer`.
- Local mock auth is available only with `?mockAdmin=true`.

## Public Published Content Loading

On page load, `admin/admin.js`:

- normalizes the current page path, including nested pages
- quietly skips CMS loading if Supabase is not configured
- fetches `cms_content` rows for the current `page_path` with `status = 'published'`
- applies matching values to `[data-edit-key]` elements
- leaves hardcoded HTML untouched when no published rows exist

## Draft Saving

In Admin Edit mode:

- selecting an editable field opens the inspector
- `Save Draft` updates the DOM immediately
- configured Supabase mode upserts a `cms_content` row with `status = 'draft'`
- draft rows include page path, page id, edit key/type, section id/type, text value, and `updated_by`
- the top bar shows unsaved and draft counts
- save status reports `Saving...`, `Draft saved`, or a failure message

## Publish Behavior

The top bar `Publish` button:

- publishes current page only
- asks for confirmation
- requires `admin_profiles.role = 'owner'`
- fetches all draft rows for the current page path
- upserts copies to `status = 'published'`
- keeps draft rows for now
- inserts a row into `cms_publish_log`
- reports `Published X changes.`

## Reset Behavior

`Reset Field`:

- asks for confirmation
- deletes only the current field's draft row
- restores the published value if one exists
- otherwise restores the hardcoded value captured on page load
- never deletes published content in Phase 3

## Fallback Behavior

If Supabase config is missing or still placeholder:

- public visitor pages do not break
- published-content loading is skipped quietly
- clicking Admin opens a modal warning: `Supabase is not configured yet.`
- login is disabled
- no default mock admin access is allowed

With `?mockAdmin=true`, the local Phase 2-style fallback can still exercise the admin UI for local testing only.

## Security Notes

- User-entered content is applied with `textContent`, not `innerHTML`.
- Phase 3 supports text, richtext as plain text, button text, and link label text.
- No arbitrary HTML injection is supported.
- Link `href` updates are only applied from trusted `value_json.href` when internal or `https://`.
- Supabase anon key must rely on strict RLS policies.
- Real owner/editor/viewer permissions are enforced by RLS, not just the client UI.

## Validation Completed

- `node --check admin/admin.js`
- `node --check js/script.js`
- `node --check js/content-registry.js`
- 54/54 HTML pages include Supabase CDN, Supabase config, admin JS, desktop Admin entry, and mobile Admin entry.
- 4,930 local refs checked, 0 missing.
- Browser validation:
  - placeholder config shows clean admin warning
  - visitor mode does not start in admin mode
  - default mock admin is disabled
  - `?mockAdmin=true` fallback logs in and saves a local draft
  - Supabase stub applies published content on public load
  - Supabase stub saves draft rows
  - Supabase stub publishes draft rows to published rows
  - desktop mega menu toggles open and updates ARIA
  - mobile menu still opens and shows Admin entry
  - index-to-process navigation/page-transition smoke passed
  - no console/page errors in validation

## Manual Testing Checklist

- Add real Supabase URL and anon key to `admin/supabase-config.js`.
- Run `supabase/schema.sql` in the Supabase SQL editor.
- Create an auth user.
- Insert the user into `admin_profiles` as `owner`.
- Log in through the Admin modal.
- Save a draft edit.
- Reload while logged in and confirm the draft override loads in Admin mode.
- Publish the page.
- Log out or open a private browser window.
- Reload the page and confirm the published value appears publicly.

## Known Limitations

- Text/content only.
- No image upload.
- No media library.
- No section builder.
- No global site publish.
- No visual diff, draft list, or revision browser.
- Draft rows remain after publishing.
- Rich text is stored and rendered as plain text in Phase 3.

## Phase 4 Recommendation

Build a structured CMS dashboard: draft overview, changed-fields list, revision history, media library planning, safer link editing, and a global publish workflow.
