/**
 * Service Upgrade Analysis - NEC 230.42, 220.87
 *
 * Helps determine if existing electrical service can handle additional loads
 * (especially EV chargers, heat pumps, solar installations)
 *
 * Two calculation modes:
 * 1. Quick Check (amp-based) - 70% of use cases, field-friendly
 * 2. Detailed Analysis (kVA-based with NEC demand factors) - Design phase
 *
 * NEC References:
 * - NEC 220.87 - Determining existing loads (CRITICAL: 125% multiplier required)
 * - NEC 230.42 - Service conductor sizing
 * - NEC 220.82/220.84 - Dwelling unit load calculation with demand factors
 * - NEC 210.19 - Branch circuit continuous load (125% factor)
 * - NEC 625.41 - EV charger continuous load (125% factor)
 */

import type {
  QuickCheckInput,
  QuickCheckResult,
  ServiceUpgradeInput,
  ServiceUpgradeResult,
  UpgradeAnalysis,
  EVEMSRecommendation,
  LoadTemplate,
  ExistingLoadDeterminationMethod
} from '../../types';

// ============================================================================
// QUICK CHECK MODE (Amp-Based)
// ============================================================================

/**
 * Quick service capacity check - amp-based for field use
 *
 * Use case: "Can my 200A service handle a 50A EV charger?"
 *
 * Per NEC 220.87: When sizing for additional loads, existing load must be
 * multiplied by 125% (1.25) UNLESS it's from actual measured demand (utility
 * billing or load study), which already represents peak demand.
 *
 * @param input - Current service, usage, and proposed load in amps
 * @returns Quick check result with status and recommendation
 */
export function quickServiceCheck(input: QuickCheckInput): QuickCheckResult {
  // NEC 220.87: Apply 125% to existing load based on determination method
  let adjustedExistingLoad = input.currentUsageAmps;

  const method = input.existingLoadMethod || 'manual';
  const isActualMeasurement =
    method === 'utility_bill' || method === 'load_study';

  // Apply 125% multiplier per NEC 220.87 for calculated/manual loads
  // (Actual measured demand already represents peak, no multiplier needed)
  if (!isActualMeasurement) {
    adjustedExistingLoad = input.currentUsageAmps * 1.25;
  }

  const totalAmps = adjustedExistingLoad + input.proposedLoadAmps;
  const availableAmps = input.currentServiceAmps - adjustedExistingLoad;
  const utilizationPercent = (totalAmps / input.currentServiceAmps) * 100;

  const canHandle = utilizationPercent <= 100;
  const upgradeRecommended = utilizationPercent > 80;

  // Determine status based on utilization
  let status: 'OK' | 'HIGH' | 'CRITICAL';
  if (utilizationPercent > 100) {
    status = 'CRITICAL';
  } else if (utilizationPercent > 80) {
    status = 'HIGH';
  } else {
    status = 'OK';
  }

  // Generate recommendation message
  const recommendation = generateQuickRecommendation(
    status,
    utilizationPercent,
    input.currentServiceAmps,
    totalAmps,
    availableAmps,
    input.proposedLoadAmps
  );

  return {
    totalAmps: Math.round(totalAmps),
    utilizationPercent: Math.round(utilizationPercent * 10) / 10,
    availableAmps: Math.round(availableAmps),
    canHandle,
    upgradeRecommended,
    status,
    recommendation
  };
}

/**
 * Generate recommendation message for quick check
 */
function generateQuickRecommendation(
  status: 'OK' | 'HIGH' | 'CRITICAL',
  utilization: number,
  serviceAmps: number,
  totalAmps: number,
  availableAmps: number,
  proposedLoadAmps: number
): string {
  if (status === 'CRITICAL') {
    const deficit = totalAmps - serviceAmps;
    return (
      `⚠️ SERVICE UPGRADE REQUIRED: Total load (${totalAmps}A) exceeds ` +
      `service capacity (${serviceAmps}A) by ${deficit}A. Cannot add proposed load ` +
      `without upgrading service.`
    );
  }

  if (status === 'HIGH') {
    return (
      `⚠️ SERVICE UPGRADE RECOMMENDED: Adding ${proposedLoadAmps}A will bring ` +
      `utilization to ${utilization.toFixed(1)}%, exceeding the recommended 80% threshold ` +
      `per NEC continuous load requirements. Service can technically handle the load, ` +
      `but upgrade recommended for safety margin and future capacity.`
    );
  }

  // status === 'OK'
  return (
    `✅ SUFFICIENT CAPACITY: Your ${serviceAmps}A service can handle the ` +
      `proposed ${proposedLoadAmps}A load. Total utilization will be ${utilization.toFixed(1)}% ` +
      `with ${availableAmps}A remaining capacity.`
  );
}

// ============================================================================
// DETAILED ANALYSIS MODE (kVA-Based with NEC Demand Factors)
// ============================================================================

/**
 * Detailed service upgrade analysis with NEC demand factors
 *
 * Use case: Design phase, permit packages, accurate calculations
 *
 * @param input - Current service, existing demand, and proposed loads
 * @returns Detailed analysis with upgrade recommendations
 */
export function analyzeServiceUpgrade(input: ServiceUpgradeInput): ServiceUpgradeResult {
  const warnings: string[] = [];
  const notes: string[] = [];
  const necReferences: string[] = [
    'NEC 220.87 - Determining Existing Loads (125% multiplier)',
    'NEC 230.42 - Service Conductor Sizing',
    'NEC 220.82 - Dwelling Unit Load Calculation',
    'NEC 210.19 - Continuous Load (125% factor)'
  ];

  // Step 1: Calculate current service capacity
  const currentServiceCapacity_kVA = calculateServiceCapacity(
    input.currentServiceAmps,
    input.serviceVoltage,
    input.servicePhase
  );

  // Step 2: NEC 220.87 - Apply 125% to existing load based on determination method
  const isActualMeasurement =
    input.existingLoadMethod === 'utility_bill' ||
    input.existingLoadMethod === 'load_study';

  // Apply 125% multiplier per NEC 220.87 for calculated/manual loads
  const adjustedExistingLoad_kVA = isActualMeasurement
    ? input.existingDemandLoad_kVA
    : input.existingDemandLoad_kVA * 1.25;

  // Add note about determination method
  if (isActualMeasurement) {
    notes.push(
      `Existing load from ${input.existingLoadMethod === 'utility_bill' ? '12-month utility billing' : '30-day load study'} ` +
      `(actual measured demand - no 125% multiplier per NEC 220.87)`
    );
  } else {
    notes.push(
      `Existing load from ${input.existingLoadMethod === 'calculated' ? 'panel schedule calculation' : 'manual entry'} ` +
      `(125% multiplier applied per NEC 220.87)`
    );
    warnings.push(
      `⚠️ NEC 220.87 RECOMMENDATION: For most accurate results, use actual maximum demand from ` +
      `12-month utility billing or 30-day load study instead of calculated loads.`
    );
  }

  // Step 3: Calculate existing utilization (using adjusted load)
  const existingUtilization_percent =
    (adjustedExistingLoad_kVA / currentServiceCapacity_kVA) * 100;

  const availableCapacity_kVA =
    currentServiceCapacity_kVA - adjustedExistingLoad_kVA;

  // Warn if existing service is already overloaded
  if (existingUtilization_percent > 100) {
    warnings.push(
      `⚠️ CRITICAL: Existing service is overloaded (${existingUtilization_percent.toFixed(1)}%). ` +
      `Address current issues before adding loads.`
    );
  } else if (existingUtilization_percent > 80) {
    warnings.push(
      `Existing service is highly utilized (${existingUtilization_percent.toFixed(1)}%). ` +
      `Limited capacity for additional loads.`
    );
  }

  // Step 3: Calculate proposed additional loads
  let proposedAdditionalLoad_kVA = 0;
  const breakdown: ServiceUpgradeResult['breakdown'] = [];

  for (const load of input.proposedLoads) {
    // Apply 125% continuous load factor per NEC 210.19
    const effectiveKW = load.continuous ? load.kw * 1.25 : load.kw;
    proposedAdditionalLoad_kVA += effectiveKW;

    breakdown.push({
      category: load.category || 'Proposed Load',
      description: load.description + (load.continuous ? ' (continuous)' : ''),
      load_kVA: effectiveKW,
      continuous: load.continuous
    });

    if (load.continuous) {
      necReferences.push('NEC 625.41 - EV Charger Continuous Load');
    }
  }

  // Add existing load to breakdown
  breakdown.unshift({
    category: 'Existing Load',
    description: isActualMeasurement
      ? `Actual measured demand (${input.existingLoadMethod === 'utility_bill' ? 'utility billing' : 'load study'})`
      : `Calculated demand × 1.25 (NEC 220.87)`,
    load_kVA: adjustedExistingLoad_kVA,
    continuous: false
  });

  // Step 4: Calculate total future demand (using adjusted existing load per NEC 220.87)
  const totalFutureDemand_kVA = adjustedExistingLoad_kVA + proposedAdditionalLoad_kVA;
  const futureUtilization_percent =
    (totalFutureDemand_kVA / currentServiceCapacity_kVA) * 100;

  const futureAvailableCapacity_kVA =
    currentServiceCapacity_kVA - totalFutureDemand_kVA;

  // Step 5: Determine if upgrade is needed
  const canHandle = futureUtilization_percent <= 100;
  const upgradeRecommended = futureUtilization_percent > 80; // NEC 80% continuous load rule
  const upgradeRequired = futureUtilization_percent > 100;

  // Step 6: Calculate recommended service size (if needed)
  let recommendedServiceAmps: number | undefined;
  let upgradePath: ServiceUpgradeResult['upgradePath'] | undefined;

  if (upgradeRecommended || upgradeRequired) {
    const futureGrowthFactor = 1 + (input.futureGrowthMargin || 0.25);
    const requiredCapacity_kVA = totalFutureDemand_kVA * futureGrowthFactor;

    const requiredAmps = calculateAmpsFromKVA(
      requiredCapacity_kVA,
      input.serviceVoltage,
      input.servicePhase
    );

    recommendedServiceAmps = roundToStandardServiceSize(requiredAmps);

    const newServiceCapacity_kVA = calculateServiceCapacity(
      recommendedServiceAmps,
      input.serviceVoltage,
      input.servicePhase
    );

    const margin_kVA = newServiceCapacity_kVA - totalFutureDemand_kVA;
    const marginPercent = (margin_kVA / newServiceCapacity_kVA) * 100;

    upgradePath = {
      from: input.currentServiceAmps,
      to: recommendedServiceAmps,
      margin_kVA: Math.round(margin_kVA * 100) / 100,
      marginPercent: Math.round(marginPercent * 10) / 10
    };

    notes.push(
      `Recommended ${recommendedServiceAmps}A service provides ${margin_kVA.toFixed(1)} kVA ` +
      `(${marginPercent.toFixed(1)}%) additional capacity for future growth.`
    );
  }

  // Step 7: Analyze upgrade type (panel vs. full service)
  let upgradeAnalysis: UpgradeAnalysis | undefined;
  if (recommendedServiceAmps) {
    upgradeAnalysis = analyzeUpgradeType(
      input.currentServiceAmps,
      recommendedServiceAmps,
      input.panelBusRating || input.currentServiceAmps,
      input.serviceConductorSize || '2/0 AWG'
    );
  }

  // Step 8: Check if EVEMS is better option
  let evemsRecommendation: EVEMSRecommendation | undefined;
  const evChargerCount = input.proposedLoads.filter(l => l.category === 'EV').length;
  if (evChargerCount >= 3 && upgradeAnalysis) {
    evemsRecommendation = shouldRecommendEVEMS(
      evChargerCount,
      upgradeAnalysis.costEstimate.high,
      availableCapacity_kVA,
      currentServiceCapacity_kVA
    );
  }

  // Step 9: Generate warnings based on utilization
  if (upgradeRequired) {
    warnings.push(
      `⚠️ SERVICE UPGRADE REQUIRED: Total demand (${totalFutureDemand_kVA.toFixed(1)} kVA) ` +
      `exceeds service capacity (${currentServiceCapacity_kVA.toFixed(1)} kVA).`
    );
  } else if (upgradeRecommended) {
    warnings.push(
      `⚠️ SERVICE UPGRADE RECOMMENDED: Future utilization (${futureUtilization_percent.toFixed(1)}%) ` +
      `exceeds 80% threshold per NEC continuous load requirements.`
    );
  } else if (futureUtilization_percent > 70) {
    notes.push(
      `Service utilization will be ${futureUtilization_percent.toFixed(1)}% - within acceptable limits ` +
      `but monitor for future additions.`
    );
  } else {
    notes.push(
      `Sufficient capacity available. Service utilization will be ${futureUtilization_percent.toFixed(1)}%.`
    );
  }

  return {
    currentServiceCapacity_kVA: Math.round(currentServiceCapacity_kVA * 100) / 100,
    existingDemand_kVA: Math.round(adjustedExistingLoad_kVA * 100) / 100, // Adjusted per NEC 220.87
    existingUtilization_percent: Math.round(existingUtilization_percent * 10) / 10,
    availableCapacity_kVA: Math.round(availableCapacity_kVA * 100) / 100,
    proposedAdditionalLoad_kVA: Math.round(proposedAdditionalLoad_kVA * 100) / 100,
    totalFutureDemand_kVA: Math.round(totalFutureDemand_kVA * 100) / 100,
    futureUtilization_percent: Math.round(futureUtilization_percent * 10) / 10,
    futureAvailableCapacity_kVA: Math.round(futureAvailableCapacity_kVA * 100) / 100,
    canHandle,
    upgradeRecommended,
    upgradeRequired,
    recommendedServiceAmps,
    upgradePath,
    upgradeAnalysis,
    evemsRecommendation,
    breakdown,
    necReferences,
    warnings,
    notes
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate service capacity in kVA
 * Formula: Single-phase: V × I / 1000
 *          Three-phase: V × I × √3 / 1000
 */
export function calculateServiceCapacity(amps: number, voltage: number, phase: 1 | 3): number {
  if (phase === 3) {
    return (voltage * amps * Math.sqrt(3)) / 1000;
  } else {
    return (voltage * amps) / 1000;
  }
}

/**
 * Calculate amps from kVA (inverse of calculateServiceCapacity)
 */
export function calculateAmpsFromKVA(kva: number, voltage: number, phase: 1 | 3): number {
  if (phase === 3) {
    return (kva * 1000) / (voltage * Math.sqrt(3));
  } else {
    return (kva * 1000) / voltage;
  }
}

/**
 * Round to standard service sizes per NEC
 * Standard sizes: 100, 125, 150, 200, 225, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000
 */
export function roundToStandardServiceSize(amps: number): number {
  const standardSizes = [100, 125, 150, 200, 225, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000];

  for (const size of standardSizes) {
    if (size >= amps) return size;
  }

  // Fallback for extremely large services (>2000A)
  return Math.ceil(amps / 200) * 200;
}

/**
 * Analyze upgrade type: panel only vs. full service upgrade
 * Critical distinction: $2-4K (panel) vs. $6-15K (service)
 */
export function analyzeUpgradeType(
  currentServiceAmps: number,
  recommendedServiceAmps: number,
  panelBusRating: number,
  serviceConductorSize: string
): UpgradeAnalysis {
  // Simple conductor capacity lookup (rough estimates)
  const conductorCapacityMap: Record<string, number> = {
    '8 AWG': 40,
    '6 AWG': 55,
    '4 AWG': 70,
    '3 AWG': 85,
    '2 AWG': 95,
    '1 AWG': 110,
    '1/0 AWG': 125,
    '2/0 AWG': 145,
    '3/0 AWG': 165,
    '4/0 AWG': 195,
    '250 kcmil': 215,
    '300 kcmil': 240,
    '350 kcmil': 260,
    '400 kcmil': 280,
    '500 kcmil': 320,
    '600 kcmil': 355
  };

  const conductorCapacity = conductorCapacityMap[serviceConductorSize] || currentServiceAmps;
  const serviceConductorsAdequate = conductorCapacity >= currentServiceAmps;
  const panelBusBarAdequate = panelBusRating >= recommendedServiceAmps;

  // If recommended service size is same or smaller than current
  if (recommendedServiceAmps <= currentServiceAmps) {
    // Check if only panel needs upgrade
    if (!panelBusBarAdequate) {
      return {
        upgradeType: 'panel_only',
        reason: 'Service conductors adequate, but panel bus bar at capacity',
        costEstimate: { low: 1500, high: 4000 },
        timeline: '1-2 days, no utility coordination required',
        serviceConductorsAdequate: true,
        meterEnclosureAdequate: true,
        panelBusBarAdequate: false,
        recommendations: [
          `Replace main panel with ${currentServiceAmps}A rated panel with larger bus bar`,
          'Add more circuit spaces for future expansion',
          'No service conductor or meter upgrade needed',
          'No utility coordination required'
        ]
      };
    }

    // No upgrade needed
    return {
      upgradeType: 'none',
      reason: 'Service and panel adequate for proposed loads',
      costEstimate: { low: 0, high: 0 },
      timeline: 'No upgrade required',
      serviceConductorsAdequate: true,
      meterEnclosureAdequate: true,
      panelBusBarAdequate: true,
      recommendations: [
        'Current service and panel can handle proposed loads',
        'Verify panel has available circuit spaces',
        'Consider adding subpanel if main panel is full'
      ]
    };
  }

  // Full service upgrade needed
  return {
    upgradeType: 'full_service',
    reason: 'Service conductors must be upsized for increased capacity',
    costEstimate: { low: 6000, high: 15000 },
    timeline: '2-6 weeks, utility coordination required',
    serviceConductorsAdequate: false,
    meterEnclosureAdequate: false,
    panelBusBarAdequate: false,
    recommendations: [
      `Upgrade service from ${currentServiceAmps}A to ${recommendedServiceAmps}A`,
      'Replace service conductors with larger size',
      'Upgrade meter enclosure to match new service size',
      'Replace main panel with new panel rated for higher capacity',
      'Coordinate with utility company (2-6 week lead time)',
      'Obtain electrical permit for service upgrade',
      'Update grounding electrode conductor per NEC 250.66'
    ]
  };
}

/**
 * Determine if EVEMS is better option than service upgrade
 * For 3+ EV chargers, load management often cheaper/faster
 */
export function shouldRecommendEVEMS(
  numberOfChargers: number,
  serviceUpgradeCost: number,
  availableCapacity_kVA: number,
  totalServiceCapacity_kVA: number
): EVEMSRecommendation {
  // Don't recommend EVEMS if service is truly maxed out (<10% available)
  const availablePercent = (availableCapacity_kVA / totalServiceCapacity_kVA) * 100;
  if (availablePercent < 10) {
    return {
      shouldConsider: false,
      numberOfChargers,
      costComparison: {
        serviceUpgradeCost,
        evemsCost: 0,
        savings: 0
      },
      tradeoffs: ['Service is at maximum capacity - EVEMS cannot create capacity from nothing'],
      recommendation: 'Service upgrade required. EVEMS not viable due to insufficient existing capacity.'
    };
  }

  // Recommend EVEMS when:
  // - 3+ chargers
  // - Service upgrade cost > $8,000
  const shouldConsider = numberOfChargers >= 3 && serviceUpgradeCost > 8000;

  if (shouldConsider) {
    // EVEMS cost estimates (varies by system size)
    const evemsCost = numberOfChargers <= 5 ? 4500 : 6500;
    const savings = serviceUpgradeCost - evemsCost;

    return {
      shouldConsider: true,
      numberOfChargers,
      costComparison: {
        serviceUpgradeCost,
        evemsCost,
        savings
      },
      tradeoffs: [
        'Chargers share available capacity (not all can run at full power simultaneously)',
        'EVEMS system manages charging to prevent overload',
        'Faster installation (1-2 weeks vs. 4-6 weeks for service upgrade)',
        'Lower upfront cost',
        'Requires ongoing EVEMS system maintenance',
        'May limit charging speed during peak demand periods'
      ],
      recommendation:
        `Consider EVEMS load management system as alternative to service upgrade. ` +
        `Savings: $${savings.toLocaleString()} and 2-4 weeks faster installation. ` +
        `Trade-off: ${numberOfChargers} chargers will share available capacity rather than ` +
        `all charging at full power simultaneously.`
    };
  }

  return {
    shouldConsider: false,
    numberOfChargers,
    costComparison: {
      serviceUpgradeCost,
      evemsCost: 0,
      savings: 0
    },
    tradeoffs: [],
    recommendation: 'Service upgrade recommended. EVEMS less cost-effective for 1-2 chargers.'
  };
}

// ============================================================================
// LOAD TEMPLATES
// ============================================================================

/**
 * Pre-defined load templates for common additions
 * Organized by category for easy selection in Quick Mode
 */
export const LOAD_TEMPLATES: LoadTemplate[] = [
  // === EV CHARGERS ===
  {
    name: 'Level 2 EV Charger (32A)',
    kw: 7.7,
    continuous: true,
    category: 'EV',
    description: 'Most common residential EV charger (Tesla, ChargePoint, etc.) - requires 50A circuit'
  },
  {
    name: 'Level 2 EV Charger (40A)',
    kw: 9.6,
    continuous: true,
    category: 'EV',
    description: 'High-power Level 2 charger - requires 60A circuit'
  },
  {
    name: 'Level 2 EV Charger (48A)',
    kw: 11.5,
    continuous: true,
    category: 'EV',
    description: 'Max residential Level 2 charger (11.5kW) - requires 70A circuit'
  },
  {
    name: 'Level 2 EV Charger (80A)',
    kw: 19.2,
    continuous: true,
    category: 'EV',
    description: 'Commercial/industrial high-power charger - requires 100A circuit'
  },

  // === HVAC ===
  {
    name: 'Central A/C (2.5 Ton)',
    kw: 3.5,
    continuous: false,
    category: 'HVAC',
    description: 'Small to medium home air conditioning'
  },
  {
    name: 'Central A/C (3 Ton)',
    kw: 4.5,
    continuous: false,
    category: 'HVAC',
    description: 'Medium home air conditioning'
  },
  {
    name: 'Central A/C (5 Ton)',
    kw: 7.5,
    continuous: false,
    category: 'HVAC',
    description: 'Large home air conditioning'
  },
  {
    name: 'Heat Pump (3 Ton)',
    kw: 5.0,
    continuous: false,
    category: 'HVAC',
    description: 'Combined heating and cooling'
  },
  {
    name: 'Electric Furnace (10kW)',
    kw: 10.0,
    continuous: false,
    category: 'HVAC',
    description: 'Electric resistance heating'
  },
  {
    name: 'Mini-Split Heat Pump',
    kw: 3.0,
    continuous: false,
    category: 'HVAC',
    description: 'Ductless mini-split system'
  },

  // === APPLIANCES ===
  {
    name: 'Electric Range (8kW)',
    kw: 8.0,
    continuous: false,
    category: 'Appliance',
    description: 'Standard electric range/cooktop'
  },
  {
    name: 'Electric Dryer (5kW)',
    kw: 5.0,
    continuous: false,
    category: 'Appliance',
    description: 'Electric clothes dryer'
  },
  {
    name: 'Electric Water Heater (4.5kW)',
    kw: 4.5,
    continuous: true,
    category: 'Appliance',
    description: 'Standard electric water heater'
  },
  {
    name: 'Tankless Water Heater (18kW)',
    kw: 18.0,
    continuous: true,
    category: 'Appliance',
    description: 'Whole-house tankless electric water heater'
  },
  {
    name: 'Pool Pump (1.5 HP)',
    kw: 1.5,
    continuous: true,
    category: 'Appliance',
    description: 'Typical residential pool pump'
  },
  {
    name: 'Pool Heater (11kW)',
    kw: 11.0,
    continuous: false,
    category: 'Appliance',
    description: 'Electric pool heater'
  },
  {
    name: 'Hot Tub/Spa (6kW)',
    kw: 6.0,
    continuous: true,
    category: 'Appliance',
    description: 'Residential hot tub or spa'
  },
  {
    name: 'Well Pump (1 HP)',
    kw: 1.0,
    continuous: false,
    category: 'Appliance',
    description: 'Residential well pump'
  },

  // === SOLAR ===
  {
    name: 'Solar PV System (5kW)',
    kw: 5.0,
    continuous: false,
    category: 'Solar',
    description: 'Small residential solar array'
  },
  {
    name: 'Solar PV System (10kW)',
    kw: 10.0,
    continuous: false,
    category: 'Solar',
    description: 'Large residential solar array'
  },
  {
    name: 'Battery Storage (10kWh)',
    kw: 5.0,
    continuous: false,
    category: 'Solar',
    description: 'Home battery backup system (e.g., Tesla Powerwall)'
  }
];

/**
 * Convert load template to quick check amps (for Quick Mode)
 * Applies 125% continuous factor and converts to amps
 */
export function templateToQuickAmps(template: LoadTemplate, voltage: number = 240): number {
  const effectiveKW = template.continuous ? template.kw * 1.25 : template.kw;
  const amps = (effectiveKW * 1000) / voltage;
  return Math.round(amps);
}
