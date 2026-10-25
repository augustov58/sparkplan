# AHJ pages printed placeholders, promos, vacuous "Compliant" rows and out-of-order sheets

**Problem.** Bound packets printed the "will appear when bound to an AHJ" box (#149), an Inspector Mode promo and "Feeder Sizing — Compliant" on a job with 0 feeders (#150), and panel schedules (E-3xx) after E-5xx/6xx (#152). The 220.87 help text named an internal function and a fixed "220.84/220.42" citation with a fixed "E-101" (#151).

## Approach

1. **#149** — `GeneralNotesPage` drew the box unconditionally. It now takes `ahjBound` (`!!data.manifest`) and draws the box only on unbound packets.
2. **#150** — every `list.every(pred)` row is true on `[]`. `ComplianceSummary::everyCheck` returns N/A (grey) for an empty list before testing `every`. The promo bullet is removed. `hasGrounding` was `!!grounding_details row`, but the grounding plan page builds from Table 250.66 without one, so the generator passes `data.hasGrounding || sections.grounding`.
3. **#152** — sheet IDs come from each builder's band, but pages render in **push order**, and the panel-schedule builders are pushed last (they need the per-panel aggregation loop). A stable `builders.sort` by band before ID allocation fixes the order without moving that block. Attachments are appended after all generated pages, so nothing else depends on builder position.
4. **#151** — the help text now reads `aggregatedDemandSplit.necReferences` through `summarizeCalculationRefs` (the narrative's helper): Part III → "NEC 220 Part III demand factors", Part IV → "Optional Method, NEC 220.8x", plus the sections applied. The sheet ID is `formatSheetId(BAND_CALCULATIONS, 1, disciplineFromSheetIdPrefix(override ?? manifest prefix))`, shown only when the load calc section is on.

## Judgment calls

- Kept the placeholder box for unbound packets instead of deleting it: with no manifest it still tells the contractor where AHJ notes come from.
- Grounding counts as Compliant when the grounding plan page is in the packet, even if it was derived from defaults rather than a saved grounding row — the AHJ sees a grounding plan either way. Packets without the page keep "Review Required".
- Sorted the builders rather than moving the panel-schedule block: the sort fixes any future builder pushed out of band order too.
- No unit test for #151 (inline JSX in a large component); verified in the UI on the café (Part III, 220.14/220.40/430.24) and Orlando SF (Part IV, 220.83) jobs.

## Reusable rule

A status derived from `list.every(...)` must check `list.length` first and print N/A for an empty list. When display order and numbering come from different sources (push order vs band), sort by the numbering key before rendering.
