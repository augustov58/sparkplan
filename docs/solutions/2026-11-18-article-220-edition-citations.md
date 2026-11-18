# Article 220 cited one edition's numbers on every project (#237)

**Problem:** Article 220 was renumbered between NEC 2020 and NEC 2023, but the app printed fixed numbers. The Commercial Load Calculator cited the 2023 unit-load table ("Table 220.42(A)") on NEC 2020 projects. Every demand table cited the 2020 lighting table ("Table 220.42") on NEC 2023 projects. The dwelling 3 VA/ft² load was cited as "Table 220.12" everywhere, which is wrong in both editions: NEC 2020 moved dwellings to 220.14(J).

## Approach

1. **One table of the renumbered sections:** `data/nec/article220-citations.ts::article220Citations(edition)`. Every site reads from it. Rows are added only when the sources agree. Those used: ECM Code Basics, the Mike Holt forum, open-exam-prep. The receptacle table (220.44 → 220.47?) was left alone because they disagree, and filed as #261.
2. **The edition is a required argument** to `getLightingDemandFactor`, `calculateLoad`, `calculateCommonAreaLoads`, `dwellingLoadsFromCircuits` and `CommercialLoadInput`. The Mistake Ledger's 220.57 row says a defaulted edition hides a caller that never passes one. Making it required turned every production caller (3 for the demand table, 2 for the legacy calc) into a tsc error to fix. The one caller that only reads VA (the multifamily generator) passes `'2020'` with a comment saying why.
3. **Don't find rows by their citation.** `calculateCommercialLoad` found its lighting row with `necReference.includes('220.42(A)')`. Once the citation followed the edition, a NEC 2020 project would have lost that row from the service-sizing note. It now compares the row object itself. Grep for `includes('` on reference strings before making a citation dynamic.
4. **Sweep the whole candidate set first.** There were 81 hits of 220.12 / 220.14(J) / 220.41 / 220.42 / 220.45 across 18 files. 35 were user-visible strings. Each one was either changed, or listed in the PR with the reason it stayed (stored template descriptions; a "220.12–220.18" help-text range whose 2023 equivalent I don't know).
5. **Follow-up #261:** a further search settled the receptacle section (220.44 → 220.47 in 2023). It became a fourth field, `receptacleDemand`, on the same table, so every site picked it up through the same helper. The two #237 assertions that pinned "220.44" under 2023 were updated.
6. **A test needs a project of each edition.** "QA Commercial 2023" is a copy of "QA Commercial panel" with `settings.nec_edition_override = '2023'`. Copied rows keep their `user_id`, since RLS rejects inserts without it.

## Verification

- `tests/article220Citations237.test.ts`: both editions at every layer (table, commercial, dwelling Part III, unit-panel warning, common area, narrative fallback), with identical totals. 6 of 7 fail on `main`; the seventh tests the new helper file itself.
- `tests/e2e/issues/issue-237.spec.ts`: 3 of 6 fail on `main`, because each half of the pair catches the edition `main` got wrong.
- Packets: E-101 prints "Table 220.45 (All others)" on the 2023 fixture and "Table 220.42 (All others)" on 2020.
- Independent verifier.

## Reusable lessons

- **A citation is edition data, like a table value.** Keep it in `data/nec/` and pass the edition in, rather than writing literals at each site.
- **Proving fails-on-main after the fix is committed:** `git stash` has nothing to stash. Use `git checkout origin/main -- <files>`, run the spec, then `git checkout HEAD -- <files>`.
