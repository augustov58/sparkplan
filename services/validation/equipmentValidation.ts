/**
 * Equipment Validation Service
 *
 * Validates electrical equipment specifications against NEC requirements,
 * particularly AIC (Available Interrupting Current) ratings per NEC 110.9.
 *
 * @module services/validation/equipmentValidation
 */

import { STANDARD_AIC_RATINGS, getNextStandardAIC, isAICAdequate } from '@/data/manufacturerTemplates';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Equipment validation result
 */
export interface ValidationResult {
  /** True if equipment meets NEC requirements */
  isCompliant: boolean;

  /** Array of warning messages (empty if compliant) */
  warnings: string[];

  /** Array of informational messages */
  info?: string[];

  /** Severity level of the issue */
  severity?: 'critical' | 'warning' | 'info';
}

/**
 * Panel with optional equipment specifications
 */
interface Panel {
  id: string;
  name: string;
  bus_rating: number;
  voltage: number;
  phase: 1 | 3;
  aic_rating?: number;
  series_rating?: boolean;
  manufacturer?: string;
  model_number?: string;
}

/**
 * Short circuit calculation result
 */
interface ShortCircuitCalculation {
  id: string;
  panel_id?: string;
  fault_current_ka: number;
  calculation_type: 'service' | 'panel';
  created_at: string;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate Panel AIC Rating against Short Circuit Calculation
 *
 * Per NEC 110.9, equipment intended to interrupt current at fault levels must
 * have an adequate interrupting rating for the maximum available fault current.
 *
 * @param panel - Panel to validate
 * @param shortCircuitCalc - Optional short circuit calculation for this panel
 * @returns Validation result with compliance status and warnings
 *
 * @example
 * ```typescript
 * const result = validatePanelAIC(panel, shortCircuitCalc);
 * if (!result.isCompliant) {
 *   console.warn('Panel non-compliant:', result.warnings);
 * }
 * ```
 */
export function validatePanelAIC(
  panel: Panel,
  shortCircuitCalc?: ShortCircuitCalculation
): ValidationResult {
  // If no AIC rating specified, return info message (not an error)
  if (!panel.aic_rating) {
    return {
      isCompliant: true,
      warnings: [],
      info: [
        `Panel ${panel.name}: AIC rating not specified. ` +
        `Consider adding equipment specifications for permit compliance.`
      ],
      severity: 'info'
    };
  }

  // If no short circuit calculation available, can't validate
  if (!shortCircuitCalc) {
    return {
      isCompliant: true,
      warnings: [],
      info: [
        `Panel ${panel.name}: No short circuit calculation available. ` +
        `Run short circuit analysis to verify AIC rating compliance.`
      ],
      severity: 'info'
    };
  }

  const requiredAIC = shortCircuitCalc.fault_current_ka;
  const actualAIC = panel.aic_rating;

  // Check if AIC rating is adequate
  if (isAICAdequate(actualAIC, requiredAIC)) {
    return {
      isCompliant: true,
      warnings: [],
      info: [
        `Panel ${panel.name}: AIC rating ${actualAIC} kA is adequate for ` +
        `${requiredAIC.toFixed(1)} kA fault current (NEC 110.9 ✓)`
      ],
      severity: 'info'
    };
  }

  // AIC rating is insufficient - CRITICAL VIOLATION
  const recommendedAIC = getNextStandardAIC(requiredAIC);

  return {
    isCompliant: false,
    warnings: [
      `⚠️ NEC 110.9 VIOLATION: Panel ${panel.name} has insufficient AIC rating`,
      ``,
      `Current Equipment:`,
      `  • Manufacturer: ${panel.manufacturer || 'Not specified'}`,
      `  • Model: ${panel.model_number || 'Not specified'}`,
      `  • AIC Rating: ${actualAIC} kA`,
      ``,
      `Fault Current Analysis:`,
      `  • Calculated Fault Current: ${requiredAIC.toFixed(1)} kA`,
      `  • Required AIC Rating: ≥${requiredAIC.toFixed(1)} kA`,
      `  • Shortfall: ${(requiredAIC - actualAIC).toFixed(1)} kA`,
      ``,
      `Required Action:`,
      `  • Upgrade to equipment with minimum ${recommendedAIC} kA AIC rating`,
      `  • Standard AIC ratings: ${STANDARD_AIC_RATINGS.join(', ')} kA`,
      ``,
      `NEC Reference:`,
      `  NEC 110.9: Equipment intended to interrupt current at fault levels ` +
      `shall have an interrupting rating at nominal circuit voltage sufficient ` +
      `for the current that must be interrupted.`
    ],
    severity: 'critical'
  };
}

/**
 * Validate Multiple Panels Against Short Circuit Calculations
 *
 * Batch validation for all panels in a project.
 *
 * @param panels - Array of panels to validate
 * @param shortCircuitCalcs - Array of short circuit calculations
 * @returns Array of validation results, one per panel
 *
 * @example
 * ```typescript
 * const results = validateAllPanelsAIC(panels, calculations);
 * const nonCompliant = results.filter(r => !r.result.isCompliant);
 * console.log(`${nonCompliant.length} panels have AIC issues`);
 * ```
 */
export function validateAllPanelsAIC(
  panels: Panel[],
  shortCircuitCalcs: ShortCircuitCalculation[]
): Array<{ panel: Panel; result: ValidationResult }> {
  return panels.map(panel => {
    // Find the most recent short circuit calculation for this panel
    const panelCalc = shortCircuitCalcs
      .filter(calc => calc.panel_id === panel.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      panel,
      result: validatePanelAIC(panel, panelCalc)
    };
  });
}

/**
 * Get Summary of Equipment Validation Issues
 *
 * Provides a high-level summary of compliance across all panels.
 *
 * @param panels - Array of panels to validate
 * @param shortCircuitCalcs - Array of short circuit calculations
 * @returns Summary object with counts and critical issues
 *
 * @example
 * ```typescript
 * const summary = getEquipmentValidationSummary(panels, calcs);
 * if (summary.criticalCount > 0) {
 *   alert(`${summary.criticalCount} panels have critical AIC violations!`);
 * }
 * ```
 */
export function getEquipmentValidationSummary(
  panels: Panel[],
  shortCircuitCalcs: ShortCircuitCalculation[]
): {
  totalPanels: number;
  compliantPanels: number;
  nonCompliantPanels: number;
  missingAICRatings: number;
  missingCalculations: number;
  criticalCount: number;
  warningCount: number;
  criticalPanels: string[];
} {
  const results = validateAllPanelsAIC(panels, shortCircuitCalcs);

  const compliant = results.filter(r => r.result.isCompliant);
  const nonCompliant = results.filter(r => !r.result.isCompliant);
  const missingAIC = panels.filter(p => !p.aic_rating);
  const critical = results.filter(r => r.result.severity === 'critical');
  const warnings = results.filter(r => r.result.severity === 'warning');

  // Calculate missing calculations (panels with AIC rating but no calculation)
  const panelsWithAIC = panels.filter(p => p.aic_rating);
  const panelIdsWithCalcs = new Set(shortCircuitCalcs.map(c => c.panel_id));
  const missingCalcs = panelsWithAIC.filter(p => !panelIdsWithCalcs.has(p.id));

  return {
    totalPanels: panels.length,
    compliantPanels: compliant.length,
    nonCompliantPanels: nonCompliant.length,
    missingAICRatings: missingAIC.length,
    missingCalculations: missingCalcs.length,
    criticalCount: critical.length,
    warningCount: warnings.length,
    criticalPanels: critical.map(r => r.panel.name)
  };
}

/**
 * Format Validation Result for Display
 *
 * Converts validation result into user-friendly text for UI display.
 *
 * @param result - Validation result to format
 * @returns Formatted text string
 */
export function formatValidationResult(result: ValidationResult): string {
  if (result.isCompliant) {
    return result.info?.join('\n') || 'Equipment is compliant';
  }

  return result.warnings.join('\n');
}

/**
 * Check if Panel Needs Short Circuit Calculation
 *
 * Determines if a panel with an AIC rating should have a short circuit
 * calculation performed to verify compliance.
 *
 * @param panel - Panel to check
 * @param shortCircuitCalcs - Array of existing calculations
 * @returns True if calculation is needed
 */
export function needsShortCircuitCalculation(
  panel: Panel,
  shortCircuitCalcs: ShortCircuitCalculation[]
): boolean {
  // If panel has no AIC rating, calculation is optional
  if (!panel.aic_rating) {
    return false;
  }

  // Check if panel has any calculations
  const hasCalculation = shortCircuitCalcs.some(calc => calc.panel_id === panel.id);

  return !hasCalculation;
}

/**
 * Get Recommended Equipment Upgrade
 *
 * Provides specific upgrade recommendations when AIC rating is insufficient.
 *
 * @param panel - Non-compliant panel
 * @param faultCurrentKA - Calculated fault current in kA
 * @returns Upgrade recommendation object
 */
export function getRecommendedEquipmentUpgrade(
  panel: Panel,
  faultCurrentKA: number
): {
  requiredAIC: number;
  currentAIC: number;
  upgradeNeeded: boolean;
  recommendation: string;
} {
  const currentAIC = panel.aic_rating || 0;
  const requiredAIC = getNextStandardAIC(faultCurrentKA);
  const upgradeNeeded = currentAIC < faultCurrentKA;

  let recommendation = '';
  if (upgradeNeeded) {
    recommendation =
      `Upgrade panel ${panel.name} to equipment with minimum ${requiredAIC} kA AIC rating. ` +
      `Current rating of ${currentAIC} kA is insufficient for ${faultCurrentKA.toFixed(1)} kA fault current. ` +
      `Consider manufacturers offering ${requiredAIC} kA series: ` +
      `Square D NF/NQOD, Eaton PRL3a, Siemens P4 (commercial), or higher-rated equipment.`;
  } else {
    recommendation = `Panel ${panel.name} AIC rating is adequate.`;
  }

  return {
    requiredAIC,
    currentAIC,
    upgradeNeeded,
    recommendation
  };
}
