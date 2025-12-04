/**
 * Short Circuit Calculation Service
 * NEC 110.9 - Interrupting Rating
 *
 * Equipment intended to interrupt current at fault levels shall have an
 * interrupting rating at nominal circuit voltage sufficient for the current
 * that must be interrupted.
 */

import { getConductorImpedance } from '../../data/nec/table-chapter9-table9';

/**
 * Standard Available Interrupting Capacity (AIC) ratings for circuit breakers
 * Common ratings: 10kA, 14kA, 22kA, 25kA, 42kA, 65kA, 100kA, 200kA
 */
export const STANDARD_AIC_RATINGS = [10, 14, 22, 25, 42, 65, 100, 200]; // kA

export interface TransformerData {
  kva: number;
  primaryVoltage: number;
  secondaryVoltage: number;
  impedance: number; // Percent impedance (Z%)
}

export interface ConductorRun {
  length: number; // feet
  conductorSize: string; // e.g., "12 AWG", "4/0 AWG"
  material: 'Cu' | 'Al';
  conduitType: 'Steel' | 'PVC' | 'Aluminum';
  voltage: number;
  phase: 1 | 3;
}

export interface ShortCircuitResult {
  faultCurrent: number; // Amperes RMS symmetrical
  requiredAIC: number; // kA - next standard AIC rating needed
  /** Detailed calculation breakdown */
  details: {
    sourceFaultCurrent: number;
    conductorImpedance: number; // ohms
    totalImpedance: number; // ohms
    faultCurrentAtPoint: number;
    safetyFactor: number;
  };
  /** NEC compliance */
  compliance: {
    necArticle: string;
    compliant: boolean;
    message: string;
  };
}

/**
 * Calculate available fault current at transformer secondary
 * Per NEC 110.9 and industry standard calculations
 *
 * Formula: If = (kVA × 1000) / (√3 × V × Z%)  [3-phase]
 *          If = (kVA × 1000) / (V × Z%)       [1-phase]
 *
 * Where:
 * - kVA = Transformer rating
 * - V = Secondary voltage
 * - Z% = Transformer impedance (typically 2-6%)
 */
export function calculateTransformerFaultCurrent(
  transformer: TransformerData,
  phase: 1 | 3
): number {
  const { kva, secondaryVoltage, impedance } = transformer;
  const zPU = impedance / 100; // Convert percent to per-unit

  if (phase === 3) {
    // 3-phase fault current: If = (kVA × 1000) / (√3 × V × Z%)
    const baseCurrent = (kva * 1000) / (Math.sqrt(3) * secondaryVoltage);
    return baseCurrent / zPU;
  } else {
    // 1-phase fault current: If = (kVA × 1000) / (V × Z%)
    const baseCurrent = (kva * 1000) / secondaryVoltage;
    return baseCurrent / zPU;
  }
}

/**
 * Calculate fault current at a point downstream from source
 * Uses point-to-point method with conductor impedance
 *
 * NEC Chapter 9 Table 9: Impedance values for conductors
 *
 * Formula: If2 = If1 / √(1 + (If1 × Z / V)²)
 *
 * Simplified for practical use:
 * If2 ≈ V / (Zsource + Zconductor)
 */
export function calculateDownstreamFaultCurrent(
  conductorRun: ConductorRun,
  sourceFaultCurrent: number
): ShortCircuitResult {
  const { length, conductorSize, material, conduitType, voltage, phase } = conductorRun;

  // Get conductor impedance data from NEC Chapter 9 Table 9
  const conductorData = getConductorImpedance(conductorSize, material, conduitType);

  if (!conductorData) {
    throw new Error(`Conductor ${conductorSize} ${material} in ${conduitType} conduit not found in NEC Table 9`);
  }

  // Calculate source impedance (ohms)
  // Zsource = V / If1
  const sourceImpedance = phase === 3
    ? (voltage / Math.sqrt(3)) / sourceFaultCurrent
    : voltage / sourceFaultCurrent;

  // Calculate conductor impedance (ohms)
  // For AC circuits, use impedance from NEC Chapter 9 Table 9
  // Z = √(R² + X²) for steel conduit
  // Simplified: For typical power factor and conductor runs < 100ft, use resistance

  const resistanceOhmsPerFoot = conductorData.resistanceOhmsPerKFt / 1000;
  const conductorResistance = resistanceOhmsPerFoot * length;

  // For steel conduit, add reactance (typical X/R ratio ≈ 1.5 for smaller conductors)
  const reactance = conduitType === 'Steel' ? conductorResistance * 0.05 : 0; // Simplified reactance
  const conductorImpedance = Math.sqrt(
    conductorResistance ** 2 + reactance ** 2
  );

  // Adjust for phase configuration
  // Single-phase: Impedance of both conductors (hot + neutral)
  // Three-phase: Impedance multiplier for line-to-line fault
  const phaseMultiplier = phase === 1 ? 2 : 1.732; // √3 for 3-phase
  const totalConductorImpedance = conductorImpedance * phaseMultiplier;

  // Total impedance
  const totalImpedance = sourceImpedance + totalConductorImpedance;

  // Fault current at downstream point
  const faultCurrentAtPoint = phase === 3
    ? (voltage / Math.sqrt(3)) / totalImpedance
    : voltage / totalImpedance;

  // Apply safety factor (typically 1.25 per NEC 110.9)
  const safetyFactor = 1.25;
  const faultCurrentWithSafety = faultCurrentAtPoint * safetyFactor;

  // Find required AIC rating (next standard size above calculated fault current)
  const faultCurrentKA = faultCurrentWithSafety / 1000;
  const requiredAIC = STANDARD_AIC_RATINGS.find((rating) => rating >= faultCurrentKA) || 200;

  // NEC 110.9 compliance check
  const compliance = {
    necArticle: 'NEC 110.9',
    compliant: requiredAIC <= 200, // Maximum commonly available
    message: requiredAIC <= 200
      ? `Equipment must have minimum ${requiredAIC} kA AIC rating`
      : `Fault current exceeds 200kA - requires special consideration or current limiting devices`
  };

  return {
    faultCurrent: faultCurrentAtPoint,
    requiredAIC,
    details: {
      sourceFaultCurrent,
      conductorImpedance: totalConductorImpedance,
      totalImpedance,
      faultCurrentAtPoint,
      safetyFactor
    },
    compliance
  };
}

/**
 * Calculate fault current for typical utility service
 * Based on utility transformer characteristics
 *
 * Common utility transformer impedances:
 * - Single-phase pad-mount: 2-3%
 * - Three-phase pad-mount: 5.75% (standard)
 * - Network transformers: 5-6%
 */
export function calculateServiceFaultCurrent(
  utilityTransformer: TransformerData,
  serviceVoltage: number,
  servicePhase: 1 | 3
): ShortCircuitResult {
  const faultCurrent = calculateTransformerFaultCurrent(utilityTransformer, servicePhase);

  // Apply safety factor
  const safetyFactor = 1.25;
  const faultCurrentWithSafety = faultCurrent * safetyFactor;

  // Find required AIC
  const faultCurrentKA = faultCurrentWithSafety / 1000;
  const requiredAIC = STANDARD_AIC_RATINGS.find((rating) => rating >= faultCurrentKA) || 200;

  const compliance = {
    necArticle: 'NEC 110.9',
    compliant: requiredAIC <= 200,
    message: requiredAIC <= 200
      ? `Main service breaker must have minimum ${requiredAIC} kA AIC rating`
      : `Fault current exceeds 200kA - consult with utility for current limiting options`
  };

  return {
    faultCurrent,
    requiredAIC,
    details: {
      sourceFaultCurrent: faultCurrent,
      conductorImpedance: 0,
      totalImpedance: (servicePhase === 3 ? serviceVoltage / Math.sqrt(3) : serviceVoltage) / faultCurrent,
      faultCurrentAtPoint: faultCurrent,
      safetyFactor
    },
    compliance
  };
}

/**
 * Estimate utility transformer characteristics based on service size
 * Used when exact utility data is not available
 *
 * Common residential/commercial service sizes:
 * - 100-200A: 25-50 kVA transformer
 * - 200-400A: 50-100 kVA transformer
 * - 400-800A: 100-300 kVA transformer
 */
export function estimateUtilityTransformer(
  serviceAmps: number,
  serviceVoltage: number,
  servicePhase: 1 | 3
): TransformerData {
  // Calculate approximate kVA
  const kva = servicePhase === 3
    ? (serviceAmps * serviceVoltage * Math.sqrt(3)) / 1000
    : (serviceAmps * serviceVoltage) / 1000;

  // Round up to next standard transformer size
  const standardSizes = [15, 25, 37.5, 50, 75, 100, 150, 225, 300, 500, 750, 1000, 1500, 2000, 2500];
  const transformerKVA = standardSizes.find((size) => size >= kva) || kva;

  // Typical impedance values
  const impedance = servicePhase === 3 ? 5.75 : 2.5; // Percent

  return {
    kva: transformerKVA,
    primaryVoltage: servicePhase === 3 ? 12470 : 7200, // Typical utility voltages
    secondaryVoltage: serviceVoltage,
    impedance
  };
}

/**
 * Calculate series of fault currents through electrical distribution system
 * Starts at utility transformer, calculates through service, panels, and branch circuits
 */
export interface SystemFaultAnalysis {
  serviceFault: ShortCircuitResult;
  panelFaults: Array<{
    panelName: string;
    faultResult: ShortCircuitResult;
  }>;
  recommendations: string[];
}

export function analyzeSystemFaultCurrents(
  serviceAmps: number,
  serviceVoltage: number,
  servicePhase: 1 | 3,
  panels: Array<{
    name: string;
    feederLength: number;
    feederSize: string;
    voltage: number;
    phase: 1 | 3;
  }>
): SystemFaultAnalysis {
  // Estimate utility transformer
  const utilityTransformer = estimateUtilityTransformer(serviceAmps, serviceVoltage, servicePhase);

  // Calculate service entrance fault current
  const serviceFault = calculateServiceFaultCurrent(utilityTransformer, serviceVoltage, servicePhase);

  // Calculate fault current at each panel
  const panelFaults = panels.map((panel) => {
    const faultResult = calculateDownstreamFaultCurrent(
      {
        length: panel.feederLength,
        conductorSize: panel.feederSize,
        material: 'Cu',
        conduitType: 'Steel',
        voltage: panel.voltage,
        phase: panel.phase
      },
      serviceFault.faultCurrent
    );

    return {
      panelName: panel.name,
      faultResult
    };
  });

  // Generate recommendations
  const recommendations: string[] = [];

  // Main service recommendation
  recommendations.push(
    `Main service breaker: Use minimum ${serviceFault.requiredAIC} kA AIC rating (NEC 110.9)`
  );

  // Panel recommendations
  panelFaults.forEach(({ panelName, faultResult }) => {
    recommendations.push(
      `${panelName}: Use minimum ${faultResult.requiredAIC} kA AIC rating breakers`
    );
  });

  // General recommendations
  if (serviceFault.requiredAIC >= 42) {
    recommendations.push(
      'High fault current installation - consider current limiting breakers or fuses'
    );
  }

  recommendations.push(
    'Verify actual utility fault current with local utility company for final design'
  );

  return {
    serviceFault,
    panelFaults,
    recommendations
  };
}
