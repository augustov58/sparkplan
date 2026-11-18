/**
 * #210: NEC 625.42 makes the EVEMS setpoint the maximum EV load on the feeder
 * AND the service. The Part III aggregate clamped only when the panel it ran
 * on was itself EVEMS-managed, so the MDP took a downstream EV panel's
 * chargers at full load. Values: the hand calculation in the issue's
 * Acceptance section ("QA EVEMS downstream").
 */
import { describe, it, expect } from 'vitest';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';
import { feederDesignLoadSplit } from '../services/feeder/feederLoadSync';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

const panel = (o: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel => ({
  bus_rating: 200, main_breaker_amps: 200, voltage: 240, phase: 1, num_spaces: 42, project_id: 'p',
  is_main: false, fed_from: 'mdp', fed_from_type: 'panel', fed_from_transformer_id: null, ...o,
} as unknown as Panel);
let n = 0;
const circuit = (panel_id: string, description: string, load_type: string, load_watts: number, is_proposed = true): Circuit => ({
  id: `c${n++}`, panel_id, description, load_type, load_watts, breaker_amps: 20, project_id: 'p',
  circuit_number: n, pole: 1, is_proposed,
} as unknown as Circuit);

const MARKER = 'EVEMS Aggregate Setpoint (NEC 625.42)';
const mdp = panel({ id: 'mdp', name: 'MDP', bus_rating: 400, main_breaker_amps: 400, is_main: true, fed_from: null, fed_from_type: 'service' });
const evPanel = panel({ id: 'ev', name: 'EV Panel' });
const office = panel({ id: 'office', name: 'Office Panel' });
const panels = [mdp, evPanel, office];
const base = [
  ...[1, 2, 3].map(i => circuit('ev', `EV Charger #${i}`, 'O', 11_520)),
  circuit('ev', 'Receptacles', 'R', 1_800),
  circuit('office', 'Lighting', 'L', 6_000),
  circuit('office', 'Receptacles', 'R', 6_000),
  circuit('office', 'Exterior sign', 'O', 1_500),
];
const circuits = [...base, circuit('ev', MARKER, 'O', 28_800)];

const agg = (id: string, cs = circuits, ps = panels, xs: Transformer[] = []) =>
  calculateAggregatedLoad(id, ps, cs, xs, 'commercial', undefined, '2020');

describe('the MDP counts a downstream EV panel at its EVEMS setpoint (#210)', () => {
  it('QA EVEMS downstream: MDP demand 44,100 VA, the sum of its feeders', () => {
    const r = agg('mdp');
    // 6,000 L + 7,800 R + 36,060 O = 49,860, less (34,560 − 28,800)
    expect(r.totalDemandVA).toBe(44_100);
    expect(r.totalDemandVA).toBe(agg('ev').totalDemandVA + agg('office').totalDemandVA);
    expect(r.totalConnectedVA).toBe(49_860); // chargers stay at nameplate in the connected load
    expect(r.necReferences).toContain('NEC 625.42 (EVEMS — feeder demand clamped to setpoint)');
    const row = r.demandBreakdown.find(b => b.loadType.startsWith('EVEMS feeder reduction'));
    expect(row).toMatchObject({ loadType: 'EVEMS feeder reduction (EV Panel)', connectedVA: 49_860, demandVA: 44_100 });
  });

  it('the proposed demand (E-101 split, the wizard\'s new load) takes the clamp', () => {
    const r = agg('mdp');
    expect(r.existingDemandVA).toBe(0);
    expect(r.proposedDemandVA).toBe(44_100);
  });

  it('agrees with the continuous adder, which already capped the chargers', () => {
    expect(feederDesignLoadSplit(['mdp'], agg('mdp').totalDemandVA, panels, circuits, [], '2020'))
      .toEqual({ continuousVA: 28_800 + 1_500, noncontinuousVA: 44_100 - 30_300 });
  });

  it('guardrails: the EV panel itself and the office panel are unchanged', () => {
    expect(agg('ev').totalDemandVA).toBe(30_600);
    expect(agg('ev').demandBreakdown.at(-1)?.loadType).toBe('EVEMS feeder reduction');
    expect(agg('office').totalDemandVA).toBe(13_500);
  });

  it('no marker → the MDP is not clamped', () => {
    const r = agg('mdp', base);
    expect(r.totalDemandVA).toBe(49_860);
    expect(r.demandBreakdown.some(b => b.loadType.startsWith('EVEMS'))).toBe(false);
  });

  it('a setpoint above the chargers\' load changes nothing', () => {
    const r = agg('mdp', [...base, circuit('ev', MARKER, 'O', 40_000)]);
    expect(r.totalDemandVA).toBe(49_860);
  });

  it('clamps an EV panel two levels down and one behind a transformer', () => {
    const sub = panel({ id: 'sub', name: 'Sub', fed_from: 'mdp' });
    const deepEv = panel({ id: 'ev', name: 'EV Panel', fed_from: 'sub' });
    expect(agg('mdp', circuits, [mdp, sub, deepEv, office]).totalDemandVA).toBe(44_100);

    const xfmr = { id: 'x1', name: 'T1', kva_rating: 75, fed_from_panel_id: 'mdp' } as unknown as Transformer;
    const xfEv = panel({ id: 'ev', name: 'EV Panel', fed_from: null, fed_from_type: 'transformer', fed_from_transformer_id: 'x1' });
    expect(agg('mdp', circuits, [mdp, xfEv, office], [xfmr]).totalDemandVA).toBe(44_100);
  });

  it('two EVEMS panels each clamp to their own setpoint', () => {
    const ev2 = panel({ id: 'ev2', name: 'EV Panel 2' });
    const cs = [
      ...circuits,
      ...[1, 2].map(i => circuit('ev2', `EV Charger #${i + 3}`, 'O', 11_520)),
      circuit('ev2', MARKER, 'O', 11_520),
    ];
    const r = agg('mdp', cs, [...panels, ev2]);
    // 44,100 + 23,040 − (23,040 − 11,520)
    expect(r.totalDemandVA).toBe(55_620);
    expect(r.demandBreakdown.at(-1)?.loadType).toBe('EVEMS feeder reduction (EV Panel, EV Panel 2)');
  });

  it('a setpoint on the MDP itself keeps its row (#191)', () => {
    const chargers = [1, 2, 3, 4].map(i => circuit('mdp', `EV Charger #${i}`, 'O', 11_520));
    const r = agg('mdp', [...chargers, circuit('mdp', MARKER, 'O', 20_000)], [mdp]);
    expect(r.totalDemandVA).toBe(20_000);
    expect(r.demandBreakdown.at(-1)).toMatchObject({ loadType: 'EVEMS feeder reduction', connectedVA: 46_080, demandVA: 20_000 });
  });
});
