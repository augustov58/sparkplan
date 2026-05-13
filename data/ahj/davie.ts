/**
 * Sprint 2C M1 — Town of Davie manifest.
 *
 * Captures the Town of Davie AHJ's "Electric Vehicle (E.V) Charger Checklist"
 * (sourced 2026-05-12 from `docs/ahj-source-checklists/davie.md`; verbatim
 * checklist preserved there).
 *
 * Davie is the **only one of the four 2C AHJs that calls out commercial-only
 * items in writing**, which makes it the best commercial-vs-residential test
 * case for the M1 engine. Three commercial-only requirements are predicated
 * on `ctx.buildingType === 'commercial'`:
 *
 *   - H27 — Knox-box (KLS-4505) emergency shut-off + switchboard signage
 *           (main breaker = emergency disconnect) + NEC 625.42 locking-means
 *   - H28 — Bollard protection for outdoor electrical transformer / equipment
 *   - H29 — Master manual shutdown shunt for multi-dispenser sites + site-plan
 *           location callout
 *
 * Davie-specific intake artifacts shared by all building types:
 *   - H25 — Signed and notarized addendum form (contractor + owner)
 *   - H26 — Broward County Property Appraiser (BCPA.NET) ownership search
 *   - NOC required when job value > $5,000 (FL Statute 713 — same as Orlando)
 *
 * Per the audit doc, intake includes Electrical / Fire / Planning & Zoning
 * **review stops** (not separate plan-submittal artifacts on Davie's
 * checklist, so they're modeled as ON-by-default `fire_review_application`
 * uploads rather than separate sections). OAS submission via avolvecloud is
 * a process requirement (not a packet artifact).
 *
 * @module data/ahj/davie
 */

import type { AHJManifest } from './types';

/**
 * Davie-specific general notes — superset of the Sprint 2A FL-pilot stack with
 * Davie commercial-only callouts deliberately left to the requirements list
 * (M1 engine surfaces them conditionally on the checklist page, not as
 * blanket notes that would appear on residential packets too).
 */
const DAVIE_GENERAL_NOTES: string[] = [
  'All electrical work shall comply with NFPA-70 (2020 NEC) and the Florida Building Code 8th edition (2023), as adopted by the Town of Davie.',
  'Voltage drop shall not exceed 3% on feeders, 3% on branch circuits, and 5% combined feeder + branch (NEC 215.2(A)(1) FPN; NEC 210.19(A)(1) FPN).',
  'All grounding and bonding shall comply with NEC Article 250. Grounding electrode conductor sized per NEC Table 250.66; equipment grounding conductor sized per NEC Table 250.122.',
  'Contractor name and Florida DBPR license number shall appear on each drawing sheet (Broward County statewide convention).',
  'Notice of Commencement required to be recorded for any job exceeding $5,000 per Florida Statute 713.',
  'A signed and notarized addendum form executed by both the contractor and the owner shall be submitted with the permit application (Town of Davie intake requirement).',
  'A copy of the property search / ownership record from the Broward County Property Appraiser (BCPA.NET) shall be included with the permit application.',
  'EVSE equipment shall bear UL-2202 and UL-2594 listings; manufacturer submittals attached.',
  'Plan review stops include Electrical, Fire, and Planning & Zoning. Permits are submitted electronically via the Town of Davie Online Application Submittal portal (avolvecloud) per the mandatory 2026 submission policy.',
];

/**
 * Davie-specific applicable codes list shown on the cover sheet's
 * "APPLICABLE CODES" section (Sprint 2A H4). Davie operates under FBC and the
 * Broward County Amendments to the FBC.
 */
const DAVIE_CODE_REFERENCES: string[] = [
  'NFPA-70 (2020 NEC)',
  'Florida Building Code, 8th edition (2023)',
  'Broward County Amendments to the Florida Building Code',
  'Town of Davie Code of Ordinances, Chapter 11 (Buildings and Construction)',
  'NFPA-70E (2024) — Standard for Electrical Safety in the Workplace',
];

/**
 * Town of Davie permit-packet manifest. Single jurisdiction (no
 * subjurisdiction split). Davie's checklist applies across the existing-
 * service / new-service service-modification axis uniformly — predicates here
 * fork primarily on `buildingType` (commercial-only block) rather than on
 * `scope`.
 *
 * `jurisdictionType: 'city'` per `AHJManifest` spec — the underlying union is
 * `'city' | 'county'` and Davie is a Town, so it maps to `'city'`.
 */
export const davieManifest: AHJManifest = {
  id: 'davie',
  name: 'Town of Davie',
  jurisdictionType: 'city',
  subjurisdiction: undefined,

  // Davie uniformly cites NEC 2020 (no Miami-Dade-style H34 fork).
  necEdition: {
    single_family_residential: 'NEC 2020',
    multi_family: 'NEC 2020',
    commercial: 'NEC 2020',
  },
  fbcEdition: 'FBC 8th ed (2023)',

  sheetIdPrefix: 'E-',

  generalNotes: DAVIE_GENERAL_NOTES,
  codeReferences: DAVIE_CODE_REFERENCES,

  // -------------------------------------------------------------------------
  // RELEVANT SECTIONS
  // -------------------------------------------------------------------------
  // Davie's "Minimum Plan Submittal" maps to: electrical floor plan
  // (conduit + wire size) + riser diagram + load calculations + manufacturer
  // submittals. The Sprint 2A stack covers this — sections listed here are
  // the same superset Orlando uses, minus paths Davie doesn't explicitly
  // require but the engine can still render when applicable (e.g., short
  // circuit, voltage drop are FL statewide conventions).
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
    // Specialty (band 600) — auto-enabled when EVEMS / EV detected
    'evemsNarrative',
    'evseLabeling',
    // Multi-family — predicated below; auto-disabled when data absent
    'meterStack',
    'multiFamilyEV',
  ],

  // -------------------------------------------------------------------------
  // RELEVANT ARTIFACT TYPES — Davie intake
  // -------------------------------------------------------------------------
  // Per the Davie checklist (verbatim in docs/ahj-source-checklists/davie.md):
  //   - site_plan + cut_sheet + manufacturer_data = Minimum Plan Submittal
  //   - fire_stopping = statewide FL-pilot convention (always)
  //   - noc = NOC required >$5k (FL Statute 713)
  //   - notarized_addendum = H25 (signed + notarized addendum form)
  //   - property_ownership_search = H26 (BCPA.NET printout)
  //   - fire_review_application = Davie Fire review stop intake
  //   - hvhz_anchoring = statewide HVHZ doc (Sprint 2C H19)
  //
  // NOT relevant by manifest default (user can still toggle on):
  //   - hoa_letter — Pompano multi-family (H6); Davie's checklist doesn't
  //     require HOA approval
  //   - survey — not on Davie checklist
  //   - zoning_application — Davie's P&Z is a review-stop on the same
  //     permit, not a separate application (Pompano-style H21 not applicable)
  //   - flood_elevation_certificate — Hillsborough (H30)
  //   - private_provider_documentation — Hillsborough (H33)
  relevantArtifactTypes: [
    'site_plan',
    'cut_sheet',
    'fire_stopping',
    'noc',
    'manufacturer_data',
    'notarized_addendum',
    'property_ownership_search',
    'fire_review_application',
    'hvhz_anchoring',
  ],

  // -------------------------------------------------------------------------
  // SECTION PREDICATES — conditional relevance refinements
  // -------------------------------------------------------------------------
  sectionPredicates: {
    // NEC 220.87 narrative ONLY applies to existing-service path (same logic
    // as Orlando — claims existing capacity per the 220.87 analysis).
    nec22087Narrative: (ctx) => ctx.scope === 'existing-service',

    // Available fault current calc ONLY applies to new-service path.
    availableFaultCurrent: (ctx) => ctx.scope === 'new-service',

    // Grounding plan — required for new-service; optional on existing.
    grounding: (ctx) => ctx.scope === 'new-service',

    // Multi-family scope sections only apply to multi_family building type.
    meterStack: (ctx) => ctx.buildingType === 'multi_family',
    multiFamilyEV: (ctx) => ctx.buildingType === 'multi_family',
  },

  // -------------------------------------------------------------------------
  // ARTIFACT-TYPE PREDICATES — conditional upload-slot relevance
  // -------------------------------------------------------------------------
  artifactTypePredicates: {
    // NOC required for jobs > $5,000 per FL Statute 713 (same as Orlando).
    // Defaults ON for non-SFR; user can toggle off for sub-$5k SFR work.
    noc: (ctx) => ctx.buildingType !== 'single_family_residential',

    // HVHZ anchoring statewide for outdoor pedestal/bollard EVSE (H19).
    // Davie is in Broward (HVHZ zone) so this is firmly on.
    hvhz_anchoring: () => true,
  },

  // -------------------------------------------------------------------------
  // REQUIREMENTS — Davie line items (Sprint 2C M1 engine consumes these)
  // -------------------------------------------------------------------------
  requirements: [
    // -----------------------------------------------------------------------
    // Application-level intake (all building types)
    // -----------------------------------------------------------------------
    {
      id: 'davie-building-permit-application',
      name: 'Building Permit Application',
      category: 'application',
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'site_plan'),
      // No locator — application is the intake form itself, not a packet sheet
    },
    {
      id: 'davie-notarized-addendum',
      name: 'Signed and notarized addendum form (contractor + owner)',
      category: 'application',
      // H25 — Davie-specific, applies to every project regardless of building type
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'notarized_addendum'),
      locator: (packet) =>
        packet.sheetIds?.find((s) => s.includes('NOTARIZED')) ?? null,
    },
    {
      id: 'davie-noc-5k',
      name: 'Notice of Commencement (jobs > $5,000)',
      category: 'application',
      // FL Statute 713. Predicate mirrors Orlando: surfaces for non-SFR by
      // default (most commercial / multi-family clears the $5k bar).
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },
    {
      id: 'davie-property-ownership-search',
      name: 'BCPA.NET property search / ownership printout',
      category: 'application',
      // H26 — Broward County Property Appraiser ownership search.
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'property_ownership_search'),
    },

    // -----------------------------------------------------------------------
    // Plan submittal (all building types)
    // -----------------------------------------------------------------------
    {
      id: 'davie-electrical-floor-plan',
      name: 'Electrical floor plan with EV charger + panel location, conduit and wire size',
      category: 'plan',
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'site_plan'),
    },
    {
      id: 'davie-riser-and-load-calc',
      name: 'Riser diagram and load calculations (service + EV panel)',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys?.includes('riserDiagram') ?? false) &&
        (packet.sectionKeys?.includes('loadCalculation') ?? false),
      locator: (packet) =>
        packet.sheetIds?.find((s) => /^E-2/.test(s)) ?? null,
    },
    {
      id: 'davie-manufacturer-submittals',
      name: 'Manufacturer submittals for EV charger',
      category: 'plan',
      required: () => true,
      detect: (packet, attachments) =>
        (packet.sectionKeys?.includes('equipmentSpecs') ?? false) ||
        attachments.some(
          (a) =>
            a.artifactType === 'cut_sheet' ||
            a.artifactType === 'manufacturer_data',
        ),
    },

    // -----------------------------------------------------------------------
    // Inspection / review stops (process — surfaced for contractor awareness)
    // -----------------------------------------------------------------------
    {
      id: 'davie-fire-review',
      name: 'Fire review stop (Davie Fire Marshal)',
      category: 'inspection',
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'fire_review_application'),
    },
    {
      id: 'davie-planning-zoning-review',
      name: 'Planning & Zoning review stop',
      category: 'inspection',
      // Review stop, not a separate application. Always relevant; M1 surfaces
      // it for awareness even without an upload slot.
      required: () => true,
      detect: () => true, // process-level — always "satisfied" by submitting
    },

    // -----------------------------------------------------------------------
    // Narrative / plan-set
    // -----------------------------------------------------------------------
    {
      id: 'davie-firestop-schedule',
      name: 'Fire-stopping schedule for rated penetrations',
      category: 'narrative',
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'fire_stopping'),
    },
    {
      id: 'davie-hvhz-anchoring',
      name: 'HVHZ wind-anchoring documentation for outdoor EVSE (Broward HVHZ)',
      category: 'narrative',
      // Statewide H19 — applies to any outdoor pedestal/bollard EVSE. Davie
      // is in Broward (HVHZ), so the documentation requirement is firm.
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'hvhz_anchoring'),
    },

    // -----------------------------------------------------------------------
    // COMMERCIAL-ONLY (H27 / H28 / H29) — predicated on buildingType
    // -----------------------------------------------------------------------
    {
      id: 'davie-knox-box-emergency-shutoff',
      name: 'Knox Box Remote Power Box (model KLS-4505) for emergency shut-off + switchboard signage + NEC 625.42 locking-means',
      category: 'plan',
      // H27 — Davie commercial-only. Combines:
      //   1. Knox Box (KLS-4505) callout on plans
      //   2. Signage on switchboard: "main breaker = emergency disconnect"
      //   3. Breaker locking-means per NEC 625.42 (Davie quotes this directly)
      required: (ctx) => ctx.buildingType === 'commercial',
      // Engine detects via the EVEMS narrative section being present (Sprint
      // 2A H10 covers NEC 625.42 narrative) — the explicit Knox/signage
      // callouts ride on the commercial-conditional notes block.
      detect: (packet) => packet.sectionKeys?.includes('evemsNarrative') ?? false,
    },
    {
      id: 'davie-bollard-protection',
      name: 'Bollard protection for outdoor electrical transformer / equipment',
      category: 'plan',
      // H28 — Davie commercial-only. SparkPlan has no first-class "outdoor
      // equipment exposure" data point yet, so the M1 engine surfaces this
      // as a `manual_verification_required` requirement on the checklist
      // page. detect() returns false until the contractor explicitly adds a
      // bollard schedule / site-plan annotation; falls through to "Action
      // required" on the checklist render.
      required: (ctx) => ctx.buildingType === 'commercial',
      detect: () => false,
    },
    {
      id: 'davie-master-manual-shutdown-shunt',
      name: 'Master manual shutdown shunt for multi-dispenser sites + location on site plan',
      category: 'plan',
      // H29 — Davie commercial-only. Like H28, no first-class data point
      // (would need a "dispenser count" field on the project model). detect()
      // returns false by default → surfaces as "Action required" until the
      // contractor confirms via site-plan annotation. Future enhancement: read
      // EVSE count and only require when >= 2 dispensers.
      required: (ctx) => ctx.buildingType === 'commercial',
      detect: () => false,
    },
  ],
};
