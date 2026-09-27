# CLAUDE.md

## Project Overview

**SparkPlan**: SaaS dashboard for electrical contractors. Modern alternative to ETAP/SKM ($15-50k/yr). React + TypeScript + Supabase + Gemini AI.

**Roadmap**: See [ROADMAP.md](./ROADMAP.md) for current phase and feature list.

---

## Skills — read the matching one BEFORE starting work in its area

| Skill | Fires when |
|-------|-----------|
| `.claude/skills/nec-calc-service/` | Any change to `services/calculations/` or `data/nec/` |
| `.claude/skills/permit-packet/` | Any change to `services/pdfExport/`, `data/ahj/`, or "the packet PDF looks wrong" |
| `.claude/skills/packet-verification/` | Before merging any PR that touches PDF output or user-facing flows |
| `.claude/skills/extract-approach/` | AFTER solving any non-trivial problem (see Learning Law below) |

Solved-problem write-ups live in `docs/solutions/` — search there before re-debugging a familiar symptom.

## Learning Law

After every non-trivial solved problem, run the extract-approach skill before moving on.
A solution without its learnings note is unfinished work.

---

## Commands

`npm install`, `npm run dev` (localhost:3000), `npm run build`, `npm test`. See `package.json` for full script list.

---

## Verification Protocol

Before marking any task complete, run these checks in order:

1. **`npm run build`** — Must exit 0 with no errors
2. **`npm test`** — All tests must pass. Zero failures allowed.
3. **`npx tsc --noEmit`** — Baseline is 0 errors; keep it there. Vite does NOT type-check, so this is the only gate.
4. **If a test fails** — Fix the code (not the test), re-run. Do not mark complete with failing tests.
5. **If you modified a calculation service** — Verify the test file covers your changes. Add tests for new code paths.
6. **If you added a new route or component** — Verify it's included in the build output (check for the chunk in build log).
7. **If you touched PDF output or a calc that feeds it** — Run the visual pass in `.claude/skills/packet-verification/`. Unit tests do not catch layout or narrative regressions.

**Verify incrementally**: Run build/tests after each significant change, not just at the end. Runtime bugs (DB constraint violations, null crashes, type errors) are cheaper to catch in the step that introduced them.

---

## When Uncertain — Escalation Rules

Exact rules for what to do when the right move isn't clear. Default is to proceed on reversible, in-scope work; these are the exceptions:

1. **NEC interpretation is ambiguous or two readings conflict** → STOP and ask Augusto (he is a FL-licensed PE; his reading is ground truth). Never guess a code interpretation into a calculation or packet — a wrong guess ships on stamped documents.
2. **The change would touch a Stable Module** (`shortCircuit.ts`, `serviceUpgrade.ts`, `OneLineDiagram.tsx`, `database.types.ts`) **or contradicts a Mistake Ledger row** → surface the conflict and wait; do not silently override a PE-validated decision.
3. **Destructive or prod-facing action** (migration against prod Supabase `ioarszhzltpisxsxrsgl`, deleting fixtures in `example_reports/`, Stripe config) → confirm first, always.
4. **Build or tests still failing after 2 fix attempts** → stop thrashing; report exact state, what was tried, and the failing output.
5. **Scope grows mid-task** — a related bug in the *same* architectural area folds into the open PR; anything else gets filed, not fixed.
6. **Everything else** (reversible, in-scope, conventional) → proceed and note the judgment call in the PR description.

---

## Critical NEC Rules

### NEC 220.87 - Service Upgrade Sizing (Existing Loads)
```
CRITICAL: only `calculated` skips the 1.25× multiplier.
- Measured (utility_bill, load_study): value × 1.25 — NEC 220.87(2) requires
  "the maximum demand at 125 percent plus the new load" ≤ service rating
- Calculated (panel schedule / NEC 220 Part III): use value directly — diversity
  is already in the demand factors; adding 1.25× double-counts
- Manual (unknown provenance): value × 1.25 as a defensive default
```
PE-confirmed 2026-07-09 (PR #118 review), superseding both prior interpretations
(pre-Sprint-2 multiplied calculated; Sprint 2 wrongly exempted measured).
Implementation: `services/calculations/serviceUpgrade.ts`, mirrored in
`services/pdfExport/PermitPacketDocuments.tsx::NEC22087NarrativePage` and
`services/calculations/multiFamilyEV.ts` — all three must stay in sync.

### Short Circuit Analysis
```
CRITICAL: 3-phase impedance multiplier is 1× (not 1.732×).
Incorrect value causes 40-50% underestimation of fault currents.
```
Implementation: `services/calculations/shortCircuit.ts`

### EVSE Load — edition-specific (NEC 2020 vs 2023)
```
Florida enforces NEC 2020 (FBC 8th Ed.) — 220.57 DOES NOT EXIST in NEC 2020.
- NEC 2020: per-EVSE load = nameplate per 220.14(A). No 7,200 VA floor.
- NEC 2023: per-EVSE load = max(7,200 VA, nameplate) per 220.57(A).
Both at 100% in the Article 220 load calc — the 125% of 625.41 is for
OCPD/conductor sizing only. Neither is a demand factor.
```
PE-confirmed 2026-09-27. Single source: `data/nec/evse-load.ts::getEvseLoadVA`.
Edition resolves manifest → project `nec_edition` → '2020' via
`data/ahj/registry.ts::resolveNecEdition` (used by the calculator AND the packet).

### EVEMS Sizing (NEC 625.42)
Size to setpoint, not full connected load. EVEMS allows service capacity reduction.

---

## Architecture Patterns

### Hooks Pattern
All data hooks (`usePanels`, `useCircuits`, `useFeeders`, etc.) follow optimistic update + realtime subscription pattern via Supabase. New hooks should copy this pattern exactly.

### Database Types
Use `Database['public']['Tables'][table]['Row']` pattern for types. The `types.ts` file has separate interfaces that may not match DB exactly.

### Panel Hierarchy (Discriminated Union)
```typescript
fed_from_type: 'service' | 'panel' | 'transformer' | 'meter_stack'  // Discriminator
fed_from: UUID                    // Only if type='panel'
fed_from_transformer_id: UUID     // Only if type='transformer'
```
- MDP is found via `p.is_main`, not by `fed_from_type`
- MDP is always the structural root in tree layout
- Meter stack is visual-only in OneLineDiagram, not a tree node
- See: [ADR-005](/docs/adr/005-panel-hierarchy-discriminated-union.md)

### PDF Generation
Uses `@react-pdf/renderer`. Components are Page-level fragments (`<>...</>`), assembled in `permitPacketGenerator.tsx` Document.

### One-line / riser diagram render paths
There are **TWO independent render paths** for the same logical diagram, in **different files**:

- **`components/OneLineDiagram.tsx`** — the in-app interactive viewer + standalone export (PNG/SVG/PDF directly from the diagram view). Has its own internal interactive rendering and a separate full-layout print rendering. Touches: panel glyphs, AIC chips, bus bars, layout geometry. **Not** the source of the audit-packet riser PDF page.
- **`services/pdfExport/PermitPacketDocuments.tsx::RiserDiagram`** (~line 1150) — the riser page rendered into the permit-packet PDF (page 3 of the audit fixture). Uses `@react-pdf` SVG primitives. This is what changes when "the riser in the packet PDF looks wrong."

When a diagram visual changes, decide which path needs updating: in-app viewer → `OneLineDiagram.tsx`; permit-packet PDF page → `PermitPacketDocuments.tsx`. Often **both** need updating for parity (e.g., AIC overlay was added to both in PR #40). Use the Sprint 1 diagnostic shortcut: in-app correct vs PDF wrong → look at the PDF call site (i.e., `PermitPacketDocuments.tsx`), not the in-app viewer.

### Permit packet merge engine (Sprint 2B PR #49, `fce6275`, 2026-05-12)

User-uploaded PDFs (site plans, cut sheets, NOC, HOA, fire-stopping, manufacturer data, HVHZ wind-anchoring) splice into the SparkPlan-generated packet via three **pure pdf-lib services** in `services/pdfExport/`: `mergePacket.ts` (bytes-in/bytes-out merge), `stampSheetIds.ts` (continuous sheet-ID stamping in bottom-right of upload pages), and `compositeTitleBlock.ts` (overlay title-block onto upload's first page via `embedPdf` + `drawPage` + `/ca 0` ExtGState for transparency). All follow the calc-service contract: **pure / no DB / no hooks / never throw / return `warnings[]`**.

Two react-pdf title-sheet components in the same folder: `AttachmentTitleSheet.tsx` (size-aware full cover; matches upload's first-page dimensions Letter → ARCH D) and `AttachmentTitleBlock.tsx` (title-block strip only, used by the overlay path). The orchestrator in `permitPacketGenerator.tsx` branches per attachment on the `cover_mode` enum (`'separate'` / `'overlay'` / `'none'`). When adding a new artifact type, extend the `artifact_type` CHECK in a migration + add the upload card to `PermitPacketGenerator.tsx`; the merge pipeline picks it up generically.

### AHJ manifest + AHJ-aware visibility (Sprint 2B PR #51, `18985e5`, 2026-05-13)

Per-AHJ packet defaults live in `data/ahj/` as **pure data + pure predicates** — no DB, no React, no side effects:

- `data/ahj/types.ts` — the `AHJManifest` interface + 4-axis `AHJContext` (`scope` / `lane` / `buildingType` / `subjurisdiction`). All 4 axes are baked in from day 1 even when a given manifest only uses a subset, so Sprint 2C M1 doesn't retrofit them across 5 AHJs.
- `data/ahj/{id}.ts` — one literal `AHJManifest` per jurisdiction. `data/ahj/orlando.ts` is the reference shape. Captures `relevantSections` + `relevantArtifactTypes` (defaults) + optional `sectionPredicates` / `artifactTypePredicates` (`(ctx: AHJContext) => boolean`, pure) + `necEdition: Record<BuildingType, string>` (Miami-Dade H34 forks NEC 2014 vs 2020 by building type) + `sheetIdPrefix` (Miami-Dade H20 reserves `EL-`) + `generalNotes` + `codeReferences` + `requirements: AHJRequirement[]` (empty on Orlando; Sprint 2C M1 populates).
- `data/ahj/visibility.ts` — `computeDefaultVisibility(manifest, ctx)` implements the **two-layer visibility model**: Layer 1 (manifest defaults from the arrays + predicates) overlaid with Layer 2 (user overrides from `projects.settings.section_overrides` jsonb). When no manifest is registered for a project's jurisdiction, returns `null` and Sprint 2A's `resolveSections(sectionPrefs)` path runs unchanged.
- `data/ahj/registry.ts` — `getManifestById(id)` (case-insensitive) + `findManifestForJurisdiction(jurisdictionName, ahjName)` (case-insensitive substring on either field). Sprint 2C M1 will replace the registry with an explicit `jurisdictions.manifest_id` FK once that table is populated.

The orchestrator threads `manifest?: AHJManifest` + `buildingType?: BuildingType` through `PermitPacketData`. Resolution chain for `generalNotes` / `codeReferences` / `necEdition`: explicit data field → manifest fallback → Sprint 2A baseline. Backward compat is preserved by null-coalescing — projects without a `jurisdiction_id`, or with one not in the registry, render exactly as they did pre-PR-#51.

When adding a new AHJ: drop in `data/ahj/{newAhj}.ts` matching the manifest shape, register it in `registry.ts`, populate `requirements: []` if the M1 engine is wired. **No engine changes required** — Sprint 2C is pure-data + engine; manifest scaffold is done.

---

## Calculation Service Rules

### Pure Functions Only
Calculation services (`/services/calculations/`) are **pure functions** — no DB calls, no hooks, no side effects. Input → output. Components and hooks call them.

### Result Contract
Every calculation result **must** include:
- `necReferences: string[]` — which NEC articles were applied (audit trail)
- `warnings: string[]` — escalating severity (INFO → WARNING → CRITICAL)
- `breakdown` or `details` — itemized sub-results for transparency

### Never Throw
Calculations **never throw** on bad results. Return the result with warnings instead. Let the UI decide how to present it. Example: a voltage drop of 8% returns `{ isCompliant: false, warnings: ['CRITICAL: ...'] }`.

### NEC Tables
NEC lookup tables live in `/data/nec/` as typed array constants + lookup functions. Never inline magic numbers. Pattern:
```typescript
const TABLE_250_122: EgcSizeEntry[] = [
  { maxOcpdRating: 15, copperEgcSize: '14', aluminumEgcSize: '12' },
  // ...
];
export function getEgcSize(ocpdRating: number, material: 'Cu' | 'Al'): string { ... }
```
Table lookups always have a **fallback** (return largest size if input exceeds table).

**NEC table data is safety-critical.** Before modifying any values in `/data/nec/`, cross-check against the actual NEC code book or a verified reference. A single wrong ampacity value (e.g., 25A vs 20A for 12 AWG Cu@60°C) cascades into incorrect conductor sizing for every user. When adding or editing table lookup functions, verify the result is actually a different entry — `>=` comparisons can return the same row you're trying to upsize from.

### Demand Factors Are Non-Cascading
Demand factors apply **once per load type to system-wide totals**, never chained through panel hierarchy. Wrong: apply 35% per panel. Right: collect all lighting VA across hierarchy, apply NEC 220.42 tiers once.

### Rounding
Round **only at final output**, preserve precision in intermediate steps:
- Power: 2 decimals (kVA)
- Current: 0 decimals (amps) for service sizing, 1 decimal for intermediate
- Percentages: 1 decimal
- Conductor sizes: never rounded (string enum)

### Unit Suffixes
Use suffixes in variable names for clarity: `_VA`, `_kVA`, `_kW`, `_pct`, `_ft`. No implicit unit conversions.

---

## Development Patterns

### Scope Confirmation
Before implementing non-trivial features, briefly restate: (1) what you understand the request to be, (2) which files will change, (3) the specific user-facing behavior. This prevents wasted work from misunderstood intent (e.g., "assign transformers to slots" ≠ "add a transformer edit form").

### Renaming / Rebranding
When renaming across the codebase, grep for ALL variations: exact match, partial, different casings, with/without spaces, abbreviations. After replacing, grep again to verify **zero** remaining references. Check landing pages, meta tags, page titles, and user-facing strings explicitly.

### Adding Calculations
1. Types → `types.ts`
2. Service → `/services/calculations/` (pure function, follows rules above)
3. Component → `/components/`
4. Route → `App.tsx`
5. Add NEC article references in comments and in result `necReferences` array

### Adding AI Features
**System 1 (Quick Q&A)**: `services/geminiService.ts` → `callGeminiProxy()`
**System 2 (Complex Analysis)**: `/backend/agents/` → Pydantic AI with approval workflow

### Database Changes
1. Migration → `/supabase/migrations/`
2. Run in Supabase SQL Editor
3. Update `lib/database.types.ts`

### Adding New Entity Hooks
- Follow optimistic update + realtime subscription pattern (copy existing hooks)
- Add event type to `dataRefreshEvents.ts`
- Add toast messages for CRUD operations in `toast.ts`
- Update `fed_from_type` enum in `validation-schemas.ts` if adding new feed types

---

## Frontend Conventions

### Imports
Use `@/` alias for absolute imports. Order: React/externals → Supabase/DB types → components → hooks → services → types → icons (lucide-react).

### Routing
Uses **HashRouter** (not BrowserRouter). Heavy components are lazy-loaded with `Suspense`:
```typescript
const Calculator = lazy(() => import('./components/Calculator'));
<Suspense fallback={<LoadingSpinner />}><Calculator /></Suspense>
```

### Forms
React Hook Form + Zod schemas (`lib/validation-schemas.ts`). Use `zodResolver`. Inline error display.

### Toasts
All user-facing messages centralized in `lib/toast.ts`. Use `showToast.success(toastMessages.panel.created)`, never raw toast calls. Add entries for new entities.

### Styling
Tailwind v4 with custom theme. Brand color: `electric-500` (#FFCC00). No CSS modules. Variants via `Record<Variant, string>` objects.

### Auth
`AuthProvider` wraps app → access via `useAuthContext()`. Supabase RLS scopes all queries to `auth.uid()` automatically — never pass user_id manually.

### Feature Gating
Premium features wrapped in `<FeatureGate feature="feature-name">`. Access tiers defined in `useSubscription` hook.

### Type Adapters
Database uses snake_case, frontend uses camelCase. Convert via adapters in `lib/typeAdapters.ts`. Don't mix conventions.

---

## Mistake Ledger

Real mistakes made in this repo, each paired with the rule that prevents recurrence. When you make (or the user corrects) a new one, add a row.

| Mistake | Prevention rule |
|---------|-----------------|
| Applied 1.25× to calculated loads under NEC 220.87, double-counting Part III diversity | `calculated` never gets 1.25×. See Critical NEC Rules above. (PR #109) |
| Exempted measured demand (utility_bill/load_study) from the 220.87 multiplier — understated existing load, the UNSAFE direction | NEC 220.87(2) takes measured max demand at 125%. Only `calculated` skips it. Keep all 3 implementation sites in sync. (PR #118) |
| Edited `components/OneLineDiagram.tsx` when the *packet PDF* riser was wrong | Two render paths exist. In-app correct + PDF wrong → the bug is in `services/pdfExport/PermitPacketDocuments.tsx`. |
| Used 1.732× as the 3-phase impedance multiplier in short circuit | It is 1×. The wrong value underestimates fault current 40–50%. Do not touch `shortCircuit.ts` without a cited IEEE/NEC reason. |
| "Next size up" table lookup returned the same row it started from | After any `>=` table lookup meant to upsize, assert the result differs from the input row. |
| Type errors accumulated silently because Vite skips type-checking | `npx tsc --noEmit` is part of the Verification Protocol; baseline stays at 0. |
| Cost/pricing fields appeared on the permit packet | Procurement data belongs on the Bid PDF only. AHJs never see money. (PR #43) |
| Hard validation gates blocked contractors from printing draft packets | Validation is advisory: warn, never block. Drafts may print with "TBD". |
| Chatbot second-guessed a correct domain request (NEMA slot numbering) | Fix is prompt-edits in BOTH the system prompt and the tool param description — not tool code. (PR #69) |
| Renames left stale brand/name strings in meta tags and landing pages | Grep all casings/spacings/abbreviations before AND after; require zero hits. Check user-facing strings explicitly. |
| Cited NEC 220.57 (a 2023-only section) on every Florida EV packet, while Florida enforces NEC 2020; a test asserted the wrong citation | Check every cited section exists in the edition the AHJ adopted. EVSE load goes through `getEvseLoadVA(nameplate, edition)`, never an inline 7,200 VA floor. |
| Calculated-method narrative cited dwelling Optional Methods (220.82/220.83) as "Part III" by occupancy, though they're Part IV and the narrative's calc never ran them | Cite from the calculation's runtime references (`summarizeCalculationRefs`), never a fixed per-occupancy string. Part IV only when an Optional Method section actually ran. (PE ruling 2026-09-27) |
| Docs updated with stale "Last Updated" dates; completed features left as "NEXT UP" | Every doc touch updates its date to today; every shipped feature flips its ROADMAP status in the same PR. |

---

## Codebase Pitfalls

### Multi-Pole Slot Formula
Slots occupied: `baseSlot + (i × 2)` for each pole.
- 2-pole at slot 1 → occupies 1, 3
- 3-pole at slot 1 → occupies 1, 3, 5
See: `components/PanelSchedule.tsx:getOccupiedSlots()`

### Stable Modules (Don't Modify Without Good Reason)
- `services/calculations/shortCircuit.ts` - IEEE 141 compliant, safety-critical
- `services/calculations/serviceUpgrade.ts` - NEC 220.87 compliant
- `components/OneLineDiagram.tsx` - Complex SVG rendering, easily broken
- `lib/database.types.ts` - Auto-generated, regenerate via Supabase CLI

---

## Key Files

**Configuration**: `vite.config.ts`, `.env.local`
**Types**: `types.ts`, `lib/database.types.ts`
**Calculations**: `/services/calculations/`
**AI (System 1)**: `services/geminiService.ts`
**AI (System 2)**: `/backend/agents/`, `services/api/pythonBackend.ts`
**Database**: `/supabase/migrations/`

---

## Environment

See [`.env.example`](./.env.example) and [`backend/.env.example`](./backend/.env.example).

**Key**: Gemini API key needed in BOTH Supabase Edge Functions AND Python backend.

---

## Resources

GitHub: `augustov58/sparkplan` • Backend: https://sparkplan.app

---

## Documentation Maintenance

### Linked Documents — Keep in Sync

When a feature, phase, or milestone is completed, **update all affected documentation** before closing out the work. Stale docs cause confusion across sessions. The following files branch from this CLAUDE.md and must stay current:

| File | What to update |
|------|----------------|
| `ROADMAP.md` | Mark phases/features complete, update "Current Phase" header |
| `docs/SESSION_LOG.md` | Add session entry. **Keep only last 2 sessions** — delete older ones (git preserves history) |
| `docs/CHANGELOG.md` | Add entry for user-facing changes |
| `business/STRATEGIC_ANALYSIS.md` | Update feature inventory and competitive positioning when major features ship |
| `business/DISTRIBUTION_PLAYBOOK.md` | Update when new selling points or demo-ready features are added |
| `docs/database-architecture.md` | Update when DB schema changes (new tables, columns, migrations) |

### Rules
- When updating any documentation file, always update "Last Updated" dates to the current date. Never leave stale dates from previous months.
- After completing a feature: check ROADMAP.md and mark it done. Don't leave completed work showing as "NEXT UP" or "NOT STARTED".
- After a DB migration: update `docs/database-architecture.md` with the new tables/columns.
- After shipping a user-facing feature: add a CHANGELOG entry.

### Concurrent worktrees
Multiple worktrees and agents are often active in parallel (`git worktree list`). Before editing any shared doc above: `git fetch origin && git log -3 origin/main -- <file>` to check for recent activity. Pre-push: re-fetch and `git rebase origin/main` if the base moved. Cite squash hashes (not just dates) when flipping status flags — concurrent merges collide on dates.
