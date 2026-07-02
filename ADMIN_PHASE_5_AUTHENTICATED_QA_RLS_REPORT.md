# ADMIN PHASE 5 AUTHENTICATED QA RLS REPORT

Date: 2026-07-02

## Scope

Phase 5 tested authenticated CMS production readiness against the real Supabase backend configured in `admin/supabase-config.js`.

No image upload, media library, section builder, React/Vite/Next conversion, dashboard redesign, or visual redesign was added.

## Files Changed

- `admin/admin.js`
- `ADMIN_PHASE_5_AUTHENTICATED_QA_RLS_REPORT.md`

No SQL patch file was created.

## Fixes Applied

During real backend testing, one production-readiness issue appeared: immediately after publishing, same-browser reads could reuse stale CMS read state while the database already contained the new published row.

Targeted fix in `admin/admin.js`:

- Supabase GET/HEAD requests now use `cache: 'no-store'`.
- CMS read queries now include a harmless dynamic freshness filter using `created_at < tomorrow`.
- When a valid admin session is detected during boot, published edits are loaded again before entering Admin Mode.
- Session detection now retries briefly while Supabase rehydrates local auth storage.

These changes are scoped to CMS stability and do not alter visual design or schema.

## Authenticated Tests Completed

Passed:

- Real Supabase Auth login worked.
- Logged-in user exists in `admin_profiles`.
- Detected role: `owner`.
- Save Draft on `index.html` inserted a real `cms_content` draft row.
- Current Page Drafts dashboard tab displayed the real draft row.
- Publish Current Page wrote a real `cms_content` published row.
- `cms_publish_log` received rows.
- `cms_audit_log` received `save_draft` / `publish_page` rows.
- Published content hydrated correctly in a fresh logged-out public visitor context.
- Reset Draft deleted the draft value and preserved published content.
- Public visitor mode stayed outside Admin Mode.
- Public reads can see published rows.
- Public reads cannot see draft rows.
- Public reads cannot see `admin_profiles`.
- Public reads cannot see `cms_publish_log`.
- Public reads cannot see `cms_audit_log`.
- Nested service page loaded: `services/brand-identity-design.html`.
- Nested work/project page loaded: `work/shopify-stores/noor-perfumery.html`.
- No browser console errors were recorded in the passing focused public/session check.
- No `sb_secret_` or service-role key pattern was found in client-side HTML/JS/CSS files.
- Final QA field cleanup restored the homepage published value to `Ecommerce Growth Partner`.

## Nuanced Findings

Session persistence:

- Supabase auth token persisted after refresh.
- A direct Supabase client session check after refresh returned a valid session.
- The focused script did not observe Admin Mode visually auto-resumed at the exact capture moment after refresh, so Phase 6 should keep a browser assertion around Admin resume timing.

Post-publish hydration:

- Database publish and fresh public visitor hydration passed.
- A same logged-in browser context could still show pre-publish DOM text immediately after navigation while a direct same-page Supabase query already returned the new row.
- The CMS read/cache hardening above was added to reduce this risk. Fresh public visitor behavior passed after the fix.

## RLS Review

Reviewed `supabase/schema.sql`.

No schema overwrite was needed and no `supabase/phase-5-rls-hardening.sql` patch was created.

Policies remain aligned with the intended role model:

- Public/anon can read only `cms_content.status = published`.
- Authenticated admins can read CMS content according to `current_admin_role()`.
- Owners and editors can insert/update/delete drafts.
- Only owners can insert/update published content.
- Only owners can read/write publish logs.
- Audit log insert is available to owners/editors; audit log read is owner-only.

RLS concern to keep watching:

- Client-side audit logging is best-effort. If audit logging becomes compliance-critical, move audit writes into database triggers or RPC functions in a later backend phase.

## Validation

Passed:

- `node --check admin/admin.js`
- `node --check js/script.js`
- `node --check js/content-registry.js`

Real Supabase browser/API validation passed for:

- login
- owner role detection
- draft save
- dashboard draft visibility
- publish
- publish log
- audit log
- public published hydration
- reset draft
- public RLS restrictions
- nested page smoke checks
- secret/service-role key scan

## Media Library Readiness

It is safe to start the next Media Library / Image Upload phase from an auth/RLS baseline perspective.

Recommended guardrail for Phase 6:

- Keep Media Library writes owner/editor-scoped.
- Keep public media reads separate from draft/private media metadata.
- Include a browser test for Admin Mode resume timing after refresh.

## Recommended Next Phase Title

Phase 6: Secure Media Library and Image Upload Pipeline
