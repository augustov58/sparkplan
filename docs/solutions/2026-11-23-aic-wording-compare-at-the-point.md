# The packet "confirmed" AIC ratings nobody entered (#307)

**Problem:** With no equipment interrupting rating entered, the packet still made three claims. E-201's legend said "Per-node AIC ratings shown for compliance with NEC 110.9 / 110.10". E-102 said the ratings "are confirmed against the value above". E-103 marked the service "Compliant" and closed with "All panels meet NEC 110.9". "Compliant" only meant that a standard rating at or above the fault current exists; nothing was compared.

## Approach

1. **Owner ruling 2026-11-23 (a)**, with the wording fixed for E-201 and E-102, and per-row E-103 statuses: "OK (r ≥ If kA)" / "Under-rated" / "Required ≥ N kA", with Outdated and Stale first and the counts following.
2. **One status function for both pages:** `permitPacketTheme.tsx::aicStatus(ratingKa, faultA, requiredKa, withinStandard)` and `panelAtShortCircuitPoint(calc, panels)`. The service row's point is the MDP; a panel row's is its panel. E-103 rows and E-102's comparison lines both use them.
3. **Which fault current is "that point's":** at the MDP it is the service-main value, 8,632 A (E-102's "Available at Service Main"). That is the value #279 already uses for Required AIC. The ruling's example "42 ≥ 10.5 kA" took the transformer secondary (10,459 A) from #313's issue text, which mislabelled it. Comparing with the secondary would call a 10 kA device "Under-rated" while it meets "Required ≥ 10 kA". The expected value was corrected in the issue's acceptance, with the reason.
4. **Required props, not optional:** `ShortCircuitTablePages` takes `panels`, and `AvailableFaultCurrentInput` takes `equipmentAic`. tsc listed the 2 production callers (packet, Export All) and every test fixture.
5. **Glyphs:** `PdfText` prints "≥" as ">=" (Helvetica is WinAnsi). Tests whose `textOf` expands function components see ">="; the older helpers that don't expand them see "≥", so those assertions accept both.
6. **Layout:** "Required >= 10 kA" wrapped in the 11 % status column. It is 17 % now, taken from Panel, Type, Voltage and Req. AIC. The pages were checked as images, not only as text.

## Judgment calls

- The >200 kA case (no standard rating covers it, `compliance.compliant = false`) keeps "Review" and E-102's existing NEC 240.86 sentence. The ruling didn't cover it, and it can't be reached in the QA data.
- E-103's footer already matched the other sheets (contractor block, sheet ID, "Page N of M"), so it is asserted as a guardrail, not changed.

## Reusable rules

- **A status word in a printed document must name what was compared.** If nothing was entered, print the requirement ("Required ≥ N kA"), never a verdict.
- **When a ruling's example number conflicts with its rule, follow the rule, trace where the number came from, and write both into the acceptance.** Don't silently match either one.
