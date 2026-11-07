/**
 * #192 (PE ruling 2026-11-07): the service check is the Article 220 load plus
 * 25% of the continuous loads (EVSE, signs, show windows) per 230.42(A)(1),
 * under every 220.87 method, dwellings included. The Article 220 load itself
 * stays at 100%.
 */
import { describe, it, expect } from 'vitest';
import type { Project } from '../types';
import { ExistingLoadDeterminationMethod } from '../types';
import { isContinuousServiceLoad, isSignOrShowWindowDescription } from '../data/nec/continuous-load';
import {
  calculateProposedNewLoadVA,
  continuousServiceAdderVA,
} from '../services/calculations/upstreamLoadAggregation';
import { projectDemandSplit } from '../lib/storedCalcs';
import {
  calculateMultiFamilyLoad,
  calculateSingleFamilyLoad,
  calculateSingleFamilyLoadFromCircuits,
} from '../services/calculations/residentialLoad';
import { LOAD_TEMPLATES, quickServiceCheck, templateToQuickAmps } from '../services/calculations/serviceUpgrade';

const project = (overrides: Record<string, unknown> = {}) =>
  ({ type: 'Commercial', serviceVoltage: 208, servicePhase: 3, settings: {}, ...overrides } as unknown as Project);
const panel = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: id, is_main: false, bus_rating: 400, voltage: 208, phase: 3, fed_from_type: 'panel', fed_from: 'mdp', ...extra });
const mdp = panel('mdp', { name: 'MDP', is_main: true, fed_from_type: 'service', fed_from: null });
const circuit = (panel_id: string, description: string, load_watts: number, load_type = 'O', is_proposed = false) =>
  ({ id: `${panel_id}-${description}`, panel_id, description, load_watts, load_type, is_proposed, pole: 1, breaker_amps: 20 });

const existing = [
  circuit('mdp', 'Lighting', 12_000, 'L'),
  ...Array.from({ length: 30 }, (_, i) => circuit('mdp', `Receptacles ${i + 1}`, 1080, 'R')),
  circuit('mdp', 'RTU-1', 15_000, 'C'), circuit('mdp', 'RTU-2', 15_000, 'C'),
  circuit('mdp', 'Water heater', 9000, 'W'),
];
const newCharger = circuit('mdp', 'EV charger 48A', 11_520, 'O', true);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adder = (panels: any[], circuits: any[], edition: '2020' | '2023' = '2020') =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  continuousServiceAdderVA('mdp', panels as any, circuits as any, [], edition);

describe('which loads are continuous in the service check', () => {
  it('signs and show windows by description, not lookalikes', () => {
    for (const d of ['Sign Lighting', 'Exterior signage', 'SIGN', 'Show Window Lighting', 'show-window track']) {
      expect(isSignOrShowWindowDescription(d)).toBe(true);
    }
    for (const d of ['Design studio receptacles', 'Signal booster', 'Lighting', 'Window AC']) {
      expect(isSignOrShowWindowDescription(d)).toBe(false);
    }
  });

  it('EVSE as isEvseDescription reads it; general lighting is not counted', () => {
    expect(isContinuousServiceLoad('EV charger 48A')).toBe(true);
    expect(isContinuousServiceLoad('EV Area Lighting')).toBe(false);
    expect(isContinuousServiceLoad('Lighting')).toBe(false);
  });
});

describe('continuousServiceAdderVA', () => {
  it('a charger adds the same 25% existing or new', () => {
    expect(adder([mdp], [...existing, newCharger])).toEqual({ existingVA: 0, proposedVA: 2880 });
    expect(adder([mdp], [...existing, { ...newCharger, is_proposed: false }])).toEqual({ existingVA: 2880, proposedVA: 0 });
  });

  it('signs and show windows on any panel under the MDP', () => {
    const lp = panel('lp');
    const circuits = [circuit('lp', 'Sign', 1200), circuit('lp', 'Show window lighting', 2400, 'L', true)];
    expect(adder([mdp, lp], circuits)).toEqual({ existingVA: 300, proposedVA: 600 });
  });

  it('NEC 2023: the charger at its 220.57 load (7,200 VA floor)', () => {
    const small = circuit('mdp', 'EV charger 16A', 3840, 'O', true);
    expect(adder([mdp], [small], '2023').proposedVA).toBe(1800);
    expect(adder([mdp], [small], '2020').proposedVA).toBe(960);
  });

  it('EVEMS: chargers count at most the setpoint, existing first', () => {
    const ev = panel('ev', { name: 'EV Panel' });
    const circuits = [
      circuit('ev', 'EV charger 1', 11_520), circuit('ev', 'EV charger 2', 11_520),
      circuit('ev', 'EV charger 3', 11_520, 'O', true), circuit('ev', 'EV charger 4', 11_520, 'O', true),
      circuit('ev', 'EVEMS Aggregate Setpoint (NEC 625.42)', 30_000),
    ];
    // 46,080 VA of chargers, setpoint 30,000: existing 23,040, proposed 6,960.
    expect(adder([mdp, ev], circuits)).toEqual({ existingVA: 5760, proposedVA: 1740 });
  });

  it('panels not under the MDP are left out', () => {
    const orphan = panel('orphan', { fed_from: 'nowhere' });
    expect(adder([mdp, orphan], [circuit('orphan', 'EV charger', 11_520)])).toEqual({ existingVA: 0, proposedVA: 0 });
  });
});

describe('E-102 / wizard: calculated-method service check', () => {
  it('the new 48 A charger: 32 A at 100% → 40 A with the 25% (208 V 3-phase)', () => {
    const circuits = [...existing, newCharger];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const split = projectDemandSplit(project(), [mdp] as any, circuits as any, [], '2020');
    expect(split.proposedKVA).toBe(11.52); // Article 220 load unchanged
    expect(split.proposedAdderKVA).toBeCloseTo(2.88, 6);
    expect(split.existingAdderKVA).toBe(0);
    const amps = (kVA: number) => Math.round((kVA * 1000) / (208 * Math.sqrt(3)));
    expect(amps(split.proposedKVA)).toBe(32);
    expect(amps(split.proposedKVA + split.proposedAdderKVA)).toBe(40);
  });

  it('measured path: new signs at 125% like the EVSE', () => {
    const circuits = [...existing, newCharger, circuit('mdp', 'Pylon sign', 1200, 'O', true)];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(calculateProposedNewLoadVA(circuits as any, '2020')).toBe((11_520 + 1200) * 1.25);
  });
});

describe('dwelling service check (serviceCheckAmps)', () => {
  const sfCircuits = [
    circuit('mdp', 'General lighting', 6000, 'L'), circuit('mdp', 'Range', 12_000, 'K'),
    circuit('mdp', 'Dryer', 5000, 'D'), circuit('mdp', 'AC condenser', 5000, 'C'),
    circuit('mdp', 'EV charger 48A', 11_520, 'O', true),
  ];

  it('single-family from circuits: demand + 25% of the charger', () => {
    const r = calculateSingleFamilyLoadFromCircuits({
      circuits: sfCircuits, squareFootage: 2000, smallApplianceCircuits: 2, laundryCircuit: true,
      voltage: 240, existingDwelling: true, necEdition: '2020',
    });
    expect(r.serviceCheckAmps).toBe(Math.round((r.totalDemandVA + 2880) / 240));
  });

  it('single-family from the toggles: the EV charger at its edition load', () => {
    const r = calculateSingleFamilyLoad({
      squareFootage: 2000, smallApplianceCircuits: 2, laundryCircuit: true, serviceVoltage: 240,
      appliances: { evCharger: { enabled: true, level: 2, kw: 9.6 } },
      necEdition: '2020',
    } as Parameters<typeof calculateSingleFamilyLoad>[0]);
    expect(r.serviceCheckAmps).toBe(Math.round((r.totalDemandVA + 2400) / 240));
  });

  it('220.84: each unit charger at its full load, not the factored share', () => {
    const r = calculateMultiFamilyLoad({
      unitTemplates: [{
        id: 't', name: '1BR', squareFootage: 850, unitCount: 12,
        appliances: { evCharger: { enabled: true, kw: 3.84, level: 2 } },
      }],
      necEdition: '2020',
    } as Parameters<typeof calculateMultiFamilyLoad>[0]);
    expect(r.serviceCheckAmps).toBe(Math.round((r.totalDemandVA + 12 * 3840 * 0.25) / 240));
  });
});

describe('Service Upgrade Wizard quick check', () => {
  it('available capacity is what is left after the new load', () => {
    const r = quickServiceCheck({ currentServiceAmps: 200, currentUsageAmps: 94, proposedLoadAmps: 60, existingLoadMethod: ExistingLoadDeterminationMethod.CALCULATED });
    expect(r.totalAmps).toBe(154);
    expect(r.availableAmps).toBe(46);
    expect(r.existingAmps).toBe(94);
  });

  it('measured existing load comes back × 1.25 for the gauge', () => {
    const r = quickServiceCheck({ currentServiceAmps: 200, currentUsageAmps: 100, proposedLoadAmps: 0, existingLoadMethod: ExistingLoadDeterminationMethod.UTILITY_BILL });
    expect(r.existingAmps).toBe(125);
  });

  it('presets: only EV at 125%; a water heater stays at nameplate at the service', () => {
    const t = (name: string) => LOAD_TEMPLATES.find(x => x.name === name)!;
    expect(templateToQuickAmps(t('Level 2 EV Charger (48A)'))).toBe(Math.round((11.5 * 1.25 * 1000) / 240));
    expect(templateToQuickAmps(t('Electric Water Heater (4.5kW)'))).toBe(Math.round(4500 / 240));
    // The flag that sizes the water heater's branch circuit (422.13) is kept.
    expect(t('Electric Water Heater (4.5kW)').continuous).toBe(true);
  });
});
