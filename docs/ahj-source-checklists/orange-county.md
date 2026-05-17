# Orange County (Unincorporated) — Electrical / EV Permit Submittal Cross-walk

**Sourced:** 2026-05-16
**Manifest:** `data/ahj/orange-county.ts` → `id: 'orange-county'`, `subjurisdiction: 'unincorporated'`
**Population served:** ~330k (unincorporated portion of Orange County's 1.5M total — Pine Hills, Doctor Phillips, Orlovista, Winter Garden suburbs, and other unincorporated areas)

**Closes the obvious Orlando-metro gap:** SparkPlan already covers City of Orlando (`data/ahj/orlando.ts`). Orange County itself maintains a separate AHJ for the *unincorporated* portion of the county. City of Orlando, Winter Park, Apopka, Maitland, Ocoee, Winter Garden, and other municipalities run independent AHJs (not modelled yet).

## Source URLs

- **Orange County Division of Building Safety landing:** http://ocfl.net/building
- **Electrical Permit page (primary intake summary):** https://www.orangecountyfl.net/PermitsLicenses/Permits/ElectricalPermit.aspx
- **Electrical Permit Application form (PDF, form 23-30 rev. 11/07; extracted via `pdftotext`):** http://apps.ocfl.net/reference/forms-files/faxPDFs/103_Electrical_Permit_Application_23-30_1107.pdf
- **Interactive Electrical Permit Application (PDF — `pdftotext` failed on this variant; treated as opaque):** https://www.orangecountyfl.net/portals/0/resource%20library/permits%20-%20licenses/Electrical%20Permit%20Application%20Interactive-CERT.pdf
- **Permitting & Construction Forms hub:** https://www.orangecountyfl.net/permitslicenses/permittingandconstructionforms.aspx
- **OC FastTrack online submittal portal:** https://fasttrack.ocfl.net/
- **Code of Ordinances, Chapter 9 (Building & Construction Regulations) via Municode:** https://library.municode.com/fl/orange_county/codes/code_of_ordinances?nodeId=PTIIORCOCO_CH9BUCORE
- **Code of Ordinances, Chapter 9 Article III (Electrical Code) via Municode:** https://library.municode.com/fl/orange_county/codes/code_of_ordinances?nodeId=PTIIORCOCO_CH9BUCORE_ARTIIIELCO_DIV1GE
- **Statewide context — FBC 8th edition (2023) effective dates:** https://www.floridabuilding.org/fbc/Publications/2023_Effective_Dates.pdf
- **Statewide context — Central FL wind speed (non-HVHZ, 130–140 mph 3-sec gust Risk Cat II):** https://windload.solutions/cities/orlando-wind-load-requirements

## Official EV-specific checklist available?

**No.** Orange County does NOT publish a dedicated EV charging station permit checklist PDF (unlike Orlando, Pompano, Davie which all publish purpose-built EV PDFs). EV installations are handled as standard electrical permits via the OC FastTrack portal. Requirements below cross-walk from the general Electrical Permit Application + Chapter 9 Article III (Electrical Code) + statewide FBC/NEC baseline + Central FL conventions inherited from Orlando.

## Notes / gaps

- **NOC threshold = $2,500 (LOWER than the $5,000 statewide FL Statute 713.13 default).** The OC Electrical Permit page is explicit: *"If value of work exceeds $2,500, a Notice of Commencement is required."* This is the single most important divergence from neighbouring AHJs and the reason the manifest's `noc` predicate returns `true` for ALL building types (not just non-SFR).
- **NOT in HVHZ.** Orange County sits in Central Florida, well outside the High-Velocity Hurricane Zone (which is Miami-Dade + Broward coastal). Design wind speed is 130–140 mph (3-sec gust, Risk Cat II) per ASCE 7-22 / FBC 8th ed (2023). FL Product Approval still applies statewide for mounted equipment, but the H19 cross-validated "HVHZ-style anchoring documentation" default is dialled back here — `hvhz_anchoring` is surfaced as an *available* upload slot but the predicate gates to commercial / multi-family outdoor installs only (SFR EV installs are overwhelmingly indoor wall-mount in attached garages).
- **OC uses the FastTrack online portal.** Per the Electrical Permit page: *"You are only required to submit one set of electronically signed and sealed construction documents for review when submitting projects through the Orange County FastTrack system."* This is the operative submittal mechanism — there is no paper-based intake.
- **Qualifying Business (QB) license + Master Electrician active certificate-holder name** are explicit fields on the OC Electrical Permit application (form 23-30). This is slightly more than the statewide DBPR-only baseline; the manifest captures it in the `orange-county-contractor-license-block` requirement.
- **Sheet-ID prefix not prescribed.** OC's Electrical Permit application does not specify a discipline-letter convention. Default to `E-` matching Orlando and Central FL industry convention; no `EL-`-style mandate from OC (contrast Miami-Dade which mandates `EL-`).
- **Permit trigger** per Orange County Code of Ordinances Section 9-86(a): *"An electrical permit is required to perform any electrical construction, to install any electrical wiring, apparatus, or equipment, or to make any extensions or changes to existing systems of wiring for light, heat, or power."* Cited verbatim on the Electrical Permit landing page.

## Source artifacts (verbatim quotes)

### From the OC Electrical Permit page (https://www.orangecountyfl.net/PermitsLicenses/Permits/ElectricalPermit.aspx)

> "An electrical permit is required to perform any electrical construction, to install any electrical wiring, apparatus, or equipment, or to make any extensions or changes to existing systems of wiring for light, heat, or power per Orange County Code of Ordinances Section 9-86 (a)."

> "If value of work exceeds $2,500, a Notice of Commencement is required."

> "You are only required to submit one set of electronically signed and sealed construction documents for review when submitting projects through the Orange County FastTrack system."

> "The Building Permit Number is required if the Electrical Installation is associated with any construction or alteration."

### From the OC Electrical Permit Application form 23-30 (rev. 11/07; pdftotext extract)

Header / scope:
> "Orange County Division of Building Safety
> 201 South Rosalind Avenue
> Reply To: Post Office Box 2687 • Orlando, Florida 32802-2687
> Phone 407-836-5550 • Fax 407-836-2852 • Inspections ONLY: 407-836-2825"

NOC warning:
> "WARNING TO OWNER: 'YOUR FAILURE TO RECORD A NOTICE OF COMMENCEMENT MAY RESULT IN YOUR PAYING TWICE FOR IMPROVEMENTS TO YOUR PROPERTY. A NOTICE OF COMMENCEMENT MUST BE RECORDED AND POSTED ON THE JOB SITE BEFORE THE FIRST INSPECTION.'"

Building / scope classification:
> "Class of Building: Old / New     Type of Building: Residential (028) / Commercial (029) / Mobile Home (006)"
> "Type of Work: New (001) / Alteration (003) / Addition (004) / Repair (002) / Low Voltage (017-New) / (018-Existing)"

Equipment quantities the form enumerates:
> Dishwasher / Hood Fan / Fixtures / Electric Signs / A/C (tons) / Stoves / Exhaust Fan / Dryer / Spa / Neon Tubing / Furnace (KW) / Temporary Construction Pole / Disposal / Paddle Fan / Pool / Meter Reset / Pumps / Water Heater / Outlets / Switches / Low Voltage / Motors

Meter service block:
> "One (1) New Meter Service / (Four (4) or More) New Meter Services Same Size / Meter Service Upgrade from ___ to ___ = Difference in Size / Relocate Existing Meter Service (No Service Size Change)"

Contractor block (verbatim fields):
> "Name of Business Organization / QB License Number / Name of Active Certificate Holder (Master Electrician) / State Registration or Certificate Number"

Permit-issuance disclaimer:
> "The issuance of this permit does not grant permission to violate any applicable Orange County and/or State of Florida codes and/or ordinances."

### From the OC Division of Building Safety landing page (http://ocfl.net/building)

> "[The Division enforces] the Florida Building Code, the National Electrical Code and Orange County's Construction Regulations."

> "Orange County abides by the current version of the Florida Building Code which includes these volumes: Building, Residential, Mechanical, Plumbing, Fuel Gas, Energy Conservation, Existing and Accessibility."

(No specific edition number cited on the landing page — confirmed via statewide FBC adoption schedule: FBC 8th edition (2023) effective 2023-12-31, with NEC 2020 incorporated by reference.)

## Line-by-line cross-walk

| OC line item / source | EV-fed-from-existing | EV-fed-from-new-service | In SparkPlan packet | Manifest requirement ID |
|---|---|---|---|---|
| Electrical Permit Application (form 23-30) via FastTrack | Required | Required | ❌ generator does not produce the application form (Sprint 2B H5 — upload slot) | `orange-county-electrical-permit-application` |
| Notice of Commencement (>$2,500 per OC — LOWER than $5k default) | Required (virtually always — EVSE jobs exceed $2,500) | Required | ❌ user-uploaded | `orange-county-noc` |
| Sheet-ID prefix `E-` + drawing number | Required (Central FL convention) | Required | ✓ | `orange-county-sheet-id-prefix` |
| Cover sheet + Table of Contents | Required | Required | ✓ Sprint 2A H1 | `orange-county-cover-toc` |
| Riser diagram (one-line) with AIC labels | Required | Required | ✓ Sprint 2A H9 / M6 | `orange-county-riser-diagram` |
| Load calculations (NEC 220 + 625) | Required | Required | ✓ Sprint 1 (C1, C2) | `orange-county-load-calculation` |
| Electrical plan (panel schedules + equipment schedule) | Required | Required | ✓ Sprint 1 + 2A | `orange-county-electrical-plan` |
| Grounding electrode system + GEC sizing (NEC 250) | Conditional (existing service grounding already in place) | Required | ✓ M3 | `orange-county-grounding` (new-service path only) |
| Available fault current calc at service main (NEC 110.9, 110.10) | Conditional (rare — only when SCS upstream changes) | Required | ✓ H9 + AIC overlay | `orange-county-available-fault-current` (new-service path only) |
| Site plan showing EV charger + panel locations | Required (when associated with construction/alteration) | Required | ❌ Sprint 2B H7 | `orange-county-site-plan` |
| Plans digitally signed-and-sealed by FL-licensed PE | Conditional (lane-gated per Sprint 2A H17) | Conditional | 🔴 no PE infrastructure | `orange-county-pe-seal` (`lane === 'pe_required'`) |
| FBC 8th ed (2023) + NEC 2020 + OC Chapter 9 code-basis block | Required | Required | ✓ Sprint 2A C7 / H4 | `orange-county-code-basis-block` |
| Per-sheet contractor block: name + DBPR license + QB license + Master Electrician | Required (OC form 23-30 explicit fields) | Required | ✓ Sprint 2A C8 (partial — DBPR only; QB + Master Electrician fields not yet stamped) | `orange-county-contractor-license-block` |
| Equipment approval, listing & installation instructions (NEC 110.2-3) — EVSE UL-2202 / UL-2594 | Required | Required | ✓ H15 specs page | `orange-county-equipment-listing` |
| Anchoring detail (FL Product Approval) — outdoor pedestal / bollard only | Conditional (non-SFR outdoor; OC NOT in HVHZ) | Conditional (non-SFR outdoor) | ❌ — uses the shared `hvhz_anchoring` artifact slot | `orange-county-anchoring-detail` (non-SFR only) |
| Voltage drop note (≤3% / 5%) — best practice | Not OC line item, statewide convention | Same | ✓ H13 | (general note, not requirement) |
| EVEMS narrative (NEC 625.42) | Conditional | Conditional | ✓ H10 | (covered by section visibility) |
| EVSE labeling (NEC 625.43) | Required | Required | ✓ H11 | (covered by section visibility) |
| Fire-stopping schedule | Not OC line item (Orlando + MD list it; OC does not surface separately) | Not OC line item | — | not surfaced; NEC 300.21 still applies on plans |
| Knox-box / emergency shutoff | Not in OC checklist | Not in OC checklist | n/a (Davie-specific commercial) | – |
| Zoning Compliance / Fire Review Application | Not OC line item (Pompano-specific H21/H22) | Not OC line item | – | – |
| HOA / condo letter | Not OC line item (Pompano H6) | Not OC line item | – | – |

## Findings — divergences from neighbouring AHJs

These are NOT new H-numbers (the H1–H37 series came out of the original Sprint 2C audit); they're documented here so a future M2 reviewer understands why this manifest's predicates diverge from Pompano / Miami-Dade / Orlando defaults.

### F1 — NOC threshold $2,500 (LOWER than statewide $5,000 default)

The OC Electrical Permit page explicitly states the NOC trigger at $2,500. FL Statute 713.13 default is $5,000 (cited by every other manifest). The manifest encodes this by having the `noc` artifact-type predicate AND the `orange-county-noc` requirement BOTH return `true` for ALL building types — unlike Orlando / Miami-Dade where the predicate gates on `buildingType !== 'single_family_residential'` (defensible default for projects that virtually always exceed $5k). For OC the threshold is low enough that even small SFR EV installs cross it.

**Severity:** Medium — wrong default surfaces "NOC not required" warning for SFR users when in fact it almost always is.

### F2 — NOT in HVHZ; anchoring documentation gated to non-SFR outdoor installs

Pompano and Miami-Dade manifests default `hvhz_anchoring` ON for all building types (Pompano because its checklist explicitly mandates the FL Product Approval / NOA path; MD because it sits inside the HVHZ). Orange County is in Central FL, OUTSIDE the HVHZ — design wind speed 130–140 mph (3-sec gust, Risk Cat II) per ASCE 7-22, vs the HVHZ's 175 mph. FL Product Approval still applies statewide for mounted equipment, but the documentation burden is realistic to gate on commercial / multi-family outdoor pedestal installs only. SFR EV installs are overwhelmingly indoor wall-mount in attached garages.

**Severity:** Low UX — wrong default would force every SFR user to upload an anchoring detail they don't actually need.

### F3 — QB license + Master Electrician name explicitly required on form 23-30

OC's electrical permit application enumerates these as separate fields ("QB License Number" + "Name of Active Certificate Holder (Master Electrician)"). The manifest's `orange-county-contractor-license-block` requirement captures this, but Sprint 2A C8 currently only stamps the DBPR license — the QB + Master Electrician fields are a future enhancement.

**Severity:** Low — application is user-filled outside the packet; the requirement surfaces it for awareness, not enforcement.

### F4 — No dedicated EV checklist PDF

Unlike Orlando, Pompano, and Davie (all of which publish purpose-built EV PDFs), OC handles EV installs as standard electrical permits. Requirements list is therefore shorter (15 entries vs 22 for Pompano / MD) and inherits more from statewide FBC/NEC baseline.

**Severity:** Low — manifest is correctly conservative.

## Confidence level

**MEDIUM** (with HIGH confidence on the structural items: code basis, NOC threshold, FastTrack submittal, Section 9-86 permit trigger; MEDIUM on EV-specific items inferred from statewide baseline + Orlando-neighbour shape).

- **HIGH** for: FBC 8th ed (2023) + NEC 2020 adoption (cited via Division of Building Safety landing + statewide effective-date schedule); Section 9-86(a) permit trigger (verbatim quote); NOC threshold $2,500 (verbatim quote from Electrical Permit page); FastTrack submittal mechanism (verbatim quote); form 23-30 fields (extracted directly via `pdftotext`); QB + Master Electrician contractor-block fields.
- **HIGH** for: Non-HVHZ status (statewide ASCE 7-22 wind speed mapping — Central FL clearly outside the HVHZ).
- **MEDIUM** for: EV-specific requirements (no dedicated OC EV checklist published — cross-walk from Electrical Permit Application + Orlando-neighbour shape + statewide NEC baseline).
- **MEDIUM** for: Sheet-ID prefix default `E-` (not prescribed by OC; safe default matching Orlando + Central FL convention).

## Research gaps (non-blocking)

1. **EV-specific plan-review treatment** — does OC plan review treat EV installs as standard branch-circuit additions or as a separate category? ~10 min phone call to (407) 836-5550 (Permitting Services) would confirm. Non-blocking — current manifest is conservative and includes the full Sprint 2A engineering stack.
2. **Section 9-86 sub-sections** — Municode page was inaccessible via WebFetch; the verbatim quote of 9-86(a) comes via the Electrical Permit page citing it. Direct read of full Article III (Electrical Code) would confirm there are no additional submittal-related sub-sections beyond what the application form captures.
3. **Sheet-ID prefix mandate** — confirm OC accepts the hyphenated `E-###` form vs requiring bare `E1`/`E2`. Cosmetic only; not blocking.
4. **Interactive Electrical Permit Application PDF** — `pdftotext` failed on the `Electrical Permit Application Interactive-CERT.pdf` variant (likely AcroForm-only content, no extractable text layer). The older form 23-30 was used for verbatim extraction; the interactive variant may carry additional fields or instructions. Non-blocking — older form is canonical and the page references it as the active form.
5. **QB / Master Electrician stamping in title-block** — Sprint 2A C8 currently stamps only the DBPR license; the OC form expects the QB license + Master Electrician name as well. Future enhancement to the title-block renderer; manifest already captures the requirement.

## How to extend

When adding additional Orlando-metro municipalities (Winter Park, Apopka, Maitland, Ocoee, Winter Garden, etc.):

1. Drop in `data/ahj/{cityname}.ts` matching the manifest shape.
2. Register in `data/ahj/registry.ts` under key `'{cityname}'`.
3. Add `tests/{cityName}Manifest.test.ts` mirroring the orange-county / orlando structure.
4. Add this research doc at `docs/ahj-source-checklists/{cityname}.md`.
5. **Key axes to check per-AHJ:** NOC threshold (some Orlando munis follow OC's $2,500; most follow the $5k default); HVHZ status (all Central FL munis are non-HVHZ); sheet-ID prefix convention; sub-jurisdiction handling (most Orlando munis are city-level AHJs covering their incorporated areas only).
