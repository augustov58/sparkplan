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
  EquipmentSchedule,
  RiserDiagram,
  LoadCalculationSummary,
  ComplianceSummary
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

  // Build labeled Page list. Each entry is ONE top-level <Page> in the Document.
  // Keep names unique and descriptive so bisect output is actionable.
  const pages: Array<{ name: string; element: React.ReactElement }> = [];

  pages.push({
    name: 'CoverPage',
    element: (
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
      />
    ),
  });

  pages.push({
    name: 'EquipmentSchedule',
    element: (
      <EquipmentSchedule
        panels={data.panels}
        transformers={data.transformers}
        feeders={data.feeders}
        projectName={data.projectName}
      />
    ),
  });

  pages.push({
    name: 'RiserDiagram',
    element: (
      <RiserDiagram
        panels={data.panels}
        transformers={data.transformers}
        feeders={data.feeders}
        meterStacks={data.meterStacks}
        meters={data.meters}
        projectName={data.projectName}
        serviceVoltage={data.serviceVoltage}
        servicePhase={data.servicePhase}
      />
    ),
  });

  pages.push({
    name: 'LoadCalculationSummary',
    element: (
      <LoadCalculationSummary
        panels={data.panels}
        circuits={data.circuits}
        transformers={data.transformers}
        projectName={data.projectName}
        serviceVoltage={data.serviceVoltage}
        servicePhase={data.servicePhase}
        projectType={data.projectType}
        multiFamilyContext={data.multiFamilyContext}
      />
    ),
  });

  pages.push({
    name: 'ComplianceSummary',
    element: (
      <ComplianceSummary
        panels={data.panels}
        circuits={data.circuits}
        feeders={data.feeders}
        projectName={data.projectName}
        hasGrounding={data.hasGrounding}
        necEdition={data.necEdition}
      />
    ),
  });

  pages.push({
    name: 'EquipmentSpecs',
    element: (
      <EquipmentSpecsPages
        projectName={data.projectName}
        projectAddress={data.projectAddress}
        panels={data.panels}
        transformers={data.transformers}
        includeNECReferences={true}
      />
    ),
  });

  if (data.feeders && data.feeders.length > 0) {
    pages.push({
      name: 'VoltageDrop',
      element: (
        <VoltageDropPages
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          feeders={data.feeders}
          panels={data.panels}
          transformers={data.transformers}
          circuits={data.circuits}
          includeNECReferences={true}
        />
      ),
    });
  }

  if (data.shortCircuitCalculations && data.shortCircuitCalculations.length > 0) {
    data.shortCircuitCalculations.forEach((calc, idx) => {
      pages.push({
        name: `ShortCircuit[${idx}:${calc.panel_name ?? calc.calculation_type ?? calc.id ?? '?'}]`,
        element: (
          <ShortCircuitCalculationPages
            calculation={calc}
            projectName={data.projectName}
            projectAddress={data.projectAddress}
            panelName={calc.calculation_type === 'panel' ? calc.panel_name : undefined}
          />
        ),
      });
    });
  }

  if (data.arcFlashData) {
    pages.push({
      name: 'ArcFlash',
      element: (
        <ArcFlashPages
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          equipmentName={data.arcFlashData.equipmentName}
          arcFlashData={data.arcFlashData}
        />
      ),
    });
  }

  if (data.groundingSystem) {
    pages.push({
      name: 'GroundingPlan',
      element: (
        <GroundingPlanPages
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          grounding={data.groundingSystem}
          serviceAmperage={sortedPanels.find(p => p.is_main)?.bus_rating || data.serviceVoltage}
          conductorMaterial="Cu"
        />
      ),
    });
  }

  if (data.meterStacks && data.meterStacks.length > 0 && data.meters) {
    pages.push({
      name: 'MeterStackSchedule',
      element: (
        <MeterStackScheduleDocument
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          meterStacks={data.meterStacks}
          meters={data.meters}
          panels={data.panels}
        />
      ),
    });
  }

  if (data.multiFamilyEVAnalysis) {
    pages.push({
      name: 'MultiFamilyEV',
      element: (
        <MultiFamilyEVPages
          result={data.multiFamilyEVAnalysis.result}
          buildingName={data.multiFamilyEVAnalysis.buildingName || data.projectName}
        />
      ),
    });
  }

  if (data.jurisdiction) {
    pages.push({
      name: 'JurisdictionRequirements',
      element: (
        <JurisdictionRequirementsPages
          jurisdiction={data.jurisdiction}
          projectName={data.projectName}
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

  sortedPanels.forEach(panel => {
    const panelCircuits = circuitsByPanel.get(panel.id) || [];
    const feederRows = synthesizeFeederCircuits(panel, panelCircuits);
    const allCircuits = [...panelCircuits, ...feederRows];
    pages.push({
      name: `PanelSchedule[${panel.name}]`,
      element: (
        <PanelSchedulePages
          panel={panel}
          circuits={allCircuits}
          projectName={data.projectName}
          projectAddress={data.projectAddress}
        />
      ),
    });
  });

  console.log('[permit-packet] pages assembled:', pages.length, pages.map(p => p.name));

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
        />
        <ComplianceSummary
          panels={data.panels}
          circuits={data.circuits}
          feeders={data.feeders}
          projectName={data.projectName}
          hasGrounding={data.hasGrounding}
          necEdition={data.necEdition}
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

