/**
 * Issue #121: single-family E-102 (existing-service capacity) must use the
 * same NEC 220.82 / 220.83 Optional Method as E-101 (Load Calculation
 * Summary), not the Part III cascade.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateDwellingDemandSplit,
  calculateDwellingPanelDemand,
} from '../services/calculations/residentialLoad';
import { buildSingleFamilyDwellingContext } from '../lib/projectSettings';
import { summarizeCalculationRefs } from '../services/pdfExport/PermitPacketDocuments';
import type { Project } from '../types';

// 2,000 sq ft existing dwelling on a 200 A / 240 V service, adding a 40 A EV charger.
const circuits = [
  { description: 'General lighting', load_watts: 6000, load_type: 'L', breaker_amps: 20, is_proposed: false },
  { description: 'Small appliance', load_watts: 3000, load_type: 'R', breaker_amps: 20, is_proposed: false },
  { description: 'Laundry', load_watts: 1500, load_type: 'R', breaker_amps: 20, is_proposed: false },
  { description: 'Range', load_watts: 12000, load_type: 'K', breaker_amps: 50, is_proposed: false },
  { description: 'Dishwasher', load_watts: 1200, load_type: 'K', breaker_amps: 20, is_proposed: false },
  { description: 'Dryer', load_watts: 5000, load_type: 'D', breaker_amps: 30, is_proposed: false },
  { description: 'Water heater', load_watts: 4500, load_type: 'W', breaker_amps: 30, is_proposed: false },
  { description: 'AC condenser', load_watts: 5000, load_type: 'C', breaker_amps: 30, is_proposed: false },
  { description: 'Heat strip', load_watts: 10000, load_type: 'H', breaker_amps: 60, is_proposed: false },
  { description: 'EV charger 40A', load_watts: 9600, load_type: 'O', breaker_amps: 50, is_proposed: true },
];
const dwelling = {
  squareFootage: 2000,
  smallApplianceCircuits: 2,
  laundryCircuit: true,
  voltage: 240,
};

describe('calculateDwellingDemandSplit', () => {
  it('total equals the E-101 Optional Method total, and existing + proposed = total', () => {
    const split = calculateDwellingDemandSplit({ circuits, ...dwelling, existingDwelling: true });
    const e101 = calculateDwellingPanelDemand({ circuits, ...dwelling, existingDwelling: true });

    expect(split.totalDemandVA).toBe(e101.totalDemandVA);
    expect(split.existingDemandVA + split.proposedDemandVA).toBe(split.totalDemandVA);
  });

  it('existing dwelling, no HVAC added → NEC 220.83(A) figures for the fixture', () => {
    const split = calculateDwellingDemandSplit({ circuits, ...dwelling, existingDwelling: true });

    expect(split.necArticle).toBe('NEC 220.83');
    // 220.83(A) (PE ruling 2026-10-18, #132): the existing HVAC (larger of
    // heat/cool = 10,000) joins the bucket. Existing 33,200 + 10,000 = 43,200
    // → 8,000 + 40% × 35,200 = 22,080.
    expect(split.existingDemandVA).toBe(22_080);
    // EV at nameplate (NEC 2020): 9,600 × 40% = 3,840 added.
    expect(split.totalDemandVA).toBe(25_920);
    expect(split.proposedDemandVA).toBe(3_840);
    // 25.92 kVA / 240 V = 108 A ≤ 200 A — E-102 agrees with E-101.
    expect(split.totalDemandVA / 240).toBeLessThan(200);
  });

  it('proposed HVAC (incl. a like-for-like replacement) → NEC 220.83(B) on both runs', () => {
    // The 5 kW AC condenser is being replaced: the permit adds HVAC.
    const withHvac = circuits.map(c => c.load_type === 'C' ? { ...c, is_proposed: true } : c);
    const split = calculateDwellingDemandSplit({ circuits: withHvac, ...dwelling, existingDwelling: true });

    // Existing run (no AC, heat strip existing) stays on (B): HVAC 10,000 at 100%.
    // General 33,200 → 8,000 + 40% × 25,200 = 18,080; + 10,000 = 28,080.
    expect(split.existingDemandVA).toBe(28_080);
    // Total: larger of heat 10,000 / cool 5,000 at 100% + EV 3,840 in the bucket.
    expect(split.totalDemandVA).toBe(31_920);
    expect(split.existingDemandVA + split.proposedDemandVA).toBe(split.totalDemandVA);
    expect(split.necReferences).toEqual(['NEC 220.83(B)', 'NEC 220.60']);
  });

  it('new dwelling with "10 kVA / 40%" selected → NEC 220.82', () => {
    const split = calculateDwellingDemandSplit({ circuits, ...dwelling, existingDwelling: false, useOptionalMethod: true });
    const e101 = calculateDwellingPanelDemand({ circuits, ...dwelling, existingDwelling: false });

    expect(split.necArticle).toBe('NEC 220.82');
    expect(split.totalDemandVA).toBe(e101.totalDemandVA);
  });

  it('new dwelling by default → NEC 220 Part III, and the narrative cites Part III (#178)', () => {
    const split = calculateDwellingDemandSplit({ circuits, ...dwelling, existingDwelling: false });

    expect(split.necArticle).toBe('NEC 220 Part III');
    expect(split.existingDemandVA + split.proposedDemandVA).toBe(split.totalDemandVA);
    expect(summarizeCalculationRefs(split.necReferences).part).toBe('III');
  });

  it('no proposed circuits → proposed demand is 0', () => {
    const existingOnly = circuits.filter(c => !c.is_proposed);
    const split = calculateDwellingDemandSplit({ circuits: existingOnly, ...dwelling, existingDwelling: true });

    expect(split.proposedDemandVA).toBe(0);
    expect(split.existingDemandVA).toBe(split.totalDemandVA);
  });

  it('references make the E-102 narrative cite Part IV / 220.83', () => {
    const split = calculateDwellingDemandSplit({ circuits, ...dwelling, existingDwelling: true });
    const citation = summarizeCalculationRefs(split.necReferences);

    expect(split.necReferences).toEqual(['NEC 220.83(A)', 'NEC 220.60']);
    expect(citation.part).toBe('IV');
    expect(citation.optionalSection).toBe('220.83');
  });
});

describe('buildSingleFamilyDwellingContext', () => {
  const project = (settings: Record<string, unknown>) => ({ settings } as unknown as Project);

  it('single-family dwelling → context; existing unless new-service', () => {
    expect(buildSingleFamilyDwellingContext(project({ occupancyType: 'dwelling' }), false))
      .toMatchObject({ existingDwelling: true, squareFootage: 2000 });
    expect(buildSingleFamilyDwellingContext(
      project({ occupancyType: 'dwelling', service_modification_type: 'new-service' }), false,
    )).toMatchObject({ existingDwelling: false, useOptionalMethod: false });
    expect(buildSingleFamilyDwellingContext(
      project({ occupancyType: 'dwelling', service_modification_type: 'new-service', dwelling_calc_mode: 'true-optional' }), false,
    )).toMatchObject({ existingDwelling: false, useOptionalMethod: true });
  });

  it('multi-family context, multi_family dwelling type, or commercial → undefined', () => {
    expect(buildSingleFamilyDwellingContext(project({ occupancyType: 'dwelling' }), true)).toBeUndefined();
    expect(buildSingleFamilyDwellingContext(
      project({ occupancyType: 'dwelling', residential: { dwellingType: 'multi_family' } }), false,
    )).toBeUndefined();
    expect(buildSingleFamilyDwellingContext(project({ occupancyType: 'commercial' }), false)).toBeUndefined();
  });
});
