# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-10

---

### Session: 2026-05-10 — Sprint 2A PR #31 (engineering content additions) shipped + post-merge docs sync

**Focus**: Continued the AHJ compliance audit Sprint 2A in a fresh worktree off `origin/main`, branched as `feat/sprint-2a-pr3-content`. Built and shipped the third themed PR of Sprint 2A — engineering content additions H14 + H9 (page only) + H15 + H10 + H11 — across 4 commits in `/home/augusto/projects/sparkplan-pr3`. Merged as PR #31 (`dacaab2`). Followed the merge with this docs-sync PR matching the precedent set by PR #24 (audit notes + ROADMAP + CHANGELOG + SESSION_LOG).

**Status**: ✅ PR #31 merged. 14 of the original ~16 Sprint 2A findings now ✅ RESOLVED on main. Test suite at 229/229 (was 213 post-PR-#23, +21 new PDF render tests across 4 new test files). Build clean. No DB migrations.

**Architecture decisions worth carrying forward**:

- **H9 split was deliberate.** The audit doc lists H9 as a single finding but the work has two physically separate landing zones: a new band-100 "Available Fault Current Calculation" page (PR #31), and AIC labels overlaid on the existing OneLineDiagram (deferred to PR 4). The latter touches the stable `OneLineDiagram.tsx` module — TWO SVG renderings (interactive ~line 2340 + print/export ~line 3290 per CLAUDE.md) — and pairs naturally with M6 (riser landscape mode for ≥10 panels). Adding labels in PR #31 without M6 would risk regressions on a stable module; bundling them into PR 4 is safer. Documented in the H9-row of the audit doc as the carryover.
- **Per-finding commits inside a themed PR.** Sprint 2A pattern is one themed PR per category boundary (Strategy C). PR #31 had 4 commits, one per finding (H14 / H9+H15 / H10 / H11), each with self-contained build + tests. This is finer-grained than per-PR-merge but coarser than per-line. Review velocity was high because each commit's diff was scoped to one finding's files.
- **Detection regex is now in 3 call sites.** PR #31 introduced `/\b(ev|evse|charger|charging|level\s*2|l2)\b/i` in `EquipmentSpecsDocuments.tsx` (H15), `permitPacketGenerator.tsx` (H11 builder), and `PermitPacketGenerator.tsx` UI (auto-disable predicate). Captured in memory as a DRY follow-up: extract to `isLikelyEVPanel(panel, circuits)` paired with the existing `isEVEMSManagedPanel` next time `upstreamLoadAggregation.ts` is touched. Three call sites is the threshold per the Sprint 1 diagnostic shortcut #3 ("when a calc is right at one layer but wrong at another, look for bypass / inline reimplementation").
- **Post-merge docs-sync PR is part of the convention.** PR #24 set the precedent (audit notes + ROADMAP + CHANGELOG + SESSION_LOG for PRs 1 + #23). PR #31 needed the same treatment. **Lesson**: at PR-merge time the orchestrator must explicitly check "are the four sibling docs synced?" and fire a docs-sync PR if not. Skipping leaves audit doc rows showing ❌ for findings that are actually shipped — and the next session that opens the doc gets confused about what's pending.

**Process gotchas worth remembering**:

- **`.env.local` is not copied into worktrees.** Tests at `services/api/pythonBackend.ts` / `services/ai/chatTools.ts` throw at module-load time when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are absent. Fix: invoke vitest with inline stub env vars: `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=test-stub-key npm test --run`. Don't copy real secrets into the worktree (auto mode classifier blocks that).
- **PR base verification.** Sprint 2A pattern #7 from prior memory: when GitHub UI creates a PR, verify base is `main` before review. PR #31 created cleanly off `main` but worth confirming on every new PR.
- **Concurrent main churn.** While PR #31 was open, three other PRs landed (#32 Permits, #33 Estimating, #34/#35 T&M Phase 1a/1b, plus a #36 docs rollout for v1b). Lessons: each themed PR must branch off latest `origin/main` after the previous merges (don't stack), and the docs-sync PR must `git fetch + rebase` right before push to absorb concurrent merges cleanly.

**Deliverables**:

| PR | Branch | Files | Result |
|---|---|---|---|
| **#31 (merged)** | `feat/sprint-2a-pr3-content` | 4 commits, 5 new PDF components, 4 new test files (~1.2k LOC) | ✅ MERGED `dacaab2` |
| **this PR (open)** | `docs/sprint-2a-pr3-sync` | audit + ROADMAP + CHANGELOG + SESSION_LOG | (this commit) |

**Worktrees in play at session end**:
- `/home/augusto/projects/sparkplan-pr3` on `feat/sprint-2a-pr3-content` (post-merge — can be removed)
- `/home/augusto/projects/sparkplan-docs-pr3` on `docs/sprint-2a-pr3-sync` (active)

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

<!-- Earlier sessions (2026-05-06/07 Sprint 1 close-out, 2026-05-08/09 Sprint 2A early phases, 2026-05-09 chatbot/inspector/sidebar pivot, 2026-05-09 morning Estimating + Permits agent details) rotated out per "keep last 2 sessions" rule. Git history preserves them. -->

