# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-09

---

### Session: 2026-05-09 — Chatbot VD+ awareness + confirmation gate fix + Inspector accuracy + sidebar contractor pivot (4 PRs)

**Focus**: Started by verifying merged PR #25 (cumulative VD + service-entrance feeders). Verification spawned three follow-up PRs (#26, #28, #29). Mid-session, the platform owner also surfaced three Inspector accuracy issues during PE review which landed as PR #27. Total: 4 PRs, 3 merged today + 1 still open.

**Status**:
- ✅ **PR #25** verified — service-entrance label + cumulative VD on one-line + PDF + FeederManager. Migration `20260508_riser_service_entrance_and_cumulative_vd.sql` already applied to Supabase.
- ✅ **PR #26** MERGED 13:25 UTC — chatbot context + tools + system instructions teach the AI about VD+ semantics, NEC 215.2(A)(1) IN No. 2 / 210.19(A)(1) IN No. 4 thresholds (3% feeder / 5% combined), SE feeder convention, parallel sets. New `calculate_cumulative_voltage_drop` panel-keyed tool. `calculate_feeder_voltage_drop` augmented with cumulative + crossesTransformer + isServiceEntrance.
- ✅ **PR #27** MERGED 13:35 UTC — Inspector accuracy fixes (3 issues) + slot visibility on the panel header. Branch `fix/inspector-panel-cap-and-branch-conductor`. Details below.
- ✅ **PR #28** MERGED 14:07 UTC — restores chatbot write-tool functionality. Root cause traced to commit `3490c68` (PR #13, 2026-04-24 security/correctness audit) which added the `requiresConfirmation` server-side gate without shipping the matching UI. Five write tools (`add_circuit`, `add_panel`, `fill_panel_with_test_loads`, `empty_panel`, `fill_with_spares`) had been completely unreachable for ~2 weeks. Fix: `executeTool` gains `bypassConfirmation` option, `askNecAssistantWithTools` short-circuits on confirmation results without round-tripping Gemini, new `applyConfirmedAction` export, App.tsx renders Apply/Cancel inline.
- ✅ **PR #29** MERGED 2026-05-09 — sidebar contractor pivot. Dropped Site Visits + RFI Tracking from the Project Management section (engineer-flavored). Added three (beta) stubs based on validated market research (small electrical shops $1M-$10M): Estimating, Permits (absorbs the inspection/issues lifecycle), T&M Billing. **All three gated to Business + Enterprise** (commit `0c4a742` after initial review — restored Pro/Business pricing distinction; trial users get access automatically via `effectivePlan`). New `feature_interest` table captures one-line demand notes. Existing routes (`/issues`, `/rfis`, `/site-visits`) preserved server-side for direct-link compatibility.
- 🟡 **PR #30** open — Permits implementation plan handoff doc. 623-line self-contained markdown plan at `docs/plans/permits-implementation.md` for the next session's build of Permits Beta v1. Phase 1 only (MVP); Phases 2-4 referenced but deferred. Includes data model, file tree, status-transition state machine, expiration thresholds, validation schemas, test plan, file-by-file implementation order. Hand-off prompt: *"Implement the Permits feature per `docs/plans/permits-implementation.md`. Phase 1 only. Branch off main."*

**PR #27 Inspector fixes (detail)**:

1. **AI Inspector hard-coded panel cap at 42 poles**. `services/inspection/inspectorMode.ts:checkPanelMaxPoles` ignored each panel's `num_spaces`. A 24-space panel at 28 poles still passed inspection. Fix: read `panel.num_spaces` with same `panel.is_main ? 30 : 42` fallback used elsewhere; cite NEC 110.3(B) instead of the long-deleted NEC 408.36.
2. **Inspector flagged branch-circuit conductor sizing on placeholder data**. NEC 240.4(D) audit ran against `circuit.conductor_size` which is a defaulted `"12 AWG"` placeholder. Every 30A+ circuit got a false "12 AWG on 30A breaker" critical issue. Fix: deleted `checkConductorProtection` from the inspector. NEC 240.4(D) still correctly enforced inside `services/calculations/conductorSizing.ts` + `breakerSizing.ts` where real feeder data drives it.
3. **Breaker-vs-load check was receptacle-only and assumed 120V**. Lighting / EV / dryer / 2-pole 240V / 3-phase circuits got no audit. Fix: `checkCircuitLoading` runs on every circuit and derives capacity from pole count + panel voltage·phase (1P/1Φ=120V, 1P/3Φ=LtoL/√3, 2P=LtoL, 3P=LtoL×√3). Critical >100%, warning >80% per NEC 210.20(A).
4. **Slot cap was invisible until users bumped into it.** Added 5th "Slots" stat card to panel header (`<polesUsed> / <totalSlots>` with amber/red tone at >90% / >100%).
5. **Bulk Circuit Creator skipped slot cap.** Pre-create cap added using same multi-pole formula as manual-add path.

**Decisions made**:

- **Skip the second Gemini round-trip on the Apply path.** The original `askNecAssistantWithTools` flow always sent the tool result back to Gemini for paraphrasing. That's what amplified the #13 regression — Gemini paraphrased the gate's "I cannot..." message into a flat refusal, making the "Apply button missing" bug invisible. PR #28's `applyConfirmedAction` synthesizes the "Done — ..." follow-up locally from each tool's `data.message` field. Faster (one LLM call instead of two), cheaper, and the LLM can no longer refuse what the user just authorized.
- **Generic Apply card, not per-tool.** The plumbing inspects `result.data.requiresConfirmation` rather than switching on tool name. Any future write tool with `requiresConfirmation: true` automatically gets Apply/Cancel UI for free.
- **Two-PR split for the sidebar pivot.** This PR ships the sidebar reshuffle + 3 stub pages only; Phase 1 (follow-up PR) actually relocates the existing Inspection & Issues UI into the Permits page as a tab. Rationale: the merge work is sunk cost if no contractor clicks "Permits" in the first 2 weeks of beta. Phase 0 buys demand signal cheaply.
- **Sidebar names: short forms (`Estimating`, `Permits`, `T&M Billing`).** Sidebar is for navigation, not explanation. Page itself tells the longer story. User confirmed.
- **`feature_interest` table is its own thing**, not piggybacking on `support_tickets`. Append-only, RLS-scoped to row owner, no admin policy at the DB layer (server-side queries via Supabase Studio cover prioritization). CHECK constraint on `feature_name IN ('estimating', 'permits', 'tm_billing')` so unknown betas can't be silently inserted.
- **Engineer-flavored items removed from sidebar but routes kept alive.** No 404s on bookmarks. Drop them only — don't unbuild them yet — in case the persona analysis is wrong.

**Why the sidebar pivot now**: validated against external market research the user pulled — the top 3 unmet pain points for small electrical shops ($1M-$10M annual revenue) are estimating + job costing (CRITICAL), permit + inspection lifecycle (HIGH), and T&M billing (HIGH). Existing tools like IntelliBid, Trimble Accubid, Knowify, Jobber are either enterprise-priced, desktop-only, or shaped wrong for commercial T&M. SparkPlan can credibly enter at $99-$199/month with electrical-specific assemblies tied to its existing panel/circuit/feeder model — but only if the sidebar reflects contractor workflow, which it didn't.

**Insight worth carrying forward**: PR #13's break (write-tool confirmation gate without UI) is a textbook example of bundling unrelated security fixes — JWT log redaction, RLS-bypass via service role, Stripe price-ID hardening, and the chatbot gate all rode in one PR. The gate compiled, tests passed (the gate code was correct), and the missing UI counterpart slipped through review because attention was on the security items. **Lesson**: when a "security audit" PR introduces a new user-facing gate (confirmation, modal, banner, second-factor), the same PR must include the UI that satisfies it. The two halves are inseparable; CI cannot catch the gap.

**Key Files Touched**:

- PR #26: `services/ai/projectContextBuilder.ts`, `services/ai/chatTools.ts`, `services/geminiService.ts` (3 files, +193/-7)
- PR #28: `App.tsx`, `services/ai/chatTools.ts`, `services/geminiService.ts` (3 files, +156/-6)
- This PR: `components/Layout.tsx`, `App.tsx`, `components/BetaFeatureStub.tsx` (new), `components/EstimatingStub.tsx` (new), `components/PermitsStub.tsx` (new), `components/TmBillingStub.tsx` (new), `supabase/migrations/20260509_feature_interest.sql` (new)

**Pending / Follow-ups**:

- **Apply migration `20260509_feature_interest.sql` to Supabase** before the stub pages can record clicks. (Like PR #25's migration: code ships first, schema applied separately.)
- **Phase 1 (next session)**: relocate Inspection & Issues UI into Permits page as a `?tab=issues` tab. Redirect `/project/:id/issues` → `/project/:id/permits?tab=issues`. Delete the "until then, open Inspection & Issues directly →" forward-link from the Permits stub.
- **Track click-through and `feature_interest` insert rates per beta** for the next 2-3 weeks. Highest-signal feature gets prioritized for actual build work.

**PRs**:

- **#25** (merged 04:53 UTC) — riser SE label + cumulative VD on diagram/PDF/FeederManager
- **#26** (merged 13:25 UTC) — chatbot VD+ awareness + new cumulative tool
- **#27** (merged 13:35 UTC) — Inspector accuracy + slot visibility (5 fixes)
- **#28** (merged 14:07 UTC) — confirmation card UI restoration (broken since #13)
- **#29** (merged) — sidebar contractor pivot + 3 beta stubs + `feature_interest` migration + Business+ tier gating
- **#30** (open) — Permits implementation plan handoff doc (`docs/plans/permits-implementation.md`)

**Next phase**: Phase 3.6 — Permits Beta v1 build. Plan doc complete; awaits a fresh-context implementation session per the handoff prompt.

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

<!-- Earlier session 2026-05-06 / 2026-05-07 (Sprint 1 close-out / C4 omnibus) rotated out per "keep last 2 sessions" rule. Git history preserves the entry. -->
