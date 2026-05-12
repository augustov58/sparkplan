# Hillsborough County / City of Tampa — EV Charging Station Permit Checklist

**Sourced:** 2026-05-12
**Source URL(s):**
- **Hillsborough County Commercial Electrical Permit Requirements (official, primary)**: https://hcfl.gov/businesses/hillsgovhub/commercial-construction-checklists-and-requirements/commercial-electrical-permit-requirements
- Hillsborough HillsGovHub portal: https://hcfl.gov/businesses/hillsgovhub
- Hillsborough Residential & Mobile Home Checklists hub: https://hcfl.gov/businesses/hillsgovhub/residential-and-mobile-home-checklists
- Hillsborough submittal requirements landing: https://hcfl.gov/businesses/hillsgovhub/submittal-requirements-and-checklists
- City of Tampa Accela portal: https://aca-prod.accela.com/TAMPA/Default.aspx
- City of Tampa Residential Electrical/Plumbing page: https://www.tampa.gov/construction-services/residential-permits/electric-plumbing
- City of Tampa Construction Services forms hub: https://www.tampa.gov/document-group/construction-services-forms-and-documents
- Tampa Electric (TECO) charger install guide: https://www.tampaelectric.com/electricvehicles/evsforhome/installingacharger/
- Industry context (used for cross-validation, not primary): https://www.evprosolutions.com/blog/tampa-ev-charger-installations-step-by-step-permit-guide-for-hillsborough-county-city-of-tampa

**Official EV-specific checklist available:** **No.** Neither Hillsborough County nor the City of Tampa publishes a dedicated EV-charging permit checklist PDF. EV scope is handled under the generic Electrical Trade Permit (residential) or Commercial Electrical Permit (commercial / multi-family) workflows.

**Notes:**
- Hillsborough/Tampa is the **most permissive** of the five AHJs for residential EV: most Level-2 home EV chargers fall under a "Residential Electric Trade Permit (no plan review)" — applicant uploads a simple scope, panel rating, proposed breaker size, and a one-line diagram **only if requested**. This means SparkPlan's full packet is *over-spec* for residential Hillsborough/Tampa — the M1 manifest must downgrade many `required: true` items to `recommended: true` for residential lane.
- The **commercial** path is the opposite — Hillsborough's commercial electrical permit requirements list is comprehensive and includes panel schedules, riser/one-line, fault current implied (NEC 110.9/10), grounding, load calcs, and digital signing/sealing by a Florida-registered architect or engineer.
- **Two jurisdictions, two portals:** Unincorporated Hillsborough → HillsGovHub; City of Tampa → Accela Citizen Access. M1 manifest needs `subjurisdiction = 'unincorporated_hillsborough' | 'city_of_tampa'`.
- **TECO coordination:** Tampa Electric requires permits and inspections before energizing service for EVSE work — this is a utility-side concurrence, not a city checklist item, but worth surfacing.

## Source artifacts (verbatim from Hillsborough Commercial Electrical Permit Requirements page)

**General intake requirements:**
> "Building plans designed in accordance with the current Florida Building Code (FBC) and digitally signed and sealed by a State of Florida Registered Architect or Engineer"
> "Designer credentials must include name, registration number, complete address, and phone number"
> "Recorded certified copy of Notice of Commencement in accordance with Florida Statutes 713.13 (required prior to the first inspection)"
> "Private Provider documentation if applicable"

**Required plan elements (verbatim list):**
> "Wiring / Services / Feeders and branch circuits / Overcurrent protection / Grounding / Wiring methods / GFCIs / Equipment / Special occupancies / Emergency systems / Communications systems / Low voltage / Load calculations / Design flood elevation"

**Acceptable submittal items (verbatim):**
> "Designer name and registration number with original signature on all plans"
> "Type, location, and capacity of all service equipment and grounding on line type riser diagram"
> "Quantity, size and type of junction box or wire way"
> "Quantity, size and type of all wiring installed"
> "Wiring methods, raceway or cable types"
> "Location of every electrical outlet, including switches"
> "The wattage or amperages of outlets"
> "The location, voltage, horsepower, kilowatt or similar rating of every motor or generator"
> "The location, voltage, horsepower, kilowatt or similar rating of every motor controller or disconnect switch"
> "Location and wattage of every transformer or appliance installed"
> "Details of panel board, switchboard and distribution centers showing type and arrangement of switches, over current device ratings, and control equipment"
> "Panel or switchboard schedule detailing wattages/amperages, and the number of active or branch circuits to be installed and the number of spare or branch circuits for future use"
> "The location of fire systems and exit lamps"
> "Load calculations"
> "Voltage drop considerations"

**City of Tampa residential context (Accela Citizen Access guide):**
- "Residential Electric Trade Permit (no plan review)" — applicant selects Residential → Electric Trade Permit, uploads scope + panel rating + proposed breaker size + "one-line if requested"
- Final inspection: "ELE-Final" verifies "conductor sizing, breaker/gfci where applicable, labeling, working clearances, and proper mounting"
- Florida state surcharge: 2.5% of permit value or $4 minimum
- Owner-Builder option available for "1- or 2-family, owner-occupied dwelling"

## Line-by-line cross-walk (mirrors Orlando matrix)

**Two lanes apply for Hillsborough/Tampa: (R) Residential ≤1-or-2-family no-plan-review trade permit, (C) Commercial / multi-family with full plan review.**

| Hillsborough/Tampa line item | EV-fed-from-existing (R) | EV-fed-from-existing (C) | EV-fed-from-new-service (R/C) | Currently in packet | Sprint where addressed |
|---|---|---|---|---|---|
| Trade Permit Application (Accela or HillsGovHub) | Required | n/a (full permit instead) | Required | ❌ generator does not produce | Sprint 2B (H5) |
| Commercial Electrical Permit application — full review | n/a | Required | Required (C) | ❌ | Sprint 2B (H5) |
| Simple electrical scope narrative | Required | n/a (replaced by plans) | – | ✓ general notes serve | done (H12) |
| Panel rating + proposed breaker size | Required | Required (in panel schedule) | Required | ✓ panel schedules | done (C4) |
| **One-line / riser diagram** | "If requested" (R); standard (C) | Required | Required | ✓ | done (M6, H9) |
| **Plans digitally signed and sealed by FL-registered PE or RA** | n/a (R, no plan review) | **Required** | Required (C); n/a (R) | 🔴 no PE infrastructure | **Sprint 3 (C5)** — Hillsborough commercial path *cannot* skip PE seal |
| Designer name + reg # + original signature on plans | n/a (R) | Required (C) | Required (C) | 🔴 not yet | Sprint 3 (C5) |
| Notice of Commencement >$5k (FS 713.13) | Required | Required | Required | ❌ | Sprint 2B (H5) |
| Private Provider documentation (if applicable) | n/a | Conditional | Conditional | ❌ | Sprint 2B (conditional upload) |
| **Load calculations** (NEC 220) | Implied via scope (R) | Required | Required | ✓ | done (C1) |
| **Voltage drop considerations** | Implied (R) | Required | Required | ✓ | done (H13) |
| **Service equipment + grounding on riser** (incl. type, location, capacity) | Implied (R) | Required (C) | Required (C) | ✓ | done (M6, M3) |
| Wiring methods, raceway/cable types | Implied (R) | Required (C) | Required (C) | ✓ implied; consider explicit callout | done; verify per-feeder method label |
| **Panel / switchboard schedule** (wattages, amps, active + spare branch circuits) | n/a (R) | Required (C) | Required (C) | ✓ | done (C4) |
| Location of every electrical outlet / switches / wattage | n/a (R) | Required (C) | Required (C) | ✓ panel schedules; spatial location is on site plan (H7) | partial — spatial outlet locations come from H7 upload |
| Voltage / HP / kW for each motor / disconnect / transformer | n/a (R) | Required (C) when present | Required (C) when present | ✓ when in scope | done |
| **Fault current / AIC** (implied via NEC 110.9/10 / overcurrent protection) | n/a (R) | Required (C) | Required (C; new service) | ✓ | done (PR #31, PR #40) |
| Design flood elevation | n/a (R typical) | Conditional (flood zone) | Conditional (flood zone) | ❌ — not in packet | **H30 candidate** |
| Site plan (location of EV charger relative to property) | Implied (R, simple) | Required (C) | Required (C) | ❌ | Sprint 2B (H7) |
| Per-sheet contractor signature | Required (R, contractor licensed) | Required (C) | Required | ✓ | Sprint 2A C8 (✓ done) |
| FBC / NEC reference block | Required (statewide) | Required | Required | ✓ | Sprint 2A C7 / H4 (✓ done) |
| Cover sheet TOC | Best practice (not explicit) | Best practice (helpful for review) | Best practice | ✓ | Sprint 2A H1 (✓ done) |
| EVEMS narrative (NEC 625.42) | Conditional | Conditional | Conditional | ✓ | done (H10) |
| EVSE labeling (NEC 625.43) | Required | Required | Required | ✓ | done (H11) |
| HOA / condo approval letter | n/a explicit (no AHJ-level requirement) | n/a | n/a | – | – |
| Knox-box / emergency shutoff | n/a | n/a (not in HCFL checklist) | n/a | – | – |
| Wind anchoring for outdoor pedestals (HVHZ-style) | n/a — Hillsborough not in HVHZ | n/a | n/a | – | – |
| TECO permit-and-inspection-before-energizing requirement | Process (utility) | Process (utility) | Process (utility) | n/a — process | – |

## Findings (potential new H-numbers)

**H30 — Design Flood Elevation (DFE) reference on plans for flood-zone projects.**
Hillsborough's commercial electrical permit requirements explicitly list "Design flood elevation" as a required plan element. SparkPlan does not currently surface flood-zone status anywhere in the packet. For coastal / Hillsborough Bay projects, EVSE in flood-zone parking decks needs to demonstrate elevation above DFE per FBC. Action: M1 manifest flags this as `manual_verification_required` when `flood_zone != 'X'`; ideally Sprint 2B+ adds a flood-zone field to the project intake. **Severity: Medium** for any project in a special flood hazard area; **N/A** otherwise.

**H31 — Residential-lane requirement downgrades for "no plan review" trade permits.**
Hillsborough's residential lane (and Tampa's, and many other FL AHJs') doesn't require a full plan-review packet for simple Level-2 home EV chargers — just a trade-permit application + scope + panel info. SparkPlan currently always generates the full packet, which is overkill for residential trade-permit-only. M1 manifest needs a `lane = 'residential_trade_permit_only'` mode that emits a much shorter packet (essentially: application + scope narrative + panel rating + breaker size + optional one-line) and downgrades the rest to `recommended`/`omitted`. **Severity: Medium** — affects the contractor's experience but doesn't block intake; the over-spec packet still passes review, it's just heavier than needed. Worth surfacing because Hillsborough/Tampa is the *expected* high-volume AHJ for residential pilot.

**H32 — Two-portal jurisdiction split (HillsGovHub vs Tampa Accela).**
This isn't a packet-content finding — it's a manifest-routing finding. M1 needs `subjurisdiction` to pick the right intake portal and form set. **Severity: Low** for packet generation; **Medium** for any "intake-blocker" flag because we'd be flagging the wrong portal otherwise.

**H33 — Private Provider documentation slot.**
Hillsborough's commercial path optionally accepts "Private Provider" plan review under FS 553.791 (alternate path that bypasses the County's plan reviewer). SparkPlan packet doesn't currently track or flag Private Provider use. **Severity: Low** — niche, but worth a manifest slot for completeness.

## Confidence level

**Medium-High.** *(Upgraded from Medium on 2026-05-12 second pass — see Follow-up sourcing section below. Not full High because Tampa Fire Rescue Knox-box stance remains officially un-sourced.)*
- *High* for the Hillsborough Commercial Electrical Permit Requirements page (verbatim from `hcfl.gov`).
- *High* for **Hillsborough residential lane** after 2nd-pass confirmation that no dedicated electrical or EV residential checklist PDF exists — the County has fully migrated from PDF checklists to webpage-only content for residential, and the residential-alterations page makes no mention of a separate trade-permit lane (it instead requires sealed plans, which contradicts the third-party trade-permit-no-plan-review narrative). **See H35 below — narrative now needs revision.**
- *Medium-Low* (unchanged) for Tampa residential procedural detail — `tampa.gov` publishes minimal up-front documentation.
- *Medium* (unchanged) for Knox-box stance — Tampa Fire Rescue's official codes-in-use page lists wildly stale editions (1985–1997) and is clearly out of date; the operative code is FFPC 8th ed (NFPA 1, 2021) statewide. Knox-box is therefore **AHJ-discretionary** per NFPA 1 § 18.2.2, but no Tampa- or Hillsborough-specific ordinance text was discoverable via web search — confirming the per-AHJ stance requires a phone call.

## Follow-up sourcing (2026-05-12, second pass)

Three gaps from the first pass were investigated; two closed, one remains intractable without direct contact.

### Gap 1 (partially closed → reframed as H35/H36): Hillsborough Residential Electrical & Mobile Home Checklist PDFs

**Finding:** Hillsborough County has **migrated away from PDF-based residential checklists**. The index page `https://hcfl.gov/businesses/hillsgovhub/residential-and-mobile-home-checklists/residential-checklists` ("Other Residential Checklists - PDF Versions") returns **"No data available — 0-0 of 0"** as of 2026-05-12. The hub at `https://hcfl.gov/businesses/hillsgovhub/residential-and-mobile-home-checklists` lists ~14 webpage-only checklists (Accessory Structures, Backup Generators, Mobile Home Setup - Private Property, Pool Construction, Solar PV Checklist, etc.) — **none specifically electrical** and **none EV-specific**.

**The two closest hits:**
1. **Residential Backup Generators Requirements** (webpage) — closest electrical-adjacent webpage; cross-validates that residential electrical scope in unincorporated Hillsborough has its own webpage-only requirement page (https://hcfl.gov/businesses/hillsgovhub/residential-and-mobile-home-checklists/residential-backup-generators-requirements).
2. **Mobile Home Setup - Private Property Checklist** (PDF — actual PDF found): https://www.hillsboroughcounty.org/library/hillsborough/media-center/documents/development-services/permits-and-records/permits/building-permits/checklists/mobile-home-private-property-checklist.pdf — this is the only true PDF checklist found in the residential category, and it covers mobile-home **setup** (zoning, NOC, sewer/water, mechanical, structural), **not** electrical scope.

**Re-examination of "Residential Alterations (Renovations)":**
Fetched `https://hcfl.gov/businesses/hillsgovhub/residential-and-mobile-home-checklists/residential-alterations-renovations` directly — verbatim: *"Building plans designed in accordance with the current Florida Building Code (FBC) and digitally signed and sealed by a State of Florida Registered Architect or Engineer"*. **This contradicts the third-party `evprosolutions.com` narrative that residential trade-permit work bypasses plan review.** It suggests that for any residential alteration in unincorporated Hillsborough — including an EV charger circuit addition that touches the panel — a sealed plan set may be required. Plain Level-2 EV charger circuit installs may still bypass via "Electric Trade Permit" type in HillsGovHub, but no `hcfl.gov` page confirms this lane verbatim.

**Action:** See **H35** and **H36** below.

### Gap 2 (closed via cross-validation): Tampa residential trade-permit details

**Finding:** No verbatim City-of-Tampa source for "Residential Electric Trade Permit (no plan review)" was located on `tampa.gov`. The `tampa.gov/construction-services/residential-permits/electric-plumbing` page is sparse. The detailed narrative ("Apply online at Accela, upload contractor license/insurance + scope + panel rating + proposed load + drawings if requested, final inspection ELE-Final") is **only sourced from `evprosolutions.com`** — a third-party EV-installer blog.

**Cross-validation that bumps confidence:** The procedural narrative is corroborated by:
- TECO (Tampa Electric)'s "Installing a Charger" guide (`https://www.tampaelectric.com/electricvehicles/evsforhome/installingacharger/`) which references "permit and inspection" as a single-step process for residential EV charger installs.
- The City of Tampa Accela portal exists (`https://aca-prod.accela.com/TAMPA/Default.aspx`) and is the operative residential intake portal.
- Industry sources (permitmint.com, levin-electric.com) all describe Tampa Level-2 EV residential permits as a same-day single-trade permit pathway with no plan review required.

**Conclusion:** The Tampa residential trade-permit-no-plan-review narrative is **cross-validated** but not officially documented by the City. Status: cross-validated **Medium-High** confidence; final verification requires a 5-min call to Tampa Construction Services (813-274-3100).

### Gap 3 (intractable → flagged for direct contact): Fire Marshal Knox-box stance

**Finding:** Both `hcfl.gov/businesses/permits-and-records/inspections/fire-marshal-inspection-services` and `hcfl.gov/businesses/permits-and-records/applications-and-forms/fire-marshal` were fetched directly — **neither page mentions Knox box, key box, rapid entry, emergency access, or EV/EVSE**. The Hillsborough County Code Chapter 26 (Fire Prevention and Protection) via Municode returned no body content via WebFetch (loads JS-only).

The City of Tampa's `tampa.gov/fire-rescue/info/city-of-tampa-code` "Codes In Use" page is **demonstrably out of date** — it lists "National Fire Codes Adopted, 1997 edition" and "Life Safety Code, 1997 edition", which is decades behind the operative Florida Fire Prevention Code 8th edition (NFPA 1, 2021) — see `https://myfloridacfo.com/division/sfm/bfp/florida-fire-prevention-code`. This page is therefore not a reliable source for current Knox-box stance.

**Operative statewide code:** NFPA 1, 2021 § 18.2.2.1 — *"The Authority Having Jurisdiction shall have the authority to require an access box(es) to be installed in an accessible location where access to or within a structure or area is difficult because of security."* This is **AHJ-discretionary** and the AHJ in this case is Hillsborough County Fire Marshal (unincorporated) or Tampa Fire Rescue (city). Davie's checklist names Knox-box explicitly for commercial EVSE; Hillsborough's commercial-electrical checklist does **not** — but the commercial-electrical checklist is the *electrical* trade reviewer's checklist, not the Fire Marshal's. The Fire Marshal review is a separate parallel track triggered by occupancy / sprinkler / alarm / commercial scope.

**Conclusion:** No web-discoverable source confirms whether Hillsborough Fire Marshal or Tampa Fire Rescue requires Knox-box for commercial EVSE. Best-guess inference: Knox-box is **almost certainly required for any new commercial-occupancy building** in either jurisdiction (consistent with NFPA 1 18.2.2 broad adoption across FL), but whether a **standalone commercial EVSE retrofit** triggers a fresh Knox-box requirement (versus inheriting an existing one from the host building) requires a phone call.

**Action items for next research pass:**
1. **Hillsborough Fire Marshal:** (813) 744-5541 or `firemarshal@hcfl.gov` — ask: "Does a commercial parking-lot EVSE retrofit on an existing building with an existing Knox box trigger any new Knox-box requirement, or does it inherit?"
2. **Tampa Fire Rescue:** (813) 274-7000 — same question.
3. Both calls: ~15 min each; can be batched on a single day.

## New findings from second pass

**H35 — Hillsborough County has deprecated PDF-based residential checklists.**
The "Other Residential Checklists - PDF Versions" page at `hcfl.gov/businesses/hillsgovhub/residential-and-mobile-home-checklists/residential-checklists` returns "0-0 of 0" data rows. Hillsborough has migrated residential checklists to webpage-only format. **Implication for SparkPlan:** the M1 manifest cannot rely on a "linked PDF checklist" pattern for Hillsborough residential — must instead use the webpage URL as the manifest source-of-truth pointer. **Severity: Low** for packet content; **Medium** for our internal manifest-build workflow (we may have other AHJs in pilot 2 / pilot 3 that follow the same migration pattern — Solar Forum's pattern shows several FL counties trending this way).

**H36 — Hillsborough residential plan-review threshold ambiguity.**
The `hcfl.gov` Residential Alterations page verbatim requires "Building plans designed in accordance with the current FBC and digitally signed and sealed by a State of Florida Registered Architect or Engineer". This **contradicts** the third-party `evprosolutions.com` claim that residential Level-2 EV chargers can bypass plan review via Electric Trade Permit. The likely reconciliation: an *Electric Trade Permit* (no alteration scope) DOES bypass plans, but a *Residential Alteration* (different permit type) does NOT. **The intake category the contractor picks in HillsGovHub determines the lane.** SparkPlan's M1 manifest must:
- Either prescribe `permit_type = 'electric_trade_permit'` in the generated cover letter / application form to lock the lane,
- Or surface this distinction explicitly in the contractor-facing UI so they pick the right intake category.
**Severity: Medium UX** — picking the wrong intake category at HillsGovHub triggers a plan-review requirement that's avoidable. Compounds H31's residential-trade-permit lane downgrade. Worth a contractor-facing tooltip in M1.

**H37 — Tampa Fire Rescue's published "Codes In Use" page is stale.**
The `tampa.gov/fire-rescue/info/city-of-tampa-code` page lists 1985–1997 editions of fire codes. The operative code is FFPC 8th ed (NFPA 1, 2021) per Florida statute 633.202 (since 2023-12-31). SparkPlan should NOT cite Tampa's published code edition list — it is unreliable. Instead, reference the statewide FFPC 8th ed citation. **Severity: Low** for packet (most contractors know not to trust this); **Medium informational** flag for SparkPlan's "Code references" rendering — should default to FFPC 8th / NFPA 1 2021 for all FL AHJs unless a specific AHJ has authoritative documentation otherwise.
