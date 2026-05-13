/**
 * Sprint 2C M1 — City of Pompano Beach manifest.
 *
 * Captures the Pompano Beach AHJ's "Vehicle Charging Station Checklist"
 * (sourced 2026-05-12; official PDF dated 01/29/2024; **High** confidence
 * per `docs/ahj-source-checklists/pompano-beach.md`).
 *
 * Pompano is unusual in the FL pilot AHJ set — it exercises a **3-permit-
 * form intake** on top of the standard plan-set:
 *
 *   1. Broward County Uniform Permit Application — "Building Checked"
 *      (filed by a licensed General contractor).
 *   2. Broward County Uniform Permit Application — "Electric Checked"
 *      (filed by a licensed Electrical contractor).
 *   3. Zoning Compliance Permit Application (Pompano-specific; H21).
 *   4. Fire Review Application — **excludes single-family residences** (H22).
 *
 * Pompano is in Broward County, NOT in the HVHZ proper, but it still
 * requires HVHZ-style anchoring documentation (FL Product Approval / MD-NOA
 * tie-down / signed-and-sealed plans) for any mounted EVSE — see Sprint 2C
 * H19 (cross-validated against Miami-Dade; the documentation requirement
 * applies statewide to any outdoor pedestal/bollard EVSE).
 *
 * Other distinctives:
 * - HOA / condo approval letter is **explicitly required** when the install
 *   sits inside an HOA or condo (Sprint 2B H6).
 * - Multi-trade inspections: Building (footings + tie-downs + final
 *   structural), Zoning final, Electrical (rough + final), Fire final
 *   (multi-family / commercial). Surface as inspections-category items
 *   so the contractor knows to expect them.
 *
 * Pompano cites NEC 2020 uniformly via Broward County's adoption of the
 * FBC 8th edition (2023). No H34-style residential-vs-commercial NEC
 * edition fork (that's a Miami-Dade artifact).
 *
 * @module data/ahj/pompano
 */

import type { AHJManifest } from './types';

/**
 * Pompano-specific general notes. Includes statewide statutory language
 * (NEC 2020, FBC 8th ed) plus Broward / Pompano-specific intake reminders
 * (3-permit-form, HOA letter, anchoring documentation path).
 */
const POMPANO_GENERAL_NOTES: string[] = [
  'All electrical work shall comply with NFPA-70 (2020 NEC) and the Florida Building Code 8th edition (2023), as adopted by the City of Pompano Beach and Broward County.',
  'Voltage drop shall not exceed 3% on feeders, 3% on branch circuits, and 5% combined feeder + branch (NEC 215.2(A)(1) FPN; NEC 210.19(A)(1) FPN).',
  'All grounding and bonding shall comply with NEC Article 250. Grounding electrode conductor sized per NEC Table 250.66; equipment grounding conductor sized per NEC Table 250.122.',
  'Contractor name and Florida DBPR license number shall appear on each drawing sheet (Sprint 2A C8).',
  'Anchoring of all mounted EVSE shall be documented via a Florida Product Approval, a Miami-Dade Notice of Acceptance (NOA) tie-down detail, OR original signed-and-sealed plans by a Florida-licensed Architect or Engineer per Pompano Beach Vehicle Charging Station Checklist item #6.',
  'Permit intake requires TWO Broward County Uniform Permit Applications (Building-Checked + Electric-Checked) plus a Zoning Compliance Permit Application. Multi-family and commercial installs additionally require a Fire Review Application.',
  'Notice of Commencement (Florida Statute 713) is required when the contract price exceeds $5,000.00 per Pompano Beach Vehicle Charging Station Checklist.',
  'Inspections will be scheduled across multiple trades: Building (footings, tie-downs, final structural), Zoning final, Electrical (rough + final), and Fire final (when applicable).',
];

/**
 * Pompano-specific applicable codes list shown on the cover sheet's
 * "APPLICABLE CODES" section (Sprint 2A H4).
 */
const POMPANO_CODE_REFERENCES: string[] = [
  'NFPA-70 (2020 NEC)',
  'Florida Building Code, 8th edition (2023)',
  'Florida Statute 713 (Notice of Commencement)',
  'Broward County Uniform Permit Application standards',
  'City of Pompano Beach Code of Ordinances (Building & Zoning)',
];

/**
 * City of Pompano Beach permit-packet manifest. Single jurisdiction (no
 * subjurisdiction split — Broward County's role here is paperwork
 * standardization, not a separate AHJ). `subjurisdiction` intentionally
 * left `undefined`.
 */
export const pompanoManifest: AHJManifest = {
  id: 'pompano',
  name: 'City of Pompano Beach',
  jurisdictionType: 'city',
  subjurisdiction: undefined,

  // Pompano uniformly cites NEC 2020 across all building types. No H34-style
  // residential/commercial fork (that's Miami-Dade).
  necEdition: {
    single_family_residential: 'NEC 2020',
    multi_family: 'NEC 2020',
    commercial: 'NEC 2020',
  },
  fbcEdition: 'FBC 8th ed (2023)',

  // Pompano follows the standard 'E-' discipline letter for electrical sheets.
  // Source PDF does not prescribe an alternate prefix.
  sheetIdPrefix: 'E-',

  generalNotes: POMPANO_GENERAL_NOTES,
  codeReferences: POMPANO_CODE_REFERENCES,

  // -------------------------------------------------------------------------
  // RELEVANT SECTIONS — Pompano wants the full Sprint 2A engineering stack
  // -------------------------------------------------------------------------
  // Pompano's intake explicitly requires riser, electrical plan, load
  // calculations, and manufacturer / installation specs. Voltage drop is a
  // best-practice on top. Cover is hard-required and not in PacketSections.
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
    'riserDiagram',          // Pompano #7 riser diagram
    'equipmentSchedule',
    'equipmentSpecs',        // Pompano #8 installation manual & manufacturer specs
    'grounding',             // new-service path only — predicated below
    // Panels
    'panelSchedules',
    // Compliance & AHJ (band 500)
    'complianceSummary',
    'jurisdiction',
    // Specialty (band 600) — auto-enabled when EVEMS / EV detected
    'evemsNarrative',
    'evseLabeling',
    // Multi-family — predicated to multi_family below
    'meterStack',
    'multiFamilyEV',
  ],

  // -------------------------------------------------------------------------
  // RELEVANT ARTIFACT TYPES — Pompano intake requirements
  // -------------------------------------------------------------------------
  // Per the Pompano Vehicle Charging Station Checklist:
  //   #5  hoa_letter — required for condo/HOA installs (Sprint 2B H6)
  //   #6  hvhz_anchoring — FL Product Approval / MD-NOA / signed-sealed plans
  //   #8  cut_sheet + manufacturer_data — installation manual + specs
  //   #9  site_plan / survey — location of EV charger
  //   NOC — required for contracts > $5,000 (FL Statute 713)
  //   zoning_application — Pompano-specific (H21)
  //   fire_review_application — multi-family / commercial (H22)
  //
  // Predicates below refine HOA, fire-review, and survey/site_plan further.
  relevantArtifactTypes: [
    'site_plan',
    'survey',
    'cut_sheet',
    'manufacturer_data',
    'noc',
    'hoa_letter',
    'hvhz_anchoring',
    'zoning_application',
    'fire_review_application',
  ],

  // -------------------------------------------------------------------------
  // SECTION PREDICATES — conditional relevance refinements
  // -------------------------------------------------------------------------
  sectionPredicates: {
    // NEC 220.87 narrative applies only to existing-service path (same fork
    // as Orlando — feeding EV off an existing service requires demonstrating
    // spare capacity per NEC 220.87).
    nec22087Narrative: (ctx) => ctx.scope === 'existing-service',

    // Available fault current calc applies only to new-service path —
    // existing services don't recompute service-main fault current.
    availableFaultCurrent: (ctx) => ctx.scope === 'new-service',

    // Grounding plan required on new-service path; on existing-service the
    // grounding system is already in place.
    grounding: (ctx) => ctx.scope === 'new-service',

    // Multi-family sections gate to multi_family building type. The UI
    // layer additionally auto-disables when meterStacks data is absent.
    meterStack: (ctx) => ctx.buildingType === 'multi_family',
    multiFamilyEV: (ctx) => ctx.buildingType === 'multi_family',
  },

  // -------------------------------------------------------------------------
  // ARTIFACT-TYPE PREDICATES — conditional upload-slot relevance
  // -------------------------------------------------------------------------
  artifactTypePredicates: {
    // Fire Review Application explicitly EXCLUDES single-family residences
    // per Pompano checklist item #4. Multi-family and commercial both
    // require it (Sprint 2C H22).
    fire_review_application: (ctx) =>
      ctx.buildingType !== 'single_family_residential',

    // HOA letter is "if-applicable" on Pompano's checklist (#5 — "If the
    // device will be installed at a condominium, or within a homeowner's
    // association"). Most SFR projects fall outside HOAs; default the slot
    // ON for multi_family + commercial (where condo associations are the
    // norm) and let SFR users toggle it on for HOA-managed neighborhoods.
    hoa_letter: (ctx) => ctx.buildingType !== 'single_family_residential',

    // HVHZ-style anchoring documentation required for ANY mounted EVSE
    // per Pompano #6. Default ON regardless of context; the user can toggle
    // off if the install is purely indoor wall-mount with no separate
    // anchoring detail required (rare).
    hvhz_anchoring: () => true,

    // Zoning Compliance Permit Application required on every Pompano
    // intake regardless of building type (Sprint 2C H21).
    zoning_application: () => true,

    // NOC required for jobs > $5,000 (FL Statute 713). We can't read
    // estimated_value_usd from AHJContext yet, so we default ON for non-SFR
    // (where contract price > $5k is virtually guaranteed). SFR users can
    // toggle on for jobs that cross the threshold.
    noc: (ctx) => ctx.buildingType !== 'single_family_residential',
  },

  // -------------------------------------------------------------------------
  // REQUIREMENTS — Sprint 2C M1 conformance checklist
  // -------------------------------------------------------------------------
  // Each requirement maps to a Pompano Vehicle Charging Station Checklist
  // line item (or to an inspection / NEC compliance gate inferred from the
  // checklist). The engine evaluates `required(ctx)` first; if true, it
  // evaluates `detect(packet, attachments)` to check whether the artifact
  // is present in the packet.
  requirements: [
    // -- Permit-application paperwork (category: 'application') ----------
    {
      id: 'pompano-broward-uniform-app-building',
      name: 'Broward County Uniform Permit Application — Building Checked (General contractor)',
      category: 'application',
      // Required on every Pompano intake.
      required: () => true,
      // No dedicated artifact_type for the Building-Checked Broward form
      // (Sprint 2C H24 — packaging-only finding). The contractor uploads it
      // via the NOC slot bundle or attaches alongside; for M1 we detect
      // presence via the NOC artifact as a proxy until the dedicated slot
      // lands.
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },
    {
      id: 'pompano-broward-uniform-app-electric',
      name: 'Broward County Uniform Permit Application — Electric Checked (Electrical contractor)',
      category: 'application',
      required: () => true,
      // Same proxy detection as the Building-Checked form pending dedicated
      // application slot (H24).
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },
    {
      id: 'pompano-zoning-application',
      name: 'Zoning Compliance Permit Application',
      category: 'application',
      // Required on every Pompano intake (Sprint 2C H21).
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'zoning_application'),
    },
    {
      id: 'pompano-fire-review-application',
      name: 'Fire Review Application (multi-family / commercial only)',
      category: 'application',
      // Pompano checklist #4 — "Excludes Single Family Residences"
      // (Sprint 2C H22).
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'fire_review_application'),
    },
    {
      id: 'pompano-noc',
      name: 'Notice of Commencement (contracts > $5,000, per FL Statute 713)',
      category: 'application',
      // Pompano checklist explicit NOC clause. AHJContext doesn't yet model
      // estimated_value_usd; defensible default is "required for non-SFR"
      // (where contract price > $5k is the norm). Mirrors the Orlando NOC
      // predicate.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },

    // -- Conditional HOA / condo paperwork --------------------------------
    {
      id: 'pompano-hoa-letter',
      name: 'HOA / Condominium Association approval letter (if applicable)',
      category: 'application',
      // Pompano #5 — "If the device will be installed at a condominium, or
      // within a homeowner's association". Default ON for non-SFR; SFR
      // users in HOA neighborhoods can toggle on via Layer 2 override.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'hoa_letter'),
    },

    // -- Plan-set requirements (category: 'plan') -------------------------
    {
      id: 'pompano-site-plan',
      name: 'Site plan or survey showing EVSE location',
      category: 'plan',
      // Pompano #9 — required on every intake.
      required: () => true,
      // Either site_plan OR survey satisfies — Pompano #9 says "Submit a
      // survey or site plan".
      detect: (_packet, attachments) =>
        attachments.some(
          (a) =>
            a.artifactType === 'site_plan' || a.artifactType === 'survey',
        ),
      locator: (packet) => {
        // Site plans land in the civil band (200) per Sprint 2B merge engine
        // (artifact_type → 'C-' discipline). Surface the first matching
        // sheet ID if present.
        const ids = packet.sheetIds ?? [];
        return ids.find((id) => id.startsWith('C-')) ?? null;
      },
    },
    {
      id: 'pompano-riser-diagram',
      name: 'Riser diagram (one-line) with AIC labels per node',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('riserDiagram'),
    },
    {
      id: 'pompano-electrical-plan',
      name: 'Electrical plan (panel schedules + equipment schedule)',
      category: 'plan',
      required: () => true,
      // Engine considers the electrical plan satisfied when both
      // panelSchedules AND equipmentSchedule sections are present.
      detect: (packet) => {
        const sections = packet.sectionKeys ?? [];
        return (
          sections.includes('panelSchedules') &&
          sections.includes('equipmentSchedule')
        );
      },
    },
    {
      id: 'pompano-load-calculation',
      name: 'Load calculations for the EVSE',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('loadCalculation'),
    },
    {
      id: 'pompano-anchoring-detail',
      name: 'Anchoring detail (FL Product Approval / MD-NOA tie-down / signed-sealed plans)',
      category: 'plan',
      // Pompano #6 — required for any mounted EVSE (default ON statewide
      // per Sprint 2C H19 cross-validation).
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'hvhz_anchoring'),
    },

    // -- Manufacturer documentation (category: 'upload') ------------------
    {
      id: 'pompano-installation-manual',
      name: 'Installation manual and manufacturer specifications',
      category: 'upload',
      // Pompano #8 — required on every intake.
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
      id: 'pompano-code-basis-block',
      name: 'Cover-sheet code basis block (NEC 2020 + FBC 8th ed + Pompano)',
      category: 'narrative',
      required: () => true,
      // Cover sheet is always present; we treat this as satisfied whenever
      // the packet has any sheet IDs (cover is sheet 1).
      detect: (packet) => (packet.sheetIds?.length ?? 0) > 0,
    },
    {
      id: 'pompano-contractor-license-block',
      name: 'Contractor name and Florida DBPR license number on each sheet',
      category: 'narrative',
      required: () => true,
      // Satisfied implicitly by Sprint 2A C8 (title-block stamping); the
      // engine treats presence of any sheet IDs as the contractor block
      // being applied. A future revision could parse the actual title
      // block content.
      detect: (packet) => (packet.sheetIds?.length ?? 0) > 0,
    },
    {
      id: 'pompano-pe-seal',
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
    // These don't affect packet content — they surface on the M1 checklist
    // page so the contractor knows what multi-trade inspections to expect.
    {
      id: 'pompano-inspection-bldg-footings',
      name: 'Building inspection: Footings',
      category: 'inspection',
      // Building footings inspection is required for ground-mounted
      // pedestals — virtually all outdoor EVSE installs. Default ON for all
      // building types; SFR wall-mount installs can toggle off via Layer 2.
      required: () => true,
      // Inspections aren't artifacts in the packet — engine reports as
      // "informational" rather than missing. Detect: false marks them as
      // pending until a future inspection-tracking feature lands.
      detect: () => false,
    },
    {
      id: 'pompano-inspection-bldg-tie-downs',
      name: 'Building inspection: Tie-downs',
      category: 'inspection',
      required: () => true,
      detect: () => false,
    },
    {
      id: 'pompano-inspection-bldg-final-structural',
      name: 'Building inspection: Final structural',
      category: 'inspection',
      required: () => true,
      detect: () => false,
    },
    {
      id: 'pompano-inspection-zoning-final',
      name: 'Zoning inspection: Zoning final',
      category: 'inspection',
      required: () => true,
      detect: () => false,
    },
    {
      id: 'pompano-inspection-electrical-rough',
      name: 'Electrical inspection: Rough',
      category: 'inspection',
      required: () => true,
      detect: () => false,
    },
    {
      id: 'pompano-inspection-electrical-final',
      name: 'Electrical inspection: Final',
      category: 'inspection',
      required: () => true,
      detect: () => false,
    },
    {
      id: 'pompano-inspection-fire-final',
      name: 'Fire inspection: Final (multi-family / commercial only)',
      category: 'inspection',
      // Same gating as Fire Review Application — Pompano checklist's
      // inspection list scopes Fire final to non-SFR (parens-qualified
      // "If applicable").
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: () => false,
    },
  ],
};
