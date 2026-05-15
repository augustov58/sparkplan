-- Track whether a circuit is a new (proposed) addition vs an existing circuit.
-- Drives the asterisk marker on permit-packet panel-schedule pages and the
-- Existing/New badge in the in-app panel schedule UI.
--
-- Backfill is intentionally simple: every pre-existing circuit defaults to
-- `false` (= existing). For projects with service_modification_type =
-- 'new-service' (new construction), the UI hides the toggle entirely so the
-- false default is harmless — every circuit is implicitly new.

ALTER TABLE public.circuits
  ADD COLUMN IF NOT EXISTS is_proposed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.circuits.is_proposed IS
  'When true, the circuit is a proposed addition (post-existing-service). Renders with "* = Proposed new circuit" marker on permit-packet panel schedules. Meaningful only for projects where service_modification_type != ''new-service''.';
