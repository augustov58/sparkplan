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
| `.claude/skills/issue-verification/` | Filing an issue (write its Acceptance (UI) section), starting one, and before its PR — every issue |
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
8. **Every issue: UI acceptance, agent-run** — `.claude/skills/issue-verification/`. Expected values are hand-calculated in the issue *before* the fix; drive the real app in the QA account (never the owner's: the local app writes to prod), get an independent verifier pass, leave `tests/e2e/issues/issue-<N>.spec.ts`, and put the `## UI verification` table in the PR (a hook blocks PR creation without it). Augusto does not review behavior by hand (2026-11-08); he still rules on NEC and approves push/merge.

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
- NEW load: continuous loads at 125% — EV charging is continuous per NEC 625.42,
  sized per 625.41 (PE ruling 2026-10-14). Signs and show windows too (#192).
- EVEMS: the setpoint is the new EV load and ALSO takes the 125% (PE ruling
  2026-10-18, #131). Size it as available × 0.90 ÷ 1.25 so EVEMS designs pass.
- SERVICE CHECK, every method (PE ruling 2026-11-07, #192): "is the service
  sufficient" is a conductor/OCPD question → 230.42(A)(1): Article 220 load
  + 25% of continuous loads (EVSE, signs, show windows; existing AND new;
  dwellings too; 220.84 unit EVs on their full load; EVEMS = setpoint) ≤
  service rating. Calculated: the adder is a separate line on E-102. Measured:
  the existing peak × 1.25 already covers it. The Article 220 LOAD stays at
  100% (E-101, panel totals) — never fold the adder into it.
- FEEDERS (PE ruling 2026-11-17, #190): design load = Article 220 demand +
  25% of the continuous loads on that feeder (215.2(A)(1), 215.3, 625.41),
  the service check's list (lighting not counted, EVEMS at the setpoint). No
  blanket 80/20 split. Existing feeders whose stored design load is >1% off
  are flagged "Outdated" (the riser and equipment schedule print stored sizes).
- OTHER TOOLS (#193): Inspector Mode, the Copilot and the EV Panel Builder
  read lib/storedCalcs.ts::scheduleServiceCheck (the same check, in service
  amps vs the rating). Never a connected × 0.8 or breaker-sum rule.
- FEEDER BREAKER (owner ruling 2026-11-21, #283): a feeder has its own
  breaker, stored in the destination panel's feeder_breaker_amps (editable);
  default = next standard size ≥ design current ("Calculated Load") or the
  panel main ("Panel Max Capacity", feeders.sizing_basis). Conductors carry
  the design load and are protected by it (240.4 incl. (B)); EGC from it
  (Table 250.122). Transformer feeders keep the primary breaker. Every reader
  calls services/feeder/feederBreaker.ts — never main || feeder || bus.
  A capacity feeder's load is feederCapacityVA (Feeder Sizing, the packet's
  voltage-drop page, the Copilot); compare design current at 0.1 A (#299).
- PANEL BUS (#225, 408.30): each panel's design load (feederDesignLoadVA;
  the MDP's = the service check) vs its bus, in its own phase —
  lib/storedCalcs.ts::panelDesignAmps (Inspector Mode, the Copilot).
```
PE-confirmed 2026-07-09 (PR #118 review), superseding both prior interpretations
(pre-Sprint-2 multiplied calculated; Sprint 2 wrongly exempted measured).
Implementation: `services/calculations/serviceUpgrade.ts`, mirrored in
`services/pdfExport/PermitPacketDocuments.tsx::NEC22087NarrativePage` (new load
prefilled in `PermitPacketGenerator.tsx` via `upstreamLoadAggregation.ts::calculateProposedNewLoadVA`)
and `services/calculations/multiFamilyEV.ts` (measured path) — all three must
stay in sync. Factor: `EVSE_CONTINUOUS_FACTOR`.
The calculated existing load comes from one function for E-102 and the Service
Upgrade Wizard: `lib/storedCalcs.ts::projectDemandSplit` (existing circuits
only, #127; the wizard converts it to amps with √3 on 3-phase, #185). The wizard's
new load: `scheduleNewLoadAmps` — calculated → the demand increase
(`projectDemandSplit.proposedKVA`, PE ruling 2026-11-04) + `proposedAdderKVA`,
measured/manual → `calculateProposedNewLoadVA`, the same as E-102 (#188, #192).
The 25% continuous adder: `upstreamLoadAggregation.ts::continuousServiceAdderVA` (over `continuousLoadVA`, which feeders share via `feederLoadSync.ts::feederDesignLoadSplit`, #190)
(classifier `data/nec/continuous-load.ts`), returned by `projectDemandSplit`
as `existingAdderKVA` / `proposedAdderKVA`; dwelling results carry it as
`serviceCheckAmps`; `multiFamilyEV.ts` takes EV × 1.25 under every method.

### Single-Family Method (PE ruling 2026-10-27, #178)
```
Existing house → 220.83. New house → the Dwelling Load Calculator's choice,
everywhere (E-101, E-102, Panel Summary, exports, 220.87 narrative):
220.82 when "10 kVA / 40%" is selected, NEC 220 Part III otherwise (default).
Every reader passes the circuits UNDER the MDP (circuitsUnderPanel), never
the MDP's own: a subpanel's loads are the dwelling's (#216).
```
Implementation: `buildSingleFamilyDwellingContext` (carries `useOptionalMethod`)
→ `residentialLoad.ts::calculateSingleFamilyPanelLoad` (one function for all three).
Circuits stored without a load type ('O' — templates write none) take one from
their description (`dwellingLoadType`); an explicit type always wins.
Once the service panel has circuits, the Dwelling Load Calculator and the Service
Upgrade Wizard compute from them too (`calculateSingleFamilyLoadFromCircuits`,
#184); the appliance toggles only build the schedule on "Generate".

### Dwelling Optional Methods — HVAC (PE rulings 2026-10-18)
```
220.83 (existing single-family):
- No proposed heating/A/C → 220.83(A): existing HVAC (larger of heat/cool
  only, per 220.60) goes INTO the 8 kVA / 40% bucket.
- Any proposed heating/A/C, INCLUDING a like-for-like replacement → 220.83(B):
  HVAC at 100%. (#132)
220.84 (multifamily): the larger of A/C or fixed electric heat at NAMEPLATE per
220.84(C)(5). No 65% heat factor — that is 220.82(C) only. (#133)
A unit's own EV charger is a unit load: in the 220.84 base at getEvseLoadVA,
factored. Only the shared EV panel adds after the factor. (#180, 2026-10-27)
```
Implementation: `residentialLoad.ts` (`calculateSingleFamilyLoad`,
`calculateDwellingPanelDemand` + `hasProposedHvac`, `calculateMultiFamilyLoad`),
`upstreamLoadAggregation.ts` (MDP 220.84), `multiFamilyEV.ts` (simplified path).

### Dwelling Unit Panels — NEC 220 Part III (PE ruling 2026-10-26, #155)
```
A unit panel inside a 220.84 building = NEC 220 Part III (standard method).
220.83 only when the permit adds load to that unit (proposed circuits on its
panel, existing building). 220.82 is not the unit default.
Part III, exact: Table 220.55 Column C always (Notes 1–2 over 12 kW; Note 3
A/B not taken); 220.53 75% for 4+ fastened-in-place appliances ≥500 W (not
cooking, dryers, heat, A/C, EVSE); +25% of the largest MOTOR CIRCUIT
(220.50/430.24) — never the A/C. Generator unit panels: no ×1.25.
```
Implementation: `residentialLoad.ts::calculateDwellingStandardLoad` (the only
Part III walk) ← `calculateSingleFamilyLoad` (toggles), `calculateDwellingUnitPanelLoad`
(circuits; unit pages, in-app summary, exports, MF generator).
The unit's feeder and the MDP's feed-thru row are the same number (PE ruling
2026-11-17, #179): `calculateAggregatedLoad` sends a unit panel to
`calculateDwellingUnitPanelLoad` and a multifamily house panel to the
non-dwelling Part III rules (also its 220.84(B) row at the MDP). Pass
`dwellingAggregateOptions(project)` with every aggregate of a project's panels.
A single-family subpanel's feeder (PE ruling 2026-11-20, #217) = Part III over
its own circuits (`calculateSingleFamilySubpanelLoad`): only the small-appliance
circuits on it (no 2-circuit minimum), receptacles at their VA in the 220.42
tiers. The 3 VA/ft² allowance and the 2-circuit minimum stay on the service calc.
Whole dwellings on Part III take each small-appliance and laundry circuit at the
larger of its VA or 1,500 VA (220.52(A)/(B); owner ruling 2026-11-21, #282) via
`circuits220_52VA`; fewer rows than counted circuits hold all of them ("2 @ 1,500
VA" = two circuits). The Optional Methods (220.82, 220.83, 220.84) take a
flat 1,500 per circuit, whatever VA is typed (owner ruling 2026-11-22, #291):
the MDP's 220.84 total via `optionalMethodAllowanceDelta`.

### Two Dwelling Units — Part III / 220.85 (PE ruling 2026-10-27, #127)
```
A two-unit service = ONE Part III walk over both units (220.42 once on the
combined general loads, 220.53 counted across both, Column C by number of
ranges) — not the commercial cascade, not a sum of unit results.
220.85: the lesser of that and 220.84 for three identical units, only when
the two units are identical and meet 220.84(A).
```
Implementation: `residentialLoad.ts::calculateTwoUnitDwellingLoad` ←
`calculateMultiFamilyLoad` (2 units), `upstreamLoadAggregation.ts` (MDP with a
2-unit `MultiFamilyContext`), `multiFamilyEV.ts` (calculated path).

### Part III aggregate citations (owner rulings 2026-11-24, #206)
```
Water heater (100 %): NEC 220.14(A) (Specific Appliances or Loads), never
220.51 (that is fixed electric space heating). Heating with nothing omitted:
220.51. Cooling with nothing omitted: 220.14(C), 440.6(A) (as #205's HVAC
row). "220.60 (Omit …)" only when a heating or cooling load is omitted
(> 0 VA). Same numbers in NEC 2020 and 2023. Values unchanged.
```
Implementation: `upstreamLoadAggregation.ts` (`WATER_HEATER_CITATION`, `HEATING_CITATION`, `COOLING_CITATION`, `calculateHvacDemand`).

### Commercial Load Calculator HVAC (owner ruling 2026-11-24, #205)
```
The HVAC row asks for the nameplate rated-load current (RLA, A) per
440.6(A): RLA × V (× √3 on 3Φ) is the Article 220 load at 100 %.
"Continuous" adds the 125 % in service sizing only (#195). Never MCA as the
load (it already holds 125 % of the largest motor, 440.33). App, PDF and
CSV cite "NEC 220.14(C), 440.6(A)" (HVAC_CITATION). The stored field keeps
its name, nameplateFLA, so saved inputs load.
```

### Short Circuit Analysis
```
CRITICAL: 3-phase impedance multiplier is 1× (not 1.732×).
Incorrect value causes 40-50% underestimation of fault currents.
Conduit type: R and XL from Chapter 9 Table 9's own column (PVC /
aluminum / steel), no extra factor — the steel column already includes
the steel effect (owner-approved 2026-11-20, #276).
Required AIC (110.9): the first standard rating ≥ the available fault
current, no margin (owner ruling 2026-11-21, #279). requiredAIC is kA.
Standard ratings (owner ruling 2026-11-23, #311, KEEP): 10, 14, 22, 25,
42, 65, 100, 200 kA (STANDARD_AIC_RATINGS, shortCircuit.ts and its copy in
data/manufacturerTemplates.ts). No 18 or 35 kA: 15.7 kA requires 22 kA.
Do not add tiers without a new ruling.
Saved results: recomputed on read from the saved inputs (owner ruling
2026-11-21, #278). A row that can't be recomputed exactly is flagged
"Outdated, re-run" — never filled with a guessed 1 set.
Parallel sets: the run's impedance ÷ its sets, service AND downstream
panel (owner OK 2026-11-22, #286); a panel row saved before its sets
were recorded is Outdated too.
One service calculation per project (owner ruling 2026-11-22, #285): a
new service save replaces the previous; readers see only the newest.
Stale (upstream changed) rows are marked on the packet as in the app
(detectStaleCalculations, #289); conductors print with "N ×" sets.
Equipment AIC rating (owner ruling 2026-11-23, #313): panels.aic_rating
is stored in kA (the form saves 42 for 42 kA). Readers print it as is
(formatAicKa, the OneLineDiagram chip) — never ÷ 1,000.
Service rating (owner ruling 2026-11-23, #301): the project's service
amps, else the MDP main (projectServiceRatingAmps). E-102 prints it; both
calculators prefill it. A service row with no transformer kVA (estimated
from its amps) whose amps differ from it is Stale (detectStaleCalculations).
AIC wording (owner ruling 2026-11-23, #307): a printed 110.9 status compares
an entered rating with the fault current at its own point (aicStatus,
panelAtShortCircuitPoint; the MDP's point = the service main, as #279):
"OK (r ≥ If kA)" / "Under-rated" / "Required ≥ N kA". Never "confirmed" or
"Compliant" without an entered rating.
```

### Material Take-Off (owner ruling 2026-11-23, #304)
Wire per circuit = poles, + 1 neutral on 1-pole; conduit per circuit from
Chapter 9 at 40 % fill, EGC included (Table 5 THHN, Table 4 EMT), totalled
by trade size; ~50 ft wire / ~10 ft raceway per circuit (estimates kept).
Implementation: `services/calculations/racewayFill.ts::branchWiringTakeoff`.
Boxes (owner ruling 2026-11-24, #321): outlet (60 %) and junction (20 %) boxes from the 1-pole
circuits only, rounded down; a count of 0 prints no row (`racewayFill.ts::boxEstimate`). Every CSV
export writes its cells through `lib/csv.ts::csvRow` (RFC 4180: 3/4" stays in one cell).
Implementation: `lib/storedCalcs.ts::recomputeShortCircuitRow`, applied to every row by `hooks/useShortCircuitCalculations.ts`. Saves record `results.setsInParallel` (no column). An outdated row is not a source in `shortCircuitHierarchy.ts`.
Implementation: `services/calculations/shortCircuit.ts`

### EVSE Load — edition-specific (NEC 2020 vs 2023)
```
Florida enforces NEC 2020 (FBC 8th Ed.) until 2026-12-31, then NEC 2023
(FBC 9th Ed.) — 220.57 DOES NOT EXIST in NEC 2020.
- NEC 2020: per-EVSE load = nameplate per 220.14(A). No 7,200 VA floor.
- NEC 2023: per-EVSE load = max(7,200 VA, nameplate) per 220.57(A).
Both at 100% in the Article 220 load calc — the 125% of 625.41 is for
OCPD/conductor sizing only, which includes the service check (230.42(A)(1),
see 220.87 above). Neither is a demand factor.
```
PE-confirmed 2026-09-27; extended 2026-10-14 to the single-family Optional Method
(220.82/220.83 bucket, 2023 floor included) and to all continuous loads — no ×1.25
in any Article 220 load calc; extended 2026-10-21 to the Part III aggregate (panels,
feeders, MDP), the 220.84 total and the 220.87(2) new load. EVEMS under 2023: the
setpoint, capped at N × 7,200 VA. No EVSE demand factor anywhere: a user-entered
"simultaneous use %" is a design assumption printed on its own line, never the NEC
load (PE ruling 2026-11-13, #194/#198). Single source: `data/nec/evse-load.ts::getEvseLoadVA`;
circuit-based calcs go through `upstreamLoadAggregation.ts::withEvseLoadForEdition`.
Edition = project-page pick (`settings.nec_edition_override`) → Automatic: Florida's
code cycle by date (a non-FL jurisdiction's own row edition), via
`data/ahj/codeCycle.ts::resolveNecEdition` / `hooks/useProjectNecEdition` — used by
every calc, the packet, exports and the Copilot. Never read `project.necEdition`
(legacy column) or `jurisdiction.nec_edition` for the edition. AHJ text written for
the 2020 cycle goes through `applyCodeCycle` / `manifestTextForEdition`.

### EVEMS Sizing (NEC 625.42)
Size to setpoint, not full connected load. EVEMS allows service capacity reduction.
The setpoint limits the feeder AND the service: every aggregate at or above the
EV panel (MDP included) takes its chargers at the setpoint (#210).

### EV Branch Conductors (PE ruling 2026-11-20, #271)
EV circuits ≤ 100 A: Table 310.16 at 60 °C (110.14(C)(1)(a)), with a note for
the smaller 75 °C size when terminals are listed for it; above 100 A, 75 °C.
Both EV tools read `data/nec/table-310-16.ts::terminationTempC` /
`conductor75COption` (the option never goes below 240.4(D)).
Every circuit, branch or feeder (owner ruling 2026-11-21, #280): breaker = next
standard size ≥ 125 % of a continuous load; conductor = `conductorForBreaker`;
a check = `conductorCodeLegal` (110.14(C)(1), 210.19(A)(1), 240.4 incl. (B)/(D)),
never "ampacity ≥ breaker". The Copilot, Circuit Sharing and the MF generator use them.
Ampacity adjustment at terminations (owner ruling 2026-11-22, #296, KEEP):
`conductorSizing.ts::sizeConductor` applies the 310.15(B)(1)/(C)(1) factors to
the 110.14(C) termination column too — conservative (100 A, 4 current-carrying
→ 1/0, not 1 AWG). Do not change it to "lesser of adjusted insulation and
unadjusted termination ampacity" without a new ruling.

---

## Architecture Patterns

### Hooks Pattern
All data hooks (`usePanels`, `useCircuits`, `useFeeders`, etc.) follow optimistic update + realtime subscription pattern via Supabase. New hooks should copy this pattern exactly.
A realtime event refetches the whole list, so a fetch that started before a local write can land after it and undo it (a deleted row comes back, #234). Every such hook uses `lib/fetchGuard.ts`: `const guard = useFetchGuard()`; the fetch takes `guard.token()` and drops its result when `guard.stale(token)`; the hook returns its mutations as `guard.wrap(fn)` and sets `guard.refetch = fetchX` (one refetch after the writes settle). A caller creating many rows passes `{ silent: true }` and toasts once (#242).
A table a hook subscribes to must be in the `supabase_realtime` publication (add it in the table's migration). Until #315 (2026-11-24) 23 subscribed tables, panels and circuits among them, were not, and no realtime event ever fired for them.

### Database Types
Use `Database['public']['Tables'][table]['Row']` pattern for types. The `types.ts` file has separate interfaces that may not match DB exactly.

### Project routes (#297)
`ProjectWrapper` renders when it has the project, waits (spinner) while `useProjects().loading` (true until the list is fetched for the signed-in user, read at render time: `lib/projectRoute.ts`), and redirects to the dashboard only when a loaded list lacks the project.

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
Import `Text` from `services/pdfExport/PdfText`, never from `@react-pdf/renderer`: Helvetica is WinAnsi, and the wrapper spells out →, ≤, ≥, √, Ω, Φ and emoji that would print as wrong glyphs (#153).

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
- `data/ahj/registry.ts` — `getManifestById(id)` (case-insensitive) + `findManifestForJurisdiction(row)`: matches a `jurisdictions` row on its `state` / `city` / `ahj_name` against each manifest's `coverage` (county building department → county manifest; else the city), never on substrings of the display name (#135: "Miami, Miami-Dade County, FL" is the City of Miami).

The orchestrator threads `manifest?: AHJManifest` + `buildingType?: BuildingType` through `PermitPacketData`. Resolution chain for `generalNotes` / `codeReferences`: explicit data field → per-project override → manifest fallback (in the project's edition via `manifestTextForEdition`) → Sprint 2A baseline. `necEdition` comes from `resolveNecEdition` (see EVSE Load above), never the manifest. Backward compat is preserved by null-coalescing — projects without a `jurisdiction_id`, or with one not in the registry, render exactly as they did pre-PR-#51.

Requirements and notes about EV, EVEMS or transformers gate on `evInScope` / `evemsInScope` / `transformerInScope` (`data/ahj/checks.ts`); a note with a condition is `{ text, when }`. A `detect()` checks content in the built packet (`PacketAST.sectionKeys` = pages actually rendered), and `partial` reports what's there when it isn't enough.

When adding a new AHJ: drop in `data/ahj/{newAhj}.ts` matching the manifest shape (including `coverage`), register it in `registry.ts`, populate `requirements: []` if the M1 engine is wired. **No engine changes required** — Sprint 2C is pure-data + engine; manifest scaffold is done.

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
**System 2 (Complex Analysis)**: `/backend/agents/` → Pydantic AI with approval workflow. Model `google:gemini-3.8-flash`; `backend/requirements.txt` pins exact versions (pydantic-ai 1.x): bump one on purpose and check a clean install starts (`GET /health`) (#334).

### Database Changes
1. Migration → `/supabase/migrations/`
2. Run in Supabase SQL Editor
3. Update `lib/database.types.ts`
4. Every database object is created by a migration in the repo, never only in the SQL editor (`redeem_promo_code` and its promo-code policy existed only in prod until 2026-11-24).
5. A `SECURITY DEFINER` function skips RLS: it takes the user from `auth.uid()` (an argument naming a user must equal it), sets `search_path = ''` with qualified names, and revokes `EXECUTE` from `PUBLIC, anon` unless signed-out callers need it. Read the RLS policies of the tables it touches in the same pass.
6. The Supabase MCP `apply_migration` asks its own confirmation for destructive statements (`DROP …`), and this client declines it unseen: hand such a migration to the owner for the SQL editor, never split or reroute it to avoid the prompt.

### Adding New Entity Hooks
- Follow optimistic update + realtime subscription pattern (copy existing hooks), with `useFetchGuard` (see Hooks Pattern, #234)
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
Email links (#330) land on the app root with their parameters in the hash (`#access_token=…&type=recovery`, `#error=…`): `lib/authLinks.ts::readAuthLink`, read once at load (`lib/supabase.ts::authLinkAtLoad`). A `redirectTo` / `emailRedirectTo` is the root (`origin + pathname`), never a hash route (auth-js would read `#/x#access_token` and miss the token). A recovery link routes on `PASSWORD_RECOVERY` to `/update-password`.

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
| Single-family E-102 ran the Part III cascade while E-101 ran NEC 220.83; the same packet passed the service on one page and failed it on the next (#121) | Pages reporting the same quantity call the same function behind the same gate helper (`buildSingleFamilyDwellingContext`). Existing dwelling → 220.83; new → the Dwelling Calculator's choice (220.82 or Part III, #178), on every page. |
| Single-family calc applied ×1.25 to EVSE and other "continuous" loads inside the 220.82/220.83 load calc, citing "220.18(B)" for it; the #123 edition fix covered only the multifamily path | The 125% is OCPD/conductor sizing, never the Article 220 load. When a rule changes, grep every calc that computes the same quantity (MF, SF Optional Method, Dwelling Calculator, Panel Summary), not just the one in the bug report. |
| Multifamily 220.84 took electric heat at 65% and cited "220.84(C)(4)" for it — a 220.82(C) single-dwelling factor carried into a section that has none, understating demand (#133) | A factor valid in one Optional Method is not valid in another. Before applying any factor, find it in the text of the section you cite. 220.84(C)(5) = larger of A/C or heat at nameplate. |
| The Part III aggregator, feeder sizing, the 220.84 total and the 220.87(2) new load read EVSE `load_watts` raw; the NEC 2023 7,200 VA floor reached only the MF-EV calc and the SF Optional Method | Every calc that turns an EVSE into load calls `getEvseLoadVA` (circuits: `withEvseLoadForEdition`) with the project edition. A new edition parameter with a default needs a grep of every production caller — tsc can't see a missing optional argument. |
| Table 310.16 stored 14 AWG Cu at 20 A in the 60 °C column (code: 15 A), plus three other rows above the code value (and six aluminum cells below it); a 20 A load on 60 °C terminals sized 14 AWG | Every corrected `data/nec/` row gets a pinned test (`tests/table-310-16.test.ts`). Cross-check against the code book, not a web chart: some charts print aluminum as ~0.8 × copper. The test pins the whole table, so any edit must match the book. |
| Manifest lookup substring-matched display names in registry order: City of Miami got the Miami-Dade County manifest, City of Tampa got none (#135); tests used made-up names, never the real rows | Match jurisdiction rows on `state` / `city` / `ahj_name` via each manifest's `coverage`. Tests of a lookup use the real rows' strings. |
| `→`, `≤`, `≥`, `√` printed as `’`, `d`, `e` in the packet (Helvetica is WinAnsi); "→ PANEL x" is stored in the DB, so fixing source strings could never cover it (#153) | Import `Text` from `services/pdfExport/PdfText`. A transform meant for every X goes where every X passes, not at an entry point. |
| The jurisdiction checklist detected sections by their toggles and by pages that only cite a requirement, and had no EV/transformer axis: E-502 printed [X] for absent pages and EVSE items on a café build-out (#140, #148) | `PacketAST.sectionKeys` comes from the built pages; a `detect()` checks the content it names (`partial` when only cited). EV / EVEMS / transformer items gate on `AHJContext.hasEV` / `hasEVEMS` / `hasTransformer` from `data/ahj/checks.ts`. |
| Saved calculator results (`multiFamilyLoadResult`, `mfEvCalculation`) were printed as saved; a rule change reached a project only after its calculator was reopened, and E-402 printed a full-load EV design for an EVEMS job (#158) | Save a calculator's inputs with its result; readers recompute through the calculator's own function (`lib/storedCalcs.ts`). Compare saved jsonb with sorted keys (jsonb reorders them) or a save effect loops. |
| One unit's load had four implementations: unit pages printed a 10 kVA bucket labelled 220.83, the generator a 220.82 bucket ×1.25, and the calculator Part III math labelled "220.82 Optional Method" (#155) | List every function that computes a quantity and every reader before fixing it. Make the math match the label printed, then route all of them through one core (`calculateDwellingStandardLoad`). |
| A two-unit building ran the commercial cascade on the packet (220.44, dishwashers as ranges) and "220.84 @ 100%" in two calculators; adding the case, the context builder classified a unit with its own charger as the EV panel and pulled it out of the dwelling walk (#127) | When a calc gains a case, route every reader through one function and re-check the classifiers upstream of it (which panel is "EV" / "house" / a unit). |
| A new house's packet printed 220.82 while the calculator defaulted to Part III; switching the packet to Part III read template circuits stored without a load type ('O') as 220.53 appliances — range at 75% instead of Column C, A/C at 75% instead of 100% (#178) | A circuit-based calc that branches on load type infers a type from the description when it is 'O' (`dwellingLoadType`). Test circuit-based calcs with the template's own circuits, not only hand-typed fixtures. |
| The Dwelling Load Calculator computed from appliance toggles and the packet from the panel's circuits; a templated house (circuits, no toggles) showed 10.2 kVA in the calculator and 30.9 kVA on E-101 (#184) | Pages reporting one quantity share the input as well as the function. Once the panel has circuits, every reader computes from them; the toggles only build the schedule. |
| The Service Upgrade Wizard called `useCircuits` with a panel ID (it takes a project ID), so its panel-schedule load never loaded. The raw `load_watts` sum behind it (no demand factors, no √3, main-panel breakers only) would have entered 220.87 as "calculated" once the ID was fixed (#185) | A reader of a packet quantity calls the packet's function (`projectDemandSplit`), never a local copy. Before turning on a dead path, run it and compare its number with the packet's. |
| The service check compared the Article 220 load straight with the service rating under the calculated method, so one charger counted 48 A when calculated and 60 A when measured (#192) | Two numbers: the Article 220 load (100%, E-101) and the service check (+25% of continuous loads per 230.42(A)(1), every method). A ruling about the load is not a ruling about the comparison; ask which one it covers. |
| The in-app Panel Schedule ran its own demand walk (lighting and water heaters ×1.25, heat ×0.75 for 4+ circuits, dwelling lighting tiers on every panel), and the card showed the shared aggregate only when it was lower (#191). The first fix fed the aggregate a display list that drops the EVEMS marker, so the table ignored the setpoint | An in-app view of a packet quantity reads the packet's function. Never choose between two calculations by which is lower. Don't pass a list filtered for display to a calc; check what the function needs (EVEMS marker circuits). |
| The Part III aggregate clamped EVSE to the EVEMS setpoint only when it ran on the EV panel itself; the MDP took the chargers at full load, so one page printed its feed-thru rows at 44.1 kVA and its demand at 49.9 kVA (#210) | A limit on the feeder and the service applies at every level above the device: walk the subtree (`collectDownstreamPanelIds`), as `continuousLoadVA` does. Two numbers on one page that must agree (feed-thru rows vs the aggregate) are a free test. |
| One unit feeder printed 29.7 kVA on the unit page, 36.6 in the Feeder Manager and voltage-drop page, 37.1 on the MDP row: `FeederManager`'s `occupancyType` prop defaulted to `'commercial'` and no render site passed it, `computeFeederLoadVA` hard-coded `'commercial'`, and the MDP row ran the cascade that counts every 'K' circuit as a range (#179) | A defaulted prop or argument hides a missing caller: check every render site / call passes it, or derive it inside. Route every reader of a quantity through the function its own page prints. List optional-argument callers with a script; tsc can't. |
| The EVEMS setpoint marker circuit was hidden as metadata on every screen, so once written it could never be edited or removed, and it kept clamping the panel and its feeder (#209) | Data filtered out of every list needs one visible owner that can edit and delete it (here the setpoint card). Counts that skip it elsewhere must skip it everywhere (tabs, E-101 TOTAL CIRCUITS). |
| Every data hook refetched its whole list on any realtime event and wrote optimistically; a fetch started before a delete landed after it and put the row back on screen (#234). The first repro passed on `main` because `route.continue()` after a sleep delays the *request*, so the server answered after the delete | A list hook drops fetch results that overlap a local write (`lib/fetchGuard.ts`). To test a slow response, hold the response back (`route.fetch()` → wait → `route.fulfill`), not the request. |
| Voltage drop read a stored Table 9 effective-Z column 10–20% below the row's own R/XL (Note 2) and used 1× on three-phase, understating E-102 (#219) | VD Ze = R·PF + XL·sin θ from the row (`voltageDrop.ts::effectiveImpedance`); line-to-line VD takes 2 (1Φ) or √3 (3Φ). The "1×, not 1.732×" rule is short-circuit only. A formula change flags stored results "Outdated". |
| Article 220 printed fixed section numbers: the 2023 "Table 220.42(A)" on 2020 projects, the 2020 "Table 220.42" on 2023 projects, and "Table 220.12" for the dwelling 3 VA/ft² (220.14(J) in 2020) (#237) | Renumbered sections come from `data/nec/article220-citations.ts::article220Citations(edition)`, with the edition required. Never find a calc row by its citation string. |
| Short circuit multiplied steel-conduit XL by 1.5 on top of Table 9's steel column, under a comment claiming "Table 9 only has PVC data"; steel fault currents were 4–12% low (#276) | Before applying a factor for a condition, check the table doesn't already have a column for it. Check a comment's claim about the data against the data. |
| Short circuit multiplied the fault current by 1.25 before picking the AIC, citing NEC 110.9 (no such factor); the packet's fault-current page printed the kA rating as "14 A", hidden because its fixtures stored the rating in amps (#279) | Find a factor in the cited section before applying it. Build a page's test fixture from the calculator's output, in its units, and assert the page's text, not that a PDF rendered. |
| Short-circuit results printed as saved, so #258/#276/#279 reached a project only on re-save; the service save never stored its sets in parallel, so old rows couldn't be recomputed (#278) | Save every input the calc function takes (diff the save payload against its parameters). Recompute stored results where rows enter the app (the data hook). A value that can't be reproduced is flagged, never defaulted, and never feeds a new calculation. |
| Whole dwellings took small-appliance and laundry circuits at a flat 1,500 VA though 220.52 says "not less than 1500 … for each"; the first fix turned a 3,000 VA row standing for two circuits into 4,500 (#282) | A "not less than X for each" is a per-item floor. Before a per-row rule, decide what a row means when rows and the count disagree; run the existing template-shaped tests before writing new ones. |
| Four tools kept private conductor lists after #271 unified the EV tools (4 AWG on every breaker > 50 A, 2 AWG on 100 A, checks against the load at 75 °C); writing the acceptance, 240.4(B) was misapplied twice (#280) | Sweep and count every path that picks or checks a conductor before fixing one. For 240.4(B), check all three conditions (ampacity not a standard rating, breaker = the next one, ≤ 800 A) in both termination columns. |
| A feeder's conductors were sized to the load but its EGC to the panel's main breaker; six readers each guessed the feeder's OCPD with their own fallback, Recalculate always went load-based, and the stale check guessed "capacity-based" from a load within 5 % of the rating (#283) | When readers each derive "the" value with their own fallback chain, store the value and route every reader through one function (`feederBreaker.ts`). Never infer a mode from a number that happens to match it — store the mode. |
| The downstream short-circuit calc ignored the feeder's sets in parallel though the form showed them (2-set feeder: 13,386 A / 14 kA printed, 16,645 A / 22 kA actual); the Short Circuit page also cast the camelCase project to a column-named type, so every prefill was 240 V 1φ (#286) | A form field that never reaches the calc is a bug: diff a form's inputs against the function's parameters. Never cast between the frontend and DB shapes of a row (`as never`); map the fields the consumer reads. |
| The Short Circuit page and E-102 read the newest service row, but the packet's short-circuit table printed every row, so superseded service calculations printed on the AHJ packet and set its "Highest Required AIC" (#285) | Rows filtered out of one view must be filtered for every view: filter where the rows enter the app (the data hook), not in each page. |
| The packet printed a panel short-circuit row as "Compliant" while the app flagged it Stale, and no surface printed the sets in parallel that change the result (#289) | A mark the app shows must reach the printed document from the same function with the same inputs. Print every input that changes a result next to it. |
| Panel templates stored loads near breaker × V × √3, so 8 of 51 circuits had a conductor smaller than their own load (a 100 A chiller at 96 A on 3 AWG); the #280 sweep checked conductor vs breaker only (#294) | Check a conductor against its load and its breaker (`conductorCodeLegal` with `loadAmps`); `tests/templateConductors294.test.ts` checks every template circuit. |
| The MDP's 220.84 total summed the unit circuits' typed VA, while 220.82/220.83 and the Multifamily calculator took a flat 1,500 per small-appliance/laundry circuit (#291) | "X VA for each" in an Optional Method is an allowance, not a floor; "not less than X" (Part III) is a floor. Read which one the cited section says, and make every path that cites it agree. |
| #283's breaker check compared a 3Φ "Panel Max Capacity" design current (main × V × √3, 400.000… A) raw with the 400 A main, so every such feeder read Outdated; the live re-sizers ignored the sizing basis (E-102 printed 4/0 AWG at 0.0 A for a 2 × 250 kcmil feeder) (#299) | Compare a derived quantity at the precision it prints. A stored mode (sizing basis) must reach every reader that re-derives the value, not only the page that stores it. Test 3Φ when √3 is in the formula. |
| The packet and the one-line divided the equipment AIC rating by 1,000, but the form saves kA: every entered rating printed "0.0 kA". The tests stored amps (22000), so they passed (#313) | A stored unit is what the writers save and the data holds; list the writers and query the stored values before changing a reader. Fixtures take the writer's output in its units (tests/aicRatingKa313.test.ts). |
| E-102 printed the calculator's Service Amps field (default 200 A) as the service rating; the Tools calculator ignored the project and the page fell back to 200, so an 800 A service's estimated transformer was sized at 225 kVA (#301) | Define a project quantity once (`projectServiceRatingAmps`) and route every reader through it, form prefills included. A calc input that also labels the printed result is a second reader of the project, not the source of truth. |
| E-102 said equipment ratings "are confirmed against the value above" and E-103 printed "Compliant" / "All panels meet NEC 110.9" with no rating entered anywhere (#307) | A printed status names what was compared. With nothing entered, print the requirement ("Required ≥ N kA"), never a verdict. Compare a rating with its own point's fault current (`aicStatus`). |
| The Material Take-Off counted one conductor per circuit and sized conduit as "3/4\" plus 30 % of 1\"", so 3-pole feeders were a third of their wire and 1 AWG got 3/4\" EMT (#304) | Size a raceway from the conductors in it (Chapter 9, EGC included); count conductors per pole. Take-off math lives in a pure function tested on the templates' own data. |
| `ProjectWrapper` redirected whenever the project was missing from the list, so a reload on any project page landed on the dashboard: the list hook ran once with no user (`[]`, loading false) and the first render with the user redirected before the fetch (#297) | A redirect-on-missing guard needs a loading signal that is correct during render (child effects run before the parent's). Test route guards with a reload, not only in-app navigation. |
| `issue-291.spec.ts` waited for the MDP's "DEMAND BY LOAD TYPE" heading, which renders at 0 circuits, read the page once and got "TOTAL DEMAND 0.0 kVA"; two more specs read before the panels loaded (the Stale banner, the 800 A prefill) (#317) | A spec reads page text once the text that proves its data loaded is there (`tests/e2e/issues/pageText.ts::mainTextWhen`). Reproduce a flake by holding the response back, then sweep every one-time read in the folder. |
| A spec faked the browser clock past the token's expiry; the page refreshed the token chain, #297's spec then reused a token two steps back and Supabase revoked the e2e session. Re-signing in, the setup's failure snapshot saved the typed QA password to disk (#328) | Never fake the clock in a signed-in context; change the time zone instead. A Playwright project that types a secret runs with trace, screenshot and video off and empties the field on every path; error-context.md records textbox values. |
| The Equipment Specs form emitted an emptied AIC rating as `undefined`, which `JSON.stringify` drops from the PATCH, so "Select AIC rating..." never cleared a saved 42 kA (the optimistic update hid it); its emit effect listed the parent's inline `onChange` and looped ("Maximum update depth exceeded") (#314) | Clear a column by sending `null`, never `undefined` or `''`; check the request body, not the optimistic UI. A child effect that calls a parent callback reads it from a ref. |
| The Material Take-Off wrapped CSV cells in quotes without doubling the quotes inside them (`3/4"` broke the row), while the commercial export already had a correct private `csvEscape`; outlet and junction boxes were a share of every circuit, so feeder-only panels listed outlet boxes (#321) | Before writing a formatter, grep for one (`csvEscape`); move it to `lib/` instead of copying it, and check the import doesn't pull a heavy module (react-pdf) into the page. An estimate per circuit says which circuits it applies to. |
| Every list hook subscribed to realtime, but 23 of its tables (panels, circuits, feeders, projects…) were never in the `supabase_realtime` publication, so no event fired and the #234 race guard defended against events that didn't arrive (#315). Also: E-201 printed "MDP (MDP)", E-202 a main breaker without its unit, and the packet's filename used the UTC day | Check the database side of a client subscription (`pg_publication_tables`), not only the hook code. Format a number with its unit at every cell that prints it. A user-facing "today" is the local day (`lib/localDate.ts::localDateStamp`), never `toISOString()` (all sites moved in #327). |
| The Part III aggregate cited "NEC 220.51 (Fixed Appliances)" for water heaters (220.51 is fixed electric space heating, and that's not its title) and "220.60 (Omit 0.0kVA cooling)" when nothing was omitted (#206) | A citation names the section that sets the value printed beside it, by its real title; a section about omitting prints only when something is omitted. Check the title in the code book (Obsidian NEC 2023) before writing it. Shorten a citation by dropping its title (a parenthetical after a space), never at the first "(": that cut "220.14(A)" to "220.14" on E-301 (`shortCitation`). Assert a packet citation per page. |
| The Commercial Load Calculator labelled the HVAC current "MCA (Amps)" and used it as the load (MCA already holds 125 % of the largest motor, and "Continuous" added 125 % again), citing 440.6 in the app and 440.22 (OCPD sizing) in the PDF (#205) | A load input asks for the value the load is (RLA, 440.6(A)), not a conductor-sizing value. One citation constant feeds the app, the PDF and the CSV (`HVAC_CITATION`); grep all three when a citation changes. |
| `redeem_promo_code` (SECURITY DEFINER, made in the SQL editor) took the account from its `p_user_id` argument and the anon role could call it, and an RLS policy let anyone SELECT the active codes: the public key alone could list every code and redeem one onto any account (#335) | A SECURITY DEFINER function takes the user from `auth.uid()` and revokes anon (Database Changes 5); read the policies on the tables it touches. Run `get_advisors` (security) after any DDL and before calling the app ready. |
| "Forgot your password?" linked to a route that didn't exist (a blank page), a recovery link signed the user in on the dashboard with no form to set a password, and an expired email link was a blank page, so the sign-in page's "link expired" notice never rendered (#330) | Supabase email links land on the root with parameters in the hash, which HashRouter reads as a route: read them once at load (`readAuthLink`). Test an auth flow by opening its email link's URL shape, with the auth endpoints stubbed. A redirect effect that lists `navigate` re-runs on every path change: fire it once. |
| 22 places took "today" or "this month" from `toISOString()` (the UTC day): from 7 PM in Florida the packet's Revision Log printed tomorrow beside a footer "Generated" today, invoices due today turned Overdue, billing forms defaulted to tomorrow, and downloads were named for tomorrow (#327) | "Today" the user reads is `lib/localDate.ts` (`localDateStamp`, `localMonthStamp`); `tests/localDate327.test.ts` fails if a new `toISOString()` date, month or clock slice appears in app code. Calendar arithmetic done entirely in UTC is fine; a reader must match its writer's convention (permit dates are stored at UTC midnight). The reverse problem, a typed date stored as UTC, is #337. |
| The e2e setup reused the saved QA session as it found it, so a run could start with less token left than it took; the tests, each loading the same file, refreshed the same refresh token, and Supabase revoked the session mid-run (23 tests failed). Each death cost the owner a manual sign-in (#339) | `auth.setup.ts` renews the saved session once per run before any browser opens (`renewSavedSession`), so no test refreshes and the token on disk stays unspent. A shared session under refresh-token rotation has one renewer; a dead session is a bug to trace, never routine re-sign-in. |
| `backend/requirements.txt` pinned nothing: pydantic-ai 2.0 (2026-06-23) reached the next Railway build and the backend crashed at import on every deploy from 2026-07-09 to 2026-11-24 ("success" then "failure" 12–24 s later); its agents' model had also been shut down. The first proposed replacement model was itself deprecated a week later (#334) | A dependency file a platform installs on every deploy pins exact versions; test a bump with a clean install that must start. Reproduce a deploy crash from the dependency file before reading code. Read the provider's deprecation table before choosing a model (#343: the Copilot's turn). Railway Healthcheck Path = `/health`. |
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
