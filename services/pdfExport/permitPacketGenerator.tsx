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

type GroundingDetail = Database['public']['Tables']['grounding_details']['Row'];
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
  riserDiagramSvg?: string; // SVG string of the one-line diagram
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
}

/**
 * Generate complete permit packet PDF
 * Includes: Cover page, Equipment schedule, Load summary, Compliance summary, Panel schedules
 */
export const generatePermitPacket = async (data: PermitPacketData): Promise<void> => {
  try {
    console.log('Generating permit packet for project:', data.projectName);

    // Validate required data
    if (!data.projectName || !data.panels || data.panels.length === 0) {
      throw new Error('Invalid permit packet data. Project name and at least one panel are required.');
    }

    // Group circuits by panel
    const circuitsByPanel = new Map<string, Circuit[]>();
    data.circuits.forEach(circuit => {
      const panelCircuits = circuitsByPanel.get(circuit.panel_id) || [];
      panelCircuits.push(circuit);
      circuitsByPanel.set(circuit.panel_id, panelCircuits);
    });

    // Sort panels: MDP first, then by name
    const sortedPanels = [...data.panels].sort((a, b) => {
      if (a.is_main && !b.is_main) return -1;
      if (!a.is_main && b.is_main) return 1;
      return a.name.localeCompare(b.name);
    });

    // Create the complete document with all pages
    const PermitPacketDocument = () => (
      <Document>
        {/* Cover Page */}
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

        {/* Equipment Schedule */}
        <EquipmentSchedule
          panels={data.panels}
          transformers={data.transformers}
          feeders={data.feeders}
          projectName={data.projectName}
        />

        {/* Riser Diagram */}
        <RiserDiagram
          panels={data.panels}
          transformers={data.transformers}
          feeders={data.feeders}
          projectName={data.projectName}
          serviceVoltage={data.serviceVoltage}
          servicePhase={data.servicePhase}
        />

        {/* Load Calculation Summary */}
        <LoadCalculationSummary
          panels={data.panels}
          circuits={data.circuits}
          projectName={data.projectName}
          serviceVoltage={data.serviceVoltage}
          servicePhase={data.servicePhase}
        />

        {/* NEC Compliance Summary */}
        <ComplianceSummary
          panels={data.panels}
          circuits={data.circuits}
          feeders={data.feeders}
          projectName={data.projectName}
          hasGrounding={data.hasGrounding}
        />

        {/* Equipment Specifications (Tier 2) */}
        <EquipmentSpecsDocument
          projectName={data.projectName}
          projectAddress={data.projectAddress}
          panels={data.panels}
          transformers={data.transformers}
          includeNECReferences={true}
        />

        {/* Voltage Drop Report (Tier 2) */}
        {data.feeders && data.feeders.length > 0 && (
          <VoltageDropDocument
            projectName={data.projectName}
            projectAddress={data.projectAddress}
            feeders={data.feeders}
            panels={data.panels}
            transformers={data.transformers}
            includeNECReferences={true}
          />
        )}

        {/* Short Circuit Analysis (Tier 2) */}
        {data.shortCircuitCalculations && data.shortCircuitCalculations.length > 0 && (
          <>
            {data.shortCircuitCalculations.map((calc, index) => (
              <ShortCircuitCalculationDocument
                key={calc.id || index}
                calculation={calc}
                projectName={data.projectName}
                projectAddress={data.projectAddress}
                panelName={calc.calculation_type === 'panel' ? calc.panel_name : undefined}
              />
            ))}
          </>
        )}

        {/* Arc Flash Analysis (Tier 2) */}
        {data.arcFlashData && (
          <ArcFlashDocument
            projectName={data.projectName}
            projectAddress={data.projectAddress}
            equipmentName={data.arcFlashData.equipmentName}
            arcFlashData={data.arcFlashData}
          />
        )}

        {/* Grounding Plan (Tier 2) */}
        {data.groundingSystem && (
          <GroundingPlanDocument
            projectName={data.projectName}
            projectAddress={data.projectAddress}
            grounding={data.groundingSystem}
            serviceAmperage={sortedPanels.find(p => p.is_main)?.bus_rating || data.serviceVoltage}
            conductorMaterial="Cu"
          />
        )}

        {/* Jurisdiction Requirements Checklist (Tier 3) */}
        {data.jurisdiction && (
          <JurisdictionRequirementsDocument
            jurisdiction={data.jurisdiction}
            projectName={data.projectName}
          />
        )}

        {/* Panel Schedules - One page per panel */}
        {sortedPanels.map(panel => {
          const panelCircuits = circuitsByPanel.get(panel.id) || [];
          return (
            <PanelScheduleDocument
              key={panel.id}
              panel={panel}
              circuits={panelCircuits}
              projectName={data.projectName}
              projectAddress={data.projectAddress}
            />
          );
        })}
      </Document>
    );

    // Generate PDF blob
    const blob = await pdf(<PermitPacketDocument />).toBlob();

    console.log('Permit packet PDF blob generated, size:', blob.size);

    if (!blob || blob.size === 0) {
      throw new Error('Failed to generate permit packet PDF blob');
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `Permit_Packet_${data.projectName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    link.download = fileName;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log('Permit packet PDF download triggered:', fileName);
  } catch (error) {
    console.error('Error generating permit packet:', error);
    throw error;
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
          projectName={data.projectName}
          serviceVoltage={data.serviceVoltage}
          servicePhase={data.servicePhase}
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

