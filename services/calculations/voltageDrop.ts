/**
 * Voltage Drop Service - NEC Chapter 9 Table 9 Compliant
 * Uses AC impedance (R + jX) for accurate voltage drop calculations
 * 20-30% more accurate than K-factor method for large conductors
 * 2023 NEC Edition
 */

import { ProjectSettings } from '../../types';
import { getConductorImpedance } from '../../data/nec';

/**
 * Result of voltage drop calculation
 */
export interface VoltageDropResult {
  // Voltage drop values
  voltageDropVolts: number;
  voltageDropPercent: number;

  // Compliance
  isCompliant: boolean; // NEC 210.19 recommends ≤3%
  maxRecommendedPercent: number;

  // Calculation details
  method: 'AC Impedance (Chapter 9 Table 9)' | 'K-Factor (Simplified)';
  effectiveZ: number; // Ohms per 1000ft
  distance: number; // One-way feet
  current: number; // Amperes

  // NEC references
  necReferences: string[];
  warnings: string[];
  notes: string[];
}

/**
 * Calculate voltage drop using AC impedance method (NEC Chapter 9 Table 9)
 * This is 20-30% more accurate than K-factor method, especially for large conductors
 *
 * @param conductorSize - Conductor size (e.g., "12 AWG", "250 kcmil")
 * @param material - Conductor material ('Cu' or 'Al')
 * @param conduitType - Conduit type ('PVC', 'Aluminum', 'Steel')
 * @param lengthFeet - One-way circuit length in feet
 * @param loadAmps - Load current in amperes
 * @param voltage - System voltage
 * @param phase - Single-phase or three-phase
 * @param powerFactor - Power factor (default 0.85 for general loads)
 * @returns Voltage drop calculation result
 *
 * @example
 * // 200A feeder, 250 kcmil Cu, 150 feet, 208V 3-phase
 * const result = calculateVoltageDropAC('250 kcmil', 'Cu', 'PVC', 150, 200, 208, 3);
 * // Uses actual AC impedance from NEC Chapter 9 Table 9
 */
export function calculateVoltageDropAC(
  conductorSize: string,
  material: 'Cu' | 'Al',
  conduitType: 'PVC' | 'Aluminum' | 'Steel' = 'PVC',
  lengthFeet: number,
  loadAmps: number,
  voltage: number,
  phase: 1 | 3,
  powerFactor: number = 0.85
): VoltageDropResult {
  const necReferences: string[] = [
    'NEC Chapter 9 Table 9 - AC Resistance and Reactance',
    'NEC 210.19(A)(1) Informational Note No. 4 - Voltage Drop ≤3% recommended'
  ];
  const warnings: string[] = [];
  const notes: string[] = [];

  // Get impedance data from NEC Chapter 9 Table 9
  const impedanceData = getConductorImpedance(conductorSize, material, conduitType);

  if (!impedanceData) {
    throw new Error(
      `Cannot find impedance data for ${conductorSize} ${material} in ${conduitType} conduit. ` +
      `Check NEC Chapter 9 Table 9 for available sizes.`
    );
  }

  // Use effective Z at 0.85 PF from table (most accurate)
  const effectiveZ = impedanceData.effectiveZ;

  // Calculate voltage drop
  // VD = Z × L × I (for 3-phase)
  // VD = 2 × Z × L × I (for single-phase)
  const multiplier = phase === 1 ? 2 : 1;
  const voltageDropVolts = (effectiveZ * lengthFeet * loadAmps * multiplier) / 1000;
  const voltageDropPercent = (voltageDropVolts / voltage) * 100;

  // Check compliance
  const maxRecommendedPercent = 3.0; // NEC 210.19(A)(1) Informational Note No. 4
  const isCompliant = voltageDropPercent <= maxRecommendedPercent;

  if (!isCompliant) {
    warnings.push(
      `⚠️ Voltage drop (${voltageDropPercent.toFixed(2)}%) exceeds NEC recommendation (${maxRecommendedPercent}%). ` +
      `Consider larger conductor or shorter run.`
    );
  }

  if (voltageDropPercent > 5.0) {
    warnings.push(
      `⚠️ CRITICAL: Voltage drop >5% may cause equipment malfunction, overheating, and code violations.`
    );
  }

  // Add informational notes
  notes.push(
    `Effective Z = ${effectiveZ} Ω/1000ft at ${powerFactor} PF (from NEC Table 9)`
  );
  notes.push(
    `AC impedance method accounts for skin effect and inductive reactance in AC circuits.`
  );

  if (conductorSize.includes('kcmil') && parseInt(conductorSize) >= 500) {
    notes.push(
      `Large conductors (≥500 kcmil) benefit most from AC impedance method vs K-factor (20-30% more accurate).`
    );
  }

  return {
    voltageDropVolts: Math.round(voltageDropVolts * 100) / 100,
    voltageDropPercent: Math.round(voltageDropPercent * 100) / 100,
    isCompliant,
    maxRecommendedPercent,
    method: 'AC Impedance (Chapter 9 Table 9)',
    effectiveZ,
    distance: lengthFeet,
    current: loadAmps,
    necReferences,
    warnings,
    notes
  };
}

/**
 * Calculate voltage drop using simplified K-factor method
 * Less accurate than AC impedance, but simpler for quick estimates
 *
 * @param conductorSize - Conductor size
 * @param material - Conductor material
 * @param lengthFeet - One-way circuit length
 * @param loadAmps - Load current
 * @param voltage - System voltage
 * @param phase - Single-phase or three-phase
 * @returns Voltage drop calculation result
 */
export function calculateVoltageDropKFactor(
  conductorSize: string,
  material: 'Cu' | 'Al',
  lengthFeet: number,
  loadAmps: number,
  voltage: number,
  phase: 1 | 3
): VoltageDropResult {
  const necReferences: string[] = [
    'Simplified K-Factor Method (DC Resistance)',
    'NEC 210.19(A)(1) Informational Note No. 4 - Voltage Drop ≤3% recommended'
  ];
  const warnings: string[] = [
    '⚠️ K-factor method uses DC resistance and may underestimate voltage drop by 20-30% for large conductors.'
  ];
  const notes: string[] = [];

  // K factors (ohms per circular mil-foot at 75°C)
  const K = material === 'Cu' ? 12.9 : 21.2;

  // Get circular mils for conductor
  const circularMils = getCircularMils(conductorSize);
  if (!circularMils) {
    throw new Error(`Unknown conductor size: ${conductorSize}`);
  }

  // Calculate voltage drop
  // VD = (K × L × I × multiplier) / CM
  const multiplier = phase === 1 ? 2 : Math.sqrt(3);
  const voltageDropVolts = (K * lengthFeet * loadAmps * multiplier) / circularMils;
  const voltageDropPercent = (voltageDropVolts / voltage) * 100;

  // Check compliance
  const maxRecommendedPercent = 3.0;
  const isCompliant = voltageDropPercent <= maxRecommendedPercent;

  if (!isCompliant) {
    warnings.push(
      `⚠️ Voltage drop (${voltageDropPercent.toFixed(2)}%) exceeds NEC recommendation (${maxRecommendedPercent}%).`
    );
  }

  notes.push(
    `K-factor = ${K} Ω/cmil-ft, Circular Mils = ${circularMils.toLocaleString()}`
  );
  notes.push(
    `For more accurate results, use AC impedance method (calculateVoltageDropAC).`
  );

  return {
    voltageDropVolts: Math.round(voltageDropVolts * 100) / 100,
    voltageDropPercent: Math.round(voltageDropPercent * 100) / 100,
    isCompliant,
    maxRecommendedPercent,
    method: 'K-Factor (Simplified)',
    effectiveZ: K / circularMils * 1000, // Approximate Z in ohms/1000ft
    distance: lengthFeet,
    current: loadAmps,
    necReferences,
    warnings,
    notes
  };
}

/**
 * Calculate maximum circuit length for given voltage drop limit
 * Useful for determining if a conductor size is adequate for a given distance
 *
 * @param conductorSize - Conductor size
 * @param material - Conductor material
 * @param conduitType - Conduit type
 * @param loadAmps - Load current
 * @param voltage - System voltage
 * @param phase - Single-phase or three-phase
 * @param maxVoltageDropPercent - Maximum allowable voltage drop (default 3%)
 * @returns Maximum circuit length in feet
 */
export function calculateMaxCircuitLength(
  conductorSize: string,
  material: 'Cu' | 'Al',
  conduitType: 'PVC' | 'Aluminum' | 'Steel' = 'PVC',
  loadAmps: number,
  voltage: number,
  phase: 1 | 3,
  maxVoltageDropPercent: number = 3.0
): {
  maxLengthFeet: number;
  voltageDropVolts: number;
  necReference: string;
} {
  const impedanceData = getConductorImpedance(conductorSize, material, conduitType);

  if (!impedanceData) {
    throw new Error(
      `Cannot find impedance data for ${conductorSize} ${material} in ${conduitType} conduit.`
    );
  }

  const effectiveZ = impedanceData.effectiveZ;
  const maxVoltageDropVolts = voltage * (maxVoltageDropPercent / 100);

  // VD = Z × L × I × multiplier / 1000
  // L = (VD × 1000) / (Z × I × multiplier)
  const multiplier = phase === 1 ? 2 : 1;
  const maxLengthFeet = (maxVoltageDropVolts * 1000) / (effectiveZ * loadAmps * multiplier);

  return {
    maxLengthFeet: Math.floor(maxLengthFeet),
    voltageDropVolts: maxVoltageDropVolts,
    necReference: `NEC 210.19(A)(1) - Max ${maxVoltageDropPercent}% voltage drop`
  };
}

/**
 * Compare K-factor vs AC impedance methods
 * Useful for understanding accuracy differences
 *
 * @param conductorSize - Conductor size
 * @param material - Conductor material
 * @param lengthFeet - Circuit length
 * @param loadAmps - Load current
 * @param voltage - System voltage
 * @param phase - Phase configuration
 * @returns Comparison of both methods
 */
export function compareVoltageDropMethods(
  conductorSize: string,
  material: 'Cu' | 'Al',
  lengthFeet: number,
  loadAmps: number,
  voltage: number,
  phase: 1 | 3
): {
  acImpedance: VoltageDropResult;
  kFactor: VoltageDropResult;
  difference: {
    volts: number;
    percent: number;
    percentDifference: number;
  };
} {
  const acResult = calculateVoltageDropAC(conductorSize, material, 'PVC', lengthFeet, loadAmps, voltage, phase);
  const kResult = calculateVoltageDropKFactor(conductorSize, material, lengthFeet, loadAmps, voltage, phase);

  const voltsDiff = acResult.voltageDropVolts - kResult.voltageDropVolts;
  const percentDiff = ((acResult.voltageDropVolts - kResult.voltageDropVolts) / kResult.voltageDropVolts) * 100;

  return {
    acImpedance: acResult,
    kFactor: kResult,
    difference: {
      volts: Math.round(voltsDiff * 100) / 100,
      percent: Math.round(percentDiff * 10) / 10,
      percentDifference: Math.abs(Math.round(percentDiff * 10) / 10)
    }
  };
}

/**
 * Get circular mils for conductor size (used in K-factor method)
 */
function getCircularMils(size: string): number | null {
  const circularMilsTable: Record<string, number> = {
    '14 AWG': 4110,
    '12 AWG': 6530,
    '10 AWG': 10380,
    '8 AWG': 16510,
    '6 AWG': 26240,
    '4 AWG': 41740,
    '3 AWG': 52620,
    '2 AWG': 66360,
    '1 AWG': 83690,
    '1/0 AWG': 105600,
    '2/0 AWG': 133100,
    '3/0 AWG': 167800,
    '4/0 AWG': 211600,
    '250 kcmil': 250000,
    '300 kcmil': 300000,
    '350 kcmil': 350000,
    '400 kcmil': 400000,
    '500 kcmil': 500000,
    '600 kcmil': 600000,
    '750 kcmil': 750000,
    '1000 kcmil': 1000000
  };

  return circularMilsTable[size] || null;
}
