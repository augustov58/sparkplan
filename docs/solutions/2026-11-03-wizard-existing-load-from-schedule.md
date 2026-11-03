# A dead path in the wizard would have printed a raw sum as "calculated" (#185)

**Problem:** the Service Upgrade Wizard called `useCircuits(targetPanel?.id)`, but the hook takes a project ID, so the query matched no rows. With "Use project data" on, the banner said the current load came from the panel schedule while it stayed at the manual default (140 A). The obvious fix, passing the project ID, would have turned on the code behind it, which was also wrong.

## Approach

1. **Run the dead path before fixing it.** On a sample 400 A, 208 V 3-phase building (87.4 kVA connected, 77.2 kVA NEC demand), the raw sum gave 87,400 ÷ 208 = 420 A against the correct 214 A. The gap comes from the missing √3 (177 A) and the skipped demand factors (29 A). With lighting and receptacles on a subpanel, the raw sum read only the main panel's own breakers and gave 207 A: two errors cancelling, so a spot check could have passed. The wizard sets the method to Calculated with project data, so this number would have entered 220.87 with no 1.25×.
2. **Owner decision (option 2):** the existing load is E-102's, the NEC 220 walk on the existing circuits only (#127), not a share of the total demand.
3. **Move the packet's code, don't copy it.** E-102's existing/proposed split was a memo inside `PermitPacketGenerator.tsx`. It moved unchanged to `lib/storedCalcs.ts::projectDemandSplit`, and both the packet and the wizard call it. `scheduleExistingLoadAmps` converts it to amps the way E-102 does (÷ V√3 on 3-phase, ÷ V on 1-phase).
4. **Fold in the same bug for multifamily (owner: include).** The wizard's dwelling branch ran for multifamily too, computing the calculator's unit templates with `housePanelLoad: 0`. It now runs for single-family only (#184's circuit result); multifamily takes the shared function, which runs 220.84 on the actual circuits, house panel included.
5. **Respect the method.** The schedule number is used only under Calculated. A measured or manual method keeps the amps entered, with the 1.25×.

## Verification

- `tests/wizardExistingLoad.test.ts`: 214 A flat and with a subpanel, proposed circuits excluded, 1-phase vs 3-phase, null without a main panel or circuits, multifamily through 220.84 with the house panel, single-family equal to the #184 result.
- Fresh packets from the branch: commercial Miami E-102 85.90 kVA / 238 A, same as the 2026-10-24 fixture; wizard 238 A. 12-unit St. Pete: wizard 698 A = E-101's existing calculated demand 167.50 kVA ÷ 240 V. SF Existing + EV: wizard still 94 A.

## Failed hypotheses / traps

- **The 12-unit E-102 doesn't show the calculated number.** That project's saved 220.87 method is utility billing, so E-102 prints the measured demand × 1.25. Compare the wizard with E-101's existing/proposed split instead.
- **The Current Usage field and the value used are separate.** `effectiveCurrentUsageAmps` drives the result; the input shows `currentUsageAmps`. The old raw-sum effect set the input too, so the new path keeps an effect that writes the schedule value into it.

## Reusable rule

Before fixing a path that never ran, run it and compare its number with the page that prints the same quantity. A reader of a packet quantity calls the packet's function, moved to a shared module, not a local copy of it.
