/**
 * #217 (PE ruling 2026-11-20): the feeder to a subpanel serving part of a
 * single-family dwelling is NEC 220 Part III over the circuits under it,
 * (a) counting only the small-appliance circuits actually there (no 2-circuit
 * minimum) and (b) its general-use receptacles at their VA inside the Table
 * 220.42 tiers. The 3 VA/ft² allowance and the 2-circuit minimum stay on the
 * service calculation.
 *
 * Hand calcs (Table 220.42 dwelling: first 3,000 VA at 100%, next at 35%):
 * - Issue example, L 1,500 + R 1,800 + pool pump (M) 1,800:
 *   (1,500 + 1,800) → 3,000 + 35% × 300 = 3,105; + 1,800 + 25% × 1,800 = 5,355 VA
 *   (the per-type cascade gave 1,500 + 1,800 + 1,800 × 1.25 = 5,550).
 * - "QA SF subpanel" Garage Subpanel, L 600 + R 1,800 + EV charger 7,680 +
 *   air compressor (M) 1,800: 2,400 + 7,680 + 1,800 + 450 = 12,330 VA.
 * - With one small-appliance circuit on the subpanel: L 1,500 + R 1,800 + SA
 *   1,500 = 4,800 → 3,000 + 35% × 1,800 = 3,630; + 2,250 = 5,880 VA.
 * - Not ruled (#282, pending), counted instead of left out: a refrigerator
 *   circuit at its VA in the tiers (R 1,200: 4,500 → 3,525; 5,775 VA); a
 *   laundry or small-appliance circuit over 1,500 VA at its VA, circuit by
 *   circuit (laundry O 5,000: 3,300 + 1,500 + 3,500 = 8,300 → 4,855; 7,105 VA;
 *   plus a 0 VA laundry circuit at its 1,500 minimum: 9,800 → 5,380; 7,630 VA;
 *   small appliance K 2,400: 3,300 + 1,500 + 900 = 5,700 → 3,945; 6,195 VA).
 */
import { describe, it, expect } from 'vitest';
import { calculateAggregatedLoad } from '../services/calculations/upstreamLoadAggregation';
import {
  calculateSingleFamilySubpanelLoad,
  calculateDwellingUnitPanelLoad,
} from '../services/calculations/residentialLoad';
import { packetFeederLoadRules, type PermitPacketData } from '../services/pdfExport/permitPacketGenerator';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

const panel = (o: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel => ({
  bus_rating: 100, main_breaker_amps: 100, voltage: 240, phase: 1, num_spaces: 24, project_id: 'p',
  is_main: false, fed_from: 'mdp', fed_from_type: 'panel', fed_from_transformer_id: null, ...o,
} as unknown as Panel);
let n = 0;
const circuit = (panel_id: string, description: string, load_type: string | null, load_watts: number): Circuit => ({
  id: `c${n++}`, panel_id, description, load_type, load_watts, breaker_amps: 20, project_id: 'p',
  circuit_number: n, pole: 1, is_proposed: false,
} as unknown as Circuit);

const mdp = panel({ id: 'mdp', name: 'Main Panel', bus_rating: 200, main_breaker_amps: 200, is_main: true, fed_from: null, fed_from_type: 'service' });
const sub = panel({ id: 'sub', name: 'Pool Subpanel' });
const SF_NEW = { multiFamily: false, existingBuilding: false };
const agg = (cs: Circuit[], dwelling: typeof SF_NEW = SF_NEW) =>
  calculateAggregatedLoad('sub', [mdp, sub], cs, [], 'dwelling', undefined, '2020', dwelling);

const poolCircuits = [
  circuit('sub', 'Pool Lighting', 'L', 1_500),
  circuit('sub', 'Pool Receptacles', 'R', 1_800),
  circuit('sub', 'Pool Pump', 'M', 1_800),
];

describe('#217 single-family subpanel feeder: Part III over its own circuits', () => {
  it('issue example: 5,355 VA (was 5,550 by the per-type cascade)', () => {
    expect(agg(poolCircuits).totalDemandVA).toBe(5_355);
  });

  it('(a) no 2-circuit small-appliance minimum; (b) receptacles inside the 220.42 tiers', () => {
    const s = calculateSingleFamilySubpanelLoad({ circuits: poolCircuits, necEdition: '2020' });
    expect(s.totalDemandVA).toBe(5_355);
    const general = s.rows.find(r => r.loadType.startsWith('Lighting + general-use receptacles'))!;
    expect(general).toMatchObject({ connectedVA: 3_300, demandVA: 3_105 });
    expect(s.totalConnectedVA).toBe(5_100); // 3,300 + 1,800: no 3,000 VA of small-appliance load added
    expect(s.warnings.join(' ')).not.toContain('210.11(C)(1)');
    expect(s.warnings.join(' ')).not.toContain('3 VA/ft');
  });

  it('small-appliance circuits on the subpanel count at 1,500 VA each: 5,880 VA', () => {
    const cs = [...poolCircuits, circuit('sub', 'Kitchen Small Appliance #3', 'K', 1_500)];
    expect(agg(cs).totalDemandVA).toBe(5_880);
  });

  it('a refrigerator circuit on a subpanel counts at its VA, in the tiers: 5,775 VA', () => {
    expect(agg([...poolCircuits, circuit('sub', 'Garage Refrigerator', 'R', 1_200)]).totalDemandVA).toBe(5_775);
  });

  it('a laundry circuit above 1,500 VA counts at its VA (220.52(B) "not less than"): 7,105 VA', () => {
    expect(agg([...poolCircuits, circuit('sub', 'Pool House Laundry', 'O', 5_000)]).totalDemandVA).toBe(7_105);
    // at 1,500 VA it is the 220.52(B) 1,500: 3,300 + 1,500 = 4,800 → 3,630 + 2,250
    expect(agg([...poolCircuits, circuit('sub', 'Laundry', 'R', 1_500)]).totalDemandVA).toBe(5_880);
    // per circuit: a 0 VA laundry circuit keeps its own 1,500 next to the 5,000 one
    expect(agg([...poolCircuits, circuit('sub', 'Laundry A', 'O', 5_000), circuit('sub', 'Laundry B', 'R', 0)]).totalDemandVA).toBe(7_630);
  });

  it('a small-appliance circuit above 1,500 VA counts at its VA (220.52(A) "not less than"): 6,195 VA', () => {
    expect(agg([...poolCircuits, circuit('sub', 'Kitchen Small Appliance #3', 'K', 2_400)]).totalDemandVA).toBe(6_195);
  });

  it('"QA SF subpanel" Garage Subpanel: 12,330 VA', () => {
    const cs = [
      circuit('sub', 'EV Charger', 'O', 7_680),
      circuit('sub', 'Workshop Air Compressor', 'M', 1_800),
      circuit('sub', 'Garage Lighting', 'L', 600),
      circuit('sub', 'Workbench Receptacles', 'R', 1_800),
    ];
    expect(agg(cs).totalDemandVA).toBe(12_330);
  });

  it('the aggregate prints the subpanel summary\'s rows (one number for the feeder and the MDP feed-thru row)', () => {
    const r = agg(poolCircuits);
    const s = calculateSingleFamilySubpanelLoad({ circuits: poolCircuits, necEdition: '2020' });
    expect(r.totalDemandVA).toBe(s.totalDemandVA);
    expect(r.necReferences.join(' ')).toContain('NEC 220 Part III - Standard Method (Single-Family Subpanel)');
  });
});

describe('#217 guardrails', () => {
  it('a whole dwelling unit still takes the 2-circuit minimum (210.11(C)(1))', () => {
    const unit = calculateDwellingUnitPanelLoad({
      circuits: [circuit('u', 'General Lighting', 'L', 4_500)], existingBuilding: false, necEdition: '2020',
    });
    // 4,500 + 2 × 1,500 = 7,500 → 3,000 + 35% × 4,500 = 4,575
    expect(unit.totalDemandVA).toBe(4_575);
  });

  it('no dwelling options (caller can\'t tell single- from multifamily): the cascade, as before', () => {
    const r = calculateAggregatedLoad('sub', [mdp, sub], poolCircuits, [], 'dwelling', undefined, '2020');
    expect(r.totalDemandVA).toBe(5_550);
  });

  it('the packet takes the project\'s multifamily flag, not the presence of a unit context', () => {
    const data = (o: Partial<PermitPacketData>) => ({ projectType: 'Residential', serviceModificationType: 'new-service', ...o }) as PermitPacketData;
    // multifamily project without a unit count: no MultiFamilyContext, still multifamily (the app's rule)
    expect(packetFeederLoadRules(data({ dwellingMultiFamily: true })).dwelling).toMatchObject({ multiFamily: true });
    expect(packetFeederLoadRules(data({ dwellingMultiFamily: false })).dwelling).toMatchObject({ multiFamily: false });
    expect(packetFeederLoadRules(data({})).dwelling).toMatchObject({ multiFamily: false }); // older callers: the fallback
  });

  it('a multifamily project\'s non-unit, non-house panel keeps the cascade', () => {
    expect(agg(poolCircuits, { multiFamily: true, existingBuilding: false }).totalDemandVA).toBe(5_550);
  });
});
