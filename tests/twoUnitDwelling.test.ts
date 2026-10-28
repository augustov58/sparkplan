/**
 * #127 item 4 (PE ruling 2026-10-27): a two-unit dwelling service is one
 * building-wide NEC 220 Part III walk — not the commercial 220.44 /
 * K-as-range cascade, not a sum of per-unit results — and NEC 220.85 takes
 * the lesser of that and 220.84 for three identical units when the two
 * units are identical.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateAggregatedLoad,
  buildMultiFamilyContext,
} from '../services/calculations/upstreamLoadAggregation';
import {
  calculateMultiFamilyLoad,
  calculateDwellingUnitPanelLoad,
} from '../services/calculations/residentialLoad';
import { calculateMultiFamilyEV } from '../services/calculations/multiFamilyEV';
import { summarizeCalculationRefs } from '../services/pdfExport/PermitPacketDocuments';
import { DEFAULT_APPLIANCES } from '../lib/storedCalcs';
import type { DwellingUnitTemplate } from '../types';

const panel = (id: string, name: string, fedFrom: string | null) => ({
  id, name, is_main: fedFrom === null, voltage: 240,
  fed_from_type: fedFrom === null ? 'service' : 'panel', fed_from: fedFrom, fed_from_transformer_id: null,
}) as any;

let n = 0;
const circuit = (panel_id: string, description: string, load_watts: number, load_type: string, is_proposed = false) =>
  ({ id: `c${n++}`, panel_id, description, load_watts, load_type, is_proposed, breaker_amps: 20 }) as any;

/** The generator's unit circuits (Unit 101 of the 12-unit QA building, #155). */
const unitCircuits = (panelId: string, rangeVA = 8000) => [
  circuit(panelId, 'Kitchen Small Appliance #1', 1500, 'K'),
  circuit(panelId, 'Kitchen Small Appliance #2', 1500, 'K'),
  circuit(panelId, 'Laundry', 1500, 'R'),
  circuit(panelId, 'Bathroom(s)', 0, 'R'),
  circuit(panelId, 'General Lighting', 1275, 'L'),
  circuit(panelId, 'General Lighting #2', 1275, 'L'),
  circuit(panelId, 'Range/Oven', rangeVA, 'K'),
  circuit(panelId, 'Clothes Dryer', 5000, 'D'),
  circuit(panelId, 'Electric Heat / Heat Pump', 5000, 'H'),
  circuit(panelId, 'A/C Condensing Unit', 3500, 'C'),
  circuit(panelId, 'Water Heater', 4500, 'W'),
  circuit(panelId, 'Dishwasher', 1200, 'K'),
  circuit(panelId, 'Disposal', 500, 'M'),
];

const settings = { occupancyType: 'dwelling', residential: { dwellingType: 'multi_family', totalUnits: 2 } };

function building(unitB = unitCircuits('b')) {
  const panels = [panel('mdp', 'MDP', null), panel('a', 'Unit 101', 'mdp'), panel('b', 'Unit 102', 'mdp')];
  const circuits = [...unitCircuits('a'), ...unitB];
  const ctx = buildMultiFamilyContext(panels[0], panels, circuits, [], settings);
  return { panels, circuits, ctx, agg: calculateAggregatedLoad('mdp', panels, circuits, [], 'dwelling', ctx) };
}

// Building-wide Part III for two of those units:
//   220.42: 5,100 lighting + 4 × 1,500 SA + 2 × 1,500 laundry = 14,100
//           → 3,000 + 35% × 11,100 = 6,885
//   Table 220.55 Col C, 2 ranges (8 kW each) = 11,000
//   220.54, 2 dryers @ 100% = 10,000
//   220.60, heat 10,000 > A/C 7,000 = 10,000
//   220.53, 6 fastened appliances @ 75%: (9,000 + 2,400 + 1,000) × 0.75 = 9,300
//   25% of the largest motor (disposal 500) = 125
const PART_III_VA = 6_885 + 11_000 + 10_000 + 10_000 + 9_300 + 125; // 47,310
// 220.85: one unit under 220.84(C) = 31,250 VA nameplate (HVAC larger of
// heat/cool); three identical units × 31,250 × 45% = 42,187.5
const THREE_UNIT_VA = 42_188;

describe('two-unit service — circuit path (packet MDP aggregate)', () => {
  it('identical units: 220.85 lesser of Part III (47,310 VA) and 220.84 for three units (42,188 VA)', () => {
    const { agg, ctx } = building();
    expect(ctx?.dwellingUnits).toBe(2);
    expect(agg.totalDemandVA).toBe(THREE_UNIT_VA);
    expect(agg.demandBreakdown[0]!.loadType).toBe('Two Dwelling Units (NEC 220.85)');
    expect(agg.demandBreakdown[0]!.necReference).toContain('47,310');
    expect(summarizeCalculationRefs(agg.necReferences)).toMatchObject({ part: 'IV', optionalSection: '220.85' });
  });

  it('rows sum to the circuits’ connected load (#160)', () => {
    const { agg } = building();
    expect(agg.totalConnectedVA).toBe(69_500);
    expect(agg.demandBreakdown.reduce((sum, r) => sum + r.connectedVA, 0)).toBe(69_500);
    expect(agg.demandBreakdown.reduce((sum, r) => sum + r.demandVA, 0)).toBe(agg.totalDemandVA);
  });

  it('units that differ: Part III, no 220.85; dishwashers are 220.53 appliances, not ranges', () => {
    const { agg } = building(unitCircuits('b', 12_000));
    expect(agg.totalDemandVA).toBe(PART_III_VA); // a 12 kW range is still Column C for 2 → 11 kW
    expect(summarizeCalculationRefs(agg.necReferences).part).toBe('III');
    const dishwasher = agg.demandBreakdown.find(r => r.loadType === 'Unit 102: Dishwasher');
    expect(dishwasher?.necReference).toBe('NEC 220.53 (6 appliances @ 75%)');
    expect(agg.necReferences.some(r => r.includes('220.44'))).toBe(false);
    expect(agg.demandBreakdown.reduce((sum, r) => sum + r.demandVA, 0)).toBe(agg.totalDemandVA);
  });

  it('is one walk, not a sum of unit results (non-cascading)', () => {
    const unit = calculateDwellingUnitPanelLoad({ circuits: unitCircuits('a'), existingBuilding: false });
    expect(unit.totalDemandVA).toBe(28_743);
    expect(PART_III_VA).toBeLessThan(2 * unit.totalDemandVA);
  });

  it('a proposed circuit on one unit: existing demand = the same walk on existing circuits', () => {
    const { agg } = building([...unitCircuits('b'), circuit('b', 'Level 2 EV Charger', 7680, 'O', true)]);
    // The proposed charger makes the units differ → Part III on the total;
    // the existing circuits alone are identical → 220.85.
    expect(agg.totalDemandVA).toBe(PART_III_VA + 7_680);
    expect(agg.existingDemandVA).toBe(THREE_UNIT_VA);
    expect(agg.proposedDemandVA).toBe(PART_III_VA + 7_680 - THREE_UNIT_VA);
  });

  it('three or more units keep 220.84', () => {
    const panels = [panel('mdp', 'MDP', null), panel('a', 'Unit 101', 'mdp'), panel('b', 'Unit 102', 'mdp'), panel('c', 'Unit 103', 'mdp')];
    const circuits = [...unitCircuits('a'), ...unitCircuits('b'), ...unitCircuits('c')];
    const ctx = buildMultiFamilyContext(panels[0], panels, circuits, [], {
      ...settings, residential: { dwellingType: 'multi_family', totalUnits: 3 },
    });
    const agg = calculateAggregatedLoad('mdp', panels, circuits, [], 'dwelling', ctx);
    expect(agg.demandBreakdown[0]!.necReference).toBe('NEC 220.84 Table (3 units @ 45%)');
  });
});

describe('two-unit building — Dwelling Load Calculator path', () => {
  // The same unit as the circuits above: 850 sq ft → 2,550 VA lighting.
  const appliances = {
    ...DEFAULT_APPLIANCES,
    range: { enabled: true, kw: 8, type: 'electric' as const },
    dryer: { enabled: true, kw: 5, type: 'electric' as const },
    waterHeater: { enabled: true, kw: 4.5, type: 'electric' as const },
    hvac: { enabled: true, type: 'heat_pump' as const, coolingKw: 3.5, heatingKw: 5 },
    dishwasher: { enabled: true, kw: 1.2 },
    disposal: { enabled: true, kw: 0.5 },
  };
  const template = (id: string, unitCount: number, extra = {}): DwellingUnitTemplate =>
    ({ id, name: `Type ${id}`, squareFootage: 850, unitCount, appliances: { ...appliances, ...extra } });

  it('one template × 2: matches the packet aggregate (220.85, 42,188 VA)', () => {
    const r = calculateMultiFamilyLoad({ unitTemplates: [template('A', 2)] });
    expect(r.totalDemandVA).toBe(THREE_UNIT_VA);
    expect(r.necReferences[0]).toContain('NEC 220.85');
    expect(r.breakdown[0]!.category).toBe('Two Dwelling Units (NEC 220.85)');
  });

  it('two different templates: Part III, matches the packet aggregate (47,310 VA)', () => {
    const r = calculateMultiFamilyLoad({
      unitTemplates: [template('A', 1), template('B', 1, { range: { enabled: true, kw: 12, type: 'electric' } })],
    });
    expect(r.totalDemandVA).toBe(PART_III_VA);
    expect(r.necReferences[0]).toBe('NEC 220 Part III - Standard Method (Two Dwelling Units)');
    expect(r.warnings.some(w => w.includes('220.85 not applied'))).toBe(true);
  });

  it('220.85 not taken when the units lack electric cooking (220.84(A))', () => {
    const r = calculateMultiFamilyLoad({
      unitTemplates: [template('A', 2, { range: { enabled: true, kw: 8, type: 'gas' } })],
    });
    expect(r.necReferences[0]).toBe('NEC 220 Part III - Standard Method (Two Dwelling Units)');
    expect(r.warnings.some(w => w.includes('220.84(A)'))).toBe(true);
  });

  it('house loads add at 100% after the dwelling load', () => {
    const r = calculateMultiFamilyLoad({ unitTemplates: [template('A', 2)], housePanelLoad: 3000 });
    expect(r.totalDemandVA).toBe(THREE_UNIT_VA + 3000);
  });
});

describe('two-unit building — MF EV calculator, calculated path', () => {
  it('no 220.84 citation; Part III or 220.85 on the assumed units', () => {
    const r = calculateMultiFamilyEV({
      dwellingUnits: 2,
      avgUnitSqFt: 1000,
      voltage: 240,
      phase: 1,
      existingServiceAmps: 200,
      evChargers: { count: 2, level: 2, ampsPerCharger: 32 },
      hasElectricCooking: true,
      hasElectricHeat: true,
    } as any);
    expect(r.compliance.necArticles).not.toContain('NEC 220.84');
    expect(r.compliance.necArticles).toContain('NEC 220 Part III - Standard Method (Two Dwelling Units)');
    // Assumed unit: 3,000 lighting + 3,000 SA + 1,500 laundry + 12 kW range + 10 kW heat.
    // Part III: 220.42 on 15,000 → 7,200; Col C 2 ranges → 11,000; heat 20,000 → 38,200.
    // 220.85: 3 × 29,500 × 45% = 39,825 → not less, so Part III.
    expect(r.buildingLoad.buildingDemandVA).toBe(38_200);
  });
});
