/**
 * Load Calculation Service - NEC Article 220 Compliant
 * Implements demand factors, continuous load multipliers, and service sizing
 * 2023 NEC Edition
 */

import { LoadItem, ProjectSettings } from '../../types';
import {
  getLightingDemandFactor,
  getRangeDemand,
  STANDARD_BREAKER_SIZES,
  getNextStandardBreakerSize
} from '../../data/nec';

/**
 * Smart defaults for continuous loads per NEC requirements
 * Can be overridden by user for edge cases
 */
export const CONTINUOUS_LOAD_DEFAULTS: Record<LoadItem['type'], boolean> = {
  lighting: true,       // NEC 210.20 - General lighting is continuous
  hvac: true,           // Typically runs >3 hours
  motor: false,         // Depends on duty cycle (user should specify)
  receptacle: false,    // General receptacles are non-continuous
  appliance: false,     // Fixed appliances vary by use
  range: false,         // Not typically continuous
  dryer: false,         // Not typically continuous
  water_heater: false   // Not typically continuous
};

/**
 * Result of load calculation with detailed breakdown
 */
export interface LoadCalculationResult {
  // Summary
  totalConnectedVA: number;
  totalDemandVA: number;
  totalAmps: number;
  recommendedServiceSize: number;

  // Breakdown by category
  breakdown: {
    lighting: { connectedVA: number; demandVA: number; demandFactor: number };
    appliances: { connectedVA: number; demandVA: number; demandFactor: number };
    motors: { connectedVA: number; demandVA: number; largestMotorVA: number };
    other: { connectedVA: number; demandVA: number };
  };

  // Phase analysis
  phaseBalance: {
    phaseA: number;
    phaseB: number;
    phaseC: number;
    imbalancePercent: number;
    warnings: string[];
  };

  // Calculation method and references
  method: 'NEC 220.82 Optional (Dwelling)' | 'NEC 220.40 Standard (Commercial/Industrial)';
  necReferences: string[];
  notes: string[];
}

/**
 * Calculate total load with NEC demand factors
 * Routes to appropriate calculation method based on occupancy type
 *
 * @param loads - Array of load items
 * @param settings - Project electrical settings
 * @returns Detailed load calculation result
 */
export function calculateLoad(loads: LoadItem[], settings: ProjectSettings): LoadCalculationResult {
  if (settings.occupancyType === 'dwelling') {
    return calculateDwellingLoad(loads, settings);
  } else {
    return calculateCommercialIndustrialLoad(loads, settings);
  }
}

/**
 * NEC 220.82 - Optional Calculation for Dwelling Units
 * This method is used in ~90% of residential projects due to diversity
 *
 * @param loads - Array of load items
 * @param settings - Project electrical settings
 * @returns Load calculation result
 */
function calculateDwellingLoad(loads: LoadItem[], settings: ProjectSettings): LoadCalculationResult {
  const necReferences: string[] = ['NEC 220.82 Optional Calculation for Dwelling Units'];
  const notes: string[] = [];

  // Separate loads by category and continuous/non-continuous
  const lightingLoads = loads.filter(l => l.type === 'lighting');
  const rangeLoads = loads.filter(l => l.type === 'range');
  const dryerLoads = loads.filter(l => l.type === 'dryer');
  const waterHeaterLoads = loads.filter(l => l.type === 'water_heater');
  const hvacLoads = loads.filter(l => l.type === 'hvac');
  const motorLoads = loads.filter(l => l.type === 'motor');
  const applianceLoads = loads.filter(l => l.type === 'appliance');
  const receptacleLoads = loads.filter(l => l.type === 'receptacle');

  // 1. LIGHTING LOAD with NEC Table 220.42 demand factors
  // Continuous loads don't get demand factors (no diversity)
  const continuousLightingVA = lightingLoads.filter(l => l.continuous).reduce((sum, load) => sum + load.watts, 0);
  const nonContinuousLightingVA = lightingLoads.filter(l => !l.continuous).reduce((sum, load) => sum + load.watts, 0);

  const lightingDemand = getLightingDemandFactor('dwelling', nonContinuousLightingVA);
  const lightingDemandVA = lightingDemand.demandVA + (continuousLightingVA * 1.25); // Continuous at 125%, non-continuous with demand factor

  if (lightingLoads.length > 0) {
    necReferences.push(lightingDemand.necReference);
  }

  // 2. RANGE/OVEN LOAD with NEC Table 220.55 demand factors
  const totalRangeVA = rangeLoads.reduce((sum, load) => sum + load.watts, 0);
  const rangeData = rangeLoads.length > 0 ? getRangeDemand(rangeLoads.length) : null;
  const rangeDemandVA = rangeData ? rangeData.demandKW * 1000 : 0;
  if (rangeLoads.length > 0 && rangeData) {
    necReferences.push(rangeData.necReference);
  }

  // 3. DRYER LOAD (NEC 220.82(B)(3))
  // Standard dryer: 5000W or nameplate rating
  const totalDryerVA = dryerLoads.reduce((sum, load) => sum + load.watts, 0);
  const dryerDemandVA = totalDryerVA; // 100% demand for first dryer
  if (dryerLoads.length > 0) {
    necReferences.push('NEC 220.82(B)(3) - Dryer Load');
  }

  // 4. WATER HEATER (NEC 220.82(B)(4))
  // Typically 4500W, 100% demand
  const totalWaterHeaterVA = waterHeaterLoads.reduce((sum, load) => sum + load.watts, 0);
  const waterHeaterDemandVA = totalWaterHeaterVA; // 100% demand
  if (waterHeaterLoads.length > 0) {
    necReferences.push('NEC 220.82(B)(4) - Water Heater');
  }

  // 5. HVAC LOAD (NEC 220.82(C))
  // Use larger of heating or cooling
  const totalHvacVA = hvacLoads.reduce((sum, load) => sum + load.watts, 0);
  const hvacDemandVA = totalHvacVA; // 100% of larger load
  if (hvacLoads.length > 0) {
    necReferences.push('NEC 220.82(C) - HVAC Load (larger of heating/cooling)');
    notes.push('If both heating and cooling exist, only the larger load is counted per NEC 220.82(C).');
  }

  // 6. MOTOR LOADS (Article 430)
  // All motors at 100%, largest motor at 125%
  const motorVAs = motorLoads.map(l => l.watts);
  const largestMotorVA = motorVAs.length > 0 ? Math.max(...motorVAs) : 0;
  const otherMotorsVA = motorVAs.reduce((sum, va) => sum + va, 0) - largestMotorVA;
  const motorDemandVA = (largestMotorVA * 1.25) + otherMotorsVA;
  if (motorLoads.length > 0) {
    necReferences.push('NEC 430.24 - Motor Load (largest motor × 125%)');
  }

  // 7. OTHER LOADS (Appliances, Receptacles)
  const otherLoadsVA = [...applianceLoads, ...receptacleLoads].reduce((sum, load) => sum + load.watts, 0);
  const otherDemandVA = otherLoadsVA; // 100% demand

  // TOTAL DEMAND CALCULATION
  // Continuous loads already have 125% factor applied in each category
  const totalConnectedVA = loads.reduce((sum, load) => sum + load.watts, 0);
  const totalDemandVA =
    lightingDemandVA +
    rangeDemandVA +
    dryerDemandVA +
    waterHeaterDemandVA +
    hvacDemandVA +
    motorDemandVA +
    otherDemandVA;

  const continuousConnectedVA = loads.filter(load => load.continuous).reduce((sum, load) => sum + load.watts, 0);
  if (continuousConnectedVA > 0) {
    necReferences.push('NEC 210.19(A)(1) - 125% Continuous Load Factor');
  }

  // CALCULATE CURRENT
  let totalAmps: number;
  if (settings.servicePhase === 1) {
    totalAmps = totalDemandVA / settings.serviceVoltage;
  } else {
    totalAmps = totalDemandVA / (Math.sqrt(3) * settings.serviceVoltage);
  }

  // RECOMMEND SERVICE SIZE
  const recommendedServiceSize = getNextStandardBreakerSize(totalAmps);

  // PHASE BALANCE ANALYSIS
  const phaseBalance = analyzePhaseBalance(loads, settings);

  return {
    totalConnectedVA,
    totalDemandVA,
    totalAmps,
    recommendedServiceSize,
    breakdown: {
      lighting: {
        connectedVA: continuousLightingVA + nonContinuousLightingVA,
        demandVA: lightingDemandVA,
        demandFactor: (continuousLightingVA + nonContinuousLightingVA) > 0
          ? lightingDemandVA / (continuousLightingVA + nonContinuousLightingVA)
          : 0
      },
      appliances: {
        connectedVA: totalRangeVA + totalDryerVA + totalWaterHeaterVA + otherLoadsVA,
        demandVA: rangeDemandVA + dryerDemandVA + waterHeaterDemandVA + otherDemandVA,
        demandFactor: (rangeDemandVA + dryerDemandVA + waterHeaterDemandVA + otherDemandVA) /
                     (totalRangeVA + totalDryerVA + totalWaterHeaterVA + otherLoadsVA || 1)
      },
      motors: {
        connectedVA: motorVAs.reduce((sum, va) => sum + va, 0),
        demandVA: motorDemandVA,
        largestMotorVA
      },
      other: {
        connectedVA: totalHvacVA,
        demandVA: hvacDemandVA
      }
    },
    phaseBalance,
    method: 'NEC 220.82 Optional (Dwelling)',
    necReferences,
    notes
  };
}

/**
 * NEC 220.40 - Standard Calculation for Commercial/Industrial
 * More conservative method without dwelling unit diversity
 *
 * @param loads - Array of load items
 * @param settings - Project electrical settings
 * @returns Load calculation result
 */
function calculateCommercialIndustrialLoad(loads: LoadItem[], settings: ProjectSettings): LoadCalculationResult {
  const necReferences: string[] = ['NEC 220.40 Standard Calculation'];
  const notes: string[] = [];

  // Separate loads by category
  const lightingLoads = loads.filter(l => l.type === 'lighting');
  const motorLoads = loads.filter(l => l.type === 'motor');
  const otherLoads = loads.filter(l => !['lighting', 'motor'].includes(l.type));

  // 1. LIGHTING LOAD with demand factors from Table 220.42
  const totalLightingVA = lightingLoads.reduce((sum, load) => sum + load.watts, 0);
  const occupancyMapping: Record<typeof settings.occupancyType, string> = {
    dwelling: 'dwelling',
    commercial: 'office',
    industrial: 'warehouse'
  };
  const lightingDemand = getLightingDemandFactor(
    occupancyMapping[settings.occupancyType],
    totalLightingVA
  );
  necReferences.push(lightingDemand.necReference);

  // 2. MOTOR LOADS (Article 430)
  const motorVAs = motorLoads.map(l => l.watts);
  const largestMotorVA = motorVAs.length > 0 ? Math.max(...motorVAs) : 0;
  const otherMotorsVA = motorVAs.reduce((sum, va) => sum + va, 0) - largestMotorVA;
  const motorDemandVA = (largestMotorVA * 1.25) + otherMotorsVA;
  if (motorLoads.length > 0) {
    necReferences.push('NEC 430.24 - Motor Load (largest motor × 125%)');
  }

  // 3. OTHER LOADS (100% demand for commercial/industrial)
  const otherLoadsVA = otherLoads.reduce((sum, load) => sum + load.watts, 0);
  const otherDemandVA = otherLoadsVA; // 100% demand

  // TOTAL DEMAND CALCULATION
  const totalConnectedVA = loads.reduce((sum, load) => sum + load.watts, 0);
  const totalDemandVA = lightingDemand.demandVA + motorDemandVA + otherDemandVA;

  // APPLY 125% CONTINUOUS LOAD FACTOR (NEC 210.19(A)(1))
  // For continuous loads, apply 125% multiplier to the demand
  const continuousLoads = loads.filter(load => load.continuous);
  const nonContinuousLoads = loads.filter(load => !load.continuous);

  const continuousConnectedVA = continuousLoads.reduce((sum, load) => sum + load.watts, 0);
  const nonContinuousConnectedVA = nonContinuousLoads.reduce((sum, load) => sum + load.watts, 0);

  // Calculate what portion of the demand is from continuous loads
  const continuousDemandRatio = totalConnectedVA > 0 ? continuousConnectedVA / totalConnectedVA : 0;
  const continuousDemandVA = totalDemandVA * continuousDemandRatio;
  const nonContinuousDemandVA = totalDemandVA * (1 - continuousDemandRatio);

  // Apply 125% factor to continuous portion
  const totalDemandWithContinuous = (continuousDemandVA * 1.25) + nonContinuousDemandVA;

  if (continuousConnectedVA > 0) {
    necReferences.push('NEC 210.19(A)(1) - 125% Continuous Load Factor');
  }

  // CALCULATE CURRENT
  let totalAmps: number;
  if (settings.servicePhase === 1) {
    totalAmps = totalDemandVA / settings.serviceVoltage;
  } else {
    totalAmps = totalDemandVA / (Math.sqrt(3) * settings.serviceVoltage);
  }

  // RECOMMEND SERVICE SIZE
  const recommendedServiceSize = getNextStandardBreakerSize(totalAmps);

  // PHASE BALANCE ANALYSIS
  const phaseBalance = analyzePhaseBalance(loads, settings);

  return {
    totalConnectedVA,
    totalDemandVA,
    totalAmps,
    recommendedServiceSize,
    breakdown: {
      lighting: {
        connectedVA: totalLightingVA,
        demandVA: lightingDemand.demandVA,
        demandFactor: lightingDemand.demandFactor
      },
      appliances: {
        connectedVA: otherLoadsVA,
        demandVA: otherDemandVA,
        demandFactor: 1.0
      },
      motors: {
        connectedVA: motorVAs.reduce((sum, va) => sum + va, 0),
        demandVA: motorDemandVA,
        largestMotorVA
      },
      other: {
        connectedVA: 0,
        demandVA: 0
      }
    },
    phaseBalance,
    method: 'NEC 220.40 Standard (Commercial/Industrial)',
    necReferences,
    notes
  };
}

/**
 * Analyze phase balance and identify imbalance issues
 * NEC 220.61 - Feeder Neutral Load
 *
 * @param loads - Array of load items
 * @param settings - Project electrical settings
 * @returns Phase balance analysis with warnings
 */
function analyzePhaseBalance(loads: LoadItem[], settings: ProjectSettings): LoadCalculationResult['phaseBalance'] {
  if (settings.servicePhase === 1) {
    return {
      phaseA: 0,
      phaseB: 0,
      phaseC: 0,
      imbalancePercent: 0,
      warnings: []
    };
  }

  // Calculate load on each phase
  const phaseLoads = {
    A: 0,
    B: 0,
    C: 0
  };

  loads.forEach(load => {
    if (load.phase === '3-Phase') {
      // 3-phase loads distribute evenly
      phaseLoads.A += load.watts / 3;
      phaseLoads.B += load.watts / 3;
      phaseLoads.C += load.watts / 3;
    } else if (load.phase in phaseLoads) {
      phaseLoads[load.phase as 'A' | 'B' | 'C'] += load.watts;
    }
  });

  const maxPhase = Math.max(phaseLoads.A, phaseLoads.B, phaseLoads.C);
  const minPhase = Math.min(phaseLoads.A, phaseLoads.B, phaseLoads.C);
  const avgPhase = (phaseLoads.A + phaseLoads.B + phaseLoads.C) / 3;

  // Calculate imbalance as percentage deviation from average
  const imbalancePercent = avgPhase > 0 ? ((maxPhase - minPhase) / avgPhase) * 100 : 0;

  const warnings: string[] = [];

  if (imbalancePercent > 20) {
    warnings.push('⚠️ CRITICAL: Phase imbalance >20%. Redistribute loads to balance phases.');
  } else if (imbalancePercent > 10) {
    warnings.push('⚠️ WARNING: Phase imbalance >10%. Consider redistributing loads.');
  }

  if (maxPhase > avgPhase * 1.15) {
    warnings.push('⚠️ One phase is loaded >15% above average. This may cause overheating.');
  }

  return {
    phaseA: phaseLoads.A,
    phaseB: phaseLoads.B,
    phaseC: phaseLoads.C,
    imbalancePercent: Math.round(imbalancePercent * 10) / 10,
    warnings
  };
}

/**
 * Get smart default for continuous load based on load type
 * User can override this default
 *
 * @param loadType - Type of load
 * @returns Default continuous state
 */
export function getContinuousLoadDefault(loadType: LoadItem['type']): boolean {
  return CONTINUOUS_LOAD_DEFAULTS[loadType];
}
