# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-10

---

### Session: 2026-05-10 — Sprint 2A final 2 PRs (PR #40 diagrams + PR #41 H17) shipped via 3 parallel worktree agents

**Focus**: Closed Sprint 2A's last 4 open findings (M6 + H9 AIC overlay + M3 in PR #40; H17 + settings JSON in PR #41). Three worktree-isolated agents working concurrently from `main @ cbd132a`, then code-reviewer + security-reviewer in parallel on the combined diff, then 2 themed PRs opened. Sprint 2A is now ✅ COMPLETE at 19/19 findings across 5 themed PRs.

**Status**: ✅ PR #40 + PR #41 open for review. Test suite at 413/413 on the combined branch (was 363 baseline at session start; +50 across the 3 agents + 7 reviewer-fix regression tests). Build green throughout. No DB migrations.

**Architecture decisions worth carrying forward**:

- **Worktree-isolated parallel agents safely co-edit a file** when their human-given scope assigns them to non-overlapping sections of it. PR #40 + PR #41 used 3 agents in worktrees; the 2 files with multi-agent edits (`PermitPacketDocuments.tsx` for Agent 1's RiserDiagram + Agent 3's CoverPage permitMode prop, `permitPacketGenerator.tsx` for Agent 2's grounding-section render + Agent 3's permitMode plumbing) auto-merged because each agent worked in distinct components/sections of the file. Git's "ort" merge strategy (default since 2.34) does smart hunk-level matching that handles this gracefully. Lesson: when fan-out parallelism is needed and shared files are inevitable, brief each agent on the specific *section* they own, not just the file.
- **Spec line numbers decay; diagnostic shortcuts don't.** CLAUDE.md and the audit doc claimed `OneLineDiagram.tsx` had two SVG renderings at lines 2340 and 3290. Investigating during PR #40, those line numbers pointed at internal bus-bar geometry and an HTML `<select>`. Agent 1 correctly diagnosed via Sprint 1's diagnostic shortcut ("in-app correct vs PDF wrong → look at the PDF call site") that the actual permit-packet riser is in `services/pdfExport/PermitPacketDocuments.tsx::RiserDiagram` (~L1150). Lesson: when a CLAUDE.md instruction is invoked, do a one-line sanity check (does line X match the description?) before trusting it. Docs fix landed in the docs-sync PR.
- **Fail-safe defaults are part of the calc-service contract for compliance logic.** CLAUDE.md's calc-service rule says "never throw, return warnings" — that handles the success path. PR #41's H2 + M1 reviewer findings showed that compliance functions (e.g., H17 lane screening) need to extend this to the failure path: malformed input gets a *safe-direction* default (fail-safe to pe-required, not silently exempt). Wrong direction creates regulatory risk; right direction errs toward over-requiring engineering review. Memory-worthy pattern for Sprint 3 PE seal logic and Sprint 2C AHJ overrides.
- **Test-count arithmetic is a clean audit trail.** Combined branch: 363 baseline + 4 Agent 1 + 27 Agent 2 + 12 Agent 3 + 7 reviewer-fix regressions = 413. Every number ties to a specific finding. When the math doesn't add up, that signals a missing test or a regression silently swallowed. Worth running `git diff main..HEAD -- 'tests/**'` to validate at PR-time.

**Process gotchas worth remembering**:

- **Worktrees lack `.env.local`.** Agents 2 and 3 reported 250-test baselines in their worktrees vs the main-checkout 363 baseline. Cause: worktrees share the bare git directory but not the working-dir `.env.local` symlink, so Supabase-env-gated test files fail at import time and get excluded. Not a regression; the missing tests are present on main with proper env. When reconvening branches in the main checkout, expect the full test count. Lesson: don't trust worktree test counts as absolute — diff them to detect regressions but compare to a same-environment baseline when reporting "X/X passing."
- **PRs need explicit conflict pre-validation when fanned out.** Before opening PR #40 I built a scratch `review/sprint2a-combined` branch merging all 3 agent branches to detect conflicts before reviewers saw the diff. Zero conflicts — but if there had been any, catching them pre-review would have been much cheaper than asking reviewers to re-run on a fixed combined branch. Lesson: always materialize the actual PR diff before review fan-out, not just review per-agent branches.
- **Reviewer findings escalate based on direction-of-failure, not just rule violation.** Security-review and code-review both flagged M1 (NaN/negative inputs route to exempt). What made M1 high-priority wasn't that it failed — it's that it failed in the **wrong direction** for a compliance flag. Same-shape bug in a non-compliance context might be a defer-to-cleanup-PR. Lesson when triaging reviewer findings: check the *direction* of failure, not just the existence of failure.

**Deliverables**:

| PR | Branch | Files | Result |
|---|---|---|---|
| **#40 (open)** | `fix/sprint2a-pr4-diagrams` (Agents 1 + 2 + H1 + M3 fixes) | 14 changed, +1886 / -201 | M6 + H9 overlay + M3 grounding |
| **#41 (open)** | `fix/sprint2a-pr5-h17-schema` (Agent 3 + H2 + M1 fixes) | 7 changed, +782 / -2 | H17 screening + settings JSON |
| **this PR (open)** | `docs/sprint2a-pr4-pr5-sync` | audit + sprint2a + README + CHANGELOG + SESSION_LOG + CLAUDE.md | (this commit) |

**Worktrees in play at session end**: none (3 agent worktrees auto-removed after their branches merged into the review scratch branch). Standard worktrees from other features still on disk.

**Pending / follow-ups**:

1. **Merge PR #40 + PR #41** (separate review surfaces; can merge in either order — they have no cross-dependencies).
2. **Pre-existing `(panel as any).aic_rating` cast at `components/OneLineDiagram.tsx:1136`** — left in place during PR #40's H1 fix (outside its scope). Clean up in a separate refactor PR or next time the file is touched.
3. **Sprint 2C is now unblocked** — H17 lane logic + settings JSON + AHJ-name placeholder are all in place. Sprint 2C wires per-AHJ manifests into `ahjOverride` and replaces the AHJ placeholder. M2/M3 (security) deferred items (enum whitelist on read, scope_flags runtime coercion) belong in Sprint 2C when those code paths get wired in.
4. **Pre-existing 480V `(panel as any)` casts** can be cleaned up generically next time the panel-data load path is touched.

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

<!-- Earlier sessions (2026-05-06/07 Sprint 1 close-out, 2026-05-08/09 Sprint 2A early phases, 2026-05-09 Permits + Estimating + T&M Phase 1 parallel-agent session) rotated out per "keep last 2 sessions" rule. Git history preserves them. -->

