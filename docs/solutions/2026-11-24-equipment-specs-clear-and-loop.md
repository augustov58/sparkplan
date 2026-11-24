# The Equipment Specs form couldn't clear a saved AIC rating, and looped on open (#314)

**Problem.** "Select AIC rating..." + Save left the MDP at 42 kA, and opening the form logged "Maximum update depth exceeded" (18–24 times, more the longer it stayed open).

## Approach

1. **Read the request body, not the UI.** The optimistic update shows the cleared value until the next fetch, so the app looks right after Save. The PATCH body (a `page.on('request')` listener) showed the clear sent **no `aic_rating` key**. The form emitted `aic_rating: undefined`, and `JSON.stringify` drops `undefined`. Text fields went as `""` (stored as empty strings, not cleared).
2. **The loop.** `OneLineDiagram.tsx` passes `onChange={(specs) => setEditingEquipmentSpecs(specs)}`, a new function each render. The form's emit effect listed `onChange` in its dependencies, so it ran after every render and set a new object in the parent, which rendered again.
3. **Fix inside `components/EquipmentSpecForm.tsx` only** (owner ruling; `OneLineDiagram.tsx` is a Stable Module):
   - `panelSpecsUpdate` / `transformerSpecsUpdate` (exported, pure) build the emitted columns with `orNull`. An emptied string or number becomes `null`; `series_rating` stays a boolean.
   - `onChange` lives in a ref (`onChangeRef.current = onChange` in an effect with no dependency list), and the emit effect depends only on the fields.
   - The parent stores the emitted object as `any` and spreads it into `updatePanel`, so `null` reaches the PATCH with no parent change.
4. **Tests.** `tests/equipmentSpecClear314.test.ts` asserts the emitted object and its JSON (`"aic_rating":null`). The repo has no DOM test tooling (no jsdom or Testing Library), so the loop is covered by `issue-314.spec.ts`, which counts the console messages on open.
5. **Specs that set a rating restore it through the form** (`tests/e2e/issues/mdpAic.ts::restoreMdpAicEmpty`). If the form leaves a value, as on main, the restore clears the column directly and fails, so a red run on main doesn't corrupt the fixture other specs read.

## Judgment calls

- `null` rather than `''` for text columns: the ruling says an emptied field clears, and every column is nullable with no CHECK constraint (`20251230_equipment_specifications.sql`).
- The transformer branch got the same `null` handling. It shares the emit effect, though no screen renders the transformer variant today.
- A spec's `finally` restore that throws hides the step that failed first. The test catches the primary failure, restores, then rethrows it (as `issue-291.spec.ts` does).

## Reusable rule

To clear a column through supabase-js, send `null`: `undefined` disappears from the request body and the column keeps its old value. A child effect that calls a parent callback keeps the callback in a ref, never in its dependency list.
