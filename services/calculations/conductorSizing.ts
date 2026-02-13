/**
 * Conductor Sizing Service - NEC Article 310 Compliant
 * Applies temperature correction, bundling adjustment, and continuous load factors
 * Includes Equipment Grounding Conductor (EGC) sizing per NEC 250.122
 * 2023 NEC Edition
 */

import { ProjectSettings } from '../../types';
import {
  TABLE_310_16,
  getTemperatureCorrectionFactor,
  getBundlingAdjustmentFactor,
  findConductorByAmpacity
} from '../../data/nec';
import { getEgcSize, getEgcSizeDetailed } from '../../data/nec/table-250-122';
import {
  calculateProportionalEgcSize,
  compareConductorSizes
} from '../../data/nec/conductor-properties';

/**
 * Result of conductor sizing calculation
 */
export interface ConductorSizingResult {
  // Required conductor specs
  conductorSize: string;
  ampacity: number;
  adjustedAmpacity: number;

  // Equipment grounding conductor
  egcSize: string;
  egcUpsized: boolean; // True if EGC was proportionally upsized per 250.122(B)

  // Adjustment factors applied
  baseTempCorrection: number;
  bundlingAdjustment: number;
  continuousLoadFactor: number;

  // Calculation breakdown
  requiredAmpacity: number;
  baseAmpacity: number;

  // NEC references
  necReferences: string[];
  warnings: string[];
}

/**
 * Calculate Equipment Grounding Conductor (EGC) size
 * Per NEC 250.122 with proportional upsizing per 250.122(B)
 *
 * @param ocpdRating - Overcurrent protective device rating in amperes
 * @param phaseConductorSize - Actual phase conductor size installed
 * @param material - Conductor material ('Cu' or 'Al')
 * @param requiresUpsizing - Whether proportional upsizing is required (phase conductors upsized for VD)
 * @returns EGC sizing result
 */
export function calculateEgcSize(
  ocpdRating: number,
  phaseConductorSize: string,
  material: 'Cu' | 'Al',
  requiresUpsizing: boolean = false
): {
  egcSize: string;
  baseEgcSize: string;
  upsized: boolean;
  necReferences: string[];
  notes: string[];
} {
  const necReferences: string[] = [];
  const notes: string[] = [];

  // Step 1: Get base EGC size from Table 250.122
  const baseResult = getEgcSizeDetailed(ocpdRating, material);
  const baseEgcSize = baseResult.egcSize;
  necReferences.push(baseResult.necReference);
  notes.push(...baseResult.notes);

  let finalEgcSize = baseEgcSize;
  let upsized = false;

  // Step 2: Check if proportional upsizing is required (NEC 250.122(B))
  if (requiresUpsizing && baseResult.tableEntry) {
    // Find what phase conductor size corresponds to this OCPD rating from Table 310.16
    // For proportional sizing, we need to know the "base" phase conductor size
    // that would normally be used with this OCPD rating

    // This is a simplified approach - in practice, you'd look up the base conductor
    // from ampacity tables. For now, we'll check if the actual phase conductor
    // is larger than what the table suggests
    const basePhaseConductor = getTypicalConductorForOcpd(ocpdRating, material);

    if (basePhaseConductor) {
      const comparison = compareConductorSizes(phaseConductorSize, basePhaseConductor);

      if (comparison !== null && comparison > 0) {
        // Phase conductor was upsized, need to proportionally upsize EGC
        const upsizedEgc = calculateProportionalEgcSize(
          baseEgcSize,
          basePhaseConductor,
          phaseConductorSize
        );

        if (upsizedEgc && upsizedEgc !== baseEgcSize) {
          finalEgcSize = upsizedEgc;
          upsized = true;
          necReferences.push('NEC 250.122(B) - Proportional EGC upsizing');
          notes.push(
            `✓ EGC proportionally upsized from ${baseEgcSize} to ${finalEgcSize} AWG` +
            ` because phase conductors increased from ${basePhaseConductor} to ${phaseConductorSize} AWG`
          );
        }
      }
    }
  }

  return {
    egcSize: finalEgcSize,
    baseEgcSize,
    upsized,
    necReferences,
    notes
  };
}

/**
 * Get typical phase conductor size for a given OCPD rating
 * Used for determining if EGC proportional upsizing is needed
 * This is a simplified lookup - actual sizing depends on many factors
 */
function getTypicalConductorForOcpd(ocpdRating: number, material: 'Cu' | 'Al'): string | null {
  // Typical conductor sizes at 75°C for common OCPD ratings
  const typicalSizes: Record<number, { Cu: string; Al: string }> = {
    15: { Cu: '14', Al: '12' },
    20: { Cu: '12', Al: '10' },
    30: { Cu: '10', Al: '8' },
    40: { Cu: '8', Al: '6' },
    50: { Cu: '8', Al: '6' },
    60: { Cu: '6', Al: '4' },
    70: { Cu: '6', Al: '4' },
    80: { Cu: '4', Al: '2' },
    90: { Cu: '4', Al: '2' },
    100: { Cu: '3', Al: '1' },
    110: { Cu: '3', Al: '1' },
    125: { Cu: '2', Al: '1/0' },
    150: { Cu: '1', Al: '2/0' },
    175: { Cu: '1/0', Al: '3/0' },
    200: { Cu: '2/0', Al: '4/0' },
  };

  const entry = typicalSizes[ocpdRating];
  if (!entry) return null;
  return material === 'Cu' ? entry.Cu : entry.Al;
}

/**
 * Size conductor based on load current with all NEC correction factors
 *
 * @param loadAmps - Load current in amperes
 * @param settings - Project electrical settings
 * @param ambientTempC - Ambient temperature in Celsius (default 30°C per NEC)
 * @param numConductors - Number of current-carrying conductors in raceway (default 3 for 3-phase)
 * @param isContinuous - Whether load is continuous (>3 hours)
 * @param ocpdRating - Optional OCPD rating for EGC sizing (if not provided, uses requiredAmpacity)
 * @returns Conductor sizing result with all corrections including EGC
 *
 * @example
 * // Size conductor for 80A continuous load, 40°C ambient, 6 conductors in conduit
 * const result = sizeConductor(80, settings, 40, 6, true);
 * // result.conductorSize = "4 AWG", result.egcSize = "8 AWG"
 */
export function sizeConductor(
  loadAmps: number,
  settings: ProjectSettings,
  ambientTempC: number = 30,
  numConductors: number = 3,
  isContinuous: boolean = true,
  ocpdRating?: number
): ConductorSizingResult {
  const necReferences: string[] = ['NEC 310.16 - Conductor Ampacity'];
  const warnings: string[] = [];

  // 1. APPLY CONTINUOUS LOAD FACTOR (NEC 210.19(A)(1))
  const continuousLoadFactor = isContinuous ? 1.25 : 1.0;
  const requiredAmpacity = loadAmps * continuousLoadFactor;

  if (isContinuous) {
    necReferences.push('NEC 210.19(A)(1) - 125% Continuous Load Factor');
  }

  // 2. GET TEMPERATURE CORRECTION FACTOR (NEC 310.15(B)(1))
  const tempCorrection = getTemperatureCorrectionFactor(ambientTempC, settings.temperatureRating);
  if (tempCorrection !== 1.0) {
    necReferences.push('NEC 310.15(B)(1) - Temperature Correction');
  }

  if (ambientTempC > 40) {
    warnings.push(`⚠️ High ambient temperature (${ambientTempC}°C) requires significant derating.`);
  }

  // 3. GET BUNDLING ADJUSTMENT FACTOR (NEC 310.15(C)(1))
  const bundlingAdjustment = getBundlingAdjustmentFactor(numConductors);
  if (bundlingAdjustment !== 1.0) {
    necReferences.push('NEC 310.15(C)(1) - Bundling Adjustment');
  }

  if (numConductors > 9) {
    warnings.push(`⚠️ High conductor count (${numConductors}) requires significant derating (${bundlingAdjustment * 100}%).`);
  }

  // 4. CALCULATE REQUIRED BASE AMPACITY
  // Base ampacity must be high enough that after applying corrections, it meets required ampacity
  // Formula: Base Ampacity × TempCorrection × BundlingAdjustment ≥ Required Ampacity
  const combinedDerating = tempCorrection * bundlingAdjustment;

  if (combinedDerating < 0.5) {
    warnings.push('⚠️ CRITICAL: Combined derating <50%. Consider reducing conductors per raceway or improving ventilation.');
  }

  const baseAmpacityNeeded = requiredAmpacity / combinedDerating;

  // 5. FIND CONDUCTOR SIZE FROM TABLE 310.16
  const conductor = findConductorByAmpacity(
    baseAmpacityNeeded,
    settings.conductorMaterial,
    settings.temperatureRating
  );

  if (!conductor) {
    throw new Error(`Cannot find conductor for ${baseAmpacityNeeded}A at ${settings.temperatureRating}°C with ${settings.conductorMaterial}`);
  }

  // Get actual base ampacity from table
  const baseAmpacity = conductor[`temp${settings.temperatureRating}C` as 'temp60C' | 'temp75C' | 'temp90C'];

  // Calculate adjusted ampacity after all corrections
  const adjustedAmpacity = baseAmpacity * combinedDerating;

  // Verify adjusted ampacity meets requirement
  if (adjustedAmpacity < requiredAmpacity) {
    warnings.push('⚠️ WARNING: Adjusted ampacity is marginal. Consider next size up for safety margin.');
  }

  // CHECK NEC 110.14(C) - TERMINATION TEMPERATURE RATING LIMITS
  // For circuits ≤100A with conductors #14-#1 AWG: Use 60°C column for terminations
  // For circuits >100A: Use 75°C column for terminations
  const requiredOCPD = ocpdRating ?? Math.ceil(requiredAmpacity);
  let finalConductor = conductor;
  let finalBaseAmpacity = baseAmpacity;
  let finalAdjustedAmpacity = adjustedAmpacity;

  // List of "small conductors" per NEC 110.14(C)(1)(a)
  const smallConductorSizes = ['14 AWG', '12 AWG', '10 AWG', '8 AWG', '6 AWG', '4 AWG', '3 AWG', '2 AWG', '1 AWG'];
  const isSmallConductor = smallConductorSizes.includes(conductor.size);

  // NEC 110.14(C): Termination temperature limits
  if (requiredAmpacity <= 100 && isSmallConductor && settings.temperatureRating > 60) {
    // For circuits ≤100A with small conductors, check 60°C termination rating
    const ampacityAt60C = conductor.temp60C;
    const adjustedAmpacityAt60C = ampacityAt60C * combinedDerating;

    if (adjustedAmpacityAt60C < requiredAmpacity) {
      // Conductor doesn't meet requirements at 60°C termination - need to upsize
      warnings.push(
        `⚠️ NEC 110.14(C)(1)(a): Circuits ≤100A require 60°C termination rating. ` +
        `${conductor.size} at 60°C = ${ampacityAt60C}A (adjusted: ${adjustedAmpacityAt60C.toFixed(1)}A) is insufficient for ${requiredAmpacity.toFixed(1)}A. Upsizing conductor.`
      );
      necReferences.push('NEC 110.14(C)(1) - Termination Temperature Rating');

      // Find conductor that meets requirement at 60°C
      const requiredAt60C = requiredAmpacity / combinedDerating;
      const upsizedConductor = findConductorByAmpacity(
        requiredAt60C,
        settings.conductorMaterial,
        60 // Use 60°C column
      );

      if (upsizedConductor) {
        finalConductor = upsizedConductor;
        // Still use the higher temp rating for the base ampacity (for derating calculations)
        finalBaseAmpacity = upsizedConductor[`temp${settings.temperatureRating}C` as 'temp60C' | 'temp75C' | 'temp90C'];
        finalAdjustedAmpacity = finalBaseAmpacity * combinedDerating;
        warnings.push(
          `✓ Upsized to ${upsizedConductor.size} to meet 60°C termination requirement (${upsizedConductor.temp60C}A @ 60°C).`
        );
      }
    } else {
      // Conductor is sized based on higher temp but limited by 60°C termination
      necReferences.push('NEC 110.14(C)(1)(a) - 60°C termination for ≤100A circuits');
      warnings.push(
        `ℹ️ NEC 110.14(C): Circuit ≤100A requires 60°C termination. ` +
        `${conductor.size} rated ${ampacityAt60C}A @ 60°C, sufficient for ${requiredAmpacity.toFixed(1)}A.`
      );
    }
  } else if (requiredAmpacity > 100 && settings.temperatureRating > 75) {
    // For circuits >100A, 75°C termination rating applies
    necReferences.push('NEC 110.14(C)(1)(b) - 75°C termination for >100A circuits');
    warnings.push(
      `ℹ️ NEC 110.14(C): Circuit >100A uses 75°C termination rating.`
    );
  }

  // CHECK NEC 240.4(D) - OVERCURRENT PROTECTION FOR SMALL CONDUCTORS
  // 14 AWG: Max 15A | 12 AWG: Max 20A | 10 AWG: Max 30A
  const smallConductorLimits: Record<string, number> = {
    '14 AWG': 15,
    '12 AWG': 20,
    '10 AWG': 30
  };

  const maxLimit = smallConductorLimits[finalConductor.size];
  if (maxLimit && requiredOCPD > maxLimit) {
    // Selected conductor violates NEC 240.4(D) - need to upsize
    warnings.push(
      `⚠️ NEC 240.4(D): ${finalConductor.size} limited to ${maxLimit}A OCPD. ` +
      `Load requires ${requiredOCPD}A protection - upsizing conductor.`
    );
    necReferences.push('NEC 240.4(D) - Small Conductor Protection');

    // Find next larger conductor that can handle the OCPD
    // Must exceed current conductor's ampacity to actually get the next size up
    let nextBaseAmpacity = baseAmpacityNeeded;
    if (finalConductor.size === '14 AWG') {
      // 14 AWG Cu@75°C = 20A; need >20A to land on 12 AWG
      nextBaseAmpacity = Math.max(baseAmpacityNeeded, 20 / combinedDerating + 0.1);
    } else if (finalConductor.size === '12 AWG') {
      // 12 AWG Cu@75°C = 25A; need >25A to land on 10 AWG
      nextBaseAmpacity = Math.max(baseAmpacityNeeded, 25 / combinedDerating + 0.1);
    }

    const upsizedConductor = findConductorByAmpacity(
      nextBaseAmpacity,
      settings.conductorMaterial,
      settings.temperatureRating
    );

    if (upsizedConductor) {
      finalConductor = upsizedConductor;
      finalBaseAmpacity = upsizedConductor[`temp${settings.temperatureRating}C` as 'temp60C' | 'temp75C' | 'temp90C'];
      finalAdjustedAmpacity = finalBaseAmpacity * combinedDerating;
      warnings.push(
        `✓ Upsized to ${upsizedConductor.size} to comply with NEC 240.4(D) overcurrent protection limits.`
      );
    }
  }

  // 6. CALCULATE EQUIPMENT GROUNDING CONDUCTOR SIZE (NEC 250.122)
  const ocpdForEgc = ocpdRating ?? Math.ceil(requiredAmpacity);
  const egcResult = calculateEgcSize(
    ocpdForEgc,
    finalConductor.size,
    settings.conductorMaterial,
    false // Don't auto-upsize - would need voltage drop calculation to determine
  );

  necReferences.push(...egcResult.necReferences);
  if (egcResult.notes.length > 0) {
    warnings.push(...egcResult.notes);
  }

  return {
    conductorSize: finalConductor.size,
    ampacity: finalBaseAmpacity,
    adjustedAmpacity: Math.round(finalAdjustedAmpacity * 100) / 100,
    egcSize: egcResult.egcSize,
    egcUpsized: egcResult.upsized,
    baseTempCorrection: tempCorrection,
    bundlingAdjustment,
    continuousLoadFactor,
    requiredAmpacity: Math.round(requiredAmpacity * 100) / 100,
    baseAmpacity: finalBaseAmpacity,
    necReferences,
    warnings
  };
}

/**
 * Size conductor for parallel runs (large services)
 * NEC 310.10(G) - Conductors in Parallel
 *
 * @param totalLoadAmps - Total load current
 * @param numParallel - Number of conductors in parallel per phase
 * @param settings - Project electrical settings
 * @param ambientTempC - Ambient temperature
 * @param numConductors - Total conductors in raceway
 * @param isContinuous - Whether load is continuous
 * @returns Conductor sizing for each parallel conductor
 */
export function sizeParallelConductors(
  totalLoadAmps: number,
  numParallel: number,
  settings: ProjectSettings,
  ambientTempC: number = 30,
  numConductors: number = 3,
  isContinuous: boolean = true
): ConductorSizingResult & { totalConductors: number; perConductorAmps: number } {
  if (numParallel < 2) {
    throw new Error('Parallel conductors require at least 2 conductors per phase');
  }

  // NEC 310.10(G) - Parallel conductors must be same length, material, size, and insulation
  const perConductorAmps = totalLoadAmps / numParallel;

  const result = sizeConductor(
    perConductorAmps,
    settings,
    ambientTempC,
    numConductors * numParallel, // Multiply conductors by parallel count
    isContinuous
  );

  result.necReferences.push('NEC 310.10(G) - Conductors in Parallel');
  result.warnings.push(`ℹ️ Using ${numParallel} conductors in parallel per phase. All must be same length, material, and size.`);

  return {
    ...result,
    totalConductors: numParallel,
    perConductorAmps: Math.round(perConductorAmps * 100) / 100
  };
}

/**
 * Calculate voltage drop for conductor size
 * Uses simplified DC resistance formula (AC impedance method in separate service)
 *
 * @param conductorSize - Conductor size (e.g., "12 AWG", "250 kcmil")
 * @param material - Conductor material
 * @param lengthFeet - One-way circuit length in feet
 * @param loadAmps - Load current in amperes
 * @param voltage - System voltage
 * @param phase - Single-phase or three-phase
 * @returns Voltage drop information
 */
export function calculateVoltageDrop(
  conductorSize: string,
  material: 'Cu' | 'Al',
  lengthFeet: number,
  loadAmps: number,
  voltage: number,
  phase: 1 | 3
): {
  voltageDropVolts: number;
  voltageDropPercent: number;
  isCompliant: boolean; // NEC 210.19 recommends ≤3%
  necReference: string;
} {
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

  return {
    voltageDropVolts: Math.round(voltageDropVolts * 100) / 100,
    voltageDropPercent: Math.round(voltageDropPercent * 100) / 100,
    isCompliant: voltageDropPercent <= 3.0,
    necReference: 'NEC 210.19 Informational Note No. 4 - Voltage Drop ≤3% recommended'
  };
}

/**
 * Get circular mils for conductor size
 * Simplified lookup for common sizes
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

/**
 * Recommend conductor size with common installation scenarios
 * Provides quick sizing for typical installations
 *
 * @param loadAmps - Load current
 * @param settings - Project settings
 * @param scenario - Common installation scenario
 * @returns Conductor sizing result
 */
export function quickSizeConductor(
  loadAmps: number,
  settings: ProjectSettings,
  scenario: 'indoor_standard' | 'outdoor_hot' | 'attic' | 'underground' | 'high_density_conduit'
): ConductorSizingResult {
  const scenarios = {
    indoor_standard: { ambientTempC: 30, numConductors: 3 },
    outdoor_hot: { ambientTempC: 40, numConductors: 3 },
    attic: { ambientTempC: 50, numConductors: 3 },
    underground: { ambientTempC: 20, numConductors: 3 },
    high_density_conduit: { ambientTempC: 30, numConductors: 12 }
  };

  const { ambientTempC, numConductors } = scenarios[scenario];

  return sizeConductor(loadAmps, settings, ambientTempC, numConductors, true);
}
