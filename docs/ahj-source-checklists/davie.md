# Town of Davie (Broward County) — EV Charging Station Permit Checklist

**Sourced:** 2026-05-12
**Source URL(s):**
- **Town of Davie "Electric Vehicle (E.V) Charger Checklist" (official, PDF)**: https://www.davie-fl.gov/DocumentCenter/View/17350/Electric-Vehicle-Charger-Checklist — saved to `/tmp/davie-ev.txt` during research.
- Davie Electrical Forms & Checklists landing: https://www.davie-fl.gov/1226/Electrical
- Davie Building Division landing: https://www.davie-fl.gov/206/Building
- Davie Building Forms: https://www.davie-fl.gov/1301/Building-Forms
- Davie Online Application Submittal portal (mandatory 2026+): https://davie-fl-us.avolvecloud.com/

**Official EV-specific checklist available:** **Yes** — Town of Davie publishes a 2-page combined "Electric Vehicle (E.V) Charger Checklist" + "Electrical Service Change Checklist" PDF (the two checklists are on the same document; commercial-only items are explicitly called out on page 2).

**Notes:**
- Davie is the **only one of the four** that calls out commercial-specific items in writing: **Knox Box Remote Power Box (model KLS4-505)** for emergency shut-off, **bollard protection** for the transformer, **master manual shutdown shunt**, and **switchboard signage** identifying the main breaker as emergency disconnect. This validates the existing H11 (commercial-only Knox-box).
- Like Pompano, intake includes Electrical + Fire + Planning & Zoning **plan-review stops**, but Davie does not require a separate Zoning Compliance application (it's a plan-review stop on the same permit).
- **OAS (Online Application Submittal)** via avolvecloud is the **required** submission method starting January 12, 2026.
- The "Electrical Service Change Checklist" header on page 2 is a layout artifact — the commercial-only block is labeled as additional EV requirements, not a separate service-change scope.

## Source artifacts (verbatim from `Electric-Vehicle-Charger-Checklist.pdf`)

**Header:**
> "BUILDING DIVISION
> ELECTRIC VEHICLE (E.V) CHARGER CHECKLIST
> 8800 SW 36th STREET, DAVIE, FLORIDA 33328
> PHONE: 954.797.2066 FAX: 954.797.1086 WWW.DAVIE-FL.GOV"

**Required Forms (verbatim):**
> "□ Building Permit Application
> □ Signed and Notarized Addendum Form by Contractor and Owner.
> □ A Notice of Commencement must be recorded if the job exceeds $5,000.
> □ If permit submitted as an Owner Builder provide Owner Builder Disclosure Statement.
> □ To avoid any delays in the permitting process, it is recommended to include a signed contract as proof of job value when over $5000.
> □ If the contractor has a Workers' Compensation Exemption, a Workers' Compensation Exemption Letter is required.
> □ Copy of Property Search/Ownership from the Broward County Property Appraisers Office WWW.BCPA.NET."

**Required Permit Applications:** "Electrical"

**Permit Review Stops:** "Electrical / Fire / Planning & Zoning"

**Minimum Plan Submittal (verbatim):**
> "□ It is recommended to hire a licensed electrical contractor for this work.
> □ Electrical floor plan drawing detailing EV charger location and electrical panel location, include conduit and wire size.
> □ Electrical riser diagram and load calculations for electrical service and the panel EV charger is to be connected to.
> □ Provide manufactures submittals for EV charger."

**Additional Commercial-Only items (verbatim, page 2):**
> "□ Charging station(s) need to have emergency shut-off capabilities located within the vicinity of the charging station(s). The contractor needs to install a Knox Box Remote Power Box (model: KLS4-505) for emergency shut-off of charging station(s). The contractor will install a Knox Box Power Box (model: KLS-4505).
> □ Signage will be installed on the switchboard indicating the section the main breaker is in and that it functions as the emergency disconnect
> □ The breakers in the switchboard are equipped with a locking means that remain in place with or without a lock installed that meets the requirement of NEC 625.42.
> □ Provide bollard protection for the new electrical transformer and equipment.
> □ Provide one master manual shutdown shunt for all of the dispensers and Identify location of master manual shutdown on the site plan."

## Line-by-line cross-walk (mirrors Orlando matrix)

| Davie line item | EV-fed-from-existing | EV-fed-from-new-service | Currently in SparkPlan packet | Sprint where addressed |
|---|---|---|---|---|
| Building Permit Application | Required | Required | ❌ | Sprint 2B (H5) |
| Signed and Notarized Addendum Form (contractor + owner) | Required | Required | ❌ | **New finding — see H25** |
| Notice of Commencement (>$5k) | Required | Required | ❌ | Sprint 2B (H5) |
| Owner-Builder Disclosure Statement (if applicable) | Conditional | Conditional | ❌ | Sprint 2B (conditional upload) |
| Signed contract / job value evidence (>$5k) | Recommended | Recommended | ❌ | Sprint 2B (conditional) |
| Workers' Comp Exemption Letter (if contractor has exemption) | Conditional | Conditional | ❌ | Sprint 2B (conditional) |
| Property Search / Ownership (BCPA.NET) | Required | Required | ❌ | **New finding — H26** |
| **Electrical floor plan** — EV charger + panel locations, **conduit and wire size** | Required | Required | ✓ implied in one-line; floor plan upload is separate (Sprint 2B H7) | partial — verify conduit + wire size are visible per node in M6 |
| **Riser diagram + load calculations** for service + EV panel | Required | Required | ✓ | done (M6, C1, C2) |
| Manufacturer submittals for EV charger | Required | Required | ✓ specs page; upload pending | done specs (H15); Sprint 2B H8 |
| Permit review stop: Fire | Required (all) | Required (all) | n/a — review-stop, not packet artifact | – |
| Permit review stop: Planning & Zoning | Required (all) | Required (all) | n/a — review-stop, not packet artifact | – |
| **Commercial: Knox Box Remote Power Box (model KLS-4505) for emergency shut-off** | Required (commercial) | Required (commercial) | ✓ existing H11 commercial conditional | Sprint 2A H11 (✓ done) — verify model number text |
| **Commercial: Switchboard signage** identifying main breaker as emergency disconnect | Required (commercial) | Required (commercial) | ⚠️ general labeling note exists; explicit "main breaker = emergency disconnect" sign is not auto-generated | **H27 candidate** |
| **Commercial: Switchboard breakers w/ locking means** per NEC 625.42 | Required (commercial) | Required (commercial) | ⚠️ implied in EVEMS narrative; explicit locking-means callout not on plan | **H27 candidate (cont.)** |
| **Commercial: Bollard protection for transformer / equipment** | Required (commercial w/ new xfmr or outdoor equipment) | Required (commercial) | ❌ | **H28 candidate** |
| **Commercial: Master manual shutdown shunt for all dispensers + location on site plan** | Required (commercial multi-dispenser) | Required (commercial multi-dispenser) | ❌ | **H29 candidate** |
| Per-sheet contractor signature | Required (Broward statewide) | Required | ✓ | Sprint 2A C8 (✓ done) |
| FBC / NEC code reference block | Required (statewide) | Required | ✓ | Sprint 2A C7 / H4 (✓ done) |
| Cover sheet TOC | Not explicit on Davie checklist | Not explicit | ✓ | Sprint 2A H1 (✓ done) |
| **OAS submission via avolvecloud (mandatory 2026+)** | Required (process) | Required | n/a — submission process, not packet content | – |
| HOA / condo approval letter | Not on Davie checklist | Not on Davie checklist | – (Pompano-specific) | – |

## Findings (potential new H-numbers)

**H25 — "Signed and Notarized Addendum Form by Contractor and Owner" (Davie-specific intake form).**
Davie is the only AHJ of the five that requires a notarized addendum signed by both contractor and owner. This is a separate uploadable PDF (not something SparkPlan generates), so M1 manifest treats it as a `required_upload` slot. **Severity: Medium** — without it, Davie intake is blocked.

**H26 — Broward Property Appraiser (BCPA) ownership search.**
Davie requires a property-ownership printout from BCPA.NET. SparkPlan could optionally auto-pull this via BCPA's public search (data-flywheel candidate), but for now it's an upload slot. **Severity: Low** — contractor has to grab a 1-page printout.

**H27 — Commercial switchboard signage + breaker locking-means callout (NEC 625.42).**
Davie commercial-only checklist requires:
1. Signage on switchboard: "main breaker = emergency disconnect"
2. Locking means on switchboard breakers per NEC 625.42

H11 partially covers EVSE labeling, but not the **switchboard-side** main-breaker signage. Add to a commercial-conditional notes block on the one-line page or to the EVEMS narrative when commercial scope. **Severity: Medium.**

**H28 — Commercial bollard protection for outdoor transformer / equipment.**
Davie requires bollard protection for outdoor electrical transformers (vehicular impact protection). SparkPlan has no concept of "outdoor equipment exposure" today. M1 manifest can flag this as a `manual_verification_required` requirement when the project includes a new outdoor pad-mount transformer for the EV scope. **Severity: Medium-High** for commercial / multi-family with new utility-side transformers; **N/A** when EV is fed from existing service.

**H29 — Master manual shutdown shunt for multi-dispenser commercial sites + location on site plan.**
Multi-dispenser commercial EV sites (think workplace charging with 4+ EVSE) need a single master shutdown shunt. This is a **plan-set callout** (location on site plan) + **scope item** (the shunt itself). SparkPlan's site plan upload (Sprint 2B H7) needs an optional "master shutdown location" annotation field, *or* the packet's narrative needs to call this requirement out and let the contractor mark it on the upload. **Severity: Medium-High** for any commercial multi-dispenser project.

## Confidence level

**High.**
- The official Davie checklist PDF was fetched, parsed, and is reproduced verbatim above.
- All commercial-only items are clearly demarcated and quotable.
- The only ambiguity is the exact Knox Box model number — the PDF text appears twice with two different formats: "KLS4-505" and "KLS-4505". This looks like an OCR-vs-original typesetting artifact in the source PDF, not a real Davie product number conflict. Recommend confirming with Knox Box product catalog or Davie inspector before encoding into M1 manifest.
