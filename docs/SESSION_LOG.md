# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-05

---

### Session: 2026-05-05 / 2026-05-06 — AHJ Compliance Audit C3 + B-1 + Panel-Phase (bundled)

**Focus**: Fourth session in the AHJ compliance audit Sprint 1. C1 (220.84 multi-family DF) and C2 (live-derive feeder load) were merged earlier; this session shipped the bundled C3 (project-metadata validation) + B-1 (chatTools.ts AI staleness) + a third bug (panel-schedule PDF phase column / balancing) spotted on 2026-05-06 while the user was reviewing the same packet — all three are consumer-side wiring fixes that didn't touch any calculation engine.

**Status**: ✅ All three shipped on branch `fix/c3-b1-bundle`, PR #17 OPEN. 164/164 tests pass (was 138 pre-bundle, +26 new). `npm run build` exits 0 in 4.61s. Pending user visual verification on Vercel preview before merging.

**Direction shift on 2026-05-06**: First C3 implementation hard-blocked PDF generation when fields were placeholder-shaped. User pushed back — contractors legitimately need draft packets with "TBD" for pre-application AHJ walk-ins. C3 was reworked into advisory-only (commit `b69a170`). Saved this preference to memory at `feedback_validation_advisory.md` so future sessions don't reintroduce hard-block validation. B-1 was unaffected.

**Panel-Phase bug spotted by user on 2026-05-06**: While reviewing the regenerated audit packet, user noticed every circuit on the Unit 108 Panel page (240V single-phase split-phase) showed "Phase A" and the load summary had Phase A = total / Phase B = 0 / Phase C = 0. Investigation showed the in-app `components/PanelSchedule.tsx` view was already correct (uses `getCircuitPhase` from `services/calculations/demandFactor.ts`, alternates A/B per row pair) but the PDF at `services/pdfExport/PanelScheduleDocuments.tsx` had reinvented its own broken inline phase logic at line 323/526 (always returned 'A' for single-phase) AND `calculatePhaseBalancing` for `panelPhase === 1` lumped all load to A. Same C1/C2 pattern: correct helper exists, PDF call site bypasses it. Fixed in commit `0c7ee2d`.

**Root causes (consumer-side wiring/validation, not engine bugs — same pattern as C1, C2)**:

- **C3**: `lib/validation-schemas.ts:projectSchema.address` only required `.min(1)`, so `"TBD"` (3 chars) passed. `components/PermitPacketGenerator.tsx:93` checked `contractorLicense.trim().length > 0` — accepting `"test"`. There was no schema for `permitNumber` at all. AHJ-rejection risk slipped past the existing form gates because they tested for emptiness, not validity.
- **B-1**: `services/ai/chatTools.ts:293` read `feeder.voltageDropPercent` (cached column on the `FeederSummary` exposed via `ProjectContext`). Same staleness pattern as the original C2 bug — the AI gave confident-but-wrong "Compliant. 0.00%" answers on EVSE feeders that were autopopulated before destination panel circuits existed. The `ProjectContext` summary is intentionally lossy (no `total_load_va`, `distance_ft`, etc.), so live-derive needed access to raw rows.

**Work Done**:

*C3 — `lib/validation-schemas.ts`*: Three new exported Zod schemas with a shared `PLACEHOLDER_VALUES` rejection list (`tbd`, `test`, `n/a`, `na`, `tba`, `todo`, `xxx`, `unknown`, case-insensitive):
- `projectAddressSchema` — `.min(8)`, must contain at least one digit (street # or ZIP), rejects placeholder strings
- `flContractorLicenseSchema` — `.regex(/^E[CR]\d{7}$/i)` (FL DBPR Certified or Registered), case-insensitive, rejects placeholders
- `permitNumberSchema` — optional + nullable; if present must be ≥ 4 chars and not a placeholder

The existing `projectSchema.address` now references `projectAddressSchema`.

*C3 — `components/PermitPacketGenerator.tsx`*: Replaced the trivial `hasLicense = contractorLicense.trim().length > 0` with `safeParse` against all three schemas. Added per-input red-border styling + inline error text (license + permit number). Updated `canGenerate` predicate. Added a re-validation pre-flight gate inside `handleGenerate` that short-circuits with a structured "would be rejected at AHJ intake" error before invoking `generatePermitPacket(...)`. The validation warning block now enumerates every failed field with its specific Zod message and points users back to Project Setup for the address (it isn't editable in the packet form).

*B-1 — `services/ai/chatTools.ts`*: Plumbed raw DB rows into `ToolContext` (new optional `rawPanels`, `rawCircuits`, `rawFeeders`, `rawTransformers` arrays). Rewrote the `calculate_feeder_voltage_drop` execute() handler (~70 lines) to:
1. Find the feeder summary by name/ID (existing `findFeeder` helper, unchanged).
2. Look up the corresponding raw `Feeder` row by ID in `context.rawFeeders`.
3. Call `computeFeederLoadVA(rawFeeder, rawPanels, rawCircuits, rawTransformers)` from `services/feeder/feederLoadSync.ts` — the exact same helper the C2 PDF fix uses.
4. Build a `FeederCalculationInput` (mirroring `services/pdfExport/VoltageDropDocuments.tsx:295-308`) and call `calculateFeederSizing(...)` from `services/calculations/feederSizing.ts`.
5. Return live values (`voltageDropPercent`, `compliant`, `conductorSize`, `designCurrentAmps`, `liveLoadVA`, `calculationSource: 'live'`, optional warnings).
6. Fall back to the cached summary value with `calculationSource: 'cached'` when raw rows aren't wired (legacy callers, transformer-destination feeders, or contexts where the user has no project loaded).

*B-1 — `services/geminiService.ts`*: Exported new interface `AgenticRawData { panels?, circuits?, feeders?, transformers? }`. `askNecAssistantWithTools` accepts an optional `rawData?: AgenticRawData` arg that threads into ToolContext.

*B-1 — `App.tsx`*: Single call site (line 511) updated to pass `{ panels, circuits, feeders, transformers }` from existing hook scope when `hasContext` is truthy. Fall-through to `undefined` keeps the AI in summary-only mode for unprojected sessions.

*Tests — `tests/calculations-extended.test.ts`*: 22 new tests:
- 21 schema acceptance/rejection cases for C3 (FL license format Cert/Reg/case-insensitive/placeholder/out-of-state/short-tail/empty; permit number undefined/empty/realistic/short/placeholder; address realistic/TBD/test/no-digits/short/empty)
- 3 AI tool tests for B-1 (live-derive proves cached `voltageDropPercent` is ignored when raw rows are wired; cached fallback when raw rows aren't provided; regression test that the pre-B-1 stale-cache behavior is reproducible — exactly the scenario where a user without a loaded project gets the "Compliant 0%" answer they used to get)

**Decisions made**:
- **Single free-text address field, not split (street/city/state/ZIP)** — DB schema change is invasive. The `.min(8)` + digit-required + placeholder-blocklist combination rejects realistic intake failures without a migration.
- **Reject FL-only license format at this pilot stage** — the strategic context is FL pilot per `business/STRATEGIC_ANALYSIS.md` rewrite. Non-FL contractors blocked from PDF gen until the license format check is parameterized by jurisdiction (deferred to post-pilot).
- **Plumb raw rows alongside lossy summary** for B-1 instead of enriching `ProjectContext` — keeps the AI prompt compact (the summary is intentionally lossy for token efficiency); raw rows ride alongside as an opt-in companion bag.
- **`calculationSource: 'live' | 'cached'` field on the tool result** — explicit so the AI can mention "based on your current project data" vs "from a cached calculation" if it wants to (also makes test assertions easier).

**Key Files Touched**:
- C3: `lib/validation-schemas.ts`, `components/PermitPacketGenerator.tsx`, `tests/calculations-extended.test.ts`
- B-1: `services/ai/chatTools.ts`, `services/geminiService.ts`, `App.tsx`, `tests/calculations-extended.test.ts`
- Docs: `docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md` (C3 + B-1 marked ✅ RESOLVED, Next Session Brief rewritten for C4), `docs/CHANGELOG.md` (new dated entry above the C1+C2 entry), `docs/SESSION_LOG.md` (this entry; rotated 2026-04-21 entry out per "keep last 2")

**Pending / Follow-ups**:
- Visual verification on Vercel preview — user should: (a) open project edit, set address to "TBD", then attempt to generate a permit packet → expect block with specific error; (b) open Spark Copilot on the 12-unit MF project, ask "is the MDP→EV Sub-Panel feeder voltage drop compliant?" → expect a real percentage matching the post-C2 PDF, not 0%.
- Audit findings still open: C4 (per-EVSE branch math + EVEMS feeder math — Next Session Brief now in audit doc), C5 (PE seal workflow), all H- and M-tier findings.
- C3 enhancement (post-pilot): parameterize `flContractorLicenseSchema` by jurisdiction so non-FL contractors aren't blocked. Currently fine — pilot is FL-only.

**PRs**:
- `fix/c3-b1-bundle` branch — pending push + PR open + Vercel preview verification.

---

### Session: 2026-05-04 / 2026-05-05 — AHJ Compliance Audit + C1 + C2 Permit Packet Fixes

**Focus**: Three sequential pieces of work, all driven by reviewing the SparkPlan permit-packet output against real Florida AHJ requirements:
1. Cleaned up `business/` folder — deleted superseded market-research / boilerplate / YouTube-research notes (13 files), rewrote `STRATEGIC_ANALYSIS.md` and `DISTRIBUTION_PLAYBOOK.md` from a "California / EV-mandate tailwind" framing to "Florida / permit-acceptance" wedge based on the Obsidian May 2026 Reconciliation Notes (Florida §366.94 preempts local EV ordinances; the FL pilot must justify on workflow value, not mandate).
2. Audited the example permit packet (`example_reports/Permit_Packet_Multifamily_Test_2026-05-05.pdf`, 27 pages) against five FL AHJ checklists (Orlando, Miami-Dade, Pompano Beach, Davie, Hillsborough). Net: would have failed first-pass review at all 5 — produced `docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md` with 5 Critical, 11 High, 8 Medium findings, organized into a 4-sprint fix sequence.
3. Fixed C1 (NEC 220.84 multi-family DF not applied to permit packet load-calc page) and C2 (EVSE feeder shown as 14 AWG / 0 A / "Compliant" because cached `feeder.total_load_va` was stale).

**Status**:
- ✅ Business cleanup + audit doc shipped on `docs/business-cleanup` branch (4 commits, merged inline).
- ✅ C1 shipped in PR #15 (`9c8941d`), merged to main, visually verified by user on Vercel preview.
- ✅ C2 shipped on branch `fix/c2-evse-feeder-aggregation` (2 commits, pushed). User verifying on Vercel preview at session end.
- 138/138 tests pass after C2 (was 123 pre-audit, +15 new). `npm run build` exits 0 in 4.64s.

**Root causes (key insight: both C1 and C2 are PDF-call-site wiring bugs, not calculation engine bugs)**:

- **C1**: `services/calculations/upstreamLoadAggregation.ts` already had a working NEC 220.84 multi-family branch (lines 638–694) that activated when called with a `multiFamilyContext` argument. The in-app MDP "Aggregated Load (NEC 220.40)" tile passed the context correctly (`PanelSchedule.tsx:290`), so it showed the right answer (242 kVA / 1,008 A). But the PDF call site at `services/pdfExport/PermitPacketDocuments.tsx:980` called `calculateAggregatedLoad` without the optional sixth argument — so the PDF fell through to the standard NEC 220 cascade where every `load_type='O'` circuit got dumped into the NEC 220.14 catch-all at 100% (498 kVA / 2,077 A on a 1,000 A service — telling the AHJ the design was *non-compliant* when it actually was).
- **C2**: The `feeders` table caches `total_load_va` at create time. Auto-population workflows (Multi-Family EV calculator, templates) create feeders before destination panel circuits exist, persisting `total_load_va = 0`. PDF read it verbatim at `VoltageDropDocuments.tsx:283-285`, fed 0 VA into `calculateFeederSizing`, which returned the smallest entry in the ampacity table (14 AWG, NEC 310.16) with vacuous-truth voltage drop (0 A × R × L = 0 V → "Compliant"). NEC 240.4(D) small-conductor enforcement at `services/calculations/conductorSizing.ts:342-365` was already correct — 14 AWG was the right answer for the wrong input.

**Work Done**:

*Commit b6db608 — `docs: business folder cleanup`:* Deleted 13 files (saas-growth-strategy, MARKET_INTELLIGENCE_FEB_2026, PERMIT_PACKET_MARKET_ANALYSIS, all 10 youtube-research notes). Net business/ tree: 9 files (down from 22).

*Commit 92c6c3b — `docs: rewrite strategic docs to FL-first multifamily-EV wedge`:* `STRATEGIC_ANALYSIS.md` and `DISTRIBUTION_PLAYBOOK.md` rewritten — California-first → Florida-first; corrected contractor count anchor (251,789 IBISWorld → 81,046 IEC 2025); ARR calibrated to $50K–$150K Y1 realistic; pricing flagged as Open Decision per Reconciliation Notes; FlashWorks added to competitor matrix; SPAN Kopperfield-incumbency caveat documented.

*Commit b7879d2 — `docs: AHJ compliance audit`:* New `docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md` with 5 Critical (C1–C5), 11 High (H1–H11), 8 Medium (M1–M8) findings + AHJ-by-AHJ requirement matrix + 4-sprint fix sequence + 10-step verification protocol for C1.

*Commits 47a1365 + 518e05f (PR #15) — C1 fix:* New pure helper `buildMultiFamilyContext(panel, panels, circuits, transformers, settings)` in `upstreamLoadAggregation.ts` — 4-condition gate (MDP, dwelling occupancy, multi_family type, ≥3 units). Both `PanelSchedule.tsx:102-138` (replaced 36-line inline gate) and `permitPacketGenerator.tsx` / `PermitPacketDocuments.tsx` now call the helper. NEC 220.84 table in `multiFamilyEV.ts:33-57` verified row-by-row against NEC 2023 Table 220.84(B) — all 23 rows match; no data changes.

*Commits 3bd6c08 + 518e05f (`fix/c2-evse-feeder-aggregation` branch) — C2 fix:* New helper `computeFeederLoadVA(feeder, panels, circuits, transformers)` in `services/feeder/feederLoadSync.ts` — live-derives `totalDemandVA` (post-NEC 220 cascade per NEC 215.2(A)(1)) from destination panel; falls back to cached for transformer feeders / orphaned panels. Wired into `VoltageDropDocuments.tsx` (renderer accepts optional `circuits` prop), `voltageDropPDF.tsx` (3 gating helpers + `exportVoltageDropReport` accept optional `panels/circuits/transformers`), `permitPacketGenerator.tsx` (passes `data.circuits`), `FeederManager.tsx` (4 gate calls + diagnostic + export handler thread the args). Cached `feeder.total_load_va` column intentionally preserved for the future PE seal snapshot workflow.

**Decisions made**:
- **Live-derive on read, not sync-and-persist** for C2 — write-on-read invites race conditions when two PDF previews run in parallel; live-derive is idempotent.
- **Keep cached column** vs. drop it entirely — needed for the future PE seal workflow (C5) where we'll snapshot the as-of-seal-time value.
- **Use `totalDemandVA`** (post-DF) not `totalConnectedVA` (raw) — NEC 215.2(A)(1) requires demand-load sizing.
- **Optional new args** on gating helpers — backwards-compatible signature change; legacy callers (test fixtures, AI tools) keep working at the cached behavior, opt-in to live-derive when they thread the args.

**Key Files Touched**:
- C1: `services/calculations/upstreamLoadAggregation.ts`, `components/PanelSchedule.tsx`, `services/pdfExport/PermitPacketDocuments.tsx`, `services/pdfExport/permitPacketGenerator.tsx`, `components/PermitPacketGenerator.tsx`, `tests/calculations-extended.test.ts`
- C2: `services/feeder/feederLoadSync.ts`, `services/pdfExport/VoltageDropDocuments.tsx`, `services/pdfExport/voltageDropPDF.tsx`, `services/pdfExport/permitPacketGenerator.tsx`, `components/FeederManager.tsx`, `tests/calculations-extended.test.ts`
- Docs: `docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md` (new), `docs/CHANGELOG.md`, `docs/SESSION_LOG.md` (this entry), `business/STRATEGIC_ANALYSIS.md` (rewritten), `business/DISTRIBUTION_PLAYBOOK.md` (rewritten)

**Pending / Follow-ups**:
- Visual verification of C2 on Vercel preview (in progress at session close).
- Per-feeder card display in `FeederManager.tsx:1317` still shows cached `feeder.design_load_va`. Intentional (Recalculate button UX), but flagged as a UX question if user prefers live-derive there too.
- `services/ai/chatTools.ts:293` reads `feeder.voltageDropPercent` directly when the AI answers "is feeder X compliant?" questions. Same staleness as the original C2 bug — AI can give wrong answers. Track as B-finding for follow-up after C5.
- Audit findings still open: C3 (project metadata validation — TBD/test placeholder fields), C4 (per-EVSE branch math + EVEMS feeder math), C5 (PE seal workflow), all of H1–H11 (cover sheet TOC, revision log, sheet ID convention E-###, FBC + NFPA-70 references, NOC placeholder, HOA letter, site plan, equipment cut sheets, AIC ratings via short-circuit study integration, EVEMS narrative, EVSE labeling page).
- F-followups (not blocking): F1 EV/house panel name-string-match → typed `panel_role` discriminator; F2 NEC 220.84 table extraction from inline → `data/nec/table-220-84.ts`; F3 legacy "Demand Factor Calculation" tile in MDP UI shows direct circuits — should be hidden on MDP for multi-family or relabeled.

**PRs**:
- #15 — C1 (merged `9c8941d`)
- C2 PR — pending on `fix/c2-evse-feeder-aggregation` (https://github.com/augustov58/sparkplan/pull/new/fix/c2-evse-feeder-aggregation)

