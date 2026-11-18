# A second copy of Table 220.42 understated warehouse lighting (#260)

**Problem:** `commercialLoad.ts` had its own `applyLightingDemandFactor`: hospitals, hotels and warehouses got "first 20,000 VA at 50%, remainder at 40%". As I remember the table, it gives warehouses 12,500 VA at 100% and the rest at 50%, so 30 kVA of warehouse lighting printed 14.0 kVA where the table gives 21.25 kVA. #236 had already removed these occupancy rows from `data/nec/table-220-42.ts` because they didn't come from the code book, but it only looked in `data/nec/`. This inline copy survived.

## Approach

1. **Apply the rule already decided rather than a new reading.** #236's rule is "add a row only from the code book". Without book rows, every non-dwelling occupancy takes the table's "All others" row (100%). That is at or above the table under any reading, so the understatement is gone, and hospitals and hotels go up (conservative).
2. **One implementation.** The calculator calls `getLightingDemandFactor('all_others', VA, edition)`, the function the panel schedule and packet use. The inline helper is deleted, since nothing else called it.
3. **What still needs the PE is a choice, not a defect:** whether to add the hospital, hotel and warehouse rows from the book (with the footnote ruling). Adding a row is a data change plus a pinned test. No calc code changes.

## Verification

- `tests/commercialLightingDemand260.test.ts`: warehouse 30 kVA → 30 kVA, hospital and hotel at 100%, office unchanged. 2 of 3 fail on `main`.
- `tests/e2e/issues/issue-260.spec.ts`: the calculator's General Lighting row for warehouse / hospital / office. It fails on `main` at the warehouse row.
- Independent verifier.

## Reusable lessons

- **When a fix removes data that isn't from the source, grep for other copies of the same table:** inline helpers, components, exports. Search for the values (`20000`, `0.40`), not only the table's name.
- **A Playwright `toContainText` regex runs on `textContent`, which has no whitespace between table cells.** Use `\s*` between cells, not `\s+`.
