# Pompano Beach (Broward County) — EV Charging Station Permit Checklist

**Sourced:** 2026-05-12
**Source URL(s):**
- **Pompano Beach "Vehicle Charging Station Checklist" (official, PDF)**: https://cdn.pompanobeachfl.gov/city/pages/building_inspections/submittal_checklists/Vehicle-Charging-Station.pdf — updated 01/29/2024. Saved to `/tmp/pompano-ev.txt` during research.
- Broward County Uniform Permit Application context (referenced by Pompano): https://www.broward.org/RecordsTaxesTreasury/Records/Pages/NoticeofCommencement.aspx
- Pompano Beach Building Inspections Division landing (department of record): cited on the checklist itself.

**Official EV-specific checklist available:** **Yes** — Pompano publishes a 1-page "Vehicle Charging Station Checklist" PDF that lists every line item. This is the strongest official source of the four non-Orlando AHJs.

**Notes:**
- Pompano is unusual: it requires **TWO separate Broward Uniform Permit Applications** (Building-Checked + Electric-Checked), plus a Zoning Compliance Permit, plus a Fire Review (multi-family / commercial only). This is a 3-permit-form intake, not 1.
- HOA / condo approval letter is **explicitly required** — confirms strategic-bullet matrix's `H6`.
- Anchoring is via **Florida Product Approval, Miami-Dade NOA tie-down, or signed-and-sealed plans** — same HVHZ-style anchoring documentation Miami-Dade triggers. Pompano enforces this even though it is outside the HVHZ proper (Pompano is in Broward County, not Dade).
- Inspections are split across 4 trades: Building (footings/tie-downs/final structural), Zoning, Electrical (rough + final), and Fire (final if applicable).

## Source artifacts (verbatim from `Vehicle-Charging-Station.pdf`, dated 01/29/2024)

**Header:**
> "City of Pompano Beach
> Department of Development Services
> Building Inspections Division
> 100 W. Atlantic Blvd, Pompano Beach, FL 33060
> Phone: 954.786.4669
> Vehicle Charging Station Checklist"

**Permit trigger:**
> "WHEN DO I NEED A PERMIT?
> The installation or replacement of a vehicle charging station requires a Building Permit to be issued."

**Required permit applications & documents (verbatim):**
> 1. "Submit a completed Broward County Uniform Permit Application (Building Checked) from a licensed General contractor."
> 2. "Submit a completed Broward County Uniform Permit Application (Electric Checked) from a licensed Electrical contractor."
> 3. "Submit a completed Zoning Compliance Permit Application from a licensed contractor."
> 4. "Submit a completed Fire Review Application from a licensed contractor. (Excludes Single Family Residences)"
> 5. "If the device will be installed at a condominium, or within a homeowner's association (HOA), submit the approval letter from the condominium association or HOA."
> 6. "Submit anchoring details in the form of a Florida Product Approval, Miami Dade Notice of Acceptance tie down detail, or original signed & sealed plans developed by an Architect or Engineer."
> 7. "Provide a riser diagram, electrical plan and load calculations for the vehicle charging station(s)."
> 8. "Provide the installation manual and manufacturer specifications."
> 9. "Submit a survey or site plan showing the location of the charging station."

**Inspections (verbatim):**
> "Miscellaneous Permit Inspections: 1. BLDG FOOTINGS, 2. BLDG TIE DOWNS, 3. BLDG FINAL STRUCTURAL
> Zoning Permit Inspections: 1. Z ZONING FINAL
> Electrical Permit Inspections: 1. EL ROUGH, 2. EL FINAL-ELECTRIC
> Fire Permit Inspections (If applicable): 1. FIRE DEPARTMENT FINAL"

**NOC:**
> "A Notice of Commencement is required to be submitted when the contract price is greater than $5,000.00."

## Line-by-line cross-walk (mirrors Orlando matrix)

| Pompano line item | EV-fed-from-existing | EV-fed-from-new-service | Currently in SparkPlan packet | Sprint where addressed |
|---|---|---|---|---|
| Broward Uniform Permit Application — Building-Checked (General contractor) | Required | Required | ❌ generator does not produce | Sprint 2B (H5 — bundle with existing application doc, but **two-form intake** is Pompano-specific) |
| Broward Uniform Permit Application — Electric-Checked (Electrical contractor) | Required | Required | ❌ | Sprint 2B (H5) — same form, "Electric Checked" box |
| Zoning Compliance Permit Application | Required | Required | ❌ | **New finding — see H21** |
| Fire Review Application *(excludes Single Family Residences)* | Required (multi-family / commercial) | Required (multi-family / commercial) | ❌ | **New finding — see H22** |
| **HOA / condo approval letter** (condo or HOA installs) | Conditional | Conditional | ❌ | Sprint 2B (H6) |
| **Anchoring detail** — FL Product Approval / Miami-Dade NOA tie-down / signed-and-sealed plans | Required for any mounted EVSE | Required | ❌ | Sprint 2B / **H19 from Miami-Dade doc** — same finding |
| **Riser diagram** | Required | Required | ✓ | Sprint 1+2A (M6 paginated, H9 AIC overlay) |
| **Electrical plan** | Required | Required | ✓ | Sprint 1+2A (one-line, panel schedules) |
| **Load calculations** | Required | Required | ✓ | Sprint 1 (C1, C2) |
| Installation manual & manufacturer specifications | Required | Required | ✓ specs page; manufacturer cut sheet pending upload (H8) | done specs (H15); Sprint 2B H8 |
| **Survey or site plan showing EV charger location** | Required | Required | ❌ | Sprint 2B (H7) |
| Notice of Commencement (>$5,000) | Required | Required | ❌ | Sprint 2B (H5 — bundled NOC) |
| Per-sheet contractor signature with license | Required (Broward General + Electrical) | Required | ✓ | Sprint 2A C8 (✓ done) |
| FBC / NEC code reference block | Required (statewide) | Required | ✓ | Sprint 2A C7 / H4 (✓ done) |
| Voltage drop notes | Best practice (not Pompano line) | Best practice | ✓ | Sprint 2A H13 (✓ done) |
| EVEMS narrative (NEC 625.42) | Conditional | Conditional | ✓ | Sprint 2A H10 (✓ done) |
| EVSE labeling (NEC 625.43) | Required | Required | ✓ | done (H11) |
| Knox-box / emergency shutoff | Not in Pompano checklist | Not in Pompano checklist | – (Davie-specific) | – |
| Fire stopping schedule | Not in Pompano checklist | Not in Pompano checklist | – | – |
| Cover sheet TOC | Not explicit | Not explicit | ✓ | Sprint 2A H1 (✓ done) |

## Findings (potential new H-numbers)

**H21 — Zoning Compliance Permit Application requirement (Pompano + likely broader Broward).**
Pompano requires a separate Zoning Compliance permit on top of building+electrical. Single-form intake assumption breaks here. Action: M1 manifest for Pompano should set `requirements.zoning_application = required: true` and surface a "Zoning Compliance Application missing" warning on the packet. Likely a simple uploadable PDF (Sprint 2B-shape work). **Severity: Medium** — without it the intake is blocked; not a calc-engine issue.

**H22 — Fire Review Application for multi-family / commercial EVSE.**
Pompano's checklist literally excludes single-family residences but otherwise requires a Fire Review Application. Sprint 2A's H17 lane logic doesn't currently distinguish "fire review applies" — that's a third axis (residential vs non-residential) orthogonal to the FS 471.003(2)(h) contractor-exemption lane. Action: M1 manifest for Pompano gates this requirement on `building_type != 'single_family_residential'`. **Severity: Medium.**

**H23 — Building-final-structural inspection for ground-mounted EVSE pedestals.**
Pompano runs a `BLDG FOOTINGS` and `BLDG TIE DOWNS` inspection separate from the electrical inspections. This is purely an inspection-scheduling concern (not on the plan-set), but worth surfacing in the M1 output so the contractor knows to expect multi-trade inspections. **Severity: Low** (informational only — doesn't change packet content).

**H24 — Two-form Broward Uniform application split (Building-Checked + Electric-Checked).**
This is a Broward-specific intake artifact. SparkPlan currently treats the permit application as one document. For Pompano (and likely Davie), M1 manifest should emit *two* application slots, both using the same Broward Uniform form but with different boxes checked. **Severity: Low** if we treat it as a documentation pattern; the user fills the Broward form themselves so SparkPlan only needs the slot, not the form itself.

## Confidence level

**High.**
- The official Pompano checklist PDF was fetched, parsed, and is reproduced verbatim above.
- Every line item is sourced from text dated 01/29/2024 — current as of this research pass.
- The only items that aren't certain are *which* items roll up into each Broward Uniform form vs separate documents; that's a packaging question for M1 and doesn't change the packet content itself.
