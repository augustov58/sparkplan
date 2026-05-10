# AHJ Compliance Audit — Multifamily Permit Packet

**Date:** 2026-05-04
**Last Updated:** 2026-05-10
**Status:** Sprint 1 ✅ COMPLETE 2026-05-07 (10 calc-engine fixes). Sprint 2A in progress 2026-05-08 → 2026-05-10: **14 of 19 findings shipped** across PR 1 (`92126eb`), PR #23 (`6859328`), PR #31 (`dacaab2`). **Remaining Sprint 2A: 2 themed PRs** — PR 4 (M3 + M6 + H9 AIC overlay) + PR 5 (H17 + settings-JSON additions).
**Audited artifact:** `example_reports/Permit_Packet_Multifamily_Test_2026-05-05.pdf` (27 pages, react-pdf, 124 KB).
**Audit basis:** FL AHJ requirements per `business/STRATEGIC_ANALYSIS.md` + Obsidian `SparkPlan Analysis/` (FL Pilot Revised Feb 2026, Competitive Landscape Apr 2026, OAI Market Viability May 2026) + **City of Orlando "EV Charging Station Permit Checklist"** (sourced 2026-05-08, both EV-from-existing and EV-from-new-service paths).
**Scope:** 5 FL pilot AHJs — Orlando (Orange), Miami-Dade, Pompano Beach (Broward), Davie (Broward), Hillsborough/Tampa.
**Sourcing caveat:** Only Orlando is validated against the official checklist. Miami-Dade / Pompano / Davie / Hillsborough still sourced from strategic-analysis bullets — Sprint 2C manifest work depends on closing that gap (additional Hxx findings likely).

**Companion docs:**
- [`docs/AHJ_AUDIT_RESOLVED_LOG.md`](./AHJ_AUDIT_RESOLVED_LOG.md) — full resolution narratives for shipped findings (Sprint 1 C1–C6, B-1 + Sprint 2A C7, C8, M4, M8, H1–H4, H10–H15, H9 page). Load on-demand for bug-pattern reference.
- Per-PR detail also in GitHub PR descriptions: #15 (C1), #17 (C3+B-1+C6), #19 (C4), #22 (PR 1 squash `92126eb`), #23 (`6859328`), #31 (`dacaab2`).

---

## Executive Summary

This packet would **fail intake at all five target FL AHJs** for different reasons. Sprint 1 closed all 10 calculation-engine bugs (the most consequential being NEC 220.84 multifamily demand factors not being applied — the very feature SparkPlan's positioning depends on). Sprint 2A has closed 14 of 19 form-factor / content findings; 5 remain across 2 themed PRs. Sprint 2B (uploads + title-sheet engine) and Sprint 2C (per-AHJ manifests + checklist engine) follow. Sprint 3 (PE seal workflow / C5) is the moat-building upsell, sequenced after the engine + uploads are correct because sealing wrong calculations would compound the problem.

---

## What's Open

### 🔴 Sprint 2A remaining — 5 findings, 2 PRs

#### **PR 4 — Diagram work (M3 + M6 + H9 AIC overlay)**

These bundle because all three edit the same SVG render paths in `OneLineDiagram.tsx` (interactive ~line 2340 + print/export ~line 3290) or its sibling grounding renderer.

- **M6 — Riser diagram layout broken (page 3).** Labels overlap; "15 meters positions" wraps mid-character. Fix: switch to landscape for ≥10 panels, or paginate. Code: `OneLineDiagram.tsx` print/export render (~line 3290 per CLAUDE.md). Both SVG renderings must be updated for visual changes.
- **H9 (AIC overlay) — AIC + voltage/phase/amperage labels per node on one-line.** Required by Orlando item #4 new-service path. The page-only portion of H9 (Available Fault Current Calculation page) shipped in PR #31 — only the per-node overlay remains. Code: same `OneLineDiagram.tsx` render paths.
- **M3 — Project-specific grounding detail with GEC sized per NEC 250.66/250.122.** Required by Orlando new-service item #6 — page 9-10 has generic grounding, Orlando wants project-specific detail. Code: `PermitPacketGenerator.tsx` grounding page.

#### **PR 5 — Engine + schema (H17 + settings JSON)**

- **H17 — FS 471.003(2)(h) contractor-exemption screening engine.** Florida-statute-driven, not AHJ-specific. Per `FL_PILOT_REVISED_REPORT.md` §3.1 this is a **must-have** component of Florida Permit Mode v1, paired with the M1 AHJ checklist engine. Without it, contractors don't know which submission lane (exempt vs PE-sealed) applies and may pay for unnecessary PE review. New `services/permitMode/exemptionScreening.ts` pure function: takes project (value, res/com, service capacity @ 240V, scope flags) → returns `{ lane: 'exempt' | 'pe-required', reason, ahjOverride? }`. Drives cover-sheet language (*"Designed under FS 471.003(2)(h) contractor exemption"* vs *"PE-sealed plans required per [Orlando AHJ]"*) and gates whether the PE seal upsell flow is even offered. AHJ overrides (e.g., Orlando 277/480V → PE-required regardless of statute) come from manifest in Sprint 2C.
- **Settings JSON additions (no DB migration required — `projects.settings` is JSON):**
  - `service_modification_type` enum (`'existing'` | `'service-upgrade'` | `'new-service'`) — drives the Orlando manifest fork.
  - `scope_flags` JSON: `service_upgrade`, `ct_cabinet`, `meter_stack`, `switchgear`, `multi_tenant_feeder`, `evems_used` — drives H17 inputs.
  - `estimated_value_usd` — drives H17 input.

### 🟠 Sprint 2B — Upload + merge engine + title sheet pattern

Architectural inflection. Adds `pdf-lib` (~190 KB, browser-safe, pure-JS PDF read/merge/embed/sign — also lays groundwork for Sprint 3 PE seal because PAdES digital signing is in the same library). Plus Supabase Storage `permit-attachments` bucket, `project_attachments` DB table, upload UI, title-sheet generator, AHJ manifest scaffold (Orlando first).

**Closes the upload-dependent findings:**
- **H5** — Notice of Commencement (NOC) placeholder for projects > $5,000 (Orlando).
- **H6** — HOA / condo approval letter placeholder (Pompano multi-family).
- **H7** — Site plan / survey (all 5 AHJs; Orlando items #6/#7).
- **H8** — Equipment cut sheets / installation manuals (Pompano; Orlando item #7 EVSE specs).
- **H16** — Fire stopping schedule for fire-rated penetrations (Orlando item #8).

**Architecture:** `pdf-lib` produces SparkPlan portion as `Uint8Array` → for each `source: 'uploaded'` manifest section, generate title sheet + load user PDF + `pdf-lib` appends → final pass stamps continuous sheet IDs in lower-right of every page (including user uploads) + applies per-page contractor footer.

**Estimated complexity:** 1–2 weeks.

### 🟡 Sprint 2C — Per-AHJ manifests + checklist engine M1

Depends on Sprint 2B's manifest scaffold + on **collecting the four other AHJ checklists** (Miami-Dade, Pompano, Davie, Hillsborough) — non-coding research, can start in parallel with Sprint 2A.

**Closes:**
- **M1** — Jurisdiction checklist engine (replaces decorative `[ ]` boxes on page 12). Pure function takes packet AST + AHJ manifest, returns `{ requirements, summary }`. Renders as `[X]` / `[ ]` / `❌ MISSING` per requirement.

**Estimated complexity:** 1 week coding + 1–2 days research per AHJ for sourcing.

### 🟣 Sprint 3 — PE Seal Workflow (C5)

**Strategic positioning (validated 2026-05-08 against Obsidian `FL_PILOT_REVISED_REPORT.md` §3.2):** PE seal is the **moat and the upsell**, not the core product. **Augusto Valbuena (platform owner, FL-licensed PE) is the PE** — not "bring your own PE cert." Centralized cert held server-side; Augusto reviews via a privileged "PE Reviewer" UI; "Approve & Seal" triggers server-side PAdES signing on the **electrical-engineering sheet range only** (not site plan / cut sheets / fire stopping — those remain contractor-signed or other-professional-sealed). This vertical-integration is the strongest moat — can't be easily replicated by national competitors.

**Hard prerequisites:**
- Sprint 2B (`pdf-lib` is also the PAdES signer).
- Pricing decision settled (cross-report reconciliation: Feb proposed $249–599/mo premium PE-led; April proposed $29/$49/$149 PLG). Don't ship seal infrastructure until bundle math is settled — Augusto's license is on the hook for whatever volume the tier promises.
- Cert vendor selection (IdenTrust, GlobalSign, or another FBPE-accepted CA).
- FBPE business-entity registration (FS 471.023).
- Secret-management ADR (Supabase Vault vs AWS KMS vs HashiCorp Vault).

**Estimated complexity:** 2–4 weeks. Multi-session sprint.

**See:** [`docs/AHJ_AUDIT_RESOLVED_LOG.md`](./AHJ_AUDIT_RESOLVED_LOG.md) is **not** the home for Sprint 3 design — when Sprint 3 starts, create `docs/SPRINT3_PE_SEAL_DESIGN.md` for the full architecture (PE Reviewer UI, cert management, capacity model 20–40 projects/week, liability scaffolding, multi-PE forward path, sheet-range signing scope).

### 🟢 Sprint 4 — Polish backlog (defer until Sprint 2 + 3 done)

- **M2** — NEC compliance summary expanded (215, 220.18, 240.4(D), 625.42, 110.16). Code: `PermitPacketGenerator.tsx` compliance summary component.
- **M3 (sub-feature)** — Grounding checklist `[X]` (designed/specified) vs `[ ]` (field-verify) distinction. M3 main scope is in PR 4; this checkbox-state distinction is the polish layer.
- **M5** — Collapse 12 byte-identical unit panel pages (16–27) into "Typical Unit" + roster.
- **M7** — Equipment Specs page-break fix (orphan blank page 7).
- LOW polish: footer timestamp + packet ID; cover page AHJ name + jurisdiction code prominent.
- **Canvas evaluation:** if pilot contractors report friction with auto-generated one-line markup, scope a canvas surface (likely embed drawio with custom shape library mirroring our project schema). **Demand-pulled, not preemptive** (decision settled 2026-05-08).

### F-tier follow-ups (tech debt; not blocking)

- **F1** — Replace EV/house panel name-string-match in `buildMultiFamilyContext` with typed `panel_role` discriminator.
- **F2** — Extract NEC 220.84 table from inline `multiFamilyEV.ts:33-57` to `data/nec/table-220-84.ts`.
- **F3** — Legacy "Demand Factor Calculation" tile in MDP UI shows direct circuits; should be hidden on MDP for multi-family or relabeled.
- **F4** — Replace EVEMS-managed circuit-description heuristic with explicit `panels.is_evems_managed` boolean + `panels.evems_setpoint_va` integer when schema is next touched.
- **F5** — `addEVInfrastructure` orphan-cleanup pattern may apply to House Panel and Unit Panel meters when regenerated. Audit and apply if so.
- **F6** — Rename `services/calculations/residentialLoad.ts:calculateSingleFamilyLoad` → `calculateSingleFamilyLoadStandard` (it implements NEC 220.40 Standard Method despite header saying 220.82); add proper `calculateSingleFamilyLoadOptional` (NEC 220.82) and unify autogen + display layer on it.
- **F7** — **Acceptance evidence capture** (per `FL_PILOT_REVISED_REPORT.md` §7 #2). After packet is submitted to AHJ and approved, capture metadata: AHJ name + jurisdiction code, packet version hash, submission/approval dates, plan-reviewer comments. Surface as "Passed in [Orlando]" badge on subsequent packets to the same AHJ + as a rollup ("87 packets passed in 5 FL AHJs since 2026-Q3"). **Moat-compounder** — the data flywheel that locks contractors in over time. New `packet_submissions` table.

---

## AHJ Compliance Matrix

✓ = currently provided; ⚠️ = present but flawed; ❌ = missing; 🔴 = present but incorrect; – = not applicable

### Legacy strategic-bullets matrix (Orlando validated 2026-05-08; others Sprint 2C)

| Required artifact | Orlando | Miami-Dade | Pompano | Davie | Hillsborough | Currently in packet |
|---|---|---|---|---|---|---|
| Permit application cover | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ post-C3 (advisory schemas) |
| One-line / riser diagram | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠️ (M6 + H9 AIC overlay) |
| Load calculation (NEC 220) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ post-C1 |
| Panel schedules | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ post-C4/C6 (M5 still open) |
| Grounding plan | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠️ (M3 — Orlando-specific detail still pending) |
| Equipment specs (mfr / AIC / UL) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ post-H15; AIC overlay still PR 4 |
| Voltage drop / feeder sizing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ post-C2 |
| Available fault current / SCS | ✓ | ✓ | – | – | ✓ | ✓ post-H9 page; AIC overlay PR 4 |
| Sheet ID (`E-###`) | – | ✓ | – | – | – | ✓ post-H3 |
| FBC + NFPA-70 references | – | ✓ | ✓ | ✓ | ✓ | ✓ post-H4 |
| Notice of Commencement (>$5k) | ✓ | ✓ | – | – | – | ❌ (H5 — Sprint 2B) |
| HOA / condo approval letter | – | – | ✓ | – | – | ❌ (H6 — Sprint 2B) |
| Site plan / survey | ✓ | ✓ | ✓ | ✓ | ✓ | ❌ (H7 — Sprint 2B) |
| Equipment cut sheets / manuals | ✓ | – | ✓ | ✓ | – | ❌ (H8 — Sprint 2B) |
| Fire stopping schedule | ✓ | ? | ? | ? | ? | ❌ (H16 — Sprint 2B) |
| General Notes page (NEC + VD) | ✓ | ? | ? | ? | ? | ✓ post-H12, H13 |
| Per-sheet contractor signature | ✓ | ? | ? | ? | ? | ✓ post-C8 |
| EVEMS narrative (NEC 625.42) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ post-H10 |
| Knox-box / emergency shutoff | – | – | – | ✓ commercial | – | ✓ post-H11 (commercial-only conditional) |
| EVSE labeling per NEC 625.43 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ post-H11 |
| **PE-signed + sealed plans (≥277V or commercial)** | ✓ | ✓ | ✓ | ✓ | ✓ | 🔴 (C5 — Sprint 3) |
| Revision log | – | ✓ | – | – | – | ✓ post-H2 |
| Cover sheet TOC | – | ✓ | – | – | – | ✓ post-H1 |
| FS 471.003(2)(h) exemption screening | – | – | – | – | – | ❌ (H17 — Sprint 2A PR 5) |

### Orlando — line-by-line validated matrix (sourced 2026-05-08, forked by service-modification type)

Orlando's official "EV Charging Station Permit Checklist" forks based on whether EV chargers are fed from existing electrical or from new electrical service. The packet generator must drive off `service_modification_type` field on the project (Sprint 2A PR 5 schema addition).

| Orlando line item | EV-fed-from-existing | EV-fed-from-new-service | Currently in packet | Sprint |
|---|---|---|---|---|
| #1 — Contractor name + license on **all** drawings, signed by license holder | Required | Required | ✓ post-C8 | done |
| #1b — Engineered plans required if equipment is 277/480V | Conditional | Conditional | 🔴 no PE seal infrastructure (C5) | 3 |
| #2 — General note of compliance with NEC 2020 | Required | Required | ✓ post-H12, C7 | done |
| #3 — General note: VD ≤ 3% feeder, 3% branch, 5% combined | Required | Required | ✓ post-H13 | done |
| #4 — One-line: raceways, conductors, OCPD + voltage/phase/amperage/AIC labels per node | Required (existing path) | Required (new-service path) | ⚠️ one-line present; M6 layout + H9 AIC overlay pending | **PR 4** |
| #5 (existing) — Revised existing panel schedule with demand load | Required | n/a | ✓ post-C1 — could add explicit "Revised" label + delta narrative | 2A enhancement |
| #5 (new-service) — Available fault current calculation at service main breaker | n/a | Required | ✓ post-H9 (PR #31) | done |
| #6 (existing) — Site plan with existing electrical panel + new EV charger locations | Required | rolls into #7 | ❌ (H7) | 2B |
| #6 (new-service) — Grounding detail with applicable electrodes + GEC size | n/a | Required | 🟡 (M3) | **PR 4** |
| #7 — EVSE specs: UL-2202 + UL-2594 listing/label | Required | Required | ✓ post-H15 (specs); 🔴 (H8 — manufacturer cut sheet upload still 2B) | done specs; 2B cut sheet |
| #8 — Approved fire stopping system for fire-rated penetrations | Required | Required | ❌ (H16) | 2B |
| 220.87 conditions narrative (when claimed) | Required (existing path) | n/a | ✓ post-H14 (PR #31) | done |

---

## Sprint 2A — Recommended Commit Order for the Final 2 PRs

**Pre-flight (start every Sprint 2A session):**

1. **Confirm latest main:** `git checkout main && git pull --ff-only origin main && git log --oneline -3` should show `dacaab2` (PR #31) at top.
2. **Test baseline:** `npm test` reports all green (was 181/181 post-Sprint 1, plus PR 1 + PR #23 + PR #31 additions). `npm run build` exits 0.
3. **Confirm Sprint 1 + Sprint 2A scoreboard intact:** regenerate the example permit packet (`example_reports/Permit_Packet_Multifamily_Test_<date>.pdf`) from the 12-unit MF + EVEMS audit fixture and skim:
   - Page 4 MDP load calc — three rows: Multi-Family Dwelling 220.84 41% + House 100% + EV 625.42 clamped; total ≈ 240 kVA / 999 A.
   - Page 8 voltage drop — realistic MDP→EV feeder values (no 14 AWG / 0 A row).
   - Page 13 MDP panel schedule — 14 synthesized feeder rows.
   - Page 14 EV Sub-Panel — 12 chargers @ 11,520 VA each, 300 A main breaker, EVEMS Aggregate Setpoint callout ~48 kVA.
   - Pages 15+ unit panels — 125 A bus rating, NEC 220.82 demand callout ~23 kVA / ~95 A.
   - Cover, footer, sheet IDs, TOC, revision log, general notes, EVEMS narrative, EVSE labeling, NEC 220.87 narrative, Available Fault Current page all rendering.

### PR 4 — Diagrams (M3 + M6 + H9 AIC overlay)

Bundle together because all edit `OneLineDiagram.tsx` SVG render paths or grounding-page renderer.

1. **M6 — Riser layout fix.** Switch to landscape for ≥10 panels OR paginate. Both interactive (~line 2340) AND print/export (~line 3290) renderings must be updated for visual changes. Visual verify on the audit fixture (15 meters, 14 panels).
2. **H9 AIC overlay.** AIC + voltage/phase/amperage labels per node on one-line. Required by Orlando #4 new-service. Same files as M6 — bundle in same commit if labels can layer cleanly on the corrected layout.
3. **M3 — Project-specific grounding detail.** GEC sized per NEC 250.66/250.122 (Orlando new-service #6). Code: grounding page in `PermitPacketGenerator.tsx`. Pull GEC size from existing service-conductor sizing.

**Visual verification per commit:** regenerate the audit packet, compare to prior visual snapshot. Same diagnostic pattern that worked across Sprint 1 (consumer-side wiring, not engine bugs).

### PR 5 — Engine + schema (H17 + settings JSON)

1. **Settings JSON additions** to `projects.settings` (no migration — JSON column): `service_modification_type` enum, `scope_flags` object, `estimated_value_usd` number. Update `lib/database.types.ts` typing for the JSON shape. Add UI to capture these in project setup (small form section).
2. **H17 — `services/permitMode/exemptionScreening.ts`** pure function. Inputs: project value, residential/commercial flag, service capacity @ 240V, scope flags. Output: `{ lane: 'exempt' | 'pe-required', reason, ahjOverride? }`.
3. **Cover-sheet language** drives off `lane`: *"Designed under FS 471.003(2)(h) contractor exemption"* vs *"PE-sealed plans required per [Orlando AHJ]"*.
4. **Gate the (future) PE seal upsell flow** off `lane === 'pe-required'`. Sprint 3 will read this gate.

---

## Architectural Decisions

### Canvas vs Generator (settled 2026-05-08): NO canvas in v1

Tools like Kopperfield are canvas-first (drawio-based shape library + custom title block + PDF export). We deliberately do not build a canvas:

- **Three different product shapes occupy this space:** ETAP/SKM = calc with limited drawing; Kopperfield = canvas with starter calc; **SparkPlan = calc with rendered drawings**. Building a canvas dilutes the calc-engine wedge and competes with Kopperfield rather than ETAP/SKM.
- **Site plans are unavoidably user-supplied.** SparkPlan has no spatial data model. Whether or not we have a canvas, contractor brings a marked-up site plan PDF (Bluebeam, Adobe, AutoCAD LT, hand-drawn-and-scanned, or Kopperfield itself). Sprint 2B's upload-and-title-sheet engine splices the marked-up upload into the packet — same outcome as a canvas, less build cost.
- **Auto-generated one-line covers ~70% of EV-retrofit projects** post-Sprint-2A (M6 layout fix + AIC labels per Orlando #4 new-service).

**Trigger condition for revisiting:** if pilot contractors consistently report friction with "I want to add a callout to your auto-generated one-line and have to upload to Bluebeam first," **then** add a canvas in Sprint 4+. Build only on demand-pull. The first 2–3 FL pilot contractors are the signal.

### Sprint 1 retrospective (full detail in [`AHJ_AUDIT_RESOLVED_LOG.md`](./AHJ_AUDIT_RESOLVED_LOG.md))

**Diagnostic shortcut, validated across 10 fixes:**
- In-app view correct but PDF disagrees → look at the PDF call site or autogeneration, not the engine.
- Displayed values look impossible (demand > breaker, imbalance > 100%) → category-error display bugs.
- Calc right at one layer but wrong at another → bypass / inline reimplementation of a shared helper.

**Architectural patterns established:**
- *Live-derive on read, cache for snapshot* (C2).
- *Helpers exported from calc layer for UI/PDF detection* (C4): `isEVEMSMarkerCircuit`, `findEVEMSSetpointMarker`, `isDwellingUnitPanel`.
- *MultiFamilyContext-style basis tracking* (C4): expose connected vs demand on different bases as separate fields.
- *Synthesize virtual rows at PDF generation time* (M4): for cross-table relationships, synthesize at the consumer.

**Sprint 2A patterns (PRs 1 + #23 + #31):**
- *Strategy C — themed PRs* over per-finding PRs.
- *Sheet ID category bands* + `E-` prefix.
- *`wrap={false}` for cohesive cards* in react-pdf.
- *Generator builder pattern*: each finding gets a dedicated `<XxxPage>` component that auto-disables when data prerequisites aren't met.

---

## NEC Reminders

- **NEC 220.57(A):** Per-EVSE branch-circuit load = `max(7,200 VA, nameplate)`. Not a demand factor.
- **NEC 625.40 / 625.42 (EVEMS):** Branches at full continuous nameplate × 1.25; FEEDER/SERVICE may be sized to managed setpoint.
- **NEC 220.82 (single-family Optional):** First 10 kVA general @ 100%, rest @ 40%; + larger of A/C vs heat @ 100%.
- **NEC 220.84 (multi-family Optional, ≥3 units):** Apply table demand factor to dwelling base; non-dwelling (EV, common areas) excluded, added back at 100%.
- **NEC 220.87 (existing-load):** Measured (utility bill, load study) value used directly. Calculated (panel schedule, manual) gets 125% multiplier. **Safety-critical** per CLAUDE.md.
- **NEC 215.2(A)(1):** Feeder ampacity ≥ 1.25 × continuous demand.
- **NEC 408 (panelboards):** Panel schedule must show every protective device including feeder breakers.

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
- Florida Building Code 8th ed (2023); NFPA-70 (2020).
