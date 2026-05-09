/**
 * Tests for services/estimating/autoTakeoffFromProject.ts.
 *
 * These tests use light fixtures rather than full DB rows; the function only
 * reads a small subset of fields. Where a column is unused the test fills in
 * a reasonable default and a `// unused` comment.
 */

import { describe, it, expect } from 'vitest';
import { autoTakeoffFromProject } from '../../services/estimating/autoTakeoffFromProject';
import type { Database } from '../../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];
type Feeder = Database['public']['Tables']['feeders']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

function panelRow(overrides: Partial<Panel> = {}): Panel {
  return {
    id: overrides.id ?? `p-${Math.random()}`,
    project_id: 'project-1',
    name: 'P1',
    voltage: 240,
    phase: 1,
    bus_rating: 200,
    main_breaker_amps: 200,
    is_main: false,
    location: null,
    manufacturer: null,
    model_number: null,
    nema_enclosure_type: null,
    notes: null,
    num_spaces: 40,
    aic_rating: null,
    fed_from: null,
    fed_from_transformer_id: null,
    fed_from_type: null,
    fed_from_circuit_number: null,
    fed_from_meter_stack_id: null,
    feeder_breaker_amps: null,
    feeder_conductor_size: null,
    feeder_conduit: null,
    feeder_length: null,
    series_rating: null,
    supplied_by_feeder_id: null,
    ul_listing: null,
    created_at: null,
    ...overrides,
  };
}

function feederRow(overrides: Partial<Feeder> = {}): Feeder {
  return {
    id: overrides.id ?? `f-${Math.random()}`,
    project_id: 'project-1',
    name: 'F1',
    conductor_material: 'Cu',
    distance_ft: 50,
    sets_in_parallel: 1,
    phase_conductor_size: '2',
    neutral_conductor_size: '2',
    egc_size: '8',
    conduit_size: '1.25',
    conduit_type: 'PVC',
    is_service_entrance: false,
    ambient_temperature_c: 30,
    continuous_load_va: null,
    design_load_va: null,
    destination_panel_id: null,
    destination_transformer_id: null,
    noncontinuous_load_va: null,
    num_current_carrying: 4,
    source_panel_id: null,
    source_transformer_id: null,
    total_load_va: null,
    voltage_drop_percent: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function circuitRow(overrides: Partial<Circuit> = {}): Circuit {
  return {
    id: overrides.id ?? `c-${Math.random()}`,
    project_id: 'project-1',
    panel_id: 'p-1',
    circuit_number: 1,
    description: 'Lighting',
    breaker_amps: 20,
    pole: 1,
    conductor_size: '12',
    egc_size: null,
    load_type: 'lighting',
    load_watts: 1500,
    created_at: null,
    ...overrides,
  };
}

function transformerRow(overrides: Partial<Transformer> = {}): Transformer {
  return {
    id: overrides.id ?? `t-${Math.random()}`,
    project_id: 'project-1',
    name: 'T1',
    kva_rating: 75,
    primary_voltage: 480,
    secondary_voltage: 208,
    primary_phase: 3,
    secondary_phase: 3,
    primary_breaker_amps: 100,
    catalog_number: null,
    connection_type: null,
    cooling_type: null,
    fed_from_circuit_number: null,
    fed_from_panel_id: null,
    impedance_percent: null,
    location: null,
    manufacturer: null,
    nema_type: null,
    notes: null,
    primary_conductor_size: null,
    secondary_breaker_amps: null,
    secondary_conductor_size: null,
    supplied_by_feeder_id: null,
    temperature_rise: null,
    ul_listing: null,
    winding_type: null,
    created_at: null,
    ...overrides,
  };
}

describe('autoTakeoffFromProject — empty project', () => {
  it('produces no line items and a friendly warning', () => {
    const r = autoTakeoffFromProject({ panels: [], circuits: [], feeders: [], transformers: [] });
    expect(r.lineItems).toEqual([]);
    expect(r.counts.total).toBe(0);
    expect(r.warnings.some((w) => w.includes('no panels'))).toBe(true);
  });
});

describe('autoTakeoffFromProject — single MDP', () => {
  it('emits material + labor for one panel', () => {
    const r = autoTakeoffFromProject({
      panels: [panelRow({ id: 'mdp', name: 'MDP', is_main: true, bus_rating: 200, main_breaker_amps: 200 })],
      circuits: [],
      feeders: [],
      transformers: [],
    });
    expect(r.counts.panels).toBe(1);
    // material + labor
    expect(r.lineItems).toHaveLength(2);
    const [mat, lab] = r.lineItems;
    expect(mat.category).toBe('material');
    expect(mat.source_kind).toBe('panel');
    expect(mat.source_id).toBe('mdp');
    expect(mat.description).toContain('MDP');
    expect(mat.unit_price).toBeGreaterThan(0);
    expect(mat.line_total).toBeGreaterThan(0);
    expect(lab.category).toBe('labor');
    expect(lab.unit).toBe('hr');
    expect(lab.taxable).toBe(false);
  });

  it('places MDP first when multiple panels exist', () => {
    const r = autoTakeoffFromProject({
      panels: [
        panelRow({ id: 'b1', name: 'BR-1', is_main: false }),
        panelRow({ id: 'mdp', name: 'MDP', is_main: true, bus_rating: 400 }),
        panelRow({ id: 'b2', name: 'BR-2', is_main: false }),
      ],
      circuits: [],
      feeders: [],
      transformers: [],
    });
    expect(r.lineItems[0].source_id).toBe('mdp');
  });
});

describe('autoTakeoffFromProject — feeder math', () => {
  it('phase conductor qty = distance × sets × 3', () => {
    const r = autoTakeoffFromProject({
      panels: [],
      feeders: [
        feederRow({
          id: 'f-1',
          name: 'F1',
          distance_ft: 100,
          sets_in_parallel: 2,
          phase_conductor_size: '4/0',
          neutral_conductor_size: '2/0',
          egc_size: '4',
          conduit_size: '3',
          conduit_type: 'PVC',
        }),
      ],
      circuits: [],
      transformers: [],
    });
    const phase = r.lineItems.find((li) => li.description.includes('phase conductors'));
    const neutral = r.lineItems.find((li) => li.description.includes('neutral conductor'));
    const egc = r.lineItems.find((li) => li.description.includes('grounding conductor'));
    const conduit = r.lineItems.find((li) => li.description.includes('PVC conduit'));
    const labor = r.lineItems.find(
      (li) => li.category === 'labor' && li.source_kind === 'feeder'
    );

    expect(phase?.quantity).toBe(600); // 100 ft × 2 sets × 3 conductors
    expect(neutral?.quantity).toBe(200); // 100 ft × 2 sets
    expect(egc?.quantity).toBe(100); // distance only (1 EGC per raceway)
    expect(conduit?.quantity).toBe(100);
    expect(labor?.quantity).toBeCloseTo(5, 5); // 100 ft × 0.05 hr/ft
  });

  it('warns when feeder has no distance', () => {
    const r = autoTakeoffFromProject({
      panels: [],
      feeders: [feederRow({ distance_ft: 0 })],
      circuits: [],
      transformers: [],
    });
    expect(r.warnings.some((w) => w.includes('no distance'))).toBe(true);
  });
});

describe('autoTakeoffFromProject — transformer', () => {
  it('emits material + labor for a transformer', () => {
    const r = autoTakeoffFromProject({
      panels: [],
      feeders: [],
      circuits: [],
      transformers: [transformerRow({ id: 't1', name: 'T1', kva_rating: 75 })],
    });
    expect(r.counts.transformers).toBe(1);
    const matRow = r.lineItems.find((li) => li.source_kind === 'transformer' && li.category === 'material');
    const labRow = r.lineItems.find((li) => li.source_kind === 'transformer' && li.category === 'labor');
    expect(matRow?.unit_price).toBeGreaterThan(0);
    expect(labRow?.taxable).toBe(false);
  });
});

describe('autoTakeoffFromProject — branch circuits grouped per panel', () => {
  it('emits one row per circuit + one bundled labor row per panel', () => {
    const r = autoTakeoffFromProject({
      panels: [panelRow({ id: 'p1', name: 'P1' })],
      feeders: [],
      transformers: [],
      circuits: [
        circuitRow({ id: 'c1', panel_id: 'p1', circuit_number: 1, breaker_amps: 20 }),
        circuitRow({ id: 'c2', panel_id: 'p1', circuit_number: 3, breaker_amps: 20 }),
        circuitRow({ id: 'c3', panel_id: 'p1', circuit_number: 5, breaker_amps: 30 }),
      ],
    });
    const circuitRows = r.lineItems.filter((li) => li.source_kind === 'circuit');
    expect(circuitRows).toHaveLength(3);
    expect(circuitRows.map((li) => li.source_id)).toEqual(['c1', 'c2', 'c3']);

    // Bundled labor row sourced to the panel.
    const panelLabor = r.lineItems.find(
      (li) => li.category === 'labor' && li.source_id === 'p1' && li.description.includes('branch circuit')
    );
    expect(panelLabor).toBeTruthy();
    // 3 circuits × 1.5 hr = 4.5 hr.
    expect(panelLabor?.quantity).toBeCloseTo(4.5, 5);
  });

  it('handles 2-pole circuits via the bundle multiplier', () => {
    const r = autoTakeoffFromProject({
      panels: [panelRow({ id: 'p1', name: 'P1' })],
      feeders: [],
      transformers: [],
      circuits: [
        circuitRow({ id: 'c1', panel_id: 'p1', circuit_number: 1, breaker_amps: 50, pole: 2 }),
      ],
    });
    const matRow = r.lineItems.find((li) => li.source_kind === 'circuit');
    // 50A 2P bundle base $68 × 1.6 pole multiplier = ~$108.80 cost; sale price = cost × 1.25
    expect(matRow?.unit_price).toBeGreaterThan(100);
  });
});

describe('autoTakeoffFromProject — full small project', () => {
  it('produces a coherent takeoff for MDP + 1 sub-panel + 1 transformer + 1 feeder + 5 circuits', () => {
    const r = autoTakeoffFromProject({
      panels: [
        panelRow({ id: 'mdp', name: 'MDP', is_main: true, bus_rating: 400, main_breaker_amps: 400 }),
        panelRow({ id: 'h1', name: 'H1', is_main: false, bus_rating: 100, main_breaker_amps: 100 }),
      ],
      transformers: [transformerRow({ id: 't1', name: 'T1', kva_rating: 45 })],
      feeders: [
        feederRow({
          id: 'f1',
          name: 'F-MDP-H1',
          distance_ft: 35,
          phase_conductor_size: '2',
          neutral_conductor_size: '2',
          egc_size: '8',
          conduit_size: '1.25',
          conduit_type: 'EMT',
        }),
      ],
      circuits: Array.from({ length: 5 }, (_, i) =>
        circuitRow({ id: `c${i}`, panel_id: 'h1', circuit_number: i * 2 + 1, breaker_amps: 20 })
      ),
    });

    expect(r.counts.panels).toBe(2);
    expect(r.counts.transformers).toBe(1);
    expect(r.counts.feeders).toBe(1);
    expect(r.counts.circuits).toBe(5);

    // No fallback prices for known sizes/values.
    expect(r.warnings.filter((w) => w.includes('fallback'))).toEqual([]);

    // Sum totals positive.
    const sum = r.lineItems.reduce((acc, li) => acc + li.line_total, 0);
    expect(sum).toBeGreaterThan(0);
  });
});
