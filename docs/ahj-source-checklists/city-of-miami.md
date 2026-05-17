# City of Miami — EV Charging Station Permit Checklist (research notes)

**Sourced:** 2026-05-16
**Source URL(s):**
- City of Miami Permits & Construction landing: https://www.miami.gov/Permits-Construction
- City of Miami Permitting Forms & Documents (catalog): https://www.miami.gov/Permits-Construction/Permitting-Resources/Permitting-Forms-Documents
- City of Miami State of Florida Applicable Codes: https://www.miami.gov/My-Government/Departments/Building/Building-Services/State-of-Florida-Applicable-Codes
- City of Miami iBuild digital permit portal: https://www.miami.gov/Permits-Construction/Apply-for-or-Manage-Building-Permits-iBuild
- City of Miami Private Provider Program: https://www.miami.gov/My-Government/Departments/Building/Private-Provider-Program
- City of Miami Building Permit Application PDF (legacy form, public download): https://www.miami.gov/files/sharedassets/public/v/1/building/legacy-permitapplication-1.pdf
- City of Miami Private Provider Program general information PDF (2022): https://www.miami.gov/files/assets/public/v/1/document-resources/pdf-docs/building/private-provider/r01-pp-general-information-2022.pdf
- City of Miami Sub-Permit catalog page: https://www.miami.gov/Permits-Construction/Permit-Catalog/Get-a-Sub-Permit
- City of Miami Building Permit Fee Schedule: https://www.miami.gov/Permits-Construction/Permitting-Resources/City-of-Miami-Building-Permit-Fee-Schedule
- City of Miami Building Department homepage: https://www.miami.gov/My-Government/Departments/Building
- HVHZ wind-load reference for Miami (175 mph 3-sec gust, Risk Cat II): https://windload.solutions/cities/miami-wind-load-requirements
- HVHZ Florida-statewide regulatory reference: https://www.floridabuilding.org/fbc/thecode/2013_Code_Development/HVHZ/FBCB/Chapter_16_2010.htm
- Permit aggregator EV-charger overview for Miami (corroborating, lower weight): https://permitmint.com/permits/florida/miami/ev_charger/
- FCC private-provider scope statement for City of Miami (third-party but explicit on scope retention): https://freedomcodecompliance.com/municipalities/city-of-miami-private-provider

**Official EV-specific checklist available:** **No.** The City of Miami Building Department does NOT publish a dedicated "Vehicle Charging Station Checklist" PDF (unlike Pompano Beach, which publishes a 1-page checklist updated 01/29/2024). City of Miami's published forms catalog covers general building/electrical/mechanical permit applications and the Private Provider Program; EV-specific requirements are derived from the standard electrical permit application + FBC 8th ed (2023) Electrical adoption + HVHZ scope.

**Confidence: MEDIUM.**
- HIGH confidence on: code basis (NEC 2020 + FBC 8th ed 2023), HVHZ enforcement (every parcel inside Miami-Dade is in the HVHZ), independent-AHJ status (City of Miami is one of 34 incorporated munis distinct from Miami-Dade County RER), NOC threshold (FL Statute 713 $5k statewide), Private Provider Program participation (FL Statute 553.791).
- MEDIUM confidence on: exact intake document list — derived from the general Building Permit Application form + applicable-codes page, not from a dedicated EV checklist. miami.gov returned HTTP 403 on direct WebFetch during research (likely an anti-bot WAF response); secondary corroborators (permit aggregators + third-party private-provider services) were used to fill in.
- LOW confidence on: sheet-ID prefix mandate (defaulted to FL-standard `E-` because no published guidance prescribes the `EL-` convention that MD County RER uses), per-building-type NEC fork (defaulted to uniform NEC 2020 because no published Plan Review Guidelines split residential vs commercial editions).

**Notes:**
- City of Miami is an **independent AHJ** within Miami-Dade County. Miami-Dade County RER (covered by `data/ahj/miami-dade.ts`) reviews ONLY unincorporated areas; the 34 incorporated municipalities each run their own building department. This manifest captures City of Miami specifically.
- City of Miami runs its own iBuild digital portal — applications are not filed against the Miami-Dade "yellow form" used by County RER.
- Plan review, zoning, fire safety, and public works remain with the City of Miami Building Department even when a private provider is elected. The private provider performs the FBC compliance review and inspections; City of Miami retains permit issuance, fees, zoning, fire, and public works approvals.
- HVHZ enforcement: All of Miami-Dade County (including City of Miami) lies inside the High-Velocity Hurricane Zone per FBC 8th ed (2023), Chapter 16. Design wind speed 175 mph 3-sec gust, Risk Category II. Outdoor pedestal- or bollard-mounted EVSE must be anchored per Florida Product Approval, Miami-Dade Notice of Acceptance (NOA), or signed-and-sealed structural anchorage plans.

## Source artifacts

**Code basis (from City of Miami Applicable Codes page + permit aggregator confirmation):**
- Florida Building Code, 8th Edition (2023) including HVHZ provisions
- NFPA-70 (2020 NEC) — adopted by FBC 8th ed Electrical
- Notably referenced NEC sections for EV scope: NEC 625.41 (125% continuous load), NEC 625.42 (Energy Management System), NEC 625.50 (wet location), NEC 625.54 (GFCI protection)

**Permit application:**
- Building Permit Application (City of Miami form, NOT the Miami-Dade "yellow form")
- Electrical category checked on the master application; sub-permit electrical permit issued separately when needed (per https://www.miami.gov/Permits-Construction/Permit-Catalog/Get-a-Sub-Permit)
- Submitted through iBuild digital portal

**Required intake documents (derived from general electrical permit guidance + corroborator review):**
- Site plan or electrical schematic showing EV charger location, panel location, and feeder route
- Manufacturer cut sheets / installation manual (UL-2202 / UL-2594 listings per NEC 110.2-3)
- Notice of Commencement when contract price > $5,000 (FL Statute 713)
- HOA / Condominium Association approval letter when install is in a condo or HOA-governed property (Brickell / downtown Miami norm)
- HVHZ anchoring documentation (FL Product Approval / MD-NOA / signed-and-sealed structural) for outdoor pedestal/bollard EVSE
- Notice to Building Official + Certificate of Compliance when Private Provider review elected (FL Statute 553.791)

**Inspections (per general electrical permit guidance):**
- Electrical rough-in (when feeder runs through walls/ceilings)
- Electrical final
- Building inspections may also apply for ground-mounted pedestal anchoring; HVHZ enforcement typically pulls in a building-final inspection on outdoor installs.

**Contact:**
- City of Miami Building Department, (305) 416-1100, building@miamigov.com

## Line-by-line cross-walk (mirrors Pompano / Orlando matrix structure)

| City of Miami line item | EV-fed-from-existing | EV-fed-from-new-service | Currently in SparkPlan packet | Source |
|---|---|---|---|---|
| City of Miami Building Permit Application (electrical category) | Required | Required | partially (NOC slot as proxy until dedicated app slot lands) | miami.gov/Permits-Construction |
| Notice of Commencement (>$5,000) | Conditional (defensible-default ON for non-SFR) | Conditional | ❌ slot only | FL Statute 713 |
| HOA / Condo approval letter | Conditional (non-SFR default ON; SFR toggle) | Conditional | ❌ slot only | statewide pattern |
| HVHZ anchoring (FL Product Approval / MD-NOA / signed-sealed) | Required (outdoor) | Required (outdoor) | ❌ slot only | FBC 8th ed Ch. 16 HVHZ |
| Site plan showing EVSE + panel locations | Required | Required | ❌ slot only | general electrical permit guidance |
| Riser diagram (one-line) | Required | Required | ✓ | Sprint 1+2A (M6, H9) |
| Electrical plan (panel + equipment schedules) | Required | Required | ✓ | Sprint 1+2A |
| Load calculations | Required | Required | ✓ | Sprint 1 C1/C2 |
| Manufacturer cut sheets / installation manual (UL listings) | Required | Required | ✓ specs page; cut sheet upload | Sprint 2A H15 + H8 |
| Available fault current calc (NEC 110.9/10) | – | Required | ✓ | Sprint 2A H4 |
| Grounding electrode + GEC sizing (NEC 250.66 / 250.24(B)) | – | Required | ✓ | Sprint 2A H4 |
| Voltage drop note | Best practice | Best practice | ✓ | Sprint 2A H13 |
| Per-sheet contractor signature + DBPR license | Required | Required | ✓ | Sprint 2A C8 |
| FBC + NEC code reference block | Required | Required | ✓ | Sprint 2A C7/H4 |
| PE seal | Conditional (`pe_required` lane only) | Conditional | – (Sprint 3) | FL Statute 471.003(2)(h) lane logic |
| Private Provider NTBO + COC | Optional (when elected) | Optional | ❌ slot only | FL Statute 553.791 |
| EVEMS narrative (NEC 625.42) | Conditional | Conditional | ✓ | Sprint 2A H10 |
| EVSE labeling (NEC 625.43) | Required | Required | ✓ | Sprint 2A H11 |

## Research gaps (left for human follow-up)

**G1 — No published City of Miami EV-specific checklist.**
Unlike Pompano Beach (which publishes a 1-page "Vehicle Charging Station Checklist" PDF dated 01/29/2024), City of Miami's Permitting Forms & Documents library does not include a dedicated EV checklist. The requirements in this manifest are derived from the City's general Building Permit Application + FBC 8th ed (2023) Electrical adoption + HVHZ Chapter 16 + corroborating third-party permit aggregator coverage. A 5-minute phone call to the City of Miami Building Department, (305) 416-1100, would confirm whether they have an unpublished internal checklist for EV installations specifically. **Severity: Medium** — this is the same documentation gap MD County RER would have in the absence of its published Plan Review Guidelines. Manifest content is conservative; over- vs under-listing risk is biased toward over-listing (defensible defaults).

**G2 — Sheet ID prefix convention not prescribed.**
The City of Miami forms catalog does not prescribe a discipline-prefix convention (vs Miami-Dade RER's `EL-` per H20). Defaulted to the FL-standard `E-`. A Miami plans-examiner phone call would confirm whether `EL-` is also accepted or required — but since no source prescribes `EL-` at the City level, `E-` is the safe default.

**G3 — Per-building-type NEC fork not documented.**
Miami-Dade County RER carries an H34-style residential (NEC 2014) vs commercial (NEC 2020) PRG split. City of Miami publishes no per-building-type Plan Review Guidelines, so all three building types default to NEC 2020 (per FBC 8th ed Electrical adoption). If the City informally still references NEC 2014 on residential plan reviews (mirroring RER), this manifest would over-cite the edition; downstream correction would update `necEdition.single_family_residential` to `'NEC 2014'`.

**G4 — Zoning Compliance / Fire Review involvement at City of Miami level.**
Pompano Beach's 3-permit-form intake (H21 zoning + H22 fire) is Broward-specific. City of Miami may have analogous zoning / fire review touchpoints for commercial EVSE installs, but no City of Miami source surfaced this requirement during research. Not added to the manifest pending source confirmation; if it surfaces post-launch, add `zoning_application` and `fire_review_application` to `relevantArtifactTypes` with `buildingType !== 'single_family_residential'` predicates (mirroring Pompano).

**G5 — Fire-stopping schedule (NEC 300.21 + FBC 712/714) at City of Miami level.**
Miami-Dade County RER lists fire-stopping as a Commercial PRG line item. City of Miami's published forms do not call this out as a standalone intake item. Not added to the manifest pending source confirmation. Commercial / multi-family permittees in City of Miami likely still need to comply with NEC 300.21 (it's a national code), but the documentation requirement at the intake stage is unclear without a published PRG.

## Confidence summary

**MEDIUM.** All architecturally significant claims (independent AHJ, HVHZ enforcement, NEC 2020, FBC 8th ed 2023, NOC threshold, Private Provider Program participation, iBuild digital portal) are sourced from official miami.gov pages or directly corroborated by published Florida statutes / FBC code. The line-by-line intake list is derived from the City's general Building Permit Application + FBC 8th ed Electrical adoption + corroborating third-party permit aggregator coverage — not from a dedicated EV-specific checklist (which the City does not publish). Gaps G1-G5 noted above for human follow-up.
