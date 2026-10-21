/**
 * PE ruling 2026-10-21 (Augusto, FL PE): under NEC 2023 the 220.57(A)
 * 7,200 VA floor applies to the EVSE wherever its load is counted — the
 * Part III aggregate (panels, feeders, MDP), the 220.84 total, and the
 * 220.87(2) new load. NEC 2020 has no 220.57: nameplate, unchanged.
 *
 * EVEMS: the load is the setpoint, capped at N × the per-EVSE load
 * (7,200 VA each under 2023), which the existing clamp already does.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateAggregatedLoad,
  calculateProposedNewLoadVA,
  buildMultiFamilyContext,
  withEvseLoadForEdition,
} from '../services/calculations/upstreamLoadAggregation';
import { calculateMultiFamilyLoad } from '../services/calculations/residentialLoad';
import { calculateMultiFamilyEV } from '../services/calculations/multiFamilyEV';
import { computeFeederLoadVA } from '../services/feeder/feederLoadSync';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

const panel = (o: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel => ({
  bus_rating: 400, voltage: 240, phase: 1, num_spaces: 42, project_id: 'p', is_main: false,
  fed_from: null, fed_from_type: null, fed_from_transformer_id: null, ...o,
} as unknown as Panel);
let n = 0;
const circuit = (panel_id: string, load_watts: number, description: string, is_proposed = false): Circuit => ({
  id: `c${n++}`, panel_id, load_watts, description, breaker_amps: 20, load_type: 'O', project_id: 'p',
  circuit_number: n, pole: 2, is_proposed,
} as unknown as Circuit);

// 10 × 16 A @ 240 V = 3,840 VA nameplate each (38,400 VA total).
const chargers = (proposed = false) =>
  Array.from({ length: 10 }, (_, i) => circuit('ev', 3_840, `EV Charger #${i + 1} - Level 2 (16A)`, proposed));
const evPanel = panel({ id: 'ev', name: 'EV Sub-Panel' });

describe('withEvseLoadForEdition', () => {
  it('2023 floors each EVSE at 7,200 VA; keeps larger nameplates, other loads and EVEMS markers', () => {
    const circuits = [
      circuit('ev', 3_840, 'EV Charger #1 (16A)'),
      circuit('ev', 11_520, 'EV Charger #2 (48A)'),
      circuit('ev', 1_800, 'Lighting Circuit'),
      circuit('ev', 60_000, 'EVEMS Aggregate Setpoint (NEC 625.42)'),
    ];
    expect(withEvseLoadForEdition(circuits, '2023').map(c => c.load_watts)).toEqual([7_200, 11_520, 1_800, 60_000]);
  });

  it('2020 returns the circuits unchanged', () => {
    const circuits = chargers();
    expect(withEvseLoadForEdition(circuits, '2020')).toBe(circuits);
  });
});

describe('Part III aggregate (panel / feeder demand)', () => {
  it('2023: 10 × 3.84 kVA chargers count 72 kVA; 2020: 38.4 kVA', () => {
    expect(calculateAggregatedLoad('ev', [evPanel], chargers(), [], 'commercial', undefined, '2023').totalConnectedVA).toBe(72_000);
    expect(calculateAggregatedLoad('ev', [evPanel], chargers(), [], 'commercial', undefined, '2020').totalConnectedVA).toBe(38_400);
  });

  it('EVEMS: setpoint 60 kVA, capped at N × 7,200 under 2023', () => {
    const withMarker = [...chargers(), circuit('ev', 60_000, 'EVEMS Aggregate Setpoint (NEC 625.42)')];
    // 2023: min(72,000, 60,000) = 60,000.
    expect(calculateAggregatedLoad('ev', [evPanel], withMarker, [], 'commercial', undefined, '2023').totalDemandVA).toBe(60_000);
    // 2020: the chargers' 38,400 is already below the setpoint.
    expect(calculateAggregatedLoad('ev', [evPanel], withMarker, [], 'commercial', undefined, '2020').totalDemandVA).toBe(38_400);
  });

  it('feeder load follows the edition', () => {
    const feeder = { destination_panel_id: 'ev', total_load_va: 0 } as never;
    expect(computeFeederLoadVA(feeder, [evPanel], chargers(), [], '2023')).toBe(72_000);
    expect(computeFeederLoadVA(feeder, [evPanel], chargers(), [], '2020')).toBe(38_400);
  });

  it('existing/proposed split uses the floored load', () => {
    const r = calculateAggregatedLoad('ev', [evPanel], chargers(true), [], 'commercial', undefined, '2023');
    expect(r.proposedConnectedVA).toBe(72_000);
    expect(r.existingConnectedVA).toBe(0);
  });
});

describe('220.84 multifamily MDP: EV panel at the edition load', () => {
  const mdp = panel({ id: 'mdp', name: 'MDP', is_main: true, bus_rating: 800 });
  const ev = panel({ id: 'ev', name: 'EV Sub-Panel', fed_from: 'mdp', fed_from_type: 'panel' });
  const units = [0, 1, 2].map(i => panel({ id: `u${i}`, name: `Unit ${i + 1}`, fed_from: 'mdp', fed_from_type: 'panel' }));
  const circuits = [...chargers(), ...units.map(u => circuit(u.id, 10_000, 'General Lighting'))];
  const settings = { occupancyType: 'dwelling', residential: { dwellingType: 'multi_family', totalUnits: 3 } };

  it('2023: context and MDP total carry 72 kVA of EV at 100%', () => {
    const ctx = buildMultiFamilyContext(mdp, [mdp, ev, ...units], circuits, [], settings, '2023')!;
    expect(ctx.evLoadVA).toBe(72_000);
    const r = calculateAggregatedLoad('mdp', [mdp, ev, ...units], circuits, [], 'dwelling', ctx, '2023');
    const evRow = r.demandBreakdown.find(b => b.loadType.startsWith('EV Charging'))!;
    expect(evRow.demandVA).toBe(72_000);
  });

  it('2020: 38.4 kVA', () => {
    const ctx = buildMultiFamilyContext(mdp, [mdp, ev, ...units], circuits, [], settings, '2020')!;
    expect(ctx.evLoadVA).toBe(38_400);
  });
});

describe('220.87(2) new load (E-102 prefill)', () => {
  it('2023: each 3.84 kVA EVSE enters at 7,200 × 1.25', () => {
    expect(calculateProposedNewLoadVA(chargers(true), '2023')).toBe(10 * 7_200 * 1.25);
    expect(calculateProposedNewLoadVA(chargers(true), '2020')).toBe(10 * 3_840 * 1.25);
  });

  it('2023 with EVEMS: min(setpoint, N × 7,200) × 1.25', () => {
    const withMarker = [...chargers(true), circuit('ev', 60_000, 'EVEMS Aggregate Setpoint (NEC 625.42)', true)];
    expect(calculateProposedNewLoadVA(withMarker, '2023')).toBe(60_000 * 1.25);
  });
});

describe('calculateMultiFamilyLoad (220.84 total)', () => {
  const run = (necEdition: '2020' | '2023') => calculateMultiFamilyLoad({
    unitTemplates: [{
      id: 't', name: '1BR', squareFootage: 850, unitCount: 12,
      appliances: { evCharger: { enabled: true, kw: 3.84, level: 2 } },
    }],
    necEdition,
  } as Parameters<typeof calculateMultiFamilyLoad>[0]);
  const appliancesRow = (r: ReturnType<typeof calculateMultiFamilyLoad>) =>
    r.breakdown.find(b => b.category === 'Appliance Loads (Nameplate)')!.connectedVA;

  it('2023: 12 unit EVSE at 7,200 VA, cites 220.57(A)', () => {
    const r = run('2023');
    expect(appliancesRow(r)).toBe(12 * 7_200);
    expect(r.necReferences).toContain('NEC 220.57(A) - EVSE load');
  });

  it('2020: nameplate, cites 220.14(A)', () => {
    const r = run('2020');
    expect(appliancesRow(r)).toBeCloseTo(12 * 3_840, 6);
    expect(r.necReferences).toContain('NEC 220.14(A) - EVSE load');
  });
});

describe('EVEMS notes show what a small charger can draw (NEC 2023)', () => {
  // 400 A service → 230 A setpoint shared by 10 × 16 A chargers (23 A share).
  const run = (necEdition: '2020' | '2023') => calculateMultiFamilyEV({
    dwellingUnits: 12, avgUnitSqFt: 850, voltage: 240, phase: 1, existingServiceAmps: 400,
    evChargers: { count: 10, level: 'Level2', ampsPerCharger: 16 }, necEdition, useEVEMS: true,
  });

  it('load stays the setpoint; notes cap the share at the 3.84 kW nameplate', () => {
    const r = run('2023');
    const e = r.scenarios.withEVEMS;
    expect(e.notes).toContain('EVEMS setpoint: 230A (service demand load per NEC 625.42)');
    expect(e.notes).toContain('10 chargers at full power: 3.8 kW each');
    expect(e.notes.some(n => n.includes('~23A each'))).toBe(false);
    expect(e.chargingPowerPerCharger_kW).toBeCloseTo(3.84, 6);
    // Load: the setpoint (~230 A × 240 V ≈ 55.2 kVA), below N × 7,200 —
    // unchanged by the display cap.
    expect(r.evLoad.demandVA).toBeCloseTo(e.powerPerCharger_kW! * 10 * 1000, 0);
    expect(r.evLoad.demandVA).toBeGreaterThan(55_000);
    expect(r.evLoad.demandVA).toBeLessThan(72_000);
  });

  it('direct-connection note gives the 220.57 load and the charger rating', () => {
    expect(run('2023').scenarios.noEVEMS.notes).toContain(
      'Per-EVSE load: 7.2 kVA (NEC 220.57(A) minimum; charger 16A @ 240V = 3.8 kW)',
    );
    expect(run('2020').scenarios.noEVEMS.notes).toContain('Per-EVSE load: 3.8 kVA (16A @ 240V)');
  });
});
