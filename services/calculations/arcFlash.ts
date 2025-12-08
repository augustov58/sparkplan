/**
 * Arc Flash Calculation Service
 * Based on IEEE 1584-2018 and NFPA 70E-2021
 * 
 * Calculates:
 * - Incident Energy (cal/cm²)
 * - Arc Flash Boundary (inches)
 * - PPE Category per NFPA 70E Table 130.7(C)(15)(a)
 * - Required PPE per NFPA 70E
 */

/**
 * Equipment types for arc flash calculations
 * Different equipment types have different typical working distances
 */
export type EquipmentType = 
  | 'switchgear' 
  | 'panelboard' 
  | 'mcc' 
  | 'motor_control' 
  | 'cable' 
  | 'open_air';

/**
 * Protective device types
 */
export type ProtectiveDeviceType = 
  | 'circuit_breaker' 
  | 'fuse' 
  | 'current_limiting_breaker' 
  | 'current_limiting_fuse';

/**
 * Input parameters for arc flash calculation
 */
export interface ArcFlashInput {
  /** Available short circuit current (kA RMS symmetrical) */
  shortCircuitCurrent: number; // kA
  
  /** System voltage (line-to-line for 3-phase, line-to-neutral for 1-phase) */
  voltage: number; // Volts
  
  /** System phase configuration */
  phase: 1 | 3;
  
  /** Equipment type */
  equipmentType: EquipmentType;
  
  /** Protective device type */
  protectiveDevice: ProtectiveDeviceType;
  
  /** Protective device rating (Amps) */
  deviceRating: number; // Amps
  
  /** Working distance (inches) - default based on equipment type if not provided */
  workingDistance?: number; // inches
  
  /** Arc gap (inches) - default based on voltage if not provided */
  arcGap?: number; // inches
  
  /** Enclosure type */
  enclosureType?: 'box' | 'open_air';
  
  /** Grounded or ungrounded system */
  grounded?: boolean; // Default: true (most systems are grounded)
}

/**
 * Arc flash calculation result
 */
export interface ArcFlashResult {
  /** Incident energy at working distance (cal/cm²) */
  incidentEnergy: number;
  
  /** Arc flash boundary - distance where incident energy = 1.2 cal/cm² (inches) */
  arcFlashBoundary: number;
  
  /** PPE Category per NFPA 70E Table 130.7(C)(15)(a) */
  ppeCategory: 0 | 1 | 2 | 3 | 4 | 'N/A';
  
  /** Required PPE description */
  requiredPPE: string;
  
  /** Detailed calculation breakdown */
  details: {
    shortCircuitCurrent: number; // kA
    arcingCurrent: number; // kA (reduced from bolted fault current)
    clearingTime: number; // seconds
    workingDistance: number; // inches
    arcGap: number; // inches
    voltage: number; // Volts
    phase: 1 | 3;
  };
  
  /** Compliance and recommendations */
  compliance: {
    necArticle: string;
    nfpaArticle: string;
    compliant: boolean;
    message: string;
    recommendations: string[];
  };
}

/**
 * Standard working distances by equipment type (inches)
 * Per IEEE 1584 and NFPA 70E
 */
const STANDARD_WORKING_DISTANCES: Record<EquipmentType, number> = {
  switchgear: 36,      // 3 feet
  panelboard: 24,     // 2 feet
  mcc: 24,            // 2 feet
  motor_control: 18,  // 1.5 feet
  cable: 18,          // 1.5 feet
  open_air: 36,       // 3 feet
};

/**
 * Standard arc gaps by voltage (inches)
 * Per IEEE 1584
 */
function getStandardArcGap(voltage: number): number {
  if (voltage <= 240) return 0.25;      // 1/4 inch
  if (voltage <= 480) return 0.5;       // 1/2 inch
  if (voltage <= 600) return 0.75;       // 3/4 inch
  return 1.0;                            // 1 inch for higher voltages
}

/**
 * Calculate arcing current (reduced from bolted fault current)
 * IEEE 1584 Equation 1
 * 
 * For systems 0.208kV to 15kV:
 * log(Ia) = K + 0.662×log(Ibf) + 0.0966×V + 0.000526×G + 0.5588×V×log(Ibf) - 0.00304×G×log(Ibf)
 * 
 * Simplified for practical use (typical values):
 * Ia ≈ 0.85 × Ibf for low voltage (< 600V)
 * Ia ≈ 0.9 × Ibf for medium voltage (600V - 15kV)
 */
function calculateArcingCurrent(
  boltedFaultCurrent: number, // kA
  voltage: number, // Volts
  arcGap: number, // inches
  grounded: boolean = true
): number {
  const voltageKV = voltage / 1000;
  
  // For low voltage systems (< 600V), use simplified calculation
  if (voltageKV < 0.6) {
    // Typical arcing current is 85% of bolted fault current for grounded systems
    // 70% for ungrounded systems
    const multiplier = grounded ? 0.85 : 0.70;
    return boltedFaultCurrent * multiplier;
  }
  
  // For medium voltage (600V - 15kV), use IEEE 1584 equation
  // Simplified version with typical coefficients
  const K = grounded ? 0.0 : -0.153;
  const logIbf = Math.log10(boltedFaultCurrent);
  const logIa = K + 0.662 * logIbf + 0.0966 * voltageKV + 0.000526 * arcGap * 25.4 + 
                0.5588 * voltageKV * logIbf - 0.00304 * arcGap * 25.4 * logIbf;
  
  return Math.pow(10, logIa);
}

/**
 * Estimate protective device clearing time
 * Based on device type, rating, and fault current
 * 
 * This is a simplified estimation. In practice, you need:
 * - Time-current curves for breakers
 * - Time-current curves for fuses
 * - Coordination study data
 */
function estimateClearingTime(
  faultCurrent: number, // kA
  deviceType: ProtectiveDeviceType,
  deviceRating: number, // Amps
  voltage: number // Volts
): number {
  const faultCurrentAmps = faultCurrent * 1000;
  const multipleOfRating = faultCurrentAmps / deviceRating;
  
  // Circuit Breaker clearing times (typical)
  if (deviceType === 'circuit_breaker') {
    // Standard thermal-magnetic breaker
    // At high multiples (>10x), magnetic trip is instantaneous (~0.01-0.05s)
    if (multipleOfRating > 10) {
      return 0.02; // 20ms (1.2 cycles at 60Hz)
    }
    // At moderate multiples (5-10x), trip time varies
    if (multipleOfRating > 5) {
      return 0.05; // 50ms
    }
    // At lower multiples, thermal trip (longer time)
    return 0.1; // 100ms (conservative estimate)
  }
  
  // Current Limiting Breaker
  if (deviceType === 'current_limiting_breaker') {
    // Current limiting breakers open very fast (< 0.01s)
    return 0.008; // 8ms
  }
  
  // Fuse clearing times
  if (deviceType === 'fuse') {
    // Class RK1, RK5 fuses - fast acting
    // At high multiples, clearing time is very short
    if (multipleOfRating > 20) {
      return 0.005; // 5ms
    }
    if (multipleOfRating > 10) {
      return 0.01; // 10ms
    }
    // At lower multiples, longer clearing time
    return 0.05; // 50ms (conservative)
  }
  
  // Current Limiting Fuse
  if (deviceType === 'current_limiting_fuse') {
    // Very fast clearing (< 0.008s)
    return 0.004; // 4ms
  }
  
  // Default conservative estimate
  return 0.1; // 100ms
}

/**
 * Calculate incident energy using IEEE 1584 equations
 * IEEE 1584-2018 equations for systems 0.208kV to 15kV
 * 
 * For low voltage (< 600V):
 * E = 4.184 × Cf × En × (t/0.2) × (610^x / D^x)
 * 
 * Where:
 * - E = Incident energy (cal/cm²)
 * - Cf = Calculation factor (1.0 for voltages > 1kV, 1.5 for < 1kV)
 * - En = Normalized incident energy
 * - t = Arcing time (seconds)
 * - D = Working distance (mm)
 * - x = Distance exponent
 */
function calculateIncidentEnergy(
  arcingCurrent: number, // kA
  voltage: number, // Volts
  clearingTime: number, // seconds
  workingDistance: number, // inches
  arcGap: number, // inches
  equipmentType: EquipmentType,
  grounded: boolean = true
): number {
  const voltageKV = voltage / 1000;
  const workingDistanceMM = workingDistance * 25.4; // Convert to mm
  
  // Calculation factor
  const Cf = voltageKV < 1.0 ? 1.5 : 1.0;
  
  // Distance exponent (varies by equipment type and voltage)
  // Typical values: 1.473 for low voltage, 0.973 for medium voltage
  const x = voltageKV < 0.6 ? 1.473 : 0.973;
  
  // Normalized incident energy (log scale)
  // IEEE 1584 Equation 2 (simplified)
  const logEn = -0.555 + 0.113 * Math.log10(arcingCurrent) + 
                0.0966 * voltageKV + 0.000526 * arcGap * 25.4;
  const En = Math.pow(10, logEn);
  
  // Incident energy calculation
  // For low voltage systems
  if (voltageKV < 0.6) {
    const E = 4.184 * Cf * En * (clearingTime / 0.2) * 
              Math.pow(610, x) / Math.pow(workingDistanceMM, x);
    return E;
  }
  
  // For medium voltage systems (simplified)
  const E = 4.184 * Cf * En * (clearingTime / 0.2) * 
            Math.pow(610, x) / Math.pow(workingDistanceMM, x);
  
  return E;
}

/**
 * Calculate arc flash boundary
 * Distance where incident energy = 1.2 cal/cm²
 * 
 * Rearranging the incident energy equation:
 * D = (E × D_ref^x / 1.2)^(1/x)
 */
function calculateArcFlashBoundary(
  incidentEnergy: number, // cal/cm²
  workingDistance: number, // inches
  voltage: number // Volts
): number {
  const voltageKV = voltage / 1000;
  const x = voltageKV < 0.6 ? 1.473 : 0.973;
  
  // Rearrange: D_boundary = D_working × (E_working / 1.2)^(1/x)
  const boundary = workingDistance * Math.pow(incidentEnergy / 1.2, 1 / x);
  
  return boundary;
}

/**
 * Determine PPE Category per NFPA 70E Table 130.7(C)(15)(a)
 */
function determinePPECategory(
  incidentEnergy: number, // cal/cm²
  equipmentType: EquipmentType,
  voltage: number // Volts
): { category: 0 | 1 | 2 | 3 | 4 | 'N/A'; description: string } {
  // Category 0: < 1.2 cal/cm²
  if (incidentEnergy < 1.2) {
    return {
      category: 0,
      description: 'Arc-rated clothing, long-sleeve shirt and pants or arc-rated coverall'
    };
  }
  
  // Category 1: 1.2 - 4 cal/cm²
  if (incidentEnergy < 4) {
    return {
      category: 1,
      description: 'Arc-rated clothing, minimum arc rating of 4 cal/cm²'
    };
  }
  
  // Category 2: 4 - 8 cal/cm²
  if (incidentEnergy < 8) {
    return {
      category: 2,
      description: 'Arc-rated clothing, minimum arc rating of 8 cal/cm²'
    };
  }
  
  // Category 3: 8 - 25 cal/cm²
  if (incidentEnergy < 25) {
    return {
      category: 3,
      description: 'Arc-rated clothing, minimum arc rating of 25 cal/cm²'
    };
  }
  
  // Category 4: 25 - 40 cal/cm²
  if (incidentEnergy < 40) {
    return {
      category: 4,
      description: 'Arc-rated clothing, minimum arc rating of 40 cal/cm²'
    };
  }
  
  // Above Category 4: Requires detailed analysis
  return {
    category: 'N/A',
    description: 'Incident energy exceeds Category 4. Requires detailed arc flash study and engineering analysis. Consider current limiting devices or de-energization.'
  };
}

/**
 * Main arc flash calculation function
 * 
 * @param input - Arc flash calculation input parameters
 * @returns Complete arc flash analysis result
 */
export function calculateArcFlash(input: ArcFlashInput): ArcFlashResult {
  // Validate inputs
  if (input.shortCircuitCurrent <= 0) {
    throw new Error('Short circuit current must be greater than zero');
  }
  if (input.voltage <= 0) {
    throw new Error('Voltage must be greater than zero');
  }
  if (input.deviceRating <= 0) {
    throw new Error('Device rating must be greater than zero');
  }
  
  // Set defaults
  const workingDistance = input.workingDistance || STANDARD_WORKING_DISTANCES[input.equipmentType];
  const arcGap = input.arcGap || getStandardArcGap(input.voltage);
  const grounded = input.grounded !== false; // Default to true
  
  // Step 1: Calculate arcing current
  const arcingCurrent = calculateArcingCurrent(
    input.shortCircuitCurrent,
    input.voltage,
    arcGap,
    grounded
  );
  
  // Step 2: Estimate clearing time
  const clearingTime = estimateClearingTime(
    arcingCurrent,
    input.protectiveDevice,
    input.deviceRating,
    input.voltage
  );
  
  // Step 3: Calculate incident energy
  const incidentEnergy = calculateIncidentEnergy(
    arcingCurrent,
    input.voltage,
    clearingTime,
    workingDistance,
    arcGap,
    input.equipmentType,
    grounded
  );
  
  // Step 4: Calculate arc flash boundary
  const arcFlashBoundary = calculateArcFlashBoundary(
    incidentEnergy,
    workingDistance,
    input.voltage
  );
  
  // Step 5: Determine PPE category
  const ppeInfo = determinePPECategory(incidentEnergy, input.equipmentType, input.voltage);
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (incidentEnergy >= 40) {
    recommendations.push('CRITICAL: Incident energy exceeds 40 cal/cm². De-energize before working or use remote operation.');
    recommendations.push('Consider installing current limiting breakers or fuses to reduce incident energy.');
  } else if (incidentEnergy >= 25) {
    recommendations.push('High incident energy. Consider current limiting protective devices.');
    recommendations.push('Ensure all workers are trained on Category 4 PPE requirements.');
  } else if (incidentEnergy >= 8) {
    recommendations.push('Moderate incident energy. Verify protective device coordination.');
  }
  
  if (clearingTime > 0.1) {
    recommendations.push('Long clearing time detected. Consider faster protective devices to reduce incident energy.');
  }
  
  recommendations.push('Verify actual protective device time-current curves for accurate results.');
  recommendations.push('Field verification required before performing energized work.');
  
  return {
    incidentEnergy: Math.round(incidentEnergy * 100) / 100, // Round to 2 decimals
    arcFlashBoundary: Math.round(arcFlashBoundary * 10) / 10, // Round to 1 decimal
    ppeCategory: ppeInfo.category,
    requiredPPE: ppeInfo.description,
    details: {
      shortCircuitCurrent: input.shortCircuitCurrent,
      arcingCurrent: Math.round(arcingCurrent * 100) / 100,
      clearingTime: Math.round(clearingTime * 1000) / 1000, // Round to 3 decimals
      workingDistance,
      arcGap,
      voltage: input.voltage,
      phase: input.phase,
    },
    compliance: {
      necArticle: 'NEC 110.16',
      nfpaArticle: 'NFPA 70E Article 130',
      compliant: incidentEnergy < 40, // Above 40 cal/cm² requires special consideration
      message: incidentEnergy < 1.2
        ? 'Low incident energy - standard work practices apply'
        : incidentEnergy < 40
        ? `Incident energy: ${Math.round(incidentEnergy * 100) / 100} cal/cm². PPE Category ${ppeInfo.category} required.`
        : 'CRITICAL: Incident energy exceeds 40 cal/cm². De-energization required or engineering analysis needed.',
      recommendations,
    },
  };
}

