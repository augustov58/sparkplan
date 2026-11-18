# A single-family service read only the MDP's own circuits (#216)

**Problem:** Six readers ran the single-family service calculation on `circuits.filter(c => c.panel_id === mdp.id)`: E-101, `projectDemandSplit` (E-102, the wizard), the Panel Summary, the Dwelling Load Calculator, and both panel-schedule PDF paths. A subpanel's appliances never reached the service load.

Three more symptoms on the same Main Panel:
- **"Demand with feeders"** came from the per-type cascade over the whole tree, with every `K` circuit counted as a range: 54.8 kVA next to the dwelling method's 29.6 kVA.
- **The packet's MDP page** fed the synthesized "→ PANEL Garage Subpanel" feeder row (its cascade demand) into the dwelling calc as an appliance. It printed 37.3 kVA, near the right answer by accident, while E-101 printed 29.57.

## Approach

1. **One helper for "the circuits a dwelling's service sees":** `circuitsUnderPanel(root, panels, circuits, transformers)`, the subtree walk the aggregate already uses, EVEMS markers left out. All six readers call it on the MDP.
2. **At the service level, no ruling is needed.** The method (220.83 / 220.82 / Part III) already puts lighting and receptacles inside the ft² allowance wherever they sit. Subpanels only add their appliances, HVAC, cooking, dryers, EVSE and motors, and 220.53 counts them across the dwelling, as the code says ("served by the same feeder or service"). The subpanel's *own* feeder is #217, which does need a ruling.
3. **The PDF component gets the circuits it lacks as an explicit prop** (`serviceCircuits`): the packet and the single export pass `circuitsUnderPanel`; the multi-panel export computes it from its own map. The dwelling-shape test reads the same set, so a house whose kitchen is on a subpanel still qualifies.
4. **Remove the second number rather than explain it.** On a single-family MDP, "Demand with feeders" shows the dwelling total, and the per-type aggregated card is hidden.

## Verification

- `tests/sfServiceSubpanels216.test.ts` (4 tests): 37,375 vs 29,570 VA; `projectDemandSplit` and the service check include the subpanel; the helper (grandchildren, transformer-fed, markers excluded).
- UI ("QA SF subpanel"):
  - Main Panel 37.4 kVA / 155.7 A; "Demand with feeders" 37.4; the dwelling table shows 220.53 at 75% on 4 appliances.
  - Dwelling Load Calculator 37.4 kVA from 22 circuits.
  - E-101 29.57 → 37.38 kVA, 123 → 156 A; the MDP page 37.4 kVA.
- Independent verifier; `tests/e2e/issues/issue-216.spec.ts` (fails on `main`: 29.6 kVA).

Folded in from the verifier: on a single-family Main Panel the summary cards read "Dwelling Load / Dwelling Demand (all panels)", since they now cover the subpanels.

## Reusable lessons

- **A filter on `panel_id === mdp.id` is a red flag in any service-level calc.** The service serves the tree.
- **Synthesized display rows are not inputs.** A feeder row added to a schedule for display entered a load calc as an appliance.
- **Found, not fixed (filed):**
  - #227: a new single-family packet never prints the 230.42(A)(1) service check (decision needed).
  - #228: E-301 draws the 2-pole feeder row on one phase; E-601 label wording.
