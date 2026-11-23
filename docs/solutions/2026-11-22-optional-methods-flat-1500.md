# The multifamily 220.84 total summed typed small-appliance VA (#291)

**Problem:** The Optional Methods count small-appliance and laundry circuits by an allowance: "1500 volt-amperes for each 2-wire, 20-ampere small-appliance branch circuit and each laundry branch circuit" (220.82(B)(1), 220.83, 220.84(C)(2)). Part III's 220.52 instead says "*not less than* 1500 … for each", which is a floor; #282 applied it as the larger of the typed VA or 1,500. The single-family Optional Methods and the Multifamily calculator already used a flat 1,500, but the MDP's 220.84 total built its base from the sum of every unit circuit's typed VA. A kitchen circuit typed at 2,400 VA added 405 VA of demand in a 3-unit building, and one typed at 1,200 counted below the code's 1,500.

## Approach

1. **Owner ruling (a):** a flat 1,500 per circuit in all three Optional Methods. The owner's reasoning: a circuit only differs from 1,500 when someone types it (documenting an existing panel, or a known appliance). The Optional Methods don't use that number; measured existing loads go through 220.87, and an appliance on a specific circuit counts at nameplate on its own row (220.82(B)(3)).
2. **Measure the difference with the existing classifier.** `residentialLoad.ts::optionalMethodAllowanceDelta` reuses `dwellingLoadsFromCircuits`, which handles descriptions, the "N @" two-circuit rows, and dryer-vs-laundry. It returns the VA above 1,500 per circuit (excess) and below it (shortfall).
3. **Apply it once, in the multifamily context.** `buildMultiFamilyContext` computes it over the dwelling base's circuits: everything under the MDP outside the EV and house panels, so the house panel's "Common Laundry" isn't a unit laundry circuit. The 220.84 branch leaves the excess out of the dwelling row and adds the shortfall at the 220.84 factor.
4. **The rows must still sum (#160).** Each difference gets its own row, like the HVAC "smaller of heat/cool, omitted" row: excess at 0 %, shortfall at the factor. The dwelling row's demand excludes the shortfall row's demand, so the column of demands adds up to the total.

## Reusable rules

- **"X for each" in an Optional Method is an allowance; "not less than X" in Part III is a floor.** Read which one the cited section says before choosing max() or a constant.
- **When one path differs from its siblings, find the shared classifier and reuse it,** rather than writing a second pattern match.
- **A base that differs from the sum of its circuits needs its own row,** or the table stops summing.
