/**
 * Equipment Specifications PDF Export Service
 *
 * Exports equipment specification sheets as PDF following existing export patterns.
 * Generates standalone PDF or integrates with permit packet generator.
 *
 * @module services/pdfExport/equipmentSpecsPDF
 */

import { pdf } from '@react-pdf/renderer';
import { EquipmentSpecsDocument } from './EquipmentSpecsDocuments';

// ============================================================================
// TYPES (matching database schema + equipment specs)
// ============================================================================

interface Panel {
  id: string;
  name: string;
  voltage: number;
  phase: 1 | 3;
  bus_rating: number;
  main_breaker_amps?: number;
  location?: string;
  manufacturer?: string;
  model_number?: string;
  nema_enclosure_type?: string;
  ul_listing?: string;
  aic_rating?: number;
  series_rating?: boolean;
  notes?: string;
}

interface Transformer {
  id: string;
  name: string;
  kva_rating: number;
  primary_voltage: number;
  primary_phase: 1 | 3;
  secondary_voltage: number;
  secondary_phase: 1 | 3;
  location?: string;
  manufacturer?: string;
  model_number?: string;
  winding_type?: string;
  impedance_percent?: number;
  cooling_type?: string;
  ul_listing?: string;
  temperature_rise?: number;
  notes?: string;
}

// ============================================================================
// EXPORT FUNCTION
// ============================================================================

/**
 * Export Equipment Specifications as PDF
 *
 * Generates and downloads a professional equipment specification sheet for
 * electrical permit applications.
 *
 * @param projectName - Project name for header
 * @param panels - Array of panels with equipment specifications
 * @param transformers - Array of transformers with equipment specifications
 * @param projectAddress - Optional project address
 * @param includeNECReferences - Include NEC code references (default: true)
 * @returns Promise that resolves when export completes
 *
 * @throws {Error} If PDF generation fails
 *
 * @example
 * ```typescript
 * await exportEquipmentSpecs(
 *   'Commercial Office Building',
 *   panels,
 *   transformers,
 *   '123 Main St, City, State 12345'
 * );
 * ```
 */
export async function exportEquipmentSpecs(
  projectName: string,
  panels: Panel[],
  transformers: Transformer[],
  projectAddress?: string,
  includeNECReferences: boolean = true
): Promise<void> {
  // Validation
  if (!projectName || projectName.trim() === '') {
    throw new Error('Project name is required for equipment specs export');
  }

  if (panels.length === 0 && transformers.length === 0) {
    throw new Error('No panels or transformers to export. Add equipment first.');
  }

  try {
    // Generate PDF blob
    const blob = await pdf(
      <EquipmentSpecsDocument
        projectName={projectName}
        projectAddress={projectAddress}
        panels={panels}
        transformers={transformers}
        includeNECReferences={includeNECReferences}
      />
    ).toBlob();

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename: Equipment_Specs_ProjectName_YYYY-MM-DD.pdf
    const sanitizedProjectName = projectName.replace(/[^a-z0-9]/gi, '_');
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    link.download = `Equipment_Specs_${sanitizedProjectName}_${dateStr}.pdf`;

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
    console.error('Equipment specs PDF export failed:', error);
    throw new Error(`Failed to export equipment specs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if any equipment has specifications defined
 *
 * Useful for showing/hiding export button or displaying warnings.
 *
 * @param panels - Array of panels to check
 * @param transformers - Array of transformers to check
 * @returns True if at least one piece of equipment has specs defined
 *
 * @example
 * ```typescript
 * if (hasEquipmentSpecs(panels, transformers)) {
 *   return <button onClick={handleExport}>Export Equipment Specs</button>;
 * }
 * ```
 */
export function hasEquipmentSpecs(panels: Panel[], transformers: Transformer[]): boolean {
  // Check if any panel has equipment specs
  const panelHasSpecs = panels.some(panel =>
    panel.manufacturer ||
    panel.model_number ||
    panel.nema_enclosure_type ||
    panel.ul_listing ||
    panel.aic_rating ||
    panel.series_rating ||
    panel.notes
  );

  // Check if any transformer has equipment specs
  const transformerHasSpecs = transformers.some(transformer =>
    transformer.manufacturer ||
    transformer.model_number ||
    transformer.winding_type ||
    transformer.impedance_percent ||
    transformer.cooling_type ||
    transformer.ul_listing ||
    transformer.temperature_rise ||
    transformer.notes
  );

  return panelHasSpecs || transformerHasSpecs;
}

/**
 * Get count of equipment with specifications
 *
 * Returns object with panel count and transformer count for display purposes.
 *
 * @param panels - Array of panels to check
 * @param transformers - Array of transformers to check
 * @returns Object with panelCount and transformerCount
 *
 * @example
 * ```typescript
 * const { panelCount, transformerCount } = getEquipmentSpecsCount(panels, transformers);
 * console.log(`${panelCount} panels, ${transformerCount} transformers have specs`);
 * ```
 */
export function getEquipmentSpecsCount(panels: Panel[], transformers: Transformer[]): {
  panelCount: number;
  transformerCount: number;
} {
  const panelCount = panels.filter(panel =>
    panel.manufacturer ||
    panel.model_number ||
    panel.nema_enclosure_type ||
    panel.ul_listing ||
    panel.aic_rating ||
    panel.series_rating ||
    panel.notes
  ).length;

  const transformerCount = transformers.filter(transformer =>
    transformer.manufacturer ||
    transformer.model_number ||
    transformer.winding_type ||
    transformer.impedance_percent ||
    transformer.cooling_type ||
    transformer.ul_listing ||
    transformer.temperature_rise ||
    transformer.notes
  ).length;

  return { panelCount, transformerCount };
}
