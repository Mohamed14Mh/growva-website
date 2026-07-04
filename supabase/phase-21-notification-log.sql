-- Phase 21: Notification Log + Delivery Tracking — cms_notification_log
-- ─────────────────────────────────────────────────────────────────────────────
-- RUN THIS FILE in the Supabase SQL Editor.
-- It is idempotent — safe to run multiple times or after a partial failure.
--
-- REQUIRES: phase-19-contact-leads.sql must be applied first
--           (cms_contact_submissions must exist for the FK reference)
-- REQUIRES: schema.sql (Phase 3) — public.current_admin_role() must exist
--
-- INSERT permissions: service-role key only (Edge Function side).
--   Supabase automatically provides SUPABASE_SERVICE_ROLE_KEY to Edge Functions.
--   No INSERT RLS policy is created for authenticated users — log writes are
--   server-side only. The service-role client bypasses RLS entirely.
-- SELECT permissions: viewer / editor / owner roles (read-only in admin UI).
-- DELETE permissions: owner role only (not surfaced in UI; for log pruning).

-- ── 1. Create table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cms_notification_log (
  id                  UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id             UUID         REFERENCES public.cms_contact_submissions(id) ON DELETE SET NULL,
  channel             TEXT         NOT NULL DEFAULT 'email',
  provider            TEXT         NOT NULL DEFAULT 'resend',
  event_type          TEXT         NOT NULL DEFAULT 'lead_notification',
  status              TEXT         NOT NULL,
  recipient_email     TEXT,
  sender_email        TEXT,
  subject             TEXT,
  provider_message_id TEXT,
  error_message       TEXT,
  metadata            JSONB        NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT cms_notification_log_status_check
    CHECK (status IN ('sent', 'failed', 'skipped', 'test')),
  CONSTRAINT cms_notification_log_channel_check
    CHECK (channel IN ('email')),
  CONSTRAINT cms_notification_log_provider_check
    CHECK (provider IN ('resend')),
  CONSTRAINT cms_notification_log_subject_length
    CHECK (char_length(subject) <= 500),
  CONSTRAINT cms_notification_log_error_length
    CHECK (char_length(error_message) <= 1000)
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS cms_notification_log_lead_id_idx
  ON public.cms_notification_log (lead_id);

CREATE INDEX IF NOT EXISTS cms_notification_log_status_idx
  ON public.cms_notification_log (status);

CREATE INDEX IF NOT EXISTS cms_notification_log_created_at_idx
  ON public.cms_notification_log (created_at DESC);

CREATE INDEX IF NOT EXISTS cms_notification_log_provider_msg_idx
  ON public.cms_notification_log (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- ── 3. Enable Row Level Security ─────────────────────────────────────────────

ALTER TABLE public.cms_notification_log ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS Policies ──────────────────────────────────────────────────────────
-- Drop first for idempotency

DROP POLICY IF EXISTS cms_notification_log_admin_select
  ON public.cms_notification_log;
DROP POLICY IF EXISTS cms_notification_log_owner_delete
  ON public.cms_notification_log;

-- Viewer / editor / owner: SELECT all log rows
CREATE POLICY cms_notification_log_admin_select
  ON public.cms_notification_log
  FOR SELECT
  TO authenticated
  USING (public.current_admin_role() IN ('owner', 'editor', 'viewer'));

-- Owner only: DELETE (log pruning; not exposed in the admin UI)
CREATE POLICY cms_notification_log_owner_delete
  ON public.cms_notification_log
  FOR DELETE
  TO authenticated
  USING (public.current_admin_role() = 'owner');

-- No INSERT policy for authenticated users — the Edge Function uses the
-- service-role client which bypasses RLS and can always INSERT.
-- Public anon has no access at all (no policy = deny by default with RLS on).

-- ── 5. Grant table access ─────────────────────────────────────────────────────

GRANT SELECT, DELETE ON public.cms_notification_log TO authenticated;
-- No INSERT/UPDATE grant to authenticated — service-role handles that inside Edge Function.

-- ── 6. Verify ─────────────────────────────────────────────────────────────────

-- Check table and RLS:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables WHERE tablename = 'cms_notification_log';

-- List policies:
-- SELECT policyname, cmd, roles
-- FROM pg_policies WHERE tablename = 'cms_notification_log'
-- ORDER BY policyname;

-- Check recent logs (after function is deployed and tested):
-- SELECT * FROM public.cms_notification_log ORDER BY created_at DESC LIMIT 10;

-- ── Notes ─────────────────────────────────────────────────────────────────────
-- • SUPABASE_SERVICE_ROLE_KEY is automatically available to all Edge Functions —
--   no manual `supabase secrets set` needed for this built-in variable.
-- • lead_id FK uses ON DELETE SET NULL — if a lead is deleted, its log rows
--   are preserved but lead_id becomes NULL (logs are audit records).
-- • status='test' is used for admin test notifications (not real leads).
-- • status='failed' rows include error_message truncated to ≤1000 chars.
