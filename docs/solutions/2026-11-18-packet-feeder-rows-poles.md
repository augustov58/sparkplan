# Packet panel schedules: blank second poles, invented feeder breakers (#228)

**Problem:** on E-301 ("QA SF subpanel"):
- **Lug-fed sub-panel drawn as a breaker.** The Garage Subpanel appeared as breaker row 25 "→ PANEL Garage Subpanel 100A 2P" on phase A only, with slot 27 blank. The in-app schedule lists it under FEED-THRU LUGS.
- **Total Circuits counted the synthesized row:** 19 against the app's 18.
- **No continuation slots, for any circuit.** Every 2-pole circuit (range, dryer, water heater, A/C) left its second slot blank too. The renderer looked a slot up only by `circuit_number`.
- **E-601's label ran the panel name and location together.**

## Approach

1. **Follow the app's model of a feed, not a new one.** `PanelSchedule.tsx` splits downstream panels by `fed_from_circuit_number`: with one, it's a breaker in that slot; without one, it's on feed-thru lugs. The packet's `synthesizeFeederCircuits` instead allocated a free slot for every panel. Now a breaker-fed panel goes to its own slot; a lug-fed panel gets slot 0 and an id prefix (`SYNTH_LUG_PREFIX`). Slot 0 keeps it out of the grid, but its load stays in the list that the phase totals and the Load Summary read, so no number moves.
2. **One slot lookup for both grids.** `slotCircuit(circuits, slot)` returns the circuit that starts in the slot, or the multi-pole circuit whose later pole it is (N+2, N+4). The packet grid and the All Panels grid both use it.
3. **Count what the app counts.** `circuitCountLabel` gives branch circuits plus "(+N feeders)". It answers the #213 question both ways: the app's number, with the feeders shown apart.
4. **A unit test went blank because of its extractor, not the PDF.** `permitPacketE2E.test.ts` finds compressed streams with `stream[\r\n]+(…)[\r\n]+endstream`. When the compressed bytes happen to end in CR or LF, the regex eats that byte, strict `inflateSync` throws, and the page's text comes back empty. Adding "(cont. ckt N)" changed the bytes and tripped it; `pdftotext` read the same PDF fine. The fix was `finishFlush: Z_SYNC_FLUSH` in the test helper.

## Verification

- Packet "QA SF subpanel": slots 15/16/19/20 "(cont. ckt 13/14/17/18)"; FEED-THRU LUGS "Garage Subpanel LUG 2P 12,330 VA"; Total Circuits "18 (+1 feeder)"; 48.6 / 37.4 kVA / 155.7 A unchanged; still 14 pages. Rendered E-301 to PNG to check the layout. Breaker-fed path: the Garage Subpanel set to slot 25 for one packet printed at 25 with "(cont. ckt 25)" at 27 and no lug block, then was set back (no QA project is breaker-fed).
- `tests/panelScheduleSlots228.test.ts` (slots, lugs, count). `tests/e2e/issues/issue-228.spec.ts` generates the packet and reads it with `pdftotext`; it fails on `main`. Independent verifier.

## Reusable lessons

- **When the PDF and the app draw the same thing, port the app's rule rather than inventing a second one.** Here that meant breaker-fed vs lug-fed by `fed_from_circuit_number`.
- **Keep a row's load and its placement separate.** Slot 0 takes the row out of the grid but keeps its load in every total.
- **When a PDF text test comes back empty after a harmless text change, suspect the extractor first.** Run `pdftotext` on the same bytes.
