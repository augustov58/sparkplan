# Non-dwelling lighting cited a Table 220.42 row that doesn't exist (#218)

**Problem:** the Part III aggregate maps every non-dwelling occupancy to `data/nec/table-220-42.ts`'s `'office'` row, which printed "Table 220.42 (Office Buildings)" on every commercial demand table, panel schedule PDF and packet. After #179 it also printed on multifamily common-area panels. Table 220.42 has no office row: its catch-all is **All others** (total VA at 100%). The factor was right; the citation wasn't.

## Approach

1. **Rename the key, not just the label.** The internal key `'office'` is what produced the label: a row named after one occupancy invites the next reader to think the table has per-occupancy rows. It is now `'all_others'`, with the book's label, and both mappings (the aggregate and the legacy `calculateLoad`) point at it.
2. **Close the latent trap next to it.** `calculateLoad` sent industrial projects to the `'warehouse'` row. That row is a flat 100% today, so the result was right by accident. The book's warehouse row (first 12,500 VA at 100%, the rest at 50%) applies to storage warehouses, not to industrial occupancies in general. Industrial now reads "All others", so correcting the warehouse row later can't change an industrial result.
3. **Don't touch values I can't check.** The hotel, warehouse and store rows don't match the book as I remember it, and nothing reads them. I filed them for a code-book check (#236) instead of guessing, plus Article 220's renumbering between editions (#237). The test pins only the row that's read.

## Verification

- Unit: `tests/table22042AllOthers218.test.ts` checks the row (100%, the label, no "office" anywhere in the table), the aggregate's lighting row for a commercial panel, and `calculateLoad` for commercial and industrial. It fails 3/3 on `main`.
- UI: Office Panel, QA Commercial panel MDP and the MF House Panel all print "Table 220.42 (All others)", and their totals are unchanged. `tests/e2e/issues/issue-218.spec.ts`. Packet: E-101 prints "(All others)"; no "Office Buildings" in 2 packets and 3 panel PDFs. The verifier failed a row I'd written asking for "All others" in the panel schedule PDF, whose NEC column prints every citation without its parenthetical by design. I narrowed that row in the issue rather than widen a column on every schedule page.
- Testing against `main` when the fix is already committed: `git stash` has nothing to stash. Use `git checkout main -- <files>`, run, then `git checkout HEAD -- <files>`.

## Reusable lessons

- **A lookup key named after one case becomes that case's label.** Name a table row after the row the code book prints.
- **"Right by accident" is a bug waiting for the next data fix.** When a mapping reaches the correct value through the wrong row, re-point it before someone corrects the row.
- **Check what a render path does to a string before writing its expected text.** One PDF truncates every parenthetical; an Acceptance row that expects the full label there fails on a correct fix.
- **Pin only what you've checked.** A test that pins unverified rows turns a guess into a regression guard.
