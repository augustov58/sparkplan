# Creating many circuits fired one toast per circuit (#242)

**Problem:** `useCircuits.createCircuit` and `usePanels.createPanel` show a success toast on every call. Flows that create in a loop toasted every row:
- **The EV Panel Builder:** about 8 toasts.
- **The Dwelling Load Calculator's Apply:** 18, followed by a blocking `alert`.

The stack covered the panel tabs, and it doesn't time out while hovered.

## Approach

1. **The caller decides, the hook keeps its default.** `createCircuit(row, { silent: true })` and `createPanel(panel, { silent: true })` skip only the success toast; errors still toast. Single-item callers don't change.
2. **The batch toasts once, with what actually happened.**
   - The EV builder keeps its summary toast.
   - Apply counts the circuits that saved and toasts `toastMessages.circuit.bulkCreated(n)`.
   - Apply's `alert` is gone: it repeated the toast and counted circuits that had been skipped.
3. **A fixture you can re-run.** "QA Dwelling generate" is a copy of "QA SF subpanel"'s project and Main Panel. Apply replaces its circuits with the same 18, so the spec can run it every time without touching the fixture the #216/#228 specs read.
4. **Left alone:** `OneLineDiagram.tsx`'s bulk creator, a stable module, still loops with toasts and an alert.

## Verification

- UI:
  - EV builder Create: exactly one toast.
  - Dwelling Apply: "18 circuits added" once (plus "Project updated", and "18 circuits deleted" on re-apply), no alert.
- `tests/e2e/issues/issue-242.spec.ts` records toasts with a MutationObserver installed before the app loads. It fails on `main` (7 extra toasts; no batch toast). Independent verifier.

## Reusable lessons

- **A hook that toasts on success needs a way to be quiet.** Otherwise every loop over it floods the screen.
- **Count what succeeded, not what you attempted.** The old alert reported `generatedCircuits.length`, including circuits skipped for lack of slots.
- **Record toasts with a MutationObserver on `[role=status]`, installed in `addInitScript`.** It catches toasts that come and go between assertions.
