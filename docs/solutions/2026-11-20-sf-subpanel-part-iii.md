# A single-family subpanel's feeder ran the per-type cascade (#217)

**Problem:** on a single-family dwelling, the service (MDP) ran NEC 220 Part III over every circuit (#178, #216), but a subpanel's own aggregate (its feeder, the MDP's feed-thru row, its Panel Summary) ran the generic per-type cascade: lighting at 100%, receptacles under the non-dwelling 220.44, the largest motor at 125%. The shared Part III walk (`calculateDwellingStandardLoad`) couldn't simply be reused, because it assumes a whole dwelling: it always adds 2 small-appliance circuits and drops receptacle circuits as "inside 3 VA/ft²". On a subpanel that adds 3,000 VA nobody connected and drops real receptacle load. Which way to go was a PE question.

**Ruling (2026-11-20):** (a) count only the small-appliance circuits on the subpanel; (b) count its receptacles at their VA inside the Table 220.42 tiers.

## Approach

1. **Parameterize the walk, don't fork it.** `DwellingStandardInput.minimumSmallApplianceCircuits` (default 2, the subpanel passes 0), and `dwellingLoadsFromCircuits` now also returns `receptacleVA`. `calculateSingleFamilySubpanelLoad` adds the receptacles to the lighting before the 220.42 tiers. Everything else (220.53, Column C, 220.54, 220.60, largest motor) is the same walk.
2. **Route by role in the one aggregate.** `dwellingPanelRole` gains `'subpanel'` (dwelling project, `multiFamily: false`, not the MDP, not a unit panel). The demand helper now takes the summary function, so unit panels and subpanels share the "rows sum to connected, 0% row for what's inside allowances" code (#160).
3. **Check every reader passes the dwelling options.** All non-MDP readers (panel schedule card, feed-thru rows, Feeder Manager / feeder sync, feeder PDF rows, packet panel pages, EV builder preview) pass `dwellingAggregateOptions(project)`. A caller with no options can't tell single-family from multifamily, so it keeps the cascade.
4. **A fixture that tells old from new.** The existing "QA SF subpanel" garage (2,400 VA of general load, under 3,000) gives the same 12,330 VA by both methods. "QA SF subpanel 217" was built with the issue's example (3,300 VA general load, so the 35% tier applies): 5,355 vs 5,550 VA.
5. **Don't let an unruled sub-case silently drop load.** The verifiers found more whole-dwelling rules in the walk: refrigerator circuits left out (220.52(A) Exception), and small-appliance and laundry circuits at a flat 1,500 VA. On a subpanel a 1,200 VA garage fridge would add 0. The PR counts them at their VA, with the excess over 1,500 VA taken circuit by circuit (a second review caught a sum that let one large circuit absorb another's minimum), and files the question (#282).
6. **Same flag everywhere.** The packet decided "multifamily" from whether a `MultiFamilyContext` existed (absent without a unit count); the app from `dwellingType`. The packet now takes the app's flag (`dwellingMultiFamily`).
7. **Label what the walk is.** The summary cites "Standard Method (Single-Family Subpanel)" and its general row "Lighting + general-use receptacles + small appliance + laundry", not the unit wording.

## Verification

- `tests/sfSubpanel217.test.ts`: the issue example (5,355), a subpanel with a small-appliance circuit (5,880), the garage fixture (12,330), the summary = the aggregate, plus guardrails (a unit panel keeps the 2-circuit minimum; no options or multifamily → cascade). 4 fail on `main`.
- `tests/dwellingFeeders179.test.ts`: its "#217 pending" pin moved to the ruled 5,355; the single-family "Guest House" case to its Part III value.
- `tests/e2e/issues/issue-217.spec.ts`: Pool Subpanel summary 5.4 kVA / 22.3 A, the feed-thru row, the feeder Load; fails on `main` (5.5 kVA).
- Independent verifier.

## Reusable lessons

- **A walk built for a whole thing has whole-thing floors.** Before reusing it on a part, list its minimums and allowances (2 SA circuits, 3 VA/ft²) and decide each one for the part.
- **Pick a fixture where the old and new rules disagree.** Two methods can agree on a small case (here, under the first 3,000 VA tier), and then a spec passes on `main` and proves nothing.
