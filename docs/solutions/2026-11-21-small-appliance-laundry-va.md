# Whole dwellings took small-appliance / laundry circuits at a flat 1,500 VA (#282)

**Problem:** the NEC 220 Part III dwelling walk (`residentialLoad.ts::calculateDwellingStandardLoad`) counted small-appliance and laundry circuits as count × 1,500 VA. 220.52(A)/(B) say "**not less than** 1500 volt-amperes for each", so a 2,400 VA circuit counted 1,500. #217 had already fixed this for single-family subpanels; the owner ruled (2026-11-21) that whole dwellings follow too, without changing generated or template projects — naming the sample template's "Small Appliance Circuits - 2 @ 1,500 VA" 3,000 VA row.

## Approach

1. **List every Part III walk and where its counts come from.** Five callers: new single-family house (`calculateSingleFamilyPanelLoad`, counts from the project's residential settings), multifamily unit panel (`calculateDwellingUnitPanelLoad`, counts from circuits), two-unit walk (`calculateTwoUnitDwellingLoad` via `upstreamLoadAggregation`), the single-family subpanel (#217; left as is, ruling 4a) and the toggles path (no circuits; unchanged).
2. **Pass per-circuit VA into the walk** (`smallApplianceCircuitVA`, `laundryCircuitVA`) and compute once in `circuits220_52VA(counted, listed, 1500)`.
3. **Check the guard against the real data first.** Template projects never store their `loads` as circuits (`createProjectFromTemplate` → `useProjects.createProject` drops them; a fresh template project has 0 circuits). The generators write 1,500 VA per circuit. "Kitchen Receptacles" at 1,800 VA (panel templates) don't match `/small appliance/`.
4. **Then run the existing suite.** Three tests failed: a hand-typed house with one "Small appliance" row of 3,000 VA and a settings count of 2 — the template's shape without "2 @". The first implementation (count × 1,500 + each row's excess) turned it into 4,500. Fix: when fewer circuits are listed than counted, the listed rows hold all of them (larger of their total or count × 1,500); "N @" rows split into N circuits.

## Found on the way

The multifamily MDP's 220.84 total already takes a circuit's raw VA (raising one unit's small-appliance circuit to 2,400 moves the MDP on `main` too), while the single-family Optional Methods use a flat 1,500. The acceptance had expected the MDP not to move; it was corrected with the reason, and reported on #291 (Optional Method scope question).

## Reusable rules

- **"Not less than X for each" is a floor per item, not a fixed value.** Before applying a per-item constant, read the section's wording.
- **A "don't change templates" guard: find the template's data in the database, not only in the source file.** A template row in code may never become a circuit; the existing tests that copy its shape are the real guard.
- **When a count and the listed rows can disagree, decide what the rows mean before applying a per-row rule** (here: fewer rows than counted = the rows hold all circuits).
