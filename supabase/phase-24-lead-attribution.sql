-- Phase 24: Lead Source Attribution and Conversion Reporting
-- ---------------------------------------------------------------------------
-- RUN THIS FILE in the Supabase SQL Editor after Phase 19.
-- Idempotent and non-destructive: preserves existing cms_contact_submissions
-- rows and extends the table with first-party attribution fields.
--
-- This patch intentionally does not modify supabase/schema.sql.

ALTER TABLE public.cms_contact_submissions
  ADD COLUMN IF NOT EXISTS landing_page     TEXT,
  ADD COLUMN IF NOT EXISTS referrer         TEXT,
  ADD COLUMN IF NOT EXISTS utm_source       TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium       TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign     TEXT,
  ADD COLUMN IF NOT EXISTS utm_term         TEXT,
  ADD COLUMN IF NOT EXISTS utm_content      TEXT,
  ADD COLUMN IF NOT EXISTS attribution_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS cms_contact_submissions_source_idx
  ON public.cms_contact_submissions (source);

CREATE INDEX IF NOT EXISTS cms_contact_submissions_page_path_idx
  ON public.cms_contact_submissions (page_path);

CREATE INDEX IF NOT EXISTS cms_contact_submissions_project_type_idx
  ON public.cms_contact_submissions (project_type);

CREATE INDEX IF NOT EXISTS cms_contact_submissions_utm_campaign_idx
  ON public.cms_contact_submissions (utm_campaign)
  WHERE utm_campaign IS NOT NULL;

-- Verification:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'cms_contact_submissions'
--   AND column_name IN (
--     'landing_page',
--     'referrer',
--     'utm_source',
--     'utm_medium',
--     'utm_campaign',
--     'utm_term',
--     'utm_content',
--     'attribution_json'
--   )
-- ORDER BY column_name;
