# The Panel Schedule's two exports disagreed with each other and with the packet (#238)

**Problem:** the same panel printed differently depending on the button:
- **"Export PDF"** passed only the panel's circuits. No `aggregatedLoad`, so no demand breakdown; no feeder rows, so no downstream feeds.
- **"All Panels"** passed both, but used its own feeder-row rule: breaker rows in slots 1, 2, 5, 6…, and only when the panel had no circuits of its own.
- **The packet** used a third rule (#228): breaker-fed at its slot, lug-fed listed apart.

## Approach

1. **One rule in a pure helper.** `services/pdfExport/feederRows.ts::feederRowsFor` holds the #228 logic:
   - breaker-fed panels at `fed_from_circuit_number`;
   - lug-fed panels at slot 0;
   - a real circuit at the fed-from slot is not repeated;
   - optionally, transformers as lug rows.

   The packet calls it (panels only, so its output doesn't change), and so do both exports (with transformers, which the app lists as lug feeds).
2. **One input builder for both buttons.** `PanelSchedule.tsx::exportInputs()` returns each panel's rows and its NEC 220 aggregate. "Export PDF" takes the selected panel's entries, so it now prints the breakdown.
3. **Render the lugs everywhere.** The #228 lug block became a shared `FeedThruLugs` component, now also in `MultiPanelDocument`, along with `circuitCountLabel`. Otherwise All Panels would have dropped lug-fed feeds entirely: slot 0 is never drawn in the grid.
4. **Watch the regression the spec caught.** All Panels builds the single-family service's circuit list (#216) from the per-panel lists, and those now include feeder rows. That counted the Garage Subpanel twice: 60.9 kVA where the packet shows 48.6. The fix filters synthesized rows out of that list. The spec asserts the same 48.6 / 37.4 / 155.7 on both exports.

## Verification

- UI/PDF:
  - **Office Panel, Export PDF:** breakdown 6.0 / 6.0 / 1.5 kVA, 13.5 kVA.
  - **SF Main Panel, both exports:** lug block, "18 (+1 feeder)", 48.6 / 37.4 / 155.7.
  - **EVEMS downstream MDP:** two lug rows, "0 (+2 feeders)", 44.1 kVA.
  - **Packet E-301:** unchanged.
- `tests/feederRows238.test.ts`; `tests/e2e/issues/issue-238.spec.ts` (`pdftotext` on each download; fails 3/3 on `main`); independent verifier.

## Reusable lessons

- **When two buttons print "the same" page, build their inputs in one function.** The single-panel export silently lacked an input the other had.
- **A synthesized row changes every list it joins.** Here it fed a dwelling load that already counted the real circuits underneath. Filter synthesized rows out of any input that means "real circuits".
- **Assert totals across renderers.** "Both exports show 48.6 / 37.4 / 155.7" caught a double count that each page alone would have hidden.
