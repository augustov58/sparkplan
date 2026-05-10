# AHJ Audit — Resolved Findings Log

**Companion to:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](./AHJ_COMPLIANCE_AUDIT_2026-05-04.md)
**Purpose:** Full resolution narratives for findings already shipped. Kept separate so the main audit doc stays lean for "what's next" sessions. Load this file on-demand when investigating similar bug patterns or referencing prior architectural decisions.

**Coverage:** Sprint 1 (C1–C6, B-1) + Sprint 2A PRs 1, #23, #31 (C7, C8, M8, H1–H4, H10–H15, H9 partial, M4 promoted from Sprint 4).

---

## Original Packet — page-by-page (audit fixture, pre-fix)

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

## Sprint 1 — Calculation correctness (✅ COMPLETE 2026-05-07)

### C1 — PDF generator was bypassing NEC 220.84 multifamily branch (2026-05-04, PR #15)

- **Symptom (pre-fix):** Page 4 "Demand Factor Breakdown" showed: `Other | 498.40 kVA | 100% | 498.40 kVA | NEC 220.14 (Other Loads @100%)`. Result: 2,077 A demand on a 1,000 A service.
- **Reclassified after code verification:** Not a calculation engine bug. The NEC 220.84 logic in `services/calculations/upstreamLoadAggregation.ts` (lines 638–694) was already correct. The bug was at the PDF call site in `services/pdfExport/PermitPacketDocuments.tsx:980`, which called `calculateAggregatedLoad(...)` **without** the optional sixth-argument `multiFamilyContext`. Without it the function fell through to the standard NEC 220 cascade, and because every unit-panel circuit is tagged `'O'` they all hit the NEC 220.14 catch-all at 100%. The in-app MDP "Aggregated Load (NEC 220.40)" tile was always showing the correct 242.1 kVA / 1,008 A because `components/PanelSchedule.tsx:290` was the only call site passing the context.
- **Verification of NEC 220.84 table:** All 23 rows of `MULTI_FAMILY_DEMAND_TABLE` in `services/calculations/multiFamilyEV.ts:33-57` confirmed against NEC 2023 Table 220.84(B) — exact match.
- **Fix shape:** Extracted gate logic into `buildMultiFamilyContext(panel, panels, circuits, transformers, settings)` in `services/calculations/upstreamLoadAggregation.ts`. Single source of truth for the 4-condition gate (MDP, dwelling occupancy, multi_family type, ≥3 units). Both in-app panel view and permit-packet PDF now call the same helper, eliminating drift.
- **Files modified:** `services/calculations/upstreamLoadAggregation.ts`, `components/PanelSchedule.tsx`, `services/pdfExport/PermitPacketDocuments.tsx`, `services/pdfExport/permitPacketGenerator.tsx`, `components/PermitPacketGenerator.tsx`, `tests/calculations-extended.test.ts` (+9 tests).
- **Test results:** 132/132 vitest pass. `npm run build` exits 0.
- **NEC references:** 220.84 (multi-family Optional, ≥3 units), 220.40 (feeder load).

### C2 — EV Sub-Panel feeder shown as 14 AWG Cu (2026-05-05, branch `fix/c2-evse-feeder-aggregation`)

- **Symptom (pre-fix):** Page 8 voltage-drop table: `MDP → EV Sub-Panel | 75 ft | 14 AWG Cu | 0.0 A | 0.00% | Compliant`.
- **Reclassified after code verification:** One root cause with cascading symptoms. The `feeders` table stores `total_load_va` as a cached value set at feeder-creation time. Auto-population workflows (Multi-Family EV calculator, templates) create feeders before destination panel circuits exist, persisting `total_load_va = 0`. The PDF generator at `services/pdfExport/VoltageDropDocuments.tsx:283-285` was reading the cached value verbatim, so `calculateFeederSizing` received `total_load_va = 0` and returned the smallest entry in the ampacity table (14 AWG, NEC 310.16) with vacuous-truth voltage drop (0 A × R × L = 0 V → "Compliant"). NEC 240.4(D) enforcement was already correct — 14 AWG was the right answer for the wrong input.
- **Fix shape:** Live-derive on read. New `computeFeederLoadVA(feeder, panels, circuits, transformers)` helper in `services/feeder/feederLoadSync.ts` calls `calculateAggregatedLoad` against the destination panel and returns `totalDemandVA` (post-NEC 220 cascade per NEC 215.2(A)(1)). PDF generators and gating helpers now consult the helper instead of reading `feeder.total_load_va`. Cached column preserved unchanged for the future PE seal workflow (C5).
- **Why not run a sync-on-PDF-gen and persist?** Write-on-read invites race conditions when two PDF previews run in parallel; live-derive is idempotent and side-effect-free.
- **Why not drop the column entirely?** PE seal workflow needs a snapshot field; throwing it away closes off that design space.
- **Files modified:** `services/feeder/feederLoadSync.ts`, `services/pdfExport/VoltageDropDocuments.tsx`, `services/pdfExport/voltageDropPDF.tsx`, `services/pdfExport/permitPacketGenerator.tsx`, `components/FeederManager.tsx`, `tests/calculations-extended.test.ts` (+6 tests).
- **Test results:** 138/138 vitest pass. `npm run build` exits 0.
- **NEC references:** 240.4(D) small-conductor protection; 215.2(A)(1) feeder ampacity sizing; 220.40 feeder load.

### B-1 — chatTools.ts AI assistant gave wrong feeder answers from cached column (2026-05-05)

- **Symptom (pre-fix):** `services/ai/chatTools.ts:293` read `feeder.voltageDropPercent` (cached) when AI answered "is feeder X compliant?" questions. Same staleness pattern as C2 — AI confidently said "Compliant. 0.00%" on the same EVSE feeder the PDF was misreporting.
- **Reclassified after code verification:** Not an AI logic bug — AI was correctly summarizing the data it was given; the data source was wrong. The `ProjectContext` summary is intentionally lossy for AI prompt efficiency: `FeederSummary` exposes `voltageDropPercent` (cached) but not `total_load_va`, `distance_ft`, `conductor_material`, etc. needed to recompute live.
- **Fix shape:** Plumb raw DB rows alongside the lossy summary so the chat tool can call the C2 live-derive path. `ToolContext` gained optional `rawPanels`, `rawCircuits`, `rawFeeders`, `rawTransformers` arrays. `askNecAssistantWithTools` accepts an optional `AgenticRawData` arg that threads into ToolContext. The `calculate_feeder_voltage_drop` tool now calls `computeFeederLoadVA + calculateFeederSizing` live and returns `{ voltageDropPercent, compliant, conductorSize, designCurrentAmps, liveLoadVA, calculationSource: 'live' }`.
- **Files modified:** `services/ai/chatTools.ts`, `services/geminiService.ts`, `App.tsx`.

### C3 — Project metadata is test placeholder text (2026-05-06, advisory-only)

- **Symptom (pre-fix):** Page 1 cover shows `Project Address: TBD`, `Permit Number: test`, `Contractor License: test`.
- **Reclassified after code verification:** No missing-column or rendering bug — validation layer simply had no shape rules. `lib/validation-schemas.ts:projectSchema.address` only required `.min(1)`. There was no schema for the permit-number field at all.
- **User-direction shift on 2026-05-06:** First implementation hard-blocked PDF generation when fields were placeholder-shaped. User pushed back: contractors legitimately need to print draft packets with "TBD" for pre-application AHJ walk-ins. Reworked into advisory-only.
- **Fix shape (final):** Three exported Zod schemas describe AHJ-acceptable values (`projectAddressSchema`, `flContractorLicenseSchema`, `permitNumberSchema`). Schemas are **advisory only** — `projectSchema.address` is back to permissive `.min(1).max(200)`. `PermitPacketGenerator.tsx` runs `safeParse` against all three and shows a **blue informational alert** on failure with the explicit caveat *"Packet will still generate — these are informational only."*
- **Test results:** 160/160 vitest pass.
- **Memory:** This is the source of the [validation-advisory-not-blocking](../../.claude/projects/-home-augusto-projects-sparkplan/memory/feedback_validation_advisory.md) memory.

### C4 — NEC 625.42 EVEMS sizing math doesn't reconcile (2026-05-07, PR #19, 7 commits)

- **Symptom (pre-fix):** Page 14 EV sub-panel schedule showed 12 chargers at `3,996 VA` each. `3,996 × 12 = 47,952` ≈ what the EVEMS aggregate setpoint should be — i.e. the EVEMS feeder-level reduction was being collapsed onto branch circuits, where it doesn't belong per NEC 625.40 + 210.19.
- **Reclassified after code verification:** Same consumer-side wiring class as C1, C2, B-1. The NEC 220.57 per-EVSE engine in `services/calculations/multiFamilyEV.ts:526-532` was already correct. The bug was at autogeneration time: `data/ev-panel-templates.ts:531-535` had a `useEVEMS && evemsLoadVAPerCharger` override that wrote the EVEMS-managed *per-charger share* into each branch circuit's `loadVA`, instead of full nameplate.
- **Why simply removing the override would have regressed C1:** `buildMultiFamilyContext` collected the EV panel's `totalConnectedVA` and used it as `evLoadVA` in the MDP-level NEC 220.84 calc. With branches at the (broken) EVEMS-shared value, `evLoadVA` accidentally came close to the EVEMS setpoint, so MDP service demand happened to come out approximately right by canceling errors. After raising branches to nameplate, `evLoadVA` would become ~138 kVA instead of ~48 kVA — over-recommending the service by ~15%. So C4 also needed an explicit feeder/service-level EVEMS reduction path.
- **Fix shape (three-pronged):**
  1. **Branch row VA = nameplate, always.** `data/ev-panel-templates.ts:531-535` rewritten to `circuitLoadVA = max(7_200, loadVA)` per NEC 220.57(A).
  2. **Explicit EVEMS setpoint marker circuit (NEC 625.42).** When `useEVEMS` is on, autogen emits a metadata-only "EVEMS Aggregate Setpoint (NEC 625.42)" circuit whose `loadVA` carries the calculator's exact setpoint. Load aggregator excludes this circuit from connected-load sums. Legacy projects (only "EVEMS Load Management System" 500 VA placeholder) detected via panel-breaker upper-bound proxy as backward-compat fallback.
  3. **NEC 625.42 EVEMS clamp at feeder/service level.** `calculateAggregatedLoad` clamps `totalDemandVA` to setpoint when `totalDemandVA > setpointVA`. `MultiFamilyContext` gained `evDemandVA?` field so MDP-level calc subtracts raw connected EV (`evLoadVA`) from the dwelling base while adding back EVEMS-clamped demand (`evDemandVA`) at 100% per NEC 625.42 — basis-consistent on both sides.
- **Bonus fixes during C4 review (each became its own commit):**
  - **M4 promoted forward** — MDP feeder synthesis on PDF (was empty "No circuits defined").
  - **F5** — EV meter orphan cleanup in `addEVInfrastructure` orchestrator (catches stale `meter_type='ev'` rows when their `panel_id` link was nulled by external deletion).
  - **In-app twin of C6** — `calculatePanelDemand` was rotating B→C for 2-pole loads on 1Φ split-phase panels (orphan Phase C bucket, 99.6% imbalance display).
  - **Unit panel sizing** moved from misnamed Standard Method (`calculateSingleFamilyLoad`) to true NEC 220.82 Optional Method inline (200A → 125A on audit fixture).
  - **Unit panel summary demand display** uses NEC 220.82 (was showing 150A on 125A panel — raw connected misread as demand). EV Sub-Panel summary similarly switches to NEC 625.42-clamped demand whenever clamp engaged.
- **Files modified:** `data/ev-panel-templates.ts`, `services/autogeneration/multiFamilyProjectGenerator.ts`, `services/calculations/upstreamLoadAggregation.ts`, `components/PanelSchedule.tsx`, `tests/calculations-extended.test.ts` (+18 tests).
- **Test results:** 181/181 vitest pass. `npm run build` exits 0.
- **NEC references:** 220.57(A), 625.40, 625.42, 220.18, 210.19, 215.2(A)(1).

### C6 — Panel schedule PDF lumped every circuit to Phase A (2026-05-06)

- **Symptom (pre-fix):** Pages 13–27 of audit packet showed "Phase A" in the per-circuit phase column for all 240 V single-phase (split-phase 1Φ-3W) panels, and bottom Load Summary & Phase Balance block reported Phase A = total connected / Phase B = 0 / Phase C = 0.
- **Reclassified after code verification:** Same consumer-side wiring class as C1/C2/C3/B-1. In-app `components/PanelSchedule.tsx` view was already correct — it called `getCircuitPhase(circuit_number, panel.phase)` (alternates A/B per slot pair for split-phase). PDF rendering layer at `services/pdfExport/PanelScheduleDocuments.tsx` had reinvented broken inline phase logic: line 323/526 used `panel.phase === 1 ? 'A' : ['A','B','C'][(row-1) % 3]` which hard-codes 'A' for any single-phase panel. `calculatePhaseBalancing` for `panelPhase === 1` similarly lumped all load to A and never split 240 V 2-pole loads across both legs.
- **Fix shape:** Replaced both inline phase expressions with `getCircuitPhase(leftNum, panel.phase === 3 ? 3 : 1)`. Rewrote `calculatePhaseBalancing(panelPhase=1)` to (a) place 1-pole loads on whichever leg `getCircuitPhase` says, and (b) split 2-pole 240 V loads 50/50 across both legs.
- **Files modified:** `services/pdfExport/PanelScheduleDocuments.tsx`, `tests/calculations-extended.test.ts` (+4 tests).

---

## Sprint 1 — Retrospective Insights

**All ten Sprint 1 fixes turned out to be consumer-side wiring / display / autogen bugs, not calculation engine bugs.** Engine modules (`upstreamLoadAggregation.ts`, `feederSizing.ts`, `conductorSizing.ts`, `demandFactor.ts:getCircuitPhase`, `multiFamilyEV.ts:calculatePerEVSELoad`) were all already correct; consumers were:
- feeding stale data (C1, C2, B-1)
- letting placeholder data flow through unchecked (C3)
- bypassing the helper and reinventing broken inline logic (C6 PDF + in-app `calculatePanelDemand` twin)
- overriding engine output at autogeneration time before reaching the database (C4)

### Diagnostic shortcut (saved ~10 days across Sprint 1)

- **In-app view correct but PDF disagrees** → look at the PDF call site or autogeneration, not the engine.
- **Displayed values look impossible** (demand > breaker, imbalance > 100%, "circuit" with breaker too small for the load) → look for category-error display bugs.
- **Calc right at one layer but wrong at another** → look for bypass / inline reimplementation of a shared helper.

### Three meta-lessons

1. **Removing a wrong-but-load-bearing line can regress a previous fix.** The 3,996 VA branch override (C4) was wrong, but it was also the channel through which EVEMS reduction reached the MDP service-sizing calc. Fixing C4 cleanly required a parallel new path. **Scan future fixes for "what previous behavior is this masking?" before deleting.**
2. **Same bug pattern can exist in multiple call sites.** C6 fixed phase-column rotation in PDF panel-schedule. C4 user review surfaced an *identical* bug in the in-app `calculatePanelDemand`. **When you fix a pattern bug, grep the codebase for the same idiom.**
3. **Function header comments lie.** `calculateSingleFamilyLoad` is documented as "NEC 220.82" but its implementation is the Standard Method (NEC 220.40 + individual demand factors). Inline NEC 220.82 was used in autogen instead. Tracked as F6.

### Architectural patterns established (worth reusing)

- **Live-derive on read, cache for snapshot** (C2): preserve cached column for future PE seal snapshot, flow live values through calc layer at render time.
- **Helpers exported from calc layer for UI/PDF detection** (C4): `isEVEMSMarkerCircuit`, `findEVEMSSetpointMarker`, `isDwellingUnitPanel`, `calculateDwellingUnitDemandVA`. Sprint 2 patterns will likely follow this same shape (e.g., `isPanelArtifactPresent(packet, requirement)`).
- **MultiFamilyContext-style basis tracking** (C4): when a calc has connected vs demand on different bases, expose both as fields on the context interface so consumers can subtract one and add back the other consistently.
- **Synthesize virtual rows at PDF generation time** (M4): for cross-table relationships (feeders ↔ panels, panels ↔ AHJ requirements), synthesize at the consumer instead of forcing the DB to model the relationship.

---

## Sprint 2A — Form-factor and content additions

### PR 1 (squash `92126eb`, merged 2026-05-08) — C7, H4, C8, M8, H12, H13

#### C7 — Hardcoded NEC 2023 reference; FL AHJs require NEC 2020

- **Symptom:** Page 1 cover subtitle reads "NEC 2023 Compliant Design Package." Florida adopted NEC 2020 via FBC 8th edition (2023). NEC 2023 not anticipated until FBC 9th edition (~2027).
- **Why CRITICAL despite being a one-line subtitle fix:** Every drawing this packet generator emits asserts compliance with the wrong code edition. A reviewer flagging the wrong-edition stamp on intake doesn't read the rest of the packet.
- **Fix shape:** Added `nec_edition` to project settings (default `'2020'` for FL pilot; allow `'2023'` for early adopters). Replaced hardcoded subtitle with dynamic value driven from AHJ manifest's `necEdition` field. NEC 220.84 multi-family demand factor table values verified valid for both 2020 and 2023.

#### H4 — No FBC + NFPA-70 references on cover

- **Fix shape:** New "APPLICABLE CODES" section on cover page driven from `codeReferences` array; default = `['NFPA-70 (NEC) 2020', 'Florida Building Code 8th Edition (2023)']`.

#### C8 — Per-sheet contractor signature block missing

- **Symptom:** Contractor name / license / address appears only on cover page. Orlando's official checklist (item #1) explicitly requires this on **all** submitted electrical drawings, sketches, and panel schedules.
- **Why distinct from PE seal:** Contractor's EC license (FL DBPR Certified or Registered Electrical Contractor) authorizes their signature on drawings — contractor's professional attestation. PE seal (Sprint 3 / C5) is the engineering attestation, applied to engineered-plans-required projects only (≥277V or commercial per FBPE thresholds). Two signatures coexist on PE-required packets; only contractor signature required for sub-FBPE-threshold residential / multi-family EV retrofits.
- **Fix shape:** New `<ContractorBlock>` `react-pdf` component rendered as a footer/strip on every electrical sheet. Carries: contractor company name, license number (FL DBPR EC#######), mailing address, phone, sign-and-date line for license holder. Wet signature initially.
- **42-circuit overflow regression** fixed in PR #23 commit `8769736`.

#### M8 — Meter stack page 11 inconsistent visual style

- **Fix shape:** `MeterStackSchedulePDF.tsx` now wraps each Page with shared `themeStyles.page` + `BrandBar` + `BrandFooter` (which carries the C8 contractor block automatically). Local styles kept for table/specs detail rendering only. **Fixed first** in PR 1 to ensure C8 covers all pages uniformly.

#### H12 — No General Notes page with NEC compliance note

- **Fix shape:** `GeneralNotesPage` in `PermitPacketDocuments.tsx`; default 8-item FL pilot stack; configurable via `generalNotes` array. Sprint 2C will populate from AHJ manifest. Renders at sheet `E-004`.

#### H13 — No voltage drop general note (3% feeder / 3% branch / 5% combined)

- **Fix shape:** Note 2 in default General Notes stack: *"Voltage drop shall not exceed 3% on branch circuits and 3% on feeders, with combined drop not exceeding 5% per NEC 210.19(A) IN 4 and 215.2(A)(1) IN 2."*

### PR #23 (squash `6859328`, merged 2026-05-09) — H1, H2, H3 (form-factor identity)

#### H1 — No table of contents / cover-sheet index

- **Fix shape:** `TableOfContentsPage` in `PermitPacketDocuments.tsx`; auto-populated from rendered sections at sheet `E-002`.

#### H2 — No revision log page

- **Fix shape:** `RevisionLogPage` in `PermitPacketDocuments.tsx`; auto-populates default Rev 0 row at sheet `E-003`.

#### H3 — No sheet-ID convention (`E-001`, `E-002`, …)

- **Fix shape:** `services/pdfExport/packetSections.ts` foundation: 7 numeric category bands + `E-` discipline prefix; allocated per builder by `nextSheetId(counters, band)`. Yellow pill in BrandBar + cream badge in BrandFooter.
- **Bonus:** projects.settings persistence + section toggle UI + 42-circuit panel overflow regression fix (commit `8769736`).
- **Sprint 2A Strategy C validated:** themed PRs over per-finding PRs. PR #23 bundled three identity-related findings (TOC + revision log + sheet IDs) with shared infrastructure (sheet ID counter foundation), avoiding 3× the review overhead.

### PR #31 (squash `dacaab2`, merged 2026-05-10) — H14, H9 page, H15, H10, H11 (engineering content)

#### H14 — No NEC 220.87 conditions narrative

- **Required by:** Orlando existing-service path explicitly cites the 3 conditions: *"(1) maximum demand data is available for a 1-year period (2) maximum demand at 125 percent plus the new load does not exceed the ampacity (3) feeder has overcurrent protection in accordance with 240.4, and the service has overload protection in accordance with 230.90."*
- **Fix shape:** `NEC22087NarrativePage` (band 100). Opt-in via UI form capturing existing-load method (utility bill / load study / calculated / manual), source citation, observation window dates, max demand kVA, proposed new load kVA. Page renders structured 3-condition checklist with green/amber verdict callout. **Measured methods skip 125% multiplier per NEC 220.87**; calculated/manual apply 125%. Auto-disabled until citation + max demand are filled.
- **Critical NEC compliance:** This is the rule documented in CLAUDE.md as `services/calculations/serviceUpgrade.ts` — measured (utility bill, load study) value used directly; calculated (panel schedule, manual) gets 125% multiplier.

#### H9 (page only — partial) — No available-fault-current calc page

- **Required by:** All FL AHJs (hurricane-state fault current); Orlando item #5 (new-service) explicitly requires *"arc fault current calculation, showing the available fault current at the service main breaker(s)."*
- **Fix shape:** Available Fault Current Calculation page (band 100, IEEE 141 derivation + NEC 110.9/110.10 verdict, sourced from `data.shortCircuitCalculations` service-level entry).
- **Deferred to PR 4:** AIC overlay on `OneLineDiagram.tsx` — pairs with M6 riser layout work since both edit the same SVG render paths (interactive ~2340 + print/export ~3290).

#### H10 — No EVEMS operational narrative

- **Required by:** All AHJs reviewing NEC 625.42 designs.
- **Fix shape:** `EVEMSNarrativePage` (band 600). One detail block per EVEMS-managed panel: device + UL 916, NEC 625.42 setpoint (sourced from `findEVEMSSetpointMarker` marker circuit when present, panel-breaker proxy fallback for legacy projects with source flag), monitoring points, failure mode, NEC 750 tamper protection. Auto-disabled when no EVEMS-managed panel detected.
- **Content requirements (all present):** device manufacturer/model with UL 916 listing; max aggregate setpoint (in amps) and how it was derived; service main / sub-feed monitoring points; failure mode (default to lowest setpoint on signal loss); tamper protection per NEC 750; setpoint values per NEC 625.42.

#### H11 — No EVSE labeling page (NEC 625.43)

- **Fix shape:** `EVSELabelingPage` (band 600). Per-panel disconnect label text + 6-item required-content checklist + breaker locking + commercial-only emergency-shutoff section + contractor attestation. Detection mirrors H15 pattern (EVEMS marker OR name pattern `/ev|evse|charger|charging|level\s*2|l2/i`).

#### H15 — EVSE specs page doesn't call out UL-2202 + UL-2594 by standard number

- **Required by:** Orlando item #7 (both paths): *"electrical specifications of EV chargers to include UL-2202 and UL-2594 listing and label information."*
- **Fix shape:** New "EV CHARGING SUPPLY EQUIPMENT — APPLICABLE LISTING STANDARDS" card on existing Equipment Specs page lists both standards by number per detected EV-bank panel. Detection: EVEMS marker circuit OR panel name pattern. H8 cut-sheet upload remains a Sprint 2B prerequisite for manufacturer-supplied evidence.

### Sprint 2A architectural patterns (validated across PRs 1, #23, #31)

- **Strategy C — themed PRs:** Bundle related findings (e.g., identity = TOC + revision log + sheet IDs; engineering content = 220.87 narrative + AIC page + UL listings + EVEMS narrative + EVSE labeling) into a single PR with shared infrastructure. Reduces review overhead vs per-finding PRs.
- **Sheet ID category bands** (PR #23): 7 numeric bands × `E-` discipline prefix → allocated by `nextSheetId(counters, band)`. Future Sprint 2B uploads fit cleanly into existing bands without renumbering.
- **`wrap={false}` for cohesive cards** (PR #23): prevents `react-pdf` from splitting visual cards across page boundaries.
- **Generator builder pattern** (PR #31): each finding gets a dedicated `<XxxPage>` component that auto-disables when its data prerequisites aren't met. Keeps the `permitPacketGenerator.tsx` orchestration linear and the per-page logic isolated.
- **PR base bug workaround** (PR #23): when GitHub PR creation rejects a base branch, push to a new branch off the rejected base and create the PR from there.

---

## Cross-cutting NEC reminders surfaced across Sprints 1 + 2A

- **NEC 220.57(A):** Per-EVSE branch-circuit load = `max(7,200 VA, nameplate)`. Not a demand factor. Branch carries this regardless of EVEMS.
- **NEC 625.40 / 625.42 (EVEMS):** Branch conductors at full continuous nameplate × 1.25 (NEC 625.40); FEEDER/SERVICE may be sized to managed setpoint per NEC 625.42.
- **NEC 220.82 (single-family Optional):** First 10 kVA general @ 100%, rest @ 40%; + larger of A/C vs heat @ 100% (NEC 220.60 non-coincident). Different from Standard Method.
- **NEC 220.84 (multi-family Optional, ≥3 units):** Apply table demand factor to dwelling base; non-dwelling (EV, common areas) excluded, added back at 100%.
- **NEC 215.2(A)(1):** Feeder ampacity ≥ 1.25 × continuous demand. Used to size EV panel main breaker from EVEMS setpoint.
- **NEC 408 (panelboards):** Panel schedule must show every protective device including feeder breakers — drove M4 (MDP feeder synthesis).
- **NEC 220.87 (existing-load):** Measured (utility bill, load study) value used directly. Calculated (panel schedule, manual) gets 125% multiplier. Documented in CLAUDE.md as a critical safety-rule.

---

**Last Updated:** 2026-05-10 — created from sections extracted from `AHJ_COMPLIANCE_AUDIT_2026-05-04.md` to keep main audit doc lean.
