# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-09

---

### Session: 2026-05-09 — Project Management Inspector accuracy + slot visibility (PR open)

**Focus**: Quick-turn fixes to the project-management surface (panel schedule + AI Inspector) flagged by the platform owner during PE review of the Inspector. Three discovered issues bundled into one PR; not part of the AHJ Sprint 2A track.

**Status**: ✅ Branch `fix/inspector-panel-cap-and-branch-conductor` pushed; PR open against `main`. 208/208 tests pass. `npm run build` exits 0 in 4.8s.

**Issues fixed**:

1. **AI Inspector hard-coded panel cap at 42 poles**. `services/inspection/inspectorMode.ts:checkPanelMaxPoles` ignored each panel's `num_spaces` (settable to 12/20/24/30/42/54/66/84 at panel creation). A 24-space panel at 28 poles still passed inspection. Fix: read `panel.num_spaces` with same `panel.is_main ? 30 : 42` fallback used elsewhere; cite NEC 110.3(B) (use equipment per its listing) instead of the long-deleted NEC 408.36.

2. **AI Inspector flagged branch-circuit conductor sizing on placeholder data**. Inspector ran NEC 240.4(D) audit against `circuit.conductor_size`, but that field is a defaulted `"12 AWG"` placeholder (set in `BulkCircuitCreator.tsx:56` and `PanelSchedule.tsx:81`) — users never enter real branch-circuit conductor data because SparkPlan only sizes feeders. So every 30A+ circuit got a false "12 AWG on 30A breaker" critical issue. Fix: deleted `checkConductorProtection` + `CONDUCTOR_PROTECTION_LIMITS` from the inspector. NEC 240.4(D) is still correctly enforced in `services/calculations/conductorSizing.ts` + `breakerSizing.ts` where real feeder data drives it.

3. **AI Inspector breaker-vs-load check was receptacle-only and assumed 120V**. `checkReceptacleLoading` fired only on `load_type === 'R'` and used a hard-coded `breakerAmps × 120` capacity — so lighting / EV / dryer / 2-pole 240V / 3-phase circuits got no audit, and 240V loads would have been falsely flagged at 2× utilization if the type filter didn't skip them first. Fix: `checkCircuitLoading(circuit, panel)` runs on every circuit and derives capacity from pole count + panel voltage·phase: 1-pole on 1Φ split-phase = 120V (LtoL/2); 1-pole on 3Φ = LtoL/√3; 2-pole = LtoL; 3-pole = LtoL × √3. Critical >100%, warning >80% (NEC 210.20(A) continuous-load rule).

4. **Slot cap was invisible until the user bumped into it.** Panel header showed Main Breaker / Voltage / Bus Rating / Phase·Wire — but no slot count. Users only saw the limit in error alerts ("This 30-space panel has no room…"). Fix: added 5th "Slots" stat card in `PanelSchedule.tsx` showing `<polesUsed> / <totalSlots>` with amber/red tone at >90% / >100%.

5. **Bulk Circuit Creator skipped the slot cap.** `OneLineDiagram.tsx:handleBulkCreateCircuits` validated multi-pole conflicts but not slot-overflow — Circuit 50 in a 30-space panel was silently persisted as an orphan. Fix: pre-create cap using same multi-pole formula (`lastSlot = circuit_number + (pole - 1) * 2`) as the manual-add and import paths.

**Decisions made**:

- **NEC 110.3(B) over NEC 408.36 for the panel-cap citation.** NEC 408.36's hard 42-OCPD cap was deleted in NEC 2008 — the limit is now whatever each panel is UL-listed for, and `panels.num_spaces` IS that listed capacity. NEC 110.3(B) ("use equipment per its listing") is the modern citation.
- **Pole count, not circuit count, for the Slots indicator.** A 2-pole breaker is one circuit row but two slots. Using poles makes the in-UI indicator agree with the inspector audit (also pole-based), so the user never sees "Slots: 15/30" while the inspector says "Panel exceeds 30-slot capacity at 32 poles."
- **Removed branch-circuit conductor audit entirely rather than gating it on real data.** SparkPlan deliberately doesn't ask for branch conductor sizing — it's not in the value prop. Auditing a field we don't ask the user to fill produced noise. Safer to remove the audit; the same NEC rule still fires correctly inside the feeder/conductor sizing tools where real user data drives it.
- **Generalized circuit-loading check to all load types.** Today every circuit has `load_watts` + `breaker_amps` + `pole` regardless of `load_type`, so a uniform check is both more useful and simpler. The receptacle-only audit was a leftover from an earlier per-outlet model.

**Key Files Touched**:

- `services/inspection/inspectorMode.ts` — rule changes (see Issues 1, 2, 3 above)
- `components/PanelSchedule.tsx` — Slots stat card
- `components/OneLineDiagram.tsx` — bulk-create slot cap
- `docs/CHANGELOG.md` + `docs/SESSION_LOG.md` — this entry

**Pending / Follow-ups**:

- **`IssueCategory = 'conductor'` is now unused** by any inspector rule. Left in the type to minimize blast — `CategoryBadge` in `InspectorMode.tsx` and the IssuesLog PDF section reference the labels record. One-line cleanup if desired.
- **AHJ Sprint 2A continuation** — PR 3, 4, 5 of the AHJ Compliance Audit (commits 5-12) still pending per the prior session's plan.
- **F4 + F6 (from earlier session)** — `panels.is_evems_managed` + `panels.evems_setpoint_va` columns AND rename of `calculateSingleFamilyLoad`. No-migration items, do when DB next touched.

**PRs**: open against `main`, branch `fix/inspector-panel-cap-and-branch-conductor`.

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
