# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-05

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

---

### Session: 2026-04-21 — Panel Photo Upload: OCR Refresh + `num_spaces` Overflow Fixes

**Focus**: Three sequential user bug reports, all converging on the panel photo upload surface:
1. Upload itself was failing with an opaque "Edge Function returned a non-2xx status code" error.
2. After fixing the upload, circuits extracted beyond the panel's slot count were silently orphaned in the database (42-circuit photo into a 30-space MDP wrote 12 invisible rows).
3. After exposing `num_spaces` in the UI, the user correctly asked whether the same overflow class of bug existed in the manual Add Circuit and AI chat `add_circuit` paths — it did.

**Status**: ✅ All three shipped in PR #12 (`ccbb55b`), merged to main. `npm run build` clean, 124/124 tests pass across three intermediate commits.

**Root causes:**
1. **OCR failure**: Google sunset `gemini-2.0-flash-exp` (the model the edge function was hardcoded to). Client-side `FunctionsHttpError` swallowed the real response body, masking the `{ error: "model not found" }` payload behind a generic wrapper.
2. **Silent orphans**: `is_main ? 30 : 42` slot-count inference was baked into 6 call sites in 4 files, and the `handlePhotoImport` handler wrote every extracted row to the DB with no bounds check. `maxCircuits={42}` was also hardcoded on the `<PanelPhotoImporter>` prop regardless of panel.
3. **Manual + AI overflow**: `isCircuitSlotAvailable` only checked occupancy, not bounds — a 2-pole at slot 41 on a 42-space panel reported "available" because slot 43 wasn't in the occupied set (it didn't exist). `chatTools.add_circuit` used a naive `maxCircuitNum + 1` with no occupancy scan and no num_spaces awareness.

**Work Done:**

*Commit 1 — `1081f02` fix(panel-ocr):*
- `supabase/functions/gemini-proxy/index.ts` v34: accepts optional `imageMimeType` on request body, falls back to `image/jpeg`. Model: `gemini-2.0-flash-exp` → `gemini-2.5-flash`. Deployed via MCP.
- `services/panelOcrService.ts`: passes `file.type || 'image/jpeg'` through to the edge function; reads `FunctionsHttpError.context.json()` to surface the real error body.
- `components/PanelPhotoImporter.tsx`: passes the File's MIME type as the 4th arg to `extractCircuitsFromPhoto`.

*Commit 2 — `70563d5` fix(panels) num_spaces refactor:*
- Migration `supabase/migrations/20260421_panels_num_spaces.sql`: `ADD COLUMN num_spaces integer` → backfill `is_main ? 30 : 42` → `NOT NULL DEFAULT 42` → `CHECK (num_spaces > 0 AND num_spaces <= 84)`. Applied to prod via MCP (`success: true`).
- `lib/database.types.ts`: added `num_spaces: number` to Row (required) + `num_spaces?: number` to Insert/Update.
- `components/OneLineDiagram.tsx`: new `<select>` dropdowns (12/20/24/30/42/54/66/84) in both the create form (~L2665) and the edit form (~L3220). `isMain` toggle auto-defaults to 30/42 but user can override. Wired through `editingPanel`/`newPanel` state, initial reset state, create payload, update payload, and `startEditPanel`. Replaced the legacy inference at line 1295 (available-slots computation).
- `components/PanelSchedule.tsx`: `totalSlots` derives from `num_spaces`. `maxCircuits={42}` on `<PanelPhotoImporter>` → `maxCircuits={totalSlots}`. `handlePhotoImport` rejects extracted rows whose footprint (`circuit_number + (pole-1)*2`) exceeds `totalSlots`, alerts user with count + skipped numbers.
- `services/pdfExport/PanelScheduleDocuments.tsx`: both `maxSlots` sites (L311, L515) now read `num_spaces` with fallback.
- `services/ai/projectContextBuilder.ts`: `PanelSummary` interface gains `numSpaces`; populated from `panel.num_spaces ?? (panel.is_main ? 30 : 42)`.
- `services/ai/chatTools.ts`: both inference sites (L1257, L1782) replaced via `replace_all`.

*Commit 3 — `67cd0c1` fix(panels): overflow guards:*
- `components/PanelSchedule.tsx`:
  - `isCircuitSlotAvailable`: rejects `slotNumber > totalSlots` (and `circuitNumber < 1`), not just occupancy.
  - `getNextAvailableCircuitNumber`: caps search at `totalSlots`, returns `null` instead of sentinel 101/102.
  - `startAddCircuit`: alerts and aborts if null.
  - `handlePoleChange`: clears `circuitNumber` if the new pole count doesn't fit on the current side.
  - `handleAddCircuit`: alerts and aborts if no slot fits.
- `services/ai/chatTools.ts` `add_circuit`: replaced naive `maxCircuitNum + 1` with the `canFitCircuit`/bounded-scan pattern from `fill_panel_with_test_loads`. Builds occupancy set with multi-pole expansion, scans 1..totalSlots, returns actionable error when full.

**Key Files Touched:**
- `supabase/functions/gemini-proxy/index.ts`, `supabase/migrations/20260421_panels_num_spaces.sql`
- `services/panelOcrService.ts`, `services/ai/chatTools.ts`, `services/ai/projectContextBuilder.ts`, `services/pdfExport/PanelScheduleDocuments.tsx`
- `components/OneLineDiagram.tsx`, `components/PanelSchedule.tsx`, `components/PanelPhotoImporter.tsx`
- `lib/database.types.ts`
- `docs/CHANGELOG.md`, `docs/database-architecture.md`, `docs/SESSION_LOG.md` (this entry)

**Commits (squashed into `ccbb55b` via PR #12):**
- `1081f02` — fix(panel-ocr): replace sunset gemini-2.0-flash-exp + surface real errors
- `70563d5` — fix(panels): add num_spaces column + eliminate 30/42 inference
- `67cd0c1` — fix(panels): bound-check manual + AI add-circuit against num_spaces

**PR:** #12 (merged, branch deleted).

**Pending / Follow-ups:**
- None known for this feature. The `num_spaces` field is now the single source of truth across the UI, DB, PDF export, AI tools, and photo importer.

