# One charger, 48 A or 60 A: the load and the service check were one number (#192)

**Problem:** under the Calculated 220.87 method, the service check compared the Article 220 load directly with the service rating. Under a measured method the new EV went in at 125%. The same 48 A charger counted 48 A in one check and 60 A in the other. Earlier PE rulings (2026-09-27 / 10-14 / 10-21) said "EVSE at 100% in the Article 220 load", and the code had applied that to the comparison as well.

## Approach

1. **Separate the two quantities before arguing about factors.** The owner's point was that sufficiency is about the service conductors and OCPD, not about the load. The code text agrees:
   - 230.42(A) has the loads determined per Article 220, then sizes the conductors for noncontinuous + 125% of continuous.
   - 230.90 / 110.3(B): a standard 80%-rated main carries continuous load only to 80% of its rating.

   The old rulings were right about the *load* and silent about the *comparison*. Present it that way and the conflict between rulings disappears.
2. **Show the consistency test with numbers.** One charger, three cases (existing in the schedule, added as new, all-new building), under both methods. The table shows where the code was consistent (existing vs new) and where it wasn't (calculated vs measured).
3. **Sweep every service-sufficiency site before planning.** A subagent listed all 27, each with the number it compares and its factor. Tier them:
   - The 6 surfaces that run the Article 220 calcs (E-102, wizard, MF EV / E-402, Dwelling Load Calculator) get the rule.
   - The other 21 sites (Inspector, AI chat, backend, EV templates, legacy calculator) use their own rough rules and get an issue (#193). Changing their factor wouldn't make them correct.
   - E-101 turned out to compare nothing, so it was left alone.
4. **One helper, a separate number.** `continuousServiceAdderVA` returns 25% of the continuous loads under the MDP, split into existing and proposed:
   - EVSE at its edition load, capped at the EVEMS setpoint (existing first).
   - Signs and show windows by description.

   `projectDemandSplit` carries it as `existingAdderKVA` / `proposedAdderKVA`. E-102 prints it as its own line. Dwelling results carry `serviceCheckAmps`. The Article 220 total is never touched.
5. **Check every reader of a flag before flipping it.** The plan was to set the wizard presets' `continuous` flag to false on water heaters. The Dwelling Load Calculator reads the same flag to size branch circuits at 125% (422.13), so flipping it would undersize them. The fix keys the service factor on the template category (EV) in `templateToQuickAmps` and leaves the flag alone.

## Verification

- `tests/serviceCheckContinuous.test.ts` (15 tests):
  - the classifier;
  - one charger, existing or new, adds the same 25%;
  - signs on a subpanel;
  - NEC 2023 7,200 VA floor;
  - EVEMS cap, existing first;
  - orphan panels excluded;
  - the commercial example (new charger 32 A → 40 A);
  - measured signs at 125%;
  - dwelling `serviceCheckAmps` (circuits, toggles, 220.84);
  - wizard available capacity, gauge and presets.
- In the app: wizard and E-102 agree on three QA projects. Single-family: 125 A. Café: 240 A, with its existing sign adding 0.50 kVA. 12-unit EVEMS building: the new load is 204 A under both methods, because the setpoint × 1.25 now applies either way.
- Five tests that pinned "calculated EV at 100%" in the MF EV calculation were updated to the ruling, not deleted. The EVEMS setpoint on the 400 A sample moved from 230 A to 184 A (230 ÷ 1.25).

## Failed hypotheses / traps

- **"125% only applies to a new load."** My own shorthand, and wrong. Under reading A the 125% depended on the method, not on new vs existing. A worked example exposed it within one exchange.
- **E-101 "gains a service-check line."** It was proposed before the sweep. The sweep showed E-101 prints the load and never compares it, so nothing changed there.
- **`recommendServiceSize` takes 80% of the rating**, i.e. 125% of *everything*. It looks like the same rule but is a new-service design margin. The owner chose to leave it.
- **PDF text extraction** in this repo can't reliably match kerned strings. Verify E-102's numbers through its inputs, and check the page in the visual pass.

## Reusable rule

When a ruling says "X at 100%", ask which quantity it covers: the load, or a comparison against a rating. Keep them as two numbers in code, with the adder printed on its own line, so a later ruling on one can't silently change the other.
