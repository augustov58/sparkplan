/**
 * Sample Project Templates
 * Pre-configured projects to help new users get started quickly
 */

import { ProjectStatus, ProjectType } from '../types';
import type { Project, LoadItem, PanelCircuit, GroundingDetail } from '../types';
import type { Database } from '../lib/database.types';

type PanelInsert = Database['public']['Tables']['panels']['Insert'];

export type TemplateType = 'residential' | 'commercial' | 'industrial' | 'ev-charging';

interface ProjectTemplate {
  name: string;
  description: string;
  type: ProjectType;
  necEdition: '2020' | '2023';
  settings: {
    serviceVoltage: number;
    servicePhase: 1 | 3;
    occupancyType: 'dwelling' | 'commercial' | 'industrial';
    conductorMaterial: 'Cu' | 'Al';
    temperatureRating: 60 | 75 | 90;
    residential?: {
      squareFootage: number;
      buildingType: 'single_family' | 'multi_family';
      stories: number;
      bedrooms: number;
      hasAirConditioning: boolean;
      hasElectricHeat: boolean;
      hasElectricCooking: boolean;
      hasElectricDryer: boolean;
    };
  };
  loads: Omit<LoadItem, 'id' | 'project_id'>[];
  panels: Omit<PanelInsert, 'id' | 'project_id'>[];
  grounding: Omit<GroundingDetail, 'id' | 'project_id'>;
}

const TEMPLATES: Record<TemplateType, ProjectTemplate> = {
  'residential': {
    name: 'Residential - Single Family Home',
    description: '2,400 sq ft single-family home with electric range, dryer, and A/C',
    type: ProjectType.RESIDENTIAL,
    necEdition: '2023',
    settings: {
      serviceVoltage: 240,
      servicePhase: 1,
      occupancyType: 'dwelling',
      conductorMaterial: 'Cu',
      temperatureRating: 75,
      residential: {
        dwellingType: 'single_family',
        squareFootage: 2400,
        numBedrooms: 4,
        numBathrooms: 2,
        smallApplianceCircuits: 2,
        laundryCircuit: true,
        bathroomCircuits: 2,
        garageCircuit: true,
        outdoorCircuit: true,
        appliances: {
          range: { enabled: true, kw: 12, type: 'electric' },
          dryer: { enabled: true, kw: 5, type: 'electric' },
          waterHeater: { enabled: true, kw: 4.5, type: 'electric' },
          hvac: { enabled: true, type: 'ac_only', coolingKw: 4.2 },
          dishwasher: { enabled: true, kw: 1.2 },
          disposal: { enabled: true, kw: 0.5 },
        },
      },
    },
    loads: [
      {
        description: 'General Lighting - 2,400 sq ft @ 3 VA/sq ft (NEC 220.12)',
        watts: 7200,
        type: 'lighting',
        continuous: false,
        phase: 'A',
      },
      {
        description: 'Small Appliance Circuits - 2 @ 1,500 VA (NEC 220.52A)',
        watts: 3000,
        type: 'receptacle',
        continuous: false,
        phase: 'A',
      },
      {
        description: 'Laundry Circuit - 1,500 VA (NEC 220.52B)',
        watts: 1500,
        type: 'receptacle',
        continuous: false,
        phase: 'B',
      },
      {
        description: 'Electric Range - 12 kW (NEC 220.55)',
        watts: 12000,
        type: 'range',
        continuous: false,
        phase: '3-Phase',
      },
      {
        description: 'Electric Dryer - 5 kW (NEC 220.54)',
        watts: 5000,
        type: 'dryer',
        continuous: false,
        phase: '3-Phase',
      },
      {
        description: 'Central AC - 3.5 ton (NEC 440.32)',
        watts: 4200,
        type: 'hvac',
        continuous: true,
        phase: '3-Phase',
      },
      {
        description: 'Water Heater - 4.5 kW (NEC 422.13)',
        watts: 4500,
        type: 'water_heater',
        continuous: false,
        phase: '3-Phase',
      },
    ],
    panels: [
      {
        name: 'Main Panel',
        voltage: 240,
        phase: 1,
        bus_rating: 200,
        main_breaker_amps: 200,
        location: 'Garage',
        is_main: true,
        fed_from_type: 'service',
        fed_from: null,
        fed_from_transformer_id: null,
      },
    ],
    grounding: {
      systemType: 'service',
      electrodeType: 'rod',
      electrodeCount: 2,
      conductorSize: 6,
      conductorMaterial: 'Cu',
      connectionMethod: 'exothermic',
      soilResistivity: 100,
      testDate: new Date().toISOString().split('T')[0],
      notes: 'Two 8-foot ground rods spaced 6 feet apart',
      bondingJumpers: [],
    },
  },

  'commercial': {
    name: 'Commercial - Small Office Building',
    description: '5,000 sq ft office space with HVAC and general loads',
    type: ProjectType.COMMERCIAL,
    necEdition: '2023',
    settings: {
      serviceVoltage: 208,
      servicePhase: 3,
      occupancyType: 'commercial',
      conductorMaterial: 'Cu',
      temperatureRating: 75,
    },
    loads: [
      {
        description: 'General Lighting - 5,000 sq ft @ 1.0 VA/sq ft (NEC 220.12)',
        watts: 5000,
        type: 'lighting',
        continuous: true,
        phase: 'A',
      },
      {
        description: 'Receptacle Loads - 5,000 sq ft @ 1.0 VA/sq ft (NEC 220.14I)',
        watts: 5000,
        type: 'receptacle',
        continuous: false,
        phase: 'B',
      },
      {
        description: 'HVAC - Rooftop Unit 1 (10 ton, 120,000 BTU) - NEC 440.32',
        watts: 12000,
        type: 'hvac',
        continuous: true,
        phase: '3-Phase',
      },
      {
        description: 'HVAC - Rooftop Unit 2 (10 ton, 120,000 BTU) - NEC 440.32',
        watts: 12000,
        type: 'hvac',
        continuous: true,
        phase: '3-Phase',
      },
      {
        description: 'Computer Room HVAC - 5 ton precision cooling (NEC 440.32)',
        watts: 6000,
        type: 'hvac',
        continuous: true,
        phase: '3-Phase',
      },
      {
        description: 'Commercial Water Heater - 12 kW (NEC 422.13)',
        watts: 12000,
        type: 'water_heater',
        continuous: false,
        phase: '3-Phase',
      },
      {
        description: 'Break Room Equipment - Refrigerator, microwave, coffee (NEC 220.14)',
        watts: 3000,
        type: 'appliance',
        continuous: false,
        phase: 'C',
      },
    ],
    panels: [
      {
        name: 'Main Distribution Panel',
        voltage: 208,
        phase: 3,
        bus_rating: 400,
        main_breaker_amps: 400,
        location: 'Electrical Room',
        is_main: true,
        fed_from_type: 'service',
        fed_from: null,
        fed_from_transformer_id: null,
      },
    ],
    grounding: {
      systemType: 'service',
      electrodeType: 'ufer',
      electrodeCount: 1,
      conductorSize: 4,
      conductorMaterial: 'Cu',
      connectionMethod: 'exothermic',
      soilResistivity: 80,
      testDate: new Date().toISOString().split('T')[0],
      notes: 'Concrete-encased electrode (Ufer ground) in building foundation',
      bondingJumpers: [],
    },
  },

  'industrial': {
    name: 'Industrial - Light Manufacturing',
    description: '10,000 sq ft light manufacturing facility with machinery',
    type: ProjectType.INDUSTRIAL,
    necEdition: '2023',
    settings: {
      serviceVoltage: 480,
      servicePhase: 3,
      occupancyType: 'industrial',
      conductorMaterial: 'Cu',
      temperatureRating: 75,
    },
    loads: [
      {
        description: 'General Lighting - 10,000 sq ft @ 1.2 VA/sq ft (NEC 220.12)',
        watts: 12000,
        type: 'lighting',
        continuous: true,
        phase: 'A',
      },
      {
        description: 'Receptacle Loads - General receptacles throughout facility (NEC 220.14)',
        watts: 8000,
        type: 'receptacle',
        continuous: false,
        phase: 'B',
      },
      {
        description: 'CNC Machine 1 - 50 HP machining center (NEC 430.22)',
        watts: 37300,
        type: 'motor',
        continuous: true,
        phase: '3-Phase',
      },
      {
        description: 'CNC Machine 2 - 50 HP machining center (NEC 430.22)',
        watts: 37300,
        type: 'motor',
        continuous: true,
        phase: '3-Phase',
      },
      {
        description: 'Air Compressor - 25 HP rotary screw (NEC 430.22)',
        watts: 18650,
        type: 'motor',
        continuous: true,
        phase: '3-Phase',
      },
      {
        description: 'Welding Equipment - 30 kVA transformer (NEC 630.11)',
        watts: 30000,
        type: 'appliance',
        continuous: false,
        phase: '3-Phase',
      },
      {
        description: 'HVAC - Manufacturing Floor 20 ton RTU (NEC 440.32)',
        watts: 24000,
        type: 'hvac',
        continuous: true,
        phase: '3-Phase',
      },
      {
        description: 'Office HVAC - 5 ton split system (NEC 440.32)',
        watts: 6000,
        type: 'hvac',
        continuous: true,
        phase: '3-Phase',
      },
    ],
    panels: [
      {
        name: 'Main Distribution Panel',
        voltage: 480,
        phase: 3,
        bus_rating: 800,
        main_breaker_amps: 800,
        location: 'Electrical Room',
        is_main: true,
        fed_from_type: 'service',
        fed_from: null,
        fed_from_transformer_id: null,
      },
    ],
    grounding: {
      systemType: 'service',
      electrodeType: 'ground-ring',
      electrodeCount: 1,
      conductorSize: 2,
      conductorMaterial: 'Cu',
      connectionMethod: 'exothermic',
      soilResistivity: 100,
      testDate: new Date().toISOString().split('T')[0],
      notes: '#2 Cu ground ring around building perimeter, buried 30 inches',
      bondingJumpers: [],
    },
  },

  'ev-charging': {
    name: 'EV Charging - Residential Installation',
    description: 'Residential home with Tesla Wall Connector (48A Level 2)',
    type: ProjectType.RESIDENTIAL,
    necEdition: '2023',
    settings: {
      serviceVoltage: 240,
      servicePhase: 1,
      occupancyType: 'dwelling',
      conductorMaterial: 'Cu',
      temperatureRating: 75,
      residential: {
        dwellingType: 'single_family',
        squareFootage: 2000,
        numBedrooms: 3,
        numBathrooms: 2,
        smallApplianceCircuits: 2,
        laundryCircuit: true,
        bathroomCircuits: 2,
        garageCircuit: true,
        outdoorCircuit: true,
        appliances: {
          range: { enabled: true, kw: 10, type: 'electric' },
          dryer: { enabled: true, kw: 5, type: 'electric' },
          hvac: { enabled: true, type: 'ac_only', coolingKw: 3.6 },
          dishwasher: { enabled: true, kw: 1.2 },
          disposal: { enabled: true, kw: 0.5 },
          evCharger: { enabled: true, kw: 9.6, level: 2 }, // 48A × 240V × 0.8 = 9.216kW
        },
      },
    },
    loads: [
      {
        description: 'General Lighting - 2,000 sq ft @ 3 VA/sq ft (NEC 220.12)',
        watts: 6000,
        type: 'lighting',
        continuous: false,
        phase: 'A',
      },
      {
        description: 'Small Appliance Circuits - 2 @ 1,500 VA (NEC 220.52A)',
        watts: 3000,
        type: 'receptacle',
        continuous: false,
        phase: 'A',
      },
      {
        description: 'Electric Range - 10 kW (NEC 220.55)',
        watts: 10000,
        type: 'range',
        continuous: false,
        phase: '3-Phase',
      },
      {
        description: 'Electric Dryer - 5 kW (NEC 220.54)',
        watts: 5000,
        type: 'dryer',
        continuous: false,
        phase: '3-Phase',
      },
      {
        description: 'Central AC - 3 ton (NEC 440.32)',
        watts: 3600,
        type: 'hvac',
        continuous: true,
        phase: '3-Phase',
      },
      {
        description: 'Tesla Wall Connector - 48A Level 2 EV charger (NEC 625.41)',
        watts: 9216,
        type: 'appliance',
        continuous: true,
        phase: '3-Phase',
      },
    ],
    panels: [
      {
        name: 'Main Panel',
        voltage: 240,
        phase: 1,
        bus_rating: 200,
        main_breaker_amps: 200,
        location: 'Garage',
        is_main: true,
        fed_from_type: 'service',
        fed_from: null,
        fed_from_transformer_id: null,
      },
    ],
    grounding: {
      systemType: 'service',
      electrodeType: 'rod',
      electrodeCount: 2,
      conductorSize: 6,
      conductorMaterial: 'Cu',
      connectionMethod: 'exothermic',
      soilResistivity: 100,
      testDate: new Date().toISOString().split('T')[0],
      notes: 'Two 8-foot ground rods, EV equipment grounding per NEC 625.43',
      bondingJumpers: [],
    },
  },
};

/**
 * Create a project from a template
 * Returns project data and panels to be created separately
 */
export function createProjectFromTemplate(
  templateType: TemplateType,
  user_id: string,
  customName?: string,
  customAddress?: string
): {
  project: Partial<Project>;
  panels: Array<Omit<PanelInsert, 'id'>>;
} {
  const template = TEMPLATES[templateType];

  if (!template) {
    throw new Error(`Invalid template type: ${templateType}`);
  }

  const projectId = crypto.randomUUID();

  return {
    project: {
      id: projectId,
      name: customName || template.name,
      address: customAddress || 'Sample Address - Update as needed',
      type: template.type,
      necEdition: template.necEdition,
      status: ProjectStatus.PLANNING,
      progress: 0,

      // Settings
      settings: template.settings,

      // Backward compatibility (top-level properties)
      serviceVoltage: template.settings.serviceVoltage,
      servicePhase: template.settings.servicePhase,

      // Loads with IDs
      loads: template.loads.map(load => ({
        ...load,
        id: crypto.randomUUID(),
        project_id: projectId,
      })),

      // Empty circuits (will be added by user)
      circuits: [],

      // Empty issues list
      issues: [],

      // Empty inspection list
      inspectionList: [],

      // Grounding with IDs
      grounding: {
        ...template.grounding,
        id: crypto.randomUUID(),
        project_id: projectId,
      },
    },
    // Panels with project_id
    panels: template.panels.map(panel => ({
      ...panel,
      project_id: projectId,
    })),
  };
}

/**
 * Get template metadata for UI display
 */
export function getTemplateInfo(templateType: TemplateType) {
  const template = TEMPLATES[templateType];
  return {
    name: template.name,
    description: template.description,
    type: template.type,
    loadCount: template.loads.length,
  };
}

/**
 * Get all available templates
 */
export function getAllTemplates() {
  return Object.keys(TEMPLATES) as TemplateType[];
}
