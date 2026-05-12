/**
 * Shared fixture for the permit-packet E2E test + the
 * `scripts/generate-full-packet-fixture.ts` visual-inspection helper.
 *
 * Extracted from tests/permitPacketE2E.test.ts so it can be imported by
 * non-vitest callers (scripts, manual generators) without dragging in
 * vitest's `beforeAll` / `describe` globals.
 *
 * If you change the fixture, both the E2E test and any generated PDFs in
 * example_reports/ will reflect the change.
 */

import type { PermitPacketData } from '../../services/pdfExport/permitPacketGenerator';
import { calculateArcFlash } from '../../services/calculations/arcFlash';
import { calculateMultiFamilyEV } from '../../services/calculations/multiFamilyEV';

export const projectId = '11111111-1111-1111-1111-111111111111';

export const mkPanel = (overrides: Partial<any> = {}): any => ({
  id: 'pnl-mdp',
  project_id: projectId,
  name: 'MDP',
  voltage: 480,
  phase: 3,
  bus_rating: 400,
  main_breaker_amps: 400,
  is_main: true,
  aic_rating: 65000,
  location: 'Electrical Room 101',
  manufacturer: 'Square D',
  model_number: 'I-Line',
  ul_listing: 'UL-67',
  nema_enclosure_type: '1',
  series_rating: false,
  fed_from: null,
  fed_from_type: 'service',
  fed_from_transformer_id: null,
  fed_from_meter_stack_id: null,
  fed_from_circuit_number: null,
  feeder_breaker_amps: null,
  feeder_conductor_size: null,
  feeder_conduit: null,
  feeder_length: null,
  supplied_by_feeder_id: null,
  notes: null,
  created_at: '2026-04-19T00:00:00Z',
  ...overrides,
});

const panels: any[] = [
  mkPanel(),
  mkPanel({
    id: 'pnl-h1',
    name: 'H1',
    voltage: 208,
    phase: 3,
    bus_rating: 225,
    main_breaker_amps: 225,
    is_main: false,
    fed_from_type: 'panel',
    fed_from: 'pnl-mdp',
    fed_from_circuit_number: 1,
    feeder_breaker_amps: 225,
    feeder_conductor_size: '4/0',
    feeder_length: 120,
    location: 'Unit 1 Electrical Closet',
    aic_rating: 22000,
  }),
];

const circuits: any[] = [
  {
    id: 'c1',
    project_id: projectId,
    panel_id: 'pnl-mdp',
    circuit_number: 1,
    pole: 3,
    breaker_amps: 225,
    load_watts: 45000,
    conductor_size: '4/0',
    description: 'Feed to H1',
    load_type: 'other',
    egc_size: '4',
    created_at: '2026-04-19T00:00:00Z',
  },
  {
    id: 'c2',
    project_id: projectId,
    panel_id: 'pnl-h1',
    circuit_number: 1,
    pole: 1,
    breaker_amps: 20,
    load_watts: 1800,
    conductor_size: '12',
    description: 'Lighting - Hallway',
    load_type: 'lighting',
    egc_size: '12',
    created_at: '2026-04-19T00:00:00Z',
  },
  {
    id: 'c3',
    project_id: projectId,
    panel_id: 'pnl-h1',
    circuit_number: 3,
    pole: 2,
    breaker_amps: 40,
    load_watts: 9600,
    conductor_size: '8',
    description: 'EV Charger - Space 1',
    load_type: 'ev',
    egc_size: '10',
    created_at: '2026-04-19T00:00:00Z',
  },
];

const feeders: any[] = [
  {
    id: 'f1',
    project_id: projectId,
    name: 'F-MDP-to-H1',
    source_panel_id: 'pnl-mdp',
    destination_panel_id: 'pnl-h1',
    destination_transformer_id: null,
    conductor_material: 'Cu',
    phase_conductor_size: '4/0',
    neutral_conductor_size: '4/0',
    egc_size: '4',
    distance_ft: 120,
    total_load_va: 45000,
    continuous_load_va: 20000,
    noncontinuous_load_va: 25000,
    design_load_va: 45000,
    voltage_drop_percent: 1.4,
    conduit_type: 'EMT',
    conduit_size: '2',
    num_current_carrying: 3,
    ambient_temperature_c: 30,
    created_at: '2026-04-19T00:00:00Z',
    updated_at: '2026-04-19T00:00:00Z',
  },
];

const transformers: any[] = [
  {
    id: 'tfr-1',
    project_id: projectId,
    name: 'T-1',
    kva_rating: 75,
    primary_voltage: 480,
    primary_phase: 3,
    secondary_voltage: 208,
    secondary_phase: 3,
    primary_breaker_amps: 125,
    secondary_breaker_amps: 225,
    primary_conductor_size: '1',
    secondary_conductor_size: '4/0',
    impedance_percent: 5.0,
    connection_type: 'Delta-Wye',
    cooling_type: 'AA',
    temperature_rise: 150,
    location: 'Electrical Room',
    manufacturer: 'Square D',
    catalog_number: 'EX75T3H',
    nema_type: '3R',
    ul_listing: 'UL-1561',
    winding_type: 'Copper',
    fed_from_panel_id: 'pnl-mdp',
    fed_from_circuit_number: 3,
    supplied_by_feeder_id: null,
    notes: null,
    created_at: '2026-04-19T00:00:00Z',
  },
];

const shortCircuitCalculation: any = {
  id: 'sc-1',
  project_id: projectId,
  user_id: 'user-1',
  calculation_type: 'service',
  location_name: 'MDP',
  panel_id: null,
  service_voltage: 480,
  service_phase: 3,
  service_amps: 400,
  service_conductor_size: '500',
  service_conductor_material: 'Cu',
  service_conductor_length: 50,
  service_conduit_type: 'EMT',
  feeder_voltage: null,
  feeder_phase: null,
  feeder_conductor_size: null,
  feeder_material: null,
  feeder_length: null,
  feeder_conduit_type: null,
  transformer_kva: 500,
  transformer_impedance: 5.0,
  source_fault_current: 25000,
  notes: null,
  results: {
    faultCurrent: 22100,
    requiredAIC: 22100,
    details: {
      sourceFaultCurrent: 25000,
      conductorImpedance: 0.003,
      totalImpedance: 0.012,
      faultCurrentAtPoint: 22100,
      safetyFactor: 1.25,
    },
    compliance: {
      necArticle: 'NEC 110.9',
      compliant: true,
      message: 'Equipment AIC rating (65kA) exceeds fault current (22.1kA).',
    },
  },
  created_at: '2026-04-19T00:00:00Z',
  updated_at: '2026-04-19T00:00:00Z',
};

const arcFlashResult = calculateArcFlash({
  shortCircuitCurrent: 22.1,
  voltage: 480,
  phase: 3,
  equipmentType: 'panelboard',
  clearingTime: 0.083,
});

const grounding: any = {
  id: 'g-1',
  project_id: projectId,
  gec_size: '2',
  electrodes: ['Ground Rod #1 (8ft x 5/8" Cu-clad)', 'Concrete-Encased Electrode (Ufer)'],
  bonding: ['Water pipe bond', 'Structural steel bond'],
  notes: 'Per NEC 250.52(A)',
  created_at: '2026-04-19T00:00:00Z',
  updated_at: '2026-04-19T00:00:00Z',
};

const meterStacks: any[] = [
  {
    id: 'ms-1',
    project_id: projectId,
    name: 'Main Meter Stack',
    location: 'Exterior West Wall',
    bus_rating_amps: 800,
    voltage: 208,
    phase: 3,
    num_meter_positions: 8,
    ct_ratio: null,
    manufacturer: 'Milbank',
    model_number: 'U4801',
    created_at: '2026-04-19T00:00:00Z',
    updated_at: '2026-04-19T00:00:00Z',
  },
];

const meters: any[] = [
  {
    id: 'm-1',
    project_id: projectId,
    meter_stack_id: 'ms-1',
    name: 'Meter 1 - Unit 101',
    meter_type: 'unit',
    position_number: 1,
    panel_id: 'pnl-h1',
    breaker_amps: 100,
    created_at: '2026-04-19T00:00:00Z',
    updated_at: '2026-04-19T00:00:00Z',
  },
  {
    id: 'm-2',
    project_id: projectId,
    meter_stack_id: 'ms-1',
    name: 'Meter 2 - House',
    meter_type: 'house',
    position_number: 2,
    panel_id: null,
    breaker_amps: 100,
    created_at: '2026-04-19T00:00:00Z',
    updated_at: '2026-04-19T00:00:00Z',
  },
];

const jurisdiction: any = {
  id: 'j-1',
  jurisdiction_name: 'Miami, Miami-Dade County, FL',
  city: 'Miami',
  county: 'Miami-Dade',
  state: 'FL',
  ahj_name: 'City of Miami Building Department',
  ahj_website: 'https://miami.gov',
  required_documents: ['one_line_diagram', 'load_calculation', 'panel_schedules'],
  required_calculations: ['load_calculation', 'short_circuit'],
  notes: 'All permits require licensed contractor signature.',
  nec_edition: '2023',
  estimated_review_days: 14,
  is_active: true,
  data_source: 'Official AHJ Website',
  source_url: 'https://miami.gov/permits',
  last_verified_date: '2026-04-01',
  created_at: '2026-04-19T00:00:00Z',
  updated_at: '2026-04-19T00:00:00Z',
};

const mfEvResult = calculateMultiFamilyEV({
  dwellingUnits: 20,
  avgUnitSqFt: 1000,
  voltage: 208,
  phase: 3,
  existingServiceAmps: 800,
  evChargers: {
    count: 20,
    level: 'Level2',
    ampsPerCharger: 40,
  },
});

export const fullPacket: PermitPacketData = {
  projectId,
  projectName: 'E2E Harness Project',
  projectAddress: '100 Test Ave, Miami FL',
  projectType: 'Commercial',
  serviceVoltage: 480,
  servicePhase: 3,
  panels,
  circuits,
  feeders,
  transformers,
  preparedBy: 'Augusto E Valbuena',
  permitNumber: 'P-2026-E2E',
  contractorLicense: 'C-10 #123456',
  scopeOfWork:
    'Install new 400A 480V 3-phase service, one 75kVA transformer, and sub-panel H1 for multi-family EV readiness.',
  serviceType: 'underground',
  meterLocation: 'Exterior north wall',
  serviceConductorRouting: 'PVC conduit, buried 24in',
  hasGrounding: true,
  shortCircuitCalculations: [shortCircuitCalculation],
  arcFlashData: {
    equipmentName: 'MDP',
    equipmentType: 'panelboard',
    systemVoltage: 480,
    faultCurrent: 22100,
    workingDistance: 18,
    clearingTime: 0.083,
    result: arcFlashResult,
  },
  groundingSystem: grounding,
  meterStacks,
  meters,
  multiFamilyEVAnalysis: {
    result: mfEvResult,
    buildingName: 'E2E Test Building',
  },
  jurisdictionId: jurisdiction.id,
  jurisdiction,
};
