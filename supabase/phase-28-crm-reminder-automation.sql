-- Phase 28: CRM Reminder Notifications and Task Automation Rules
-- ---------------------------------------------------------------------------
-- RUN THIS FILE in the Supabase SQL Editor after Phase 27.
-- Idempotent and non-destructive: adds reminder/automation fields to
-- cms_lead_tasks and expands cms_lead_activity types. Does not alter schema.sql.

ALTER TABLE public.cms_lead_tasks
  ADD COLUMN IF NOT EXISTS reminder_enabled   BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count     INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_error TEXT,
  ADD COLUMN IF NOT EXISTS automation_source  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cms_lead_tasks_reminder_count_check'
      AND conrelid = 'public.cms_lead_tasks'::regclass
  ) THEN
    ALTER TABLE public.cms_lead_tasks
      ADD CONSTRAINT cms_lead_tasks_reminder_count_check
      CHECK (reminder_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cms_lead_tasks_last_reminder_error_length'
      AND conrelid = 'public.cms_lead_tasks'::regclass
  ) THEN
    ALTER TABLE public.cms_lead_tasks
      ADD CONSTRAINT cms_lead_tasks_last_reminder_error_length
      CHECK (char_length(last_reminder_error) <= 1000);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cms_lead_tasks_automation_source_length'
      AND conrelid = 'public.cms_lead_tasks'::regclass
  ) THEN
    ALTER TABLE public.cms_lead_tasks
      ADD CONSTRAINT cms_lead_tasks_automation_source_length
      CHECK (char_length(automation_source) <= 120);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cms_lead_tasks_reminder_sent_at_idx
  ON public.cms_lead_tasks (reminder_sent_at)
  WHERE reminder_sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS cms_lead_tasks_automation_source_idx
  ON public.cms_lead_tasks (automation_source)
  WHERE automation_source IS NOT NULL;

-- Recreate the activity type check with Phase 26 + Phase 27 + Phase 28 values.
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
        'suggested_task_created'
      ));
  END IF;
END $$;

-- Verification:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'cms_lead_tasks'
--   AND column_name IN (
--     'reminder_enabled',
--     'reminder_sent_at',
--     'reminder_count',
--     'last_reminder_error',
--     'automation_source'
--   )
-- ORDER BY column_name;
