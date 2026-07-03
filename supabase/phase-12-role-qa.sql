-- GROWVA CMS Phase 12: Role Matrix QA, Editorial Workflow Polish, Production Hardening
-- Run AFTER schema.sql, phase-7-visual-controls.sql, phase-8-section-builder.sql, and
-- phase-11-media-asset-management.sql are applied.
-- This patch is minimal: it adds no new tables or columns.
-- It contains:
--   1. Production safety assertions (read-only checks)
--   2. Test account setup instructions (manual steps, run as owner)
--   3. Cleanup instructions

-- ── 1. Safety assertions ──────────────────────────────────────────────────
-- These SELECT queries confirm that RLS is enabled on all CMS tables.
-- Expected: every row returns is_rls_enabled = true.
-- Run these manually in the SQL Editor if you want to verify your schema.

/*
select
  tablename,
  rowsecurity as is_rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in (
    'admin_profiles',
    'cms_content',
    'cms_publish_log',
    'cms_audit_log',
    'cms_media_assets',
    'cms_design_tokens',
    'cms_section_settings',
    'cms_element_styles',
    'cms_custom_sections'
  )
order by tablename;
*/

-- ── 2. Test account setup (manual steps) ─────────────────────────────────
-- To create editor/viewer test accounts for role QA:
--
-- Step A — Create the auth user in Supabase Dashboard:
--   1. Open Authentication > Users in the Supabase dashboard.
--   2. Click "Invite user" or "Add user" and enter the test email and password.
--      Example emails: editor-test@growva.local / viewer-test@growva.local
--   3. Note the auto-generated UUID for each new user.
--
-- Step B — Insert admin_profiles rows:
--   Replace the UUIDs below with the actual user IDs from Step A.
--
-- INSERT INTO public.admin_profiles (id, email, role)
-- VALUES
--   ('REPLACE-WITH-EDITOR-UUID', 'editor-test@growva.local', 'editor'),
--   ('REPLACE-WITH-VIEWER-UUID', 'viewer-test@growva.local', 'viewer')
-- ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email;
--
-- Step C — Verify the rows were inserted:
--
-- SELECT id, email, role FROM public.admin_profiles ORDER BY role;
--
-- Step D — Test in the browser:
--   - Open the site with ?mockAdmin=false (or no mock param).
--   - Open the CMS admin entry, sign in as the editor / viewer account.
--   - Verify the Role & Session tab shows the correct role matrix.
--   - Verify Save Draft works for editor, is blocked for viewer.
--   - Verify Publish is blocked for both editor and viewer.

-- ── 3. Test account cleanup ───────────────────────────────────────────────
-- After QA, remove test accounts:
--
-- DELETE FROM public.admin_profiles
-- WHERE email IN ('editor-test@growva.local', 'viewer-test@growva.local');
--
-- Then delete the auth users in Supabase Dashboard > Authentication > Users.
-- Deleting from admin_profiles alone does NOT remove the auth user.

-- ── 4. Verify admin_profiles has no unintended users ─────────────────────
-- Run before committing to production:
--
-- SELECT id, email, role, created_at FROM public.admin_profiles ORDER BY created_at;

-- ── 5. Confirm all SQL patches have been applied ──────────────────────────
-- Check that all expected tables exist:
--
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'cms_content', 'cms_media_assets', 'cms_design_tokens',
--     'cms_section_settings', 'cms_element_styles', 'cms_custom_sections'
--   )
-- ORDER BY tablename;
--
-- Expected: 6 rows.
-- Missing rows mean a SQL patch was not applied.

-- ── 6. Storage bucket check ───────────────────────────────────────────────
-- Supabase Storage does not have a SQL-accessible catalog for bucket configs.
-- Verify manually:
--   Dashboard > Storage > cms-media:
--     - Public: ON
--     - SELECT policy exists for anon + authenticated
--     - INSERT policy requires owner or editor role

-- ── 7. Production readiness final check ──────────────────────────────────
-- Confirm all of the following manually before going live:
--
-- [ ] supabase-config.js uses anon (publishable) key, not service_role key
-- [ ] RLS is enabled on all CMS tables (see assertion block above)
-- [ ] admin_profiles contains only intended users
-- [ ] test users removed or documented
-- [ ] No ?mockAdmin=true in production URLs
-- [ ] No ?cmsDebug=true in production URLs
-- [ ] Public pages load without console errors when logged out
-- [ ] admin/admin.js passes node --check
-- [ ] js/script.js passes node --check
-- [ ] js/content-registry.js passes node --check
-- [ ] Phase 7, 8, 11 SQL patches applied (6 CMS tables present)
-- [ ] cms-media Storage bucket exists and is Public
-- [ ] No sb_secret_ or service_role key committed to git
