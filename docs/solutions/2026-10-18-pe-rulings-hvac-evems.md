# PE rulings: EVEMS setpoint ×1.25, 220.83(A)/(B), 220.84 heat at nameplate (#131–#133, #137)

**The problem:** three NEC questions from the 2026-10-14 QA were answered by the PE (Augusto). Each one changed a quantity that 3+ code paths compute independently, and one path (E-301) was found computing a dwelling quantity with a different function from the start.

## The approach

1. **One worked example per question, on a real QA job, before asking.** Show both readings with real numbers and say where the verdict flips: St. Pete 187.8 vs 197.3 kVA; Orlando 33.2 vs 27.2 kVA; 12 units 32.0 vs 49.2 kVA. The PE answered each in one line.
2. **Sweep before editing.** `grep -rn "0\.65\|65%"` plus `grep "220\.84(C)"` found all three 220.84 heat sites, plus a comment in the generator and a UI label. `grep -rli setpoint` found every EVEMS consumer, including two labels that would have lied after the change ("EVEMS setpoint" next to a setpoint × 1.25 value).
3. **#131 needs a sizing change, not just a factor.** Multiplying the setpoint by 1.25 alone makes every EVEMS design fail by construction, because the setpoint was 90% of the headroom. Size it as `available × 0.90 ÷ factor` (`multiFamilyEV.ts`), and the in-app gauge must multiply by `evLoad.demandFactor` too.
4. **#132: decide the branch once.** `calculateDwellingDemandSplit` runs the calculation twice (existing-only and total). Compute `hasProposedHvac(allCircuits)` once and pass `hvacProposed` to both runs. Otherwise the existing-only run, which has no proposed circuits, picks (A) while the total picks (B), and existing + proposed ≠ total.
5. **The Dwelling Calculator had no way to know a proposed load was HVAC.** `proposedLoads` became `otherAppliances` without their `category`. Carrying `category` through lets a proposed 'HVAC' row become an HVAC row, at 100% under (B), instead of falling into the 40% bucket.
6. **The visual pass found E-301 disagreeing** (35.9 vs 27.2 kVA). Cause: `PanelScheduleDocuments.tsx` called `calculateDwellingUnitDemandVA` (10 kVA knee, no 3 VA/ft², HVAC always at 100%) and labeled it 220.83. Fix: thread `singleFamilyDwellingContext` + `necEdition` into `PanelSchedulePages` and call `calculateDwellingPanelDemand`.

**Failed hypotheses:**
- "The St. Pete prefill applies 1.25 twice." No: its 37.8 kVA marker came from the old 157.5 A setpoint. The E-102 FAIL came from the stale stored 154.80 kVA field. The prefill only fills an empty field.
- "DLC vs E-101 base mismatch is a new bug." No: `settings.residential.multiFamilyLoadResult` is a stored result computed with the old rule. It refreshes only when the calculator reruns.

## The judgment calls

- **Legacy `loadCalculation.ts` stays on 220.83(B).** `LoadItem` has no existing/new flag, so (A) can't be detected. It stays on the conservative branch and adds a note pointing to the Dwelling Calculator. Defaulting to (A) without knowing would understate the load.
- **The calculated (220.84) path keeps the setpoint at 100%.** The ruling is about the 220.87(2) comparison; the EVSE stays at 100% inside Article 220 load calcs (PE 2026-09-27).
- **The multiFamilyEV simplified path keeps its assumed 10 kW/unit heat**, now at nameplate and labeled "assumed". It has no per-unit data, and inventing an A/C default was out of scope.
- **The E-301 fix covers the single-family service panel only.** Multifamily unit panels and the standalone panel export still use the heuristic; filed rather than widened.

## The reusable rule

Before applying a demand factor, find it in the text of the section you cite; a factor valid in one Optional Method (220.82(C) 65%) is not valid in another (220.84). When a ruling changes a quantity, grep every function that computes it AND every label that names it, and when one calculation runs twice (existing/total), make the branch decision once and pass it to both.
