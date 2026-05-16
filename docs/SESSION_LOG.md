# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-16

---

### Session: 2026-05-15 to 2026-05-16 — Docs cleanup, JurisdictionRequirements font hotfix, and NEC 220.83 follow-up (PRs #63, #64, #65)

**Focus**: Picked up mid-stream from a compacted prior session that had been mid-execution of the dwelling-load fixes. Three PRs landed: doc-debt cleanup (#63 `aa37d4b`), font crash hotfix on commercial packets (#64 `405c7b9`), and the 3-commit follow-up to PR #61's NEC 220.83 routing work (#65 in-flight, branch `feat/220-83-panel-summary-playwright-el101`). Mid-session discovered that PR #61 (also by the user) had shipped the core 220.83 routing in parallel — most of the original `feat/nec-220-83-existing-dwelling` branch's 17 commits were already on main via #61's squash, so PR #62 was closed and the genuinely-new 3 commits were cherry-picked onto a fresh branch as PR #65.

**Status**: 2 PRs merged (`#63` docs cleanup, `#64` font fix); 1 PR open (`#65` dwelling follow-up). Test suite at 748/748 on main; 769/769 on the #65 branch (21 new in-process PDF tests). Build green across all three branches.

**Architecture decisions worth carrying forward**:

- **Code-anchored docs decay slower than free-floating decisions.** PR #63 deleted the STRATEGIC_ANALYSIS "Pricing — Open Decision" section (which the doc's own staleness rule flagged for deletion once pricing was locked in) and replaced it with a "Current Pricing" table that cites `hooks/useSubscription.ts` as the source of truth. The replacement decays only when the code does — not on its own timeline. Lesson: when a doc captures a decision, point at the code that implements the decision (or the artifact that proves it) so the doc's freshness is tied to a falsifiable thing, not to a calendar reminder.
- **React-PDF style inheritance can compose unresolvable font tuples.** The JurisdictionRequirements crash (#64) came from `<Text style={itemLocation}>` (italic) nested inside `<Text style={itemTextFail}>` (Helvetica-Bold). React-pdf cascades fontFamily through nested Text, so the resolved style on the inner Text became `{ fontFamily: 'Helvetica-Bold', fontStyle: 'italic' }` — which has no registered variant (react-pdf treats `Helvetica-Bold` as a literal family with only normal weight; italic-bold has to come from `fontFamily: 'Helvetica' + fontWeight: 'bold' + fontStyle: 'italic'`). Fix is to *break* the inheritance on the child by explicitly setting fontFamily back to base Helvetica. Memory-worthy: **never use `fontFamily: 'Helvetica-Bold'` as a literal family in nested Text trees** — always use `fontWeight: 'bold'` so the variant resolver can compose with italic if the child needs it.
- **`git cherry` lies when upstream squash-merged.** Trying to figure out whether PR #62's 17 commits were redundant with PR #61, the obvious tool was `git cherry origin/main feat/nec-220-83-existing-dwelling` — which reported all 17 commits as unmerged. The actual truth: 14 of them were already on main, just rolled into #61's squash. `git cherry` compares by patch-id, and a squash collapses N patch-ids into 1 with a different hash, so the individual-commit lookup always misses. The reliable test is **cherry-pick each commit onto a fresh main snapshot in a temp branch** and watch whether it produces an empty diff (already on main), a non-empty diff (genuinely new), or a conflict (overlap with #61's different implementation). Even for "CONFLICT" results, grepping main for the specific identifiers the commit introduced is the gold standard — every CONFLICT identifier from PR #62's tail commits was present on main, confirming #61's squash absorbed all of it.
- **Parallel PRs converging on the same feature is fine — but resolving the convergence requires content-level diffing, not branch-level.** The instinct to "rebase the conflicted branch" would have replayed 14 already-shipped commits and forced 8 conflict resolutions to recover work that was already on main. Correct move: close #62, cherry-pick only the 3 genuinely-new commits into a clean branch. Resulting PR #65 is 3 commits / 13 files / +861 LOC instead of the rebased 17 commits / 26 files / +2676 LOC, with zero conflicts to resolve.

**Process gotchas worth remembering**:

- **Compacted sessions can drop mid-execution.** The session started with a system summary that established prior context (220.83 work mid-stream, EL-101 PDF bug, Playwright scaffold staged). The first action was a continuation message, but the actual state on disk was 5 commits ahead of main + 3 ahead of origin/feature-branch — work that had been committed but not pushed. Lesson: when resuming a compacted session, `git status` + `git log --oneline -n 10` + `git branch -vv` are the first three commands. They reconcile what the summary claims with what's actually on disk.
- **Multi-branch work needs to fall off one at a time.** Three branches were active simultaneously this session: `feat/nec-220-83-existing-dwelling` (the WIP), `docs/cleanup-2026-05-15` (the audit fixes), and `fix/jurisdiction-pdf-font-crash` (the hotfix). All three pushed clean PRs to GitHub in one batch. The key was branching each new piece **off origin/main** rather than off the feature branch, so the docs and font fixes could merge independently without waiting on the 220.83 work. Memory-worthy: when a session generates >1 PR's worth of work, branching strategy matters more than implementation speed.
- **gh CLI's "uncommitted changes" warning is mostly noise on this repo.** Every `gh pr create` call surfaced "Warning: 8 uncommitted changes" — those are the untracked PDFs in `example_reports/`, the `.playwright-mcp/` cache, and the `.claude/` lock files. All correctly gitignored from feature work; just not relevant to the PR. Safe to ignore; should not be confused with actual unsaved staging.

**Deliverables**:

| PR | Branch | Files | Result |
|---|---|---|---|
| **#63 (merged)** | `docs/cleanup-2026-05-15` | 15 files, +25 / -29 LOC (5 archives + 1 deletion + 9 content edits) | ✅ MERGED `aa37d4b` 2026-05-15 |
| **#64 (merged)** | `fix/jurisdiction-pdf-font-crash` | 1 file, +4 LOC | ✅ MERGED `405c7b9` 2026-05-15 |
| **#65 (open)** | `feat/220-83-panel-summary-playwright-el101` | 13 files, +861 / -23 LOC (3 cherry-picked commits: panel-summary alignment + Playwright + EL-101 PDF gate) | ⏳ Open against main |
| **#62 (closed)** | `feat/nec-220-83-existing-dwelling` | 26 files, +2676 / -139 LOC | Closed as superseded by #61 + #65 |

**Worktrees in play at session end**: none on disk (all branches are plain `git checkout -b`); the worktree directories listed in `.claude/worktrees/` are from prior sessions, untracked.

**Pending / follow-ups (queue from doc audit)**:

1. **Task A — Backfill ROADMAP / CHANGELOG / SESSION_LOG for PRs #52-#60**: ✅ **This commit** (and the new ROADMAP Phase 3.10 / 3.11 entries + CHANGELOG entries for PRs #52, #53, #54, #56, #57, #58, #59, #60, #61, #63, #64, #65).
2. **Task B — Update STRATEGIC_ANALYSIS feature inventory**: pending. Inventory still silent on AHJ manifests (PR #51 + #54 + #56), permit-merge engine (PR #49), NEC 220.83 retrofit (PR #61), H17 contractor-exemption screening (PR #41), PE-as-service positioning, T&M Billing / Estimating / Permits Phase 1 (PRs #33-#36).
3. **Task C — Update DISTRIBUTION_PLAYBOOK demo flow**: pending. Demo flow doesn't reference the uploads UI (PR #47), AHJ manifest pre-fill (PR #51 + #56), or the PE-as-service paid upsell positioning.
4. **Tasks D + E + F + G — additional archival sweeps**: pending. Archive completed-plan docs in `/docs` (8 candidates), archive stale CA-era marketing assets, refresh "Last Updated" on `architecture.md` / `development-guide.md` / `security.md`, consolidate `docs/implementation-notes/` into archive.
5. **JurisdictionRequirements design follow-up** (not on the queue): commercial vs residential fixture diversity in E2E tests would have caught #64 earlier. The smoke test fixture was a single-family residential happy path with zero fail-severity rows — exactly the path the bug hid on. Adding a commercial fixture to the Playwright suite is the highest-leverage addition.

---

### Session: 2026-05-13 — Sprint 2B PR-4 (Orlando manifest + AHJ-aware visibility) shipped via single-agent run

**Focus**: Closed Sprint 2B. Built and shipped PR #51 over 8 commits / ~2,066 LOC against `feat/sprint2b-orlando-manifest`, merged at squash hash `18985e5` 2026-05-13. Adds the first-ever AHJ manifest (`data/ahj/orlando.ts`), the AHJManifest type system with a 4-axis `AHJContext`, a two-layer visibility model (manifest defaults + user overrides), an AHJ registry with case-insensitive lookup, the orchestrator plumbing to consume an optional manifest, and 6 new `artifact_type` enum values reserved for Sprint 2C AHJs. Sprint 2B is now complete at 4/4 PRs (PR #45 foundation + PR #47 upload UI + PR #49 merge engine + PR #51 manifest scaffold).

**Status**: ✅ PR #51 merged. Sprint 2B: ✅ COMPLETE. Test suite at 572 passing across 37 test files (was 522 post-PR-#49; +50 new tests across 2 new test files: `tests/visibility.test.ts` (22) + `tests/orlandoManifestE2E.test.ts` (28)). 1 DB migration applied to live Supabase (`20260514_attachment_types_pr4.sql` — extends `artifact_type` CHECK from 8 to 14 values). Build green.

**Architecture decisions worth carrying forward**:

- **Bake the manifest's hardest axes into the type system on day 1, not on day N.** PR-4's `AHJContext` declares all 4 cross-AHJ discriminators (`scope`, `lane`, `buildingType`, `subjurisdiction`) even though Orlando uses only 2 of them (`scope` + `buildingType`). The temptation was to ship Orlando first and add `buildingType` / `subjurisdiction` when Miami-Dade / Pompano / Davie / Hillsborough land in Sprint 2C M1. Wrong call — that would force a retrofit across 5 manifests + their predicate functions. Cost of adding the field upfront: ~10 LOC + one comment per field explaining when it's used. Cost of retrofitting: rewriting every predicate. Lesson: when you can predict the axes of variation from research that already landed (Sprint 2C parallel-research PRs #46 + #48), declare them all on the day-1 interface even if today's only consumer uses a subset.
- **Two-layer visibility (manifest defaults + user overrides) is the right shape for cross-AHJ work.** Sprint 2A's `DEFAULT_SECTIONS = { panelSchedule: true, ... }` assumed every project of every AHJ has the same defaults. That's wrong as soon as you have >1 AHJ. The two-layer model gets 90% right automatically (manifest declares what the AHJ wants by default; predicates refine per-project context) while letting the contractor override the last 10% (project-specific reality, e.g., "Davie commercial usually wants Knox-box but this 80A project doesn't have a switchboard"). Pattern memory-worthy for any future "system has opinionated defaults + power-user overrides" problem.
- **Predicates over enums for conditional relevance.** Orlando's NEC 220.87 narrative is relevant on existing-service path / irrelevant on new-service path. Available Fault Current calc is the opposite. The temptation is to enumerate ('existing-service-only', 'new-service-only', 'always', 'never'). Predicates win: pure `(ctx: AHJContext) => boolean`, composable with future axes (`ctx.scope === 'existing-service' && ctx.lane === 'pe_required'` falls out naturally), and they survive new context axes without enum migration. The manifest's `sectionPredicates` + `artifactTypePredicates` maps are the abstraction surface — Sprint 2C M1's per-AHJ manifests just add more predicate keys.
- **Reserve enum values in advance when downstream PRs need them.** PR #51 added 6 `artifact_type` values that Orlando's manifest doesn't surface (zoning_application, fire_review_application, notarized_addendum, property_ownership_search, flood_elevation_certificate, private_provider_documentation). Why? Sprint 2C M1's Pompano / Miami-Dade / Davie / Hillsborough manifests need them. Splitting the migration across 4 PRs would cost 4 migrations + 4 testing windows; bundling them with PR-4 costs 1 migration. The Orlando manifest just doesn't list any of them in `relevantArtifactTypes` — they're enum-valid but visibility-OFF. Lesson: when the next sprint's research is already done (and `data/ahj/orlando.ts` references the H21/H22/H25/H26/H30/H33 findings in comments), pre-allocate the schema values during the current PR.
- **Backward-compat via fallback chains, not feature flags.** Resolution logic in the orchestrator: `generalNotes = data.generalNotes ?? manifest?.generalNotes ?? Sprint2A_baseline`. Same shape for `codeReferences` and `necEdition`. No feature flag, no toggle, no opt-in — projects without a `jurisdiction_id` (or with one not in the registry) get exactly the Sprint 2A behavior they had pre-PR-#51. Lesson: when adding new defaults, prefer null-coalescing fallback chains over feature flags — the new path naturally degrades to the old path when its inputs aren't present.

**Process gotchas worth remembering**:

- **Manifest-as-pure-data continues to pay off.** `data/ahj/orlando.ts` is 208 LOC of literal data + predicate functions. No DB calls, no React, no side effects, no imports beyond `./types`. Tested via 28 E2E assertions against the visibility-math output. When a sprint produces pure-data artifacts, the test surface collapses (no async, no mocks, no setup teardown) and the next-sprint's review burden collapses with it. Sprint 2C M1 reviews will be N more `data/ahj/{ahj}.ts` files + an engine — both reviewable on the same shape.
- **8 commits in one PR is the right size.** PR #51 reviewed cleanly: 1 commit per architectural surface (types → manifest → registry → visibility math → orchestrator integration → UI plumbing → E2E tests + 1 supporting commit). Compare to PR #49's 17-commit iterative v1 → v5 cycle (which was the right call given the design-by-review nature of title-block UX). When a sprint is "implement against an already-decided spec," lean toward fewer-but-cohesive commits; when it's "iterate to discover the shape," lean toward more-but-finer-grained commits.
- **Docs-sync convention extends to Sprint 2B closure.** Same pattern as PR #50 (post-PR #49) and PR #42 (post-Sprint 2A PRs #40 + #41). Docs-only PR off main after the feature PR merges. This session's docs-sync PR follows the precedent.

**Deliverables**:

| PR | Branch | Files | Result |
|---|---|---|---|
| **#51 (merged)** | `feat/sprint2b-orlando-manifest` | 13 files, 8 commits, ~2,066 LOC (5 new `data/ahj/` modules + 2 new test files + 1 migration + 4 modified files including orchestrator) | ✅ MERGED `18985e5` 2026-05-13 |
| **this PR (local)** | `feat/sprint2b-orlando-manifest` worktree (docs-sync) | parent audit + sprint2b + README + ROADMAP + CHANGELOG + SESSION_LOG + database-architecture + CLAUDE.md | (this commit set) |

**Worktrees in play at session end**: `worktree-agent-a2bc0abf949ed1035` (this docs-sync worktree, part of a 7-agent parallel orchestration for PR #51).

**Pending / follow-ups**:

1. **Sprint 2C M1 — per-AHJ manifest engine** — declare Pompano → Miami-Dade → Davie → Hillsborough manifests against the same `AHJManifest` shape. Populate their `requirements: AHJRequirement[]` arrays. Build the engine that walks `requirements[]` and emits a per-project conformance checklist. All schema work is done; Sprint 2C is now a pure-data + engine exercise.
2. **F8: Enable RLS on `public.jurisdictions`** — one-line migration before Sprint 2C M1 populates the table. Supabase advisor flagged 2026-05-12; still open.
3. **Sprint 3 unblocked** — `pdf-lib` PAdES integration shape established by Sprint 2B PR #49; H17 lane logic (Sprint 2A PR #41) gates the PE-seal upsell offering; manifest's `lane: 'pe_required'` predicate flows naturally into seal-required determination. Cert vendor selection + FBPE business-entity registration remain as hard prerequisites.
4. **Sheet-ID prefix plumbing (H20 Miami-Dade `EL-`)** — `AHJManifest.sheetIdPrefix` is declared but the orchestrator still uses the Sprint 2B PR-3 discipline-letter system. Wire `manifest.sheetIdPrefix` into the band allocator when Miami-Dade's manifest lands in Sprint 2C M1.

---

<!-- Earlier sessions (2026-05-12 Sprint 2B PR-3 merge engine, 2026-05-10 Sprint 2A final 2 PRs, 2026-05-09 contractor-pivot + T&M Phase 1, 2026-05-10 Sprint 2A PR #31) rotated out per "keep last 2 sessions" rule. Git history preserves them. -->
