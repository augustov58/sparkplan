# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-16

---

### Session: 2026-05-16 — Sprint 2C M2 (AHJ coverage expansion + manifest reuse flexibility, PRs #70–#75 in-flight)

**Focus**: One-shot expansion from the post-2C-M1 audit. User asked whether the packet was flexible enough for contractors in unmodeled FL cities (Winter Park, Sanford, Cape Coral, Lake Mary, etc.) to reuse an existing AHJ's defaults without misrepresenting their actual AHJ on the cover sheet. Answered yes-but-with-3-gaps; user said "do both (a) Tier 1 manifest expansion and (b) close those gaps. Use parallel agents." Six PRs landed in-flight against main: PR #70 Orlando-populate (sequential, foreground), then 5 PRs from 5 parallel agents in worktree isolation — 4 Tier 1 manifests (City of Miami, Orange County unincorporated, City of St. Petersburg, Jacksonville/Duval) + 1 flexibility-gaps PR.

**Status**: 6 PRs open (#70 Orlando-populate, #71 Gaps, #72 Miami, #73 Orange, #74 St. Pete, #75 Jacksonville). None merged yet. Full test suite at 960/960 passing in local pre-merge verification (vs ~797 baseline). Build green. AHJ count when all 6 merge: 5 → 9 registered; FL metro population served: ~2.3M → ~3.5M directly.

**Architecture decisions worth carrying forward**:

- **Two-layer visibility model paid off.** Sprint 2B PR #51 designed the AHJ-aware visibility module with Layer 1 (manifest defaults) + Layer 2 (user overrides), and put `section_overrides.artifactTypes` on the schema even though there was no UI for it at the time. PR #71 Gap 2 only needed to add the UI — `applyUserOverrides` already consumed the artifact-types branch. Lesson: when you build a layered model, plumb the bottom layer even before the UI exists. Adding the UI later is one PR; adding the persistence shape later would have required a migration + a backward-compat retrofit.
- **Manifest-template reuse is a higher-leverage move than adding more manifests.** Adding 4 Tier 1 AHJs (#72–#75) directly covers ~1.2M additional FL population. PR #71's Gap 1 (`manifest_template_id` separation from `jurisdiction_id`) unblocks every OTHER unmodeled FL city in one dropdown click. Per the audit, that's the entire long tail — Winter Park / Sanford / Cape Coral / Lake Mary / Naples etc. — all served via "pick the nearest covered AHJ's defaults" rather than waiting for individual manifest research. The architecture made Gap 1 a ~½-day fix; the marginal cost of more manifests is ~1–2 days each. Always prefer the leverage move.
- **Pure-function manifests with named research artifacts scale to many AHJs.** Each agent followed the Pompano template (best exemplar at 22 reqs / 5 categories) and produced 4 deliverables: `data/ahj/<id>.ts` + `tests/<id>Manifest.test.ts` + `docs/ahj-source-checklists/<id>.md` + registry.ts addition. 4 agents in 4 parallel worktrees took ~11 minutes wall-clock and produced 9 files / ~3000 LOC / 172 new tests. The architecture's data-only contract (no engine changes per AHJ) is what made parallelization clean.

**Process gotchas worth remembering**:

- **Sequential merges of agent branches can leak orphan conflict markers past Git.** Resolving the 4 `registry.ts` conflicts during local sequential merges, one Edit's `old_string` captured the `=======/>>>>>>>` markers but not the corresponding `<<<<<<< HEAD` higher up. Git accepts commits containing literal `<<<<<<<` text once the file is `git add`-ed — it only blocks unmerged paths, not conflict-marker patterns. The orphan only surfaced at `npm run build` via esbuild's `Transform failed: Expected identifier but found "<<"`. Fixed forward with a 1-line cleanup commit. A pre-commit hook (`grep -E '^(<<<<<<<|=======|>>>>>>>)' --include='*.{ts,tsx,js,jsx}'`) would catch it next time — added to follow-ups.
- **Worktree CWD doesn't always survive Bash calls across an agent's session.** The gaps-closure agent's report mentioned it had to revert "accidental edits" to `/home/augusto/projects/sparkplan` (the main repo) after `cd` jumped it out of its worktree. Resulted in `tests/visibility.test.ts` being modified in the main repo working tree (NOT committed in the agent's branch), plus St. Pete files leaking from the St. Pete agent's worktree into the main repo as untracked files. All correctly preserved on the respective agent branches; the floating state in main was safely discarded with `git restore` + `rm`. **Lesson for future parallel-agent prompts: include "always use absolute paths or `git -C $WORKTREE_PATH` for git commands" explicitly.**
- **Agent confidence ratings are honest signal.** All 4 manifest agents reported MEDIUM confidence on EV-specific scope because none of the new AHJs publish dedicated EV checklists (verified by direct fetches). Each agent documented the specific phone-call follow-up that would close the gap. Trusting MEDIUM is better than asking for HIGH-or-nothing — the manifests work today; the phone-call closure is a Sprint 2C+ task.
- **Local merges can be "verification only" rather than "ship".** I merged all 5 agent branches into local main, ran full tests, then `git reset --hard origin/main` and opened 5 PRs targeting main. This preserves the PR-per-feature review workflow while letting me verify integration locally. Trade-off: each PR will re-hit the same `registry.ts` conflicts on merge (user resolves in GitHub UI). Worth it for the granular review surface; not worth it if the user wanted single-PR bulk merge.

**Deliverables**:

| PR | Branch | Files | Result |
|---|---|---|---|
| **#70** | `feat/orlando-manifest-requirements` | 4 files, +592 / -11 LOC, 28 new tests | ⏳ Open against main |
| **#71** | `feat/manifest-flexibility-gaps` | 4 files, +815 / -9 LOC, 19 new tests | ⏳ Open against main |
| **#72** | `feat/ahj-city-of-miami` | 4 files, +1092 / 0 LOC, 44 new tests | ⏳ Open against main |
| **#73** | `feat/ahj-orange-county` | 4 files, +1051 / 0 LOC, 33 new tests | ⏳ Open against main |
| **#74** | `feat/ahj-st-petersburg` | 4 files, ~+1200 LOC, 51 new tests | ⏳ Open against main |
| **#75** | `feat/ahj-jacksonville-duval` | 4 files, ~+1100 LOC, 44 new tests | ⏳ Open against main |

**Worktrees in play at session end**: 5 agent worktrees in `.claude/worktrees/agent-*` are still on disk (locked branches). Safe to `git worktree remove` after PRs merge.

**Pending / follow-ups**:

1. **Merge sequence**: PR #71 (Gaps) first — no `registry.ts` conflict. Then PRs #72/73/74/75 in any order — each hits a deterministic 2-line `registry.ts` conflict that resolves mechanically via GitHub's UI conflict editor (each adds 1 import + 1 entry to non-overlapping spots).
2. **Pre-commit hook for conflict markers**: small `grep -E '^(<<<<<<<|=======|>>>>>>>)' --include='*.{ts,tsx,js,jsx,md}'` in `.husky/pre-commit` (or `.git/hooks/pre-commit` if no husky) to catch the failure mode that bit this sprint.
3. **Beaches munis (Jax)** + **Pinellas surrounding munis (Clearwater, Largo, Dunedin)** — flagged in PR #75 / #74 research docs.
4. **Tier 2 AHJs**: Fort Lauderdale, Miami Beach, Coral Gables, Hialeah, Sanford / Seminole County, Naples / Cape Coral — per the audit's coverage matrix.
5. **Phone-call research closures** — each new manifest's research doc lists 1–5 short calls to close MEDIUM-confidence research gaps.

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

<!-- Earlier sessions (2026-05-13 Sprint 2B PR-4 Orlando manifest scaffold + AHJ-aware visibility, 2026-05-12 Sprint 2B PR-3 merge engine, 2026-05-10 Sprint 2A final 2 PRs, 2026-05-09 contractor-pivot + T&M Phase 1) rotated out per "keep last 2 sessions" rule. Git history preserves them. -->
