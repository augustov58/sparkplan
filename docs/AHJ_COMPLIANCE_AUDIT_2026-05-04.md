# AHJ Compliance Audit — Multifamily Permit Packet

**Date:** 2026-05-04
**Last Updated:** 2026-05-15
**Audited artifact:** `example_reports/Permit_Packet_Multifamily_Test_2026-05-05.pdf` (27 pages, react-pdf, 124 KB)
**Audit basis:** FL AHJ requirements per `business/STRATEGIC_ANALYSIS.md` + Obsidian `SparkPlan Analysis/` (FL Pilot Revised Feb 2026, Competitive Landscape Apr 2026, OAI Market Viability May 2026) + **City of Orlando "EV Charging Station Permit Checklist"** (sourced 2026-05-08, both EV-from-existing and EV-from-new-service paths)
**Scope:** 5 FL pilot AHJs — Orlando (Orange), Miami-Dade, Pompano Beach (Broward), Davie (Broward), Hillsborough/Tampa
**Sourcing caveat:** Orlando + Pompano + Davie + Miami-Dade validated at High confidence against official sources (MD upgraded 2026-05-12 second pass via Residential + Commercial PRGs — Residential PRG cites NEC 2014; Commercial PRG cites NEC 2020 — see H34). Hillsborough/Tampa Medium-High after second pass; Fire Marshal Knox-box stance remains intractable without phone calls. See [`docs/ahj-source-checklists/SUMMARY.md`](./ahj-source-checklists/SUMMARY.md) for full sourcing map. **20 new candidate H-findings (H18–H37) surfaced** by the two research passes. Highest-severity: **H19 (HVHZ wind-anchoring documentation)** — cross-validated statewide for any outdoor pedestal/bollard EVSE; **H34 (NEC-edition-per-lane)** — code-basis block must vary by residential vs commercial; **H35 (Hillsborough deprecated PDF checklists)** — manifest research must shift to webpage-only sources. Cross-cutting architectural findings: **`building_type` (residential / multi-family / commercial) is a first-class manifest axis orthogonal to Sprint 2A's H17 lane**; **Miami-Dade requires a `subjurisdiction` discriminator** (34 munis + unincorporated; County RER handles only unincorporated). See [`sprints/sprint2c-ahj-manifests.md`](./sprints/sprint2c-ahj-manifests.md). **M1 build order revised:** Pompano → **Miami-Dade** (promoted from #3 → #2 after gap closure) → Davie → Hillsborough/Tampa.

---

## Document layout

This is the index. Per-sprint detail lives in [`docs/sprints/`](./sprints/). Load only the sprint(s) you're actively working on.

| Doc | Loads when… | Approx tokens |
|---|---|---|
| **This file** (`AHJ_COMPLIANCE_AUDIT_2026-05-04.md`) | always — provides matrices + status board pointer + cross-cutting refs | ~5k |
| [`docs/sprints/README.md`](./sprints/README.md) | "what sprints exist?" / "what's next?" / dependency graph | ~2k |
| [`docs/sprints/sprint1-engine-fixes.md`](./sprints/sprint1-engine-fixes.md) | diagnosing a calc-engine-shaped bug; investigating Sprint 1 patterns | ~12k |
| [`docs/sprints/sprint2a-form-factor.md`](./sprints/sprint2a-form-factor.md) | working on Sprint 2A PRs 4 / 5 | ~10k |
| [`docs/sprints/sprint2b-uploads.md`](./sprints/sprint2b-uploads.md) | scoping or building Sprint 2B uploads / merge engine | ~3k |
| [`docs/sprints/sprint2c-ahj-manifests.md`](./sprints/sprint2c-ahj-manifests.md) | sourcing AHJ checklists; building M1 | ~3k |
| [`docs/sprints/sprint3-pe-seal.md`](./sprints/sprint3-pe-seal.md) | designing or implementing PE seal workflow | ~7k |
| [`docs/sprints/sprint4-polish.md`](./sprints/sprint4-polish.md) | working on polish backlog | ~2k |

Cold-read cost for typical sessions: index (~5k) + 1 sprint file = **~7–17k tokens**, vs prior monolithic ~39k.

---

## Status snapshot

- **Sprint 1** — ✅ COMPLETE 2026-05-07 (10 calc-engine fixes)
- **Sprint 2A** — ✅ COMPLETE 2026-05-10 (19/19; 5 themed PRs)
- **Sprint 2B** — ✅ COMPLETE 2026-05-13 (PR #45 foundation + PR #47 upload UI + PR #49 merge engine + PR #51 Orlando manifest scaffold merged)
- **Sprint 2C** — ✅ COMPLETE 2026-05-14 (M1 engine via PR #54 `e6d9133` + 4 manifests Pompano/MD/Davie/Hillsborough via PR #56 `a4bf21a`)
- **Sprint 3** — ⚪ Not started
- **Sprint 4** — 🔵 Deferred

For details on each sprint's open work, dependencies, and architectural patterns, follow the links in the table above.

---

## AHJ Compliance Matrix

✓ = currently provided; ⚠️ = present but flawed; ❌ = missing; 🔴 = present but incorrect; – = not applicable

### Legacy strategic-bullets matrix (Orlando validated 2026-05-08; others Sprint 2C)

| Required artifact | Orlando | Miami-Dade | Pompano | Davie | Hillsborough | Currently in packet | Closes |
|---|---|---|---|---|---|---|---|
| Permit application cover | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | C3 |
| One-line / riser diagram | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | M6 + H9 AIC overlay (PR #40) |
| Load calculation (NEC 220) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | C1 |
| Panel schedules | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | C4, C6 (M5 still open) |
| Grounding plan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | M3 (PR #40) |
| Equipment specs (mfr / AIC / UL) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | H15 + H9 AIC overlay (PR #40) |
| Voltage drop / feeder sizing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | C2 |
| Available fault current / SCS | ✓ | ✓ | – | – | ✓ | ✓ | H9 page (PR #31) + H9 AIC overlay (PR #40) |
| Sheet ID (`E-###`) | – | ✓ | – | – | – | ✓ | H3 |
| FBC + NFPA-70 references | – | ✓ | ✓ | ✓ | ✓ | ✓ | C7 + H4 |
| Notice of Commencement (>$5k) | ✓ | ✓ | – | – | – | ✓ upload slot + Orlando per-AHJ wiring (non-SFR predicate) | H5 (Sprint 2B; Orlando ✅ PR #51; other AHJs → Sprint 2C M1) |
| HOA / condo approval letter | – | – | ✓ | – | – | ✓ upload slot; Orlando defaults OFF | H6 (Sprint 2B; Orlando ✅ PR #51 (declared OFF); Pompano wiring → Sprint 2C M1) |
| Site plan / survey | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ upload slot + Orlando per-AHJ wiring (ON) | H7 (Sprint 2B; Orlando ✅ PR #51; other AHJs → Sprint 2C M1) |
| Equipment cut sheets / manuals | ✓ | – | ✓ | ✓ | – | ✓ upload slot + Orlando per-AHJ wiring (ON, #7 EVSE UL listings) | H8 (Sprint 2B; Orlando ✅ PR #51; Pompano wiring → Sprint 2C M1) |
| Fire stopping schedule | ✓ | ? | ? | ? | ? | ✓ upload slot + Orlando per-AHJ wiring (ON, #8 both paths) | H16 (Sprint 2B; Orlando ✅ PR #51) |
| HVHZ wind-anchoring (outdoor pedestal/bollard) | – | ✓ | ✓ | ? | ? | ✓ upload slot + Orlando manifest declares statewide ON | H19 (Sprint 2B upload + Orlando ✅ PR #51; MD + Pompano enforcement → Sprint 2C M1) |
| General Notes page (NEC + VD) | ✓ | ? | ? | ? | ? | ✓ | H12 + H13 |
| Per-sheet contractor signature | ✓ | ? | ? | ? | ? | ✓ | C8 |
| EVEMS narrative (NEC 625.42) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | H10 |
| Knox-box / emergency shutoff | – | – | – | ✓ commercial | – | ✓ commercial-only conditional | H11 |
| EVSE labeling per NEC 625.43 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | H11 |
| **PE-signed + sealed plans (≥277V or commercial)** | ✓ | ✓ | ✓ | ✓ | ✓ | 🔴 | C5 (Sprint 3) |
| Revision log | – | ✓ | – | – | – | ✓ | H2 |
| Cover sheet TOC | – | ✓ | – | – | – | ✓ | H1 |
| FS 471.003(2)(h) exemption screening | – | – | – | – | – | ✓ | H17 (PR #41) |
| Jurisdiction checklist engine | – | – | – | – | – | ❌ | M1 (Sprint 2C) |

### Orlando — line-by-line validated matrix (sourced 2026-05-08)

Orlando's official "EV Charging Station Permit Checklist" forks based on whether EV chargers are fed from existing electrical or from new electrical service. The packet generator drives off `service_modification_type` (Sprint 2A PR 5 schema addition).

| Orlando line item | EV-fed-from-existing | EV-fed-from-new-service | Currently in packet | Sprint |
|---|---|---|---|---|
| #1 — Contractor name + license on **all** drawings, signed by license holder | Required | Required | ✓ | done (C8) |
| #1b — Engineered plans required if equipment is 277/480V | Conditional | Conditional | 🔴 no PE seal infrastructure | Sprint 3 (C5) |
| #2 — General note of compliance with NEC 2020 | Required | Required | ✓ | done (H12 + C7) |
| #3 — General note: VD ≤ 3% feeder, 3% branch, 5% combined | Required | Required | ✓ | done (H13) |
| #4 — One-line: raceways, conductors, OCPD + voltage/phase/amperage/AIC labels per node | Required (existing path) | Required (new-service path) | ✓ M6 paginated + H9 AIC overlay per node | done (PR #40) |
| #5 (existing) — Revised existing panel schedule with demand load | Required | n/a | ✓ post-C1 — could add explicit "Revised" label + delta narrative | 2A enhancement (small) |
| #5 (new-service) — Available fault current calculation at service main breaker | n/a | Required | ✓ | done (H9 page) |
| #6 (existing) — Site plan with existing electrical panel + new EV charger locations | Required | rolls into #7 | ❌ | Sprint 2B (H7) |
| #6 (new-service) — Grounding detail with applicable electrodes + GEC size | n/a | Required | ✓ project-specific GEC sized per NEC 250.66 | done (PR #40, M3) |
| #7 — EVSE specs: UL-2202 + UL-2594 listing/label | Required | Required | ✓ specs; 🔴 H8 manufacturer cut sheet upload still 2B | done specs (H15); 2B cut sheet (H8) |
| #8 — Approved fire stopping system for fire-rated penetrations | Required | Required | ❌ | Sprint 2B (H16) |
| 220.87 conditions narrative (when claimed) | Required (existing path) | n/a | ✓ | done (H14) |

---

## F-tier follow-ups (cross-sprint tech debt; not blocking)

These touch multiple sprints' code and don't fit cleanly inside one sprint file. Tracked here at the index level.

- **F1** — Replace EV/house panel name-string-match in `buildMultiFamilyContext` with typed `panel_role` discriminator. (Originated Sprint 1 C1.)
- **F2** — Extract NEC 220.84 table from inline `multiFamilyEV.ts:33-57` to `data/nec/table-220-84.ts`. (Originated Sprint 1 C1.)
- **F3** — Legacy "Demand Factor Calculation" tile in MDP UI shows direct circuits; should be hidden on MDP for multi-family or relabeled. (Originated Sprint 1 C1.)
- **F4** — Replace EVEMS-managed circuit-description heuristic with explicit `panels.is_evems_managed` boolean + `panels.evems_setpoint_va` integer when schema is next touched. (Originated Sprint 1 C4.)
- **F5** — `addEVInfrastructure` orphan-cleanup pattern may apply to House Panel and Unit Panel meters when regenerated. Audit and apply if so. (Originated Sprint 1 C4 review.)
- **F6** — Rename `services/calculations/residentialLoad.ts:calculateSingleFamilyLoad` → `calculateSingleFamilyLoadStandard` (it implements NEC 220.40 Standard Method despite header saying 220.82); add proper `calculateSingleFamilyLoadOptional` (NEC 220.82) and unify autogen + display layer on it. (Originated Sprint 1 C4.)
- **F7** — **Acceptance evidence capture** (per `FL_PILOT_REVISED_REPORT.md` §7 #2). After packet is submitted to AHJ and approved, capture metadata: AHJ name + jurisdiction code, packet version hash, submission/approval dates, plan-reviewer comments. Surface as "Passed in [Orlando]" badge on subsequent packets to the same AHJ + as a rollup ("87 packets passed in 5 FL AHJs since 2026-Q3"). **Moat-compounder** — the data flywheel that locks contractors in over time. New `packet_submissions` table.
- **F8** — **Enable RLS on `public.jurisdictions`** before Sprint 2C M1 populates it. Currently 0 rows so no exposure, but Supabase advisor flagged it 2026-05-12 during the PR #49 schema review. Should land alongside the first M1 manifest seed (or earlier as a one-line migration).

---

## Architectural Decisions

### Canvas vs Generator (settled 2026-05-08): NO canvas in v1

Tools like Kopperfield are canvas-first (drawio-based shape library + custom title block + PDF export). We deliberately do not build a canvas:

- **Three different product shapes occupy this space:** ETAP/SKM = calc with limited drawing; Kopperfield = canvas with starter calc; **SparkPlan = calc with rendered drawings**. Building a canvas dilutes the calc-engine wedge and competes with Kopperfield rather than ETAP/SKM.
- **Site plans are unavoidably user-supplied.** SparkPlan has no spatial data model. Whether or not we have a canvas, contractor brings a marked-up site plan PDF (Bluebeam, Adobe, AutoCAD LT, hand-drawn-and-scanned, or Kopperfield itself). Sprint 2B's upload-and-title-sheet engine splices the marked-up upload into the packet — same outcome as a canvas, less build cost.
- **Auto-generated one-line covers ~70% of EV-retrofit projects** post-Sprint-2A (M6 layout fix + AIC labels per Orlando #4 new-service).

**Trigger condition for revisiting:** if pilot contractors consistently report friction with "I want to add a callout to your auto-generated one-line and have to upload to Bluebeam first," **then** add a canvas in Sprint 4+. Build only on demand-pull. The first 2–3 FL pilot contractors are the signal.

---

## Cross-cutting NEC reminders

These rules surface across multiple sprints and bear repeating at the top level:

- **NEC 220.57(A)** — Per-EVSE branch-circuit load = `max(7,200 VA, nameplate)`. Not a demand factor.
- **NEC 625.40 / 625.42 (EVEMS)** — Branches at full continuous nameplate × 1.25; FEEDER/SERVICE may be sized to managed setpoint.
- **NEC 220.82** — Single-family Optional. First 10 kVA general @ 100%, rest @ 40%; + larger of A/C vs heat @ 100%.
- **NEC 220.84** — Multi-family Optional, ≥3 units. Apply table demand factor to dwelling base; non-dwelling (EV, common areas) excluded, added back at 100%.
- **NEC 220.87 (existing-load)** — Measured (utility bill, load study) value used directly. Calculated (panel schedule, manual) gets 125% multiplier. **Safety-critical** per CLAUDE.md.
- **NEC 215.2(A)(1)** — Feeder ampacity ≥ 1.25 × continuous demand.
- **NEC 408 (panelboards)** — Panel schedule must show every protective device including feeder breakers.

Per-sprint NEC references are documented in each sprint file.

---

## References

- `business/STRATEGIC_ANALYSIS.md` — strategic positioning, NEC 220.84 / 220.87 differentiator.
- `business/DISTRIBUTION_PLAYBOOK.md` — pilot AHJ list.
- `CLAUDE.md` — calculation service rules, NEC critical rules, verification protocol.
- Obsidian `SparkPlan Analysis/Reconciliation Notes.md` — cross-validated strategy.
- Obsidian `SparkPlan Analysis/FL_PILOT_REVISED_REPORT.md` §3.2 — PE seal workflow constraints (FBPE).
- Obsidian `SparkPlan Analysis/Market Viability Analysis (Deep Research OAI).md` — AHJ checklist evidence.
- NEC 2020: Articles 215, 220.42, 220.57, 220.84, 220.87, 240.4(D), 250, 408, 625.42, 625.43, 750.
- FBPE — Florida Board of Professional Engineers, signing/sealing requirements.
- FS 471.003(2)(h) — Contractor design exemption thresholds.
- FS 471.023 — Business-entity registration (for Sprint 3 PE service offering).
- Florida Building Code 8th ed (2023); NFPA-70 (2020).
