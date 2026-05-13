/**
 * Sprint 2C M1 — Hillsborough County / City of Tampa joint manifest.
 *
 * Sourced 2026-05-12 (`docs/ahj-source-checklists/hillsborough-tampa.md`,
 * Medium-High confidence — Fire Marshal Knox-box stance unresolved).
 *
 * Hillsborough / Tampa is the MOST PERMISSIVE of the five Sprint 2C AHJs:
 * single-family residential EVSE additions under contractor-exemption lane
 * can ride the **Residential Electric Trade Permit (no plan review)** lane
 * (H31). The manifest models this by gating most line items behind
 * `ctx => !(buildingType === 'single_family_residential' && lane ===
 * 'contractor_exemption')` — the negated SFR-contractor-exemption case
 * receives only a minimal "trade permit only" requirement set
 * (application + scope narrative + panel rating + breaker size; one-line
 * "if requested"). Commercial / multi-family ride the full Commercial
 * Electrical Permit Requirements list verbatim from `hcfl.gov`.
 *
 * Joint manifest scope decision: Hillsborough Co. (unincorporated) and
 * City of Tampa share NEC/FBC edition, sheet-ID prefix, and the bulk of
 * the commercial intake set. They differ on PORTAL (HillsGovHub vs Accela
 * Citizen Access — H32) and FIRE MARSHAL authority (Hillsborough Fire
 * Marshal vs Tampa Fire Rescue). We expose this via the optional
 * `subjurisdiction` axis (`'unincorporated_hillsborough'` |
 * `'city_of_tampa'`). The packet content is the same; only the cover-page
 * portal pointer differs. If Sprint 3 surfaces materially different
 * content per jurisdiction (e.g., a confirmed Knox-box ordinance for one
 * but not the other), this should be split into two manifests.
 *
 * Research gaps flagged for future passes (commit message also notes):
 *   - **H36 — HillsGovHub intake-category ambiguity (OPEN).** Picking
 *     `Residential Alterations` in HillsGovHub triggers a sealed-plan
 *     requirement (contradicts trade-permit-no-plan-review narrative).
 *     SparkPlan UI tooltip needs to prescribe `electric_trade_permit`
 *     intake category. Not a manifest blocker; the requirements list
 *     reflects the trade-permit lane.
 *   - **Knox-box stance — UNRESOLVED.** NFPA 1 § 18.2.2 is
 *     AHJ-discretionary. No `hcfl.gov` or `tampa.gov` page confirms a
 *     specific commercial-EVSE Knox-box trigger. Phone calls to
 *     Hillsborough Fire Marshal (813-744-5541) and Tampa Fire Rescue
 *     (813-274-7000) are the only resolution path. The commercial
 *     requirements list does NOT include Knox-box pending confirmation.
 *   - **H31 trade-permit artifact type.** Whether HillsGovHub / Accela
 *     accept a SparkPlan-generated "trade permit cover letter" as a
 *     valid intake artifact, or whether contractors must fill the portal
 *     form directly, is not officially documented. The minimal residential
 *     set assumes the portal-form path and surfaces only the artifacts
 *     SparkPlan owns (scope narrative + panel info via panel schedules).
 *
 * @module data/ahj/hillsborough-tampa
 */

import type { AHJManifest, AHJContext } from './types';

// ============================================================================
// PREDICATE HELPERS
// ============================================================================

/**
 * "Is this project on the residential-trade-permit-only lane?"
 *
 * Per H31: Hillsborough/Tampa SFR + contractor-exemption rides the
 * Residential Electric Trade Permit lane (no plan review). Commercial and
 * multi-family ALWAYS ride the full Commercial Electrical Permit
 * Requirements set, regardless of lane. SFR + pe_required is rare but
 * defensible — if a PE is on the project we assume the contractor wants
 * the full packet anyway (the PE seal is meaningful only attached to a
 * full plan set).
 */
const isResidentialTradePermitLane = (ctx: AHJContext): boolean =>
  ctx.buildingType === 'single_family_residential' &&
  ctx.lane === 'contractor_exemption';

/** Inverse of `isResidentialTradePermitLane` — "full plan-review lane?" */
const isFullPlanReviewLane = (ctx: AHJContext): boolean =>
  !isResidentialTradePermitLane(ctx);

// ============================================================================
// NARRATIVE CONTENT
// ============================================================================

/**
 * Hillsborough/Tampa general notes — verbatim references from the
 * Hillsborough Commercial Electrical Permit Requirements page +
 * Sprint 2A H12/H13/H14 phrasing. Residential trade-permit lane will
 * not render most of these (handled by section predicates), but the
 * notes themselves are AHJ-uniform.
 */
const HILLSBOROUGH_TAMPA_GENERAL_NOTES: string[] = [
  'All electrical work shall comply with NFPA-70 (2020 NEC) and the Florida Building Code 8th edition (2023), as adopted by Hillsborough County and the City of Tampa.',
  'Voltage drop shall not exceed 3% on feeders, 3% on branch circuits, and 5% combined feeder + branch (NEC 215.2(A)(1) FPN; NEC 210.19(A)(1) FPN).',
  'All grounding and bonding shall comply with NEC Article 250. Grounding electrode conductor sized per NEC Table 250.66; equipment grounding conductor sized per NEC Table 250.122.',
  'All service equipment, panelboards, and overcurrent devices shall be labeled with voltage, phase, amperage, and AIC rating per NEC 110.9 and 110.10.',
  'Building plans shall be digitally signed and sealed by a State of Florida Registered Architect or Engineer for commercial / multi-family scope, per Hillsborough Commercial Electrical Permit Requirements.',
  'Recorded certified copy of Notice of Commencement (Florida Statutes 713.13) required prior to the first inspection for any job > $5,000.',
  'EVSE equipment shall bear UL-2202 and UL-2594 listings; manufacturer cut sheets attached.',
  'Fire-rated penetrations shall use a UL-listed firestop assembly. Firestop schedule attached where applicable.',
  'For projects in a FEMA Special Flood Hazard Area, equipment elevation shall be demonstrated above the Design Flood Elevation per Florida Building Code.',
];

/**
 * Applicable codes shown on the cover sheet. NEC + FBC + FFPC are
 * statewide; the local code reference cites the County and City code
 * chapters directly. NOTE: Tampa's published "Codes In Use" page is
 * stale (H37) — we do NOT cite it; instead we cite the operative
 * statewide FFPC 8th ed.
 */
const HILLSBOROUGH_TAMPA_CODE_REFERENCES: string[] = [
  'NFPA-70 (2020 NEC)',
  'Florida Building Code, 8th edition (2023)',
  'Florida Fire Prevention Code, 8th edition (NFPA 1, 2021)',
  'Hillsborough County Code of Ordinances, Chapter 6 (Buildings and Building Regulations)',
  'City of Tampa Code of Ordinances, Chapter 5 (Building and Construction)',
  'NFPA-70E (2024) — Standard for Electrical Safety in the Workplace',
];

// ============================================================================
// MANIFEST
// ============================================================================

/**
 * Hillsborough County / City of Tampa joint permit-packet manifest.
 *
 * `subjurisdiction` on the manifest itself is `undefined` — both
 * Hillsborough Co. unincorporated and City of Tampa resolve to this
 * manifest. Per-project `AHJContext.subjurisdiction` distinguishes
 * `'unincorporated_hillsborough'` vs `'city_of_tampa'` at evaluation
 * time (currently used by predicates only informationally; packet
 * content is uniform).
 */
export const hillsboroughTampaManifest: AHJManifest = {
  id: 'hillsborough-tampa',
  name: 'Hillsborough County / City of Tampa',
  jurisdictionType: 'county',
  subjurisdiction: undefined,

  // Hillsborough / Tampa cite NEC 2020 uniformly across SFR / multi-family
  // / commercial (no Miami-Dade-style H34 fork). FBC 8th ed (2023) statewide.
  necEdition: {
    single_family_residential: 'NEC 2020',
    multi_family: 'NEC 2020',
    commercial: 'NEC 2020',
  },
  fbcEdition: 'FBC 8th ed (2023)',

  sheetIdPrefix: 'E-',

  generalNotes: HILLSBOROUGH_TAMPA_GENERAL_NOTES,
  codeReferences: HILLSBOROUGH_TAMPA_CODE_REFERENCES,

  // -------------------------------------------------------------------------
  // RELEVANT SECTIONS
  // -------------------------------------------------------------------------
  // Full Sprint 2A stack for commercial / multi-family / SFR+PE.
  // Residential trade-permit lane (SFR + contractor_exemption) gates most
  // of these OFF via sectionPredicates below.
  relevantSections: [
    // Front matter (band 000) — always on for any lane (TOC + general
    // notes serve the trade-permit scope narrative requirement too).
    'tableOfContents',
    'generalNotes',
    'revisionLog',
    // Engineering (band 100) — full-plan-review lane only
    'loadCalculation',
    'nec22087Narrative',
    'availableFaultCurrent',
    'voltageDrop',
    'shortCircuit',
    // Diagrams & equipment (band 200)
    'riserDiagram',
    'equipmentSchedule',
    'equipmentSpecs',
    'grounding',
    // Panels — Hillsborough commercial intake explicitly wants
    // "Details of panel board" + "Panel or switchboard schedule".
    'panelSchedules',
    // Compliance & AHJ (band 500)
    'complianceSummary',
    'jurisdiction',
    // Specialty (band 600)
    'evemsNarrative',
    'evseLabeling',
    // Multi-family — included by manifest, UI-layer disables when data absent
    'meterStack',
    'multiFamilyEV',
  ],

  // -------------------------------------------------------------------------
  // RELEVANT ARTIFACT TYPES
  // -------------------------------------------------------------------------
  // Per the line-by-line cross-walk:
  //   site_plan — required commercial; "implied" residential
  //   cut_sheet — EVSE manufacturer cut sheets (UL listings)
  //   fire_stopping — required when penetrations involved
  //   noc — FS 713.13 > $5k
  //   manufacturer_data — supplemental
  //   flood_elevation_certificate — Hillsborough commercial explicit DFE
  //     requirement (H30); conditional on flood zone
  //   private_provider_documentation — alt path under FS 553.791 (H33)
  //
  // NOT relevant for Hillsborough/Tampa (default OFF, user can toggle):
  //   hoa_letter — no AHJ-level requirement (Pompano H6)
  //   survey — separate from site plan; not Hillsborough/Tampa intake
  //   zoning_application — Pompano H21
  //   fire_review_application — Pompano H22 (Knox-box unresolved
  //     for Hillsborough — see commit research-gaps section)
  //   notarized_addendum — Davie H25
  //   property_ownership_search — Davie BCPA.NET H26
  //   hvhz_anchoring — Hillsborough not in HVHZ (line-by-line: n/a).
  //     Statewide pattern from H19 still allows user opt-in via override.
  relevantArtifactTypes: [
    'site_plan',
    'cut_sheet',
    'fire_stopping',
    'noc',
    'manufacturer_data',
    'flood_elevation_certificate',
    'private_provider_documentation',
  ],

  // -------------------------------------------------------------------------
  // SECTION PREDICATES — residential trade-permit lane bypass
  // -------------------------------------------------------------------------
  // H31 lane downgrade: SFR + contractor_exemption rides the trade-permit
  // path. ONLY tableOfContents + generalNotes + revisionLog + jurisdiction
  // stay on (the minimal scope narrative envelope). Everything else off.
  sectionPredicates: {
    // Engineering pages — full-plan-review only
    loadCalculation: isFullPlanReviewLane,
    nec22087Narrative: (ctx) =>
      isFullPlanReviewLane(ctx) && ctx.scope === 'existing-service',
    availableFaultCurrent: (ctx) =>
      isFullPlanReviewLane(ctx) && ctx.scope === 'new-service',
    voltageDrop: isFullPlanReviewLane,
    shortCircuit: isFullPlanReviewLane,
    // Diagrams & equipment — riser is "if requested" on trade-permit
    // lane per Tampa Accela narrative. Default OFF on trade-permit; user
    // can override on if AHJ requests it.
    riserDiagram: isFullPlanReviewLane,
    equipmentSchedule: isFullPlanReviewLane,
    equipmentSpecs: isFullPlanReviewLane,
    // Grounding — new-service only on full-plan-review lane
    grounding: (ctx) => isFullPlanReviewLane(ctx) && ctx.scope === 'new-service',
    // Panel schedules — commercial intake required; trade-permit lane
    // satisfies "panel rating + proposed breaker size" via the simpler
    // scope narrative (rendered in generalNotes).
    panelSchedules: isFullPlanReviewLane,
    // Compliance summary — full-plan-review only
    complianceSummary: isFullPlanReviewLane,
    // Specialty — EVEMS / EVSE labeling are required regardless of lane
    // per the line-by-line cross-walk (EVSE labeling "Required" on all
    // three columns). Leave default-on (no predicate).
    // Multi-family scope
    meterStack: (ctx) => ctx.buildingType === 'multi_family',
    multiFamilyEV: (ctx) => ctx.buildingType === 'multi_family',
  },

  // -------------------------------------------------------------------------
  // ARTIFACT-TYPE PREDICATES
  // -------------------------------------------------------------------------
  artifactTypePredicates: {
    // NOC required for jobs > $5,000 (FS 713.13). Same defensible default
    // as Orlando: include for non-SFR; user toggles off for sub-$5k SFR.
    noc: (ctx) => ctx.buildingType !== 'single_family_residential',
    // Site plan: residential trade-permit lane bypasses. Commercial /
    // multi-family always.
    site_plan: isFullPlanReviewLane,
    // Cut sheets + manufacturer data are useful at any scope — keep on
    // for residential too so the contractor uploads the EVSE spec. The
    // trade-permit lane "panel rating + proposed breaker size + scope"
    // benefits from the cut sheet as evidence of UL listing.
    // (No predicate → default-on per relevantArtifactTypes.)
    // Fire stopping: residential trade-permit lane doesn't penetrate
    // rated assemblies in a typical Level-2 home EVSE install.
    fire_stopping: isFullPlanReviewLane,
    // Flood elevation: conditional on flood-zone status. AHJContext
    // doesn't yet model flood zone — defensible default ON for
    // commercial (commercial intake explicitly lists DFE; user can
    // toggle off for non-flood projects). Off for residential.
    flood_elevation_certificate: (ctx) => ctx.buildingType === 'commercial',
    // Private provider doc: niche FS 553.791 alt path. Off-by-default —
    // user opts in when applicable. Predicate gates to commercial only
    // (residential trade-permit + multi-family don't use this path).
    private_provider_documentation: (ctx) => ctx.buildingType === 'commercial',
  },

  // -------------------------------------------------------------------------
  // REQUIREMENTS — Sprint 2C M1 line-by-line from the cross-walk
  // -------------------------------------------------------------------------
  // Pattern per requirement:
  //   - required(ctx): when does this requirement APPLY to THIS project?
  //   - detect(packet, attachments): is the artifact actually in the packet?
  //   - locator(packet): where (sheet ID) is it satisfied? — optional
  //
  // H31 lane gating: most line items gate behind `isFullPlanReviewLane`.
  // The minimal residential-trade-permit set is:
  //   - Trade permit application (envelope satisfied by tableOfContents
  //     + generalNotes + cover sheet contractor info)
  //   - Simple scope narrative (generalNotes)
  //   - Panel rating + proposed breaker size (scope narrative — for
  //     trade-permit lane, the contractor enters this in the portal; the
  //     SparkPlan packet's role is documentation, not authority)
  //   - One-line "if requested" (riserDiagram, off by default)
  //   - Per-sheet contractor signature (always, Sprint 2A C8)
  //   - FBC / NEC reference block (always, Sprint 2A C7 / H4)
  requirements: [
    // -----------------------------------------------------------------
    // APPLICATION CATEGORY — portal-routing intake forms (H5 / H32)
    // -----------------------------------------------------------------
    {
      id: 'hillsborough-tampa-trade-permit-application',
      name: 'Residential Electric Trade Permit application (HillsGovHub or Tampa Accela)',
      category: 'application',
      // Residential trade-permit lane only. Commercial uses the full
      // Commercial Electrical Permit application instead.
      required: isResidentialTradePermitLane,
      // Application is filed in the portal directly — SparkPlan packet
      // does not generate the form. Detection is best-effort: presence
      // of generalNotes + cover sheet contractor info indicates the
      // packet has the scope narrative the application asks for.
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('generalNotes')),
    },
    {
      id: 'hillsborough-tampa-commercial-electrical-permit',
      name: 'Commercial Electrical Permit application — full plan review',
      category: 'application',
      required: isFullPlanReviewLane,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('generalNotes')),
    },
    {
      id: 'hillsborough-tampa-noc',
      name: 'Notice of Commencement (FS 713.13, jobs > $5,000)',
      category: 'upload',
      // Required for any non-SFR job (commercial / multi-family virtually
      // always exceed $5k). SFR varies — defer to user override on
      // sub-threshold residential.
      required: (ctx) => ctx.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },
    {
      id: 'hillsborough-tampa-private-provider-doc',
      name: 'Private Provider documentation (FS 553.791 alt path)',
      category: 'upload',
      // Niche optional path — commercial only. User opts in.
      required: (ctx) =>
        isFullPlanReviewLane(ctx) && ctx.buildingType === 'commercial',
      detect: (_packet, attachments) =>
        attachments.some(
          (a) => a.artifactType === 'private_provider_documentation',
        ),
    },

    // -----------------------------------------------------------------
    // NARRATIVE CATEGORY — cover-sheet + scope content
    // -----------------------------------------------------------------
    {
      id: 'hillsborough-tampa-scope-narrative',
      name: 'Simple electrical scope narrative (residential trade permit)',
      category: 'narrative',
      // Required on ALL projects — the general-notes page covers
      // the trade-permit scope narrative and the commercial code-basis
      // requirement.
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('generalNotes')),
      locator: (packet) =>
        packet.sectionKeys?.includes('generalNotes') ? 'E-001' : null,
    },
    {
      id: 'hillsborough-tampa-code-reference-block',
      name: 'FBC / NEC / FFPC reference block on cover sheet',
      category: 'narrative',
      required: () => true,
      // Cover is hard-required and not in PacketSections — detect by
      // presence of any section (packet was generated).
      detect: (packet) => (packet.sectionKeys?.length ?? 0) > 0,
    },
    {
      id: 'hillsborough-tampa-contractor-signature',
      name: 'Contractor name + FL DBPR license # on each sheet',
      category: 'narrative',
      required: () => true,
      // Sprint 2A C8 — contractor block on every sheet. Same packet-
      // presence signal as the code reference block.
      detect: (packet) => (packet.sectionKeys?.length ?? 0) > 0,
    },

    // -----------------------------------------------------------------
    // PLAN CATEGORY — commercial / full-plan-review lane only
    // -----------------------------------------------------------------
    {
      id: 'hillsborough-tampa-pe-seal',
      name: 'Plans digitally signed and sealed by FL-registered PE or RA',
      category: 'plan',
      // Required for commercial / multi-family. NOT required for
      // residential trade-permit lane. The H17 lane axis is honored
      // independently here — even on commercial, the lane could be
      // contractor-exemption in some jurisdictions, but Hillsborough
      // commercial intake explicitly requires the seal regardless of
      // lane (see line-by-line: "🔴 no PE infrastructure" / Sprint 3 C5).
      required: isFullPlanReviewLane,
      // Detection: PE seal is on the cover sheet (Sprint 2A C5 not yet
      // built — Sprint 3 follow-up). For M1, detect via the lane: if
      // lane === 'pe_required', assume the seal is present. This
      // simplification will be replaced by actual artifact detection in
      // Sprint 3.
      detect: () => false, // Pending Sprint 3 C5
    },
    {
      id: 'hillsborough-tampa-site-plan',
      name: 'Site plan with EVSE locations relative to property',
      category: 'plan',
      required: isFullPlanReviewLane,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'site_plan'),
    },
    {
      id: 'hillsborough-tampa-riser-diagram',
      name: 'One-line / riser diagram with service equipment + grounding',
      category: 'plan',
      // Required commercial; "if requested" on residential trade permit.
      // We honor the strict commercial requirement; residential lane
      // bypasses entirely.
      required: isFullPlanReviewLane,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('riserDiagram')),
    },
    {
      id: 'hillsborough-tampa-panel-schedule',
      name: 'Panel / switchboard schedule (wattages, amps, branch circuits)',
      category: 'plan',
      required: isFullPlanReviewLane,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('panelSchedules')),
    },
    {
      id: 'hillsborough-tampa-load-calculations',
      name: 'Load calculations per NEC Article 220',
      category: 'plan',
      required: isFullPlanReviewLane,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('loadCalculation')),
    },
    {
      id: 'hillsborough-tampa-voltage-drop',
      name: 'Voltage drop considerations (NEC 215.2 / 210.19 FPN)',
      category: 'plan',
      required: isFullPlanReviewLane,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('voltageDrop')),
    },
    {
      id: 'hillsborough-tampa-fault-current',
      name: 'Available fault current calculation (NEC 110.9/110.10)',
      category: 'plan',
      required: (ctx) =>
        isFullPlanReviewLane(ctx) && ctx.scope === 'new-service',
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('availableFaultCurrent')),
    },
    {
      id: 'hillsborough-tampa-grounding',
      name: 'Service equipment grounding detail (NEC Article 250)',
      category: 'plan',
      required: (ctx) =>
        isFullPlanReviewLane(ctx) && ctx.scope === 'new-service',
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('grounding')),
    },
    {
      id: 'hillsborough-tampa-existing-service-nec22087',
      name: 'NEC 220.87 existing-service capacity narrative',
      category: 'plan',
      required: (ctx) =>
        isFullPlanReviewLane(ctx) && ctx.scope === 'existing-service',
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('nec22087Narrative')),
    },
    {
      id: 'hillsborough-tampa-design-flood-elevation',
      name: 'Design Flood Elevation reference (FBC flood zone)',
      category: 'plan',
      // H30: required when in FEMA SFHA. Without flood-zone modeling on
      // AHJContext, this is conditional in the manifest (commercial
      // only, user toggles off if not in flood zone). Stays in
      // requirements[] so the M1 engine flags it as manual-verification.
      required: (ctx) =>
        isFullPlanReviewLane(ctx) && ctx.buildingType === 'commercial',
      detect: (_packet, attachments) =>
        attachments.some(
          (a) => a.artifactType === 'flood_elevation_certificate',
        ),
    },

    // -----------------------------------------------------------------
    // UPLOAD CATEGORY — manufacturer / fire-stopping / cut sheets
    // -----------------------------------------------------------------
    {
      id: 'hillsborough-tampa-evse-cut-sheet',
      name: 'EVSE manufacturer cut sheets (UL-2202 / UL-2594 listings)',
      category: 'upload',
      // Useful at any scope — even the residential trade-permit lane
      // benefits from the cut sheet as listing evidence. Always required.
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'cut_sheet'),
    },
    {
      id: 'hillsborough-tampa-fire-stopping',
      name: 'Firestop assembly schedule for rated penetrations',
      category: 'upload',
      required: isFullPlanReviewLane,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'fire_stopping'),
    },

    // -----------------------------------------------------------------
    // INSPECTION CATEGORY — final inspection prerequisites
    // -----------------------------------------------------------------
    {
      id: 'hillsborough-tampa-evse-labeling',
      name: 'EVSE labeling per NEC 625.43 (visible at disconnect)',
      category: 'inspection',
      // Required on all lanes per the line-by-line cross-walk.
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('evseLabeling')),
    },
    {
      id: 'hillsborough-tampa-evems-narrative',
      name: 'EVEMS operational narrative (NEC 625.42, when EVEMS present)',
      category: 'inspection',
      // Conditional on EVEMS scope — we don't model "EVEMS present?" on
      // context yet, so leave required across all lanes and let the
      // section's data predicate hide it when irrelevant.
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('evemsNarrative')),
    },
  ],
};
