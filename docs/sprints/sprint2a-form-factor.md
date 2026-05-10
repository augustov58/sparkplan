# Sprint 2A — Form-Factor + Content

**Status:** ✅ COMPLETE 2026-05-10 (19/19 findings shipped via 5 themed PRs; PR #40 + #41 open for merge)
**Hard prerequisites:** Sprint 1 ✅ COMPLETE
**Inherits from:** [`sprint1-engine-fixes.md`](./sprint1-engine-fixes.md) — diagnostic shortcuts and the live-derive / helpers-from-calc-layer / basis-tracking / synthesize-virtual-rows patterns
**Index:** [`docs/sprints/README.md`](./README.md)
**Parent doc:** [`docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`](../AHJ_COMPLIANCE_AUDIT_2026-05-04.md)

---

## Why this sprint exists

The 2026-05-08 Orlando line-by-line cross-walk surfaced systemic intake-rejection vectors that affect every drawing on every Orlando submittal — wrong NEC edition stamped, no per-sheet contractor signature block, no general notes page, no voltage drop note, no TOC, no revision log, no sheet IDs, no FBC reference, no EVSE labeling, no UL standard numbers, no available fault current calc page, no NEC 220.87 conditions narrative, no EVEMS narrative, no contractor-exemption screening. None of these require new dependencies, DB migrations, or upload UI — **all work lands in `services/pdfExport/permitPacketGenerator.tsx` + adjacent**. The sprint closes systemic-rejection vectors that affect every AHJ AND establishes the dual-path (exempt vs PE-required) lane logic that gates Sprint 3.

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

### PR #40 (open 2026-05-10) — M6, H9 AIC overlay, M3 (diagrams + grounding)

Themed: diagram + grounding render-layer work. Built via 3 parallel worktree-isolated agents, code-reviewer + security-reviewer pass, then merged onto a single PR branch. Test count 363 → 394 (+4 pagination boundary tests + 27 GEC/grounding tests).

#### M6 — Riser diagram pagination (page 3 of audit packet)

- **Symptom (pre-fix):** On the audit fixture (15 meters, 14 panels) labels overlapped and "15 meters positions" wrapped mid-character. Page 3 of `example_reports/Permit_Packet_Multifamily_Test_2026-05-05.pdf` is the broken-state reference.
- **Spec correction during execution:** The original spec pointed at `components/OneLineDiagram.tsx` (~line 2340 / ~3290 per CLAUDE.md). Those line numbers point at internal bus-bar geometry and an HTML `<select>`, not at SVG rendering. The actual permit-packet riser is rendered by `services/pdfExport/PermitPacketDocuments.tsx::RiserDiagram` (~line 1150). Sprint 1's diagnostic shortcut (in-app correct vs PDF wrong → look at the PDF call site) caught this. CLAUDE.md docs fix included in this PR's docs-sync.
- **Fix:** Pagination, not landscape (PDF was already landscape). Bug was scaling 14×(150+18)=2352pt of nodes into 720pt, collapsing labels to ~6pt. Paginate every >6 siblings; each page now keeps labels at 7-9pt. Shortened "N meters positions" → "N meters" so the meter-stack node label no longer wraps even at scale.

#### H9 (AIC overlay portion) — AIC + voltage/phase/amperage labels per node

- **Status:** Page-only portion shipped in PR #31 (`dacaab2`). PR #40 closes the per-node overlay — required by Orlando #4 new-service explicitly.
- **Fix:** AIC chip overlapping the lower-right corner of each panel glyph. Layered onto the corrected paginated layout from M6.

#### M3 — Project-specific grounding detail with GEC sized per NEC 250.66

- **Symptom:** Pages 9-10 of audit packet had generic grounding boilerplate. Orlando new-service item #6 wants project-specific detail.
- **Discovery during execution:** Two existing GEC helpers were unsuitable — `components/GroundingBonding.tsx::getRecommendedGecSize` was UI-coupled with an incorrect mapping (amps → GEC directly, not via service conductor); `services/calculations/residentialLoad.ts::recommendGecSize` was non-exported and only handled some buckets.
- **Fix:** New `data/nec/table-250-66.ts` typed lookup (NEC 2017/2020/2023 — values unchanged across editions) + new `services/calculations/groundingElectrodeConductor.ts` pure function following `data/nec/table-250-122.ts` + `getEgcSizeDetailed` pattern. Card uses `wrap={false}` cohesive-card pattern. Audit fixture (1000 A service) → 2/0 AWG Cu (verified against NEC Table 250.66).

#### Latent bug fix piggybacked

`services/pdfExport/permitPacketGenerator.tsx` was falling back `serviceAmperage={bus_rating || data.serviceVoltage}` — for a panel with no `bus_rating` this silently treated **480 V as 480 A**. Fixed to `main_breaker_amps ?? bus_rating ?? 200`. Same failure class as the Sprint 1 short-circuit `1.732×` issue.

#### Reviewer findings addressed in PR #40

- **H1 (HIGH)** — `(panel as any).aic_rating` casts in `OneLineDiagram.tsx` defeated TypeScript needlessly. Removed the 2 new casts (left 1 pre-existing at line 1136 for separate cleanup PR).
- **M3 (MEDIUM, code review on Agent 2)** — NEC table header said "NEC 2023" only. Updated to reflect multi-edition compatibility (2017 / 2020 / 2023 values unchanged) + reference `projects.settings.nec_edition` for project-level edition.

### PR #41 (open 2026-05-10) — H17 + settings JSON (engine + schema)

Themed: engine + schema. Florida Permit Mode v1 lane-screening foundation per `FL_PILOT_REVISED_REPORT.md` §3.1. Test count 363 → 382 (+12 original lane-scenario tests + 7 H2/M1 regression tests).

#### H17 — FS 471.003(2)(h) contractor-exemption screening engine

- **Why it matters:** Without it, contractors don't know which submission lane (exempt vs PE-sealed) applies and may pay for unnecessary PE review.
- **FS 471.003(2)(h) thresholds:** residential ≤ 600 A @ 240 V, commercial ≤ 800 A @ 240 V, project value ≤ $125,000.
- **Fix:** New `services/permitMode/exemptionScreening.ts` pure function. Inputs: `(estimatedValueUsd, occupancyType, serviceCapacityAmps, serviceVoltageV, scopeFlags, ahjOverride?)`. Output: `{ lane: 'exempt' | 'pe-required', reason, ahjOverride?, necReferences, warnings }`. Cover-sheet language switches on lane: *"Designed under FS 471.003(2)(h) contractor exemption"* vs *"PE-sealed plans required per [AHJ name]"*.
- **AHJ overrides** (e.g., Orlando 277/480 V → PE-required regardless of statute) come from manifest in Sprint 2C. Currently uses `'AHJ'` placeholder when jurisdiction not bound.

#### Settings JSON additions (no DB migration — `projects.settings` is JSON)

- `service_modification_type` enum: `'existing'` | `'service-upgrade'` | `'new-service'` — drives Orlando manifest fork in Sprint 2B.
- `scope_flags` JSON: 6 booleans — drives H17 inputs.
- `estimated_value_usd` number — drives H17 input.
- Typed in `types.ts` via extended `ProjectSettings` interface (matches existing PR 1 / #23 pattern for the `Json` column — `lib/database.types.ts` is auto-generated per CLAUDE.md "Stable Modules" rule).
- Project Setup UI gains "Permit Scope (FL Contractor Exemption)" card (uses existing local-state + debounced-update pattern, not RHF/Zod, to match the surrounding form's pattern).

#### Reviewer findings addressed in PR #41

- **H2 (HIGH)** — Pre-fix the function expected `serviceCapacity_240V_amps` but the caller passed raw amps. For a 480 V/800 A commercial service, the function silently routed to `exempt` (≤ 800 A commercial threshold) — but the 240 V-equivalent is 1600 A which would trip the threshold. **Wrong-direction failure** for a regulatory-compliance flag. Fix: renamed input to `serviceCapacityAmps` + added `serviceVoltageV`; function normalizes internally to FS 471.003(2)(h)'s 240 V terms. Reason string surfaces both nameplate and normalized values so contractors see why the threshold tripped.
- **M1 (MEDIUM, both reviewers)** — Pre-fix `NaN` / negative / non-finite inputs silently routed to `exempt`. Added `coerceNonNegativeFinite` helper that maps malformed values to `POSITIVE_INFINITY`, which trips the thresholds and produces `pe-required` with a `WARNING`. Compliance flags must lean toward over-requiring engineering review, not under-requiring it.

---

## Architectural patterns established (used by Sprint 2B / 2C / 3 / 4)

- **Strategy C — themed PRs over per-finding PRs.** Bundle related findings into a single PR with shared infrastructure. PR 1 = code-edition + identity foundation; PR #23 = cover-sheet identity; PR #31 = engineering content; PR #40 = diagrams + grounding; PR #41 = engine + schema. Reduces review overhead vs 19 separate PRs.
- **Sheet ID category bands** (`packetSections.ts`): 7 numeric bands × `E-` discipline prefix → allocated by `nextSheetId(counters, band)`. PR #40's new GroundingPlan component slotted in cleanly at `E-204` without renumbering. **Sprint 2B uploads fit cleanly into existing bands without renumbering.**
- **`wrap={false}` for cohesive cards in react-pdf** — prevents `react-pdf` from splitting visual cards across page boundaries. Applied in PR #40 grounding detail card.
- **Generator builder pattern** — each finding gets a dedicated `<XxxPage>` component that auto-disables when its data prerequisites aren't met. Keeps `permitPacketGenerator.tsx` orchestration linear and per-page logic isolated. Applied in PR #41 H17 cover-sheet language conditional.
- **PR base bug workaround** — when GitHub PR creation rejects a base branch, push to a new branch off the rejected base and create the PR from there.
- **Worktree-isolated parallel agents safe to co-edit a file** when their human-given scope assigns them to non-overlapping sections of it. PR #40 + PR #41 used 3 parallel agents; the 2 files with multi-agent edits (`PermitPacketDocuments.tsx`, `permitPacketGenerator.tsx`) auto-merged because each agent worked in distinct components/sections. Git "ort" merge strategy resolves hunk-level overlaps cleanly.
- **Fail-safe defaults for compliance logic.** Calc-service rule "never throw, return warnings" handles the success path. Compliance functions (e.g., H17 lane screening) extend this to the failure path: malformed input gets a *safe-direction* default, not just a non-throwing one. Wrong direction (silently exempt) creates regulatory risk; right direction (fail-safe to pe-required) errs toward over-requiring engineering review.
- **Spec line numbers decay; diagnostic shortcuts don't.** Sprint 2A PR #40 surfaced that `CLAUDE.md`'s OneLineDiagram.tsx line numbers (2340 / 3290) had drifted to point at unrelated code. Sprint 1's diagnostic shortcut ("in-app correct vs PDF wrong → look at the PDF call site") is the resilient guidance — line numbers should be re-validated when CLAUDE.md is touched.

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

## NEC references touched in this sprint

- **220.87** — Existing-load method. Measured value used directly; calculated gets 125% multiplier. **Safety-critical.**
- **220.57(A), 625.40, 625.42, 750** — EVEMS narrative content (H10).
- **625.43** — EVSE labeling (H11).
- **110.9, 110.10** — Available fault current verdict (H9).
- **210.19(A) IN 4, 215.2(A)(1) IN 2** — Voltage drop notes (H13).
- **250.66, 250.122** — Grounding electrode conductor sizing (M3 — PR #40).
- **FS 471.003(2)(h)** — FL contractor-exemption thresholds (H17 — PR #41); not NEC but cited via the calc-service `necReferences[]` contract.
- **UL 2202, UL 2594, UL 916** — Listing standards on EVSE specs (H15) and EVEMS device (H10).

---

## Cross-references

- **Sprint 1** [`sprint1-engine-fixes.md`](./sprint1-engine-fixes.md) — diagnostic shortcut (in-app correct vs PDF wrong → PDF call site) applies to PR 4 SVG render-layer work; live-derive pattern from C2 informs how H17's lane logic should consume cached vs live data.
- **Sprint 2B** [`sprint2b-uploads.md`](./sprint2b-uploads.md) — `service_modification_type` schema addition feeds Sprint 2B's Orlando manifest fork; sheet ID category bands accommodate uploaded artifacts; section toggle pattern reused for upload UI.
- **Sprint 2C** [`sprint2c-ahj-manifests.md`](./sprint2c-ahj-manifests.md) — `generalNotes[]` and `codeReferences[]` arrays populated per AHJ; H17 lane logic feeds M1 checklist engine.
- **Sprint 3** [`sprint3-pe-seal.md`](./sprint3-pe-seal.md) — H17 lane logic gates PE seal upsell offering; C8 contractor block coexists with PE seal on engineered packets (both visible).
- **Sprint 4** [`sprint4-polish.md`](./sprint4-polish.md) — M3 sub-feature (`[X]` vs `[ ]` checklist-state distinction) builds on PR 4 M3 main scope; M7 (page-break orphan) coexists with `wrap={false}` cohesive-card pattern.
- **Memory:** [validation-advisory-not-blocking](../../.claude/projects/-home-augusto-projects-sparkplan/memory/feedback_validation_advisory.md) (from C3 in Sprint 1, applied across Sprint 2A schema-aware UI surfaces).
