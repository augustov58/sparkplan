/**
 * #190 (PE ruling 2026-11-17): feeder design load = Article 220 demand + 25%
 * of the continuous loads on the feeder (215.2(A)(1), 215.3, 625.41), with the
 * service check's classifier (EV charging, signs, show windows; EVEMS at the
 * setpoint). Replaces a blanket 80% / 20% split (design = 1.20 × demand).
 * Values are the hand calculation in the issue's Acceptance section.
 */
import { describe, it, expect } from 'vitest';
import {
  feederDesignLoadSplit,
  feederDesignLoadVA,
  checkFeederLoadStatus,
  type FeederDesignContext,
} from '../services/feeder/feederLoadSync';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';
import { calculateFeederSizing } from '../services/calculations/feederSizing';
import type { Feeder } from '../types';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

const panel = (o: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel => ({
  bus_rating: 200, main_breaker_amps: 200, voltage: 240, phase: 1, num_spaces: 42, project_id: 'p',
  is_main: false, fed_from: 'mdp', fed_from_type: 'panel', fed_from_transformer_id: null, ...o,
} as unknown as Panel);
let n = 0;
const circuit = (panel_id: string, description: string, load_type: string, load_watts: number): Circuit => ({
  id: `c${n++}`, panel_id, description, load_type, load_watts, breaker_amps: 20, project_id: 'p',
  circuit_number: n, pole: 1, is_proposed: false,
} as unknown as Circuit);

const mdp = panel({ id: 'mdp', name: 'MDP', bus_rating: 400, main_breaker_amps: 400, is_main: true, fed_from: null, fed_from_type: 'service' });
const evPanel = panel({ id: 'ev', name: 'EV Panel' });
const office = panel({ id: 'office', name: 'Office Panel' });
const panels = [mdp, evPanel, office];
const circuits = [
  ...[1, 2, 3].map(i => circuit('ev', `EV Charger #${i}`, 'O', 11_520)),
  circuit('ev', 'Receptacles', 'R', 1_800),
  circuit('office', 'Lighting', 'L', 6_000),
  circuit('office', 'Receptacles', 'R', 6_000),
  circuit('office', 'Exterior sign', 'O', 1_500),
];
const design: FeederDesignContext = { transformers: [], occupancy: 'commercial', necEdition: '2020' };

const demand = (panelId: string, cs = circuits) =>
  calculateAggregatedLoad(panelId, panels, cs, [], 'commercial', undefined, '2020').totalDemandVA;

/** Size a 240 V single-phase feeder the way the Feeder Manager and E-103 do */
const size = (panelId: string, cs = circuits) => {
  const demandVA = demand(panelId, cs);
  const split = feederDesignLoadSplit([panelId], demandVA, panels, cs, [], '2020');
  return calculateFeederSizing({
    source_voltage: 240, source_phase: 1, destination_voltage: 240, destination_phase: 1,
    total_load_va: demandVA, continuous_load_va: split.continuousVA, noncontinuous_load_va: split.noncontinuousVA,
    distance_ft: 50, conductor_material: 'Cu', ambient_temperature_c: 30, num_current_carrying: 4,
    max_voltage_drop_percent: 3,
  });
};

describe('feeder design load = demand + 25% of the continuous loads (#190)', () => {
  it('F-EV: three 11,520 VA chargers and 1,800 VA of receptacles', () => {
    expect(demand('ev')).toBe(36_360);
    expect(feederDesignLoadSplit(['ev'], 36_360, panels, circuits, [], '2020'))
      .toEqual({ continuousVA: 34_560, noncontinuousVA: 1_800 });
    const r = size('ev');
    expect(r.design_load_va).toBe(45_000); // 36,360 + 8,640 (was 43,632 = 1.20 ×)
    expect(r.design_current_amps).toBeCloseTo(187.5, 6);
    expect(r.phase_conductor_size).toBe('250 kcmil'); // 187.5 ÷ 0.80 = 234.4 A > 4/0's 230 A
  });

  it('F-Office: only the sign is continuous; lighting and receptacles are not', () => {
    expect(demand('office')).toBe(13_500);
    expect(feederDesignLoadSplit(['office'], 13_500, panels, circuits, [], '2020'))
      .toEqual({ continuousVA: 1_500, noncontinuousVA: 12_000 });
    const r = size('office');
    expect(r.design_load_va).toBe(13_875); // 13,500 + 375 (was 16,200)
    expect(r.design_current_amps).toBe(57.8); // 13,875 ÷ 240 = 57.8125, rounded at output
    expect(r.phase_conductor_size).toBe('3 AWG'); // 60 °C termination: 4 AWG gives 70 × 0.80 = 56 A
  });

  it('an EVEMS panel counts its chargers at the setpoint', () => {
    const withMarker = [...circuits, circuit('ev', 'EVEMS Aggregate Setpoint (NEC 625.42)', 'O', 28_800)];
    expect(demand('ev', withMarker)).toBe(30_600); // setpoint + receptacles
    expect(feederDesignLoadSplit(['ev'], 30_600, panels, withMarker, [], '2020'))
      .toEqual({ continuousVA: 28_800, noncontinuousVA: 1_800 });
    expect(size('ev', withMarker).design_load_va).toBe(37_800); // 30,600 + 7,200
  });

  it('a feeder to the MDP counts the continuous loads of every panel under it', () => {
    const total = demand('mdp');
    expect(total).toBe(36_360 + 13_500);
    expect(feederDesignLoadSplit(['mdp'], total, panels, circuits, [], '2020').continuousVA).toBe(34_560 + 1_500);
  });

  it('never makes the continuous part larger than the demand', () => {
    expect(feederDesignLoadSplit(['ev'], 10_000, panels, circuits, [], '2020'))
      .toEqual({ continuousVA: 10_000, noncontinuousVA: 0 });
    expect(feederDesignLoadSplit(['ev'], 0, panels, circuits, [], '2020'))
      .toEqual({ continuousVA: 0, noncontinuousVA: 0 });
  });

  it('feederDesignLoadVA gives the Feeder Manager\'s design load', () => {
    expect(feederDesignLoadVA('ev', panels, circuits, design)).toBe(45_000);
    expect(feederDesignLoadVA('office', panels, circuits, design)).toBe(13_875);
  });
});

describe('stale check: a stored design load the rule no longer gives (#190)', () => {
  const feeder = (o: Partial<Feeder>): Feeder => ({
    id: 'f', name: 'F-EV', destination_panel_id: 'ev', total_load_va: 36_360, ...o,
  } as unknown as Feeder);

  it('flags a feeder stored with the old 1.20 × demand, though the connected load is unchanged', () => {
    const s = checkFeederLoadStatus(feeder({ design_load_va: 43_632 }), circuits, panels, 5, design);
    expect(s.loadDifferencePercent).toBe(0);
    expect(s.designChanged).toBe(true);
    expect(s.isStale).toBe(true);
    expect(s.cachedDesignVA).toBe(43_632);
    expect(s.currentDesignVA).toBe(45_000);
    expect(s.message).toContain('Design load 43.6 → 45.0 kVA');
  });

  it('flags the all-EV case, which moves only 4.2%', () => {
    const evOnly = circuits.filter(c => c.description !== 'Receptacles' || c.panel_id !== 'ev');
    // 34,560 × 1.20 = 41,472 stored; the rule now gives 34,560 × 1.25 = 43,200
    const s = checkFeederLoadStatus(
      feeder({ design_load_va: 41_472, total_load_va: 34_560 }), evOnly, panels, 5, design,
    );
    expect(s.designChanged).toBe(true);
    expect(s.currentDesignVA).toBe(43_200);
  });

  it('does not flag a feeder recalculated with the current rule', () => {
    const s = checkFeederLoadStatus(feeder({ design_load_va: 45_000 }), circuits, panels, 5, design);
    expect(s.designChanged).toBe(false);
    expect(s.isStale).toBe(false);
  });

  it('flags an EVEMS marker added after the last recalculation (no connected-load change)', () => {
    const withMarker = [...circuits, circuit('ev', 'EVEMS Aggregate Setpoint (NEC 625.42)', 'O', 28_800)];
    const s = checkFeederLoadStatus(feeder({ design_load_va: 45_000 }), withMarker, panels, 5, design);
    expect(s.loadDifferencePercent).toBe(0);
    expect(s.designChanged).toBe(true);
    expect(s.currentDesignVA).toBe(37_800);
  });

  it('never flags a capacity-based feeder', () => {
    // 200 A × 240 V = 48,000 VA stored as the load
    const s = checkFeederLoadStatus(feeder({ total_load_va: 48_000, design_load_va: 48_000 }), circuits, panels, 5, design);
    expect(s.isStale).toBe(false);
  });

  it('keeps the old behaviour when no design context is given', () => {
    const s = checkFeederLoadStatus(feeder({ design_load_va: 43_632 }), circuits, panels, 5);
    expect(s.designChanged).toBe(false);
    expect(s.isStale).toBe(false);
  });
});
