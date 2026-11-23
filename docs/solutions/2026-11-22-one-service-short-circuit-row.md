# Superseded service short-circuit rows printed on the packet (#285)

**Problem:** Every "Save to Project" from Tools → Short Circuit → Service Entrance added a row. The Short Circuit page and E-102 each read the newest service row (`.find` on a newest-first list), but the packet's short-circuit table printed every row. Superseded service calculations printed on the AHJ packet and drove its summary ("Highest Required AIC: 14 kA" from a row the app no longer showed, where the current service needed 10 kA). The project calculator already refused a second service row; the Tools calculator didn't.

## Approach

1. **Owner ruling (a):** one service row per project; a save replaces it; the table prints only that row.
2. **Filter where rows enter the app, not per page.** `lib/storedCalcs.ts::currentShortCircuitRows` keeps all panel rows and the newest service-entrance row (`calculation_type === 'service' && !panel_id`); `useShortCircuitCalculations` applies it before the #278 recompute. Every reader goes through that hook (the Short Circuit page, Export All, E-102, the packet table, the Copilot, Pre-Inspection), and nothing else queries the table. Duplicates already in prod stop showing without a data migration.
3. **Replace on save, inside the hook's `createCalculation`.** After the insert succeeds, delete the project's other service-entrance rows. That's the order that never loses a row: a failed insert leaves the old one. It covers both calculators at once.

## Caught on the way

- The #278 regression spec saved a 2-set service row in "QA SC saved" and deleted it afterwards. With replace-on-save, that save would delete the legacy row the fixture exists for. The spec now saves in "QA Short circuit" and restores its 1-set row. **Check which specs write to a fixture whose rows a new rule deletes.**
- The browser MCP returns as soon as a page shows `alert()` ("Calculation saved successfully!"), but the script keeps running in the background. One QA script saved a second row behind my back. Step through alert-producing actions one call at a time, and confirm state in the database.

## Reusable rules

- **Rows filtered out of one view must be filtered for every view:** filter in the data hook, not in each page.
- **Replace = insert, then delete the others.** Never delete first.
- **A rule that deletes rows on save changes what e2e fixtures can survive:** grep the specs that save into those fixtures.
