/**
 * #155 (PE ruling 2026-10-26): a dwelling unit panel in a multifamily
 * building computes NEC 220 Part III; NEC 220.83 only when the permit adds
 * load to that unit. Part III is exact: Table 220.55 Column C, 220.53 75%
 * for four or more fastened-in-place appliances, 25% of the largest motor
 * (motor circuits only, never the A/C).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateDwellingStandardLoad,
  calculateDwellingUnitPanelLoad,
  calculateSingleFamilyLoad,
  type DwellingLoadItem,
  type PanelDemandCircuit,
} from '../services/calculations/residentialLoad';
import { getCookingDemandVA } from '../data/nec/table-220-55';
import { DEFAULT_APPLIANCES } from '../lib/storedCalcs';

const c = (description: string, load_watts: number, load_type: string, is_proposed = false): PanelDemandCircuit =>
  ({ description, load_watts, load_type, is_proposed });

/** Unit 101 of the St. Pete 12-unit QA building, as the generator wrote it. */
const unit101: PanelDemandCircuit[] = [
  c('Kitchen Small Appliance #1', 1500, 'K'),
  c('Kitchen Small Appliance #2', 1500, 'K'),
  c('Laundry', 1500, 'R'),
  c('Bathroom(s)', 0, 'R'),
  c('General Lighting', 1275, 'L'),
  c('General Lighting #2', 1275, 'L'),
  c('Range/Oven', 8000, 'K'),
  c('Clothes Dryer', 5000, 'D'),
  c('Electric Heat / Heat Pump', 5000, 'H'),
  c('A/C Condensing Unit', 3500, 'C'),
  c('Water Heater', 4500, 'W'),
  c('Dishwasher', 1200, 'K'),
  c('Disposal', 500, 'M'),
];

describe('calculateDwellingUnitPanelLoad', () => {
  it('Unit 101: Part III, 28,743 VA (was 21,500 VA under a 10 kVA bucket labelled 220.83)', () => {
    // 2,550 + 3,000 + 1,500 = 7,050 → 3,000 + 35% × 4,050 = 4,418 (Table 220.42)
    // + range 8,000 (Col C) + dryer 5,000 + heat 5,000 (> A/C 3,500)
    // + WH 4,500 + DW 1,200 + disposal 500 (3 fastened appliances → 100%)
    // + 25% × disposal 500 = 125
    const r = calculateDwellingUnitPanelLoad({ circuits: unit101, existingBuilding: true });
    expect(r.necArticle).toBe('NEC 220 Part III');
    expect(r.totalDemandVA).toBe(28_743);
    expect(r.totalConnectedVA).toBe(31_250);
    expect(r.rows.find(row => row.loadType === 'Range/Oven')?.demandVA).toBe(8_000);
    expect(r.rows.find(row => row.loadType === 'Largest Motor (25%)')?.demandVA).toBe(125);
    expect(r.title).toContain('Part III');
  });

  it('existing building + proposed circuit on this unit → NEC 220.83, small-appliance circuits not double-counted', () => {
    const circuits = [...unit101, c('Level 2 EV Charger', 7680, 'O', true)];
    const r = calculateDwellingUnitPanelLoad({ circuits, existingBuilding: true });
    expect(r.necArticle).toBe('NEC 220.83');
    // 220.83(A) (no HVAC proposed): 2,550 + 3,000 + 1,500 + 8,000 + 5,000 + 4,500
    // + 1,200 + 500 + 7,680 + heat 5,000 = 38,930 → 8,000 + 40% × 30,930 = 20,372
    expect(r.totalDemandVA).toBe(20_372);
    expect(r.rows[0]!.necReference).toBe('NEC 220.83(A)');
  });

  it('proposed circuits in a new building stay Part III; no proposed circuits stay Part III', () => {
    const circuits = [...unit101, c('Level 2 EV Charger', 7680, 'O', true)];
    expect(calculateDwellingUnitPanelLoad({ circuits, existingBuilding: false }).necArticle).toBe('NEC 220 Part III');
    expect(calculateDwellingUnitPanelLoad({ circuits: unit101, existingBuilding: true }).necArticle).toBe('NEC 220 Part III');
  });

  it('EVSE on a unit panel follows the edition (NEC 2023 7,200 VA floor), outside 220.53', () => {
    const circuits = [...unit101, c('EV Charger', 3840, 'O')];
    const r2020 = calculateDwellingUnitPanelLoad({ circuits, existingBuilding: false, necEdition: '2020' });
    const r2023 = calculateDwellingUnitPanelLoad({ circuits, existingBuilding: false, necEdition: '2023' });
    expect(r2020.totalDemandVA).toBe(28_743 + 3_840);
    expect(r2023.totalDemandVA).toBe(28_743 + 7_200);
  });

  it('warns when the panel has no lighting circuits', () => {
    const r = calculateDwellingUnitPanelLoad({
      circuits: unit101.filter(x => x.load_type !== 'L'),
      existingBuilding: false,
    });
    expect(r.warnings.some(w => w.includes('220.12'))).toBe(true);
  });
});

describe('calculateDwellingStandardLoad — Part III details', () => {
  const base = { lightingVA: 0, lightingDescription: '', smallApplianceCircuits: 2, laundryCircuit: false };
  const item = (category: string, va: number, kind: DwellingLoadItem['kind']): DwellingLoadItem =>
    ({ category, description: category, va, kind });
  const rowDemand = (items: DwellingLoadItem[], category: string) =>
    calculateDwellingStandardLoad({ ...base, items }).breakdown.find(r => r.category === category)?.demandVA;

  it('220.53: 75% on four or more fastened-in-place appliances (500 W or more)', () => {
    const items = [
      item('Water Heater', 4500, 'appliance'), item('Dishwasher', 1200, 'appliance'),
      item('Microwave', 1500, 'appliance'), item('Disposal', 500, 'motor'),
    ];
    const r = calculateDwellingStandardLoad({ ...base, items });
    expect(r.breakdown.find(x => x.category === 'Water Heater')?.demandVA).toBe(3375);
    expect(r.breakdown.find(x => x.category === 'Water Heater')?.necReference).toBe('NEC 220.53 (4 appliances @ 75%)');
    // three appliances → 100%
    expect(rowDemand(items.slice(0, 3), 'Water Heater')).toBe(4500);
  });

  it('220.53 excludes cooking, dryers, HVAC and EVSE from the count', () => {
    const items = [
      item('Water Heater', 4500, 'appliance'), item('Dishwasher', 1200, 'appliance'), item('Disposal', 500, 'motor'),
      item('Range', 8000, 'cooking'), item('Dryer', 5000, 'dryer'), item('EV', 7680, 'evse'),
      item('HVAC', 5000, 'heating'),
    ];
    expect(rowDemand(items, 'Water Heater')).toBe(4500);
  });

  it('largest motor: 25% of the largest motor circuit, never the A/C', () => {
    const items = [item('HVAC', 5000, 'cooling'), item('Disposal', 500, 'motor'), item('Pool Pump', 1500, 'motor')];
    const r = calculateDwellingStandardLoad({ ...base, items });
    const motorRow = r.breakdown.find(x => x.category === 'Largest Motor (25%)');
    expect(motorRow?.demandVA).toBe(375);
    expect(calculateDwellingStandardLoad({ ...base, items: [item('HVAC', 5000, 'cooling')] })
      .breakdown.some(x => x.category === 'Largest Motor (25%)')).toBe(false);
  });

  it('a cooking appliance of 1¾ kW or less is a fastened-in-place appliance, not Table 220.55', () => {
    expect(rowDemand([item('Warming Drawer', 1500, 'cooking')], 'Warming Drawer')).toBe(1500);
  });
});

describe('getCookingDemandVA — Table 220.55 Column C', () => {
  it('one range up to 12 kW → 8 kW; a 12 kW range is 8 kW, not 80%', () => {
    expect(getCookingDemandVA([8000]).demandVA).toBe(8000);
    expect(getCookingDemandVA([12000]).demandVA).toBe(8000);
    // Column C is used even for a small cooktop (Note 3 not taken)
    expect(getCookingDemandVA([6000]).demandVA).toBe(8000);
  });

  it('two appliances (cooktop + oven) → Column C for 2 = 11 kW', () => {
    expect(getCookingDemandVA([6000, 4000]).demandVA).toBe(11000);
  });

  it('Note 1: over 12 kW → +5% per kW or major fraction', () => {
    expect(getCookingDemandVA([14000]).demandVA).toBe(8800);   // +2 kW → +10%
    expect(getCookingDemandVA([13400]).demandVA).toBe(8400);   // 1.4 kW → 1 step
    expect(getCookingDemandVA([13600]).demandVA).toBe(8800);   // 1.6 kW → 2 steps
  });

  it('Note 2: unequal ratings average with 12 kW minimum each', () => {
    // (16 + 12) / 2 = 14 kW average → Column C for 2 (11 kW) + 10%
    expect(getCookingDemandVA([16000, 8000]).demandVA).toBe(12100);
  });

  it('over 27 kW is outside the table → nameplate with a warning', () => {
    const r = getCookingDemandVA([30000]);
    expect(r.demandVA).toBe(30000);
    expect(r.warnings.length).toBe(1);
  });
});

describe('calculateSingleFamilyLoad default mode is the same Part III', () => {
  it('labels and computes Part III; the 12 kW range takes Column C 8 kW', () => {
    const r = calculateSingleFamilyLoad({
      squareFootage: 2000,
      smallApplianceCircuits: 2,
      laundryCircuit: true,
      appliances: { ...DEFAULT_APPLIANCES, range: { enabled: true, kw: 12, type: 'electric' } },
    });
    expect(r.necReferences[0]).toBe('NEC 220 Part III - Standard Method (Dwelling Unit)');
    expect(r.breakdown.find(x => x.category === 'Electric Range')?.demandVA).toBe(8000);
  });
});
