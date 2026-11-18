/**
 * #191 — the Panel Schedule's demand table and cards read the shared
 * aggregate run on the panel alone, the function the packet and the panel
 * schedule PDF use. The local walk it replaced put lighting and water heaters
 * at 125% and electric heat at 75% for four or more heating circuits.
 * Values are the hand calculation in the issue's Acceptance section.
 */
import { describe, it, expect } from 'vitest';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

const mdp = {
  id: 'mdp', name: 'MDP', bus_rating: 200, voltage: 208, phase: 3, num_spaces: 30, project_id: 'p',
  is_main: true, fed_from: null, fed_from_type: 'service', fed_from_transformer_id: null,
} as unknown as Panel;
let n = 0;
const circuit = (description: string, load_type: string, load_watts: number): Circuit => ({
  id: `c${n++}`, panel_id: 'mdp', load_watts, description, breaker_amps: 30, load_type, project_id: 'p',
  circuit_number: n * 2 - 1, pole: 1, is_proposed: false,
} as unknown as Circuit);

const circuits = [
  circuit('Lighting', 'L', 3000),
  circuit('Receptacles', 'R', 1800),
  circuit('Water heater', 'W', 4500),
  ...[1, 2, 3, 4].map(i => circuit(`Unit heater ${i}`, 'H', 3000)),
];

describe('Panel Schedule direct demand — shared aggregate on one panel (#191)', () => {
  const r = calculateAggregatedLoad('mdp', [mdp], circuits, [], 'commercial', undefined, '2020');
  const row = (name: string) => r.demandBreakdown.find(b => b.loadType.startsWith(name))!;

  it('takes lighting, water heating and four heating circuits at 100%', () => {
    expect(row('Lighting').demandVA).toBe(3000); // not × 1.25
    expect(row('Receptacles').demandVA).toBe(1800);
    expect(row('Water Heater').demandVA).toBe(4500); // not × 1.25
    expect(row('HVAC').demandVA).toBe(12000); // 220.51: 100%, not 75%
    expect(r.totalConnectedVA).toBe(21300);
    expect(r.totalDemandVA).toBe(21300);
    // 21,300 ÷ (208 × √3) = 59.1 A
    expect(r.totalDemandVA / (208 * Math.sqrt(3))).toBeCloseTo(59.1, 1);
  });

  it('never shows a row above its connected load', () => {
    for (const b of r.demandBreakdown) expect(b.demandVA).toBeLessThanOrEqual(b.connectedVA);
  });
});

describe('Panel Schedule direct demand — EVEMS-managed panel (#191)', () => {
  // The Panel Schedule hides the EVEMS marker from its row list; the direct
  // aggregate must still receive it, or the table total ignores the setpoint.
  const chargers = [1, 2, 3, 4].map(i => circuit(`EV Charger #${i}`, 'O', 11520));
  const marker = circuit('EVEMS Aggregate Setpoint (NEC 625.42)', 'O', 20000);

  it('clamps to the setpoint when the marker circuit is passed', () => {
    const r = calculateAggregatedLoad('mdp', [mdp], [...chargers, marker], [], 'commercial', undefined, '2020');
    expect(r.totalConnectedVA).toBe(46080);
    expect(r.totalDemandVA).toBe(20000); // 625.42: the setpoint
    expect(r.necReferences.some(ref => ref.includes('625.42'))).toBe(true);
    expect(r.demandBreakdown.find(b => b.loadType.includes('EVEMS'))!.demandVA).toBe(20000);
  });

  it('does not clamp without the marker (why the component passes every circuit)', () => {
    const r = calculateAggregatedLoad('mdp', [mdp], chargers, [], 'commercial', undefined, '2020');
    expect(r.totalDemandVA).toBe(46080);
  });

  it('counts only the selected panel when given the whole project\'s circuits', () => {
    const other = { ...circuit('Elsewhere', 'O', 9999), panel_id: 'other-panel' } as Circuit;
    const r = calculateAggregatedLoad('mdp', [mdp], [...chargers, marker, other], [], 'commercial', undefined, '2020');
    expect(r.totalConnectedVA).toBe(46080);
  });
});
