# Saved short-circuit results printed as saved (#278)

**Problem:** the packet (E-102, E-103), the Short Circuit page and its PDFs, the Copilot and Pre-Inspection read `short_circuit_calculations.results` as stored. #258, #276 and #279 changed the calculator, so every older save printed the old numbers (steel fault currents 4–12 % low; AIC from fault × 1.25). The service save also never stored the conductor **sets in parallel**, so an old row couldn't be recomputed exactly.

## Approach

1. **List every reader, then find the choke point.** `grep short_circuit_calculations|useShortCircuitCalculations` → 12 files. Every *live* reader gets rows from `useShortCircuitCalculations` (the packet via `PermitPacketGenerator`, the AI surfaces via `buildProjectContext`, the hierarchy via the page). Two readers were dead: `services/validation/equipmentValidation.ts` (not imported) and the utility-interconnection form (route commented out; uses only "a calc exists").
2. **One recompute function, applied in the hook.** `lib/storedCalcs.ts::recomputeShortCircuitRow` calls `calculateServiceFaultCurrent` / `calculateDownstreamFaultCurrent` with the row's saved inputs (`estimateUtilityTransformer` when no kVA was saved, as both calculators do). The hook maps every row through it, so no reader can forget.
3. **"Can't recompute exactly" is a state, not a guess.** A service row with a conductor and no stored sets → `results.outdated = reason`, values kept, shown "Outdated, re-run" on every surface. Panel rows store every input the calc uses (the downstream calc ignores sets, #286), so they always recompute.
4. **Record what was missing, without a migration.** Both save sites write `results.setsInParallel`; the recompute carries it forward, so it is idempotent.
5. **Outdated rows aren't a source.** `shortCircuitHierarchy.ts` skips an outdated service/panel row and falls back with a warning; otherwise a fresh panel save would inherit the stale (low) value and look "exact".

## Fixture for old saves

`main` can no longer produce an old row, so the QA rows were inserted through the app's own Supabase client (Vite serves `/lib/supabase.ts`; `page.evaluate(() => import('/lib/supabase.ts'))` uses the QA session) with results computed by the **old** formula from `git show 4a1e4cf^:…` (old Table 9, XL × 1.5, AIC × 1.25). The service value reproduced the issue's 8,275 A exactly, which checks the reconstruction.

## Side effects to expect

- Every service save made before this change shows "Outdated, re-run" until re-run (the fixture "QA Short circuit" had to be re-saved).
- Adding a `useMemo` to a mounted hook makes Vite HMR log "change in the order of Hooks" / "Should have a queue". A fresh load is clean; don't chase it.

## Reusable rules

- **Save every input the calc function takes.** Diff the save payload against the function's parameters (`setsInParallel` was passed to the calc but never saved).
- **Recompute stored results where rows enter the app** (the data hook), not in each reader.
- **A value that can't be reproduced is flagged, never filled with a default** — and a flagged value must not feed a new calculation.
