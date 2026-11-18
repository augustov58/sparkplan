# Voltage drop was 10–20% low single-phase and ~42% low three-phase (#219)

**Problem:** E-102's volts were 12–15% below a Chapter 9 Table 9 hand calculation. `calculateVoltageDropAC` read `effectiveZ` from `data/nec/table-chapter9-table9.ts`. That column is inconsistent with the same row's R and XL under Table 9 Note 2 (Ze = R·PF + XL·sin θ): for 2/0 Cu, 0.10·0.85 + 0.043·0.527 = 0.1077 against 0.091 stored, and lower still for larger sizes. The function also ignored its power-factor argument and multiplied the line-to-neutral drop by **1** on three-phase. Its own K-factor sibling uses √3.

## Approach

1. **Use the code's formula on the data already there.** `effectiveImpedance(R, XL, PF)` implements Note 2 and `voltageDropMultiplier` gives 2 or √3. No `data/nec` value was edited (CLAUDE.md: table values need the code book). R and XL reproduce the Ze values I recall from the book (1/0 → 0.12, 3/0 → 0.088, 4/0 → 0.074), while the stored column ran low.
2. **Don't confuse this with the short-circuit rule.** CLAUDE.md's "3-phase multiplier is 1×, not 1.732×" is about fault current in `shortCircuit.ts`. Voltage drop is a line-to-line quantity, so the line-to-neutral I·Ze·L takes √3.
3. **Flag stored numbers that the change makes stale (the #190 pattern).** Feeder cards and riser labels print the stored `voltage_drop_percent`. `checkFeederLoadStatus` recomputes it the way `calculateFeederSizing` does (stored conductor, PVC, length, per-set current at the stored design load, source voltage and phase) and flags "Outdated" when they differ by more than 0.02 points. The QA fixtures were recalculated through that button.
4. **A stale dev-server module once printed the old E-102 values,** while the calculator and a direct `calculateFeederSizing` run showed the new ones. Restarting the dev server fixed it. When one path shows new numbers and another shows old ones, run the shared function directly before chasing code.

## Verification

- `tests/voltageDropTable9_219.test.ts`: Ze, the 1Φ and 3Φ drops, max length, the stale flag. It fails 7/7 on `main`.
- UI:
  - **Calculator:** 1.86 V / 0.90% / Ze 0.1077 on 3Φ.
  - **E-102:** 1.33 V / 0.56% and 1.22 V / 0.51%.
  - **Outdated:** the flag and Recalc work.
  - **Riser:** prints the recalculated values.
- `tests/e2e/issues/issue-219.spec.ts` fails on `main`. Independent verifier.

## Reusable lessons

- **When a table has a derived column, recompute it from its inputs and compare.** A derived column that disagrees with its own row is the error.
- **A formula change makes stored results stale.** Give the stored numbers an "Outdated" check, not a silent mismatch.
- **New packet text needs a look at the rendered page, not only the extracted text.** The new method line's "θ" printed as "¸" (not in WinAnsi, the #153 pattern). `pdftotext` hid it as a near-miss, and the verifier caught it on a pdftoppm render. θ now goes through `PdfText`'s map.
- **Multipliers depend on the quantity:** fault current and voltage drop handle three-phase differently. Name which one a rule covers.
