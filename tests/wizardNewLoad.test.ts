/**
 * #188: the Service Upgrade Wizard's new load from the proposed circuits is
 * E-102's new load for the 220.87 method, in service amps. Calculated → the
 * demand increase (PE ruling 2026-11-04); measured / manual → the 220.87(2)
 * new load (EVSE at 125%, EVEMS setpoint where set, others at nameplate).
 */
import { describe, it, expect } from 'vitest';
import type { Project } from '../types';
import { ExistingLoadDeterminationMethod } from '../types';
import { projectDemandSplit, scheduleExistingLoadAmps, scheduleNewLoadAmps } from '../lib/storedCalcs';
import { calculateProposedNewLoadVA } from '../services/calculations/upstreamLoadAggregation';

const project = (overrides: Record<string, unknown>) =>
  ({ type: 'Commercial', serviceVoltage: 208, servicePhase: 3, settings: {}, ...overrides } as unknown as Project);
const circuit = (description: string, load_watts: number, load_type: string, is_proposed = false) =>
  ({ id: description, panel_id: 'mdp', description, load_watts, load_type, is_proposed, pole: 1, breaker_amps: 20 });
const mdp = { id: 'mdp', name: 'MDP', is_main: true, bus_rating: 400, voltage: 208, phase: 3, fed_from_type: 'service', fed_from: null };

const existing = [
  circuit('Lighting', 12_000, 'L'),
  ...Array.from({ length: 30 }, (_, i) => circuit(`Receptacles ${i + 1}`, 1080, 'R')),
  circuit('RTU-1', 15_000, 'C'), circuit('RTU-2', 15_000, 'C'),
  circuit('Water heater', 9000, 'W'),
];
const evCharger = circuit('EV charger 48A', 11_520, 'O', true);
const { CALCULATED, UTILITY_BILL, LOAD_STUDY, MANUAL } = ExistingLoadDeterminationMethod;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newAmps = (p: Project, circuits: any[], method: ExistingLoadDeterminationMethod) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scheduleNewLoadAmps(p, [mdp] as any, circuits, [], '2020', method);

describe('wizard new load from the proposed circuits', () => {
  it('calculated: the demand increase E-102 uses — the charger at 100% (11.52 kVA ÷ 208√3 = 32 A)', () => {
    const circuits = [...existing, evCharger];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(projectDemandSplit(project({}), [mdp] as any, circuits as any, [], '2020').proposedKVA).toBe(11.52);
    expect(newAmps(project({}), circuits, CALCULATED)).toBe(32);
  });

  it('measured and manual: the 220.87(2) new load — the charger at 125% (14.4 kVA ÷ 208√3 = 40 A)', () => {
    const circuits = [...existing, evCharger];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(calculateProposedNewLoadVA(circuits as any, '2020')).toBe(14_400);
    for (const method of [UTILITY_BILL, LOAD_STUDY, MANUAL]) {
      expect(newAmps(project({}), circuits, method)).toBe(40);
    }
  });

  it('existing + new = the total demand under the calculated method', () => {
    const circuits = [...existing, evCharger];
    const p = project({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const split = projectDemandSplit(p, [mdp] as any, circuits as any, [], '2020');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingAmps = scheduleExistingLoadAmps(p, [mdp] as any, circuits as any, [], '2020')!;
    const totalAmps = Math.round(((split.existingKVA + split.proposedKVA) * 1000) / (208 * Math.sqrt(3)));
    expect(Math.abs(existingAmps + newAmps(p, circuits, CALCULATED)! - totalAmps)).toBeLessThanOrEqual(1);
  });

  it('service amps follow the service phase', () => {
    const p1 = project({ serviceVoltage: 240, servicePhase: 1 });
    expect(newAmps(p1, [...existing, evCharger], UTILITY_BILL)).toBe(Math.round(14_400 / 240));
  });

  it('no proposed circuits or no service panel: null (manual entry)', () => {
    expect(newAmps(project({}), existing, CALCULATED)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(scheduleNewLoadAmps(project({}), [] as any, [...existing, evCharger] as any, [], '2020', CALCULATED)).toBeNull();
  });
});
