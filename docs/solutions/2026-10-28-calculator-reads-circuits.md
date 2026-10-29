# The calculator and the packet read different inputs (#184)

**Problem:** after #178, the Dwelling Load Calculator and the packet used the same method for a single-family house, but not the same input. The calculator computed from its appliance toggles. The packet computed from the service panel's circuits. A project made from a template has circuits and no toggles, so the calculator showed 10.2 kVA (general loads only) and E-101 showed 30.9 kVA for the same house.

## Approach

1. **Pick one input (owner decision, option 1).** Once the service panel has circuits, the circuits are the input everywhere. The toggles only build the schedule on "Generate".
2. **Reuse the packet's function.** `calculateSingleFamilyLoadFromCircuits` calls `calculateSingleFamilyPanelLoad`, the function E-101 uses, and returns the calculator's `ResidentialLoadResult`. The tail of `calculateSingleFamilyLoad` (service size, 220.61 neutral, conductors, GEC) became `dwellingServiceResult`, shared by both paths, so toggle results don't change.
3. **Neutral.** The packet prints no neutral, so there was nothing to reuse. The calculator decides which loads are 240 V-only by row category ("Electric Range"), but circuit rows carry the circuit's description. The new function finds the 240 V-only circuits by inferred type instead: range (K + cooking), dryer (D), water heater (W), EVSE, pool/spa/well pump. It leaves their rows out of the neutral. One typed house gives the same 16,825 VA neutral through both paths.
4. **Proposed loads not yet applied** (`lib/storedCalcs.ts::circuitsWithPendingProposed`). A proposed load counts as a proposed circuit until an is_proposed circuit with its description exists. That is what "Generate Schedule" writes, with the same load type mapping (HVAC → C). An existing circuit with the same name doesn't count as applied.
5. **Readers.**
   - The calculator shows the circuit result when there are circuits, with a note saying so.
   - "Apply" still sizes the panel's main breaker from the toggle result, because that result describes the schedule being written.
   - The Service Upgrade Wizard uses the existing circuits with the whole panel's 220.83(A)/(B) decision, which is E-102's existing-demand run.

## Verification

- Templated new house: calculator 30.9 kVA under Part III and 24.12 kVA under 220.82, both matching the #178 packet fixtures.
- Existing house with an applied proposed EV charger: 27.20 kVA under 220.83(A), the same as its packet, so nothing is counted twice.
- Wizard on the same house: 94 A existing, the same as E-102 (94 A, 22.60 kVA).

## Failed hypotheses / traps

- **The wizard's own circuits were always empty.** It calls `useCircuits(targetPanel?.id)`, but the hook takes a project ID, so its panel-schedule sum never had data. The dwelling path uses a separate `useCircuits(projectId)` call. The existing call is left as it was and filed as #185, because fixing it would change the commercial path.
- **A component memo that depends on a filtered array** recomputes every render. The memo depends on `circuits` and `mainPanel` and filters inside.

## Reusable rule

Two pages that report one quantity need the same input as well as the same function. When one side works from a model (toggles) and the other from records (circuits), make the records the input once they exist, and keep the model as what builds the records.
