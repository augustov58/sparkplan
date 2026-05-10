# Sprint 2A — Form-Factor + Content

**Status:** 🟡 14/19 findings shipped; **2 PRs remaining** — PR 4 (M3 + M6 + H9 AIC overlay) + PR 5 (H17 + settings JSON)
**Hard prerequisites:** Sprint 1 ✅ COMPLETE
**Inherits from:** [`sprint1-engine-fixes.md`](./sprint1-engine-fixes.md) — diagnostic shortcuts and the live-derive / helpers-from-calc-layer / basis-tracking / synthesize-virtual-rows patterns
**Index:** [`docs/sprints/README.md`](./README.md)
**Parent doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md)

---

## Why this sprint exists

The 2026-05-08 Orlando line-by-line cross-walk surfaced systemic intake-rejection vectors that affect every drawing on every Orlando submittal — wrong NEC edition stamped, no per-sheet contractor signature block, no general notes page, no voltage drop note, no TOC, no revision log, no sheet IDs, no FBC reference, no EVSE labeling, no UL standard numbers, no available fault current calc page, no NEC 220.87 conditions narrative, no EVEMS narrative, no contractor-exemption screening. None of these require new dependencies, DB migrations, or upload UI — **all work lands in `services/pdfExport/permitPacketGenerator.tsx` + adjacent**. The sprint closes systemic-rejection vectors that affect every AHJ AND establishes the dual-path (exempt vs PE-required) lane logic that gates Sprint 3.

---

## Open work

### 🔴 PR 4 — Diagram work (M3 + M6 + H9 AIC overlay)

These bundle because all three edit the same SVG render paths or grounding-page renderer.

#### M6 — Riser diagram layout broken (page 3)

- **Symptom:** Labels overlap; "15 meters positions" wraps mid-character on the audit fixture (15 meters, 14 panels).
- **Code:** `components/OneLineDiagram.tsx` — has **TWO SVG renderings** per CLAUDE.md: interactive (~line 2340) and print/export (~line 3290). **Both must be updated for visual changes.**
- **Fix shape:** Switch to landscape orientation when ≥10 panels OR paginate. Visual-verify on the audit fixture.
- **Required by:** Orlando #4 (one-line diagram); all FL AHJs.

#### H9 (AIC overlay portion) — AIC + voltage/phase/amperage labels per node

- **Status:** Page-only portion (Available Fault Current Calculation page) shipped in PR #31 (`dacaab2`). **Only the per-node overlay on `OneLineDiagram.tsx` remains.**
- **Code:** Same SVG render paths as M6 — bundle in same commit if labels can layer cleanly on the corrected layout.
- **Required by:** Orlando #4 new-service path explicitly: *"voltage/phase/amperage/AIC labels per node."*

#### M3 — Project-specific grounding detail with GEC sized per NEC 250.66/250.122

- **Symptom:** Page 9-10 has generic grounding; Orlando new-service item #6 wants project-specific detail.
- **Code:** `PermitPacketGenerator.tsx` grounding page section.
- **Fix shape:** Pull GEC size from existing service-conductor sizing logic — don't reinvent. Grep for existing GEC sizing helpers first (likely in `services/calculations/`).
- **Required by:** Orlando new-service #6.
- **Note:** Sprint 4 has a sub-feature for the `[X]` (designed/specified) vs `[ ]` (field-verify) checklist-state distinction. M3 main scope here is the project-specific GEC sizing; the checklist-state polish is later.

### 🔴 PR 5 — Engine + schema (H17 + settings JSON)

#### H17 — FS 471.003(2)(h) contractor-exemption screening engine

- **What:** Florida-statute-driven, not AHJ-specific. Per `FL_PILOT_REVISED_REPORT.md` §3.1 this is a **must-have** component of Florida Permit Mode v1.
- **Why it matters:** Without it, contractors don't know which submission lane (exempt vs PE-sealed) applies and may pay for unnecessary PE review.
- **FS 471.003(2)(h) thresholds:** residential ≤ 600 A @ 240 V, commercial ≤ 800 A @ 240 V, project value ≤ $125,000.
- **Code shape:** New `services/permitMode/exemptionScreening.ts` pure function. Inputs: `(value, residentialOrCommercial, serviceCapacity_240V, scopeFlags)` → output: `{ lane: 'exempt' | 'pe-required', reason, ahjOverride? }`.
- **Cover-sheet language drives off `lane`:** *"Designed under FS 471.003(2)(h) contractor exemption"* vs *"PE-sealed plans required per [Orlando AHJ]"*.
- **AHJ overrides** (e.g., Orlando 277/480V → PE-required regardless of statute) come from manifest in Sprint 2C.
- **Tests:** cover the 4 lanes — exempt residential, exempt commercial, threshold-exceeded → pe-required, ahjOverride → pe-required regardless.

#### Settings JSON additions (no DB migration — `projects.settings` is a JSON column)

- `service_modification_type` enum: `'existing'` | `'service-upgrade'` | `'new-service'` — **drives the Orlando manifest fork in Sprint 2B.**
- `scope_flags` JSON: `service_upgrade`, `ct_cabinet`, `meter_stack`, `switchgear`, `multi_tenant_feeder`, `evems_used` — drives H17 inputs.
- `estimated_value_usd` number — drives H17 input.
- Update `lib/database.types.ts` typing for the JSON shape additions.
- Add UI to capture these in project setup (small form section).

---

## Resolved findings

### PR 1 (squash `92126eb`, merged 2026-05-08) — C7, H4, C8, M8, H12, H13

Themed: code-edition + identity foundation.

#### C7 — Hardcoded NEC 2023 reference; FL AHJs require NEC 2020

- **Symptom:** Page 1 cover subtitle reads "NEC 2023 Compliant Design Package." Florida adopted NEC 2020 via FBC 8th edition (2023). NEC 2023 not anticipated until FBC 9th edition (~2027).
- **Why CRITICAL despite being a one-line subtitle fix:** Every drawing this packet generator emits asserts compliance with the wrong code edition. A reviewer flagging the wrong-edition stamp on intake doesn't read the rest of the packet.
- **Fix:** Added `nec_edition` to project settings (default `'2020'` for FL pilot). Replaced hardcoded subtitle with dynamic value driven from AHJ manifest's `necEdition` field. NEC 220.84 multi-family demand factor table values verified valid for both 2020 and 2023.

#### H4 — No FBC + NFPA-70 references on cover

- **Fix:** New "APPLICABLE CODES" section on cover page driven from `codeReferences` array; default = `['NFPA-70 (NEC) 2020', 'Florida Building Code 8th Edition (2023)']`.

#### C8 — Per-sheet contractor signature block missing

- **Symptom:** Contractor name / license / address appears only on cover page. Orlando's official checklist (item #1) requires this on **all** submitted electrical drawings, sketches, and panel schedules.
- **Why distinct from PE seal:** Contractor's EC license (FL DBPR Certified or Registered Electrical Contractor) authorizes their signature on drawings — contractor's professional attestation. PE seal (Sprint 3 / C5) is the engineering attestation, applied to engineered-plans-required projects only (≥277V or commercial per FBPE thresholds). Two signatures coexist on PE-required packets; only contractor signature required for sub-FBPE-threshold residential / multi-family EV retrofits.
- **Fix:** New `<ContractorBlock>` `react-pdf` component rendered as footer/strip on every electrical sheet. Carries: contractor company name, license number (FL DBPR EC#######), mailing address, phone, sign-and-date line for license holder. Wet signature initially.
- **42-circuit overflow regression** fixed in PR #23 commit `8769736`.

#### M8 — Meter stack page 11 inconsistent visual style

- **Fix:** `MeterStackSchedulePDF.tsx` now wraps each Page with shared `themeStyles.page` + `BrandBar` + `BrandFooter` (which carries the C8 contractor block automatically). **Fixed first** in PR 1 to ensure C8 covers all pages uniformly.

#### H12 — No General Notes page with NEC compliance note

- **Fix:** `GeneralNotesPage` in `PermitPacketDocuments.tsx`; default 8-item FL pilot stack; configurable via `generalNotes` array. Sprint 2C will populate from AHJ manifest. Renders at sheet `E-004`.

#### H13 — No voltage drop general note (3% feeder / 3% branch / 5% combined)

- **Fix:** Note 2 in default General Notes stack: *"Voltage drop shall not exceed 3% on branch circuits and 3% on feeders, with combined drop not exceeding 5% per NEC 210.19(A) IN 4 and 215.2(A)(1) IN 2."*

### PR #23 (squash `6859328`, merged 2026-05-09) — H1, H2, H3 (form-factor identity)

Themed: cover-sheet + plan-set conventions.

#### H1 — No table of contents / cover-sheet index

- **Fix:** `TableOfContentsPage` in `PermitPacketDocuments.tsx`; auto-populated from rendered sections at sheet `E-002`.

#### H2 — No revision log page

- **Fix:** `RevisionLogPage` in `PermitPacketDocuments.tsx`; auto-populates default Rev 0 row at sheet `E-003`.

#### H3 — No sheet-ID convention (`E-001`, `E-002`, …)

- **Fix:** `services/pdfExport/packetSections.ts` foundation: 7 numeric category bands + `E-` discipline prefix; allocated per builder by `nextSheetId(counters, band)`. Yellow pill in BrandBar + cream badge in BrandFooter.
- **Bonus:** projects.settings persistence + section toggle UI + 42-circuit panel overflow regression fix.

### PR #31 (squash `dacaab2`, merged 2026-05-10) — H14, H9 page, H15, H10, H11 (engineering content)

Themed: drawings-required engineering content.

#### H14 — No NEC 220.87 conditions narrative

- **Required by:** Orlando existing-service path explicitly cites the 3 conditions: *"(1) maximum demand data is available for a 1-year period (2) maximum demand at 125 percent plus the new load does not exceed the ampacity (3) feeder has overcurrent protection in accordance with 240.4, and the service has overload protection in accordance with 230.90."*
- **Fix:** `NEC22087NarrativePage` (band 100). Opt-in via UI form capturing existing-load method (utility bill / load study / calculated / manual), source citation, observation window dates, max demand kVA, proposed new load kVA. Page renders structured 3-condition checklist with green/amber verdict callout.
- **Critical NEC compliance:** **Measured methods skip 125% multiplier per NEC 220.87**; calculated/manual apply 125%. This is the rule documented in CLAUDE.md as `services/calculations/serviceUpgrade.ts` — measured (utility bill, load study) value used directly; calculated (panel schedule, manual) gets 125% multiplier. Auto-disabled until citation + max demand are filled.

#### H9 (page only — partial) — Available Fault Current Calculation page

- **Required by:** All FL AHJs (hurricane-state fault current); Orlando #5 new-service explicitly requires *"arc fault current calculation, showing the available fault current at the service main breaker(s)."*
- **Fix:** Available Fault Current Calculation page (band 100, IEEE 141 derivation + NEC 110.9/110.10 verdict, sourced from `data.shortCircuitCalculations` service-level entry).
- **Deferred to PR 4:** AIC overlay on `OneLineDiagram.tsx`. See "Open work" above.

#### H10 — No EVEMS operational narrative

- **Required by:** All AHJs reviewing NEC 625.42 designs.
- **Fix:** `EVEMSNarrativePage` (band 600). One detail block per EVEMS-managed panel: device + UL 916, NEC 625.42 setpoint (sourced from `findEVEMSSetpointMarker` marker circuit when present, panel-breaker proxy fallback for legacy projects with source flag), monitoring points, failure mode, NEC 750 tamper protection. Auto-disabled when no EVEMS-managed panel detected.
- **Content (all present):** device manufacturer/model with UL 916 listing; max aggregate setpoint (in amps) and how it was derived; service main / sub-feed monitoring points; failure mode (default to lowest setpoint on signal loss); tamper protection per NEC 750; setpoint values per NEC 625.42.

#### H11 — No EVSE labeling page (NEC 625.43)

- **Fix:** `EVSELabelingPage` (band 600). Per-panel disconnect label text + 6-item required-content checklist + breaker locking + commercial-only emergency-shutoff section + contractor attestation. Detection mirrors H15 pattern (EVEMS marker OR name pattern `/ev|evse|charger|charging|level\s*2|l2/i`).

#### H15 — UL-2202 + UL-2594 by standard number

- **Required by:** Orlando item #7 (both paths): *"electrical specifications of EV chargers to include UL-2202 and UL-2594 listing and label information."*
- **Fix:** New "EV CHARGING SUPPLY EQUIPMENT — APPLICABLE LISTING STANDARDS" card on existing Equipment Specs page. Detection: EVEMS marker circuit OR panel name pattern. H8 cut-sheet upload remains a Sprint 2B prerequisite for manufacturer-supplied evidence.

---

## Architectural patterns established (used by Sprint 2B / 2C / 3 / 4)

- **Strategy C — themed PRs over per-finding PRs.** Bundle related findings into a single PR with shared infrastructure. PR 1 = code-edition + identity foundation; PR #23 = cover-sheet identity; PR #31 = engineering content. Reduces review overhead vs 14 separate PRs.
- **Sheet ID category bands** (`packetSections.ts`): 7 numeric bands × `E-` discipline prefix → allocated by `nextSheetId(counters, band)`. **Sprint 2B uploads fit cleanly into existing bands without renumbering.**
- **`wrap={false}` for cohesive cards in react-pdf** — prevents `react-pdf` from splitting visual cards across page boundaries. Apply to PR 4 grounding detail card.
- **Generator builder pattern** — each finding gets a dedicated `<XxxPage>` component that auto-disables when its data prerequisites aren't met. Keeps `permitPacketGenerator.tsx` orchestration linear and per-page logic isolated. Apply to PR 5 H17 cover-sheet language conditional.
- **PR base bug workaround** — when GitHub PR creation rejects a base branch, push to a new branch off the rejected base and create the PR from there.

---

## Pre-flight (start every Sprint 2A session)

1. **Confirm latest main:** `git checkout main && git pull --ff-only origin main && git log --oneline -3` should show `dacaab2` (PR #31) at top, plus any later post-merge docs syncs.
2. **Test baseline:** `npm test` reports all green (was 181/181 post-Sprint 1, plus PR 1 + PR #23 + PR #31 additions). `npm run build` exits 0.
3. **Confirm Sprint 1 + 2A scoreboard intact** by regenerating the example permit packet (`example_reports/Permit_Packet_Multifamily_Test_<date>.pdf`) from the 12-unit MF + EVEMS audit fixture and skim:
   - Page 4 MDP load calc — three rows: Multi-Family Dwelling 220.84 41% + House 100% + EV 625.42 clamped; total ≈ 240 kVA / 999 A.
   - Page 8 voltage drop — realistic MDP→EV feeder values (no 14 AWG / 0 A row).
   - Page 13 MDP panel schedule — 14 synthesized feeder rows.
   - Page 14 EV Sub-Panel — 12 chargers @ 11,520 VA each, 300 A main breaker, EVEMS Aggregate Setpoint callout ~48 kVA.
   - Pages 15+ unit panels — 125 A bus rating, NEC 220.82 demand callout ~23 kVA / ~95 A.
   - Cover, footer, sheet IDs, TOC, revision log, general notes, EVEMS narrative, EVSE labeling, NEC 220.87 narrative, Available Fault Current page all rendering.

---

## Recommended commit order

### PR 4 — Diagrams

1. **M6 — Riser layout fix.** Switch to landscape for ≥10 panels OR paginate. Both interactive (~line 2340) AND print/export (~line 3290) renderings must be updated. Visual-verify on audit fixture.
2. **H9 AIC overlay.** AIC + voltage / phase / amperage labels per node on the one-line. Required by Orlando #4 new-service. Same files as M6 — bundle in same commit if labels can layer cleanly on the corrected layout.
3. **M3 — Project-specific grounding detail.** GEC sized per NEC 250.66/250.122 (Orlando new-service item #6). Pull GEC size from existing service-conductor sizing logic — don't reinvent.

**Visual verification per commit:** regenerate the audit packet, compare to prior visual snapshot. Sprint 1 diagnostic shortcut applies — these are PDF/SVG render-layer bugs, not engine bugs.

### PR 5 — Engine + schema

1. **Settings JSON additions** to `projects.settings` (no migration — JSON column). Update `lib/database.types.ts`. Add UI to capture these (small form section).
2. **H17 — `services/permitMode/exemptionScreening.ts`** pure function. Tests cover the 4 lanes.
3. **Cover-sheet language** drives off `lane`.
4. **Gate the (future) PE seal upsell flow** off `lane === 'pe-required'`. Sprint 3 will read this gate.

---

## NEC references touched in this sprint

- **220.87** — Existing-load method. Measured value used directly; calculated gets 125% multiplier. **Safety-critical.**
- **220.57(A), 625.40, 625.42, 750** — EVEMS narrative content (H10).
- **625.43** — EVSE labeling (H11).
- **110.9, 110.10** — Available fault current verdict (H9).
- **210.19(A) IN 4, 215.2(A)(1) IN 2** — Voltage drop notes (H13).
- **250.66, 250.122** — Grounding electrode conductor sizing (M3 — PR 4).
- **UL 2202, UL 2594, UL 916** — Listing standards on EVSE specs (H15) and EVEMS device (H10).

---

## Cross-references

- **Sprint 1** [`sprint1-engine-fixes.md`](./sprint1-engine-fixes.md) — diagnostic shortcut (in-app correct vs PDF wrong → PDF call site) applies to PR 4 SVG render-layer work; live-derive pattern from C2 informs how H17's lane logic should consume cached vs live data.
- **Sprint 2B** [`sprint2b-uploads.md`](./sprint2b-uploads.md) — `service_modification_type` schema addition feeds Sprint 2B's Orlando manifest fork; sheet ID category bands accommodate uploaded artifacts; section toggle pattern reused for upload UI.
- **Sprint 2C** [`sprint2c-ahj-manifests.md`](./sprint2c-ahj-manifests.md) — `generalNotes[]` and `codeReferences[]` arrays populated per AHJ; H17 lane logic feeds M1 checklist engine.
- **Sprint 3** [`sprint3-pe-seal.md`](./sprint3-pe-seal.md) — H17 lane logic gates PE seal upsell offering; C8 contractor block coexists with PE seal on engineered packets (both visible).
- **Sprint 4** [`sprint4-polish.md`](./sprint4-polish.md) — M3 sub-feature (`[X]` vs `[ ]` checklist-state distinction) builds on PR 4 M3 main scope; M7 (page-break orphan) coexists with `wrap={false}` cohesive-card pattern.
- **Memory:** [validation-advisory-not-blocking](../../.claude/projects/-home-augusto-projects-sparkplan/memory/feedback_validation_advisory.md) (from C3 in Sprint 1, applied across Sprint 2A schema-aware UI surfaces).
