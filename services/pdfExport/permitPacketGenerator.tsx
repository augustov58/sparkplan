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
  type TocEntry,
  type RevisionEntry,
} from './PermitPacketDocuments';
import { PanelSchedulePages } from './PanelScheduleDocuments';
import { calculateAggregatedLoad } from '../calculations/upstreamLoadAggregation';
import { EquipmentSpecsPages } from './EquipmentSpecsDocuments';
import { VoltageDropPages } from './VoltageDropDocuments';
import { JurisdictionRequirementsPages } from './JurisdictionDocuments';
import { ShortCircuitCalculationPages } from './ShortCircuitDocuments';
import { ArcFlashPages } from './ArcFlashDocuments';
import { GroundingPlanPages } from './GroundingPlanDocuments';
import { MultiFamilyEVPages } from './MultiFamilyEVDocuments';
import { MeterStackScheduleDocument } from './MeterStackSchedulePDF';
import {
  type PacketSections,
  type SheetBand,
  resolveSections,
  newBandCounters,
  nextSheetId,
  BAND_FRONT_MATTER,
  BAND_CALCULATIONS,
  BAND_DIAGRAMS,
  BAND_PANELS,
  BAND_MULTIFAMILY,
  BAND_COMPLIANCE,
} from './packetSections';

export interface PermitPacketData {
  projectId: string;
  projectName: string;
  projectAddress: string;
  projectType: 'Residential' | 'Commercial' | 'Industrial';
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
    | 'jurisdiction';

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

  if (sections.shortCircuit && data.shortCircuitCalculations && data.shortCircuitCalculations.length > 0) {
    data.shortCircuitCalculations.forEach((calc, idx) => {
      builders.push({
        name: `ShortCircuit[${idx}:${calc.panel_name ?? calc.calculation_type ?? calc.id ?? '?'}]`,
        kind: 'shortCircuit',
        band: BAND_CALCULATIONS,
        pageCount: 1,
        tocTitles: [`Short Circuit Analysis — ${calc.panel_name ?? calc.calculation_type ?? 'System'}`],
        render: (sheetIds) => (
          <ShortCircuitCalculationPages
            calculation={calc}
            projectName={data.projectName}
            projectAddress={data.projectAddress}
            panelName={calc.calculation_type === 'panel' ? calc.panel_name : undefined}
            {...contractor}
            sheetId={sheetIds[0]}
          />
        ),
      });
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
          includeNECReferences={true}
          {...contractor}
          sheetId={sheetIds[0]}
        />
      ),
    });
  }

  if (sections.grounding && data.groundingSystem) {
    const groundingDetail = data.groundingSystem;
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
          serviceAmperage={sortedPanels.find(p => p.is_main)?.bus_rating || data.serviceVoltage}
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
      pageCount: 3,
      tocTitles: [
        'Multi-Family EV Readiness — System Overview',
        'Multi-Family EV Readiness — Capacity Scenarios',
        'Multi-Family EV Readiness — Compliance & Load Breakdown',
      ],
      render: (sheetIds) => (
        <MultiFamilyEVPages
          result={mfevData.result}
          buildingName={mfevData.buildingName || data.projectName}
          {...contractor}
          sheetIds={sheetIds as [string, string, string]}
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
        />
      ),
    });
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

  const counters = newBandCounters();
  const allocatedIds: string[][] = builders.map((b) => {
    if (b.band === undefined) return [];
    const ids: string[] = [];
    for (let i = 0; i < b.pageCount; i++) {
      ids.push(nextSheetId(counters, b.band));
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
    const blob = await pdf(<FullDoc />).toBlob();
    if (!blob || blob.size === 0) {
      throw new Error('PDF blob was empty');
    }
    downloadBlob(blob, fileName);
    console.log('[permit-packet] SUCCESS', { bytes: blob.size, fileName });
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

