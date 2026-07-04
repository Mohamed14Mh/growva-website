-- Phase 16: Visual Properties Panel — Schema Documentation
-- ─────────────────────────────────────────────────────────
-- THIS FILE IS DOCUMENTATION-ONLY. No schema changes are required.
-- Do NOT run this file in the Supabase SQL Editor unless you need
-- to re-read or audit the existing table structure below.
--
-- The existing cms_element_styles table (created in phase-7-visual-controls.sql)
-- already supports Phase 16 without modification. The style_json JSONB column
-- is flexible enough to store both the legacy "flat" format and the new
-- breakpoint-aware format used by the Visual Designer Panel.

-- ── Existing table (created in Phase 7 — DO NOT re-run) ─────────────────────

-- CREATE TABLE IF NOT EXISTS public.cms_element_styles (
--   id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   page_path    TEXT NOT NULL,
--   edit_key     TEXT NOT NULL,
--   section_id   TEXT,
--   style_json   JSONB NOT NULL DEFAULT '{}',
--   status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
--   updated_by   UUID REFERENCES auth.users(id),
--   created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
--   updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- UNIQUE CONSTRAINT: (page_path, edit_key, status)
-- One row per element per status — a draft row and a published row can coexist.

-- ── style_json storage formats ────────────────────────────────────────────────

-- LEGACY format (written by the old Style tab inspector, Phases 7–15):
-- {
--   "styles": {
--     "color": "#fff",
--     "fontSize": "18px"
--   }
-- }

-- PHASE 16 VD format (written by the Visual Properties Panel):
-- {
--   "desktop": { "color": "#fff", "fontSize": "18px" },
--   "tablet":  { "fontSize": "16px" },
--   "mobile":  { "fontSize": "14px" }
-- }

-- MERGED format (when an element has both legacy Style-tab and VD overrides):
-- {
--   "styles":  { "color": "#fff" },
--   "desktop": { "fontSize": "18px", "color": "#fff" },
--   "tablet":  { "fontSize": "16px" },
--   "mobile":  { "fontSize": "14px" }
-- }

-- The Phase 16 code:
--   • Saves merged style_json via saveVisualStyleDraft() → saveElementStyleDraftData()
--   • Reads both keys in applyElementStyleJson() — legacy "styles" applied first,
--     desktop VD styles override. Tablet/mobile applied only in admin mode.
--   • Hydrates vdStyleStore from loaded rows in loadElementStyles()
--     via vd16HydrateStoreEntry() — only processes rows that have breakpoint keys.
--   • Leaves rows with only the "styles" key untouched (fully backward-compatible).

-- ── Backward compatibility ────────────────────────────────────────────────────

-- Old rows (style_json has "styles" key only): handled correctly.
-- New rows (style_json has "desktop"/"tablet"/"mobile" keys): handled correctly.
-- Mixed rows (both "styles" and breakpoint keys): handled correctly.
-- No migration required. Old Style-tab rows continue to work unchanged.

-- ── RLS policy (unchanged from Phase 7) ─────────────────────────────────────

-- Public (unauthenticated): SELECT WHERE status = 'published'
-- Admin (authenticated):    SELECT all statuses for their pages
-- Editor + Owner:           INSERT / UPDATE WHERE status = 'draft'
-- Owner only:               INSERT / UPDATE WHERE status = 'published'
-- RLS is the authoritative security gate. Client-side role checks are clarity only.

-- ── No SQL action required ────────────────────────────────────────────────────
-- If you are deploying Phase 16 to a new environment that has not run Phase 7,
-- run supabase/phase-7-visual-controls.sql first. Then Phase 16 works without
-- any additional SQL.
