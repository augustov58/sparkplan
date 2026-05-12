-- ============================================================================
-- SPRINT 2B PR-3 — add hvhz_anchoring to project_attachments.artifact_type
-- ============================================================================
-- Created: 2026-05-13
-- Branch:  feat/sprint2b-merge-engine
-- Spec:    docs/sprints/sprint2b-uploads.md (H19 finding from Sprint 2C research)
--
-- Adds a new artifact_type value: `hvhz_anchoring`. Surfaced by Sprint 2C
-- parallel AHJ research (2026-05-12) — applies to ANY outdoor pedestal/
-- bollard EVSE statewide in Florida. Documents required:
--   * FL Product Approval, OR
--   * Miami-Dade NOA tie-down details, OR
--   * Signed-and-sealed structural plans
--
-- Cross-validated against Miami-Dade + Pompano Beach AHJs; Pompano enforces
-- despite being outside the HVHZ proper. M1 engine (Sprint 2C) will check
-- presence of this artifact_type for outdoor EVSE projects.
--
-- CHECK constraint must be dropped and re-created (Postgres CHECKs don't
-- support adding values like ALTER TYPE ... ADD VALUE on enums).
-- ============================================================================

ALTER TABLE public.project_attachments
  DROP CONSTRAINT IF EXISTS project_attachments_artifact_type_check;

ALTER TABLE public.project_attachments
  ADD CONSTRAINT project_attachments_artifact_type_check
  CHECK (artifact_type IN (
    'site_plan',
    'cut_sheet',
    'fire_stopping',
    'noc',
    'hoa_letter',
    'survey',
    'manufacturer_data',
    'hvhz_anchoring'
  ));

COMMENT ON COLUMN public.project_attachments.artifact_type IS
  'Discipline of artifact. Drives manifest slotting + sheet ID discipline prefix (E- electrical / C- civil / X- manufacturer). Sprint 2B PR-3 added hvhz_anchoring (Sprint 2C H19): FL Product Approval / MD-NOA tie-down / signed-sealed structural for outdoor pedestal/bollard EVSE statewide.';
