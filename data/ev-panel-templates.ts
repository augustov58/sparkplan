/**
 * EV Panel Templates
 *
 * Pre-designed panel schedules for common EV charging installations.
 * Compliant with NEC Article 625 (Electric Vehicle Charging System).
 *
 * References:
 * - NEC 625.42: Electric Vehicle Supply Equipment (EVSE) load management
 * - NEC 625.44: EVSE demand factors
 * - NEC 310.16: Conductor ampacities
 * - NEC 220.87: Determining existing loads (for service upgrades)
 */

import type { Panel, Circuit } from '../types';
import { nanoid } from 'nanoid';

export interface EVPanelTemplate {
  id: string;
  name: string;
  description: string;

  // Panel Specifications
  panelRating: number;           // Amps (e.g., 200A, 400A)
  voltage: number;                // Volts (e.g., 240V, 480V)
  phase: 1 | 3;                   // Single or three-phase
  busConfiguration: '1P' | '3P';  // Bus bar configuration

  // EV Charger Configuration
  chargerType: 'Level 2' | 'DC Fast Charge';
  numberOfChargers: number;
  chargerPowerKw: number;         // Per-charger power rating
  chargerAmps: number;            // Per-charger amperage

  // Load Management
  usesEVEMS: boolean;             // Uses EVEMS load management system per NEC 625.42
  simultaneousCharging: number;   // Max chargers operating simultaneously

  // NEC Compliance
  demandFactor: number;           // NEC 625.44 demand factor (0-1)
  totalLoadAmps: number;          // Total calculated load
  necArticles: string[];          // Relevant NEC articles

  // Pre-configured Circuits
  circuits: Omit<Circuit, 'id' | 'project_id' | 'panel_id' | 'created_at'>[];

  // Use Cases
  idealFor: string[];             // Recommended applications
  estimatedCost: {                // Material cost estimate
    low: number;
    high: number;
  };
}

/**
 * Level 2 EV Charger Templates (240V AC)
 */

export const EV_PANEL_TEMPLATE_4X_LEVEL2: EVPanelTemplate = {
  id: 'ev-4x-level2-200a',
  name: '4× Level 2 Chargers (200A Panel)',
  description: '200A, 240V single-phase panel with 4× Level 2 EV chargers (48A each). No EVEMS required - each charger on dedicated 60A breaker.',

  panelRating: 200,
  voltage: 240,
  phase: 1,
  busConfiguration: '1P',

  chargerType: 'Level 2',
  numberOfChargers: 4,
  chargerPowerKw: 11.5,  // 48A × 240V = 11,520W
  chargerAmps: 48,

  usesEVEMS: false,
  simultaneousCharging: 4,  // All can charge simultaneously

  demandFactor: 1.0,  // No diversity - worst case
  totalLoadAmps: 240,  // 4 × 60A breakers = 240A (needs service upgrade if existing <240A)
  necArticles: ['NEC 625.41', 'NEC 625.44', 'NEC 210.19', 'NEC 310.16'],

  circuits: [
    {
      circuitNumber: 1,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #1 - Level 2 (48A continuous)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 5,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #2 - Level 2 (48A continuous)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 9,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #3 - Level 2 (48A continuous)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 13,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #4 - Level 2 (48A continuous)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    }
  ],

  idealFor: [
    'Residential (4-car garage)',
    'Small office parking lot',
    'Apartment building (4 assigned spaces)',
    'Fleet parking (small scale)'
  ],

  estimatedCost: {
    low: 8000,   // 200A panel + 4× Level 2 chargers + installation
    high: 12000
  }
};

export const EV_PANEL_TEMPLATE_8X_LEVEL2_EVEMS: EVPanelTemplate = {
  id: 'ev-8x-level2-400a-evems',
  name: '8× Level 2 Chargers with EVEMS (400A Panel)',
  description: '400A, 240V single-phase panel with 8× Level 2 EV chargers (48A each). EVEMS system per NEC 625.42 allows 6 simultaneous charging.',

  panelRating: 400,
  voltage: 240,
  phase: 1,
  busConfiguration: '1P',

  chargerType: 'Level 2',
  numberOfChargers: 8,
  chargerPowerKw: 11.5,  // 48A × 240V = 11,520W
  chargerAmps: 48,

  usesEVEMS: true,  // Load management system required
  simultaneousCharging: 6,  // EVEMS limits to 6 simultaneous

  demandFactor: 0.75,  // NEC 625.44: 6/8 = 75%
  totalLoadAmps: 360,  // 6 × 60A = 360A (within 400A panel)
  necArticles: ['NEC 625.42', 'NEC 625.44', 'NEC 210.19', 'NEC 310.16'],

  circuits: [
    {
      circuitNumber: 1,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #1 - Level 2 (48A, EVEMS managed)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 5,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #2 - Level 2 (48A, EVEMS managed)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 9,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #3 - Level 2 (48A, EVEMS managed)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 13,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #4 - Level 2 (48A, EVEMS managed)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 17,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #5 - Level 2 (48A, EVEMS managed)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 21,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #6 - Level 2 (48A, EVEMS managed)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 25,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #7 - Level 2 (48A, EVEMS managed)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 29,
      breakerAmps: 60,
      poles: 2,
      voltage: 240,
      description: 'EV Charger #8 - Level 2 (48A, EVEMS managed)',
      conductorSize: '6 AWG Cu',
      conductorType: 'THHN',
      loadVA: 11520,
      isEvCharger: true,
      evChargerAmps: 48
    },
    {
      circuitNumber: 33,
      breakerAmps: 20,
      poles: 2,
      voltage: 240,
      description: 'EVEMS Load Management System',
      conductorSize: '12 AWG Cu',
      conductorType: 'THHN',
      loadVA: 500,
      isEvCharger: false
    }
  ],

  idealFor: [
    'Multi-family residential (8+ units)',
    'Office building parking garage',
    'Retail shopping center',
    'Hotel guest parking'
  ],

  estimatedCost: {
    low: 18000,  // 400A panel + 8× Level 2 + EVEMS controller + installation
    high: 25000
  }
};

/**
 * DC Fast Charge Templates (480V 3-phase)
 */

export const EV_PANEL_TEMPLATE_2X_DC_FAST: EVPanelTemplate = {
  id: 'ev-2x-dc-fast-800a',
  name: '2× DC Fast Chargers (800A Panel)',
  description: '800A, 480V three-phase panel with 2× DC Fast Chargers (150kW each). Commercial/fleet application.',

  panelRating: 800,
  voltage: 480,
  phase: 3,
  busConfiguration: '3P',

  chargerType: 'DC Fast Charge',
  numberOfChargers: 2,
  chargerPowerKw: 150,  // 150kW DC fast charger
  chargerAmps: 180,     // 150kW / (480V × √3) ≈ 180A per charger

  usesEVEMS: false,
  simultaneousCharging: 2,

  demandFactor: 1.0,
  totalLoadAmps: 360,  // 2 × 180A = 360A
  necArticles: ['NEC 625.41', 'NEC 625.44', 'NEC 430.22', 'NEC 310.16'],

  circuits: [
    {
      circuitNumber: 1,
      breakerAmps: 225,
      poles: 3,
      voltage: 480,
      description: 'DC Fast Charger #1 - 150kW (180A continuous)',
      conductorSize: '3/0 AWG Cu',
      conductorType: 'THHN',
      loadVA: 150000,
      isEvCharger: true,
      evChargerAmps: 180
    },
    {
      circuitNumber: 7,
      breakerAmps: 225,
      poles: 3,
      voltage: 480,
      description: 'DC Fast Charger #2 - 150kW (180A continuous)',
      conductorSize: '3/0 AWG Cu',
      conductorType: 'THHN',
      loadVA: 150000,
      isEvCharger: true,
      evChargerAmps: 180
    },
    {
      circuitNumber: 13,
      breakerAmps: 30,
      poles: 3,
      voltage: 480,
      description: 'HVAC for equipment cooling',
      conductorSize: '10 AWG Cu',
      conductorType: 'THHN',
      loadVA: 15000,
      isEvCharger: false
    }
  ],

  idealFor: [
    'Highway rest stop charging station',
    'Fleet depot (buses, delivery trucks)',
    'Public fast charging plaza',
    'Commercial EV service center'
  ],

  estimatedCost: {
    low: 75000,  // 800A 3Φ panel + 2× DC fast chargers + transformer + installation
    high: 120000
  }
};

/**
 * All EV Panel Templates
 */
export const EV_PANEL_TEMPLATES: EVPanelTemplate[] = [
  EV_PANEL_TEMPLATE_4X_LEVEL2,
  EV_PANEL_TEMPLATE_8X_LEVEL2_EVEMS,
  EV_PANEL_TEMPLATE_2X_DC_FAST
];

/**
 * Apply template to project (create panel and circuits)
 */
export interface ApplyTemplateInput {
  projectId: string;
  template: EVPanelTemplate;
  panelName?: string;  // Custom panel name (defaults to template name)
}

export interface ApplyTemplateOutput {
  panel: Omit<Panel, 'id' | 'created_at'>;
  circuits: Omit<Circuit, 'id' | 'created_at' | 'project_id' | 'panel_id'>[];
}

export function applyEVPanelTemplate(input: ApplyTemplateInput): ApplyTemplateOutput {
  const { projectId, template, panelName } = input;

  // Create panel from template
  const panel: Omit<Panel, 'id' | 'created_at'> = {
    project_id: projectId,
    name: panelName || template.name,
    main_breaker_amps: template.panelRating,
    voltage: template.voltage,
    phase: template.phase,
    bus_rating: template.panelRating,
    panel_type: 'Sub-panel',
    fed_from_type: 'service',  // User must configure parent panel
    location: 'EV Charging Area'
  };

  // Create circuits from template
  const circuits = template.circuits.map(circuitTemplate => ({
    ...circuitTemplate,
    project_id: projectId
  }));

  return { panel, circuits };
}

/**
 * Custom EV Panel Configuration
 * Allows users to build custom EV charging panels with any number of chargers
 */
export type ChargerTypeOption = 'Level 2 (48A)' | 'Level 2 (80A)' | 'DC Fast Charge (150kW)';

export interface CustomEVPanelConfig {
  chargerType: ChargerTypeOption;
  numberOfChargers: number;
  useEVEMS: boolean;
  simultaneousChargers?: number;  // Required if useEVEMS is true
  includeSpare: boolean;
  includeLighting: boolean;
  panelName?: string;
}

export interface CustomEVPanelInput {
  projectId: string;
  config: CustomEVPanelConfig;
}

/**
 * Generate custom EV panel based on user configuration
 */
export function generateCustomEVPanel(input: CustomEVPanelInput): ApplyTemplateOutput {
  const { projectId, config } = input;
  const {
    chargerType,
    numberOfChargers,
    useEVEMS,
    simultaneousChargers,
    includeSpare,
    includeLighting,
    panelName
  } = config;

  // Determine charger specifications based on type
  let chargerAmps: number;
  let chargerKW: number;
  let voltage: number;
  let phase: 1 | 3;
  let breakerSize: number;
  let conductorSize: string;
  let loadVA: number;

  switch (chargerType) {
    case 'Level 2 (48A)':
      chargerAmps = 48;
      chargerKW = 11.5;
      voltage = 240;
      phase = 1;
      breakerSize = 60;  // 125% of 48A = 60A
      conductorSize = '6 AWG Cu';
      loadVA = 11520;  // 48A × 240V
      break;
    case 'Level 2 (80A)':
      chargerAmps = 80;
      chargerKW = 19.2;
      voltage = 240;
      phase = 1;
      breakerSize = 100;  // 125% of 80A = 100A
      conductorSize = '3 AWG Cu';
      loadVA = 19200;  // 80A × 240V
      break;
    case 'DC Fast Charge (150kW)':
      chargerAmps = 180;  // 150kW / (480V × √3)
      chargerKW = 150;
      voltage = 480;
      phase = 3;
      breakerSize = 225;  // 125% of 180A = 225A
      conductorSize = '3/0 AWG Cu';
      loadVA = 150000;  // 150kW
      break;
  }

  // Calculate total load
  const totalChargerLoad = numberOfChargers * breakerSize;

  // Apply EVEMS demand factor if enabled
  let effectiveLoad = totalChargerLoad;
  if (useEVEMS && simultaneousChargers) {
    effectiveLoad = simultaneousChargers * breakerSize;
  }

  // Add spare and lighting loads
  const spareLoad = includeSpare ? 20 : 0;
  const lightingLoad = includeLighting ? 20 : 0;
  const totalLoad = effectiveLoad + spareLoad + lightingLoad;

  // Determine panel rating (round up to standard sizes)
  const standardSizes = [100, 125, 150, 200, 225, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000];
  const panelRating = standardSizes.find(size => size >= totalLoad) || 2000;

  // Generate panel name
  const defaultName = `${numberOfChargers}× ${chargerType}${useEVEMS ? ' with EVEMS' : ''} Panel`;

  // Create panel
  const panel: Omit<Panel, 'id' | 'created_at'> = {
    project_id: projectId,
    name: panelName || defaultName,
    main_breaker_amps: panelRating,
    voltage: voltage,
    phase: phase,
    bus_rating: panelRating,
    panel_type: 'Sub-panel',
    fed_from_type: 'service',
    location: 'EV Charging Area'
  };

  // Generate circuits
  const circuits: Omit<Circuit, 'id' | 'created_at' | 'project_id' | 'panel_id'>[] = [];
  let circuitNumber = 1;

  // Add EV charger circuits
  // Multi-pole slot formula: 2-pole at slot N occupies N and N+2.
  // Increment by (poles * 2) to avoid overlapping slots.
  const chargerPoles = phase === 1 ? 2 : 3;
  for (let i = 1; i <= numberOfChargers; i++) {
    circuits.push({
      circuitNumber: circuitNumber,
      breakerAmps: breakerSize,
      poles: chargerPoles,
      voltage: voltage,
      description: `EV Charger #${i} - ${chargerType}${useEVEMS ? ' (EVEMS managed)' : ''}`,
      conductorSize: conductorSize,
      conductorType: 'THHN',
      loadVA: loadVA,
      isEvCharger: true,
      evChargerAmps: chargerAmps
    });
    circuitNumber += chargerPoles * 2;  // 2-pole = +4, 3-pole = +6
  }

  // Add EVEMS controller circuit if enabled
  if (useEVEMS) {
    circuits.push({
      circuitNumber: circuitNumber,
      breakerAmps: 20,
      poles: 2,
      voltage: 240,
      description: 'EVEMS Load Management System',
      conductorSize: '12 AWG Cu',
      conductorType: 'THHN',
      loadVA: 500,
      isEvCharger: false
    });
    circuitNumber += 4;  // 2-pole occupies 2 slots
  }

  // Add spare circuit if requested
  if (includeSpare) {
    circuits.push({
      circuitNumber: circuitNumber,
      breakerAmps: 20,
      poles: 2,
      voltage: voltage === 480 ? 277 : 120,
      description: 'Spare Circuit',
      conductorSize: '12 AWG Cu',
      conductorType: 'THHN',
      loadVA: 0,
      isEvCharger: false
    });
    circuitNumber += 4;  // 2-pole occupies 2 slots
  }

  // Add lighting circuit if requested
  if (includeLighting) {
    circuits.push({
      circuitNumber: circuitNumber,
      breakerAmps: 20,
      poles: 2,
      voltage: voltage === 480 ? 277 : 120,
      description: 'Lighting Circuit',
      conductorSize: '12 AWG Cu',
      conductorType: 'THHN',
      loadVA: 1800,
      isEvCharger: false
    });
  }

  return { panel, circuits };
}
