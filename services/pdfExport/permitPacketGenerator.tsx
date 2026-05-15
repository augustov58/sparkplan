/**
 * Permit Packet Generator Service
 * Generates comprehensive permit application packet with all required documents
 */

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { Document } from '@react-pdf/renderer';
import type { Panel, Circuit, Feeder, Transformer, ShortCircuitCalculation, Database } from '../../lib/database.types';
import type { Jurisdiction } from '../../types';
import type { ArcFlashResult } from '../calculations/arcFlash';
import type { MultiFamilyEVResult } from '../calculations/multiFamilyEV';
import type { MultiFamilyContext } from '../calculations/upstreamLoadAggregation';

type GroundingDetail = Database['public']['Tables']['grounding_details']['Row'];
type MeterStack = Database['public']['Tables']['meter_stacks']['Row'];
type MeterDB = Database['public']['Tables']['meters']['Row'];
import {
  CoverPage,
  GeneralNotesPage,
  EquipmentSchedule,
  RiserDiagram,
  LoadCalculationSummary,
  ComplianceSummary,
  TableOfContentsPage,
  RevisionLogPage,
  NEC22087NarrativePage,
  AvailableFaultCurrentPage,
  EVEMSNarrativePage,
  EVSELabelingPage,
  type TocEntry,
  type RevisionEntry,
  type NEC22087NarrativeData,
  type AvailableFaultCurrentInput,
  type EVEMSNarrativePanelEntry,
  type EVSELabelingPanelEntry,
} from './PermitPacketDocuments';
import { PanelSchedulePages } from './PanelScheduleDocuments';
import {
  calculateAggregatedLoad,
  isEVEMSManagedPanel,
  findEVEMSSetpointMarker,
} from '../calculations/upstreamLoadAggregation';
import { EquipmentSpecsPages } from './EquipmentSpecsDocuments';
import { VoltageDropPages } from './VoltageDropDocuments';
import { JurisdictionRequirementsPages } from './JurisdictionDocuments';
import { ShortCircuitTablePages } from './ShortCircuitDocuments';
import { ArcFlashPages } from './ArcFlashDocuments';
import { GroundingPlanPages } from './GroundingPlanDocuments';
import { MultiFamilyEVPages } from './MultiFamilyEVDocuments';
import { MeterStackScheduleDocument } from './MeterStackSchedulePDF';
import {
  type PacketSections,
  type SheetBand,
  type SheetDiscipline,
  resolveSections,
  newBandCounters,
  nextSheetId,
  BAND_FRONT_MATTER,
  BAND_CALCULATIONS,
  BAND_DIAGRAMS,
  BAND_PANELS,
  BAND_MULTIFAMILY,
  BAND_COMPLIANCE,
  BAND_SPECIALTY,
  SHEET_DISCIPLINE_CIVIL,
  SHEET_DISCIPLINE_MANUFACTURER,
  SHEET_DISCIPLINE_ELECTRICAL,
  disciplineFromSheetIdPrefix,
} from './packetSections';
import { AttachmentTitleSheet } from './AttachmentTitleSheet';
import { AttachmentTitleBlock } from './AttachmentTitleBlock';
import { compositeTitleBlock } from './compositeTitleBlock';
import { mergePacket } from './mergePacket';
import { stampSheetIds, buildStampMaps } from './stampSheetIds';
import type { ArtifactType, CoverMode } from '../../hooks/useProjectAttachments';
import type {
  AHJContext,
  AHJManifest,
  AttachmentSummary,
  BuildingType,
  PacketAST,
  SectionKey,
} from '../../data/ahj/types';

export interface PermitPacketData {
  projectId: string;
  projectName: string;
  projectAddress: string;
  projectType: 'Residential' | 'Commercial' | 'Industrial';
  /**
   * Project Status — drives whether panel-schedule pages render the
   * "* = Proposed new circuit" legend and asterisk markers. When the value
   * is 'new-service' (or undefined), every circuit is implicitly new and the
   * legend is suppressed to avoid visual noise.
   */
  serviceModificationType?: 'existing' | 'service-upgrade' | 'new-service';
  serviceVoltage: number;
  servicePhase: 1 | 3;
  panels: Panel[];
  circuits: Circuit[];
  feeders: Feeder[];
  transformers: Transformer[];
  preparedBy?: string;
  permitNumber?: string;
  hasGrounding?: boolean;
  // Tier 1 additions for permit completeness
  contractorLicense?: string;
  scopeOfWork?: string;
  serviceType?: 'overhead' | 'underground';
  meterLocation?: string;
  serviceConductorRouting?: string;
  // Tier 3: Jurisdiction Requirements
  jurisdictionId?: string;
  jurisdiction?: Jurisdiction; // Full jurisdiction object for PDF generation
  // Tier 2: Additional calculations and plans
  shortCircuitCalculations?: ShortCircuitCalculation[]; // Short circuit analysis results
  arcFlashData?: {  // Arc flash analysis data
    equipmentName: string;
    equipmentType: string;
    systemVoltage: number;
    faultCurrent: number;
    workingDistance: number;
    clearingTime: number;
    result: ArcFlashResult;
  };
  groundingSystem?: GroundingDetail; // Grounding electrode system
  // Multi-Family: Meter Stack Schedule (NEC 408)
  meterStacks?: MeterStack[];
  meters?: MeterDB[];
  // Multi-Family EV Analysis (NEC 220.84 + 220.57)
  multiFamilyEVAnalysis?: {
    result: MultiFamilyEVResult;
    buildingName?: string;
  };
  /**
   * NEC 220.84 multifamily context for the MDP load-calculation summary.
   * Build with `buildMultiFamilyContext(mdp, panels, circuits, transformers, settings)`
   * — pass `undefined` for projects that aren't multi-family with 3+ units. When
   * provided, the load-calc page applies the Optional Method blanket DF instead of
   * the standard NEC 220 cascade.
   */
  multiFamilyContext?: MultiFamilyContext;
  /**
   * Sprint 2A C7: NEC edition stamped on cover sheet + compliance summary.
   * Defaults to '2020' for the FL pilot AHJs (FBC 8th ed adopts NFPA-70 2020).
   * NEC 220.84 demand-factor table values are unchanged between 2020 and 2023.
   */
  necEdition?: '2020' | '2023';
  /**
   * Sprint 2A H4: applicable model codes shown in the cover-sheet
   * "APPLICABLE CODES" section. Defaults to FL pilot stack
   * (NFPA-70 2020 + FBC 8th ed 2023). Override per AHJ when other codes apply.
   */
  codeReferences?: string[];
  /**
   * Sprint 2A C8: contractor name printed in the per-sheet signature block.
   * Falls back to `preparedBy` when not provided so existing callers keep
   * working (preparedBy is often the same person on residential / single-PE
   * jobs). Distinct from preparedBy in cases where the design preparer is
   * different from the signing contractor (PE-stamped commercial work).
   */
  contractorName?: string;
  /**
   * Sprint 2A H12 + H13: numbered general-notes list shown on the dedicated
   * General Notes page. Defaults to the FL pilot stack (NEC 2020 + 3/3/5
   * voltage drop). Sprint 2C will override this from per-AHJ manifests.
   */
  generalNotes?: string[];
  /**
   * Sprint 2A H1+H2+H3: per-section toggles. Cover is hard-required and
   * always rendered. ComplianceSummary + PanelSchedules are toggleable but
   * the UI layer should warn when off. Defaults to all-on
   * (`DEFAULT_SECTIONS` from `./packetSections`).
   */
  sections?: Partial<PacketSections>;
  /**
   * Sprint 2A H2: revision log entries. When omitted or empty, the Revision
   * Log page auto-populates a single "Rev 0 / [today] / Initial submittal"
   * row using `contractorName ?? preparedBy` as the issuer.
   */
  revisions?: RevisionEntry[];
  /**
   * Sprint 2A H14: opt-in NEC 220.87 existing-service narrative. When provided,
   * the generator inserts a structured 3-condition checklist sheet (band 100)
   * required by Orlando's existing-service permit checklist. When omitted, the
   * `nec22087Narrative` section toggle auto-disables in the UI — only projects
   * claiming an NEC 220.87 service upgrade need this page.
   */
  nec22087Narrative?: NEC22087NarrativeData;
  /**
   * Sprint 2A PR 5 / H17: permit-packet lane stamp on the cover sheet. Caller
   * (UI layer) computes this from `screenContractorExemption(...)` and passes
   * the result here. When omitted, the cover sheet renders without the
   * lane-specific subtitle (legacy callers stay backward-compatible).
   */
  permitMode?: {
    lane: 'exempt' | 'pe-required';
    ahjName?: string;
  };
  /**
   * Sprint 2B PR-4: optional active AHJ manifest. When provided, the
   * orchestrator pulls `sheetIdPrefix`, `generalNotes`, `codeReferences`,
   * and `necEdition[buildingType]` from the manifest when the equivalent
   * top-level fields aren't supplied. The UI layer typically passes both
   * the manifest AND the resolved values for explicitness; the manifest
   * here is for orchestrator-internal use (sheet-ID stamping uses
   * `manifest.sheetIdPrefix`'s letter as the discipline override for
   * electrical sheets) and for the future Sprint 2C M1 engine that runs
   * inside the orchestrator's render path.
   *
   * Backward compat: when omitted, the orchestrator uses the existing
   * top-level fields and hard-coded defaults exactly as Sprint 2A.
   */
  manifest?: AHJManifest;
  /**
   * Sprint 2B PR-4: building type used to pick the right NEC edition from
   * `manifest.necEdition` when `necEdition` is not supplied directly.
   * Defaults to `'single_family_residential'` when omitted. Sprint 2C M1
   * uses this for `building_type`-gated requirements.
   */
  buildingType?: BuildingType;
  /**
   * Sprint 2B PR-3: user-uploaded PDF artifacts to splice into the packet.
   *
   * Storage fetch happens at the React layer (Supabase auth context lives
   * there); this generator accepts the bytes already in memory so it can
   * remain testable without a browser/Supabase context.
   *
   * Each attachment becomes a SparkPlan title sheet (size-matched to the
   * upload's first page) followed by the user's PDF pages. Order is
   * preserved — uploads with discipline 'C' (site_plan/survey/hvhz_anchoring)
   * are emitted first, then 'X' (everything else), so reviewers see civil
   * before manufacturer documents.
   */
  attachments?: PermitPacketAttachment[];
}

/**
 * In-memory representation of one user-uploaded artifact. The React layer
 * fetches the bytes from Supabase Storage; this generator never talks to
 * Storage directly.
 */
export interface PermitPacketAttachment {
  /** Discriminates the title sheet's discipline prefix + display title. */
  artifactType: ArtifactType;
  /** Human-readable name shown on the title sheet (falls back per ArtifactType). */
  displayTitle?: string;
  /** Original filename — surfaced in warning messages if merge fails. */
  filename: string;
  /** ISO timestamp when the user uploaded the file (drives "Date Received"). */
  uploadedAt?: string;
  /** The user's PDF, fetched from Supabase Storage by the caller. */
  uploadBytes: Uint8Array;
  /**
   * Per-upload cover behavior (Sprint 2B PR-3 v4). Replaces the
   * v3 boolean `includeSparkplanCover`.
   *
   * - 'separate' (default) — SparkPlan title sheet as its own page
   *    preceding the upload. Upload pages stamped with sheet IDs.
   * - 'overlay' — SparkPlan title block composited ONTO the upload
   *    page itself. Each upload page becomes a composite (drawing +
   *    title block) and receives a sheet-ID stamp.
   * - 'none' — upload appended as-is, no SparkPlan ceremony, no
   *    stamping. For pre-bordered drawings with their own architect
   *    title block.
   *
   * Omitting this field is equivalent to 'separate' (preserves the
   * v3 default behavior for legacy callers).
   */
  coverMode?: CoverMode;
  /**
   * Optional contractor-supplied sheet ID override (Sprint 2B PR-3 v4).
   * When set, used verbatim as the title sheet ID (cover-ON path) instead
   * of pulling from the band+discipline counter. When null/undefined, the
   * orchestrator auto-allocates from the counter (current behavior).
   *
   * Custom IDs do NOT advance the band counter — that way, every upload
   * with a custom ID acts as a "free slot" in the auto-allocation
   * sequence, so neighboring auto-allocated uploads stay continuous.
   * Multi-page upload pages still receive auto-allocated IDs continuing
   * from where the counter would naturally have been.
   *
   * No-op for cover-OFF uploads (the sheet ID isn't stamped anywhere in
   * that path; the contractor's own title block carries the identifier).
   */
  customSheetId?: string | null;
  /**
   * Optional per-upload discipline letter override (Sprint 2B PR-3 v5).
   *
   * When set, this single letter replaces the auto-determined discipline
   * prefix (the 'C' in 'C-201') for this upload. Auto-determination
   * (when this field is null/undefined) maps:
   *   site_plan / survey / hvhz_anchoring → 'C' (civil)
   *   everything else                     → 'X' (manufacturer)
   *
   * Override values are expected to be a single uppercase letter A-Z
   * — typically one of `A` (architectural), `C`, `M`, `P`, `S`, `X`.
   * `E` is reserved for SparkPlan-generated content and isn't offered
   * in the UI, but the orchestrator accepts whatever letter is passed
   * (the column has no DB-level CHECK constraint — feedback_validation_advisory).
   *
   * Overrides do NOT change the band counter; the band counter keeps
   * advancing normally so neighboring auto-allocated uploads stay
   * continuous in their own discipline numbering. Only the letter
   * prefix on this upload's sheet IDs flips.
   */
  disciplineOverride?: string | null;
}

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

const summarizeStack = (err: unknown, lines = 6): string => {
  if (!(err instanceof Error)) return String(err);
  const stack = err.stack ?? '';
  return stack.split('\n').slice(0, lines).join('\n');
};

/**
 * Generate complete permit packet PDF.
 *
 * Strategy: build a labeled list of Page elements, try to render them
 * together first, and on failure bisect by re-rendering each Page in
 * isolation so the error message can point at the exact offender.
 */
export const generatePermitPacket = async (data: PermitPacketData): Promise<void> => {
  console.log('[permit-packet] start', {
    projectName: data.projectName,
    counts: {
      panels: data.panels?.length ?? 0,
      circuits: data.circuits?.length ?? 0,
      feeders: data.feeders?.length ?? 0,
      transformers: data.transformers?.length ?? 0,
      shortCircuit: data.shortCircuitCalculations?.length ?? 0,
      meterStacks: data.meterStacks?.length ?? 0,
      meters: data.meters?.length ?? 0,
    },
    flags: {
      arcFlash: !!data.arcFlashData,
      grounding: !!data.groundingSystem,
      multiFamilyEV: !!data.multiFamilyEVAnalysis,
      jurisdiction: !!data.jurisdiction,
    },
  });

  if (!data.projectName || !data.panels || data.panels.length === 0) {
    throw new Error('Invalid permit packet data. Project name and at least one panel are required.');
  }

  // Sprint 2B PR-4: resolve manifest-derived overrides for the AHJ-aware
  // narrative content. The UI typically passes these as top-level fields
  // AND the manifest; this fallback ensures any caller that passes ONLY the
  // manifest still gets the right strings on the cover sheet / general
  // notes page. Backward compat: when no manifest, every value falls back
  // to the existing top-level field (which itself defaults to Sprint 2A's
  // FL-pilot stack inside each page component).
  const manifestBuildingType: BuildingType =
    data.buildingType ?? 'single_family_residential';
  // NEC-edition fallback: prefer the explicit top-level field; otherwise
  // ask the manifest. Map "NEC 2020" / "NEC 2014" strings down to the
  // limited '2020' | '2023' union the page components accept (Sprint 2C
  // M1 will widen this when Miami-Dade's NEC 2014 residential lane lands).
  const necFromManifest =
    data.manifest?.necEdition[manifestBuildingType] ?? null;
  const resolvedNecEdition: '2020' | '2023' | undefined =
    data.necEdition
    ?? (necFromManifest && necFromManifest.includes('2023')
      ? '2023'
      : necFromManifest && necFromManifest.includes('2020')
      ? '2020'
      : undefined);
  const resolvedGeneralNotes = data.generalNotes ?? data.manifest?.generalNotes;
  const resolvedCodeReferences =
    data.codeReferences ?? data.manifest?.codeReferences;

  // Build a shadow `data` reference that uses the manifest-resolved values
  // when the explicit top-level fields are missing. Keep the original
  // `data` untouched so we don't surprise downstream callers.
  data = {
    ...data,
    necEdition: resolvedNecEdition,
    generalNotes: resolvedGeneralNotes,
    codeReferences: resolvedCodeReferences,
  };

  const circuitsByPanel = new Map<string, Circuit[]>();
  data.circuits.forEach(circuit => {
    const panelCircuits = circuitsByPanel.get(circuit.panel_id) || [];
    panelCircuits.push(circuit);
    circuitsByPanel.set(circuit.panel_id, panelCircuits);
  });

  const sortedPanels = [...data.panels].sort((a, b) => {
    if (a.is_main && !b.is_main) return -1;
    if (!a.is_main && b.is_main) return 1;
    return a.name.localeCompare(b.name);
  });

  // Sprint 2A C8: every electrical sheet renders a per-sheet contractor
  // signature block above its footer. Fall back to `preparedBy` when an
  // explicit `contractorName` isn't supplied — most residential / single-PE
  // packets have one person filling both roles.
  const contractor = {
    contractorName: data.contractorName ?? data.preparedBy,
    contractorLicense: data.contractorLicense,
  };

  // Sprint 2A H1+H2+H3: resolve section toggles. Cover is always-on (not in
  // the config). Default is all-on.
  const sections = resolveSections(data.sections);

  // Sprint 2C M1: assemble the AHJContext the checklist engine consumes
  // (`required(ctx)` forks on these axes). We derive scope from
  // `data.nec22087Narrative` presence (the existing-service narrative is
  // opt-in and gates the existing-service path) and lane from
  // `data.permitMode` (Sprint 2A H17 contractor-exemption screening). When
  // either upstream field is absent, conservative defaults keep the engine
  // running — predicates can detect via ctx.buildingType regardless.
  const ahjCtx: AHJContext = {
    scope: data.nec22087Narrative ? 'existing-service' : 'new-service',
    lane:
      data.permitMode?.lane === 'pe-required'
        ? 'pe_required'
        : 'contractor_exemption',
    buildingType: manifestBuildingType,
    subjurisdiction: data.manifest?.subjurisdiction,
  };

  // Sprint 2C M1: project attachments → AttachmentSummary[] for the engine.
  // The engine doesn't need the bytes; it only inspects artifactType (for
  // detect predicates) + displayTitle + sheetId. Sheet IDs aren't allocated
  // for uploads yet at this phase — the engine tolerates `sheetId: null`,
  // and the locator path uses packet.sheetIds to find sheets instead.
  const attachmentSummaries: AttachmentSummary[] = (data.attachments ?? []).map(
    (a) => ({
      artifactType: a.artifactType,
      displayTitle: a.displayTitle ?? null,
      sheetId: a.customSheetId ?? null,
    }),
  );

  // The jurisdiction builder's render lambda needs the packet AST, which
  // can only be assembled AFTER sheet-ID allocation walks every builder
  // once. Capture a mutable ref here; populate it post-allocation, then
  // the render lambda reads the populated value via closure.
  const packetAstRef: { current: PacketAST } = { current: {} };

  // ============================================================================
  // PAGE BUILDERS — declarative description of every page that COULD render.
  // Each builder is filtered against the section config, then walked twice:
  // once to allocate category-banded sheet IDs, once to render the elements
  // with both the assigned sheet IDs and the populated TOC entries.
  // ============================================================================

  type PageKind =
    | 'cover'
    | 'tableOfContents'
    | 'revisionLog'
    | 'generalNotes'
    | 'loadCalculation'
    | 'nec22087Narrative'
    | 'availableFaultCurrent'
    | 'voltageDrop'
    | 'shortCircuit'
    | 'arcFlash'
    | 'riserDiagram'
    | 'equipmentSchedule'
    | 'equipmentSpecs'
    | 'grounding'
    | 'panelSchedule'
    | 'meterStack'
    | 'multiFamilyEV'
    | 'complianceSummary'
    | 'jurisdiction'
    | 'evemsNarrative'
    | 'evseLabeling';

  interface PageBuilder {
    name: string;
    kind: PageKind;
    band?: SheetBand;
    pageCount: number;
    tocTitles: string[];
    render: (sheetIds: string[], tocEntries: TocEntry[]) => React.ReactElement;
  }

  const builders: PageBuilder[] = [];

  // ---- Front matter (band 000) ----
  builders.push({
    name: 'CoverPage',
    kind: 'cover',
    band: BAND_FRONT_MATTER,
    pageCount: 1,
    tocTitles: ['Permit Application Cover Sheet'],
    render: (sheetIds) => (
      <CoverPage
        projectName={data.projectName}
        projectAddress={data.projectAddress}
        projectType={data.projectType}
        serviceVoltage={data.serviceVoltage}
        servicePhase={data.servicePhase}
        preparedBy={data.preparedBy}
        permitNumber={data.permitNumber}
        contractorLicense={data.contractorLicense}
        scopeOfWork={data.scopeOfWork}
        serviceType={data.serviceType}
        meterLocation={data.meterLocation}
        serviceConductorRouting={data.serviceConductorRouting}
        necEdition={data.necEdition}
        codeReferences={data.codeReferences}
        sheetId={sheetIds[0]}
        permitMode={data.permitMode}
      />
    ),
  });

  if (sections.tableOfContents) {
    builders.push({
      name: 'TableOfContents',
      kind: 'tableOfContents',
      band: BAND_FRONT_MATTER,
      pageCount: 1,
      tocTitles: ['Table of Contents'],
      render: (sheetIds, tocEntries) => (
        <TableOfContentsPage
          projectName={data.projectName}
          entries={tocEntries}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  if (sections.revisionLog) {
    builders.push({
      name: 'RevisionLog',
      kind: 'revisionLog',
      band: BAND_FRONT_MATTER,
      pageCount: 1,
      tocTitles: ['Revision Log'],
      render: (sheetIds) => (
        <RevisionLogPage
          projectName={data.projectName}
          revisions={data.revisions}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  if (sections.generalNotes) {
    builders.push({
      name: 'GeneralNotes',
      kind: 'generalNotes',
      band: BAND_FRONT_MATTER,
      pageCount: 1,
      tocTitles: ['General Notes'],
      render: (sheetIds) => (
        <GeneralNotesPage
          projectName={data.projectName}
          generalNotes={data.generalNotes}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  // ---- Engineering calculations (band 100) ----
  if (sections.loadCalculation) {
    builders.push({
      name: 'LoadCalculationSummary',
      kind: 'loadCalculation',
      band: BAND_CALCULATIONS,
      pageCount: 1,
      tocTitles: ['Load Calculation Summary'],
      render: (sheetIds) => (
        <LoadCalculationSummary
          panels={data.panels}
          circuits={data.circuits}
          transformers={data.transformers}
          projectName={data.projectName}
          serviceVoltage={data.serviceVoltage}
          servicePhase={data.servicePhase}
          projectType={data.projectType}
          multiFamilyContext={data.multiFamilyContext}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  // Sprint 2A H14: NEC 220.87 narrative is opt-in — only renders when an
  // explicit narrative data block is provided AND the section toggle is on.
  // Most projects don't claim an NEC 220.87 existing-service path, so the
  // page is gated on data presence to avoid emitting an empty / boilerplate
  // sheet for the majority of packets.
  if (sections.nec22087Narrative && data.nec22087Narrative) {
    const narrative = data.nec22087Narrative;
    builders.push({
      name: 'NEC22087Narrative',
      kind: 'nec22087Narrative',
      band: BAND_CALCULATIONS,
      pageCount: 1,
      tocTitles: ['NEC 220.87 — Existing Service Capacity Verification'],
      render: (sheetIds) => (
        <NEC22087NarrativePage
          projectName={data.projectName}
          data={narrative}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  if (sections.voltageDrop && data.feeders && data.feeders.length > 0) {
    builders.push({
      name: 'VoltageDrop',
      kind: 'voltageDrop',
      band: BAND_CALCULATIONS,
      pageCount: 1,
      tocTitles: ['Voltage Drop Analysis'],
      render: (sheetIds) => (
        <VoltageDropPages
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          feeders={data.feeders}
          panels={data.panels}
          transformers={data.transformers}
          circuits={data.circuits}
          includeNECReferences={true}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  // Sprint 2A H9: Available Fault Current Calculation page — required by
  // Orlando new-service path. Selects the service-level entry from the
  // shortCircuitCalculations array (calculation_type === 'service'). When
  // no service-level entry exists, the section toggle auto-disables in the
  // UI and the builder is not pushed.
  if (sections.availableFaultCurrent && data.shortCircuitCalculations) {
    const serviceCalc = data.shortCircuitCalculations.find(
      c => c.calculation_type === 'service',
    );
    if (serviceCalc) {
      const input: AvailableFaultCurrentInput = {
        serviceAmps: serviceCalc.service_amps,
        serviceVoltage: serviceCalc.service_voltage,
        servicePhase: serviceCalc.service_phase,
        sourceFaultCurrent: serviceCalc.source_fault_current,
        transformerKVA: serviceCalc.transformer_kva,
        transformerImpedance: serviceCalc.transformer_impedance,
        serviceConductorSize: serviceCalc.service_conductor_size,
        serviceConductorMaterial: serviceCalc.service_conductor_material,
        serviceConductorLength: serviceCalc.service_conductor_length,
        // The `results` column is typed `Json` in the DB; the IEEE-141 engine
        // writes a structured block whose shape lines up with
        // ShortCircuitResultsBlock. Cast through `unknown` so the typecheck
        // doesn't over-constrain consumers of the raw Json column.
        results: (serviceCalc.results as unknown as AvailableFaultCurrentInput['results']) ?? null,
        notes: serviceCalc.notes,
      };
      builders.push({
        name: 'AvailableFaultCurrent',
        kind: 'availableFaultCurrent',
        band: BAND_CALCULATIONS,
        pageCount: 1,
        tocTitles: ['Available Fault Current — Service Main'],
        render: (sheetIds) => (
          <AvailableFaultCurrentPage
            projectName={data.projectName}
            projectAddress={data.projectAddress}
            input={input}
            {...contractor}
            sheetId={sheetIds[0]}
          />
        ),
      });
    }
  }

  if (sections.shortCircuit && data.shortCircuitCalculations && data.shortCircuitCalculations.length > 0) {
    // Single page with a row per panel. Replaces the prior per-panel page-per-builder loop,
    // which grew sheet count linearly with panel count. See PR description for rationale.
    builders.push({
      name: 'ShortCircuit',
      kind: 'shortCircuit',
      band: BAND_CALCULATIONS,
      pageCount: 1,
      tocTitles: ['Short Circuit Analysis'],
      render: (sheetIds) => (
        <ShortCircuitTablePages
          calculations={data.shortCircuitCalculations ?? []}
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  if (sections.arcFlash && data.arcFlashData) {
    const arcData = data.arcFlashData;
    builders.push({
      name: 'ArcFlash',
      kind: 'arcFlash',
      band: BAND_CALCULATIONS,
      pageCount: 1,
      tocTitles: ['Arc Flash Analysis'],
      render: (sheetIds) => (
        <ArcFlashPages
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          equipmentName={arcData.equipmentName}
          arcFlashData={arcData}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  // ---- Diagrams & equipment (band 200) ----
  if (sections.riserDiagram) {
    builders.push({
      name: 'RiserDiagram',
      kind: 'riserDiagram',
      band: BAND_DIAGRAMS,
      pageCount: 1,
      tocTitles: ['Riser Diagram'],
      render: (sheetIds) => (
        <RiserDiagram
          panels={data.panels}
          transformers={data.transformers}
          feeders={data.feeders}
          meterStacks={data.meterStacks}
          meters={data.meters}
          projectName={data.projectName}
          serviceVoltage={data.serviceVoltage}
          servicePhase={data.servicePhase}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  if (sections.equipmentSchedule) {
    builders.push({
      name: 'EquipmentSchedule',
      kind: 'equipmentSchedule',
      band: BAND_DIAGRAMS,
      pageCount: 1,
      tocTitles: ['Equipment Schedule'],
      render: (sheetIds) => (
        <EquipmentSchedule
          panels={data.panels}
          transformers={data.transformers}
          feeders={data.feeders}
          projectName={data.projectName}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  if (sections.equipmentSpecs) {
    builders.push({
      name: 'EquipmentSpecs',
      kind: 'equipmentSpecs',
      band: BAND_DIAGRAMS,
      pageCount: 1,
      tocTitles: ['Equipment Specifications'],
      render: (sheetIds) => (
        <EquipmentSpecsPages
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          panels={data.panels}
          transformers={data.transformers}
          circuits={data.circuits}
          includeNECReferences={true}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  if (sections.grounding) {
    // Sprint 2A PR 4 / M3: render the grounding page even when no
    // grounding_details DB row exists. The PDF derives a project-specific
    // GEC size from service ampacity via NEC Table 250.66 + standard
    // electrode/bonding catalogue, instead of falling back to generic
    // Article 250 boilerplate. When a DB row exists it is the source of
    // truth (preserves user-entered electrode/bonding selections + any
    // installed GEC override).
    const groundingDetail = data.groundingSystem ?? null;
    const mainPanel = sortedPanels.find(p => p.is_main);
    const serviceAmperage =
      mainPanel?.main_breaker_amps ?? mainPanel?.bus_rating ?? 200;
    builders.push({
      name: 'GroundingPlan',
      kind: 'grounding',
      band: BAND_DIAGRAMS,
      pageCount: 1,
      tocTitles: ['Grounding Plan'],
      render: (sheetIds) => (
        <GroundingPlanPages
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          grounding={groundingDetail}
          serviceAmperage={serviceAmperage}
          conductorMaterial="Cu"
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  // ---- Multi-family scope (band 400) ----
  if (sections.meterStack && data.meterStacks && data.meterStacks.length > 0 && data.meters) {
    const stacks = data.meterStacks;
    const meters = data.meters;
    const panels = data.panels;
    builders.push({
      name: 'MeterStackSchedule',
      kind: 'meterStack',
      band: BAND_MULTIFAMILY,
      pageCount: stacks.length,
      tocTitles: stacks.map((s, i) => `Meter Stack Schedule — ${s.name ?? `Stack ${i + 1}`}`),
      render: (sheetIds) => (
        <MeterStackScheduleDocument
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          meterStacks={stacks}
          meters={meters}
          panels={panels}
          {...contractor}
          sheetIds={sheetIds}
        />
      ),
    });
  }

  if (sections.multiFamilyEV && data.multiFamilyEVAnalysis) {
    const mfevData = data.multiFamilyEVAnalysis;
    builders.push({
      name: 'MultiFamilyEV',
      kind: 'multiFamilyEV',
      band: BAND_MULTIFAMILY,
      pageCount: 2,
      tocTitles: [
        'Multi-Family EV Readiness — Overview & Scenarios',
        'Multi-Family EV Readiness — Compliance & Load Breakdown',
      ],
      render: (sheetIds) => (
        <MultiFamilyEVPages
          result={mfevData.result}
          buildingName={mfevData.buildingName || data.projectName}
          {...contractor}
          sheetIds={sheetIds as [string, string]}
        />
      ),
    });
  }

  // ---- Compliance & AHJ (band 500) ----
  if (sections.complianceSummary) {
    builders.push({
      name: 'ComplianceSummary',
      kind: 'complianceSummary',
      band: BAND_COMPLIANCE,
      pageCount: 1,
      tocTitles: ['NEC Compliance Summary'],
      render: (sheetIds) => (
        <ComplianceSummary
          panels={data.panels}
          circuits={data.circuits}
          feeders={data.feeders}
          projectName={data.projectName}
          hasGrounding={data.hasGrounding}
          necEdition={data.necEdition}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  if (sections.jurisdiction && data.jurisdiction) {
    const jurisdiction = data.jurisdiction;
    builders.push({
      name: 'JurisdictionRequirements',
      kind: 'jurisdiction',
      band: BAND_COMPLIANCE,
      pageCount: 1,
      tocTitles: ['Jurisdiction Requirements Checklist'],
      render: (sheetIds) => (
        <JurisdictionRequirementsPages
          jurisdiction={jurisdiction}
          projectName={data.projectName}
          {...contractor}
          sheetId={sheetIds[0]}
          // Sprint 2C M1: engine-driven checklist. When `manifest` is
          // supplied, the renderer calls evaluatePacket() and groups the
          // result by category. When absent (legacy callers), falls back
          // to the pre-M1 decorative jurisdiction.required_documents
          // listing — see JurisdictionDocuments.tsx for the branch.
          manifest={data.manifest}
          ahjContext={ahjCtx}
          packet={packetAstRef.current}
          attachments={attachmentSummaries}
        />
      ),
    });
  }

  // ---- Specialty / scope-specific (band 600) ----
  // Sprint 2A H10: EVEMS operational narrative — only renders when at least
  // one EVEMS-managed panel is detected. Setpoint pulled from explicit marker
  // circuit (preferred); legacy projects without the marker get a "estimated"
  // breaker × voltage proxy with the source flag exposed in the output.
  if (sections.evemsNarrative) {
    const evemsPanels: EVEMSNarrativePanelEntry[] = sortedPanels
      .filter(p => isEVEMSManagedPanel(p.id, data.circuits))
      .map(p => {
        const marker = findEVEMSSetpointMarker(p.id, data.circuits);
        const explicitSetpointVA = marker?.load_watts ?? null;
        const phaseAsLit: 1 | 3 = p.phase === 3 ? 3 : 1;
        // Proxy fallback: panel main breaker × voltage. Bounds the setpoint
        // from above for legacy projects that pre-date the marker circuit.
        const proxyVA = p.main_breaker_amps && p.voltage
          ? p.main_breaker_amps * p.voltage * (phaseAsLit === 3 ? 1.732 : 1)
          : null;
        return {
          panelId: p.id,
          panelName: p.name,
          setpointVA: explicitSetpointVA && explicitSetpointVA > 0 ? explicitSetpointVA : proxyVA,
          hasExplicitMarker: !!(explicitSetpointVA && explicitSetpointVA > 0),
          mainBreakerAmps: p.main_breaker_amps ?? null,
          voltage: p.voltage,
          phase: phaseAsLit,
        };
      });
    if (evemsPanels.length > 0) {
      builders.push({
        name: 'EVEMSNarrative',
        kind: 'evemsNarrative',
        band: BAND_SPECIALTY,
        pageCount: 1,
        tocTitles: ['EVEMS Operational Narrative (NEC 625.42)'],
        render: (sheetIds) => (
          <EVEMSNarrativePage
            projectName={data.projectName}
            panels={evemsPanels}
            {...contractor}
            sheetId={sheetIds[0]}
          />
        ),
      });
    }
  }

  // Sprint 2A H11: EVSE labeling reference — applies to any EV-bank panel
  // (EVEMS-managed or not). Detection mirrors the H15 EquipmentSpecs card:
  // EVEMS marker circuit OR panel name pattern. The labeling page itself
  // is generic enough that even false positives just produce a useful
  // contractor reference.
  if (sections.evseLabeling) {
    const evNamePattern = /\b(ev|evse|charger|charging|level\s*2|l2)\b/i;
    const evseLabelingPanels: EVSELabelingPanelEntry[] = sortedPanels
      .filter(
        p => isEVEMSManagedPanel(p.id, data.circuits) || evNamePattern.test(p.name),
      )
      .map(p => {
        // Count the charger branch circuits for this panel (filter out the
        // EVEMS marker so the count reflects real chargers).
        const chargerCount = data.circuits.filter(
          c => c.panel_id === p.id && c.description && evNamePattern.test(c.description),
        ).length;
        return {
          panelId: p.id,
          panelName: p.name,
          chargerCircuitCount: chargerCount,
          location: p.location ?? undefined,
        };
      });
    if (evseLabelingPanels.length > 0) {
      const isCommercial = data.projectType === 'Commercial' || data.projectType === 'Industrial';
      builders.push({
        name: 'EVSELabeling',
        kind: 'evseLabeling',
        band: BAND_SPECIALTY,
        pageCount: 1,
        tocTitles: ['EVSE Labeling & Disconnect Requirements (NEC 625.43)'],
        render: (sheetIds) => (
          <EVSELabelingPage
            projectName={data.projectName}
            panels={evseLabelingPanels}
            isCommercial={isCommercial}
            {...contractor}
            sheetId={sheetIds[0]}
          />
        ),
      });
    }
  }

  // Synthesize virtual feeder-circuit rows for panels that feed downstream
  // sub-panels (e.g. an MDP feeding 14 sub-panels). Without this, the MDP
  // panel-schedule page renders "No circuits defined" because the MDP has no
  // direct branch circuits — it has feeders. NEC 408 requires the panel
  // schedule to show every protective device on the panel, including feeders.
  // Map projectType to NEC occupancy classification for the load aggregator.
  // Multi-family projects already pass a `multiFamilyContext` for the MDP
  // calc; the per-feeder synthesis below uses standard NEC 220 cascade for
  // each individual sub-panel's load (NEC 220.84 Optional Method applies at
  // the system aggregate, not at individual feeder sizing).
  const occupancyType: 'dwelling' | 'commercial' | 'industrial' =
    data.projectType === 'Residential'
      ? 'dwelling'
      : data.projectType === 'Industrial'
        ? 'industrial'
        : 'commercial';
  const synthesizeFeederCircuits = (panel: Panel, existing: Circuit[]): Circuit[] => {
    const downstreamPanels = data.panels.filter(
      p => p.fed_from_type === 'panel' && p.fed_from === panel.id,
    );
    if (downstreamPanels.length === 0) return [];

    // Slot allocator — alternate left (odd) / right (even), avoiding any slots
    // already taken by real circuits or by the slots a multi-pole circuit
    // occupies (a 2-pole at slot N occupies N and N+2; 3-pole occupies
    // N, N+2, N+4).
    const occupied = new Set<number>();
    for (const c of existing) {
      const span = c.pole === 3 ? 3 : c.pole === 2 ? 2 : 1;
      for (let i = 0; i < span; i++) {
        occupied.add(c.circuit_number + i * 2);
      }
    }

    let leftSlot = 1;
    let rightSlot = 2;
    let useLeft = true;
    const advanceLeft = (poles: number) => {
      leftSlot += poles === 3 ? 6 : poles === 2 ? 4 : 2;
    };
    const advanceRight = (poles: number) => {
      rightSlot += poles === 3 ? 6 : poles === 2 ? 4 : 2;
    };
    const findFreeSlot = (poles: number): number => {
      const span = poles === 3 ? 3 : poles === 2 ? 2 : 1;
      while (true) {
        const candidate = useLeft ? leftSlot : rightSlot;
        const slots: number[] = [];
        for (let i = 0; i < span; i++) slots.push(candidate + i * 2);
        const free = slots.every(s => !occupied.has(s));
        if (free) {
          slots.forEach(s => occupied.add(s));
          if (useLeft) advanceLeft(poles);
          else advanceRight(poles);
          useLeft = !useLeft;
          return candidate;
        }
        if (useLeft) advanceLeft(poles);
        else advanceRight(poles);
      }
    };

    return downstreamPanels.map(dp => {
      const dpLoad = calculateAggregatedLoad(
        dp.id,
        data.panels,
        data.circuits,
        data.transformers,
        occupancyType,
      );
      const breakerAmps = dp.feeder_breaker_amps || dp.main_breaker_amps || 100;
      const pole = (dp.phase === 3 ? 3 : 2) as 1 | 2 | 3;
      const slot = findFreeSlot(pole);
      return {
        id: `synth-feeder-${panel.id}-${dp.id}`,
        project_id: panel.project_id,
        panel_id: panel.id,
        circuit_number: slot,
        description: `→ PANEL ${dp.name}`,
        breaker_amps: breakerAmps,
        pole,
        load_watts: dpLoad.totalDemandVA,
        load_type: 'O',
        conductor_size: null,
        conductor_type: null,
        conductor_material: null,
        feeder_id: null,
        is_continuous_load: null,
        notes: 'Synthesized feeder row — represents downstream panel demand (NEC 408)',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as unknown as Circuit;
    });
  };

  // ---- Panel schedules (band 300) — one builder per panel ----
  if (sections.panelSchedules) {
    sortedPanels.forEach((panel) => {
      const panelCircuits = circuitsByPanel.get(panel.id) || [];
      const feederRows = synthesizeFeederCircuits(panel, panelCircuits);
      const allCircuits = [...panelCircuits, ...feederRows];
      builders.push({
        name: `PanelSchedule[${panel.name}]`,
        kind: 'panelSchedule',
        band: BAND_PANELS,
        pageCount: 1,
        tocTitles: [`Panel Schedule — ${panel.name}`],
        render: (sheetIds) => (
          <PanelSchedulePages
            panel={panel}
            circuits={allCircuits}
            projectName={data.projectName}
            projectAddress={data.projectAddress}
            {...contractor}
            sheetId={sheetIds[0]}
            showExistingNewMarkers={
              !!data.serviceModificationType && data.serviceModificationType !== 'new-service'
            }
          />
        ),
      });
    });
  }

  // ============================================================================
  // SHEET ID ALLOCATION + TOC ASSEMBLY
  // ============================================================================
  // Walk the filtered builder list once to allocate banded sheet IDs (uses
  // per-band counters so each category numbers from its base independently),
  // then walk again to populate TOC entries from the assigned IDs. The cover
  // and TOC entries themselves are excluded from the TOC list — they're
  // implicit. Finally, render each builder into its React element with the
  // allocated sheet IDs and the populated TOC entries injected.

  // Sprint 2C M1: SparkPlan-generated electrical sheets use the manifest's
  // sheetIdPrefix when supplied (Miami-Dade declares 'EL-' per H20; Orlando
  // sticks with 'E-'). Backward compat: when no manifest, falls back to 'E'
  // (Sprint 2A default). User-uploaded attachment discipline letters
  // (C/X/A/S/M/P) are handled separately downstream and are NOT affected.
  const generatedDiscipline = data.manifest?.sheetIdPrefix
    ? disciplineFromSheetIdPrefix(data.manifest.sheetIdPrefix)
    : SHEET_DISCIPLINE_ELECTRICAL;

  const counters = newBandCounters();
  const allocatedIds: string[][] = builders.map((b) => {
    if (b.band === undefined) return [];
    const ids: string[] = [];
    for (let i = 0; i < b.pageCount; i++) {
      ids.push(nextSheetId(counters, b.band, generatedDiscipline));
    }
    return ids;
  });

  const tocEntries: TocEntry[] = [];
  builders.forEach((b, i) => {
    if (b.kind === 'cover' || b.kind === 'tableOfContents') return;
    allocatedIds[i].forEach((sheetId, j) => {
      tocEntries.push({
        sheetId,
        title: b.tocTitles[j] ?? b.name,
      });
    });
  });

  // Sprint 2C M1: assemble the read-only PacketAST the checklist engine
  // consumes. `sheetIds` is the flattened list of every allocated ID in
  // render order (engine locators walk this to find specific sheets);
  // `sectionKeys` is the list of section toggles currently ON (engine
  // detect predicates use this to check "is the load-calc section in the
  // packet?"). We compute this AFTER allocation so it's authoritative,
  // then mutate `packetAstRef.current` so the jurisdiction builder's
  // render lambda (which closed over the ref above) sees the populated
  // value when invoked below.
  const allSheetIds: string[] = allocatedIds.flat();
  const enabledSectionKeys: SectionKey[] = (
    Object.entries(sections) as Array<[SectionKey, boolean]>
  )
    .filter(([, on]) => on === true)
    .map(([key]) => key);
  packetAstRef.current = {
    sheetIds: allSheetIds,
    sectionKeys: enabledSectionKeys,
  };

  const pages: Array<{ name: string; element: React.ReactElement }> = builders.map((b, i) => ({
    name: b.name,
    element: b.render(allocatedIds[i], tocEntries),
  }));

  console.log('[permit-packet] pages assembled:', pages.length, pages.map(p => p.name));
  console.log('[permit-packet] sheet IDs:', builders.map((b, i) => `${b.name} → ${allocatedIds[i].join(', ') || '(none)'}`));

  const fileName = `Permit_Packet_${data.projectName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

  // First attempt: render the complete packet together.
  try {
    const FullDoc = () => (
      <Document>
        {pages.map((p, i) => React.cloneElement(p.element, { key: `${p.name}-${i}` }))}
      </Document>
    );
    const sparkplanBlob = await pdf(<FullDoc />).toBlob();
    if (!sparkplanBlob || sparkplanBlob.size === 0) {
      throw new Error('PDF blob was empty');
    }

    // ====================================================================
    // SPRINT 2B PR-3: merge user-uploaded artifacts behind title sheets.
    // ====================================================================
    // If the caller supplied attachments, we (a) render a size-matched
    // title sheet per upload, (b) call mergePacket to splice them in
    // behind the SparkPlan electrical portion, and (c) stamp continuous
    // sheet IDs onto the upload pages. When no attachments are present,
    // download the SparkPlan portion as-is (legacy behavior).
    if (!data.attachments || data.attachments.length === 0) {
      downloadBlob(sparkplanBlob, fileName);
      console.log('[permit-packet] SUCCESS (no attachments)', {
        bytes: sparkplanBlob.size,
        fileName,
      });
      return;
    }

    const sparkplanBytes = new Uint8Array(await sparkplanBlob.arrayBuffer());
    // mergePacket re-loads the SparkPlan bytes via pdf-lib and reads the
    // actual page count off the rendered output — that's authoritative.
    // We don't need to sum builders.pageCount manually here.

    // Sort attachments: civil first (site_plan, survey, hvhz_anchoring),
    // then manufacturer (cut_sheet, fire_stopping, manufacturer_data, noc,
    // hoa_letter). Within each discipline, preserve insertion order.
    const CIVIL_TYPES: ReadonlySet<ArtifactType> = new Set([
      'site_plan',
      'survey',
      'hvhz_anchoring',
    ]);
    const disciplineOf = (t: ArtifactType): SheetDiscipline =>
      CIVIL_TYPES.has(t) ? SHEET_DISCIPLINE_CIVIL : SHEET_DISCIPLINE_MANUFACTURER;

    const sortedAttachments = [...data.attachments].sort((a, b) => {
      const da = disciplineOf(a.artifactType);
      const db = disciplineOf(b.artifactType);
      if (da === db) return 0;
      return da === SHEET_DISCIPLINE_CIVIL ? -1 : 1;
    });

    // Per-discipline counters for sheet ID allocation, starting at band 200.
    // Civil + manufacturer share the BAND_DIAGRAMS (200-299) band — the
    // discipline letter (C vs X) distinguishes them so AHJs can reference
    // "C-201 site plan" or "X-203 cut sheet" without ambiguity.
    // Per-AHJ band-specific assignments are deferred to Sprint 2C / PR-4.
    const uploadCounters = newBandCounters();
    const allocateId = (discipline: SheetDiscipline): string =>
      nextSheetId(uploadCounters, BAND_DIAGRAMS, discipline);

    // Render title sheets + allocate sheet IDs per attachment.
    // `hasCover === false` means: no SparkPlan title sheet, no sheet-ID
    // stamps — the upload is appended as-is. We still process it through
    // the merge engine so it lands in the merged output in the right
    // discipline order; mergePacket recognizes a zero-byte titleSheetBytes
    // as "skip title page" and stampSheetIds skips empty sheet IDs.
    const mergeInputs: Array<{
      label: string;
      titleSheetBytes: Uint8Array;
      uploadBytes: Uint8Array;
      sheetIdRange: string[];
      hasCover: boolean;
      /** v4 commit 15: overlay-mode flag — composite pages get stamped. */
      overlay?: boolean;
    }> = [];

    for (const att of sortedAttachments) {
      // v5 commit 17: per-upload discipline letter override. When set,
      // the contractor-supplied letter replaces the auto-determined
      // value but the band counter keeps advancing normally so adjacent
      // auto-allocated sheets stay continuous. When NULL, falls back to
      // disciplineOf(artifactType) (the v3 behavior).
      const overrideLetter = att.disciplineOverride?.trim().toUpperCase();
      const discipline: SheetDiscipline = overrideLetter
        ? (overrideLetter as SheetDiscipline)
        : disciplineOf(att.artifactType);
      // v4 commit 15: 3-state cover mode (separate / overlay / none).
      // Default 'separate' preserves existing behavior for callers / DB
      // rows that pre-date the cover_mode column.
      const coverMode: CoverMode = att.coverMode ?? 'separate';

      // Pre-flight: parse the upload to (a) detect first-page dimensions
      // for the size-aware title sheet/block and (b) count pages so we
      // allocate the right number of stamp IDs. If pdf-lib can't parse
      // the upload here, skip the attachment now — that keeps the
      // sheet-ID counter aligned with what actually ends up in the
      // merged output.
      let pageSize: [number, number] = [612, 792];
      let uploadPageCount = 0;
      try {
        const { PDFDocument } = await import('pdf-lib');
        const probe = await PDFDocument.load(att.uploadBytes, {
          ignoreEncryption: true,
          throwOnInvalidObject: false,
        });
        if (probe.getPageCount() === 0) {
          console.warn(
            '[permit-packet] skipping attachment with zero pages:',
            att.filename,
          );
          continue;
        }
        const first = probe.getPage(0).getSize();
        pageSize = [first.width, first.height];
        uploadPageCount = probe.getPageCount();
      } catch (probeErr) {
        console.warn(
          '[permit-packet] could not parse attachment, skipping:',
          att.filename,
          probeErr,
        );
        continue;
      }

      const customTitle = att.customSheetId?.trim() || null;

      if (coverMode === 'separate') {
        // SparkPlan title sheet as its own page preceding the upload.
        // Custom ID honors the contractor override; counter slot stays
        // untouched when honored so the next upload's auto-allocation
        // remains continuous.
        const titleSheetId = customTitle ?? allocateId(discipline);
        const uploadPageIds: string[] = [];
        for (let i = 0; i < uploadPageCount; i++) {
          uploadPageIds.push(allocateId(discipline));
        }

        const titleSheetBlob = await pdf(
          <Document>
            <AttachmentTitleSheet
              sheetId={titleSheetId}
              artifactType={att.artifactType}
              displayTitle={att.displayTitle}
              contractorName={data.contractorName ?? data.preparedBy}
              contractorLicense={data.contractorLicense}
              projectName={data.projectName}
              projectAddress={data.projectAddress}
              permitNumber={data.permitNumber}
              dateReceived={att.uploadedAt}
              pageSize={pageSize}
            />
          </Document>,
        ).toBlob();
        const titleSheetBytes = new Uint8Array(await titleSheetBlob.arrayBuffer());

        mergeInputs.push({
          label: att.filename,
          titleSheetBytes,
          uploadBytes: att.uploadBytes,
          sheetIdRange: [titleSheetId, ...uploadPageIds],
          hasCover: true,
        });
      } else if (coverMode === 'overlay') {
        // SparkPlan title block composited ONTO each upload page. We
        // allocate ONE sheet ID per upload page (the composite page IS
        // the only page) — the contractor's custom ID (if supplied)
        // is applied to the first composite page only. Subsequent
        // composite pages auto-allocate.
        const firstCompositeId = customTitle ?? allocateId(discipline);
        const compositePageIds: string[] = [firstCompositeId];
        for (let i = 1; i < uploadPageCount; i++) {
          compositePageIds.push(allocateId(discipline));
        }

        // Render the title block at the upload's first-page size, then
        // composite onto every page of the upload.
        const titleBlockBlob = await pdf(
          <Document>
            <AttachmentTitleBlock
              sheetId={firstCompositeId}
              artifactType={att.artifactType}
              displayTitle={att.displayTitle}
              contractorName={data.contractorName ?? data.preparedBy}
              contractorLicense={data.contractorLicense}
              projectName={data.projectName}
              projectAddress={data.projectAddress}
              permitNumber={data.permitNumber}
              dateReceived={att.uploadedAt}
              pageSize={pageSize}
            />
          </Document>,
        ).toBlob();
        const titleBlockBytes = new Uint8Array(await titleBlockBlob.arrayBuffer());

        const composite = await compositeTitleBlock({
          uploadBytes: att.uploadBytes,
          titleBlockBytes,
          sheetId: firstCompositeId,
          label: att.filename,
        });
        if (composite.warnings.length > 0) {
          console.warn(
            '[permit-packet] overlay warnings for',
            att.filename,
            composite.warnings,
          );
        }

        // Push as a no-title-sheet merge input. The composite IS the
        // upload pages; stampSheetIds will stamp each composite page
        // with its sheet ID. Use the overlay sentinel by passing
        // hasCover=false (no title-sheet insertion) AND a non-empty
        // sheet ID range — the stamp map builder treats a non-empty ID
        // with hasCover=false as a stamp-on-upload signal.
        mergeInputs.push({
          label: att.filename,
          titleSheetBytes: new Uint8Array(0),
          uploadBytes: composite.composedPdf,
          sheetIdRange: compositePageIds,
          hasCover: false,
          // v4 commit 15: overlay mode flag — overrides the
          // shouldStamp=false default for cover-OFF attachments so
          // composite pages get a sheet ID stamp.
          overlay: true,
        });
      } else {
        // coverMode === 'none' — upload appended as-is, no title sheet,
        // no stamping. Architect's own title block / numbering carries
        // the identifier.
        const blankIds = new Array(uploadPageCount).fill('');
        mergeInputs.push({
          label: att.filename,
          titleSheetBytes: new Uint8Array(0),
          uploadBytes: att.uploadBytes,
          sheetIdRange: blankIds,
          hasCover: false,
        });
      }
    }

    // Run the merge.
    const merge = await mergePacket(sparkplanBytes, mergeInputs);
    if (merge.warnings.length > 0) {
      console.warn('[permit-packet] merge warnings:', merge.warnings);
    }

    // Build the stamp maps + run the stamp pass. `mergeInputs` already
    // contains only the attachments that probed successfully above, so
    // it aligns with the merged output 1:1.
    const maps = buildStampMaps({
      sparkplanPageCount: merge.sparkplanPageCount,
      attachments: mergeInputs,
    });
    const stamped = await stampSheetIds({
      merged: merge.bytes,
      sheetIdMap: maps.sheetIdMap,
      shouldStamp: maps.shouldStamp,
    });
    if (stamped.warnings.length > 0) {
      console.warn('[permit-packet] stamp warnings:', stamped.warnings);
    }

    const finalBlob = new Blob([stamped.bytes], { type: 'application/pdf' });
    downloadBlob(finalBlob, fileName);
    console.log('[permit-packet] SUCCESS (with attachments)', {
      bytes: finalBlob.size,
      fileName,
      sparkplanPages: merge.sparkplanPageCount,
      mergedAttachments: merge.mergedAttachmentCount,
      stampedPages: stamped.stampedCount,
    });
    return;
  } catch (fullErr) {
    console.error('[permit-packet] full-document render failed, bisecting...', fullErr);

    // Bisect: try each Page alone.
    const results: Array<{ name: string; ok: boolean; error?: string; stack?: string }> = [];
    for (const { name, element } of pages) {
      try {
        const SingleDoc = () => <Document>{element}</Document>;
        const blob = await pdf(<SingleDoc />).toBlob();
        results.push({ name, ok: !!blob && blob.size > 0 });
        console.log(`[permit-packet]   OK   ${name}`);
      } catch (pageErr) {
        const e = pageErr instanceof Error ? pageErr : new Error(String(pageErr));
        results.push({ name, ok: false, error: e.message, stack: e.stack });
        console.error(`[permit-packet]   FAIL ${name}:`, e);
      }
    }

    const failures = results.filter(r => !r.ok);
    const primaryMsg = fullErr instanceof Error ? fullErr.message : String(fullErr);
    const primaryStack = summarizeStack(fullErr);

    const report =
      `Permit packet generation failed.\n\n` +
      `Primary error: ${primaryMsg}\n` +
      `Primary stack:\n${primaryStack}\n\n` +
      (failures.length > 0
        ? `Failing pages in isolation (${failures.length}/${pages.length}):\n` +
          failures
            .map(
              f =>
                `  • ${f.name}\n    message: ${f.error}\n    stack: ${(f.stack || '')
                  .split('\n')
                  .slice(0, 4)
                  .join('\n           ')}`
            )
            .join('\n')
        : `All ${pages.length} pages render individually. ` +
          `Failure is in Document composition or a global font/style side-effect.`);

    console.error('[permit-packet] DIAGNOSTIC REPORT\n' + report);

    const diag = new Error(report);
    throw diag;
  }
};

/**
 * Generate a lightweight permit packet (without panel schedules)
 * Useful for quick submittal when panel schedules are submitted separately
 */
export const generateLightweightPermitPacket = async (data: PermitPacketData): Promise<void> => {
  try {
    console.log('Generating lightweight permit packet for project:', data.projectName);

    // Sprint 2B PR-4: mirror the full generator's manifest-fallback logic so
    // the lightweight path picks up Orlando general notes / code refs etc.
    // when only the manifest is supplied. Same behavior as
    // generatePermitPacket; kept here so the two paths stay aligned.
    const lwBuildingType: BuildingType =
      data.buildingType ?? 'single_family_residential';
    const lwNecFromManifest =
      data.manifest?.necEdition[lwBuildingType] ?? null;
    const lwResolvedNecEdition: '2020' | '2023' | undefined =
      data.necEdition
      ?? (lwNecFromManifest && lwNecFromManifest.includes('2023')
        ? '2023'
        : lwNecFromManifest && lwNecFromManifest.includes('2020')
        ? '2020'
        : undefined);
    data = {
      ...data,
      necEdition: lwResolvedNecEdition,
      generalNotes: data.generalNotes ?? data.manifest?.generalNotes,
      codeReferences: data.codeReferences ?? data.manifest?.codeReferences,
    };

    const contractor = {
      contractorName: data.contractorName ?? data.preparedBy,
      contractorLicense: data.contractorLicense,
    };

    const LightweightPacketDocument = () => (
      <Document>
        <CoverPage
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          projectType={data.projectType}
          serviceVoltage={data.serviceVoltage}
          servicePhase={data.servicePhase}
          preparedBy={data.preparedBy}
          permitNumber={data.permitNumber}
          necEdition={data.necEdition}
          codeReferences={data.codeReferences}
          permitMode={data.permitMode}
        />
        <EquipmentSchedule
          panels={data.panels}
          transformers={data.transformers}
          feeders={data.feeders}
          projectName={data.projectName}
          {...contractor}
        />
        <LoadCalculationSummary
          panels={data.panels}
          circuits={data.circuits}
          transformers={data.transformers}
          projectName={data.projectName}
          serviceVoltage={data.serviceVoltage}
          servicePhase={data.servicePhase}
          projectType={data.projectType}
          multiFamilyContext={data.multiFamilyContext}
          {...contractor}
        />
        <ComplianceSummary
          panels={data.panels}
          circuits={data.circuits}
          feeders={data.feeders}
          projectName={data.projectName}
          hasGrounding={data.hasGrounding}
          necEdition={data.necEdition}
          {...contractor}
        />
      </Document>
    );

    const blob = await pdf(<LightweightPacketDocument />).toBlob();

    if (!blob || blob.size === 0) {
      throw new Error('Failed to generate lightweight permit packet PDF blob');
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `Permit_Packet_Lightweight_${data.projectName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log('Lightweight permit packet PDF download triggered:', fileName);
  } catch (error) {
    console.error('Error generating lightweight permit packet:', error);
    throw error;
  }
};

