# The EV Panel Builder's number fields clamped every keystroke (#243)

**Problem:** both number fields ran `setX(Math.max(1, Math.min(max, parseInt(value) || 1)))` on every change. Clearing the field gave `NaN || 1` = 1, so the next keystroke "2" made it "12"; from 1, typing "12" made 112, which clamped to 20. A user typing 12 chargers got 20.

## Approach

1. **Separate the text from the value.** `WholeNumberInput` keeps the field's text in local state:
   - it reports a number only when the text parses to a whole number in range, so the preview follows valid typing;
   - it clamps on blur, so 25 → 20 and an empty field → the last valid value;
   - it re-syncs its text when the value changes from outside (the builder's reset after Create, or the #230 clamp of simultaneous to the charger count).
2. **Use it for both fields,** so "Max Simultaneous Chargers" behaves the same way.

## Verification

- UI ("QA EV builder"):
  - **"12" typed after clearing:** 12 chargers, 14 circuits, 583.5 A demand, 727.5 A design, 800 A, 91%.
  - **25 → 20** on blur.
  - **Empty field:** the last value comes back, and the preview never jumps to 1.
  - **Simultaneous 2:** 103.5 A.
  - **The #230 clamp still holds:** 1 charger → 1, back to 4 → 3.
- `tests/e2e/issues/issue-243.spec.ts` uses real keystrokes (`pressSequentially`, Backspace), not `fill`. It fails on `main` with "20" for "12". Independent verifier, including arrows, decimals, negatives, "1e1" and per-frame sampling: no frame showed an invalid count.

## Reusable lessons

- **Don't clamp a text field on every keystroke.** Intermediate text ("", "1") is not the value. Keep the text, report valid values, clamp on blur.
- **Test typing with keystrokes.** `fill()` replaces the whole value at once and passes on the bug. Select-all followed by typing passed on `main` too; only Backspace and then typing reproduced it.
