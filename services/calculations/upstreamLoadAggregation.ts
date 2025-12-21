/**
 * Upstream Load Aggregation Service - NEC Article 220 Compliant
 * 
 * Per NEC Article 220, demand factors must be applied to the TOTAL connected
 * load across the entire system served by a feeder, not per-panel.
 * 
 * CORRECT APPROACH:
 * 1. Collect ALL connected loads by type across entire downstream hierarchy
 * 2. Apply demand factors ONCE to system-wide totals
 * 3. Use occupancy type to determine which demand factors apply
 * 
 * INCORRECT (previous implementation):
 * - Calculating demand per-panel and then summing = WRONG
 * - Example: Two panels each with 8kVA receptacles would never hit 10kVA threshold
 *   when calculated separately, but combined 16kVA should have 10kVA@100% + 6kVA@50%
 * 
 * @module services/calculations/upstreamLoadAggregation
 */

import type { Database } from '@/lib/database.types';
import { getLightingDemandFactor } from '@/data/nec/table-220-42';

type Panel = Database['public']['Tables']['panels']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

// Occupancy type from project settings
type OccupancyType = 'dwelling' | 'commercial' | 'industrial';

/**
 * Collected loads by type across hierarchy (connected VA, not demand)
 */
export interface CollectedLoads {
  lighting: number;         // 'L' - Total lighting VA
  receptacles: number;      // 'R' - Total receptacle VA
  motors: number[];         // 'M' - Individual motor VAs (needed for largest motor calc)
  heating: number;          // 'H' - Total heating VA
  cooling: number;          // 'C' - Total cooling VA
  waterHeater: number;      // 'W' - Total water heater VA
  dryers: number[];         // 'D' - Individual dryer VAs (count matters per NEC 220.54)
  ranges: number[];         // 'K' - Individual range VAs (count matters per NEC 220.55)
  other: number;            // 'O' - Other loads at 100%
}

export interface DemandCalculation {
  loadType: string;
  connectedVA: number;
  demandVA: number;
  demandFactor: number;
  necReference: string;
}

export interface AggregatedLoad {
  panelId: string;
  panelName: string;
  occupancyType: OccupancyType;
  
  // Connected loads (before demand factors)
  totalConnectedVA: number;
  
  // Demand load (after applying NEC demand factors)
  totalDemandVA: number;
  
  // Overall demand factor achieved
  overallDemandFactor: number;
  
  // Breakdown by load type with demand calculations
  demandBreakdown: DemandCalculation[];
  
  // Source breakdown (direct vs downstream)
  sourceBreakdown: Array<{
    sourceId: string;
    sourceName: string;
    sourceType: 'direct' | 'panel' | 'transformer';
    connectedVA: number;
  }>;
  
  // Downstream counts
  downstreamPanelCount: number;
  transformerCount: number;
  
  // NEC references applied
  necReferences: string[];
}

/**
 * Creates empty collected loads object
 */
function createEmptyCollectedLoads(): CollectedLoads {
  return {
    lighting: 0,
    receptacles: 0,
    motors: [],
    heating: 0,
    cooling: 0,
    waterHeater: 0,
    dryers: [],
    ranges: [],
    other: 0,
  };
}

/**
 * Merges two CollectedLoads objects
 */
function mergeCollectedLoads(a: CollectedLoads, b: CollectedLoads): CollectedLoads {
  return {
    lighting: a.lighting + b.lighting,
    receptacles: a.receptacles + b.receptacles,
    motors: [...a.motors, ...b.motors],
    heating: a.heating + b.heating,
    cooling: a.cooling + b.cooling,
    waterHeater: a.waterHeater + b.waterHeater,
    dryers: [...a.dryers, ...b.dryers],
    ranges: [...a.ranges, ...b.ranges],
    other: a.other + b.other,
  };
}

/**
 * Collects all connected loads from a panel's circuits (no demand factors)
 */
function collectCircuitLoads(circuits: Circuit[]): CollectedLoads {
  const loads = createEmptyCollectedLoads();
  
  for (const circuit of circuits) {
    const va = circuit.load_watts || 0;
    const type = circuit.load_type || 'O';
    
    switch (type) {
      case 'L':
        loads.lighting += va;
        break;
      case 'R':
        loads.receptacles += va;
        break;
      case 'M':
        loads.motors.push(va); // Keep individual motor sizes
        break;
      case 'H':
        loads.heating += va;
        break;
      case 'C':
        loads.cooling += va;
        break;
      case 'W':
        loads.waterHeater += va;
        break;
      case 'D':
        loads.dryers.push(va); // Keep individual dryer sizes
        break;
      case 'K':
        loads.ranges.push(va); // Keep individual range sizes
        break;
      default:
        loads.other += va;
    }
  }
  
  return loads;
}

/**
 * PHASE 1: Recursively collects ALL connected loads across downstream hierarchy
 * Returns raw connected VA by type - NO demand factors applied yet
 */
function collectAllDownstreamLoads(
  panelId: string,
  panels: Panel[],
  circuits: Circuit[],
  transformers: Transformer[],
  visited: Set<string> = new Set()
): { loads: CollectedLoads; panelCount: number; transformerCount: number; sourceBreakdown: AggregatedLoad['sourceBreakdown'] } {
  
  // Prevent circular references
  if (visited.has(panelId)) {
    return { 
      loads: createEmptyCollectedLoads(), 
      panelCount: 0, 
      transformerCount: 0,
      sourceBreakdown: []
    };
  }
  visited.add(panelId);
  
  const panel = panels.find(p => p.id === panelId);
  if (!panel) {
    return { 
      loads: createEmptyCollectedLoads(), 
      panelCount: 0, 
      transformerCount: 0,
      sourceBreakdown: []
    };
  }
  
  const sourceBreakdown: AggregatedLoad['sourceBreakdown'] = [];
  
  // 1. Collect direct circuit loads from this panel
  const panelCircuits = circuits.filter(c => c.panel_id === panelId);
  let totalLoads = collectCircuitLoads(panelCircuits);
  
  const directConnected = panelCircuits.reduce((sum, c) => sum + (c.load_watts || 0), 0);
  if (directConnected > 0) {
    sourceBreakdown.push({
      sourceId: panelId,
      sourceName: `${panel.name} Direct`,
      sourceType: 'direct',
      connectedVA: directConnected,
    });
  }
  
  let panelCount = 0;
  let transformerCount = 0;
  
  // 2. Recursively collect from downstream panels
  const downstreamPanels = panels.filter(
    p => p.fed_from_type === 'panel' && p.fed_from === panelId
  );
  
  for (const downPanel of downstreamPanels) {
    const downstream = collectAllDownstreamLoads(
      downPanel.id,
      panels,
      circuits,
      transformers,
      new Set(visited)
    );
    
    totalLoads = mergeCollectedLoads(totalLoads, downstream.loads);
    panelCount += 1 + downstream.panelCount;
    transformerCount += downstream.transformerCount;
    
    // Calculate connected VA for this downstream panel
    const downstreamConnected = 
      downstream.loads.lighting +
      downstream.loads.receptacles +
      downstream.loads.motors.reduce((a, b) => a + b, 0) +
      downstream.loads.heating +
      downstream.loads.cooling +
      downstream.loads.waterHeater +
      downstream.loads.dryers.reduce((a, b) => a + b, 0) +
      downstream.loads.ranges.reduce((a, b) => a + b, 0) +
      downstream.loads.other;
    
    if (downstreamConnected > 0) {
      sourceBreakdown.push({
        sourceId: downPanel.id,
        sourceName: downPanel.name,
        sourceType: 'panel',
        connectedVA: downstreamConnected,
      });
    }
  }
  
  // 3. Recursively collect from transformers fed from this panel
  const fedTransformers = transformers.filter(t => t.fed_from_panel_id === panelId);
  
  for (const xfmr of fedTransformers) {
    const xfmrPanels = panels.filter(p => p.fed_from_transformer_id === xfmr.id);
    
    let xfmrTotalConnected = 0;
    
    for (const xfmrPanel of xfmrPanels) {
      const xfmrDownstream = collectAllDownstreamLoads(
        xfmrPanel.id,
        panels,
        circuits,
        transformers,
        new Set(visited)
      );
      
      totalLoads = mergeCollectedLoads(totalLoads, xfmrDownstream.loads);
      panelCount += 1 + xfmrDownstream.panelCount;
      
      xfmrTotalConnected += 
        xfmrDownstream.loads.lighting +
        xfmrDownstream.loads.receptacles +
        xfmrDownstream.loads.motors.reduce((a, b) => a + b, 0) +
        xfmrDownstream.loads.heating +
        xfmrDownstream.loads.cooling +
        xfmrDownstream.loads.waterHeater +
        xfmrDownstream.loads.dryers.reduce((a, b) => a + b, 0) +
        xfmrDownstream.loads.ranges.reduce((a, b) => a + b, 0) +
        xfmrDownstream.loads.other;
    }
    
    // If transformer has no panels, use its kVA rating
    if (xfmrPanels.length === 0 && xfmr.kva_rating) {
      totalLoads.other += xfmr.kva_rating * 1000;
      xfmrTotalConnected = xfmr.kva_rating * 1000;
    }
    
    transformerCount += 1;
    
    if (xfmrTotalConnected > 0) {
      sourceBreakdown.push({
        sourceId: xfmr.id,
        sourceName: xfmr.name || `Transformer ${xfmr.kva_rating}kVA`,
        sourceType: 'transformer',
        connectedVA: xfmrTotalConnected,
      });
    }
  }
  
  return { loads: totalLoads, panelCount, transformerCount, sourceBreakdown };
}

/**
 * NEC 220.44 - Receptacle Load Demand Factors
 * First 10kVA at 100%, remainder at 50%
 * Applies to commercial/industrial and dwelling units
 */
function calculateReceptacleDemand(totalVA: number): DemandCalculation {
  if (totalVA <= 10000) {
    return {
      loadType: 'Receptacles',
      connectedVA: totalVA,
      demandVA: totalVA,
      demandFactor: 1.0,
      necReference: 'NEC 220.44',
    };
  }
  
  const demandVA = 10000 + (totalVA - 10000) * 0.5;
  return {
    loadType: 'Receptacles',
    connectedVA: totalVA,
    demandVA: Math.round(demandVA),
    demandFactor: demandVA / totalVA,
    necReference: 'NEC 220.44 (First 10kVA @100%, remainder @50%)',
  };
}

/**
 * NEC 430.24 - Motor Load Demand
 * Largest motor at 125%, all others at 100%
 */
function calculateMotorDemand(motorLoads: number[]): DemandCalculation {
  if (motorLoads.length === 0) {
    return {
      loadType: 'Motors',
      connectedVA: 0,
      demandVA: 0,
      demandFactor: 0,
      necReference: 'NEC 430.24',
    };
  }
  
  const totalConnected = motorLoads.reduce((a, b) => a + b, 0);
  const sortedMotors = [...motorLoads].sort((a, b) => b - a);
  const largestMotor = sortedMotors[0] || 0;
  const otherMotors = sortedMotors.slice(1).reduce((a, b) => a + b, 0);

  // Largest at 125%, others at 100%
  const demandVA = (largestMotor * 1.25) + otherMotors;

  return {
    loadType: 'Motors',
    connectedVA: totalConnected,
    demandVA: Math.round(demandVA),
    demandFactor: totalConnected > 0 ? demandVA / totalConnected : 0,
    necReference: `NEC 430.24 (Largest ${(largestMotor/1000).toFixed(1)}kVA @125%, ${motorLoads.length - 1} others @100%)`,
  };
}

/**
 * NEC 220.54 - Electric Dryer Load Demand (Dwelling Units)
 * Based on count of dryers
 */
function calculateDryerDemand(dryerLoads: number[], occupancyType: OccupancyType): DemandCalculation {
  const totalConnected = dryerLoads.reduce((a, b) => a + b, 0);
  
  if (dryerLoads.length === 0) {
    return {
      loadType: 'Dryers',
      connectedVA: 0,
      demandVA: 0,
      demandFactor: 0,
      necReference: 'NEC 220.54',
    };
  }
  
  // NEC 220.54 applies to dwelling units
  if (occupancyType !== 'dwelling') {
    return {
      loadType: 'Dryers',
      connectedVA: totalConnected,
      demandVA: totalConnected,
      demandFactor: 1.0,
      necReference: 'NEC 220.54 (Non-dwelling - 100%)',
    };
  }
  
  // Table 220.54 demand factors based on count
  const count = dryerLoads.length;
  let demandFactor = 1.0;
  
  if (count <= 4) demandFactor = 1.0;
  else if (count === 5) demandFactor = 0.80;
  else if (count === 6) demandFactor = 0.70;
  else if (count === 7) demandFactor = 0.65;
  else if (count === 8) demandFactor = 0.60;
  else if (count === 9) demandFactor = 0.55;
  else if (count === 10) demandFactor = 0.50;
  else if (count === 11) demandFactor = 0.45;
  else demandFactor = 0.35 + (count > 23 ? 0 : (23 - count) * 0.01); // Simplified
  
  const demandVA = totalConnected * demandFactor;
  
  return {
    loadType: 'Dryers',
    connectedVA: totalConnected,
    demandVA: Math.round(demandVA),
    demandFactor,
    necReference: `NEC Table 220.54 (${count} dryers @${(demandFactor * 100).toFixed(0)}%)`,
  };
}

/**
 * NEC 220.55 - Electric Range Load Demand (Dwelling Units)
 * Simplified - uses Table 220.55 Column C for ranges over 8.75kW
 */
function calculateRangeDemand(rangeLoads: number[], occupancyType: OccupancyType): DemandCalculation {
  const totalConnected = rangeLoads.reduce((a, b) => a + b, 0);
  
  if (rangeLoads.length === 0) {
    return {
      loadType: 'Ranges/Ovens',
      connectedVA: 0,
      demandVA: 0,
      demandFactor: 0,
      necReference: 'NEC 220.55',
    };
  }
  
  // NEC 220.55 applies primarily to dwelling units
  if (occupancyType !== 'dwelling') {
    return {
      loadType: 'Ranges/Ovens',
      connectedVA: totalConnected,
      demandVA: totalConnected,
      demandFactor: 1.0,
      necReference: 'NEC 220.55 (Non-dwelling - 100%)',
    };
  }
  
  // Simplified Table 220.55 Column C (for ranges 8.75kW to 12kW)
  const count = rangeLoads.length;
  let demandKW: number;
  
  if (count === 1) demandKW = 8;
  else if (count === 2) demandKW = 11;
  else if (count === 3) demandKW = 14;
  else if (count === 4) demandKW = 17;
  else if (count === 5) demandKW = 20;
  else demandKW = 15 + (count * 1); // Simplified for larger counts
  
  const demandVA = demandKW * 1000;
  const demandFactor = totalConnected > 0 ? demandVA / totalConnected : 0;
  
  return {
    loadType: 'Ranges/Ovens',
    connectedVA: totalConnected,
    demandVA: Math.round(demandVA),
    demandFactor,
    necReference: `NEC Table 220.55 Col C (${count} ranges → ${demandKW}kW)`,
  };
}

/**
 * NEC 220.60 - Noncoincident Loads (Heating vs Cooling)
 * Use larger of heating or cooling, not both
 */
function calculateHvacDemand(heatingVA: number, coolingVA: number): DemandCalculation {
  const largerLoad = Math.max(heatingVA, coolingVA);
  const omittedLoad = Math.min(heatingVA, coolingVA);
  const loadType = heatingVA >= coolingVA ? 'Heating (larger)' : 'Cooling (larger)';
  
  return {
    loadType: `HVAC - ${loadType}`,
    connectedVA: heatingVA + coolingVA,
    demandVA: largerLoad,
    demandFactor: (heatingVA + coolingVA) > 0 ? largerLoad / (heatingVA + coolingVA) : 0,
    necReference: `NEC 220.60 (Omit ${(omittedLoad/1000).toFixed(1)}kVA ${heatingVA >= coolingVA ? 'cooling' : 'heating'})`,
  };
}

/**
 * PHASE 2: Apply demand factors to collected loads based on occupancy type
 */
function applyDemandFactors(
  loads: CollectedLoads,
  occupancyType: OccupancyType
): { demandBreakdown: DemandCalculation[]; totalDemandVA: number; necReferences: string[] } {
  
  const demandBreakdown: DemandCalculation[] = [];
  const necReferences: string[] = ['NEC 220.40 (Feeder Load Calculation)'];
  let totalDemandVA = 0;
  
  // 1. Lighting - Use Table 220.42 based on occupancy
  if (loads.lighting > 0) {
    // Map project occupancy to table occupancy
    let tableOccupancy = occupancyType === 'dwelling' ? 'dwelling' : 'office';
    
    const lightingDemand = getLightingDemandFactor(tableOccupancy, loads.lighting);
    demandBreakdown.push({
      loadType: 'Lighting',
      connectedVA: loads.lighting,
      demandVA: Math.round(lightingDemand.demandVA),
      demandFactor: lightingDemand.demandFactor,
      necReference: lightingDemand.necReference,
    });
    totalDemandVA += lightingDemand.demandVA;
    necReferences.push(lightingDemand.necReference);
  }
  
  // 2. Receptacles - NEC 220.44 (applies to all occupancies)
  if (loads.receptacles > 0) {
    const receptacleDemand = calculateReceptacleDemand(loads.receptacles);
    demandBreakdown.push(receptacleDemand);
    totalDemandVA += receptacleDemand.demandVA;
    necReferences.push(receptacleDemand.necReference);
  }
  
  // 3. Motors - NEC 430.24 (applies to all occupancies)
  if (loads.motors.length > 0) {
    const motorDemand = calculateMotorDemand(loads.motors);
    demandBreakdown.push(motorDemand);
    totalDemandVA += motorDemand.demandVA;
    necReferences.push(motorDemand.necReference);
  }
  
  // 4. HVAC - NEC 220.60 noncoincident loads
  if (loads.heating > 0 || loads.cooling > 0) {
    const hvacDemand = calculateHvacDemand(loads.heating, loads.cooling);
    demandBreakdown.push(hvacDemand);
    totalDemandVA += hvacDemand.demandVA;
    necReferences.push(hvacDemand.necReference);
  }
  
  // 5. Water Heater - typically 100%
  if (loads.waterHeater > 0) {
    demandBreakdown.push({
      loadType: 'Water Heater',
      connectedVA: loads.waterHeater,
      demandVA: loads.waterHeater,
      demandFactor: 1.0,
      necReference: 'NEC 220.51 (Fixed Appliances)',
    });
    totalDemandVA += loads.waterHeater;
  }
  
  // 6. Dryers - NEC 220.54
  if (loads.dryers.length > 0) {
    const dryerDemand = calculateDryerDemand(loads.dryers, occupancyType);
    demandBreakdown.push(dryerDemand);
    totalDemandVA += dryerDemand.demandVA;
    necReferences.push(dryerDemand.necReference);
  }
  
  // 7. Ranges - NEC 220.55
  if (loads.ranges.length > 0) {
    const rangeDemand = calculateRangeDemand(loads.ranges, occupancyType);
    demandBreakdown.push(rangeDemand);
    totalDemandVA += rangeDemand.demandVA;
    necReferences.push(rangeDemand.necReference);
  }
  
  // 8. Other loads at 100%
  if (loads.other > 0) {
    demandBreakdown.push({
      loadType: 'Other',
      connectedVA: loads.other,
      demandVA: loads.other,
      demandFactor: 1.0,
      necReference: 'NEC 220.14 (Other Loads @100%)',
    });
    totalDemandVA += loads.other;
  }
  
  return { demandBreakdown, totalDemandVA: Math.round(totalDemandVA), necReferences: [...new Set(necReferences)] };
}

/**
 * Main function: Calculates aggregated load for a panel including all downstream loads
 * Uses correct NEC approach: collect ALL loads first, then apply demand factors ONCE
 * 
 * @param panelId - The panel to calculate aggregated load for
 * @param panels - All panels in the project
 * @param circuits - All circuits in the project
 * @param transformers - All transformers in the project
 * @param occupancyType - Project occupancy type for demand factor selection
 * @returns AggregatedLoad with full breakdown
 */
export function calculateAggregatedLoad(
  panelId: string,
  panels: Panel[],
  circuits: Circuit[],
  transformers: Transformer[],
  occupancyType: OccupancyType = 'commercial'
): AggregatedLoad {
  const panel = panels.find(p => p.id === panelId);
  if (!panel) {
    return createEmptyAggregatedLoad(panelId, 'Panel not found', occupancyType);
  }
  
  // PHASE 1: Collect ALL connected loads across downstream hierarchy
  const { loads, panelCount, transformerCount, sourceBreakdown } = collectAllDownstreamLoads(
    panelId,
    panels,
    circuits,
    transformers
  );
  
  // Calculate total connected VA
  const totalConnectedVA = 
    loads.lighting +
    loads.receptacles +
    loads.motors.reduce((a, b) => a + b, 0) +
    loads.heating +
    loads.cooling +
    loads.waterHeater +
    loads.dryers.reduce((a, b) => a + b, 0) +
    loads.ranges.reduce((a, b) => a + b, 0) +
    loads.other;
  
  // PHASE 2: Apply demand factors to system-wide totals
  const { demandBreakdown, totalDemandVA, necReferences } = applyDemandFactors(loads, occupancyType);
  
  return {
    panelId,
    panelName: panel.name,
    occupancyType,
    totalConnectedVA,
    totalDemandVA,
    overallDemandFactor: totalConnectedVA > 0 ? totalDemandVA / totalConnectedVA : 0,
    demandBreakdown,
    sourceBreakdown,
    downstreamPanelCount: panelCount,
    transformerCount,
    necReferences,
  };
}

/**
 * Creates an empty aggregated load result
 */
function createEmptyAggregatedLoad(panelId: string, panelName: string, occupancyType: OccupancyType): AggregatedLoad {
  return {
    panelId,
    panelName,
    occupancyType,
    totalConnectedVA: 0,
    totalDemandVA: 0,
    overallDemandFactor: 0,
    demandBreakdown: [],
    sourceBreakdown: [],
    downstreamPanelCount: 0,
    transformerCount: 0,
    necReferences: [],
  };
}

/**
 * Gets aggregated loads for all panels in a project
 */
export function getAllPanelAggregatedLoads(
  panels: Panel[],
  circuits: Circuit[],
  transformers: Transformer[],
  occupancyType: OccupancyType = 'commercial'
): AggregatedLoad[] {
  return panels.map(panel => 
    calculateAggregatedLoad(panel.id, panels, circuits, transformers, occupancyType)
  );
}

/**
 * Determines which panels are affected when a circuit load changes
 * (All upstream panels need their aggregated loads recalculated)
 */
export function getAffectedUpstreamPanels(
  panelId: string,
  panels: Panel[]
): Panel[] {
  const affected: Panel[] = [];
  
  let current = panels.find(p => p.id === panelId);
  while (current) {
    if (current.fed_from_type === 'panel' && current.fed_from) {
      const upstream = panels.find(p => p.id === current!.fed_from);
      if (upstream) {
        affected.push(upstream);
        current = upstream;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  return affected;
}
