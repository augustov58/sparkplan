# The Commercial Load Calculator put 125% inside the load total (#195)

**Problem:** `commercialLoad.ts::calculateCommercialLoad` multiplied continuous HVAC and continuous special loads by 1.25 inside `demandLoad_VA`, so "Total Demand" was not the Article 220 load. A continuous 42 A / 208 V rooftop unit showed Demand 18.9 kVA at a "125% factor". Signs and show windows in the same function were already right: 100% in the load, × 1.25 only in `serviceSizingLoad_VA`. The issue came from grepping every calculator for `* 1.25` after the service-check ruling (#192).

## Approach

1. **Each breakdown row already had two numbers.** `demandLoad_VA` is the Article 220 load and `serviceSizingLoad_VA` is the 230.42(A)(1) sizing load. The bug was writing the 125% into both. The fix copies the sign / show-window rows: 100% in the first, × 1.25 in the second.
2. **Derive "continuous" from the input, not from the result.** The code inferred `isContinuous` from "demand factor above 100%". Once the factor is fixed at 100% that inference is always false, so the flag now comes from the user's checkbox (`some(load => load.isContinuous)`).
3. **Apply the 125% per load, then sum.** A row can mix continuous and non-continuous loads (10,000 VA continuous + 5,000 VA not = 17,500 VA sizing). The sum is kept per load rather than applied to the row.
4. **Pick the guardrail that proves nothing else moved.** The calculated amps come from `serviceSizingLoad_VA`, which had the 125% exactly once before and after. So the Acceptance pins the amps in every step (113.6 / 103.1 / 148.3 / 162.1 A) and they are the same on `main`.

## Verification

- `tests/commercialLoad.test.ts` (6 tests, the file is new): the four hand steps, signs and show windows unchanged, and an invariant that no non-motor row's demand exceeds its connected load.
- UI acceptance in the QA account ("QA Commercial calc"), the CSV export, an independent verifier, `tests/e2e/issues/issue-195.spec.ts`.

## Reusable lessons

- **When a result has a "load" field and a "sizing" field, a multiplier belongs in exactly one.** Check which field each reader prints before moving it.
- **A flag inferred from a number breaks when the number is corrected.** Carry the flag from the input.
- **Not changed, noted for the owner:** the HVAC input is labelled "MCA (Amps)". MCA already includes 125% of the largest motor (440.33), so ticking "Continuous" on an MCA value counts a margin twice in service sizing.
