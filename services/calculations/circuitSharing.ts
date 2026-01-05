/**
 * Circuit Sharing Calculator
 *
 * Allows EV charger to share circuit with dryer, HVAC, or other 240V appliances
 * using smart switching devices that ensure only one load operates at a time.
 *
 * Popular Devices:
 * - NeoCharge Smart Splitter (~$450)
 * - DCC-9 by Enel X (~$400)
 * - Tesla Wall Connector with load sharing (built-in)
 * - SplitVolt (~$350)
 *
 * NEC References:
 * - NEC 625.42 - Electric Vehicle Branch Circuit
 * - NEC 220.87 - Determining Existing Loads
 * - NEC 210.23 - Permissible Loads (outlet devices)
 */

import type {
  CircuitSharingInput,
  CircuitSharingResult,
  CircuitShareDevice,
  CircuitSharingDeviceType
} from '../../types';

// ============================================================================
// Device Database
// ============================================================================

interface CircuitSharingDevice {
  type: CircuitSharingDeviceType;
  name: string;
  manufacturer: string;
  cost: { min: number; max: number };
  maxAmps: number;
  compatibleWith: CircuitShareDevice[];
  features: string[];
  installationNotes: string[];
}

const CIRCUIT_SHARING_DEVICES: CircuitSharingDevice[] = [
  {
    type: 'neocharge',
    name: 'NeoCharge Smart Splitter',
    manufacturer: 'NeoCharge',
    cost: { min: 400, max: 500 },
    maxAmps: 50,
    compatibleWith: ['dryer', 'hvac', 'water_heater'],
    features: [
      'Works with any J1772 EV charger',
      'Automatic load sensing',
      'WiFi connectivity for monitoring',
      '2-year warranty'
    ],
    installationNotes: [
      'Installs at existing outlet location',
      'No electrical panel work required',
      'Plug-and-play installation (~30 min)',
      'Requires 4-prong NEMA 14-30 or 14-50 outlet'
    ]
  },
  {
    type: 'dcc9',
    name: 'DCC-9 Smart Splitter',
    manufacturer: 'Enel X (formerly Enel)',
    cost: { min: 350, max: 450 },
    maxAmps: 40,
    compatibleWith: ['dryer', 'water_heater'],
    features: [
      'Compact design',
      'Load sensing technology',
      'UL Listed',
      '3-year warranty'
    ],
    installationNotes: [
      'Wall-mounted installation',
      'Works with 30A and 40A circuits',
      'Professional installation recommended',
      'Compatible with most Level 2 chargers'
    ]
  },
  {
    type: 'tesla_splitter',
    name: 'Tesla Wall Connector (Power Sharing)',
    manufacturer: 'Tesla',
    cost: { min: 475, max: 550 },
    maxAmps: 48,
    compatibleWith: ['dryer', 'hvac'],
    features: [
      'Built-in power sharing (up to 6 units)',
      'WiFi enabled',
      'Works with any EV (J1772 adapter available)',
      'Sleek design'
    ],
    installationNotes: [
      'Hardwired installation required',
      'Can share circuit with compatible Tesla chargers',
      'Requires dedicated circuit for power sharing mode',
      'Professional installation required'
    ]
  },
  {
    type: 'splitvolt',
    name: 'SplitVolt Outlet Splitter',
    manufacturer: 'SplitVolt',
    cost: { min: 300, max: 400 },
    maxAmps: 40,
    compatibleWith: ['dryer', 'water_heater'],
    features: [
      'Most affordable option',
      'Simple design',
      'No WiFi required',
      '1-year warranty'
    ],
    installationNotes: [
      'Plugs into existing outlet',
      'DIY-friendly installation',
      'Works with NEMA 10-30 and 14-30 outlets',
      'Manual priority selection'
    ]
  }
];

// ============================================================================
// Cost Database for Service Upgrades (for comparison)
// ============================================================================

interface ServiceUpgradeCostEstimate {
  fromAmps: number;
  toAmps: number;
  cost: { min: number; max: number };
  timeline: string;
}

const SERVICE_UPGRADE_COSTS: ServiceUpgradeCostEstimate[] = [
  { fromAmps: 100, toAmps: 200, cost: { min: 2800, max: 4500 }, timeline: '2-4 days' },
  { fromAmps: 150, toAmps: 200, cost: { min: 1800, max: 3000 }, timeline: '1-2 days' },
  { fromAmps: 200, toAmps: 300, cost: { min: 3500, max: 5500 }, timeline: '3-5 days' },
  { fromAmps: 200, toAmps: 400, cost: { min: 5000, max: 8000 }, timeline: '4-7 days' }
];

// ============================================================================
// Wire Size Lookup
// ============================================================================

const WIRE_SIZE_BY_AMPS: Record<number, string> = {
  30: '#10 AWG Cu',
  40: '#8 AWG Cu',
  50: '#6 AWG Cu',
  60: '#4 AWG Cu'
};

// ============================================================================
// Main Calculation Function
// ============================================================================

export function calculateCircuitSharing(input: CircuitSharingInput): CircuitSharingResult {
  const {
    serviceRating,
    currentUtilization,
    proposedEVChargerAmps,
    shareWith,
    existingCircuitAmps,
    dryerUsagePattern,
    evChargingSchedule
  } = input;

  // Determine required circuit size (max of EV charger and shared device)
  const requiredCircuitAmps = Math.max(proposedEVChargerAmps, existingCircuitAmps);

  // Find compatible devices
  const compatibleDevices = CIRCUIT_SHARING_DEVICES.filter(device =>
    device.compatibleWith.includes(shareWith) && device.maxAmps >= requiredCircuitAmps
  );

  // Check basic compatibility
  const isCircuitSizeOK = requiredCircuitAmps <= 50; // Most splitters max at 50A
  const isDeviceAvailable = compatibleDevices.length > 0;

  // Calculate compatibility score (0-100)
  let compatibilityScore = 100;
  let incompatibilityReasons: string[] = [];

  // Check 1: Circuit size compatibility
  if (!isCircuitSizeOK) {
    compatibilityScore -= 50;
    incompatibilityReasons.push(`Circuit requirement (${requiredCircuitAmps}A) exceeds splitter capacity`);
  }

  // Check 2: Usage pattern compatibility
  const usageConflict = checkUsageConflict(shareWith, dryerUsagePattern, evChargingSchedule);
  if (usageConflict === 'high') {
    compatibilityScore -= 30;
    incompatibilityReasons.push('High likelihood of usage conflicts (both devices used at same time)');
  } else if (usageConflict === 'moderate') {
    compatibilityScore -= 15;
  }

  // Check 3: Service capacity (if already near capacity, sharing helps less)
  if (currentUtilization > 95) {
    compatibilityScore -= 20;
    incompatibilityReasons.push('Service already near capacity - circuit sharing may not provide enough relief');
  }

  // Check 4: Share device type
  if (shareWith === 'range') {
    compatibilityScore -= 40;
    incompatibilityReasons.push('Sharing with range not recommended (frequent, long usage cycles)');
  }

  const isCompatible = compatibilityScore >= 50 && isDeviceAvailable;

  // Select best device
  const recommendedDevice = selectBestDevice(compatibleDevices, proposedEVChargerAmps, shareWith);

  // Calculate expected charging performance
  const chargingAnalysis = calculateChargingPerformance(
    proposedEVChargerAmps,
    shareWith,
    dryerUsagePattern,
    evChargingSchedule
  );

  // Get service upgrade cost for comparison
  const upgradeCost = getServiceUpgradeCost(serviceRating);

  // Calculate total installed cost
  const installationCost = 150; // Typical installation labor
  const totalCircuitSharingCost = recommendedDevice
    ? (recommendedDevice.cost.min + recommendedDevice.cost.max) / 2 + installationCost
    : 0;

  // Build result
  const result: CircuitSharingResult = {
    isCompatible,
    compatibilityScore: Math.max(0, compatibilityScore),
    incompatibilityReason: incompatibilityReasons.length > 0
      ? incompatibilityReasons.join('. ')
      : undefined,

    recommendedDevice: recommendedDevice?.type || 'neocharge',
    deviceName: recommendedDevice?.name || 'NeoCharge Smart Splitter',
    deviceCost: recommendedDevice?.cost || { min: 400, max: 500 },

    installationNotes: recommendedDevice?.installationNotes || [],
    circuitRequirements: {
      circuitAmps: requiredCircuitAmps,
      wireSize: WIRE_SIZE_BY_AMPS[requiredCircuitAmps] || '#8 AWG Cu',
      breakerType: `${requiredCircuitAmps}A 2-pole breaker`
    },

    expectedChargingHours: chargingAnalysis.hoursFor30Miles,
    chargingPausesExpected: chargingAnalysis.pauseFrequency,

    costComparison: {
      circuitSharingCost: totalCircuitSharingCost,
      serviceUpgradeCost: upgradeCost.cost,
      savings: {
        min: upgradeCost.cost.min - totalCircuitSharingCost,
        max: upgradeCost.cost.max - totalCircuitSharingCost
      }
    },

    upgradeAlternative: {
      newServiceSize: getNextServiceSize(serviceRating),
      estimatedCost: upgradeCost.cost,
      timeline: upgradeCost.timeline
    },

    necReferences: [
      'NEC 625.42 - Electric Vehicle Branch Circuit',
      'NEC 220.87 - Determining Existing Loads',
      'NEC 210.23 - Permissible Loads'
    ],
    warnings: generateWarnings(input, isCompatible, compatibilityScore)
  };

  return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

function checkUsageConflict(
  shareWith: CircuitShareDevice,
  dryerPattern: string,
  evSchedule: string
): 'low' | 'moderate' | 'high' {
  // Overnight EV charging has lowest conflict with most devices
  if (evSchedule === 'overnight') {
    return 'low'; // Dryer/HVAC rarely used 11pm-7am
  }

  // Daytime EV charging + daytime dryer = moderate conflict
  if (evSchedule === 'daytime' && dryerPattern === 'daytime') {
    return 'moderate';
  }

  // Evening usage has highest conflict
  if (evSchedule === 'daytime' && dryerPattern === 'evening') {
    return 'moderate';
  }

  // HVAC sharing during hot/cold days = frequent pauses
  if (shareWith === 'hvac') {
    return 'moderate';
  }

  // Variable patterns = unpredictable
  if (dryerPattern === 'variable' || evSchedule === 'flexible') {
    return 'moderate';
  }

  return 'low';
}

function selectBestDevice(
  compatibleDevices: CircuitSharingDevice[],
  evAmps: number,
  shareWith: CircuitShareDevice
): CircuitSharingDevice | undefined {
  if (compatibleDevices.length === 0) {
    // Return NeoCharge as default (most versatile)
    return CIRCUIT_SHARING_DEVICES.find(d => d.type === 'neocharge');
  }

  // Sort by best fit
  const scored = compatibleDevices.map(device => {
    let score = 0;

    // Prefer devices with adequate capacity (not overkill)
    if (device.maxAmps >= evAmps && device.maxAmps <= evAmps + 10) {
      score += 20;
    }

    // Prefer NeoCharge for dryer sharing (most reviews)
    if (shareWith === 'dryer' && device.type === 'neocharge') {
      score += 15;
    }

    // Prefer cheaper options
    const avgCost = (device.cost.min + device.cost.max) / 2;
    if (avgCost < 400) {
      score += 10;
    }

    // Prefer devices with more features
    score += device.features.length * 2;

    return { device, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.device;
}

function calculateChargingPerformance(
  evAmps: number,
  shareWith: CircuitShareDevice,
  dryerPattern: string,
  evSchedule: string
): { hoursFor30Miles: number; pauseFrequency: 'rare' | 'occasional' | 'frequent' } {
  // Base charging rate: ~25-30 miles per hour at 240V
  // At 32A = ~25 mi/hr, 40A = ~30 mi/hr, 48A = ~36 mi/hr
  const milesPerHour = evAmps * 0.75; // Rough approximation
  const baseHoursFor30Miles = 30 / milesPerHour;

  // Adjust for expected interruptions
  let pauseFrequency: 'rare' | 'occasional' | 'frequent' = 'rare';
  let timeMultiplier = 1.0;

  if (evSchedule === 'overnight') {
    // Overnight charging = minimal interruptions
    pauseFrequency = 'rare';
    timeMultiplier = 1.05;
  } else if (shareWith === 'hvac') {
    // HVAC cycles frequently
    pauseFrequency = 'frequent';
    timeMultiplier = 1.3;
  } else if (dryerPattern === 'variable') {
    pauseFrequency = 'occasional';
    timeMultiplier = 1.15;
  } else {
    pauseFrequency = 'occasional';
    timeMultiplier = 1.1;
  }

  return {
    hoursFor30Miles: Math.round(baseHoursFor30Miles * timeMultiplier * 10) / 10,
    pauseFrequency
  };
}

function getServiceUpgradeCost(currentService: number): { cost: { min: number; max: number }; timeline: string } {
  const nextSize = getNextServiceSize(currentService);
  const upgrade = SERVICE_UPGRADE_COSTS.find(
    u => u.fromAmps === currentService && u.toAmps === nextSize
  );

  if (upgrade) {
    return { cost: upgrade.cost, timeline: upgrade.timeline };
  }

  // Default estimate
  return {
    cost: { min: 3000, max: 5000 },
    timeline: '3-5 days'
  };
}

function getNextServiceSize(current: number): number {
  if (current < 150) return 200;
  if (current < 200) return 200;
  if (current < 300) return 300;
  return 400;
}

function generateWarnings(
  input: CircuitSharingInput,
  isCompatible: boolean,
  score: number
): string[] {
  const warnings: string[] = [];

  if (!isCompatible) {
    warnings.push('Circuit sharing may not be suitable for this installation');
  }

  if (input.shareWith === 'hvac') {
    warnings.push('HVAC sharing may cause frequent charging pauses during extreme weather');
  }

  if (input.proposedEVChargerAmps > 40 && input.existingCircuitAmps < 50) {
    warnings.push('Consider upgrading circuit to 50A to maximize EV charging speed');
  }

  if (input.evChargingSchedule !== 'overnight') {
    warnings.push('Overnight charging recommended to minimize conflicts with shared device');
  }

  if (score < 70 && score >= 50) {
    warnings.push('Marginal compatibility - monitor performance after installation');
  }

  return warnings;
}

// ============================================================================
// Utility Functions for UI
// ============================================================================

/**
 * Get default circuit amps for a shared device type
 */
export function getDefaultCircuitAmps(device: CircuitShareDevice): number {
  switch (device) {
    case 'dryer':
      return 30;
    case 'hvac':
      return 40;
    case 'water_heater':
      return 30;
    case 'range':
      return 50;
    default:
      return 30;
  }
}

/**
 * Get display name for device type
 */
export function getDeviceDisplayName(device: CircuitShareDevice): string {
  switch (device) {
    case 'dryer':
      return 'Electric Dryer';
    case 'hvac':
      return 'HVAC System';
    case 'water_heater':
      return 'Water Heater';
    case 'range':
      return 'Electric Range';
    default:
      return device;
  }
}

/**
 * Get all available circuit sharing devices
 */
export function getAvailableDevices(): CircuitSharingDevice[] {
  return CIRCUIT_SHARING_DEVICES;
}

/**
 * Quick check if circuit sharing is worth considering
 */
export function shouldConsiderCircuitSharing(
  currentUtilization: number,
  proposedEVAmps: number
): { recommend: boolean; reason: string } {
  // If plenty of capacity, no need for circuit sharing
  if (currentUtilization < 60) {
    return {
      recommend: false,
      reason: 'Sufficient service capacity available - circuit sharing not needed'
    };
  }

  // If near capacity (70-95%), circuit sharing is a great option
  if (currentUtilization >= 70 && currentUtilization <= 95) {
    return {
      recommend: true,
      reason: `Service is ${currentUtilization}% utilized - circuit sharing can avoid upgrade`
    };
  }

  // If very high utilization, may need upgrade anyway
  if (currentUtilization > 95) {
    return {
      recommend: false,
      reason: 'Service near maximum capacity - upgrade likely needed regardless'
    };
  }

  // Moderate utilization - optional
  return {
    recommend: true,
    reason: 'Circuit sharing is a cost-effective alternative to service upgrade'
  };
}
