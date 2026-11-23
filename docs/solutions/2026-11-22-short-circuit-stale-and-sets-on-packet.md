# The packet hid what the Short Circuit page showed: stale rows, parallel sets (#289)

**Problem:** The Short Circuit page flagged a panel calculation "Stale — upstream chain changed: was 20,344 A, now 20,069 A" (`detectStaleCalculations`), but the packet's short-circuit table printed the same row as "Compliant". If the utility raises the available fault current, the stale row understates. Separately, since #278 the saves record the sets in parallel, and they change the result (500 kcmil Cu, 20 ft: 3 sets 20,344 A, 2 sets 20,069 A), yet no surface printed them. And the table's references always said the source was "utility-provided".

## Approach

1. **Owner rulings:** (1)(a) mark stale rows on the packet the way the app does; (2) print the sets wherever the conductor prints.
2. **Same function, same inputs.** The packet calls `detectStaleCalculations` with the inputs the page uses: service voltage and phase, the utility's available fault current (now in `PermitPacketData`), the panels, transformers and rows. It passes the map to `ShortCircuitTablePages`, and Export All passes the page's own map. A stale row is counted apart from Compliant, and a note gives the old and new values.
3. **One formatter for the conductor.** `lib/storedCalcs.ts::shortCircuitConductorText` ("2 × 4/0 AWG Cu") serves the cards, the single-calculation PDF and the table. E-102 takes `serviceConductorSets` from the row's `results.setsInParallel`. Rows saved before the sets were recorded print without a prefix (one set, or unknown and already Outdated).
4. **Folded in (same pages):** the references line now describes the service row (its transformer kVA and %Z, or the estimate from the service rating). E-102's header cards print "22 kA" / "1200 A".

## Notes

- `ShortCircuitSystemReport` (paged legacy report) has no caller and still prints the old conductor text; left alone.
- The "×" glyph is WinAnsi (0xD7), so it renders in Helvetica without the `PdfText` substitutions.
- The text-collecting test helper joins nested `<Text>` pieces with a space, so it can't catch a missing space between a value and a nested unit. That check lives in the e2e spec, which reads the pdftotext output.

## Reusable rules

- **When the app marks a row, the printed document must mark it too**, from the same function with the same inputs. Pass the computed map down; never recompute with different inputs.
- **Print every input that changes the result** next to the result, so a reviewer can reproduce it.
