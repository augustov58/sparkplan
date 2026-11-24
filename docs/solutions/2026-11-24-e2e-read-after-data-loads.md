# An e2e spec read the MDP page before its circuits loaded (#317)

**Problem.** `issue-291.spec.ts` failed once in a full-folder run reading "TOTAL DEMAND 0.0 kVA": it waited for the "DEMAND BY LOAD TYPE" heading, which renders with 0 circuits, and then read `main.innerText()` once.

## Approach

1. **Reproduce deterministically, not by re-running.** A flake that passes 3/3 alone needs a forced delay. Hold the table's *response* back (`route.fetch()` → sleep 3 s → `route.fulfill({ response })`). Delaying the request would let the server answer late, which is a different race (#234). With `circuits` held back, main's `mdpDemand` read 0.0 kVA every time.
2. **Sweep every one-time read before fixing one.** `grep innerText()|textContent()|allInnerTexts()|allTextContents()` over `tests/e2e/issues/` found 22 reads in 12 specs, and `inputValue()|evaluateAll(|isChecked()` 7 more (29 in 13 specs). For each one: does the element it waited on prove that the data it asserts has loaded?
   - Safe (26): the data comes in the same fetch as the signal ("N calculations saved" and the Fault values are both from the rows), a static `<option>` list, render-time calculator state, a read already inside `expect.poll`, or the project row `ProjectWrapper` holds before first render.
   - Races (3): 291 (heading vs circuits); 289 ("2 calculations saved" comes from the rows, but the Stale banner needs `panels` and `transformers`, separate hooks); 301 (`not.toHaveValue('')` passed on the calculator's 200 A seed before the panels gave the MDP's 800 A).
3. **Reproduce each race under the same hold-back, read-only.** For 301 the Service Entrance button is disabled while a service row exists, so stub the calculations GET to `[]` rather than deleting fixture rows.
4. **Fix with one shared reader**, `tests/e2e/issues/pageText.ts::mainTextWhen(page, ready)`, which polls until every `ready` string or pattern is on the page and then returns the text. 291 passes each step's expected lines. 289 gates on "DP-1 (400A, 480V)": the panel suffix renders only once `usePanels` has the panel. 301 waits for `toHaveValue('800')`.
5. **Prove the regression spec detects the bug.** `issue-317.spec.ts` runs the three readers with the responses held back. Mutating `mainTextWhen` to read once turned its first two tests red.

## Judgment calls

- Polling for the *expected values* (the owner's ruling) instead of a generic "loaded" flag. After a full reload the page can only show fresh rows, so the values are the most direct proof.
- Negative checks (`not.toContain('Stale')`) can't flake, but read early they pass without checking anything. They now run only after a positive "loaded" gate. Auto-retrying negatives elsewhere (`expect(locator).not.toContainText`) have the same weakness but are not one-time reads, so they were not swept here.
- Not exported from a spec file: importing a `.spec.ts` registers its tests in the importer. The shared reader is a plain `.ts` next to the specs (testMatch is `*.spec.ts`).

## Reusable rule

Before a spec reads page text once, name the text that proves the data it asserts has loaded, and wait for that (`mainTextWhen`). A heading or a count proves only the data it is computed from.
