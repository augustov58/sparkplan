# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-09

---

### Session: 2026-05-08 / 2026-05-09 — AHJ Compliance Audit Sprint 2A (commits 1–4 across two PRs)

**Focus**: Long multi-day session executing the Sprint 2A plan from the audit doc. Closes systemic intake-rejection vectors that affect every Florida AHJ — not engine bugs, just packet form-factor and content gaps. Work split into themed PRs (Strategy C — see "Decisions" below).

**Status**:
- ✅ **PR 1** merged to `main` as `92126eb` — Sprint 2A commits 1, 2, 3 (C7+H4, C8+M8, H12+H13)
- 🟡 **PR #23** open against `main` — Sprint 2A commit 4a + 4b + bug-fix follow-up (H1+H2+H3 sections + sheet IDs + TOC + revision log + UI toggle panel + DB persistence + sheet ID `E-` prefix + visibility pill + 42-circuit panel overflow fix)
- ⏳ **Pending** — Sprint 2A commits 5–12 (H14, H9+H15, H10, H11, M3, M6, H17, schema additions). Audit doc plans 3 more themed PRs (PR 3 content, PR 4 diagrams, PR 5 engine + schema).

198/198 tests pass on PR #23 branch. `npm run build` exits 0. PR #23 mergeable status: CLEAN against `main`.

---

#### PR 1 — `92126eb` (merged) — Per-sheet polish + content gaps

Three sub-commits:

1. **C7 + H4** (`e17d5a4`) — NEC edition selector. Replaced hardcoded "NEC 2023" with packet-level `necEdition` prop (default '2020' for FL pilot AHJs — FBC 8th ed adopts NFPA-70 2020). Added APPLICABLE CODES section to cover sheet driven by optional `codeReferences` array. NEC 220.84 demand-factor table values verified valid for both 2020 and 2023 (already declared in `services/calculations/multiFamilyEV.ts:25`).

2. **C8 + M8** (`026470c`) — Per-sheet `<ContractorBlock>` signature footer. Required by every Florida AHJ on every electrical sheet — without it, intake reviewers reject before reaching technical review. Implementation: shared `BrandFooter` (in `permitPacketTheme.tsx`) now renders a fixed signature/date row above the brand footer when `contractorName`/`contractorLicense` props are provided. The signature line renders even when contractor metadata is missing so the AHJ has a place to wet-sign. M8 fix bundled here: `MeterStackSchedulePDF.tsx` previously used a private style sheet — now wraps each Page with shared `themeStyles.page` + `BrandBar` + `BrandFooter` (which carries the C8 contractor block automatically).

3. **H12 + H13** (`500031e`) — Dedicated General Notes page (sheet 2 of the packet). Driven from optional `generalNotes` string array on `PermitPacketData`. Default 8-item FL pilot stack covers NEC 2020 + FBC 8th ed compliance, voltage-drop convention 3% branch / 3% feeder / 5% combined, conductor sizing references, grounding & bonding refs, NRTL listing requirement, EVSE/EVEMS refs, working-space requirement, and available-fault-current verification. Sprint 2C will replace the stub with per-AHJ manifest content.

---

#### PR #23 — `feat/sprint-2a-part-2-sections` (open, 3 commits) — Sections + sheet IDs + TOC + revision log

**Commit 4a** (`ed4fdb8`) — Backend restructure. The largest single commit of Sprint 2A so far.

Replaced the imperative `pages.push({ name, element })` chain with a declarative `builders: PageBuilder[]` list. Each builder declares `kind`, `band`, `pageCount`, `tocTitles`, and a `render(sheetIds, tocEntries)` function. The build pipeline:

1. Push every potential page-builder, gated by both data presence (existing) and `sections` config (new). Cover is hard-required (no gate). ComplianceSummary + PanelSchedules are toggleable but the UI warns when off.
2. Walk builders allocating sheet IDs via per-band counters.
3. Walk again collecting TOC entries (cover + TOC itself excluded).
4. Render each builder with its allocated sheet IDs and the populated `tocEntries` array.

New `services/pdfExport/packetSections.ts` foundation: `PacketSections` type + `DEFAULT_SECTIONS` (all-on default), `resolveSections` helper, 7 `SheetBand` constants (000-099 / 100-199 / 200-299 / 300-399 / 400-499 / 500-599 / 600-699), `newBandCounters` + `nextSheetId` per-band sequential allocator. Toggling a section off compresses numbering within its band — no gaps.

New PDF components: `TableOfContentsPage` (auto-populated from rendered sections, lists sheet ID + title), `RevisionLogPage` (auto-populates default "Rev 0 / [today] / Initial submittal / [contractor]" row when `revisions` is omitted; subsequent revisions append).

Theme additions: `BrandBar` and `BrandFooter` accept optional `sheetId` — render "Sheet [id] · Page X of Y" instead of bare "Page X of Y".

Multi-page component split (Option A): `MultiFamilyEVPages` accepts `sheetIds: [string, string, string]`; `MeterStackScheduleDocument` accepts `sheetIds: string[]` aligned to `meterStacks`. Generator declares `pageCount: 3` for MFEV and `pageCount: stacks.length` for meter stack so each physical page in the merged PDF gets its own unique sheet ID.

Sheet ID prop threaded through all 9 page components: CoverPage, GeneralNotesPage, EquipmentSchedule, RiserDiagram, LoadCalculationSummary, ComplianceSummary, EquipmentSpecsPages, VoltageDropPages, JurisdictionRequirementsPages, ShortCircuitCalculationPages, ArcFlashPages, GroundingPlanPages, PanelSchedulePages.

**Commit 4b** (`df919e0`) — Frontend toggle panel + projects.settings persistence.

Added Configure Sections panel between Project Summary and Jurisdiction Requirements cards in `components/PermitPacketGenerator.tsx`. 16 toggleable sections grouped into 6 categories. Cover is shown as a non-toggleable indicator. "Reset to defaults" link clears the override. Each toggle shows section purpose + band info.

Auto-disable predicates grey out toggles with tooltips when underlying data is missing (Voltage Drop / no feeders, Short Circuit / no calcs, Arc Flash / not yet wired, Grounding / no grounding system, Meter Stack / no stacks, Multi-Family EV / requires the input checkbox above, Jurisdiction / no jurisdiction selected).

Off-warning amber banners surface above the grid when sections most AHJs require are toggled off (Compliance Summary, Panel Schedules).

Persistence: each toggle change calls `updateProject({...currentProject, settings: {...settings, sectionPreferences: updated}})`. ProjectSettings extended with `sectionPreferences?: Record<string, boolean>` (typed as `Record<string, boolean>` instead of `Partial<PacketSections>` to avoid a circular import from PDF service into `types.ts`; packet generator narrows at the boundary). Stored in existing `projects.settings` JSONB column — no migration.

**Commit `8769736`** — Bug-fix follow-up (3 issues found during user visual review):

1. Sheet IDs now prefix with `E-` (was bare numeric like "305"; now "E-305" — standard plan-set discipline prefix).
2. Sheet IDs render as a high-visibility yellow pill in BrandBar and a bordered cream badge in BrandFooter (was inline text, blending into dark bar).
3. 42-circuit panel schedules were overflowing onto a second page (with the same sheet ID, breaking the uniqueness invariant). Three-layer fix: `themeStyles.page.paddingBottom` reduced 78pt → 64pt (over-provisioned in commit 2); panel summary card layout tightened (padding/margins/font sizes); `wrap={false}` on both summary cards so react-pdf moves the entire card to the next page rather than splitting it mid-content.

**Decisions made**:

- **Strategy C — themed PRs.** Splitting Sprint 2A's 12 commits into 4 themed PRs instead of 12 individual ones. PR 1 = "per-sheet polish + content gaps" (commits 1-3); PR #23 = "document structure + user control" (commits 4a + 4b + bugfix); PR 3 (next) = "engineering content additions" (commits 5-8 — H14, H9+H15, H10, H11); PR 4 = "diagrams" (commits 9-10 — M3, M6); PR 5 = "engine + schema" (commits 11-12 — H17, settings JSON additions). Saved this preference because it's now the project's de facto Sprint 2A workflow.
- **Hard-required pages**: Cover only. ComplianceSummary + PanelSchedules toggleable but with off-warning banners ("Most AHJs reject without this").
- **Sheet ID scheme**: numeric category bands with `E-` discipline prefix. Front matter 001-099, calculations 100-199, diagrams 200-299, panels 300-399, multi-family 400-499, compliance 500-599, specialty 600-699 (reserved for EVEMS narrative + EVSE labeling in commits 7-8).
- **Default revision-log row**: Auto-populated `Rev 0 / [today's date] / Initial submittal / [Contractor name]` for first submittals. Avoids shipping with a blank page.
- **Sections persistence in `projects.settings`** (not localStorage). Round-trips through existing JSONB column, no DB migration. Per-project preferences survive page reloads.
- **Sections config locking is Sprint 3 territory.** Sheet ID stability across revisions matters for AHJ comment letters citing specific sheet IDs. Documented as a Sprint 3 concern (PE seal workflow will lock the sections snapshot at submittal time).
- **`wrap={false}` on cohesive PDF cards**. Once react-pdf's auto-pagination kicks in, fixed elements (BrandBar, BrandFooter) re-render on each overflow page with the same sheet ID — breaks uniqueness. Defensive pattern: any logical card the reader expects together gets `wrap={false}` so react-pdf relocates the whole card on overflow rather than splitting it.

**Key files touched**:
- New: `services/pdfExport/packetSections.ts` (sections config + sheet ID utilities)
- Generator restructure: `services/pdfExport/permitPacketGenerator.tsx` (~512 lines new, ~172 deleted)
- Cross-cutting: 9 PDF page modules touched for sheetId prop threading + contractor footer prop threading
- Theme: `services/pdfExport/permitPacketTheme.tsx` (BrandBar pill, BrandFooter badge, contractorBlock, paddingBottom tightening)
- UI: `components/PermitPacketGenerator.tsx` (toggle panel + persistence; +330 LOC)
- Types: `types.ts` (`ProjectSettings.sectionPreferences?`)
- Tests: `tests/contractorBlockPdf.test.ts`, `tests/generalNotesPdf.test.ts`, `tests/packetSections.test.ts`, `tests/tocRevisionLogPdf.test.ts` (+ updates to `tests/coverPagePdf.test.ts`)

**Pending / Follow-ups**:

- **PR #23 user merge.** Awaiting browser verification of the toggle panel + sheet ID rendering + 42-circuit overflow fix.
- **Sprint 2A continuation** — commits 5-12 across 3 more themed PRs:
  - **PR 3** (next): commit 5 H14 (NEC 220.87 conditions narrative), commit 6 H9+H15 (AIC labels on one-line + UL-2202/UL-2594 fields on EVSE specs + new "Available Fault Current Calculation" page when service-modification-type === 'new-service'), commit 7 H10 (EVEMS operational narrative), commit 8 H11 (EVSE labeling page per NEC 625.43)
  - **PR 4**: commit 9 M3 (project-specific grounding detail with GEC sizing per NEC 250.66 / 250.122), commit 10 M6 (riser diagram landscape mode for ≥10 panels OR pagination)
  - **PR 5**: commit 11 H17 (FS 471.003(2)(h) contractor-exemption screening engine — pure function in `services/permitMode/exemptionScreening.ts` returning `{ lane, reason, ahjOverride? }`), commit 12 schema additions to `projects.settings` (service_modification_type enum, scope_flags JSON, estimated_value_usd)
- **PR base bug** — Claude Code's UI created PR #23 with base set to `fix/c2-evse-feeder-aggregation` (a Sprint 1 branch) instead of `main`. Manually retargeted via `gh api PATCH /repos/.../pulls/23 -f base=main`. If this recurs, check repo default-branch settings.

**PRs**:
- **PR 1** — Sprint 2A commits 1-3 (merged to main as squash commit `92126eb`)
- **PR #23** — Sprint 2A commit 4a + 4b + bugfix (open, base now correctly `main`, mergeable CLEAN)

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
