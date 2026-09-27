# Calculated-method narrative cited a NEC method that never ran

**Problem:** E-102 (calculated existing load) cited dwelling Optional Methods (220.82 / 220.83 / 220.84) as "NEC 220 Part III" from a fixed per-occupancy map. They are Part IV, and for single-family the page's own calculation never ran them.

## Approach

1. Started from a stale UI help string (`components/PermitPacketGenerator.tsx` NEC 220.87 dropdown, PR #120). Grepped the section numbers in the label (`220.82/220.84`), which led to `PART_III_REFS_BY_OCCUPANCY` in `services/pdfExport/PermitPacketDocuments.tsx`.
2. Checked the NEC structure: Part III = 220.40–220.61, Part IV = 220.80–220.88 (NEC 2020/2023). So "Part III (220.42 / 220.83)" mixes Parts.
3. **Failed hypothesis:** "just relabel dwellings as Part IV." Before editing, traced where E-102's number comes from: `aggregatedDemandSplit` → `calculateAggregatedLoad`. That runs 220.84 when `multiFamilyContext` exists, but **never** 220.82/220.83 (only `calculateDwellingPanelDemand` does, and that feeds E-101 only). So relabeling single-family as Part IV would have stamped a method that didn't run. Surfaced to the PE before coding.
4. PE chose "cite what ran, from runtime refs." Implemented `summarizeCalculationRefs` (pure): regex section tokens out of free-text refs, collapse subsections into cited parents, sort, and mark Part IV iff 220.82/83/84 is present.
5. **Second failed assumption:** "`AggregatedLoad.necReferences` is complete." An integration test on the real fixture showed it contains only `220.40` for the standard path. `applyDemandFactors` never pushes 220.14 ("Other") or 220.51 (water heater); they exist only on `demandBreakdown[].necReference`. Fix: the UI passes the union of both lists. The calc service is unchanged (issue #121).

## Judgment calls

- Did **not** swap E-102 to the 220.82/220.83 calculation to match E-101. 220.83 includes the new load and has no existing/proposed split, so the page layout needs a PE ruling. Filed as #121.
- Did **not** edit `upstreamLoadAggregation.ts` to fix its incomplete `necReferences` (a calc-service change with other consumers). Used the union at the call site instead.
- Kept an occupancy fallback for direct API callers. Single-family falls back to Part III (what the source actually runs), not the Optional Method.
- Did not touch `serviceUpgrade.ts` "Part III" wording (Stable Module).

## Reusable rule

Before editing a citation on a packet page, trace the number on that page back to the function that computed it, and cite that function's runtime `necReferences` + breakdown-row references. Never cite from a fixed per-occupancy or per-method string.
