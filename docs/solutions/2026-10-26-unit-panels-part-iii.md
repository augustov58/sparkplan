# One unit's load had four implementations (#155)

**Problem:** a multifamily unit panel printed 21.5 kVA under "NEC 220.83 — Existing Dwelling" (a 10 kVA / 40% bucket, 220.83's own tier is 8 kVA), while other code computed the same unit three other ways.

## Approach

1. **Count every function that computes one dwelling unit's load before deciding anything.** There were four:
   - `calculateDwellingUnitDemandVA` (unit pages, in-app summary, both exports): 10 kVA bucket, keyword-matched HVAC, labelled 220.83 in existing buildings.
   - The multifamily generator's unit-panel rating (`multiFamilyProjectGenerator.ts`): an inline true 220.82 bucket × 1.25.
   - `calculateMultiFamilyLoad` step 1: `calculateSingleFamilyLoad` per template. It is stored on the template and never displayed.
   - `calculateSingleFamilyLoad` default mode: per-category demand factors labelled "220.82 Optional Method" — it never ran the 220.82 bucket.
2. **Ask the PE which method a unit panel uses**, with the code text and sources in hand. The ruling was Part III by default (always applicable; Annex D4(a) sizes unit feeders by Part III), and 220.83 only when the permit adds load to that unit.
3. **Make the Part III walk exact before relabelling it.** A "Part III" label on non-Part III math would repeat the bug. Three follow-up rulings: Table 220.55 Column C always (Note 3 not taken), 220.53 75% for four or more fastened-in-place appliances, 25% of the largest *motor circuit* (never the A/C).
4. **One core, three adapters.** `calculateDwellingStandardLoad(items)` is the only Part III implementation. `calculateSingleFamilyLoad` feeds it appliance toggles, `calculateDwellingUnitPanelLoad` feeds it panel circuits, and the generator sizes unit panels by calling `calculateDwellingUnitPanelLoad` on the circuits it just wrote.
5. **Protect the bucket methods.** The 220.82 / 220.83 post-process re-pools each row's nameplate `connectedVA`, so the core keeps nameplate there and puts Part III factors only in `demandVA`; the largest-motor row is dropped in bucket mode. The whole existing suite passed unchanged except two label assertions — the check that the refactor didn't move a bucket number.

## Failed hypotheses / traps

- **"The calculator already sizes unit panels by 220.82"** — wrong twice: the value was never displayed, and its math was Part III. Read where a value is consumed before citing it as the reference.
- **`calculateAggregatedLoad` as the circuit-based Part III** — it counts every `K` circuit as a range, so a unit's small-appliance circuits and dishwasher became four ranges under Table 220.55.
- **Small-appliance circuits double-count.** The multifamily generator stores them as `K`, single-family panels as `R`. The circuit adapter matches them by description in any load type and enters them as 220.52 1,500 VA circuits; the 220.83 path filters them out before `calculateDwellingPanelDemand` adds them structurally.

## Judgment calls

- **"Other" appliances in the calculator stay at 100%, outside 220.53**: not known to be fastened in place.
- **Floor area on a unit panel = its lighting circuits ÷ 3 VA/ft²** (the generator writes them that way); a panel with no lighting circuits prints a warning instead of guessing.
- **The single-family calculator's default (Part III) vs E-101 for a new house (220.82)** is a separate calculator-vs-packet disagreement, not folded in.

## Reusable rule

Before relabelling or fixing a quantity, list every function that computes it and every place that reads it; make the math match the label you print, then route all of them through one core with thin adapters, and prove untouched modes unchanged by running the existing suite before editing any expected value.
