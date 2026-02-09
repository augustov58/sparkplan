/**
 * Multi-Family Project Generator
 *
 * Generates a complete set of electrical entities (panels, circuits, meter stack,
 * meters, feeders) from a MultiFamilyEVResult and selected scenario.
 *
 * This is the core business logic that bridges the MF EV Calculator to
 * a permit-ready project design.
 *
 * NEC References:
 * - NEC 220.84 - Multi-Family Demand Factors
 * - NEC 220.57 - EVSE Load
 * - NEC 625.42 - EVEMS
 * - NEC 210.11 - Branch Circuits Required (dwelling units)
 * - NEC 408 - Meter Socket Enclosures
 *
 * @module services/autogeneration/multiFamilyProjectGenerator
 */

import type { Database } from '@/lib/database.types';
import type { MultiFamilyEVResult, EVCapacityScenario, CommonAreaLoadItem } from '@/services/calculations/multiFamilyEV';
import { calculateCommonAreaLoads } from '@/services/calculations/multiFamilyEV';
import { generateCustomEVPanel, type CustomEVPanelConfig } from '@/data/ev-panel-templates';

type PanelInsert = Database['public']['Tables']['panels']['Insert'];
type CircuitInsert = Database['public']['Tables']['circuits']['Insert'];
type MeterStackInsert = Database['public']['Tables']['meter_stacks']['Insert'];
type MeterInsert = Database['public']['Tables']['meters']['Insert'];
type FeederInsert = Database['public']['Tables']['feeders']['Insert'];

// ============================================================================
// TYPES
// ============================================================================

export type ScenarioKey = 'noEVEMS' | 'withEVEMS' | 'withUpgrade';

/** Appliance wattages for unit panel circuit generation (from DwellingLoadCalculator) */
export interface UnitApplianceConfig {
  rangeKW?: number;
  dryerKW?: number;
  waterHeaterKW?: number;
  coolingKW?: number;
  heatingKW?: number;
  dishwasherKW?: number;
  disposalKW?: number;
}

export interface GenerationOptions {
  /** Which scenario to apply */
  scenario: ScenarioKey;

  /** Project context */
  projectId: string;
  voltage: number;
  phase: 1 | 3;

  /** Building details */
  dwellingUnits: number;
  avgUnitSqFt: number;
  buildingName?: string;

  /** EV charger config */
  evAmpsPerCharger: number;
  evChargerLevel: 'Level1' | 'Level2';

  /** Common area load (VA) for house panel circuits */
  commonAreaLoadVA: number;

  /** Itemized common area loads for detailed house panel circuit generation */
  commonAreaItems?: CommonAreaLoadItem[];

  /** Whether building has electric cooking/heat (affects unit panel sizing) */
  hasElectricCooking: boolean;
  hasElectricHeat: boolean;

  /** Actual appliance wattages from DwellingLoadCalculator settings */
  applianceConfig?: UnitApplianceConfig;
}

/**
 * Generated entities ready for DB insertion.
 * IDs are placeholders — the orchestrator replaces them with real UUIDs.
 */
export interface GeneratedProject {
  mdp: Omit<PanelInsert, 'id'>;
  meterStack: Omit<MeterStackInsert, 'id'>;
  housePanel: Omit<PanelInsert, 'id'>;
  evPanel: Omit<PanelInsert, 'id'>;
  evCircuits: Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[];
  unitPanels: Omit<PanelInsert, 'id'>[];
  unitCircuits: Map<number, Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[]>; // key = unit index
  houseCircuits: Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[];
  meters: {
    type: 'unit' | 'house' | 'ev';
    name: string;
    position: number;
    panelRef: 'house' | 'ev' | { unitIndex: number };
    breakerAmps?: number;
  }[];
  feeders: {
    name: string;
    sourceRef: 'mdp';
    destRef: 'house' | 'ev' | { unitIndex: number };
    distance_ft: number;
  }[];
  summary: {
    scenarioName: string;
    totalPanels: number;
    totalCircuits: number;
    totalMeters: number;
    mdpRating: number;
    evChargers: number;
  };
}

// ============================================================================
// STANDARD PANEL SIZES
// ============================================================================

const STANDARD_PANEL_SIZES = [100, 125, 150, 200, 225, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000];
const STANDARD_BREAKER_SIZES = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400];

function roundUpToStandardSize(amps: number, sizes: number[]): number {
  return sizes.find(s => s >= amps) || sizes[sizes.length - 1]!;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate complete multi-family project from MF EV calculator results.
 */
export function generateMultiFamilyProject(
  result: MultiFamilyEVResult,
  options: GenerationOptions
): GeneratedProject {
  const { scenario, projectId, voltage, phase, dwellingUnits } = options;

  const selectedScenario = result.scenarios[scenario];
  const evChargers = Math.min(selectedScenario.maxChargers, result.input.evChargersRequested);

  // Use recommended service amps from the scenario or the existing service
  const serviceAmps = scenario === 'withUpgrade'
    ? (selectedScenario.recommendedServiceAmps || result.serviceAnalysis.existingCapacityAmps)
    : result.serviceAnalysis.existingCapacityAmps;

  const mdpRating = roundUpToStandardSize(serviceAmps, STANDARD_PANEL_SIZES);

  // ---- MDP ----
  const mdp = generateMDP(projectId, mdpRating, voltage, phase, options.buildingName);

  // ---- Meter Stack ----
  const meterStack = generateMeterStack(projectId, mdpRating, voltage, phase, dwellingUnits);

  // ---- House Panel ----
  const { panel: housePanel, circuits: houseCircuits } = generateHousePanel(
    projectId, voltage, phase, options.commonAreaLoadVA, options.commonAreaItems
  );

  // ---- EV Panel (reuse proven generateCustomEVPanel) ----
  const { panel: evPanel, circuits: evCircuits } = generateEVPanel(
    projectId, evChargers, options.evAmpsPerCharger, options.evChargerLevel,
    scenario !== 'noEVEMS', selectedScenario
  );

  // ---- Unit Panels ----
  const { panels: unitPanels, circuits: unitCircuits } = generateUnitPanels(
    projectId, dwellingUnits, options.avgUnitSqFt, voltage, phase,
    options.hasElectricCooking, options.hasElectricHeat, options.applianceConfig
  );

  // ---- Meters ----
  const meters = generateMeters(dwellingUnits);

  // ---- Feeders: skip auto-creation (panels already linked via fed_from) ----
  const feeders: GeneratedProject['feeders'] = [];

  // ---- Summary ----
  const totalCircuits = houseCircuits.length + evCircuits.length +
    Array.from(unitCircuits.values()).reduce((sum, c) => sum + c.length, 0);

  return {
    mdp,
    meterStack,
    housePanel,
    evPanel,
    evCircuits,
    unitPanels,
    unitCircuits,
    houseCircuits,
    meters,
    feeders,
    summary: {
      scenarioName: selectedScenario.name,
      totalPanels: 1 + 1 + 1 + unitPanels.length, // MDP + house + EV + units
      totalCircuits,
      totalMeters: meters.length,
      mdpRating,
      evChargers,
    },
  };
}

// ============================================================================
// BASIC GENERATOR (NO EV)
// ============================================================================

/**
 * Options for basic multi-family project generation (no EV infrastructure).
 * Used by DwellingLoadCalculator when EV charging is not needed.
 */
export interface BasicGenerationOptions {
  projectId: string;
  voltage: number;
  phase: 1 | 3;
  dwellingUnits: number;
  avgUnitSqFt: number;
  buildingName?: string;
  serviceAmps: number;
  commonAreaLoadVA: number;
  hasElectricCooking: boolean;
  hasElectricHeat: boolean;
  applianceConfig?: UnitApplianceConfig;
}

/**
 * Generate a multi-family project without EV infrastructure.
 * Creates MDP, meter stack, house panel, and unit panels — no EV panel.
 */
export function generateBasicMultiFamilyProject(
  options: BasicGenerationOptions
): GeneratedProject {
  const {
    projectId, voltage, phase, dwellingUnits, avgUnitSqFt,
    serviceAmps, commonAreaLoadVA, hasElectricCooking, hasElectricHeat
  } = options;

  const mdpRating = roundUpToStandardSize(serviceAmps, STANDARD_PANEL_SIZES);

  // ---- MDP ----
  const mdp = generateMDP(projectId, mdpRating, voltage, phase, options.buildingName);

  // ---- Meter Stack ----
  const meterStack = generateMeterStack(projectId, mdpRating, voltage, phase, dwellingUnits);
  // Adjust positions: no EV meter, so units + house + spares
  meterStack.num_meter_positions = Math.min(
    dwellingUnits + 1 + Math.ceil(dwellingUnits * 0.1),
    200
  );

  // ---- House Panel ----
  const { panel: housePanel, circuits: houseCircuits } = generateHousePanel(
    projectId, voltage, phase, commonAreaLoadVA
  );

  // ---- Empty EV Panel placeholder (required by GeneratedProject type) ----
  const evPanel: Omit<PanelInsert, 'id'> = {
    project_id: projectId,
    name: 'EV Panel (Not Required)',
    voltage: 240,
    phase: 1,
    bus_rating: 100,
    is_main: false,
    fed_from_type: 'panel',
    location: 'N/A',
  };

  // ---- Unit Panels ----
  const { panels: unitPanels, circuits: unitCircuits } = generateUnitPanels(
    projectId, dwellingUnits, avgUnitSqFt, voltage, phase,
    hasElectricCooking, hasElectricHeat, options.applianceConfig
  );

  // ---- Meters (no EV meter) ----
  const meters: GeneratedProject['meters'] = [];
  let position = 1;
  meters.push({ type: 'house', name: 'House Meter', position: position++, panelRef: 'house' });
  const metersToCreate = Math.min(dwellingUnits, 20);
  for (let i = 0; i < metersToCreate; i++) {
    meters.push({
      type: 'unit',
      name: `Unit ${i + 101} Meter`,
      position: position++,
      panelRef: { unitIndex: i },
    });
  }

  // ---- Feeders: skip auto-creation (panels already linked via fed_from) ----
  // Stub feeders have no conductor sizing and show as errored in FeederManager.
  // Users can create feeders manually with proper specs when needed.
  const feeders: GeneratedProject['feeders'] = [];

  // ---- Summary ----
  const totalCircuits = houseCircuits.length +
    Array.from(unitCircuits.values()).reduce((sum, c) => sum + c.length, 0);

  return {
    mdp,
    meterStack,
    housePanel,
    evPanel,
    evCircuits: [],
    unitPanels,
    unitCircuits,
    houseCircuits,
    meters,
    feeders,
    summary: {
      scenarioName: 'Basic Multi-Family (No EV)',
      totalPanels: 1 + 1 + unitPanels.length, // MDP + house + units (no EV)
      totalCircuits,
      totalMeters: meters.length,
      mdpRating,
      evChargers: 0,
    },
  };
}

// ============================================================================
// EV-ONLY GENERATOR (Add EV to existing project)
// ============================================================================

/**
 * Generated EV infrastructure entities ready for DB insertion.
 * Used by addEVInfrastructure() orchestrator to attach EV to an existing project.
 */
export interface EVInfrastructureProject {
  evPanel: Omit<PanelInsert, 'id'>;
  evCircuits: Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[];
  evMeter: { name: string; type: 'ev'; position: number };
  evFeeder: { name: string; distance_ft: number };
  summary: {
    scenarioName: string;
    evChargers: number;
    evPanelRating: number;
  };
}

export interface EVInfrastructureOptions {
  scenario: ScenarioKey;
  projectId: string;
  evAmpsPerCharger: number;
  evChargerLevel: 'Level1' | 'Level2';
}

/**
 * Generate ONLY EV infrastructure (panel + circuits + meter + feeder).
 * Used when adding EV charging to an existing project generated by DwellingLoadCalculator.
 */
export function generateEVInfrastructure(
  result: MultiFamilyEVResult,
  options: EVInfrastructureOptions
): EVInfrastructureProject {
  const { scenario, projectId, evAmpsPerCharger, evChargerLevel } = options;

  const selectedScenario = result.scenarios[scenario];
  const evChargers = Math.min(selectedScenario.maxChargers, result.input.evChargersRequested);

  // Generate EV panel and circuits using the existing proven function
  const { panel: evPanel, circuits: evCircuits } = generateEVPanel(
    projectId, evChargers, evAmpsPerCharger, evChargerLevel,
    scenario !== 'noEVEMS', selectedScenario
  );

  return {
    evPanel,
    evCircuits,
    evMeter: { name: 'EV Meter', type: 'ev', position: -1 }, // position set by orchestrator
    evFeeder: { name: 'MDP to EV Sub-Panel', distance_ft: 75 },
    summary: {
      scenarioName: selectedScenario.name,
      evChargers,
      evPanelRating: evPanel.bus_rating || 200,
    },
  };
}

// ============================================================================
// ENTITY GENERATORS
// ============================================================================

function generateMDP(
  projectId: string,
  rating: number,
  voltage: number,
  phase: number,
  buildingName?: string
): Omit<PanelInsert, 'id'> {
  return {
    project_id: projectId,
    name: buildingName ? `${buildingName} MDP` : 'MDP',
    voltage,
    phase,
    bus_rating: rating,
    main_breaker_amps: rating,
    is_main: true,
    fed_from_type: 'meter_stack',
    location: 'Electrical Room',
  };
}

function generateMeterStack(
  projectId: string,
  busRating: number,
  voltage: number,
  phase: number,
  dwellingUnits: number
): Omit<MeterStackInsert, 'id'> {
  // Meter positions: 1 per unit + 1 for house + 1 for EV + spares
  const positions = dwellingUnits + 2 + Math.ceil(dwellingUnits * 0.1); // 10% spare

  return {
    project_id: projectId,
    name: 'CT Cabinet',
    location: 'Electrical Room',
    bus_rating_amps: busRating,
    voltage,
    phase,
    num_meter_positions: Math.min(positions, 200),
  };
}

/**
 * Map common area category to circuit description, pole count, and conductor sizing hints.
 */
const CATEGORY_CIRCUIT_MAP: Record<string, { description: string; pole: 1 | 2 | 3; is3Phase?: boolean }> = {
  lighting_indoor: { description: 'Interior Lighting', pole: 1 },
  lighting_outdoor: { description: 'Exterior & Parking Lighting', pole: 1 },
  receptacles: { description: 'Common Area Receptacles', pole: 1 },
  elevators: { description: 'Elevator', pole: 2, is3Phase: true },
  pool_spa: { description: 'Pool/Spa Equipment', pole: 2 },
  hvac: { description: 'HVAC', pole: 2, is3Phase: true },
  fire_pump: { description: 'Fire Pump', pole: 2, is3Phase: true },
  motors: { description: 'Motor Load', pole: 2 },
  other: { description: 'Misc. Common Area', pole: 1 },
};

/**
 * Select conductor size based on breaker amps per NEC 310.
 */
function conductorForBreaker(breakerAmps: number): string {
  if (breakerAmps <= 15) return '14 AWG Cu';
  if (breakerAmps <= 20) return '12 AWG Cu';
  if (breakerAmps <= 30) return '10 AWG Cu';
  if (breakerAmps <= 40) return '8 AWG Cu';
  if (breakerAmps <= 55) return '6 AWG Cu';
  if (breakerAmps <= 70) return '4 AWG Cu';
  if (breakerAmps <= 85) return '3 AWG Cu';
  if (breakerAmps <= 100) return '2 AWG Cu';
  if (breakerAmps <= 115) return '1 AWG Cu';
  if (breakerAmps <= 130) return '1/0 AWG Cu';
  if (breakerAmps <= 150) return '2/0 AWG Cu';
  if (breakerAmps <= 175) return '3/0 AWG Cu';
  return '4/0 AWG Cu';
}

function generateHousePanel(
  projectId: string,
  voltage: number,
  phase: number,
  commonAreaLoadVA: number,
  commonAreaItems?: CommonAreaLoadItem[]
): { panel: Omit<PanelInsert, 'id'>; circuits: Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[] } {
  const circuits: Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[] = [];
  let circuitNumber = 1;

  // ---- Itemized path: real circuits from calculateCommonAreaLoads ----
  if (commonAreaItems && commonAreaItems.length > 0) {
    const caResult = calculateCommonAreaLoads(commonAreaItems);

    for (const item of caResult.items) {
      const mapping = CATEGORY_CIRCUIT_MAP[item.category] || CATEGORY_CIRCUIT_MAP['other']!;
      const loadVA = item.demandVA;
      const loadAmps = Math.ceil(loadVA / voltage);
      // NEC 210.20: continuous loads at 125%, motors at 125% FLC
      const breakerAmps = roundUpToStandardSize(
        Math.ceil(loadAmps * 1.25),
        STANDARD_BREAKER_SIZES
      );
      const pole = mapping.is3Phase && phase === 3 ? 3 : mapping.pole;

      circuits.push({
        circuit_number: circuitNumber,
        description: item.description || mapping.description,
        breaker_amps: breakerAmps,
        pole,
        load_watts: loadVA,
        conductor_size: conductorForBreaker(breakerAmps),
      });
      circuitNumber += pole === 3 ? 6 : pole === 2 ? 4 : 2;
    }

    // Always add fire alarm (required by code, not a common area "load item")
    circuits.push({
      circuit_number: circuitNumber,
      description: 'Fire Alarm System',
      breaker_amps: 20,
      pole: 1,
      load_watts: 500,
      conductor_size: '12 AWG Cu',
    });
  } else {
    // ---- Fallback: percentage-based allocation (original logic) ----

    // Lobby/corridor lighting
    const lobbyVA = Math.round(commonAreaLoadVA * 0.3);
    circuits.push({
      circuit_number: circuitNumber,
      description: 'Lobby & Corridor Lighting',
      breaker_amps: 20,
      pole: 1,
      load_watts: lobbyVA,
      conductor_size: '12 AWG Cu',
    });
    circuitNumber += 2;

    // Exterior/parking lighting
    const exteriorVA = Math.round(commonAreaLoadVA * 0.15);
    circuits.push({
      circuit_number: circuitNumber,
      description: 'Exterior & Parking Lighting',
      breaker_amps: 20,
      pole: 1,
      load_watts: exteriorVA,
      conductor_size: '12 AWG Cu',
    });
    circuitNumber += 2;

    // Common area receptacles
    circuits.push({
      circuit_number: circuitNumber,
      description: 'Common Area Receptacles',
      breaker_amps: 20,
      pole: 1,
      load_watts: Math.round(commonAreaLoadVA * 0.1),
      conductor_size: '12 AWG Cu',
    });
    circuitNumber += 2;

    // Elevator (if load suggests it)
    if (commonAreaLoadVA > 15000) {
      const elevatorVA = Math.round(commonAreaLoadVA * 0.25);
      const elevatorAmps = Math.ceil(elevatorVA / voltage);
      const elevatorBreaker = roundUpToStandardSize(elevatorAmps * 1.25, STANDARD_BREAKER_SIZES);
      circuits.push({
        circuit_number: circuitNumber,
        description: 'Elevator',
        breaker_amps: elevatorBreaker,
        pole: phase === 3 ? 3 : 2,
        load_watts: elevatorVA,
        conductor_size: elevatorBreaker <= 30 ? '10 AWG Cu' : '8 AWG Cu',
      });
      circuitNumber += phase === 3 ? 6 : 4;
    }

    // Fire alarm
    circuits.push({
      circuit_number: circuitNumber,
      description: 'Fire Alarm System',
      breaker_amps: 20,
      pole: 1,
      load_watts: 500,
      conductor_size: '12 AWG Cu',
    });
    circuitNumber += 2;

    // Laundry room (common)
    if (commonAreaLoadVA > 10000) {
      circuits.push({
        circuit_number: circuitNumber,
        description: 'Common Laundry',
        breaker_amps: 30,
        pole: 2,
        load_watts: 5000,
        conductor_size: '10 AWG Cu',
      });
    }
  }

  // Size house panel
  const totalLoadAmps = circuits.reduce((sum, c) => sum + c.load_watts, 0) / voltage;
  const panelRating = roundUpToStandardSize(Math.ceil(totalLoadAmps * 1.25), STANDARD_PANEL_SIZES);

  const panel: Omit<PanelInsert, 'id'> = {
    project_id: projectId,
    name: 'House Panel',
    voltage,
    phase,
    bus_rating: panelRating,
    main_breaker_amps: panelRating,
    is_main: false,
    fed_from_type: 'panel', // Fed from MDP (linked by orchestrator)
    location: 'Electrical Room',
  };

  return { panel, circuits };
}

function generateEVPanel(
  projectId: string,
  chargerCount: number,
  ampsPerCharger: number,
  level: 'Level1' | 'Level2',
  useEVEMS: boolean,
  scenario: EVCapacityScenario
): { panel: Omit<PanelInsert, 'id'>; circuits: Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[] } {
  if (chargerCount <= 0) {
    // No EV panel needed
    return {
      panel: {
        project_id: projectId,
        name: 'EV Panel (Empty)',
        voltage: 240,
        phase: 1,
        bus_rating: 100,
        is_main: false,
        fed_from_type: 'panel',
        location: 'Parking Garage',
      },
      circuits: [],
    };
  }

  // Determine charger type for generateCustomEVPanel
  let chargerType: 'Level 2 (48A)' | 'Level 2 (80A)' | 'DC Fast Charge (150kW)';
  if (ampsPerCharger <= 48) {
    chargerType = 'Level 2 (48A)';
  } else if (ampsPerCharger <= 80) {
    chargerType = 'Level 2 (80A)';
  } else {
    chargerType = 'DC Fast Charge (150kW)';
  }

  // NEC 625.42: Use scenario's computed per-charger power (accounts for building load + house panel)
  // Fall back to 50% simultaneous if no scenario power available
  const evemsLoadVAPerCharger = (useEVEMS && scenario.powerPerCharger_kW)
    ? Math.round(scenario.powerPerCharger_kW * 1000)
    : undefined;

  const config: CustomEVPanelConfig = {
    chargerType,
    numberOfChargers: chargerCount,
    useEVEMS,
    simultaneousChargers: useEVEMS ? Math.ceil(chargerCount * 0.5) : undefined,
    evemsLoadVAPerCharger,
    includeSpare: true,
    includeLighting: true,
    panelName: 'EV Sub-Panel',
  };

  const result = generateCustomEVPanel({ projectId, config });

  // Convert from EV template format to our insert format
  const circuits = result.circuits.map((c, idx) => ({
    circuit_number: c.circuitNumber ?? (idx * 2 + 1),
    description: c.description ?? `EV Circuit ${idx + 1}`,
    breaker_amps: c.breakerAmps ?? 60,
    pole: c.poles ?? 2,
    load_watts: c.loadVA ?? 0,
    conductor_size: c.conductorSize ?? '6 AWG Cu',
  }));

  const panel: Omit<PanelInsert, 'id'> = {
    project_id: projectId,
    name: 'EV Sub-Panel',
    voltage: result.panel.voltage ?? 240,
    phase: result.panel.phase ?? 1,
    bus_rating: result.panel.bus_rating ?? result.panel.main_breaker_amps ?? 200,
    main_breaker_amps: result.panel.main_breaker_amps ?? 200,
    is_main: false,
    fed_from_type: 'panel', // Fed from MDP
    location: 'Parking Garage / EV Charging Area',
  };

  return { panel, circuits };
}

function generateUnitPanels(
  projectId: string,
  dwellingUnits: number,
  avgSqFt: number,
  voltage: number,
  phase: number,
  hasElectricCooking: boolean,
  hasElectricHeat: boolean,
  applianceConfig?: UnitApplianceConfig
): {
  panels: Omit<PanelInsert, 'id'>[];
  circuits: Map<number, Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[]>;
} {
  const panels: Omit<PanelInsert, 'id'>[] = [];
  const allCircuits = new Map<number, Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[]>();

  // For buildings with many units, generate representative panels rather than one per unit
  // Group identical units together. For now: all units are the same template.
  // We create one panel per unit (up to 20), then use "typical" for larger buildings.
  const panelsToCreate = Math.min(dwellingUnits, 20);

  for (let i = 0; i < panelsToCreate; i++) {
    const unitNumber = i + 101; // Start at Unit 101
    const { panel, circuits } = generateSingleUnitPanel(
      projectId, unitNumber, avgSqFt, voltage, phase, hasElectricCooking, hasElectricHeat, applianceConfig
    );
    panels.push(panel);
    allCircuits.set(i, circuits);
  }

  // For large buildings (>20 units), add a note to the last panel
  if (dwellingUnits > 20) {
    const lastPanel = panels[panels.length - 1];
    if (lastPanel) {
      lastPanel.notes = `Typical of ${dwellingUnits - panelsToCreate + 1} identical units (${panelsToCreate}–${dwellingUnits + 100})`;
    }
  }

  return { panels, circuits: allCircuits };
}

function generateSingleUnitPanel(
  projectId: string,
  unitNumber: number,
  sqFt: number,
  voltage: number,
  phase: number,
  hasElectricCooking: boolean,
  hasElectricHeat: boolean,
  applianceConfig?: UnitApplianceConfig
): { panel: Omit<PanelInsert, 'id'>; circuits: Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[] } {
  const circuits: Omit<CircuitInsert, 'id' | 'panel_id' | 'project_id'>[] = [];

  // Slot allocator: alternates between left (odd) and right (even) columns
  let leftSlot = 1;
  let rightSlot = 2;
  let useLeft = true;
  function nextSlot(poles: number): number {
    const slot = useLeft ? leftSlot : rightSlot;
    const increment = poles === 3 ? 6 : poles === 2 ? 4 : 2;
    if (useLeft) leftSlot += increment; else rightSlot += increment;
    useLeft = !useLeft;
    return slot;
  }

  // NEC 210.11(C)(1) - Small Appliance Branch Circuits (min 2 required)
  circuits.push({
    circuit_number: nextSlot(1),
    description: 'Kitchen Small Appliance #1',
    breaker_amps: 20,
    pole: 1,
    load_watts: 1500,
    conductor_size: '12 AWG Cu',
  });

  circuits.push({
    circuit_number: nextSlot(1),
    description: 'Kitchen Small Appliance #2',
    breaker_amps: 20,
    pole: 1,
    load_watts: 1500,
    conductor_size: '12 AWG Cu',
  });

  // NEC 210.11(C)(2) - Laundry Circuit
  circuits.push({
    circuit_number: nextSlot(1),
    description: 'Laundry',
    breaker_amps: 20,
    pole: 1,
    load_watts: 1500,
    conductor_size: '12 AWG Cu',
  });

  // NEC 210.11(C)(3) - Bathroom Circuit
  circuits.push({
    circuit_number: nextSlot(1),
    description: 'Bathroom(s)',
    breaker_amps: 20,
    pole: 1,
    load_watts: 1500,
    conductor_size: '12 AWG Cu',
  });

  // General Lighting (NEC 220.12: 3 VA/sq ft)
  const lightingVA = sqFt * 3;
  const lightingCircuits = Math.max(1, Math.ceil(lightingVA / 1800)); // ~15A per circuit
  for (let j = 0; j < lightingCircuits; j++) {
    circuits.push({
      circuit_number: nextSlot(1),
      description: j === 0 ? 'General Lighting' : `General Lighting #${j + 1}`,
      breaker_amps: 15,
      pole: 1,
      load_watts: Math.round(lightingVA / lightingCircuits),
      conductor_size: '14 AWG Cu',
    });
  }

  // Electric Range/Oven (if applicable)
  if (hasElectricCooking) {
    const rangeWatts = applianceConfig?.rangeKW ? applianceConfig.rangeKW * 1000 : 8000;
    const rangeBreaker = roundUpToStandardSize(
      Math.ceil((rangeWatts / voltage) * 1.25), STANDARD_BREAKER_SIZES
    );
    circuits.push({
      circuit_number: nextSlot(2),
      description: 'Range/Oven',
      breaker_amps: rangeBreaker,
      pole: 2,
      load_watts: rangeWatts,
      conductor_size: conductorForBreaker(rangeBreaker),
    });
  }

  // Electric Dryer (if applicable)
  if (applianceConfig?.dryerKW) {
    const dryerWatts = applianceConfig.dryerKW * 1000;
    const dryerBreaker = roundUpToStandardSize(
      Math.ceil((dryerWatts / voltage) * 1.25), STANDARD_BREAKER_SIZES
    );
    circuits.push({
      circuit_number: nextSlot(2),
      description: 'Clothes Dryer',
      breaker_amps: dryerBreaker,
      pole: 2,
      load_watts: dryerWatts,
      conductor_size: conductorForBreaker(dryerBreaker),
    });
  }

  // Electric Heat (if applicable)
  if (hasElectricHeat) {
    const heatWatts = applianceConfig?.heatingKW ? applianceConfig.heatingKW * 1000 : 5000;
    const heatBreaker = roundUpToStandardSize(
      Math.ceil((heatWatts / voltage) * 1.25), STANDARD_BREAKER_SIZES
    );
    circuits.push({
      circuit_number: nextSlot(2),
      description: 'Electric Heat / Heat Pump',
      breaker_amps: heatBreaker,
      pole: 2,
      load_watts: heatWatts,
      conductor_size: conductorForBreaker(heatBreaker),
    });
  }

  // A/C condensing unit
  const acWatts = applianceConfig?.coolingKW ? applianceConfig.coolingKW * 1000 : 3500;
  const acBreaker = roundUpToStandardSize(
    Math.ceil((acWatts / voltage) * 1.25), STANDARD_BREAKER_SIZES
  );
  circuits.push({
    circuit_number: nextSlot(2),
    description: 'A/C Condensing Unit',
    breaker_amps: acBreaker,
    pole: 2,
    load_watts: acWatts,
    conductor_size: conductorForBreaker(acBreaker),
  });

  // Water Heater
  const whWatts = applianceConfig?.waterHeaterKW ? applianceConfig.waterHeaterKW * 1000 : 4500;
  const whBreaker = roundUpToStandardSize(
    Math.ceil((whWatts / voltage) * 1.25), STANDARD_BREAKER_SIZES
  );
  circuits.push({
    circuit_number: nextSlot(2),
    description: 'Water Heater',
    breaker_amps: whBreaker,
    pole: 2,
    load_watts: whWatts,
    conductor_size: conductorForBreaker(whBreaker),
  });

  // Dishwasher (if enabled)
  if (applianceConfig?.dishwasherKW) {
    circuits.push({
      circuit_number: nextSlot(1),
      description: 'Dishwasher',
      breaker_amps: 20,
      pole: 1,
      load_watts: applianceConfig.dishwasherKW * 1000,
      conductor_size: '12 AWG Cu',
    });
  }

  // Disposal (if enabled)
  if (applianceConfig?.disposalKW) {
    circuits.push({
      circuit_number: nextSlot(1),
      description: 'Disposal',
      breaker_amps: 20,
      pole: 1,
      load_watts: applianceConfig.disposalKW * 1000,
      conductor_size: '12 AWG Cu',
    });
  }

  // Size unit panel - dwelling unit panels are typically 100A or 125A
  const totalLoad = circuits.reduce((sum, c) => sum + c.load_watts, 0);
  const loadAmps = totalLoad / (voltage === 208 ? 208 : 240);
  const unitPanelRating = roundUpToStandardSize(Math.ceil(loadAmps * 1.25), [100, 125, 150, 200]);

  const panel: Omit<PanelInsert, 'id'> = {
    project_id: projectId,
    name: `Unit ${unitNumber} Panel`,
    voltage: voltage === 208 ? 208 : 240, // Unit panels are typically 120/240 or 120/208
    phase: 1, // Dwelling units are single-phase
    bus_rating: unitPanelRating,
    main_breaker_amps: unitPanelRating,
    is_main: false,
    fed_from_type: 'panel', // Fed from MDP
    location: `Unit ${unitNumber}`,
  };

  return { panel, circuits };
}

function generateMeters(dwellingUnits: number): GeneratedProject['meters'] {
  const meters: GeneratedProject['meters'] = [];
  let position = 1;

  // House meter
  meters.push({
    type: 'house',
    name: 'House Meter',
    position: position++,
    panelRef: 'house',
  });

  // EV meter
  meters.push({
    type: 'ev',
    name: 'EV Meter',
    position: position++,
    panelRef: 'ev',
  });

  // Unit meters (up to 20 explicit, rest implied)
  const metersToCreate = Math.min(dwellingUnits, 20);
  for (let i = 0; i < metersToCreate; i++) {
    const unitNumber = i + 101;
    meters.push({
      type: 'unit',
      name: `Unit ${unitNumber} Meter`,
      position: position++,
      panelRef: { unitIndex: i },
    });
  }

  return meters;
}

function generateFeeders(dwellingUnits: number): GeneratedProject['feeders'] {
  const feeders: GeneratedProject['feeders'] = [];

  // MDP → House Panel
  feeders.push({
    name: 'MDP to House Panel',
    sourceRef: 'mdp',
    destRef: 'house',
    distance_ft: 25,
  });

  // MDP → EV Panel
  feeders.push({
    name: 'MDP to EV Sub-Panel',
    sourceRef: 'mdp',
    destRef: 'ev',
    distance_ft: 75, // Typically longer run to parking area
  });

  // MDP → Unit Panels (representative feeders)
  const feedersToCreate = Math.min(dwellingUnits, 20);
  for (let i = 0; i < feedersToCreate; i++) {
    const unitNumber = i + 101;
    feeders.push({
      name: `MDP to Unit ${unitNumber}`,
      sourceRef: 'mdp',
      destRef: { unitIndex: i },
      distance_ft: 50 + i * 10, // Increasing distance for higher floors
    });
  }

  return feeders;
}
