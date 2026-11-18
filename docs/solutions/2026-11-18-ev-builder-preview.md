# The EV Panel Builder's preview described a different panel than it created (#230)

**Problem:** after #224 the builder created the right panel, but its preview card computed its own numbers:
- "Total Load" was the sum of breaker trips (4 × 60 + 20 + 20 = 280 A), where the created panel's demand was 199.5 A.
- "Total Power" counted chargers only.
- "Utilization" was breakers ÷ rating.
- "Total Circuits" counted the EVEMS setpoint marker that every schedule hides.

The template also created the lighting circuit as a 2-pole row with no load type (the column default 'O'), and put the hidden marker at slots 10/12, between real circuits.

## Approach

1. **One object for preview and Create.** `builderTemplate` (from #224) is what Create inserts. A `preview` memo places it under the MDP as rows, and the card reads it through the shared functions:
   - `calculateAggregatedLoad`: demand, with EVEMS at the setpoint;
   - `panelDesignAmps`: the 408.30 design load Inspector Mode checks (#225);
   - `isEVEMSMarkerCircuit`: the circuit count.

   The service-check line (#193) reads the same `preview`.
2. **Let the template carry load types.** `TemplateCircuit.loadType` (lighting 'L'); `templateCircuitRow` writes it and defaults to 'O'. A 120/277 V lighting circuit is 1-pole.
3. **Hidden rows go last.** The marker is generated after the spare and the lighting.
4. **Clamp derived state where it's read.** The verifier found that "Max Simultaneous Chargers" kept 3 after the charger count dropped to 1. The input clamped only on its own change, so the template stored a 3-charger setpoint. `simultaneousChargers = min(input, numberOfChargers)` is computed on every render and is what every reader uses.
5. **Split out what needs the PE.** The 625.41/625.44 titles go to #241, not into this PR.

## Verification

- UI ("QA EV builder"):
  - **Default:** 199.5 A (47.9 kVA) demand, 247.5 A design, 300 A, 83%, 6 circuits.
  - **EVEMS × 3:** 151.5 A (36.4 kVA), 187.5 A, 225 A, 6.
  - **Created panels:** tab (6), lighting 1-pole 'L', marker after the real circuits (spare 10, lighting 14, marker 16).
  - **Labels** toggle their checkboxes.
- `tests/evPanelBuilderPreview230.test.ts`; `tests/e2e/issues/issue-230.spec.ts` (fails on `main` on the demand line); independent verifier.

## Reusable lessons

- **A preview must call the function that builds the thing it previews.** A side calculation with its own rules drifts the moment either side changes.
- **When an insert omits a column, the database default becomes a silent decision.** Write the value from the source object (here `loadType`).
- **A value bounded by another input must be clamped where it's read, not only in its own onChange.** The other input can change under it.
- **Metadata rows go after the real rows in slot order.** Otherwise they show up as unexplained gaps.
