-- Phase 29: Scheduled CRM Reminder Delivery and Automation Reliability
-- ---------------------------------------------------------------------------
-- RUN THIS FILE in the Supabase SQL Editor after Phase 28.
-- Idempotent and non-destructive. Creates reminder sweep run logs and expands
-- crm activity types. Does not alter schema.sql.

CREATE TABLE IF NOT EXISTS public.cms_crm_reminder_runs (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type         TEXT        NOT NULL DEFAULT 'manual',
  status           TEXT        NOT NULL DEFAULT 'started',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  actor_id         UUID,
  actor_email      TEXT,
  total_candidates INTEGER     NOT NULL DEFAULT 0,
  total_sent       INTEGER     NOT NULL DEFAULT 0,
  total_skipped    INTEGER     NOT NULL DEFAULT 0,
  total_failed     INTEGER     NOT NULL DEFAULT 0,
  error_message    TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cms_crm_reminder_runs_type_check
    CHECK (run_type IN ('manual', 'scheduled', 'test')),
  CONSTRAINT cms_crm_reminder_runs_status_check
    CHECK (status IN ('started', 'completed', 'completed_with_errors', 'failed')),
  CONSTRAINT cms_crm_reminder_runs_counts_check
    CHECK (
      total_candidates >= 0
      AND total_sent >= 0
      AND total_skipped >= 0
      AND total_failed >= 0
    ),
  CONSTRAINT cms_crm_reminder_runs_error_length
    CHECK (char_length(error_message) <= 1000)
);

CREATE TABLE IF NOT EXISTS public.cms_crm_reminder_run_items (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id        UUID        NOT NULL REFERENCES public.cms_crm_reminder_runs(id) ON DELETE CASCADE,
  task_id       UUID        REFERENCES public.cms_lead_tasks(id) ON DELETE CASCADE,
  lead_id       UUID        REFERENCES public.cms_contact_submissions(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL,
  reason        TEXT,
  reminder_type TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cms_crm_reminder_run_items_status_check
    CHECK (status IN ('sent', 'skipped', 'failed')),
  CONSTRAINT cms_crm_reminder_run_items_reason_length
    CHECK (char_length(reason) <= 1000),
  CONSTRAINT cms_crm_reminder_run_items_type_length
    CHECK (char_length(reminder_type) <= 80)
);

CREATE INDEX IF NOT EXISTS cms_crm_reminder_runs_created_at_idx
  ON public.cms_crm_reminder_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS cms_crm_reminder_runs_status_idx
  ON public.cms_crm_reminder_runs (status);

CREATE INDEX IF NOT EXISTS cms_crm_reminder_run_items_run_id_idx
  ON public.cms_crm_reminder_run_items (run_id);

CREATE INDEX IF NOT EXISTS cms_crm_reminder_run_items_task_id_idx
  ON public.cms_crm_reminder_run_items (task_id);

CREATE INDEX IF NOT EXISTS cms_crm_reminder_run_items_lead_id_idx
  ON public.cms_crm_reminder_run_items (lead_id);

CREATE INDEX IF NOT EXISTS cms_crm_reminder_run_items_status_idx
  ON public.cms_crm_reminder_run_items (status);

CREATE INDEX IF NOT EXISTS cms_crm_reminder_run_items_created_at_idx
  ON public.cms_crm_reminder_run_items (created_at DESC);

ALTER TABLE public.cms_crm_reminder_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_crm_reminder_run_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cms_crm_reminder_runs_admin_select
  ON public.cms_crm_reminder_runs;
DROP POLICY IF EXISTS cms_crm_reminder_runs_owner_delete
  ON public.cms_crm_reminder_runs;
DROP POLICY IF EXISTS cms_crm_reminder_run_items_admin_select
  ON public.cms_crm_reminder_run_items;
DROP POLICY IF EXISTS cms_crm_reminder_run_items_owner_delete
  ON public.cms_crm_reminder_run_items;

CREATE POLICY cms_crm_reminder_runs_admin_select
  ON public.cms_crm_reminder_runs
  FOR SELECT
  TO authenticated
  USING (public.current_admin_role() IN ('owner', 'editor', 'viewer'));

CREATE POLICY cms_crm_reminder_runs_owner_delete
  ON public.cms_crm_reminder_runs
  FOR DELETE
  TO authenticated
  USING (public.current_admin_role() = 'owner');

CREATE POLICY cms_crm_reminder_run_items_admin_select
  ON public.cms_crm_reminder_run_items
  FOR SELECT
  TO authenticated
  USING (public.current_admin_role() IN ('owner', 'editor', 'viewer'));

CREATE POLICY cms_crm_reminder_run_items_owner_delete
  ON public.cms_crm_reminder_run_items
  FOR DELETE
  TO authenticated
  USING (public.current_admin_role() = 'owner');

REVOKE ALL ON public.cms_crm_reminder_runs FROM anon;
REVOKE ALL ON public.cms_crm_reminder_run_items FROM anon;
GRANT SELECT, DELETE ON public.cms_crm_reminder_runs TO authenticated;
GRANT SELECT, DELETE ON public.cms_crm_reminder_run_items TO authenticated;

-- Recreate the activity type check with Phase 26 + Phase 27 + Phase 28 + Phase 29 values.
DO $$
BEGIN
  IF to_regclass('public.cms_lead_activity') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'cms_lead_activity_type_check'
        AND conrelid = 'public.cms_lead_activity'::regclass
    ) THEN
      ALTER TABLE public.cms_lead_activity
        DROP CONSTRAINT cms_lead_activity_type_check;
    END IF;

    ALTER TABLE public.cms_lead_activity
      ADD CONSTRAINT cms_lead_activity_type_check
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
        'marked_new',
        'task_created',
        'task_completed',
        'task_cancelled',
        'task_reopened',
        'task_updated',
        'task_reminder_sent',
        'task_reminder_failed',
        'automation_task_created',
        'automation_task_skipped_duplicate',
        'suggested_task_created',
        'task_scheduled_reminder_sent',
        'task_scheduled_reminder_failed',
        'reminder_sweep_run',
        'reminder_sweep_failed'
      ));
  END IF;
END $$;

-- Verification:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('cms_crm_reminder_runs', 'cms_crm_reminder_run_items');
--
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('cms_crm_reminder_runs', 'cms_crm_reminder_run_items')
-- ORDER BY tablename, policyname;
