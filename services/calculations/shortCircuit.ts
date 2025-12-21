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
  // Note: Table 9 only has PVC data, so we'll use PVC as baseline
  // and adjust for steel conduit magnetic effects if needed
  let conductorData = getConductorImpedance(conductorSize, material, conduitType);

  // Fallback to PVC if Steel/Aluminum not in table
  if (!conductorData && (conduitType === 'Steel' || conduitType === 'Aluminum')) {
    conductorData = getConductorImpedance(conductorSize, material, 'PVC');
  }

  if (!conductorData) {
    throw new Error(`Conductor ${conductorSize} ${material} not found in NEC Table 9`);
  }

  // Calculate source impedance (ohms)
  // Zsource = V / If1
  const sourceImpedance = phase === 3
    ? (voltage / Math.sqrt(3)) / sourceFaultCurrent
    : voltage / sourceFaultCurrent;

  // Calculate conductor impedance (ohms)
  // For AC circuits, use impedance from NEC Chapter 9 Table 9
  // Z = √(R² + X²)

  const resistanceOhmsPerFoot = conductorData.resistanceOhmsPerKFt / 1000;
  const conductorResistance = resistanceOhmsPerFoot * length;

  // Calculate reactance based on conduit type
  // Steel conduit has higher reactance due to magnetic effects
  const reactanceOhmsPerFoot = conductorData.reactanceXLOhmsPerKFt / 1000;
  let conductorReactance = reactanceOhmsPerFoot * length;

  // For steel conduit, increase reactance by ~50% due to magnetic effects
  if (conduitType === 'Steel') {
    conductorReactance *= 1.5;
  }

  const conductorImpedance = Math.sqrt(
    conductorResistance ** 2 + conductorReactance ** 2
  );

  // Adjust for phase configuration
  // Single-phase: 2× impedance (out-and-back through hot + neutral)
  // Three-phase: 1× impedance (per-phase impedance for bolted 3φ fault)
  const phaseMultiplier = phase === 1 ? 2 : 1;
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
    necArticle: 'NEC 110.9 - Interrupting Rating',
    compliant: requiredAIC <= 200, // Maximum commonly available
    message: requiredAIC <= 200
      ? `Equipment interrupting rating shall be sufficient for the current available. Use ${requiredAIC} kA AIC rated breakers or higher`
      : `Available fault current exceeds 200 kA - requires special engineering analysis or current-limiting devices`
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
 *
 * If serviceConductor parameters are provided, calculates fault current at service panel
 * accounting for conductor impedance from transformer to panel.
 * Otherwise, calculates fault current at transformer secondary (conservative/higher value).
 */
export function calculateServiceFaultCurrent(
  utilityTransformer: TransformerData,
  serviceVoltage: number,
  servicePhase: 1 | 3,
  serviceConductor?: {
    length: number;
    conductorSize: string;
    material: 'Cu' | 'Al';
    conduitType: 'Steel' | 'PVC' | 'Aluminum';
    setsInParallel?: number;
  }
): ShortCircuitResult {
  const transformerFaultCurrent = calculateTransformerFaultCurrent(utilityTransformer, servicePhase);

  // If service conductor parameters provided, calculate impedance drop
  let faultCurrentAtServicePanel = transformerFaultCurrent;
  let conductorImpedance = 0;
  let totalImpedance = (servicePhase === 3 ? serviceVoltage / Math.sqrt(3) : serviceVoltage) / transformerFaultCurrent;

  if (serviceConductor) {
    // Get conductor impedance data from NEC Chapter 9 Table 9
    // Note: Table 9 only has PVC data, so we'll use PVC as baseline
    // and adjust for steel conduit magnetic effects if needed
    let conductorData = getConductorImpedance(
      serviceConductor.conductorSize,
      serviceConductor.material,
      serviceConductor.conduitType
    );

    // Fallback to PVC if Steel/Aluminum not in table
    if (!conductorData && (serviceConductor.conduitType === 'Steel' || serviceConductor.conduitType === 'Aluminum')) {
      conductorData = getConductorImpedance(
        serviceConductor.conductorSize,
        serviceConductor.material,
        'PVC'
      );
    }

    if (conductorData) {
      // Calculate source impedance at transformer secondary
      const sourceImpedance = servicePhase === 3
        ? (serviceVoltage / Math.sqrt(3)) / transformerFaultCurrent
        : serviceVoltage / transformerFaultCurrent;

      // Calculate conductor impedance
      const resistanceOhmsPerFoot = conductorData.resistanceOhmsPerKFt / 1000;
      const conductorResistance = resistanceOhmsPerFoot * serviceConductor.length;

      // Calculate reactance based on conduit type
      // Steel conduit has higher reactance due to magnetic effects
      const reactanceOhmsPerFoot = conductorData.reactanceXLOhmsPerKFt / 1000;
      let conductorReactance = reactanceOhmsPerFoot * serviceConductor.length;

      // For steel conduit, increase reactance by ~50% due to magnetic effects
      if (serviceConductor.conduitType === 'Steel') {
        conductorReactance *= 1.5;
      }

      const singleConductorImpedance = Math.sqrt(
        conductorResistance ** 2 + conductorReactance ** 2
      );

      // Adjust for phase configuration
      // Single-phase: 2× impedance (out-and-back through hot + neutral)
      // Three-phase: 1× impedance (per-phase impedance for bolted 3φ fault)
      const phaseMultiplier = servicePhase === 1 ? 2 : 1;
      let adjustedImpedance = singleConductorImpedance * phaseMultiplier;

      // Parallel conductor sets reduce impedance proportionally
      // Z_parallel = Z_single / N (where N = number of parallel sets)
      const setsInParallel = serviceConductor.setsInParallel || 1;
      conductorImpedance = adjustedImpedance / setsInParallel;

      // Total impedance and fault current at service panel
      totalImpedance = sourceImpedance + conductorImpedance;
      faultCurrentAtServicePanel = servicePhase === 3
        ? (serviceVoltage / Math.sqrt(3)) / totalImpedance
        : serviceVoltage / totalImpedance;
    }
  }

  // Apply safety factor
  const safetyFactor = 1.25;
  const faultCurrentWithSafety = faultCurrentAtServicePanel * safetyFactor;

  // Find required AIC
  const faultCurrentKA = faultCurrentWithSafety / 1000;
  const requiredAIC = STANDARD_AIC_RATINGS.find((rating) => rating >= faultCurrentKA) || 200;

  const compliance = {
    necArticle: 'NEC 110.9 - Interrupting Rating',
    compliant: requiredAIC <= 200,
    message: requiredAIC <= 200
      ? `Equipment interrupting rating shall be sufficient for the current available. Use ${requiredAIC} kA AIC rated breakers or higher (next standard tier: ${STANDARD_AIC_RATINGS.find(r => r >= requiredAIC)} kA)`
      : `Available fault current exceeds 200 kA - requires engineering analysis and possible current-limiting devices (fuses, reactors, or utility coordination)`
  };

  return {
    faultCurrent: faultCurrentAtServicePanel,
    requiredAIC,
    details: {
      sourceFaultCurrent: transformerFaultCurrent,
      conductorImpedance,
      totalImpedance,
      faultCurrentAtPoint: faultCurrentAtServicePanel,
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
  servicePhase: 1 | 3,
  customImpedance?: number
): TransformerData {
  // Calculate approximate kVA
  const kva = servicePhase === 3
    ? (serviceAmps * serviceVoltage * Math.sqrt(3)) / 1000
    : (serviceAmps * serviceVoltage) / 1000;

  // Round up to next standard transformer size
  const standardSizes = [15, 25, 37.5, 50, 75, 100, 150, 225, 300, 500, 750, 1000, 1500, 2000, 2500];
  const transformerKVA = standardSizes.find((size) => size >= kva) || kva;

  // Use custom impedance if provided, otherwise use typical values
  const impedance = customImpedance !== undefined
    ? customImpedance
    : (servicePhase === 3 ? 5.75 : 2.5); // Percent

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
