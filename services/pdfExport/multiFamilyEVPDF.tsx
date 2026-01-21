/**
 * Multi-Family EV Readiness PDF Export Service
 * Generates professional multi-family EV analysis reports
 * Uses @react-pdf/renderer for PDF generation
 */

import { pdf } from '@react-pdf/renderer';
import { MultiFamilyEVDocument } from './MultiFamilyEVDocuments';
import type { MultiFamilyEVResult } from '../calculations/multiFamilyEV';

/**
 * Export Multi-Family EV Analysis to PDF
 */
export const exportMultiFamilyEVAnalysis = async (
  result: MultiFamilyEVResult,
  buildingName?: string,
  preparedBy?: string,
  preparedFor?: string
) => {
  try {
    const blob = await pdf(
      <MultiFamilyEVDocument
        result={result}
        buildingName={buildingName}
        preparedBy={preparedBy}
        preparedFor={preparedFor}
      />
    ).toBlob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename
    const safeBuildingName = buildingName
      ? buildingName.replace(/[^a-z0-9]/gi, '_')
      : 'Building';
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `MultiFamilyEV_${safeBuildingName}_${dateStr}.pdf`;
    link.download = fileName;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 100);

    console.log('Multi-Family EV PDF download triggered:', fileName);
    return fileName;
  } catch (error) {
    console.error('Error exporting Multi-Family EV PDF:', error);
    throw error;
  }
};

/**
 * Generate PDF blob without triggering download
 * Useful for email attachments or preview
 */
export const generateMultiFamilyEVPDFBlob = async (
  result: MultiFamilyEVResult,
  buildingName?: string,
  preparedBy?: string,
  preparedFor?: string
): Promise<Blob> => {
  try {
    const blob = await pdf(
      <MultiFamilyEVDocument
        result={result}
        buildingName={buildingName}
        preparedBy={preparedBy}
        preparedFor={preparedFor}
      />
    ).toBlob();

    return blob;
  } catch (error) {
    console.error('Error generating Multi-Family EV PDF blob:', error);
    throw error;
  }
};
