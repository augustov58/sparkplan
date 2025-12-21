/**
 * Feeder Sizing Service - NEC Article 215 Compliant
 * Calculates feeder conductor sizing for panel-to-panel or panel-to-transformer connections
 * 2023 NEC Edition
 */

import { sizeConductor } from './conductorSizing';
import { calculateVoltageDropAC } from './voltageDrop';
import { getEgcSize } from '../../data/nec/table-250-122';
import { getNextStandardBreakerSize } from '../../data/nec/standard-breakers';
import type { FeederCalculationInput, FeederCalculationResult } from '../../types';

/**
 * Calculate feeder conductor sizing per NEC Article 215
 *
 * NEC 215.2: Feeder conductors shall have ampacity not less than the loads served
 * NEC 215.2(A)(1): Continuous loads at 125% + noncontinuous loads at 100%
 * NEC 220.61: Feeder neutral load calculation with demand factors
 * NEC 250.122: Equipment grounding conductor sizing
 *
 * @param input - Feeder calculation parameters
 * @returns Complete feeder sizing result with conductor sizes and voltage drop
 *
 * @example
 * const result = calculateFeederSizing({
 *   source_voltage: 208,
 *   source_phase: 3,
 *   destination_voltage: 208,
 *   destination_phase: 3,
 *   total_load_va: 50000,
 *   continuous_load_va: 30000,
 *   noncontinuous_load_va: 20000,
 *   distance_ft: 150,
 *   conductor_material: 'Cu',
 *   ambient_temperature_c: 30,
 *   num_current_carrying: 4
 * });
 */
export function calculateFeederSizing(
  input: FeederCalculationInput
): FeederCalculationResult {
  const warnings: string[] = [];
  const necReferences: string[] = [];

  let design_load_va: number;
  let design_current_amps: number;

  // Check if this feeder is feeding a transformer
  const isFeedingTransformer = input.transformer_kva !== undefined &&
                                 input.transformer_primary_voltage !== undefined &&
                                 input.transformer_primary_phase !== undefined;

  if (isFeedingTransformer) {
    // TRANSFORMER FEEDER SIZING per NEC 450.3(B)
    necReferences.push(
      'NEC 215.2(A)(1) - Feeder Ampacity Requirements',
      'NEC 450.3(B) - Transformer Overcurrent Protection',
      'NEC 215.3 - Overload Protection'
    );

    // STEP 1: Calculate transformer primary current
    // I_primary = (kVA × 1000) / (V × √3) for 3-phase
    // I_primary = (kVA × 1000) / V for single-phase
    const transformerPrimaryCurrent = input.transformer_primary_phase === 3
      ? (input.transformer_kva! * 1000) / (input.transformer_primary_voltage! * Math.sqrt(3))
      : (input.transformer_kva! * 1000) / input.transformer_primary_voltage!;

    // STEP 2: Apply 125% factor for continuous load (NEC 215.2(A)(1))
    // Transformers are considered continuous loads
    design_current_amps = transformerPrimaryCurrent * 1.25;
    design_load_va = input.transformer_kva! * 1000 * 1.25;

    warnings.push(
      `ℹ️ Feeder sized for ${input.transformer_kva} kVA transformer. ` +
      `Transformer primary current: ${transformerPrimaryCurrent.toFixed(1)}A, ` +
      `feeder sized at 125% = ${design_current_amps.toFixed(1)}A (NEC 450.3(B))`
    );

  } else {
    // STANDARD PANEL FEEDER SIZING per NEC 215.2(A)(1)
    necReferences.push(
      'NEC 215.2 - Feeder Conductor Ampacity',
      'NEC 215.2(A)(1) - 125% Continuous + 100% Noncontinuous Loads'
    );

    // STEP 1: Calculate design load per NEC 215.2(A)(1)
    // Design load = (continuous × 1.25) + (noncontinuous × 1.0)
    design_load_va = (input.continuous_load_va * 1.25) + input.noncontinuous_load_va;

    if (input.continuous_load_va > input.total_load_va * 0.8) {
      warnings.push(
        `ℹ️ High continuous load (${((input.continuous_load_va / input.total_load_va) * 100).toFixed(0)}%). ` +
        `Ensure adequate conductor cooling and derating.`
      );
    }

    // STEP 2: Calculate design current
    if (input.source_phase === 1) {
      // Single-phase: I = VA / V
      design_current_amps = design_load_va / input.source_voltage;
    } else {
      // Three-phase: I = VA / (√3 × V)
      design_current_amps = design_load_va / (Math.sqrt(3) * input.source_voltage);
    }
  }

  // STEP 3: Size phase conductors using conductor sizing service
  // Note: We pass isContinuous=false because we already factored in 125% in design_load_va
  const phaseConductor = sizeConductor(
    design_current_amps,
    {
      serviceVoltage: input.source_voltage,
      servicePhase: input.source_phase,
      occupancyType: 'commercial', // Feeders typically use commercial/industrial ratings
      conductorMaterial: input.conductor_material,
      temperatureRating: input.temperature_rating || 75 // Use specified temp rating or default to 75°C
    },
    input.ambient_temperature_c,
    input.num_current_carrying,
    false, // Continuous factor already applied in design_load_va
    undefined // Let conductor sizing calculate appropriate OCPD
  );

  necReferences.push(...phaseConductor.necReferences);
  warnings.push(...phaseConductor.warnings);

  // STEP 4: Calculate voltage drop using AC impedance method
  const vdResult = calculateVoltageDropAC(
    phaseConductor.conductorSize,
    input.conductor_material,
    'PVC', // Default to PVC conduit
    input.distance_ft,
    design_current_amps,
    input.source_voltage,
    input.source_phase
  );

  const max_vd = input.max_voltage_drop_percent || 3.0;
  const meets_vd = vdResult.voltageDropPercent <= max_vd;

  if (!meets_vd) {
    warnings.push(
      `⚠️ Voltage drop ${vdResult.voltageDropPercent.toFixed(2)}% exceeds ${max_vd}% limit ` +
      `(NEC 210.19 informational note). Consider upsizing conductor or reducing distance.`
    );
  }

  necReferences.push('NEC 210.19 Informational Note No. 4 - Voltage Drop ≤3% recommended');
  necReferences.push(vdResult.method);

  // STEP 5: Size neutral conductor per NEC 220.61
  // Simplified approach: Use same size as phase conductor
  // Full implementation would apply demand factors for neutral current calculation
  // (200A service: 200A @ 100% + excess @ 70%)
  const neutral_conductor_size = phaseConductor.conductorSize;
  necReferences.push('NEC 220.61 - Feeder Neutral Load');

  // Note for future enhancement
  if (input.source_phase === 3) {
    warnings.push(
      `ℹ️ Neutral sizing simplified. For 3-phase systems with unbalanced loads, ` +
      `apply NEC 220.61 demand factors to neutral current.`
    );
  }

  // STEP 6: Size EGC per NEC 250.122 (using already implemented calculateEgcSize)
  const breaker_size = getNextStandardBreakerSize(design_current_amps);
  const egc_size = phaseConductor.egcSize; // Already calculated in sizeConductor

  necReferences.push('NEC 250.122 - Equipment Grounding Conductor Sizing');

  // STEP 7: Calculate recommended conduit size (simplified estimate)
  const num_conductors = input.source_phase === 3
    ? 4  // 3 phase + neutral
    : 3; // 2 phase + neutral (for single-phase)
  const conduit_size = estimateConduitSize(phaseConductor.conductorSize, num_conductors);
  necReferences.push('NEC Chapter 9, Table 4 - Conduit Fill (40% rule)');

  if (input.distance_ft > 200) {
    warnings.push(
      `ℹ️ Long feeder run (${input.distance_ft} ft). Verify conduit supports and ` +
      `consider pull boxes per NEC 314.28.`
    );
  }

  return {
    design_load_va: Math.round(design_load_va),
    design_current_amps: Math.round(design_current_amps * 10) / 10,
    phase_conductor_size: phaseConductor.conductorSize,
    phase_conductor_ampacity: phaseConductor.adjustedAmpacity,
    neutral_conductor_size,
    egc_size,
    recommended_conduit_size: conduit_size,
    voltage_drop_percent: vdResult.voltageDropPercent,
    voltage_drop_volts: vdResult.voltageDropVolts,
    meets_voltage_drop: meets_vd,
    warnings,
    necReferences
  };
}

/**
 * Simplified conduit sizing based on conductor size and count
 * Conservative estimate following NEC Chapter 9 Table 4 (40% fill rule)
 *
 * @param conductorSize - Phase conductor size (e.g., "12 AWG", "2/0 AWG")
 * @param numConductors - Total number of conductors (phase + neutral + EGC)
 * @returns Recommended conduit trade size
 *
 * NOTE: This is a simplified lookup. For precise sizing, use full NEC
 * Chapter 9 calculations with actual conductor areas and conduit fill tables.
 */
function estimateConduitSize(conductorSize: string, numConductors: number): string {
  // Simplified mapping for common scenarios (3-4 conductors)
  // Based on NEC Chapter 9 Table 4 for EMT conduit at 40% fill
  const sizeMap: Record<string, string> = {
    '14 AWG': '1/2"',
    '12 AWG': '1/2"',
    '10 AWG': '3/4"',
    '8 AWG': '3/4"',
    '6 AWG': '1"',
    '4 AWG': '1-1/4"',
    '3 AWG': '1-1/4"',
    '2 AWG': '1-1/2"',
    '1 AWG': '1-1/2"',
    '1/0 AWG': '2"',
    '2/0 AWG': '2"',
    '3/0 AWG': '2-1/2"',
    '4/0 AWG': '3"',
    '250 kcmil': '3"',
    '300 kcmil': '3-1/2"',
    '350 kcmil': '3-1/2"',
    '400 kcmil': '4"',
    '500 kcmil': '4"',
    '600 kcmil': '5"',
    '750 kcmil': '5"',
    '1000 kcmil': '6"'
  };

  const baseSize = sizeMap[conductorSize] || '3"';

  // Upsize if more than 4 conductors (conservative approach)
  if (numConductors > 6) {
    return upsizeConduit(baseSize, 2); // Two sizes larger
  } else if (numConductors > 4) {
    return upsizeConduit(baseSize, 1); // One size larger
  }

  return baseSize;
}

/**
 * Helper function to upsize conduit by N standard sizes
 */
function upsizeConduit(currentSize: string, steps: number): string {
  const sizes = [
    '1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"',
    '3"', '3-1/2"', '4"', '5"', '6"'
  ];

  const currentIndex = sizes.indexOf(currentSize);
  if (currentIndex === -1) return currentSize;

  const newIndex = Math.min(currentIndex + steps, sizes.length - 1);
  return sizes[newIndex];
}
