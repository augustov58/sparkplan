-- Track whether a panel is a new (proposed) installation vs an existing panel.
-- Mirrors the existing circuits.is_proposed pattern (migration 20260514) up
-- one level in the equipment hierarchy.
--
-- Drives the "PROPOSED — NEW INSTALLATION" badge on the per-panel schedule
-- header, the dashed-outline + "NEW" treatment in the riser PDF + in-app
-- One-Line Diagram, and (via aggregation) the cover-sheet scope-of-work
-- summary.
--
-- Backfill is intentionally simple: every pre-existing panel defaults to
-- `false` (= existing). For projects with service_modification_type =
-- 'new-service' (new construction), the UI hides the toggle entirely so the
-- false default is harmless — every panel is implicitly new and the
-- EXIST/NEW differentiation is suppressed at the renderer level.
--
-- The MDP / service main is always considered existing in an
-- existing-construction project; the contractor is adding sub-panels TO an
-- existing service, not replacing the MDP. The form auto-checks the toggle
-- only on non-MDP panels (is_main !== true).

ALTER TABLE public.panels
  ADD COLUMN IF NOT EXISTS is_proposed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.panels.is_proposed IS
  'When true, the panel is a proposed new installation (vs an existing panel being modified). Renders with dashed border + "NEW" badge on the riser diagram + "PROPOSED — NEW INSTALLATION" tag on the panel-schedule cover. Meaningful only for projects where service_modification_type != ''new-service''.';
