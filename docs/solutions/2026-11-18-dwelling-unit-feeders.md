# One dwelling unit feeder printed three different loads (#179)

**Problem:** A unit panel's page computes NEC 220 Part III (#155), but nothing else used that function. In a generated 3-unit building, Unit 101's page said 29.7 kVA:
- the Feeder Manager said 36.6 kVA. Neither of its render sites passed `occupancyType`, so it defaulted to `'commercial'` on every project;
- the voltage-drop page also said 36.6 kVA (`computeFeederLoadVA` hard-coded `'commercial'`);
- the MDP's feed-thru row said 37.1 kVA. The per-type cascade with `'dwelling'` counted every `K` circuit as a range, and the generator types small-appliance circuits and the dishwasher as `K`.

House panels had the same split: 16.6 kVA on their page (dwelling lighting tiers), 18.3 kVA at the MDP (connected load at 100%), 19.3 kVA in the Feeder Manager.

## Approach

1. **Reproduce in the generator's own data, not hand-typed fixtures.** The `K` small-appliance circuits are a generator convention. A fixture typed the "right" way would not have shown the "4 ranges" error. The QA project came from the Dwelling Load Calculator's "Generate Multi-Family Project".
2. **Read every number on the path before deciding where the bug is.** Three readers, three answers. The fix is not "change the cascade" but "send every reader to the function the unit page prints".
3. **Put the routing in the shared aggregate, keyed by panel role.** `calculateAggregatedLoad` on a dwelling project now asks `dwellingPanelRole`:
   - unit (the unit page's own test, `isDwellingUnitPanel`) → `calculateDwellingUnitPanelLoad`;
   - multifamily house → the cascade with non-dwelling rules;
   - anything else → unchanged.
   Every caller then agrees without per-caller branches. The house panel's Part III demand also feeds the 220.84 total (220.84(B)), which used to add connected VA.
4. **The role needs two project facts the aggregate didn't have** (multifamily? existing building, for the unit page's 220.83 case). An optional `dwelling` argument, built by one helper (`dwellingAggregateOptions`). **tsc can't see a missing optional argument**, so a script listed all 23 production calls and checked each. The 6 without the argument are MDP-only, load > 0 gates, the EV-panel aggregate, or unused.
5. **Don't edit a Stable Module to pass a prop.** `FeederManager` already loads its project (`getProjectById`), so it derives the occupancy itself. `OneLineDiagram.tsx`, one of its two render sites, stays untouched.
6. **Split what the ruling didn't settle.** The Part III walk enforces 2 small-appliance circuits and drops receptacles into 3 VA/ft². That's right for a whole unit, ambiguous for a single-family subpanel serving part of a house. Filed as a ruling question (#217) with the three candidate numbers, rather than guessed.

## Verification

- `tests/dwellingFeeders179.test.ts` (11 tests): the unit (29,700 = the unit page; rows sum to 36,500 / 29,700), the old cascade values, the feeder design load and the voltage-drop load, the 220.83 existing-unit case, the house panel (19,300; 16,570 without the multifamily flag), the 220.84 and two-unit MDPs, generated house panels unchanged, and the EV panel, single-family subpanel and commercial guardrails. 8 fail on `main`.
- UI ("QA MF feeders"):
  - F-Unit101 flagged "36.6 → 29.7 kVA", then recalculated to 2/0.
  - MDP rows 29.7 / 19.3, total 108.4; MDP 68.6 kVA, 285.7 A; house 19.3 kVA.
  - Packet E-101 68.58 kVA, 286 A; voltage drop 2/0, 123.8 A; E-301 rows 29,700 / 19,300; E-302 19.3 kVA.
- Independent verifier; `tests/e2e/issues/issue-179.spec.ts` (fails on `main`: "Load: 36.6 kVA").

## Reusable lessons

- **A defaulted prop hides a missing caller.** `occupancyType = 'commercial'` made every project commercial in the Feeder Manager for as long as it existed. When a component takes a project fact as an optional prop, check the render sites pass it, or derive it inside.
- **"Same function" means the page's function.** The feeder, the MDP row and the voltage-drop page each called a shared aggregate, but not the function the unit's page prints. Route every reader of a quantity through the function that quantity's own page uses.
- **Found, not fixed (filed):**
  - #216: the single-family service calc reads only the MDP's own circuits.
  - #217: ruling needed, Part III on a partial-dwelling subpanel.
  - #218: Table 220.42 has no "Office Buildings" row ("All others").
