# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-13

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
| **#50 (merged)** | `docs/sprint-2b-docs-sync` | parent audit + sprint2b + README + ROADMAP + CHANGELOG + SESSION_LOG + database-architecture + CLAUDE.md | docs sync |

**Worktrees in play at session end**: none on disk for PR #49 (was a single-agent run, no parallel worktrees).

**Pending / follow-ups (resolved by Sprint 2B PR-4 work the next day)**:

1. **PR-4: Orlando manifest scaffold** — resolved by PR #51 (`18985e5`, 2026-05-13). Ships AHJManifest type system + Orlando manifest + two-layer visibility model + 6 new artifact_types.
2. **F8: Enable RLS on `public.jurisdictions`** — still open; one-line migration before Sprint 2C M1 populates the table.
3. **H19 per-AHJ wiring** — Orlando wired in PR #51 (statewide outdoor EVSE predicate). Miami-Dade + Pompano enforcement wiring lands in Sprint 2C M1 alongside their manifests.
4. **Sprint 3 unblocked at the pdf-lib layer** — PAdES PE seal signing now has the same library + integration pattern that PR #49 established. Cert vendor selection + FBPE business-entity registration are the remaining hard prerequisites.

---

<!-- Earlier sessions (2026-05-10 Sprint 2A final 2 PRs, 2026-05-09 contractor-pivot + T&M Phase 1, 2026-05-10 Sprint 2A PR #31) rotated out per "keep last 2 sessions" rule. Git history preserves them. -->
