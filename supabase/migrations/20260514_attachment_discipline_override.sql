-- ============================================================================
-- SPRINT 2B PR-3 v5 — per-upload discipline letter override
-- ============================================================================
-- Created: 2026-05-14
-- Branch:  feat/sprint2b-merge-engine
-- Spec:    PR #49 v5 follow-up — contractor wants to override the
--          auto-determined discipline prefix (the letter in "C-201")
--          per upload while keeping the auto-numbered band counter.
--
-- Today: the merge orchestrator picks the discipline from artifact_type
-- (site_plan/survey/hvhz_anchoring → C, everything else → X). That works
-- for the common case, but real plan sets use additional disciplines —
-- A (architectural), S (structural), M (mechanical), P (plumbing). A FL
-- PE submitting through SparkPlan may want a Bluebeam markup that lives
-- in the architect's package to come through as "A-201" rather than the
-- default "C-201".
--
-- Adds `discipline_override` text column to project_attachments.
-- Nullable — NULL means "use the auto-determined discipline from
-- artifact_type" (existing behavior). When set to a single uppercase
-- letter, that letter replaces the auto value on the next packet build
-- but the band counter continues normally (so the rest of the auto-
-- allocated sheet IDs in the packet stay continuous).
--
-- Format expectation (advisory, not enforced at DB level):
--     A single uppercase letter A-Z. The React layer warns on anything
--     else but still saves (feedback_validation_advisory).
-- ============================================================================

ALTER TABLE public.project_attachments
  ADD COLUMN IF NOT EXISTS discipline_override TEXT;

COMMENT ON COLUMN public.project_attachments.discipline_override IS
  'Optional override for the auto-determined discipline letter (the prefix in sheet IDs like C-201). When NULL, discipline is auto-determined from artifact_type (site_plan/survey/hvhz_anchoring -> C; everything else -> X). When set, this letter replaces the auto value but the band counter continues normally.';
