/**
 * End-to-end harness for the themed permit-packet rollout (commit ad268e2).
 *
 * This reproduces the exact code path the "Download Permit Packet" button
 * runs: it calls `generatePermitPacket()` with a realistic `PermitPacketData`
 * payload that triggers every themed page the generator can emit (cover,
 * equipment, riser, load calc, compliance, equipment specs, voltage drop,
 * short circuit, arc flash, grounding, meter stack, multi-family EV,
 * jurisdiction, and one panel schedule per panel).
 *
 * We stub the DOM APIs the generator touches (document.createElement,
 * URL.createObjectURL) so the test can run in vitest's default Node
 * environment, then intercept the synthesized anchor click so we can
 * inspect the Blob the user would have downloaded.
 *
 * This is the E2E fallback described in the rollout runbook: because
 * no Agent Browser / Playwright is available on the machine and the
 * real UI is gated by Supabase auth + live project data, we validate
 * the PDF pipeline itself via the same entry point the UI would hit.
 */
import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import {
  generatePermitPacket,
  generateLightweightPermitPacket,
  type PermitPacketData,
} from '../services/pdfExport/permitPacketGenerator';
import {
  CoverPage,
  EquipmentSchedule,
  RiserDiagram,
  LoadCalculationSummary,
  ComplianceSummary,
} from '../services/pdfExport/PermitPacketDocuments';
import { PanelSchedulePages } from '../services/pdfExport/PanelScheduleDocuments';
import { EquipmentSpecsPages } from '../services/pdfExport/EquipmentSpecsDocuments';
import { VoltageDropPages } from '../services/pdfExport/VoltageDropDocuments';
import { JurisdictionRequirementsPages } from '../services/pdfExport/JurisdictionDocuments';
import { ShortCircuitCalculationPages } from '../services/pdfExport/ShortCircuitDocuments';
import { ArcFlashPages } from '../services/pdfExport/ArcFlashDocuments';
import { GroundingPlanPages } from '../services/pdfExport/GroundingPlanDocuments';
import { MultiFamilyEVPages } from '../services/pdfExport/MultiFamilyEVDocuments';
import { MeterStackScheduleDocument } from '../services/pdfExport/MeterStackSchedulePDF';
import { calculateArcFlash } from '../services/calculations/arcFlash';
import { calculateMultiFamilyEV } from '../services/calculations/multiFamilyEV';

// ---------- DOM stubs (vitest runs in Node by default) -----------------------

type CapturedDownload = {
  fileName: string;
  bytes: number;
  blob: Blob;
};

const downloads: CapturedDownload[] = [];

beforeAll(() => {
  // Intercept URL.createObjectURL → just give a fake URL; remember the blob
  // by capturing it in the anchor click below.
  const originalCreateObjectURL = (globalThis.URL as any).createObjectURL;
  const originalRevokeObjectURL = (globalThis.URL as any).revokeObjectURL;
  (globalThis.URL as any).createObjectURL = () => 'blob:fake-url';
  (globalThis.URL as any).revokeObjectURL = () => {};

  // Stub just enough of document/body to satisfy downloadBlob().
  (globalThis as any).document = {
    createElement: (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        href: '',
        download: '',
        click: () => {
          // When the anchor is clicked, the blob itself isn't attached, but
          // the generator's download helper wrote .href and .download right
          // before the click. We track completions via _lastBlob set below.
          downloads.push({
            fileName: el.download,
            bytes: (globalThis as any).__lastBlob?.size ?? 0,
            blob: (globalThis as any).__lastBlob,
          });
        },
      };
      return el;
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  };

  // Patch createObjectURL again so it records the blob (so we can inspect it).
  (globalThis.URL as any).createObjectURL = (blob: Blob) => {
    (globalThis as any).__lastBlob = blob;
    return 'blob:fake-url';
  };

  afterAll(() => {
    (globalThis.URL as any).createObjectURL = originalCreateObjectURL;
    (globalThis.URL as any).revokeObjectURL = originalRevokeObjectURL;
    delete (globalThis as any).document;
    delete (globalThis as any).__lastBlob;
  });
});

// ---------- Fixtures ---------------------------------------------------------

const projectId = '11111111-1111-1111-1111-111111111111';

const mkPanel = (overrides: Partial<any> = {}): any => ({
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
  shortCircuitCurrent: 22.1, // kA
  voltage: 480,
  phase: 3,
  equipmentType: 'panelboard',
  clearingTime: 0.083, // 5 cycles
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

const fullPacket: PermitPacketData = {
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

// ---------- Per-page isolation (bisect like the real generator does) ---------

describe('Permit packet: each themed page renders in isolation', () => {
  // These are the same page elements the generator produces; rendering each
  // one alone inside a Document mirrors the fallback bisect path. If any
  // page regresses we get a pin-pointed failure instead of a vague
  // "full document failed" error.
  //
  const pageCases: Array<{ name: string; element: React.ReactElement }> = [
    { name: 'CoverPage', element: React.createElement(CoverPage, {
      projectName: fullPacket.projectName,
      projectAddress: fullPacket.projectAddress,
      projectType: fullPacket.projectType,
      serviceVoltage: fullPacket.serviceVoltage,
      servicePhase: fullPacket.servicePhase,
      preparedBy: fullPacket.preparedBy,
      permitNumber: fullPacket.permitNumber,
      contractorLicense: fullPacket.contractorLicense,
      scopeOfWork: fullPacket.scopeOfWork,
      serviceType: fullPacket.serviceType,
      meterLocation: fullPacket.meterLocation,
      serviceConductorRouting: fullPacket.serviceConductorRouting,
    }) },
    { name: 'EquipmentSchedule', element: React.createElement(EquipmentSchedule, {
      panels, transformers, feeders, projectName: fullPacket.projectName,
    }) },
    { name: 'RiserDiagram', element: React.createElement(RiserDiagram, {
      panels, transformers, feeders, meterStacks, meters,
      projectName: fullPacket.projectName,
      serviceVoltage: fullPacket.serviceVoltage,
      servicePhase: fullPacket.servicePhase,
    }) },
    { name: 'LoadCalculationSummary', element: React.createElement(LoadCalculationSummary, {
      panels, circuits, transformers,
      projectName: fullPacket.projectName,
      serviceVoltage: fullPacket.serviceVoltage,
      servicePhase: fullPacket.servicePhase,
      projectType: fullPacket.projectType,
    }) },
    { name: 'ComplianceSummary', element: React.createElement(ComplianceSummary, {
      panels, circuits, feeders,
      projectName: fullPacket.projectName,
      hasGrounding: true,
    }) },
    { name: 'EquipmentSpecs', element: React.createElement(EquipmentSpecsPages, {
      projectName: fullPacket.projectName,
      projectAddress: fullPacket.projectAddress,
      panels, transformers,
      includeNECReferences: true,
    }) },
    { name: 'VoltageDrop', element: React.createElement(VoltageDropPages, {
      projectName: fullPacket.projectName,
      projectAddress: fullPacket.projectAddress,
      feeders, panels, transformers,
      includeNECReferences: true,
    }) },
    { name: 'ShortCircuit', element: React.createElement(ShortCircuitCalculationPages, {
      calculation: shortCircuitCalculation,
      projectName: fullPacket.projectName,
      projectAddress: fullPacket.projectAddress,
    }) },
    { name: 'ArcFlash', element: React.createElement(ArcFlashPages, {
      projectName: fullPacket.projectName,
      projectAddress: fullPacket.projectAddress,
      equipmentName: 'MDP',
      arcFlashData: fullPacket.arcFlashData!,
    }) },
    { name: 'GroundingPlan', element: React.createElement(GroundingPlanPages, {
      projectName: fullPacket.projectName,
      projectAddress: fullPacket.projectAddress,
      grounding,
      serviceAmperage: 400,
      conductorMaterial: 'Cu',
    }) },
    { name: 'MeterStackSchedule', element: React.createElement(MeterStackScheduleDocument, {
      projectName: fullPacket.projectName,
      projectAddress: fullPacket.projectAddress,
      meterStacks, meters, panels,
    }) },
    { name: 'MultiFamilyEV', element: React.createElement(MultiFamilyEVPages, {
      result: mfEvResult,
      buildingName: 'E2E Test Building',
    }) },
    { name: 'JurisdictionRequirements', element: React.createElement(JurisdictionRequirementsPages, {
      jurisdiction,
      projectName: fullPacket.projectName,
    }) },
    { name: 'PanelSchedule[MDP]', element: React.createElement(PanelSchedulePages, {
      panel: panels[0],
      circuits: circuits.filter(c => c.panel_id === panels[0].id),
      projectName: fullPacket.projectName,
      projectAddress: fullPacket.projectAddress,
    }) },
    { name: 'PanelSchedule[H1]', element: React.createElement(PanelSchedulePages, {
      panel: panels[1],
      circuits: circuits.filter(c => c.panel_id === panels[1].id),
      projectName: fullPacket.projectName,
      projectAddress: fullPacket.projectAddress,
    }) },
  ];

  for (const { name, element } of pageCases) {
    it(`renders ${name} alone`, async () => {
      const doc = React.createElement(Document, null, element);
      const blob = await pdf(doc).toBlob();
      expect(blob).toBeTruthy();
      expect(blob.size).toBeGreaterThan(500); // non-trivial PDF
    });
  }
});

// ---------- Full-document end-to-end -----------------------------------------

describe('Permit packet: full generator E2E (mirrors button click)', () => {
  // The real PermitPacketGenerator component hard-codes `arcFlashData: undefined`
  // in `components/PermitPacketGenerator.tsx:139`. So the "what the button
  // actually renders" case is the packet WITHOUT arc flash. We mirror that
  // faithfully — this is the production-reachable flow.
  const uiLikePacket: PermitPacketData = { ...fullPacket, arcFlashData: undefined };

  it('generates full packet (UI-reachable flow, no arc flash) without errors', async () => {
    downloads.length = 0;
    await generatePermitPacket(uiLikePacket);

    expect(downloads).toHaveLength(1);
    const dl = downloads[0];
    expect(dl.fileName).toMatch(/^Permit_Packet_E2E_Harness_Project_\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(dl.bytes).toBeGreaterThan(10_000); // a 15+ page PDF is comfortably >10KB
    // Sanity: header bytes for "%PDF-"
    const buf = new Uint8Array(await dl.blob.arrayBuffer());
    const head = String.fromCharCode(...buf.slice(0, 5));
    expect(head).toBe('%PDF-');
  }, 60_000);

  it('generates full packet WITH arc flash (not reachable from UI today)', async () => {
    downloads.length = 0;
    await generatePermitPacket(fullPacket);
    expect(downloads).toHaveLength(1);
    expect(downloads[0].bytes).toBeGreaterThan(10_000);
  }, 60_000);

  it('generates lightweight packet without errors', async () => {
    downloads.length = 0;
    await generateLightweightPermitPacket(fullPacket);

    expect(downloads).toHaveLength(1);
    const dl = downloads[0];
    expect(dl.fileName).toMatch(/^Permit_Packet_Lightweight_/);
    expect(dl.bytes).toBeGreaterThan(5_000);
  }, 30_000);

  // Sprint 2A PR 4 / M3: grounding page must render even when no
  // grounding_details DB row exists. The PDF derives a project-specific GEC
  // size + electrode list from service ampacity instead of falling back to
  // generic Article 250 boilerplate.
  it('renders grounding page with derived GEC when groundingSystem is missing', async () => {
    downloads.length = 0;
    const noGrounding: PermitPacketData = { ...uiLikePacket, groundingSystem: undefined };
    await generatePermitPacket(noGrounding);

    expect(downloads).toHaveLength(1);
    // Should still produce the same number of bytes ballpark (grounding page
    // is included via its calculated default).
    expect(downloads[0].bytes).toBeGreaterThan(10_000);
  }, 60_000);

  it('generates minimal packet (no optional sections)', async () => {
    downloads.length = 0;
    const minimal: PermitPacketData = {
      projectId,
      projectName: 'Minimal',
      projectAddress: '1 Main St',
      projectType: 'Residential',
      serviceVoltage: 240,
      servicePhase: 1,
      panels: [mkPanel({ voltage: 240, phase: 1, bus_rating: 200, main_breaker_amps: 200 })],
      circuits: [],
      feeders: [],
      transformers: [],
      preparedBy: 'Tester',
      contractorLicense: 'C-10 #000',
      scopeOfWork: 'Minimal service upgrade.',
    };
    await generatePermitPacket(minimal);

    expect(downloads).toHaveLength(1);
    expect(downloads[0].bytes).toBeGreaterThan(5_000);
  }, 30_000);
});

// =============================================================================
// NEC 220.83 EXISTING DWELLING — Proposed New Loads + asterisk marker rendering
// =============================================================================
//
// This scenario reproduces the Sprint "feat/nec-220-83-existing-dwelling"
// journey end-to-end at the PDF surface:
//
//   1. Existing 125A residential service (service_modification_type = 'existing')
//   2. Mix of existing circuits (range, dryer, WH, A/C, disposal, pool pump)
//      plus one proposed Level 2 EV charger (48A continuous, is_proposed=true)
//   3. Render the panel schedule via the same code path the permit packet
//      uses (`PanelSchedulePages` with showExistingNewMarkers=true) and assert:
//      a) The proposed EV row description carries the trailing " *" marker
//      b) The legend "* = Proposed new circuit ..." appears
//   4. Negative control: render the same circuits with markers OFF and assert
//      neither artifact appears (so we know the gate works).
//   5. Full-generator parity: generate a complete packet with
//      serviceModificationType='existing' and assert the legend lands in the
//      final PDF bytes — proves the wiring at permitPacketGenerator.tsx:1144.
//
// Why this matters: the calc-layer 220.83 math (Connected 48.0 kVA / Demand
// 28.15 kVA / 117 A) is already pinned by tests/calculations-extended.test.ts
// at line 635. What is NOT yet pinned is the rendered PDF artifact, which is
// what the AHJ reviewer actually sees. A regression here (e.g., the legend
// gate flipping, or the decorator dropping the asterisk) would not be caught
// by the calc tests alone.
describe('Permit packet: NEC 220.83 existing dwelling — proposed loads on PDF', () => {
  // Reproduce the user's screenshot scenario from the verification protocol:
  // 1000 sq ft existing house, 125A main, 15 existing circuits + 1 proposed EV.
  // Circuit numbers / loads / breaker sizes mirror the calculations-extended
  // test (line 635) so the rendered PDF and the demand math share a fixture.
  const existingMdp: any = {
    id: 'pnl-mdp-existing',
    project_id: projectId,
    name: 'MDP',
    voltage: 240,
    phase: 1,
    bus_rating: 125,
    main_breaker_amps: 125,
    is_main: true,
    aic_rating: 10000,
    num_spaces: 30,
    location: 'Garage North Wall',
    manufacturer: 'Square D',
    model_number: 'QO130L125G',
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
    created_at: '2026-05-14T00:00:00Z',
  };

  // Helper — mint a circuit with sane defaults so the fixture stays readable.
  const mkCkt = (
    n: number,
    desc: string,
    watts: number,
    breaker: number,
    pole: 1 | 2 = 1,
    isProposed = false,
  ): any => ({
    id: `c-${n}`,
    project_id: projectId,
    panel_id: existingMdp.id,
    circuit_number: n,
    pole,
    breaker_amps: breaker,
    load_watts: watts,
    conductor_size: pole === 2 ? '8' : '12',
    description: desc,
    load_type: 'O',
    egc_size: pole === 2 ? '10' : '12',
    is_proposed: isProposed,
    created_at: '2026-05-14T00:00:00Z',
  });

  const existingCircuits: any[] = [
    mkCkt(1, 'Lighting Circuit 1', 1500, 15, 1),
    mkCkt(3, 'Lighting Circuit 2', 1500, 15, 1),
    mkCkt(5, 'Kitchen SA 1', 1500, 20, 1),
    mkCkt(7, 'Kitchen SA 2', 1500, 20, 1),
    mkCkt(9, 'Laundry', 1500, 20, 1),
    mkCkt(11, 'Bathroom Recepta', 1500, 20, 1),
    mkCkt(13, 'Garage Receptacles', 1500, 20, 1),
    mkCkt(15, 'Outdoor Recepta', 180, 20, 1),
    mkCkt(17, 'Refrigerator', 600, 20, 1),
    mkCkt(2, 'Electric Range', 12000, 50, 2),
    mkCkt(6, 'Electric Dryer', 5500, 30, 2),
    mkCkt(10, 'Electric Water Heater', 4500, 25, 2),
    mkCkt(14, 'Air Conditioning', 5000, 30, 2),
    mkCkt(18, 'Garbage Disposal', 500, 20, 1),
    mkCkt(19, 'Pool Pump', 1500, 10, 1),
  ];

  // The Proposed New Load — Level 2 EV charger added under this permit.
  // is_proposed=true must produce both the " *" suffix on the description
  // and the legend below the title block.
  const proposedEv: any = mkCkt(20, 'Level 2 EV Charger (48A)', 11500, 60, 2, true);

  const allCircuits = [...existingCircuits, proposedEv];

  // Decode a PDF buffer to a searchable string by inflating every FlateDecode
  // content stream and extracting the printable text that @react-pdf emits as
  // PDF text operators. @react-pdf uses two encodings inside content streams:
  //
  //   1. Tj operators with Latin1 string literals:  (Hello World) Tj
  //   2. TJ operators with hex strings + per-glyph kerning offsets:
  //        [<48656c6c6f> 10 <20576f726c64> 0] TJ
  //
  // The TJ form is the harder case — naive Latin1 decoding of the inflated
  // stream produces something like "<48656c6c6f>" that won't substring-match
  // "Hello". This helper:
  //   • inflates every FlateDecode `stream ... endstream` block
  //   • pulls out hex literals `<...>` and decodes them to ASCII
  //   • pulls out parenthesized string literals `(...)` too (handles the Tj
  //     path used for some metadata strings)
  //   • concatenates everything so a substring search finds the legend and
  //     decorated descriptions regardless of which operator emitted them.
  const extractTextFromPdf = async (blob: Blob): Promise<string> => {
    const buf = Buffer.from(await blob.arrayBuffer());
    const zlib = await import('zlib');
    let extracted = '';

    // Iterate `stream\r?\n ... \r?\nendstream` blocks. PDF syntax permits
    // either CR+LF or LF after the `stream` keyword.
    const streamRe = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let m: RegExpExecArray | null;
    while ((m = streamRe.exec(buf.toString('binary'))) !== null) {
      const streamBytes = Buffer.from(m[1], 'binary');
      let inflated: Buffer;
      try {
        inflated = zlib.inflateSync(streamBytes);
      } catch {
        // Non-FlateDecode stream (e.g., raw image data, embedded font) — skip.
        continue;
      }
      const streamText = inflated.toString('binary');

      // Pull hex literals: <48656c6c6f>  (TJ kerning arrays + single Tj hex).
      // Skip any with odd length or non-hex chars (defensive — they're not
      // real text strings).
      const hexRe = /<([0-9a-fA-F\s]+)>/g;
      let h: RegExpExecArray | null;
      while ((h = hexRe.exec(streamText)) !== null) {
        const hex = h[1].replace(/\s+/g, '');
        if (hex.length === 0 || hex.length % 2 !== 0) continue;
        try {
          const decoded = Buffer.from(hex, 'hex').toString('binary');
          extracted += decoded;
        } catch {
          // ignore
        }
      }

      // Pull parenthesized string literals: (Hello World)  (classic Tj path).
      // Note: full PDF literal-string syntax allows escapes and nested parens;
      // for our purposes — finding our own English strings — a non-greedy
      // match is sufficient.
      const litRe = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
      let l: RegExpExecArray | null;
      while ((l = litRe.exec(streamText)) !== null) {
        extracted += '\n' + l[1];
      }
    }
    return extracted;
  };

  it('renders proposed circuit with " *" suffix AND legend when markers ON', async () => {
    const buf = await pdf(
      React.createElement(
        Document,
        null,
        React.createElement(PanelSchedulePages, {
          panel: existingMdp,
          circuits: allCircuits,
          projectName: 'NEC 220.83 Existing Dwelling Test',
          projectAddress: '500 Residential Lane',
          showExistingNewMarkers: true,
        }) as any,
      ),
    ).toBlob();

    const text = await extractTextFromPdf(buf);

    // Legend must appear (the existing-construction marker disclosure).
    expect(text).toContain('Proposed new circuit');

    // Proposed EV description must carry the trailing asterisk. The
    // decorator at PanelScheduleDocuments.tsx:262-265 appends " *".
    expect(text).toMatch(/Level 2 EV Charger \(48A\)\s?\*/);

    // Existing circuit descriptions must NOT carry the asterisk. We pick
    // a couple of the higher-load existing rows since those reliably land
    // in the visible portion of the page (no clipping concerns).
    expect(text).toMatch(/Electric Range(?!\s?\*)/);
    expect(text).toMatch(/Electric Dryer(?!\s?\*)/);
  }, 30_000);

  it('omits asterisk and legend when markers OFF (gate works)', async () => {
    const buf = await pdf(
      React.createElement(
        Document,
        null,
        React.createElement(PanelSchedulePages, {
          panel: existingMdp,
          circuits: allCircuits,
          projectName: 'New Construction Test',
          projectAddress: '500 Greenfield Way',
          showExistingNewMarkers: false,
        }) as any,
      ),
    ).toBlob();

    const text = await extractTextFromPdf(buf);

    // No legend on new-construction packets.
    expect(text).not.toContain('Proposed new circuit');

    // No asterisk suffix on the EV description even though is_proposed=true
    // on the underlying circuit — the renderer must respect the gate.
    expect(text).not.toMatch(/Level 2 EV Charger \(48A\)\s?\*/);
    // But the description itself still renders (sanity).
    expect(text).toContain('Level 2 EV Charger');
  }, 30_000);

  it('full-generator E2E: existing-construction packet emits the legend', async () => {
    downloads.length = 0;

    const packet: PermitPacketData = {
      projectId,
      projectName: 'NEC 220.83 Smoke Test',
      projectAddress: '500 Residential Lane, Miami FL',
      projectType: 'Residential',
      serviceVoltage: 240,
      servicePhase: 1,
      panels: [existingMdp],
      circuits: allCircuits,
      feeders: [],
      transformers: [],
      preparedBy: 'E2E Harness',
      permitNumber: 'P-2026-22083',
      contractorLicense: 'C-10 #220-83',
      scopeOfWork:
        'Add Level 2 EV charger (48A) on existing 125A service per NEC 220.83.',
      // The key wiring under test: this flag flows to
      // permitPacketGenerator.tsx:1144 → PanelSchedulePages
      // showExistingNewMarkers prop.
      serviceModificationType: 'existing',
    };

    await generatePermitPacket(packet);

    expect(downloads).toHaveLength(1);
    const dl = downloads[0];
    expect(dl.bytes).toBeGreaterThan(10_000);

    // Opt-in disk dump so the user can visually inspect the rendered PDF.
    // Set E2E_DUMP_PDFS=1 in the env to write to tests/e2e/__output__/pdfs/.
    if (process.env.E2E_DUMP_PDFS === '1') {
      const fs = await import('fs');
      const path = await import('path');
      const outDir = path.resolve(__dirname, 'e2e/__output__/pdfs');
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, 'nec-220-83-existing-with-proposed-ev.pdf');
      fs.writeFileSync(outPath, Buffer.from(await dl.blob.arrayBuffer()));
      console.log(`[e2e dump] wrote ${outPath} (${dl.bytes} bytes)`);
    }

    const text = await extractTextFromPdf(dl.blob);

    // Final PDF must carry both artifacts on the panel-schedule page.
    expect(text).toContain('Proposed new circuit');
    expect(text).toMatch(/Level 2 EV Charger \(48A\)\s?\*/);
  }, 60_000);

  it('full-generator E2E: new-construction packet has NO legend (regression guard)', async () => {
    downloads.length = 0;

    const packet: PermitPacketData = {
      projectId,
      projectName: 'New Construction Smoke Test',
      projectAddress: '500 Greenfield Way, Orlando FL',
      projectType: 'Residential',
      serviceVoltage: 240,
      servicePhase: 1,
      panels: [existingMdp],
      // Same fixture (one circuit still happens to be flagged is_proposed)
      // but the project is new-construction — the renderer must hide the
      // marker entirely so we don't pollute every greenfield packet with
      // an unexplained asterisk.
      circuits: allCircuits,
      feeders: [],
      transformers: [],
      preparedBy: 'E2E Harness',
      contractorLicense: 'C-10 #NEW',
      scopeOfWork: 'New 125A service for new single-family dwelling.',
      serviceModificationType: 'new-service',
    };

    await generatePermitPacket(packet);

    expect(downloads).toHaveLength(1);
    const text = await extractTextFromPdf(downloads[0].blob);

    expect(text).not.toContain('Proposed new circuit');
  }, 60_000);
});
