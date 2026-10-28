/**
 * #180 (PE ruling 2026-10-27): on a building with 3+ units, a dwelling unit
 * panel with its own EV charger stays a unit. The charger's edition load
 * goes into the 220.84 connected base and takes the Table 220.84 factor;
 * the building's shared EV panel still adds after the factor.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateAggregatedLoad,
  buildMultiFamilyContext,
} from '../services/calculations/upstreamLoadAggregation';

const panel = (id: string, name: string, fedFrom: string | null) => ({
  id, name, is_main: fedFrom === null, voltage: 240,
  fed_from_type: fedFrom === null ? 'service' : 'panel', fed_from: fedFrom, fed_from_transformer_id: null,
}) as any;

let n = 0;
const circuit = (panel_id: string, description: string, load_watts: number, load_type: string, is_proposed = false) =>
  ({ id: `c${n++}`, panel_id, description, load_watts, load_type, is_proposed, breaker_amps: 20 }) as any;

/** The generator's unit circuits: 34,750 VA connected, heat 5,000 / A/C 3,500. */
const unitCircuits = (panelId: string) => [
  circuit(panelId, 'Kitchen Small Appliance #1', 1500, 'K'),
  circuit(panelId, 'Kitchen Small Appliance #2', 1500, 'K'),
  circuit(panelId, 'Laundry', 1500, 'R'),
  circuit(panelId, 'General Lighting', 1275, 'L'),
  circuit(panelId, 'General Lighting #2', 1275, 'L'),
  circuit(panelId, 'Range/Oven', 8000, 'K'),
  circuit(panelId, 'Clothes Dryer', 5000, 'D'),
  circuit(panelId, 'Electric Heat / Heat Pump', 5000, 'H'),
  circuit(panelId, 'A/C Condensing Unit', 3500, 'C'),
  circuit(panelId, 'Water Heater', 4500, 'W'),
  circuit(panelId, 'Dishwasher', 1200, 'K'),
  circuit(panelId, 'Disposal', 500, 'M'),
];

function building(unitCharger: { va: number; proposed?: boolean } | null, necEdition: '2020' | '2023' = '2020') {
  const panels = [
    panel('mdp', 'MDP', null),
    panel('u1', 'Unit 101', 'mdp'), panel('u2', 'Unit 102', 'mdp'), panel('u3', 'Unit 103', 'mdp'),
    panel('ev', 'EV Sub-Panel', 'mdp'),
  ];
  const circuits = [
    ...unitCircuits('u1'), ...unitCircuits('u2'), ...unitCircuits('u3'),
    ...(unitCharger ? [circuit('u2', 'Level 2 EV Charger', unitCharger.va, 'O', unitCharger.proposed)] : []),
    circuit('ev', 'EV Charger 1', 7680, 'O'),
    circuit('ev', 'EV Charger 2', 7680, 'O'),
  ];
  const ctx = buildMultiFamilyContext(panels[0], panels, circuits, [], {
    occupancyType: 'dwelling', residential: { dwellingType: 'multi_family', totalUnits: 3 },
  }, necEdition);
  return { ctx, agg: calculateAggregatedLoad('mdp', panels, circuits, [], 'dwelling', ctx, necEdition) };
}

// Dwelling base per unit: 34,750 − 3,500 (smaller of heat/cool, 220.84(C)(5)) = 31,250.
const BASE_3_UNITS = 3 * 31_250;
const SHARED_EV_VA = 2 * 7_680;

describe('a unit panel with its own EV charger (3+ units)', () => {
  it('stays a unit: only the shared EV panel is the EV subset', () => {
    const { ctx } = building({ va: 7_680 });
    expect(ctx?.evPanelIds).toEqual(['ev']);
    expect(ctx?.evLoadVA).toBe(SHARED_EV_VA);
  });

  it('its charger is in the 220.84 base and takes the 45% factor; the shared EV bank adds at 100%', () => {
    const { agg } = building({ va: 7_680 });
    const dwelling = agg.demandBreakdown[0]!;
    expect(dwelling.necReference).toBe('NEC 220.84 Table (3 units @ 45%)');
    expect(dwelling.connectedVA).toBe(BASE_3_UNITS + 7_680);
    expect(dwelling.demandVA).toBe(Math.round((BASE_3_UNITS + 7_680) * 0.45)); // 45,644
    expect(agg.totalDemandVA).toBe(45_644 + SHARED_EV_VA);
  });

  it('NEC 2023: the unit charger enters the base at the 7,200 VA floor', () => {
    const { agg } = building({ va: 3_840 }, '2023');
    expect(agg.demandBreakdown[0]!.connectedVA).toBe(BASE_3_UNITS + 7_200);
    expect(agg.demandBreakdown[0]!.demandVA).toBe(Math.round((BASE_3_UNITS + 7_200) * 0.45));
  });

  it('a proposed unit charger keeps the existing/proposed split summing to the total', () => {
    const { agg } = building({ va: 7_680, proposed: true });
    expect(agg.proposedConnectedVA).toBe(7_680);
    expect(agg.proposedDemandVA).toBeGreaterThan(0);
    expect(agg.existingDemandVA + agg.proposedDemandVA).toBe(Math.round(agg.totalDemandVA));
  });

  it('no unit charger: unchanged 220.84 result', () => {
    const { agg } = building(null);
    expect(agg.totalDemandVA).toBe(Math.round(BASE_3_UNITS * 0.45) + SHARED_EV_VA);
  });
});
