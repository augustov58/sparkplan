/**
 * Sprint 2C M1 (post-PR-#69 follow-up) — City of Jacksonville / Duval County
 * consolidated manifest.
 *
 * Sourced 2026-05-16 (`docs/ahj-source-checklists/jacksonville-duval.md`,
 * **Medium-High** confidence — no dedicated EV-charging checklist PDF is
 * published; intake follows the generic Building Inspection Division
 * electrical-sub-permit lane via JaxEPICS).
 *
 * Why Jacksonville is structurally distinct from the other five Sprint 2C
 * AHJs:
 *
 *  1. **Consolidated city-county since 1968.** The City of Jacksonville
 *     and Duval County share one government — there is no separate "Duval
 *     County" AHJ for the consolidated area. The Building Inspection
 *     Division (BID) sits under Jacksonville Public Works and handles all
 *     permits via the JaxEPICS portal (`jaxepics.coj.net`). We model this
 *     as `jurisdictionType: 'city'` even though it functions as both — the
 *     city government IS the county government. The opposite of Miami-Dade,
 *     where 34+ munis fork off a county RER; here, four small munis fork
 *     off a city-county.
 *
 *  2. **Four retained Beaches AHJs.** When consolidation passed in 1968,
 *     Jacksonville Beach, Atlantic Beach, Neptune Beach, and Baldwin
 *     voted to keep their own municipal governments and therefore their
 *     own building departments. These are independent AHJs and out of
 *     scope for this manifest — projects in those four munis must use a
 *     dedicated manifest (Sprint 2C+). We surface this via the
 *     `subjurisdiction` axis with a defensible default of `undefined`
 *     (= consolidated Jacksonville/Duval); a future manifest can stamp
 *     `'jacksonville_beach'` / `'atlantic_beach'` / `'neptune_beach'` /
 *     `'baldwin'` once those four are sourced.
 *
 *  3. **NOT in HVHZ.** HVHZ is statutorily limited to South Florida
 *     (Miami-Dade, Broward, Monroe). Duval is North Florida and falls
 *     outside HVHZ. FL Product Approval still applies statewide for
 *     mounted equipment, so the `hvhz_anchoring` artifact slot stays
 *     available as a Layer-2 user override (per Sprint 2C H19 statewide
 *     pattern) but does NOT default ON like Pompano #6.
 *
 *  4. **Flood-zone exposure.** Jacksonville is coastal + riverine (St.
 *     Johns River bisects the city) with significant FEMA AE/VE/AH/AO
 *     exposure. Elevation Certificates are routinely required prior to
 *     slab inspection AND at final, per Jacksonville Development Services
 *     floodplain regs. We surface `flood_elevation_certificate` for
 *     commercial scope by default (mirrors Hillsborough H30 pattern); SFR
 *     and multi-family default off and opt in via Layer-2 override when
 *     the site falls in a SFHA.
 *
 *  5. **No formal residential trade-permit-no-plan-review lane.** Unlike
 *     Hillsborough/Tampa (H31), Jacksonville BID does NOT publish a
 *     "trade permit no plan review" shortcut for residential electrical.
 *     The published guidance describes a sub-permit model: licensed
 *     electricians pull electrical sub-permits associated with the
 *     homeowner's primary building permit. Owner-builder is allowed for
 *     1–2 family owner-occupied dwellings (per Jacksonville Residential
 *     Permits page). We do NOT downgrade residential to a Hillsborough-
 *     style minimal packet for Jacksonville; the full plan set rides
 *     through for all building types.
 *
 *  6. **Standard 3-trade routing.** Plans submitted via JaxEPICS are
 *     routed to Zoning, Concurrency, Development Services, plus the
 *     Fire Marshal for commercial scope. The plan-review clock does
 *     not start until Zoning/Concurrency/Development Services approve
 *     and the plan-review fee is paid.
 *
 * Research gaps flagged for future passes (commit message also notes):
 *   - **J1 — No dedicated EV-charging checklist PDF.** BID's
 *     "Checklists, Forms and Documents" page lists only two
 *     electrical-specific forms (Emergency Reconnect Letter,
 *     Electrical Temporary Service Letter). EV scope routes through
 *     the generic electrical-sub-permit workflow. Confirmation
 *     pending direct call to BID (904-255-8500). Severity: LOW for
 *     packet generation; the generic intake works.
 *   - **J2 — Tree-canopy / historic-preservation routing.** Jacksonville
 *     ordinances have a tree-protection chapter and an active Historic
 *     Preservation Section that can extend plan review by 3–6 weeks
 *     when triggered. Not relevant to most EV installs (no canopy
 *     removal, no historic structure modification), but worth a
 *     contractor-facing tooltip in Sprint 3.
 *   - **J3 — Sealed-plan threshold for residential.** BID publishes
 *     "digitally signed and sealed plans" as a general requirement
 *     without an explicit sub-$X threshold for owner-builder. We
 *     honor Sprint 2A H17 lane logic (PE seal gated by
 *     `lane === 'pe_required'`) and assume contractor-exemption
 *     residential bypasses the seal — consistent with FL contractor
 *     statute. Direct BID confirmation deferred to Sprint 3 C5.
 *   - **J4 — NOC threshold for sub-permits.** Jacksonville BID reuses
 *     the FS 713.13 statewide $5,000 NOC threshold; mechanical scope
 *     uses a separate $15,000 threshold. For pure-electrical EV
 *     installs the $5,000 threshold applies. We model NOC the same
 *     way as Pompano/Hillsborough (required for non-SFR;
 *     SFR users toggle on for sub-threshold residential).
 *
 * @module data/ahj/jacksonville-duval
 */

import type { AHJManifest } from './types';

// ============================================================================
// NARRATIVE CONTENT
// ============================================================================

/**
 * Jacksonville/Duval general notes. Includes statewide statutory language
 * (NEC 2020, FBC 8th ed, FFPC 8th ed) plus Jacksonville-specific intake
 * reminders (JaxEPICS routing, sub-permit model, NOC threshold).
 */
const JACKSONVILLE_DUVAL_GENERAL_NOTES: string[] = [
  'All electrical work shall comply with NFPA-70 (2020 NEC) and the Florida Building Code 8th edition (2023), as adopted and enforced by the City of Jacksonville Building Inspection Division (Duval County consolidated jurisdiction).',
  'Voltage drop shall not exceed 3% on feeders, 3% on branch circuits, and 5% combined feeder + branch (NEC 215.2(A)(1) FPN; NEC 210.19(A)(1) FPN).',
  'All grounding and bonding shall comply with NEC Article 250. Grounding electrode conductor sized per NEC Table 250.66; equipment grounding conductor sized per NEC Table 250.122.',
  'All service equipment, panelboards, and overcurrent devices shall be labeled with voltage, phase, amperage, and AIC rating per NEC 110.9 and 110.10.',
  'Contractor name and Florida DBPR license number shall appear on each drawing sheet (Sprint 2A C8).',
  'Permit intake and plan submittal shall be performed electronically via the JaxEPICS portal (jaxepics.coj.net). All documents shall be submitted in PDF format. The plan-review clock begins only after Zoning, Concurrency, and Development Services approve the plans for review and the plan-review fee is paid.',
  'Electrical work shall be filed as an electrical sub-permit associated with the primary building permit when applicable. Licensed electrical contractors shall pull their own sub-permit; owner-builder is permitted only for 1- or 2-family owner-occupied dwellings per Jacksonville Residential Permits guidance.',
  'Notice of Commencement (Florida Statute 713.13) is required and shall be recorded with the Duval County Clerk of Courts (or filed at BID) prior to the first inspection for any electrical job exceeding $5,000 contract value.',
  'For projects within a FEMA Special Flood Hazard Area, equipment elevation shall be demonstrated above the Design Flood Elevation per Florida Building Code. Elevation Certificates may be required prior to slab inspection and again at final inspection for construction in AO/AE/VE zones per Jacksonville Development Services floodplain regulations.',
  'EVSE equipment shall bear UL-2202 and UL-2594 listings; manufacturer cut sheets attached. EVSE labeling shall comply with NEC 625.43; EVEMS narrative shall comply with NEC 625.42 where applicable.',
];

/**
 * Jacksonville/Duval applicable codes list shown on the cover sheet's
 * "APPLICABLE CODES" section (Sprint 2A H4). All editions verified
 * 2026-05-16 against the BID Codes page (`jacksonville.gov/.../codes`).
 */
const JACKSONVILLE_DUVAL_CODE_REFERENCES: string[] = [
  'NFPA-70 (2020 NEC)',
  'Florida Building Code, 8th edition (2023) — Building',
  'Florida Building Code, 8th edition (2023) — Residential',
  'Florida Building Code, 8th edition (2023) — Existing Buildings',
  'Florida Building Code, 8th edition (2023) — Mechanical / Plumbing / Fuel-Gas / Energy / Accessibility',
  'Florida Fire Prevention Code, 8th edition (NFPA 1, 2021)',
  'Florida Statute 713.13 (Notice of Commencement)',
  'City of Jacksonville Ordinance Code, Title VIII (Construction Regulation) — Chapter 320',
  'NFPA-70E (2024) — Standard for Electrical Safety in the Workplace',
];

// ============================================================================
// MANIFEST
// ============================================================================

/**
 * City of Jacksonville / Duval County (Consolidated) permit-packet
 * manifest.
 *
 * `jurisdictionType: 'city'` because Jacksonville is structurally a city
 * government that absorbed county functions in 1968. `subjurisdiction:
 * undefined` defaults to the consolidated jurisdiction. The four retained
 * Beaches munis (Jacksonville Beach / Atlantic Beach / Neptune Beach /
 * Baldwin) are independent AHJs and out of scope; future manifests can
 * pick those up via the `subjurisdiction` axis or as standalone manifests.
 *
 * Jacksonville/Duval cites NEC 2020 uniformly across all building types
 * (no Miami-Dade H34 fork). FBC 8th ed (2023) statewide.
 */
export const jacksonvilleDuvalManifest: AHJManifest = {
  id: 'jacksonville-duval',
  name: 'City of Jacksonville / Duval County (Consolidated)',
  jurisdictionType: 'city',
  subjurisdiction: undefined,

  necEdition: {
    single_family_residential: 'NEC 2020',
    multi_family: 'NEC 2020',
    commercial: 'NEC 2020',
  },
  fbcEdition: 'FBC 8th ed (2023)',

  // Jacksonville BID follows the standard 'E-' discipline letter. No
  // documented alternate prefix (Miami-Dade's 'EL-' was H20-specific).
  sheetIdPrefix: 'E-',

  generalNotes: JACKSONVILLE_DUVAL_GENERAL_NOTES,
  codeReferences: JACKSONVILLE_DUVAL_CODE_REFERENCES,

  // -------------------------------------------------------------------------
  // RELEVANT SECTIONS — full Sprint 2A engineering stack
  // -------------------------------------------------------------------------
  // Jacksonville does NOT publish a residential-trade-permit-no-plan-review
  // shortcut (J3 / unlike Hillsborough H31). All building types ride the
  // full plan set through JaxEPICS routing. Scope-conditional fork
  // (existing vs new service) is handled the same way as Orlando/Pompano.
  relevantSections: [
    // Front matter (band 000)
    'tableOfContents',
    'generalNotes',
    'revisionLog',
    // Engineering (band 100)
    'loadCalculation',
    'nec22087Narrative',     // existing-service path only — predicated below
    'availableFaultCurrent', // new-service path only — predicated below
    'voltageDrop',
    'shortCircuit',
    // Diagrams & equipment (band 200)
    'riserDiagram',
    'equipmentSchedule',
    'equipmentSpecs',
    'grounding',             // new-service path only — predicated below
    // Panels
    'panelSchedules',
    // Compliance & AHJ (band 500)
    'complianceSummary',
    'jurisdiction',
    // Specialty (band 600)
    'evemsNarrative',
    'evseLabeling',
    // Multi-family — predicated to multi_family below
    'meterStack',
    'multiFamilyEV',
  ],

  // -------------------------------------------------------------------------
  // RELEVANT ARTIFACT TYPES — Jacksonville intake requirements
  // -------------------------------------------------------------------------
  // Per the Jacksonville BID published guidance + cross-walk:
  //   site_plan — required (Development Services routing + flood-zone callouts)
  //   cut_sheet — EVSE cut sheets (UL listings)
  //   noc — FS 713.13 > $5k
  //   manufacturer_data — supplemental
  //   fire_stopping — when rated penetrations are involved (commercial)
  //   flood_elevation_certificate — Jacksonville coastal/riverine SFHA
  //     exposure (default ON for commercial; SFR opt-in via Layer 2)
  //
  // NOT relevant for Jacksonville/Duval (default OFF, user can toggle):
  //   hoa_letter — no AHJ-level requirement
  //   survey — Jacksonville accepts site_plan; survey is optional
  //   zoning_application — Pompano-specific (H21); JaxEPICS routes zoning
  //     internally — no separate uploaded application
  //   fire_review_application — Pompano-specific (H22); Jacksonville Fire
  //     Marshal review is internal routing, not a contractor-uploaded form
  //   notarized_addendum — Davie H25
  //   property_ownership_search — Davie BCPA.NET H26
  //   hvhz_anchoring — Jacksonville NOT in HVHZ; user can opt-in via
  //     Layer 2 override per Sprint 2C H19 statewide pattern
  //   private_provider_documentation — FS 553.791 alt path (commercial only;
  //     niche; default off, user opts in)
  relevantArtifactTypes: [
    'site_plan',
    'cut_sheet',
    'noc',
    'manufacturer_data',
    'fire_stopping',
    'flood_elevation_certificate',
  ],

  // -------------------------------------------------------------------------
  // SECTION PREDICATES — scope and building-type forks (no lane downgrade)
  // -------------------------------------------------------------------------
  sectionPredicates: {
    // NEC 220.87 narrative applies only to existing-service path (same
    // fork as Orlando/Pompano).
    nec22087Narrative: (ctx) => ctx.scope === 'existing-service',

    // Available fault current calc applies only to new-service path.
    availableFaultCurrent: (ctx) => ctx.scope === 'new-service',

    // Grounding plan required on new-service path; existing service has
    // grounding already in place.
    grounding: (ctx) => ctx.scope === 'new-service',

    // Multi-family sections gate to multi_family. UI layer additionally
    // auto-disables when meterStacks data is absent.
    meterStack: (ctx) => ctx.buildingType === 'multi_family',
    multiFamilyEV: (ctx) => ctx.buildingType === 'multi_family',
  },

  // -------------------------------------------------------------------------
  // ARTIFACT-TYPE PREDICATES — conditional upload-slot relevance
  // -------------------------------------------------------------------------
  artifactTypePredicates: {
    // NOC required for jobs > $5,000 (FS 713.13). AHJContext doesn't model
    // estimated_value_usd yet — defensible default is "required for non-SFR"
    // (commercial / multi-family virtually always exceed $5k). SFR users
    // toggle on for sub-threshold residential.
    noc: (ctx) => ctx.buildingType !== 'single_family_residential',

    // Fire-stopping: required when penetrating rated assemblies, which is
    // typical for commercial. SFR Level-2 home installs rarely penetrate
    // rated assemblies. Default ON for commercial only.
    fire_stopping: (ctx) => ctx.buildingType === 'commercial',

    // Flood elevation certificate: Jacksonville has significant SFHA
    // exposure (coastal + St. Johns River). AHJContext doesn't yet model
    // flood-zone status — defensible default is ON for commercial
    // (commercial intake routinely surfaces DFE on plans); SFR/multi-family
    // default off and user opts in via Layer 2 when the site is in a SFHA.
    flood_elevation_certificate: (ctx) => ctx.buildingType === 'commercial',
  },

  // -------------------------------------------------------------------------
  // REQUIREMENTS — Sprint 2C M1 conformance checklist
  // -------------------------------------------------------------------------
  // No dedicated EV checklist (J1); requirements derive from the BID
  // generic electrical-sub-permit workflow + statewide statutory baseline.
  // Categories: application / narrative / plan / upload / inspection.
  requirements: [
    // -- Application paperwork (category: 'application') ------------------
    {
      id: 'jacksonville-duval-electrical-sub-permit-application',
      name: 'Electrical sub-permit application (JaxEPICS intake)',
      category: 'application',
      // Required on every Jacksonville intake — electrical sub-permit is
      // the operative permit type for EVSE work.
      required: () => true,
      // No dedicated artifact_type for the JaxEPICS application form
      // (it's filed in the portal directly). Detect via presence of the
      // generalNotes / cover envelope (proxy for "packet was generated
      // for submission").
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('generalNotes')),
    },
    {
      id: 'jacksonville-duval-noc',
      name: 'Notice of Commencement (FS 713.13, jobs > $5,000) — recorded with Duval Clerk',
      category: 'application',
      // Same defensible default as Pompano/Orlando: required for non-SFR.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },
    {
      id: 'jacksonville-duval-private-provider-doc',
      name: 'Private Provider documentation (FS 553.791 alt path, optional)',
      category: 'application',
      // Niche commercial-only opt-in path. Not required by default.
      // Mirrors Hillsborough H33 — commercial only, user opts in.
      required: () => false,
      detect: (_packet, attachments) =>
        attachments.some(
          (a) => a.artifactType === 'private_provider_documentation',
        ),
    },

    // -- Narrative / code-basis (category: 'narrative') -------------------
    {
      id: 'jacksonville-duval-code-basis-block',
      name: 'Cover-sheet code basis block (NEC 2020 + FBC 8th ed + FFPC 8th + COJ Ch. 320)',
      category: 'narrative',
      required: () => true,
      // Cover sheet is always present; treat satisfied whenever any sheet
      // IDs exist (cover is sheet 1).
      detect: (packet) => (packet.sheetIds?.length ?? 0) > 0,
    },
    {
      id: 'jacksonville-duval-contractor-license-block',
      name: 'Contractor name and Florida DBPR license number on each sheet',
      category: 'narrative',
      required: () => true,
      // Satisfied implicitly by Sprint 2A C8 title-block stamping;
      // presence of any sheet IDs is the contractor-block proxy until a
      // dedicated AST flag lands.
      detect: (packet) => (packet.sheetIds?.length ?? 0) > 0,
    },
    {
      id: 'jacksonville-duval-pe-seal',
      name: 'Digitally signed and sealed plans by FL-registered PE or RA (when applicable)',
      category: 'narrative',
      // Lane-gated per Sprint 2A H17. Contractor-exemption residential
      // bypasses; pe_required lane requires seal. BID general guidance
      // says "digitally signed and sealed" without an explicit threshold
      // (J3 research gap) — we honor the H17 lane axis as the
      // discriminator.
      required: (ctx) => ctx.lane === 'pe_required',
      // No AST flag for PE-seal presence yet — default detect to false so
      // the engine surfaces it as missing. Upgrade in Sprint 3 C5 when
      // the seal-stamping flow lands.
      detect: () => false,
    },

    // -- Plan-set requirements (category: 'plan') -------------------------
    {
      id: 'jacksonville-duval-site-plan',
      name: 'Site plan with EVSE location and flood-zone callouts (FEMA panel + BFE)',
      category: 'plan',
      // Required on every Jacksonville intake — Development Services
      // routing checks the site plan for zoning + flood-zone compliance.
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'site_plan'),
      locator: (packet) => {
        const ids = packet.sheetIds ?? [];
        return ids.find((id) => id.startsWith('C-')) ?? null;
      },
    },
    {
      id: 'jacksonville-duval-riser-diagram',
      name: 'One-line / riser diagram with AIC labels per node (NEC 110.9/110.10)',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('riserDiagram')),
    },
    {
      id: 'jacksonville-duval-panel-schedule',
      name: 'Panel / switchboard schedule (wattages, amps, branch circuits, spares)',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('panelSchedules')),
    },
    {
      id: 'jacksonville-duval-load-calculations',
      name: 'Load calculations for the EVSE per NEC Article 220',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('loadCalculation')),
    },
    {
      id: 'jacksonville-duval-voltage-drop',
      name: 'Voltage drop considerations (NEC 215.2 / 210.19 FPN)',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('voltageDrop')),
    },
    {
      id: 'jacksonville-duval-fault-current',
      name: 'Available fault current calculation (NEC 110.9/110.10) — new service',
      category: 'plan',
      required: (ctx) => ctx.scope === 'new-service',
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('availableFaultCurrent')),
    },
    {
      id: 'jacksonville-duval-grounding',
      name: 'Service equipment grounding detail (NEC Article 250) — new service',
      category: 'plan',
      required: (ctx) => ctx.scope === 'new-service',
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('grounding')),
    },
    {
      id: 'jacksonville-duval-existing-service-nec22087',
      name: 'NEC 220.87 existing-service spare-capacity narrative — existing service',
      category: 'plan',
      required: (ctx) => ctx.scope === 'existing-service',
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('nec22087Narrative')),
    },
    {
      id: 'jacksonville-duval-equipment-schedule',
      name: 'Equipment schedule (EVSE, disconnects, conductors, OCPDs)',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('equipmentSchedule')),
    },
    {
      id: 'jacksonville-duval-design-flood-elevation',
      name: 'Design Flood Elevation reference (FBC, when in FEMA SFHA)',
      category: 'plan',
      // Conditional on flood-zone status. AHJContext doesn't model flood
      // zone yet (Hillsborough H30 / J4 carry-over). Defensible default
      // for commercial; SFR/multi-family rely on user Layer-2 override.
      required: (ctx) => ctx.buildingType === 'commercial',
      detect: (_packet, attachments) =>
        attachments.some(
          (a) => a.artifactType === 'flood_elevation_certificate',
        ),
    },

    // -- Upload category (category: 'upload') -----------------------------
    {
      id: 'jacksonville-duval-evse-cut-sheet',
      name: 'EVSE manufacturer cut sheets (UL-2202 / UL-2594 listings)',
      category: 'upload',
      // Useful at any scope; cut sheets are the standard listing evidence
      // for EVSE intake regardless of lane.
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'cut_sheet'),
    },
    {
      id: 'jacksonville-duval-fire-stopping',
      name: 'Firestop assembly schedule for rated penetrations (commercial)',
      category: 'upload',
      required: (ctx) => ctx.buildingType === 'commercial',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'fire_stopping'),
    },

    // -- Inspections (category: 'inspection') ----------------------------
    // Jacksonville BID inspection types per the residential/commercial
    // permits guidance. These don't gate packet content — surfaced on the
    // checklist page so the contractor knows what's coming.
    {
      id: 'jacksonville-duval-inspection-electrical-rough',
      name: 'Electrical inspection: Rough-in (pre-cover)',
      category: 'inspection',
      required: () => true,
      // Inspections aren't packet artifacts — detect: false marks pending.
      detect: () => false,
    },
    {
      id: 'jacksonville-duval-inspection-electrical-final',
      name: 'Electrical inspection: Final',
      category: 'inspection',
      required: () => true,
      detect: () => false,
    },
    {
      id: 'jacksonville-duval-inspection-floodplain-slab',
      name: 'Elevation Certificate prior to slab inspection (when in SFHA)',
      category: 'inspection',
      // Floodplain inspection gating — only required when in SFHA. We
      // surface for commercial as the manual-verification default; SFR
      // user opts in via Layer 2 when applicable.
      required: (ctx) => ctx.buildingType === 'commercial',
      detect: (_packet, attachments) =>
        attachments.some(
          (a) => a.artifactType === 'flood_elevation_certificate',
        ),
    },
    {
      id: 'jacksonville-duval-inspection-floodplain-final',
      name: 'Elevation Certificate at final inspection (when in SFHA)',
      category: 'inspection',
      required: (ctx) => ctx.buildingType === 'commercial',
      detect: (_packet, attachments) =>
        attachments.some(
          (a) => a.artifactType === 'flood_elevation_certificate',
        ),
    },
    {
      id: 'jacksonville-duval-inspection-fire-final',
      name: 'Fire inspection: Final (commercial / multi-family only)',
      category: 'inspection',
      // Fire Marshal review is internal JaxEPICS routing for commercial /
      // multi-family scope. SFR Level-2 home EV installs typically do not
      // route through the Fire Marshal.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: () => false,
    },

    // -- EVSE-specific (category: 'inspection') --------------------------
    {
      id: 'jacksonville-duval-evse-labeling',
      name: 'EVSE labeling per NEC 625.43 (visible at disconnect)',
      category: 'inspection',
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('evseLabeling')),
    },
    {
      id: 'jacksonville-duval-evems-narrative',
      name: 'EVEMS operational narrative (NEC 625.42, when EVEMS present)',
      category: 'inspection',
      // Conditional on EVEMS scope. AHJContext doesn't model "EVEMS
      // present?" — leave required across all lanes and let the section's
      // data predicate hide it when irrelevant.
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('evemsNarrative')),
    },
  ],
};
