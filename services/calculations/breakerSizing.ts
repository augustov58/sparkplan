/**
 * Breaker Sizing Service - NEC Article 240 Compliant
 * Selects standard breaker sizes and validates overcurrent protection
 * 2023 NEC Edition
 */

import { ProjectSettings } from '../../types';
import {
  STANDARD_BREAKER_SIZES,
  getNextStandardBreakerSize,
  isStandardBreakerSize,
  findConductorByAmpacity,
  TABLE_310_16
} from '../../data/nec';

/**
 * Result of breaker sizing calculation
 */
export interface BreakerSizingResult {
  // Selected breaker
  breakerSize: number;
  breakerType: '1-pole' | '2-pole' | '3-pole';

  // Load information
  loadAmps: number;
  requiredMinimumBreaker: number;

  // Conductor compatibility
  conductorSize: string;
  conductorAmpacity: number;
  isCompatible: boolean;

  // NEC compliance
  necReferences: string[];
  warnings: string[];
  notes: string[];
}

/**
 * Size breaker for given load with NEC requirements
 *
 * @param loadAmps - Load current in amperes
 * @param settings - Project electrical settings
 * @param isContinuous - Whether load is continuous (>3 hours)
 * @param conductorSize - Optional conductor size to validate compatibility
 * @returns Breaker sizing result
 *
 * @example
 * // Size breaker for 40A continuous load
 * const result = sizeBreaker(40, settings, true);
 * // result.breakerSize = 50A (40A × 1.25 = 50A minimum)
 */
export function sizeBreaker(
  loadAmps: number,
  settings: ProjectSettings,
  isContinuous: boolean = true,
  conductorSize?: string
): BreakerSizingResult {
  const necReferences: string[] = ['NEC 240.6(A) - Standard Ampere Ratings'];
  const warnings: string[] = [];
  const notes: string[] = [];

  // 1. APPLY CONTINUOUS LOAD FACTOR (NEC 210.20(A))
  // Overcurrent device rating must be ≥125% of continuous load
  const continuousFactor = isContinuous ? 1.25 : 1.0;
  const requiredMinimumBreaker = loadAmps * continuousFactor;

  if (isContinuous) {
    necReferences.push('NEC 210.20(A) - Breaker rating ≥125% of continuous load');
    notes.push(`Continuous load (${loadAmps}A) requires breaker ≥${Math.round(requiredMinimumBreaker * 10) / 10}A`);
  }

  // 2. SELECT NEXT STANDARD BREAKER SIZE
  const breakerSize = getNextStandardBreakerSize(requiredMinimumBreaker);

  // 3. DETERMINE BREAKER TYPE BASED ON SYSTEM
  let breakerType: '1-pole' | '2-pole' | '3-pole';
  if (settings.servicePhase === 1) {
    breakerType = settings.serviceVoltage > 120 ? '2-pole' : '1-pole';
  } else {
    breakerType = '3-pole';
  }

  // 4. VALIDATE CONDUCTOR COMPATIBILITY (NEC 240.4)
  let conductorAmpacity = 0;
  let isCompatible = true;
  let selectedConductorSize = conductorSize || 'Not specified';

  if (conductorSize) {
    // Find specific conductor in ampacity table
    const conductorEntry = TABLE_310_16.find(
      c => c.size === conductorSize && c.material === settings.conductorMaterial
    );

    if (conductorEntry) {
      conductorAmpacity = conductorEntry[`temp${settings.temperatureRating}C` as 'temp60C' | 'temp75C' | 'temp90C'];

      // NEC 240.4 - Conductor protection
      // Breaker must not exceed conductor ampacity (with exceptions for small conductors)
      if (breakerSize > conductorAmpacity) {
        isCompatible = false;
        warnings.push(`⚠️ CRITICAL: Breaker (${breakerSize}A) exceeds conductor ampacity (${conductorAmpacity}A). This violates NEC 240.4.`);
        necReferences.push('NEC 240.4 - VIOLATION: Overcurrent protection exceeds conductor ampacity');
      } else {
        necReferences.push('NEC 240.4 - Conductor protected by overcurrent device');
        notes.push(`Conductor (${conductorSize}, ${conductorAmpacity}A) is properly protected by ${breakerSize}A breaker.`);
      }
    } else {
      warnings.push(`⚠️ Cannot find conductor ${conductorSize} in NEC Table 310.16`);
      isCompatible = false;
    }
  }

  // 5. SPECIAL NEC 240.4(B) - Small Conductor Exception
  // 14 AWG: max 15A, 12 AWG: max 20A, 10 AWG: max 30A
  if (conductorSize) {
    const smallConductorLimits: Record<string, number> = {
      '14 AWG': 15,
      '12 AWG': 20,
      '10 AWG': 30
    };

    if (conductorSize in smallConductorLimits) {
      const maxBreaker = smallConductorLimits[conductorSize];
      if (breakerSize > maxBreaker) {
        isCompatible = false;
        warnings.push(`⚠️ CRITICAL: ${conductorSize} limited to ${maxBreaker}A breaker per NEC 240.4(D).`);
        necReferences.push(`NEC 240.4(D) - ${conductorSize} maximum overcurrent protection`);
      }
    }
  }

  // 6. CHECK FOR OVERSIZED BREAKER
  if (breakerSize > requiredMinimumBreaker * 1.5) {
    warnings.push(`⚠️ Breaker (${breakerSize}A) is significantly larger than load (${loadAmps}A). Consider smaller breaker for better protection.`);
  }

  return {
    breakerSize,
    breakerType,
    loadAmps,
    requiredMinimumBreaker: Math.round(requiredMinimumBreaker * 10) / 10,
    conductorSize: selectedConductorSize,
    conductorAmpacity,
    isCompatible,
    necReferences,
    warnings,
    notes
  };
}

/**
 * Size main service breaker based on calculated service load
 * NEC 230.79 - Service Disconnecting Means Rating
 *
 * @param calculatedServiceAmps - Calculated service load
 * @param settings - Project electrical settings
 * @returns Service breaker sizing result
 */
export function sizeServiceBreaker(
  calculatedServiceAmps: number,
  settings: ProjectSettings
): BreakerSizingResult & { isServiceEntrance: true } {
  const necReferences: string[] = [
    'NEC 230.79 - Service Disconnecting Means',
    'NEC 240.6(A) - Standard Ampere Ratings'
  ];
  const warnings: string[] = [];
  const notes: string[] = [];

  // Service entrance breaker minimum ratings (NEC 230.79(C))
  const minimumServiceSizes: Record<ProjectSettings['occupancyType'], number> = {
    dwelling: 100, // NEC 230.79(C) - One-family dwelling minimum 100A
    commercial: 100,
    industrial: 100
  };

  const minimumByOccupancy = minimumServiceSizes[settings.occupancyType];

  // Select larger of calculated load or minimum required
  const requiredMinimumBreaker = Math.max(calculatedServiceAmps, minimumByOccupancy);

  if (calculatedServiceAmps < minimumByOccupancy) {
    notes.push(`Calculated load (${Math.round(calculatedServiceAmps)}A) is below minimum service size (${minimumByOccupancy}A).`);
    necReferences.push(`NEC 230.79(C) - Minimum ${minimumByOccupancy}A service for ${settings.occupancyType}`);
  }

  const breakerSize = getNextStandardBreakerSize(requiredMinimumBreaker);

  // Service breaker is always 2-pole (single phase) or 3-pole (three phase)
  const breakerType = settings.servicePhase === 1 ? '2-pole' : '3-pole';

  // Recommend conductor size for service
  notes.push(`Service conductors must be sized for ${breakerSize}A continuous load.`);
  necReferences.push('NEC 230.42(A) - Service conductor sizing');

  // Common service sizes
  const commonServiceSizes = [100, 125, 150, 200, 225, 400, 600, 800];
  if (!commonServiceSizes.includes(breakerSize)) {
    warnings.push(`ℹ️ Selected service size (${breakerSize}A) is non-standard. Common sizes: ${commonServiceSizes.join('A, ')}A.`);
  }

  return {
    breakerSize,
    breakerType,
    loadAmps: calculatedServiceAmps,
    requiredMinimumBreaker: Math.round(requiredMinimumBreaker * 10) / 10,
    conductorSize: 'See service conductor sizing',
    conductorAmpacity: 0,
    isCompatible: true,
    isServiceEntrance: true,
    necReferences,
    warnings,
    notes
  };
}

/**
 * Size breaker for motor load (Article 430)
 * Motors require special sizing due to starting currents
 *
 * @param motorFLA - Motor full-load amperes (from nameplate)
 * @param settings - Project electrical settings
 * @param motorType - Type of motor
 * @returns Breaker sizing for motor circuit
 */
export function sizeMotorBreaker(
  motorFLA: number,
  settings: ProjectSettings,
  motorType: 'standard' | 'hermetic' | 'wound_rotor' = 'standard'
): BreakerSizingResult & { motorProtectionFactor: number } {
  const necReferences: string[] = [
    'NEC 430.52 - Motor branch-circuit short-circuit protection',
    'NEC 240.6(A) - Standard Ampere Ratings'
  ];
  const warnings: string[] = [];
  const notes: string[] = [];

  // NEC 430.52(C)(1) - Motor protection multipliers
  // Inverse time breaker: 250% for standard motors
  const protectionFactors: Record<typeof motorType, number> = {
    standard: 2.5,        // 250% for inverse time breaker
    hermetic: 1.75,       // 175% for hermetic refrigerant motor-compressor
    wound_rotor: 1.5      // 150% for wound rotor motors
  };

  const motorProtectionFactor = protectionFactors[motorType];
  const requiredMinimumBreaker = motorFLA * motorProtectionFactor;

  notes.push(`Motor FLA (${motorFLA}A) × ${motorProtectionFactor} = ${Math.round(requiredMinimumBreaker * 10) / 10}A minimum.`);
  necReferences.push(`NEC 430.52(C)(1) - ${motorProtectionFactor * 100}% motor protection factor`);

  let breakerSize = getNextStandardBreakerSize(requiredMinimumBreaker);

  // NEC 430.52(C)(1) Exception No. 1 - If standard breaker is not sufficient,
  // next higher standard size is permitted up to 400% for inverse time breakers
  const maximumAllowed = motorFLA * 4.0;
  if (breakerSize > maximumAllowed) {
    warnings.push(`⚠️ CRITICAL: Breaker (${breakerSize}A) exceeds 400% of motor FLA (${motorFLA}A). Special approval required.`);
    necReferences.push('NEC 430.52(C)(1) Exception - Maximum 400% for inverse time breaker');
  }

  const breakerType = settings.servicePhase === 1 ? '2-pole' : '3-pole';

  notes.push('Motor circuits require separate overload protection per NEC 430.32.');
  notes.push('Conductor sizing per NEC 430.22 (125% of FLA).');

  return {
    breakerSize,
    breakerType,
    loadAmps: motorFLA,
    requiredMinimumBreaker: Math.round(requiredMinimumBreaker * 10) / 10,
    conductorSize: 'See NEC 430.22 motor conductor sizing',
    conductorAmpacity: 0,
    isCompatible: true,
    motorProtectionFactor,
    necReferences,
    warnings,
    notes
  };
}

/**
 * Get all standard breaker sizes available
 * Useful for UI dropdowns
 *
 * @returns Array of standard breaker sizes
 */
export function getStandardBreakerSizes(): number[] {
  return [...STANDARD_BREAKER_SIZES];
}

/**
 * Validate if a breaker size is standard per NEC 240.6(A)
 *
 * @param breakerSize - Breaker size to validate
 * @returns Whether size is standard
 */
export function validateBreakerSize(breakerSize: number): boolean {
  return isStandardBreakerSize(breakerSize);
}
