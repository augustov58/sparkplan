-- #283 (owner ruling 2026-11-21, option b): a feeder keeps the basis it was
-- sized on, so Recalculate re-sizes it the same way and the stale check no
-- longer guesses "capacity-based" from a load within 5% of the panel's rating.
--   'load'     — "Calculated Load": conductors for the design load; the feeder
--                breaker defaults to the next standard size at or above the
--                design current.
--   'capacity' — "Panel Max Capacity": conductors for the destination panel's
--                main breaker, which is the feeder breaker.
-- NULL = sized before this column existed (read as 'load', which is what
-- Recalculate always used). The feeder breaker itself is stored on the
-- destination panel (panels.feeder_breaker_amps).

alter table public.feeders
  add column if not exists sizing_basis text
  check (sizing_basis is null or sizing_basis in ('load', 'capacity'));

comment on column public.feeders.sizing_basis is
  '#283: ''load'' (Calculated Load) or ''capacity'' (Panel Max Capacity); NULL = sized before the column existed (read as load).';
