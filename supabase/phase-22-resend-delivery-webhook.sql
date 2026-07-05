-- Phase 22: Resend Delivery Webhook + Bounce Handling
-- ---------------------------------------------------------------------------
-- RUN THIS FILE in the Supabase SQL Editor after Phase 21.
-- Idempotent and non-destructive: preserves all existing cms_notification_log
-- rows and extends the existing log table for Resend lifecycle events.
--
-- This patch intentionally does not modify supabase/schema.sql.

-- 1. Extend allowed notification statuses.
ALTER TABLE public.cms_notification_log
  DROP CONSTRAINT IF EXISTS cms_notification_log_status_check;

ALTER TABLE public.cms_notification_log
  ADD CONSTRAINT cms_notification_log_status_check
  CHECK (
    status IN (
      'sent',
      'test',
      'failed',
      'skipped',
      'delivered',
      'bounced',
      'complained',
      'opened',
      'clicked',
      'unknown'
    )
  );

-- 2. Optional lifecycle timestamps. These make admin/debug queries simple while
-- detailed provider context remains in metadata.
ALTER TABLE public.cms_notification_log
  ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

-- 3. Helpful indexes for delivery triage.
CREATE INDEX IF NOT EXISTS cms_notification_log_last_event_idx
  ON public.cms_notification_log (last_event_at DESC)
  WHERE last_event_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS cms_notification_log_delivery_status_idx
  ON public.cms_notification_log (status, last_event_at DESC);

-- 4. Verification queries.
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.cms_notification_log'::regclass
--   AND conname = 'cms_notification_log_status_check';
--
-- SELECT status, provider_message_id, delivered_at, bounced_at,
--        complained_at, opened_at, clicked_at, last_event_at
-- FROM public.cms_notification_log
-- ORDER BY created_at DESC
-- LIMIT 10;
