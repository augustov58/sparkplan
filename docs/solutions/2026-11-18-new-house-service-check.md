# A new house never printed its 230.42(A)(1) service check (#227)

**Problem:** the PE ruling of 2026-11-07 (#192) makes "is the service sufficient" the Article 220 load + 25% of the continuous loads, under every method, dwellings included. For existing houses E-102 and the calculator's Service Headroom card print it. For a new house the value was computed (`serviceCheckAmps`) but nothing printed it. The calculator showed only "Service Current" (the Article 220 load) and a recommended size.

## Approach

1. **The ruling already answers the question.** "Every method, dwellings too" covers new houses, so the check is printed: option A's display half. No new decision was needed.
2. **The recommendation can stay.** `recommendServiceSize` picks the smallest size with rating × 0.8 ≥ load, so rating ≥ 1.25 × load ≥ load + 25% of the continuous part. The recommended size always passes the check, and the owner's 80% margin stands.
3. **One function on both pages.** E-101 calls `calculateSingleFamilyLoadFromCircuits`, the Dwelling Load Calculator's own function, with the same circuits under the MDP (#216) and context. The calculator and the packet print the same 164 A.

## Verification

- "QA SF subpanel": calculator 156 A + "Service Check 164 A"; E-101 "164 A on the 200 A service — sufficient"; 14 pages. Existing and commercial pages unchanged.
- `tests/e2e/issues/issue-227.spec.ts` fails on `main`. Independent verifier.

## Reusable lessons

- **Before calling something "a decision", check whether a recorded ruling already covers it.** Here "every method, dwellings too" did.
- **Prove a recommendation can't contradict a new check** (rating ≥ 1.25 × load ≥ load + 25% × continuous) instead of changing the recommendation.
