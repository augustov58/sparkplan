# E-102 printed the calculator's 200 A as the service rating (#301)

**Problem:** E-102's "Service Rating" printed the saved service row's `service_amps`, which is whatever the calculator's Service Amps field held. Tools → Short Circuit defaulted it to 200 A / 240 V / 1Φ. The Short Circuit page prefilled `project.service_amps ?? 200`. "QA Short circuit" (no project service amps, MDP main 800 A) printed 200 A on E-102 and 800 A on the riser. When no transformer kVA is entered, those amps also size the estimated utility transformer: 200 A → 225 kVA → 4,297 A at the main, against 11,908 A for 800 A.

## Approach

1. **Owner ruling 2026-11-23 (c):** E-102 prints the project's rating. Both calculators prefill from the project. An estimated service row (no kVA) whose amps differ from the project's rating is "Stale, re-run" in the app and on the packet, like #289.
2. **One definition of "the project's rating":** `shortCircuitHierarchy.ts::projectServiceRatingAmps` returns the project's service amps, else the MDP main. E-102 (`permitPacketGenerator.tsx::availableFaultCurrentInputFor`), the Tools calculator, the page calculator and the Stale rule all call it. The page's own `?? 200` would have made its own saves Stale at once, so it moved too (same area).
3. **Stale through the existing function:** `detectStaleCalculations` gained the service-row rule, so the app card, E-102 and E-103 all mark it from the same call (`packetShortCircuitStale(data)` in the generator, built with the same inputs as the page). The reason starts with `SERVICE_RATING_CHANGED`, so the app banner and the E-103 note word it apart from "upstream changed". It also gives the value at the project's rating (11,908 A).
4. **A required field, not an optional one:** `PermitPacketData.projectServiceAmps: number | null`. tsc listed all 8 builders (1 production, 7 test), so none can silently miss it (Mistake Ledger #179).
5. **Prefill timing:** `useState` initializers run once, and the panels can arrive after the form mounts. Both forms take the rating once it is known, unless the user has typed (a `touched` ref).
6. **Reader sweep:** 6 readers of a row's `service_amps`. Only E-102 printed it as "the service rating". The other 5 describe or recompute the calculation's own input (`recomputeShortCircuitRow`, the card details, the single-calc PDF, E-103's references line "estimated from the 200 A service", the legacy system report), so they stay.

## Traps hit

- **A restore that rewrites the fixture can blind the red test.** The first restores saved the 500 kVA row with the new 800 A prefill, so main's E-102 also printed 800 and step 1 passed on main. The restore now types the fixture's original 200 A. Re-run the spec on main after every change to its restore.
- **`try { … } finally { restore }` hides the real failure** when the restore throws too. Use the `failure` pattern (catch, restore, rethrow the first error).
- **Same-URL `page.goto` doesn't refetch.** Poll the text you expect after a save instead of reading the page once.
- The dev server (a background task) stops at its time limit; a spec that dies mid-run with timeouts may just have lost the server.

## Reusable rules

- **When several readers derive "the" value, define it once and make every reader call it**, including the form prefills, which are readers too.
- **Make a new data field required (`T | null`) when every builder must supply it**; let tsc list the builders.
