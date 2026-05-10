# Sprint 1 — Calculation Engine Correctness

**Status:** ✅ COMPLETE 2026-05-07
**Closed findings:** 10 (C1, C2, B-1, C3, C4, C6 + bonus fixes M4, F5, in-app C6 twin, unit panel oversizing)
**Hard prerequisites:** none — this was the entry sprint
**Index:** [`docs/sprints/README.md`](./README.md)
**Parent doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md)

---

## Why this sprint matters going forward

**All 10 fixes turned out to be consumer-side wiring / display / autogen bugs, not calculation engine bugs.** The engine modules (`upstreamLoadAggregation.ts`, `feederSizing.ts`, `conductorSizing.ts`, `demandFactor.ts:getCircuitPhase`, `multiFamilyEV.ts:calculatePerEVSELoad`) were all already correct. Consumers were:

- feeding stale data (C1, C2, B-1)
- letting placeholder data flow through unchecked (C3)
- bypassing the helper and reinventing broken inline logic (C6 PDF + in-app `calculatePanelDemand` twin)
- overriding engine output at autogeneration time before reaching the database (C4)

This is the **single most important pattern to remember across all future sprints**. Every Sprint 2A finding to date has followed it.

---

## Original packet — page-by-page (audit fixture, pre-fix)

`example_reports/Permit_Packet_Multifamily_Test_2026-05-05.pdf` (27 pages, react-pdf, 124 KB)

| Page(s) | Content | Status (pre-fix) |
|---|---|---|
| 1 | Permit application cover | ⚠️ Test data (`TBD` / `test`) |
| 2 | Equipment schedule (MDP + 14 panels + 2 feeders) | ✓ |
| 3 | Riser diagram | ⚠️ Layout broken; labels overlap |
| 4 | Load calculation summary | 🔴 Wrong DF model (treats all 498 kVA as "Other @100%") |
| 5 | NEC compliance summary | ⚠️ Decorative — only 6 line items |
| 6 | Equipment specifications | 🔴 All AIC / mfr / model / UL fields blank |
| 7 | (orphan) | 🐛 Empty page with header — page-break bug |
| 8 | Voltage drop analysis | 🔴 14 AWG to a 400 A panel; 0 A reported |
| 9–10 | Grounding electrode system | ✓ Code-correct; checklist boxes empty |
| 11 | Meter stack schedule | ⚠️ Different visual style (no SparkPlan header bar) |
| 12 | Jurisdiction Requirements (Orlando) | ⚠️ Decorative — empty checkboxes |
| 13 | MDP panel schedule | 🔴 Empty — "No circuits defined" |
| 14 | EV sub-panel schedule | ⚠️ Per-charger load math (`3,996 VA`) doesn't reconcile |
| 15 | House panel | ✓ |
| 16–27 | Unit 101–112 panel schedules | ⚠️ Byte-identical 12 pages |

---

## Fix sequencing (chronological)

Order: **C1 → C2 → C3 + B-1 + C6 → C4**.

### C1 — PDF generator was bypassing NEC 220.84 multifamily branch (2026-05-04, PR #15)

- **Symptom (pre-fix):** Page 4 "Demand Factor Breakdown" showed `Other | 498.40 kVA | 100% | 498.40 kVA | NEC 220.14`. Result: 2,077 A demand on a 1,000 A service.
- **Root cause:** Not a calc engine bug. The NEC 220.84 logic in `services/calculations/upstreamLoadAggregation.ts:638-694` was already correct. The bug was at the PDF call site in `services/pdfExport/PermitPacketDocuments.tsx:980`, which called `calculateAggregatedLoad(...)` **without** the optional sixth-argument `multiFamilyContext`. Without it the function fell through to the standard NEC 220 cascade. Every unit-panel circuit is tagged `'O'` so they all hit the NEC 220.14 catch-all at 100%. The in-app MDP "Aggregated Load" tile at `components/PanelSchedule.tsx:290` was correct because that was the only call site passing the context.
- **Verification:** All 23 rows of `MULTI_FAMILY_DEMAND_TABLE` in `services/calculations/multiFamilyEV.ts:33-57` confirmed against NEC 2023 Table 220.84(B).
- **Fix shape:** Extracted gate logic into `buildMultiFamilyContext(panel, panels, circuits, transformers, settings)`. Single source of truth for the 4-condition gate (MDP, dwelling occupancy, multi_family type, ≥3 units). Both in-app and PDF call sites now use the helper.
- **Tests:** +9 (`tests/calculations-extended.test.ts`); 132/132 pass.
- **NEC:** 220.84, 220.40.

### C2 — EV Sub-Panel feeder shown as 14 AWG Cu (2026-05-05, branch `fix/c2-evse-feeder-aggregation`)

- **Symptom (pre-fix):** Page 8 voltage-drop table: `MDP → EV Sub-Panel | 75 ft | 14 AWG Cu | 0.0 A | 0.00% | Compliant`.
- **Root cause:** `feeders.total_load_va` is a cached column set at feeder-creation time. Auto-population workflows (Multi-Family EV calculator, templates) create feeders before destination-panel circuits exist, so `total_load_va = 0` is persisted. PDF generator at `VoltageDropDocuments.tsx:283-285` read the cached value verbatim. `calculateFeederSizing(0)` returned the smallest entry in the ampacity table (14 AWG, NEC 310.16) with vacuous-truth voltage drop (0 A × R × L = 0 V → "Compliant"). NEC 240.4(D) enforcement was already correct — 14 AWG was the right answer for the wrong input.
- **Fix shape:** Live-derive on read. New `computeFeederLoadVA(feeder, panels, circuits, transformers)` helper in `services/feeder/feederLoadSync.ts` calls `calculateAggregatedLoad` against the destination panel and returns `totalDemandVA` (post-NEC 220 cascade per NEC 215.2(A)(1)). PDF generators and gating helpers consult the helper instead of the cached column. Cached column preserved for future PE seal snapshot needs.
- **Why not write-on-PDF-gen and persist?** Race conditions with parallel previews. Live-derive is idempotent and side-effect-free.
- **Why not drop the column entirely?** Future PE seal workflow (Sprint 3) needs a snapshot field.
- **Tests:** +6; 138/138 pass.
- **NEC:** 240.4(D), 215.2(A)(1), 220.40.

### B-1 — chatTools.ts AI assistant gave wrong feeder answers from cached column (2026-05-05)

- **Symptom (pre-fix):** AI confidently said "Compliant. 0.00%" on the EVSE feeder the PDF was misreporting. Same staleness pattern as C2.
- **Root cause:** Not an AI logic bug — AI was correctly summarizing the data given to it. The `ProjectContext` summary is intentionally lossy for AI prompt efficiency: `FeederSummary` exposes `voltageDropPercent` (cached) but not `total_load_va`, `distance_ft`, `conductor_material` etc. needed to recompute live.
- **Fix shape:** Plumb raw DB rows alongside the lossy summary. `ToolContext` gained optional `rawPanels`, `rawCircuits`, `rawFeeders`, `rawTransformers`. `askNecAssistantWithTools` accepts an optional `AgenticRawData` arg threaded into ToolContext. The `calculate_feeder_voltage_drop` tool now calls `computeFeederLoadVA + calculateFeederSizing` live and returns `{ voltageDropPercent, compliant, conductorSize, designCurrentAmps, liveLoadVA, calculationSource: 'live' }`.

### C3 — Project metadata is test placeholder text (2026-05-06, advisory-only)

- **Symptom (pre-fix):** Page 1 cover shows `Project Address: TBD`, `Permit Number: test`, `Contractor License: test`.
- **Root cause:** Validation layer simply had no shape rules. `lib/validation-schemas.ts:projectSchema.address` only required `.min(1)`. No schema for the permit-number field at all.
- **User-direction shift on 2026-05-06:** First implementation hard-blocked PDF generation when fields were placeholder-shaped. User pushed back: contractors legitimately need to print draft packets with "TBD" for pre-application AHJ walk-ins. Reworked to **advisory-only**.
- **Fix shape (final):** Three exported Zod schemas describe AHJ-acceptable values (`projectAddressSchema`, `flContractorLicenseSchema`, `permitNumberSchema`). Schemas are advisory only — `projectSchema.address` reverted to permissive `.min(1).max(200)`. `PermitPacketGenerator.tsx` runs `safeParse` and shows a **blue informational alert** on failure with the caveat *"Packet will still generate — these are informational only."*
- **Tests:** 160/160 pass.
- **Memory:** This is the source of the [validation-advisory-not-blocking](../../.claude/projects/-home-augusto-projects-sparkplan/memory/feedback_validation_advisory.md) memory.

### C4 — NEC 625.42 EVEMS sizing math doesn't reconcile (2026-05-07, PR #19, 7 commits)

- **Symptom (pre-fix):** Page 14 EV sub-panel showed 12 chargers at `3,996 VA` each. `3,996 × 12 = 47,952` ≈ EVEMS aggregate setpoint — i.e. EVEMS feeder-level reduction was being collapsed onto branch circuits, where it doesn't belong per NEC 625.40 + 210.19.
- **Root cause:** Same consumer-side wiring class as C1, C2, B-1. The NEC 220.57 per-EVSE engine in `multiFamilyEV.ts:526-532` was correct. The bug was at autogeneration: `data/ev-panel-templates.ts:531-535` had a `useEVEMS && evemsLoadVAPerCharger` override that wrote the EVEMS-managed *per-charger share* into each branch circuit's `loadVA` instead of full nameplate.
- **Why simply removing the override would have regressed C1:** `buildMultiFamilyContext` collected the EV panel's `totalConnectedVA` and used it as `evLoadVA` in the MDP-level NEC 220.84 calc. With branches at the (broken) EVEMS-shared value, `evLoadVA` accidentally came close to the EVEMS setpoint, so MDP service demand happened to come out approximately right by canceling errors. After raising branches to nameplate, `evLoadVA` would jump from ~48 kVA to ~138 kVA — over-recommending the service by ~15%. **Fix had to add a parallel correct path** before removing the wrong-but-load-bearing one.
- **Fix shape (three-pronged):**
  1. **Branch row VA = nameplate, always.** `data/ev-panel-templates.ts:531-535` rewritten to `circuitLoadVA = max(7_200, loadVA)` per NEC 220.57(A).
  2. **Explicit EVEMS setpoint marker circuit (NEC 625.42).** When `useEVEMS` is on, autogen emits a metadata-only "EVEMS Aggregate Setpoint (NEC 625.42)" circuit whose `loadVA` carries the calculator's exact setpoint. Load aggregator excludes this circuit from connected-load sums. Legacy projects (only "EVEMS Load Management System" 500 VA placeholder) detected via panel-breaker upper-bound proxy as backward-compat fallback.
  3. **NEC 625.42 EVEMS clamp at feeder/service level.** `calculateAggregatedLoad` clamps `totalDemandVA` to setpoint when `totalDemandVA > setpointVA`. `MultiFamilyContext` gained `evDemandVA?` field so MDP-level calc subtracts raw connected EV (`evLoadVA`) from the dwelling base while adding back EVEMS-clamped demand (`evDemandVA`) at 100% per NEC 625.42 — basis-consistent on both sides.
- **Bonus fixes during C4 review (each its own commit):**
  - **M4 promoted forward** — MDP feeder synthesis on PDF (was empty "No circuits defined" because MDP has no direct circuits, only feeders).
  - **F5** — EV meter orphan cleanup in `addEVInfrastructure`.
  - **In-app twin of C6** — `calculatePanelDemand` was rotating B→C for 2-pole loads on 1Φ split-phase panels (orphan Phase C bucket, 99.6% imbalance display).
  - **Unit panel sizing** moved from misnamed Standard Method (`calculateSingleFamilyLoad`) to true NEC 220.82 Optional Method inline (200A → 125A on audit fixture).
  - **Unit panel summary demand display** uses NEC 220.82 (was showing 150A on 125A panel — raw connected misread as demand).
- **Tests:** +18; 181/181 pass.
- **NEC:** 220.57(A), 625.40, 625.42, 220.18, 210.19, 215.2(A)(1).

### C6 — Panel schedule PDF lumped every circuit to Phase A (2026-05-06)

- **Symptom (pre-fix):** Pages 13–27 showed "Phase A" for all 240 V single-phase (split-phase 1Φ-3W) panels; bottom Load Summary reported Phase A = total connected / Phase B = 0 / Phase C = 0.
- **Root cause:** Same consumer-side wiring class as C1/C2/C3/B-1. In-app `components/PanelSchedule.tsx` was correct (called `getCircuitPhase` from `demandFactor.ts`). PDF rendering at `services/pdfExport/PanelScheduleDocuments.tsx` had reinvented broken inline phase logic: line 323/526 used `panel.phase === 1 ? 'A' : ['A','B','C'][(row-1) % 3]`. `calculatePhaseBalancing` for `panelPhase === 1` lumped all load to A and never split 240 V 2-pole loads across both legs.
- **Fix shape:** Replaced inline phase expressions with `getCircuitPhase(leftNum, panel.phase === 3 ? 3 : 1)`. Rewrote `calculatePhaseBalancing(panelPhase=1)` to (a) place 1-pole loads on whichever leg `getCircuitPhase` says, (b) split 2-pole 240 V loads 50/50 across both legs.
- **Tests:** +4.

---

## Diagnostic shortcut (validated across 10 fixes — saved ~10 days)

- **In-app view correct but PDF disagrees** → look at the PDF call site or autogeneration, not the engine.
- **Displayed values look impossible** (demand > breaker, imbalance > 100%, "circuit" with breaker too small for the load) → category-error display bugs.
- **Calc right at one layer but wrong at another** → bypass / inline reimplementation of a shared helper.

## Three meta-lessons

1. **Removing a wrong-but-load-bearing line can regress a previous fix.** The 3,996 VA branch override (C4) was wrong but was also the channel through which EVEMS reduction reached MDP service-sizing. Fixing C4 cleanly required a parallel new path. **Scan future fixes for "what previous behavior is this masking?" before deleting.**
2. **Same bug pattern can exist in multiple call sites.** C6 fixed phase-column rotation in PDF panel-schedule. C4 user review surfaced an *identical* bug in in-app `calculatePanelDemand`. **When you fix a pattern bug, grep the codebase for the same idiom.**
3. **Function header comments lie.** `calculateSingleFamilyLoad` is documented as "NEC 220.82" but its implementation is the Standard Method (NEC 220.40 + individual demand factors). Tracked as F6 in parent doc.

## Architectural patterns established (used by all downstream sprints)

- **Live-derive on read, cache for snapshot** (C2): preserve cached column for future PE seal snapshot, flow live values through calc layer at render time.
- **Helpers exported from calc layer for UI/PDF detection** (C4): `isEVEMSMarkerCircuit`, `findEVEMSSetpointMarker`, `isDwellingUnitPanel`, `calculateDwellingUnitDemandVA`. Future sprints follow this shape (e.g., Sprint 2C will export `isPanelArtifactPresent(packet, requirement)`).
- **MultiFamilyContext-style basis tracking** (C4): when a calc has connected vs demand on different bases, expose both as fields on the context interface so consumers can subtract one and add back the other consistently.
- **Synthesize virtual rows at PDF generation time** (M4): for cross-table relationships (feeders ↔ panels, panels ↔ AHJ requirements), synthesize at the consumer instead of forcing the DB to model the relationship.

---

## NEC references touched in this sprint

- **220.57(A)** — Per-EVSE branch-circuit load = `max(7,200 VA, nameplate)`. Not a demand factor.
- **220.82** — Single-family Optional Method. First 10 kVA general @ 100%, rest @ 40%; + larger of A/C vs heat @ 100%.
- **220.84** — Multi-family Optional, ≥3 units. Apply table demand factor to dwelling base; non-dwelling excluded, added back at 100%.
- **220.40** — Feeder load.
- **240.4(D)** — Small-conductor protection.
- **215.2(A)(1)** — Feeder ampacity ≥ 1.25 × continuous demand.
- **625.40** — EVSE branch conductors at full continuous nameplate × 1.25.
- **625.42** — EVEMS feeder/service may be sized to managed setpoint.
- **408** — Panel schedule must show every protective device including feeder breakers (drove M4 MDP feeder synthesis).

---

## Cross-references

- **Parent doc** [`AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md) — for AHJ matrices, F-tier follow-ups (F1–F7 are this sprint's tech debt), Canvas vs Generator decision.
- **Sprint 2A** [`sprint2a-form-factor.md`](./sprint2a-form-factor.md) — extended Sprint 1's patterns: generator builder pattern, sheet ID category bands, themed PRs. Sprint 2A also fixed the `calculatePanelDemand` in-app twin of C6 spotted during C4 review.
- **Sprint 4** [`sprint4-polish.md`](./sprint4-polish.md) — M5 (collapse byte-identical pages) builds on C6 phase-balance fix; M2 (NEC compliance summary expansion) leverages this sprint's NEC reference patterns.
