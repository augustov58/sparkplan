# The aggregate cited 220.51 for water heaters and 220.60 when nothing was omitted (#206)

**Problem.** `upstreamLoadAggregation.ts::applyDemandFactors` cited "NEC 220.51 (Fixed Appliances)" for water heaters. 220.51 is *Fixed Electric Space Heating*, and "Fixed Appliances" is not its title. `calculateHvacDemand` cited "NEC 220.60 (Omit 0.0kVA cooling)" on a panel with heating and no cooling. Both print on E-101, the panel schedule PDF and the in-app demand table.

## Approach
1. **Read the code book before the ruling's text goes in.** The NEC 2023 transcript in the Obsidian vault confirms the titles: 220.14(A) "Specific Appliances or Loads", 220.51 "Fixed Electric Space Heating", 220.14(C) "Motor Outlets" (→ 430.22, 430.24, 440.6), and 220.60 "Noncoincident Loads". None is renumbered between 2020 and 2023, so `article220Citations` isn't needed.
2. **Walk the ruling's edges before coding.** The ruling covered water heaters, heating with nothing omitted, and 220.60 only when > 0 VA is omitted. A cooling-only panel also lands in `calculateHvacDemand` and would have had no citation once 220.60 stopped printing. That's an NEC reading, so I asked: the owner ruled 220.14(C), 440.6(A), the same basis as #205.
3. **Sweep the readers.** Only the aggregate prints these strings. `residentialLoad.ts` cites "220.50, 220.51" correctly for proposed heating. Two comments called 220.51 "water heater"; they were fixed.
4. **Tests on the fixture's own circuits** ("QA Commercial panel"): water heater, heating only, one heater re-typed C (the omit path keeps 220.60), all re-typed C. Values asserted unchanged (21.30 kVA).

## Judgment calls
- The row label "HVAC - Heating (larger)" stays when nothing is omitted. The ruling is about citations, and "values unchanged" covers the rest.
- **e2e with realtime on:** the spec re-types four circuits while the page is open. Each update is now its own realtime refetch, so a prefix like `/HVAC - Cooling/` matched an in-between state (3 of 4). The readiness pattern is the expected row's full values (#317's rule, sharpened by realtime).

## Reusable rule
A citation names the section that sets the value printed beside it, by its real title from the code book. A section about omitting or reducing prints only when something is omitted or reduced.
