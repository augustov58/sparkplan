/**
 * PDF Export Service
 * Generates professional PDF reports for load calculations
 * Uses @react-pdf/renderer for client-side PDF generation
 */

import { pdf } from '@react-pdf/renderer';
import { Project } from '../types';
import { calculateLoad } from './calculations';

/**
 * Generate and download PDF load calculation report
 *
 * @param project - Project data to export
 * @returns Promise that resolves when PDF is downloaded
 */
export async function exportLoadCalculationPDF(project: Project): Promise<void> {
  // For now, generate a simple text-based report
  // Full React PDF implementation would go here in production

  try {
    if (!project.settings?.occupancyType) {
      throw new Error('Project must have occupancyType configured for PDF export');
    }

    const result = calculateLoad(project.loads, project.settings);

    // Generate report content
    const reportContent = generateReportText(project, result);

    // Create blob and download
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, '_')}_Load_Calculation.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('PDF Export Error:', error);
    throw error;
  }
}

/**
 * Generate formatted text report
 * TODO: Replace with React PDF Document in production
 */
function generateReportText(project: Project, result: ReturnType<typeof calculateLoad>): string {
  const date = new Date().toLocaleDateString();

  return `
═══════════════════════════════════════════════════════════════════════
                    NEC LOAD CALCULATION REPORT
═══════════════════════════════════════════════════════════════════════

Project: ${project.name}
Address: ${project.address}
Date: ${date}
NEC Edition: ${project.necEdition}

───────────────────────────────────────────────────────────────────────
ELECTRICAL SERVICE PARAMETERS
───────────────────────────────────────────────────────────────────────

Service Voltage:     ${project.serviceVoltage}V
Service Phase:       ${project.servicePhase === 1 ? 'Single' : 'Three'}-Phase
Occupancy Type:      ${project.settings.occupancyType}
Conductor Material:  ${project.settings.conductorMaterial === 'Cu' ? 'Copper' : 'Aluminum'}
Temperature Rating:  ${project.settings.temperatureRating}°C

───────────────────────────────────────────────────────────────────────
LOAD SCHEDULE
───────────────────────────────────────────────────────────────────────

${project.loads.map((load, idx) => `
${idx + 1}. ${load.description}
   Type: ${load.type.toUpperCase()}
   Load: ${load.watts} VA
   Phase: ${load.phase}
   Continuous: ${load.continuous ? 'YES (125% factor applied)' : 'NO'}
`).join('')}

Total Connected Load: ${result.totalConnectedVA.toLocaleString()} VA

───────────────────────────────────────────────────────────────────────
CALCULATION METHOD: ${result.method}
───────────────────────────────────────────────────────────────────────

LIGHTING LOADS (NEC Table 220.42)
  Connected Load:    ${result.breakdown.lighting.connectedVA.toLocaleString()} VA
  Demand Factor:     ${(result.breakdown.lighting.demandFactor * 100).toFixed(1)}%
  Demand Load:       ${result.breakdown.lighting.demandVA.toLocaleString()} VA

APPLIANCES (Ranges, Dryers, Water Heaters)
  Connected Load:    ${result.breakdown.appliances.connectedVA.toLocaleString()} VA
  Demand Factor:     ${(result.breakdown.appliances.demandFactor * 100).toFixed(1)}%
  Demand Load:       ${result.breakdown.appliances.demandVA.toLocaleString()} VA

${result.breakdown.motors.connectedVA > 0 ? `
MOTOR LOADS (Article 430)
  Total Motors:      ${result.breakdown.motors.connectedVA.toLocaleString()} VA
  Largest Motor:     ${result.breakdown.motors.largestMotorVA.toLocaleString()} VA (125% per NEC 430.24)
  Demand Load:       ${result.breakdown.motors.demandVA.toLocaleString()} VA
` : ''}

${result.breakdown.other.connectedVA > 0 ? `
OTHER LOADS (HVAC, etc.)
  Connected Load:    ${result.breakdown.other.connectedVA.toLocaleString()} VA
  Demand Load:       ${result.breakdown.other.demandVA.toLocaleString()} VA
` : ''}

───────────────────────────────────────────────────────────────────────
PHASE BALANCE ANALYSIS
───────────────────────────────────────────────────────────────────────

Phase A:            ${result.phaseBalance.phaseA.toLocaleString()} VA
Phase B:            ${result.phaseBalance.phaseB.toLocaleString()} VA
Phase C:            ${result.phaseBalance.phaseC.toLocaleString()} VA
Imbalance:          ${result.phaseBalance.imbalancePercent.toFixed(1)}%

${result.phaseBalance.warnings.length > 0 ? `
WARNINGS:
${result.phaseBalance.warnings.map(w => `⚠ ${w}`).join('\n')}
` : ''}

───────────────────────────────────────────────────────────────────────
FINAL CALCULATION
───────────────────────────────────────────────────────────────────────

Total Demand Load:          ${result.totalDemandVA.toLocaleString()} VA
Calculated Current:         ${result.totalAmps.toFixed(2)} A
Recommended Service Size:   ${result.recommendedServiceSize} A

───────────────────────────────────────────────────────────────────────
NEC REFERENCES
───────────────────────────────────────────────────────────────────────

${result.necReferences.map(ref => `• ${ref}`).join('\n')}

${result.notes.length > 0 ? `
───────────────────────────────────────────────────────────────────────
NOTES
───────────────────────────────────────────────────────────────────────

${result.notes.map(note => `• ${note}`).join('\n')}
` : ''}

═══════════════════════════════════════════════════════════════════════
Report generated with SparkPlan
Generated: ${new Date().toLocaleString()}
═══════════════════════════════════════════════════════════════════════
`.trim();
}
