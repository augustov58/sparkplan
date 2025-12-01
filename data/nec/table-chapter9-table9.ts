import { ConductorImpedance } from '../../types/nec-types';

/**
 * NEC Chapter 9 Table 9 - AC Resistance and Reactance for 600V Cables
 * 3-Phase, 60 Hz, 75°C - Three Single Conductors in Conduit
 * Effective Z at 0.85 PF
 * 2023 NEC Edition
 *
 * This table provides the actual AC impedance values for conductors, which
 * is more accurate than DC resistance K-factors. AC impedance includes both
 * resistance (R) and inductive reactance (XL), which varies with conductor size.
 *
 * Using these values for voltage drop calculations is significantly more accurate
 * than simplified K-factor methods, especially for large conductors and long runs.
 */
export const CHAPTER_9_TABLE_9: ConductorImpedance[] = [
  // Copper in PVC conduit
  { size: '14 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 3.1, reactanceXLOhmsPerKFt: 0.044, effectiveZ: 2.7 },
  { size: '12 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 2.0, reactanceXLOhmsPerKFt: 0.042, effectiveZ: 1.7 },
  { size: '10 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 1.2, reactanceXLOhmsPerKFt: 0.040, effectiveZ: 1.1 },
  { size: '8 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.78, reactanceXLOhmsPerKFt: 0.052, effectiveZ: 0.69 },
  { size: '6 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.49, reactanceXLOhmsPerKFt: 0.051, effectiveZ: 0.44 },
  { size: '4 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.31, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.28 },
  { size: '3 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.25, reactanceXLOhmsPerKFt: 0.047, effectiveZ: 0.23 },
  { size: '2 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.19, reactanceXLOhmsPerKFt: 0.045, effectiveZ: 0.18 },
  { size: '1 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.15, reactanceXLOhmsPerKFt: 0.046, effectiveZ: 0.14 },
  { size: '1/0 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.12, reactanceXLOhmsPerKFt: 0.044, effectiveZ: 0.11 },
  { size: '2/0 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.10, reactanceXLOhmsPerKFt: 0.043, effectiveZ: 0.091 },
  { size: '3/0 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.077, reactanceXLOhmsPerKFt: 0.042, effectiveZ: 0.072 },
  { size: '4/0 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.062, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.058 },
  { size: '250 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.052, reactanceXLOhmsPerKFt: 0.040, effectiveZ: 0.049 },
  { size: '300 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.044, reactanceXLOhmsPerKFt: 0.039, effectiveZ: 0.041 },
  { size: '350 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.038, reactanceXLOhmsPerKFt: 0.038, effectiveZ: 0.036 },
  { size: '400 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.033, reactanceXLOhmsPerKFt: 0.037, effectiveZ: 0.032 },
  { size: '500 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.027, reactanceXLOhmsPerKFt: 0.036, effectiveZ: 0.026 },
  { size: '600 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.023, reactanceXLOhmsPerKFt: 0.035, effectiveZ: 0.022 },
  { size: '750 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.019, reactanceXLOhmsPerKFt: 0.034, effectiveZ: 0.019 },
  { size: '1000 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.015, reactanceXLOhmsPerKFt: 0.033, effectiveZ: 0.016 },

  // Aluminum in PVC conduit
  { size: '12 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 3.2, reactanceXLOhmsPerKFt: 0.042, effectiveZ: 2.8 },
  { size: '10 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 2.0, reactanceXLOhmsPerKFt: 0.040, effectiveZ: 1.7 },
  { size: '8 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 1.3, reactanceXLOhmsPerKFt: 0.052, effectiveZ: 1.1 },
  { size: '6 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.81, reactanceXLOhmsPerKFt: 0.051, effectiveZ: 0.72 },
  { size: '4 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.51, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.45 },
  { size: '3 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.40, reactanceXLOhmsPerKFt: 0.047, effectiveZ: 0.36 },
  { size: '2 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.32, reactanceXLOhmsPerKFt: 0.045, effectiveZ: 0.29 },
  { size: '1 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.25, reactanceXLOhmsPerKFt: 0.046, effectiveZ: 0.23 },
  { size: '1/0 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.20, reactanceXLOhmsPerKFt: 0.044, effectiveZ: 0.18 },
  { size: '2/0 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.16, reactanceXLOhmsPerKFt: 0.043, effectiveZ: 0.14 },
  { size: '3/0 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.13, reactanceXLOhmsPerKFt: 0.042, effectiveZ: 0.12 },
  { size: '4/0 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.10, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.095 },
  { size: '250 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.085, reactanceXLOhmsPerKFt: 0.040, effectiveZ: 0.079 },
  { size: '300 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.071, reactanceXLOhmsPerKFt: 0.039, effectiveZ: 0.067 },
  { size: '350 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.061, reactanceXLOhmsPerKFt: 0.038, effectiveZ: 0.057 },
  { size: '400 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.054, reactanceXLOhmsPerKFt: 0.037, effectiveZ: 0.051 },
  { size: '500 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.043, reactanceXLOhmsPerKFt: 0.036, effectiveZ: 0.041 },
  { size: '600 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.036, reactanceXLOhmsPerKFt: 0.035, effectiveZ: 0.035 },
  { size: '750 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.029, reactanceXLOhmsPerKFt: 0.034, effectiveZ: 0.029 },
  { size: '1000 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.023, reactanceXLOhmsPerKFt: 0.033, effectiveZ: 0.024 }
];

/**
 * Get conductor impedance data for voltage drop calculations
 *
 * @param size - Conductor size (e.g., "12 AWG", "250 kcmil")
 * @param material - Conductor material ('Cu' or 'Al')
 * @param conduitType - Conduit type (defaults to 'PVC')
 * @returns ConductorImpedance object with R, XL, and effective Z values, or null if not found
 *
 * @example
 * const impedance = getConductorImpedance('12 AWG', 'Cu', 'PVC');
 * // impedance.resistanceOhmsPerKFt = 2.0
 * // impedance.reactanceXLOhmsPerKFt = 0.042
 * // impedance.effectiveZ = 1.7
 */
export function getConductorImpedance(
  size: string,
  material: 'Cu' | 'Al',
  conduitType: 'PVC' | 'Aluminum' | 'Steel' = 'PVC'
): ConductorImpedance | null {
  return CHAPTER_9_TABLE_9.find(
    e => e.size === size && e.material === material && e.conduitType === conduitType
  ) || null;
}
