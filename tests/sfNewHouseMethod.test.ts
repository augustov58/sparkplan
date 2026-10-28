/**
 * #178 (PE ruling 2026-10-27): a new single-family house prints the method
 * chosen on the Dwelling Load Calculator — NEC 220.82 when "10 kVA / 40%"
 * is selected, NEC 220 Part III otherwise (the default). Existing houses
 * stay on NEC 220.83.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSingleFamilyPanelLoad,
  calculateSingleFamilyLoad,
  calculateDwellingPanelDemand,
} from '../services/calculations/residentialLoad';
import { DEFAULT_APPLIANCES } from '../lib/storedCalcs';

// 2,000 sq ft house: range, dishwasher, dryer, water heater, A/C + heat strip, 40 A EV charger.
const circuits = [
  { description: 'General lighting', load_watts: 6000, load_type: 'L', is_proposed: false },
  { description: 'Small appliance', load_watts: 3000, load_type: 'R', is_proposed: false },
  { description: 'Laundry', load_watts: 1500, load_type: 'R', is_proposed: false },
  { description: 'Range', load_watts: 12000, load_type: 'K', is_proposed: false },
  { description: 'Dishwasher', load_watts: 1200, load_type: 'K', is_proposed: false },
  { description: 'Dryer', load_watts: 5000, load_type: 'D', is_proposed: false },
  { description: 'Water heater', load_watts: 4500, load_type: 'W', is_proposed: false },
  { description: 'AC condenser', load_watts: 5000, load_type: 'C', is_proposed: false },
  { description: 'Heat strip', load_watts: 10000, load_type: 'H', is_proposed: false },
  { description: 'EV charger 40A', load_watts: 9600, load_type: 'O', is_proposed: false },
];
const house = { circuits, squareFootage: 2000, smallApplianceCircuits: 2, laundryCircuit: true, voltage: 240 };

// Part III: 220.42 on 6,000 + 3,000 + 1,500 = 10,500 → 3,000 + 35% × 7,500 = 5,625
//   + range 8,000 (Column C) + dishwasher 1,200 + dryer 5,000 + water heater 4,500
//   (2 fastened appliances → 100%) + heat 10,000 (> A/C 5,000) + EVSE 9,600 = 43,925
const PART_III_VA = 43_925;

describe('new single-family house — method follows the calculator choice', () => {
  it('default: NEC 220 Part III from the circuits, with lighting from the floor area', () => {
    const r = calculateSingleFamilyPanelLoad({ ...house, existingDwelling: false });
    expect(r.necArticle).toBe('NEC 220 Part III');
    expect(r.totalDemandVA).toBe(PART_III_VA);
    expect(r.rows.find(row => row.loadType === 'Range')?.demandVA).toBe(8_000);
    expect(r.rows[0]!.necReference).toBe('NEC Table 220.42');
    expect(r.rows.reduce((sum, row) => sum + row.demandVA, 0)).toBe(r.totalDemandVA);
  });

  it('"10 kVA / 40%" selected: NEC 220.82, the same number as before', () => {
    const r = calculateSingleFamilyPanelLoad({ ...house, existingDwelling: false, useOptionalMethod: true });
    expect(r.necArticle).toBe('NEC 220.82');
    expect(r.totalDemandVA).toBe(calculateDwellingPanelDemand({ ...house, existingDwelling: false }).totalDemandVA);
  });

  it('existing house: NEC 220.83 whatever the calculator setting', () => {
    for (const useOptionalMethod of [false, true]) {
      const r = calculateSingleFamilyPanelLoad({ ...house, existingDwelling: true, useOptionalMethod });
      expect(r.necArticle).toBe('NEC 220.83');
    }
  });

  it('the panel and the Dwelling Load Calculator agree for the same house', () => {
    const calculator = calculateSingleFamilyLoad({
      squareFootage: 2000,
      smallApplianceCircuits: 2,
      laundryCircuit: true,
      appliances: {
        ...DEFAULT_APPLIANCES,
        range: { enabled: true, kw: 12, type: 'electric' },
        dishwasher: { enabled: true, kw: 1.2 },
        dryer: { enabled: true, kw: 5, type: 'electric' },
        waterHeater: { enabled: true, kw: 4.5, type: 'electric' },
        hvac: { enabled: true, type: 'electric_heat', coolingKw: 5, heatingKw: 10 },
        evCharger: { enabled: true, kw: 9.6, level: 2 },
      },
    });
    expect(calculator.totalDemandVA).toBe(PART_III_VA);
  });

  it('NEC 2023: the EVSE takes the 7,200 VA minimum in Part III', () => {
    const small = circuits.map(c => c.description.startsWith('EV') ? { ...c, load_watts: 3840 } : c);
    const r = calculateSingleFamilyPanelLoad({ ...house, circuits: small, existingDwelling: false, necEdition: '2023' });
    expect(r.totalDemandVA).toBe(PART_III_VA - 9_600 + 7_200);
  });

  it('untyped circuits (project templates store none): types come from the description', () => {
    // The "2000 sq ft Single-Family Home" template's circuits, all load type 'O'.
    const o = (description: string, load_watts: number) => ({ description, load_watts, load_type: 'O', is_proposed: false });
    const template = [
      o('Kitchen Receptacles 1', 1800), o('Kitchen Receptacles 2', 1800), o('Refrigerator', 600),
      o('Dishwasher', 1200), o('Garbage Disposal', 900), o('Microwave', 1500),
      o('Living Room Receptacles', 1200), o('Bedroom 1 Receptacles', 1200), o('Bedroom 2 Receptacles', 1200),
      o('Bedroom 3 Receptacles', 1200), o('General Lighting', 800), o('Exterior Lighting', 300),
      o('Bathroom 1 Receptacles (GFCI)', 1500), o('Bathroom 2 Receptacles (GFCI)', 1500),
      o('Electric Range (40A)', 8000), o('Electric Dryer (30A)', 5000), o('Water Heater (30A)', 4500),
      o('Air Conditioner (30A)', 5000), o('Furnace/Air Handler (15A)', 1200),
    ];
    const r = calculateSingleFamilyPanelLoad({ ...house, circuits: template, existingDwelling: false });
    // 5,625 general + range 8,000 (Column C) + dryer 5,000 + A/C 5,000 (220.60)
    // + 5 fastened appliances @ 75% (dishwasher, disposal, microwave, water
    // heater, air handler: 9,300 → 6,975) + 25% of the air handler 1,200 = 300
    expect(r.totalDemandVA).toBe(30_900);
    expect(r.rows.find(row => row.loadType === 'Electric Range (40A)')?.necReference).toContain('Column C');
    expect(r.rows.find(row => row.loadType.startsWith('HVAC'))?.demandVA).toBe(5_000);
    expect(r.rows.some(row => /Receptacles/.test(row.loadType))).toBe(false);

    // 220.82 on the same circuits: the A/C is the 220.82(C) HVAC row at 100%,
    // not in the 40% bucket; receptacles, lighting and the refrigerator are in
    // the 3 VA/ft² + 220.52 baseline. General: 10,500 + dishwasher 1,200 +
    // disposal 900 + microwave 1,500 + range 8,000 + dryer 5,000 + water
    // heater 4,500 + air handler 1,200 = 32,800 → 10,000 + 40% × 22,800 = 19,120.
    const optional = calculateDwellingPanelDemand({ ...house, circuits: template, existingDwelling: false });
    expect(optional.generalConnectedVA).toBe(32_800);
    expect(optional.hvacVA).toBe(5_000);
    expect(optional.totalDemandVA).toBe(19_120 + 5_000);
  });
});
