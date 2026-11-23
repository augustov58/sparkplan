/**
 * #291 (owner ruling 2026-11-22, a): the Optional Methods take each
 * small-appliance and laundry circuit at a flat 1,500 VA — "1500
 * volt-amperes for each" (220.82(B)(1), 220.83, 220.84(C)(2)), whatever VA is
 * typed on the row. Part III keeps #282's larger-of rule. The change: the
 * MDP's 220.84 total, which summed each unit circuit's typed VA.
 * Values: the issue's Acceptance section, hand-calculated on "QA MF feeders"
 * (the generator's circuits): base 109,500 VA × 45 % = 49,275 + house 19,300
 * = 68,575 VA.
 */
import { describe, it, expect } from 'vitest';
import { buildMultiFamilyContext, calculateAggregatedLoad, type DwellingAggregateOptions } from '../services/calculations/upstreamLoadAggregation';
import { optionalMethodAllowanceDelta, calculateDwellingUnitPanelLoad } from '../services/calculations/residentialLoad';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

const panel = (o: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel => ({
  bus_rating: 125, main_breaker_amps: 125, voltage: 240, phase: 1, num_spaces: 42, project_id: 'p',
  is_main: false, fed_from: 'mdp', fed_from_type: 'panel', fed_from_transformer_id: null, ...o,
} as unknown as Panel);
let n = 0;
const circuit = (panel_id: string, description: string, load_type: string | null, load_watts: number): Circuit => ({
  id: `c${n++}`, panel_id, description, load_type, load_watts, breaker_amps: 20, project_id: 'p',
  circuit_number: n, pole: 1, is_proposed: false,
} as unknown as Circuit);

const unitCircuits = (id: string, sa1 = 1_500, laundry = 1_500) => [
  circuit(id, 'Kitchen Small Appliance #1', 'K', sa1),
  circuit(id, 'Kitchen Small Appliance #2', 'K', 1_500),
  circuit(id, 'Laundry', 'R', laundry),
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
const houseCircuits = [
  circuit('house', 'Lobby & Corridor Lighting', 'L', 4_800),
  circuit('house', 'Exterior & Parking Lighting', 'L', 2_400),
  circuit('house', 'Common Area Receptacles', 'R', 1_600),
  circuit('house', 'Elevator', 'M', 4_000),
  circuit('house', 'Fire Alarm System', null, 500),
  circuit('house', 'Common Laundry', null, 5_000), // a house circuit, not a unit's laundry: outside 220.84(C)(2)
];
const mdp = panel({ id: 'mdp', name: 'MDP', bus_rating: 400, main_breaker_amps: 400, is_main: true, fed_from: null, fed_from_type: 'meter_stack' });
const units = ['101', '102', '103'].map(u => panel({ id: `u${u}`, name: `Unit ${u} Panel` }));
const house = panel({ id: 'house', name: 'House Panel', bus_rating: 100, main_breaker_amps: 100 });
const panels = [mdp, ...units, house];
const MF_NEW: DwellingAggregateOptions = { multiFamily: true, existingBuilding: false };
const settings = { occupancyType: 'dwelling' as const, residential: { dwellingType: 'multi_family' as const, totalUnits: 3 } };

function mdpTotal(u101: Circuit[]) {
  const circuits = [...u101, ...unitCircuits('u102'), ...unitCircuits('u103'), ...houseCircuits];
  const ctx = buildMultiFamilyContext(mdp, panels, circuits, [], settings, '2020');
  return calculateAggregatedLoad('mdp', panels, circuits, [], 'dwelling', ctx, '2020', MF_NEW);
}

describe('#291 optionalMethodAllowanceDelta', () => {
  it('VA above 1,500 per circuit is left out, below it is added; other circuits are ignored', () => {
    expect(optionalMethodAllowanceDelta(unitCircuits('u', 2_400))).toEqual({ excessVA: 900, shortfallVA: 0 });
    expect(optionalMethodAllowanceDelta(unitCircuits('u', 1_500, 1_200))).toEqual({ excessVA: 0, shortfallVA: 300 });
    expect(optionalMethodAllowanceDelta(unitCircuits('u'))).toEqual({ excessVA: 0, shortfallVA: 0 });
    // the sample template's two-circuit row: "2 @ 1,500 VA", 3,000 W = two circuits at 1,500
    expect(optionalMethodAllowanceDelta([circuit('u', 'Small Appliance Circuits - 2 @ 1,500 VA (NEC 220.52A)', 'O', 3_000)]))
      .toEqual({ excessVA: 0, shortfallVA: 0 });
  });
});

describe('#291 the MDP 220.84 total takes 1,500 VA per small-appliance / laundry circuit', () => {
  it('baseline: 109,500 × 45 % = 49,275 + house 19,300 = 68,575 VA', () => {
    expect(mdpTotal(unitCircuits('u101')).totalDemandVA).toBe(68_575);
  });

  it('Unit 101 "Kitchen Small Appliance #1" at 2,400 VA: unchanged 68,575 (was 68,980); 900 VA in its own row at 0 %', () => {
    const r = mdpTotal(unitCircuits('u101', 2_400));
    expect(r.totalDemandVA).toBe(68_575);
    expect(r.demandBreakdown.find(b => b.loadType.startsWith('Multi-Family Dwelling'))).toMatchObject({ connectedVA: 109_500, demandVA: 49_275 });
    expect(r.demandBreakdown.find(b => b.loadType.includes('above 1,500 VA'))).toMatchObject({ connectedVA: 900, demandVA: 0 });
    // the rows still sum to the connected total (#160)
    expect(r.demandBreakdown.reduce((s, b) => s + b.connectedVA, 0)).toBe(r.totalConnectedVA);
    expect(r.necReferences.join(' ')).toMatch(/220\.84\(C\)\(2\)/);
  });

  it('Unit 101 "Laundry" at 1,200 VA: unchanged 68,575 (was 68,440); +300 VA raised, at 45 % = 135', () => {
    const r = mdpTotal(unitCircuits('u101', 1_500, 1_200));
    expect(r.totalDemandVA).toBe(68_575);
    expect(r.demandBreakdown.find(b => b.loadType.startsWith('Multi-Family Dwelling'))).toMatchObject({ connectedVA: 109_200, demandVA: 49_140 });
    expect(r.demandBreakdown.find(b => b.loadType.includes('raised to 1,500 VA'))).toMatchObject({ connectedVA: 300, demandVA: 135 });
    expect(r.existingDemandVA + r.proposedDemandVA).toBe(r.totalDemandVA);
  });

  it('Part III (the unit panel itself, #282) keeps the larger of VA or 1,500', () => {
    const at1500 = calculateDwellingUnitPanelLoad({ circuits: unitCircuits('u101'), existingBuilding: false, necEdition: '2020' });
    const at2400 = calculateDwellingUnitPanelLoad({ circuits: unitCircuits('u101', 2_400), existingBuilding: false, necEdition: '2020' });
    expect(at2400.totalDemandVA).toBeGreaterThan(at1500.totalDemandVA);
  });
});
