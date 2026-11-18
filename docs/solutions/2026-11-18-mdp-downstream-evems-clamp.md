# The MDP ignored a downstream panel's EVEMS setpoint (#210)

**Problem:** `calculateAggregatedLoad` clamped EVSE demand to the EVEMS setpoint (NEC 625.42) only when the panel it ran on was itself EVEMS-managed. Run on the MDP, it collected a downstream EV panel's chargers at full nameplate. The same panel page printed the MDP's feed-thru rows at 44.1 kVA (each child's own clamped demand) and its "DEMAND WITH FEEDERS" at 49.9 kVA. E-101 and the Service Upgrade Wizard took the unclamped value, while the service check's 25% adder (`continuousLoadVA`) already capped the chargers at the setpoint.

## Approach

1. **Read the rule's scope from the code section, not the function's.** 625.42 makes the setpoint the maximum load on the feeder *and the service*. A limit on the service holds at every panel above the device. The clamp sat inside the "this panel" branch, so it only ever applied one level.
2. **Find the walk that already gets it right.** `continuousLoadVA` (shared by the service check and feeders, #190) walks the subtree with `collectDownstreamPanelIds` and caps each managed panel. The fix uses the same walk in the Part III branch. Each managed panel under the root, root included, contributes `chargers − setpoint` of reduction.
3. **Keep the old single-panel result bit-for-bit.** The old formula was `setpoint + max(0, total − chargers)`. That equals `total − (chargers − setpoint)`, except when the cascade has already reduced the chargers below nameplate (typed as receptacles). A `max(Σ setpoints, …)` floor keeps that case identical too. The row keeps its old label when the root is the only clamped panel, so the EV panel pages print exactly as before.
4. **Check every other branch.** 220.84 (3+ units) and the two-unit path already take EV at `evDemandVA` from the multifamily context, so only the Part III branch needed it.

## Verification

- `tests/mdpEvemsClamp210.test.ts` (9 tests): the QA case (44,100 = the sum of the feeders), the existing/proposed split, agreement with the continuous adder, two levels down, behind a transformer, two EVEMS panels, setpoint above load, no marker, and the root case unchanged. 5 fail on `main`; the 4 guardrails pass on both.
- UI ("QA EVEMS downstream"): MDP 49.9 → 44.1 kVA, 207.8 → 183.8 A; wizard 239 → 215 A; E-101 49.86 → 44.10 kVA, 208 → 184 A. Guardrails unchanged: connected 49.86 kVA, EV Panel 30.6 kVA, Office 13.5 kVA.
- Independent verifier; `tests/e2e/issues/issue-210.spec.ts`.

## Reusable lessons

- **A limit on the service applies at every level above the device.** When a clamp lives in a "this panel" branch, ask whether the code section limits only this panel.
- **Two numbers on one page are a free oracle.** The feed-thru rows (each child's own aggregate) and the MDP's aggregate must agree when the demand factors don't change between levels. Here they didn't.
- **Found, not fixed (filed):** #212, the reduction row prints "before → after" totals, so the table's columns don't add up to its TOTAL row (an owner call on presentation).
