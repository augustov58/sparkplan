/**
 * Residential Load Calculation Service
 * Implements NEC Article 220 for Dwelling Units
 * 
 * NEC 220.82 - Standard Method for Single-Family Dwellings
 * NEC 220.83 - Existing Dwelling Units (not implemented)
 * NEC 220.84 - Multi-Family Dwellings
 */

import { ResidentialAppliances, DwellingUnitTemplate } from '../../types';

// ============================================================================
// NEC CONSTANTS AND TABLES
// ============================================================================

/** 
 * NEC Table 220.12 - General Lighting Loads by Occupancy
 * For dwelling units: 3 VA per square foot
 */
export const LIGHTING_LOAD_VA_PER_SQFT = 3;

/**
 * NEC 220.14(J) - Small Appliance Branch Circuits
 * 1,500 VA for each 2-wire small-appliance branch circuit
 */
export const SMALL_APPLIANCE_VA_PER_CIRCUIT = 1500;

/**
 * NEC 220.14(J) - Laundry Branch Circuit
 * 1,500 VA minimum for laundry circuit
 */
export const LAUNDRY_CIRCUIT_VA = 1500;

/**
 * NEC Table 220.42 - Lighting Load Demand Factors for Dwelling Units
 */
const LIGHTING_DEMAND_TABLE = [
  { upTo: 3000, factor: 1.00 },      // First 3,000 VA at 100%
  { upTo: 120000, factor: 0.35 },    // 3,001 to 120,000 VA at 35%
  { upTo: Infinity, factor: 0.25 }   // Over 120,000 VA at 25%
];

/**
 * NEC Table 220.55 - Demand Factors for Household Electric Ranges
 * Simplified for 12 kW and less
 */
const RANGE_DEMAND_FACTORS: Record<number, { demand: number; colA?: number; colB?: number; colC: number }> = {
  1: { demand: 8000, colC: 8000 },    // 1 range: 8 kW
  2: { demand: 11000, colC: 11000 },   // 2 ranges: 11 kW
  3: { demand: 14000, colC: 14000 },   // 3 ranges: 14 kW
  4: { demand: 17000, colC: 17000 },   // 4 ranges: 17 kW
  5: { demand: 20000, colC: 20000 },   // 5 ranges: 20 kW
};

/**
 * NEC Table 220.54 - Demand Factors for Household Electric Clothes Dryers
 */
const DRYER_DEMAND_TABLE = [
  { count: 1, factor: 1.00 },
  { count: 2, factor: 1.00 },
  { count: 3, factor: 1.00 },
  { count: 4, factor: 1.00 },
  { count: 5, factor: 0.80 },
  { count: 6, factor: 0.80 },
  { count: 7, factor: 0.80 },
  { count: 8, factor: 0.70 },
  { count: 9, factor: 0.70 },
  { count: 10, factor: 0.70 },
  { count: 11, factor: 0.65 },
];

/**
 * NEC Table 220.84 - Multi-Family Dwelling Demand Factors
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

// ============================================================================
// INTERFACES
// ============================================================================

export interface LoadBreakdown {
  category: string;
  description: string;
  connectedVA: number;
  demandVA: number;
  demandFactor: number;
  necReference: string;
}

export interface ResidentialLoadResult {
  // Summary
  totalConnectedVA: number;
  totalDemandVA: number;
  demandFactor: number;

  // Service sizing
  serviceAmps: number;
  recommendedServiceSize: number;

  // Neutral conductor sizing (NEC 220.61)
  neutralLoadVA: number;
  neutralAmps: number;
  neutralReduction: number;  // Percentage reduction applied (0-30%)

  // Recommended conductor sizes
  serviceConductorSize?: string;  // Ungrounded conductors
  neutralConductorSize?: string;  // Grounded (neutral) conductor
  gecSize?: string;              // Grounding electrode conductor

  // Breakdown
  breakdown: LoadBreakdown[];

  // NEC References
  necReferences: string[];

  // Warnings
  warnings: string[];
}

export interface SingleFamilyInput {
  squareFootage: number;
  smallApplianceCircuits: number;
  laundryCircuit: boolean;
  appliances: ResidentialAppliances;
  serviceVoltage?: number;  // Default 240V
}

export interface MultiFamilyInput {
  unitTemplates: DwellingUnitTemplate[];
  housePanelLoad?: number;  // Common area loads (parking, laundry, etc.)
  serviceVoltage?: number;  // Default 240V
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Apply tiered demand factor (like lighting demand)
 */
function applyTieredDemand(totalVA: number, table: { upTo: number; factor: number }[]): number {
  let demandVA = 0;
  let remaining = totalVA;
  let previousLimit = 0;

  for (const tier of table) {
    const tierSize = tier.upTo - previousLimit;
    const vaInTier = Math.min(remaining, tierSize);
    demandVA += vaInTier * tier.factor;
    remaining -= vaInTier;
    previousLimit = tier.upTo;
    if (remaining <= 0) break;
  }

  return Math.round(demandVA);
}

/**
 * Get multi-family demand factor based on number of units
 */
function getMultiFamilyDemandFactor(unitCount: number): number {
  if (unitCount <= 2) return 1.0; // No reduction for 1-2 units
  
  for (const entry of MULTI_FAMILY_DEMAND_TABLE) {
    if (unitCount <= entry.units) {
      return entry.factor;
    }
  }
  return 0.23; // 62+ units
}

/**
 * Get dryer demand factor based on count
 */
function getDryerDemandFactor(count: number): number {
  if (count <= 0) return 0;
  if (count > 11) return 0.65;
  return DRYER_DEMAND_TABLE.find(d => d.count === count)?.factor || 1.0;
}

/**
 * Calculate motor HP to VA (approximate)
 * 1 HP ≈ 746 VA, but we use NEC Table 430.248 values
 */
function hpToVA(hp: number): number {
  // Simplified: use 1000 VA per HP for single-phase 240V
  return hp * 1000;
}

/**
 * Standard service entrance equipment sizes (commercially available)
 * Per NEC 230.79 and standard manufacturer offerings
 */
const STANDARD_SERVICE_SIZES = [
  100, 125, 150, 200, 225, 400, 600, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000
];

/**
 * Recommend service size based on calculated amps.
 * Returns the smallest standard service size that can handle the load
 * at 80% continuous rating (NEC 215.3, 230.42).
 */
function recommendServiceSize(amps: number): number {
  // Find smallest standard size where 80% of the rating >= calculated amps
  for (const size of STANDARD_SERVICE_SIZES) {
    if (size * 0.8 >= amps) return size;
  }
  return STANDARD_SERVICE_SIZES[STANDARD_SERVICE_SIZES.length - 1]!; // 4000A max
}

/**
 * Calculate neutral load per NEC 220.61 and 220.82
 *
 * For dwelling units:
 * - Neutral load = loads that use the neutral conductor
 * - 240V-only loads (no neutral) are excluded (range, dryer, A/C, water heater when 240V)
 * - First 200A at 100%, remainder at 70%
 *
 * @param breakdown - Load breakdown array
 * @param serviceVoltage - Service voltage (typically 240V)
 * @returns Neutral load info with VA, amps, and reduction percentage
 */
function calculateNeutralLoad(
  breakdown: LoadBreakdown[],
  serviceVoltage: number
): { neutralVA: number; neutralAmps: number; reductionPercent: number } {
  // Categories that use neutral (120V loads or 240V with neutral)
  const neutralCategories = [
    'General Loads Subtotal',  // Lighting, small appliance, laundry
    'Dishwasher',
    'Garbage Disposal',
    'HVAC',  // Some HVAC uses neutral for controls
  ];

  // Categories that DON'T use neutral (240V-only)
  const nonNeutralCategories = [
    'Electric Range',
    'Electric Dryer',
    'Electric Water Heater',
    'EV Charger',
    'Pool Pump',
    'Pool Heater',
    'Hot Tub/Spa',
    'Well Pump'
  ];

  // Calculate neutral demand
  let neutralDemandVA = 0;

  for (const item of breakdown) {
    if (neutralCategories.includes(item.category)) {
      neutralDemandVA += item.demandVA;
    } else if (!nonNeutralCategories.includes(item.category) && !item.category.includes('Demand Factor')) {
      // For 'Other Appliance' or unknown categories, assume they use neutral (conservative)
      neutralDemandVA += item.demandVA;
    }
  }

  // NEC 220.61(B) - Dwelling Unit Neutral Load Reduction
  // First 200A at 100%, remainder at 70%
  const neutralAmpsBeforeReduction = neutralDemandVA / serviceVoltage;

  let neutralAmps: number;
  let reductionPercent: number;

  if (neutralAmpsBeforeReduction <= 200) {
    // No reduction for loads ≤200A
    neutralAmps = neutralAmpsBeforeReduction;
    reductionPercent = 0;
  } else {
    // Apply 70% to portion over 200A (30% reduction)
    const first200A = 200;
    const over200A = neutralAmpsBeforeReduction - 200;
    neutralAmps = first200A + (over200A * 0.70);
    reductionPercent = 30;
  }

  return {
    neutralVA: Math.round(neutralAmps * serviceVoltage),
    neutralAmps: Math.round(neutralAmps * 10) / 10,
    reductionPercent
  };
}

/**
 * Recommend service conductor size based on ampacity (NEC Table 310.12)
 * Residential services ≤400A use Table 310.12
 *
 * This is simplified - actual sizing should use ConductorSizingTool
 * for temperature/bundling corrections
 */
function recommendServiceConductorSize(amps: number, material: 'Cu' | 'Al' = 'Cu'): string {
  // NEC Table 310.12 - Service Conductor Sizing (75°C column)
  const serviceConductorTable: { amps: number; Cu: string; Al: string }[] = [
    { amps: 100, Cu: '1 AWG', Al: '1/0 AWG' },
    { amps: 110, Cu: '1/0 AWG', Al: '2/0 AWG' },
    { amps: 125, Cu: '1/0 AWG', Al: '2/0 AWG' },
    { amps: 150, Cu: '2/0 AWG', Al: '3/0 AWG' },
    { amps: 175, Cu: '2/0 AWG', Al: '4/0 AWG' },
    { amps: 200, Cu: '3/0 AWG', Al: '4/0 AWG' },
    { amps: 225, Cu: '3/0 AWG', Al: '250 kcmil' },
    { amps: 250, Cu: '4/0 AWG', Al: '300 kcmil' },
    { amps: 300, Cu: '250 kcmil', Al: '350 kcmil' },
    { amps: 350, Cu: '350 kcmil', Al: '500 kcmil' },
    { amps: 400, Cu: '400 kcmil', Al: '600 kcmil' },
  ];

  for (const entry of serviceConductorTable) {
    if (amps <= entry.amps) {
      return material === 'Cu' ? entry.Cu : entry.Al;
    }
  }

  return material === 'Cu' ? '600 kcmil' : '750 kcmil';
}

/**
 * Recommend grounding electrode conductor (GEC) size per NEC 250.66
 * Based on service conductor size
 */
function recommendGecSize(serviceConductorSize: string, material: 'Cu' | 'Al' = 'Cu'): string {
  // NEC Table 250.66 - Grounding Electrode Conductor Size
  const gecTable: { serviceConductor: string; Cu: string; Al: string }[] = [
    { serviceConductor: '2 AWG or smaller', Cu: '8 AWG', Al: '6 AWG' },
    { serviceConductor: '1 AWG or 1/0 AWG', Cu: '6 AWG', Al: '4 AWG' },
    { serviceConductor: '2/0 or 3/0 AWG', Cu: '4 AWG', Al: '2 AWG' },
    { serviceConductor: '4/0 AWG to 350 kcmil', Cu: '2 AWG', Al: '1/0 AWG' },
    { serviceConductor: '400 to 600 kcmil', Cu: '1/0 AWG', Al: '3/0 AWG' },
    { serviceConductor: '650 to 1100 kcmil', Cu: '2/0 AWG', Al: '4/0 AWG' },
  ];

  // Simple lookup - this is a simplified version
  // Actual implementation should parse conductor size and match ranges
  const sizeMap: Record<string, number> = {
    '8 AWG': 8, '6 AWG': 6, '4 AWG': 4, '3 AWG': 3, '2 AWG': 2, '1 AWG': 1,
    '1/0 AWG': 0, '2/0 AWG': -1, '3/0 AWG': -2, '4/0 AWG': -3,
    '250 kcmil': -4, '300 kcmil': -5, '350 kcmil': -6, '400 kcmil': -7,
    '500 kcmil': -8, '600 kcmil': -9, '750 kcmil': -10, '1000 kcmil': -11
  };

  const sizeNum = sizeMap[serviceConductorSize] || 0;

  if (sizeNum >= 2) return material === 'Cu' ? '8 AWG' : '6 AWG';
  if (sizeNum >= 0) return material === 'Cu' ? '6 AWG' : '4 AWG';
  if (sizeNum >= -2) return material === 'Cu' ? '4 AWG' : '2 AWG';
  if (sizeNum >= -6) return material === 'Cu' ? '2 AWG' : '1/0 AWG';
  if (sizeNum >= -9) return material === 'Cu' ? '1/0 AWG' : '3/0 AWG';
  return material === 'Cu' ? '2/0 AWG' : '4/0 AWG';
}

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

/**
 * NEC 220.82 - Standard Method for Single-Family Dwellings
 */
export function calculateSingleFamilyLoad(input: SingleFamilyInput): ResidentialLoadResult {
  const { 
    squareFootage, 
    smallApplianceCircuits, 
    laundryCircuit, 
    appliances,
    serviceVoltage = 240
  } = input;

  const breakdown: LoadBreakdown[] = [];
  const necReferences: string[] = ['NEC 220.82 - Standard Method'];
  const warnings: string[] = [];

  // =========================================
  // Step 1: General Lighting Load (3 VA/sq ft)
  // =========================================
  const lightingConnectedVA = squareFootage * LIGHTING_LOAD_VA_PER_SQFT;
  
  // =========================================
  // Step 2: Small Appliance Circuits (1,500 VA each, min 2)
  // =========================================
  const effectiveSmallAppliance = Math.max(2, smallApplianceCircuits);
  const smallApplianceVA = effectiveSmallAppliance * SMALL_APPLIANCE_VA_PER_CIRCUIT;
  if (smallApplianceCircuits < 2) {
    warnings.push('Minimum 2 small appliance circuits required per NEC 210.11(C)(1)');
  }

  // =========================================
  // Step 3: Laundry Circuit
  // =========================================
  const laundryVA = laundryCircuit ? LAUNDRY_CIRCUIT_VA : 0;
  if (!laundryCircuit) {
    warnings.push('Laundry circuit required per NEC 210.11(C)(2)');
  }

  // =========================================
  // Step 4: Apply Demand to General Lighting + SA + Laundry
  // Per NEC 220.82(B)(1)
  // =========================================
  const generalLoadsTotal = lightingConnectedVA + smallApplianceVA + laundryVA;
  const generalLoadsDemand = applyTieredDemand(generalLoadsTotal, LIGHTING_DEMAND_TABLE);
  
  breakdown.push({
    category: 'General Lighting',
    description: `${squareFootage} sq ft @ 3 VA/sq ft`,
    connectedVA: lightingConnectedVA,
    demandVA: 0, // Combined below
    demandFactor: 0,
    necReference: 'NEC Table 220.12'
  });
  
  breakdown.push({
    category: 'Small Appliance Circuits',
    description: `${effectiveSmallAppliance} circuits @ 1,500 VA each`,
    connectedVA: smallApplianceVA,
    demandVA: 0,
    demandFactor: 0,
    necReference: 'NEC 220.52(A)'
  });

  if (laundryCircuit) {
    breakdown.push({
      category: 'Laundry Circuit',
      description: '1 circuit @ 1,500 VA',
      connectedVA: laundryVA,
      demandVA: 0,
      demandFactor: 0,
      necReference: 'NEC 220.52(B)'
    });
  }

  // Combined general loads entry
  breakdown.push({
    category: 'General Loads Subtotal',
    description: 'Lighting + Small Appliance + Laundry',
    connectedVA: generalLoadsTotal,
    demandVA: generalLoadsDemand,
    demandFactor: generalLoadsDemand / generalLoadsTotal,
    necReference: 'NEC Table 220.42'
  });

  let totalConnected = generalLoadsTotal;
  let totalDemand = generalLoadsDemand;

  // =========================================
  // Step 5: Appliances at 100% (NEC 220.82(B)(2))
  // =========================================

  // Range/Cooktop
  if (appliances.range?.enabled && appliances.range.type === 'electric') {
    const rangeVA = appliances.range.kw * 1000;
    // For single range <= 12 kW, use 8 kW
    const rangeDemand = rangeVA <= 12000 ? Math.max(8000, rangeVA * 0.8) : rangeVA;
    breakdown.push({
      category: 'Electric Range',
      description: `${appliances.range.kw} kW`,
      connectedVA: rangeVA,
      demandVA: rangeDemand,
      demandFactor: rangeDemand / rangeVA,
      necReference: 'NEC Table 220.55'
    });
    totalConnected += rangeVA;
    totalDemand += rangeDemand;
    necReferences.push('NEC Table 220.55');
  }

  // Dryer
  if (appliances.dryer?.enabled && appliances.dryer.type === 'electric') {
    const dryerVA = Math.max(appliances.dryer.kw * 1000, 5000); // Min 5 kW
    breakdown.push({
      category: 'Electric Dryer',
      description: `${appliances.dryer.kw} kW (min 5 kW)`,
      connectedVA: dryerVA,
      demandVA: dryerVA, // 100% for single dryer
      demandFactor: 1.0,
      necReference: 'NEC 220.54'
    });
    totalConnected += dryerVA;
    totalDemand += dryerVA;
  }

  // Water Heater
  if (appliances.waterHeater?.enabled && appliances.waterHeater.type === 'electric') {
    const whVA = appliances.waterHeater.kw * 1000;
    breakdown.push({
      category: 'Electric Water Heater',
      description: `${appliances.waterHeater.kw} kW`,
      connectedVA: whVA,
      demandVA: whVA,
      demandFactor: 1.0,
      necReference: 'NEC 220.82(C)(3)'
    });
    totalConnected += whVA;
    totalDemand += whVA;
  }

  // =========================================
  // Step 6: HVAC - Non-coincident Loads (NEC 220.60)
  // Use largest of heating or cooling
  // =========================================
  if (appliances.hvac?.enabled) {
    const coolingVA = (appliances.hvac.coolingKw || 0) * 1000;
    const heatingVA = (appliances.hvac.heatingKw || 0) * 1000;
    
    // Only electric heat counts if it's actually electric
    const isElectricHeat = appliances.hvac.type === 'electric_heat' || appliances.hvac.type === 'heat_pump';
    const effectiveHeating = isElectricHeat ? heatingVA : 0;
    
    // Use larger of A/C or electric heat (non-coincident per NEC 220.60)
    const hvacConnected = Math.max(coolingVA, effectiveHeating);
    const hvacDemand = hvacConnected;
    
    if (hvacConnected > 0) {
      const hvacType = coolingVA > effectiveHeating ? 'A/C' : 'Electric Heat';
      breakdown.push({
        category: 'HVAC',
        description: `${hvacType} ${(hvacConnected / 1000).toFixed(1)} kW (larger of heat/cool)`,
        connectedVA: Math.max(coolingVA, effectiveHeating, coolingVA + effectiveHeating),
        demandVA: hvacDemand,
        demandFactor: 1.0,
        necReference: 'NEC 220.60'
      });
      totalConnected += hvacConnected;
      totalDemand += hvacDemand;
      necReferences.push('NEC 220.60 - Non-coincident Loads');
    }
  }

  // =========================================
  // Step 7: Other Fixed Appliances at 100%
  // =========================================
  
  // Dishwasher
  if (appliances.dishwasher?.enabled) {
    const dwVA = appliances.dishwasher.kw * 1000;
    breakdown.push({
      category: 'Dishwasher',
      description: `${appliances.dishwasher.kw} kW`,
      connectedVA: dwVA,
      demandVA: dwVA,
      demandFactor: 1.0,
      necReference: 'NEC 220.82(B)(2)'
    });
    totalConnected += dwVA;
    totalDemand += dwVA;
  }

  // Garbage Disposal
  if (appliances.disposal?.enabled) {
    const dispVA = appliances.disposal.kw * 1000;
    breakdown.push({
      category: 'Garbage Disposal',
      description: `${appliances.disposal.kw} kW`,
      connectedVA: dispVA,
      demandVA: dispVA,
      demandFactor: 1.0,
      necReference: 'NEC 220.82(B)(2)'
    });
    totalConnected += dispVA;
    totalDemand += dispVA;
  }

  // EV Charger
  if (appliances.evCharger?.enabled) {
    const evVA = appliances.evCharger.kw * 1000;
    breakdown.push({
      category: 'EV Charger',
      description: `Level ${appliances.evCharger.level} - ${appliances.evCharger.kw} kW`,
      connectedVA: evVA,
      demandVA: evVA,
      demandFactor: 1.0,
      necReference: 'NEC 625.42'
    });
    totalConnected += evVA;
    totalDemand += evVA;
    necReferences.push('NEC Article 625 - EV Charging');
  }

  // Pool Pump
  if (appliances.poolPump?.enabled) {
    const poolPumpVA = hpToVA(appliances.poolPump.hp);
    breakdown.push({
      category: 'Pool Pump',
      description: `${appliances.poolPump.hp} HP motor`,
      connectedVA: poolPumpVA,
      demandVA: poolPumpVA,
      demandFactor: 1.0,
      necReference: 'NEC 680.22'
    });
    totalConnected += poolPumpVA;
    totalDemand += poolPumpVA;
  }

  // Pool Heater
  if (appliances.poolHeater?.enabled) {
    const poolHeatVA = appliances.poolHeater.kw * 1000;
    breakdown.push({
      category: 'Pool Heater',
      description: `${appliances.poolHeater.kw} kW`,
      connectedVA: poolHeatVA,
      demandVA: poolHeatVA,
      demandFactor: 1.0,
      necReference: 'NEC 680.22'
    });
    totalConnected += poolHeatVA;
    totalDemand += poolHeatVA;
  }

  // Hot Tub/Spa
  if (appliances.hotTub?.enabled) {
    const hotTubVA = appliances.hotTub.kw * 1000;
    breakdown.push({
      category: 'Hot Tub/Spa',
      description: `${appliances.hotTub.kw} kW`,
      connectedVA: hotTubVA,
      demandVA: hotTubVA,
      demandFactor: 1.0,
      necReference: 'NEC 680.44'
    });
    totalConnected += hotTubVA;
    totalDemand += hotTubVA;
  }

  // Well Pump
  if (appliances.wellPump?.enabled) {
    const wellPumpVA = hpToVA(appliances.wellPump.hp);
    breakdown.push({
      category: 'Well Pump',
      description: `${appliances.wellPump.hp} HP motor`,
      connectedVA: wellPumpVA,
      demandVA: wellPumpVA,
      demandFactor: 1.0,
      necReference: 'NEC 220.82(B)(2)'
    });
    totalConnected += wellPumpVA;
    totalDemand += wellPumpVA;
  }

  // Other Custom Appliances
  if (appliances.otherAppliances?.length) {
    for (const other of appliances.otherAppliances) {
      const otherVA = other.kw * 1000;
      breakdown.push({
        category: 'Other Appliance',
        description: `${other.description} - ${other.kw} kW`,
        connectedVA: otherVA,
        demandVA: otherVA,
        demandFactor: 1.0,
        necReference: 'NEC 220.82(B)(2)'
      });
      totalConnected += otherVA;
      totalDemand += otherVA;
    }
  }

  // =========================================
  // Calculate Service Size
  // =========================================
  const serviceAmps = totalDemand / serviceVoltage;
  const recommendedSize = recommendServiceSize(serviceAmps);

  // =========================================
  // Calculate Neutral Load (NEC 220.61, 220.82)
  // =========================================
  const neutralLoad = calculateNeutralLoad(breakdown, serviceVoltage);
  if (neutralLoad.reductionPercent > 0) {
    necReferences.push('NEC 220.61(B) - Neutral Load Reduction');
    warnings.push(
      `ℹ️ Neutral load reduced by ${neutralLoad.reductionPercent}% per NEC 220.61(B) ` +
      `(first 200A at 100%, remainder at 70%)`
    );
  }

  // =========================================
  // Recommend Conductor Sizes (Copper assumed)
  // =========================================
  const serviceConductorSize = recommendServiceConductorSize(serviceAmps, 'Cu');
  const neutralConductorSize = recommendServiceConductorSize(neutralLoad.neutralAmps, 'Cu');
  const gecSize = recommendGecSize(serviceConductorSize, 'Cu');

  necReferences.push('NEC Table 310.12 - Service Conductor Sizing');
  necReferences.push('NEC 250.66 - Grounding Electrode Conductor');

  return {
    totalConnectedVA: Math.round(totalConnected),
    totalDemandVA: Math.round(totalDemand),
    demandFactor: totalDemand / totalConnected,
    serviceAmps: Math.round(serviceAmps),
    recommendedServiceSize: recommendedSize,
    neutralLoadVA: neutralLoad.neutralVA,
    neutralAmps: neutralLoad.neutralAmps,
    neutralReduction: neutralLoad.reductionPercent,
    serviceConductorSize,
    neutralConductorSize,
    gecSize,
    breakdown,
    necReferences: [...new Set(necReferences)],
    warnings
  };
}

/**
 * NEC 220.84 - Multi-Family Dwellings Optional Calculation
 * Only for buildings with 3+ dwelling units where each unit has:
 * - Electric cooking equipment or space heating (or both)
 *
 * IMPORTANT: NEC 220.84 uses CONNECTED loads at nameplate rating.
 * Do NOT apply individual reductions from 220.55 (range), 220.42 (lighting
 * tiers), or 220.54 (dryer). The single Table 220.84 demand factor replaces
 * all of those. This matches the methodology in multiFamilyEV.ts.
 */
export function calculateMultiFamilyLoad(input: MultiFamilyInput): ResidentialLoadResult {
  const { unitTemplates, housePanelLoad = 0, serviceVoltage = 240 } = input;

  const breakdown: LoadBreakdown[] = [];
  const necReferences: string[] = ['NEC 220.84 - Multi-Family Optional Method'];
  const warnings: string[] = [];

  const totalUnits = unitTemplates.reduce((sum, t) => sum + t.unitCount, 0);

  if (totalUnits < 3) {
    warnings.push('NEC 220.84 requires minimum 3 dwelling units. Use standard method (220.82) for each unit.');
  }

  // =========================================================================
  // Step 1: Per-unit panel sizing (still uses 220.82 for individual panels)
  // Each dwelling unit panel is sized per the standard method — only the
  // BUILDING SERVICE total uses the 220.84 optional method.
  // =========================================================================
  for (const template of unitTemplates) {
    const unitLoad = calculateSingleFamilyLoad({
      squareFootage: template.squareFootage,
      smallApplianceCircuits: 2,
      laundryCircuit: true,
      appliances: template.appliances,
      serviceVoltage
    });
    template.calculatedLoadVA = unitLoad.totalDemandVA;
    template.panelSize = recommendServiceSize(unitLoad.serviceAmps);
  }

  // =========================================================================
  // Step 2: Building service load using NEC 220.84 Optional Method
  //
  // All unit loads are taken at NAMEPLATE (connected) values. The single
  // Table 220.84 demand factor is applied once to the total. This is the
  // same methodology used by the MF EV Calculator (multiFamilyEV.ts).
  // =========================================================================

  // 2a. General lighting (3 VA/sq ft per NEC 220.12 — no tiered 220.42 reduction)
  let totalLightingVA = 0;
  for (const template of unitTemplates) {
    totalLightingVA += template.squareFootage * LIGHTING_LOAD_VA_PER_SQFT * template.unitCount;
  }
  breakdown.push({
    category: 'General Lighting',
    description: `${totalUnits} units @ 3 VA/sq ft`,
    connectedVA: totalLightingVA,
    demandVA: totalLightingVA,
    demandFactor: 1.0,
    necReference: 'NEC Table 220.12'
  });

  // 2b. Small appliance circuits (2 per unit @ 1,500 VA each)
  const totalSmallApplianceVA = totalUnits * 2 * SMALL_APPLIANCE_VA_PER_CIRCUIT;
  breakdown.push({
    category: 'Small Appliance Circuits',
    description: `${totalUnits} units × 2 circuits × 1,500 VA`,
    connectedVA: totalSmallApplianceVA,
    demandVA: totalSmallApplianceVA,
    demandFactor: 1.0,
    necReference: 'NEC 220.52(A)'
  });

  // 2c. Laundry circuits (1 per unit @ 1,500 VA)
  const totalLaundryVA = totalUnits * LAUNDRY_CIRCUIT_VA;
  breakdown.push({
    category: 'Laundry Circuits',
    description: `${totalUnits} units × 1,500 VA`,
    connectedVA: totalLaundryVA,
    demandVA: totalLaundryVA,
    demandFactor: 1.0,
    necReference: 'NEC 220.52(B)'
  });

  // 2d. Appliance loads at NAMEPLATE (no 220.55 / 220.54 reductions)
  // Per NEC 220.84(C)(3): cooking equipment at nameplate, not per Table 220.55
  // Per NEC 220.84(C)(4): electric heat at 65%
  // Per NEC 220.60: non-coincident heating/cooling — use the larger
  let totalApplianceVA = 0;
  for (const template of unitTemplates) {
    const app = template.appliances;
    let unitApplianceVA = 0;

    // Range at nameplate per 220.84(C)(3) — NOT reduced per 220.55
    if (app.range?.enabled && app.range.type === 'electric') {
      unitApplianceVA += app.range.kw * 1000;
    }

    // Dryer at nameplate (min 5 kW per NEC 220.54) — NOT demand-factored
    if (app.dryer?.enabled && app.dryer.type === 'electric') {
      unitApplianceVA += Math.max(app.dryer.kw * 1000, 5000);
    }

    // Water heater at nameplate
    if (app.waterHeater?.enabled && app.waterHeater.type === 'electric') {
      unitApplianceVA += app.waterHeater.kw * 1000;
    }

    // Kitchen appliances at nameplate
    if (app.dishwasher?.enabled) unitApplianceVA += app.dishwasher.kw * 1000;
    if (app.disposal?.enabled) unitApplianceVA += app.disposal.kw * 1000;
    if (app.microwave?.enabled) unitApplianceVA += app.microwave.kw * 1000;

    // HVAC: non-coincident per NEC 220.60 (use larger of heating / cooling)
    // Electric heat at 65% per NEC 220.84(C)(4)
    if (app.hvac?.enabled) {
      const coolingVA = (app.hvac.coolingKw || 0) * 1000;
      const isElectricHeat = app.hvac.type === 'heat_pump' || app.hvac.type === 'electric_heat';
      const heatingVA = isElectricHeat ? (app.hvac.heatingKw || 0) * 1000 * 0.65 : 0;
      unitApplianceVA += Math.max(coolingVA, heatingVA); // Non-coincident
    }

    // EV charger at nameplate
    if (app.evCharger?.enabled) unitApplianceVA += app.evCharger.kw * 1000;

    // Pool / hot tub / sauna
    if (app.poolPump?.enabled) unitApplianceVA += hpToVA(app.poolPump.hp);
    if (app.poolHeater?.enabled) unitApplianceVA += app.poolHeater.kw * 1000;
    if (app.hotTub?.enabled) unitApplianceVA += app.hotTub.kw * 1000;
    if (app.sauna?.enabled) unitApplianceVA += app.sauna.kw * 1000;
    if (app.wellPump?.enabled) unitApplianceVA += hpToVA(app.wellPump.hp);

    // Other / custom appliances
    if (app.otherAppliances) {
      for (const other of app.otherAppliances) {
        unitApplianceVA += other.kw * 1000;
      }
    }

    totalApplianceVA += unitApplianceVA * template.unitCount;
  }

  if (totalApplianceVA > 0) {
    breakdown.push({
      category: 'Appliance Loads (Nameplate)',
      description: 'Range, dryer, water heater, HVAC, etc. at nameplate per 220.84',
      connectedVA: totalApplianceVA,
      demandVA: totalApplianceVA,
      demandFactor: 1.0,
      necReference: 'NEC 220.84(C)'
    });
  }

  // 2e. Total unit loads — apply single NEC 220.84 demand factor
  const unitLoadsSubtotal = totalLightingVA + totalSmallApplianceVA + totalLaundryVA + totalApplianceVA;
  const demandFactor = getMultiFamilyDemandFactor(totalUnits);
  const totalDemandWithDF = unitLoadsSubtotal * demandFactor;

  breakdown.push({
    category: 'Multi-Family Demand Factor',
    description: `${totalUnits} units @ ${(demandFactor * 100).toFixed(0)}%`,
    connectedVA: unitLoadsSubtotal,
    demandVA: totalDemandWithDF,
    demandFactor: demandFactor,
    necReference: 'NEC Table 220.84'
  });

  // 2f. House panel loads (common areas) at 100% — added AFTER demand factor
  let totalConnected = unitLoadsSubtotal;
  if (housePanelLoad > 0) {
    breakdown.push({
      category: 'House/Common Loads',
      description: 'Parking, laundry, common areas',
      connectedVA: housePanelLoad,
      demandVA: housePanelLoad,
      demandFactor: 1.0,
      necReference: 'NEC 220.84(B)'
    });
    totalConnected += housePanelLoad;
  }

  const finalDemand = totalDemandWithDF + housePanelLoad;

  // =========================================================================
  // Step 3: Service sizing and conductors
  // =========================================================================
  const serviceAmps = finalDemand / serviceVoltage;
  const recommendedSize = recommendServiceSize(serviceAmps);

  // Neutral load (NEC 220.61)
  const neutralLoad = calculateNeutralLoad(breakdown, serviceVoltage);
  if (neutralLoad.reductionPercent > 0) {
    necReferences.push('NEC 220.61(B) - Neutral Load Reduction');
    warnings.push(
      `ℹ️ Neutral load reduced by ${neutralLoad.reductionPercent}% per NEC 220.61(B) ` +
      `(first 200A at 100%, remainder at 70%)`
    );
  }

  // Conductor sizing (Copper assumed)
  const serviceConductorSize = recommendServiceConductorSize(serviceAmps, 'Cu');
  const neutralConductorSize = recommendServiceConductorSize(neutralLoad.neutralAmps, 'Cu');
  const gecSize = recommendGecSize(serviceConductorSize, 'Cu');

  necReferences.push('NEC Table 310.12 - Service Conductor Sizing');
  necReferences.push('NEC 250.66 - Grounding Electrode Conductor');

  return {
    totalConnectedVA: Math.round(totalConnected),
    totalDemandVA: Math.round(finalDemand),
    demandFactor: totalConnected > 0 ? finalDemand / totalConnected : 1,
    serviceAmps: Math.round(serviceAmps),
    recommendedServiceSize: recommendedSize,
    neutralLoadVA: neutralLoad.neutralVA,
    neutralAmps: neutralLoad.neutralAmps,
    neutralReduction: neutralLoad.reductionPercent,
    serviceConductorSize,
    neutralConductorSize,
    gecSize,
    breakdown,
    necReferences,
    warnings
  };
}

// ============================================================================
// PANEL SCHEDULE AUTO-GENERATION
// ============================================================================

export interface GeneratedCircuit {
  description: string;
  breakerAmps: number;
  pole: 1 | 2;
  loadWatts: number;
  loadType: 'L' | 'R' | 'M' | 'K' | 'H' | 'C' | 'W' | 'D' | 'O';
  necReference: string;
}

/**
 * Generate a residential panel schedule based on dwelling characteristics
 */
export function generateResidentialPanelSchedule(input: SingleFamilyInput): GeneratedCircuit[] {
  const circuits: GeneratedCircuit[] = [];
  const { squareFootage, smallApplianceCircuits, laundryCircuit, appliances } = input;

  // General Lighting circuits - MUST NOT EXCEED CIRCUIT CAPACITY
  // NEC 210.70: General lighting
  // 15A × 120V = 1,800 VA max capacity
  // Use 1,500 VA per circuit for safety margin (83% capacity)
  const totalLightingVA = squareFootage * 3; // NEC 220.12: 3 VA/sq ft
  const MAX_VA_PER_15A_CIRCUIT = 1500; // Safe loading (not exceeding 1,800 VA)
  const lightingCircuits = Math.ceil(totalLightingVA / MAX_VA_PER_15A_CIRCUIT);
  const lightingVAPerCircuit = Math.ceil(totalLightingVA / lightingCircuits);

  for (let i = 1; i <= lightingCircuits; i++) {
    circuits.push({
      description: `Lighting Circuit ${i}`,
      breakerAmps: 15,
      pole: 1,
      loadWatts: lightingVAPerCircuit,
      loadType: 'L',
      necReference: 'NEC 210.70'
    });
  }

  // Small Appliance Circuits (kitchen)
  for (let i = 1; i <= Math.max(2, smallApplianceCircuits); i++) {
    circuits.push({
      description: `Kitchen Small Appliance ${i}`,
      breakerAmps: 20,
      pole: 1,
      loadWatts: 1500,
      loadType: 'R',
      necReference: 'NEC 210.52(B)'
    });
  }

  // Laundry Circuit
  if (laundryCircuit) {
    circuits.push({
      description: 'Laundry',
      breakerAmps: 20,
      pole: 1,
      loadWatts: 1500,
      loadType: 'R',
      necReference: 'NEC 210.52(F)'
    });
  }

  // Bathroom Circuit(s)
  circuits.push({
    description: 'Bathroom Receptacles',
    breakerAmps: 20,
    pole: 1,
    loadWatts: 1500,
    loadType: 'R',
    necReference: 'NEC 210.11(C)(3)'
  });

  // Garage/Accessory
  circuits.push({
    description: 'Garage Receptacles',
    breakerAmps: 20,
    pole: 1,
    loadWatts: 1500,
    loadType: 'R',
    necReference: 'NEC 210.52(G)'
  });

  // Outdoor Receptacle
  circuits.push({
    description: 'Outdoor Receptacles',
    breakerAmps: 20,
    pole: 1,
    loadWatts: 180,
    loadType: 'R',
    necReference: 'NEC 210.52(E)'
  });

  // Refrigerator (dedicated circuit recommended)
  circuits.push({
    description: 'Refrigerator',
    breakerAmps: 20,
    pole: 1,
    loadWatts: 600,
    loadType: 'K',
    necReference: 'NEC 210.52(B)(1) Ex 2'
  });

  // =========================================
  // Appliance-specific circuits
  // =========================================

  // Electric Range
  if (appliances.range?.enabled && appliances.range.type === 'electric') {
    const rangeAmps = Math.ceil((appliances.range.kw * 1000) / 240);
    circuits.push({
      description: 'Electric Range',
      breakerAmps: Math.min(50, Math.max(40, Math.ceil(rangeAmps / 5) * 5)),
      pole: 2,
      loadWatts: appliances.range.kw * 1000,
      loadType: 'K',
      necReference: 'NEC 210.19(A)(3)'
    });
  }

  // Electric Dryer
  if (appliances.dryer?.enabled && appliances.dryer.type === 'electric') {
    circuits.push({
      description: 'Electric Dryer',
      breakerAmps: 30,
      pole: 2,
      loadWatts: appliances.dryer.kw * 1000,
      loadType: 'D',
      necReference: 'NEC 220.54'
    });
  }

  // Water Heater
  if (appliances.waterHeater?.enabled && appliances.waterHeater.type === 'electric') {
    const whAmps = Math.ceil((appliances.waterHeater.kw * 1000) / 240);
    circuits.push({
      description: 'Electric Water Heater',
      breakerAmps: Math.ceil(whAmps * 1.25 / 5) * 5, // 125% for continuous
      pole: 2,
      loadWatts: appliances.waterHeater.kw * 1000,
      loadType: 'W',
      necReference: 'NEC 422.13'
    });
  }

  // HVAC - A/C
  if (appliances.hvac?.enabled && appliances.hvac.coolingKw) {
    const acAmps = Math.ceil((appliances.hvac.coolingKw * 1000) / 240);
    circuits.push({
      description: 'Air Conditioning Compressor',
      breakerAmps: Math.ceil(acAmps * 1.25 / 5) * 5,
      pole: 2,
      loadWatts: appliances.hvac.coolingKw * 1000,
      loadType: 'C',
      necReference: 'NEC 440.32'
    });
  }

  // HVAC - Electric Heat
  if (appliances.hvac?.enabled && appliances.hvac.heatingKw && 
      (appliances.hvac.type === 'electric_heat' || appliances.hvac.type === 'heat_pump')) {
    const heatAmps = Math.ceil((appliances.hvac.heatingKw * 1000) / 240);
    circuits.push({
      description: 'Electric Heat / Heat Pump',
      breakerAmps: Math.ceil(heatAmps * 1.25 / 5) * 5,
      pole: 2,
      loadWatts: appliances.hvac.heatingKw * 1000,
      loadType: 'H',
      necReference: 'NEC 424.3'
    });
  }

  // Dishwasher
  if (appliances.dishwasher?.enabled) {
    circuits.push({
      description: 'Dishwasher',
      breakerAmps: 20,
      pole: 1,
      loadWatts: appliances.dishwasher.kw * 1000,
      loadType: 'K',
      necReference: 'NEC 422.12'
    });
  }

  // Garbage Disposal
  if (appliances.disposal?.enabled) {
    circuits.push({
      description: 'Garbage Disposal',
      breakerAmps: 20,
      pole: 1,
      loadWatts: appliances.disposal.kw * 1000,
      loadType: 'K',
      necReference: 'NEC 422.12'
    });
  }

  // EV Charger
  if (appliances.evCharger?.enabled) {
    const evAmps = Math.ceil((appliances.evCharger.kw * 1000) / 240);
    circuits.push({
      description: `EV Charger Level ${appliances.evCharger.level}`,
      breakerAmps: appliances.evCharger.level === 2 ? 50 : 20,
      pole: 2,
      loadWatts: appliances.evCharger.kw * 1000,
      loadType: 'O',
      necReference: 'NEC 625.42'
    });
  }

  // Pool Pump
  if (appliances.poolPump?.enabled) {
    const pumpWatts = appliances.poolPump.hp * 1000;
    const pumpAmps = Math.ceil(pumpWatts / 240);
    circuits.push({
      description: 'Pool Pump',
      breakerAmps: Math.ceil(pumpAmps * 1.25 / 5) * 5,
      pole: 2,
      loadWatts: pumpWatts,
      loadType: 'M',
      necReference: 'NEC 680.21'
    });
  }

  // Pool Heater
  if (appliances.poolHeater?.enabled) {
    const heaterAmps = Math.ceil((appliances.poolHeater.kw * 1000) / 240);
    circuits.push({
      description: 'Pool Heater',
      breakerAmps: Math.ceil(heaterAmps * 1.25 / 5) * 5,
      pole: 2,
      loadWatts: appliances.poolHeater.kw * 1000,
      loadType: 'H',
      necReference: 'NEC 680.22'
    });
  }

  // Hot Tub / Spa
  if (appliances.hotTub?.enabled) {
    const spaAmps = Math.ceil((appliances.hotTub.kw * 1000) / 240);
    circuits.push({
      description: 'Hot Tub / Spa',
      breakerAmps: Math.ceil(spaAmps * 1.25 / 5) * 5,
      pole: 2,
      loadWatts: appliances.hotTub.kw * 1000,
      loadType: 'O',
      necReference: 'NEC 680.44'
    });
  }

  // Well Pump
  if (appliances.wellPump?.enabled) {
    const wellWatts = appliances.wellPump.hp * 1000;
    const wellAmps = Math.ceil(wellWatts / 240);
    circuits.push({
      description: 'Well Pump',
      breakerAmps: Math.ceil(wellAmps * 1.25 / 5) * 5,
      pole: 2,
      loadWatts: wellWatts,
      loadType: 'M',
      necReference: 'NEC 430.6'
    });
  }

  // Other appliances
  if (appliances.otherAppliances?.length) {
    for (const other of appliances.otherAppliances) {
      const otherAmps = Math.ceil((other.kw * 1000) / 240);
      circuits.push({
        description: other.description,
        breakerAmps: Math.ceil(otherAmps / 5) * 5,
        pole: other.kw > 2 ? 2 : 1,
        loadWatts: other.kw * 1000,
        loadType: 'O',
        necReference: 'NEC 220.82(B)(2)'
      });
    }
  }

  return circuits;
}

