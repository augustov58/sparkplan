/**
 * Sprint 2C M1 follow-up — City of St. Petersburg manifest.
 *
 * Sourced 2026-05-16 (`docs/ahj-source-checklists/st-petersburg.md`,
 * Medium confidence — no EV-specific checklist published by the City;
 * manifest is composed from the residential / commercial plan review
 * checklists + statewide FBC/NEC adoption + FL Statute 713 NOC rule).
 *
 * St. Petersburg is the second-largest Tampa Bay metro AHJ (population
 * ~265k), distinct from City of Tampa (Hillsborough County) which is
 * covered by `hillsborough-tampa.ts`. St. Pete is in Pinellas County and
 * does NOT roll up to the Hillsborough/Tampa joint manifest — Pinellas
 * has its own Construction Licensing Board (PCCLB), its own Click2Gov
 * permit portal (`stpe-egov.aspgov.com`), and its own published
 * checklists hosted on `stpete.org`.
 *
 * HVHZ verdict: **OUT.** Pinellas is NOT in the High-Velocity Hurricane
 * Zone (only Miami-Dade and Broward counties are). Pinellas IS in the
 * Wind-Borne Debris Region with a 140 mph ultimate design wind speed
 * per FBC 8th ed (2023). Mounted EVSE anchoring documentation is
 * therefore via FL Product Approval (NOT Miami-Dade NOA), and per the
 * Sprint 2C H19 statewide pattern we still surface the `hvhz_anchoring`
 * upload slot on every project as an opt-in path for the anchoring
 * detail — defaulting OFF for SFR (most home EVSE installs are
 * wall-mount with no separate anchoring) and ON for commercial /
 * multi-family (outdoor pedestal / bollard installs).
 *
 * St. Petersburg follows the Hillsborough/Tampa "no published EV
 * checklist" pattern (cross-validated against `hcfl.gov`) — the City
 * routes EV scope through its generic residential / commercial
 * electrical permit workflows. SparkPlan's full packet is therefore
 * appropriate for commercial / multi-family scope; SFR + contractor-
 * exemption installs ride a lighter "Electric Trade Permit"-style lane
 * via the Click2Gov portal (mirrors Hillsborough H31 pattern). The
 * manifest gates engineering-heavy sections behind
 * `isFullPlanReviewLane(ctx)` so the residential-trade-permit lane
 * doesn't get an over-spec packet.
 *
 * Research gaps flagged for future passes (commit message also notes):
 *   - **No EV-specific checklist published.** Verified against
 *     `stpete.org/business/building_permitting/building_permits.php`
 *     (2026-05-16 fetch — page lists Generator / Solar / Windows-and-
 *     Doors checklists but NO EV or general Electrical checklist).
 *     Closure path: ~10 min phone call to Construction Services
 *     (727-893-7230) to confirm whether an internal-only checklist
 *     exists or whether EV is fully subsumed by the Residential Plans
 *     Submittal Checklist 2020.
 *   - **HOA letter status — UNRESOLVED for SFR.** Pinellas has heavy
 *     HOA / condo coverage (especially beach / waterfront communities);
 *     no City-published rule states whether an HOA letter is required
 *     for SFR EV installs in HOA-governed neighborhoods. Defensible
 *     default: ON for multi_family / commercial, OFF for SFR (matches
 *     Pompano predicate). User can toggle on via Layer 2 override.
 *   - **Flood zone DFE callout.** St. Pete's coastal AE zones with
 *     BFE = 9 ft are documented (FEMA case study + Pinellas County
 *     guidance), but no checklist explicitly requires a DFE callout on
 *     EVSE plans the way Hillsborough's commercial electrical
 *     requirements do. Defensible default: surface
 *     `flood_elevation_certificate` for commercial scope only (mirrors
 *     Hillsborough H30 treatment); SFR users can opt in via override
 *     for waterfront / island properties.
 *   - **Sub-jurisdiction split.** None — St. Pete is a self-contained
 *     city AHJ. Surrounding Pinellas munis (Clearwater, Largo, Dunedin,
 *     St. Pete Beach) are independent AHJs that would each get their
 *     own manifest in a future pass.
 *
 * @module data/ahj/st-petersburg
 */

import type { AHJManifest, AHJContext } from './types';

// ============================================================================
// PREDICATE HELPERS
// ============================================================================

/**
 * "Is this project on the residential-trade-permit-only lane?"
 *
 * Mirrors Hillsborough H31 pattern: St. Pete SFR + contractor_exemption
 * rides a lighter Click2Gov "Electric Trade Permit"-style intake (panel
 * rating + breaker size + scope; no formal plan review). Commercial /
 * multi-family always ride the full Commercial Electrical Permit lane.
 * SFR + pe_required is rare but defensible — if a PE is on the SFR
 * project, assume the contractor wants the full packet anyway (PE seal
 * is meaningful only attached to a full plan set).
 */
const isResidentialTradePermitLane = (ctx: AHJContext): boolean =>
  ctx?.buildingType === 'single_family_residential' &&
  ctx?.lane === 'contractor_exemption';

/** Inverse — "full plan-review lane?" */
const isFullPlanReviewLane = (ctx: AHJContext): boolean =>
  !isResidentialTradePermitLane(ctx);

// ============================================================================
// NARRATIVE CONTENT
// ============================================================================

/**
 * St. Petersburg-specific general notes. Statewide statutory language
 * (NEC 2020, FBC 8th ed, FS 713) plus Pinellas / St. Pete-specific
 * intake reminders (PCCLB licensure, Click2Gov portal, 140 mph WBDR).
 *
 * Verified verbatim against:
 *   - `cms5.revize.com/.../Current_Codes_Adopted.pdf` (NEC 2020 + FBC 8th)
 *   - FL Statute 713.135 ($5,000 NOC threshold)
 *   - Pinellas Construction Licensing Board (pcclb.com)
 */
const ST_PETERSBURG_GENERAL_NOTES: string[] = [
  'All electrical work shall comply with NFPA-70 (2020 NEC) and the Florida Building Code 8th edition (2023), as adopted by the City of St. Petersburg.',
  'Voltage drop shall not exceed 3% on feeders, 3% on branch circuits, and 5% combined feeder + branch (NEC 215.2(A)(1) FPN; NEC 210.19(A)(1) FPN).',
  'All grounding and bonding shall comply with NEC Article 250. Grounding electrode conductor sized per NEC Table 250.66; equipment grounding conductor sized per NEC Table 250.122.',
  'All service equipment, panelboards, and overcurrent devices shall be labeled with voltage, phase, amperage, and AIC rating per NEC 110.9 and 110.10.',
  'Contractor name and Florida DBPR license number, plus Pinellas County Construction Licensing Board (PCCLB) registration where applicable, shall appear on each drawing sheet.',
  'Recorded Notice of Commencement (Florida Statute 713.135) is required prior to the first inspection for any building-trade job exceeding $5,000.',
  'Permits are submitted electronically via the City of St. Petersburg Click2Gov / ePlan portal; applicants have ten (10) business days to upload plans after application acceptance.',
  'EVSE equipment shall bear UL-2202 and UL-2594 listings; manufacturer cut sheets attached.',
  'Mounted EVSE in outdoor / pedestal applications shall be anchored per a Florida Product Approval or original signed-and-sealed plans by a Florida-licensed Architect or Engineer. Pinellas County is in the Wind-Borne Debris Region (140 mph ultimate design wind speed per FBC 8th ed) but is NOT within the High-Velocity Hurricane Zone — Miami-Dade NOA tie-down details are acceptable but not required.',
  'For projects in a FEMA Special Flood Hazard Area (St. Petersburg coastal AE zones, BFE = 9 ft), service equipment elevation shall be demonstrated above the Design Flood Elevation per Florida Building Code.',
];

/**
 * Applicable codes shown on the cover sheet. NEC + FBC + FFPC are
 * statewide; local code reference cites the City of St. Petersburg
 * Code of Ordinances and the Pinellas County Construction Licensing
 * Board directly.
 */
const ST_PETERSBURG_CODE_REFERENCES: string[] = [
  'NFPA-70 (2020 NEC)',
  'Florida Building Code, 8th edition (2023)',
  'Florida Fire Prevention Code, 8th edition (NFPA 1, 2021)',
  'Florida Statute 713.135 (Notice of Commencement)',
  'City of St. Petersburg Code of Ordinances (Building & Construction)',
  'Pinellas County Construction Licensing Board (PCCLB) requirements',
  'NFPA-70E (2024) — Standard for Electrical Safety in the Workplace',
];

// ============================================================================
// MANIFEST
// ============================================================================

/**
 * City of St. Petersburg permit-packet manifest. Single jurisdiction
 * (no subjurisdiction split — Pinellas County's role here is licensure
 * (PCCLB) and code-amendment standardization, not a separate AHJ).
 * `subjurisdiction` intentionally left `undefined`.
 */
export const stPetersburgManifest: AHJManifest = {
  id: 'st-petersburg',
  name: 'City of St. Petersburg',
  jurisdictionType: 'city',
  subjurisdiction: undefined,

  // St. Petersburg cites NEC 2020 uniformly across SFR / multi-family /
  // commercial (no Miami-Dade H34 fork). FBC 8th ed (2023) statewide.
  // Verified via `cms5.revize.com/.../Current_Codes_Adopted.pdf`.
  necEdition: {
    single_family_residential: 'NEC 2020',
    multi_family: 'NEC 2020',
    commercial: 'NEC 2020',
  },
  fbcEdition: 'FBC 8th ed (2023)',

  // St. Pete follows the standard 'E-' discipline letter for electrical
  // sheets — no published alternate prefix in the City's plan review
  // checklists (contrast Miami-Dade's 'EL-' reservation).
  sheetIdPrefix: 'E-',

  generalNotes: ST_PETERSBURG_GENERAL_NOTES,
  codeReferences: ST_PETERSBURG_CODE_REFERENCES,

  // -------------------------------------------------------------------------
  // RELEVANT SECTIONS
  // -------------------------------------------------------------------------
  // Full Sprint 2A engineering stack for commercial / multi-family /
  // SFR+PE. Residential trade-permit lane (SFR + contractor_exemption)
  // gates most of these OFF via sectionPredicates below (Hillsborough
  // H31 pattern).
  relevantSections: [
    // Front matter (band 000)
    'tableOfContents',
    'generalNotes',
    'revisionLog',
    // Engineering (band 100)
    'loadCalculation',
    'nec22087Narrative',     // existing-service path only
    'availableFaultCurrent', // new-service path only
    'voltageDrop',
    'shortCircuit',
    // Diagrams & equipment (band 200)
    'riserDiagram',
    'equipmentSchedule',
    'equipmentSpecs',
    'grounding',             // new-service path only
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
  // RELEVANT ARTIFACT TYPES
  // -------------------------------------------------------------------------
  // Per the St. Pete Residential Plan Review Checklist + general permit
  // rules:
  //   site_plan — required (utility / service entry locations)
  //   cut_sheet — EVSE manufacturer cut sheets (UL listings)
  //   manufacturer_data — supplemental
  //   noc — FS 713.135 > $5,000
  //   hoa_letter — Pinellas HOA / condo prevalence; ON for non-SFR
  //   hvhz_anchoring — Pinellas WBDR (140 mph) — FL Product Approval
  //     path even though NOT HVHZ-proper. Predicated to non-SFR.
  //   flood_elevation_certificate — St. Pete coastal AE zones (BFE 9ft);
  //     conditional on flood zone, ON for commercial.
  //
  // NOT relevant for St. Petersburg (default OFF, user can toggle):
  //   survey — not Pinellas / St. Pete intake (Pompano-specific)
  //   fire_stopping — gated to full-plan-review lane via predicate
  //   zoning_application — Pompano H21
  //   fire_review_application — Pompano H22
  //   notarized_addendum — Davie H25
  //   property_ownership_search — Davie BCPA.NET H26
  //   private_provider_documentation — Hillsborough H33
  relevantArtifactTypes: [
    'site_plan',
    'cut_sheet',
    'fire_stopping',
    'noc',
    'hoa_letter',
    'manufacturer_data',
    'hvhz_anchoring',
    'flood_elevation_certificate',
  ],

  // -------------------------------------------------------------------------
  // SECTION PREDICATES — residential trade-permit lane bypass + scope forks
  // -------------------------------------------------------------------------
  sectionPredicates: {
    // Engineering pages — full-plan-review only (H31 pattern)
    loadCalculation: isFullPlanReviewLane,
    nec22087Narrative: (ctx) =>
      isFullPlanReviewLane(ctx) && ctx?.scope === 'existing-service',
    availableFaultCurrent: (ctx) =>
      isFullPlanReviewLane(ctx) && ctx?.scope === 'new-service',
    voltageDrop: isFullPlanReviewLane,
    shortCircuit: isFullPlanReviewLane,
    // Diagrams & equipment — riser default OFF on trade-permit lane
    riserDiagram: isFullPlanReviewLane,
    equipmentSchedule: isFullPlanReviewLane,
    equipmentSpecs: isFullPlanReviewLane,
    // Grounding — new-service only on full-plan-review lane
    grounding: (ctx) =>
      isFullPlanReviewLane(ctx) && ctx?.scope === 'new-service',
    // Panel schedules — commercial intake required; trade-permit lane
    // satisfies via the simpler scope narrative (rendered in generalNotes).
    panelSchedules: isFullPlanReviewLane,
    // Compliance summary — full-plan-review only
    complianceSummary: isFullPlanReviewLane,
    // Multi-family
    meterStack: (ctx) => ctx?.buildingType === 'multi_family',
    multiFamilyEV: (ctx) => ctx?.buildingType === 'multi_family',
  },

  // -------------------------------------------------------------------------
  // ARTIFACT-TYPE PREDICATES
  // -------------------------------------------------------------------------
  artifactTypePredicates: {
    // NOC required for any non-SFR job (commercial / multi-family
    // virtually always exceed $5k). Same defensible default as Orlando /
    // Hillsborough — user toggles off for sub-$5k SFR.
    noc: (ctx) => ctx?.buildingType !== 'single_family_residential',
    // Site plan: residential trade-permit lane bypasses. Commercial /
    // multi-family always.
    site_plan: isFullPlanReviewLane,
    // Fire stopping: residential trade-permit lane doesn't penetrate
    // rated assemblies in a typical Level-2 home EVSE install.
    fire_stopping: isFullPlanReviewLane,
    // HOA letter: Pompano predicate pattern. Pinellas is heavy HOA /
    // condo territory. Default ON for non-SFR; SFR users in HOA
    // neighborhoods can toggle on via Layer 2 override.
    hoa_letter: (ctx) => ctx?.buildingType !== 'single_family_residential',
    // HVHZ-style anchoring (FL Product Approval path — Pinellas is
    // WBDR but NOT HVHZ). Default ON for non-SFR outdoor pedestal /
    // bollard installs; SFR wall-mount typically doesn't need separate
    // anchoring detail.
    hvhz_anchoring: (ctx) =>
      ctx?.buildingType !== 'single_family_residential',
    // Flood elevation: St. Pete coastal AE zones with BFE 9 ft.
    // AHJContext doesn't model flood zone — defensible default ON for
    // commercial (where waterfront sites are common); user can toggle
    // off for inland projects.
    flood_elevation_certificate: (ctx) => ctx?.buildingType === 'commercial',
  },

  // -------------------------------------------------------------------------
  // REQUIREMENTS — Sprint 2C M1 conformance checklist
  // -------------------------------------------------------------------------
  // Composed from the St. Petersburg Residential / Commercial Plan
  // Review checklists + FL Statute 713 + statewide code adoption. No
  // EV-specific St. Pete checklist exists — line items are derived
  // from general permit rules. Pattern per requirement:
  //   - required(ctx): does this requirement apply to THIS project?
  //   - detect(packet, attachments): is the artifact actually in the
  //     packet?
  //   - locator(packet): where (sheet ID) is it satisfied? — optional
  requirements: [
    // -----------------------------------------------------------------
    // APPLICATION CATEGORY — portal intake
    // -----------------------------------------------------------------
    {
      id: 'st-petersburg-trade-permit-application',
      name: 'Electric Trade Permit application (Click2Gov / ePlan portal)',
      category: 'application',
      // Residential trade-permit lane only.
      required: isResidentialTradePermitLane,
      // Application is filed in the portal directly — SparkPlan packet
      // does not generate the form. Detection is best-effort: presence
      // of generalNotes indicates scope narrative is in the packet.
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('generalNotes')),
    },
    {
      id: 'st-petersburg-commercial-electrical-permit',
      name: 'Commercial Electrical Permit application — full plan review',
      category: 'application',
      required: isFullPlanReviewLane,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('generalNotes')),
    },
    {
      id: 'st-petersburg-noc',
      name: 'Notice of Commencement (FS 713.135, jobs > $5,000)',
      category: 'application',
      required: (ctx) => ctx?.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'noc'),
    },
    {
      id: 'st-petersburg-hoa-letter',
      name: 'HOA / Condominium Association approval letter (if applicable)',
      category: 'application',
      // Default ON for non-SFR (Pinellas HOA / condo prevalence). SFR
      // users in HOA neighborhoods can toggle on via Layer 2 override.
      required: (ctx) => ctx?.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'hoa_letter'),
    },

    // -----------------------------------------------------------------
    // NARRATIVE CATEGORY — cover-sheet + scope content
    // -----------------------------------------------------------------
    {
      id: 'st-petersburg-scope-narrative',
      name: 'Simple electrical scope narrative (residential trade permit)',
      category: 'narrative',
      // Required on ALL projects — general-notes covers trade-permit
      // scope narrative AND commercial code-basis requirement.
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('generalNotes')),
      locator: (packet) =>
        packet.sectionKeys?.includes('generalNotes') ? 'E-001' : null,
    },
    {
      id: 'st-petersburg-code-reference-block',
      name: 'FBC / NEC / FFPC reference block on cover sheet',
      category: 'narrative',
      required: () => true,
      detect: (packet) => (packet.sectionKeys?.length ?? 0) > 0,
    },
    {
      id: 'st-petersburg-contractor-signature',
      name: 'Contractor name + FL DBPR license # + PCCLB registration on each sheet',
      category: 'narrative',
      required: () => true,
      detect: (packet) => (packet.sectionKeys?.length ?? 0) > 0,
    },

    // -----------------------------------------------------------------
    // PLAN CATEGORY — commercial / full-plan-review lane only
    // -----------------------------------------------------------------
    {
      id: 'st-petersburg-pe-seal',
      name: 'Plans digitally signed and sealed by FL-registered PE or RA',
      category: 'plan',
      // Required for commercial / multi-family per St. Pete Residential
      // Plan Review Checklist (PE seal threshold). Lane-gated so the
      // SFR contractor-exemption path does not require it.
      required: isFullPlanReviewLane,
      // Detection: PE seal is on the cover sheet (Sprint 2A C5 not yet
      // built — Sprint 3 follow-up). For M1, defer to false.
      detect: () => false, // Pending Sprint 3 C5
    },
    {
      id: 'st-petersburg-site-plan',
      name: 'Site plan with EVSE locations + utility service entry',
      category: 'plan',
      required: isFullPlanReviewLane,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'site_plan'),
      locator: (packet) => {
        const ids = packet.sheetIds ?? [];
        return ids.find((id) => id.startsWith('C-')) ?? null;
      },
    },
    {
      id: 'st-petersburg-riser-diagram',
      name: 'One-line / riser diagram with service equipment + grounding',
      category: 'plan',
      required: isFullPlanReviewLane,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('riserDiagram')),
    },
    {
      id: 'st-petersburg-panel-schedule',
      name: 'Panel / switchboard schedule (wattages, amps, branch circuits)',
      category: 'plan',
      required: isFullPlanReviewLane,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('panelSchedules')),
    },
    {
      id: 'st-petersburg-load-calculations',
      name: 'Load calculations per NEC Article 220',
      category: 'plan',
      required: isFullPlanReviewLane,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('loadCalculation')),
    },
    {
      id: 'st-petersburg-voltage-drop',
      name: 'Voltage drop considerations (NEC 215.2 / 210.19 FPN)',
      category: 'plan',
      required: isFullPlanReviewLane,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('voltageDrop')),
    },
    {
      id: 'st-petersburg-fault-current',
      name: 'Available fault current calculation (NEC 110.9/110.10)',
      category: 'plan',
      required: (ctx) =>
        isFullPlanReviewLane(ctx) && ctx?.scope === 'new-service',
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('availableFaultCurrent')),
    },
    {
      id: 'st-petersburg-grounding',
      name: 'Service equipment grounding detail (NEC Article 250)',
      category: 'plan',
      required: (ctx) =>
        isFullPlanReviewLane(ctx) && ctx?.scope === 'new-service',
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('grounding')),
    },
    {
      id: 'st-petersburg-existing-service-nec22087',
      name: 'NEC 220.87 existing-service capacity narrative',
      category: 'plan',
      required: (ctx) =>
        isFullPlanReviewLane(ctx) && ctx?.scope === 'existing-service',
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('nec22087Narrative')),
    },
    {
      id: 'st-petersburg-anchoring-detail',
      name: 'Anchoring detail (FL Product Approval / signed-sealed plans) — WBDR 140 mph',
      category: 'plan',
      // Pinellas is WBDR but NOT HVHZ — FL Product Approval path. Gate
      // to non-SFR (outdoor pedestal / bollard EVSE); SFR wall-mount
      // typically does not require a separate anchoring detail.
      required: (ctx) => ctx?.buildingType !== 'single_family_residential',
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'hvhz_anchoring'),
    },
    {
      id: 'st-petersburg-design-flood-elevation',
      name: 'Design Flood Elevation reference (coastal AE zones, BFE = 9 ft)',
      category: 'plan',
      // St. Pete coastal AE zones. Without flood-zone modeling on
      // AHJContext, conditional in the manifest (commercial only, user
      // toggles off if not in flood zone).
      required: (ctx) =>
        isFullPlanReviewLane(ctx) && ctx?.buildingType === 'commercial',
      detect: (_packet, attachments) =>
        attachments.some(
          (a) => a.artifactType === 'flood_elevation_certificate',
        ),
    },

    // -----------------------------------------------------------------
    // UPLOAD CATEGORY — manufacturer / fire-stopping / cut sheets
    // -----------------------------------------------------------------
    {
      id: 'st-petersburg-evse-cut-sheet',
      name: 'EVSE manufacturer cut sheets (UL-2202 / UL-2594 listings)',
      category: 'upload',
      // Useful at any scope — even residential trade-permit lane
      // benefits from the cut sheet as listing evidence.
      required: () => true,
      detect: (_packet, attachments) =>
        attachments.some((a) => a.artifactType === 'cut_sheet'),
    },
    {
      id: 'st-petersburg-fire-stopping',
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
      id: 'st-petersburg-evse-labeling',
      name: 'EVSE labeling per NEC 625.43 (visible at disconnect)',
      category: 'inspection',
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('evseLabeling')),
    },
    {
      id: 'st-petersburg-evems-narrative',
      name: 'EVEMS operational narrative (NEC 625.42, when EVEMS present)',
      category: 'inspection',
      // Conditional on EVEMS scope — context doesn't model "EVEMS
      // present?" yet, so leave required across all lanes and let the
      // section's data predicate hide it when irrelevant.
      required: () => true,
      detect: (packet) =>
        Boolean(packet.sectionKeys?.includes('evemsNarrative')),
    },
    {
      id: 'st-petersburg-inspection-electrical-rough',
      name: 'Electrical inspection: Rough (full-plan-review lane)',
      category: 'inspection',
      required: isFullPlanReviewLane,
      detect: () => false,
    },
    {
      id: 'st-petersburg-inspection-electrical-final',
      name: 'Electrical inspection: Final',
      category: 'inspection',
      required: () => true,
      detect: () => false,
    },
  ],
};
