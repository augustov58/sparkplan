# The EV Charging calculator turned a user's planning % into an NEC demand factor (#198)

**Problem:** `evCharging.ts::calculateEVDemandFactor` took the user's "simultaneous use %" and multiplied it by 1.1 / 0.95 / 0.85 / 0.75 depending on the charger count. It printed the result as the "Demand Load" under "NEC 625.44". It was the second copy of the factor #194 removed from the EVEMS tool, found by grepping the function name during #194. Unlike the EVEMS copy it had a user input behind it, so the fix needed a PE ruling first: keep the % or drop it.

## Approach

1. **Get the ruling before the Acceptance values.** The two options give different screens: keep the % as a labelled line, or remove the input. The ruling (2026-11-13) was to keep it as a design assumption, outside the NEC load. It is written into the issue body above the Acceptance section, so the verifier's criteria and the ruling travel together.
2. **Pick steps that hit every old multiplier:**
   - 4 chargers at 100% (the ×0.95 bucket);
   - 12 at 60% (×0.85);
   - 2 at 50% (×1.1, the only bucket that *raised* the load);
   - a Level 1 charger under NEC 2023 (the 220.57(A) floor).

   Each step shows that the expected peak is exactly the entered %, with no multiplier left.
3. **Two numbers, two boxes.** The NEC load (100%, cited by edition) goes in the "System Load (NEC Article 220)" card. The assumption goes in a separate dashed box titled "Design Assumption (not an NEC load)". The input label says "(design assumption)" too. A reviewer can't mistake one for the other.
4. **Rename the result fields.** `demandLoad_kVA` / `demandFactor` became `necLoad_kVA` / `expectedPeak_kVA`, so `tsc` flags every reader of the old meaning. The edition input is required, as in #194.
5. **Fold in the wrong citations on the same card.** "625.40 – Branch circuit conductors (125%)" and "625.42 – Overcurrent protection" were wrong: 625.41 is overcurrent protection at 125%, and 625.42 is the continuous-load rule. They print on the card being fixed, so the fix went in the same PR rather than a new issue.

## Verification

- `tests/evCharging.test.ts` (4 tests): the hand values, NEC 2020 vs 2023, the citations, and the unchanged circuit sizing.
- UI acceptance in the QA account: every step matched. Guardrails held: 40 A / 8 AWG / 10 AWG at 32 A, 20 A / 12 AWG at Level 1, and voltage drop 1.04% / 2.63%.
- Independent verifier given only the Acceptance section; `tests/e2e/issues/issue-198.spec.ts`.

## Reusable lessons

- **A user-entered % is not the problem; where it lands is.** An assumption can stay if it is printed as one, on its own line, and nothing downstream reads it as the code load.
- **A filed "needs ruling" issue should list the options in the order you'd recommend.** The owner answered "go with the proposed option". The first option listed became the ruling, so record which option that was in the issue.
