# An EVEMS setpoint could not be edited or removed (#209)

**Problem:** The NEC 625.42 setpoint is a circuit, "EVEMS Aggregate Setpoint (NEC 625.42)", whose `load_watts` is the setpoint. It is metadata, so every screen hides it (`isEVEMSMarkerCircuit`): schedule rows, phase totals, circuit lists. The only place it showed was a read-only card on the Panel Schedule. Once it existed it couldn't be changed or deleted, yet it kept clamping the panel's demand and its feeder's design load. Some counts still included it: the panel tab ("EV Panel(5)" for 4 circuits) and E-101's TOTAL CIRCUITS.

## Approach

1. **Put the controls where the user already sees the setpoint.** The card gets Edit (a VA input; it writes `load_watts` through the same `updateCircuit` as any row) and Remove (`confirm`, then `deleteCircuit`, the existing row-delete pattern). No new data model, no new route.
2. **Cover the legacy marker.** Older projects carry "EVEMS Load Management System", which has no value; the aggregate falls back to the panel's main breaker. The card now shows for any marker. Edit turns it into an explicit setpoint; Remove deletes every marker on the panel, so no stale one keeps clamping.
3. **Keep the editor per panel.** The editing flag stores the panel ID, so switching tabs closes it without an effect hook.
4. **Fold in the counts the #210 verifier found.** The tab count and the packet's two TOTAL CIRCUITS counts filter the marker, the same way the per-panel table already did. The Circuit Design page's "N ckts" is in `OneLineDiagram.tsx` (Stable Module), so it is flagged in the PR, not changed.

## Verification

- UI ("QA EVEMS marker edit"):
  - The card shows Edit / Remove; the tab reads EV Panel(4).
  - Edit to 23,040 VA: card 23.0 kVA, 96.0 A; panel 24.8 kVA, 103.5 A; F-EV "37.8 → 30.6 kVA".
  - Remove: card gone; panel 36.4 kVA, 151.5 A; F-EV "37.8 → 45.0 kVA".
  - E-101 TOTAL CIRCUITS 7.
- `tests/e2e/issues/issue-209.spec.ts` resets the fixture before and after itself (`finally`), so a failed run can't leave it edited. It fails on `main` at "EV Panel(4)".
- Independent verifier.

## Reusable lessons

- **Hidden metadata needs one visible owner.** If data is filtered out of every list, the screen that shows it must also be the screen that edits it, or it becomes permanent.
- **A spec that mutates its fixture resets it in `finally`**, through the app's own client as the QA user. The next run then starts from the documented state even after a failure.
- **`page.evaluate(() => import('/lib/...'))` breaks `tsc`**: import through a variable, since the path only exists for Vite in the browser.
