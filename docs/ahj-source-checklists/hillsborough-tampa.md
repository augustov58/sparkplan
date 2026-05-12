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

**Medium.**
- *High* for the Hillsborough Commercial Electrical Permit Requirements page (fetched directly from `hcfl.gov`, verbatim quoted).
- *Medium-Low* for Tampa residential because the City of Tampa publishes minimal up-front documentation — most of the procedural info comes from a third-party guide (evprosolutions.com) cross-referenced against the official Accela portal and Tampa's construction services landing page. The official Tampa residential electrical landing (`tampa.gov/construction-services/residential-permits/electric-plumbing`) is sparse.
- *Lower* for Hillsborough Residential & Mobile Home Checklists — the index page exists at `hcfl.gov/businesses/hillsgovhub/residential-and-mobile-home-checklists` but individual checklist PDFs were not accessible during this research pass. Recommend a follow-up research ping before M1 manifest implementation to grab the residential-specific PDF(s) if they exist.
- The biggest unknown: **does Hillsborough or Tampa have any commercial Knox-box / emergency-shutoff requirement enforced by the fire department, even if not on the electrical checklist?** Davie's checklist names this explicitly. Hillsborough/Tampa might enforce it via the Fire Marshal independently of the electrical permit — worth confirming with a contractor or plans examiner before M1 manifest finalization.
