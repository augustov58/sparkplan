/**
 * Project Templates
 * Pre-configured templates for common electrical project types
 * Speeds up project creation with typical configurations
 */

import { ProjectType } from '../types';

export interface CircuitTemplate {
  circuit_number: number;
  description: string;
  breaker_amps: number;
  pole: 1 | 2 | 3;
  load_watts: number;
  conductor_size: string;
  egc_size?: string;
}

export interface PanelTemplate {
  name: string;
  bus_rating: number;
  voltage: number;
  phase: 1 | 3;
  main_breaker_amps: number;
  location: string;
  is_main: boolean;
  circuits: CircuitTemplate[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  serviceVoltage: number;
  servicePhase: 1 | 3;
  panels: PanelTemplate[];
  icon: string;
  estimatedTime: string; // How long to complete design
}

/**
 * Residential Project Templates
 */
export const residentialTemplates: ProjectTemplate[] = [
  {
    id: 'residential-2000sf-house',
    name: '2000 sq ft Single-Family Home',
    description: '200A service, standard residential loads, split into kitchen and general loads',
    type: ProjectType.RESIDENTIAL,
    serviceVoltage: 240,
    servicePhase: 1,
    icon: '🏠',
    estimatedTime: '30-45 min',
    panels: [
      {
        name: 'Main Panel',
        bus_rating: 200,
        voltage: 240,
        phase: 1,
        main_breaker_amps: 200,
        location: 'Garage',
        is_main: true,
        circuits: [
          // Kitchen circuits (20A, 12 AWG)
          { circuit_number: 1, description: 'Kitchen Receptacles 1', breaker_amps: 20, pole: 1, load_watts: 1800, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 3, description: 'Kitchen Receptacles 2', breaker_amps: 20, pole: 1, load_watts: 1800, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 5, description: 'Refrigerator', breaker_amps: 20, pole: 1, load_watts: 600, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 7, description: 'Dishwasher', breaker_amps: 20, pole: 1, load_watts: 1200, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 9, description: 'Garbage Disposal', breaker_amps: 20, pole: 1, load_watts: 900, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 11, description: 'Microwave', breaker_amps: 20, pole: 1, load_watts: 1500, conductor_size: '12 AWG', egc_size: '12 AWG' },

          // General receptacles (15A, 14 AWG)
          { circuit_number: 2, description: 'Living Room Receptacles', breaker_amps: 15, pole: 1, load_watts: 1200, conductor_size: '14 AWG', egc_size: '14 AWG' },
          { circuit_number: 4, description: 'Bedroom 1 Receptacles', breaker_amps: 15, pole: 1, load_watts: 1200, conductor_size: '14 AWG', egc_size: '14 AWG' },
          { circuit_number: 6, description: 'Bedroom 2 Receptacles', breaker_amps: 15, pole: 1, load_watts: 1200, conductor_size: '14 AWG', egc_size: '14 AWG' },
          { circuit_number: 8, description: 'Bedroom 3 Receptacles', breaker_amps: 15, pole: 1, load_watts: 1200, conductor_size: '14 AWG', egc_size: '14 AWG' },

          // Lighting circuits (15A, 14 AWG)
          { circuit_number: 10, description: 'General Lighting', breaker_amps: 15, pole: 1, load_watts: 800, conductor_size: '14 AWG', egc_size: '14 AWG' },
          { circuit_number: 12, description: 'Exterior Lighting', breaker_amps: 15, pole: 1, load_watts: 300, conductor_size: '14 AWG', egc_size: '14 AWG' },

          // Bathroom circuits (20A GFCI)
          { circuit_number: 13, description: 'Bathroom 1 Receptacles (GFCI)', breaker_amps: 20, pole: 1, load_watts: 1500, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 15, description: 'Bathroom 2 Receptacles (GFCI)', breaker_amps: 20, pole: 1, load_watts: 1500, conductor_size: '12 AWG', egc_size: '12 AWG' },

          // Major appliances (240V, 2-pole)
          { circuit_number: 14, description: 'Electric Range (40A)', breaker_amps: 40, pole: 2, load_watts: 8000, conductor_size: '8 AWG', egc_size: '10 AWG' },
          { circuit_number: 16, description: 'Electric Dryer (30A)', breaker_amps: 30, pole: 2, load_watts: 5000, conductor_size: '10 AWG', egc_size: '10 AWG' },
          { circuit_number: 18, description: 'Water Heater (30A)', breaker_amps: 30, pole: 2, load_watts: 4500, conductor_size: '10 AWG', egc_size: '10 AWG' },

          // HVAC
          { circuit_number: 20, description: 'Air Conditioner (30A)', breaker_amps: 30, pole: 2, load_watts: 5000, conductor_size: '10 AWG', egc_size: '10 AWG' },
          { circuit_number: 22, description: 'Furnace/Air Handler (15A)', breaker_amps: 15, pole: 1, load_watts: 1200, conductor_size: '14 AWG', egc_size: '14 AWG' },
        ]
      }
    ]
  },
  {
    id: 'residential-3500sf-house',
    name: '3500 sq ft Large Home',
    description: '400A service with subpanel, bonus rooms, workshop',
    type: ProjectType.RESIDENTIAL,
    serviceVoltage: 240,
    servicePhase: 1,
    icon: '🏡',
    estimatedTime: '1-2 hours',
    panels: [
      {
        name: 'Main Panel',
        bus_rating: 400,
        voltage: 240,
        phase: 1,
        main_breaker_amps: 400,
        location: 'Garage',
        is_main: true,
        circuits: [
          { circuit_number: 1, description: 'Kitchen Receptacles 1', breaker_amps: 20, pole: 1, load_watts: 1800, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 3, description: 'Kitchen Receptacles 2', breaker_amps: 20, pole: 1, load_watts: 1800, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 5, description: 'Electric Range (50A)', breaker_amps: 50, pole: 2, load_watts: 12000, conductor_size: '6 AWG', egc_size: '10 AWG' },
          { circuit_number: 7, description: 'Dryer (30A)', breaker_amps: 30, pole: 2, load_watts: 5000, conductor_size: '10 AWG', egc_size: '10 AWG' },
          { circuit_number: 9, description: 'Water Heater (40A)', breaker_amps: 40, pole: 2, load_watts: 6000, conductor_size: '8 AWG', egc_size: '10 AWG' },
          { circuit_number: 11, description: 'Central AC (40A)', breaker_amps: 40, pole: 2, load_watts: 7500, conductor_size: '8 AWG', egc_size: '10 AWG' },
          { circuit_number: 13, description: 'Pool Pump (20A)', breaker_amps: 20, pole: 2, load_watts: 2400, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 15, description: 'Hot Tub (50A GFCI)', breaker_amps: 50, pole: 2, load_watts: 8000, conductor_size: '6 AWG', egc_size: '10 AWG' },
          { circuit_number: 17, description: 'EV Charger (40A)', breaker_amps: 40, pole: 2, load_watts: 7680, conductor_size: '8 AWG', egc_size: '10 AWG' },
          { circuit_number: 19, description: 'Garage Subpanel (60A)', breaker_amps: 60, pole: 2, load_watts: 10000, conductor_size: '6 AWG', egc_size: '10 AWG' },
        ]
      }
    ]
  }
];

/**
 * Commercial Project Templates
 */
export const commercialTemplates: ProjectTemplate[] = [
  {
    id: 'commercial-retail-store',
    name: 'Retail Store (2500 sq ft)',
    description: '208V 3-phase service, general lighting, receptacles, HVAC',
    type: ProjectType.COMMERCIAL,
    serviceVoltage: 208,
    servicePhase: 3,
    icon: '🏪',
    estimatedTime: '1-2 hours',
    panels: [
      {
        name: 'Main Distribution Panel',
        bus_rating: 400,
        voltage: 208,
        phase: 3,
        main_breaker_amps: 400,
        location: 'Electrical Room',
        is_main: true,
        circuits: [
          // Lighting (277V)
          { circuit_number: 1, description: 'Sales Floor Lighting Zone 1', breaker_amps: 20, pole: 1, load_watts: 3000, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 3, description: 'Sales Floor Lighting Zone 2', breaker_amps: 20, pole: 1, load_watts: 3000, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 5, description: 'Back Room Lighting', breaker_amps: 20, pole: 1, load_watts: 1500, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 7, description: 'Exterior Signage', breaker_amps: 20, pole: 1, load_watts: 2000, conductor_size: '12 AWG', egc_size: '12 AWG' },

          // Receptacles (120V)
          { circuit_number: 2, description: 'Sales Floor Receptacles 1', breaker_amps: 20, pole: 1, load_watts: 1800, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 4, description: 'Sales Floor Receptacles 2', breaker_amps: 20, pole: 1, load_watts: 1800, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 6, description: 'Cash Register Area', breaker_amps: 20, pole: 1, load_watts: 2400, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 8, description: 'Break Room Receptacles', breaker_amps: 20, pole: 1, load_watts: 1800, conductor_size: '12 AWG', egc_size: '12 AWG' },

          // HVAC (208V 3-phase)
          { circuit_number: 9, description: 'Rooftop Unit 1 (30A)', breaker_amps: 30, pole: 3, load_watts: 10000, conductor_size: '10 AWG', egc_size: '10 AWG' },
          { circuit_number: 12, description: 'Rooftop Unit 2 (30A)', breaker_amps: 30, pole: 3, load_watts: 10000, conductor_size: '10 AWG', egc_size: '10 AWG' },

          // Specialized equipment
          { circuit_number: 15, description: 'Refrigeration Case 1 (20A)', breaker_amps: 20, pole: 1, load_watts: 2400, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 17, description: 'Refrigeration Case 2 (20A)', breaker_amps: 20, pole: 1, load_watts: 2400, conductor_size: '12 AWG', egc_size: '12 AWG' },
          { circuit_number: 19, description: 'Security System', breaker_amps: 15, pole: 1, load_watts: 500, conductor_size: '14 AWG', egc_size: '14 AWG' },
        ]
      }
    ]
  },
  {
    id: 'commercial-office',
    name: 'Office Building (5000 sq ft)',
    description: '480V 3-phase service with step-down transformer',
    type: ProjectType.COMMERCIAL,
    serviceVoltage: 480,
    servicePhase: 3,
    icon: '🏢',
    estimatedTime: '2-3 hours',
    panels: [
      {
        name: 'Main Distribution Panel',
        bus_rating: 600,
        voltage: 480,
        phase: 3,
        main_breaker_amps: 600,
        location: 'Electrical Room',
        is_main: true,
        circuits: [
          // Main feeders
          { circuit_number: 1, description: 'Transformer 1 (75 kVA)', breaker_amps: 100, pole: 3, load_watts: 75000, conductor_size: '3 AWG', egc_size: '8 AWG' },
          { circuit_number: 4, description: 'Chiller (100A)', breaker_amps: 100, pole: 3, load_watts: 80000, conductor_size: '3 AWG', egc_size: '8 AWG' },
          { circuit_number: 7, description: 'Elevator (50A)', breaker_amps: 50, pole: 3, load_watts: 40000, conductor_size: '6 AWG', egc_size: '10 AWG' },
        ]
      }
    ]
  }
];

/**
 * Industrial Project Templates
 */
export const industrialTemplates: ProjectTemplate[] = [
  {
    id: 'industrial-workshop',
    name: 'Small Workshop/Light Manufacturing',
    description: '480V 3-phase, machinery circuits, lighting, welding',
    type: ProjectType.INDUSTRIAL,
    serviceVoltage: 480,
    servicePhase: 3,
    icon: '🏭',
    estimatedTime: '2-4 hours',
    panels: [
      {
        name: 'Main Distribution Panel',
        bus_rating: 800,
        voltage: 480,
        phase: 3,
        main_breaker_amps: 800,
        location: 'Electrical Room',
        is_main: true,
        circuits: [
          // Machinery (480V 3-phase)
          { circuit_number: 1, description: 'CNC Mill (60A)', breaker_amps: 60, pole: 3, load_watts: 48000, conductor_size: '6 AWG', egc_size: '10 AWG' },
          { circuit_number: 4, description: 'CNC Lathe (60A)', breaker_amps: 60, pole: 3, load_watts: 48000, conductor_size: '6 AWG', egc_size: '10 AWG' },
          { circuit_number: 7, description: 'Compressor (100A)', breaker_amps: 100, pole: 3, load_watts: 80000, conductor_size: '3 AWG', egc_size: '8 AWG' },
          { circuit_number: 10, description: 'Welding Receptacle (50A)', breaker_amps: 50, pole: 3, load_watts: 40000, conductor_size: '6 AWG', egc_size: '10 AWG' },

          // Support systems
          { circuit_number: 13, description: 'Transformer for 208V Panel', breaker_amps: 150, pole: 3, load_watts: 120000, conductor_size: '1/0 AWG', egc_size: '6 AWG' },
          { circuit_number: 16, description: 'HVAC Unit (80A)', breaker_amps: 80, pole: 3, load_watts: 64000, conductor_size: '4 AWG', egc_size: '8 AWG' },
        ]
      }
    ]
  }
];

/**
 * Get all templates grouped by type
 */
export function getAllTemplates(): Record<ProjectType, ProjectTemplate[]> {
  return {
    [ProjectType.RESIDENTIAL]: residentialTemplates,
    [ProjectType.COMMERCIAL]: commercialTemplates,
    [ProjectType.INDUSTRIAL]: industrialTemplates,
  };
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): ProjectTemplate | undefined {
  const allTemplates = [
    ...residentialTemplates,
    ...commercialTemplates,
    ...industrialTemplates
  ];
  return allTemplates.find(t => t.id === id);
}
