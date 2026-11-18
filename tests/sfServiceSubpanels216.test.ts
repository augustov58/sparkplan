/**
 * #216: a single-family dwelling's service calculation reads every circuit
 * under the MDP — a subpanel's loads are the dwelling's. Values: the hand
 * calculation in the issue's Acceptance section ("QA SF subpanel": the
 * Dwelling Load Calculator's generated Main Panel + a garage subpanel).
 */
import { describe, it, expect } from 'vitest';
import { circuitsUnderPanel } from '../services/calculations/upstreamLoadAggregation';
import { calculateSingleFamilyLoadFromCircuits } from '../services/calculations/residentialLoad';
import { projectDemandSplit, scheduleServiceCheck } from '../lib/storedCalcs';
import type { Project } from '../types';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

const panel = (o: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel => ({
  bus_rating: 200, main_breaker_amps: 200, voltage: 240, phase: 1, num_spaces: 42, project_id: 'p',
  is_main: false, fed_from: 'main', fed_from_type: 'panel', fed_from_transformer_id: null, ...o,
} as unknown as Panel);
let n = 0;
const circuit = (panel_id: string, description: string, load_type: string, load_watts: number): Circuit => ({
  id: `c${n++}`, panel_id, description, load_type, load_watts, breaker_amps: 20, project_id: 'p',
  circuit_number: n, pole: 1, is_proposed: false,
} as unknown as Circuit);

const project = {
  id: 'p', name: 'QA SF subpanel', type: 'Residential', serviceVoltage: 240, servicePhase: 1,
  settings: {
    occupancyType: 'dwelling', service_modification_type: 'new-service',
    residential: { dwellingType: 'single_family', squareFootage: 2400, smallApplianceCircuits: 2, laundryCircuit: true },
  },
} as unknown as Project;

const main = panel({ id: 'main', name: 'Main Panel', is_main: true, fed_from: null, fed_from_type: 'service' });
const garage = panel({ id: 'garage', name: 'Garage Subpanel', bus_rating: 100, main_breaker_amps: 100 });
const panels = [main, garage];
// The Dwelling Load Calculator's generated schedule
const mainCircuits = [
  ...[1, 2, 3, 4, 5].map(i => circuit('main', `Lighting Circuit ${i}`, 'L', 1_440)),
  circuit('main', 'Kitchen Small Appliance 1', 'R', 1_500),
  circuit('main', 'Kitchen Small Appliance 2', 'R', 1_500),
  circuit('main', 'Laundry', 'R', 1_500),
  circuit('main', 'Bathroom Receptacles', 'R', 1_500),
  circuit('main', 'Garage Receptacles', 'R', 1_500),
  circuit('main', 'Outdoor Receptacles', 'R', 180),
  circuit('main', 'Refrigerator', 'K', 600),
  circuit('main', 'Electric Range', 'K', 12_000),
  circuit('main', 'Electric Dryer', 'D', 5_000),
  circuit('main', 'Electric Water Heater', 'W', 4_500),
  circuit('main', 'Air Conditioning Compressor', 'C', 4_200),
  circuit('main', 'Dishwasher', 'K', 1_200),
  circuit('main', 'Garbage Disposal', 'K', 500),
];
const garageCircuits = [
  circuit('garage', 'EV Charger', 'O', 7_680),
  circuit('garage', 'Workshop Air Compressor', 'M', 1_800),
  circuit('garage', 'Garage Lighting', 'L', 600),
  circuit('garage', 'Workbench Receptacles', 'R', 1_800),
];
const circuits = [...mainCircuits, ...garageCircuits];
const dwelling = { squareFootage: 2400, smallApplianceCircuits: 2, laundryCircuit: true, existingDwelling: false, voltage: 240, necEdition: '2020' as const };

describe('the single-family service reads the circuits under the MDP (#216)', () => {
  it('the Dwelling Load Calculator: 37,375 VA with the subpanel, 29,570 VA from the MDP alone', () => {
    const whole = calculateSingleFamilyLoadFromCircuits({ ...dwelling, circuits: circuitsUnderPanel('main', panels, circuits, []) });
    // 6,045 + 8,000 + 5,000 + 4,200 + 220.53 75% × 8,000 + 7,680 EVSE + 25% × 1,800
    expect(whole.totalDemandVA).toBe(37_375);
    const mdpOnly = calculateSingleFamilyLoadFromCircuits({ ...dwelling, circuits: mainCircuits });
    expect(mdpOnly.totalDemandVA).toBe(29_570);
  });

  it('E-102 / the wizard (projectDemandSplit) include the subpanel', () => {
    const split = projectDemandSplit(project, panels, circuits, [], '2020');
    expect((split.existingKVA + split.proposedKVA) * 1000).toBeCloseTo(37_375, 6);
    // 25% of the EV charger, wherever it sits (#192)
    expect((split.existingAdderKVA + split.proposedAdderKVA) * 1000).toBeCloseTo(1_920, 6);
  });

  it('the service check (#193) follows: (37,375 + 1,920) ÷ 240 = 163.7 A', () => {
    expect(scheduleServiceCheck(project, panels, circuits, [], '2020')!.checkAmps).toBeCloseTo(39_295 / 240, 6);
  });

  it('circuitsUnderPanel: grandchildren and transformer-fed panels count; EVEMS markers do not', () => {
    const sub2 = panel({ id: 'sub2', name: 'Shed', fed_from: 'garage' });
    const xf = { id: 'x', fed_from_panel_id: 'main' } as unknown as Transformer;
    const xfPanel = panel({ id: 'xp', name: 'Pool', fed_from: null, fed_from_type: 'transformer', fed_from_transformer_id: 'x' });
    const extra = [
      circuit('sub2', 'Shed Heater', 'H', 1_500),
      circuit('xp', 'Pool Pump', 'M', 1_500),
      circuit('garage', 'EVEMS Aggregate Setpoint (NEC 625.42)', 'O', 5_000),
    ];
    const got = circuitsUnderPanel('main', [...panels, sub2, xfPanel], [...circuits, ...extra], [xf]);
    expect(got.map(c => c.description)).toEqual(expect.arrayContaining(['Shed Heater', 'Pool Pump', 'EV Charger']));
    expect(got.some(c => c.description.startsWith('EVEMS'))).toBe(false);
    expect(circuitsUnderPanel('garage', panels, circuits, [])).toHaveLength(4);
  });
});
