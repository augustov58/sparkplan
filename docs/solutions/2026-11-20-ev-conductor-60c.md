# The two EV tools sized the same circuit from different ampacity columns (#271)

**Problem:** for a 48 A charger on a 60 A breaker, the EV Panel Builder gave 6 AWG Cu (75 °C column, 65 A) and the EV Charging calculator gave 4 AWG Cu (60 °C, 70 A; since #269). NEC 110.14(C)(1)(a) allows 75 °C on circuits ≤ 100 A only when the terminals are listed for it, so which one is right was a PE call.

**Ruling (2026-11-20):** 60 °C in both tools, with a note for the optional 75 °C.

## Approach

1. **One rule, one place.** `data/nec/table-310-16.ts::terminationTempC(amps)` (60 °C ≤ 100 A, 75 °C above) is now read by the calculator (`sizeEvConductor`), the builder presets and its charger-amps override, and the test of the premade templates. The rule had been inlined three ways (`amps <= 100 ? 60 : 75`, a hard-coded `75`, and literal sizes in templates).
2. **The note is computed, not written.** `conductor75COption(amps, material)` returns the smaller 75 °C size or null. It applies **240.4(D)**: at 75 °C, 14 AWG Cu is 20 A and 12 AWG Cu is 25 A in Table 310.16, but 240.4(D) caps them at 15 A and 20 A. Without that check, a 20 A circuit would have offered "14 AWG allowed at 75 °C". The limits were checked in the NEC 2023 book (same values in 2020).
3. **Show it where people look.** The calculator never rendered `result.notes`, so the option is a result field (`conductor75COption`) shown under the conductor. The builder's "This will create" line now states the breaker and conductor, since the conductor only appeared on Material Take-Off after Create.

## Verification

- `tests/evConductor60C271.test.ts`: the rule boundary, the 75 °C option including the 240.4(D) cases, calculator Cu/Al, builder presets, builder = calculator for 16–80 A chargers, and every premade template EV circuit. 11/13 fail on `main`.
- `tests/e2e/issues/issue-271.spec.ts`: builder preview (48A / 80A / DCFC) and calculator note; fails on `main`.
- UI: Create in the QA account wrote 4 × 4 AWG Cu (Material Take-Off), then cleaned up.
- Independent verifier against the book.

## Reusable lessons

- **A rule inlined in several places drifts; give it a name in `data/nec/` and grep for its old spellings** (`<= 100 ? 60 : 75`, a literal `75`, literal sizes).
- **A "smaller conductor allowed" answer must also pass 240.4(D).** Table 310.16 ampacity alone overstates 14/12/10 AWG.
- **Check that a result field is rendered before relying on it for a ruling's note.** `notes[]` existed but no screen showed it.
