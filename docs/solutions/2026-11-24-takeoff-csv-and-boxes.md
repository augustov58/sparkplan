# Take-off CSV split 3/4" cells; boxes estimated on feeder-only panels (#321)

**Problem.** Material Take-Off's Export CSV wrapped each cell in quotes without doubling the quotes inside it (`"3/4""`), so the row split in a spreadsheet. Outlet and junction boxes were 60 % and 20 % of *all* circuits, so the Office and Workshop take-offs (only 3-pole feeder and equipment circuits) listed outlet boxes.

## Approach

1. **Sweep the CSV writers.** `grep "text/csv"` found two: `components/MaterialTakeOff.tsx` (the bug) and `services/pdfExport/commercialLoadExport.ts`, which already had a correct private RFC 4180 `csvEscape` / `csvRow`.
2. **Reuse it, but check the import graph.** Importing from `commercialLoadExport.ts` would pull `@react-pdf/renderer` into the take-off's chunk. So the two functions moved unchanged to `lib/csv.ts`, and both writers import them. The build shows a 0.16 kB `csv` chunk, and the commercial CSV still parses (58 rows; `NEC 220.14, 220.44` stays one cell).
3. **Boxes as a pure function on the templates' data.** `racewayFill.ts::boxEstimate(circuits)` counts 1-pole circuits: Retail 11 of 13 → 6 and 2, Office 0 of 3 and Workshop 0 of 6 → 0 and 0. The counts were checked by parsing `data/project-templates.ts` before the fix, and they match the owner's numbers.
4. **The e2e spec reads the page through `mainTextWhen`** (#317), gated on the wire and fitting lines that come from the circuits. Its first draft guessed `Wire Nuts (Assorted) 2 box`, but an item without a size prints `-`, so the poll timed out on main. The error lists the missing strings, which made this a 1-minute fix rather than a debugging session.

## Judgment calls

- A box count of 0 prints **no row**: the ruling says such a panel "lists none".
- The CSV switched from "quote every cell" to "quote only when needed". Both are RFC 4180; one shared writer beats two styles.
- The residential templates' boxes change too (same rule). Their quick-start projects store no circuits, so the take-off doesn't show them.

## Reusable rule

Before writing a formatter or a parser, grep for an existing one. Move it to `lib/` instead of copying it, and check that the module you import from doesn't drag a heavy dependency into the page.
