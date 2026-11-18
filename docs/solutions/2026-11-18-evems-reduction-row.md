# The EVEMS row made demand tables sum to twice their total (#212)

**Problem:** the Part III aggregate added an "EVEMS feeder reduction" row whose connected column was the panel's demand *before* the setpoint clamp and whose demand column was the demand *after* it, i.e. a before → after summary. Every other row is a per-load-type amount, so the columns summed to almost twice the TOTAL row (99.72 / 93.96 against 49.86 / 44.10 on E-101).

## Approach

1. **Follow the existing table rule (#160):** rows add up to the totals, and an adjustment carries its own row. The issue's option A matches it; options B (an EVSE row split out of "Other") and C (as is) don't fit as well.
2. **One change at the source.** The aggregate's row is now `EVEMS_REDUCTION_LABEL` with connected 0 and demand `clamped − preClamp`. `isEvemsReductionRow()` lets each renderer print "—" for its factor: the in-app table and card, E-101, and both panel-schedule PDFs.
3. **Find the filters.** Three places dropped rows with `connectedVA > 0 || demandVA > 0`: both PDF documents and the in-app table's own copy. A negative-only row vanished, and the EV Panel's in-app table stopped adding up in the opposite direction. All three now use `!== 0`.
4. **Tests that pinned the old shape were updated to the new rule,** and now also assert that the rows sum to the totals: `mdpEvemsClamp210.test.ts`, `panelScheduleDemand191.test.ts`, the #191 and #210 specs.

## Verification

- UI/PDF on "QA EVEMS downstream":
  - **EV Panel table:** 1.80 + 34.56 − 5.76 = 30.60 = TOTALS.
  - **MDP card:** "−5.8 kVA (NEC 625.42)".
  - **E-101:** 6.00 + 7.80 + 36.06 − 5.76 = 44.10.
  - **Panel pages:** "0.0 / −5.8 kVA / —".
- Totals unchanged. `tests/e2e/issues/issue-212.spec.ts` fails on `main`. Independent verifier.

## Reusable lessons

- **A summary row ("before → after") doesn't belong in a column of addends.** Show the adjustment itself.
- **When a row can be negative or zero-connected, grep for `> 0` filters on the same list.** They drop it silently.
- **When a test pins a presentation that a decision changes, update it to assert the new rule** (here, that the rows sum to the totals), not just the new number.
