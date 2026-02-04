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
 *
 * VERIFIED per NEC 2020/2023 Table 220.84
 * Source: NFPA 70-2023, up.codes, Mike Holt forums
 *
 * Conditions for use (NEC 220.84):
 * 1. No dwelling unit supplied by more than one feeder
 * 2. Each unit has electric cooking equipment
 * 3. Each unit has electric heat or A/C (or both)
 */
const MULTI_FAMILY_DEMAND_TABLE: { units: number; factor: number }[] = [
  { units: 5, factor: 0.45 },     // 3-5 units: 45%
  { units: 7, factor: 0.44 },     // 6-7 units: 44%
  { units: 10, factor: 0.43 },    // 8-10 units: 43%
  { units: 11, factor: 0.42 },    // 11 units: 42%
  { units: 13, factor: 0.41 },    // 12-13 units: 41%
  { units: 15, factor: 0.40 },    // 14-15 units: 40%
  { units: 17, factor: 0.39 },    // 16-17 units: 39%
  { units: 20, factor: 0.38 },    // 18-20 units: 38%
  { units: 21, factor: 0.37 },    // 21 units: 37%
  { units: 23, factor: 0.36 },    // 22-23 units: 36%
  { units: 25, factor: 0.35 },    // 24-25 units: 35%
  { units: 27, factor: 0.34 },    // 26-27 units: 34%
  { units: 30, factor: 0.33 },    // 28-30 units: 33%
  { units: 31, factor: 0.32 },    // 31 units: 32%
  { units: 33, factor: 0.31 },    // 32-33 units: 31%
  { units: 36, factor: 0.30 },    // 34-36 units: 30%
  { units: 38, factor: 0.29 },    // 37-38 units: 29%
  { units: 42, factor: 0.28 },    // 39-42 units: 28%
  { units: 45, factor: 0.27 },    // 43-45 units: 27%
  { units: 50, factor: 0.26 },    // 46-50 units: 26%
  { units: 55, factor: 0.25 },    // 51-55 units: 25%
  { units: 61, factor: 0.24 },    // 56-61 units: 24%
  { units: Infinity, factor: 0.23 }, // 62+ units: 23%
];

/**
 * NEC 220.57 - Electric Vehicle Branch-Circuit Load (2023 NEC)
 *
 * IMPORTANT: NEC 220.57 is NOT a demand factor table!
 * It specifies how to calculate per-EVSE load:
 *   "The load for one EVSE shall be calculated at the larger of:
 *    (1) 7,200 volt-amperes, or
 *    (2) The nameplate rating of the EVSE"
 *
 * For service/feeder calculations:
 * - WITHOUT EVEMS: Use full connected EV load (sum of per-EVSE loads)
 * - WITH EVEMS (NEC 625.42): Size to EVEMS setpoint, treated as continuous
 *
 * Source: NFPA 70-2023 Article 220.57, Captain Code 2023
 */
const NEC_220_57_MINIMUM_VA = 7200; // 7,200 VA minimum per EVSE

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
// COMMON AREA LOAD CONSTANTS
// ============================================================================

/**
 * NEC Table 220.12 - General Lighting Loads (Commercial/Common Areas)
 * These are for common areas, NOT dwelling units
 */
const COMMON_AREA_LIGHTING_VA_PER_SQFT: Record<string, number> = {
  'corridor': 0.5,      // Corridors, hallways
  'lobby': 2.0,         // Lobbies, reception areas
  'stairwell': 0.5,     // Stairwells
  'parking_indoor': 0.2, // Indoor parking/garage
  'parking_outdoor': 0.1, // Outdoor parking (pole lights)
  'amenity': 1.5,       // Gym, clubhouse, party room
  'laundry': 1.5,       // Common laundry room
  'mechanical': 0.5,    // Mechanical/electrical rooms
  'office': 1.5,        // Leasing/management office
  'pool_area': 1.0,     // Pool deck lighting
};

/**
 * Motor HP to VA conversion (approximate)
 * Based on typical motor efficiency and power factor
 */
const HP_TO_VA = 746 * 1.25; // 746 W/HP × 1.25 (PF/efficiency factor) ≈ 932 VA/HP

/**
 * HVAC tons to VA conversion
 * Approximate: 1 ton = 12,000 BTU/hr ≈ 1,500 VA (including fan)
 */
const TONS_TO_VA = 1500;

/**
 * Common area load category types
 */
export type CommonAreaCategory =
  | 'lighting_indoor'
  | 'lighting_outdoor'
  | 'receptacles'
  | 'elevators'
  | 'pool_spa'
  | 'hvac'
  | 'fire_pump'
  | 'motors'
  | 'other';

/**
 * Common area load item for itemized input
 */
export interface CommonAreaLoadItem {
  /** Load category */
  category: CommonAreaCategory;

  /** Description (e.g., "Lobby lighting", "Elevator #1") */
  description: string;

  /** Input type determines how value is interpreted */
  inputType: 'va' | 'sqft' | 'hp' | 'tons';

  /** Primary value (VA, sq ft, HP, or tons depending on inputType) */
  value: number;

  /** Quantity for multiple units (e.g., 2 elevators) */
  quantity?: number;

  /** Space type for lighting (determines VA/sq ft) */
  spaceType?: keyof typeof COMMON_AREA_LIGHTING_VA_PER_SQFT;
}

/**
 * Common area load calculation result
 */
export interface CommonAreaLoadResult {
  /** Individual load items with demand factors applied */
  items: LoadBreakdownItem[];

  /** Total connected load (before demand factors) */
  totalConnectedVA: number;

  /** Total demand load (after demand factors) */
  totalDemandVA: number;
}

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

  /** Optional: Common area loads in VA (lighting, elevators, pool, etc.) - simple entry */
  commonAreaLoadVA?: number;

  /** Optional: Itemized common area loads with NEC demand factors */
  commonAreaLoads?: CommonAreaLoadItem[];

  /** Optional: Transformer information (for capacity check) */
  transformer?: {
    kvaRating: number;
    impedancePercent?: number;
  };

  /** Whether to use EVEMS load management */
  useEVEMS?: boolean;

  /** EVEMS scheduling mode */
  evemsMode?: 'power_sharing' | 'scheduled' | 'dynamic';

  // =========================================================================
  // NEC 220.87 - Existing Load Determination Method
  // =========================================================================

  /**
   * How existing building load is determined per NEC 220.87
   *
   * - 'calculated': Use NEC 220.84 calculation (125% multiplier applied)
   * - 'utility_bill': 12-month utility billing data (no multiplier - actual demand)
   * - 'load_study': 30-day continuous recording (no multiplier - actual demand)
   *
   * Default: 'calculated'
   */
  existingLoadMethod?: 'calculated' | 'utility_bill' | 'load_study';

  /**
   * Measured peak demand in kW (required if utility_bill or load_study)
   * This is the actual measured building demand from utility records
   */
  measuredPeakDemandKW?: number;

  /**
   * Measurement period description (e.g., "Jan 2025 - Dec 2025")
   */
  measurementPeriod?: string;

  /**
   * Utility company name (for documentation)
   */
  utilityCompany?: string;
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

  /** Building load calculation per NEC 220.84 or NEC 220.87 */
  buildingLoad: {
    /** Total connected load before demand factors (VA) */
    totalConnectedVA: number;

    /** Building load after demand factor (VA) */
    buildingDemandVA: number;

    /** Demand factor applied (1.0 for measured data) */
    buildingDemandFactor: number;

    /** Building load in amps */
    buildingLoadAmps: number;

    /** Detailed breakdown */
    breakdown: LoadBreakdownItem[];

    /**
     * Load determination method per NEC 220.87
     * - 'calculated': NEC 220.84 calculation (default)
     * - 'utility_bill': 12-month utility billing data (NEC 220.87(A))
     * - 'load_study': 30-day continuous recording (NEC 220.87(A))
     */
    loadDeterminationMethod: 'calculated' | 'utility_bill' | 'load_study';

    /** Measurement period (if using utility_bill or load_study) */
    measurementPeriod?: string;

    /** Utility company (if using utility_bill or load_study) */
    utilityCompany?: string;
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
 * Calculate per-EVSE load per NEC 220.57(A)
 * Load = max(7,200 VA, nameplate VA)
 */
function calculatePerEVSELoad(nameplateAmps: number, voltage: number): number {
  const nameplateVA = nameplateAmps * voltage;
  return Math.max(NEC_220_57_MINIMUM_VA, nameplateVA);
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

/**
 * Calculate common area loads with proper NEC demand factors
 *
 * NEC Demand Factor References:
 * - Lighting: 220.42 "All Others" = 100%
 * - Receptacles: 220.44 = 100% first 10 kVA, 50% remainder
 * - Elevators: 620.14 = Largest @ 100%, others @ 50%
 * - Motors: 430.24 = Largest @ 125%, others @ 100%
 * - Pool/Spa: 680 = 100% (largest motor @ 125% if multiple)
 * - HVAC: 440 = 100% per nameplate
 * - Fire Pump: 695.7 = 100%
 *
 * @param items - Array of common area load items
 * @returns Calculated loads with demand factors applied
 */
export function calculateCommonAreaLoads(items: CommonAreaLoadItem[]): CommonAreaLoadResult {
  if (!items || items.length === 0) {
    return {
      items: [],
      totalConnectedVA: 0,
      totalDemandVA: 0,
    };
  }

  const breakdownItems: LoadBreakdownItem[] = [];

  // Group items by category for demand factor calculations
  const byCategory: Record<CommonAreaCategory, { connectedVA: number; items: CommonAreaLoadItem[] }> = {
    lighting_indoor: { connectedVA: 0, items: [] },
    lighting_outdoor: { connectedVA: 0, items: [] },
    receptacles: { connectedVA: 0, items: [] },
    elevators: { connectedVA: 0, items: [] },
    pool_spa: { connectedVA: 0, items: [] },
    hvac: { connectedVA: 0, items: [] },
    fire_pump: { connectedVA: 0, items: [] },
    motors: { connectedVA: 0, items: [] },
    other: { connectedVA: 0, items: [] },
  };

  // First pass: Convert all items to VA and group by category
  for (const item of items) {
    let connectedVA = 0;
    const qty = item.quantity || 1;

    switch (item.inputType) {
      case 'va':
        connectedVA = item.value * qty;
        break;
      case 'sqft':
        // Use space-specific VA/sqft or default
        const vaPerSqft = item.spaceType
          ? COMMON_AREA_LIGHTING_VA_PER_SQFT[item.spaceType] || 1.0
          : (item.category === 'lighting_outdoor' ? 0.25 : 2.0);
        connectedVA = item.value * vaPerSqft * qty;
        break;
      case 'hp':
        connectedVA = item.value * HP_TO_VA * qty;
        break;
      case 'tons':
        connectedVA = item.value * TONS_TO_VA * qty;
        break;
    }

    byCategory[item.category].connectedVA += connectedVA;
    byCategory[item.category].items.push({ ...item, value: connectedVA / qty }); // Store VA per unit
  }

  let totalConnectedVA = 0;
  let totalDemandVA = 0;

  // Process each category with appropriate NEC demand factors

  // LIGHTING (Indoor & Outdoor) - NEC 220.42 "All Others" = 100%
  for (const lightingCat of ['lighting_indoor', 'lighting_outdoor'] as const) {
    const data = byCategory[lightingCat];
    if (data.connectedVA > 0) {
      const demandVA = data.connectedVA; // 100% for commercial lighting
      breakdownItems.push({
        category: lightingCat === 'lighting_indoor' ? 'Common Area - Indoor Lighting' : 'Common Area - Outdoor Lighting',
        description: data.items.map(i => i.description).join(', '),
        connectedVA: Math.round(data.connectedVA),
        demandVA: Math.round(demandVA),
        demandFactor: 1.0,
        necReference: 'NEC 220.42',
      });
      totalConnectedVA += data.connectedVA;
      totalDemandVA += demandVA;
    }
  }

  // RECEPTACLES - NEC 220.44: 100% first 10 kVA, 50% remainder
  const receptacleData = byCategory.receptacles;
  if (receptacleData.connectedVA > 0) {
    let demandVA: number;
    let demandFactor: number;
    if (receptacleData.connectedVA <= 10000) {
      demandVA = receptacleData.connectedVA;
      demandFactor = 1.0;
    } else {
      demandVA = 10000 + (receptacleData.connectedVA - 10000) * 0.5;
      demandFactor = demandVA / receptacleData.connectedVA;
    }
    breakdownItems.push({
      category: 'Common Area - Receptacles',
      description: receptacleData.items.map(i => i.description).join(', ') || 'General receptacles',
      connectedVA: Math.round(receptacleData.connectedVA),
      demandVA: Math.round(demandVA),
      demandFactor: Math.round(demandFactor * 100) / 100,
      necReference: 'NEC 220.44',
    });
    totalConnectedVA += receptacleData.connectedVA;
    totalDemandVA += demandVA;
  }

  // ELEVATORS - NEC 620.14: Largest @ 100%, others @ 50%
  const elevatorData = byCategory.elevators;
  if (elevatorData.connectedVA > 0) {
    // Sort items by VA (largest first)
    const sortedElevators = [...elevatorData.items].sort((a, b) => {
      const aVA = a.value * (a.quantity || 1);
      const bVA = b.value * (b.quantity || 1);
      return bVA - aVA;
    });

    let demandVA = 0;
    let isFirst = true;
    for (const elev of sortedElevators) {
      const elevVA = elev.value * (elev.quantity || 1);
      if (isFirst) {
        demandVA += elevVA; // 100% for largest
        isFirst = false;
      } else {
        demandVA += elevVA * 0.5; // 50% for others
      }
    }

    const demandFactor = demandVA / elevatorData.connectedVA;
    breakdownItems.push({
      category: 'Common Area - Elevators',
      description: elevatorData.items.map(i => i.description).join(', '),
      connectedVA: Math.round(elevatorData.connectedVA),
      demandVA: Math.round(demandVA),
      demandFactor: Math.round(demandFactor * 100) / 100,
      necReference: 'NEC 620.14',
    });
    totalConnectedVA += elevatorData.connectedVA;
    totalDemandVA += demandVA;
  }

  // MOTORS (General) - NEC 430.24: Largest @ 125%, others @ 100%
  const motorData = byCategory.motors;
  if (motorData.connectedVA > 0) {
    // Sort by VA (largest first)
    const sortedMotors = [...motorData.items].sort((a, b) => {
      const aVA = a.value * (a.quantity || 1);
      const bVA = b.value * (b.quantity || 1);
      return bVA - aVA;
    });

    let demandVA = 0;
    let isFirst = true;
    for (const motor of sortedMotors) {
      const motorVA = motor.value * (motor.quantity || 1);
      if (isFirst) {
        demandVA += motorVA * 1.25; // 125% for largest
        isFirst = false;
      } else {
        demandVA += motorVA; // 100% for others
      }
    }

    const demandFactor = demandVA / motorData.connectedVA;
    breakdownItems.push({
      category: 'Common Area - Motors',
      description: motorData.items.map(i => i.description).join(', '),
      connectedVA: Math.round(motorData.connectedVA),
      demandVA: Math.round(demandVA),
      demandFactor: Math.round(demandFactor * 100) / 100,
      necReference: 'NEC 430.24',
    });
    totalConnectedVA += motorData.connectedVA;
    totalDemandVA += demandVA;
  }

  // POOL/SPA - NEC 680: 100% (motor loads should use 430.24 if multiple)
  const poolData = byCategory.pool_spa;
  if (poolData.connectedVA > 0) {
    // If multiple pool motors, apply largest @ 125%, others @ 100%
    let demandVA: number;
    let demandFactor: number;
    if (poolData.items.length > 1) {
      const sortedPool = [...poolData.items].sort((a, b) => {
        const aVA = a.value * (a.quantity || 1);
        const bVA = b.value * (b.quantity || 1);
        return bVA - aVA;
      });
      demandVA = 0;
      let isFirst = true;
      for (const pool of sortedPool) {
        const poolVA = pool.value * (pool.quantity || 1);
        if (isFirst) {
          demandVA += poolVA * 1.25;
          isFirst = false;
        } else {
          demandVA += poolVA;
        }
      }
      demandFactor = demandVA / poolData.connectedVA;
    } else {
      demandVA = poolData.connectedVA;
      demandFactor = 1.0;
    }

    breakdownItems.push({
      category: 'Common Area - Pool/Spa',
      description: poolData.items.map(i => i.description).join(', '),
      connectedVA: Math.round(poolData.connectedVA),
      demandVA: Math.round(demandVA),
      demandFactor: Math.round(demandFactor * 100) / 100,
      necReference: 'NEC 680',
    });
    totalConnectedVA += poolData.connectedVA;
    totalDemandVA += demandVA;
  }

  // HVAC - NEC 440: 100% per nameplate
  const hvacData = byCategory.hvac;
  if (hvacData.connectedVA > 0) {
    breakdownItems.push({
      category: 'Common Area - HVAC',
      description: hvacData.items.map(i => i.description).join(', '),
      connectedVA: Math.round(hvacData.connectedVA),
      demandVA: Math.round(hvacData.connectedVA),
      demandFactor: 1.0,
      necReference: 'NEC 440',
    });
    totalConnectedVA += hvacData.connectedVA;
    totalDemandVA += hvacData.connectedVA;
  }

  // FIRE PUMP - NEC 695.7: 100%
  const firePumpData = byCategory.fire_pump;
  if (firePumpData.connectedVA > 0) {
    breakdownItems.push({
      category: 'Common Area - Fire Pump',
      description: firePumpData.items.map(i => i.description).join(', '),
      connectedVA: Math.round(firePumpData.connectedVA),
      demandVA: Math.round(firePumpData.connectedVA),
      demandFactor: 1.0,
      necReference: 'NEC 695.7',
    });
    totalConnectedVA += firePumpData.connectedVA;
    totalDemandVA += firePumpData.connectedVA;
  }

  // OTHER - 100% (no demand factor)
  const otherData = byCategory.other;
  if (otherData.connectedVA > 0) {
    breakdownItems.push({
      category: 'Common Area - Other',
      description: otherData.items.map(i => i.description).join(', '),
      connectedVA: Math.round(otherData.connectedVA),
      demandVA: Math.round(otherData.connectedVA),
      demandFactor: 1.0,
      necReference: 'NEC 220.84(B)',
    });
    totalConnectedVA += otherData.connectedVA;
    totalDemandVA += otherData.connectedVA;
  }

  return {
    items: breakdownItems,
    totalConnectedVA: Math.round(totalConnectedVA),
    totalDemandVA: Math.round(totalDemandVA),
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
    commonAreaLoads,
    transformer,
    useEVEMS = false,
    evemsMode = 'power_sharing',
    // NEC 220.87 - Existing Load Determination Method
    existingLoadMethod = 'calculated',
    measuredPeakDemandKW,
    measurementPeriod,
    utilityCompany,
  } = input;

  const warnings: string[] = [];
  const recommendations: string[] = [];
  const necArticles: string[] = ['NEC 220.84', 'NEC 220.57', 'NEC 625.42'];

  // =========================================================================
  // STEP 1: Determine Building Load
  // =========================================================================
  // Per NEC 220.87:
  // - 220.87(A): Measurement (utility bill/load study) - use actual demand, NO multiplier
  // - 220.87(B): Calculation (Article 220.84) - calculate per NEC
  //
  // Using measured data often shows MORE available capacity than calculation,
  // because actual building usage is typically lower than code-calculated demand.
  // =========================================================================

  const breakdown: LoadBreakdownItem[] = [];
  const totalSqFt = dwellingUnits * avgUnitSqFt;

  // Variables for building load (will be populated based on method)
  let buildingDemandVA: number;
  let totalConnectedVA: number;
  let buildingDemandFactor: number;

  // Check if using measured data (NEC 220.87(A)) or calculation (NEC 220.87(B))
  const useMeasuredData = (existingLoadMethod === 'utility_bill' || existingLoadMethod === 'load_study')
    && measuredPeakDemandKW !== undefined && measuredPeakDemandKW > 0;

  if (useMeasuredData) {
    // =========================================================================
    // PATH A: MEASURED DATA (NEC 220.87(A))
    // =========================================================================
    // Using actual measured demand from utility billing or load study.
    // NO 125% multiplier - this IS the actual building demand.
    //
    // Benefits of measurement method:
    // - Often shows MORE available capacity than calculation
    // - Reflects actual usage patterns (vacancy, efficiency, etc.)
    // - Widely accepted by AHJs for service upgrade calculations
    // =========================================================================

    necArticles.push('NEC 220.87(A)');

    const measuredDemandVA = measuredPeakDemandKW * 1000;

    // Create breakdown entry for measured data
    const methodDescription = existingLoadMethod === 'utility_bill'
      ? `12-month utility billing${utilityCompany ? ` (${utilityCompany})` : ''}`
      : `30-day load study${utilityCompany ? ` (${utilityCompany})` : ''}`;

    const periodDescription = measurementPeriod ? ` (${measurementPeriod})` : '';

    breakdown.push({
      category: 'Measured Building Demand',
      description: `${methodDescription}${periodDescription}`,
      connectedVA: measuredDemandVA, // Best estimate - same as measured
      demandVA: measuredDemandVA,
      demandFactor: 1.0, // No factor applied - this is actual demand
      necReference: 'NEC 220.87(A)',
    });

    // Set building load values from measured data
    totalConnectedVA = measuredDemandVA; // We don't know connected, use measured
    buildingDemandVA = measuredDemandVA;
    buildingDemandFactor = 1.0; // Not applicable for measured data

    recommendations.push(
      'Building load based on measured demand (NEC 220.87(A)) - typically shows more available capacity than calculation.'
    );

    // Note: Common area loads are INCLUDED in measured demand, don't add separately

  } else {
    // =========================================================================
    // PATH B: CALCULATED DATA (NEC 220.87(B) via NEC 220.84)
    // =========================================================================
    // Calculate building demand using NEC 220.84 Optional Method for
    // multifamily dwellings. This is the standard calculation method.
    // =========================================================================

    necArticles.push('NEC 220.87(B)');

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
    const baseUnitLoadVA = lightingLoadVA + smallApplianceVA + laundryVA;

    // 1d. Electric cooking (if applicable) - per NEC 220.84(C)(3)
    // IMPORTANT: For NEC 220.84 Optional Method, cooking equipment is included
    // at NAMEPLATE rating, NOT reduced per Table 220.55. The Table 220.84
    // demand factor is applied once to the total.
    // Table 220.55 is for the Standard Method (220.40-220.60), not 220.84.
    let cookingLoadVA = 0;
    if (hasElectricCooking) {
      // Include at nameplate rating per NEC 220.84(C)(3)
      // Assume 12 kW range per dwelling unit
      const nameplatePerUnit = 12000; // 12 kW = 12,000 VA
      cookingLoadVA = dwellingUnits * nameplatePerUnit;
      breakdown.push({
        category: 'Electric Cooking',
        description: `${dwellingUnits} units @ 12 kW nameplate each`,
        connectedVA: cookingLoadVA,
        demandVA: cookingLoadVA, // Will be factored with all loads via 220.84
        demandFactor: 1.0, // No separate factor - 220.84 applies to sum
        necReference: 'NEC 220.84(C)(3)',
      });
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
    buildingDemandFactor = getMultiFamilyDemandFactor(dwellingUnits);
    const unitLoadsDemandVA = unitLoadsSubtotal * buildingDemandFactor;

    breakdown.push({
      category: 'NEC 220.84 Demand Factor',
      description: `${dwellingUnits} units @ ${(buildingDemandFactor * 100).toFixed(0)}%`,
      connectedVA: unitLoadsSubtotal,
      demandVA: unitLoadsDemandVA,
      demandFactor: buildingDemandFactor,
      necReference: 'NEC Table 220.84',
    });

    // 1g. Common area loads
    // Use itemized loads if provided, otherwise use simple VA input
    let commonAreaConnectedVA = 0;
    let commonAreaDemandVA = 0;

    if (commonAreaLoads && commonAreaLoads.length > 0) {
      // Calculate itemized common area loads with proper NEC demand factors
      const commonAreaResult = calculateCommonAreaLoads(commonAreaLoads);
      commonAreaConnectedVA = commonAreaResult.totalConnectedVA;
      commonAreaDemandVA = commonAreaResult.totalDemandVA;

      // Add each itemized load to the breakdown
      for (const item of commonAreaResult.items) {
        breakdown.push(item);
      }
    } else if (commonAreaLoadVA > 0) {
      // Fall back to simple VA input (100% demand factor)
      commonAreaConnectedVA = commonAreaLoadVA;
      commonAreaDemandVA = commonAreaLoadVA;
      breakdown.push({
        category: 'Common Area Loads',
        description: 'Lighting, elevators, pool, etc. (100%)',
        connectedVA: commonAreaLoadVA,
        demandVA: commonAreaLoadVA,
        demandFactor: 1.0,
        necReference: 'NEC 220.84(B)',
      });
    }

    // Total building load (calculated method)
    totalConnectedVA = unitLoadsSubtotal + commonAreaConnectedVA;
    buildingDemandVA = unitLoadsDemandVA + commonAreaDemandVA;
  }
  const buildingLoadAmps = calculateAmps(buildingDemandVA, voltage, phase);

  // =========================================================================
  // STEP 2: Calculate EV Load per NEC 220.57
  // =========================================================================

  // EV charger load calculation per NEC 220.57(A)
  // Level 2 charger voltage depends on system (240V single-phase, 208V 3-phase)
  const evVoltage = phase === 3 ? 208 : 240;

  // Per NEC 220.57(A): each EVSE load = max(7,200 VA, nameplate rating)
  const perEVSELoad = calculatePerEVSELoad(evChargers.ampsPerCharger, evVoltage);
  const totalEVConnectedVA = perEVSELoad * evChargers.count;

  // IMPORTANT: NEC 220.57 does NOT provide demand factors for multiple EVSE!
  // - Without EVEMS: Use FULL connected EV load in service calculation
  // - With EVEMS (NEC 625.42): Size to EVEMS setpoint, treated as continuous
  //
  // The "evDemandVA" below represents the load for service/feeder sizing.
  // For the base calculation (no EVEMS), we use 100% of connected load.
  const evDemandFactor = 1.0; // No NEC-based demand factor for EV loads
  const evDemandVA = totalEVConnectedVA; // Full connected load per NEC 220.57
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

  // Per-EVSE amps in TWO reference frames:
  // 1. "EVSE amps" - the actual charger current at EV voltage (for charger specs)
  // 2. "Service-equivalent amps" - contribution to 3-phase service capacity
  //
  // For 3-phase systems: a single-phase 208V L-L EVSE draws current from two phases.
  // Its service-equivalent contribution is: VA / (√3 × V_service)
  // NOT: VA / V_evse (which would be the single-phase L-L current)
  const perEVSEAmpsAtCharger = perEVSELoad / evVoltage; // For charger spec display
  const perEVSEServiceEquivalentAmps = calculateAmps(perEVSELoad, voltage, phase); // For capacity calc

  // Scenario A: Without EVEMS (Direct Connection)
  // Per NEC 220.57: Each EVSE at full nameplate/7200VA, no demand factor
  // Use service-equivalent amps for capacity calculation
  const maxChargersNoEVEMS = availableCapacityAmps > 0
    ? Math.floor(availableCapacityAmps / perEVSEServiceEquivalentAmps)
    : 0;

  const noEVEMSScenario: EVCapacityScenario = {
    name: 'Direct Connection (No Load Management)',
    maxChargers: Math.max(0, maxChargersNoEVEMS),
    powerPerCharger_kW: perEVSELoad / 1000,
    notes: [
      'Per NEC 220.57: Each EVSE at full load (no demand factor)',
      `Per-EVSE load: ${(perEVSELoad / 1000).toFixed(1)} kVA (${Math.round(perEVSEAmpsAtCharger)}A @ ${evVoltage}V)`,
      `Service-equivalent: ${perEVSEServiceEquivalentAmps.toFixed(1)}A per EVSE @ ${voltage}V ${phase}φ`,
      `Available service capacity: ${Math.round(Math.max(0, availableCapacityAmps))}A`,
      maxChargersNoEVEMS >= evChargers.count
        ? `Can accommodate all ${evChargers.count} requested chargers`
        : `Maximum ${maxChargersNoEVEMS} chargers without service upgrade`,
    ],
    requiresServiceUpgrade: maxChargersNoEVEMS < evChargers.count,
    recommendedServiceAmps: maxChargersNoEVEMS < evChargers.count ? recommendedServiceAmps : undefined,
    estimatedCostLow: Math.max(0, Math.min(evChargers.count, maxChargersNoEVEMS)) * 800,
    estimatedCostHigh: Math.max(0, Math.min(evChargers.count, maxChargersNoEVEMS)) * 1500,
  };

  // Scenario B: With EVEMS (Automatic Load Management System) per NEC 625.42
  //
  // Per NEC 625.42: "An automatic load management system (ALMS) shall be
  // permitted to control EVSE loads... Where an ALMS is used, the feeder or
  // service demand load shall be permitted to be the maximum load permitted
  // by the ALMS."
  //
  // This means: Size feeder/service to the EVEMS SETPOINT, not the sum of all EVSE.
  // The setpoint becomes the "demand load" for service calculations.
  //
  // IMPORTANT: EVEMS only provides value when direct connection can't support
  // the requested chargers. If direct already works, EVEMS adds cost without benefit.

  const evemsEfficiencyFactor = 0.90; // 90% of theoretical capacity (system overhead, safety margin)
  const evemsSetpointAmps = Math.max(0, availableCapacityAmps) * evemsEfficiencyFactor;

  // Minimum viable charging: ~2.5 kW (12A @ 208V) provides ~8-10 miles/hour
  const minViableAmpsPerCharger = 12;

  // Maximum chargers EVEMS can support at minimum viable power
  const maxChargersWithEVEMSAtMinPower = evemsSetpointAmps > 0
    ? Math.floor(evemsSetpointAmps / minViableAmpsPerCharger)
    : 0;

  // Check if direct connection already supports all requested chargers
  const directAlreadySufficient = maxChargersNoEVEMS >= evChargers.count;

  // Calculate what power each charger gets when sharing the EVEMS setpoint
  // CRITICAL: Cap at the charger's physical maximum - EVEMS can't make a 32A charger output 48A!
  const perEVSEMaxKW = perEVSELoad / 1000; // Physical charger limit (e.g., 7.68 kW for 32A @ 240V)

  const actualChargersWithEVEMS = evChargers.count; // EVEMS can always support requested count (at reduced power)
  const theoreticalAmpsPerCharger = actualChargersWithEVEMS > 0
    ? evemsSetpointAmps / actualChargersWithEVEMS
    : 0;
  const theoreticalKWPerCharger = (evVoltage * theoreticalAmpsPerCharger) / 1000;

  // Cap at charger's physical maximum
  const actualKWPerChargerWithEVEMS = Math.min(perEVSEMaxKW, theoreticalKWPerCharger);
  const actualAmpsPerChargerWithEVEMS = (actualKWPerChargerWithEVEMS * 1000) / evVoltage;

  // EVEMS is beneficial only when it allows more chargers than direct, or when
  // direct can't support the requested count
  const evemsProvidesBenefit = !directAlreadySufficient ||
    maxChargersWithEVEMSAtMinPower > maxChargersNoEVEMS;

  // Build scenario notes based on whether EVEMS provides value
  const evemsNotes: string[] = [];
  if (directAlreadySufficient) {
    // Direct connection already works - EVEMS not needed
    evemsNotes.push(`Direct connection already supports all ${evChargers.count} chargers at full power`);
    evemsNotes.push(`EVEMS not required - adds cost without benefit in this scenario`);
    if (maxChargersWithEVEMSAtMinPower > maxChargersNoEVEMS) {
      evemsNotes.push(`EVEMS could support up to ${maxChargersWithEVEMSAtMinPower} chargers at ${minViableAmpsPerCharger}A minimum`);
    }
  } else {
    // EVEMS needed to support requested chargers
    evemsNotes.push(`EVEMS setpoint: ${Math.round(evemsSetpointAmps)}A (service demand load per NEC 625.42)`);
    if (actualKWPerChargerWithEVEMS >= perEVSEMaxKW * 0.99) {
      // Chargers can run at full power
      evemsNotes.push(`${actualChargersWithEVEMS} chargers at full power: ${perEVSEMaxKW.toFixed(1)} kW each`);
    } else {
      // Power sharing required
      evemsNotes.push(`${actualChargersWithEVEMS} chargers share capacity: ~${Math.round(actualAmpsPerChargerWithEVEMS)}A each (${actualKWPerChargerWithEVEMS.toFixed(1)} kW)`);
      evemsNotes.push(`Estimated charge rate: ~${Math.round(actualKWPerChargerWithEVEMS * 3)} mi/hr when all active`);
    }
    evemsNotes.push(`Max chargers at ${minViableAmpsPerCharger}A minimum: ${maxChargersWithEVEMSAtMinPower}`);
  }

  const withEVEMSScenario: EVCapacityScenario = {
    name: 'With EVEMS (NEC 625.42 Load Management)',
    maxChargers: directAlreadySufficient ? maxChargersWithEVEMSAtMinPower : actualChargersWithEVEMS,
    powerPerCharger_kW: actualKWPerChargerWithEVEMS,
    notes: evemsNotes,
    requiresServiceUpgrade: false, // EVEMS by definition avoids service upgrade
    recommendedServiceAmps: undefined,
    // Only show EVEMS cost if it provides value
    estimatedCostLow: evemsProvidesBenefit ? 15000 + actualChargersWithEVEMS * 800 : 0,
    estimatedCostHigh: evemsProvidesBenefit ? 35000 + actualChargersWithEVEMS * 1500 : 0,
  };

  // Scenario C: With service upgrade
  // Only calculate upgrade if actually needed - never recommend same or lower service size
  const minUpgradeServiceAmps = roundToStandardServiceSize(totalDemandAmps * 1.25);
  const actualUpgradeServiceAmps = Math.max(
    minUpgradeServiceAmps,
    existingServiceAmps + 100 // Ensure upgrade is at least one step up
  );
  // Find next standard size above existing
  const nextStandardSize = STANDARD_SERVICE_SIZES.find(size => size > existingServiceAmps) || actualUpgradeServiceAmps;
  const upgradeServiceAmps = Math.max(actualUpgradeServiceAmps, nextStandardSize);

  const upgradeCapacityVA = calculateServiceCapacityVA(upgradeServiceAmps, voltage, phase);
  const upgradeAvailableAmps = calculateAmps(upgradeCapacityVA - buildingDemandVA, voltage, phase);

  // Determine if this scenario is even relevant
  // Upgrade needed only if neither direct nor EVEMS can support all requested chargers
  const canEVEMSSupportAll = maxChargersWithEVEMSAtMinPower >= evChargers.count;
  const upgradeNeeded = !directAlreadySufficient && !canEVEMSSupportAll;

  const withUpgradeScenario: EVCapacityScenario = {
    name: 'With Service Upgrade',
    maxChargers: evChargers.count, // Can accommodate all requested chargers
    notes: upgradeNeeded ? [
      `Upgrade from ${existingServiceAmps}A to ${upgradeServiceAmps}A service`,
      `Available capacity after upgrade: ${Math.round(upgradeAvailableAmps)}A`,
      'Full power to all chargers simultaneously (no load sharing)',
      'Utility coordination required - contact utility before proceeding',
    ] : [
      'Service upgrade not required',
      `Existing ${existingServiceAmps}A service is adequate`,
      'Consider EVEMS for optimal charger utilization',
    ],
    requiresServiceUpgrade: upgradeNeeded,
    recommendedServiceAmps: upgradeNeeded ? upgradeServiceAmps : undefined,
    estimatedCostLow: upgradeNeeded ? 50000 + evChargers.count * 800 : 0,
    estimatedCostHigh: upgradeNeeded ? 150000 + evChargers.count * 1500 : 0,
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
  if (!useEVEMS && maxChargersNoEVEMS < evChargers.count && canEVEMSSupportAll) {
    recommendations.push(`EVEMS can accommodate all ${evChargers.count} chargers without service upgrade`);
  }

  const isCompliant = !upgradeRequired || upgradeType !== 'none';

  // =========================================================================
  // STEP 7: Cost Comparison
  // =========================================================================

  // Consistent cost comparison - use same charger counts as scenarios
  const costComparison = [
    {
      scenario: 'No Load Management',
      maxChargers: noEVEMSScenario.maxChargers,
      estimatedCostLow: noEVEMSScenario.estimatedCostLow || 0,
      estimatedCostHigh: noEVEMSScenario.estimatedCostHigh || 0,
    },
    {
      scenario: 'With EVEMS',
      maxChargers: withEVEMSScenario.maxChargers, // Already uses actualChargersWithEVEMS
      estimatedCostLow: withEVEMSScenario.estimatedCostLow || 0,
      estimatedCostHigh: withEVEMSScenario.estimatedCostHigh || 0,
    },
    ...(withUpgradeScenario.requiresServiceUpgrade ? [{
      scenario: 'Service Upgrade',
      maxChargers: evChargers.count,
      estimatedCostLow: withUpgradeScenario.estimatedCostLow || 0,
      estimatedCostHigh: withUpgradeScenario.estimatedCostHigh || 0,
    }] : []),
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
      loadDeterminationMethod: existingLoadMethod,
      measurementPeriod,
      utilityCompany,
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
