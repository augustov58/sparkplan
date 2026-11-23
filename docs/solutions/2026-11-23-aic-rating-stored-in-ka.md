# AIC ratings printed "0.0 kA": saved in kA, formatted as amps (#313)

**Problem:** The Equipment Specs form saves `panels.aic_rating` in kA (42 for "42 kA"), but `permitPacketTheme.tsx::formatAicKa` and the one-line chip in `OneLineDiagram.tsx` divided by 1,000. Every entered rating printed "AIC 0.0 kA" on E-201, the Equipment Specs sheet and the in-app diagram. The tests stayed green because their fixtures stored amps (22000, 65000).

## Approach

1. **Decide the unit from the writers and the data, not from the reader's comment.** Writers: the form's select (`STANDARD_AIC_RATINGS`, 10…200), the manufacturer templates (`aic: 65`), `equipmentValidation.ts` (compares with `fault_current_ka`), `types.ts` ("kA"). Production rows held 10, 10 and 42. Only the formatter's docstring said "raw amps", and it had been written alongside amp-valued fixtures.
2. **Sweep every reader and count them** (`grep -rln "aic_rating|aicRating"`): 9 production files. Readers that format: `formatAicKa` (feeds `PermitPacketDocuments.tsx::formatAic` → E-201 `line4`, and `EquipmentSpecsDocuments.tsx` AIC column) and the `OneLineDiagram.tsx` chip. Truthiness only: `permitPacketGenerator.tsx` (`riserAIC`), `equipmentSpecsPDF.tsx` (has-specs). Already kA: `EquipmentSpecForm.tsx`, `equipmentValidation.ts`, `manufacturerTemplates.ts`. So 2 sites change.
3. **Owner ruling (2026-11-23, yes):** kA stays the stored unit; the readers stop dividing; the ruling is the Stable Module OK for `OneLineDiagram.tsx`.
4. **Tests built from the writer's value:** `tests/aicRatingKa313.test.ts` renders `RiserDiagram` and `EquipmentSpecsPages` with `aic_rating: 42` and asserts "AIC 42 kA" / "42 kA" as text. Every amp-valued fixture (4 files, 10 values) moved to kA.
5. **The e2e spec sets 42 kA through the form and restores empty through the app's Supabase client**, because choosing "Select AIC rating..." does not clear a saved value (the form emits `undefined`, which JSON drops from the PATCH). Filed as #314, with the form's "Maximum update depth exceeded" loop.

## Notes

- Vite HMR did not swap `permitPacketTheme.tsx` (it exports non-components) into the open packet page; the first "after" packet still printed 0.0 kA. A reload fixed it. Reload before judging a PDF change in a running dev session.
- A reload on `#/project/<id>/permit-packet` landed on the dashboard: that is #297.

## Reusable rules

- **A stored unit is what the writers save and the data holds.** Before changing a formatter or a reader, list the writers and query the stored values; a reader's docstring is not evidence.
- **Test fixtures take the writer's output, in its units** (here, the form's select value), and the test asserts the printed text.
