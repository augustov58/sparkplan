# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-09

---

### Session: 2026-05-09 — Estimating Beta v1 — Phase 1 implementation (branch `feat/estimating-beta-v1`)

**Focus**: Built Phase 1 of the Estimating beta per `docs/plans/estimating-implementation.md`. Replaces the demand-discovery `EstimatingStub` (PR #29) with a working estimating module. Branch off `main` at commit `74df3e1` plus the cherry-picked plan-doc commit `b7386fd`. Worktree at `/home/augusto/projects/sparkplan-estimating`.

**Status**:
- 🟡 Branch `feat/estimating-beta-v1` ready, build clean, 129 tests passing (was 95 at branch start). Migration not yet applied.
- 🟡 PR not opened — user opens it manually after applying the migration and smoke-testing.

**What shipped (7 commits)**:
1. Migration + types extension. `supabase/migrations/20260511_estimates_and_line_items.sql` creates `estimates` (header) + `estimate_line_items` (detail) with full RLS, indexes, realtime publication. `lib/database.types.ts` hand-extended.
2. Pure services. `services/estimating/estimateMath.ts` (subtotals + markup + tax), `estimateStatusTransitions.ts` (state machine: draft → submitted → accepted/rejected/expired/cancelled), `defaultPricing.ts` (Phase-1 starter price tables). 25 tests.
3. Auto-takeoff. `services/estimating/autoTakeoffFromProject.ts` walks panels (MDP first), transformers, feeders (phase + neutral + EGC + conduit + labor), and branch circuits (per-panel grouped + bundled labor). Snapshot semantics; the user re-runs from the takeoff tab to append. 9 tests.
4. Hooks. `hooks/useEstimates.ts` + `hooks/useEstimateLineItems.ts` follow the optimistic-update + Supabase realtime pattern from `usePanels.ts`. `bulkInsert` for auto-takeoff round-trip; `cloneAsRevision` + `cloneLineItemsForEstimate` for revisions.
5. Bid PDF. `services/estimating/estimatePdfGenerator.tsx` — 3-page Document (cover + detail + terms/signature) using `@react-pdf/renderer` with shared `permitPacketTheme` BrandBar/Footer.
6. UI components in `components/Estimating/`: `EstimatingPage`, `EstimatesListView`, `EstimateDetailView` (5-tab strip with `?tab=` URL persistence), `EstimateOverviewTab` (totals + customer + scope), `LineItemsTab` (used by Takeoff/Materials/Labor with optional category filter), `EstimateLineItemRow`, `BidOutputTab`, `EstimateStatusPill`. `App.tsx` swaps lazy import from `EstimatingStub` to `EstimatingPage`. Stub deleted.
7. AI context + docs. `services/ai/projectContextBuilder.ts` accepts an optional `estimates` array and surfaces count + most-recent in the formatted context (Phase 3 will expand). ROADMAP / CHANGELOG / SESSION_LOG updated.

**Decisions made**:
- **Tax applied to taxable basis BEFORE markup** (plan §5 decision 1). Markup is on subtotal; tax is on materials only; both add to total. Don't tax the markup itself.
- **Snapshot, not live binding** (plan §5 decision 4). Auto-takeoff at create time pulls a frozen snapshot of the project. Re-running from the takeoff tab APPENDS rather than reconciles.
- **Soft FK for line items** (plan §5 decision 9). `source_id` is a UUID with no DB-level FK constraint. If the user deletes a panel after the estimate exists, the estimate keeps the line items with an orphaned `source_id`. Acceptable; revisions are explicit.
- **Subtotal_other rolls up equipment + subcontract + other** in the DB. Phase 2 (per-category markup) will split them into dedicated columns. Saves 2 columns now at the cost of a small adapter in `totalsForPersistence`.
- **No `set_updated_at()` trigger** in the migration. The project doesn't ship that helper function — every existing migration just defaults `updated_at NOW()` and lets the app update it explicitly. Followed convention.
- **PDF stays client-side in Phase 1**. The `bid_pdf_url` column is in the schema for Phase 4; today the user clicks Download and the browser saves the blob. Avoided the storage-bucket + signed-URL plumbing that adds complexity for marginal Phase 1 value.

**Numbers**:
- Build: 4.87s clean. New `EstimatingPage` chunk 53.81 kB (gzip 13.71 kB).
- Tests: 95 → 129 (+34 new in `tests/estimating/`). Pre-existing 1-suite failure in `tests/calculations-extended.test.ts` is the missing-Supabase-env error from `lib/supabase.ts:13` (untouched by this work).

**Pending / follow-ups for the user**:
1. **Apply the migration** in Supabase SQL Editor: `supabase/migrations/20260511_estimates_and_line_items.sql`.
2. **Optionally regenerate `lib/database.types.ts` via Supabase CLI** to replace the hand-written rows. The hand-written types match the migration field-for-field but the CLI version may add extra metadata (e.g. timestamp string vs. Date).
3. **Smoke test** — create a project with 2 panels + 1 transformer + a feeder, click "New estimate" with auto-takeoff on, edit a line, change status to submitted, click Generate PDF in the Bid Output tab.
4. **Open the PR**. Suggested title: `feat(estimating): Phase 1 — auto-takeoff + bid PDF + 5-tab UI`. Base is `main`.

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

<!-- Earlier sessions (2026-05-06/07 Sprint 1 close-out, 2026-05-08/09 Sprint 2A) rotated out per "keep last 2 sessions" rule. Git history preserves them. -->
