# Changelog

All notable changes to SparkPlan.

---

## 2026-05-09: Sidebar contractor pivot + 3 beta stubs (PR #29, open)

Reorganizes the project-management sidebar to fit the contractor persona (the actual buyer per CLAUDE.md) instead of the engineer persona that had crept into the labels. Validated against external market research the user pulled showing the top 3 unmet pain points for $1M-$10M small electrical shops: estimating + job costing (CRITICAL), permit + inspection lifecycle (HIGH), T&M billing (HIGH).

**User-Facing Changes:**

- **Three new sidebar entries, all (beta)**: `Estimating`, `Permits`, `T&M Billing`. Each renders a stub page with feature description, "Coming this quarter" status, and a "Tell us what you'd want from this" feedback CTA. One-line notes get inserted into a new `feature_interest` table — clicks-per-feature serve as a demand signal to prioritize which beta to build first.
- **Permits absorbs the inspection/issues lifecycle conceptually** (permit submission → AHJ review → approval → inspection → corrections → reinspect → closed). The stub's forward-link points to the existing `Inspection & Issues` page until Phase 1 (next session) merges that UI in as a `?tab=issues` tab.
- **Removed from sidebar (routes preserved server-side for direct-link compatibility)**: `Inspection & Issues`, `RFI Tracking`, `Site Visits`. Engineer-flavored, not contractor-flavored — contractors don't author inspection findings (inspectors do; contractors close them), don't log "site visits" as discrete events (they're on site every day), and route RFIs through Procore/email rather than a standalone tracker. The chatbot's `draft_rfi` tool covers the AI-drafted-RFI value prop without a dedicated page. No 404s on bookmarks: the routes still resolve.
- **`(beta)` chip rendering** added to `SidebarItem` — small amber pill rendered to the right of the label. Generic; any future sidebar entry passing `beta: true` gets the chip for free.

**Why this matters**: SparkPlan started as a calc/design tool (engineer territory). As "project management" features were added, engineer-vocabulary leaked into the contractor-facing sidebar — sidebar making a positioning claim the rest of the product wasn't honoring. The pivot validates demand cheaply (3 stub pages, ~150 LOC + 1 migration) before committing sprint time to any of the three pain-point builds. Whichever beta gets the most clicks gets prioritized.

**Technical:**

- New `components/BetaFeatureStub.tsx` — shared stub component. Takes icon, title, `featureKey`, description, optional `comingWhen`, optional `forwardLink` to an existing page being absorbed. Renders the feedback textarea (max 2000 chars, count display, disabled-while-empty submit), submits to `feature_interest` table, shows confirmation state. RLS scopes inserts to `auth.uid() = user_id`.
- New thin wrappers: `EstimatingStub.tsx`, `PermitsStub.tsx`, `TmBillingStub.tsx`. Each is ~10 lines, just supplying icon/title/description/featureKey to `BetaFeatureStub`. Lazy-loaded via `React.lazy()` per the codebase convention.
- `components/Layout.tsx` — `SidebarItemProps` extended with `beta?: boolean`. New beta chip rendering between label and chevron. `PROJECT MANAGEMENT` items array rewritten: drop 3, add 3 new with `beta: true`. Render call threads `beta={(item as any).beta}` through.
- `App.tsx` — three new project-scoped routes (`/estimating`, `/permits`, `/billing`) wrapped in `FeatureErrorBoundary` + `Suspense`. No `FeatureGate` because betas are open to all tiers during the demand-discovery phase.
- New migration `supabase/migrations/20260509_feature_interest.sql` — `feature_interest` table with `id` UUID PK, `user_id` FK to `auth.users`, `feature_name` TEXT (CHECK constrained to known beta keys), `note` TEXT (max 2000), optional `project_id`, `created_at`. Two indexes (per-user, per-feature). RLS: SELECT/INSERT scoped to row owner. No app-level admin policy — roadmap queries run via Supabase Studio under service-role.

---

## 2026-05-09: Chatbot VD+ awareness + confirmation gate fix (PRs #26 + #28, MERGED)

Two follow-ups spawned by verifying the merged PR #25 (riser SE label + cumulative VD).

**PR #26 — Chatbot VD+ awareness:**

- **AI now sees cumulative voltage drop (VD+)** for every feeder in the passive context summary, with `[SERVICE ENTRANCE]` tag, asterisk-flagged transformer-crossing chains, and parallel-set count when > 1.
- **New `calculate_cumulative_voltage_drop` tool** (panel-keyed) — answers "what's the total VD at panel L1?" with the full chain breakdown (per-segment list, voltage segment source, NEC compliance vs the 5% combined limit).
- **Augmented `calculate_feeder_voltage_drop` tool** — result now includes `cumulativeVoltageDropPercent`, `crossesTransformer`, `setsInParallel`, `isServiceEntrance`, `cumulativeNote`.
- **Three system-instruction builders updated** (basic, memory-aware, agentic) — VD+ resets at transformer secondaries, NEC 215.2(A)(1) IN No. 2 (≤3% feeder), NEC 210.19(A)(1) IN No. 4 (≤5% combined feeder + branch), `[SERVICE ENTRANCE]` feeder convention.

**PR #28 — Confirmation card UI restoration (broken since #13):**

- **Fixes regression introduced in PR #13 (2026-04-24).** That security/correctness audit added a server-side `requiresConfirmation` gate in `executeTool` but never shipped the UI half. Five write tools (`add_circuit`, `add_panel`, `fill_panel_with_test_loads`, `empty_panel`, `fill_with_spares`) have been completely unreachable for ~2 weeks — the chatbot was stuck in an infinite "I cannot directly modify..." loop even after the user typed "yes."
- **`executeTool` gains `bypassConfirmation` option.** Gate fires only when bypass is false (default). UI calls back with `bypassConfirmation: true` after user clicks Apply.
- **`askNecAssistantWithTools` short-circuits on confirmation results** — returns structured `pendingAction: { toolName, params }` to the UI without round-tripping Gemini. (The round-trip was the bug amplifier: Gemini paraphrased the gate's "not executed" message into a flat refusal, hiding that an Apply button was intended.)
- **New `applyConfirmedAction` export** runs the tool with bypass=true and synthesizes a brief result message locally, skipping Gemini entirely on the second leg for fast click→feedback.
- **`App.tsx` Apply / Cancel buttons** render inline beneath any AI message with a `pendingAction`. Apply calls `applyConfirmedAction`, appends a "Done — ..." follow-up, disables the buttons. Cancel marks resolved with an "Action cancelled." italic note. Existing `notifyDataRefresh` calls inside each write tool's `execute()` already refresh the UI post-apply.
- **Generic, not per-tool**: any future write tool with `requiresConfirmation: true` automatically gets the Apply card for free.

---

## 2026-05-09: Project Management — AI Inspector accuracy + panel slot visibility (PR #27, MERGED)

Fixes three issues in the project-management surface (panel schedule + AI Inspector) flagged by the platform owner during PE review.

**User-Facing Changes:**

- **Panel slot count is now visible in the PanelSchedule header.** The metadata strip (Main Breaker / Voltage / Bus Rating / Phase·Wire) now includes a 5th "Slots" stat showing `<used> / <capacity>` (e.g., `28 / 30`). The "used" number counts **poles**, not circuit rows — so a 2-pole breaker counts as 2, matching what the inspector audits. Tone is gray when fine, amber >90%, red >100%. The slot cap was already settable per panel at creation (12/20/24/30/42/54/66/84 spaces, persisted in `panels.num_spaces`); previously the only way the user learned the cap was by hitting an overflow alert.

- **AI Inspector caps poles using each panel's listed slot count, not a hard-coded 42.** `checkPanelMaxPoles` was hard-coded to 42 (the long-deleted NEC 408.36 rule). It now reads `panel.num_spaces` per panel (same `panel.is_main ? 30 : 42` fallback used elsewhere) and cites NEC 110.3(B) — *use equipment per its listing*. Critical when over capacity, warning at >90%.

- **AI Inspector no longer flags individual branch-circuit conductor sizing.** SparkPlan does not size individual branch-circuit conductors (only feeders), so the previous NEC 240.4(D) audit on `circuit.conductor_size` was reading defaulted "12 AWG" placeholder data and producing noise — every 30A circuit was being flagged as "12 AWG on 30A — violation." Removed `checkConductorProtection` and the `CONDUCTOR_PROTECTION_LIMITS` table from the inspector. NEC 240.4(D) is still enforced (correctly) inside the *feeder* sizing tools at `services/calculations/conductorSizing.ts` and `breakerSizing.ts` where real user data drives the check.

- **AI Inspector audits breaker-vs-load on every circuit (not just receptacles) at the correct voltage.** Replaced `checkReceptacleLoading` (which fired only on `load_type === 'R'` and assumed 120V) with `checkCircuitLoading`. Runs on every circuit; capacity is derived from line-to-neutral for 1-pole, line-to-line for 2-pole, and 3-phase (× √3) for 3-pole. Critical at >100%, warning at >80% (NEC 210.20(A) continuous-load rule). Concrete impact: a 6 kVA water heater on a 30A 2-pole breaker is now correctly rated at 30A × 240V = 7.2 kVA capacity (83% utilized — passes), not 30A × 120V = 3.6 kVA (which would have been a false critical at 167%).

- **Bulk Circuit Creator refuses circuit numbers beyond the panel's listed slot count.** `OneLineDiagram.tsx:handleBulkCreateCircuits` previously only validated multi-pole conflicts; a Circuit 50 entry into a 30-space panel was silently created as an orphan row. The cap now uses the same multi-pole formula (`lastSlot = circuit_number + (pole - 1) * 2`) as the manual-add and import paths.

**Technical:**

- `services/inspection/inspectorMode.ts`: `checkPanelMaxPoles` now reads `panel.num_spaces`. `checkConductorProtection` + `CONDUCTOR_PROTECTION_LIMITS` deleted. `checkReceptacleLoading` replaced by `checkCircuitLoading(circuit, panel)` which receives the full panel for voltage derivation. NEC articles referenced updated: 408.36 → 110.3(B); 210.21(B) → 210.20(A); 240.4(D) removed from this surface (still cited correctly in feeder calc).
- `components/PanelSchedule.tsx`: header grid widened from `md:grid-cols-4` to `md:grid-cols-5`. New "Slots" cell counts poles via `panelCircuits.reduce((sum, c) => sum + (c.pole || 1), 0)`.
- `components/OneLineDiagram.tsx:handleBulkCreateCircuits`: pre-create cap rejecting any entry where `circuit_number + (pole - 1) * 2 > targetPanel.num_spaces`.

**Tests:** 208/208 passing (no test changes — rule signature change only). `npm run build` exits 0 in 4.8s.

**No DB migration required.** All changes use the existing `panels.num_spaces` column.

---

## 2026-05-09: AHJ Compliance Audit Sprint 2A — Document Structure (PR #23, open)

Closes audit findings **H1, H2, H3** (TOC + revision log + sheet IDs) plus a sheet-ID styling and panel-schedule overflow fix found during user visual review. Open against `main`, mergeable CLEAN.

**User-Facing Changes:**

- **Section toggle panel before generating a packet.** New "Configure Sections" card on the Permit Packet Generator screen lets contractors choose which sections to include before hitting Generate. 16 toggleable sections grouped by category (Document Meta, Engineering, Diagrams & Equipment, Multi-Family, Compliance & AHJ, Panels). Cover sheet is always-on and shown as a non-toggleable indicator. Off-warning amber banners appear when the contractor toggles off sections most AHJs require (Compliance Summary, Panel Schedules — "Most AHJs reject without this"). Auto-disable predicates grey out toggles when the underlying data isn't present (e.g., "Voltage Drop" disabled with tooltip when no feeders are defined). Preferences persist per-project to `projects.settings.section_preferences` and survive page reloads.

- **Sheet IDs on every electrical sheet.** Every sheet of the packet now displays a stable plan-set sheet ID (e.g., `E-001` cover, `E-002` TOC, `E-101` load calc, `E-301` MDP panel schedule) in two places: a high-visibility yellow pill in the brand bar at the top, and a bordered cream badge in the footer paired with the page number. AHJ comment letters cite sheet IDs, not page numbers — a sheet ID stays stable across submittal rounds even when sections shift around it.

- **Sheet IDs use category-banded numbering.** 001-099 = front matter (cover, TOC, revision log, general notes), 100-199 = engineering calculations, 200-299 = diagrams & equipment, 300-399 = panel schedules (one per panel), 400-499 = multi-family scope, 500-599 = compliance & AHJ, 600-699 = specialty (reserved for upcoming EVEMS narrative + EVSE labeling pages). An AHJ reviewer sees "fix item on E-302" and immediately knows it's a panel schedule, not a calculation page. Same effect as letter prefixes (E-300s / M-200s) without prefix complexity.

- **Toggling a section off compresses sheet ID numbering within its band — no gaps.** If you toggle off the Table of Contents for a slimmer packet, the Revision Log moves from `E-003` to `E-002` and General Notes from `E-004` to `E-003`. The TOC entries (when included) auto-update to match.

- **New Table of Contents page (sheet `E-002`).** Auto-populated from the rendered section list. Lists every other sheet in the packet by sheet ID + title. Stable across revisions even if page numbers shift.

- **New Revision Log page (sheet `E-003`).** Tabular revision history. First submittals auto-populate "Rev 0 / [today's date] / Initial submittal / [Contractor name]" — the page never ships blank. Subsequent revisions append new rows. Required by every Florida pilot AHJ as the audit trail of plan changes.

- **42-circuit panel schedules no longer overflow to a second page.** A regression introduced by the per-sheet contractor signature block (Sprint 2A commit 2 added 34pt of bottom padding) was tipping 42-circuit panels into auto-overflow. Three-layer fix: page bottom padding tightened from 78pt to 64pt (the original 78 was over-provisioned for the contractor block + footer); panel summary card layout tightened (margins + padding + font sizes); `wrap={false}` added to the Load Summary and Dwelling Unit Demand cards so react-pdf moves the entire card to the next page rather than splitting it mid-content. Net: 42-circuit panel + Load Summary + Dwelling Unit Demand all fit on one sheet.

**Why this matters for the FL pilot:** Sheet IDs + TOC + Revision Log are intake-critical for every Florida AHJ — without them the packet gets rejected at the front desk before reaching technical review. The section toggle panel addresses real contractor workflow: they sometimes need a slimmer packet for pre-application AHJ walk-ins (no schedules, no jurisdiction page) and previously had to generate the full packet and tell reviewers to ignore certain pages.

**Technical:**

- **New `services/pdfExport/packetSections.ts`**: `PacketSections` type + `DEFAULT_SECTIONS` (all-on default), `resolveSections` partial-override helper, `SheetBand` constants for the 7 numeric category bands, `newBandCounters` + `nextSheetId` per-band sequential allocator, `formatSheetId` for tests. Sheet ID prefix is `E-` (electrical discipline).
- **Generator restructure (`services/pdfExport/permitPacketGenerator.tsx`)**: Replaced the imperative `pages.push({...})` chain with a declarative `builders: PageBuilder[]` list. Each builder declares `kind`, `band`, `pageCount`, `tocTitles`, and a `render(sheetIds, tocEntries)` function. Build pipeline: push every potential builder gated by both data presence (existing) and `sections` config (new); walk allocating sheet IDs per band; walk again collecting TOC entries; render each builder with its allocated IDs and the populated `tocEntries`. Cover is hard-required (no gate). ComplianceSummary + PanelSchedules toggleable but UI warns when off.
- **Multi-page component split (Option A)**: `MultiFamilyEVPages` accepts `sheetIds: [string, string, string]` (3 internal pages); `MeterStackScheduleDocument` accepts `sheetIds: string[]` aligned to `meterStacks`. Generator declares `pageCount: 3` for MFEV and `pageCount: stacks.length` for meter stack so each physical page in the merged PDF gets its own unique sheet ID.
- **Sheet ID prop threaded through all 9 page components**: CoverPage, GeneralNotesPage, EquipmentSchedule, RiserDiagram, LoadCalculationSummary, ComplianceSummary, EquipmentSpecsPages, VoltageDropPages, JurisdictionRequirementsPages, ShortCircuitCalculationPages, ArcFlashPages, GroundingPlanPages, PanelSchedulePages. Each forwards to BrandBar + BrandFooter.
- **Theme additions (`services/pdfExport/permitPacketTheme.tsx`)**: `BrandBar` accepts optional `sheetId` — renders yellow `BRAND_YELLOW` pill with `BRAND_DARK` bold text on the right side of the dark brand bar. `BrandFooter` accepts optional `sheetId` — renders cream `#fef3c7` badge with thin border paired with the page number. `themeStyles.page.paddingBottom` reduced 78pt → 64pt.
- **New PDF components (`services/pdfExport/PermitPacketDocuments.tsx`)**: `TableOfContentsPage` renders the entries grid + a note that sheet IDs are stable across revisions. `RevisionLogPage` auto-populates a default Rev 0 row when `revisions` is omitted.
- **UI (`components/PermitPacketGenerator.tsx`)**: New "Configure Sections" panel between Project Summary and Jurisdiction Requirements cards. 16 toggleable sections grouped into 6 categories. Cover shown as non-toggleable. Off-warning banners for ComplianceSummary + PanelSchedules. Auto-disable predicates with tooltips for missing-data sections. "Reset to defaults" link clears the override.
- **Persistence**: `ProjectSettings.sectionPreferences?: Record<string, boolean>` (typed loosely to avoid circular import from PDF service into `types.ts`; packet generator narrows at the boundary). Stored in existing `projects.settings` JSONB column — **no DB migration**. Each toggle change calls `updateProject(...)` with the merged settings.
- **Layout fix for 42-circuit panel overflow (`services/pdfExport/PanelScheduleDocuments.tsx`)**: `summarySection` margins/padding tightened (marginTop 15→8pt, padding 10→6pt), `summaryTitle` fontSize 11→9.5pt + marginBottom 8→4pt, `summaryValue` fontSize 12→10.5pt, `summaryLabel` fontSize 8→7pt. `wrap={false}` added to both summary card Views so react-pdf relocates the whole card on overflow rather than splitting mid-content.

**Tests:** 198/198 passing (was 187 + 11 new across `tests/packetSections.test.ts` and `tests/tocRevisionLogPdf.test.ts`). Build clean.

**No DB migration required.** All changes round-trip through the existing `projects.settings` JSON column.

**Audit doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](AHJ_COMPLIANCE_AUDIT_2026-05-04.md). H1, H2, H3 marked ✅ RESOLVED in PR #23. Open Sprint 2A: H14, H9+H15, H10, H11, M3, M6, H17, schema additions (3 themed PRs remaining).

**PRs**: #23 (open against `main`, mergeable CLEAN). Originally created with the wrong base (`fix/c2-evse-feeder-aggregation`); manually retargeted to `main` via REST API after `gh pr edit` failed on a Projects-classic deprecation warning.

---

## 2026-05-08: AHJ Compliance Audit Sprint 2A — Per-Sheet Polish + Content Gaps (PR 1, merged `92126eb`)

Closes audit findings **C7, H4, C8, M8, H12, H13** plus the LOW edition-stamp polish item. Three sub-commits squashed onto main.

**User-Facing Changes:**

- **NEC edition is now a packet-level setting (default 2020 for FL pilot AHJs).** Cover sheet subtitle and Compliance Summary now read "NEC 2020 Compliant Design Package" by default — was hardcoded "NEC 2023" everywhere. The Florida Building Code 8th Edition (2023) adopts NFPA-70 2020, so the FL pilot AHJs (Orlando, Miami-Dade, Pompano Beach, Davie, Hillsborough) all reference NEC 2020. Override via `data.necEdition = '2023'` for jurisdictions on the newer cycle. NEC 220.84 demand-factor table values are unchanged between 2020 and 2023, so calc engine outputs remain valid for either selector.

- **New "Applicable Codes" section on the cover sheet.** Lists the codes the design conforms to: NFPA-70 (NEC) 2020 + Florida Building Code 8th Edition (2023) by default. Driven from a `codeReferences` string array — Sprint 2C will inject per-AHJ overrides from the manifest.

- **Per-sheet contractor signature block on every electrical sheet.** Required by every Florida pilot AHJ — without it, intake reviewers reject the packet before reaching technical review. Renders fixed above the brand footer on every sheet showing Contractor name + License # on the left and a Signature / Date line on the right. The signature line draws even when contractor metadata is missing so the AHJ has a place to wet-sign.

- **Meter Stack Schedule page now matches the rest of the packet visually.** Was previously using a private style sheet with a different header/footer — read as a visual outlier. Now wraps each meter stack page with the shared brand bar + brand footer, including the new contractor signature block automatically.

- **New "General Notes" page (sheet 2 of the packet).** Eight numbered notes covering NEC 2020 + FBC 8th ed compliance, voltage-drop convention 3% branch / 3% feeder / 5% combined per NEC 210.19(A) IN 4 + 215.2(A)(1) IN 2, conductor sizing references, grounding & bonding (NEC 250.66 / 250.122 / 250.92), NRTL listing requirement (NEC 110.3(B)), EVSE / EVEMS references (NEC 625.42, 625.43), working space (NEC 110.26 / 110.27), and available fault current verification (NEC 110.10). Configurable via `generalNotes` array — Sprint 2C replaces with per-AHJ manifest content.

**Why this matters for the FL pilot:** These three commits close the most systemic intake-rejection vectors that affect every Florida AHJ — wrong NEC edition stamped on the cover, missing contractor signature block on every sheet, missing general notes page. Combined with PR #23 (sheet IDs, TOC, revision log), the form-factor side of Sprint 2A is largely complete.

**Technical:**

- **C7 + H4** (`services/pdfExport/PermitPacketDocuments.tsx` + `services/pdfExport/permitPacketGenerator.tsx`): `PermitPacketData` extended with `necEdition?: '2020' | '2023'` (default `'2020'`) and `codeReferences?: string[]` (default `['NFPA-70 (NEC) 2020', 'Florida Building Code 8th Edition (2023)']`). CoverPage and ComplianceSummary components accept the props and replace hardcoded "NEC 2023" strings. Both `generatePermitPacket` and `generateLightweightPermitPacket` pipe the props through.
- **C8 + M8** (`services/pdfExport/permitPacketTheme.tsx` + 9 page-component files): Shared `Footer` (BrandFooter) extended with optional `contractorName` + `contractorLicense` props. When provided, renders a fixed `<ContractorBlock>` above the brand footer with Contractor / License # cell on the left and a Signature / Date line on the right. `themeStyles.page.paddingBottom` raised 44pt → 78pt to make room (later tightened to 64pt in PR #23 after the 42-circuit overflow regression). All 9 PDF page modules accept the props and forward to BrandFooter. Generator threads a single `contractor = { contractorName: data.contractorName ?? data.preparedBy, contractorLicense: data.contractorLicense }` props bag into every page invocation. M8 fix bundled here: `MeterStackSchedulePDF.tsx` previously used a private style sheet — now wraps each Page with shared `themeStyles.page` + `BrandBar` (with `pageLabel="METER STACK SCHEDULE"`) + shared `BrandFooter` (which carries the C8 contractor block automatically). Local styles kept for table/specs detail rendering only.
- **H12 + H13** (`services/pdfExport/PermitPacketDocuments.tsx`): New `GeneralNotesPage` component renders a numbered notes list. Default `DEFAULT_GENERAL_NOTES` 8-item FL pilot stack defined at the top of the component. `PermitPacketData` extended with `generalNotes?: string[]`. Generator inserts the page right after CoverPage, before EquipmentSchedule.
- **5 new tests** in `tests/coverPagePdf.test.ts`, `tests/contractorBlockPdf.test.ts`, `tests/generalNotesPdf.test.ts` covering: NEC edition prop renders correctly with both default ('2020') and override ('2023') + custom code-reference arrays; BrandFooter renders ContractorBlock when contractor info is provided AND when omitted (signature line still drawn); MeterStackSchedule renders under shared theme; GeneralNotesPage renders default FL pilot notes AND custom AHJ override notes. Total suite: 187/187 pass (was 181 pre-Sprint-2A).
- **No data-model changes.** All Sprint 2A PR-1 fixes are PDF-layer additions to existing components.

**Audit doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](AHJ_COMPLIANCE_AUDIT_2026-05-04.md). C7, H4, C8, M8, H12, H13 marked ✅ RESOLVED. Sprint 2A continues with PR #23 (H1, H2, H3 — sections + sheet IDs + TOC + revision log).

**PRs**: PR 1 (merged to `main` as squash commit `92126eb` on 2026-05-08).

---

## 2026-05-07: AHJ Compliance Audit Sprint 1 — COMPLETE (C4 omnibus PR #19)

Closes the engine-correctness sweep of the permit-packet PDF against five Florida AHJ checklists. Six critical findings (C1, C2, C3, B-1, C6, C4) plus four bonus findings discovered during C4 user-review cycles (M4 promoted forward, F5 EV-meter dedup, in-app C6 twin, unit-panel sizing + display) all resolved. **Every page of the audit packet that does arithmetic now produces the right number.**

**User-Facing Changes (Sprint 1 omnibus, post-PR-#19):**

- **Per-EVSE branch circuits show full NEC 220.57(A) nameplate.** Page 14 of the audit packet was showing 3,996 VA per Level-2 charger branch (the EVEMS-shared per-charger value mistakenly persisted at autogeneration time). Each branch row now shows 11,520 VA (or the NEC 220.57(A) 7,200 VA minimum, whichever is larger), per NEC 625.40 + 210.19 conductor sizing rules.
- **NEC 625.42 EVEMS reduction applied at the feeder/service level only.** Branch conductors stay at full nameplate; the calculator's exact setpoint flows to the MDP demand calc via a metadata-only "EVEMS Aggregate Setpoint (NEC 625.42)" marker circuit. The MDP demand drops from ~1,199 A (over the 1,000 A breaker, an oversize misread) to ~999 A (sized correctly). The EV Sub-Panel main breaker now sizes to NEC 215.2(A)(1) (setpoint × 1.25 → 300 A on the audit fixture, was 400 A from the legacy heuristic).
- **EVEMS aggregate setpoint visible to AHJ reviewers.** The metadata row that previously read "EVEMS Load Management System  500 VA" (a placeholder the audit itself flagged as misleadingly low) is now hidden from the panel-schedule circuit table and replaced by a dedicated "EVEMS Aggregate Setpoint (NEC 625.42)" callout below the Load Summary on both the in-app panel summary and the PDF panel-schedule page. AHJ reviewers can verify the setpoint at a glance.
- **MDP panel-schedule PDF page now shows the 14 feeder breakers** (was empty "No circuits defined"). Synthesized virtual feeder rows at PDF generation time, each labeled `→ PANEL <name>` with the feeder breaker rating + post-NEC-220 demand load. Per NEC 408 panel schedules must show every protective device on the panel including feeders.
- **Unit panels right-sized to NEC 220.82 Optional Method.** Was 200 A bus rating (Standard Method via misnamed `calculateSingleFamilyLoad`); now 125 A bus rating (Optional Method: first 10 kVA general @ 100%, rest @ 40%, plus larger of A/C-vs-heat at 100%). MDP feeder breakers to each unit panel correspondingly drop from 200 A to 125 A.
- **Unit panel summary shows NEC 220.82 demand** instead of raw connected sum. Was reporting 150 A "demand" on a 125 A panel (misleading display, not a sizing error); now shows ~95 A with `(NEC 220.82)` annotation. New "Dwelling Unit Demand (NEC 220.82 Optional Method)" callout on the PDF panel-schedule page walks AHJ reviewers through the tiered general + non-coincident climate breakdown.
- **In-app panel-schedule phase imbalance display fixed for split-phase 1Φ panels.** Was showing 99.6% imbalance (an impossible value) on Unit panels because 2-pole 240 V loads were rotating to a phantom Phase C bucket that's never displayed. Now correctly splits 50/50 across A and B per NEC physics — same fix as C6 (PDF) but in the in-app `calculatePanelDemand` (the user found this twin during C4 review).
- **Meter stack no longer accumulates orphaned EV meters.** Was showing 4 "EV Meter" rows (1 linked + 3 orphans from prior testing) on a 15-position meter stack reporting `17 used / 15 total`. The `addEVInfrastructure` orchestrator now also deletes by `meter_type='ev'` (not just by `panel_id` link) so orphan meters left behind by external panel deletions get cleaned up on the next regen.

**Why this matters for the FL pilot:** Sprint 1 cleared every calculation-correctness bug in the audit packet. Combined with the C3 advisory permit metadata (placeholder warnings) and B-1 AI live-derive (Spark Copilot no longer gives stale-cache answers on feeder voltage drop), the packet is no longer producing demonstrably wrong arithmetic on any of its calculation-bearing pages. The packet can now be reviewed by an electrical engineer or AHJ without flagging arithmetic errors. Remaining work is presentation (Sprint 2 — Permit Mode v1) and policy (Sprint 3 — PE seal workflow).

**PR #19 commit chain (7 commits):**

| # | Commit | What |
|---|---|---|
| 1 | `aa1d3bb` | Branch nameplate per NEC 220.57(A); EVEMS clamp via panel-breaker proxy (over-generous) |
| 2 | `c85b088` | Replace proxy with explicit "EVEMS Aggregate Setpoint" marker circuit; in-app demand-amps clamp display |
| 3 | `38f1d25` | Hide marker from in-app PanelSchedule + right-size EV panel breaker per NEC 215.2(A)(1) |
| 4 | `ea67d7d` | MDP feeder synthesis on PDF (M4); unit panel sizing via misnamed Standard Method; EV meter orphan cleanup (F5); marker filter on PanelSchedulePages PDF render path |
| 5 | `aa72bdb` | Phase imbalance fix for 2-pole loads on 1Φ split-phase panels (in-app twin of C6) |
| 6 | `0b6ce69` | True NEC 220.82 Optional Method inline for unit panel sizing (200 A → 125 A) |
| 7 | `a6f2050` | Display NEC 220.82 demand on dwelling unit panel summaries (in-app + PDF) |

**Test count:** 123 (pre-audit) → 181 (post-Sprint-1, +58 regression tests). All 181 pass. `npm run build` exits 0.

**No DB migrations.** All Sprint 1 fixes are calc/display/autogen-layer changes. Future follow-up F4 + F6 will add `panels.is_evems_managed` + `panels.evems_setpoint_va` columns and rename the misnamed `calculateSingleFamilyLoad` when the schema is next touched.

**Audit doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](AHJ_COMPLIANCE_AUDIT_2026-05-04.md). Sprint 1 marked ✅ COMPLETE. Next session brief at the bottom of the audit doc points at Sprint 2 (FL Permit Mode v1: H1 TOC + H2 revision log + H3 sheet IDs + H4 FBC reference + M1 jurisdiction-checklist engine) or Sprint 3 (C5 PE seal workflow).

---

## 2026-05-05 / 2026-05-06: AHJ Compliance Audit — Permit Submittal Advisory + AI Live-Derive + PDF Phase Fix (C3 + B-1 + Panel-Phase)

**User-Facing Changes:**
- **Permit packet generator now warns about AHJ-rejection-class metadata without blocking generation.** When project address, contractor license, or permit number look like placeholders ("TBD", "test") or don't match the format Florida AHJs expect (FL DBPR `EC#######` / `ER#######` for license; ≥ 4 chars for permit number), a blue heads-up alert appears above the Generate button explaining the AHJ-rejection risk — but the packet still generates. Contractors keep the right to print drafts with "TBD" in unfinalized fields for pre-application AHJ walk-ins. Hard gating is reserved only for cases that would break PDF generation outright: no panels, no contractor-license input at all, no scope of work.
- **Spark Copilot ("is this feeder voltage drop compliant?") no longer gives false-confident answers from stale cached data.** The C2 staleness pattern that was fixed in the PDF was still present in the AI assistant: ask "is the MDP→EV Sub-Panel feeder compliant?" on a project where the feeder was auto-created before its destination panel had circuits, and Spark Copilot would answer "Compliant — 0.00%" because it was reading the same stale `feeder.voltageDropPercent` cache the PDF used to. The chat tool now live-derives feeder voltage drop from the destination panel's current NEC 220 demand, returning real values that match what the (post-C2) PDF reports.
- **Panel schedule pages on the permit-packet PDF now show correct phase letters and a real Phase A / Phase B balance.** Spotted on 2026-05-06 reviewing the audit packet's Unit 108 Panel page: every circuit on a 240 V single-phase (split-phase 1Φ-3W) panel displayed as "Phase A", and the bottom-of-page Load Summary reported phaseA = total / phaseB = 0 / phaseC = 0 — making the panel look maximally imbalanced when it was actually fine. Phase column now alternates A/B per slot pair (rows 1+2 → A, 3+4 → B, …) the same way the in-app view always did, and 240 V 2-pole loads (range, dryer, A/C, water heater) split 50/50 across both legs in the balance summary, since they physically span both bus stabs to get 240 V.

**Why this matters for the FL pilot:** C3 surfaces AHJ-rejection risk explicitly so contractors can make an informed call ("yes I know it's TBD, this is just a draft for the meeting") rather than being silently surprised on intake. B-1 closes the staleness loop — users who ask the AI for compliance answers now get the same numbers the PDF prints, so the "trust but verify" workflow doesn't produce contradictory results.

**Direction shift on 2026-05-06:** The first C3 implementation hard-blocked packet generation when metadata didn't match the AHJ-acceptable shape. User pushed back — contractors should retain the choice to print placeholder data, and the role of the tool is to inform rather than gate. C3 was reworked into an advisory-only pattern. B-1 was unaffected.

**Technical:**
- **C3 — `lib/validation-schemas.ts`, `components/PermitPacketGenerator.tsx`:** Three new exported advisory-only Zod schemas (`projectAddressSchema`, `flContractorLicenseSchema`, `permitNumberSchema`) with a shared `PLACEHOLDER_VALUES` rejection list (`tbd`, `test`, `n/a`, `na`, `tba`, `todo`, `xxx`, `unknown`, case-insensitive). `projectSchema.address` left at the original permissive `.min(1).max(200)` so other forms that consume it stay placeholder-tolerant. `PermitPacketGenerator.tsx` calls `safeParse` on all three; non-success results drive a blue informational alert ("Heads up — these may cause AHJ intake friction") that explicitly notes "Packet will still generate — these are informational only." The Generate button stays enabled.
- **B-1 — `services/ai/chatTools.ts`, `services/geminiService.ts`, `App.tsx`:** Plumbed raw DB rows alongside the lossy `ProjectContext` summary so chat tools can compute live values. `ToolContext` gained optional `rawPanels`, `rawCircuits`, `rawFeeders`, `rawTransformers` arrays. `askNecAssistantWithTools` accepts an optional `AgenticRawData` arg that threads into ToolContext. The single caller in `App.tsx:511` passes `{ panels, circuits, feeders, transformers }` from existing hook scope when project context is available. The `calculate_feeder_voltage_drop` tool now calls `computeFeederLoadVA` + `calculateFeederSizing` live (mirroring `services/pdfExport/VoltageDropDocuments.tsx:268-308`) and returns `{ voltageDropPercent, compliant, conductorSize, designCurrentAmps, liveLoadVA, calculationSource: 'live' | 'cached', warnings? }`. Falls back to the cached summary value with `calculationSource: 'cached'` when raw rows aren't wired (legacy callers, transformer-destination feeders).
- **Panel-Phase — `services/pdfExport/PanelScheduleDocuments.tsx`:** Same C1/C2 pattern — correct helper exists (`getCircuitPhase` in `services/calculations/demandFactor.ts`, fully tested), but the PDF reinvented its own broken inline phase logic (`panel.phase === 1 ? 'A' : ['A','B','C'][(row-1) % 3]`). Replaced the inline expression at both render paths (full + lightweight) with a `getCircuitPhase(leftNum, panel.phase)` call. Rewrote `calculatePhaseBalancing` for `panelPhase === 1` to distribute 1-pole loads to A or B by slot position and split 2-pole 240 V loads 50/50 across both legs (mirrors how 3-phase code already handles 2-pole breakers spanning two phases — and matches NEC physics: a 240 V load by definition draws across both opposite-polarity legs). In-app `components/PanelSchedule.tsx` was already correct; bug was PDF-only.
- **26 new regression tests** in `tests/calculations-extended.test.ts` covering: 21 schema acceptance/rejection cases for C3 (FL license format, permit-number length & placeholders, address placeholders & missing-digit detection); 3 AI tool tests for B-1 (live-derive happy path proving the cached `voltageDropPercent` is ignored, cached fallback when raw rows aren't provided, regression test that the pre-B-1 stale-cache behavior is reproducible); 4 panel-phase tests using the exact Unit 108 Panel circuit mix from the audit packet (regression that both legs carry load, 1-pole loads land on the correct leg per slot, 2-pole loads split 50/50, total imbalance ≤ 25%). Total suite: 164/164 pass (was 138 pre-bundle). `npm run build` exits 0.
- **No data-model changes.** No DB migration. The cached `feeder.voltageDropPercent` and `feeder.total_load_va` columns are preserved unchanged for the future PE seal snapshot workflow.

**Audit doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](AHJ_COMPLIANCE_AUDIT_2026-05-04.md). C3 and B-1 marked ✅ RESOLVED. Open: C4 (per-EVSE / EVEMS branch math), C5 (PE seal workflow), all H-tier and M-tier findings.

**PRs:** Branch `fix/c3-b1-bundle` (visual verification on Vercel preview before merge).

---

## 2026-05-05: AHJ Compliance Audit — Permit Packet Wiring Fixes (C1 + C2)

**User-Facing Bug Fixes:**
- **Multifamily permit packet load calc page now applies NEC 220.84 (Optional Method).** Generating a permit packet for a 12-unit multi-family + EVEMS-managed EV project used to dump every load into a single "Other / 100% / NEC 220.14" row at 498 kVA / 2,077 A — telling the AHJ the service was undersized when it actually wasn't. The packet now produces three correctly-attributed demand rows: Multi-Family Dwelling at the 220.84 unit-count factor (41% for 12 units), House Panel / Common Areas at 100%, and EV Charging (EVEMS-managed) at 100% per NEC 625.42. Totals match the in-app MDP "Aggregated Load" tile exactly (≈242 kVA / ≈1,008 A for the audit fixture).
- **Voltage drop report no longer shows 14 AWG / 0 A / "Compliant" for auto-generated EVSE feeders.** When a feeder was created by the Multi-Family EV calculator before the destination panel's circuits existed, the cached `total_load_va` stayed at 0 forever — the PDF then chose the smallest conductor in the table and reported a vacuously-true 0 % voltage drop. Voltage drop now live-derives feeder loads from the destination panel's current NEC 220 demand, so a 50 kVA EVSE sub-panel feeder sizes correctly without requiring a manual Recalculate click.
- **"Export Voltage Drop Report" button no longer disabled on projects that have valid feeder data.** The gating logic was checking the same stale cached column the PDF was reading; both now consult the live-derived demand.

**Why this matters for the FL pilot:** Both fixes are prerequisites for showing the packet to a Florida AHJ reviewer (Pompano Beach, Davie, Orlando, Miami-Dade, Hillsborough). The pre-fix output would have failed first-pass review on intake — the load calc table claimed the service was undersized, and the voltage-drop table contained an obvious-to-an-electrician violation (14 AWG to a 400 A panel).

**Technical:**
- **C1 — `components/PermitPacketGenerator.tsx`, `services/pdfExport/permitPacketGenerator.tsx`, `services/pdfExport/PermitPacketDocuments.tsx`, `services/calculations/upstreamLoadAggregation.ts`, `components/PanelSchedule.tsx`:** the calculation engine's NEC 220.84 branch was already correct (and the in-app MDP tile was hitting it correctly), but the PDF call site at `PermitPacketDocuments.tsx:980` was calling `calculateAggregatedLoad` without the optional `multiFamilyContext` argument — so the PDF fell through to the standard NEC 220 cascade where every `load_type='O'` circuit hit the `220.14` Other-Loads catch-all at 100%. Extracted the gate logic into a new pure helper `buildMultiFamilyContext(panel, panels, circuits, transformers, settings)` in `upstreamLoadAggregation.ts`. Single source of truth for the 4-condition gate (MDP, dwelling occupancy, multi_family type, ≥3 units). Both `PanelSchedule.tsx` and the permit-packet PDF now call the same helper.
- **C2 — `services/feeder/feederLoadSync.ts`, `services/pdfExport/VoltageDropDocuments.tsx`, `services/pdfExport/voltageDropPDF.tsx`, `components/FeederManager.tsx`:** the `feeders` table caches `total_load_va` at create time, but auto-population (Multi-Family EV calculator, templates) creates feeders before destination panel circuits exist. New `computeFeederLoadVA(feeder, panels, circuits, transformers)` helper live-derives `totalDemandVA` (post-NEC 220 cascade per NEC 215.2(A)(1)) from the destination panel. PDF generators, gating helpers, and the FeederManager UI button-disable logic now consult the helper. Cached column intentionally preserved for the future PE seal snapshot workflow. NEC 240.4(D) small-conductor enforcement was already correct — the 14 AWG result was the right answer for the wrong input.
- **NEC 220.84 table verification:** All 23 rows of `MULTI_FAMILY_DEMAND_TABLE` in `services/calculations/multiFamilyEV.ts:33-57` confirmed against NEC 2023 Table 220.84(B) — exact match, no data changes needed.
- **15 new regression tests** in `tests/calculations-extended.test.ts` covering the gate-condition matrix, multi-family branch correctness, the pre-C1 broken behavior, the pre-C2 broken behavior (vacuous-truth voltage drop on 0 A input), commercial-occupancy isolation, transformer-feeder fallback, and end-to-end EVSE-feeder sizing. Total suite: 138/138 pass (was 123 pre-audit). `npm run build` exits 0.
- **No data-model changes.** Both fixes are call-site wiring; the cached `feeders.total_load_va` column stays in place.

**Audit doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](AHJ_COMPLIANCE_AUDIT_2026-05-04.md). C1 and C2 marked ✅ RESOLVED. Open: C3 (project metadata validation), C4 (per-EVSE / EVEMS branch math), C5 (PE seal workflow).

**PRs:** #15 (C1, merged `9c8941d`), C2 PR pending on branch `fix/c2-evse-feeder-aggregation` (visual verification on Vercel preview before merge).

---

## 2026-04-21: Panel Photo Upload — OCR Refresh + `num_spaces` Overflow Fixes

**User-Facing Bug Fixes:**
- **Panel photo upload works again.** The "Edge Function returned a non-2xx status code" error users hit when uploading panel schedule photos is fixed — the underlying Gemini model (`gemini-2.0-flash-exp`) was sunset by Google. Replaced with `gemini-2.5-flash` (current GA). Error messages from the edge function now surface the real Gemini error body instead of the opaque wrapper.
- **PNG and WEBP panel photos now upload.** The edge function was hardcoding `"image/jpeg"` for all uploads; now honors the file's actual MIME type so non-JPEG captures (iPhone HEIC→PNG conversion, screenshots, etc.) analyze correctly.
- **Panel number-of-spaces is now editable.** New "Number of Spaces" dropdown in the panel create + edit forms on the One-Line Diagram: 12 / 20 / 24 / 30 / 42 / 54 / 66 / 84. Previously the app inferred size from `is_main` (MDP → 30, branch → 42), which silently dropped circuits whenever your real panel didn't match the inference (e.g., a 42-space MDP or a 24-space sub-panel).
- **Photo import no longer silently loses circuits.** When the AI extracted more circuits than the panel has spaces (e.g., 42 circuits imported into a 30-space MDP), the extra rows used to be written to the database as invisible orphans. Now the importer reports how many were skipped in a dialog: *"Imported 30 of 42 circuits. Skipped 12 circuit(s) past slot 30 (#31, #33...). Increase the panel's number of spaces to import them."*
- **Manual Add Circuit now bounds-checks against the panel's real size.** Previously, adding a 2-pole breaker at slot 41 of a 42-space panel would succeed even though slot 43 doesn't exist — producing orphan rows. Now rejected with a clear alert. The "+" button on a full panel alerts instead of silently doing nothing.
- **AI chat `add_circuit` now bounds-checks and scans for gaps.** Previously, asking the AI to add a circuit to a nearly-full panel wrote the next sequential number regardless of whether it fit (so slot 31 on a 30-space panel, or colliding with an existing circuit). Now uses the same bounded gap-scan as `fill_panel_with_test_loads`, and returns an actionable error when the panel is full.

**Technical:**
- New migration `supabase/migrations/20260421_panels_num_spaces.sql` adds `panels.num_spaces INTEGER NOT NULL DEFAULT 42 CHECK (num_spaces > 0 AND num_spaces <= 84)`. Backfilled from `is_main` at apply time (MDP → 30, branch → 42) so existing panels preserve their inferred size. Applied to the production Supabase project prior to the PR merging.
- `services/panelOcrService.ts` reads `FunctionsHttpError.context.json()` to surface the real Gemini error body (`{ error: "..."}`) through the wrapper, and forwards the image MIME type to the edge function.
- `supabase/functions/gemini-proxy/index.ts` v34 accepts `imageMimeType` on the request and falls back to `"image/jpeg"` when absent.
- Eliminated the `is_main ? 30 : 42` inference across **6 call sites in 4 files**: `OneLineDiagram` (available-slot finder), `PanelSchedule` (totalSlots computation, manual-add guard, photo-import guard), `PanelScheduleDocuments` (PDF export, 2 sites), `chatTools` (AI tools, 2 sites), and `projectContextBuilder` (AI context extraction). All sites now read `num_spaces` from the panel row with the legacy inference only as a defensive fallback for any row that somehow bypassed the migration backfill.
- `isCircuitSlotAvailable` and `getNextAvailableCircuitNumber` in `PanelSchedule.tsx` now respect `totalSlots`. The latter returns `null` when no slot fits; callers handle the null with user-facing alerts instead of writing phantom slot numbers like 101/102 (previous sentinel behavior).
- `chatTools.add_circuit` ported the `canFitCircuit` / bounded-scan pattern from `fill_panel_with_test_loads`. Builds an occupancy set that expands multi-pole breakers (2-pole at slot 1 blocks 1 *and* 3), scans 1..totalSlots for the first pole-sized gap, returns an actionable error when the panel is full.

**PR:** #12, merged `ccbb55b`.

---

## 2026-04-20: Spark Copilot Chatbot — Rebrand, Theme Re-skin, and UX Pass

**User-Facing:**
- **Renamed "NEC Copilot" → "Spark Copilot"** across the chatbot UI, docs, and in-app pointers. Stale "Check the AI Copilot sidebar" strings (the sidebar was removed last sprint) in Calculators, SiteVisitManager, RFIManager, TestAgentButton, and InspectorMode now correctly point users at Spark Copilot (bottom-right).
- **Chatbot now matches the rest of the app.** Dark-gray + electric-yellow skin replaced with the Harvey-inspired theme: forest-green header (`--color-primary`), serif title, gold `Sparkles` brand mark, primary-green user bubbles, `rounded-xl` corners, cream-paper message area, primary-ring input focus. FAB is green with a gold icon and an accent-gold unread badge.
- **Conversation persists across refreshes.** History is saved to `localStorage` keyed by the current `projectId` (or globally when you're outside a project). Navigating between projects swaps conversations automatically.
- **Clear-conversation button** (🗑 in the header) with a confirm gate. Disabled when history is empty.
- **Stop / retry.** Mid-response the Send button becomes a red Stop button — clicking discards the in-flight reply. Errors now surface as a red-bordered card inside the panel (instead of an "I encountered an error" bubble polluting history) with a **Retry** button that re-sends the last question.
- **Cmd/Ctrl+K** toggles the chatbot from anywhere in the app. Hint is printed below the input.
- **Multi-line input.** Replaced the single-line `<input>` with an auto-growing textarea. Enter sends; Shift+Enter adds a newline.
- **Clickable NEC references.** Anywhere the AI says "NEC 220.42" or "Article 250" in a response, it's now a link to the NFPA code landing page. (This codepath was previously dead code.)
- **Expandable tool-use disclosure.** The purple pill showing which tool the agent called is now clickable — it reveals a JSON view of the tool result underneath the message.
- **Upsell FAB** for users without the AI Copilot feature. Previously the FAB was silently hidden; now it shows a locked icon and navigates to `/pricing` on click.
- **A11y:** `role="dialog"`, `aria-live="polite"` on messages, Esc-to-close, auto-focus on open.

**Technical:**
- New helpers at top of `App.tsx`: `loadCopilotHistory` / `saveCopilotHistory` with `localStorage` key `sparkplan.copilot.history.<projectId|'global'>`. Date objects are serialized via ISO string and rehydrated on load. Failures (storage full, cookies-disabled) are swallowed silently — the feature degrades to session-only history.
- Stop/abort uses a **generation-id pattern** (`generationIdRef` + `nanoid()`) rather than a real `AbortSignal`. Each ask assigns a fresh id; Stop nulls it; when the Gemini reply returns, the handler checks whether the id still matches and discards otherwise. `services/geminiService.ts` `askNecAssistantWithTools` doesn't accept an `AbortSignal` today — threading one through to the Supabase edge function + Gemini SDK is bigger than this PR's scope and is left as a follow-up.
- Removed the duplicate copy button that was rendered both as an absolute overlay inside the AI bubble AND as an inline button below the timestamp. Kept the overlay; deleted the inline.
- Removed the `Bot` lucide icon in favor of `Sparkles` as a single consistent brand mark across FAB, AI avatar, loading state, and empty state.
- `processNecReferences` was declared-but-never-called with a dead `articleNum` variable. Renamed to `linkNecReferences`, removed the unused var, and wired it to run against `msg.text` before `ReactMarkdown` renders.
- `AICopilotSidebar.tsx` remains in the tree but is not rendered (it was disconnected from `Layout.tsx` in a previous sprint). Deferred deletion to a separate cleanup PR.

**Not shipped in this PR (candidates for follow-ups):**
- Streaming responses (requires changes to `services/geminiService.ts` and the edge function).
- Real `AbortSignal` plumbing through the service layer.
- Delete the orphaned `AICopilotSidebar.tsx` component.

**Branch**: `fix/chatbot-design-refresh` — build clean, 124/124 tests pass. Live browser verification deferred to user (see SESSION_LOG for checklist).

---

## 2026-04-19: `/circuits` Bug Sweep — Inputs, Cross-Component Refresh, Cascade-Delete, Hierarchy-Delete Safety

**User-Facing Bug Fixes:**
- **Numeric input fields no longer prefix a stubborn `0`.** Previously, clearing a number field and retyping produced values like `036` or `0120` because the controlled input re-rendered with `value="0"` mid-edit. All affected sites across the Dwelling Load Calculator and the standalone Calculators (voltage-drop, conduit-fill, short-circuit, EV charging, solar PV, arc flash) now use the buffered `NumberInput` component — typing behaves as expected.
- **Newly created panels now appear immediately in the Feeder Sizing dropdown.** On `/circuits`, creating, renaming, or deleting a panel in the diagram now reflects in FeederManager's Destination Panel dropdown without refreshing the page.
- **Panels with connected feeders can now be deleted.** Previously this failed with a confusing "Failed to update panel" error and the panel stayed. Deletion now succeeds and the confirmation dialog warns "This will also delete N feeder(s) connected to this panel." before proceeding. Error toasts for delete failures now read "Failed to delete panel" instead of "Failed to update panel".
- **Deleting a mid-tree panel or transformer is now blocked with a clear message.** Previously, deleting a panel that fed a downstream subpanel would silently leave the subpanel orphaned — still visible in the list but missing from the one-line diagram. Delete now aborts with an alert listing the dependent equipment and instructs the user to delete downstream branches first. Same guard applies to transformers that feed panels.
- **Transformers with connected feeders can now be deleted.** Same class of error as the panel-delete bug: `feeders` FK cascade + CHECK constraint would roll back the delete with a 400. Now resolves cleanly; confirmation warns "This will also delete N feeder(s) connected to this transformer." Error toast reads "Failed to delete transformer" (previously "Failed to update transformer").

**Technical:**
- `usePanels` now emits `dataRefreshEvents.emit('panels')` on every successful CRUD operation. This works around Supabase realtime's behavior when multiple components on the same page subscribe to a shared channel name (`panels_${projectId}`) — every peer hook instance refetches regardless.
- `usePanels.deletePanel` performs an app-level cascade: it deletes feeders referencing the panel (`source_panel_id = id OR destination_panel_id = id`) before the panel itself. This is required because the `feeders` table has an FK at `ON DELETE SET NULL` combined with a CHECK constraint that requires exactly one of `{panel_id, transformer_id}` per side — the two would otherwise conflict and roll back the delete.
- After cascading, `deletePanel` dispatches the `feeder-data-updated` window event so `useFeeders` instances also refetch.
- New pure helper `services/equipmentDependencies.ts` exposes `getPanelDownstream` / `getTransformerDownstream` / `getMeterStackDownstream` + `formatDependencyMessage`. Used by `OneLineDiagram.removePanel` and `removeTransformer` to block mid-tree deletes before any DB mutation.
- `useTransformers.deleteTransformer` now mirrors `deletePanel`: pre-cascade feeders on `source_transformer_id` / `destination_transformer_id`, then dispatch `feeder-data-updated`. `toast.transformer.deleteError` added for verb-specific error copy.

**PRs:** #8, #9, #10

---

## 2026-04-18 (PM): Stripe Webhook Signature Verification — Re-aligned to Env-Var Source of Truth

**Operational:**
- **`stripe-webhook` deployed function now matches git source.** Previously, the deployed v35 had the `whsec_...` signing secret hardcoded as a workaround for an env var that was silently set to the wrong value. Overwrote the Supabase secret with the correct value; redeployed git source (env-var based) as v38 with `verify_jwt: false`.
- **Signature verification confirmed via direct HMAC probes** (independent of Stripe infrastructure): valid HMAC → `200 {"received":true}`, forged HMAC → `400 "No signatures found matching..."`. Gateway accepts both, confirming `verify_jwt: false`.
- **Duplicate webhook endpoint neutralized.** Stripe account had a second live endpoint (`adventurous-splendor`) at 35/35 failure rate — its signing secret was never propagated. Disabled (not deleted) so it can be re-enabled if needed. The only event it caught that endpoint A doesn't (`customer.subscription.paused`) is redundant — already handled via `customer.subscription.updated`.
- **Memory updated** with rotation playbook and the duplicate-endpoint gotcha (`memory/stripe_webhook_signature.md`). Added `.rollback/` to `.gitignore` to prevent local v35 snapshot from leaking.

**Recommended follow-up**: rotate the webhook signing secret when convenient — the `whsec_P0LA...` value has effectively been exposed through conversation history and the local rollback snapshot.

**PR:** #6

---

## 2026-04-18: Support Inbound Pipeline — Live Deployment + Debug Playbook

**Operational:**
- **End-to-end email-reply pipeline is live in production.** Admin replies from `support@sparkplan.app` and customer replies to notification emails now thread back into the originating ticket, get persisted to `support_replies`, and trigger a cross-echo email to the other party. Widget + Admin Panel update in realtime without refresh.
- Resolved migration history drift across 29 local migration files (timestamp prefixes normalized to unique 14-digit `YYYYMMDDHHMMSS` format so `supabase db push` can track them).

**Bugs Fixed During Live Validation:**
- **Gateway-level 401**: Supabase's default JWT verification rejected pg_cron's custom shared-secret header. Redeployed `support-inbound` with `--no-verify-jwt` (application-layer `verifySecret()` still enforces auth).
- **Vault placeholder never replaced**: `support_inbound_secret` Vault row held a literal template string instead of the 64-hex random value. Generated `openssl rand -hex 32` and synced both the Vault entry (via `vault.update_secret()`) and the edge function secret.
- **Admin identity too narrow**: Inbound function only recognized the admin's login email (augustovalbuena@gmail.com), so replies from the shared `support@sparkplan.app` mailbox were rejected as `ignored-unauthorized`. Widened `isSenderAdmin` to accept either `ADMIN_EMAIL` or `GMAIL_MAILBOX`.
- **Internal service-role call rejected**: `support-inbound` → `support-notify` invocations returned 401 because Supabase's new API key format (`sb_secret_...`) isn't a JWT. Redeployed `support-notify` with `--no-verify-jwt`; the function's own `isInternalCall` check continues to validate the service-role bearer.

**Known Limitation (Documented, Not Yet Fixed):**
- **`is:unread` strands opened messages**: If you preview a reply in Gmail before cron polls, it gets marked read and excluded from `to:support+ticket- is:unread newer_than:1d`. Workaround is to mark unread; future fix is to migrate to Gmail History API using the already-provisioned `support_gmail_sync_state.last_history_id` column.

**Documentation:**
- Expanded `docs/SUPPORT_INBOUND_SETUP.md` with a 7-stage diagnostic playbook (cron fired? response body fingerprint? Vault/secret parity? sender authorized? Gmail query returning? echo emitted? token valid?). Each stage lists the exact SQL query and the specific fix.
- Added a response-body fingerprint table mapping HTTP body → root cause → fix, so future debugging sessions start from a string match rather than first-principles.

**Files Modified:**
- `supabase/functions/support-inbound/index.ts` — accept shared mailbox as admin identity
- `docs/SUPPORT_INBOUND_SETUP.md` — comprehensive troubleshooting playbook
- 29 migration files renamed to unique 14-digit timestamps

---

## 2026-04-17: Support System — Inbound Email Replies (Gmail polling) + AI-Investigation Scaffolding

**New Features:**
- **Email replies thread back into tickets**: Both admin and customer email replies are now automatically attached to the originating ticket as `support_replies` rows. No dashboard visit required for quick back-and-forth. Realtime subscriptions mean the reply appears live in both SupportWidget and AdminSupportPanel without refresh.
- **Per-ticket plus-addressed `Reply-To`**: All outbound mail types (`new_ticket`, `admin_reply`, `status_changed`, and new `user_reply`) set `Reply-To: support+ticket-<uuid>@sparkplan.app`. Gmail delivers plus-addressed mail to the same inbox, so the ticket ID rides every thread for free — no extra MX records, no new domain.
- **`support-inbound` edge function (Gmail API polling)**: pg_cron fires the function every minute with a shared secret. It lists unread messages matching `to:support+ticket- is:unread newer_than:1d`, extracts the ticket UUID from the recipient, authenticates the sender (admin email or ticket owner), strips quoted reply history, inserts into `support_replies` via service_role, emits a `support_ticket_events` row, then echoes via `support-notify` to keep the *other* party informed. Admin email replies auto-bump `open → in_progress` matching dashboard behavior.
- **`support-investigate` edge function (stub)**: Architectural seam for a future Claude Code runner that picks up bug tickets, investigates, and reports findings to Slack + the admin dashboard. Currently returns 202 Accepted and writes `status='skipped'` investigation rows so the UI can show "deferred" without further migrations. The schema (`support_ticket_investigations`) already carries everything the runner will eventually write: `findings`, `artifacts` (JSONB), `notified_via`, `completed_at`, `error_message`.

**Architecture:**
- **Gmail API over Resend Inbound**: The existing Google Workspace mailbox handles receiving for free; Resend Pro ($20/mo) was avoided. Code structure is provider-agnostic — swapping to a webhook-based provider later would only touch `support-inbound`'s entry point.
- **Append-only event log**: New `support_ticket_events` table captures every lifecycle event (`ticket_created`, `user_reply`, `admin_reply`, `status_changed`, `priority_changed`, `investigation_requested`, `investigation_completed`) with a `source` discriminator (`widget` / `dashboard` / `email` / `system`). This is the integration point for the future AI-investigation handler and any other event-driven downstream (Slack, analytics, audit).
- **Investigation scaffolding is forward-compatible**: `investigator` column is a CHECK-constrained enum that already includes `'claude-code'`, `'human'`, `'automated-check'`. Status column covers the full lifecycle (`pending` → `running` → `completed` / `failed` / `skipped`). Adding the real runner is a code-only change.
- **Shared helpers**: `supabase/functions/_shared/gmail.ts` (OAuth refresh-token flow, message listing, base64url decoding, MIME tree walk) and `supabase/functions/_shared/supportEvents.ts` (event emit, ticket-ID extraction, quoted-reply stripping) keep edge functions thin.
- **Internal-trust bypass in support-notify**: `support-inbound` calls `support-notify` with the service_role bearer token to trigger user_reply echoes. support-notify now detects service_role callers and treats them as trusted system-level without requiring a user session.

**New Tables:**
- `support_ticket_events` — append-only event log (admin-read-only RLS, service_role writes)
- `support_ticket_investigations` — AI/human investigation records (realtime enabled for live dashboard updates)
- `support_gmail_sync_state` — singleton polling watermark for operational visibility

**Configuration Required Before Live Use:**
- Google Cloud Console: enable Gmail API on a project, create OAuth 2.0 Desktop-app credentials, grant `https://www.googleapis.com/auth/gmail.modify` scope
- Run `deno run --allow-net scripts/gmail-oauth.ts` once to obtain the offline refresh token
- Supabase Edge Function secrets: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_MAILBOX=support@sparkplan.app`, `SUPPORT_INBOUND_SECRET` (strong random), `SUPPORT_ADMIN_AUTH_USER_ID` (admin's `auth.users.id`)
- Supabase Vault: `support_inbound_secret` (same value as the env var) and `supabase_functions_base_url` (so the pg_cron migration can read them)
- Apply migrations: `20260417_support_events_and_investigations.sql`, `20260417_support_inbound_cron.sql`
- Deploy edge functions: `support-notify` (updated), `support-inbound` (new), `support-investigate` (new stub)

**Files Created:**
- `supabase/migrations/20260417_support_events_and_investigations.sql` — event log + investigations + Gmail sync state
- `supabase/migrations/20260417_support_inbound_cron.sql` — pg_cron schedule + pg_net call
- `supabase/functions/_shared/gmail.ts` — Gmail API REST helpers
- `supabase/functions/_shared/supportEvents.ts` — shared event emit + email parsing
- `supabase/functions/support-inbound/index.ts` — Gmail polling handler
- `supabase/functions/support-investigate/index.ts` — AI-investigation stub
- `scripts/gmail-oauth.ts` — one-shot OAuth bootstrap

**Files Modified:**
- `supabase/functions/support-notify/index.ts` — plus-addressed `Reply-To`, service_role internal-trust path, new `user_reply` payload type
- `lib/database.types.ts` — added 3 new table types

---

## 2026-04-16: In-App Support System (Phase 3.2)

**New Features:**
- **In-app support ticket system**: Users open tickets from a floating support bubble (bottom-left). Tickets capture category, subject, message, optional image attachments (up to 5), current page URL, plan tier, and browser info. Admin replies from the Admin Panel "Support" tab; threaded replies appear in the widget. No more mailto: hand-off — the entire conversation stays in-app.
- **Email notifications via Resend**: New ticket → `support@sparkplan.app` (with reply-to set to the user for quick email replies); admin reply → user's registered email with "continue in SparkPlan" CTA; status changes (open / in_progress / resolved / closed) → user email with a branded status badge.
- **Unread-reply badges**: Red badges appear on the floating bubble, the "My tickets" tab, and each ticket row when the admin has replied since the user last opened the ticket. Opening a ticket (or receiving a reply while the ticket is already open) clears it. Implementation uses a per-ticket `user_last_seen_at` high-water mark rather than per-reply read receipts.
- **Realtime sync**: Supabase postgres_changes subscriptions on both `support_tickets` and `support_replies` — new admin replies show up instantly with the badge incremented without refresh.
- **Admin Support Panel**: List / filter / search tickets by status or email; set priority (low / normal / high / urgent); set status; compose replies inline; view full user thread with image attachments rendered via signed URLs.

**Bug Fixes:**
- **"permission denied for table users" on ticket insert**: Root cause was admin RLS policies subquerying `auth.users`, but the `authenticated` role has no SELECT grant on that table. Because policies are OR-combined, every user (not just admins) hit the error. Fixed by switching admin checks to `(auth.jwt() ->> 'email') = 'augustovalbuena@gmail.com'`, which reads the email claim from the JWT instead of joining against auth.users. Applied to support_tickets, support_replies, and storage.objects.
- **Support bubble overlap**: Floating bubble position changed from `md:left-6` to `md:left-[17rem]` so it sits past the 16rem sidebar instead of covering "Sign Out" / "Account Settings".
- **Widget title readability**: Forced `text-white` on the heading (was reading as dark green on the dark-green gradient).

**Files Created:**
- `components/SupportWidget.tsx` — Floating bubble + form + history + threaded reply view
- `components/AdminSupportPanel.tsx` — Admin ticket dashboard
- `hooks/useSupportTickets.ts` — Supabase CRUD + realtime + unread computation
- `supabase/functions/support-notify/index.ts` — Resend edge function (new_ticket / admin_reply / status_changed)
- `supabase/migrations/20260416_support_tickets.sql` — Tables + RLS + storage bucket
- `supabase/migrations/20260416_fix_support_rls_use_jwt.sql` — JWT-claim admin policy fix
- `supabase/migrations/20260416_support_tickets_last_seen.sql` — Unread watermark column + restricted UPDATE grant

**Files Modified:**
- `App.tsx` — Mount SupportWidget + lazy-load AdminSupportPanel behind AdminPanel tab
- `components/AdminPanel.tsx` — New "Support" tab wiring
- `lib/database.types.ts` — support_tickets / support_replies / user_last_seen_at
- `lib/validation-schemas.ts` — Ticket form schemas
- `lib/toast.ts` — Support-flow toast messages
- `lib/dataRefreshEvents.ts` — Support entity refresh events

**Edge Functions Deployed:**
- `support-notify` v3 (via MCP `deploy_edge_function`)

---

## 2026-04-15: Commercial Load Calculator UX + Export

**New Features:**
- **PDF export from Commercial Load Calculator**: Submittal-quality report with project info, service sizing summary (main breaker / bus / utilization), itemized load breakdown with NEC refs, service sizing math, input parameters (HVAC/Motors/Kitchen/Special), warnings, NEC calculation notes, and a signature block. Single-page layout that flows naturally — small projects render on 1 sheet, dense projects expand to 2–3.
- **CSV export from Commercial Load Calculator**: Structured multi-section CSV (project info, service sizing, breakdown, inputs per category, warnings, notes). RFC 4180-compliant with UTF-8 BOM so Excel correctly renders Φ and ⚠️ symbols. Includes testable pure `buildCommercialLoadCSV()` helper.
- **Manual override of main breaker + bus rating** in the Recommended Service Sizing card: dropdown picks filtered to valid sizes (OCPD ≥ calculated amps, bus ≥ effective main breaker), utilization and color recalc live, "↺ Auto" resets to NEC-computed default. Overrides are tagged in both PDF and CSV exports with the NEC-auto value for audit trail.
- **Motor FLA auto-populate** from NEC 2023 Tables 430.248 (single-phase) and 430.250 (three-phase) when HP/voltage/phase changes. Manual edits are preserved until any driver input changes again. NEC reference value shown as a hint below each FLA field with a "Reset to NEC" button when overridden.

**Bug Fixes:**
- **Number input UX**: Fixed two long-standing bugs affecting all 15 number inputs in the Commercial Load Calculator: users couldn't clear the field to empty (Number('') coerced to 0 and snapped back) and typing produced leading zeros (e.g., "10" rendered as "010"). New reusable `<NumberInput>` component buffers typing as a local string, allowing empty/partial states mid-typing and normalizing on blur.
- **Riser / one-line diagram voltage label**: The UTIL symbol and "…V …Φ Service" badge in the top-left corner of the diagram were hardcoded to read `project.serviceVoltage` / `project.servicePhase`. Creating an MDP at a different voltage (e.g. 480V) left the labels stuck at the project default (e.g. 208V). Now derives from the MDP (`is_main: true`) when present, falling back to the project-level value.

**Files Created:**
- `data/nec/table-430-248-250.ts` — NEC 2023 motor full-load current tables + `getMotorFLA()` lookup with voltage-column mapping (120→115, 240→230, 480→460, 600→575)
- `components/common/NumberInput.tsx` — Reusable controlled numeric input
- `services/pdfExport/CommercialLoadDocument.tsx` — React-PDF Document component
- `services/pdfExport/commercialLoadExport.ts` — `exportCommercialLoadPDF()`, `exportCommercialLoadCSV()`, `buildCommercialLoadCSV()`

**Files Modified:**
- `components/CommercialLoadCalculator.tsx` — Manual overrides, motor FLA auto-populate, all inputs migrated to NumberInput, export buttons
- `components/OneLineDiagram.tsx` — Effective service voltage/phase derived from MDP at 4 display sites + export path
- `services/calculations/commercialLoad.ts` — Exported `STANDARD_OCPD_SIZES` and `STANDARD_SERVICE_BUS_RATINGS` for UI dropdowns
- `App.tsx` — Pass full `project` object (not just id) to CommercialLoadCalculator so exports can access metadata

---

## 2026-04-12: Stripe Live Mode & Admin Panel (Phase 3.0)

**New Features:**
- **Stripe live mode**: Migrated from test to live API keys, created live products/prices, deployed new webhook endpoint
- **Admin refund & cancel**: One-click refund of latest payment + subscription cancellation from admin panel
- **Trial expiration UI fixes**: FeatureGate now uses `effectivePlan` (not `plan`) so expired trials show "Free" correctly; fixed invisible "View Plans" button CSS
- **Branded email template**: SparkPlan-branded confirmation email with trial info and feature list
- **SMTP setup guide**: Step-by-step Resend + Vercel DNS configuration

**Files Created:**
- `supabase/functions/stripe-refund/index.ts` — Admin-only refund edge function
- `supabase/email-templates/confirmation.html` — Branded signup email
- `supabase/email-templates/SETUP.md` — Resend SMTP setup guide

**Files Modified:**
- `components/AdminPanel.tsx` — Refund button, confirmation dialog
- `components/FeatureGate.tsx` — `effectivePlan` fix for expired trials
- `components/TrialBanner.tsx` — Button visibility CSS fix

**Edge Functions Deployed:**
- `stripe-checkout` v16, `stripe-portal` v15, `stripe-webhook` v22, `stripe-refund` v2

---

## 2026-03-08: Subscriptions & Feature Gating (Phase 2.9)

**New Features:**
- **5-tier subscription system**: Free, Starter ($29), Pro ($49), Business ($149), Enterprise (custom)
- **Stripe Checkout**: Edge function creates checkout sessions with promo code support
- **Stripe Webhooks**: Handles checkout.session.completed, subscription CRUD, invoice.paid/failed
- **Stripe Billing Portal**: Self-service subscription management
- **Feature gating**: 40+ features mapped to plan tiers via `FeatureGate` component (blocking, subtle, inline modes)
- **14-day Business trial**: Auto-created on signup, countdown banner with urgency states
- **Pricing page**: Plan cards, feature comparison table, FAQ section
- **Admin panel**: User search, plan override, create/delete users, email confirmation
- **Real-time sync**: Subscription changes propagate instantly via Supabase channels

**Files Created:**
- `hooks/useSubscription.ts` — Subscription state, feature checks, Stripe integration
- `components/PricingPage.tsx` — Pricing page with comparison table
- `components/FeatureGate.tsx` — Feature access control component
- `components/TrialBanner.tsx` — Trial countdown + promo code input
- `components/AdminPanel.tsx` — Admin dashboard
- `supabase/functions/stripe-checkout/index.ts` — Checkout session creation
- `supabase/functions/stripe-webhook/index.ts` — Webhook event handler
- `supabase/functions/stripe-portal/index.ts` — Billing portal session
- `supabase/migrations/20260105_subscriptions.sql` — Subscriptions table
- `supabase/migrations/20260212_trial_and_admin.sql` — Admin RPC functions
- `supabase/migrations/20260212_admin_user_management.sql` — User management RPCs
- `supabase/migrations/20260217_admin_confirm_user.sql` — Email confirmation RPC

---

## 2026-02-22: User Profiles & Settings (Phase 2.8)

**New Features:**
- **Profile auto-creation**: Trigger creates profile row on user signup
- **Backfill migration**: Existing auth.users get profiles automatically
- **Account Settings page** (`/settings`): Name, company, license number, contact info
- **Permit Packet auto-fill**: "Prepared By" and license fields populate from profile
- **Sidebar display name**: Shows user's name from profile in navigation

**Files Created/Modified:**
- `hooks/useProfile.ts` — Single-row profile fetch/update hook
- `components/UserProfile.tsx` — Settings page
- `supabase/migrations/20260217_profile_creation_trigger.sql` — Trigger + backfill

---

## 2026-02-08: Multi-Family Project Population (Phase 2.7)

**New Features:**
- **Auto-Generation Service**: "Apply to Project" button creates full electrical hierarchy from MF EV calculator results — MDP, meter stack, house panel, EV sub-panel, unit panels, feeders, EVEMS circuits
- **Meter Stack & Meters**: New DB schema + hooks with realtime sync
- **CT Cabinet in One-Line Diagram**: Current transformer metering visualization (both interactive and print views)
- **Meter Stack Schedule PDF**: Permit-ready meter schedule in permit packet
- **Building/Unit Relationships**: Hooks + realtime subscription for multi-family hierarchy

**Files Created/Modified:**
- `services/autogeneration/multiFamilyProjectGenerator.ts` — 3 generation modes
- `services/autogeneration/projectPopulationOrchestrator.ts` — DB insertion in FK order
- `services/pdfExport/MeterStackSchedulePDF.tsx` — Permit-ready meter schedule
- `supabase/migrations/20260208_meter_stacks.sql` — meter_stacks + meters tables

---

## 2026-02-04: NEC 220.87 Measurement Path & Smart Defaults

**New Features:**
- **NEC 220.87 Dual-Path Support**: Can now determine building load via calculation (220.87(B)) OR measurement (220.87(A))
  - 12-month utility billing input (kW demand from utility records)
  - 30-day load study input (continuous metering data)
  - Measurement path often shows 30-50% MORE available capacity
- **Building Type Presets**: Smart defaults for common building types
  - Studio apartments, 1BR, 2BR, condos, townhomes, senior living
  - Auto-fills typical sq ft, common area loads, service size
  - "Don't know the details? Select building type" workflow
- **Documentation Updates**:
  - `STRATEGIC_ANALYSIS.md` refocused on Multi-Family EV only
  - `VALIDATION_ANALYSIS.md` updated with NEC 220.87 findings
  - Data collection guide for contractors added

**Files Modified:**
- `services/calculations/multiFamilyEV.ts` - NEC 220.87 measurement path logic
- `components/MultiFamilyEVCalculator.tsx` - Building presets UI, load method selector
- `services/pdfExport/MultiFamilyEVDocuments.tsx` - Shows load determination method

---

## 2026-01-31: Multi-Family EV Bug Fixes & Merge

**Branch**: `feature/multi-family-ev` → Merged to `main`

**Critical EVEMS Bug Fixes:**
- Bug #1: EVEMS showed fewer max chargers than direct connection (backwards!)
  - Added `directAlreadySufficient` check
  - Fixed missing variable references (`canAccommodateAllWithEVEMS`, `maxChargersWithEVEMS`)
- Bug #2: kW per charger exceeded physical charger limits (showed 11.4 kW for 32A @ 240V = 7.68 kW max)
  - Added cap at charger's physical maximum: `Math.min(perEVSEMaxKW, theoreticalKWPerCharger)`

**UI Cleanup:**
- Removed Cost Comparison card from calculator

**Commits:** `97ef322`, `5ed2640`, `4578565`, `68da43a`

---

## 2026-01-21: Multi-Family EV Calculator (Phase 2.5)

**New Features:**
- Multi-Family EV Readiness Calculator implementing NEC 220.84 + 220.57 + 625.42
- Building profile inputs (dwelling units, sq ft, common areas)
- EV charger configuration (Level 1/2, amps, chargers per unit)
- Itemized common area loads with NEC demand factors (220.42, 220.44, 620.14, 430.24)
- Building demand analysis with tiered demand factors
- EV capacity scenarios (with/without EVEMS load management)
- Service upgrade recommendation (none/panel-only/full-service)
- 3-page professional PDF export for city permits
- Integrated into Permit Packet Generator

**Files Created:**
- `services/calculations/multiFamilyEV.ts` (1400+ lines)
- `components/MultiFamilyEVCalculator.tsx` (~1100 lines)
- `services/pdfExport/MultiFamilyEVDocuments.tsx` (692 lines)
- `services/pdfExport/multiFamilyEVPDF.tsx` (84 lines)

---

## 2026-01-15: Feeder Sizing Bugs & UI Improvements

**Commit**: `8f80285`

**Bug Fixes:**
- Fixed transformer source → panel destination dropdown
- Added `getValidPanelDestinationsFromTransformer()` for connectivity validation
- Moved continuous load % slider to load-based sizing only (NEC 215.2(A)(1))
- Fixed transformer destination load aggregation

**UI Improvements:**
- Compact feeder and short circuit cards (50% height reduction)
- Cross-component feeder refresh via custom events

---

## 2026-01-12: AI Chatbot Enhancement & Tools

**New Action Tools:**
- `add_circuit`, `add_panel`, `fill_panel_with_test_loads`, `empty_panel`, `fill_with_spares`

**Read/Check Tools:**
- `get_project_summary`, `check_panel_capacity`, `calculate_feeder_voltage_drop`
- `check_conductor_sizing`, `check_service_upgrade`, `run_quick_inspection`

---

## 2025-12-30: UI/UX Improvements - Issues #24-27

**Issue #24: One-Line Diagram Separation**
- Added `diagramOnly` prop to OneLineDiagram component

**Issue #25: Inline Circuit Addition**
- Inline "+ Add Circuit" row in panel schedule table
- Comprehensive slot validation with multi-pole support

**Issue #26: Circuit Design Layout**
- 2-column layout (320px sidebar + 1fr diagram)
- Sticky diagram stays visible while scrolling

**Issue #27: Site Visit Status + Calendar Integration**
- Status dropdown: Scheduled ↔ In Progress ↔ Completed ↔ Cancelled
- Auto-sync with calendar events

---

## 2025-12-26: Python AI Backend Deployed

**URL**: https://neccompliance-production.up.railway.app

- Python FastAPI backend deployed to Railway
- 4 Pydantic AI agents operational
- Supabase integration configured
- Gemini AI 2.0 connected
- Real-time WebSocket subscriptions enabled

---

## 2025-12-20: Agentic PM System - Phase 0

- RFI Tracking with AI PDF extraction (Gemini Vision)
- Site Visit Logging with drag-and-drop photo upload
- Open Items Dashboard (cross-project aggregation)
- Calendar/Timeline with events, deadlines, meetings

---

## 2025-12-17: Service Upgrade Wizard

**Critical Compliance Fix:** Added 125% multiplier for calculated/manual loads per NEC 220.87
- Four determination methods: Utility Bill, Load Study, Calculated, Manual
- Only actual measurements skip 125% multiplier

---

## 2025-12-16: Short Circuit Calculator

- Service conductor parameters (real-world distance modeling)
- Critical bug fix: 3-phase impedance multiplier (was 40% underestimated)
- Calculation tracking system with results viewer
- PDF export (single calculation or full system report)
- Engineering accuracy per IEEE 141 (Red Book)
