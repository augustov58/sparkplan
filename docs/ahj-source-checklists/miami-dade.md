# Miami-Dade County — EV Charging Station Permit Checklist

**Sourced:** 2026-05-12
**Source URL(s):**
- Miami-Dade Electrical Permits landing: https://www.miamidade.gov/global/economy/building/permits/electrical.page
- **Commercial Electrical Plan Review Guidelines (PDF, authoritative)**: https://www.miamidade.gov/permits/library/guidelines/electrical-commercial.pdf — line-by-line code reference matrix; saved to `/tmp/md-elec-commercial.txt` during research.
- Miami-Dade Forms hub: https://www.miamidade.gov/global/economy/building/all-forms.page
- Miami-Dade Building Permit Application (yellow form): https://www.miamidade.gov/resources/economy/permits/documents/building-permit.pdf
- Miami-Dade Electrical Fee Sheet: https://www.miamidade.gov/resources/economy/building/documents/electrical-fee.pdf
- Miami-Dade Digital Signing & Sealing policy page: https://www.miamidade.gov/global/economy/permits/digital-signing-sealing.page
- E-permit portal: https://www.miamidade.gov/Apps/RER/EPSPortal
- Florida statewide context (HVHZ + 2023 FBC 8th ed): https://windload.solutions/miami-dade-hvhz-requirements
- Industry-sourced Miami EV cost guide (used for sanity-check, not primary): https://permitmint.com/permits/florida/miami/ev_charger/

**Official EV-specific checklist available:** No, *not as a single dedicated EV PDF*. Miami-Dade's "Guide for Electric Vehicle (EV) Charging Stations" at `miamidade.gov/internalservices/library/charging-electric-vehicles-guide.pdf` returns **HTTP 404** as of 2026-05-12 — the link is referenced in search results and a 2022 Legistar matter (`Matters/Y2022/221292.pdf`) but the PDF is not currently served.

**Official electrical plan-review checklist available:** **Yes** — the "Commercial Plan Review Guidelines (Electrical Review)" PDF is the authoritative line-by-line code-reference matrix used by the Building Official before permit issuance. This is the document EV permits flow through when the EV scope hits commercial / multi-family thresholds, plus a residential variant referenced on the electrical permits page ("Residential Electrical Plan Review Guidelines").

**Notes / gaps:**
- Miami-Dade does **not publish a dedicated EV-only submittal PDF** comparable to Orlando's "EV Charging Station Permit Checklist". The EV scope is folded into the general Commercial / Residential Electrical Plan Review Guidelines.
- All of Miami-Dade County sits inside the **HVHZ** (High-Velocity Hurricane Zone) per FBC 8th ed; design wind speed 175 mph (3-sec gust) Risk Cat II. Mounted EVSE pedestals/bollards therefore need wind-anchoring documentation — this is *enforced via the structural review*, not the electrical review.
- Code basis: **FBC 8th ed (2023)** + **NFPA-70/NEC 2020**. Plan-set sheet ID convention is explicit and is one of the strongest H-finding triggers for SparkPlan.
- Multi-family condo/HOA approval is **not in the electrical guidelines** at the County level — it's enforced at the building/HOA level under FL 718.113(8). Miami-Dade has no HOA-letter line-item analogous to Pompano's.

## Source artifacts (verbatim quotes from `electrical-commercial.pdf`)

**Header / scope:**
> "Commercial Plan Review Guidelines (Electrical Review)"
> "This form provides a list of code requirements that must be verified by the Building Official before the issuance of a building permit."
> "Code references are to the 2023 8TH Edition of Florida Building Code (unless otherwise noted). Suffixes identify the code volume as follows: Accessibility (Ac) - Building (Bl) – Energy Conservation (En) Existing (Ex) – Fuel/Gas (Gs) Mechanical (Me) – NFPA-70 (2020)/National Electric Code (NEC) - Plumbing (Pl) - Residential (Re)"

**Sheet ID convention (critical for SparkPlan):**
> "Identify electrical plans with the letter "E" & Drawing number."
> "When submitting compliance documents for reference codes sections it shall be stated on plan sheet to be verified or select the N.A. box whenever the code provision is not applicable."

**Service / fault-current items (extracted from form columns; FBC + NEC 2020 cites):**
- "Construction documents submitted" — FBC 107 (Bl)
- "Equipment approval, listing and installation instructions" — NEC 110.2-3
- "Number of services" — NEC 230.2
- "Conductor size/rating" (overhead / underground) — NEC 230.23, 230.31
- "Insulation of service conductors" — NEC 230.22, 230.30, 230.41
- **"Available fault current"** — NEC 110.9, 110.10
- "Working space" — NEC 110.26, 110.32, 110.34
- "Over current protection" / "Grounding" — NEC 230.70(A)(B)(C), 110.22, 230.71-95
- "Grounded conductor to service equipment / Electrode system / Conductors / Grounding" — NEC 250.24(B), 250 III, 250.66, 250.20(D), 250.30, 450.5
- "Transformer overcurrent protection 600-volt nominal or less / Primary/secondary / Ventilation / Accessibility" — NEC 450.3, 450.9, 450.45, 450.13
- "Emergency systems / Standby Systems" — FBC 2702 (Bl), NEC 700/701
- "Wet Locations" — NEC 210.63, 210.8
- "Fixture supports / Identification / Conduit seals / Penetrations" — NEC 410 IV, 110.22, 300.7, 300.21
- "Smoke alarms / Fire alarm and detection system" — FBC 907, NEC 760

(Full matrix has ~4 pages of categories; the above are the items most relevant to EV / multi-family electrical scope.)

## Line-by-line cross-walk (mirrors Orlando matrix)

| Miami-Dade line item | EV-fed-from-existing | EV-fed-from-new-service | Currently in SparkPlan packet | Sprint where addressed |
|---|---|---|---|---|
| Building Permit Application (yellow form) — electrical category | Required | Required | ❌ generator does not produce the yellow form | Sprint 2B (H5 — application as separate upload) |
| Electrical Fee Sheet | Required | Required | ❌ | Sprint 2B (upload) |
| **Plan sheet ID convention — letter "E" + drawing number** | Required (≥ commercial / multi-family) | Required | ✓ `E-###` sheet IDs (H3) — verify "E" prefix specifically | Sprint 2A H3 (✓ done) — *cross-check that prefix is literally `E` not `ES`/`EL`* |
| Cover sheet / TOC referencing every "E-x" sheet | Required (≥ commercial) | Required | ✓ | Sprint 2A H1 (✓ done) |
| Plans digitally signed and sealed (PE) when scope triggers it | Conditional (PE-required at ≥277/480V or commercial threshold) | Conditional | 🔴 no PE infrastructure | Sprint 3 (C5) |
| Construction documents submitted (FBC 107 Bl) — narrative of scope | Required | Required | ✓ general notes page covers this | Sprint 2A H12 (✓ done) |
| Equipment approval, listing & installation instructions (NEC 110.2-3) — UL listings for EVSE | Required | Required | ✓ specs page; manufacturer cut sheet pending upload | done H15; H8 cut-sheet upload Sprint 2B |
| Number of services / Conductor size & rating (NEC 230.2, 230.23/31) | Required | Required | ✓ one-line + load calc cover this | done (C2, M6, H9) |
| Insulation of service conductors (NEC 230.22/30/41) | Required when service is touched | Required | ✓ implied in one-line; not called out | done (M6) |
| **Available fault current** (NEC 110.9/10) — calc at service main | Required for new-service path; conditional (where SCS upstream changes) for existing | Required | ✓ H9 fault-current page + AIC overlay per node | done (PR #31, PR #40) |
| Working space, OCPD, grounding (NEC 110.26, 230, 250) | Required | Required | ✓ grounding detail; working clearance is on installer | done (M3) |
| Grounding electrode system + GEC size per NEC 250.66 | Conditional (when service changes) | Required | ✓ project-specific GEC | done (M3) |
| Transformer overcurrent (NEC 450.3) | Conditional (only if EV behind step-down xfmr) | Conditional | ✓ when transformer in scope | done |
| Emergency systems (FBC 2702, NEC 700/701) | n/a for EV | n/a for typical EV | – | – |
| Wet location compliance (NEC 210.8, 210.63) — outdoor EVSE | Required (outdoor) | Required (outdoor) | ✓ implied in specs | partial — add explicit wet-location call-out per AHJ (H18 candidate) |
| Notice of Commencement (>$5k) | Required statewide (FS 713.13) | Required | ❌ | Sprint 2B (H5) |
| **HVHZ wind-anchoring documentation for pedestal/bollard EVSE** (FBC 2023 8th ed HVHZ provisions) | Conditional (outdoor pedestal) | Conditional | ❌ — not addressed by packet | **H19 candidate — see Findings** |
| Site plan / survey showing EV charger + panel locations | Required (commercial / multi-family) | Required | ❌ | Sprint 2B (H7) |
| Per-sheet contractor signature with name + license | Required | Required | ✓ | Sprint 2A C8 (✓ done) |
| FBC 8th ed (2023) + NEC 2020 reference block on plans | Required | Required | ✓ | Sprint 2A C7 / H4 (✓ done) |
| Voltage-drop note (≤3% / 5% combined) | Best practice (not explicit MD line) | Best practice | ✓ | Sprint 2A H13 (✓ done) |
| EVEMS narrative (NEC 625.42) when service capacity managed | Required (when EVEMS used to avoid service upgrade) | Conditional | ✓ | Sprint 2A H10 (✓ done) |
| EVSE labeling per NEC 625.43 | Required | Required | ✓ | done (H11) |
| Knox-box / emergency shutoff | Not in MD electrical guidelines — local fire AHJ may add | Same | n/a (Davie commercial-only) | – |
| Selective Coordination form (for elevators / fire pumps / emergency systems) | n/a unless EV near these | n/a | – | – |

## Findings (potential new H-numbers)

**H18 — Wet location / outdoor EVSE compliance call-out (NEC 210.8 + 210.63 + 625.50).**
Miami-Dade's commercial guideline checks "wet locations" explicitly. SparkPlan currently lists UL-2202/2594 EVSE listing on the specs page but does not surface an explicit "wet-location compliant / rated for outdoor use" callout when the EVSE is mounted outdoors. Low effort: add a conditional callout to H15 specs page if `installation_location = 'outdoor'`. **Severity: Low/Medium.** Most coastal AHJs (Miami-Dade, Pompano, Davie, Tampa) will catch this on review but flag it; adding it preempts a comment.

**H19 — HVHZ wind-anchoring documentation for outdoor EVSE pedestal / bollard.**
All of Miami-Dade sits inside the HVHZ. Pedestal-mounted EVSE and bollards require Florida Product Approval, Miami-Dade NOA tie-down detail, *or* signed-and-sealed structural plans for anchorage (175 mph 3-sec gust, Risk Cat II). Notably, **Pompano Beach's checklist also references this exact mechanism** ("Florida Product Approval, Miami Dade Notice of Acceptance tie down detail, or original signed & sealed plans") — so HVHZ-style anchoring documentation is a *statewide* multi-AHJ requirement for outdoor pedestal EVSE, not Miami-Dade-only. **Severity: High** for multi-family/commercial outdoor installs; **N/A** for indoor wall-mount residential.
- Implementation: add to Sprint 2B uploads (H7/H8 family) — a new attachment slot `anchoring_documentation` that accepts NOA, FL Product Approval, or signed/sealed structural detail. Conditionally required when `mounting_type ∈ { 'pedestal', 'bollard', 'outdoor' }`.

**H20 — "E" sheet ID prefix specifically (not `EL`, `ES`, `E-`).**
Miami-Dade is explicit: "Identify electrical plans with the letter **E** & Drawing number." H3 (Sprint 2A) implemented `E-###` sheet IDs but the audit should confirm Miami-Dade accepts the hyphenated form vs requires bare `E1`/`E2`. **Severity: Low** (cosmetic), but cheap to verify with a Miami-Dade plans examiner. Not blocking.

## Confidence level

**Medium-High.**
- *High* for the line-by-line code references (the Commercial Plan Review Guidelines PDF is verbatim from the Building Official's own checklist).
- *Medium* for EV-specific items because Miami-Dade does not publish a dedicated EV PDF — we are inferring EV scope from the general electrical guideline + cross-validation against Orlando's EV-specific items + the Pompano EV checklist's HVHZ anchoring reference.
- *Lower* on the residential side: Miami-Dade has a "Residential Electrical Plan Review Guidelines" PDF that we could not extract during this research pass (link present on the Electrical Permits page but not pulled). Recommend re-sourcing that PDF before M1 manifest implementation for the residential-EV lane.
