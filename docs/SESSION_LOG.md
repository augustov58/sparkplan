# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-17

---

### Session: 2026-05-17 — Sprint 2C M3 (Existing/New construction end-to-end across SF / MF / Commercial, PRs #79, #80, #81 stacked)

**Focus**: User opened the session correcting a misread on a previous PR — "PR #78 removed the MF-EV inline form but the analysis still needs to be in the packet; we have a multifamily calculator for that. Make this a bigger UX simplification." They described three end-to-end scenarios the product couldn't express (Existing MF + EV; Existing Commercial + new sub-panel via 220.87 Method 2; Existing Commercial + new loads via 220.87 Method 1 utility bill) and asked me to test E2E + generate proof PDFs. The session evolved through three stacked PRs and two rounds of user-feedback iteration.

**Status**: 3 PRs open against main, stacked:
- **PR #79** (base `main`) — Tools-Hub-as-source-of-truth MF-EV wiring + Existing/New foundation
- **PR #80** (base `feat/existing-new-construction-flow`) — equipment-level `is_proposed` (panels)
- **PR #81** (base `feat/panel-level-is-proposed`) — voltage selector + form persistence + legend polish

Merge order is #79 → #80 → #81. Each subsequent PR auto-rebases to main when its base merges; small chance of manual `git rebase origin/main + git push --force-with-lease` if conflicts.

**Architecture decisions worth carrying forward**:

- **Tools Hub is the source of truth, packet is the consumer.** PR #78's removal-only fix was wrong because it deleted the broken inline duplicate form without restoring the packet's ability to include MF-EV analysis. The correct model is: the Tools Hub calculator does the compute + UI review and persists its full `result` to a known location on `project.settings`. The packet generator reads that location and routes it into `packetData.multiFamilyEVAnalysis`. No reconstruction at the packet site — what the user reviews byte-for-byte is what lands in the PDF. Tests pin the data-shape contract so renames in one site don't silently break the other.
- **`is_proposed` is the right primitive — apply it at every equipment level.** PR #79 established the circuit-level pattern (`circuits.is_proposed`); PR #80 lifted it to panels. Each level needs: (a) DB column with `DEFAULT false`, (b) UI toggle in the create form that auto-checks when project is existing-construction, (c) renderer differentiation in BOTH the in-app view and the packet PDF, (d) test fixture coverage. The pattern is replicable for transformers / feeders / meter_stacks when a user scenario surfaces them. The MDP carve-out (`is_proposed` always false when `is_main: true`) is a deliberate semantic: in existing-construction projects, the contractor is modifying a service, not replacing the service main.
- **Shared utility modules beat ad-hoc helpers.** `lib/electricalDisplay.ts` consolidates the L-N voltage formula + system-type ↔ {voltage, phase} mapping + the canonical 3-option SYSTEM_TYPE_OPTIONS. Replaces inline ternaries in PanelSchedule (buggy hardcoded `'120V'`) and the standalone-voltage selector in OneLineDiagram (let users pick 480V single-phase). Future panel/equipment forms have a single import to mirror ProjectSetup's pattern.
- **Hydrate-then-debounce-persist pattern works for any per-project form state.** PR #79 introduced it for `nec22087Narrative`; PR #81 extended it for `permitPacketDefaults` (preparedBy, contractor license, scope, service type, meter location, conductor routing). 750ms debounce + a `useRef`-tracked `hydratedRef` guard to skip the initial persist. Add a `permitPacketDefaults?: {...}` slot to `ProjectSettings` and copy two `useEffect` blocks; that's the whole pattern. Future form fields should follow this rather than introducing new persistence patterns.

**Process gotchas worth remembering**:

- **Vite's transpile-only build silently ships TypeScript errors.** The inline MF-EV form was passing a stale `MultiFamilyEVInput` shape (`evChargersPerUnit, chargerLevel, commonAreaSqFt` instead of `evChargers: { count, level, ampsPerCharger }, avgUnitSqFt, commonAreaLoadVA`). `tsc --noEmit` flagged it as TS2353 — but `npm run build` (Vite) doesn't run tsc as a step, so the error went un-blocked into production. Future PR worth: add `tsc --noEmit` to the npm scripts or CI so type errors gate the build.
- **User PDF review is a real bug-finding tool.** Two rounds of user review (commits `98f0cbb` + `82bb3d8` + PR #81) caught 7 real issues that the automated test suite missed: 22100kA AIC label, duplicate "PANEL H1" rows, missing EXIST/NEW in fixture, kVA-only cards, "480V / 120V" hardcoded ternary, lost form fields on reload, dim "*" markers. The fix-cycle was: user names a specific spot in the rendered PDF → I locate the render site by grep → minimal targeted edit → regenerate + send → user verifies or names the next thing. This loop scales much better than trying to anticipate every visual detail upfront. **Send the PDF as a SendUserFile artifact every time** so the user can open it natively rather than scrolling through console output.
- **Stacked PRs work but require explicit base setting.** `gh pr create --base feat/existing-new-construction-flow` (vs default `main`) is the key flag. Without it, GitHub shows the PR's diff as "everything from both stacked branches combined" which is unreviewable. After the base PR merges, the stacked PR may need `git rebase origin/main` + `gh pr edit --base main` + `git push --force-with-lease`. Worked smoothly for both #80 and #81 since the panel-level + polish work was additive (no rewriting #79's logic). Stacked PRs are best for additive layers; less suited to layered work that might rewrite earlier commits during review.
- **`is_proposed: false` is the safe migration default but it requires backfill thought.** Adding `is_proposed boolean NOT NULL DEFAULT false` to an existing table is non-destructive: all current rows get `false` (= existing). For brand-new projects in existing-construction mode, the Add Circuit / Add Panel forms auto-flip to TRUE on the next user interaction. The only edge case is "user had a project mid-build before the migration" — those projects keep their (now-canonical-existing) tagging unchanged, which is the right default for in-progress projects where the contractor hasn't yet differentiated. Worth flagging in the migration comment so future maintainers know the default isn't accidental.

**Deliverables**:

| PR | Base | Branch | Files | Result |
|---|---|---|---|---|
| **#79** | `main` | `feat/existing-new-construction-flow` | 6 modified + 2 created (993→995 tests) | ⏳ Open against main |
| **#80** | `#79` | `feat/panel-level-is-proposed` | 5 modified + 1 created migration | ⏳ Open, stacked on #79 |
| **#81** | `#80` | `feat/voltage-persistence-legend-polish` | 6 modified + 1 created (`lib/electricalDisplay.ts`) | ⏳ Open, stacked on #80 |

**Migration required (manual run in Supabase SQL Editor)**: `supabase/migrations/20260517_panel_is_proposed.sql` — adds `panels.is_proposed boolean NOT NULL DEFAULT false`. JSONB-only extensions to `projects.settings` (no migration) for `permitPacketDefaults`, `nec22087Narrative`, `residential.mfEvCalculation`.

**Proof artifacts in `/home/augusto/Obsidian Notes/Projects/Sparkplan Test Packets/`**:
- `Permit_Packet_MF_EV_Existing_2026-05-17.pdf` — Scenario 1 (Existing MF + EV)
- `Permit_Packet_Commercial_Method2_Calculated_2026-05-17.pdf` — Scenario 2 (Commercial + 220.87 calculated × 1.25)
- `Permit_Packet_Commercial_Method1_UtilityBill_2026-05-17.pdf` — Scenario 3 (Commercial + 220.87 utility bill, no 1.25×)

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

**Follow-ups not on this session's queue**:
1. **Pre-commit hook for orphan conflict markers** — `grep -E '^(<<<<<<<|=======|>>>>>>>)' --include='*.{ts,tsx,js,jsx}'`. Caught in this session by `npm run build`; should fail-fast at commit time.
2. **STRATEGIC_ANALYSIS.md + DISTRIBUTION_PLAYBOOK.md feature-inventory sweep** — neither doc mentions the AHJ manifest layer (PRs #51/#54/#56/#70-#75), permit-merge engine (PR #49), NEC 220.83 retrofit (PR #61), H17 contractor-exemption screening (PR #41), PE-as-service positioning, or T&M Phase 1 (PRs #33-#36).
3. **Commercial fixture in Playwright suite** — would have caught PR #64 earlier. Smoke test fixture is single-family residential happy path with zero fail-severity rows.

---

<!-- Earlier sessions (2026-05-15 docs cleanup + JurisdictionRequirements font hotfix + dwelling-load follow-up PRs #63/#64/#65, 2026-05-13 Sprint 2B PR-4 Orlando manifest scaffold + AHJ-aware visibility, 2026-05-12 Sprint 2B PR-3 merge engine, 2026-05-10 Sprint 2A final 2 PRs, 2026-05-09 contractor-pivot + T&M Phase 1) rotated out per "keep last 2 sessions" rule. Git history preserves them. -->
