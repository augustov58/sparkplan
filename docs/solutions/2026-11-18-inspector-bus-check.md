# Inspector's bus check read only a panel's own circuits (#225)

**Problem:** `checkPanelBusLoading` summed `panel.id`'s own circuits at connected load. An MDP with no direct circuits always passed. A sub-panel's continuous loads (EV) were never taken at 125%, and the service's phase was used for every panel. The Copilot's `run_quick_inspection` had its own variant: connected VA against 80% of the bus.

## Approach

1. **Name the quantity from the code section.** 408.30: the panelboard rating is not less than "the minimum feeder capacity required for the load calculated in accordance with Part III, IV, or V of Article 220". The minimum feeder capacity is the #190 design load (demand + 25% of continuous loads, 215.2(A)(1)), which the Feeder Manager already computes (`feederDesignLoadVA`); for the MDP it's the service check (#193).
2. **One helper for both readers.** `lib/storedCalcs.ts::panelDesignAmps` gives every panel's design amps in its own phase. Inspector Mode passes it into the pure inspection service (`ProjectInspectionData.panelDesignAmps`); the Copilot's panel summaries carry it.
3. **Keep a fallback, but in the panel's phase.** Without the map, the check still uses the panel's connected load, now divided by its own voltage and phase.
4. **The spec waits for the report save**, as #193's does: Inspector shows the last saved report until a run completes.

## Verification

- `tests/inspectorBusCheck225.test.ts` (4 tests): the design amps (MDP = service check 245.3 A; EV 187.5 A; Office 57.8 A); Inspector MDP critical / EV warning / Office pass; `main`'s behavior as the fallback; the Copilot quick inspection.
- UI ("QA Service check"): MDP "Panel Overloaded Beyond Bus Rating" 245 A > 200 A; EV Panel "Panel High Utilization" 94%; Office passes. On `main` all three passed.
- Independent verifier; `tests/e2e/issues/issue-225.spec.ts`.

## Reusable lessons

- **"The panel's load" depends on what's under it.** Any per-panel capacity check reads the aggregate (or the design load), never the panel's own circuits.
- **Read the referenced quantity out of the code text.** 408.30 doesn't say "connected load"; it points to the feeder capacity, which this app already computes.
