# A method switch exposed untyped template circuits (#178)

**Problem:** for a new single-family house, the Dwelling Load Calculator defaulted to NEC 220 Part III. The packet (E-101, E-102, Panel Summary, exports) always printed NEC 220.82. PE ruling 2026-10-27: the calculator's choice prints everywhere, and the default stays Part III.

## Approach

1. **Carry the choice through the existing gate.** `buildSingleFamilyDwellingContext` (the single gate every page uses, #121) now returns `useOptionalMethod`, read from `settings.dwelling_calc_mode`.
2. **One function for the three methods.** `calculateSingleFamilyPanelLoad` returns a `DwellingPanelLoadSummary`, the same shape the unit panels print. It handles all three cases:
   - an existing house, or 220.82 selected: `calculateDwellingPanelDemand`, through `dwellingSummaryFromOptionalMethod`;
   - otherwise: `calculateDwellingStandardLoad` on the MDP circuits. Lighting comes from the floor area and the 220.52 circuits from settings, as the calculator counts them.

   Part III rows come from `partIIISummary`, which `calculateDwellingUnitPanelLoad` shares.
3. **Readers:**
   - E-101 renders the Part III rows when that method applies.
   - E-102's `calculateDwellingDemandSplit` runs the same function on all circuits and on existing circuits.
   - The in-app Panel Summary shows the rows card for Part III.
   - `dwellingLoadSummaryFor` (MDP schedule, both exports) calls the same function.
4. **Pin the agreement.** One house computed from the calculator's toggles and from the panel's circuits gives the same 43,925 VA.

## Failed hypotheses / traps

- **"Unit tests with typed fixtures are enough."** The QA project came from the "2000 sq ft Single-Family Home" template, which stores no load types, so every circuit was the default 'O'. Part III then read the range and the A/C as 220.53 appliances at 75%, and 17 receptacle circuits as "fastened appliances". The 220.82 bucket had hidden this, because it pools everything except the A/C — which also went into the 40% bucket instead of the 220.82(C) 100% row. Fix: `dwellingLoadType` infers a type from the description, only when the type is 'O'. Receptacle, refrigerator and lighting map to the allowances; then air handler → motor, A/C or heat pump → C, heat or furnace → H, dryer → D, range/oven/cooktop → K, water heater → W. Both circuit adapters use it: `dwellingLoadsFromCircuits` and `calculateDwellingPanelDemand`.
- **"Air handler" read as heating** would drop the blower under 220.60 non-coincidence. It's matched as a motor first, so it counts and is a largest-motor candidate.

## Judgment calls

- Existing houses: unchanged numbers. Checked against the 10-26 Orlando fixture: 27.20 kVA, 220.83(A).
- Saved new-house projects with no stored choice move from 220.82 to Part III on their next packet, as the ruling's default implies. This is at the top of the CHANGELOG and the PR.
- The calculator (appliance toggles) and the packet (circuits) still read different inputs. On a templated project with no toggles set, the calculator shows only the general loads. That's a separate inputs question, not the method.

## Reusable rule

Before switching a circuit-based calculation to a method that branches on load type, run it on the circuits a project template actually writes. Infer the type from the description only when the type is the 'O' default.
