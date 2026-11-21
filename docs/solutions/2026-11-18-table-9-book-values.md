# Chapter 9 Table 9 reactances were low and aluminum conduit was missing (#258)

**Problem:** `data/nec/table-chapter9-table9.ts` differed from the book in 82 cells, always low:
- **XL in PVC:** 14 / 12 / 10 AWG were 0.044 / 0.042 / 0.040; the book has 0.058 / 0.054 / 0.050. From 250 kcmil up they were 0.001–0.004 low.
- **XL in steel:** every row carried about the PVC values; the book is 0.073 … 0.046.
- **R in steel:** reused the PVC column; the book's is higher from 2 AWG up.
- **Aluminum conduit:** offered in the Voltage Drop tool but had no rows, so it returned 0 V with a CRITICAL warning.

Since #219 computes Ze from R and XL, low XL meant low voltage drop.

## Approach

1. **Source: the book, in the vault.** `Obsidian Notes/Electrical Engineering/NEC 2023/Transcript/Chapter 9 - Tables.md` (p. 70-726). The OCR garbles some cells. Each size has a metric row (Ω/km) and an imperial row (Ω/1000 ft), so every imperial value was accepted only when it matched metric × 0.3048. The #272 verifier made the same comparison independently and found the same 82 differences before the fix.
2. **Regenerate, don't patch.** All 123 rows (Cu 21 sizes, Al 20, × PVC / aluminum / steel) were written from one transcription. The stored `effectiveZ` is recomputed by Note 2 at 0.85 PF; no calc reads it since #219. `tests/table9Book258.test.ts` pins every R and XL.
3. **Measure who else moves.** `shortCircuit.ts` (stable module) reads R and XL. With the book's higher steel XL, its `× 1.5 for steel` pushed steel fault currents further down: 1000 kcmil Cu in steel, 50 ft from 65 kA, 37,675 → 35,398 A. Measuring that exposed #276: the book's steel column already includes the steel effect, so the factor counted it twice. The PR was held as a draft until the owner approved removing it (2026-11-20), then both landed in one merge: 41,158 A, and every steel case is higher than before. See [the #276 note](2026-11-20-short-circuit-steel-double-count.md).

## Verification

- `tests/table9Book258.test.ts`: 123 rows against the book; aluminum conduit present; three voltage-drop hand calcs. 3/3 fail on `main`.
- `tests/e2e/issues/issue-258.spec.ts`: the Voltage Drop tool for 750 PVC / 1000 steel / 1000 aluminum conduit. It fails on `main`.
- Independent verifier against the book.

## Reusable lessons

- **An OCR'd code book is usable when each value can be checked two ways.** Here the metric and imperial rows of the same table cross-check each other.
- **Changing shared NEC data moves every consumer.** List them (`grep` the table name) and quantify the change for any safety-critical one before merging.
