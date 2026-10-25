# Saved calculator results printed old numbers after a calc rule changed

**Problem.** `settings.residential.multiFamilyLoadResult` (Dwelling Load Calculator) and `settings.residential.mfEvCalculation` (Multi-Family EV Calculator) are saved results. The packet and the Copilot read them as-is, so a rule change (e.g. #133, #138) reached a project only after someone reopened the calculator (#158). On the St. Pete QA project the saved 220.84 load was 161.4 kVA against 168.8 kVA under current rules. Its saved EV result had EVEMS off, while its saved EV inputs said EVEMS, so E-402 printed a 1632 A full-load design for an EVEMS job.

## Approach

1. **Which results can be recomputed?** The 220.84 load: yes. Unit templates, appliances and proposed loads are saved by the same calculator, and the house-panel load lives in the result itself. The EV result: no. The existing-load method, measured kW, itemized common-area loads, transformer and building profile were component state only.
2. **One function per result, shared by writer and readers** (`lib/storedCalcs.ts`):
   - `calculateMultiFamilyLoadForProject` + `toStoredMultiFamilyLoad`: the Dwelling Load Calculator computes and saves through them.
   - `multiFamilyLoadFromSettings`: readers recompute through them (MF EV Calculator, Copilot context).
   - `buildMfEvInput(savedInputs, mfLoad, edition)`: the MF EV Calculator builds its input through it. It now saves `mfEvCalculation.inputs` (every field it reads).
   - `mfEvCalculationFromSettings`: the packet recomputes from those inputs plus the recomputed 220.84 load.
3. **Legacy results** (no `inputs`) print as saved, with `recomputed: false`. The packet form shows an amber "saved by an earlier version — open the calculator once" note. Opening the calculator saves the inputs.
4. **Prefilled user fields.** The 220.87 Proposed New Load keeps the user's value. When it differs from the current suggestion, the form shows "Your entry differs. Use X kVA".

## Failed hypothesis / trap

- Comparing saved inputs with `JSON.stringify` before re-saving would loop. Postgres `jsonb` reorders object keys, so the comparison never matches after a round trip. The EV save effect re-runs on every project refresh, because the recomputed 220.84 load is a new object. `sameMfEvInputs` compares with sorted keys. Verified in the app: one write, then `updated_at` stayed fixed.
- A recompute memoized on `project.settings.residential` changes identity on every project save, which re-ran the MF EV calculator's profile auto-populate effect and would overwrite measured-method entries. Key the memo on the computed values (`JSON.stringify` of our own output, deterministic key order).
- The building profile override from the 220.84 load applies only in the calculated method. The calculator hides those fields there; in the measured method they are user-entered and must not be overwritten.

## Judgment calls

- No calc-version number. "Inputs saved or not" is the only distinction a reader can act on, because a result with inputs is always recomputed, so a version adds nothing.
- The saved results stay in settings as caches. Nothing reads them as truth except the legacy EV path.
- The "use suggested" button never overwrites on its own: the user may have a reason for their number (validation is advisory).

## Reusable rule

Save a calculator's inputs, not just its output, and make every reader recompute through the same function the calculator uses. A saved result is a cache; treat a result without its inputs as legacy and say so in the UI.
