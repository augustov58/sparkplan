# The panel short-circuit calc ignored the feeder's parallel sets (#286)

**Problem:** The Short Circuit page's panel calculation showed a "Sets" field, pre-filled from the feeder, but `calculateDownstreamFaultCurrent` took no sets argument. A 2-set feeder was computed as one set: twice the impedance, so a lower fault current, the unsafe direction for NEC 110.9 (22,000 A source, 100 ft 4/0 Cu steel: 13,386 A / 14 kA printed, 16,645 A / 22 kA actual). The service path already divided by its sets.

## Approach

1. **Owner OK first** (`shortCircuit.ts` is a stable module). The change is physics, not an NEC reading: N identical sets in parallel = Z ÷ N, as the service path does.
2. **`ConductorRun.setsInParallel`** (optional, default 1), so callers without a sets field (the Tools calculator's one-set panel mode, the uncalled `analyzeSystemFaultCurrents`) are unchanged.
3. **Recompute-on-read (#278) follows.** Since #278 the project calculator already recorded `results.setsInParallel` on panel saves; the recompute now passes it. A panel row saved before that has no sets → "Outdated, re-run" (the #278 ruling: never recompute with a guessed 1 set). That flips #278's own acceptance row for the legacy LP-1 fixture row (recomputed → Outdated); its spec was updated, as a deliberate value change.
4. **Fixture with a tier change.** The issue's 22,000 A example needs an exact source; the fixture uses a saved service calc (1,000 kVA, 5.75 %, 20 ft 500 kcmil × 3 → 20,344 A) so 1 set vs 2 sets crosses an AIC tier (14 → 22 kA).

## Caught in the UI pass (folded in, same page)

- The page passed the camelCase frontend `Project` to code typed for the DB row (`project as never`), which read `service_voltage`, `service_phase`, `utility_*` → all undefined. Every service prefill was 240 V 1φ at 2.5 %, every panel prefill 1φ, and the utility's available fault current never fed the upstream chain. Fixed by mapping the fields once at the page (`ShortCircuitProject`), and a panel calc takes the panel's own phase (like its voltage).
- Found while building the fixture, filed separately: a 3-phase "Panel Max Capacity" feeder reads Outdated (400.000… A "exceeds" 400 A, #299, a #283 rounding regression); reloading a deep project URL lands on the dashboard (#297).

## Reusable rules

- **A form field that never reaches the calc is a bug.** Diff a form's state against the calc function's parameters (here `feederSets` was in the save payload and the deps list, not in the call).
- **`as never` between the frontend and DB shapes of a row hides undefined fields.** Map the fields the consumer reads, and type the prop as that `Pick`.
- **A new input to a recomputed calc makes older saves non-reproducible.** Apply the flag rule (Outdated), and grep the specs/fixtures that asserted the old recompute.
