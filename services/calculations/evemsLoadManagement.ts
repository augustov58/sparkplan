/**
 * EVEMS Load Management Calculator - NEC 625.42
 * Electric Vehicle Energy Management System
 * 
 * NEC 625.42 allows load management systems to reduce required service capacity
 * by intelligently scheduling EV charging loads based on available capacity.
 * 
 * Key Requirements:
 * - NEC 625.42: EVEMS can reduce feeder/panel capacity requirements
 * - System must monitor total load and adjust EV charging accordingly
 * - EVEMS must prevent service overload
 * - Individual EV circuits still sized at 125% per NEC 625.40
 */

/**
 * Input parameters for EVEMS load management calculation
 */
export interface EVEMSInput {
  /** Existing service size (Amps) */
  serviceAmps: number;
  
  /** Existing service voltage */
  serviceVoltage: number;
  
  /** Existing service phase */
  servicePhase: 1 | 3;
  
  /** Existing connected load (kVA) - from load calculation */
  existingLoad_kVA: number;
  
  /** Existing demand load (kVA) - after demand factors */
  existingDemand_kVA: number;
  
  /** EV charger specifications */
  evChargers: Array<{
    level: 'Level1' | 'Level2' | 'Level3_DCFC';
    voltage: number;
    phase: 1 | 3;
    chargerAmps: number;
    quantity: number;
  }>;
  
  /** Whether EVEMS is being used */
  useEVEMS: boolean;
  
  /** EVEMS priority mode (if applicable) */
  evemsMode?: 'first_come_first_served' | 'priority_based' | 'round_robin';
}

/**
 * EVEMS load management calculation result
 */
export interface EVEMSResult {
  /** Service capacity (kVA) */
  serviceCapacity_kVA: number;
  
  /** Existing demand load (kVA) */
  existingDemand_kVA: number;
  
  /** Available capacity for EV charging (kVA) */
  availableCapacity_kVA: number;
  
  /** Total EV connected load (kVA) */
  totalEVLoad_kVA: number;
  
  /** EV demand load with/without EVEMS (kVA) */
  evDemandLoad_kVA: number;
  
  /** Total system demand (existing + EV) */
  totalSystemDemand_kVA: number;
  
  /** Service utilization percentage */
  serviceUtilizationPercent: number;
  
  /** Whether service upgrade is needed */
  serviceUpgradeNeeded: boolean;
  
  /** Recommended service size if upgrade needed (Amps) */
  recommendedServiceAmps?: number;
  
  /** Number of chargers that can be installed */
  maxChargersWithoutEVEMS: number;
  maxChargersWithEVEMS: number;
  
  /** EVEMS recommendations */
  evemsRecommendations: {
    evemsRequired: boolean;
    evemsBenefit_kVA: number;
    schedulingStrategy: string;
    notes: string[];
  };
  
  /** Load scheduling breakdown */
  loadSchedule?: {
    timeSlot: string;
    availableCapacity_kVA: number;
    evCharging_kVA: number;
    otherLoads_kVA: number;
    utilizationPercent: number;
  }[];
  
  /** NEC compliance */
  compliance: {
    necArticle: string;
    compliant: boolean;
    message: string;
    warnings: string[];
  };
}

/**
 * Calculate EVEMS load management per NEC 625.42
 * 
 * @param input - EVEMS calculation parameters
 * @returns Complete EVEMS analysis result
 */
export function calculateEVEMSLoadManagement(input: EVEMSInput): EVEMSResult {
  const warnings: string[] = [];
  const notes: string[] = [];
  
  // Calculate service capacity
  const serviceCapacity_kVA = input.servicePhase === 3
    ? (input.serviceVoltage * Math.sqrt(3) * input.serviceAmps) / 1000
    : (input.serviceVoltage * input.serviceAmps) / 1000;
  
  // Calculate total EV connected load
  let totalEVLoad_kVA = 0;
  input.evChargers.forEach(charger => {
    const singleChargerVA = charger.phase === 1
      ? charger.voltage * charger.chargerAmps
      : Math.sqrt(3) * charger.voltage * charger.chargerAmps;
    const singleChargerKVA = singleChargerVA / 1000;
    totalEVLoad_kVA += singleChargerKVA * charger.quantity;
  });
  
  // Calculate EV demand load
  // Without EVEMS: All chargers at full capacity (with diversity)
  // With EVEMS: Can reduce to available capacity
  let evDemandLoad_kVA: number;
  
  if (input.useEVEMS) {
    // EVEMS allows charging up to available capacity
    // System intelligently schedules charging based on available capacity
    const availableCapacity = serviceCapacity_kVA - input.existingDemand_kVA;
    
    // EVEMS can utilize up to 100% of available capacity (with some safety margin)
    const evemsUtilizationFactor = 0.90; // 90% to leave safety margin
    evDemandLoad_kVA = Math.min(totalEVLoad_kVA, availableCapacity * evemsUtilizationFactor);
    
    notes.push(
      `EVEMS allows ${evDemandLoad_kVA.toFixed(2)} kVA of EV charging ` +
      `(limited by available capacity of ${availableCapacity.toFixed(2)} kVA)`
    );
  } else {
    // Without EVEMS: Apply standard demand factors per NEC 625.44
    const totalChargers = input.evChargers.reduce((sum, c) => sum + c.quantity, 0);
    const simultaneousUse = 100; // Assume 100% without EVEMS (conservative)
    const demandFactor = calculateEVDemandFactor(totalChargers, simultaneousUse);
    evDemandLoad_kVA = totalEVLoad_kVA * demandFactor;
    
    notes.push(
      `Without EVEMS: Demand factor of ${(demandFactor * 100).toFixed(0)}% applied ` +
      `for ${totalChargers} chargers per NEC 625.44`
    );
  }
  
  // Calculate available capacity
  const availableCapacity_kVA = serviceCapacity_kVA - input.existingDemand_kVA;
  
  // Total system demand
  const totalSystemDemand_kVA = input.existingDemand_kVA + evDemandLoad_kVA;
  
  // Service utilization
  const serviceUtilizationPercent = (totalSystemDemand_kVA / serviceCapacity_kVA) * 100;
  
  // Determine if service upgrade is needed
  const serviceUpgradeNeeded = totalSystemDemand_kVA > serviceCapacity_kVA;
  
  // Calculate maximum chargers
  const maxChargersWithoutEVEMS = calculateMaxChargers(
    input.evChargers,
    availableCapacity_kVA,
    false
  );
  
  const maxChargersWithEVEMS = calculateMaxChargers(
    input.evChargers,
    availableCapacity_kVA,
    true
  );
  
  // EVEMS recommendations
  const evemsBenefit_kVA = (totalEVLoad_kVA * 0.9) - evDemandLoad_kVA; // Approximate benefit
  const evemsRequired = totalSystemDemand_kVA > serviceCapacity_kVA && !input.useEVEMS;
  
  let schedulingStrategy = '';
  if (input.useEVEMS) {
    switch (input.evemsMode) {
      case 'first_come_first_served':
        schedulingStrategy = 'First-come-first-served: Chargers activate in order of connection until capacity is reached.';
        break;
      case 'priority_based':
        schedulingStrategy = 'Priority-based: High-priority chargers (e.g., fleet vehicles) get priority access to available capacity.';
        break;
      case 'round_robin':
        schedulingStrategy = 'Round-robin: Chargers share available capacity equally, rotating access.';
        break;
      default:
        schedulingStrategy = 'Intelligent scheduling: EVEMS monitors total load and adjusts EV charging to prevent overload.';
    }
  }
  
  // Generate load schedule (simplified - shows peak and off-peak scenarios)
  const loadSchedule = input.useEVEMS ? generateLoadSchedule(
    input.existingDemand_kVA,
    availableCapacity_kVA,
    totalEVLoad_kVA,
    serviceCapacity_kVA
  ) : undefined;
  
  // Compliance check
  let compliant = true;
  let message = '';
  
  if (serviceUpgradeNeeded && !input.useEVEMS) {
    compliant = false;
    message = `Service overload: Total demand (${totalSystemDemand_kVA.toFixed(2)} kVA) exceeds service capacity (${serviceCapacity_kVA.toFixed(2)} kVA). Service upgrade or EVEMS required.`;
    warnings.push('CRITICAL: Service capacity exceeded. Upgrade service or implement EVEMS.');
  } else if (serviceUpgradeNeeded && input.useEVEMS) {
    compliant = false;
    message = `Even with EVEMS, service capacity may be insufficient. Consider service upgrade.`;
    warnings.push('Service capacity may be insufficient even with EVEMS.');
  } else if (serviceUtilizationPercent > 90) {
    compliant = true;
    message = `High service utilization (${serviceUtilizationPercent.toFixed(1)}%). Monitor closely.`;
    warnings.push('Service utilization exceeds 90% - consider service upgrade for future expansion.');
  } else if (serviceUtilizationPercent > 80) {
    compliant = true;
    message = `Service utilization at ${serviceUtilizationPercent.toFixed(1)}% - acceptable but approaching limits.`;
    notes.push('Consider EVEMS for future expansion or to reduce peak demand.');
  } else {
    compliant = true;
    message = `Service utilization at ${serviceUtilizationPercent.toFixed(1)}% - within acceptable limits.`;
  }
  
  // Calculate recommended service size if upgrade needed
  let recommendedServiceAmps: number | undefined;
  if (serviceUpgradeNeeded) {
    // Add 25% margin for future growth
    const requiredCapacity_kVA = totalSystemDemand_kVA * 1.25;
    recommendedServiceAmps = input.servicePhase === 3
      ? Math.ceil((requiredCapacity_kVA * 1000) / (input.serviceVoltage * Math.sqrt(3)))
      : Math.ceil((requiredCapacity_kVA * 1000) / input.serviceVoltage);
    
    // Round to standard service sizes
    recommendedServiceAmps = roundToStandardServiceSize(recommendedServiceAmps);
  }
  
  return {
    serviceCapacity_kVA: Math.round(serviceCapacity_kVA * 100) / 100,
    existingDemand_kVA: input.existingDemand_kVA,
    availableCapacity_kVA: Math.round(availableCapacity_kVA * 100) / 100,
    totalEVLoad_kVA: Math.round(totalEVLoad_kVA * 100) / 100,
    evDemandLoad_kVA: Math.round(evDemandLoad_kVA * 100) / 100,
    totalSystemDemand_kVA: Math.round(totalSystemDemand_kVA * 100) / 100,
    serviceUtilizationPercent: Math.round(serviceUtilizationPercent * 10) / 10,
    serviceUpgradeNeeded,
    recommendedServiceAmps,
    maxChargersWithoutEVEMS,
    maxChargersWithEVEMS,
    evemsRecommendations: {
      evemsRequired: evemsRequired,
      evemsBenefit_kVA: Math.round(evemsBenefit_kVA * 100) / 100,
      schedulingStrategy,
      notes,
    },
    loadSchedule,
    compliance: {
      necArticle: 'NEC 625.42',
      compliant,
      message,
      warnings,
    },
  };
}

/**
 * Calculate demand factor for multiple EV chargers
 * Per NEC 625.44
 */
function calculateEVDemandFactor(numChargers: number, simultaneousUse: number): number {
  const baseFactor = simultaneousUse / 100;
  
  if (numChargers <= 1) {
    return 1.0;
  } else if (numChargers <= 3) {
    return Math.min(1.0, baseFactor * 1.1);
  } else if (numChargers <= 10) {
    return Math.min(1.0, baseFactor * 0.95);
  } else if (numChargers <= 25) {
    return Math.min(1.0, baseFactor * 0.85);
  } else {
    return Math.min(1.0, baseFactor * 0.75);
  }
}

/**
 * Calculate maximum number of chargers that can be installed
 */
function calculateMaxChargers(
  chargerSpecs: Array<{ voltage: number; phase: 1 | 3; chargerAmps: number; quantity: number }>,
  availableCapacity_kVA: number,
  withEVEMS: boolean
): number {
  if (chargerSpecs.length === 0) return 0;
  
  // Use the first charger spec as reference (simplified)
  const refCharger = chargerSpecs[0];
  const singleChargerVA = refCharger.phase === 1
    ? refCharger.voltage * refCharger.chargerAmps
    : Math.sqrt(3) * refCharger.voltage * refCharger.chargerAmps;
  const singleChargerKVA = singleChargerVA / 1000;
  
  if (withEVEMS) {
    // With EVEMS: Can use up to 90% of available capacity
    return Math.floor((availableCapacity_kVA * 0.90) / singleChargerKVA);
  } else {
    // Without EVEMS: Apply demand factor (assume 85% for multiple chargers)
    const demandFactor = 0.85;
    return Math.floor((availableCapacity_kVA / singleChargerKVA) / demandFactor);
  }
}

/**
 * Generate simplified load schedule
 */
function generateLoadSchedule(
  existingDemand_kVA: number,
  availableCapacity_kVA: number,
  totalEVLoad_kVA: number,
  serviceCapacity_kVA: number
): Array<{
  timeSlot: string;
  availableCapacity_kVA: number;
  evCharging_kVA: number;
  otherLoads_kVA: number;
  utilizationPercent: number;
}> {
  // Simplified schedule showing peak and off-peak scenarios
  return [
    {
      timeSlot: 'Peak Hours (6PM-10PM)',
      availableCapacity_kVA: availableCapacity_kVA * 0.7, // Less available during peak
      evCharging_kVA: Math.min(totalEVLoad_kVA * 0.5, availableCapacity_kVA * 0.7 * 0.9),
      otherLoads_kVA: existingDemand_kVA * 1.2, // Higher during peak
      utilizationPercent: ((existingDemand_kVA * 1.2 + Math.min(totalEVLoad_kVA * 0.5, availableCapacity_kVA * 0.7 * 0.9)) / serviceCapacity_kVA) * 100,
    },
    {
      timeSlot: 'Off-Peak Hours (10PM-6AM)',
      availableCapacity_kVA: availableCapacity_kVA * 1.1, // More available off-peak
      evCharging_kVA: Math.min(totalEVLoad_kVA * 0.9, availableCapacity_kVA * 1.1 * 0.9),
      otherLoads_kVA: existingDemand_kVA * 0.6, // Lower during off-peak
      utilizationPercent: ((existingDemand_kVA * 0.6 + Math.min(totalEVLoad_kVA * 0.9, availableCapacity_kVA * 1.1 * 0.9)) / serviceCapacity_kVA) * 100,
    },
    {
      timeSlot: 'Daytime Hours (6AM-6PM)',
      availableCapacity_kVA: availableCapacity_kVA,
      evCharging_kVA: Math.min(totalEVLoad_kVA * 0.7, availableCapacity_kVA * 0.9),
      otherLoads_kVA: existingDemand_kVA,
      utilizationPercent: ((existingDemand_kVA + Math.min(totalEVLoad_kVA * 0.7, availableCapacity_kVA * 0.9)) / serviceCapacity_kVA) * 100,
    },
  ];
}

/**
 * Round to standard service sizes
 */
function roundToStandardServiceSize(amps: number): number {
  const standardSizes = [100, 125, 150, 200, 225, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000];
  
  for (const size of standardSizes) {
    if (size >= amps) return size;
  }
  
  return Math.ceil(amps / 200) * 200; // Round to nearest 200A above
}

