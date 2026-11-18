/**
 * #179 (PE ruling 2026-11-17): on a dwelling project, a unit panel's aggregate
 * (its feeder, the MDP's feed-thru row) is the unit page's own calculation
 * (`calculateDwellingUnitPanelLoad`, #155), and a multifamily house panel takes
 * the non-dwelling Part III rules, at its own level and in the MDP's 220.84
 * total (220.84(B)). EV panels and single-family subpanels (#217) keep the
 * per-type cascade. Values: the hand calculation in the issue's Acceptance
 * section ("QA MF feeders": the Multi-Family generator's own circuits).
 */
import { describe, it, expect } from 'vitest';
import {
  buildMultiFamilyContext,
  calculateAggregatedLoad,
  type DwellingAggregateOptions,
} from '../services/calculations/upstreamLoadAggregation';
import { calculateDwellingUnitPanelLoad } from '../services/calculations/residentialLoad';
import { computeFeederLoadVA, feederDesignLoadVA } from '../services/feeder/feederLoadSync';
import type { Feeder } from '../types';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

const panel = (o: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel => ({
  bus_rating: 125, main_breaker_amps: 125, voltage: 240, phase: 1, num_spaces: 42, project_id: 'p',
  is_main: false, fed_from: 'mdp', fed_from_type: 'panel', fed_from_transformer_id: null, ...o,
} as unknown as Panel);
let n = 0;
const circuit = (panel_id: string, description: string, load_type: string | null, load_watts: number, is_proposed = false): Circuit => ({
  id: `c${n++}`, panel_id, description, load_type, load_watts, breaker_amps: 20, project_id: 'p',
  circuit_number: n, pole: 1, is_proposed,
} as unknown as Circuit);

/** One unit panel exactly as the Multi-Family generator writes it */
const unitCircuits = (id: string) => [
  circuit(id, 'Kitchen Small Appliance #1', 'K', 1_500),
  circuit(id, 'Kitchen Small Appliance #2', 'K', 1_500),
  circuit(id, 'Laundry', 'R', 1_500),
  circuit(id, 'Bathroom(s)', 'R', 0),
  circuit(id, 'General Lighting', 'L', 1_500),
  circuit(id, 'General Lighting #2', 'L', 1_500),
  circuit(id, 'Range/Oven', 'K', 12_000),
  circuit(id, 'Clothes Dryer', 'D', 5_500),
  circuit(id, 'A/C Condensing Unit', 'C', 5_000),
  circuit(id, 'Water Heater', 'W', 4_500),
  circuit(id, 'Dishwasher', 'K', 1_500),
  circuit(id, 'Disposal', 'M', 500),
];
const houseCircuits = (typed: boolean) => [
  circuit('house', 'Lobby & Corridor Lighting', typed ? 'L' : null, 4_800),
  circuit('house', 'Exterior & Parking Lighting', typed ? 'L' : null, 2_400),
  circuit('house', 'Common Area Receptacles', typed ? 'R' : null, 1_600),
  circuit('house', 'Elevator', typed ? 'M' : null, 4_000),
  circuit('house', 'Fire Alarm System', null, 500),
  circuit('house', 'Common Laundry', null, 5_000),
];

const mdp = panel({ id: 'mdp', name: 'MDP', bus_rating: 400, main_breaker_amps: 400, is_main: true, fed_from: null, fed_from_type: 'meter_stack' });
const units = ['101', '102', '103'].map(u => panel({ id: `u${u}`, name: `Unit ${u} Panel` }));
const house = panel({ id: 'house', name: 'House Panel', bus_rating: 100, main_breaker_amps: 100 });
const panels = [mdp, ...units, house];
const circuits = [...units.flatMap(u => unitCircuits(u.id)), ...houseCircuits(true)];

const MF_NEW: DwellingAggregateOptions = { multiFamily: true, existingBuilding: false };
const agg = (id: string, cs = circuits, opts: DwellingAggregateOptions | undefined = MF_NEW) =>
  calculateAggregatedLoad(id, panels, cs, [], 'dwelling', undefined, '2020', opts);

describe('a unit panel aggregates as its page does (#179)', () => {
  it('Unit 101: 29,700 VA, the unit page\'s Part III, not 37,125 (every K as a range)', () => {
    const r = agg('u101');
    // general 7,500 → 4,575; range 8,000; dryer 5,500; A/C 5,000; WH + DW + disposal 6,500; motor 125
    expect(r.totalDemandVA).toBe(29_700);
    const page = calculateDwellingUnitPanelLoad({ circuits: unitCircuits('u101'), existingBuilding: false, necEdition: '2020' });
    expect(r.totalDemandVA).toBe(page.totalDemandVA);
    expect(r.totalConnectedVA).toBe(36_500);
    // rows sum to the totals (#160)
    expect(r.demandBreakdown.reduce((s, b) => s + b.connectedVA, 0)).toBe(36_500);
    expect(Math.round(r.demandBreakdown.reduce((s, b) => s + b.demandVA, 0))).toBe(29_700);
    expect(r.demandBreakdown.some(b => b.loadType.includes('Ranges'))).toBe(false);
  });

  it('the old per-type cascade gave 37,125 (dwelling) and 36,625 (commercial)', () => {
    // A panel not named like a unit keeps the cascade: same circuits, renamed
    const renamed = panels.map(p => (p.id === 'u101' ? { ...p, name: 'Panel A' } : p));
    expect(calculateAggregatedLoad('u101', renamed, circuits, [], 'dwelling', undefined, '2020', MF_NEW).totalDemandVA).toBe(37_125);
    expect(agg('u101').totalDemandVA).not.toBe(37_125);
  });

  it('feeders: Feeder Manager design load and the voltage-drop page\'s load are 29,700 VA', () => {
    expect(feederDesignLoadVA('u101', panels, circuits, { transformers: [], occupancy: 'dwelling', necEdition: '2020', dwelling: MF_NEW }))
      .toBe(29_700); // no continuous loads in the unit
    const feeder = { id: 'f', destination_panel_id: 'u101', total_load_va: 0 } as unknown as Feeder;
    expect(computeFeederLoadVA(feeder, panels, circuits, [], '2020', 'dwelling', MF_NEW)).toBe(29_700);
    // the old hard-coded commercial cascade stays the default for non-dwelling callers
    expect(computeFeederLoadVA(feeder, panels, circuits, [], '2020')).toBe(36_625);
  });

  it('existing building with a proposed circuit on the unit → 220.83, as the unit page', () => {
    const cs = [...unitCircuits('u101'), circuit('u101', 'EV Charger', 'O', 7_680, true)];
    const r = calculateAggregatedLoad('u101', panels, cs, [], 'dwelling', undefined, '2020', { multiFamily: true, existingBuilding: true });
    const page = calculateDwellingUnitPanelLoad({ circuits: cs, existingBuilding: true, necEdition: '2020' });
    expect(page.necArticle).toContain('220.83');
    expect(r.totalDemandVA).toBe(page.totalDemandVA);
  });
});

describe('a multifamily house panel takes the non-dwelling Part III rules (#179, 220.84(B))', () => {
  it('House Panel: 19,300 VA (lighting 100%, elevator 125%), not 16,570 (dwelling lighting tiers)', () => {
    const r = agg('house');
    // 7,200 L + 1,600 R + 4,000 × 1.25 + 5,500 O
    expect(r.totalDemandVA).toBe(19_300);
    expect(r.demandBreakdown.find(b => b.loadType === 'Lighting')).toMatchObject({ connectedVA: 7_200, demandVA: 7_200 });
    // without the multifamily flag (a single-family "Guest House" panel) it is not a house panel
    expect(agg('house', circuits, { multiFamily: false, existingBuilding: false }).totalDemandVA).toBe(16_570);
  });

  it('the MDP\'s 220.84 total takes the house load at its Part III demand', () => {
    const ctx = buildMultiFamilyContext(mdp, panels, circuits, [], {
      occupancyType: 'dwelling', residential: { dwellingType: 'multi_family', totalUnits: 3 },
    }, '2020');
    expect(ctx).toMatchObject({ housePanelLoadVA: 18_300, housePanelDemandVA: 19_300 });
    const r = calculateAggregatedLoad('mdp', panels, circuits, [], 'dwelling', ctx, '2020', MF_NEW);
    expect(r.totalConnectedVA).toBe(127_800);
    expect(r.totalDemandVA).toBe(49_275 + 19_300); // 109,500 × 45% + house
    expect(r.demandBreakdown.find(b => b.loadType === 'House Panel / Common Areas')).toMatchObject({
      connectedVA: 18_300, demandVA: 19_300, necReference: 'NEC 220.84(B) (house loads per NEC 220 Part III)',
    });
    expect(r.existingDemandVA + r.proposedDemandVA).toBe(r.totalDemandVA);
  });

  it('a generated house panel (no load types) is unchanged: every circuit at 100%', () => {
    const cs = [...units.flatMap(u => unitCircuits(u.id)), ...houseCircuits(false)];
    const ctx = buildMultiFamilyContext(mdp, panels, cs, [], {
      occupancyType: 'dwelling', residential: { dwellingType: 'multi_family', totalUnits: 3 },
    }, '2020');
    expect(ctx?.housePanelDemandVA).toBe(18_300);
    expect(calculateAggregatedLoad('mdp', panels, cs, [], 'dwelling', ctx, '2020', MF_NEW).totalDemandVA).toBe(67_575);
  });

  it('a two-unit service adds the house panel at its Part III demand', () => {
    const twoPanels = [mdp, units[0]!, units[1]!, house];
    const cs = [...unitCircuits('u101'), ...unitCircuits('u102'), ...houseCircuits(true)];
    const ctx = buildMultiFamilyContext(mdp, twoPanels, cs, [], {
      occupancyType: 'dwelling', residential: { dwellingType: 'multi_family', totalUnits: 2 },
    }, '2020');
    const r = calculateAggregatedLoad('mdp', twoPanels, cs, [], 'dwelling', ctx, '2020', MF_NEW);
    const houseRow = r.demandBreakdown.find(b => b.loadType === 'House Panel / Common Areas');
    expect(houseRow).toMatchObject({ connectedVA: 18_300, demandVA: 19_300 });
  });
});

describe('unchanged (#179 guardrails)', () => {
  it('an EV panel on a dwelling project keeps the per-type cascade and its EVEMS clamp', () => {
    const ev = panel({ id: 'ev', name: 'EV Sub-Panel' });
    const cs = [
      ...[1, 2, 3].map(i => circuit('ev', `EV Charger #${i}`, 'O', 11_520)),
      circuit('ev', 'Lighting', 'L', 4_000),
      circuit('ev', 'EVEMS Aggregate Setpoint (NEC 625.42)', 'O', 20_000),
    ];
    const r = calculateAggregatedLoad('ev', [mdp, ev], cs, [], 'dwelling', undefined, '2020', MF_NEW);
    // dwelling lighting tiers 3,000 + 35% × 1,000 = 3,350; chargers clamped to 20,000
    expect(r.totalDemandVA).toBe(3_350 + 20_000);
  });

  it('a single-family subpanel keeps the per-type cascade (#217 pending)', () => {
    const sub = panel({ id: 'sub', name: 'Garage Subpanel' });
    const cs = [circuit('sub', 'Lighting', 'L', 1_500), circuit('sub', 'Receptacles', 'R', 1_800), circuit('sub', 'Pool Pump', 'M', 1_800)];
    const r = calculateAggregatedLoad('sub', [mdp, sub], cs, [], 'dwelling', undefined, '2020', { multiFamily: false, existingBuilding: false });
    expect(r.totalDemandVA).toBe(1_500 + 1_800 + 2_250);
  });

  it('commercial projects ignore the dwelling options', () => {
    const r = calculateAggregatedLoad('u101', panels, circuits, [], 'commercial', undefined, '2020', MF_NEW);
    expect(r.totalDemandVA).toBe(36_625);
  });
});
