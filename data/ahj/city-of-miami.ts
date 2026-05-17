/**
 * Sprint 2C M1 — City of Miami manifest.
 *
 * City of Miami is an **independent AHJ** inside Miami-Dade County. It is
 * NOT covered by the Miami-Dade County (Unincorporated — RER) manifest:
 * Miami-Dade RER reviews ONLY unincorporated areas; the 34 incorporated
 * municipalities (City of Miami, Miami Beach, Coral Gables, Hialeah, etc.)
 * each run their own building department under their own AHJ.
 *
 * Why this manifest exists separately from `miami-dade.ts`:
 * - City of Miami operates its own iBuild digital permit portal
 *   (https://www.miami.gov/Permits-Construction/Apply-for-or-Manage-Building-Permits-iBuild)
 *   and its own Building Permit Application form — NOT the MD County
 *   "yellow form" RER uses for unincorporated areas.
 * - City of Miami publishes its own fee schedule
 *   (https://www.miami.gov/Permits-Construction/Permitting-Resources/City-of-Miami-Building-Permit-Fee-Schedule)
 *   and its own Private Provider Program (FCC and similar).
 * - Plan review, zoning, fire, and public works are retained by the City
 *   (per FCC's published "scope" documentation:
 *   https://freedomcodecompliance.com/municipalities/city-of-miami-private-provider).
 *
 * Sources (2026-05-16 research pass; MEDIUM confidence — see
 * `docs/ahj-source-checklists/city-of-miami.md` for the audit cross-walk):
 * - City of Miami Permits & Construction:
 *   https://www.miami.gov/Permits-Construction
 * - City of Miami Permitting Forms & Documents:
 *   https://www.miami.gov/Permits-Construction/Permitting-Resources/Permitting-Forms-Documents
 * - City of Miami State of Florida Applicable Codes:
 *   https://www.miami.gov/My-Government/Departments/Building/Building-Services/State-of-Florida-Applicable-Codes
 * - City of Miami Private Provider Program:
 *   https://www.miami.gov/My-Government/Departments/Building/Private-Provider-Program
 * - City of Miami Building Permit Application (PDF):
 *   https://www.miami.gov/files/sharedassets/public/v/1/building/legacy-permitapplication-1.pdf
 * - Permit aggregator EV-permit summary (corroborating, lower weight):
 *   https://permitmint.com/permits/florida/miami/ev_charger/
 *
 * Three things City of Miami exercises that Orlando does not (and that this
 * manifest captures):
 *
 * 1. **HVHZ enforcement.** All of Miami-Dade County (including every
 *    incorporated municipality) lies inside the HVHZ per FBC 8th ed (2023)
 *    — 175 mph 3-sec gust, Risk Cat II. Outdoor pedestal/bollard EVSE
 *    must be anchored per FL Product Approval / MD-NOA tie-down / signed-
 *    and-sealed structural anchorage plans. Same statewide-in-MD scope
 *    that the County RER manifest enforces (H19 cross-validation).
 *
 * 2. **Notice of Commencement (FL Statute 713).** Required for jobs
 *    > $5,000. The City of Miami Permit Application form references this
 *    explicitly. Same defensible default Orlando + Pompano + MD use
 *    (default-ON for non-SFR; SFR users toggle on for jobs that cross
 *    the $5k threshold).
 *
 * 3. **Private Provider Program.** City of Miami participates in FL
 *    Statute 553.791 Private Provider review. When a project elects PP
 *    review, a Notice to Building Official (NTBO) + Certificate of
 *    Compliance (COC) must be on file. Captured as an artifact-slot
 *    upload (`private_provider_documentation`) — same artifact_type
 *    Hillsborough/Tampa already uses for its private-provider lane.
 *
 * NOT exercised (vs other FL pilot manifests):
 * - No NEC-edition fork by building type (Miami-Dade RER's H34 split is a
 *   PRG-document artifact specific to the RER; City of Miami publishes no
 *   such per-building-type PRG, so uniformly cites NEC 2020 per FBC 8th
 *   ed Electrical adoption).
 * - No `EL-` sheet ID prefix mandate (Miami-Dade RER's H20 EL- convention
 *   is an MD-PRG-specific artifact; City of Miami's published forms do not
 *   prescribe an alternate prefix, so default to the FL-standard `E-`).
 * - No multi-form intake (Pompano's 3-form Broward-Uniform + Zoning +
 *   Fire intake is Broward-specific; City of Miami uses a single Building
 *   Permit Application with the electrical category checked, plus the
 *   sub-permit electrical permit).
 *
 * `subjurisdiction` is intentionally left `undefined` — City of Miami does
 * not fork on a sub-area axis; the city itself is the unit of AHJ scope.
 *
 * Requirement count: 17 (regression-locked in tests).
 *
 * @module data/ahj/city-of-miami
 */

import type { AHJManifest } from './types';

// ============================================================================
// NARRATIVE CONTENT
// ============================================================================

/**
 * City-of-Miami-specific general notes. Superset of Sprint 2A H12/H13 with
 * Miami HVHZ wind-anchoring callout, FL Statute 713 NOC threshold, and a
 * pointer to the City's iBuild digital permit portal.
 */
const CITY_OF_MIAMI_GENERAL_NOTES: string[] = [
  'All electrical work shall comply with NFPA-70 (2020 NEC) and the Florida Building Code, 8th edition (2023), as adopted by the City of Miami Building Department.',
  'The City of Miami lies entirely within the High-Velocity Hurricane Zone (HVHZ) per FBC 8th ed (2023). Outdoor pedestal- or bollard-mounted EVSE shall be anchored per Florida Product Approval, Miami-Dade Notice of Acceptance (NOA) tie-down detail, or original signed-and-sealed structural anchorage plans rated for 175 mph (3-sec gust) Risk Category II minimum.',
  'Voltage drop shall not exceed 3% on feeders, 3% on branch circuits, and 5% combined feeder + branch (NEC 215.2(A)(1) FPN; NEC 210.19(A)(1) FPN).',
  'All grounding and bonding shall comply with NEC Article 250. Grounding electrode conductor sized per NEC Table 250.66; equipment grounding conductor sized per NEC Table 250.122.',
  'Available fault current shall be calculated and labeled at the service main per NEC 110.9 and 110.10 when new service is installed.',
  'Working space, dedicated equipment space, and clearance shall comply with NEC 110.26 (commercial / multi-family scope).',
  'EVSE equipment shall bear UL-2202 / UL-2594 listings; manufacturer cut sheets shall be attached. Outdoor EVSE shall be rated for wet locations per NEC 210.8, 210.63, and 625.50.',
  'Contractor name and Florida DBPR license number shall appear on each drawing sheet. Plans subject to PE seal triggers (commercial / multi-family / ≥277-480V scope) shall be signed and sealed by a Florida-licensed Professional Engineer.',
  'Permit applications are submitted through the City of Miami iBuild digital permit portal. Notice of Commencement (Florida Statute 713) is required when the contract price exceeds $5,000.00.',
  'Plan review may be performed by the City of Miami Building Department or, at the applicant\'s election, by a private provider per Florida Statute 553.791 (Notice to Building Official + Certificate of Compliance required).',
];

/**
 * City-of-Miami applicable codes list shown on the cover sheet's
 * "APPLICABLE CODES" section. Single NEC edition (2020) — no Miami-Dade
 * RER-style residential-vs-commercial fork (the City of Miami publishes no
 * per-building-type Plan Review Guidelines).
 */
const CITY_OF_MIAMI_CODE_REFERENCES: string[] = [
  'NFPA-70 (2020 NEC)',
  'Florida Building Code, 8th edition (2023) — including HVHZ provisions',
  'Florida Statute 713 (Notice of Commencement)',
  'Florida Statute 553.791 (Private Provider Program)',
  'City of Miami Code of Ordinances (Building & Zoning)',
  'Miami-Dade County Product Control (NOA) standards — referenced for HVHZ anchorage',
];

// ============================================================================
// MANIFEST
// ============================================================================

/**
 * City of Miami permit-packet manifest. Independent AHJ inside Miami-Dade
 * County — distinct from `miamiDadeManifest` (which covers ONLY
 * unincorporated County RER scope).
 *
 * Requirement count: 17 (regression-locked in tests).
 */
export const cityOfMiamiManifest: AHJManifest = {
  id: 'city-of-miami',
  name: 'City of Miami',
  jurisdictionType: 'city',
  subjurisdiction: undefined,

  // City of Miami publishes no per-building-type PRG, so cites NEC 2020
  // uniformly per FBC 8th ed (2023) Electrical adoption. (Unlike MD County
  // RER, which carries a NEC 2014 SFR / NEC 2020 commercial split.)
  necEdition: {
    single_family_residential: 'NEC 2020',
    multi_family: 'NEC 2020',
    commercial: 'NEC 2020',
  },
  fbcEdition: 'FBC 8th ed (2023)',

  // No alternate prefix prescribed in City of Miami published forms;
  // default to the FL-standard `E-` discipline letter.
  sheetIdPrefix: 'E-',

  generalNotes: CITY_OF_MIAMI_GENERAL_NOTES,
  codeReferences: CITY_OF_MIAMI_CODE_REFERENCES,

  // -------------------------------------------------------------------------
  // RELEVANT SECTIONS — City of Miami wants the standard FL engineering stack
  // -------------------------------------------------------------------------
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
    // Multi-family — gated by buildingType predicate below
    'meterStack',
    'multiFamilyEV',
  ],

  // -------------------------------------------------------------------------
  // RELEVANT ARTIFACT TYPES — City of Miami intake
  // -------------------------------------------------------------------------
  // Core uploads:
  //   - site_plan: location of EV charger / panel / route
  //   - cut_sheet + manufacturer_data: UL listings (NEC 110.2-3)
  //   - noc: FL Statute 713 (>$5,000)
  //   - hvhz_anchoring: HVHZ-wide statewide-in-MD scope (outdoor EVSE)
  //   - hoa_letter: condo/HOA installs (statewide pattern; predicate below)
  //   - private_provider_documentation: when PP review elected (FS 553.791)
  //
  // NOT relevant (default OFF; user can toggle on via Layer 2 if needed):
  //   - survey (City of Miami uses site_plan; survey is Pompano-specific)
  //   - fire_stopping (commercial-only Miami-Dade RER pattern; City of
  //     Miami does not list as a standalone intake item)
  //   - zoning_application (Pompano H21 — Broward-specific)
  //   - fire_review_application (Pompano H22 / Davie H22 — not a City of
  //     Miami intake item per published forms)
  //   - notarized_addendum (Davie H25)
  //   - property_ownership_search (Davie H26 — BCPA.NET, Broward only)
  //   - flood_elevation_certificate (Hillsborough H30)
  relevantArtifactTypes: [
    'site_plan',
    'cut_sheet',
    'manufacturer_data',
    'noc',
    'hvhz_anchoring',
    'hoa_letter',
    'private_provider_documentation',
  ],

  // -------------------------------------------------------------------------
  // SECTION PREDICATES — conditional relevance refinements
  // -------------------------------------------------------------------------
  sectionPredicates: {
    // NEC 220.87 narrative ONLY applies to existing-service path. Same logic
    // as Orlando + MD County RER — claim of existing service capacity
    // requires the 220.87 method.
    nec22087Narrative: (ctx) => ctx.scope === 'existing-service',

    // Available fault current applies only to new-service path (same fork
    // as Orlando + Pompano). MD County RER differs here — it requires AFC
    // on BOTH paths — but City of Miami follows the standard pattern; no
    // published guidance forces AFC on existing-service jobs.
    availableFaultCurrent: (ctx) => ctx.scope === 'new-service',

    // Grounding plan required on new-service path; on existing-service the
    // grounding system is already in place.
    grounding: (ctx) => ctx.scope === 'new-service',

    // Multi-family scope sections only apply to multi_family building type.
    // The UI layer also auto-disables when underlying data is absent.
    meterStack: (ctx) => ctx.buildingType === 'multi_family',
    multiFamilyEV: (ctx) => ctx.buildingType === 'multi_family',
  },

  // -------------------------------------------------------------------------
  // ARTIFACT-TYPE PREDICATES — conditional upload-slot relevance
  // -------------------------------------------------------------------------
  artifactTypePredicates: {
    // HVHZ anchoring — ALL of Miami-Dade County (including City of Miami)
    // is inside the HVHZ. Required for outdoor pedestal/bollard EVSE.
    // Default ON regardless of context; user toggles off for indoor-only
    // wall-mount installs (Layer 2).
    hvhz_anchoring: () => true,

    // NOC required for jobs > $5,000 per FL Statute 713. Defensible default
    // matches Orlando + Pompano + MD: non-SFR projects default ON; SFR
    // users toggle on for jobs that cross the threshold.
    noc: (ctx) => ctx.buildingType !== 'single_family_residential',

    // HOA / condo approval letter — statewide pattern. Most SFR projects
    // fall outside HOAs; default ON for non-SFR (where condo associations
    // are the norm in downtown Miami / Brickell), SFR users toggle on for
    // HOA-managed neighborhoods.
    hoa_letter: (ctx) => ctx.buildingType !== 'single_family_residential',

    // Private Provider documentation — optional uploads-slot. Default ON
    // so the slot is visible in the City of Miami workflow; user toggles
    // off when the project does not elect Private Provider review.
    private_provider_documentation: () => true,
  },

  // -------------------------------------------------------------------------
  // REQUIREMENTS — City of Miami conformance checklist (Sprint 2C M1 engine)
  // -------------------------------------------------------------------------
  // 17 requirements drawn from the City of Miami Building Permit Application
  // + Permitting Forms & Documents + Private Provider Program references.
  // City of Miami does NOT publish a dedicated EV-charging-station checklist
  // (gap noted in docs/ahj-source-checklists/city-of-miami.md), so this list
  // is the conservative intersection of City forms + statewide HVHZ scope.
  requirements: [
    // -- Permit-application paperwork (category: 'application') ----------
    {
      id: 'city-of-miami-building-permit-app',
      name: 'City of Miami Building Permit Application (electrical category) — submitted via iBuild',
      category: 'application',
      // Required on every intake.
      required: () => true,
      // No dedicated artifact_type for the City of Miami permit application
      // form (filed directly through iBuild). Detect proxy via NOC presence
      // until a dedicated application slot lands.
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },
    {
      id: 'city-of-miami-noc',
      name: 'Notice of Commencement (contracts > $5,000, per FL Statute 713)',
      category: 'application',
      // Defensible default — non-SFR projects almost always exceed $5k.
      // Mirrors Orlando + Pompano + MD predicates.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },
    {
      id: 'city-of-miami-hoa-letter',
      name: 'HOA / Condominium Association approval letter (if applicable)',
      category: 'application',
      // Statewide pattern; default ON for non-SFR (Brickell/condo norm).
      // SFR HOA-managed homes toggle on via Layer 2.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'hoa_letter'),
    },
    {
      id: 'city-of-miami-private-provider-ntbo',
      name: 'Private Provider Notice to Building Official (NTBO) — FL Statute 553.791 (if PP review elected)',
      category: 'application',
      // Optional intake item — only applies when applicant elects Private
      // Provider review. M1 engine reports as informational when missing;
      // never strictly "required" by AHJContext alone.
      required: () => false,
      detect: (_packet, attachments) =>
        attachments.some(
          (a) => a.artifactType === 'private_provider_documentation',
        ),
    },

    // -- Plan-set requirements (category: 'plan') -------------------------
    {
      id: 'city-of-miami-site-plan',
      name: 'Site plan showing EVSE + panel locations and feeder routing',
      category: 'plan',
      // Required on every intake — City of Miami permit forms require a
      // site plan for any new electrical work involving exterior equipment.
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'site_plan'),
      locator: (packet) => {
        // Site plans land in the civil band per Sprint 2B merge engine
        // (artifact_type → 'C-' discipline). Surface the first matching
        // sheet ID if present.
        const ids = packet.sheetIds ?? [];
        return ids.find((id) => id.startsWith('C-')) ?? null;
      },
    },
    {
      id: 'city-of-miami-riser-diagram',
      name: 'Riser diagram (one-line) with AIC labels per node',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('riserDiagram'),
    },
    {
      id: 'city-of-miami-electrical-plan',
      name: 'Electrical plan (panel schedules + equipment schedule)',
      category: 'plan',
      required: () => true,
      // Considered satisfied when both panel + equipment schedule sections
      // are present (mirrors the Pompano electrical-plan detection).
      detect: (packet) => {
        const sections = packet.sectionKeys ?? [];
        return (
          sections.includes('panelSchedules') &&
          sections.includes('equipmentSchedule')
        );
      },
    },
    {
      id: 'city-of-miami-load-calculation',
      name: 'Load calculations for the EVSE',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('loadCalculation'),
    },
    {
      id: 'city-of-miami-hvhz-anchoring',
      name: 'HVHZ wind-anchoring documentation for outdoor pedestal/bollard EVSE (FBC 8th ed HVHZ; FL Product Approval / MD-NOA / signed-and-sealed structural)',
      category: 'plan',
      // ALL of Miami-Dade (including City of Miami) is HVHZ. Required for
      // any outdoor EVSE install. Default-ON; user toggles off via Layer 2
      // for indoor-only wall-mount projects.
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'hvhz_anchoring'),
    },
    {
      id: 'city-of-miami-available-fault-current',
      name: 'Available fault current calculation at service main (NEC 110.9, 110.10) — when new service installed',
      category: 'plan',
      // City of Miami follows the Orlando/Pompano pattern: AFC required on
      // new-service path. MD County RER differs (requires on both paths).
      required: (ctx) => ctx.scope === 'new-service',
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('availableFaultCurrent'),
    },
    {
      id: 'city-of-miami-grounding-electrode',
      name: 'Grounding electrode system + GEC sizing (NEC 250 Article III, 250.66, 250.24(B)) — when new service installed',
      category: 'plan',
      required: (ctx) => ctx.scope === 'new-service',
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('grounding'),
    },

    // -- Manufacturer documentation (category: 'upload') ------------------
    {
      id: 'city-of-miami-installation-manual',
      name: 'Installation manual and manufacturer specifications (UL-2202 / UL-2594 listings)',
      category: 'upload',
      // Required on every intake per NEC 110.2-3 + the published Miami EV
      // installation guidance.
      required: () => true,
      // Satisfied by either cut_sheet OR manufacturer_data upload, OR by
      // the SparkPlan-generated equipmentSpecs section.
      detect: (packet, attachments) => {
        const hasUpload = attachments.some(
          (a) =>
            a.artifactType === 'cut_sheet' ||
            a.artifactType === 'manufacturer_data',
        );
        const hasSection = (packet.sectionKeys ?? []).includes(
          'equipmentSpecs',
        );
        return hasUpload || hasSection;
      },
    },

    // -- Narrative / code-basis (category: 'narrative') -------------------
    {
      id: 'city-of-miami-code-basis-block',
      name: 'Cover-sheet code basis block (NEC 2020 + FBC 8th ed + City of Miami)',
      category: 'narrative',
      required: () => true,
      // Cover sheet is always present; treated as satisfied whenever the
      // packet has any sheet IDs (cover is sheet 1).
      detect: (packet) => (packet.sheetIds?.length ?? 0) > 0,
    },
    {
      id: 'city-of-miami-contractor-license-block',
      name: 'Contractor name and Florida DBPR license number on each sheet',
      category: 'narrative',
      required: () => true,
      // Satisfied implicitly by Sprint 2A C8 (title-block stamping); engine
      // treats presence of any sheet IDs as the contractor block being
      // applied.
      detect: (packet) => (packet.sheetIds?.length ?? 0) > 0,
    },
    {
      id: 'city-of-miami-pe-seal',
      name: 'PE seal on plan-set (required when contractor-exemption lane does not apply)',
      category: 'narrative',
      // Lane-gated: only required when AHJContext.lane === 'pe_required'
      // (Sprint 2A H17 contractor-exemption screening).
      required: (ctx) => ctx.lane === 'pe_required',
      // Currently no AST flag for PE-seal presence; default detect to false
      // so the engine surfaces it as missing. Sprint 2C M1 engine can
      // upgrade detection once the seal-stamping flow lands.
      detect: () => false,
    },

    // -- Inspections (category: 'inspection') ----------------------------
    // City of Miami runs electrical rough + final inspections at minimum.
    // Surface as inspection-category items so the contractor knows what to
    // expect post-permit-issuance.
    {
      id: 'city-of-miami-inspection-electrical-rough',
      name: 'Electrical inspection: Rough-in',
      category: 'inspection',
      required: () => true,
      // Inspections aren't artifacts in the packet — engine reports as
      // "informational" rather than missing.
      detect: () => false,
    },
    {
      id: 'city-of-miami-inspection-electrical-final',
      name: 'Electrical inspection: Final',
      category: 'inspection',
      required: () => true,
      detect: () => false,
    },
  ],
};
