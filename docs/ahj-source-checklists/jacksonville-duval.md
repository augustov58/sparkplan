# City of Jacksonville / Duval County (Consolidated) — EV Charging Station Permit Checklist

**Sourced:** 2026-05-16
**Source URL(s):**
- **City of Jacksonville Building Inspection Division (BID) — primary**: https://www.jacksonville.gov/departments/public-works/building-inspection-division
- **BID Codes page (authoritative, currently enforced codes)**: https://www.jacksonville.gov/departments/public-works/building-inspection-division/codes
- **BID Checklists, Forms and Documents**: https://www.jacksonville.gov/departments/public-works/building-inspection-division/checklists,-forms-and-documents
- **JaxEPICS online permit portal**: https://jaxepics.coj.net/
- **JaxEPICS electronic plan submittal guidance**: https://www.jacksonville.gov/departments/planning-and-development/building-inspection-division/electronic-plan-submittal
- **BID Residential Permits**: https://www.jacksonville.gov/departments/public-works/building-inspection-division/residential-permits
- **BID FAQs**: https://www.jacksonville.gov/departments/public-works/building-inspection-division/faqs
- **Notice of Commencement form (Rev. 4-14-2026)**: https://www.jacksonville.gov/getContentAsset/36e7bec6-265a-4c1a-b153-7c8ede7d2d1c/135b97c9-84fa-4e82-b956-0fbccec4aa1f/Notice-of-Commencement-Rev-4-14-2026.pdf?language=en
- **Floodplain definitions (Jacksonville Development Services)**: https://www.jacksonville.gov/departments/planning-and-development/development-services-division/floodplain-definitions.aspx
- **Code of Ordinances (Municode), Title VIII Construction, Chapter 320**: https://library.municode.com/fl/jacksonville/codes/code_of_ordinances?nodeId=TITVIIICOREBUCO_CH320GEPR
- Industry context (cross-validation, not primary):
  - https://www.jaspector.com/permits/florida/duval/jacksonville/
  - https://legacyengineering.com/blog/how-do-i-submit-for-a-building-permit-in-jacksonville-florida
  - https://www.davidgrayonline.com/blog/2023/july/ev-charger-permits-in-florida-a-guide/

**Official EV-specific checklist available:** **No.** Jacksonville BID does not publish a dedicated EV-charging permit checklist PDF. EV scope routes through the generic electrical sub-permit lane via JaxEPICS. The two electrical-specific forms published on the BID Checklists / Forms page are scope-narrow utility forms (Emergency Reconnect Letter, Electrical Temporary Service Letter) and not intake checklists.

## Notes

- **Consolidated city-county since 1968.** The City of Jacksonville and Duval County share one government following the 1968 consolidation referendum. The Building Inspection Division (BID) under Jacksonville Public Works handles all permits for the consolidated jurisdiction via JaxEPICS. The manifest models this as `jurisdictionType: 'city'` (it's a city government that absorbed the county functions, not a county AHJ).
- **Four retained Beaches AHJs.** Jacksonville Beach, Atlantic Beach, Neptune Beach, and Baldwin voted in 1968 to retain their own municipal governments, so they operate as independent AHJs for building/electrical permits. They are **out of scope** for the `jacksonville-duval` manifest; a future manifest (or four separate manifests) can cover them via the `subjurisdiction` axis or as standalone manifests.
- **NOT in HVHZ.** HVHZ is statutorily limited to Miami-Dade, Broward, and Monroe counties (South Florida). Duval County is North Florida and outside HVHZ. The manifest does NOT default `hvhz_anchoring` ON; Layer-2 user override remains available per Sprint 2C H19 statewide FL-Product-Approval pattern for any mounted EVSE installer who wants to attach anchoring documentation.
- **Significant flood-zone exposure.** Jacksonville is coastal (Atlantic) + riverine (St. Johns River bisects the city) with extensive FEMA AE/VE/AH/AO mapping. Per Jacksonville Development Services floodplain regs, Elevation Certificates may be required prior to slab inspection AND at final inspection for construction in AO/AE/VE zones. The manifest defaults `flood_elevation_certificate` ON for commercial scope (mirroring Hillsborough H30); SFR/multi-family default off and user opts in via Layer-2 when the site falls in a SFHA.
- **JaxEPICS-only intake.** All permit submissions are electronic via `jaxepics.coj.net`. All documents must be PDF. The plan-review clock does not start until Zoning, Concurrency, and Development Services approve the plans for review and the plan-review fee is paid. (Source: BID Electronic Plan Submittal page + JaxEPICS landing.)
- **No published residential trade-permit-no-plan-review shortcut.** Unlike Hillsborough/Tampa (H31), Jacksonville BID does not document a "trade permit no plan review" lane that bypasses the full plan set for residential electrical. The published guidance describes a sub-permit model: licensed electricians pull electrical sub-permits associated with the homeowner's primary building permit; owner-builder is permitted only for 1–2 family owner-occupied dwellings. The Jacksonville manifest therefore rides the **full plan set for all building types** (no residential lane downgrade).
- **Sub-permit electrical model.** Per the Residential Permits page: "Licensed or registered contractors hired by the owner to provide electrical, plumbing and mechanical (heating and air conditioning) work, or other subcontracted work requiring a permit (roofing), must also obtain their own permits that are associated to the homeowner's building permit." Electrical sub-permit is the operative intake type for EVSE work.
- **NOC threshold:** $5,000 statewide per FS 713.13 (electrical). Mechanical work uses a separate $15,000 threshold (not relevant for pure-electrical EV scope). Recording is at the Duval County Clerk of Courts (501 W. Adams St.) or at BID (214 N. Hogan St.) prior to first inspection.
- **Multi-agency routing risk.** The Jaspector 2026 Jacksonville guide explicitly notes 3–6 week plan-review timelines "account for projects requiring agency coordination" with Historical Preservation, Downtown Investment Authority, or Health Department. Not typically triggered by EVSE installs unless the host structure is historic or downtown; manifest does not surface as a requirement.

## Currently enforced codes (verified verbatim 2026-05-16 from BID Codes page)

- **Building:** Florida Building Code 8th Edition (2023) — Building / Residential / Existing Buildings
- **Electrical:** NFPA 70 — 2020 National Electric Code
- **Mechanical:** Florida Building Code 8th Edition (2023) — Mechanical
- **Plumbing:** Florida Building Code 8th Edition (2023) — Plumbing
- **Fire:** 2023 Florida Fire Prevention Code 8th Edition (NFPA 1, 2021)
- **Energy / Gas / Accessibility:** Florida Building Code 8th Edition (2023)

NEC edition is uniform across SFR / multi-family / commercial — no Miami-Dade-style H34 fork.

## Line-by-line cross-walk (mirrors Pompano / Hillsborough matrix)

| Jacksonville/Duval intake line item | EV-fed-from-existing | EV-fed-from-new-service | Currently in packet | Manifest disposition |
|---|---|---|---|---|
| Electrical sub-permit application (JaxEPICS) | Required | Required | ❌ generator does not produce (filed in portal) | Requirement: `application` always |
| Notice of Commencement (FS 713.13 > $5k, recorded with Duval Clerk) | Required (non-SFR) | Required (non-SFR) | ✓ via `noc` artifact slot | Predicate: non-SFR default ON |
| Digitally signed and sealed plans by FL PE or RA | Conditional (lane-gated) | Conditional (lane-gated) | 🔴 no PE infrastructure yet | Requirement: lane-gated; detect pending Sprint 3 C5 |
| Site plan (location of EVSE + flood-zone callouts: FEMA panel, BFE, finished floor) | Required | Required | ✓ via `site_plan` artifact slot | Requirement: always; locator → first `C-` sheet |
| One-line / riser diagram | Required | Required | ✓ riserDiagram section | Requirement: always |
| Panel / switchboard schedule | Required | Required | ✓ panelSchedules section | Requirement: always |
| Load calculations (NEC 220) | Required | Required | ✓ loadCalculation section | Requirement: always |
| Voltage drop considerations | Required | Required | ✓ voltageDrop section | Requirement: always |
| Available fault current (NEC 110.9/110.10) | n/a (existing service) | Required | ✓ availableFaultCurrent section | Requirement: scope=new-service |
| Service equipment grounding detail (NEC Art. 250) | n/a | Required | ✓ grounding section | Requirement: scope=new-service |
| NEC 220.87 existing-service spare-capacity narrative | Required | n/a | ✓ nec22087Narrative section | Requirement: scope=existing-service |
| Equipment schedule (EVSE, disconnects, OCPDs, conductors) | Required | Required | ✓ equipmentSchedule section | Requirement: always |
| EVSE manufacturer cut sheets (UL-2202 / UL-2594) | Required | Required | ✓ via `cut_sheet` artifact slot | Requirement: always |
| Firestop assembly schedule for rated penetrations | Conditional (commercial) | Conditional (commercial) | ✓ via `fire_stopping` artifact slot | Requirement: buildingType=commercial |
| Design Flood Elevation reference (FBC, FEMA SFHA) | Conditional (SFHA) | Conditional (SFHA) | ❌ via `flood_elevation_certificate` artifact slot (commercial default ON) | Requirement: buildingType=commercial (manual-verification baseline) |
| Elevation Certificate prior to slab inspection (when in SFHA) | Conditional (SFHA) | Conditional (SFHA) | ✓ slot exists | Requirement: buildingType=commercial |
| Elevation Certificate at final inspection (when in SFHA) | Conditional (SFHA) | Conditional (SFHA) | ✓ slot exists | Requirement: buildingType=commercial |
| EVSE labeling (NEC 625.43, visible at disconnect) | Required | Required | ✓ evseLabeling section | Requirement: always |
| EVEMS operational narrative (NEC 625.42, when present) | Conditional (EVEMS scope) | Conditional (EVEMS scope) | ✓ evemsNarrative section | Requirement: always (section data-gated) |
| Per-sheet contractor signature (FL DBPR license #) | Required | Required | ✓ Sprint 2A C8 | Requirement: always |
| FBC / NEC / FFPC reference block on cover sheet | Required | Required | ✓ Sprint 2A C7 / H4 | Requirement: always |
| Cover sheet TOC | Best practice | Best practice | ✓ Sprint 2A H1 | (no separate requirement; envelope) |
| Electrical inspection: Rough-in (pre-cover) | Required | Required | n/a — process | Requirement: inspection always |
| Electrical inspection: Final | Required | Required | n/a — process | Requirement: inspection always |
| Fire inspection: Final | Conditional (non-SFR) | Conditional (non-SFR) | n/a — process | Requirement: inspection buildingType≠SFR |
| Knox-box / emergency shutoff | Out of scope (Fire Marshal discretionary) | Out of scope | n/a | Not in requirements (parallel to Hillsborough's unresolved H-finding) |
| Wind anchoring for outdoor pedestals (HVHZ-style) | n/a — Duval NOT in HVHZ | n/a — Duval NOT in HVHZ | – | Layer-2 user opt-in per H19 |
| HOA / condo approval letter | Not an AHJ-level requirement | Not an AHJ-level requirement | – | Not in requirements |
| Zoning Compliance Permit Application | Not separately filed (JaxEPICS routes zoning internally) | Same | – | Not in requirements (vs Pompano H21) |
| Fire Review Application (separate form) | Not separately filed (Fire Marshal review routes internally) | Same | – | Not in requirements (vs Pompano H22) |
| Private Provider documentation (FS 553.791 alt path) | Optional (commercial niche) | Optional (commercial niche) | ✓ via `private_provider_documentation` artifact slot | Requirement: off-by-default opt-in |
| JEA utility coordination (service disconnect/reconnect for panel upgrade) | Process (utility) | Process (utility) | – | Out of scope (utility-side concurrence) |

## Findings (potential new J-numbers)

**J1 — No dedicated EV-charging checklist PDF published.**
Jacksonville BID's "Checklists, Forms and Documents" page lists only two electrical-specific forms (Emergency Reconnect Letter, Electrical Temporary Service Letter), neither of which is an intake checklist. EV scope routes through the generic electrical sub-permit lane via JaxEPICS. Cross-validated via three industry sources (David Gray, Empire Electric, Bolt Electric — all describe the generic sub-permit lane as the operative intake for EV chargers in Duval). **Severity: LOW** for packet generation; the generic intake works as long as the contractor selects the right sub-permit type in JaxEPICS. **Action:** confirm in a 5–10 min call to BID (904-255-8500) that there is no internal EV-specific checklist circulated to staff that is not published online.

**J2 — Tree-canopy / historic-preservation routing risk for plan-review timelines.**
The Jacksonville Code of Ordinances has a tree-protection chapter and an active Historic Preservation Section under the Planning and Development Department. The Jaspector 2026 Jacksonville guide explicitly notes 3–6 week plan-review timelines "account for projects requiring agency coordination" with Historical Preservation, Downtown Investment Authority, or Health Department. Not typically triggered by EVSE installs, but worth a contractor-facing tooltip in Sprint 3 for downtown / historic-district projects. **Severity: LOW** for packet; **Medium** for contractor UX in downtown / historic districts.

**J3 — Sealed-plan threshold for residential.**
BID publishes "digitally signed and sealed plans" as a general requirement without an explicit sub-$X threshold for owner-builder. The manifest honors Sprint 2A H17 lane logic (PE seal gated by `lane === 'pe_required'`) and assumes contractor-exemption residential bypasses the seal — consistent with FL contractor exemption statute. **Severity: LOW** as long as the lane-screening logic upstream is sound. **Action:** direct BID confirmation deferred to Sprint 3 C5 alongside the PE-seal stamping flow.

**J4 — NOC threshold for electrical sub-permits.**
Jacksonville BID reuses the FS 713.13 statewide $5,000 NOC threshold for electrical; mechanical work uses a separate $15,000 threshold (not relevant for pure-electrical EV scope). The manifest models NOC the same way as Pompano/Hillsborough (required for non-SFR by defensible default; SFR users toggle on for sub-threshold residential). **Severity: LOW**; documented for completeness.

**J5 — Beaches AHJ routing risk (project addressed in Jax Beach / Atlantic Beach / Neptune Beach / Baldwin must NOT use this manifest).**
The four retained Beaches munis are independent AHJs. If a contractor selects "Jacksonville" but the project address falls within one of the four Beaches munis, the manifest will surface incorrect intake guidance. **Action:** Sprint 2C+ either (a) add four standalone manifests for the Beaches, or (b) wire address-based jurisdiction selection that flags Beaches addresses with a "this manifest does not apply — see [Beach] manifest" warning. **Severity: MEDIUM** UX risk for the SparkPlan Jacksonville pilot if a Beaches address slips through.

**J6 — Plan-review clock-start dependency.**
Per JaxEPICS guidance: the plan-review clock does not start until Zoning + Concurrency + Development Services approve the plans for review AND the plan-review fee is paid. This is process-only (not a packet-content finding) but worth a contractor-facing tooltip explaining the timeline expectation. **Severity: LOW** for packet; **Low-Medium** for contractor UX.

## Confidence level

**Medium-High.**
- **High** for the BID-published code editions (verbatim from `jacksonville.gov/.../codes`): NEC 2020, FBC 8th ed (2023), FFPC 8th ed (NFPA 1, 2021).
- **High** for the JaxEPICS-only intake workflow (verified directly via `jaxepics.coj.net` and the BID Electronic Plan Submittal page).
- **High** for the consolidated city-county structure + Beaches AHJ carve-out (Wikipedia + News4Jax 2025 UNF poll article + multiple cross-validating sources).
- **High** for the Duval flood-zone exposure (Jacksonville Development Services floodplain definitions page + SiteplanCreator + Apex Surveying cross-validation).
- **Medium-High** for the NOC $5,000 / $15,000 thresholds (BID Residential Permits page + statewide FS 713.13 statute + Notice of Commencement form PDF directly hosted by COJ).
- **Medium** for the absence of a published EV-specific intake checklist (J1) — cross-validated by three industry sources but not officially confirmed by BID.
- **Medium-Low** for the sealed-plan threshold (J3) — BID guidance is generic; reconciliation with H17 lane logic is defensible but un-confirmed.

## Follow-up sourcing (Sprint 2C+)

Three action items for a focused follow-up pass:

1. **BID phone call (~10 min):** confirm (a) there is no internal EV-specific intake checklist not published online (J1), and (b) the sub-permit lane is the operative intake for EVSE work regardless of building type (validates the no-residential-downgrade decision). Contact: 904-255-8500 option 4 or BIDDocuments@coj.net.
2. **Beaches AHJ scoping (J5):** stand up four standalone manifests for Jax Beach / Atlantic Beach / Neptune Beach / Baldwin, OR wire address-based jurisdiction resolution that flags Beaches addresses with a "this manifest does not apply" UX. Source per-Beach building-department checklists from their respective `.gov` sites.
3. **JEA utility-coordination tooltip:** Jacksonville Electric Authority (JEA) is the municipal utility for the consolidated jurisdiction. Panel upgrades for EV chargers require JEA coordination for service disconnect/reconnect. Not a packet-content finding, but worth a contractor-facing tooltip; cross-reference JEA's Electric Permit Status Request page (`jea.com/PermitStatusRequest`).
