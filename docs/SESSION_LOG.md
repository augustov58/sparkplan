# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-07

---

### Session: 2026-05-06 / 2026-05-07 — AHJ Compliance Audit C4 omnibus (Sprint 1 close-out)

**Focus**: Single long session that started as the C4 fix (per-EVSE branch math + EVEMS feeder reduction, the last engine-correctness bug from the audit) and turned into a Sprint-1 close-out across multiple user-review cycles. PR #19 (`fix/c4-evems-branch-circuit-math`) accumulated 7 commits as each user review surfaced an additional issue worth fixing in the same PR.

**Status**: ✅ Sprint 1 COMPLETE. PR #19 awaiting user merge. 181/181 tests pass (was 164 pre-C4, +17 across the seven C4 commits). `npm run build` exits 0 in 4.7s. ROADMAP updated with Phase 3.3.

**The C4 commit arc**:

1. **`aa1d3bb`** — Initial fix. Branch row `loadVA = max(7,200, V × I)` per NEC 220.57(A) (was overriding to EVEMS-shared per-charger value). New `isEVEMSManagedPanel` + `evemsSetpointVA(panel)` helpers in `upstreamLoadAggregation.ts`; clamp via `panel.main_breaker_amps × voltage` proxy. `MultiFamilyContext.evDemandVA?` for basis-consistent NEC 220.84 + 625.42 combined math.

2. **`c85b088`** — User review found MDP showing 1199A on 1000A panel, EV Sub-Panel showing 585A on 400A panel. Root cause: panel-breaker proxy was over-generous (~2x the actual setpoint, because autogen rounds breaker UP to standard size). Fix: emit explicit "EVEMS Aggregate Setpoint (NEC 625.42)" marker circuit carrying the calculator's exact `scenario.powerPerCharger_kW × 1000 × chargerCount`; `evemsSetpointVA` reads from marker, falls back to proxy for legacy. Marker excluded from connected sums in `collectCircuitLoads` + `directConnected` reducer. PanelSchedule.tsx panel-summary "Demand Amps" tile now uses aggregated demand whenever it's smaller than direct demand (clamp engaged) — not just when downstreamPanelCount > 0.

3. **`38f1d25`** — User asked "why is there a 47.94 kVA circuit on a 20A 2P breaker on the panel schedule?" Two issues: (a) marker circuit was rendering as a regular branch in the in-app PanelSchedule.tsx — looks like a code violation. Filtered out. (b) Same 200A panel rating user asked about — autogen heuristic was `simultaneousChargers × breakerSize` rounded up. Replaced with NEC 215.2(A)(1) sizing from explicit setpoint: `ceil(setpointAmps × 1.25)` → 300A panel for the audit fixture (was 400A).

4. **`ea67d7d`** — User regenerated the PDF and reported 3 issues: (a) MDP page showed "No circuits defined" / 0 kVA — fixed by synthesizing virtual feeder rows at PDF generation time (M4 from audit doc, was Sprint 4 polish, promoted forward). (b) Meter stack showed 4 "EV Meter" rows (1 linked + 3 orphans, `17 used / 15 total` impossible) — fixed `addEVInfrastructure` orchestrator to delete by `meter_type='ev'` (catches orphans whose `panel_id` was nulled by external deletion). (c) EV Sub-Panel marker still showing on PDF page 15 — root cause: my `38f1d25` filter was on `MultiPanelDocument` but the permit packet uses a different export `PanelSchedulePages`; filter applied there too. Plus unit panel sizing fix using `calculateSingleFamilyLoad` (turned out to be misnamed, see #6).

5. **`aa72bdb`** — User regenerated and confirmed unit panels still 200A AND noticed Phase Imbalance: 99.6% (impossible value) on Unit 110 with phase totals 5.7 / 17.0. Investigation: same 3Φ-rotation bug as C6 but in `calculatePanelDemand` (`services/calculations/demandFactor.ts:281`) — for 2-pole loads on 1Φ split-phase panel, rotated B→C, orphaning ~13.5 kVA into a phantom Phase C bucket that's never displayed. Same fix pattern as C6: when `phase === 1`, split 50/50 across A and B regardless of which row the slot lands on. **In-app twin of C6.**

6. **`0b6ce69`** — User regenerated and reported "the amps still show 200A." Investigation: `calculateSingleFamilyLoad` (used by my `ea67d7d` sizing fix) is **misnamed** — header claims NEC 220.82 but implementation is the Standard Method (NEC 220.40 + individual demand factors per appliance). For user's config (12 kW range, 5.5 kW dryer, 4.5 kW WH, 5 kW A/C, 0.5 kW disposal), Standard Method gives ~30 kVA / 154 A × 1.25 = 200 A. True NEC 220.82 Optional Method (first 10 kVA general @ 100%, rest @ 40%, + larger of A/C vs heat @ 100%) gives 22.88 kVA / 95 A × 1.25 = 119 A → 125 A panel. Fixed by inlining true NEC 220.82 in autogen (skip the misnamed function). Added F6 follow-up: rename and clean up.

7. **`a6f2050`** — User confirmed 125A panel sizing but reported "Direct Demand Load: 36.2 kVA / 150.8 A on a 125 A panel" misleading display. Root cause: panel-summary cards use `calculatePanelDemand` (panel-local NEC 220.14 cascade) — for circuits all tagged 'O', demand = connected. Real NEC 220.82 demand is 23 kVA / 95 A. Fix: new `calculateDwellingUnitDemandVA(circuits)` + `isDwellingUnitPanel(name, circuits)` helpers in `residentialLoad.ts`. PanelSchedule.tsx and PanelScheduleDocuments.tsx (PDF) detect dwelling unit panels and substitute NEC 220.82 demand for the display, with a small `(NEC 220.82)` annotation.

**Bonus findings discovered during C4 review** (each captured as its own row in the audit doc's Fix Sequencing table, all bundled into PR #19):
- **M4** (MDP feeder synthesis) — promoted forward from Sprint 4
- **F5** (EV meter orphan cleanup) — new follow-up, fixed in same orchestrator
- **In-app twin of C6** — same bug pattern as C6 in a different code path
- **Unit panel sizing + summary display** — two distinct fixes (sizing + display), both due to NEC 220.82 not being properly implemented in the codebase

**Decisions made**:

- **Carry EVEMS setpoint as a metadata-only circuit, not panel.notes JSON or new column** — cleanest no-migration path. Description "EVEMS Aggregate Setpoint (NEC 625.42)" is the marker; `loadVA` carries the value. Excluded from connected sums in `collectCircuitLoads` + `directConnected` reducer. Side benefit: AHJ reviewers see the setpoint visibly listed (addressing the audit's "EVEMS aggregate row shows 500 VA — way too low" complaint).
- **Hide marker from panel-schedule table, show in dedicated callout** — rendering the marker as a regular circuit row with a 20A 2P "breaker" carrying 47 kVA looks like a code violation. Filter it out + emit a clearly-labeled info block.
- **Inline NEC 220.82 in autogen rather than fix `calculateSingleFamilyLoad`** — the misnamed function is used by other code paths (calculator UI). Renaming it would be a larger refactor (F6). Inlining gives us the right behavior in autogen without churn elsewhere.
- **Display-layer detection of dwelling unit panels via name + circuit shape** — `isDwellingUnitPanel(name, circuits)` matches "Unit \d+", "Apt \d+", "Apartment \d+" name patterns AND requires dwelling-shape circuits (kitchen / range / laundry / dryer / WH / dishwasher). Conservative: a House Panel or EV Sub-Panel named "Unit X" would still be rejected because it lacks dwelling shape.
- **In-app `calculatePanelDemand` 2-pole split**: when `phase === 1`, split 50/50 across A↔B regardless of which row the slot lands on (NEC physics: 240V load draws across both stabs). Same fix as C6 (PDF) but in the in-app code path.
- **Panel-breaker proxy for EVEMS setpoint kept as legacy fallback** — for projects generated before commit `c85b088` (only the 500 VA "EVEMS Load Management System" placeholder, no explicit setpoint marker). Better than no clamp; over-clamps by ~2x but always upper-bound. New projects use the precise marker.

**Key Files Touched**:
- C4 calc: `data/ev-panel-templates.ts`, `services/autogeneration/multiFamilyProjectGenerator.ts`, `services/calculations/upstreamLoadAggregation.ts`, `services/calculations/demandFactor.ts`, `services/calculations/residentialLoad.ts`, `services/autogeneration/projectPopulationOrchestrator.ts`
- UI: `components/PanelSchedule.tsx`
- PDF: `services/pdfExport/PanelScheduleDocuments.tsx`, `services/pdfExport/permitPacketGenerator.tsx`
- Tests: `tests/calculations-extended.test.ts` (+17 tests across the 7 commits)
- Docs: `docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md` (Sprint 1 marked ✅ COMPLETE; full retrospective + Insight section refresh; Next Session Brief rewritten for Sprint 2 / Sprint 3 choice), `docs/CHANGELOG.md` (Sprint 1 omnibus entry), `docs/SESSION_LOG.md` (this entry; rotated 2026-05-05/06 entry out per "keep last 2"), `ROADMAP.md` (Phase 3.3 added)

**Pending / Follow-ups**:

- **PR #19 user merge.** User explicitly asked to "review and merge."
- **Visual verification on Vercel preview** after merge: regenerate the example permit packet, confirm everything in the Sprint 1 scoreboard (Pre-flight checklist in audit doc Next Session Brief).
- **F4 + F6** — add `panels.is_evems_managed` + `panels.evems_setpoint_va` columns AND rename `calculateSingleFamilyLoad` → split into Standard + Optional. Both are no-migration-yet items; do together when DB next touched.
- **Sprint 2 vs Sprint 3 choice** — Sprint 2 (Permit Mode v1: H1-H4 + M1) recommended next per audit doc rationale. Multiple small additions, share `permitPacketGenerator.tsx` surface area, ship as one PR. Sprint 3 (C5 PE seal) is bigger and benefits from PE seal landing on a packet that already looks clean.

**PRs**:

- #15 — C1 (merged earlier sessions)
- #16 — C2 (merged earlier sessions)
- #17 — C3 + B-1 + C6 (merged 2026-05-07 03:00 UTC)
- **#19 — C4 omnibus** (open, awaiting merge)

---

### Session: 2026-05-05 / 2026-05-06 — AHJ Compliance Audit C3 + B-1 + Panel-Phase (bundled, PR #17 merged)

**Focus**: Fourth audit-Sprint-1 session. C1 + C2 already merged earlier. This session shipped the C3 (project-metadata advisory validation) + B-1 (chatTools.ts AI staleness) + C6 (panel-schedule PDF phase column) bundle — all three are consumer-side wiring fixes that didn't touch any calculation engine.

**Status**: ✅ All three shipped on `fix/c3-b1-bundle`, PR #17 merged 2026-05-07. 164/164 tests pass (was 138 pre-bundle, +26 new).

**Direction shift on 2026-05-06**: First C3 implementation hard-blocked PDF generation when fields were placeholder-shaped. User pushed back — contractors legitimately need draft packets with "TBD" for pre-application AHJ walk-ins. C3 was reworked into advisory-only. Saved this preference to memory at `feedback_validation_advisory.md` so future sessions don't reintroduce hard-block validation.

**Panel-Phase bug spotted by user on 2026-05-06**: While reviewing the regenerated audit packet, user noticed every circuit on the Unit 108 Panel page (240V single-phase split-phase) showed "Phase A". Investigation: in-app `components/PanelSchedule.tsx` was correct (uses `getCircuitPhase` from `services/calculations/demandFactor.ts`); PDF at `services/pdfExport/PanelScheduleDocuments.tsx` had reinvented its own broken inline phase logic. Same C1/C2 pattern: correct helper exists, PDF call site bypasses it. Fixed.

**Root causes (consumer-side wiring/validation, not engine bugs — same pattern as C1, C2)**:
- **C3**: `lib/validation-schemas.ts:projectSchema.address` only required `.min(1)`, so `"TBD"` (3 chars) passed. `components/PermitPacketGenerator.tsx:93` checked `contractorLicense.trim().length > 0` — accepting `"test"`. AHJ-rejection risk slipped past existing form gates.
- **B-1**: `services/ai/chatTools.ts:293` read `feeder.voltageDropPercent` (cached column on the lossy `FeederSummary`). Same staleness pattern as the original C2 bug.
- **C6**: `services/pdfExport/PanelScheduleDocuments.tsx` had inline `panel.phase === 1 ? 'A' : ['A','B','C'][(row-1) % 3]` instead of calling `getCircuitPhase`.

**Work Done**:
- C3: Three new exported Zod schemas (`projectAddressSchema`, `flContractorLicenseSchema`, `permitNumberSchema`) with `PLACEHOLDER_VALUES` rejection list; advisory-only blue alert in `PermitPacketGenerator.tsx`, never blocks generation.
- B-1: Plumbed raw DB rows alongside lossy `ProjectContext` summary; rewired `calculate_feeder_voltage_drop` AI tool to call `computeFeederLoadVA` + `calculateFeederSizing` live.
- C6: Replaced inline phase expression with `getCircuitPhase(leftNum, panel.phase === 3 ? 3 : 1)` at both render paths; rewrote `calculatePhaseBalancing` for `panelPhase === 1` to split 2-pole loads 50/50.

**PRs**: #17 (merged 2026-05-07).

**Note for future sessions**: a SECOND copy of the same `calculatePhaseBalancing` 1Φ-bug pattern existed in `services/calculations/demandFactor.ts:calculatePanelDemand` (the in-app function); it was discovered during C4 review and fixed in commit `aa72bdb` of PR #19. When fixing a pattern bug, grep the codebase for the same idiom — Sprint 1 confirmed it usually exists in at least one more place.
