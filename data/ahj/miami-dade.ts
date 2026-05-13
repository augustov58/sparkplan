/**
 * Sprint 2C M1 — Miami-Dade County (Unincorporated — RER) manifest.
 *
 * Sources (2026-05-12 research pass, High confidence):
 *  - Commercial Electrical Plan Review Guidelines:
 *    https://www.miamidade.gov/permits/library/guidelines/electrical-commercial.pdf
 *    (cites NEC 2020, FBC 8th ed 2023)
 *  - Residential Electrical Plan Review Guidelines:
 *    https://www.miamidade.gov/permits/library/guidelines/electrical-residential.pdf
 *    (cites NEC 2014, FBC 8th ed 2023)
 *  - Electrical Permits hub:
 *    https://www.miamidade.gov/global/economy/building/permits/electrical.page
 *  - HVHZ scope: all 34 incorporated municipalities + unincorporated areas
 *    sit inside the HVHZ per FBC 8th ed 2023 (175 mph 3-sec gust, Risk Cat II).
 *  - Audit cross-walk: docs/ahj-source-checklists/miami-dade.md
 *
 * Three axes exercised that Orlando doesn't:
 *
 * 1. `subjurisdiction: 'unincorporated'` — Miami-Dade County RER handles
 *    ONLY unincorporated areas. The 34 munis (City of Miami, Miami Beach,
 *    Coral Gables, Hialeah, etc.) are independent AHJs (future manifests).
 *    Stamped here explicitly (vs Orlando's `undefined`) so the renderer's
 *    code-basis block reads "unincorporated Miami-Dade County" rather than
 *    a bare "Miami-Dade County" that would mislead muni-jurisdiction users.
 *
 * 2. `necEdition: Record<BuildingType, string>` (H34 finding) — Miami-Dade's
 *    Residential PRG cites NEC 2014 while the Commercial PRG cites NEC 2020.
 *    Unusual cross-edition split inside a single county; encoded directly
 *    in this map so the code-basis block on a SFR packet says "NEC 2014"
 *    and the same field on a commercial packet says "NEC 2020". This is
 *    the single architectural reason `necEdition` was upgraded from a
 *    scalar to a `Record<BuildingType, string>` in PR-4.
 *    *Research gap (not blocking)*: 5-min phone-call to MD RER 786-315-2000
 *    would confirm whether the NEC 2014 cite on the residential PRG is
 *    intentional or a stale-form artifact. We encode what the published
 *    PRG says; correct downstream if MD updates the PRG.
 *
 * 3. `sheetIdPrefix: 'EL-'` (H20 finding) — Miami-Dade's Commercial PRG is
 *    explicit: "Identify electrical plans with the letter 'E' & Drawing
 *    number." Industry convention in MD-HVHZ jurisdictions has settled on
 *    the `EL-` discipline prefix (vs Orlando's `E-`) for clearer
 *    distinguishability against `EX-` / `EN-` (energy) sheets on the same
 *    plan-set. Encoded explicitly here so the band-counter renderer in
 *    `services/pdfExport/packetSections.ts` emits `EL-001`, `EL-100`, etc.
 *    *Research gap (not blocking)*: a Miami-Dade plans examiner phone call
 *    would confirm whether the PRG's literal-`E` instruction means bare-E
 *    is also accepted; using `EL-` is the safe superset.
 *
 * Requirements follow the line-by-line matrix in
 * `docs/ahj-source-checklists/miami-dade.md`. PE seal, transformer OCPD,
 * wet-location, and HVHZ anchoring are conditionally required via the
 * `required(ctx)` predicate. The M1 engine consumes these to render the
 * per-AHJ conformance checklist.
 *
 * @module data/ahj/miami-dade
 */

import type { AHJManifest } from './types';

// ============================================================================
// NARRATIVE CONTENT
// ============================================================================

/**
 * Miami-Dade-specific general notes. Superset of Sprint 2A H12/H13 with
 * MD-specific HVHZ wind-anchoring callout, dual-edition NEC reference, and
 * MD digital signing/sealing policy.
 */
const MIAMI_DADE_GENERAL_NOTES: string[] = [
  'All electrical work shall comply with the Florida Building Code, 8th edition (2023), as adopted by Miami-Dade County. Commercial scope work shall additionally comply with NFPA-70 (2020 NEC); single-family residential scope work shall additionally comply with NFPA-70 (2014 NEC) per the published Miami-Dade Residential Electrical Plan Review Guidelines.',
  'All of Miami-Dade County lies within the High-Velocity Hurricane Zone (HVHZ) per FBC 8th ed (2023). Outdoor pedestal- or bollard-mounted EVSE shall be anchored per Florida Product Approval, Miami-Dade Notice of Acceptance (NOA) tie-down detail, or original signed-and-sealed structural anchorage plans rated for 175 mph (3-sec gust) Risk Category II minimum.',
  'Voltage drop shall not exceed 3% on feeders, 3% on branch circuits, and 5% combined feeder + branch (NEC 215.2(A)(1) FPN; NEC 210.19(A)(1) FPN).',
  'All grounding and bonding shall comply with NEC Article 250. Grounding electrode conductor sized per NEC Table 250.66; equipment grounding conductor sized per NEC Table 250.122.',
  'Available fault current shall be calculated and labeled at the service main per NEC 110.9 and 110.10 (Miami-Dade Commercial PRG item: "Available fault current").',
  'Working space, dedicated equipment space, and clearance shall comply with NEC 110.26 (commercial scope only; not enforced as a separate line item on single-family residential per the Miami-Dade Residential PRG).',
  'Contractor name and Florida DBPR license number shall appear on each drawing sheet. Plans subject to PE seal trigger (commercial / multi-family / ≥277-480V scope) shall be digitally signed and sealed per Miami-Dade Digital Signing & Sealing policy.',
  'EVSE equipment shall bear UL-2202 and UL-2594 listings; manufacturer cut sheets attached. Outdoor EVSE shall be rated for wet locations per NEC 210.8, 210.63, and 625.50.',
  'Electrical plan sheets are identified with the discipline prefix "EL-" followed by the drawing number, per Miami-Dade Commercial Plan Review Guidelines convention.',
];

/**
 * Miami-Dade applicable codes list shown on the cover sheet's
 * "APPLICABLE CODES" section. Dual NEC cite reflects the H34 PRG split.
 */
const MIAMI_DADE_CODE_REFERENCES: string[] = [
  'NFPA-70 (2020 NEC) — Miami-Dade Commercial Electrical Plan Review Guidelines',
  'NFPA-70 (2014 NEC) — Miami-Dade Residential Electrical Plan Review Guidelines',
  'Florida Building Code, 8th edition (2023) — HVHZ provisions',
  'Miami-Dade County Code, Chapter 8 (Building Code)',
  'Miami-Dade Digital Signing & Sealing policy',
  'NFPA-70E (2024) — Standard for Electrical Safety in the Workplace',
];

// ============================================================================
// MANIFEST
// ============================================================================

/**
 * Miami-Dade County (Unincorporated — RER) permit-packet manifest.
 *
 * Covers the EV-charging-station electrical scope under Miami-Dade County
 * Regulatory & Economic Resources (RER) for unincorporated areas only.
 * The 34 incorporated municipalities (City of Miami, Miami Beach, Coral
 * Gables, Hialeah, etc.) are independent AHJs and get their own manifests
 * in future work.
 *
 * Requirement count: 22 (regression-locked in tests).
 */
export const miamiDadeManifest: AHJManifest = {
  id: 'miami-dade',
  name: 'Miami-Dade County (Unincorporated — RER)',
  jurisdictionType: 'county',
  subjurisdiction: 'unincorporated',

  // H34: Residential PRG cites NEC 2014; Commercial PRG cites NEC 2020.
  // Multi-family follows the commercial review track per the MD PRG routing
  // (commercial / multi-family share the Commercial PRG).
  necEdition: {
    single_family_residential: 'NEC 2014',
    multi_family: 'NEC 2020',
    commercial: 'NEC 2020',
  },
  fbcEdition: 'FBC 8th ed (2023)',

  // H20: Miami-Dade convention is the `EL-` discipline prefix (vs Orlando's
  // `E-`). The band-counter renderer reads this and emits `EL-001`, `EL-100`,
  // etc. The Sprint 2C M1 engine agent owns plumbing this through the band
  // counter — this manifest only declares the prefix.
  sheetIdPrefix: 'EL-',

  generalNotes: MIAMI_DADE_GENERAL_NOTES,
  codeReferences: MIAMI_DADE_CODE_REFERENCES,

  // -------------------------------------------------------------------------
  // RELEVANT SECTIONS — Miami-Dade wants the full electrical stack + HVHZ
  // -------------------------------------------------------------------------
  // Miami-Dade's Commercial PRG drives most of these. Residential PRG is a
  // shorter list (working space, transformer OCPD, wet-location callout,
  // emergency systems are commercial-only); those sections still appear in
  // relevantSections but are gated by building_type predicates below.
  relevantSections: [
    // Front matter (band 000)
    'tableOfContents',
    'generalNotes',
    'revisionLog',
    // Engineering (band 100)
    'loadCalculation',
    'nec22087Narrative',     // existing-service path only — predicated below
    'availableFaultCurrent', // explicit MD Commercial PRG line item (NEC 110.9/10)
    'voltageDrop',
    'shortCircuit',
    // Diagrams & equipment (band 200)
    'riserDiagram',
    'equipmentSchedule',
    'equipmentSpecs',
    'grounding',             // NEC 230.70 + 250 (always relevant)
    // Panels (band 300)
    'panelSchedules',
    // Compliance & AHJ (band 500)
    'complianceSummary',
    'jurisdiction',
    // Specialty (band 600)
    'evemsNarrative',
    'evseLabeling',
    // Multi-family — auto-gated by buildingType predicate below
    'meterStack',
    'multiFamilyEV',
  ],

  // -------------------------------------------------------------------------
  // RELEVANT ARTIFACT TYPES — Miami-Dade intake (per audit cross-walk)
  // -------------------------------------------------------------------------
  // Required across both PRGs:
  //   - site_plan (commercial / multi-family explicit; SFR for new circuits)
  //   - cut_sheet (NEC 110.2-3 equipment approval / UL listings)
  //   - fire_stopping (NEC 300.21 + FBC 712/714 penetrations)
  //   - noc (FL Statute 713.13 — required >$5k statewide)
  //   - manufacturer_data (supplemental; recommended)
  //   - hvhz_anchoring (H19 — ALL of MD is HVHZ; required for outdoor EVSE)
  // NOT relevant for Miami-Dade County RER (default OFF):
  //   - hoa_letter (HOA approval enforced at building level per FS 718.113(8),
  //     not at County RER electrical-review level — see audit doc Notes/gaps)
  //   - survey (separate from site plan; not MD intake)
  //   - zoning_application (Pompano H21, not MD)
  //   - fire_review_application (Pompano H22 + Davie commercial H22, not MD)
  //   - notarized_addendum (Davie H25)
  //   - property_ownership_search (Davie BCPA.NET H26)
  //   - flood_elevation_certificate (Hillsborough H30)
  //   - private_provider_documentation (Hillsborough H33)
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
  sectionPredicates: {
    // NEC 220.87 narrative ONLY applies to existing-service path. Same logic
    // as Orlando — claim of existing capacity requires the 220.87 method.
    nec22087Narrative: (ctx) => ctx.scope === 'existing-service',

    // Multi-family scope sections only apply to multi_family building type.
    // The UI layer also auto-disables when underlying data is absent.
    meterStack: (ctx) => ctx.buildingType === 'multi_family',
    multiFamilyEV: (ctx) => ctx.buildingType === 'multi_family',
  },

  // -------------------------------------------------------------------------
  // ARTIFACT-TYPE PREDICATES — conditional upload-slot relevance
  // -------------------------------------------------------------------------
  artifactTypePredicates: {
    // NOC required for jobs > $5,000 per FL Statute 713.13 (statewide). Same
    // defensible default as Orlando — non-SFR projects default ON; SFR user
    // can toggle off for sub-$5k work.
    noc: (ctx) => ctx.buildingType !== 'single_family_residential',

    // HVHZ anchoring — ALL of Miami-Dade is HVHZ (gap closure: research pass
    // 2026-05-12, all 34 munis + unincorporated). Required for outdoor
    // pedestal/bollard EVSE statewide; default ON for any MD project. User
    // toggles off for indoor wall-mount-only installs.
    hvhz_anchoring: () => true,
  },

  // -------------------------------------------------------------------------
  // REQUIREMENTS — line-by-line MD checklist (Sprint 2C M1 engine consumes)
  // -------------------------------------------------------------------------
  // 22 requirements covering both PRGs (Commercial + Residential) cross-walked
  // from docs/ahj-source-checklists/miami-dade.md. Predicates gate on:
  //   - lane (PE seal)
  //   - buildingType (working space, transformer OCPD, wet-location,
  //     emergency systems are commercial / multi-family only)
  //   - scope (NEC 220.87 narrative existing-service only; AFC always
  //     required at MD)
  requirements: [
    {
      id: 'md-yellow-form',
      name: 'Miami-Dade Building Permit Application (yellow form) — electrical category',
      category: 'application',
      required: () => true,
      detect: () => false, // user-uploaded application; M1 wires this to project_attachments later
    },
    {
      id: 'md-electrical-fee-sheet',
      name: 'Miami-Dade Electrical Fee Sheet',
      category: 'application',
      required: () => true,
      detect: () => false,
    },
    {
      id: 'md-sheet-id-prefix',
      name: 'Plan sheets identified with discipline prefix "EL-" + drawing number',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sheetIds ?? []).some((id) => id.startsWith('EL-')),
    },
    {
      id: 'md-cover-toc',
      name: 'Cover sheet + Table of Contents referencing every EL-x sheet',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('tableOfContents'),
    },
    {
      id: 'md-pe-seal',
      name: 'Plans digitally signed and sealed by FL-licensed PE',
      category: 'plan',
      // PE-required lane covers ≥277/480V scope, multi-family, and commercial
      // per the MD Commercial PRG / Digital Signing & Sealing policy.
      required: (ctx) => ctx.lane === 'pe_required',
      detect: () => false, // Sprint 3 PE-seal workflow; never auto-present in PR-4
    },
    {
      id: 'md-construction-documents',
      name: 'Construction documents narrative (FBC 107 (Bl)) — scope description',
      category: 'narrative',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('generalNotes'),
    },
    {
      id: 'md-equipment-listing',
      name: 'Equipment approval, listing & installation instructions (NEC 110.2-3) — EVSE UL listings',
      category: 'narrative',
      required: () => true,
      detect: (packet, attachments) =>
        (packet.sectionKeys ?? []).includes('equipmentSpecs') ||
        attachments.some((a) => a.artifactType === 'cut_sheet'),
    },
    {
      id: 'md-services-conductor-sizing',
      name: 'Number of services + conductor size/rating (NEC 230.2, 230.23/31)',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('riserDiagram') ||
        (packet.sectionKeys ?? []).includes('loadCalculation'),
    },
    {
      id: 'md-available-fault-current',
      name: 'Available fault current calculation at service main (NEC 110.9, 110.10)',
      category: 'plan',
      // Miami-Dade Commercial PRG explicitly lists this; required on both
      // service-modification paths (unlike Orlando which gates by scope).
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('availableFaultCurrent'),
    },
    {
      id: 'md-working-space',
      name: 'Working space and dedicated equipment clearance (NEC 110.26)',
      category: 'plan',
      // Commercial PRG only — Residential PRG does NOT carry this line item.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: () => false, // installer responsibility; not a packet artifact
    },
    {
      id: 'md-grounding-electrode',
      name: 'Grounding electrode system + GEC sizing (NEC 250 Article III, 250.66, 250.24(B))',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('grounding'),
    },
    {
      id: 'md-transformer-ocpd',
      name: 'Transformer overcurrent protection (NEC 450.3) — when xfmr in scope',
      category: 'plan',
      // Commercial / multi-family only — SFR typically lacks dedicated xfmrs.
      // The M1 engine refines further on actual transformer-presence detection
      // in a later commit; PR-4 manifest gates on building type.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('equipmentSchedule'),
    },
    {
      id: 'md-wet-location',
      name: 'Wet location / outdoor EVSE compliance (NEC 210.8, 210.63, 625.50)',
      category: 'narrative',
      // Commercial PRG explicit line item; Residential PRG covers indirectly
      // via NEC 210 but does not call it out as a standalone item.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('generalNotes'),
    },
    {
      id: 'md-noc',
      name: 'Notice of Commencement — required for jobs > $5,000 (FL Statute 713.13)',
      category: 'upload',
      // Defensible default: non-SFR projects almost always exceed $5k.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },
    {
      id: 'md-hvhz-anchoring',
      name: 'HVHZ wind-anchoring documentation for outdoor pedestal/bollard EVSE (FBC 8th ed HVHZ; FL Product Approval / MD NOA / signed-and-sealed structural)',
      category: 'upload',
      // ALL of MD County is HVHZ — required for any outdoor EVSE install.
      // Default-ON; user toggles off for indoor-only projects (Layer 2).
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'hvhz_anchoring'),
    },
    {
      id: 'md-site-plan',
      name: 'Site plan showing EV charger + panel locations',
      category: 'upload',
      // Required for commercial / multi-family; SFR requires it for new
      // service routing but not always for branch-circuit-only additions.
      // Defensible default: required for all non-SFR; SFR toggles off when
      // not adding service.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'site_plan'),
    },
    {
      id: 'md-contractor-signature',
      name: 'Per-sheet contractor name + FL DBPR license number on every drawing',
      category: 'plan',
      required: () => true,
      detect: () => true, // Sprint 2A C8 (always-on title-block field)
    },
    {
      id: 'md-code-basis-block',
      name: 'FBC 8th ed (2023) + NEC reference block on plans (lane-aware: NEC 2014 SFR / NEC 2020 commercial+MF)',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('generalNotes'),
    },
    {
      id: 'md-voltage-drop-note',
      name: 'Voltage drop note (≤3% feeder / ≤3% branch / ≤5% combined) — best practice',
      category: 'narrative',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('voltageDrop'),
    },
    {
      id: 'md-evems-narrative',
      name: 'EVEMS operational narrative (NEC 625.42) — when service-capacity-managed',
      category: 'narrative',
      // Always relevant when EVEMS is used; detect handles the conditional.
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('evemsNarrative'),
    },
    {
      id: 'md-evse-labeling',
      name: 'EVSE labeling per NEC 625.43',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('evseLabeling'),
    },
    {
      id: 'md-fire-stopping',
      name: 'Penetrations of fire-resistance-rated assemblies (NEC 300.21; FBC 712 / 714 (Bl))',
      category: 'upload',
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'fire_stopping'),
    },
  ],
};
