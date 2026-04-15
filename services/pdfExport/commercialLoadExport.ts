/**
 * Commercial Load Calculation Export Helpers
 *
 * Two entry points:
 *   - exportCommercialLoadPDF()  → renders the CommercialLoadDocument and triggers a
 *                                  browser download of a submittal-quality .pdf
 *   - exportCommercialLoadCSV()  → builds a structured multi-section CSV and triggers
 *                                  download. Sections are separated by blank lines and
 *                                  prefixed with `#` comment headers so Excel renders each
 *                                  as its own contiguous table while CSV parsers can
 *                                  skip the comment lines.
 *
 * Pattern matches services/pdfExport/shortCircuitPDF.tsx (pdf().toBlob() + anchor click)
 * so these functions can later be composed into the PermitPacket bundle.
 */

import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { CommercialLoadDocument, type CommercialLoadDocumentProps } from './CommercialLoadDocument';
import { OCCUPANCY_LABELS, LIGHTING_UNIT_LOAD } from '../calculations/commercialLoad';

export type CommercialLoadExportInput = CommercialLoadDocumentProps;

// ==================== SHARED HELPERS ====================

/**
 * Trigger a browser download for a Blob with the given filename.
 * Keeps the implementation out of the main export logic and makes testing easier.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Defer revoke so browsers that read the blob asynchronously don't race
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/** Build a slug-safe filename component from a project name. */
function slugify(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'project';
}

function dateStamp(): string {
  return new Date().toISOString().split('T')[0];
}

// ==================== PDF EXPORT ====================

export async function exportCommercialLoadPDF(
  input: CommercialLoadExportInput
): Promise<void> {
  const blob = await pdf(React.createElement(CommercialLoadDocument, input)).toBlob();
  const filename = `CommercialLoadCalc_${slugify(input.project.name)}_${dateStamp()}.pdf`;
  downloadBlob(blob, filename);
}

// ==================== CSV EXPORT ====================

/**
 * Escape a single CSV field per RFC 4180:
 *   - If the field contains a comma, quote, CR, or LF → wrap in double quotes
 *     and double any internal double quotes.
 *   - Otherwise return as-is.
 * Numbers are stringified; null/undefined become empty strings.
 */
function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV row from an array of fields. */
function csvRow(fields: Array<string | number | boolean | null | undefined>): string {
  return fields.map(csvEscape).join(',');
}

/**
 * Build the multi-section CSV content as a single string.
 * Exposed (not just internal) so it can be unit-tested without touching the DOM.
 */
export function buildCommercialLoadCSV(input: CommercialLoadExportInput): string {
  const {
    project,
    occupancyType,
    totalFloorArea,
    generalReceptacleCount,
    showWindowLighting_linearFeet,
    signOutlets,
    hvacLoads,
    motorLoads,
    kitchenEquipment,
    specialLoads,
    serviceVoltage,
    servicePhase,
    result,
    effectiveMainBreaker,
    effectiveBusRating,
    isMainBreakerOverridden,
    isBusOverridden,
    preparedBy,
  } = input;

  const utilization = (result.calculatedAmps / effectiveMainBreaker) * 100;
  const lines: string[] = [];

  // --- Header comment block ---
  lines.push(`# Commercial Load Calculation — SparkPlan`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# NEC ${project.necEdition ?? '2023'} Article 220 Part III & IV`);
  lines.push('');

  // --- Project information ---
  lines.push('# PROJECT INFORMATION');
  lines.push(csvRow(['Field', 'Value']));
  lines.push(csvRow(['Project Name', project.name]));
  lines.push(csvRow(['Project Address', project.address || '']));
  lines.push(csvRow(['Report Date', new Date().toLocaleDateString('en-US')]));
  lines.push(csvRow(['NEC Edition', project.necEdition ?? '2023']));
  lines.push(csvRow(['Occupancy Type', OCCUPANCY_LABELS[occupancyType]]));
  lines.push(csvRow(['Total Floor Area (sq ft)', totalFloorArea]));
  lines.push(csvRow(['Lighting Unit Load (VA/sq ft)', LIGHTING_UNIT_LOAD[occupancyType]]));
  lines.push(csvRow(['Service Voltage (V)', serviceVoltage]));
  lines.push(csvRow(['Service Phase', servicePhase]));
  if (preparedBy) lines.push(csvRow(['Prepared By', preparedBy]));
  lines.push('');

  // --- Service Sizing ---
  lines.push('# SERVICE SIZING SUMMARY');
  lines.push(csvRow(['Metric', 'Value']));
  lines.push(csvRow(['Total Connected Load (VA)', result.totalConnectedLoad_VA.toFixed(0)]));
  lines.push(csvRow(['Total Demand Load (VA)', result.totalDemandLoad_VA.toFixed(0)]));
  lines.push(csvRow(['Calculated Current (A)', result.calculatedAmps.toFixed(2)]));
  lines.push(csvRow(['Recommended Main Breaker per NEC (A)', result.recommendedMainBreakerAmps]));
  lines.push(csvRow(['Recommended Service Bus Rating per NEC (A)', result.recommendedServiceBusRating]));
  lines.push(csvRow(['Effective Main Breaker (A)', effectiveMainBreaker]));
  lines.push(csvRow(['Effective Service Bus Rating (A)', effectiveBusRating]));
  lines.push(csvRow(['Main Breaker Manually Overridden', isMainBreakerOverridden ? 'Yes' : 'No']));
  lines.push(csvRow(['Bus Rating Manually Overridden', isBusOverridden ? 'Yes' : 'No']));
  lines.push(csvRow(['Utilization (%)', utilization.toFixed(2)]));
  lines.push('');

  // --- Load Breakdown ---
  lines.push('# LOAD BREAKDOWN');
  lines.push(csvRow([
    'Category',
    'Connected Load (VA)',
    'Demand Factor (%)',
    'Demand Load (VA)',
    'Continuous',
    'Service Sizing Load (VA)',
    'NEC Reference',
  ]));
  for (const item of result.loadBreakdown) {
    lines.push(csvRow([
      item.category,
      item.connectedLoad_VA.toFixed(0),
      item.demandFactor.toFixed(1),
      item.demandLoad_VA.toFixed(0),
      item.isContinuous ? 'Yes' : 'No',
      item.serviceSizingLoad_VA.toFixed(0),
      item.necReference,
    ]));
  }
  lines.push('');

  // --- Receptacles / auxiliary lighting inputs ---
  lines.push('# GENERAL RECEPTACLES & SPECIAL OUTLETS (INPUTS)');
  lines.push(csvRow(['Item', 'Quantity', 'NEC Reference']));
  lines.push(csvRow(['General Receptacles (180 VA each)', generalReceptacleCount, '220.14(I), 220.44']));
  lines.push(csvRow([
    'Show Window Lighting (linear ft, 200 VA/ft)',
    showWindowLighting_linearFeet,
    '220.14(G)',
  ]));
  lines.push(csvRow(['Sign Outlets (1,200 VA each)', signOutlets, '220.14(F)']));
  lines.push('');

  // --- HVAC inputs ---
  if (hvacLoads.length > 0) {
    lines.push('# HVAC LOADS (INPUTS)');
    lines.push(csvRow([
      'Description',
      'MCA/FLA (A)',
      'Voltage (V)',
      'Phase',
      'Continuous',
    ]));
    for (const h of hvacLoads) {
      lines.push(csvRow([
        h.description,
        h.nameplateFLA,
        h.voltage,
        h.phase,
        h.isContinuous ? 'Yes' : 'No',
      ]));
    }
    lines.push('');
  }

  // --- Motor inputs ---
  if (motorLoads.length > 0) {
    lines.push('# MOTOR LOADS (INPUTS)');
    lines.push(csvRow(['Description', 'HP', 'FLA (A)', 'Voltage (V)', 'Phase']));
    for (const m of motorLoads) {
      lines.push(csvRow([
        m.description,
        m.horsepower,
        m.fullLoadAmps,
        m.voltage,
        m.phase,
      ]));
    }
    lines.push('');
  }

  // --- Kitchen inputs ---
  if (kitchenEquipment.length > 0) {
    lines.push('# KITCHEN EQUIPMENT (INPUTS, NEC 220.56)');
    lines.push(csvRow(['Description', 'Nameplate Rating (kW)']));
    for (const k of kitchenEquipment) {
      lines.push(csvRow([k.description, k.nameplateRating_kW]));
    }
    lines.push('');
  }

  // --- Special load inputs ---
  if (specialLoads.length > 0) {
    lines.push('# SPECIAL LOADS (INPUTS)');
    lines.push(csvRow(['Description', 'Load (VA)', 'Continuous']));
    for (const s of specialLoads) {
      lines.push(csvRow([s.description, s.load_VA, s.isContinuous ? 'Yes' : 'No']));
    }
    lines.push('');
  }

  // --- Warnings ---
  if (result.warnings.length > 0) {
    lines.push('# WARNINGS');
    lines.push(csvRow(['#', 'Message']));
    result.warnings.forEach((w, i) => lines.push(csvRow([i + 1, w])));
    lines.push('');
  }

  // --- Notes ---
  if (result.notes.length > 0) {
    lines.push('# CALCULATION NOTES');
    lines.push(csvRow(['#', 'Note']));
    result.notes.forEach((n, i) => lines.push(csvRow([i + 1, n])));
    lines.push('');
  }

  // CRLF line endings per RFC 4180 — Excel handles both but CRLF is the spec
  return lines.join('\r\n');
}

export function exportCommercialLoadCSV(input: CommercialLoadExportInput): void {
  const csv = buildCommercialLoadCSV(input);
  // BOM (\uFEFF) so Excel correctly detects UTF-8 when the CSV contains symbols
  // like ⚠️, Φ, or NEC § markers
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `CommercialLoadCalc_${slugify(input.project.name)}_${dateStamp()}.csv`;
  downloadBlob(blob, filename);
}
