# The Panel Schedule's demand table was a second, wrong demand calculation (#191)

**Problem:** `demandFactor.ts::calculatePanelDemand` fed the in-app Panel Schedule's demand table and summary cards with its own per-load-type walk. It took lighting and water heaters at 125%, electric heat at 75% when the panel had four or more heating circuits (citing 220.51, which says 100%), and ran the dwelling lighting tiers (3,000 VA at 100%, the rest at 35%) on every panel, commercial included. The summary card then showed the shared aggregate only when it was *lower* than this walk's total. On a commercial panel with 12 kVA of heat the card read 20.2 kVA where the code gives 21.3 kVA.

## Approach

1. **Find every reader before deciding patch or replace.** `grep calculatePanelDemand` gave one production caller, `PanelSchedule.tsx`. The panel schedule PDF and the packet already printed `calculateAggregatedLoad`'s breakdown. So the wrong numbers were in-app only, and the fix could be a replacement.
2. **Replace, don't patch.** Correcting three constants would have left a parallel implementation with no EVSE edition floor, no EVEMS clamp and its own receptacle, dryer and kitchen rules. The table and cards now read the aggregate run on the panel alone: `calculateAggregatedLoad(panel.id, [panel], panelCircuits, [], occupancy, undefined, necEdition)`. Passing only that panel keeps the "direct circuits" meaning, because the function finds no downstream panels.
3. **Delete the wrong math so nobody reuses it.** `calculatePanelDemand` became `calculatePanelPhaseLoads` (per-phase connected load and imbalance only). The rename makes `tsc` flag every reader, and the tests that pinned the wrong factors went with it.
4. **Keep the one behaviour that depended on the bug.** The card's "(NEC 625.42 EVEMS)" tag appeared because the aggregate was lower than the local walk. With the direct number already clamped, "lower" is never true, so the tag now reads the calculation's own references.
5. **Check the path that has no fixture, in the app.** The EVEMS tag had no QA project, so I built one (four chargers under a 20 kVA setpoint). It showed the first version of the fix was wrong: the card read 20.0 kVA and the table total 46.08. The component's `panelCircuits` list drops the EVEMS marker circuit (so it isn't drawn as a row), and the aggregate needs that marker to clamp. The call now passes the project's circuits; with only one panel in the list, the function still counts that panel alone. The project stayed as a fixture and a second spec test.
6. **Hand-calc scenario that hits each wrong factor at once:** one lighting, one receptacle, one water heater and four heating circuits. Four heaters matter: the 75% factor only fired at four or more.

## Verification

- `tests/panelScheduleDemand191.test.ts`: the hand values through the aggregate on one panel. `tests/calculations-extended.test.ts`: the phase-load tests, renamed.
- UI acceptance in the QA account ("QA Commercial panel"), an independent verifier that added its own circuits (receptacles over 10 kVA, cooling under heating, two motors) and re-checked after the EVEMS correction, `tests/e2e/issues/issue-191.spec.ts` (two tests).

## Reusable lessons

- **Never choose between two calculations by which is lower.** Whenever the wrong one understates, the wrong one wins. One function, one number.
- **A table of factors next to a correct total is still a second calculation.** Check the breakdown's source, not only the headline number.
- **When behaviour depended on a bug (a tag shown because two numbers differed), re-derive it from the calculation's own output** (its references) before removing the difference.
- **A filtered list made for display is the wrong input for a calculation.** Before passing a component's local list to a calc function, read how the list was filtered and what the function expects (here, metadata circuits).
