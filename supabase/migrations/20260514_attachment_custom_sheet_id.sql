-- ============================================================================
-- SPRINT 2B PR-3 v4 — per-upload custom sheet ID override
-- ============================================================================
-- Created: 2026-05-14
-- Branch:  feat/sprint2b-merge-engine
-- Spec:    PR #49 v4 review (2026-05-14) — contractor wants to override
--          the SparkPlan auto-allocated sheet ID for an upload (e.g.
--          force "A-100" so the inserted sheet number matches an
--          existing architect's plan-set numbering scheme).
--
-- Adds `custom_sheet_id` text column to project_attachments. Nullable —
-- NULL means "auto-allocate from the SparkPlan band+discipline counter"
-- (the existing behavior). When set, the merge orchestrator uses the
-- contractor-supplied value verbatim as the title sheet ID (cover_mode
-- = 'separate') or composite page ID (cover_mode = 'overlay').
--
-- Format expectation (advisory, not enforced at DB level):
--     <letter><alphanum>-<alphanum-or-hyphens>
--     e.g., "C-201", "A-100", "SP-1", "C-001a", "E-201.1"
--
-- We DON'T enforce the format with a CHECK constraint — validation lives
-- in the React layer where the contractor sees the warning toast and can
-- still save the value (advisory, not blocking — feedback_validation_advisory).
-- ============================================================================

ALTER TABLE public.project_attachments
  ADD COLUMN IF NOT EXISTS custom_sheet_id TEXT;

COMMENT ON COLUMN public.project_attachments.custom_sheet_id IS
  'Optional override for the SparkPlan-allocated sheet ID. When set, used as the title sheet ID (or composite page ID in overlay mode) instead of auto-allocation. NULL = auto-allocate from band+discipline counter.';
