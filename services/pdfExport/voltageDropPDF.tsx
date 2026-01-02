/**
 * Voltage Drop Report PDF Export Service
 *
 * Exports voltage drop analysis as PDF following existing export patterns.
 * Generates standalone PDF or integrates with permit packet generator.
 *
 * @module services/pdfExport/voltageDropPDF
 */

import { pdf } from '@react-pdf/renderer';
import { VoltageDropDocument } from './VoltageDropDocuments';

// ============================================================================
// TYPES (matching database schema)
// ============================================================================

interface Feeder {
  id: string;
  name: string;
  from_panel_id: string | null;
  to_panel_id: string | null;
  voltage: number;
  phase: number;
  calculated_load_va: number | null;
  length_feet: number | null;
  conductor_material: string | null;
  conductor_size: string | null;
}

interface Panel {
  id: string;
  name: string;
  voltage: number;
  phase: 1 | 3;
  bus_rating: number;
  location?: string;
}

interface Transformer {
  id: string;
  name: string;
  kva_rating: number;
  primary_voltage: number;
  secondary_voltage: number;
  location?: string;
}

// ============================================================================
// EXPORT FUNCTION
// ============================================================================

/**
 * Export Voltage Drop Analysis as PDF
 *
 * Generates and downloads a professional voltage drop analysis report for
 * electrical permit applications and design review.
 *
 * @param projectName - Project name for header
 * @param feeders - Array of feeders to analyze
 * @param panels - Array of panels (for feeder endpoints)
 * @param transformers - Array of transformers (for feeder endpoints)
 * @param projectAddress - Optional project address
 * @param includeNECReferences - Include NEC code references (default: true)
 * @returns Promise that resolves when export completes
 *
 * @throws {Error} If PDF generation fails
 *
 * @example
 * ```typescript
 * await exportVoltageDropReport(
 *   'Commercial Office Building',
 *   feeders,
 *   panels,
 *   transformers,
 *   '123 Main St, City, State 12345'
 * );
 * ```
 */
export async function exportVoltageDropReport(
  projectName: string,
  feeders: Feeder[],
  panels: Panel[],
  transformers: Transformer[],
  projectAddress?: string,
  includeNECReferences: boolean = true
): Promise<void> {
  // Validation
  if (!projectName || projectName.trim() === '') {
    throw new Error('Project name is required for voltage drop report export');
  }

  if (feeders.length === 0) {
    throw new Error('No feeders found. Add feeders to generate voltage drop report.');
  }

  try {
    // Generate PDF blob
    const blob = await pdf(
      <VoltageDropDocument
        projectName={projectName}
        projectAddress={projectAddress}
        feeders={feeders}
        panels={panels}
        transformers={transformers}
        includeNECReferences={includeNECReferences}
      />
    ).toBlob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename: Voltage_Drop_Report_ProjectName_YYYY-MM-DD.pdf
    const sanitizedProjectName = projectName.replace(/[^a-z0-9]/gi, '_');
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    link.download = `Voltage_Drop_Report_${sanitizedProjectName}_${dateStr}.pdf`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);

    // Revoke object URL after short delay to ensure download started
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);

  } catch (error) {
    console.error('Voltage drop report PDF export failed:', error);
    throw new Error(`Failed to export voltage drop report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if project has feeders with voltage drop data
 *
 * Useful for showing/hiding export button or displaying warnings.
 *
 * @param feeders - Array of feeders to check
 * @returns True if at least one feeder has length and load data
 *
 * @example
 * ```typescript
 * if (hasVoltageDropData(feeders)) {
 *   return <button onClick={handleExport}>Export Voltage Drop Report</button>;
 * }
 * ```
 */
export function hasVoltageDropData(feeders: Feeder[]): boolean {
  return feeders.some(feeder =>
    (feeder.distance_ft !== null && feeder.distance_ft > 0) &&
    (feeder.total_load_va !== null && feeder.total_load_va > 0)
  );
}

/**
 * Get count of feeders with complete voltage drop data
 *
 * Returns counts for display purposes (total feeders vs. feeders with data).
 *
 * @param feeders - Array of feeders to check
 * @returns Object with totalFeeders and feedersWithData counts
 *
 * @example
 * ```typescript
 * const { totalFeeders, feedersWithData } = getVoltageDropDataCount(feeders);
 * console.log(`${feedersWithData} of ${totalFeeders} feeders have voltage drop data`);
 * ```
 */
export function getVoltageDropDataCount(feeders: Feeder[]): {
  totalFeeders: number;
  feedersWithData: number;
  feedersWithoutData: number;
} {
  const totalFeeders = feeders.length;
  const feedersWithData = feeders.filter(feeder =>
    (feeder.distance_ft !== null && feeder.distance_ft > 0) &&
    (feeder.total_load_va !== null && feeder.total_load_va > 0)
  ).length;
  const feedersWithoutData = totalFeeders - feedersWithData;

  return {
    totalFeeders,
    feedersWithData,
    feedersWithoutData,
  };
}

/**
 * Validate feeders have minimum data for voltage drop calculation
 *
 * Returns list of feeders missing required data for user feedback.
 *
 * @param feeders - Array of feeders to validate
 * @returns Object with validation status and missing data details
 *
 * @example
 * ```typescript
 * const validation = validateFeedersForVoltageDropReport(feeders);
 * if (!validation.isValid) {
 *   console.warn('Feeders missing data:', validation.feedersWithIssues);
 * }
 * ```
 */
export function validateFeedersForVoltageDropReport(feeders: Feeder[]): {
  isValid: boolean;
  feedersWithIssues: Array<{
    feederName: string;
    missingFields: string[];
  }>;
} {
  const feedersWithIssues = feeders.map(feeder => {
    const missingFields: string[] = [];

    if (!feeder.distance_ft || feeder.distance_ft <= 0) {
      missingFields.push('distance_ft');
    }
    if (!feeder.total_load_va || feeder.total_load_va <= 0) {
      missingFields.push('total_load_va');
    }
    if (!feeder.conductor_size) {
      missingFields.push('conductor_size');
    }
    if (!feeder.conductor_material) {
      missingFields.push('conductor_material');
    }

    if (missingFields.length > 0) {
      return {
        feederName: feeder.name,
        missingFields,
      };
    }

    return null;
  }).filter((issue): issue is { feederName: string; missingFields: string[] } => issue !== null);

  return {
    isValid: feedersWithIssues.length === 0,
    feedersWithIssues,
  };
}
