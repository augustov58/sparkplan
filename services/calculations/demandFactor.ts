/**
 * NEC Article 220 Demand Factor Calculations
 * Panel Schedule Load Analysis per 2023 NEC
 * 
 * Load Types:
 * L = Lighting (220.42, 220.44)
 * M = Motor (220.50, 430.24)
 * R = Receptacles (220.44)
 * O = Other (100% - no demand factor)
 * H = Heating (220.51, 220.60)
 * C = Cooling (220.60)
 * W = Water Heater (220.53)
 * D = Dryer (220.54, Table 220.54)
 * K = Kitchen Equipment (220.56)
 */

import type { LoadTypeCode } from '../../types';

export interface CircuitLoad {
  id: string;
  description: string;
  loadWatts: number;
  loadType: LoadTypeCode;
  pole: 1 | 2 | 3;
  circuitNumber: number;
  phase?: 'A' | 'B' | 'C';
}

export interface LoadByType {
  type: LoadTypeCode;
  label: string;
  connectedLoad_kVA: number;
  adjustmentFactor: number; // For motors (largest = 1.25, others = 1.0)
  demandFactor: number;
  demandLoad_kVA: number;
  circuits: CircuitLoad[];
}

export interface PhaseLoad {
  phase: 'A' | 'B' | 'C';
  connectedLoad_kVA: number;
  demandLoad_kVA: number;
}

export interface DemandCalculationResult {
  loadsByType: LoadByType[];
  phaseLoads: PhaseLoad[];
  totalConnectedLoad_kVA: number;
  totalDemandLoad_kVA: number;
  demandAmps: number;
  percentImbalance: number;
  voltage: number;
  phase: 1 | 3;
  necReferences: string[];
}

const LOAD_TYPE_LABELS: Record<LoadTypeCode, string> = {
  'L': 'Lighting',
  'M': 'Motor', 
  'R': 'Receptacles',
  'O': 'Other',
  'H': 'Heating',
  'C': 'Cooling',
  'W': 'Water Heater',
  'D': 'Dryer',
  'K': 'Kitchen Equipment',
};

/**
 * Determine which phase a circuit is on based on circuit number
 * 3-phase panels: 1,2→A, 3,4→B, 5,6→C, then repeat
 * Single-phase panels: 1,2→A, 3,4→B, then repeat
 */
export function getCircuitPhase(circuitNumber: number, panelPhase: 1 | 3): 'A' | 'B' | 'C' {
  if (panelPhase === 1) {
    // Single-phase: alternates A, B
    const row = Math.ceil(circuitNumber / 2);
    return (row % 2 === 1) ? 'A' : 'B';
  } else {
    // Three-phase: cycles A, B, C
    const row = Math.ceil(circuitNumber / 2);
    const phaseIndex = (row - 1) % 3;
    return ['A', 'B', 'C'][phaseIndex] as 'A' | 'B' | 'C';
  }
}

/**
 * Calculate NEC 220.42 Lighting Demand Factor
 * First 3000 VA at 100%, next 117,000 VA at 35%, remainder at 25%
 */
function calculateLightingDemandFactor(totalVA: number): number {
  if (totalVA <= 3000) {
    return 1.0;
  } else if (totalVA <= 120000) {
    const demandVA = 3000 + (totalVA - 3000) * 0.35;
    return demandVA / totalVA;
  } else {
    const demandVA = 3000 + (117000 * 0.35) + (totalVA - 120000) * 0.25;
    return demandVA / totalVA;
  }
}

/**
 * Calculate NEC 220.44 Receptacle Demand Factor
 * First 10 kVA at 100%, remainder at 50%
 */
function calculateReceptacleDemandFactor(totalVA: number): number {
  if (totalVA <= 10000) {
    return 1.0;
  } else {
    const demandVA = 10000 + (totalVA - 10000) * 0.5;
    return demandVA / totalVA;
  }
}

/**
 * Calculate NEC Table 220.54 Dryer Demand Factor
 * Based on number of dryers
 */
function calculateDryerDemandFactor(numDryers: number): number {
  // Table 220.54 demand factors
  const factors: Record<number, number> = {
    1: 1.00, 2: 1.00, 3: 1.00, 4: 1.00,
    5: 0.80, 6: 0.70, 7: 0.65, 8: 0.60,
    9: 0.55, 10: 0.50, 11: 0.50
  };
  if (numDryers <= 11) {
    return factors[numDryers] || 1.0;
  }
  // 12+ dryers: 47% + (count - 11) × 0.5%
  return Math.max(0.35, 0.47 - (numDryers - 11) * 0.005);
}

/**
 * Calculate NEC 220.56 Kitchen Equipment Demand Factor
 * Based on number of pieces of equipment
 */
function calculateKitchenDemandFactor(numEquipment: number): number {
  // Table 220.56 demand factors for commercial kitchens
  if (numEquipment <= 2) return 1.00;
  if (numEquipment === 3) return 0.90;
  if (numEquipment === 4) return 0.80;
  if (numEquipment === 5) return 0.70;
  if (numEquipment >= 6) return 0.65;
  return 1.0;
}

/**
 * Calculate demand factors for all load types per NEC Article 220
 */
export function calculatePanelDemand(
  circuits: CircuitLoad[],
  voltage: number,
  phase: 1 | 3
): DemandCalculationResult {
  const necReferences: string[] = [];
  
  // Group circuits by load type
  const circuitsByType = new Map<LoadTypeCode, CircuitLoad[]>();
  circuits.forEach(circuit => {
    const type = circuit.loadType || 'O';
    if (!circuitsByType.has(type)) {
      circuitsByType.set(type, []);
    }
    circuitsByType.get(type)!.push(circuit);
  });

  // Calculate loads by type
  const loadsByType: LoadByType[] = [];
  let largestMotorLoad = 0;
  let totalMotorLoad = 0;

  // First pass: identify largest motor for 125% rule
  const motors = circuitsByType.get('M') || [];
  motors.forEach(m => {
    if (m.loadWatts > largestMotorLoad) {
      largestMotorLoad = m.loadWatts;
    }
    totalMotorLoad += m.loadWatts;
  });

  // Process each load type
  const types: LoadTypeCode[] = ['L', 'R', 'M', 'H', 'C', 'W', 'D', 'K', 'O'];
  
  types.forEach(type => {
    const typeCircuits = circuitsByType.get(type) || [];
    if (typeCircuits.length === 0) return;

    const connectedVA = typeCircuits.reduce((sum, c) => sum + c.loadWatts, 0);
    const connectedKVA = connectedVA / 1000;

    let adjustmentFactor = 1.0;
    let demandFactor = 1.0;

    switch (type) {
      case 'L':
        demandFactor = calculateLightingDemandFactor(connectedVA);
        adjustmentFactor = 1.25; // Continuous load per 220.43
        necReferences.push('NEC 220.42 - Lighting Demand Factors');
        break;

      case 'R':
        demandFactor = calculateReceptacleDemandFactor(connectedVA);
        necReferences.push('NEC 220.44 - Receptacle Demand Factors');
        break;

      case 'M':
        // Largest motor at 125%, others at 100%
        if (motors.length > 0) {
          // Calculate: (largest × 1.25) + (total - largest × 1.0)
          const adjustedTotal = (largestMotorLoad * 1.25) + (totalMotorLoad - largestMotorLoad);
          adjustmentFactor = adjustedTotal / totalMotorLoad;
          demandFactor = 1.0; // Motors don't get additional demand factor reduction
          necReferences.push('NEC 430.24 - Largest Motor at 125%');
        }
        break;

      case 'H':
        // Heating typically at 100%, may use NEC 220.51 for 3+ heating units
        demandFactor = typeCircuits.length >= 4 ? 0.75 : 1.0;
        if (typeCircuits.length >= 4) {
          necReferences.push('NEC 220.51 - Fixed Electric Space Heating');
        }
        break;

      case 'C':
        // Cooling at 100% (usually omit heating if A/C larger per 220.60)
        demandFactor = 1.0;
        necReferences.push('NEC 220.60 - Noncoincident Loads (Heating/Cooling)');
        break;

      case 'W':
        // Water heaters - continuous load (125% adjustment already in sizing)
        adjustmentFactor = 1.25;
        demandFactor = 1.0;
        necReferences.push('NEC 220.53 - Appliance Loads');
        break;

      case 'D':
        demandFactor = calculateDryerDemandFactor(typeCircuits.length);
        necReferences.push('NEC Table 220.54 - Dryer Demand Factors');
        break;

      case 'K':
        demandFactor = calculateKitchenDemandFactor(typeCircuits.length);
        necReferences.push('NEC Table 220.56 - Kitchen Equipment Demand');
        break;

      case 'O':
      default:
        // Other loads at 100%
        demandFactor = 1.0;
        break;
    }

    const demandKVA = connectedKVA * adjustmentFactor * demandFactor;

    loadsByType.push({
      type,
      label: LOAD_TYPE_LABELS[type],
      connectedLoad_kVA: Math.round(connectedKVA * 100) / 100,
      adjustmentFactor: Math.round(adjustmentFactor * 100) / 100,
      demandFactor: Math.round(demandFactor * 100) / 100,
      demandLoad_kVA: Math.round(demandKVA * 100) / 100,
      circuits: typeCircuits,
    });
  });

  // Calculate phase loads
  const phaseLoadsMap: Record<'A' | 'B' | 'C', { connected: number; demand: number }> = {
    'A': { connected: 0, demand: 0 },
    'B': { connected: 0, demand: 0 },
    'C': { connected: 0, demand: 0 },
  };

  circuits.forEach(circuit => {
    const circuitPhase = circuit.phase || getCircuitPhase(circuit.circuitNumber, phase);
    const loadVA = circuit.loadWatts;
    
    // For multi-pole circuits, distribute evenly
    if (circuit.pole === 2) {
      // 2-pole: split between two phases
      phaseLoadsMap[circuitPhase].connected += loadVA / 2;
      const nextPhase = circuitPhase === 'A' ? 'B' : circuitPhase === 'B' ? 'C' : 'A';
      phaseLoadsMap[nextPhase].connected += loadVA / 2;
    } else if (circuit.pole === 3) {
      // 3-pole: split evenly across all three
      phaseLoadsMap['A'].connected += loadVA / 3;
      phaseLoadsMap['B'].connected += loadVA / 3;
      phaseLoadsMap['C'].connected += loadVA / 3;
    } else {
      phaseLoadsMap[circuitPhase].connected += loadVA;
    }
  });

  // Apply demand factors to phase loads (simplified - uses overall ratio)
  const totalConnected = loadsByType.reduce((sum, lt) => sum + lt.connectedLoad_kVA, 0);
  const totalDemand = loadsByType.reduce((sum, lt) => sum + lt.demandLoad_kVA, 0);
  const overallDemandRatio = totalConnected > 0 ? totalDemand / totalConnected : 1;

  const phaseLoads: PhaseLoad[] = [];
  const phases = phase === 1 ? ['A', 'B'] as const : ['A', 'B', 'C'] as const;
  
  phases.forEach(p => {
    const connectedKVA = phaseLoadsMap[p].connected / 1000;
    phaseLoads.push({
      phase: p,
      connectedLoad_kVA: Math.round(connectedKVA * 100) / 100,
      demandLoad_kVA: Math.round(connectedKVA * overallDemandRatio * 100) / 100,
    });
  });

  // Calculate total demand amps
  let demandAmps: number;
  if (phase === 1) {
    // Single-phase: I = VA / V
    demandAmps = (totalDemand * 1000) / voltage;
  } else {
    // Three-phase: I = VA / (V × √3)
    demandAmps = (totalDemand * 1000) / (voltage * Math.sqrt(3));
  }

  // Calculate phase imbalance
  const phaseValues = phaseLoads.map(p => p.connectedLoad_kVA);
  const maxPhase = Math.max(...phaseValues);
  const minPhase = Math.min(...phaseValues);
  const avgPhase = phaseValues.reduce((a, b) => a + b, 0) / phaseValues.length;
  const percentImbalance = avgPhase > 0 ? ((maxPhase - minPhase) / avgPhase) * 100 : 0;

  return {
    loadsByType: loadsByType.filter(lt => lt.circuits.length > 0),
    phaseLoads,
    totalConnectedLoad_kVA: Math.round(totalConnected * 100) / 100,
    totalDemandLoad_kVA: Math.round(totalDemand * 100) / 100,
    demandAmps: Math.round(demandAmps * 10) / 10,
    percentImbalance: Math.round(percentImbalance * 10) / 10,
    voltage,
    phase,
    necReferences: [...new Set(necReferences)], // Remove duplicates
  };
}

/**
 * Get color for load type (for UI display)
 */
export function getLoadTypeColor(type: LoadTypeCode): string {
  const colors: Record<LoadTypeCode, string> = {
    'L': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'M': 'bg-blue-100 text-blue-800 border-blue-300',
    'R': 'bg-green-100 text-green-800 border-green-300',
    'O': 'bg-gray-100 text-gray-800 border-gray-300',
    'H': 'bg-red-100 text-red-800 border-red-300',
    'C': 'bg-cyan-100 text-cyan-800 border-cyan-300',
    'W': 'bg-orange-100 text-orange-800 border-orange-300',
    'D': 'bg-purple-100 text-purple-800 border-purple-300',
    'K': 'bg-pink-100 text-pink-800 border-pink-300',
  };
  return colors[type] || colors['O'];
}

