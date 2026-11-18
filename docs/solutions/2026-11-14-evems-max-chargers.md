# "Max chargers with EVEMS" always equalled "without", and hid an unlimited pass (#202)

**Problem:** The EVEMS tool's "Maximum Chargers" card showed the same number with and without EVEMS. "With" divided the largest setpoint by each charger's **full** load. Simplified, the two formulas were 0.72 × available ÷ charger kVA and 0.80 × available ÷ charger kVA, so "with" could never exceed "without", and the "EVEMS allows N additional chargers" line could never appear. Behind it was a bigger gap: with "Use EVEMS" ticked, the EV load is the setpoint whatever the quantity, so 100 chargers passed at 95% with no warning.

## Approach

1. **Spot the constant-ratio comparison.** When two figures differ only by a constant factor, comparing them can never change the answer. Reduce both formulas to a common form before trusting a "with vs without" card.
2. **Ask what the number means under the new model.** An EVEMS fixes the total current, so "how many fit" only has an answer once you set a minimum current per charger. That is a product judgment, not an NEC value, so the owner chose it (2026-11-14, option A: 12 A). The NEC load stays the setpoint plus 25%.
3. **Reuse the minimum already in the codebase.** The Multifamily EV calculator had `minViableAmpsPerCharger = 12`, so the two tools now agree. A charger rated below 12 A uses its own rating as the minimum.
4. **Close the gap with advice, not a block.** The per-charger current at the entered quantity (min(nameplate, setpoint A ÷ N)) goes in the notes, with a warning below 12 A. The result stays compliant, because the NEC service check does pass (validation is advisory).
5. **Fold in the stale note on the same card:** "Consider EVEMS" now shows only when EVEMS is off.

## Verification

- `tests/evemsLoadManagement.test.ts`: 4 new tests. They cover the card on every quantity and toggle, the 32/18/12/10.3 A steps with the warning only at 10.3 A, the note toggle, and √3 for a 3-phase charger.
- UI acceptance in the QA account matched every hand value; independent verifier; `tests/e2e/issues/issue-202.spec.ts`.

## Reusable lessons

- **A capacity limit needs a per-unit floor once a manager can throttle.** With load management, "how many fit" is always "infinitely many" unless you name the minimum each one must get.
- **Known edge:** for chargers rated ≤ 12 A under NEC 2020 (no 7.2 kVA floor), "with" can be one lower than "without". The EVEMS path keeps the 90% setpoint margin and the direct path doesn't. It is left as is, since it's honest about that margin.
