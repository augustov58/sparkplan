import { TemperatureCorrectionFactor } from '../../types/nec-types';

/**
 * NEC Table 310.15(B)(1) - Ambient Temperature Correction Factors
 * Based on 30°C (86°F) ambient temperature
 * 2023 NEC Edition
 *
 * These factors adjust conductor ampacity based on ambient temperature.
 * Higher temperatures reduce ampacity; lower temperatures increase it.
 * The base ampacity from Table 310.16 assumes 30°C ambient.
 */
export const TABLE_310_15_B1: TemperatureCorrectionFactor[] = [
  { ambientTempC: 10, temp60C: 1.29, temp75C: 1.20, temp90C: 1.15 },
  { ambientTempC: 15, temp60C: 1.22, temp75C: 1.15, temp90C: 1.12 },
  { ambientTempC: 20, temp60C: 1.15, temp75C: 1.11, temp90C: 1.08 },
  { ambientTempC: 25, temp60C: 1.08, temp75C: 1.05, temp90C: 1.04 },
  { ambientTempC: 30, temp60C: 1.00, temp75C: 1.00, temp90C: 1.00 }, // Base
  { ambientTempC: 35, temp60C: 0.91, temp75C: 0.94, temp90C: 0.96 },
  { ambientTempC: 40, temp60C: 0.82, temp75C: 0.88, temp90C: 0.91 },
  { ambientTempC: 45, temp60C: 0.71, temp75C: 0.82, temp90C: 0.87 },
  { ambientTempC: 50, temp60C: 0.58, temp75C: 0.75, temp90C: 0.82 },
  { ambientTempC: 55, temp60C: 0.41, temp75C: 0.67, temp90C: 0.76 },
  { ambientTempC: 60, temp60C: 0.00, temp75C: 0.58, temp90C: 0.71 },
  { ambientTempC: 65, temp60C: 0.00, temp75C: 0.47, temp90C: 0.65 },
  { ambientTempC: 70, temp60C: 0.00, temp75C: 0.33, temp90C: 0.58 },
  { ambientTempC: 75, temp60C: 0.00, temp75C: 0.00, temp90C: 0.50 },
  { ambientTempC: 80, temp60C: 0.00, temp75C: 0.00, temp90C: 0.41 },
  { ambientTempC: 85, temp60C: 0.00, temp75C: 0.00, temp90C: 0.29 },
  { ambientTempC: 90, temp60C: 0.00, temp75C: 0.00, temp90C: 0.00 }
];

/**
 * Get temperature correction factor for given ambient temperature
 *
 * @param ambientTempC - Ambient temperature in degrees Celsius
 * @param insulationTemp - Insulation temperature rating (60, 75, or 90 degrees C)
 * @returns Correction factor (multiply by base ampacity)
 *
 * @example
 * // For 12 AWG copper at 75°C in 40°C ambient:
 * const baseMaterial = 25; // from Table 310.16
 * const correction = getTemperatureCorrectionFactor(40, 75); // 0.88
 * const adjustedAmpacity = baseAmpacity * correction; // 25 * 0.88 = 22A
 */
export function getTemperatureCorrectionFactor(
  ambientTempC: number,
  insulationTemp: 60 | 75 | 90
): number {
  // NEC requires using the table row at or above the actual ambient temperature
  // (round UP to next listed row for conservative derating)
  if (TABLE_310_15_B1.length === 0) return 1.0;

  // For temps at or below the lowest row (10°C), use that row (gives a bonus factor)
  if (ambientTempC <= TABLE_310_15_B1[0].ambientTempC) {
    const entry = TABLE_310_15_B1[0];
    if (insulationTemp === 60) return entry.temp60C;
    if (insulationTemp === 75) return entry.temp75C;
    return entry.temp90C;
  }

  // Find the first row where table temp >= ambient temp (round up)
  for (const entry of TABLE_310_15_B1) {
    if (entry.ambientTempC >= ambientTempC) {
      if (insulationTemp === 60) return entry.temp60C;
      if (insulationTemp === 75) return entry.temp75C;
      return entry.temp90C;
    }
  }

  // Ambient exceeds highest table row — conductor cannot be used at this temp
  return 0.00;
}
