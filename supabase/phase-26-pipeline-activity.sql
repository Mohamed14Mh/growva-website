-- Phase 26: Pipeline Board and CRM Activity Timeline
-- ---------------------------------------------------------------------------
-- RUN THIS FILE in the Supabase SQL Editor after Phase 25.
-- Idempotent and non-destructive: creates a lead activity timeline table
-- without altering supabase/schema.sql or existing contact submission rows.

CREATE TABLE IF NOT EXISTS public.cms_lead_activity (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id       UUID        NOT NULL REFERENCES public.cms_contact_submissions(id) ON DELETE CASCADE,
  actor_id      UUID,
  actor_email   TEXT,
  activity_type TEXT        NOT NULL,
  field_name    TEXT,
  old_value     TEXT,
  new_value     TEXT,
  note          TEXT,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cms_lead_activity_type_check
    CHECK (activity_type IN (
      'pipeline_updated',
      'stage_changed',
      'priority_changed',
      'assigned_to_changed',
      'follow_up_changed',
      'last_contacted_changed',
      'outcome_changed',
      'next_action_changed',
      'internal_note_added',
      'archived',
      'unarchived',
      'marked_read',
      'marked_new'
    ))
);

CREATE INDEX IF NOT EXISTS cms_lead_activity_lead_id_idx
  ON public.cms_lead_activity (lead_id);

CREATE INDEX IF NOT EXISTS cms_lead_activity_created_at_idx
  ON public.cms_lead_activity (created_at DESC);

CREATE INDEX IF NOT EXISTS cms_lead_activity_type_idx
  ON public.cms_lead_activity (activity_type);

CREATE INDEX IF NOT EXISTS cms_lead_activity_actor_id_idx
  ON public.cms_lead_activity (actor_id)
  WHERE actor_id IS NOT NULL;

ALTER TABLE public.cms_lead_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cms_lead_activity_admin_select
  ON public.cms_lead_activity;
DROP POLICY IF EXISTS cms_lead_activity_editor_insert
  ON public.cms_lead_activity;

CREATE POLICY cms_lead_activity_admin_select
  ON public.cms_lead_activity
  FOR SELECT
  TO authenticated
  USING (public.current_admin_role() IN ('owner', 'editor', 'viewer'));

CREATE POLICY cms_lead_activity_editor_insert
  ON public.cms_lead_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_admin_role() IN ('owner', 'editor'));

REVOKE ALL ON public.cms_lead_activity FROM anon;
GRANT SELECT, INSERT ON public.cms_lead_activity TO authenticated;

-- Verification:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'cms_lead_activity'
-- ORDER BY ordinal_position;
--
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'cms_lead_activity'
-- ORDER BY policyname;
