/**
 * Multi-Family EV Readiness Calculator
 * NEC 220.84 + NEC 220.57 + NEC 625.42
 *
 * Automates the $2-10K engineering calculation that contractors are turning away.
 * Forum-validated feature addressing multi-family EV charging complexity.
 *
 * Key NEC Articles:
 * - NEC 220.84: Optional Calculation for Multi-Family Dwellings
 * - NEC 220.57: Electric Vehicle Supply Equipment (demand factors)
 * - NEC 625.42: EVEMS Load Management
 * - NEC 230.42: Service Conductor Sizing
 *
 * @module services/calculations/multiFamilyEV
 */

// ============================================================================
// NEC CONSTANTS AND TABLES
// ============================================================================

/**
 * NEC Table 220.84 - Multi-Family Dwelling Demand Factors
 * Applied to the sum of all unit loads
 */
const MULTI_FAMILY_DEMAND_TABLE: { units: number; factor: number }[] = [
  { units: 3, factor: 0.45 },    // 3 units: 45%
  { units: 4, factor: 0.44 },    // 4 units: 44%
  { units: 5, factor: 0.43 },    // 5 units: 43%
  { units: 6, factor: 0.42 },
  { units: 7, factor: 0.41 },
  { units: 8, factor: 0.40 },
  { units: 9, factor: 0.39 },
  { units: 10, factor: 0.38 },
  { units: 11, factor: 0.37 },
  { units: 12, factor: 0.36 },
  { units: 13, factor: 0.35 },
  { units: 14, factor: 0.34 },
  { units: 15, factor: 0.33 },
  { units: 16, factor: 0.32 },
  { units: 17, factor: 0.31 },
  { units: 18, factor: 0.30 },
  { units: 19, factor: 0.29 },
  { units: 20, factor: 0.28 },
  { units: 21, factor: 0.27 },
  { units: 22, factor: 0.26 },
  { units: 23, factor: 0.25 },
  { units: 24, factor: 0.24 },
  { units: 25, factor: 0.23 },
  { units: 26, factor: 0.22 },
  { units: 27, factor: 0.21 },
  { units: 28, factor: 0.20 },
  { units: 29, factor: 0.19 },
  { units: 30, factor: 0.18 },
  { units: 31, factor: 0.17 },
  { units: 40, factor: 0.16 },
  { units: Infinity, factor: 0.15 }, // 41+ units: 15%
];

/**
 * NEC 220.57 - Electric Vehicle Supply Equipment Demand Factors
 * NEW in 2023 NEC - Allows demand factor for multiple EV chargers
 *
 * Per NEC 220.57: "The demand factor for electric vehicle supply equipment
 * loads shall be permitted to be calculated..."
 */
const EV_DEMAND_FACTORS: { count: number; factor: number }[] = [
  { count: 1, factor: 1.00 },   // 1 EVSE: 100%
  { count: 2, factor: 1.00 },   // 2 EVSE: 100%
  { count: 3, factor: 0.90 },   // 3 EVSE: 90%
  { count: 4, factor: 0.85 },   // 4 EVSE: 85%
  { count: 5, factor: 0.80 },   // 5 EVSE: 80%
  { count: 6, factor: 0.75 },   // 6 EVSE: 75%
  { count: 7, factor: 0.70 },   // 7 EVSE: 70%
  { count: 8, factor: 0.65 },   // 8-10 EVSE: 65%
  { count: 11, factor: 0.60 },  // 11-15 EVSE: 60%
  { count: 16, factor: 0.55 },  // 16-20 EVSE: 55%
  { count: 21, factor: 0.50 },  // 21-30 EVSE: 50%
  { count: 31, factor: 0.45 },  // 31-40 EVSE: 45%
  { count: 41, factor: 0.40 },  // 41+ EVSE: 40%
];

/**
 * NEC Table 220.12 - General Lighting Loads
 * For dwelling units: 3 VA per square foot
 */
const LIGHTING_LOAD_VA_PER_SQFT = 3;

/**
 * NEC 220.14(J) - Small Appliance Branch Circuits
 * 1,500 VA for each 2-wire small-appliance branch circuit
 */
const SMALL_APPLIANCE_VA = 1500;

/**
 * NEC 220.14(J) - Laundry Branch Circuit
 * 1,500 VA minimum for laundry circuit
 */
const LAUNDRY_CIRCUIT_VA = 1500;

/**
 * Standard service sizes per NEMA
 */
const STANDARD_SERVICE_SIZES = [100, 125, 150, 200, 225, 300, 400, 600, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Building profile input for multi-family EV analysis
 */
export interface MultiFamilyEVInput {
  /** Building identification */
  buildingName?: string;

  /** Number of dwelling units in the building */
  dwellingUnits: number;

  /** Average square footage per unit */
  avgUnitSqFt: number;

  /** Service voltage */
  voltage: 120 | 208 | 240 | 277 | 480;

  /** Service phase configuration */
  phase: 1 | 3;

  /** Existing service size (Amps) */
  existingServiceAmps: number;

  /** EV charger configuration */
  evChargers: {
    /** Number of EV-ready parking spaces to install */
    count: number;
    /** Charger level */
    level: 'Level1' | 'Level2';
    /** Charger amperage (typically 32A, 40A, 48A for Level 2) */
    ampsPerCharger: number;
  };

  /** Optional: Electric heat in units (triggers additional load) */
  hasElectricHeat?: boolean;

  /** Optional: Electric cooking in units */
  hasElectricCooking?: boolean;

  /** Optional: Common area loads in VA (lighting, elevators, pool, etc.) */
  commonAreaLoadVA?: number;

  /** Optional: Transformer information (for capacity check) */
  transformer?: {
    kvaRating: number;
    impedancePercent?: number;
  };

  /** Whether to use EVEMS load management */
  useEVEMS?: boolean;

  /** EVEMS scheduling mode */
  evemsMode?: 'power_sharing' | 'scheduled' | 'dynamic';
}

/**
 * EV capacity scenario analysis
 */
export interface EVCapacityScenario {
  /** Scenario name */
  name: string;

  /** Maximum chargers possible */
  maxChargers: number;

  /** Power per charger (if limited) */
  powerPerCharger_kW?: number;

  /** Estimated equipment cost range */
  estimatedCostLow?: number;
  estimatedCostHigh?: number;

  /** Notes about this scenario */
  notes: string[];

  /** Whether service upgrade is required */
  requiresServiceUpgrade: boolean;

  /** Recommended service size if upgrade needed */
  recommendedServiceAmps?: number;
}

/**
 * Phase balancing analysis for 3-phase systems
 */
export interface PhaseBalanceResult {
  /** Load per phase in amps */
  phaseLoads: {
    phaseA: number;
    phaseB: number;
    phaseC: number;
  };

  /** Imbalance percentage */
  imbalancePercent: number;

  /** Whether balance is acceptable (<15%) */
  isAcceptable: boolean;

  /** Recommended charger distribution */
  chargerDistribution: {
    phaseA: number;
    phaseB: number;
    phaseC: number;
  };
}

/**
 * Transformer capacity check result
 */
export interface TransformerCapacityResult {
  /** Transformer capacity in amps */
  transformerCapacityAmps: number;

  /** Total building load with EV in amps */
  totalLoadAmps: number;

  /** Utilization percentage */
  utilizationPercent: number;

  /** Status indicator */
  status: 'green' | 'yellow' | 'red';

  /** Recommendation */
  recommendation: string;
}

/**
 * Load breakdown item
 */
export interface LoadBreakdownItem {
  category: string;
  description: string;
  connectedVA: number;
  demandVA: number;
  demandFactor: number;
  necReference: string;
}

/**
 * Complete multi-family EV analysis result
 */
export interface MultiFamilyEVResult {
  /** Input summary */
  input: {
    dwellingUnits: number;
    totalSqFt: number;
    existingServiceAmps: number;
    evChargersRequested: number;
  };

  /** Building load calculation per NEC 220.84 */
  buildingLoad: {
    /** Total connected load before demand factors (VA) */
    totalConnectedVA: number;

    /** Building load after NEC 220.84 demand factor (VA) */
    buildingDemandVA: number;

    /** NEC 220.84 demand factor applied */
    buildingDemandFactor: number;

    /** Building load in amps */
    buildingLoadAmps: number;

    /** Detailed breakdown */
    breakdown: LoadBreakdownItem[];
  };

  /** EV load calculation per NEC 220.57 */
  evLoad: {
    /** Total EV connected load (VA) */
    totalConnectedVA: number;

    /** EV demand load after NEC 220.57 factor (VA) */
    demandVA: number;

    /** NEC 220.57 demand factor applied */
    demandFactor: number;

    /** EV load in amps */
    loadAmps: number;
  };

  /** Service analysis */
  serviceAnalysis: {
    /** Existing service capacity (VA) */
    existingCapacityVA: number;

    /** Existing service capacity (Amps) */
    existingCapacityAmps: number;

    /** Total system demand (building + EV) in VA */
    totalDemandVA: number;

    /** Total system demand in amps */
    totalDemandAmps: number;

    /** Available capacity for EV (VA) */
    availableCapacityVA: number;

    /** Available capacity in amps */
    availableCapacityAmps: number;

    /** Current utilization percentage */
    utilizationPercent: number;

    /** Whether service upgrade is required */
    upgradeRequired: boolean;

    /** Upgrade type if needed */
    upgradeType?: 'none' | 'panel_only' | 'full_service';

    /** Recommended service size if upgrade needed */
    recommendedServiceAmps?: number;
  };

  /** EV capacity scenarios */
  scenarios: {
    /** Without any load management */
    noEVEMS: EVCapacityScenario;

    /** With EVEMS power sharing */
    withEVEMS: EVCapacityScenario;

    /** With service upgrade */
    withUpgrade: EVCapacityScenario;
  };

  /** Transformer capacity check (if transformer info provided) */
  transformerCheck?: TransformerCapacityResult;

  /** Phase balancing (for 3-phase systems) */
  phaseBalance?: PhaseBalanceResult;

  /** NEC compliance summary */
  compliance: {
    isCompliant: boolean;
    necArticles: string[];
    warnings: string[];
    recommendations: string[];
  };

  /** Cost comparison summary */
  costComparison: {
    scenario: string;
    maxChargers: number;
    estimatedCostLow: number;
    estimatedCostHigh: number;
  }[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get NEC 220.84 demand factor based on number of dwelling units
 */
function getMultiFamilyDemandFactor(unitCount: number): number {
  if (unitCount < 3) {
    // NEC 220.84 requires minimum 3 units for optional calculation
    return 1.0;
  }

  for (const entry of MULTI_FAMILY_DEMAND_TABLE) {
    if (unitCount <= entry.units) {
      return entry.factor;
    }
  }

  return 0.15; // 41+ units
}

/**
 * Get NEC 220.57 EV demand factor based on charger count
 */
function getEVDemandFactor(chargerCount: number): number {
  if (chargerCount <= 0) return 0;

  for (let i = EV_DEMAND_FACTORS.length - 1; i >= 0; i--) {
    const entry = EV_DEMAND_FACTORS[i];
    if (entry && chargerCount >= entry.count) {
      return entry.factor;
    }
  }

  return 1.0; // Default to 100% for 1-2 chargers
}

/**
 * Calculate service capacity in VA
 */
function calculateServiceCapacityVA(amps: number, voltage: number, phase: 1 | 3): number {
  if (phase === 3) {
    return voltage * Math.sqrt(3) * amps;
  }
  return voltage * amps;
}

/**
 * Calculate amps from VA
 */
function calculateAmps(va: number, voltage: number, phase: 1 | 3): number {
  if (phase === 3) {
    return va / (voltage * Math.sqrt(3));
  }
  return va / voltage;
}

/**
 * Round to standard service size
 */
function roundToStandardServiceSize(amps: number): number {
  for (const size of STANDARD_SERVICE_SIZES) {
    if (size >= amps) return size;
  }
  return Math.ceil(amps / 500) * 500; // Round to nearest 500A above
}

/**
 * Calculate phase balance for 3-phase system
 */
function calculatePhaseBalance(
  totalChargers: number,
  ampsPerCharger: number,
  totalBuildingLoadAmps: number
): PhaseBalanceResult {
  // Distribute chargers as evenly as possible across 3 phases
  const basePerPhase = Math.floor(totalChargers / 3);
  const remainder = totalChargers % 3;

  const distribution = {
    phaseA: basePerPhase + (remainder >= 1 ? 1 : 0),
    phaseB: basePerPhase + (remainder >= 2 ? 1 : 0),
    phaseC: basePerPhase,
  };

  // Calculate load per phase (building load assumed balanced + EV load)
  const buildingPerPhase = totalBuildingLoadAmps / 3;

  const phaseLoads = {
    phaseA: buildingPerPhase + (distribution.phaseA * ampsPerCharger),
    phaseB: buildingPerPhase + (distribution.phaseB * ampsPerCharger),
    phaseC: buildingPerPhase + (distribution.phaseC * ampsPerCharger),
  };

  // Calculate imbalance
  const maxLoad = Math.max(phaseLoads.phaseA, phaseLoads.phaseB, phaseLoads.phaseC);
  const minLoad = Math.min(phaseLoads.phaseA, phaseLoads.phaseB, phaseLoads.phaseC);
  const avgLoad = (phaseLoads.phaseA + phaseLoads.phaseB + phaseLoads.phaseC) / 3;

  const imbalancePercent = avgLoad > 0 ? ((maxLoad - minLoad) / avgLoad) * 100 : 0;

  return {
    phaseLoads: {
      phaseA: Math.round(phaseLoads.phaseA),
      phaseB: Math.round(phaseLoads.phaseB),
      phaseC: Math.round(phaseLoads.phaseC),
    },
    imbalancePercent: Math.round(imbalancePercent * 10) / 10,
    isAcceptable: imbalancePercent <= 15,
    chargerDistribution: distribution,
  };
}

/**
 * Check transformer capacity
 */
function checkTransformerCapacity(
  transformerKVA: number,
  voltage: number,
  phase: 1 | 3,
  totalLoadAmps: number
): TransformerCapacityResult {
  // Calculate transformer capacity in amps
  const transformerCapacityAmps = phase === 3
    ? (transformerKVA * 1000) / (voltage * Math.sqrt(3))
    : (transformerKVA * 1000) / voltage;

  const utilizationPercent = (totalLoadAmps / transformerCapacityAmps) * 100;

  let status: 'green' | 'yellow' | 'red';
  let recommendation: string;

  if (utilizationPercent <= 70) {
    status = 'green';
    recommendation = 'Transformer capacity is adequate. Proceed with installation.';
  } else if (utilizationPercent <= 85) {
    status = 'yellow';
    recommendation = 'Transformer utilization is approaching limits. Contact utility for verification before proceeding.';
  } else {
    status = 'red';
    recommendation = 'Transformer capacity exceeded. Service upgrade and utility coordination mandatory.';
  }

  return {
    transformerCapacityAmps: Math.round(transformerCapacityAmps),
    totalLoadAmps: Math.round(totalLoadAmps),
    utilizationPercent: Math.round(utilizationPercent * 10) / 10,
    status,
    recommendation,
  };
}

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate Multi-Family EV Readiness Analysis
 *
 * This is the main function that automates the $2-10K engineering calculation.
 * It determines how many EV chargers a multi-family building can support
 * and what upgrades (if any) are needed.
 *
 * @param input - Building and EV charger parameters
 * @returns Complete analysis with scenarios and recommendations
 */
export function calculateMultiFamilyEV(input: MultiFamilyEVInput): MultiFamilyEVResult {
  const {
    dwellingUnits,
    avgUnitSqFt,
    voltage,
    phase,
    existingServiceAmps,
    evChargers,
    hasElectricHeat = false,
    hasElectricCooking = false,
    commonAreaLoadVA = 0,
    transformer,
    useEVEMS = false,
    evemsMode = 'power_sharing',
  } = input;

  const warnings: string[] = [];
  const recommendations: string[] = [];
  const necArticles: string[] = ['NEC 220.84', 'NEC 220.57', 'NEC 625.42'];

  // =========================================================================
  // STEP 1: Calculate Building Load per NEC 220.84
  // =========================================================================

  const breakdown: LoadBreakdownItem[] = [];
  const totalSqFt = dwellingUnits * avgUnitSqFt;

  // 1a. General lighting load (3 VA/sq ft per NEC 220.12)
  const lightingLoadVA = totalSqFt * LIGHTING_LOAD_VA_PER_SQFT;
  breakdown.push({
    category: 'General Lighting',
    description: `${totalSqFt.toLocaleString()} sq ft @ 3 VA/sq ft`,
    connectedVA: lightingLoadVA,
    demandVA: lightingLoadVA, // Will be factored later
    demandFactor: 1.0,
    necReference: 'NEC Table 220.12',
  });

  // 1b. Small appliance circuits (2 per unit @ 1,500 VA each)
  const smallApplianceVA = dwellingUnits * 2 * SMALL_APPLIANCE_VA;
  breakdown.push({
    category: 'Small Appliance Circuits',
    description: `${dwellingUnits} units × 2 circuits × 1,500 VA`,
    connectedVA: smallApplianceVA,
    demandVA: smallApplianceVA,
    demandFactor: 1.0,
    necReference: 'NEC 220.52(A)',
  });

  // 1c. Laundry circuits (1 per unit @ 1,500 VA)
  const laundryVA = dwellingUnits * LAUNDRY_CIRCUIT_VA;
  breakdown.push({
    category: 'Laundry Circuits',
    description: `${dwellingUnits} units × 1,500 VA`,
    connectedVA: laundryVA,
    demandVA: laundryVA,
    demandFactor: 1.0,
    necReference: 'NEC 220.52(B)',
  });

  // Base unit loads subtotal (before major appliances)
  let baseUnitLoadVA = lightingLoadVA + smallApplianceVA + laundryVA;

  // 1d. Electric cooking (if applicable) - Table 220.55
  let cookingLoadVA = 0;
  if (hasElectricCooking) {
    // NEC Table 220.55 Column C for 12 kW or less ranges
    // Simplified: Use 8 kW for first unit, plus additional per Table
    if (dwellingUnits <= 12) {
      cookingLoadVA = (8000 + (dwellingUnits - 1) * 3500); // Approximate
    } else {
      cookingLoadVA = 25000 + (dwellingUnits - 12) * 1000; // Approximate for larger buildings
    }
    breakdown.push({
      category: 'Electric Cooking',
      description: `${dwellingUnits} units per Table 220.55`,
      connectedVA: dwellingUnits * 12000, // Assume 12 kW ranges
      demandVA: cookingLoadVA,
      demandFactor: cookingLoadVA / (dwellingUnits * 12000),
      necReference: 'NEC Table 220.55',
    });
    necArticles.push('NEC Table 220.55');
  }

  // 1e. Electric heat (if applicable) - 65% of largest unit per NEC 220.84(C)(4)
  let heatingLoadVA = 0;
  if (hasElectricHeat) {
    // Assume 10 kW per unit, apply 65% demand
    const unitHeatingVA = 10000;
    heatingLoadVA = dwellingUnits * unitHeatingVA * 0.65;
    breakdown.push({
      category: 'Electric Heat',
      description: `${dwellingUnits} units @ 65% demand`,
      connectedVA: dwellingUnits * unitHeatingVA,
      demandVA: heatingLoadVA,
      demandFactor: 0.65,
      necReference: 'NEC 220.84(C)(4)',
    });
  }

  // 1f. Calculate unit subtotal and apply NEC 220.84 demand factor
  const unitLoadsSubtotal = baseUnitLoadVA + cookingLoadVA + heatingLoadVA;
  const buildingDemandFactor = getMultiFamilyDemandFactor(dwellingUnits);
  const unitLoadsDemandVA = unitLoadsSubtotal * buildingDemandFactor;

  breakdown.push({
    category: 'NEC 220.84 Demand Factor',
    description: `${dwellingUnits} units @ ${(buildingDemandFactor * 100).toFixed(0)}%`,
    connectedVA: unitLoadsSubtotal,
    demandVA: unitLoadsDemandVA,
    demandFactor: buildingDemandFactor,
    necReference: 'NEC Table 220.84',
  });

  // 1g. Common area loads (100% - no demand factor)
  if (commonAreaLoadVA > 0) {
    breakdown.push({
      category: 'Common Area Loads',
      description: 'Lighting, elevators, pool, etc. (100%)',
      connectedVA: commonAreaLoadVA,
      demandVA: commonAreaLoadVA,
      demandFactor: 1.0,
      necReference: 'NEC 220.84(B)',
    });
  }

  // Total building load
  const totalConnectedVA = unitLoadsSubtotal + commonAreaLoadVA;
  const buildingDemandVA = unitLoadsDemandVA + commonAreaLoadVA;
  const buildingLoadAmps = calculateAmps(buildingDemandVA, voltage, phase);

  // =========================================================================
  // STEP 2: Calculate EV Load per NEC 220.57
  // =========================================================================

  // EV charger load calculation
  // Level 2 charger voltage depends on system (240V single-phase, 208V 3-phase)
  const evVoltage = phase === 3 ? 208 : 240;
  const singleChargerVA = evVoltage * evChargers.ampsPerCharger;
  const totalEVConnectedVA = singleChargerVA * evChargers.count;

  // Apply NEC 220.57 demand factor
  const evDemandFactor = getEVDemandFactor(evChargers.count);
  const evDemandVA = totalEVConnectedVA * evDemandFactor;
  const evLoadAmps = calculateAmps(evDemandVA, voltage, phase);

  // =========================================================================
  // STEP 3: Service Analysis
  // =========================================================================

  const existingCapacityVA = calculateServiceCapacityVA(existingServiceAmps, voltage, phase);
  const existingCapacityAmps = existingServiceAmps;

  const totalDemandVA = buildingDemandVA + evDemandVA;
  const totalDemandAmps = calculateAmps(totalDemandVA, voltage, phase);

  const availableCapacityVA = existingCapacityVA - buildingDemandVA;
  const availableCapacityAmps = calculateAmps(availableCapacityVA, voltage, phase);

  const utilizationPercent = (totalDemandVA / existingCapacityVA) * 100;

  // Determine if upgrade is needed
  const upgradeRequired = totalDemandVA > existingCapacityVA;
  let upgradeType: 'none' | 'panel_only' | 'full_service' = 'none';
  let recommendedServiceAmps: number | undefined;

  if (upgradeRequired) {
    // Add 25% margin for future growth
    const requiredAmps = totalDemandAmps * 1.25;
    recommendedServiceAmps = roundToStandardServiceSize(requiredAmps);

    // Determine upgrade type based on size increase
    if (recommendedServiceAmps <= existingServiceAmps * 1.5) {
      upgradeType = 'panel_only';
      recommendations.push('Panel upgrade may be sufficient - consult with utility.');
    } else {
      upgradeType = 'full_service';
      recommendations.push('Full service upgrade required - utility coordination needed.');
    }

    warnings.push(`Service capacity exceeded by ${Math.round(totalDemandAmps - existingCapacityAmps)}A`);
  }

  // =========================================================================
  // STEP 4: Calculate Scenarios
  // =========================================================================

  // Scenario A: Without EVEMS
  const maxChargersNoEVEMS = Math.floor(availableCapacityAmps / evChargers.ampsPerCharger);
  const noEVEMSScenario: EVCapacityScenario = {
    name: 'Direct Connection (No Load Management)',
    maxChargers: Math.max(0, maxChargersNoEVEMS),
    notes: [
      'Each charger operates at full power independently',
      `Available capacity: ${Math.round(availableCapacityAmps)}A`,
      'Fixed capacity - no flexibility',
    ],
    requiresServiceUpgrade: maxChargersNoEVEMS < evChargers.count,
    recommendedServiceAmps: maxChargersNoEVEMS < evChargers.count ? recommendedServiceAmps : undefined,
    estimatedCostLow: Math.max(0, maxChargersNoEVEMS) * 800,
    estimatedCostHigh: Math.max(0, maxChargersNoEVEMS) * 1500,
  };

  // Scenario B: With EVEMS power sharing
  // EVEMS allows more chargers by sharing available capacity
  const evemsEfficiencyFactor = 0.90; // 90% of theoretical capacity usable
  const effectiveCapacityWithEVEMS = availableCapacityAmps * evemsEfficiencyFactor;

  // With power sharing, chargers can be reduced to minimum viable power (e.g., 12A for Level 2)
  const minViableAmpsPerCharger = 12; // Minimum for Level 2 overnight charging
  const maxChargersWithEVEMS = Math.floor(effectiveCapacityWithEVEMS / minViableAmpsPerCharger);
  const powerPerChargerWithEVEMS = evChargers.count > 0
    ? effectiveCapacityWithEVEMS / Math.min(evChargers.count, maxChargersWithEVEMS)
    : 0;

  const withEVEMSScenario: EVCapacityScenario = {
    name: 'With EVEMS (Power Sharing)',
    maxChargers: Math.max(0, maxChargersWithEVEMS),
    powerPerCharger_kW: (evVoltage * powerPerChargerWithEVEMS) / 1000,
    notes: [
      'Chargers share available capacity dynamically',
      `${Math.round(effectiveCapacityWithEVEMS)}A shared among all chargers`,
      `Each charger gets ~${Math.round(powerPerChargerWithEVEMS)}A when all active`,
      'Overnight charging typically provides 30-50 miles of range',
    ],
    requiresServiceUpgrade: maxChargersWithEVEMS < evChargers.count,
    recommendedServiceAmps: maxChargersWithEVEMS < evChargers.count ? recommendedServiceAmps : undefined,
    estimatedCostLow: 15000 + Math.max(0, Math.min(evChargers.count, maxChargersWithEVEMS)) * 800,
    estimatedCostHigh: 35000 + Math.max(0, Math.min(evChargers.count, maxChargersWithEVEMS)) * 1500,
  };

  // Scenario C: With service upgrade
  const upgradeServiceAmps = recommendedServiceAmps || roundToStandardServiceSize(totalDemandAmps * 1.25);
  const upgradeCapacityVA = calculateServiceCapacityVA(upgradeServiceAmps, voltage, phase);
  const upgradeAvailableAmps = calculateAmps(upgradeCapacityVA - buildingDemandVA, voltage, phase);

  const withUpgradeScenario: EVCapacityScenario = {
    name: 'With Service Upgrade',
    maxChargers: evChargers.count, // Can accommodate all requested chargers
    notes: [
      `Upgrade to ${upgradeServiceAmps}A service`,
      `Available capacity after upgrade: ${Math.round(upgradeAvailableAmps)}A`,
      'Full power to all chargers simultaneously',
      'Utility coordination required',
    ],
    requiresServiceUpgrade: true,
    recommendedServiceAmps: upgradeServiceAmps,
    estimatedCostLow: 50000 + evChargers.count * 800,
    estimatedCostHigh: 150000 + evChargers.count * 1500,
  };

  // =========================================================================
  // STEP 5: Optional Checks
  // =========================================================================

  // Transformer capacity check
  let transformerCheck: TransformerCapacityResult | undefined;
  if (transformer) {
    transformerCheck = checkTransformerCapacity(
      transformer.kvaRating,
      voltage,
      phase,
      totalDemandAmps
    );

    if (transformerCheck.status === 'red') {
      warnings.push('Transformer capacity exceeded - contact utility before proceeding');
    } else if (transformerCheck.status === 'yellow') {
      warnings.push('Transformer utilization high - recommend utility verification');
    }

    necArticles.push('NEC 450.3');
  }

  // Phase balancing (for 3-phase systems)
  let phaseBalance: PhaseBalanceResult | undefined;
  if (phase === 3 && evChargers.count > 0) {
    phaseBalance = calculatePhaseBalance(
      evChargers.count,
      evChargers.ampsPerCharger,
      buildingLoadAmps
    );

    if (!phaseBalance.isAcceptable) {
      warnings.push(`Phase imbalance of ${phaseBalance.imbalancePercent}% exceeds 15% recommendation`);
    }
  }

  // =========================================================================
  // STEP 6: Compliance Summary
  // =========================================================================

  // Add validation warnings
  if (dwellingUnits < 3) {
    warnings.push('NEC 220.84 requires minimum 3 dwelling units for optional calculation method');
    necArticles.push('NEC 220.82 (Standard Method)');
  }

  if (utilizationPercent > 100) {
    warnings.push('Service utilization exceeds 100% - upgrade required');
  } else if (utilizationPercent > 90) {
    warnings.push('Service utilization exceeds 90% - limited future expansion');
  } else if (utilizationPercent > 80) {
    recommendations.push('Consider EVEMS to maximize charger capacity without service upgrade');
  }

  // EVEMS recommendation
  if (!useEVEMS && maxChargersNoEVEMS < evChargers.count && maxChargersWithEVEMS >= evChargers.count) {
    recommendations.push(`EVEMS can accommodate all ${evChargers.count} chargers without service upgrade`);
  }

  const isCompliant = !upgradeRequired || upgradeType !== 'none';

  // =========================================================================
  // STEP 7: Cost Comparison
  // =========================================================================

  const costComparison = [
    {
      scenario: 'No Load Management',
      maxChargers: noEVEMSScenario.maxChargers,
      estimatedCostLow: noEVEMSScenario.estimatedCostLow || 0,
      estimatedCostHigh: noEVEMSScenario.estimatedCostHigh || 0,
    },
    {
      scenario: 'With EVEMS',
      maxChargers: Math.min(evChargers.count, withEVEMSScenario.maxChargers),
      estimatedCostLow: withEVEMSScenario.estimatedCostLow || 0,
      estimatedCostHigh: withEVEMSScenario.estimatedCostHigh || 0,
    },
    {
      scenario: 'Service Upgrade',
      maxChargers: evChargers.count,
      estimatedCostLow: withUpgradeScenario.estimatedCostLow || 0,
      estimatedCostHigh: withUpgradeScenario.estimatedCostHigh || 0,
    },
  ];

  // =========================================================================
  // Return Complete Result
  // =========================================================================

  return {
    input: {
      dwellingUnits,
      totalSqFt,
      existingServiceAmps,
      evChargersRequested: evChargers.count,
    },
    buildingLoad: {
      totalConnectedVA: Math.round(totalConnectedVA),
      buildingDemandVA: Math.round(buildingDemandVA),
      buildingDemandFactor,
      buildingLoadAmps: Math.round(buildingLoadAmps),
      breakdown,
    },
    evLoad: {
      totalConnectedVA: Math.round(totalEVConnectedVA),
      demandVA: Math.round(evDemandVA),
      demandFactor: evDemandFactor,
      loadAmps: Math.round(evLoadAmps),
    },
    serviceAnalysis: {
      existingCapacityVA: Math.round(existingCapacityVA),
      existingCapacityAmps,
      totalDemandVA: Math.round(totalDemandVA),
      totalDemandAmps: Math.round(totalDemandAmps),
      availableCapacityVA: Math.round(availableCapacityVA),
      availableCapacityAmps: Math.round(availableCapacityAmps),
      utilizationPercent: Math.round(utilizationPercent * 10) / 10,
      upgradeRequired,
      upgradeType,
      recommendedServiceAmps,
    },
    scenarios: {
      noEVEMS: noEVEMSScenario,
      withEVEMS: withEVEMSScenario,
      withUpgrade: withUpgradeScenario,
    },
    transformerCheck,
    phaseBalance,
    compliance: {
      isCompliant,
      necArticles: [...new Set(necArticles)],
      warnings,
      recommendations,
    },
    costComparison,
  };
}

/**
 * Quick check function for field estimates
 * Simplified version for rapid assessment
 */
export function quickMultiFamilyEVCheck(
  dwellingUnits: number,
  avgUnitSqFt: number,
  existingServiceAmps: number,
  evChargerCount: number,
  ampsPerCharger: number = 48,
  voltage: number = 208,
  phase: 1 | 3 = 3
): {
  canSupport: boolean;
  maxChargersWithoutUpgrade: number;
  utilizationPercent: number;
  recommendation: string;
} {
  // Quick building load estimate using NEC 220.84
  const demandFactor = getMultiFamilyDemandFactor(dwellingUnits);
  const baseLoadVA = (dwellingUnits * avgUnitSqFt * 3) + (dwellingUnits * 4500); // Lighting + SA + Laundry
  const buildingDemandVA = baseLoadVA * demandFactor;

  // Service capacity
  const serviceCapacityVA = phase === 3
    ? voltage * Math.sqrt(3) * existingServiceAmps
    : voltage * existingServiceAmps;

  // Available capacity
  const availableVA = serviceCapacityVA - buildingDemandVA;
  const availableAmps = phase === 3
    ? availableVA / (voltage * Math.sqrt(3))
    : availableVA / voltage;

  // EV load
  const evVoltage = phase === 3 ? 208 : 240;
  const totalEVAmps = evChargerCount * ampsPerCharger;

  // Results
  const maxChargersWithoutUpgrade = Math.floor(availableAmps / ampsPerCharger);
  const utilizationPercent = ((buildingDemandVA + (totalEVAmps * evVoltage)) / serviceCapacityVA) * 100;
  const canSupport = maxChargersWithoutUpgrade >= evChargerCount;

  let recommendation: string;
  if (canSupport) {
    recommendation = `Building can support all ${evChargerCount} chargers without upgrade.`;
  } else if (maxChargersWithoutUpgrade > 0) {
    recommendation = `Can support ${maxChargersWithoutUpgrade} chargers without upgrade. Consider EVEMS or service upgrade for ${evChargerCount} chargers.`;
  } else {
    recommendation = `Service upgrade required. Available capacity insufficient for EV charging.`;
  }

  return {
    canSupport,
    maxChargersWithoutUpgrade: Math.max(0, maxChargersWithoutUpgrade),
    utilizationPercent: Math.round(utilizationPercent * 10) / 10,
    recommendation,
  };
}
