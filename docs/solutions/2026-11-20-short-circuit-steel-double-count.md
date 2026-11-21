# Short circuit counted steel conduit twice (#276)

**Problem:** `services/calculations/shortCircuit.ts` read a run's R and XL from NEC Chapter 9 Table 9 for its own conduit type, then multiplied XL by 1.5 when the conduit was steel, "for magnetic effects". Table 9's steel columns already are the values for conductors in steel conduit (the table gives separate PVC, aluminum and steel columns for XL and R). So the steel effect was counted twice, and steel-conduit fault currents came out 4–12% low. That is the unsafe direction for 110.9 interrupting ratings.

The factor came from the initial scaffold commit (2025-12-20), with the comment "Table 9 only has PVC data, so we'll use PVC as baseline". That premise was false from day one: the steel rows existed, and `getConductorImpedance(…, 'Steel')` returned them.

## Approach

1. **Found by measuring a data change.** #258 corrected Table 9 to the book (higher steel XL). Quantifying every consumer of the table showed steel fault currents would drop further, which made the stacked factor visible.
2. **Stable module → owner ruling first** (CLAUDE.md escalation rule 2). The issue gave the numbers both ways and the cause. The owner approved on 2026-11-20.
3. **Fix:** remove both `conductorReactance *= 1.5` sites (service and downstream paths) and the false comments. The PVC fallback stays; it can no longer trigger, since every conduit type has rows.
4. **Land with the data fix.** #258 alone would have made steel 7–15% low. Both went into one PR, so `main` never had the worse state.

## Verification

- `tests/shortCircuitSteel276.test.ts`: book hand calcs (service 500 kcmil Cu, 100 ft, 500 kVA 480 V: steel 8,632 A, PVC 8,871 A; three downstream steel cases). All fail on `main`; the steel cases also fail with #258's data alone.
- `tests/e2e/issues/issue-276.spec.ts`: the Short Circuit tool, service steel / PVC and downstream steel.
- Independent verifier against the book's Table 9 headings and values.

## Reusable lessons

- **When a table already has a column for a condition, a code factor for the same condition double-counts.** Before applying an adjustment, read the table's headings; check that the condition isn't already one of its axes.
- **A false comment can keep a bug alive.** "Table 9 only has PVC data" described data that didn't exist. Check a comment's claim against the data before trusting the code under it.
- **Stored results don't follow a formula fix.** The packet prints saved short-circuit results; they keep the old value until recalculated (follow-up issue).
