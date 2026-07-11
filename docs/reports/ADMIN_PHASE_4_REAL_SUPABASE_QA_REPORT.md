# ADMIN PHASE 4 REAL SUPABASE QA REPORT

Date: 2026-07-02

## Summary

Real Supabase public/RLS and visitor-mode checks were completed against the configured project.

Authenticated owner/editor dashboard tests could not be completed because no real Supabase Auth admin email/password was present in the repo or environment. This is a good security posture, but it blocks real login, role, draft, publish, reset, and session-persistence testing until a test admin account is provided.

No schema or application code changes were made.

## Files Changed

- `ADMIN_PHASE_4_REAL_SUPABASE_QA_REPORT.md`

## Real Supabase Tests Completed

Passed:

- Configured Supabase project is reachable.
- Client key is a browser-safe `sb_publishable` key, not a secret key.
- Logged-out public visitor can query `cms_content` rows where `status = published`.
- Logged-out public visitor cannot read draft rows from `cms_content`.
- Logged-out public visitor cannot read `admin_profiles`.
- Logged-out public visitor cannot read `cms_publish_log`.
- Logged-out public visitor cannot read `cms_audit_log`.
- Homepage public visitor mode loads with the real Supabase client.
- Public published edits hydrate on `index.html` after page load.
- Nested page path smoke test completed on `services/brand-identity-design.html`.
- Visitor mode stayed outside Admin Mode.
- Admin dashboard/topbar did not appear for logged-out visitors.
- No browser console errors during the public visitor validation.
- No client-side secret/service-role key pattern was found in HTML/JS/CSS client files.

Observed real public data:

- `cms_content` returned 2 published rows to logged-out public reads.
- `cms_content` returned 0 draft rows to logged-out public reads.
- `admin_profiles` returned 0 rows to logged-out public reads.
- `cms_publish_log` returned 0 rows to logged-out public reads.
- `cms_audit_log` returned 0 rows to logged-out public reads.

## Tests Blocked By Missing Credentials

Blocked:

- Real Supabase login.
- Real `admin_profiles` role detection after login.
- Save Draft using real `cms_content`.
- Current Page Drafts dashboard tab with authenticated draft rows.
- Publish Current Page using real Supabase owner permissions.
- Published Content tab after authenticated publish.
- Authenticated `cms_publish_log` insert/read.
- Authenticated `cms_audit_log` insert/read, if table/policies are installed.
- Reset Draft using real Supabase.
- Logout/login session persistence.

Reason:

- No real admin email/password was available in repo files or matching environment variables.
- The only documented credentials are the local mock fallback credentials, which are intentionally not real Supabase Auth credentials.

## RLS Concerns

No public RLS leak was found in the tested unauthenticated surface.

The following still need authenticated verification with a real owner/editor/viewer account:

- Owners can publish current-page drafts.
- Editors can save/reset drafts but cannot publish.
- Viewers can enter Admin Mode but cannot write.
- `cms_publish_log` is readable/writable only by owners.
- `cms_audit_log` insert/read behavior matches intended roles.

## Visitor Mode

Public visitor mode remained visually and behaviorally isolated from Admin Mode during the real Supabase smoke test:

- No admin mode body class.
- No admin topbar/dashboard overlay.
- Public published edits loaded after refresh.
- Nested service page loaded normally.
- No console errors.

## Result

Phase 4 public Supabase integration looks stable.

Phase 4 authenticated Supabase integration is not fully signed off yet because real admin credentials are required to complete the owner/editor workflow tests.

## Is Phase 5 Safe To Start?

Not yet for authenticated CMS work.

Phase 5 should wait until the real Supabase owner account is tested end-to-end through login, save draft, dashboard draft rows, publish current page, published rows, logs, reset draft, logout/login persistence, and public refresh.

If Phase 5 is purely frontend/public-site polish, it is safe to start from the current state.

## Recommended Next Phase 5 Title

Phase 5: Authenticated CMS Production QA, Role Matrix, and RLS Hardening
