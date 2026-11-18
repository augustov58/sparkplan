# Feeders were sized at a blanket 1.20 × demand (#190)

**Problem:** Every feeder's design load came from `splitFeederDesignLoad(demand)`: 80% "continuous" and 20% not, so 1.20 × demand whatever the feeder served. NEC 215.2(A)(1), 215.3 and 625.41 take the actual continuous loads at 125%. An all-EV feeder came out at 1.20× where the code requires 1.25× (undersized, the unsafe direction), and a feeder with no continuous load was 20% oversized. Three callers shared the split: the Feeder Manager, the packet's voltage-drop page (E-103) and the Copilot.

## Approach

1. **Reuse the service check's classifier.** The ruling said "the same continuous loads as the service check". `continuousServiceAdderVA` already walked a panel subtree (EVSE at the edition load, signs, show windows, EVEMS capped at the setpoint), but returned the 25% adder. I split out `continuousLoadVA` (unscaled, any root panel) and kept the adder as a one-line wrapper. The service-check tests stayed green, proving the refactor changed nothing there.
2. **One feeder function, three callers.** `feederDesignLoadSplit(rootPanelIds, demandVA, …)` returns the continuous and non-continuous parts. `calculateFeederSizing` takes the continuous part at 125%, so the design load is demand + 25% of it. Deleting `splitFeederDesignLoad` made `tsc` list every caller: exactly the three expected, plus one test.
3. **Make the rule change reach existing projects.** The riser, the one-line and the equipment schedule print each feeder's *stored* sizing; only E-103 recomputes. The stale check compared connected load only, so a rule change (or an EVEMS marker, which adds no connected load) never flagged anything. It now also compares the stored design load with `feederDesignLoadVA`, computed exactly as the Feeder Manager's recalculation does, so a Recalc clears the flag. **The threshold is 1%, not the existing 5%:** the unsafe all-EV case moves only 4.2% (1.20 → 1.25). Owner decision 2026-11-17.
4. **Reproduce on the packet, not just in the app.** Generating the packet on `main` showed a second defect on the same page. E-103 and the Copilot sized each feeder with 3 current-carrying conductors and 30 °C, hard-coded, while the Feeder Manager used the feeder's stored 4 conductors (0.80 bundling). One packet printed 3/0 on E-103 and 4/0 on the equipment schedule. Both callers now pass the feeder's stored conditions.
5. **Hand-calculate the conductors too.** With the rule in hand, 187.5 A ÷ 0.80 = 234.4 A crosses 4/0's 230 A, so 250 kcmil. 57.8 A falls under the 60 °C termination rule (110.14(C)(1)(a)): 4 AWG gives 56 A, so 3 AWG. Both matched the app.

## Verification

- `tests/feederDesignLoad190.test.ts` (12 tests): both feeders, EVEMS, an MDP feeder, the cap, and the stale check (old rule flagged, the 4.2% all-EV case flagged, recalculated not flagged, EVEMS marker flagged, capacity feeders never). `tests/evemsEvseClassification.test.ts`: the old 80/20 assertion replaced.
- UI: feeders saved on `main` showed "Outdated" with 43.6 → 45.0 and 16.2 → 13.9 kVA on the fix. Recalc gave 45.0 kVA / 250 kcmil and 13.9 kVA / 3 AWG. Adding an EVEMS marker flagged 45.0 → 37.8. The packet's voltage-drop page, riser and equipment schedule all print 250 kcmil and 3 AWG.
- Independent verifier; `tests/e2e/issues/issue-190.spec.ts`.

## Reusable lessons

- **When a rule changes a stored value, ask how existing rows learn about it.** A correct formula that only applies on the next manual recalculation leaves every existing packet on the old rule.
- **Pick a staleness threshold from the case that matters, not a default.** 5% would have missed exactly the unsafe direction (4.2%).
- **"Same function" includes the same inputs.** Three callers shared the split but not the installation conditions, so they still printed different conductors.
- **Found, not fixed (filed):**
  - #209: an EVEMS setpoint marker cannot be edited or removed from the UI; it is hidden everywhere as metadata.
  - #210: the MDP's Part III demand ignores a downstream panel's EVEMS setpoint (found by the verifier).
