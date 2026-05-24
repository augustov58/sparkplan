# Session Log

**Purpose**: Tracks recent work for seamless handoff between Claude instances.
**Maintenance Rule**: Keep only the last 2 sessions. At the start of a new session, delete older entries — git history preserves everything.

**Last Updated**: 2026-05-24

---

### Session: 2026-05-23 / 2026-05-24 — Post-Sprint-2C panel-PDF demand surfacing + type baseline + CI gate (PRs #94, #95, #96, #97, #98, #99 all merged)

**Focus**: Two-day arc closing three threads deferred during Sprint 2C. Day 1 (2026-05-23): cleaned the TypeScript baseline (447 → 0 errors), added the first CI workflow in the repo with a `tsc --noEmit` gate, regenerated `database.types.ts` from the Supabase MCP. Day 2 (2026-05-24): three layered panel-schedule PDF improvements driven by user visual review of multifamily + commercial generated packets — surface NEC demand kVA/amps inline on the Load Summary, add a per-load-type NEC 220 audit breakdown table, and route the dwelling card's NEC article (220.82 vs 220.83) by construction context.

**Status**: 6 PRs merged sequentially. Build green. 995/995 tests passing throughout (zero net test count change — all production code, no test additions other than the two opt-in PDF disk-dump blocks in `permitPacketE2E.test.ts`).

**Architecture decisions worth carrying forward**:

- **Trust-the-aggregator pattern beats reimplementing NEC math at every render site.** The panel-schedule PDF doesn't redo any NEC 220 cascade math — it asks `calculateAggregatedLoad` (the single source of truth for the in-app Panel Summary) and trusts the result. The `necReferences` array on the result drives the inline article annotation in the card title; the `demandBreakdown` array drives the audit table. If a future NEC update changes how the aggregator computes demand, the PDF automatically picks up the new behavior without renderer changes. Replicable pattern for any rendered NEC artifact: the calc service is the source of truth, the renderer is dumb-but-structured.
- **The per-row tightening is the load-bearing fix when fighting tabular overflow.** PR #98's third sub-change recovered ~80pt total by tightening panel-schedule spacing. One-time fixes (header marginBottom 20→8, paddingBottom 10→4, infoRow marginBottom 3→1, tableContainer margins, etc.) saved ~48pt. But the load-bearing change was `tableRow.paddingVertical 4→2.5` × 21 rows = 31.5pt — the multiplied-cost source. **Lesson for future overflow fights: identify the multiplied-cost line first; fixed-cost savings rarely accumulate enough alone.**
- **Reuse existing semantic props rather than introducing new ones with overlapping meaning.** PR #99 needed a signal for "is this existing construction or new" to route between NEC 220.82 and 220.83. `showExistingNewMarkers` was already plumbed for the "* = Proposed new circuit" decorator from Sprint 2C. Same boolean semantically, two distinct uses. No new prop. **General rule**: when an upstream signal already encodes the answer to a downstream question, route off it directly even if the original use was visual-only.
- **Postgres enums > CHECK constraints when narrow-typed columns matter.** PR #96's regen surfaced that `cover_mode` widened from a 3-literal union to `string` because Supabase's gen-types doesn't introspect CHECK constraints — the runtime safety is there, but the type system can't see it. Fixed inline with `as CoverMode` casts at two call sites, but the deeper lesson is for the next narrow-typed text column: use `CREATE TYPE x AS ENUM (...)` so gen-types can narrow it. Already at least one such column on the schema worth migrating; documented as a low-stakes high-leverage cleanup for a future session.
- **The audit-breakdown pattern is a data → UI evolution worth replicating.** Inspector ergonomics shifted measurably: an AHJ reviewer now sees the NEC 220 cascade application on the same page as the panel schedule, eliminating the cross-reference flip to the separate Load Calculation Summary. The breakdown table's compact 5-col layout (`Load Type | Connected | Demand | Factor | NEC`) fits below a 42-row schedule with ~30% page room to spare. **Same pattern applies anywhere we have a "summary number that was derived from a multi-rule cascade"** — short circuit AIC, voltage drop %, conductor sizing, etc. Each renders today as a single result number with no per-rule visibility. The breakdown pattern is the next polish layer.

**Process gotchas worth remembering**:

- **Vite skipping type validation is a real production hazard.** PR #94 surfaced one real bug among 447 type errors: `MultiFamilyEVInput.evChargersPerUnit` was a stale field that Vite's transpile-only build had silently shipped past the broken type checker. Without PR #95's CI gate, the 0-error baseline would have drifted right back up. **For any new repo / monorepo additions: include `npx tsc --noEmit` in CI from day one.**
- **The Supabase MCP `generate_typescript_types` works identically to the CLI but without local auth state.** PR #96 used `mcp__plugin_supabase_supabase__generate_typescript_types({project_id: "..."})` — output is byte-identical to `supabase gen types typescript --project-id` from the CLI. For future regens, either path works; the MCP path is one tool invocation if already authenticated, the CLI path is one shell line. No need to lean on one over the other.
- **Visual review (PDFs converted to PNG + sent via SendUserFile) is a real bug-finding tool.** User caught the dwelling false-positive on commercial MDPs (kitchen-shape circuits triggering single-family-MDP detection) on a Commercial Building generated packet — would have shipped uncaught without the visual review cycle. Same cycle caught the 42-circuit overflow in PR #98 and led to the spacing-tightening third sub-change. **Pattern: send each generated PDF as a SendUserFile artifact (status: normal) so the user opens it natively; user names a specific visual issue → renderer site located via grep → minimal targeted edit → regenerate + re-send → user confirms or names the next thing.** Scales far better than trying to anticipate every visual detail upfront.
- **Fold related fixes into the open PR, not as land-and-followup.** Mid-PR-#98 review surfaced the layout overflow on 42-circuit panels (NOT a regression — PR #97 was clean, but #98's added breakdown row pushed it over). Folded the tightening into the same PR per the user's saved preference (`feedback_scope_during_review.md`) rather than opening a separate PR. Three commits in one PR vs three separate PRs is the right call when the fixes are in the same architectural area.

**Deliverables**:

| PR | Branch | Files | Result |
|---|---|---|---|
| **#94** | `fix/types-baseline` | many files, 447→0 tsc errors | ✅ Merged 2026-05-23 |
| **#95** | `ci/add-tsc-gate` | `.github/workflows/ci.yml` (new) | ✅ Merged 2026-05-23 |
| **#96** | `chore/regen-database-types` | `lib/database.types.ts` + 2 cover_mode call sites | ✅ Merged 2026-05-23 |
| **#97** | `fix/panel-pdf-demand-display` | 4 files, +321 / -98 LOC | ✅ Merged 2026-05-23 |
| **#98** | `fix/panel-pdf-commercial-demand` | 4 files, +190 / -29 LOC across 2 commits | ✅ Merged 2026-05-24 |
| **#99** | `fix/panel-pdf-dwelling-breakdown` | 2 files, +188 / -49 LOC | ✅ Merged 2026-05-24 |

**No DB migrations.** All six PRs are pure-code: type cleanup, CI infrastructure, types regen, and PDF rendering changes. Backward compat preserved everywhere.

**Visual proofs in `example_reports/`** (regeneratable via `E2E_DUMP_PDFS=1 npm test`):
- `Permit_Packet_MF_EV_Existing_2026-05-17.pdf` — multifamily packet with MDP + H1 sub-panel pages showing the new aggregator card + breakdown table
- `PanelSchedule_Dwelling_Existing_22083.pdf` — single-page dwelling MDP showing the NEC 220.83 card + tier-split breakdown
- `PanelSchedule_Dwelling_New_22082.pdf` — same fixture rendered as new-construction, NEC 220.82 routing

**Follow-ups not on this session's queue**:
1. **STRATEGIC_ANALYSIS.md + DISTRIBUTION_PLAYBOOK.md feature-inventory sweep** — still owed from the prior session; now also needs the audit-breakdown story added as a competitive differentiator (no competing SaaS surfaces the NEC 220 cascade on the panel page itself).
2. **Commercial demand-factor coverage extension** — `calculateAggregatedLoad`'s per-load-type helpers cover Receptacles / Motors / HVAC / Range / Dryer. Specialty commercial loads (welders @ NEC 220.55, restaurant kitchen equipment @ 220.56) currently bucket into "Other @ 100%" — not wrong but conservative. Extend coverage if a real packet surfaces it.
3. **Migrate CHECK-constrained text columns to Postgres enums** — surfaced by PR #96. `cover_mode` is the known one; grep the schema for other narrow-typed text columns with CHECK constraints and migrate them so the next gen-types regen produces narrow unions automatically.
4. **Apply audit-breakdown pattern to other multi-rule results** — short circuit AIC, voltage drop, conductor sizing all currently render as single numbers without per-rule visibility. Same pattern would surface those derivations on their respective PDF pages.

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

<!-- Earlier sessions (2026-05-16 Sprint 2C M2 AHJ expansion PRs #70–#75, 2026-05-15 docs cleanup + JurisdictionRequirements font hotfix + dwelling-load follow-up PRs #63/#64/#65, 2026-05-13 Sprint 2B PR-4 Orlando manifest scaffold + AHJ-aware visibility, 2026-05-12 Sprint 2B PR-3 merge engine, 2026-05-10 Sprint 2A final 2 PRs, 2026-05-09 contractor-pivot + T&M Phase 1) rotated out per "keep last 2 sessions" rule. Git history preserves them. -->
