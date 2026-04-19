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
import { PanelScheduleDocument } from './PanelScheduleDocuments';
import { EquipmentSpecsDocument } from './EquipmentSpecsDocuments';
import { VoltageDropDocument } from './VoltageDropDocuments';
import { JurisdictionRequirementsDocument } from './JurisdictionDocuments';
import { ShortCircuitCalculationDocument } from './ShortCircuitDocuments';
import { ArcFlashDocument } from './ArcFlashDocuments';
import { GroundingPlanDocument } from './GroundingPlanDocuments';
import { MultiFamilyEVDocument } from './MultiFamilyEVDocuments';
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
      />
    ),
  });

  pages.push({
    name: 'EquipmentSpecs',
    element: (
      <EquipmentSpecsDocument
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
        <VoltageDropDocument
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          feeders={data.feeders}
          panels={data.panels}
          transformers={data.transformers}
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
          <ShortCircuitCalculationDocument
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
        <ArcFlashDocument
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
        <GroundingPlanDocument
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
        <MultiFamilyEVDocument
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
        <JurisdictionRequirementsDocument
          jurisdiction={data.jurisdiction}
          projectName={data.projectName}
        />
      ),
    });
  }

  sortedPanels.forEach(panel => {
    const panelCircuits = circuitsByPanel.get(panel.id) || [];
    pages.push({
      name: `PanelSchedule[${panel.name}]`,
      element: (
        <PanelScheduleDocument
          panel={panel}
          circuits={panelCircuits}
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
        />
        <ComplianceSummary
          panels={data.panels}
          circuits={data.circuits}
          feeders={data.feeders}
          projectName={data.projectName}
          hasGrounding={data.hasGrounding}
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

