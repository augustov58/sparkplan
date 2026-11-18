# The EV Panel Builder cited sections it doesn't use, by titles they don't have (#241)

**Problem:** the builder listed "NEC 625.41 - Electric Vehicle Coupler" and "NEC 625.44 - Electric Vehicle Supply Equipment Demand Factors". The project has no EVSE demand factor (PE ruling #198), and the builder's numbers come from other sections.

## Approach

1. **Describe what each section does here, not its official title.** CLAUDE.md records the rulings that say what 625.41, 625.42, 220.14(A) / 220.57, 215.2(A)(1), 230.42(A)(1) and 408.30 mean in this app. The list uses those meanings, which come from the PE's own decisions, so it doesn't depend on titles recalled from memory.
2. **The edition line follows the project:** `useProjectNecEdition` picks 220.14(A) for 2020 and 220.57 for 2023.
3. **Folded in from the verifier:** the #230 preview needed an MDP and showed "—" on a project with no panels. The preview panel is now service-fed when there's no MDP; its own demand doesn't depend on one, and the service check stays hidden.

## Verification

- UI: "QA EV builder" (NEC 2020) and "QA EVEMS tool (NEC 2023)", with the exact lines. The verifier hand-checked each line against the preview's own numbers (demand, 408.30 design, the 230.42 service check, 125% breakers, the EVEMS setpoint).
- `tests/e2e/issues/issue-241.spec.ts` fails on `main`.

## Reusable lessons

- **When a citation's exact title is uncertain, cite by what the app does with it,** using the rulings already recorded, instead of guessing a title.
- **A preview should work on an empty project.** Compute what doesn't need the missing parent, and hide only what does.
