-- Phase 27: CRM Task Automation and Pipeline Reminders
-- ---------------------------------------------------------------------------
-- RUN THIS FILE in the Supabase SQL Editor after Phase 26.
-- Idempotent and non-destructive: creates a lead task/reminder table and
-- expands lead activity types for task events. Does not alter schema.sql.

CREATE TABLE IF NOT EXISTS public.cms_lead_tasks (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id          UUID        NOT NULL REFERENCES public.cms_contact_submissions(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  description      TEXT,
  status           TEXT        NOT NULL DEFAULT 'open',
  priority         TEXT        NOT NULL DEFAULT 'normal',
  assigned_to      TEXT,
  due_at           TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  completed_by     UUID,
  created_by       UUID,
  created_by_email TEXT,
  updated_by       UUID,
  updated_by_email TEXT,
  metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cms_lead_tasks_status_check
    CHECK (status IN ('open', 'completed', 'cancelled')),
  CONSTRAINT cms_lead_tasks_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT cms_lead_tasks_title_length
    CHECK (char_length(title) BETWEEN 1 AND 240)
);

CREATE INDEX IF NOT EXISTS cms_lead_tasks_lead_id_idx
  ON public.cms_lead_tasks (lead_id);

CREATE INDEX IF NOT EXISTS cms_lead_tasks_status_idx
  ON public.cms_lead_tasks (status);

CREATE INDEX IF NOT EXISTS cms_lead_tasks_priority_idx
  ON public.cms_lead_tasks (priority);

CREATE INDEX IF NOT EXISTS cms_lead_tasks_due_at_idx
  ON public.cms_lead_tasks (due_at)
  WHERE due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS cms_lead_tasks_created_at_idx
  ON public.cms_lead_tasks (created_at DESC);

CREATE INDEX IF NOT EXISTS cms_lead_tasks_assigned_to_idx
  ON public.cms_lead_tasks (assigned_to)
  WHERE assigned_to IS NOT NULL;

DROP TRIGGER IF EXISTS cms_lead_tasks_updated_at
  ON public.cms_lead_tasks;

CREATE TRIGGER cms_lead_tasks_updated_at
  BEFORE UPDATE ON public.cms_lead_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cms_lead_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cms_lead_tasks_admin_select
  ON public.cms_lead_tasks;
DROP POLICY IF EXISTS cms_lead_tasks_editor_insert
  ON public.cms_lead_tasks;
DROP POLICY IF EXISTS cms_lead_tasks_editor_update
  ON public.cms_lead_tasks;
DROP POLICY IF EXISTS cms_lead_tasks_owner_delete
  ON public.cms_lead_tasks;

CREATE POLICY cms_lead_tasks_admin_select
  ON public.cms_lead_tasks
  FOR SELECT
  TO authenticated
  USING (public.current_admin_role() IN ('owner', 'editor', 'viewer'));

CREATE POLICY cms_lead_tasks_editor_insert
  ON public.cms_lead_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_admin_role() IN ('owner', 'editor'));

CREATE POLICY cms_lead_tasks_editor_update
  ON public.cms_lead_tasks
  FOR UPDATE
  TO authenticated
  USING (public.current_admin_role() IN ('owner', 'editor'))
  WITH CHECK (public.current_admin_role() IN ('owner', 'editor'));

CREATE POLICY cms_lead_tasks_owner_delete
  ON public.cms_lead_tasks
  FOR DELETE
  TO authenticated
  USING (public.current_admin_role() = 'owner');

REVOKE ALL ON public.cms_lead_tasks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_lead_tasks TO authenticated;

-- Phase 27 task actions are written to cms_lead_activity. Recreate the check
-- constraint with the Phase 26 values plus task-specific activity types.
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
        'task_updated'
      ));
  END IF;
END $$;

-- Verification:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'cms_lead_tasks'
-- ORDER BY ordinal_position;
--
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'cms_lead_tasks'
-- ORDER BY policyname;
