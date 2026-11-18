# The DC fast charger template hard-coded sizes below 125% of its own load (#249)

**Problem:** The EV Panel Builder's "DC Fast Charge (150kW)" fixed its circuit at 180 A, a 225 A breaker and 3/0 Cu. Every calc takes the charger as `loadVA: 150000`, which is 180.4 A at 480 V 3Φ, so 125% is 225.5 A. The breaker was one standard size short. 3/0 Cu (200 A at 75 °C) sat below 225 A even at a round 180 A.

## Approach

1. **The "assumption" question already had an answer in the data.** The issue asked which input current to assume, but the app already assumed one: `loadVA = 150000` drives the load calc, the service check and EVEMS. Sizing the circuit from any other number would make two pages disagree about one charger (Mistake Ledger: pages reporting one quantity share the input). A *higher* nameplate input would change `loadVA` everywhere, which is a new ruling, not this fix.
2. **Reuse the sibling path's rule instead of new arithmetic.** The Level 2 amps override already computes `getNextStandardBreakerSize(amps × 1.25)` and `findConductorByAmpacity(breaker, 'Cu', 75)`. The DC fast case now does the same from `loadVA / (V√3)`, so a future preset can't drift.
3. **A test that holds across charger types:** for every type, breaker ≥ 1.25 × the charger current, and the conductor is the one rated for the breaker. Level 2 stays 60 A / 6 AWG and 100 A / 3 AWG.
4. **Look for the same quantity in other tools.** The EV Charging calculator's DC presets list input currents *below* their output (150 kW at 160 A = 133 kVA). Filed as #264, since picking preset currents is the same open question.

## Verification

- `tests/dcfcTemplateSizing249.test.ts`: 3 of 4 fail on `main`; the Level 2 test passes on both by design.
- `tests/e2e/issues/issue-249.spec.ts`: the option label and the panel line. It fails on `main`.
- UI: created a 2-charger panel. The circuits were 250 A, 3-pole, 250 kcmil Cu, 150,000 VA. The panel was then deleted.
- Independent verifier.

## Reusable lessons

- **When an issue asks "which value should we assume?", check whether the app already assumes one somewhere.** If it does, the fix is to make every reader use that value, and changing the value itself is the separate question.
- **Hard-coded sizes next to a computed path are drift waiting to happen.** Compute them with the same helpers.
