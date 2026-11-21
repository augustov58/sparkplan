/**
 * #282 — owner ruling 2026-11-21:
 * (4b) whole dwellings count each small-appliance and laundry circuit at the
 *      larger of its VA or 1,500 VA (220.52(A)/(B): "not less than 1500
 *      volt-amperes for each"), in the NEC 220 Part III calculations;
 * (4a) the single-family subpanel keeps #217/#284's handling;
 * generated and template projects don't change, including the sample
 * template's "Small Appliance Circuits - 2 @ 1,500 VA" 3,000 VA row.
 * The Optional Methods keep 1,500 per circuit (asked in #291).
 * Expected values: the issue's Acceptance section (hand-calculated).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSingleFamilyPanelLoad,
  calculateDwellingUnitPanelLoad,
  calculateSingleFamilySubpanelLoad,
  calculateTwoUnitDwellingLoad,
  dwellingLoadsFromCircuits,
  circuits220_52VA,
} from '../services/calculations/residentialLoad';

const c = (description: string, load_type: string, load_watts: number) => ({ description, load_type, load_watts, is_proposed: false });
const general = (rows: { loadType: string; connectedVA: number; demandVA: number }[]) =>
  rows.find(r => /small appliance \+ laundry/.test(r.loadType))!;

// "QA Dwelling generate" Main Panel (Dwelling Load Calculator, 2,400 ft²)
const sfCircuits = (sa1 = 1500, laundry = 1500) => [
  ...[1, 2, 3, 4, 5].map(n => c(`Lighting Circuit ${n}`, 'L', 1440)),
  c('Kitchen Small Appliance 1', 'R', sa1), c('Kitchen Small Appliance 2', 'R', 1500), c('Laundry', 'R', laundry),
  c('Bathroom Receptacles', 'R', 1500), c('Garage Receptacles', 'R', 1500), c('Outdoor Receptacles', 'R', 180),
  c('Refrigerator', 'K', 600), c('Electric Range', 'K', 12000), c('Electric Dryer', 'D', 5000),
  c('Electric Water Heater', 'W', 4500), c('Air Conditioning Compressor', 'C', 4200),
  c('Dishwasher', 'K', 1200), c('Garbage Disposal', 'K', 500),
];
const sf = (circuits: ReturnType<typeof sfCircuits>, existingDwelling = false) => calculateSingleFamilyPanelLoad({
  circuits, squareFootage: 2400, smallApplianceCircuits: 2, laundryCircuit: true, voltage: 240, existingDwelling,
});

// "QA MF feeders" Unit 101 Panel (multifamily generator, 1,000 ft²)
const unitCircuits = (sa1 = 1500) => [
  c('Kitchen Small Appliance #1', 'K', sa1), c('Kitchen Small Appliance #2', 'K', 1500), c('Laundry', 'R', 1500),
  c('Bathroom(s)', 'R', 0), c('General Lighting', 'L', 1500), c('General Lighting #2', 'L', 1500),
  c('Range/Oven', 'K', 12000), c('Clothes Dryer', 'D', 5500), c('A/C Condensing Unit', 'C', 5000),
  c('Water Heater', 'W', 4500), c('Dishwasher', 'K', 1500), c('Disposal', 'M', 500),
];

describe('#282 (4b) whole dwellings: each circuit at the larger of its VA or 1,500', () => {
  it('new house (Part III), generated circuits: unchanged — 11,700 / 6,045 VA; 29,570 VA', () => {
    const r = sf(sfCircuits());
    expect(general(r.rows).connectedVA).toBe(11700);
    expect(general(r.rows).demandVA).toBeCloseTo(6045, 0);
    expect(r.totalDemandVA).toBeCloseTo(29570, 0);
  });

  it('new house: small appliance #1 at 2,400 and laundry at 2,000 → 13,100 / 6,535 VA; 30,060 VA', () => {
    const r = sf(sfCircuits(2400, 2000));
    expect(general(r.rows).connectedVA).toBe(13100); // main: 11,700 (flat 1,500 each)
    expect(general(r.rows).demandVA).toBeCloseTo(6535, 0);
    expect(r.totalDemandVA).toBeCloseTo(30060, 0);   // 125.25 A at 240 V
  });

  it('multifamily unit panel (Part III): small appliance #1 at 2,400 → 8,400 / 4,890 VA; 30,015 VA (was 29,700)', () => {
    const before = calculateDwellingUnitPanelLoad({ circuits: unitCircuits(), existingBuilding: false });
    expect(before.totalDemandVA).toBeCloseTo(29700, 0);
    const after = calculateDwellingUnitPanelLoad({ circuits: unitCircuits(2400), existingBuilding: false });
    expect(general(after.rows).connectedVA).toBe(8400);
    expect(general(after.rows).demandVA).toBeCloseTo(4890, 0);
    expect(after.totalDemandVA).toBeCloseTo(30015, 0);
  });

  it('two-unit Part III walk counts it too: +900 VA in the 220.42 pool → +315 VA', () => {
    const unit = (sa1: number) => ({ label: 'U', ...dwellingLoadsFromCircuits(unitCircuits(sa1), '2020') });
    const base = calculateTwoUnitDwellingLoad({ units: [unit(1500), { ...unit(1500), label: 'V' }], identicalUnits: false });
    const raised = calculateTwoUnitDwellingLoad({ units: [unit(2400), { ...unit(1500), label: 'V' }], identicalUnits: false });
    expect(raised.partIII.totalDemandVA - base.partIII.totalDemandVA).toBeCloseTo(315, 0);
  });
});

describe('#282 templates and the 2-circuit row stay unchanged', () => {
  it('"Small Appliance Circuits - 2 @ 1,500 VA" (3,000 W) counts as two 1,500 VA circuits', () => {
    const template = sfCircuits().filter(x => !/Kitchen Small Appliance/.test(x.description));
    template.push(c('Small Appliance Circuits - 2 @ 1,500 VA (NEC 220.52A)', 'R', 3000));
    expect(sf(template).totalDemandVA).toBeCloseTo(29570, 0); // not 30,095 (3,000 + a second 1,500)
    const unit = unitCircuits().filter(x => !/Kitchen Small Appliance/.test(x.description));
    unit.push(c('Small Appliance Circuits - 2 @ 1,500 VA (NEC 220.52A)', 'K', 3000));
    expect(calculateDwellingUnitPanelLoad({ circuits: unit, existingBuilding: false }).totalDemandVA).toBeCloseTo(29700, 0);
  });

  it('one 3,000 VA small-appliance row for the two counted circuits stays 3,000', () => {
    expect(circuits220_52VA(2, [3000], 1500)).toBe(3000);
    expect(circuits220_52VA(2, [1500, 1500], 1500)).toBe(3000);
    expect(circuits220_52VA(2, [2400, 1500], 1500)).toBe(3900);
    expect(circuits220_52VA(2, [], 1500)).toBe(3000);
  });
});

describe('#282 outside Part III: unchanged', () => {
  it('(4a) subpanel: Pool Subpanel 5,355 VA; with a 2,400 VA small-appliance circuit 6,195 VA', () => {
    const pool = [c('Pool Lighting', 'L', 1500), c('Pool Receptacles', 'R', 1800), c('Pool Pump', 'M', 1800)];
    expect(calculateSingleFamilySubpanelLoad({ circuits: pool }).totalDemandVA).toBeCloseTo(5355, 0);
    expect(calculateSingleFamilySubpanelLoad({ circuits: [...pool, c('Kitchen Small Appliance #3', 'K', 2400)] }).totalDemandVA)
      .toBeCloseTo(6195, 0);
  });

  it('existing house (220.83, an Optional Method) keeps 1,500 per circuit (#291)', () => {
    expect(sf(sfCircuits(2400, 2000), true).totalDemandVA).toBe(sf(sfCircuits(), true).totalDemandVA);
  });
});
