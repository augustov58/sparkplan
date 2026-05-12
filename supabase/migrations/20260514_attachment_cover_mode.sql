-- ============================================================================
-- SPRINT 2B PR-3 v4 — 3-mode cover behavior (separate / overlay / none)
-- ============================================================================
-- Created: 2026-05-14
-- Branch:  feat/sprint2b-merge-engine
-- Spec:    PR #49 v4 review (2026-05-14) — the existing boolean
--          include_sparkplan_cover is too coarse for the real-world
--          mix of uploads. A contractor uploading a bare Bluebeam
--          markup PNG-on-PDF or a Google Earth screenshot wants the
--          SparkPlan title block ON the page (overlay), not as a
--          standalone preceding sheet (separate, current default).
--          They still want the "as-is" path for HOK-style pre-bordered
--          drawings (none).
--
-- Transition: drop the boolean, add a 3-state enum:
--   'separate' — current default cover behavior (title sheet preceding upload)
--   'overlay'  — title block composited ONTO the upload's first page
--   'none'     — upload appended as-is, no SparkPlan ceremony
--
-- Safe to drop the boolean here: it was added in PR-3's commit 7
-- (20260514_attachment_include_sparkplan_cover.sql, applied same day).
-- The pilot project_attachments rows have either the default TRUE
-- (→ 'separate') or were explicitly toggled FALSE (→ 'none'). No
-- 'overlay' rows exist yet — that mode is brand-new in this migration.
-- ============================================================================

-- Step 1: add the new column with a default so existing rows don't violate NOT NULL.
ALTER TABLE public.project_attachments
  ADD COLUMN IF NOT EXISTS cover_mode TEXT NOT NULL DEFAULT 'separate';

-- Step 2: CHECK constraint pins the enum values.
ALTER TABLE public.project_attachments
  DROP CONSTRAINT IF EXISTS project_attachments_cover_mode_check;
ALTER TABLE public.project_attachments
  ADD CONSTRAINT project_attachments_cover_mode_check
  CHECK (cover_mode IN ('separate', 'overlay', 'none'));

-- Step 3: backfill from the existing boolean. Idempotent — if commit 7's
-- column has already been dropped (e.g., re-running this migration), the
-- UPDATE is a no-op against the new default.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_attachments'
      AND column_name = 'include_sparkplan_cover'
  ) THEN
    UPDATE public.project_attachments
      SET cover_mode = CASE
        WHEN include_sparkplan_cover = TRUE THEN 'separate'
        ELSE 'none'
      END;
  END IF;
END $$;

-- Step 4: drop the boolean. Safe per the header comment — no production
-- data depends on it beyond the backfill above.
ALTER TABLE public.project_attachments
  DROP COLUMN IF EXISTS include_sparkplan_cover;

COMMENT ON COLUMN public.project_attachments.cover_mode IS
  'How the SparkPlan title block is applied: separate (own page preceding upload, current default), overlay (composited onto upload page itself), none (upload appended as-is).';
