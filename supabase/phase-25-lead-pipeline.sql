-- Phase 25: Lead Pipeline Workflow and Follow-up Tracking
-- ---------------------------------------------------------------------------
-- RUN THIS FILE in the Supabase SQL Editor after Phase 19 and Phase 24.
-- Idempotent and non-destructive: preserves existing cms_contact_submissions
-- rows and extends the table with lightweight CRM pipeline fields.
--
-- This patch intentionally does not modify supabase/schema.sql.

ALTER TABLE public.cms_contact_submissions
  ADD COLUMN IF NOT EXISTS pipeline_stage      TEXT        DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS priority            TEXT        DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS assigned_to         TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contacted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome             TEXT,
  ADD COLUMN IF NOT EXISTS next_action         TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes      TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.cms_contact_submissions
SET
  pipeline_stage = COALESCE(pipeline_stage, 'new'),
  priority = COALESCE(priority, 'normal'),
  pipeline_updated_at = COALESCE(pipeline_updated_at, updated_at, created_at, now())
WHERE pipeline_stage IS NULL
   OR priority IS NULL
   OR pipeline_updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cms_contact_submissions_pipeline_stage_check'
      AND conrelid = 'public.cms_contact_submissions'::regclass
  ) THEN
    ALTER TABLE public.cms_contact_submissions
      ADD CONSTRAINT cms_contact_submissions_pipeline_stage_check
      CHECK (pipeline_stage IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost', 'nurture'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cms_contact_submissions_priority_check'
      AND conrelid = 'public.cms_contact_submissions'::regclass
  ) THEN
    ALTER TABLE public.cms_contact_submissions
      ADD CONSTRAINT cms_contact_submissions_priority_check
      CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cms_contact_submissions_pipeline_stage_idx
  ON public.cms_contact_submissions (pipeline_stage);

CREATE INDEX IF NOT EXISTS cms_contact_submissions_priority_idx
  ON public.cms_contact_submissions (priority);

CREATE INDEX IF NOT EXISTS cms_contact_submissions_assigned_to_idx
  ON public.cms_contact_submissions (assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS cms_contact_submissions_follow_up_at_idx
  ON public.cms_contact_submissions (follow_up_at)
  WHERE follow_up_at IS NOT NULL;

-- Preserve existing RLS, but harden anonymous contact-form inserts so public
-- visitors cannot set internal CRM fields. Authenticated admin SELECT/UPDATE
-- policies from Phase 19 are intentionally preserved. The existing broad
-- editor/owner UPDATE policy authorizes admin updates at the table level; the
-- frontend only sends pipeline fields from the Save Pipeline action.

DROP POLICY IF EXISTS cms_contact_submissions_anon_insert
  ON public.cms_contact_submissions;

CREATE POLICY cms_contact_submissions_anon_insert
  ON public.cms_contact_submissions
  FOR INSERT
  TO anon
  WITH CHECK (
    pipeline_stage = 'new'
    AND priority = 'normal'
    AND assigned_to IS NULL
    AND follow_up_at IS NULL
    AND last_contacted_at IS NULL
    AND outcome IS NULL
    AND next_action IS NULL
    AND internal_notes IS NULL
  );

-- Verification:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'cms_contact_submissions'
--   AND column_name IN (
--     'pipeline_stage',
--     'priority',
--     'assigned_to',
--     'follow_up_at',
--     'last_contacted_at',
--     'outcome',
--     'next_action',
--     'internal_notes',
--     'pipeline_updated_at'
--   )
-- ORDER BY column_name;
--
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'cms_contact_submissions'
-- ORDER BY policyname;
