# EV Panel Builder's "Create" left an empty, service-fed panel (#224)

**Problem:** `EVPanelTemplates.tsx` spread the generator's camelCase intermediate circuits (`circuitNumber`, `breakerAmps`, `loadVA`, …) into `createCircuit`, "cast to satisfy the snake_case signature". PostgREST rejected every insert (`Could not find the 'breakerAmps' column`). The hook returns `null` on failure; the loop ignored it, so the user saw no error. The panel itself saved with the template's `fed_from_type: 'service'`, so it never joined the MDP's load. With EVEMS, the template wrote the legacy marker, whose setpoint falls back to the panel's main breaker.

## Approach

1. **Find the existing correct conversion.** The Multi-Family generator already maps the same template output to rows. The mapping became a pure, exported `templateCircuitRow` in `data/ev-panel-templates.ts`. The test assigns its output to `CircuitInsert`, so a wrong column name now fails `tsc`, not production.
2. **Count the nulls.** A hook that swallows errors needs its return value checked: N of M failures now throw into the Builder's error state.
3. **One template for preview and create.** The #193 service-check preview and Create share `builderTemplate`, including the explicit EVEMS setpoint (simultaneous chargers × per-charger VA, the Builder's own UI meaning). What the warning shows is what gets saved.
4. **The spec found a race the manual pass didn't.** Clicking Create before the panel list loaded meant no MDP and a service-fed panel again. The button now waits for `usePanels`' loading flag (which starts `true`).

## Verification

- `tests/evPanelBuilderRows224.test.ts` (2 tests): rows typed as `CircuitInsert`, no camelCase keys; the explicit setpoint marker.
- UI ("QA EV builder"): 6/6 circuits saved (was 6 × 400); the panel under the MDP at 47.9 kVA / 199.5 A; MDP 97.7 kVA; EVEMS: 7 rows, card 23.0 kVA / 96.0 A, panel 24.8 kVA, tab (6).
- Independent verifier; `tests/e2e/issues/issue-224.spec.ts` (creates two panels and deletes them in `finally`; fails on `main`).

## Reusable lessons

- **A cast at an insert boundary hides a schema mismatch.** If code needs `as unknown as Insert`, the shape is probably wrong; assign it to the real type in a test.
- **A hook that returns `null` on error needs every caller to check it.**
- **Run the spec at machine speed.** A human-paced manual pass waits for data that a fast click doesn't.
- **Found, not fixed (filed):** #230, the Builder's preview numbers and labels (breaker-sum "Total Load", lighting coded Other, NEC reference titles).
