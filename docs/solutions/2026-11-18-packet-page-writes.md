# Opening the Permit Packet page saved the project twice (#252)

**Problem:** `PermitPacketGenerator.tsx` persists two form blocks (`permitPacketDefaults`, `nec22087Narrative`) with debounced effects. Each skips the save when `JSON.stringify(next) === JSON.stringify(stored)`. Postgres jsonb returns object keys in its own order (by length, then alphabetically), so the comparison was always false and every visit saved twice. The "Project updated" toast showed with no edit.

## Approach

1. **Use the helper that already exists.** `lib/storedCalcs.ts::stableJson`, JSON with sorted keys, was written for the stored-calc save effects (Mistake Ledger: "compare saved jsonb with sorted keys"). It's now exported, and both effects use it.
2. **Don't seed defaults on a first visit.** With nothing stored, the comparison was `next` against `{}`, so the first visit still saved both blocks of defaults (the verifier's own check). Default values come from profile auto-fill and initial state, so a value baseline can't tell them from an edit. A DOM change event can: an `onChangeCapture` on the form root sets `userEditedRef`, reset per project. Programmatic `setState` (hydration, auto-fill) fires none. With nothing stored and no edit, nothing is written.
3. **Rule out the newest suspect first.** The writes showed up right after the #234 hook change, which adds a refetch after each write. The same page with the pre-#234 hooks made the same two writes, so it predated #234 and wasn't a loop: the effects depend on the form fields, not the project.

## Verification

- 0 writes on load on two QA projects (was 2 each), and 0 on a project with nothing stored (was 2, the defaults). Its first edit saves once. An edit to Scope of Work saves once and survives a reload; restoring it saves once.
- `tests/e2e/issues/issue-252.spec.ts` fails on `main`. Independent verifier, twice.

## Reusable lessons

- **Any "skip if unchanged" against a jsonb column must compare with sorted keys.** `JSON.stringify` order is insertion order; jsonb's isn't.
- **To tell a user edit from programmatic state, listen for the DOM change event** (`onChangeCapture` on the form root); `setState` never fires one.
- **When a symptom appears right after a change, swap in the old code before blaming it.** Here it was older than the change.
