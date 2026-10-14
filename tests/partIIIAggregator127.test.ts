/**
 * Issue #127 — Part III aggregator (`calculateAggregatedLoad`) fixes that
 * change no pass/fail verdicts: complete necReferences, existing/proposed
 * split by re-running the cascade on existing circuits, and non-dwelling
 * kitchen circuits labeled as kitchen equipment rather than ranges.
 */
import { describe, it, expect } from 'vitest';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';
import type { Panel, Circuit } from '../lib/database.types';

const mdp = {
  id: 'mdp', name: 'MDP', is_main: true, bus_rating: 200, voltage: 240, phase: 1, num_spaces: 42,
  project_id: 'p', fed_from: null, fed_from_type: 'service', fed_from_transformer_id: null,
} as unknown as Panel;

const circuit = (i: number, description: string, load_watts: number, load_type: string, is_proposed = false) =>
  ({ id: `c${i}`, panel_id: 'mdp', description, load_watts, load_type, is_proposed, breaker_amps: 20,
     project_id: 'p', circuit_number: 2 * i + 1, pole: 1 } as unknown as Circuit);

// The #121 / #127 repro panel.
const circuits = [
  circuit(0, 'General lighting', 6000, 'L'),
  circuit(1, 'Small appliance', 3000, 'R'),
  circuit(2, 'Laundry', 1500, 'R'),
  circuit(3, 'Range', 12000, 'K'),
  circuit(4, 'Dishwasher', 1200, 'K'),
  circuit(5, 'Dryer', 5000, 'D'),
  circuit(6, 'Water heater', 4500, 'W'),
  circuit(7, 'AC condenser', 5000, 'C'),
  circuit(8, 'Heat strip', 10000, 'H'),
  circuit(9, 'EV charger 40A', 9600, 'O', true),
];

describe('#127 item 1 — necReferences lists every applied section', () => {
  it('includes rows that previously appeared only in the breakdown (220.14 Other, 220.51 water heater)', () => {
    const agg = calculateAggregatedLoad('mdp', [mdp], circuits, [], 'dwelling');
    for (const row of agg.demandBreakdown) {
      expect(agg.necReferences).toContain(row.necReference);
    }
    expect(agg.necReferences.some(r => r.includes('220.14'))).toBe(true);
    expect(agg.necReferences.some(r => r.includes('220.51'))).toBe(true);
  });
});

describe('#127 item 2 — existing/proposed split re-runs the cascade on existing circuits', () => {
  for (const occupancy of ['dwelling', 'commercial'] as const) {
    it(`${occupancy}: a new 100%-demand load prints at its full nameplate as proposed`, () => {
      const agg = calculateAggregatedLoad('mdp', [mdp], circuits, [], occupancy);
      const existingOnly = calculateAggregatedLoad('mdp', [mdp], circuits.filter(c => !c.is_proposed), [], occupancy);

      expect(agg.existingDemandVA).toBe(Math.round(existingOnly.totalDemandVA));
      // EV is "Other" @ 100%: the increase is exactly its 9,600 VA nameplate
      // (the proportional split printed ~8,080 VA).
      expect(agg.proposedDemandVA).toBe(9600);
      expect(agg.existingDemandVA + agg.proposedDemandVA).toBe(Math.round(agg.totalDemandVA));
    });
  }

  it('no proposed circuits → proposed demand 0', () => {
    const agg = calculateAggregatedLoad('mdp', [mdp], circuits.filter(c => !c.is_proposed), [], 'commercial');
    expect(agg.proposedDemandVA).toBe(0);
  });
});

describe('#127 item 3 — non-dwelling K circuits are kitchen equipment, not ranges', () => {
  it('commercial: K row is "Kitchen Equipment" at 100% per 220.14, same demand as before', () => {
    const agg = calculateAggregatedLoad('mdp', [mdp], circuits, [], 'commercial');
    const row = agg.demandBreakdown.find(r => r.loadType === 'Kitchen Equipment');
    expect(row).toBeDefined();
    expect(row!.connectedVA).toBe(13200);
    expect(row!.demandVA).toBe(13200);
    expect(row!.necReference).toBe('NEC 220.14 (Kitchen equipment @100%)');
    expect(agg.demandBreakdown.some(r => r.loadType === 'Ranges/Ovens')).toBe(false);
    expect(agg.necReferences.some(r => r.includes('220.55'))).toBe(false);
  });

  it('dwelling: unchanged — still Table 220.55 (dwelling K re-bucketing is parked)', () => {
    const agg = calculateAggregatedLoad('mdp', [mdp], circuits, [], 'dwelling');
    const row = agg.demandBreakdown.find(r => r.loadType === 'Ranges/Ovens');
    expect(row!.necReference).toContain('220.55');
  });
});
