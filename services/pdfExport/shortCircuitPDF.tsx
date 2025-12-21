/**
 * Short Circuit Analysis PDF Export Service
 * Generates professional short circuit calculation reports
 * Uses @react-pdf/renderer for PDF generation
 */

import { pdf } from '@react-pdf/renderer';
import type { ShortCircuitCalculation } from '../../lib/database.types';
import { ShortCircuitCalculationDocument, ShortCircuitSystemReport } from './ShortCircuitDocuments';

/**
 * Export a single short circuit calculation to PDF
 */
export const exportSingleCalculation = async (
  calculation: ShortCircuitCalculation,
  projectName: string,
  projectAddress?: string,
  panelName?: string
) => {
  try {
    const blob = await pdf(
      <ShortCircuitCalculationDocument
        calculation={calculation}
        projectName={projectName}
        projectAddress={projectAddress}
        panelName={panelName}
      />
    ).toBlob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `ShortCircuit_${calculation.location_name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    link.download = fileName;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log('PDF download triggered:', fileName);
  } catch (error) {
    console.error('Error exporting short circuit calculation PDF:', error);
    throw error;
  }
};

/**
 * Export all short circuit calculations for a project to a single PDF
 */
export const exportSystemReport = async (
  calculations: ShortCircuitCalculation[],
  projectName: string,
  projectAddress: string,
  panels?: any[]
) => {
  try {
    if (!calculations || calculations.length === 0) {
      throw new Error('No calculations to export');
    }

    const blob = await pdf(
      <ShortCircuitSystemReport
        calculations={calculations}
        projectName={projectName}
        projectAddress={projectAddress}
        panels={panels}
      />
    ).toBlob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `ShortCircuit_Analysis_${projectName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    link.download = fileName;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log('System report PDF download triggered:', fileName);
  } catch (error) {
    console.error('Error exporting system report PDF:', error);
    throw error;
  }
};
