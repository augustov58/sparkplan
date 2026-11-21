# Required AIC carried a 1.25× "safety factor per NEC 110.9" (#279)

**Problem:** `services/calculations/shortCircuit.ts` multiplied the available fault current by 1.25 before picking the required interrupting rating, at all three sites (downstream run, service, downstream transformer), with the comment "typically 1.25 per NEC 110.9". NEC 110.9 has no factor: the rating must be at least the current available at the line terminals. The tool, the short-circuit PDF and the packet printed "Safety Factor Applied: 1.25×" next to the 110.9 citation, and asked for 14 kA where 10 kA is the code minimum (8,632 A at a 500 kVA / 480 V service).

## Approach

1. **Stable module → owner ruling first.** The issue gave three options; the owner ruled (a): drop the factor, required AIC = first standard rating ≥ available current, cite 110.9.
2. **List every surface before editing.** `grep safetyFactor` found five readers besides the calc: the tool (`Calculators.tsx`), the saved list (`ShortCircuitResults.tsx`), the single-calc PDF and the packet's short-circuit table (`ShortCircuitDocuments.tsx`, including a fixed "Safety factor of 1.25×" NEC-references bullet), and the packet's Available Fault Current page (`PermitPacketDocuments.tsx`). The field was removed from the result type so no reader can print it again.
3. **One helper, three call sites.** `requiredAicFor(availableA)` replaces three copies of the pick.
4. **Hand calcs before the fix**, one per path, each chosen so old and new disagree (8,632 A, 8,542 A, 9,504 A: all 14 kA before, 10 kA after). The first transformer case tried (75 kVA) gave 10 kA both ways and was discarded.

## Found on the way (folded in, same lines)

- **The Available Fault Current page formatted `requiredAIC` as amps.** The calculator returns kA (10, 14, 22…); the page printed "14 A". Its test fixtures stored `requiredAIC: 22100` (amps), so every fixture packet looked right and only a real save showed the bug. The unit tests only checked that a PDF blob was produced.
- **Above 200 kA was reported compliant.** `find(...) || 200` then `compliant: requiredAIC <= 200` made the "exceeds 200 kA" branch unreachable.

## Not done here

- Rows saved before the fix keep their stored ×1.25 `requiredAIC` (and the pre-#276 fault current) until #278 recomputes saved results on read.
- E-103 lists every saved service calculation while the in-app list shows only the newest, so an older row prints on the packet but can't be found to delete. Filed separately.

## Reusable rules

- **Test fixtures must have the producer's units.** Build a page's fixture from the calculator's own output (or assert the unit), not a hand-typed number; a fixture in the wrong unit hides a formatting bug.
- **Removing a printed factor: remove the field from the type.** Then tsc finds every reader, including old jsonb rows rendered by a page.
- **A "PDF renders" test is not a content test.** Assert text with the element-tree `textOf` helper (`tests/shortCircuitAic279.test.ts`).
