-- ============================================================================
-- SPRINT 2B PR-4 — extend project_attachments.artifact_type CHECK to 14 values
-- ============================================================================
-- Created: 2026-05-14
-- Branch:  feat/sprint2b-orlando-manifest
-- Spec:    docs/sprints/sprint2b-uploads.md (PR-4 manifest scaffold)
--          memory: audit_sprint2b_pr4_ahj_aware_visibility.md
--
-- Adds six new artifact_type values surfaced by Sprint 2C parallel AHJ
-- research (2026-05-12) across Miami-Dade, Pompano Beach, Davie, and
-- Hillsborough/Tampa. Each maps to a specific Sprint 2C H-finding:
--
--   zoning_application            — H21 Pompano (Zoning Compliance Permit)
--   fire_review_application       — H22 Pompano + Davie commercial
--   notarized_addendum            — H25 Davie (contractor + owner)
--   property_ownership_search     — H26 Davie BCPA.NET printout
--   flood_elevation_certificate   — H30 Hillsborough flood zones
--   private_provider_documentation — H33 Hillsborough FS 553.791 alt path
--
-- The Orlando manifest (PR-4) does NOT list any of these in its
-- relevantArtifactTypes — they're added to the DB enum NOW so Sprint 2C
-- M1's per-AHJ manifests can wire them up to the appropriate AHJ
-- visibility predicates without another migration.
--
-- CHECK constraint must be dropped + recreated (Postgres CHECKs don't
-- support ADD VALUE like enums). Pattern matches PR-3's
-- 20260513_attachment_hvhz_anchoring.sql.
-- ============================================================================

ALTER TABLE public.project_attachments
  DROP CONSTRAINT IF EXISTS project_attachments_artifact_type_check;

ALTER TABLE public.project_attachments
  ADD CONSTRAINT project_attachments_artifact_type_check
  CHECK (artifact_type IN (
    -- Sprint 2B PR-1 originals (7 values)
    'site_plan',
    'cut_sheet',
    'fire_stopping',
    'noc',
    'hoa_letter',
    'survey',
    'manufacturer_data',
    -- Sprint 2B PR-3 H19 statewide HVHZ
    'hvhz_anchoring',
    -- Sprint 2B PR-4 (this migration) — 6 new artifact types for
    -- Sprint 2C AHJ manifests (Pompano, Davie, Hillsborough)
    'zoning_application',
    'fire_review_application',
    'notarized_addendum',
    'property_ownership_search',
    'flood_elevation_certificate',
    'private_provider_documentation'
  ));

COMMENT ON COLUMN public.project_attachments.artifact_type IS
  'Discipline of artifact. Drives manifest slotting + sheet ID discipline prefix (E- electrical / C- civil / X- manufacturer). 14 values total. Sprint 2B PR-3 added hvhz_anchoring (H19 statewide HVHZ); PR-4 added zoning_application (H21), fire_review_application (H22), notarized_addendum (H25), property_ownership_search (H26), flood_elevation_certificate (H30), private_provider_documentation (H33) — Sprint 2C M1 wires each to per-AHJ manifest visibility predicates.';
