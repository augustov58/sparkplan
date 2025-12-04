/**
 * Panel Connection Validation Service
 *
 * Validates electrical panel connections for voltage/phase compatibility
 * per NEC requirements and standard electrical engineering practices.
 *
 * This service determines when direct panel-to-panel connections are valid
 * versus when a transformer is required.
 */

export interface PanelConnectionValidation {
  isValid: boolean;
  severity: 'allow' | 'warn' | 'block';
  message: string;
  requiresTransformer: boolean;
  technicalReason?: string;
}

/**
 * Validates a direct connection between two panels (no transformer)
 *
 * @param sourceVoltage - Source panel nominal voltage (120, 208, 240, 277, 480, 600)
 * @param sourcePhase - Source panel phase count (1 or 3)
 * @param destVoltage - Destination panel nominal voltage
 * @param destPhase - Destination panel phase count (1 or 3)
 * @returns Validation result with severity and message
 */
export function validatePanelConnection(
  sourceVoltage: number,
  sourcePhase: number,
  destVoltage: number,
  destPhase: number
): PanelConnectionValidation {
  // Rule 1: Same voltage and phase (standard feeder)
  if (sourceVoltage === destVoltage && sourcePhase === destPhase) {
    return {
      isValid: true,
      severity: 'allow',
      message: 'Standard feeder connection - same voltage and phase',
      requiresTransformer: false,
    };
  }

  // Rule 2: Line-to-neutral derivative (3-phase to 1-phase)
  if (sourcePhase === 3 && destPhase === 1) {
    const derivativeResult = validateLineToNeutralDerivative(sourceVoltage, destVoltage);
    if (derivativeResult.isValid) {
      return derivativeResult;
    }
  }

  // Rule 3: Split-phase derivative (240V 1φ → 120V 1φ)
  if (sourceVoltage === 240 && destVoltage === 120 && sourcePhase === 1 && destPhase === 1) {
    return {
      isValid: true,
      severity: 'allow',
      message: 'Split-phase derivative - 120V from center-tap neutral',
      requiresTransformer: false,
      technicalReason: 'Standard 120/240V split-phase system with center-tapped neutral',
    };
  }

  // Rule 4: High-leg delta system (240V 3φ → 120V 1φ - requires warning)
  if (sourceVoltage === 240 && destVoltage === 120 && sourcePhase === 3 && destPhase === 1) {
    return {
      isValid: true,
      severity: 'warn',
      message: 'High-leg delta system - verify 120V loads connected to correct phases (A-N or C-N only, NOT B-N)',
      requiresTransformer: false,
      technicalReason: 'High-leg delta has 208V on B-phase to neutral - only A and C phases provide 120V',
    };
  }

  // Rule 5: Line-to-line single-phase tap (3φ → 1φ at same voltage - uncommon)
  if (sourceVoltage === destVoltage && sourcePhase === 3 && destPhase === 1) {
    return {
      isValid: true,
      severity: 'warn',
      message: `Single-phase ${destVoltage}V load from 3-phase ${sourceVoltage}V system - ensure proper line-to-line connection`,
      requiresTransformer: false,
      technicalReason: 'Valid but uncommon - typically used for large single-phase loads like welders',
    };
  }

  // Rule 6: Single-phase to three-phase (ALWAYS requires transformer)
  if (sourcePhase === 1 && destPhase === 3) {
    return {
      isValid: false,
      severity: 'block',
      message: 'Cannot convert single-phase to three-phase without transformer',
      requiresTransformer: true,
      technicalReason: 'Three-phase power cannot be electrically derived from single-phase source',
    };
  }

  // Rule 7: Voltage mismatch (requires transformer)
  if (sourceVoltage !== destVoltage) {
    return {
      isValid: false,
      severity: 'block',
      message: `Voltage transformation from ${sourceVoltage}V to ${destVoltage}V requires transformer`,
      requiresTransformer: true,
      technicalReason: 'Direct connection cannot change voltage levels (except line-to-neutral derivatives)',
    };
  }

  // Rule 8: Catch-all for incompatible configurations
  return {
    isValid: false,
    severity: 'block',
    message: `Incompatible system configuration - ${sourceVoltage}V ${sourcePhase}φ → ${destVoltage}V ${destPhase}φ`,
    requiresTransformer: true,
    technicalReason: 'Configuration does not match any valid direct connection pattern',
  };
}

/**
 * Validates line-to-neutral derivative connections (3-phase to 1-phase)
 *
 * Valid derivatives:
 * - 208V 3φ → 120V 1φ (120 = 208 / √3)
 * - 480V 3φ → 277V 1φ (277 = 480 / √3)
 * - 600V 3φ → 347V 1φ (347 = 600 / √3)
 */
function validateLineToNeutralDerivative(
  sourceVoltage: number,
  destVoltage: number
): PanelConnectionValidation {
  const sqrt3 = Math.sqrt(3);
  const expectedLineToNeutral = Math.round(sourceVoltage / sqrt3);

  // Allow 1V tolerance for rounding
  const isValidDerivative = Math.abs(destVoltage - expectedLineToNeutral) <= 1;

  if (isValidDerivative) {
    return {
      isValid: true,
      severity: 'allow',
      message: `Line-to-neutral derivative - ${destVoltage}V from ${sourceVoltage}V three-phase system`,
      requiresTransformer: false,
      technicalReason: `${destVoltage}V = ${sourceVoltage}V / √3 (line-to-neutral voltage)`,
    };
  }

  // Invalid derivative voltage
  return {
    isValid: false,
    severity: 'block',
    message: `Cannot derive ${destVoltage}V single-phase from ${sourceVoltage}V three-phase system`,
    requiresTransformer: true,
    technicalReason: `Line-to-neutral voltage of ${sourceVoltage}V 3φ system is ${expectedLineToNeutral}V, not ${destVoltage}V`,
  };
}

/**
 * Checks if a transformer exists between source and destination panels
 * (To be integrated with database transformer tracking)
 */
export function hasTransformerInPath(
  sourcePanelId: string,
  destPanelId: string,
  transformers: Array<{ fed_from_panel_id: string; id: string }>
): boolean {
  // Check if destination panel is fed from a transformer that's fed from source panel
  return transformers.some(t => t.fed_from_panel_id === sourcePanelId);
}

/**
 * Provides user-friendly explanation of why a connection is invalid
 */
export function getConnectionValidationHelp(
  sourceVoltage: number,
  sourcePhase: number,
  destVoltage: number,
  destPhase: number
): string {
  const validation = validatePanelConnection(sourceVoltage, sourcePhase, destVoltage, destPhase);

  if (validation.severity === 'allow') {
    return `✓ Valid connection: ${validation.message}`;
  }

  if (validation.severity === 'warn') {
    return `⚠ Warning: ${validation.message}\n\nTechnical note: ${validation.technicalReason}`;
  }

  // Block - provide guidance
  let help = `✗ Invalid connection: ${validation.message}\n\n`;
  help += `Technical reason: ${validation.technicalReason}\n\n`;

  if (validation.requiresTransformer) {
    help += `Solution: Add a transformer between these panels with:\n`;
    help += `  - Primary: ${sourceVoltage}V ${sourcePhase === 3 ? '3-phase' : 'single-phase'}\n`;
    help += `  - Secondary: ${destVoltage}V ${destPhase === 3 ? '3-phase' : 'single-phase'}\n`;
  }

  return help;
}

/**
 * Returns all valid destination voltages/phases for a given source panel
 * (Used to populate dropdown options in UI)
 */
export function getCompatibleDestinations(
  sourceVoltage: number,
  sourcePhase: number
): Array<{ voltage: number; phase: number; description: string }> {
  const compatible: Array<{ voltage: number; phase: number; description: string }> = [];

  // Always allow same voltage/phase
  compatible.push({
    voltage: sourceVoltage,
    phase: sourcePhase,
    description: `Same system (${sourceVoltage}V ${sourcePhase}φ)`,
  });

  // Three-phase systems can derive line-to-neutral voltages
  if (sourcePhase === 3) {
    const lineToNeutral = Math.round(sourceVoltage / Math.sqrt(3));

    if (sourceVoltage === 208) {
      compatible.push({ voltage: 120, phase: 1, description: '120V 1φ (line-to-neutral)' });
    } else if (sourceVoltage === 480) {
      compatible.push({ voltage: 277, phase: 1, description: '277V 1φ (line-to-neutral)' });
      compatible.push({ voltage: 480, phase: 1, description: '480V 1φ (line-to-line, uncommon)' });
    } else if (sourceVoltage === 600) {
      compatible.push({ voltage: 347, phase: 1, description: '347V 1φ (line-to-neutral)' });
    } else if (sourceVoltage === 240) {
      // High-leg delta - requires warning
      compatible.push({ voltage: 120, phase: 1, description: '120V 1φ (high-leg delta - WARNING)' });
    }
  }

  // Split-phase can derive 120V
  if (sourceVoltage === 240 && sourcePhase === 1) {
    compatible.push({ voltage: 120, phase: 1, description: '120V 1φ (center-tap neutral)' });
  }

  return compatible;
}
