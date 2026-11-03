/**
 * #185: the Service Upgrade Wizard's existing load from the panel schedule is
 * E-102's existing demand — the NEC 220 walk on the existing circuits, in
 * service amps — not a raw sum of the service panel's load_watts.
 */
import { describe, it, expect } from 'vitest';
import type { Project } from '../types';
import { projectDemandSplit, scheduleExistingLoadAmps } from '../lib/storedCalcs';
import { calculateSingleFamilyLoadFromCircuits } from '../services/calculations/residentialLoad';

const project = (overrides: Record<string, unknown>) =>
  ({ type: 'Commercial', serviceVoltage: 208, servicePhase: 3, settings: {}, ...overrides } as unknown as Project);
const panel = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({ id, name, is_main: false, bus_rating: 400, voltage: 208, phase: 3, fed_from_type: 'panel', fed_from: 'mdp', ...extra });
const circuit = (panel_id: string, description: string, load_watts: number, load_type: string, is_proposed = false) =>
  ({ id: `${panel_id}-${description}`, panel_id, description, load_watts, load_type, is_proposed, pole: 1, breaker_amps: 20 });
const mdp = panel('mdp', 'MDP', { is_main: true, fed_from_type: 'service', fed_from: null });

// Lighting 12 kVA, 30 receptacles (32.4 kVA), 2 RTUs, a walk-in motor, a water heater.
const building = (generalPanel: string) => [
  circuit(generalPanel, 'Lighting', 12_000, 'L'),
  ...Array.from({ length: 30 }, (_, i) => circuit(generalPanel, `Receptacles ${i + 1}`, 1080, 'R')),
  circuit('mdp', 'RTU-1', 15_000, 'C'), circuit('mdp', 'RTU-2', 15_000, 'C'),
  circuit('mdp', 'Walk-in cooler', 4000, 'M'),
  circuit('mdp', 'Water heater', 9000, 'W'),
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const amps = (p: Project, panels: any[], circuits: any[]) => scheduleExistingLoadAmps(p, panels, circuits, [], '2020');

describe('wizard existing load from the panel schedule (commercial)', () => {
  it('the NEC 220 demand (77.2 kVA, 214 A on 208 V 3-phase), not the raw sum (87.4 kVA ÷ 208 = 420 A)', () => {
    const circuits = building('mdp');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(projectDemandSplit(project({}), [mdp] as any, circuits as any, [], '2020').existingKVA).toBe(77.2);
    expect(amps(project({}), [mdp], circuits)).toBe(214);
  });

  it('the same with lighting and receptacles on a subpanel', () => {
    expect(amps(project({}), [mdp, panel('lp', 'LP-1')], building('lp'))).toBe(214);
  });

  it('proposed circuits stay out of the existing load', () => {
    const circuits = [...building('mdp'), circuit('mdp', 'RTU-3 (new)', 15_000, 'C', true)];
    expect(amps(project({}), [mdp], circuits)).toBe(214);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const split = projectDemandSplit(project({}), [mdp] as any, circuits as any, [], '2020');
    expect(split.proposedKVA).toBe(15);
  });

  it('service amps follow the service phase', () => {
    const p1 = project({ serviceVoltage: 240, servicePhase: 1 });
    expect(amps(p1, [mdp], building('mdp'))).toBe(Math.round(77_200 / 240));
  });

  it('no service panel or no circuits: null (manual entry)', () => {
    expect(amps(project({}), [panel('lp', 'LP-1')], building('lp'))).toBeNull();
    expect(amps(project({}), [mdp], [])).toBeNull();
  });
});

describe('wizard existing load from the panel schedule (dwellings)', () => {
  it('multifamily: the MDP 220.84 walk on the actual circuits, house panel included', () => {
    const mf = project({
      type: 'Residential', serviceVoltage: 240, servicePhase: 1,
      settings: { occupancyType: 'dwelling', residential: { dwellingType: 'multi_family', totalUnits: 4 } },
    });
    const units = [1, 2, 3, 4].map(n => panel(`u${n}`, `Unit ${n}`, { voltage: 240, phase: 1 }));
    const unitCircuits = units.flatMap(u => [
      circuit(u.id, 'General lighting', 3000, 'L'), circuit(u.id, 'Small appliance', 3000, 'R'),
      circuit(u.id, 'Range', 8000, 'K'), circuit(u.id, 'AC condenser', 4000, 'C'),
    ]);
    const house = panel('house', 'House Panel', { voltage: 240, phase: 1 });
    const circuits = [...unitCircuits, circuit('house', 'Corridor lighting', 2000, 'L')];
    const mdp240 = { ...mdp, voltage: 240, phase: 1 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const split = projectDemandSplit(mf, [mdp240, ...units, house] as any, circuits as any, [], '2020');
    expect(split.necReferences.some(r => r.includes('220.84'))).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withoutHouse = projectDemandSplit(mf, [mdp240, ...units, house] as any, unitCircuits as any, [], '2020');
    expect(split.existingKVA).toBeGreaterThan(withoutHouse.existingKVA);
    expect(amps(mf, [mdp240, ...units, house], circuits)).toBe(Math.round((split.existingKVA * 1000) / 240));
  });

  it('single-family: the same existing demand as the wizard\'s dwelling result (#184)', () => {
    const sf = project({
      type: 'Residential', serviceVoltage: 240, servicePhase: 1,
      settings: { occupancyType: 'dwelling', residential: { dwellingType: 'single_family', squareFootage: 2000 } },
    });
    const circuits = [
      circuit('mdp', 'General lighting', 6000, 'L'), circuit('mdp', 'Range', 12_000, 'K'),
      circuit('mdp', 'Dryer', 5000, 'D'), circuit('mdp', 'AC condenser', 5000, 'C'),
      circuit('mdp', 'EV charger 48A', 11_520, 'O', true),
    ];
    const mdp240 = { ...mdp, voltage: 240, phase: 1 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const split = projectDemandSplit(sf, [mdp240] as any, circuits as any, [], '2020');
    const wizard = calculateSingleFamilyLoadFromCircuits({
      squareFootage: 2000, smallApplianceCircuits: 2, laundryCircuit: true, voltage: 240,
      existingDwelling: true, circuits: circuits.filter(c => !c.is_proposed),
    });
    expect(split.existingKVA * 1000).toBe(wizard.totalDemandVA);
  });
});
