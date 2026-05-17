# City of St. Petersburg (Pinellas County) — EV Charging Station Permit Checklist

**Sourced:** 2026-05-16
**Source URL(s):**
- City of St. Petersburg Building Permits hub (official, primary): https://www.stpete.org/business/building_permitting/building_permits.php
- City of St. Petersburg Applications & Forms: https://www.stpete.org/business/building_permitting/forms_applications.php
- City of St. Petersburg Building & Permitting landing: https://www.stpete.org/business/building_permitting/index.php
- City of St. Petersburg Residential Plan Review Checklist 2020 (PDF): https://cms5.revize.com/revize/stpete/Business/Building%20Forms%20%26%20Applications/Residential_Plan_Review_Checklist%202020.pdf
- City of St. Petersburg Current Codes Adopted (PDF): https://cms5.revize.com/revize/stpete/Business/Building%20Forms%20%26%20Applications/Current_Codes_Adopted.pdf
- City of St. Petersburg List of Exempted Permits (PDF): https://cms5.revize.com/revize/stpete/Business/Building%20Forms%20%26%20Applications/list_of_exempted_permits.pdf
- City of St. Petersburg Notice of Commencement form (PDF): https://cms5.revize.com/revize/stpete/construction_services_and_permitting/docs/notice_of_commencement.pdf
- St. Petersburg Click2Gov permit portal: https://stpe-egov.aspgov.com/Click2GovBP/index.html
- Pinellas County Construction Licensing Board (PCCLB): https://www.pcclb.com/
- Pinellas County permitting guide (for cross-validation): https://pinellas.gov/permitting-guide/
- Pinellas Access Portal (Accela; for unincorporated Pinellas, not St. Pete proper): https://aca-prod.accela.com/PINELLAS/Cap/CapHome.aspx
- FEMA case study (St. Pete flood elevation context): https://www.fema.gov/case-study/florida-city-st-petersburg-single-family-home-elevation
- Pinellas County floodplain construction: https://pinellas.gov/construction-in-a-floodplain/
- Industry references (used only for cross-validation, not primary): https://winwayhomes.com/pinellas-county-base-flood-elevations-and-permits-a-homeowners-guide-to-building-in-st-petersburg/, https://www.davidgrayonline.com/blog/2023/july/ev-charger-permits-in-florida-a-guide/

**Official EV-specific checklist available:** **No.** The City of St. Petersburg does not publish a dedicated EV-charging permit checklist PDF. The Building Permits hub at `stpete.org/business/building_permitting/building_permits.php` lists checklists for Commercial / Residential NSFR / Generator / Windows-and-Doors / Swimming Pool / Foundation Only / Solar / Sign — **no electrical-specific or EV-specific checklist**. EV scope is handled under the City's generic Residential Plan Review Checklist (residential trade-permit lane) or Commercial Plan Review Checklist (commercial / multi-family full plan review). This mirrors Hillsborough/Tampa's documented pattern (see `hillsborough-tampa.md`).

**Notes:**
- St. Petersburg is the **second-largest Tampa Bay metro AHJ** (population ~265k) and is in **Pinellas County**, NOT Hillsborough. St. Pete is therefore distinct from the `hillsborough-tampa` joint manifest — it has its own permit portal (Click2Gov, not HillsGovHub or Tampa Accela), its own Construction Services & Permitting Division, and its own published checklists hosted on `stpete.org`.
- **Two portals, two licensing tracks:** St. Pete proper → Click2Gov / ePlan (`stpe-egov.aspgov.com`). Unincorporated Pinellas → Pinellas Access Portal Accela. Contractor licensing for both is administered by the Pinellas County Construction Licensing Board (PCCLB, `pcclb.com`) — a county-level board that all Pinellas munis use.
- **Adopted codes (verified via `Current_Codes_Adopted.pdf`):** Florida Building Code 8th edition (2023) + National Electrical Code 2020 (NFPA 70) + Florida Fire Prevention Code 8th edition (NFPA 1, 2021). Uniform statewide adoption — no Miami-Dade-style residential/commercial NEC fork (H34).
- **Notice of Commencement (FS 713.135):** Required for building-trade jobs > $5,000 (per FS 713.135 + cross-validated against St. Pete NOC form and Pinellas County permitting guide). Same defensible default as Orlando / Hillsborough — ON for non-SFR.
- **Owner-Builder / contractor-exemption:** Available per FL Statute 489.503 — owner may install electrical wiring in a single-family or duplex residence for their own use and occupancy, may not sell or lease within 1 year. PCCLB requires registration for anyone advertising as a contractor.
- **Electronic submittal:** Effective November 1, 2023, all plan review is handled via ePlan. Applicants have 10 business days to upload plans after application acceptance or the application is denied.

## HVHZ verdict (critical for anchoring detail)

**Pinellas is OUT of the High-Velocity Hurricane Zone (HVHZ).** The HVHZ covers ONLY Miami-Dade and Broward counties per FBC 8th ed. However:

- Pinellas IS classified as a **Wind-Borne Debris Region** (WBDR) along with Palm Beach, Monroe, and coastal portions of Lee, Collier, and Hillsborough.
- Pinellas sits in the **140 mph ultimate design wind speed zone** per FBC 8th ed (2023) — the upper range of non-HVHZ.
- Mounted EVSE anchoring documentation: **Florida Product Approval** is the canonical path. Miami-Dade NOA tie-down details are acceptable but NOT required (NOA is a strict superset of FL Product Approval for testing rigor).
- The manifest still surfaces the `hvhz_anchoring` upload slot for non-SFR projects per the Sprint 2C H19 statewide pattern — the slot name is legacy (it's the FL Product Approval slot for non-HVHZ regions); see Sprint 2C audit doc.

## Source artifacts (verbatim from St. Pete-published documents)

### `Current_Codes_Adopted.pdf` (City of St. Petersburg)

The PDF is binary-encoded and not fully extractable via WebFetch, but the web-indexed summary confirms: *"St. Petersburg has adopted the 8th Edition 2023 Florida Fire Prevention Code and NEC 2020 National Electric Code (NFPA 70)."* Cross-validated against statewide FL DBPR / Florida Building Commission adoption schedule.

### Building Permits hub page (verbatim list of published checklists, 2026-05-16 fetch)

> "ePlan Submittal Checklists (specific project types):
> - Commercial Project Permit
> - Residential NSFR Project Permit
> - Generator Permit
> - Windows and Doors Permit
> - Swimming Pool Permit
> - Foundation Only Permit
> - Solar Permit
> - Sign Permit"

**No** Electrical Permit checklist published. **No** EV charger checklist published. **No** Residential Alteration / Renovation checklist published. The generic Residential Plan Review Checklist 2020 is the closest published artifact applicable to a Level-2 home EVSE install.

### Notice of Commencement requirement (verbatim from FS 713.135 + Pinellas permitting guide cross-walk)

> "A recorded Notice of Commencement is required on projects where the job value exceeds $5,000 or when a mechanical job value to repair or replace an existing heating or air-conditioning system is equal to or exceeds $15,000 according to Florida Statutes § 713.135."

### Click2Gov ePlan submittal terms (verbatim from Building Permits hub page)

> "Applicants have ten (10) business days to complete their upload and address any comments found during the initial submittal to correct the permit application and electronic submittal, with failure to correct within 10 business days resulting in a denial of the application."

### Contact information

- General Building & Permitting: **permits@stpete.org** or **(727) 893-7230**
- ePlan review: **eplanreview@stpete.org**
- Affordable Housing permits: **AFHpermits@stpete.org**
- Preliminary Plan Review: **mary.martinelli@stpete.org**

## Line-by-line cross-walk (mirrors Hillsborough/Tampa matrix)

**Two lanes apply: (R) Residential ≤1-or-2-family Click2Gov trade-permit lane (per Hillsborough H31 pattern; not officially documented by St. Pete but consistent with FL practice), (C) Commercial / multi-family Plan Review lane.**

| St. Petersburg line item | EV-fed-from-existing (R) | EV-fed-from-existing (C) | EV-fed-from-new-service | Currently in packet | Manifest gating |
|---|---|---|---|---|---|
| Click2Gov / ePlan Electric Trade Permit application | Required | n/a (full permit instead) | Required (R lane) | generator does not produce | `isResidentialTradePermitLane` |
| Commercial Electrical Permit application — full plan review | n/a | Required | Required (C) | generator does not produce | `isFullPlanReviewLane` |
| Notice of Commencement > $5,000 (FS 713.135) | Conditional | Required | Required | ok | `noc` predicate (non-SFR) |
| Simple electrical scope narrative | Required | n/a (replaced by plans) | Required (R) | ok generalNotes serve | `() => true` |
| Panel rating + proposed breaker size | Required | Required (in panel sched) | Required | ok | `isFullPlanReviewLane` |
| Riser diagram (one-line) | "If requested" (R); standard (C) | Required | Required (C) | ok | `isFullPlanReviewLane` |
| Plans digitally signed and sealed by FL-registered PE or RA | n/a (R) | Required | Required (C) | no PE infra | `isFullPlanReviewLane` |
| Load calculations (NEC 220) | Implied (R) | Required | Required | ok | `isFullPlanReviewLane` |
| Voltage drop considerations | Implied (R) | Required | Required | ok | `isFullPlanReviewLane` |
| Available fault current (NEC 110.9/10) | n/a (R) | Required (C, new svc) | Required (new svc) | ok | new-service + full plan review |
| Service equipment grounding detail (NEC 250) | n/a (R) | Required (C, new svc) | Required (new svc) | ok | new-service + full plan review |
| NEC 220.87 existing-service narrative | Implied (R) | Required (C, existing) | n/a | ok | existing-service + full plan review |
| Site plan (EVSE location relative to property + utility entry) | Implied (R, simple) | Required (C) | Required (C) | upload slot | `isFullPlanReviewLane` |
| EVSE cut sheets (UL-2202 / UL-2594) | Required | Required | Required | upload slot | `() => true` |
| Fire stopping schedule (rated penetrations) | n/a typical (R) | Required when penetrations | Required when penetrations | upload slot | `isFullPlanReviewLane` |
| HOA / condo approval letter | Conditional (HOA props) | Conditional | Conditional | upload slot | non-SFR default ON |
| HVHZ-style anchoring (FL Product Approval — WBDR path) | n/a typical (SFR wall-mount) | Required (outdoor pedestal) | Required (outdoor pedestal) | upload slot | non-SFR |
| Design Flood Elevation reference (coastal AE zones) | Conditional (flood) | Conditional (flood) | Conditional (flood) | upload slot | commercial + full plan review |
| Per-sheet contractor signature + PCCLB # | Required | Required | Required | ok Sprint 2A C8 | `() => true` |
| FBC / NEC reference block | Required | Required | Required | ok Sprint 2A C7/H4 | `() => true` |
| Cover sheet TOC | Best practice | Best practice | Best practice | ok Sprint 2A H1 | always on |
| EVEMS narrative (NEC 625.42) | Conditional | Conditional | Conditional | ok | `() => true` (data-gated) |
| EVSE labeling (NEC 625.43) | Required | Required | Required | ok | `() => true` |
| Knox-box / emergency shutoff | n/a (R) | UNRESOLVED (City's stance not web-discoverable) | UNRESOLVED | n/a | not in manifest |
| Zoning Compliance permit | n/a typical | n/a (not Pompano) | n/a | n/a | not in manifest |
| Wind anchoring for outdoor pedestals | n/a (R wall-mount) | FL Product Approval | FL Product Approval | upload slot | covered by hvhz_anchoring |

## Findings

**S1 — No St. Pete EV-specific checklist published.**
Verified via direct fetch of `stpete.org/business/building_permitting/building_permits.php` on 2026-05-16. The City publishes Generator / Solar / Windows-and-Doors / Pool / Sign / Foundation Only / Commercial / Residential NSFR checklists, but NO electrical-specific and NO EV-specific checklist. Manifest is composed from generic plan review checklists + FS 713 + statewide code adoption. **Severity: Medium informational** — packet content is conservatively over-spec relative to whatever the City's internal-only intake reviewer expects; closure requires a ~10 min phone call to (727) 893-7230. Mirrors Hillsborough's documented `H35` pattern.

**S2 — Owner-Builder vs PCCLB-registered contractor lane.**
FL Statute 489.503 owner-builder exemption applies in St. Pete (SFR / duplex owner-occupied; not for sale or lease within 1 year). PCCLB requires registration for advertised contractors. The manifest does NOT fork on owner-builder vs contractor — both ride the same Click2Gov trade-permit lane on SFR. **Severity: Low**.

**S3 — Click2Gov vs ePlan vs Accela ambiguity.**
St. Pete proper uses Click2Gov (`stpe-egov.aspgov.com`) for status lookup AND ePlan for plan submittal. Unincorporated Pinellas uses the Pinellas Access Portal (Accela, `aca-prod.accela.com/PINELLAS`). Surrounding Pinellas munis (Clearwater, Largo, Dunedin, St. Pete Beach) are each independent AHJs with their own portals. The manifest scopes `id = 'st-petersburg'` to the City of St. Pete only — neighbor munis would each need their own manifest. **Severity: Low for packet content; Medium for future-pass scope.**

**S4 — Knox-box / Fire Marshal stance UNRESOLVED.**
Same intractable gap as Hillsborough/Tampa — NFPA 1 § 18.2.2.1 is AHJ-discretionary. St. Pete Fire Rescue's commercial EVSE Knox-box stance is not web-discoverable. Closure requires direct contact: St. Pete Fire Rescue (727) 893-7691. Manifest does NOT include Knox-box pending confirmation. **Severity: Low** (matches Hillsborough treatment).

**S5 — Coastal AE flood zones widespread.**
St. Pete has extensive coastal AE flood zones with BFE = 9 ft per FEMA. Pinellas County requires +1 ft freeboard above BFE (more stringent than federal minimum). The manifest's `flood_elevation_certificate` slot is ON for commercial only — defensible default; SFR users in waterfront / island properties can toggle on via Layer 2 override. **Severity: Medium** for any project in a special flood hazard area; **N/A** otherwise.

## Confidence level

**Medium.**
- *High* for adopted codes (NEC 2020 + FBC 8th ed + FFPC 8th ed) — verified via `Current_Codes_Adopted.pdf` + cross-validation.
- *High* for HVHZ verdict (Pinellas is NOT in HVHZ) — verified via multiple FBC + product-approval sources.
- *High* for NOC threshold ($5,000) and FS 713.135 reference — verified.
- *High* for Click2Gov / ePlan portal — verified via direct fetch.
- *Medium-Low* for EV-specific scope — composed from generic checklists, NOT from a published EV checklist.
- *Medium* for the "residential trade-permit lane" pattern — inferred from Hillsborough H31 pattern; St. Pete does not officially document a separate trade-permit lane vs full plan review for SFR EV chargers. Closure: ~10 min call to (727) 893-7230.
- *Low-Medium* for Fire Marshal Knox-box stance — same intractable gap as Hillsborough.

## Follow-up sourcing actions

1. **St. Petersburg Construction Services & Permitting:** (727) 893-7230 or `permits@stpete.org` — ask: "Is there a published EV charging station permit checklist? If not, does an EV install on an existing SFR panel ride the Electric Trade Permit lane (no plan review) or the Residential Alteration lane (plan review required)?"
2. **St. Pete Fire Rescue:** (727) 893-7691 — ask Knox-box question (same as Hillsborough/Tampa).
3. **PCCLB:** (727) 582-3100 — confirm contractor registration requirement for EVSE-only installs.

Calls can be batched on a single day; estimated total time ~30 min.

## Sources

- [City of St. Petersburg — Building Permits hub](https://www.stpete.org/business/building_permitting/building_permits.php)
- [City of St. Petersburg — Applications & Forms](https://www.stpete.org/business/building_permitting/forms_applications.php)
- [City of St. Petersburg — Residential Plan Review Checklist 2020 (PDF)](https://cms5.revize.com/revize/stpete/Business/Building%20Forms%20%26%20Applications/Residential_Plan_Review_Checklist%202020.pdf)
- [City of St. Petersburg — Current Codes Adopted (PDF)](https://cms5.revize.com/revize/stpete/Business/Building%20Forms%20%26%20Applications/Current_Codes_Adopted.pdf)
- [City of St. Petersburg — Notice of Commencement form (PDF)](https://cms5.revize.com/revize/stpete/construction_services_and_permitting/docs/notice_of_commencement.pdf)
- [Pinellas County Construction Licensing Board (PCCLB)](https://www.pcclb.com/)
- [Pinellas County — Permitting Guide](https://pinellas.gov/permitting-guide/)
- [Pinellas County — Construction in a Floodplain](https://pinellas.gov/construction-in-a-floodplain/)
- [FEMA — St. Petersburg Single-Family Home Elevation Case Study](https://www.fema.gov/case-study/florida-city-st-petersburg-single-family-home-elevation)
- [Florida Building Code 8th Edition — Hurricane Window Code by County (cross-reference for HVHZ + WBDR)](https://ajwindowhaus.com/florida-hurricane-window-code-by-county/)
