# The wizard's new load follows the 220.87 method (#188)

**Problem:** after #185 the Service Upgrade Wizard read its existing load from the panel schedule, but the new load still came only from the common-loads dropdown or a typed value. Until the user entered one, the wizard checked the service against 0 A of new load. The 12-unit QA building showed 698 A on 800 A ("adequate") while its packet needed an upgrade.

## Approach

1. **Find what E-102 uses, per method.** E-102's new load depends on the 220.87 method: calculated uses `projectDemandSplit.proposedKVA` (the demand increase, EV at 100% inside the 220.84 / Part III walk); measured and manual use `calculateProposedNewLoadVA` (EVSE ×1.25, EVEMS setpoint ×1.25). These differ: 165 A vs 204 A on the 12-unit building.
2. **Ask before choosing.** The 220.87(2) wording ("plus the new load", continuous at 125%) could argue for the ×1.25 figure under calculated too. That is a code reading, so it went to the owner. Ruling (2026-11-04): calculated → the demand increase, as E-102 uses.
3. **One helper that takes the method.** `lib/storedCalcs.ts::scheduleNewLoadAmps(project, panels, circuits, transformers, edition, method)` returns the amps, or null without an MDP or proposed circuits. It shares the kVA → amps conversion with `scheduleExistingLoadAmps` (÷ V√3 on 3-phase), so the two cannot drift apart.
4. **Keep the user's value with a flag.** The wizard re-runs the pre-fill whenever the method or circuits change, unless `proposedLoadEdited` is set (typing, the dropdown, or the clear button set it). "Use … A" clears it, so the field follows the method again.
5. **Stable Module left alone.** The dropdown's missing √3 lives in `serviceUpgrade.ts::templateToQuickAmps`, which already takes a voltage. The wizard now passes V√3 on 3-phase (service voltage, not a fixed 240 V) instead of editing the module.

## Verification

- `tests/wizardNewLoad.test.ts`: calculated 32 A vs measured 40 A for one 48 A charger on 208 V 3-phase (11.52 vs 14.4 kVA); existing + new = total demand; 1-phase conversion; null without proposed circuits or an MDP.
- In the app: 12-unit St. Pete calculated 165 A = E-101's 39.60 kVA ÷ 240 V; utility bill 204 A = the packet's 49.05 kVA suggestion ÷ 240 V. SF Existing + EV calculated 19 A = E-102's 4.60 kVA; utility bill 60 A = 11.52 kVA × 1.25 ÷ 240 V. Miami café (no proposed circuits): stays 0 A with no note. A typed 50 A survived a method switch; "Use 204A" restored the pre-fill. Dropdown 48 A charger on Miami's 208 V 3-phase: 40 A (was 60 A).

## Failed hypotheses / traps

- **A project with no proposed circuits looks like a broken pre-fill.** The Miami café QA project has none, so 0 A is correct there. Query proposed-circuit counts before blaming the code.
- **Don't change the packet's 220.87 method dropdown to compare numbers.** It edits saved project settings. Read the calculated split off E-101 in a fixture instead.

## Reusable rule

When a quantity has a per-method definition, give the shared helper the method as a parameter and let the reader recompute on every method change. Keep a user's edit with an explicit flag, not by comparing the field with the computed value.
