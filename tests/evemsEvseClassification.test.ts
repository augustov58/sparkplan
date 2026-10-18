/**
 * EVEMS / EVSE classification fixes from the 2026-10-14 QA (#139, #144, #156, #164).
 */
import { describe, it, expect } from 'vitest';
import { generateCustomEVPanel } from '../data/ev-panel-templates';
import {
  calculateAggregatedLoad,
  buildMultiFamilyContext,
} from '../services/calculations/upstreamLoadAggregation';
import { splitFeederDesignLoad } from '../services/feeder/feederLoadSync';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

const panel = (o: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel => ({
  bus_rating: 200, voltage: 240, phase: 1, num_spaces: 42, project_id: 'p', is_main: false,
  fed_from: null, fed_from_type: null, fed_from_transformer_id: null, ...o,
} as unknown as Panel);
let n = 0;
const circuit = (panel_id: string, load_watts: number, description: string, breaker_amps = 20): Circuit => ({
  id: `c${n++}`, panel_id, load_watts, description, breaker_amps, load_type: 'O', project_id: 'p',
  circuit_number: n, pole: 2,
} as unknown as Circuit);

describe('#139 generated chargers use the calculator rating', () => {
  const chargers = (amps: number) =>
    generateCustomEVPanel({
      projectId: 'p',
      config: { chargerType: 'Level 2 (48A)', chargerAmps: amps, numberOfChargers: 2, useEVEMS: false, includeSpare: false, includeLighting: false },
    }).circuits.filter(c => c.isEvCharger);

  it('40 A charger → 50 A breaker, 8 AWG Cu, 9,600 VA', () => {
    const [c] = chargers(40);
    expect(c!.breakerAmps).toBe(50);
    expect(c!.conductorSize).toBe('8 AWG Cu');
    expect(c!.loadVA).toBe(9_600);
    expect(c!.description).toContain('Level 2 (40A)');
  });

  it('48 A still matches the old preset (60 A, 6 AWG, 11,520 VA)', () => {
    const [c] = chargers(48);
    expect(c!.breakerAmps).toBe(60);
    expect(c!.conductorSize).toBe('6 AWG Cu');
    expect(c!.loadVA).toBe(11_520);
  });
});

describe('#144 EVEMS clamp limits the chargers, not the whole panel', () => {
  it('EV panel demand = setpoint + non-EVSE loads; marker is not load (#156)', () => {
    const ev = panel({ id: 'ev', name: 'EV Sub-Panel', bus_rating: 300 });
    const circuits = [
      ...Array.from({ length: 8 }, (_, i) => circuit('ev', 11_520, `EV Charger #${i + 1} - Level 2 (48A) (EVEMS managed)`, 60)),
      circuit('ev', 1_800, 'Lighting Circuit'),
      circuit('ev', 30_240, 'EVEMS Aggregate Setpoint (NEC 625.42)'),
    ];
    const r = calculateAggregatedLoad('ev', [ev], circuits, [], 'commercial');
    expect(r.totalConnectedVA).toBe(8 * 11_520 + 1_800);
    expect(r.totalDemandVA).toBe(30_240 + 1_800);
  });

  it('feeder split is shared: 80% continuous / 20% non-continuous', () => {
    expect(splitFeederDesignLoad(32_040)).toEqual({ continuousVA: 32_040 * 0.8, noncontinuousVA: 32_040 * 0.2 });
  });
});

describe('#164 EV panel classification in the multifamily context', () => {
  it('"Elevator Panel" is not an EV panel; a panel with chargers is', () => {
    const mdp = panel({ id: 'mdp', name: 'Riverview MDP', is_main: true, bus_rating: 800 });
    const units = Array.from({ length: 3 }, (_, i) =>
      panel({ id: `u${i}`, name: `Unit ${101 + i} Panel`, fed_from_type: 'panel', fed_from: 'mdp' }));
    const elevator = panel({ id: 'elev', name: 'Elevator Panel', fed_from_type: 'panel', fed_from: 'mdp' });
    const garage = panel({ id: 'gar', name: 'Garage Chargers', fed_from_type: 'panel', fed_from: 'mdp' });
    const circuits = [
      ...units.map(u => circuit(u.id, 20_000, 'Kitchen Small Appliance')),
      circuit('elev', 15_000, 'Elevator Motor'),
      circuit('gar', 9_600, 'EV Charger 40A', 50),
    ];
    const ctx = buildMultiFamilyContext(mdp, [mdp, ...units, elevator, garage], circuits, [], {
      occupancyType: 'dwelling',
      residential: { dwellingType: 'multi_family', totalUnits: 3 },
    });
    expect(ctx?.evPanelIds).toEqual(['gar']);
    expect(ctx?.evLoadVA).toBe(9_600);
  });
});
