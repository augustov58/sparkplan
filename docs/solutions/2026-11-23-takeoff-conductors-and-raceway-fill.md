# Material Take-Off counted one wire per circuit and guessed conduit (#304)

**Problem:** `components/MaterialTakeOff.tsx` priced ~50 ft of wire per circuit, one conductor regardless of poles, so 3-pole circuits were a third of their wire. Its conduit was "circuits × 10 ft of 3/4″, plus 30 % of that in 1″ for larger wire sizes", unrelated to the conductors: the Office template's 1 AWG feeders got 3/4″, and Retail's 12 AWG circuits got 1″. Separately, the Retail template stored its lighting circuits as 'O'. Two template descriptions claimed things the templates don't create, and the notes said "1 circuits".

## Approach

1. **Owner ruling 2026-11-23.** Wire per circuit = poles, plus 1 neutral on 1-pole circuits (a multi-pole neutral can't be known from the row). Conduit (a): Chapter 9 at 40 % fill, EGC included, totalled by trade size. Keep the run lengths. The Retail sign stays 'O' (220.14(F)).
2. **Pure module for testability:** `services/calculations/racewayFill.ts` (`conductorsPerCircuit`, `emtTradeSizeForCircuit`, `branchWiringTakeoff`). The component spreads its lines. The tests assert the three templates' take-offs against the hand calc in the issue, built from `data/project-templates.ts` itself.
3. **Data, not new tables:** THHN areas from `data/nec/chapter9-conductor-dimensions.ts` (Table 5), EMT 40 % areas from `chapter9-conduit-dimensions.ts` (Table 4). Checked against the ruling's example: 3 × 0.1562 + 0.0366 = 0.5052 in² → 1-1/4″ (1″ holds 0.346).
4. **Never guess a size:** a conductor not in the table lands in a "TBD" conduit line with a warning (advisory, not blocking).
5. **Template load codes:** `CircuitTemplate.load_type?: 'L'`, passed through by `templateService.ts` only when set (other rows stay null, read as 'O'). E-101 total unchanged (40.44 kVA); a 5.34 kVA lighting row splits out of "Other".
6. **Older specs:** `issue-294.spec.ts` asserted "1 circuits" and the Retail lighting at 'O'. It now asserts "1 circuit," and 'L'.

## Judgment calls

- The 50 ft wire / 10 ft conduit per circuit are inconsistent with each other, but the ruling kept them; the PR states them.
- 40 % fill is the ruling's rule. A 1-pole circuit with no EGC would be 2 conductors (31 % in Table 1), but every template circuit has an EGC.
- The Estimating bid take-off (`services/estimating/autoTakeoffFromProject.ts`) prices branch circuits as bundles and was not part of the ruling; untouched.

## Reusable rules

- **Move a take-off or estimate's math out of the component into a pure function** before changing it, and test it on the templates' own data.
- **Size a raceway from the conductors in it, never from a percentage guess:** count conductors per circuit, add the EGC, and compare with the Table 4 column for the conductor count.
