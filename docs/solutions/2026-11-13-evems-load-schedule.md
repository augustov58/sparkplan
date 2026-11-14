# The EVEMS tool's load schedule contradicted the result above it (#199)

**Problem:** with EVEMS on, the "Load Schedule (with EVEMS)" card was built from fixed multipliers:
- EV load × 0.5 / 0.9 / 0.7;
- existing demand × 1.2 / 0.6 / 1.0;
- available capacity × 0.7 / 1.1 / 1.0.

It showed charging above the setpoint, left out the 25% service-check adder, and printed "Available" figures that were not the service minus the slot's load.

## Approach

1. **The owner ruled on the named fix:** cap each slot's EV at the setpoint and add the 25%.
2. **Check what the ruled fix would still leave broken, before writing code.** Applying just that rule, the peak slot's "other" stayed at 120% of the existing demand. That is above the maximum the user entered. On the QA inputs it landed at exactly 100%; with 30 kVA existing it would print 108.8% while the result card passed at 95%. That was one more question, asked with both tables as previews. The answer was to cap "other" at the entered demand.
3. **One formula per slot**, so the printed numbers agree by construction:
   - EV = min(share × full EV load, setpoint);
   - +25% = EV × 0.25;
   - Total = Other + EV + 25%;
   - Available = service − Total.

   The slot shares live in one table (`LOAD_SCHEDULE_SLOTS`), labelled as an illustration in the code.
4. **Pick acceptance steps where the cap binds and where it doesn't:**
   - 4 chargers: the setpoint caps off-peak and daytime;
   - 2 chargers: every share is below the setpoint.

## Verification

- Unit tests:
  - both tables;
  - a sweep (charger counts 1/2/4/12 × existing demand 10/24/30/40 kVA) asserting no slot's EV exceeds the setpoint and no slot's utilization exceeds the result card's.
- UI acceptance in the QA account: every slot value matched. The result card was unchanged (45.6 kVA / 95.0% and 43.2 kVA / 90.0%).
- An independent verifier; `tests/e2e/issues/issue-199.spec.ts`.

## Reusable lessons

- **An illustration can use made-up shares, but it must obey the calculation it illustrates.** Caps, adders, and inputs that are maxima all apply. State that as an invariant and test it with a sweep, not one example.
- **A ruling covers what it names.** When an adjacent number in the same card would still break the invariant, ask, and show the two outcomes side by side.
