-- ============================================================================
-- SPRINT 2B PR-3 — per-upload SparkPlan cover toggle
-- ============================================================================
-- Created: 2026-05-14
-- Branch:  feat/sprint2b-merge-engine
-- Spec:    PR #49 v2 review (user surfaced two flexibility issues on
--          2026-05-14 — the Royal Caribbean A100 already has its own
--          architect title block, so SparkPlan's added title sheet +
--          sheet ID stamp is redundant for those uploads).
--
-- Adds `include_sparkplan_cover` boolean to project_attachments. Default
-- TRUE preserves the existing behavior (SparkPlan renders a title sheet
-- + stamps sheet IDs on every page of the upload). FALSE skips both —
-- the upload is appended to the merged packet as-is, carrying only its
-- own architect-supplied title block + sheet numbering.
--
-- The contractor toggles this per-upload in AttachmentUploadCard.
--
-- Existing rows: the DEFAULT TRUE + NOT NULL constraint backfills cleanly
-- on the existing pilot tables (only a handful of project_attachments rows
-- exist as of 2026-05-14).
-- ============================================================================

ALTER TABLE public.project_attachments
  ADD COLUMN IF NOT EXISTS include_sparkplan_cover BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.project_attachments.include_sparkplan_cover IS
  'Per-upload toggle: TRUE = SparkPlan title sheet rendered + sheet ID stamped on upload pages (default). FALSE = upload appended as-is, no SparkPlan title sheet, no bottom-right stamp — for pre-bordered uploads (e.g., architect-prepared A100 with full title block).';
