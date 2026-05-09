-- ============================================================================
-- RISER SERVICE-ENTRANCE + CUMULATIVE VD SUPPORT
-- ============================================================================
-- Created: 2026-05-08
-- Purpose: Persist service-entrance data so the riser diagram can label and
--          calculate the UTIL → MDP segment, and so cumulative voltage drop
--          can be walked from the service down through the panel hierarchy.
--
-- Scope split per ADR (project-level decision, 2026-05-08):
--   * Utility-source facts → columns on `projects` (one project = one utility)
--   * Conductor-run facts  → synthetic row in `feeders` flagged
--                            is_service_entrance=true (mirrors how all other
--                            runs are modeled, so renderFeederLabel can reuse
--                            its existing pipeline)
--
-- See: components/OneLineDiagram.tsx renderFeederLabel/renderPanelGlyph
--      services/calculations/cumulativeVoltageDrop.ts (new in Phase 2)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROJECTS: utility-source columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS service_amps                       INTEGER,
  ADD COLUMN IF NOT EXISTS utility_available_fault_current_a  NUMERIC,
  ADD COLUMN IF NOT EXISTS utility_transformer_kva            NUMERIC,
  ADD COLUMN IF NOT EXISTS utility_transformer_impedance_pct  NUMERIC;

COMMENT ON COLUMN public.projects.service_amps IS
  'Service ampacity (utility-side). Used as the basis for VD load and SC denominator on the service-entrance run. NULL = infer from MDP main breaker.';
COMMENT ON COLUMN public.projects.utility_available_fault_current_a IS
  'Available fault current at point of service, supplied by utility (amps). Used as source for downstream short-circuit chain.';
COMMENT ON COLUMN public.projects.utility_transformer_kva IS
  'Utility transformer rated kVA (when known). Falls back to estimateUtilityTransformer when NULL.';
COMMENT ON COLUMN public.projects.utility_transformer_impedance_pct IS
  'Utility transformer nameplate %Z. Falls back to typical (1.5%–5.75% by size) when NULL.';

-- Sensible bounds. NULL allowed for all (data may be incomplete during early project setup).
ALTER TABLE public.projects
  ADD CONSTRAINT projects_service_amps_range
    CHECK (service_amps IS NULL OR (service_amps > 0 AND service_amps <= 10000)),
  ADD CONSTRAINT projects_utility_fault_current_range
    CHECK (utility_available_fault_current_a IS NULL OR utility_available_fault_current_a >= 0),
  ADD CONSTRAINT projects_utility_transformer_kva_range
    CHECK (utility_transformer_kva IS NULL OR utility_transformer_kva > 0),
  ADD CONSTRAINT projects_utility_transformer_impedance_range
    CHECK (utility_transformer_impedance_pct IS NULL
           OR (utility_transformer_impedance_pct > 0 AND utility_transformer_impedance_pct < 100));

-- ----------------------------------------------------------------------------
-- 2. FEEDERS: service-entrance flag + parallel sets
-- ----------------------------------------------------------------------------
ALTER TABLE public.feeders
  ADD COLUMN IF NOT EXISTS is_service_entrance BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sets_in_parallel    INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.feeders.is_service_entrance IS
  'TRUE for the synthetic UTIL→MDP run. Exactly one allowed per project. Sources are NULL for these rows; destination must be the MDP panel.';
COMMENT ON COLUMN public.feeders.sets_in_parallel IS
  'Number of parallel conductor sets per phase. >=1. Used by VD and SC calcs to derate impedance.';

ALTER TABLE public.feeders
  ADD CONSTRAINT feeders_sets_in_parallel_range
    CHECK (sets_in_parallel >= 1 AND sets_in_parallel <= 10);

-- ----------------------------------------------------------------------------
-- 3. FEEDERS: relax source XOR to allow service-entrance rows with NULL source
-- ----------------------------------------------------------------------------
-- The existing constraint requires exactly one of (source_panel_id, source_transformer_id).
-- Service-entrance rows have neither — the source IS the utility, which we don't model as a row.
ALTER TABLE public.feeders
  DROP CONSTRAINT IF EXISTS feeders_source_and_destination_check;

ALTER TABLE public.feeders
  ADD CONSTRAINT feeders_source_and_destination_check CHECK (
    -- Source rules
    (
      -- Service-entrance: no source row, both NULL
      (is_service_entrance = TRUE
        AND source_panel_id IS NULL
        AND source_transformer_id IS NULL)
      OR
      -- Normal feeder: exactly ONE source (panel XOR transformer)
      (is_service_entrance = FALSE
        AND (
          (source_panel_id IS NOT NULL AND source_transformer_id IS NULL)
          OR
          (source_panel_id IS NULL AND source_transformer_id IS NOT NULL)
        ))
    )
    AND
    -- Destination rules (unchanged): exactly ONE destination
    (
      (destination_panel_id IS NOT NULL AND destination_transformer_id IS NULL)
      OR
      (destination_panel_id IS NULL AND destination_transformer_id IS NOT NULL)
    )
  );

-- Service-entrance must terminate at the MDP (a panel), not a transformer.
-- (Utility→transformer→MDP is uncommon for our market and would be a separate model.)
ALTER TABLE public.feeders
  ADD CONSTRAINT feeders_service_entrance_destination_is_panel CHECK (
    is_service_entrance = FALSE
    OR destination_panel_id IS NOT NULL
  );

-- Enforce one service-entrance feeder per project.
CREATE UNIQUE INDEX IF NOT EXISTS idx_feeders_one_service_entrance_per_project
  ON public.feeders (project_id)
  WHERE is_service_entrance = TRUE;

-- ----------------------------------------------------------------------------
-- 4. Backfill notes
-- ----------------------------------------------------------------------------
-- No backfill: existing projects/feeders work unchanged. Service-entrance rows
-- are created on demand when a user populates the new "Service Entrance" form.
-- Existing service voltage/phase remain on `projects.service_voltage` /
-- `service_phase`. New columns are additive.
