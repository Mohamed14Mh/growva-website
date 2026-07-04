-- Phase 19: Contact Form Lead Capture — cms_contact_submissions
-- ─────────────────────────────────────────────────────────────────────────────
-- RUN THIS FILE in the Supabase SQL Editor.
-- It is idempotent — safe to run after a partial failure or re-run from scratch.
--
-- REQUIRES: schema.sql (Phase 3) must be applied first.
-- public.current_admin_role() and public.admin_profiles must already exist.
--
-- FIX NOTE (Phase 19 v2): original patch incorrectly referenced
-- public.cms_admin_profiles which does not exist. Corrected to use
-- public.current_admin_role() — the helper function defined in schema.sql
-- and used by every other CMS phase SQL file.

-- ── 1. Create table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cms_contact_submissions (
  id            UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT         NOT NULL,
  email         TEXT         NOT NULL,
  company       TEXT,
  phone         TEXT,
  project_type  TEXT,
  budget        TEXT,
  message       TEXT         NOT NULL,
  page_path     TEXT,
  source        TEXT         NOT NULL DEFAULT 'contact_form',
  status        TEXT         NOT NULL DEFAULT 'new',
  is_archived   BOOLEAN      NOT NULL DEFAULT false,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT cms_contact_submissions_status_check
    CHECK (status IN ('new', 'read', 'archived')),
  CONSTRAINT cms_contact_submissions_name_length
    CHECK (char_length(name)    BETWEEN 1 AND 200),
  CONSTRAINT cms_contact_submissions_email_length
    CHECK (char_length(email)   BETWEEN 3 AND 320),
  CONSTRAINT cms_contact_submissions_message_length
    CHECK (char_length(message) BETWEEN 1 AND 5000)
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS cms_contact_submissions_status_idx
  ON public.cms_contact_submissions (status);

CREATE INDEX IF NOT EXISTS cms_contact_submissions_created_at_idx
  ON public.cms_contact_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS cms_contact_submissions_is_archived_idx
  ON public.cms_contact_submissions (is_archived);

-- ── 3. updated_at trigger ────────────────────────────────────────────────────
-- Reuses the shared set_updated_at() function from schema.sql.

DROP TRIGGER IF EXISTS cms_contact_submissions_updated_at
  ON public.cms_contact_submissions;

CREATE TRIGGER cms_contact_submissions_updated_at
  BEFORE UPDATE ON public.cms_contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Enable Row Level Security ─────────────────────────────────────────────

ALTER TABLE public.cms_contact_submissions ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS Policies — using public.current_admin_role() ──────────────────────
-- All other CMS tables use this same pattern (schema.sql, phase-7, phase-8, etc.)
-- public.current_admin_role() returns the role from public.admin_profiles
-- for the currently authenticated user (auth.uid()).
--
-- Drop existing policies first (makes this script idempotent after partial failure)

DROP POLICY IF EXISTS cms_contact_submissions_anon_insert
  ON public.cms_contact_submissions;
DROP POLICY IF EXISTS cms_contact_submissions_admin_select
  ON public.cms_contact_submissions;
DROP POLICY IF EXISTS cms_contact_submissions_editor_update
  ON public.cms_contact_submissions;
DROP POLICY IF EXISTS cms_contact_submissions_owner_delete
  ON public.cms_contact_submissions;

-- Public visitors (anon): INSERT only — cannot read, update, or delete.
-- This allows the contact form to submit without authentication.
CREATE POLICY cms_contact_submissions_anon_insert
  ON public.cms_contact_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated admins (viewer / editor / owner): SELECT all rows.
CREATE POLICY cms_contact_submissions_admin_select
  ON public.cms_contact_submissions
  FOR SELECT
  TO authenticated
  USING (public.current_admin_role() IN ('owner', 'editor', 'viewer'));

-- Editor + Owner: UPDATE status and is_archived.
-- Column-level restriction (only status/is_archived fields) enforced at the
-- application layer; RLS authorises the UPDATE for editor/owner roles.
CREATE POLICY cms_contact_submissions_editor_update
  ON public.cms_contact_submissions
  FOR UPDATE
  TO authenticated
  USING     (public.current_admin_role() IN ('owner', 'editor'))
  WITH CHECK (public.current_admin_role() IN ('owner', 'editor'));

-- Owner only: DELETE (archive is strongly preferred — delete is last resort).
CREATE POLICY cms_contact_submissions_owner_delete
  ON public.cms_contact_submissions
  FOR DELETE
  TO authenticated
  USING (public.current_admin_role() = 'owner');

-- ── 6. Grant table access ────────────────────────────────────────────────────

GRANT INSERT ON public.cms_contact_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_contact_submissions TO authenticated;

-- ── 7. Verify ────────────────────────────────────────────────────────────────
-- Run these after the patch to confirm success:

-- Check table exists and RLS is on:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename = 'cms_contact_submissions';

-- List all active policies on the table:
-- SELECT policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE tablename = 'cms_contact_submissions'
-- ORDER BY policyname;

-- Count any rows (should be 0 on a fresh install):
-- SELECT COUNT(*) FROM public.cms_contact_submissions;

-- Confirm trigger is attached:
-- SELECT trigger_name, event_manipulation, action_timing
-- FROM information_schema.triggers
-- WHERE event_object_table = 'cms_contact_submissions';

-- ── Notes ─────────────────────────────────────────────────────────────────────
--
-- • Admin role system: public.current_admin_role() (defined in schema.sql).
--   Returns 'owner' | 'editor' | 'viewer' | NULL for the current user.
--   Source table: public.admin_profiles (id = auth.uid(), role, email).
--
-- • Public visitors INSERT only — they cannot SELECT their own row after submit.
--
-- • Archiving is preferred over DELETE:
--   is_archived = true hides the row from the default admin view but retains data.
--
-- • Email notification (Resend / SendGrid) requires a Supabase Edge Function
--   triggered by a DB webhook on INSERT. Never put API secrets in the frontend.
--   TODO Phase 20+: implement edge-function-based email notification.
