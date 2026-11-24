/**
 * Short Circuit Analysis PDF Export Service
 * Generates professional short circuit calculation reports
 * Uses @react-pdf/renderer for PDF generation
 */

import { Document, pdf } from '@react-pdf/renderer';
import type { ShortCircuitCalculation } from '../../lib/database.types';
import { ShortCircuitCalculationDocument, ShortCircuitTablePages } from './ShortCircuitDocuments';
import { localDateStamp } from '../../lib/localDate';

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
    const fileName = `ShortCircuit_${calculation.location_name.replace(/[^a-z0-9]/gi, '_')}_${localDateStamp()}.pdf`;
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
 * Export all short circuit calculations for a project to a single PDF.
 *
 * Renders the tabular ShortCircuitTablePages (single page, all panels) — the
 * same layout used in the permit-packet path. Replaces the legacy per-panel
 * paged ShortCircuitSystemReport so the two surfaces stay in sync.
 */
export const exportSystemReport = async (
  calculations: ShortCircuitCalculation[],
  projectName: string,
  projectAddress: string,
  /** Rows the Short Circuit page marks "Stale" (#289), marked the same way. */
  stale: Map<string, { reason: string }> | undefined,
  /** The project's panels: each row's NEC 110.9 status compares the entered rating at its point (#307). */
  panels: ReadonlyArray<{ id: string; name?: string; is_main?: boolean | null; aic_rating?: number | null }>,
) => {
  try {
    if (!calculations || calculations.length === 0) {
      throw new Error('No calculations to export');
    }

    const blob = await pdf(
      <Document>
        <ShortCircuitTablePages
          calculations={calculations}
          stale={stale}
          panels={panels}
          projectName={projectName}
          projectAddress={projectAddress}
          includeNECReferences={true}
        />
      </Document>
    ).toBlob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `ShortCircuit_Analysis_${projectName.replace(/[^a-z0-9]/gi, '_')}_${localDateStamp()}.pdf`;
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
