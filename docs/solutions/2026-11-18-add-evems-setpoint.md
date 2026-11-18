# No control to add an EVEMS setpoint to a panel (#222)

**Problem:** #209 gave an existing setpoint Edit and Remove, but adding one (after a Remove, or on a hand-built EV panel) still meant "Add Circuit" with the exact description "EVEMS Aggregate Setpoint (NEC 625.42)" and the setpoint as watts.

## Approach

1. **Reuse the card's own input and save path.** `saveSetpoint` updates the marker when there is one, and otherwise creates it with `createCircuit`. A dashed "EVEMS SETPOINT" card offers "Add EVEMS setpoint" on a panel with EVSE circuits and no marker. It adds no new rule: the setpoint takes effect through the existing 625.42 clamp (#210).
2. **Put the hidden row where it can't collide.** The marker goes in the panel's highest free slot, skipping real circuits' poles and breaker-fed feeder slots, after the real circuits as #230 placed the template's. The grid, counts and exports already skip markers (#209).
3. **Warn, don't block** (validation is advisory): a setpoint at or above the chargers' nameplate total limits nothing.
4. **The spec caught a real race.** `removeSetpoint` closed the editor after awaiting the delete. The card goes optimistically, so a quick "Add" was then closed by the late reset. Closing first fixes it, since Remove is only offered when the editor is closed.

## Verification

- UI ("QA EVEMS marker edit" → EV Panel):
  - **Remove:** 36.4 kVA, plus the add card saying the chargers are 34.6 kVA.
  - **Add 40,000:** warning.
  - **Add 28,800:** card 28.8 kVA / 120.0 A, demand 30.6 kVA, tab (4), marker in slot 42.
- `tests/e2e/issues/issue-222.spec.ts` drives the real Remove → Add flow and fails on `main`. The #209 / #234 specs still pass. Independent verifier.

## Reusable lessons

- **State reset after an awaited write races with the next click when the UI updates optimistically.** Reset before the await.
- **Metadata rows need a slot that real rows won't take:** the highest free one.
