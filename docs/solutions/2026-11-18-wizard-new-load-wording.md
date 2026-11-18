# The Service Upgrade Wizard called the whole new load "continuous" and cited 210.19 (#214)

**Problem:** the wizard's result labelled the proposed load "245A continuous load" and cited "NEC 210.19 - Continuous Load (80% rule)" plus "new load at 125% in the 220.87 check". After #188/#192 the calculated method's new load is the demand increase plus 25% of only its *continuous* part (230.42(A)(1)), and only the measured methods take continuous loads at 125%. 210.19 is the branch-circuit section. So the labels described an older calculation than the one the numbers came from.

## Approach

1. **Words follow the method, like the numbers.** The "From proposed circuits" hint already branched on `existingLoadMethod`, so the card and the references branch on the same flag. Calculated: the demand increase + 25% of continuous loads. Measured or manual: continuous loads at 125%, existing peak × 125%.
2. **Cite the sections the check actually runs:** 230.42(A)(1), 220.87 (or 220.87(2) when measured) and 625.41/625.42. Drop 210.19.
3. **Numbers unchanged** (245 A on 200 A): the spec asserts the guardrail and the wording together.
4. **The verifier's own checks found more of the same card** (folded in):
   - Manual Entry said "measured peak"; it now has its own branch.
   - A hand-picked load got the circuits' basis; now the basis shows only when the value equals `scheduleNewAmps`.
   - The Future card added `effectiveCurrentUsageAmps` (raw) to a total built from `result.existingAmps` (× 1.25); it now shows `result.existingAmps`.
   - The Current Usage input stayed editable while the calculated method ignored it; now it's read-only and shows the computed value (`currentUsageComputed` mirrors the effective-value memo's priorities).

## Verification

- UI (QA "QA Service check"): billing with 100 A shows "Current: 125A | Added: +245A | Total: 370A" and 62.5%; manual shows "a manual entry × 125%"; calculated shows "245A new load (NEC 220 demand increase + 25% …)" and the three references, with no 210.19. Utility billing shows "new load (continuous loads at 125%)" and "220.87(2) … measured peak × 125%".
- `tests/e2e/issues/issue-214.spec.ts` fails on `main` (no "245A new load"). Independent verifier.

## Reusable lessons

- **When a calculation changes, the labels around it are part of the change.** Grep the component for the old basis' words ("continuous load", the old section numbers) in the same PR as the math, or the UI explains a calculation it no longer does.
- **A card that shows "A + B = C" must take A and C from the same object.** Mixing a raw input with a result built from an adjusted copy prints arithmetic that doesn't add up.
- **An input a mode ignores should say so** (read-only, showing the value in use). Otherwise a typed number sits in the box while the result uses another.
- **A section citation must match the quantity it sits next to.** 210.19 (branch circuits) next to a service check reads as authority for the wrong rule.
