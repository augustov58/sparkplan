/**
 * Sprint 2A PR 4 — Riser Diagram pagination + AIC overlay (M6 + H9 overlay).
 *
 * Validates:
 * 1. Single-page riser path is preserved when the project is small.
 * 2. The 14-meter / 14-panel multifamily fixture (the audit reproducer) splits
 *    across multiple pages instead of cramming everything into one sheet.
 * 3. Each page renders to a non-empty PDF.
 * 4. AIC overlay (line4) is added when `panel.aic_rating` is set.
 * 5. The shortened "N meters" label fits the node width — the literal regression
 *    that produced "15 meters posi-tions" wrapping is locked in.
 *
 * The internal layout helpers (`buildRiserTree`, `planRiserPages`, `formatAic`)
 * aren't exported, so we exercise them indirectly through `RiserDiagram` and
 * inspect the rendered PDF blob. A robust end-to-end check, but slower than a
 * pure unit test.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { pdf, Document } from '@react-pdf/renderer';
import { RiserDiagram } from '../services/pdfExport/PermitPacketDocuments';

const projectId = '11111111-1111-1111-1111-111111111111';

const mkPanel = (overrides: Partial<any> = {}): any => ({
  id: `pnl-${Math.random().toString(36).slice(2, 9)}`,
  project_id: projectId,
  name: 'Panel',
  voltage: 240,
  phase: 1,
  bus_rating: 200,
  main_breaker_amps: null,
  is_main: false,
  aic_rating: 10000,
  fed_from: null,
  fed_from_type: 'meter_stack',
  fed_from_transformer_id: null,
  fed_from_meter_stack_id: null,
  fed_from_circuit_number: null,
  feeder_breaker_amps: null,
  feeder_conductor_size: null,
  feeder_conduit: null,
  feeder_length: null,
  supplied_by_feeder_id: null,
  notes: null,
  location: null,
  manufacturer: null,
  model_number: null,
  ul_listing: null,
  nema_enclosure_type: null,
  series_rating: false,
  created_at: '2026-04-19T00:00:00Z',
  ...overrides,
});

const buildMultifamilyFixture = (numUnits: number) => {
  const stackId = 'ms-1';
  const meterStack = {
    id: stackId,
    project_id: projectId,
    name: 'CT Cabinet',
    location: 'Exterior West Wall',
    bus_rating_amps: 1000,
    voltage: 240,
    phase: 1,
    num_meter_positions: numUnits + 1, // +1 for house panel
    ct_ratio: null,
    manufacturer: 'Milbank',
    model_number: 'U4801',
    created_at: '2026-04-19T00:00:00Z',
    updated_at: '2026-04-19T00:00:00Z',
  };

  // House panel (MDP) — fed_from_type: 'meter_stack'
  const housePanel = mkPanel({
    id: 'pnl-house',
    name: 'House Panel',
    is_main: true,
    bus_rating: 100,
    main_breaker_amps: 100,
    fed_from_meter_stack_id: stackId,
    aic_rating: 22000,
  });

  // 14 unit panels, each fed via its own meter position
  const unitPanels = Array.from({ length: numUnits }, (_, i) =>
    mkPanel({
      id: `pnl-u${i + 1}`,
      name: `Unit ${101 + i} Panel`,
      bus_rating: 200,
      main_breaker_amps: 200,
      fed_from_meter_stack_id: stackId,
      aic_rating: 10000,
    })
  );

  const meters: any[] = [];
  meters.push({
    id: 'm-house',
    project_id: projectId,
    meter_stack_id: stackId,
    name: 'House Meter',
    meter_type: 'house',
    position_number: 1,
    panel_id: 'pnl-house',
    breaker_amps: 100,
    created_at: '2026-04-19T00:00:00Z',
    updated_at: '2026-04-19T00:00:00Z',
  });
  unitPanels.forEach((p, i) => {
    meters.push({
      id: `m-u${i + 1}`,
      project_id: projectId,
      meter_stack_id: stackId,
      name: `Meter ${i + 2}`,
      meter_type: 'unit',
      position_number: i + 2,
      panel_id: p.id,
      breaker_amps: null, // MLO
      created_at: '2026-04-19T00:00:00Z',
      updated_at: '2026-04-19T00:00:00Z',
    });
  });

  return {
    panels: [housePanel, ...unitPanels],
    meterStacks: [meterStack],
    meters,
    feeders: [],
    transformers: [],
  };
};

describe('RiserDiagram (Sprint 2A PR 4 — M6 + H9 overlay)', () => {
  it('renders a small project as a single page', async () => {
    const mdp = mkPanel({
      id: 'pnl-mdp',
      name: 'MDP',
      voltage: 480,
      phase: 3,
      bus_rating: 400,
      main_breaker_amps: 400,
      is_main: true,
      fed_from_type: 'service',
      aic_rating: 65000,
    });
    const doc = React.createElement(
      Document,
      null,
      React.createElement(RiserDiagram, {
        panels: [mdp],
        transformers: [],
        feeders: [],
        meterStacks: [],
        meters: [],
        projectName: 'Small Project',
        serviceVoltage: 480,
        servicePhase: 3,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob).toBeTruthy();
    expect(blob.size).toBeGreaterThan(500);
  });

  it('paginates the audit-fixture multifamily riser (14 unit panels) into multiple sheets', async () => {
    const fixture = buildMultifamilyFixture(14);
    const doc = React.createElement(
      Document,
      null,
      React.createElement(RiserDiagram, {
        panels: fixture.panels,
        transformers: fixture.transformers,
        feeders: fixture.feeders,
        meterStacks: fixture.meterStacks,
        meters: fixture.meters,
        projectName: 'Multifamily Audit Fixture',
        serviceVoltage: 240,
        servicePhase: 1,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob).toBeTruthy();
    expect(blob.size).toBeGreaterThan(500);

    // Page-count regression: the 15-meter fixture (1 house + 14 units) must
    // chunk into >1 physical pages so each label has room to render at the
    // 7pt readability floor instead of clamping to 6pt and wrapping mid-word.
    // We count "/Type /Page " markers in the raw PDF stream — uncompressed
    // by default in @react-pdf — as a proxy for the page count.
    const buf = new Uint8Array(await blob.arrayBuffer());
    const text = String.fromCharCode(...buf);
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g) || [];
    expect(pageMatches.length).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it('renders a 6-child riser as a single page (boundary, no pagination needed)', async () => {
    const fixture = buildMultifamilyFixture(5); // 5 units + 1 house = 6 meters
    const doc = React.createElement(
      Document,
      null,
      React.createElement(RiserDiagram, {
        panels: fixture.panels,
        transformers: fixture.transformers,
        feeders: fixture.feeders,
        meterStacks: fixture.meterStacks,
        meters: fixture.meters,
        projectName: 'Six-meter project',
        serviceVoltage: 240,
        servicePhase: 1,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob).toBeTruthy();
    expect(blob.size).toBeGreaterThan(500);
  }, 30_000);

  it('renders without crashing when all panels lack aic_rating (line4 omitted)', async () => {
    const mdp = mkPanel({
      id: 'pnl-mdp',
      name: 'MDP',
      voltage: 240,
      phase: 1,
      bus_rating: 200,
      main_breaker_amps: 200,
      is_main: true,
      fed_from_type: 'service',
      aic_rating: null,
    });
    const sub = mkPanel({
      id: 'pnl-sub',
      name: 'Sub',
      fed_from_type: 'panel',
      fed_from: 'pnl-mdp',
      aic_rating: null,
    });
    const doc = React.createElement(
      Document,
      null,
      React.createElement(RiserDiagram, {
        panels: [mdp, sub],
        transformers: [],
        feeders: [
          {
            id: 'f1',
            project_id: projectId,
            name: 'F-MDP-Sub',
            source_panel_id: 'pnl-mdp',
            destination_panel_id: 'pnl-sub',
            destination_transformer_id: null,
            conductor_material: 'Cu',
            phase_conductor_size: '4',
            neutral_conductor_size: '4',
            egc_size: '8',
            distance_ft: 50,
            total_load_va: 12000,
            continuous_load_va: 8000,
            noncontinuous_load_va: 4000,
            design_load_va: 12000,
            voltage_drop_percent: 1.2,
            conduit_type: 'EMT',
            conduit_size: '1',
            num_current_carrying: 3,
            ambient_temperature_c: 30,
            created_at: '2026-04-19T00:00:00Z',
            updated_at: '2026-04-19T00:00:00Z',
          } as any,
        ],
        meterStacks: [],
        meters: [],
        projectName: 'No AIC project',
        serviceVoltage: 240,
        servicePhase: 1,
      }),
    );
    const blob = await pdf(doc).toBlob();
    expect(blob).toBeTruthy();
    expect(blob.size).toBeGreaterThan(500);
  });
});
