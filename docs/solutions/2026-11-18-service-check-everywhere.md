# Five tools each answered "is the service big enough?" their own way (#193)

**Problem:** After the 230.42(A)(1) ruling (#192), E-102 and the Service Upgrade Wizard check the service as the NEC 220 load + 25% of the continuous loads. Five other tools still used rough rules:
- Inspector Mode: connected × 0.8.
- The Copilot: connected × 0.8, upgrade above 80%.
- The EV Panel Builder: the template's breaker sum against the service, the existing load ignored.
- The Multi-Family EV banner: a quick 220.84 estimate for the banner color.
- The Python agents: the raw connected sum.

On a project whose check is 245 A on 200 A, Inspector Mode said "nearing capacity, 83%".

## Approach

1. **One function, named for the question.** `lib/storedCalcs.ts::scheduleServiceCheck` returns the load, the adder, the check amps (unrounded; each screen rounds once), the rating and the verdict, on top of `projectDemandSplit`, the function E-102 already uses. Each tool reads it; none keeps a formula.
2. **Keep calculation services pure.** `inspectorMode.ts` takes the check as input (`ProjectInspectionData.serviceCheck`); the component computes it from its project. Without it there is no service issue, rather than a wrong one.
3. **Model the future state for "what if I add this panel".** The EV Panel Builder runs the generator (pure) and places the preview panel under the MDP in memory. It then calls the same check, so the warning is what E-102 would print after the panel exists.
4. **When a number can't be made right, label it.** The Python agents can't call the TypeScript calc, so every result carries a `basis` field calling it an estimate and pointing to the real check. The Copilot's no-project fallback does the same.
5. **Check the path is live before fixing it.** The legacy Load Calculator renders only for a project type outside the three-value enum, so it is unreachable and left alone.
6. **An e2e spec on a page that shows the last saved report must wait for the new save.** The first spec version passed on `main` because Inspector Mode displays the previous report until the run completes.

## Verification

- `tests/serviceChecks193.test.ts` (11 tests): the check (245.3 A on 200 A; the rating fallback; null without an MDP), Inspector critical / warning / none, and Copilot continuous vs not. Also: rating not 80%, the labelled fallback, and the context summary.
- UI:
  - Inspector critical 245 A.
  - Builder 493 A (97.7 kVA load + 20.5 kVA adder).
  - Wizard 245 A (guardrail).
  - Multi-Family banner blue with "can support … with EVEMS".
- Independent verifier; `tests/e2e/issues/issue-193.spec.ts` (fails on `main`: Inspector shows no "Service Undersized", banner amber).

## Reusable lessons

- **A ruling about a check reaches every screen that answers the same question,** not just the page it was found on. Grep for the answer ("utilization", "upgrade", "capacity"), not the formula.
- **A colour and a sentence that describe one verdict must come from one value.**
- **Folded in:** the Multi-Family EV upgrade card printed "Upgrade to A service" when no upgrade was needed (found by the verifier, same screen).
- **Found, not fixed (filed):**
  - #225: Inspector Mode's bus-loading check reads only a panel's own circuits.
  - #224, the EV Panel Builder's "Create EV Panel" inserts camelCase columns, so every circuit fails and an empty, service-fed panel is left behind.
