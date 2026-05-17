/**
 * Sprint 2C follow-up — Orange County (Unincorporated) manifest.
 *
 * Closes the obvious Orlando-metro gap: City of Orlando already has a
 * manifest (`data/ahj/orlando.ts`), but Orange County itself maintains its
 * own AHJ for the *unincorporated* portion of the county (Pine Hills,
 * Doctor Phillips, Orlovista, Winter Garden suburbs, etc. — roughly 330k
 * residents of Orange County's 1.5M total).
 *
 * Sources (2026-05-16 research pass; see
 * `docs/ahj-source-checklists/orange-county.md` for full cross-walk):
 *  - Division of Building Safety landing: http://ocfl.net/building
 *  - Electrical Permit page:
 *    https://www.orangecountyfl.net/PermitsLicenses/Permits/ElectricalPermit.aspx
 *  - Electrical Permit Application (form 23-30 rev. 11/07; pdftotext extract):
 *    http://apps.ocfl.net/reference/forms-files/faxPDFs/103_Electrical_Permit_Application_23-30_1107.pdf
 *  - Permitting & Construction Forms hub:
 *    https://www.orangecountyfl.net/permitslicenses/permittingandconstructionforms.aspx
 *  - OC FastTrack online submittal portal: https://fasttrack.ocfl.net/
 *  - Chapter 9, Article III (Electrical Code) — Code of Ordinances via
 *    Municode; Section 9-86(a) cited verbatim on the Electrical Permit page.
 *  - Statewide code basis: FBC 8th ed (2023), effective 2023-12-31; NEC 2020
 *    adopted via FBC reference.
 *  - Wind context (NOT HVHZ — Central FL inland; design wind 130–140 mph
 *    3-sec gust Risk Cat II per ASCE 7-22) — used only to *exclude* the
 *    HVHZ-anchoring default, not to add a separate wind-anchoring slot.
 *
 * Key distinctives vs. neighbouring AHJs:
 *
 * 1. `subjurisdiction: 'unincorporated'` — mirrors `miami-dade.ts`. Orange
 *    County Division of Building Safety handles only unincorporated areas.
 *    City of Orlando, Winter Park, Apopka, Maitland, Ocoee, Winter Garden,
 *    and other municipalities run independent AHJs (Orlando manifest is
 *    already shipped; others are future work).
 *
 * 2. **NOC threshold = $2,500 (not $5,000)** — Orange County's Electrical
 *    Permit page is explicit: *"If value of work exceeds $2,500, a Notice
 *    of Commencement is required."* This is a meaningful divergence from
 *    Pompano / Miami-Dade / Orlando (all $5,000 per FL Statute 713.13 default).
 *    Most EV-charger jobs cross $2,500 easily, so NOC defaults ON for
 *    every Orange County project regardless of building type — unlike
 *    Orlando / Miami-Dade where the predicate gates non-SFR only.
 *
 * 3. **NOT HVHZ** — Central Florida sits well outside the HVHZ proper
 *    (175 mph 3-sec gust). Design wind speed is 130–140 mph (3-sec gust)
 *    Risk Cat II per ASCE 7-22. FL Product Approval still applies
 *    statewide for mounted equipment, but the H19 cross-validated
 *    "HVHZ-style anchoring documentation" default is dialled back here —
 *    we surface `hvhz_anchoring` as an *available* upload slot but do NOT
 *    force-default it ON (predicate gates to commercial / multi-family
 *    outdoor pedestal installs only). Contrast with Miami-Dade (default
 *    ON everywhere) and Pompano (default ON everywhere despite being
 *    outside HVHZ proper, because Broward's checklist explicitly requires
 *    the documentation regardless).
 *
 * 4. **Uniform NEC 2020 across building types** — no H34-style residential/
 *    commercial fork (that's a Miami-Dade artifact). Orange County adopts
 *    the NEC via the FBC reference and applies it uniformly.
 *
 * Research gaps (non-blocking; see source doc):
 *  - Orange County does NOT publish a dedicated EV charging station permit
 *    checklist PDF (unlike Orlando, Pompano, Davie). Requirements below
 *    cross-walk from the general Electrical Permit Application + the
 *    Solar Submittal Checklist pattern + Section 9-86 + statewide FBC/NEC
 *    baseline. ~10 min phone call to (407) 836-5550 could confirm whether
 *    plan review treats EV installs as standard branch-circuit additions
 *    or as a separate category.
 *  - Sheet-ID prefix convention is not explicitly prescribed on the OC
 *    Electrical Permit application; we default to `E-` matching Orlando
 *    (Central FL industry convention; OC has no `EL-`-style mandate).
 *
 * @module data/ahj/orange-county
 */

import type { AHJManifest } from './types';

// ============================================================================
// NARRATIVE CONTENT
// ============================================================================

/**
 * Orange County-specific general notes. Superset of Sprint 2A H12/H13 with
 * OC-specific NOC threshold ($2,500), FastTrack submittal callout, and
 * Section 9-86 electrical-permit-trigger reference.
 */
const ORANGE_COUNTY_GENERAL_NOTES: string[] = [
  'All electrical work shall comply with NFPA-70 (2020 NEC) and the Florida Building Code 8th edition (2023), as adopted by Orange County via Chapter 9 of the Code of Ordinances and enforced by the Orange County Division of Building Safety.',
  'An electrical permit is required for any electrical construction, installation, extension, or change to existing wiring per Orange County Code of Ordinances Section 9-86(a). Permits are submitted through the OC FastTrack online portal.',
  'Notice of Commencement (Florida Statute 713) is required when the value of work exceeds $2,500.00 per the Orange County Electrical Permit application — note this threshold is LOWER than the $5,000 default cited by most Florida AHJs.',
  'Voltage drop shall not exceed 3% on feeders, 3% on branch circuits, and 5% combined feeder + branch (NEC 215.2(A)(1) FPN; NEC 210.19(A)(1) FPN).',
  'All grounding and bonding shall comply with NEC Article 250. Grounding electrode conductor sized per NEC Table 250.66; equipment grounding conductor sized per NEC Table 250.122.',
  'Contractor name and Florida DBPR license number, plus Orange County Qualifying Business (QB) license number and the Master Electrician active certificate-holder name, shall appear on each drawing sheet and on the electrical permit application (form 23-30).',
  'EVSE equipment shall bear UL-2202 and UL-2594 listings; manufacturer cut sheets attached.',
  'Mounted equipment shall comply with Florida Product Approval requirements per the Florida Building Code. Orange County is NOT within the High-Velocity Hurricane Zone — design wind speed is approximately 130–140 mph (3-sec gust, Risk Cat II) per ASCE 7-22 / FBC 8th ed (2023).',
];

/**
 * Orange County applicable codes list shown on the cover sheet's
 * "APPLICABLE CODES" section.
 */
const ORANGE_COUNTY_CODE_REFERENCES: string[] = [
  'NFPA-70 (2020 NEC)',
  'Florida Building Code, 8th edition (2023)',
  'Florida Statute 713 (Notice of Commencement)',
  'Orange County Code of Ordinances, Chapter 9 (Buildings & Construction Regulations)',
  'Orange County Code of Ordinances, Chapter 9, Article III (Electrical Code)',
  'NFPA-70E (2024) — Standard for Electrical Safety in the Workplace',
];

// ============================================================================
// MANIFEST
// ============================================================================

/**
 * Orange County (Unincorporated) permit-packet manifest.
 *
 * Covers the EV-charging-station electrical scope under the Orange County
 * Division of Building Safety for the unincorporated portion of the county
 * (~330k residents). City of Orlando, Winter Park, Apopka, Ocoee, Maitland,
 * Winter Garden, and other municipalities are independent AHJs (Orlando is
 * already shipped via `data/ahj/orlando.ts`; others are future work).
 *
 * Requirement count: 15 (regression-locked in tests).
 */
export const orangeCountyManifest: AHJManifest = {
  id: 'orange-county',
  name: 'Orange County (Unincorporated)',
  jurisdictionType: 'county',
  subjurisdiction: 'unincorporated',

  // Uniform NEC 2020 across building types. No H34-style residential/
  // commercial fork (that's Miami-Dade).
  necEdition: {
    single_family_residential: 'NEC 2020',
    multi_family: 'NEC 2020',
    commercial: 'NEC 2020',
  },
  fbcEdition: 'FBC 8th ed (2023)',

  // Sheet-ID prefix not prescribed by OC; default to `E-` matching Orlando
  // and Central FL industry convention. (Research gap: no OC mandate either
  // way; safe default.)
  sheetIdPrefix: 'E-',

  generalNotes: ORANGE_COUNTY_GENERAL_NOTES,
  codeReferences: ORANGE_COUNTY_CODE_REFERENCES,

  // -------------------------------------------------------------------------
  // RELEVANT SECTIONS — Orange County wants the full Sprint 2A engineering stack
  // -------------------------------------------------------------------------
  // OC does not publish a dedicated EV checklist; we infer the relevant
  // section set from (a) the general Electrical Permit Application + (b)
  // statewide FBC/NEC baseline + (c) mirroring Orlando's neighbor-jurisdiction
  // shape. Cover is hard-required and not in PacketSections.
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
    // Multi-family — included by manifest, gated by predicates below
    'meterStack',
    'multiFamilyEV',
  ],

  // -------------------------------------------------------------------------
  // RELEVANT ARTIFACT TYPES — Orange County intake (per cross-walk)
  // -------------------------------------------------------------------------
  // OC's Electrical Permit application is short on attachment requirements
  // (single set of signed-and-sealed construction documents via FastTrack
  // when associated with a Building Permit). Defensible defaults:
  //   site_plan — required for new circuits / EVSE location
  //   cut_sheet — manufacturer specs (statewide NEC 110.2-3)
  //   noc — required >$2,500 (LOWER than $5k default — covers most jobs)
  //   manufacturer_data — supplemental
  //   hvhz_anchoring — available as an upload slot, but NOT default ON
  //     for SFR (Central FL is non-HVHZ; predicate gates to commercial /
  //     multi-family outdoor installs only)
  //
  // NOT relevant for OC (default OFF, user can still toggle on):
  //   hoa_letter — Pompano-specific (H6) — OC doesn't mandate at AHJ level
  //   survey — separate from site plan; not OC intake
  //   zoning_application — Pompano-specific (H21)
  //   fire_review_application — Pompano + Davie commercial (H22)
  //   fire_stopping — Orlando/MD line item; not surfaced on OC Electrical
  //     Permit form (NEC 300.21 still applies on the plans, just not as a
  //     separate upload slot)
  //   notarized_addendum — Davie (H25)
  //   property_ownership_search — Davie BCPA.NET (H26)
  //   flood_elevation_certificate — Hillsborough flood zones (H30)
  //   private_provider_documentation — Hillsborough alt path (H33)
  relevantArtifactTypes: [
    'site_plan',
    'cut_sheet',
    'noc',
    'manufacturer_data',
    'hvhz_anchoring',
  ],

  // -------------------------------------------------------------------------
  // SECTION PREDICATES — conditional relevance refinements
  // -------------------------------------------------------------------------
  sectionPredicates: {
    // NEC 220.87 narrative ONLY applies to existing-service path. Same fork
    // as Orlando / Pompano / Miami-Dade — claim of existing capacity requires
    // the 220.87 method.
    nec22087Narrative: (ctx) => ctx.scope === 'existing-service',

    // Available fault current calc ONLY applies to new-service path —
    // existing services don't recompute service-main fault current. (Same
    // gating as Orlando; differs from Miami-Dade which mandates AFC on
    // both paths via the Commercial PRG.)
    availableFaultCurrent: (ctx) => ctx.scope === 'new-service',

    // Grounding plan required on new-service path; on existing-service the
    // grounding system is already in place. (Same as Orlando.)
    grounding: (ctx) => ctx.scope === 'new-service',

    // Multi-family sections gate to multi_family building type. UI layer
    // also auto-disables when meterStacks data is absent.
    meterStack: (ctx) => ctx.buildingType === 'multi_family',
    multiFamilyEV: (ctx) => ctx.buildingType === 'multi_family',
  },

  // -------------------------------------------------------------------------
  // ARTIFACT-TYPE PREDICATES — conditional upload-slot relevance
  // -------------------------------------------------------------------------
  artifactTypePredicates: {
    // NOC required for jobs > $2,500 per OC Electrical Permit application
    // (LOWER threshold than the $5k FL Statute 713.13 default cited by other
    // AHJs). Most EV-charger jobs cross $2,500 easily, so we default ON for
    // ALL building types — unlike Orlando/Miami-Dade which only gate non-SFR.
    // Users with sub-$2,500 work (rare for EVSE) can toggle off via Layer 2.
    noc: () => true,

    // HVHZ-style anchoring documentation — OC is NOT in the HVHZ, but FL
    // Product Approval still applies statewide for mounted equipment per
    // FBC. Surface the upload slot only when the install is plausibly an
    // outdoor pedestal (commercial / multi-family — SFR EV installs are
    // overwhelmingly wall-mount in attached garages, not pedestal).
    // Contrast: Pompano + Miami-Dade default ON everywhere.
    hvhz_anchoring: (ctx) =>
      ctx.buildingType !== 'single_family_residential',
  },

  // -------------------------------------------------------------------------
  // REQUIREMENTS — line-by-line OC checklist (Sprint 2C M1 engine consumes)
  // -------------------------------------------------------------------------
  // 15 requirements. Lower count than Pompano/Miami-Dade (22 each) because
  // OC does not publish a dedicated EV checklist with explicit per-trade
  // inspection enumeration (Pompano enumerates 7 inspections; OC's online
  // FastTrack portal handles scheduling generically). Predicates gate on:
  //   - scope (NEC 220.87 narrative existing-service only; AFC + grounding
  //     new-service only)
  //   - lane (PE seal)
  //   - buildingType (HVHZ anchoring slot only on non-SFR; HOA/fire-review
  //     not surfaced)
  requirements: [
    // -- Permit-application paperwork (category: 'application') ----------
    {
      id: 'orange-county-electrical-permit-application',
      name: 'Orange County Electrical Permit Application (form 23-30) submitted via OC FastTrack',
      category: 'application',
      // Required on every OC electrical scope per Section 9-86(a).
      required: () => true,
      // User-uploaded application; M1 engine wires this to project_attachments
      // once a dedicated slot lands. Defaults to false so the engine surfaces
      // it as outstanding until then.
      detect: () => false,
    },
    {
      id: 'orange-county-noc',
      name: 'Notice of Commencement (jobs > $2,500 — Orange County threshold; LOWER than statewide $5k default)',
      category: 'application',
      // OC threshold is $2,500 (per the Electrical Permit page) vs $5,000
      // statewide default. Virtually every EV install crosses $2,500, so
      // required on all building types unlike other AHJs.
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },

    // -- Plan-set requirements (category: 'plan') -------------------------
    {
      id: 'orange-county-sheet-id-prefix',
      name: 'Plan sheets identified with discipline prefix "E-" + drawing number (Central FL convention)',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sheetIds ?? []).some((id) => id.startsWith('E-')),
    },
    {
      id: 'orange-county-cover-toc',
      name: 'Cover sheet + Table of Contents referencing every E-x sheet',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('tableOfContents'),
    },
    {
      id: 'orange-county-riser-diagram',
      name: 'Riser diagram (one-line) with AIC labels per node',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('riserDiagram'),
    },
    {
      id: 'orange-county-load-calculation',
      name: 'Load calculations for the EVSE (NEC 220 + 625)',
      category: 'plan',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('loadCalculation'),
    },
    {
      id: 'orange-county-electrical-plan',
      name: 'Electrical plan (panel schedules + equipment schedule)',
      category: 'plan',
      required: () => true,
      detect: (packet) => {
        const sections = packet.sectionKeys ?? [];
        return (
          sections.includes('panelSchedules') &&
          sections.includes('equipmentSchedule')
        );
      },
    },
    {
      id: 'orange-county-grounding',
      name: 'Grounding electrode system + GEC sizing (NEC 250 Article III, 250.66)',
      category: 'plan',
      // OC defers to NEC; grounding plan is required on new-service path
      // (gating matches the section predicate above).
      required: (ctx) => ctx.scope === 'new-service',
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('grounding'),
    },
    {
      id: 'orange-county-available-fault-current',
      name: 'Available fault current calculation at service main (NEC 110.9, 110.10)',
      category: 'plan',
      // Required on new-service path only (matches Orlando gating; differs
      // from Miami-Dade which mandates on both paths).
      required: (ctx) => ctx.scope === 'new-service',
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('availableFaultCurrent'),
    },
    {
      id: 'orange-county-site-plan',
      name: 'Site plan showing EV charger + panel locations',
      category: 'upload',
      // OC FastTrack accepts a single set of signed-and-sealed construction
      // documents; site plan included for new circuits / EVSE location.
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'site_plan'),
      locator: (packet) => {
        const ids = packet.sheetIds ?? [];
        return ids.find((id) => id.startsWith('C-')) ?? null;
      },
    },
    {
      id: 'orange-county-pe-seal',
      name: 'Plans digitally signed and sealed by FL-licensed PE (when contractor-exemption lane does not apply)',
      category: 'plan',
      // OC's FastTrack instructs "one set of electronically signed and
      // sealed construction documents" — PE seal required when the
      // lane is `pe_required` (Sprint 2A H17 contractor-exemption screening).
      required: (ctx) => ctx.lane === 'pe_required',
      detect: () => false, // Sprint 3 PE-seal workflow; never auto-present today
    },

    // -- Narrative / code-basis (category: 'narrative') -------------------
    {
      id: 'orange-county-code-basis-block',
      name: 'Cover-sheet code basis block (NEC 2020 + FBC 8th ed (2023) + OC Ordinance Chapter 9)',
      category: 'narrative',
      required: () => true,
      detect: (packet) =>
        (packet.sectionKeys ?? []).includes('generalNotes'),
    },
    {
      id: 'orange-county-contractor-license-block',
      name: 'Contractor name + FL DBPR license number + Orange County QB license + Master Electrician name on each sheet',
      category: 'narrative',
      // OC permit application explicitly requires the Qualifying Business
      // (QB) license number AND the Master Electrician active certificate-
      // holder name — slightly more than the statewide DBPR-only baseline.
      required: () => true,
      // Satisfied implicitly by Sprint 2A C8 (title-block stamping).
      detect: (packet) => (packet.sheetIds?.length ?? 0) > 0,
    },
    {
      id: 'orange-county-equipment-listing',
      name: 'Equipment approval, listing & installation instructions (NEC 110.2-3) — EVSE UL-2202 / UL-2594',
      category: 'narrative',
      required: () => true,
      detect: (packet, attachments) =>
        (packet.sectionKeys ?? []).includes('equipmentSpecs') ||
        attachments.some(
          (a) =>
            a.artifactType === 'cut_sheet' ||
            a.artifactType === 'manufacturer_data',
        ),
    },

    // -- Conditional anchoring (category: 'upload') -----------------------
    {
      id: 'orange-county-anchoring-detail',
      name: 'Anchoring detail (FL Product Approval) — outdoor pedestal / bollard EVSE only; Orange County is NOT in HVHZ',
      category: 'upload',
      // OC is outside the HVHZ; we surface this only for non-SFR outdoor
      // installs (commercial / multi-family pedestals/bollards). SFR EV
      // installs are overwhelmingly indoor wall-mount and don't need
      // separate anchoring documentation. (Contrast Pompano + Miami-Dade
      // where this defaults ON regardless of building type.)
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'hvhz_anchoring'),
    },
  ],
};
