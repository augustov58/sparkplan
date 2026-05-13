/**
 * Sprint 2B PR-4 — City of Orlando manifest.
 *
 * Captures the Orlando AHJ's "EV Charging Station Permit Checklist"
 * (sourced 2026-05-08; validated High confidence in
 * `docs/AHJ_COMPLIANCE_AUDIT_2026-05-04.md`). Orlando's checklist forks on
 * `service_modification_type` (Sprint 2A PR-5):
 *
 * - EV-fed-from-existing path: requires NEC 220.87 narrative + revised
 *   existing panel schedule + site plan + EVSE specs + fire stopping.
 * - EV-fed-from-new-service path: requires available fault current calc
 *   at service main + grounding detail + site plan + EVSE specs + fire
 *   stopping. (NEC 220.87 narrative does NOT apply on this path.)
 *
 * Both paths share: contractor name + license on all drawings (Sprint 2A
 * C8), general note of NEC 2020 compliance (H12 + C7), VD ≤ 3/3/5 note
 * (H13), one-line with AIC labels per node (Sprint 2A M6 + H9), EVSE
 * UL-listing specs (H15).
 *
 * `requirements: []` is intentionally empty — Sprint 2C M1 populates this
 * line-by-line from the audit doc's Orlando matrix. PR-4 ships only the
 * structural manifest data + visibility defaults.
 *
 * @module data/ahj/orlando
 */

import type { AHJManifest } from './types';

/**
 * Orlando-specific general notes — superset of Sprint 2A H12 + H13 with
 * Orlando-specific phrasing for permit submittal. Numbered list rendered
 * on the dedicated General Notes page.
 */
const ORLANDO_GENERAL_NOTES: string[] = [
  'All electrical work shall comply with NFPA-70 (2020 NEC) and the Florida Building Code 8th edition (2023), as adopted by the City of Orlando.',
  'Voltage drop shall not exceed 3% on feeders, 3% on branch circuits, and 5% combined feeder + branch (NEC 215.2(A)(1) FPN; NEC 210.19(A)(1) FPN).',
  'All grounding and bonding shall comply with NEC Article 250. Grounding electrode conductor sized per NEC Table 250.66; equipment grounding conductor sized per NEC Table 250.122.',
  'All raceways, conductors, and overcurrent protective devices shall be labeled with voltage, phase, amperage, and AIC rating per Orlando EV Permit Checklist #4.',
  'Available fault current calculation provided per Orlando EV Permit Checklist #5 (new-service path) — see service-main fault current page.',
  'Contractor name and Florida DBPR license number shall appear on each drawing sheet per Orlando EV Permit Checklist #1.',
  'EVSE equipment shall bear UL-2202 and UL-2594 listings; manufacturer cut sheets attached per Orlando EV Permit Checklist #7.',
  'Fire-rated penetrations shall use a UL-listed firestop assembly. Firestop schedule attached per Orlando EV Permit Checklist #8.',
];

/**
 * Orlando-specific applicable codes list shown on the cover sheet's
 * "APPLICABLE CODES" section (Sprint 2A H4).
 */
const ORLANDO_CODE_REFERENCES: string[] = [
  'NFPA-70 (2020 NEC)',
  'Florida Building Code, 8th edition (2023)',
  'Orlando City Code, Chapter 14 (Electrical)',
  'NFPA-70E (2024) — Standard for Electrical Safety in the Workplace',
];

/**
 * City of Orlando permit-packet manifest. Combines the two checklist
 * paths (existing-service / new-service) into a single manifest;
 * `sectionPredicates` route conditional sections to the right path.
 *
 * Orlando is a single jurisdiction (no subjurisdiction split) — the field
 * is intentionally left `undefined` rather than set to a sentinel so the
 * AHJContext.subjurisdiction check (`!ctx.subjurisdiction`) reads cleanly.
 */
export const orlandoManifest: AHJManifest = {
  id: 'orlando',
  name: 'City of Orlando',
  jurisdictionType: 'city',
  subjurisdiction: undefined,

  // Orlando uniformly cites NEC 2020 across all building types (no Miami-Dade
  // -style H34 fork). Same value for SFR / multi-family / commercial.
  necEdition: {
    single_family_residential: 'NEC 2020',
    multi_family: 'NEC 2020',
    commercial: 'NEC 2020',
  },
  fbcEdition: 'FBC 8th ed (2023)',

  sheetIdPrefix: 'E-',

  generalNotes: ORLANDO_GENERAL_NOTES,
  codeReferences: ORLANDO_CODE_REFERENCES,

  // -------------------------------------------------------------------------
  // RELEVANT SECTIONS — Orlando wants the full Sprint 2A stack
  // -------------------------------------------------------------------------
  // The Orlando line-by-line matrix in the audit doc maps to these sections.
  // Cover is hard-required and not in PacketSections (never toggleable).
  // Sections NOT listed here default OFF; user can still toggle ON via the
  // override layer.
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
    // (arcFlash not in Orlando's checklist; user can opt-in via override)
    // Diagrams & equipment (band 200)
    'riserDiagram',          // Orlando #4 one-line with AIC labels
    'equipmentSchedule',
    'equipmentSpecs',        // Orlando #7 EVSE UL-listings
    'grounding',             // Orlando #6 new-service path — predicated below
    // Panels
    'panelSchedules',        // Orlando #5 existing — revised panel schedule
    // Compliance & AHJ (band 500)
    'complianceSummary',
    'jurisdiction',
    // Specialty (band 600) — auto-enabled when EVEMS / EV detected
    'evemsNarrative',
    'evseLabeling',
    // Multi-family — included by manifest, but auto-disabled by data
    // predicates in the UI layer (meterStacks empty → toggle disabled)
    'meterStack',
    'multiFamilyEV',
  ],

  // -------------------------------------------------------------------------
  // RELEVANT ARTIFACT TYPES — Orlando intake requirements
  // -------------------------------------------------------------------------
  // Per the audit doc Orlando matrix:
  //   #6 site_plan (existing path) / part of #7 (new-service path) — required
  //   #7 cut_sheet — manufacturer cut sheets for EVSE UL-listings
  //   #8 fire_stopping — required both paths
  //   NOC (Florida Statute 713) — required for jobs > $5,000 (Orlando #5b)
  //   manufacturer_data — supplemental; recommended
  //   hvhz_anchoring — statewide for any outdoor pedestal/bollard EVSE
  //     (Sprint 2C H19; Pompano enforces, applies in Orlando too)
  //
  // NOT relevant for Orlando (default OFF, user can still toggle on):
  //   hoa_letter — Pompano multi-family (H6); Orlando doesn't require
  //   survey — separate from site plan; not Orlando intake
  //   zoning_application — Pompano (H21)
  //   fire_review_application — Pompano + Davie commercial (H22)
  //   notarized_addendum — Davie (H25)
  //   property_ownership_search — Davie BCPA.NET (H26)
  //   flood_elevation_certificate — Hillsborough flood zones (H30)
  //   private_provider_documentation — Hillsborough alt path (H33)
  relevantArtifactTypes: [
    'site_plan',
    'cut_sheet',
    'fire_stopping',
    'noc',
    'manufacturer_data',
    'hvhz_anchoring',
  ],

  // -------------------------------------------------------------------------
  // SECTION PREDICATES — conditional relevance refinements
  // -------------------------------------------------------------------------
  // Predicates evaluated AFTER the relevantSections array filter. A section
  // listed in relevantSections AND failing its predicate is hidden. A
  // section listed but with no predicate stays ON (the predicate map is
  // optional — fall-through is "always relevant").
  sectionPredicates: {
    // NEC 220.87 narrative ONLY applies to existing-service path per
    // Orlando matrix (column "EV-fed-from-existing"). New-service path
    // doesn't claim existing capacity, so this page is irrelevant.
    nec22087Narrative: (ctx) => ctx.scope === 'existing-service',

    // Available fault current calc ONLY applies to new-service path
    // (Orlando #5 new-service). Existing-service path doesn't recompute
    // service-main fault current (existing service stays).
    availableFaultCurrent: (ctx) => ctx.scope === 'new-service',

    // Grounding plan (Orlando #6 new-service path) — required for
    // new-service. On existing-service, grounding is already in place; the
    // page is optional (toggle off by default, user can override).
    grounding: (ctx) => ctx.scope === 'new-service',

    // Multi-family scope sections only apply to multi_family building type.
    // The UI layer ALSO auto-disables these when data is absent
    // (meterStacks.length === 0); the predicate is the cleaner gate.
    meterStack: (ctx) => ctx.buildingType === 'multi_family',
    multiFamilyEV: (ctx) => ctx.buildingType === 'multi_family',
  },

  // -------------------------------------------------------------------------
  // ARTIFACT-TYPE PREDICATES — conditional upload-slot relevance
  // -------------------------------------------------------------------------
  artifactTypePredicates: {
    // NOC required for jobs > $5,000 per FL Statute 713. Orlando intake
    // surfaces this on the checklist. Most commercial projects exceed
    // $5k; SFR projects vary. We can't read estimated_value_usd from the
    // context without expanding AHJContext, so the current predicate
    // includes NOC for non-SFR (defensible default) and lets the user
    // toggle off for sub-$5k SFR work.
    noc: (ctx) => ctx.buildingType !== 'single_family_residential',

    // HVHZ anchoring applies to ANY outdoor pedestal/bollard EVSE
    // statewide per Sprint 2C H19 (Pompano + MD cross-validated). Orlando
    // is not in the HVHZ proper but the documentation requirement still
    // surfaces on intake when the design includes outdoor mounting. We
    // don't yet model "outdoor EVSE present?" on the context, so default
    // ON and let the user toggle off for indoor-only projects.
    hvhz_anchoring: () => true,
  },

  // -------------------------------------------------------------------------
  // REQUIREMENTS — Sprint 2C M1 populates this; PR-4 ships empty
  // -------------------------------------------------------------------------
  requirements: [],
};
