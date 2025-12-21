/**
 * Commercial Load Calculation Service
 * NEC 2023 Article 220, Part III & IV - Feeder and Service Load Calculations (Non-Dwelling)
 *
 * Implements general method for commercial and industrial occupancies per:
 * - NEC 220.40: General provisions
 * - NEC 220.42: Lighting demand factors
 * - NEC 220.44: Receptacle demand factors
 * - NEC 220.50: Motors
 * - NEC 220.54: Electric clothes dryers (if applicable)
 * - NEC 220.56: Kitchen equipment
 * - NEC 220.60: Noncoincident loads
 */

// ==================== TYPES ====================

export type OccupancyType =
  | 'armories_auditoriums'
  | 'banks'
  | 'barber_beauty'
  | 'churches'
  | 'clubs'
  | 'courts'
  | 'dwelling_units'
  | 'garages_commercial'
  | 'halls_corridors'
  | 'hospitals'
  | 'hotels_motels'
  | 'industrial_commercial'
  | 'lodge_rooms'
  | 'office_buildings'
  | 'restaurants'
  | 'schools'
  | 'stores'
  | 'warehouses_storage';

export interface CommercialLoadInput {
  // Building Information
  occupancyType: OccupancyType;
  totalFloorArea: number; // square feet

  // Lighting Load (from NEC Table 220.12)
  // Calculated automatically based on occupancy and floor area

  // Receptacle Loads (NEC 220.14)
  generalReceptacleCount: number; // 180 VA each
  showWindowLighting_linearFeet?: number; // 200 VA per linear foot (NEC 220.14(G))
  signOutlets?: number; // 1200 VA each (NEC 220.14(F))

  // HVAC Loads (NEC 220.14(C), Article 430)
  hvacLoads: HVACLoad[];

  // Motor Loads (Article 430)
  motorLoads: MotorLoad[];

  // Kitchen Equipment (NEC 220.56) - Only if restaurant/food service
  kitchenEquipment?: KitchenEquipment[];

  // Special Loads
  specialLoads?: SpecialLoad[];

  // Service Parameters
  serviceVoltage: 120 | 208 | 240 | 277 | 480; // Line-to-neutral or line-to-line
  servicePhase: 1 | 3;
}

export interface HVACLoad {
  description: string;
  nameplateFLA: number; // Full Load Amps from nameplate
  voltage: number;
  phase: 1 | 3;
  isContinuous: boolean; // 125% factor if continuous (>3 hours)
}

export interface MotorLoad {
  description: string;
  horsepower: number;
  voltage: number;
  phase: 1 | 3;
  fullLoadAmps: number; // From NEC Table 430.250
}

export interface KitchenEquipment {
  description: string;
  nameplateRating_kW: number;
}

export interface SpecialLoad {
  description: string;
  load_VA: number;
  isContinuous: boolean;
}

export interface CommercialLoadResult {
  // Breakdown by load type
  lightingLoad_VA: number;
  lightingDemandLoad_VA: number; // After demand factors

  receptacleLoad_VA: number;
  receptacleDemandLoad_VA: number; // After demand factors (NEC 220.44)

  hvacLoad_VA: number;
  hvacDemandLoad_VA: number; // With 125% continuous factor

  motorLoad_VA: number;
  motorDemandLoad_VA: number; // With 25% on largest motor

  kitchenLoad_VA?: number;
  kitchenDemandLoad_VA?: number; // After NEC 220.56 demand factors

  specialLoad_VA?: number;
  specialDemandLoad_VA?: number;

  // Totals
  totalConnectedLoad_VA: number;
  totalDemandLoad_VA: number;

  // Service Sizing
  calculatedAmps: number;
  recommendedMainBreakerAmps: number; // Main OCPD size per NEC 240.6(A)
  recommendedServiceBusRating: number; // Service equipment bus rating (commercially available)

  // Load breakdown for display
  loadBreakdown: LoadBreakdownItem[];

  // Warnings and notes
  warnings: string[];
  notes: string[];
}

export interface LoadBreakdownItem {
  category: string;
  connectedLoad_VA: number;
  demandLoad_VA: number;
  demandFactor: number; // Demand factor as percentage (e.g., 100, 85, 50)
  isContinuous: boolean; // True if continuous load (gets ×1.25 for service sizing)
  serviceSizingLoad_VA: number; // Demand × 1.25 if continuous, otherwise same as demand
  necReference: string;
}

// ==================== NEC TABLE 220.12 - GENERAL LIGHTING LOADS ====================

/**
 * NEC 2023 Table 220.42(A) (formerly Table 220.12) - General Lighting Loads by Occupancy
 * Unit load per square foot (VA/sq ft)
 *
 * Note: These values were updated in NEC 2020/2023 based on LED lighting efficiency
 * and include considerations for continuous loads
 */
export const LIGHTING_UNIT_LOAD: Record<OccupancyType, number> = {
  armories_auditoriums: 1.0,
  banks: 3.5,
  barber_beauty: 3.0,
  churches: 1.0,
  clubs: 2.0,
  courts: 2.0,
  dwelling_units: 3.0,
  garages_commercial: 0.25,
  halls_corridors: 0.5,
  hospitals: 2.0,
  hotels_motels: 2.0, // Guest rooms (was 1.0, corrected)
  industrial_commercial: 2.0, // Loft buildings (was 1.0, corrected)
  lodge_rooms: 1.5,
  office_buildings: 1.0,
  restaurants: 2.0,
  schools: 1.5, // Changed from 3.0 in NEC 2020/2023
  stores: 3.0, // Was 1.5, corrected to match Example D3
  warehouses_storage: 0.25,
};

/**
 * Occupancy display names for UI
 */
export const OCCUPANCY_LABELS: Record<OccupancyType, string> = {
  armories_auditoriums: 'Armories and Auditoriums',
  banks: 'Banks',
  barber_beauty: 'Barber Shops / Beauty Parlors',
  churches: 'Churches',
  clubs: 'Clubs',
  courts: 'Court Rooms',
  dwelling_units: 'Dwelling Units',
  garages_commercial: 'Garages - Commercial (Storage)',
  halls_corridors: 'Halls, Corridors, Closets, Stairways',
  hospitals: 'Hospitals',
  hotels_motels: 'Hotels / Motels (Guest Rooms)',
  industrial_commercial: 'Industrial Commercial (Loft Buildings)',
  lodge_rooms: 'Lodge Rooms',
  office_buildings: 'Office Buildings',
  restaurants: 'Restaurants',
  schools: 'Schools',
  stores: 'Stores',
  warehouses_storage: 'Warehouses (Storage)',
};

// ==================== STANDARD SIZES ====================

/**
 * Standard OCPD (Overcurrent Protection Device) sizes per NEC Table 240.6(A)
 * These are the available main breaker/fuse ratings
 */
const STANDARD_OCPD_SIZES = [
  100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800,
  1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000,
];

/**
 * Standard service equipment bus bar ratings (commercially available)
 * Service equipment (panels, switchboards, switchgear) bus bars are manufactured
 * in specific ratings that may differ from OCPD sizes
 *
 * Common commercial bus ratings:
 * - Panelboards: 100A, 125A, 150A, 200A, 225A, 400A, 600A
 * - Switchboards/Switchgear: 800A, 1000A, 1200A, 1600A, 2000A, 2500A, 3000A, 4000A
 *
 * Note: Some OCPD sizes (175A, 250A, 300A, 350A, 450A, 500A, 700A) are not
 * commonly available as bus bar ratings. In these cases, use the next larger bus size.
 */
const STANDARD_SERVICE_BUS_RATINGS = [
  100, 125, 150, 200, 225, 400, 600, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000,
];

// ==================== MAIN CALCULATION FUNCTION ====================

/**
 * Calculate commercial/industrial load per NEC 220.40-220.87
 */
export function calculateCommercialLoad(input: CommercialLoadInput): CommercialLoadResult {
  const warnings: string[] = [];
  const notes: string[] = [];
  const loadBreakdown: LoadBreakdownItem[] = [];

  // ===== 1. LIGHTING LOAD (NEC 220.12, Table 220.12) =====
  const lightingUnitLoad = LIGHTING_UNIT_LOAD[input.occupancyType];
  const lightingLoad_VA = input.totalFloorArea * lightingUnitLoad;

  // Apply lighting demand factors (NEC 220.42)
  const lightingDemandLoad_VA = applyLightingDemandFactor(
    lightingLoad_VA,
    input.occupancyType
  );

  const lightingDemandFactor = (lightingDemandLoad_VA / lightingLoad_VA) * 100;

  loadBreakdown.push({
    category: 'General Lighting (Continuous)',
    connectedLoad_VA: lightingLoad_VA,
    demandLoad_VA: lightingDemandLoad_VA,
    demandFactor: lightingDemandFactor,
    isContinuous: true,
    serviceSizingLoad_VA: lightingDemandLoad_VA * 1.25,
    necReference: 'NEC 220.12, Table 220.12',
  });

  notes.push(
    `Lighting load calculated at ${lightingUnitLoad} VA/sq ft per NEC Table 220.12 (${OCCUPANCY_LABELS[input.occupancyType]}) - Continuous load`
  );

  // ===== 2. RECEPTACLE LOAD (NEC 220.14, 220.44) - NON-CONTINUOUS =====
  let receptacleLoad_VA = input.generalReceptacleCount * 180; // 180 VA per receptacle

  // Apply receptacle demand factors (NEC 220.44)
  const receptacleDemandLoad_VA = applyReceptacleDemandFactor(receptacleLoad_VA);
  const receptacleDemandFactor = (receptacleDemandLoad_VA / receptacleLoad_VA) * 100;

  loadBreakdown.push({
    category: 'Receptacles (Non-Continuous)',
    connectedLoad_VA: receptacleLoad_VA,
    demandLoad_VA: receptacleDemandLoad_VA,
    demandFactor: receptacleDemandFactor,
    isContinuous: false,
    serviceSizingLoad_VA: receptacleDemandLoad_VA, // No multiplier for non-continuous
    necReference: 'NEC 220.14, 220.44',
  });

  // ===== 3. SHOW WINDOW LIGHTING (NEC 220.14(G)) - CONTINUOUS =====
  let showWindowLoad_VA = 0;
  if (input.showWindowLighting_linearFeet && input.showWindowLighting_linearFeet > 0) {
    showWindowLoad_VA = input.showWindowLighting_linearFeet * 200; // 200 VA per linear foot
    notes.push(`Show window lighting: ${input.showWindowLighting_linearFeet} linear feet @ 200 VA/ft = ${showWindowLoad_VA} VA (continuous)`);

    loadBreakdown.push({
      category: 'Show Window Lighting (Continuous)',
      connectedLoad_VA: showWindowLoad_VA,
      demandLoad_VA: showWindowLoad_VA,
      demandFactor: 100,
      isContinuous: true,
      serviceSizingLoad_VA: showWindowLoad_VA * 1.25,
      necReference: 'NEC 220.14(G)',
    });
  }

  // ===== 4. SIGN OUTLETS (NEC 220.14(F)) - CONTINUOUS =====
  let signLoad_VA = 0;
  if (input.signOutlets && input.signOutlets > 0) {
    signLoad_VA = input.signOutlets * 1200; // 1200 VA per outlet
    notes.push(`Sign outlets: ${input.signOutlets} @ 1200 VA each = ${signLoad_VA} VA (continuous)`);

    loadBreakdown.push({
      category: 'Sign Outlets (Continuous)',
      connectedLoad_VA: signLoad_VA,
      demandLoad_VA: signLoad_VA,
      demandFactor: 100,
      isContinuous: true,
      serviceSizingLoad_VA: signLoad_VA * 1.25,
      necReference: 'NEC 220.14(F)',
    });
  }

  // ===== 3. HVAC LOAD (NEC 220.14(C)) =====
  let hvacLoad_VA = 0;
  let hvacDemandLoad_VA = 0;

  for (const hvac of input.hvacLoads) {
    let loadVA = 0;

    if (hvac.phase === 3) {
      // Three-phase: VA = V × I × √3
      loadVA = hvac.voltage * hvac.nameplateFLA * Math.sqrt(3);
    } else {
      // Single-phase: VA = V × I
      loadVA = hvac.voltage * hvac.nameplateFLA;
    }

    // Apply 125% for continuous loads (>3 hours)
    const demandVA = hvac.isContinuous ? loadVA * 1.25 : loadVA;

    hvacLoad_VA += loadVA;
    hvacDemandLoad_VA += demandVA;
  }

  if (hvacLoad_VA > 0) {
    const hvacDemandFactor = (hvacDemandLoad_VA / hvacLoad_VA) * 100;
    const hvacIsContinuous = hvacDemandFactor > 100; // Continuous if demand > connected
    loadBreakdown.push({
      category: 'HVAC Equipment',
      connectedLoad_VA: hvacLoad_VA,
      demandLoad_VA: hvacDemandLoad_VA,
      demandFactor: hvacDemandFactor,
      isContinuous: hvacIsContinuous,
      serviceSizingLoad_VA: hvacDemandLoad_VA, // Already includes 125% if continuous
      necReference: 'NEC 220.14(C), 440.6',
    });

    if (hvacIsContinuous) {
      notes.push(`HVAC loads include 125% factor for continuous operation per NEC 220.14(C)`);
    }
  }

  // ===== 4. MOTOR LOAD (Article 430, NEC 220.50) =====
  let motorLoad_VA = 0;
  let motorDemandLoad_VA = 0;
  let largestMotorVA = 0;

  for (const motor of input.motorLoads) {
    let loadVA = 0;

    if (motor.phase === 3) {
      loadVA = motor.voltage * motor.fullLoadAmps * Math.sqrt(3);
    } else {
      loadVA = motor.voltage * motor.fullLoadAmps;
    }

    motorLoad_VA += loadVA;
    motorDemandLoad_VA += loadVA;

    if (loadVA > largestMotorVA) {
      largestMotorVA = loadVA;
    }
  }

  // Add 25% of largest motor per NEC 430.24
  if (largestMotorVA > 0) {
    motorDemandLoad_VA += largestMotorVA * 0.25;
    notes.push(`Added 25% of largest motor (${Math.round(largestMotorVA)} VA) per NEC 430.24`);
  }

  if (motorLoad_VA > 0) {
    const motorDemandFactor = (motorDemandLoad_VA / motorLoad_VA) * 100;
    loadBreakdown.push({
      category: 'Motors',
      connectedLoad_VA: motorLoad_VA,
      demandLoad_VA: motorDemandLoad_VA,
      demandFactor: motorDemandFactor,
      isContinuous: true, // Motors are continuous loads
      serviceSizingLoad_VA: motorDemandLoad_VA, // Already includes 25% on largest motor
      necReference: 'NEC 430.24, 220.50',
    });
  }

  // ===== 5. KITCHEN EQUIPMENT (NEC 220.56) =====
  let kitchenLoad_VA: number | undefined;
  let kitchenDemandLoad_VA: number | undefined;

  if (input.kitchenEquipment && input.kitchenEquipment.length > 0) {
    kitchenLoad_VA = 0;

    for (const equipment of input.kitchenEquipment) {
      kitchenLoad_VA += equipment.nameplateRating_kW * 1000;
    }

    // Apply kitchen equipment demand factors (NEC 220.56)
    kitchenDemandLoad_VA = applyKitchenDemandFactor(
      input.kitchenEquipment,
      kitchenLoad_VA
    );

    const kitchenDemandFactor = (kitchenDemandLoad_VA / kitchenLoad_VA) * 100;

    loadBreakdown.push({
      category: 'Kitchen Equipment',
      connectedLoad_VA: kitchenLoad_VA,
      demandLoad_VA: kitchenDemandLoad_VA,
      demandFactor: kitchenDemandFactor,
      isContinuous: false, // Kitchen equipment uses NEC 220.56 demand factors, not continuous multiplier
      serviceSizingLoad_VA: kitchenDemandLoad_VA, // Uses demand factors from Table 220.56
      necReference: 'NEC 220.56, Table 220.56',
    });

    notes.push(`Kitchen equipment demand factors applied per NEC 220.56 (${input.kitchenEquipment.length} units)`);
  }

  // ===== 6. SPECIAL LOADS =====
  let specialLoad_VA: number | undefined;
  let specialDemandLoad_VA: number | undefined;

  if (input.specialLoads && input.specialLoads.length > 0) {
    specialLoad_VA = 0;
    specialDemandLoad_VA = 0;

    for (const load of input.specialLoads) {
      specialLoad_VA += load.load_VA;
      // Apply 125% for continuous loads
      const demandVA = load.isContinuous ? load.load_VA * 1.25 : load.load_VA;
      specialDemandLoad_VA += demandVA;
    }

    const specialDemandFactor = (specialDemandLoad_VA / specialLoad_VA) * 100;
    const specialIsContinuous = specialDemandFactor > 100; // Continuous if demand > connected

    loadBreakdown.push({
      category: 'Special Loads',
      connectedLoad_VA: specialLoad_VA,
      demandLoad_VA: specialDemandLoad_VA,
      demandFactor: specialDemandFactor,
      isContinuous: specialIsContinuous,
      serviceSizingLoad_VA: specialDemandLoad_VA, // Already includes 125% if continuous
      necReference: 'NEC 220.14',
    });
  }

  // ===== 7. CALCULATE TOTALS =====
  const totalConnectedLoad_VA =
    lightingLoad_VA +
    receptacleLoad_VA +
    showWindowLoad_VA +
    signLoad_VA +
    hvacLoad_VA +
    motorLoad_VA +
    (kitchenLoad_VA || 0) +
    (specialLoad_VA || 0);

  // Total demand load (for display purposes, without 125% continuous factor)
  const totalDemandLoad_VA =
    lightingDemandLoad_VA +
    receptacleDemandLoad_VA +
    showWindowLoad_VA +
    signLoad_VA +
    hvacLoad_VA + // Note: HVAC already includes 125% if continuous
    motorDemandLoad_VA +
    (kitchenDemandLoad_VA || 0) +
    (specialLoad_VA || 0); // Note: Special loads already include 125% if continuous

  // ===== 8. SERVICE SIZING (NEC 230.42, 215.3) =====
  // Per Example D3: Noncontinuous (as-is) + Continuous (× 1.25)

  // Sum up all service sizing loads from the breakdown
  const serviceSizingLoad_VA = loadBreakdown.reduce(
    (total, item) => total + item.serviceSizingLoad_VA,
    0
  );

  // Calculate breakdown for notes
  const continuousItems = loadBreakdown.filter(item => item.isContinuous);
  const nonContinuousItems = loadBreakdown.filter(item => !item.isContinuous);

  const totalContinuousDemand_VA = continuousItems.reduce((sum, item) => sum + item.demandLoad_VA, 0);
  const totalNonContinuous_VA = nonContinuousItems.reduce((sum, item) => sum + item.serviceSizingLoad_VA, 0);

  notes.push(
    `Service sizing per NEC 215.3/230.90: Non-continuous loads (${Math.round(totalNonContinuous_VA)} VA) + Continuous loads × 1.25 (${Math.round(totalContinuousDemand_VA)} VA × 1.25 = ${Math.round(totalContinuousDemand_VA * 1.25)} VA)`
  );

  let calculatedAmps = 0;

  if (input.servicePhase === 3) {
    // Three-phase: I = VA ÷ (V × √3)
    calculatedAmps = serviceSizingLoad_VA / (input.serviceVoltage * Math.sqrt(3));
  } else {
    // Single-phase: I = VA ÷ V
    calculatedAmps = serviceSizingLoad_VA / input.serviceVoltage;
  }

  // ===== STEP 1: Determine Main Breaker Size (OCPD) per NEC Table 240.6(A) & 215.3 =====
  // Note: serviceSizingLoad_VA already includes 125% of continuous loads per NEC 230.42(A)
  const recommendedMainBreakerAmps = STANDARD_OCPD_SIZES.find(
    (size) => size >= calculatedAmps
  ) || Math.ceil(calculatedAmps / 100) * 100;

  // ===== STEP 2: Determine Service Equipment Bus Rating (commercially available) =====
  // Service equipment bus bars may not be available in all OCPD sizes
  // Use next available commercial bus rating
  const recommendedServiceBusRating = STANDARD_SERVICE_BUS_RATINGS.find(
    (size) => size >= recommendedMainBreakerAmps
  ) || Math.ceil(recommendedMainBreakerAmps / 100) * 100;

  // Add explanatory notes
  notes.push(
    `Main breaker (OCPD): ${recommendedMainBreakerAmps}A per NEC Table 240.6(A) and 215.3`
  );

  if (recommendedServiceBusRating !== recommendedMainBreakerAmps) {
    notes.push(
      `Service equipment bus rating: ${recommendedServiceBusRating}A (next available commercial bus size)`
    );
  } else {
    notes.push(
      `Service equipment bus rating: ${recommendedServiceBusRating}A (matches main breaker size)`
    );
  }

  // ===== 9. WARNINGS =====

  // High utilization warning (based on main breaker size)
  const utilization = (calculatedAmps / recommendedMainBreakerAmps) * 100;
  if (utilization > 90) {
    warnings.push(
      `⚠️ Service utilization is ${utilization.toFixed(1)}%. Consider next larger service size for future expansion.`
    );
  }

  // NEC 220.60 - Noncoincident loads
  if (hvacLoad_VA > 0) {
    notes.push(
      `Note: Per NEC 220.60, if heating and cooling loads are present, only the larger load is included (assumed in HVAC totals).`
    );
  }

  return {
    lightingLoad_VA,
    lightingDemandLoad_VA,
    receptacleLoad_VA,
    receptacleDemandLoad_VA,
    hvacLoad_VA,
    hvacDemandLoad_VA,
    motorLoad_VA,
    motorDemandLoad_VA,
    kitchenLoad_VA,
    kitchenDemandLoad_VA,
    specialLoad_VA,
    specialDemandLoad_VA,
    totalConnectedLoad_VA,
    totalDemandLoad_VA,
    calculatedAmps,
    recommendedMainBreakerAmps,
    recommendedServiceBusRating,
    loadBreakdown,
    warnings,
    notes,
  };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Apply lighting demand factors per NEC 220.42
 *
 * NEC 220.42(A): Hospitals, hotels, motels, and storage warehouses
 * - First 20,000 VA @ 50%
 * - Remainder @ 40%
 *
 * All other occupancies: 100% (no reduction)
 */
function applyLightingDemandFactor(
  lightingLoad_VA: number,
  occupancyType: OccupancyType
): number {
  const hospitalHotelTypes: OccupancyType[] = [
    'hospitals',
    'hotels_motels',
    'warehouses_storage',
  ];

  if (hospitalHotelTypes.includes(occupancyType) && lightingLoad_VA > 20000) {
    // First 20,000 VA @ 50%, remainder @ 40%
    const first20k = 20000 * 0.50;
    const remainder = (lightingLoad_VA - 20000) * 0.40;
    return first20k + remainder;
  }

  // All other occupancies: 100% (no demand reduction)
  return lightingLoad_VA;
}

/**
 * Apply receptacle demand factors per NEC 220.44
 *
 * NEC 220.44: Receptacle loads (other than dwelling units)
 * - First 10 kVA or less @ 100%
 * - Remainder over 10 kVA @ 50%
 */
function applyReceptacleDemandFactor(receptacleLoad_VA: number): number {
  if (receptacleLoad_VA <= 10000) {
    return receptacleLoad_VA;
  }

  const first10kVA = 10000;
  const remainder = (receptacleLoad_VA - 10000) * 0.50;

  return first10kVA + remainder;
}

/**
 * Apply kitchen equipment demand factors per NEC 220.56, Table 220.56
 *
 * Table 220.56 - Demand Factors for Kitchen Equipment (Other Than Dwelling Unit(s))
 *
 * Number of Units | Demand Factor
 * ----------------|---------------
 * 1               | 100%
 * 2               | 100%
 * 3               | 90%
 * 4               | 80%
 * 5               | 70%
 * 6+              | 65% (for units beyond 6)
 *
 * Note: For 6+ units:
 * - First 3 @ 100%
 * - Next 3 @ 65%
 * - Remainder @ 25% (per NEC 220.56 note)
 */
function applyKitchenDemandFactor(
  equipment: KitchenEquipment[],
  totalLoad_VA: number
): number {
  const count = equipment.length;

  if (count === 0) return 0;
  if (count === 1) return totalLoad_VA * 1.00;
  if (count === 2) return totalLoad_VA * 1.00;
  if (count === 3) return totalLoad_VA * 0.90;
  if (count === 4) return totalLoad_VA * 0.80;
  if (count === 5) return totalLoad_VA * 0.70;

  // 6+ units: More complex calculation per Table 220.56
  // Sort equipment by nameplate rating (largest first)
  const sorted = [...equipment].sort((a, b) => b.nameplateRating_kW - a.nameplateRating_kW);

  let demandLoad = 0;

  // First 3 units @ 100%
  for (let i = 0; i < Math.min(3, count); i++) {
    if (sorted[i]) {
      demandLoad += sorted[i].nameplateRating_kW * 1000 * 1.00;
    }
  }

  // Next 3 units @ 65%
  for (let i = 3; i < Math.min(6, count); i++) {
    if (sorted[i]) {
      demandLoad += sorted[i].nameplateRating_kW * 1000 * 0.65;
    }
  }

  // Remaining units @ 25%
  for (let i = 6; i < count; i++) {
    if (sorted[i]) {
      demandLoad += sorted[i].nameplateRating_kW * 1000 * 0.25;
    }
  }

  return demandLoad;
}

/**
 * Get voltage options based on service phase
 */
export function getVoltageOptions(phase: 1 | 3): number[] {
  if (phase === 1) {
    return [120, 240];
  }
  return [120, 208, 277, 480];
}

/**
 * Format VA to kVA with proper rounding
 */
export function formatVA_to_kVA(va: number): string {
  const kva = va / 1000;
  if (kva >= 10) {
    return kva.toFixed(1);
  }
  return kva.toFixed(2);
}
