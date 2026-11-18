# The EV Charging calculator sized conductors from an inline list that stopped at 500 kcmil (#269)

**Problem:** `evCharging.ts::getConductorSizeForAmps` had its own ampacity list. Up to 1 AWG it matched the 60 °C column. From 1/0 up it fell between the 60 °C and 75 °C columns. It stopped at 500 kcmil and returned that for anything larger, so a 600 A breaker (350 kW DC) got 500 kcmil Cu, rated 380 A. #264 made the presets carry real currents, which put the cap in reach of a preset.

## Approach

1. **The column question was already answered in the app.** `conductorSizing.ts` applies 110.14(C): 60 °C for ≤ 100 A (14–1 AWG), 75 °C above. Using the same rule kept every copper result ≤ 100 A identical, because the inline list *was* the 60 °C column there. Above 100 A the code text ((1)(b)) is unambiguous. The open part, whether listed EVSE terminals allow 75 °C at ≤ 100 A, is filed as #271. Read what's already decided before asking for a ruling, and split off only the part that's truly open.
2. **The book-checked table instead of a copy:** `findConductorByAmpacity` from `data/nec/table-310-16.ts`, which is pinned by `tests/table-310-16.test.ts`. It returns null past its last row (1000 kcmil) rather than a too-small conductor.
3. **Past one conductor: parallel sets** of 1/0 or larger at 75 °C (310.10(G)). The smallest set count wins: 600 A → 2 × 350 kcmil (620 A). Voltage drop uses each set's share of the current. kcmil sizes past the old circular-mil list are read from their names.
4. **The basis stays the same:** the conductor is rated for the breaker, as before. 240.4(B)'s next-size-up is not applied (#249 leaves that to the PE).

## Verification

- `tests/evConductorTable269.test.ts`: 60 °C ≤ 100 A unchanged; 2/0, 250 kcmil and 600 kcmil above; 2 × 350 kcmil past 1000 kcmil; the 350 kW preset's VD per set.
- `tests/e2e/issues/issue-269.spec.ts`: the calculator for 150 / 350 / 250 kW and Level 2. It fails on `main`.
- Independent verifier.

## Reusable lessons

- **A lookup's fallback of "return the largest row" is a silent undersize** for anything past the table. Return null, or arrange parallel sets, and warn.
- **When a fix makes larger inputs reachable (#264's presets), re-check the tables those inputs flow into.**
