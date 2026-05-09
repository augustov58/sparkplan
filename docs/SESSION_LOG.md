# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-09

---

### Session: 2026-05-09 — Permits + Estimating + T&M Billing Phase 1 shipped via three parallel agents (PRs #32, #33, #34, #35)

**Focus**: Built and shipped Phase 1 of all three contractor-pivot betas concurrently. Three features, three plans (`docs/plans/{permits,estimating,tm-billing}-implementation.md`), three Sonnet 4.6 agents working in three independent git worktrees. Total: 4 PRs merged today (#32 Permits, #33 Estimating, #34 T&M Phase 1a, #35 T&M Phase 1b), 4 Supabase migrations applied, 5 net cascading conflict-resolution merges across the three sibling branches.

**Status**: ✅ All three features in main. All 4 migrations live in Supabase project `ioarszhzltpisxsxrsgl`. Test suite at 250 passing (was 95 baseline). Build clean (~4.9s consistently across all branches).

**Architecture decisions worth carrying forward**:

- **Parallel features that share *registries*; serial features that share *logic*.** The three Phase 1 plans had zero shared business logic but extensively shared "registry" files: `App.tsx` (route list), `lib/dataRefreshEvents.ts` (event-type union), `lib/validation-schemas.ts` (Zod schemas), `services/ai/projectContextBuilder.ts` (chatbot context params), and the doc files. Parallel agents produce *additive* conflicts in registry files (mechanical to resolve, ~30s per file), but they would produce *semantic* conflicts in shared logic (much harder). Three Phase 1s in parallel saved ~50 min wall-clock vs serial; conflict resolution added ~15 min total. Net win.
- **Worktree isolation pattern**: `git worktree add -b feat/<branch> /home/augusto/projects/sparkplan-<feature> origin/main`. Each worktree shares `.git` but has independent `node_modules` and working tree. Three Sonnet agents each in their own worktree = no contention, parallelizable npm install / build / test runs.
- **MCP-driven migrations** are a real productivity boost. Skipped the SQL-Editor copy-paste round-trip for all 4 migrations + the type regen. Auth flow is one OAuth click; afterwards `apply_migration` + `execute_sql` + `generate_typescript_types` are tool calls.

**Process gotchas worth remembering**:

- **Stacked-PR squash-merge can strand upstream code on main.** PR #35 (T&M Phase 1b) was stacked on `feat/tm-billing-beta-v1a`. After PR #34 squash-merged v1a → main, GitHub did NOT auto-retarget #35's base. Clicking Merge on #35 merged v1b INTO v1a (not into main). #35 showed `state: MERGED` even though its code never landed on main. **Fix**: caught it during a status check ("did you doc all this to update where we are?"). Opened a follow-up PR `feat/tm-billing-beta-v1a → main` to bring v1b's code over. **Prevention**: when stacking, either (a) merge the stacked PR FIRST while base is still its dependency branch, then merge the dependency PR which now contains both, or (b) after squash-merging the bottom PR, manually retarget the top PR's base via the GitHub UI before clicking Merge.
- **Three cascade rounds during merge.** After each PR landed, every still-in-flight PR had to absorb the new main state. Permits→main triggered cascades on Estimating + T&M v1a + T&M v1b. Estimating→main triggered another cascade on T&M v1a + v1b. T&M v1a→main triggered final cascade on v1b. Each round resolved in ~5 minutes because the conflicts were always the same shape: additive entries to the same registry files. The pattern was muscle memory by the third pass.
- **Doc rollout deferred ≠ doc rollout done.** The T&M agent's report flagged "doc updates deferred to PR-merge time." That guidance was followed by the *agent* but not by anyone afterwards. Phase 1a + 1b shipped with no CHANGELOG / ROADMAP / SESSION_LOG / database-architecture entries until this consolidating commit. **Lesson**: if an agent says "deferred to merge time," the orchestrator must take the baton at merge time. Better: have the agent ship the docs proactively in their original PR; reviewers see the doc updates as part of the change.

**Deliverables across the day**:

| PR | Branch | Files | Result |
|---|---|---|---|
| #32 | `feat/permits-beta-v1` | 28 | Tabbed PermitsPage (Overview / Permits / Inspections / Issues), `permits` + `permit_inspections` tables, status state machine, `/issues` redirects to `/permits?tab=issues`, IssuesLog migrated as Issues tab |
| #33 | `feat/estimating-beta-v1` | 32 | EstimatingPage (4 tabs), `estimates` + `estimate_line_items` tables, **auto-takeoff from project model** (the differentiator), bid PDF, clone-as-revision |
| #34 | `feat/tm-billing-beta-v1a` | 22 | BillingPage (4 tabs), `time_entries` + `material_entries` + `project_billing_settings` tables, hooks, billing math |
| #35 | `feat/tm-billing-beta-v1b` (stacked) | 19 | InvoicesTab + payments + invoice PDF + `generate_invoice_atomic` RPC + `sync_invoice_paid_totals` trigger |
| follow-up | `feat/tm-billing-beta-v1a → main` | (this commit) | Brings #35's code to main + consolidates T&M + cross-feature docs |

**Migrations applied via Supabase MCP** (in order):
1. `20260509193634_permits_and_inspections`
2. `20260509193720_estimates_and_line_items`
3. `20260509193801_tm_billing_phase1a`
4. `20260509193850_tm_billing_phase1b`

**Test counts** (cumulative):
- Baseline: 95
- After Permits agents: 130 (+35 status / expiration unit tests)
- After Estimating agent: 129 in own branch (+34 own; lower because no Permits tests)
- After T&M Phase 1a agent: 122 in own branch (+27 billingMath)
- After T&M Phase 1b agent: 160 in own branch (+38 status/generator/payments)
- Final on main after all merges: **250 passing** (one pre-existing test file fails at module-load due to missing `VITE_SUPABASE_URL` — present on main since before this session, untouched).

**Type regen**: `lib/database.types.ts` regenerated from live Supabase schema via MCP after migrations applied. Replaces hand-written types from each agent (which were field-equivalent but used a slightly older generic-helper structure than `supabase gen types typescript` emits).

**Pre-existing advisory surfaced (not addressed today)**: `public.jurisdictions` has RLS disabled. Read-only reference data; enabling RLS without policies would break existing reads. Fix when convenient: `ALTER TABLE public.jurisdictions ENABLE ROW LEVEL SECURITY;` + `CREATE POLICY "jurisdictions_read_all" ON public.jurisdictions FOR SELECT USING (true);`.

**Pending / follow-ups**:

1. **Manual smoke test all three features end-to-end**:
   - Permits: create → advance status (draft → submitted → in_review → approved) → schedule + fail inspection → reinspect.
   - Estimating: project with 2 panels + 1 transformer + 1 feeder → New estimate (auto-takeoff on) → edit line → submit → Generate PDF.
   - T&M Billing: log time + material → Generate invoice → mark sent → record partial payment → record full payment → confirm status flips to `paid` (exercises the trigger) → Download PDF.
2. **Watch beta usage signal** (`feature_interest` clicks + actual feature engagement) for 2-3 weeks before committing to Phase 2 of any of the three. Phase 2 priority should follow demand, not implementation order.
3. **Address `public.jurisdictions` RLS advisory** when convenient.
4. **Consider `.env.local.test` lane** to unblock integration tests across the three features. All three agents had to defer their integration tests because `lib/supabase.ts` throws at import without env vars and the project's `feedback_validation_advisory` memory rules out DB mocking. A dedicated test-env lane would unblock real CRUD test coverage.

**Worktrees still on disk** (kept for potential Phase 2 work; remove via `git worktree remove <path>` if not needed):
- `/home/augusto/projects/sparkplan-permits` on `feat/permits-beta-v1`
- `/home/augusto/projects/sparkplan-estimating` on `feat/estimating-beta-v1`
- `/home/augusto/projects/sparkplan-tm-billing` on `feat/tm-billing-beta-v1a` (now also contains v1b's content via the #35 merge)

---

### Session: 2026-05-09 (earlier) — Chatbot VD+ awareness + confirmation gate fix + Inspector accuracy + sidebar contractor pivot (4 PRs)

**Focus**: Started by verifying merged PR #25 (cumulative VD + service-entrance feeders). Verification spawned three follow-up PRs (#26, #28, #29). Mid-session, the platform owner also surfaced three Inspector accuracy issues during PE review which landed as PR #27. Total: 4 PRs, 3 merged today + 1 still open at session boundary.

**Status**:
- ✅ **PR #25** verified — service-entrance label + cumulative VD on one-line + PDF + FeederManager. Migration `20260508_riser_service_entrance_and_cumulative_vd.sql` already applied to Supabase.
- ✅ **PR #26** MERGED 13:25 UTC — chatbot context + tools + system instructions teach the AI about VD+ semantics, NEC 215.2(A)(1) IN No. 2 / 210.19(A)(1) IN No. 4 thresholds (3% feeder / 5% combined), SE feeder convention, parallel sets. New `calculate_cumulative_voltage_drop` panel-keyed tool. `calculate_feeder_voltage_drop` augmented with cumulative + crossesTransformer + isServiceEntrance.
- ✅ **PR #27** MERGED 13:35 UTC — Inspector accuracy fixes (3 issues) + slot visibility on the panel header. Branch `fix/inspector-panel-cap-and-branch-conductor`.
- ✅ **PR #28** MERGED 14:07 UTC — restores chatbot write-tool functionality. Root cause traced to commit `3490c68` (PR #13, 2026-04-24 security/correctness audit) which added the `requiresConfirmation` server-side gate without shipping the matching UI. Five write tools (`add_circuit`, `add_panel`, `fill_panel_with_test_loads`, `empty_panel`, `fill_with_spares`) had been completely unreachable for ~2 weeks. Fix: `executeTool` gains `bypassConfirmation` option, `askNecAssistantWithTools` short-circuits on confirmation results without round-tripping Gemini, new `applyConfirmedAction` export, App.tsx renders Apply/Cancel inline.
- ✅ **PR #29** MERGED 2026-05-09 — sidebar contractor pivot. Dropped Site Visits + RFI Tracking from the Project Management section (engineer-flavored). Added three (beta) stubs: Estimating, Permits, T&M Billing — all gated to Business + Enterprise tier (matches sibling PM features; trial users get access automatically via `effectivePlan`). New `feature_interest` table captures one-line demand notes.

**Why the sidebar pivot now**: validated against external market research the user pulled — the top 3 unmet pain points for small electrical shops ($1M-$10M annual revenue) are estimating + job costing (CRITICAL), permit + inspection lifecycle (HIGH), and T&M billing (HIGH). Existing tools like IntelliBid, Trimble Accubid, Knowify, Jobber are either enterprise-priced, desktop-only, or shaped wrong for commercial T&M. SparkPlan can credibly enter at $99-$199/month with electrical-specific assemblies tied to its existing panel/circuit/feeder model — but only if the sidebar reflects contractor workflow, which it didn't.

**Insight worth carrying forward**: PR #13's break (write-tool confirmation gate without UI) is a textbook example of bundling unrelated security fixes — JWT log redaction, RLS-bypass via service role, Stripe price-ID hardening, and the chatbot gate all rode in one PR. The gate compiled, tests passed (the gate code was correct), and the missing UI counterpart slipped through review because attention was on the security items. **Lesson**: when a "security audit" PR introduces a new user-facing gate (confirmation, modal, banner, second-factor), the same PR must include the UI that satisfies it. The two halves are inseparable; CI cannot catch the gap.

---

<!-- Earlier sessions (2026-05-06/07 Sprint 1 close-out, 2026-05-08/09 Sprint 2A, 2026-05-09 morning Estimating + Permits agent details) rotated out per "keep last 2 sessions" rule. Git history preserves them. The orchestrator-level entry above consolidates the agent-level Estimating + Permits sessions into a single multi-feature shipping day. -->
