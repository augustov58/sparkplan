# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-12

---

### Session: 2026-05-12 — Sprint 2B PR-3 (merge engine) shipped via 5-round iterative review cycle

**Focus**: Closed the merge-engine half of Sprint 2B. Built and shipped PR #49 over 17 commits / 5,580 LOC against `feat/sprint2b-merge-engine`, merged at squash hash `fce6275` 2026-05-12. Bundled with the PR #45 (foundation, merged 2026-05-11) and PR #47 (upload UI, merged 2026-05-11) work that landed earlier in the week, Sprint 2B's merge-engine deliverable is now complete; PR-4 (Orlando manifest scaffold) and Sprint 2C M1 wiring remain.

**Status**: ✅ PR #49 merged. Sprint 2B: 3 of 4 planned PRs shipped (PR #45 + PR #47 + PR #49). Test suite at 522 passing across 35 test files (was 491 post-PR-2; +31 new tests across 4 new test files: `attachmentTitleSheet`, `attachmentTitleBlock`, `compositeTitleBlock`, `stampSheetIds`, `mergePacket`). 5 DB migrations applied to live Supabase. Build green.

**Architecture decisions worth carrying forward**:

- **Pure pdf-lib functions follow the same contract as calc services.** CLAUDE.md's calc-service rule ("pure functions / never throw / return warnings") extends cleanly to PDF post-processing. `mergePacket`, `stampSheetIds`, and `compositeTitleBlock` are all bytes-in / bytes-out, hold no Supabase imports, take no hooks, and return warnings instead of throwing. This makes them testable without a browser/Supabase context AND lets Sprint 3 PAdES signing reuse the same wiring shape. Lesson: when a service is going to be reused by a future sprint, write it pure from day one — refactoring around side effects is more expensive than getting the shape right up front.
- **The merge engine never blocks the merge when individual attachments fail.** Encrypted / corrupted / zero-byte / zero-page uploads surface as warnings but the merge proceeds with everything that succeeded. Wrong-direction failure here would be "block the entire packet because one cut sheet was corrupted" — that creates a hostage situation where the contractor can't submit at all. Right-direction: skip the bad upload, emit a warning, let the contractor see what failed and re-upload. Memory-worthy pattern for any future "compose N artifacts" pipeline (Sprint 3 multi-sheet PE seal will hit the same shape).
- **Cover-mode evolution: boolean → 3-state enum, same day.** PR #49 v3 shipped `include_sparkplan_cover` (boolean: cover or no cover). v4 review caught the gap — a Bluebeam markup PNG-on-PDF wants the title-block overlaid ONTO its page, not as a standalone preceding sheet. v5 dropped the boolean, added `cover_mode` enum (`separate` / `overlay` / `none`) with idempotent backfill. Lesson: when a boolean flag captures a binary distinction but the real-world axis is 3-way, the binary always gets refactored within a few iterations. If you smell the third option (even speculatively), reach for the enum first.
- **Size-aware title sheets matter more than expected.** First v1 used hardcoded Letter dimensions for all title sheets, so a contractor's ARCH D site plan (1728 × 2592 pt) was preceded by an 8.5 × 11 cover that looked wildly out of scale next to the plan. v2 added detection via pdf-lib (`getPage(0).getSize()`) and forwarded the dimensions into the react-pdf title sheet via an explicit `pageSize` prop. Lesson: when generating a "cover for X," size-match X — even if it adds a detection step to the pipeline.
- **Augusto-as-PE drives feature scope.** The user is FL-licensed PE + platform owner (memory: `user_role_pe.md`). Sprint 2B's title-block layout (perimeter rule, right-margin labeled cells, FL Reg/Seal cell, Seal Area, "NOT FOR CONSTRUCTION" cell, Revisions cell) is the layout a Florida AHJ plan reviewer expects to see on architectural drawings. Building it generically would have missed the FL-specific cells. Lesson: when the user has domain authority, ask them what the artifact should look like before sketching v1 from generic references.

**Process gotchas worth remembering**:

- **17 commits is a lot for one PR.** PR #49 reviewed cleanly because each commit was small and self-contained (one feature, one test file, builds + tests pass). The iterative v1 → v5 cycle would have been a nightmare to review as a single squash commit. Lesson: when iterating on a feature, lean into per-feature commits inside the PR — the squash commit at merge captures the final shape, and the per-commit history makes the review surface tractable.
- **Migrations stack tight.** PR #49 applied 5 migrations to live Supabase in the order: `20260513_attachment_hvhz_anchoring.sql` → `20260514_attachment_include_sparkplan_cover.sql` → `20260514_attachment_cover_mode.sql` (which drops the prior boolean) → `20260514_attachment_custom_sheet_id.sql` → `20260514_attachment_discipline_override.sql`. Same-day cover_mode supersedes the boolean — the cover_mode migration is idempotent (uses DO block to check for the boolean column before backfilling). Lesson: when refactoring a column same-day, the second migration should be idempotent against either "boolean exists" or "boolean dropped" states.
- **Supabase advisor surfaces F-tier work.** While reviewing PR #49's schema additions, the Supabase advisor flagged `public.jurisdictions` as having RLS disabled. Currently 0 rows so no exposure, but Sprint 2C M1 will populate it. Captured as F8 in the parent audit doc — fix before Sprint 2C M1 lands.
- **Docs sync convention extends to Sprint 2B.** PR #24 (after Sprint 2A PRs 1 + #23) + PR #42 (after Sprint 2A PRs #40 + #41) set the precedent — docs-only PR off main after feature PRs merge. This session's docs-sync PR (#50) follows the same pattern for Sprint 2B PR #49. Stays consistent.

**Deliverables**:

| PR | Branch | Files | Result |
|---|---|---|---|
| **#49 (merged)** | `feat/sprint2b-merge-engine` | 17 commits, 5 new pdf-lib services + 2 new react-pdf components + 5 migrations + 4 test files (~5,580 LOC) | ✅ MERGED `fce6275` 2026-05-12 |
| **this PR (local)** | `docs/sprint-2b-docs-sync` | parent audit + sprint2b + README + ROADMAP + CHANGELOG + SESSION_LOG + database-architecture + CLAUDE.md | (this commit set) |

**Worktrees in play at session end**: none on disk for PR #49 (was a single-agent run, no parallel worktrees).

**Pending / follow-ups**:

1. **PR-4: Orlando manifest scaffold** — `data/ahj/orlando.ts` defines two scopes (`'existing-service'` and `'new-service'`) as `PacketSection[]`. M1 engine in Sprint 2C extends this to 4 more AHJs. Unblocks per-AHJ wiring of H5/H6/H7/H8/H16.
2. **F8: Enable RLS on `public.jurisdictions`** — one-line migration before Sprint 2C M1 populates the table. Supabase advisor flagged 2026-05-12.
3. **H19 per-AHJ wiring** — `artifact_type='hvhz_anchoring'` slot exists; Miami-Dade + Pompano enforcement wiring lands in Sprint 2C M1 alongside the manifest scaffold.
4. **Sprint 3 unblocked at the pdf-lib layer** — PAdES PE seal signing now has the same library + integration pattern that PR #49 established. Cert vendor selection + FBPE business-entity registration are the remaining hard prerequisites.

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
| **#40 (merged)** | `fix/sprint2a-pr4-diagrams` (Agents 1 + 2 + H1 + M3 fixes) | 14 changed, +1886 / -201 | M6 + H9 overlay + M3 grounding |
| **#41 (merged)** | `fix/sprint2a-pr5-h17-schema` (Agent 3 + H2 + M1 fixes) | 7 changed, +782 / -2 | H17 screening + settings JSON |
| **#42 (merged)** | `docs/sprint2a-pr4-pr5-sync` | audit + sprint2a + README + CHANGELOG + SESSION_LOG + CLAUDE.md | docs sync |

**Worktrees in play at session end**: none (3 agent worktrees auto-removed after their branches merged into the review scratch branch). Standard worktrees from other features still on disk.

**Pending / follow-ups (resolved by Sprint 2B work)**:

1. **Merge PR #40 + PR #41** — done.
2. **Pre-existing `(panel as any).aic_rating` cast at `components/OneLineDiagram.tsx:1136`** — still in place; clean up next time the file is touched.
3. **Sprint 2C is now unblocked** — H17 lane logic + settings JSON + AHJ-name placeholder are all in place. Sprint 2C wires per-AHJ manifests into `ahjOverride` and replaces the AHJ placeholder. M2/M3 (security) deferred items (enum whitelist on read, scope_flags runtime coercion) belong in Sprint 2C when those code paths get wired in.
4. **Pre-existing 480V `(panel as any)` casts** — still pending.

---

<!-- Earlier sessions (2026-05-09 contractor-pivot + T&M Phase 1, 2026-05-10 Sprint 2A PR #31) rotated out per "keep last 2 sessions" rule. Git history preserves them. -->
