# QA projects (QA account only)

Named projects in the QA account (`E2E_QA_EMAIL`) that issue acceptance steps and
`tests/e2e/issues/*.spec.ts` refer to by name. The loop may create, edit and
delete these freely; never point a spec at the owner's account.

Add a row when a scenario needs a project none of these covers. No row IDs or
stored settings values here (public repo).

Last updated: 2026-11-17

| Project name | Scenario | Key setup |
|---|---|---|
| QA EVEMS tool (NEC 2023) | EVEMS Load Management tool (#194); EV Charging calculator (#198); EVEMS load schedule (#199); EVEMS max chargers (#202) | Blank residential project, NEC Edition = 2023 Edition; the tool keeps its own defaults (200 A / 240 V / 24 kVA demand) |
| QA Commercial calc | Commercial Load Calculator (#195) | Blank commercial project (Start from Scratch); the calculator keeps its own defaults in the tab (Office, 10,000 sq ft, 50 receptacles, one 42 A / 208 V / 3-phase continuous HVAC row) |
| QA Commercial panel | Panel Schedule demand table and cards (#191) | Commercial project (Start from Scratch), main panel "MDP" 208 V 3-phase, seven 1-pole circuits on odd slots: Lighting (L) 3,000 VA; Receptacles (R) 1,800 VA; Water heater (W) 4,500 VA; Unit heater 1 to 4 (H) 3,000 VA each |
| QA EVEMS panel | Panel Schedule on an EVEMS-managed panel (#191) | Commercial project, main panel "MDP" 208 V 3-phase, "EV Charger #1" to "#4" (O) 11,520 VA each, plus the marker circuit "EVEMS Aggregate Setpoint (NEC 625.42)" 20,000 VA. The chargers are 1-pole for a short setup; the demand values don't depend on poles |
