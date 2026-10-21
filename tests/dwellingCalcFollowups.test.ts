/**
 * Dwelling calc follow-ups from the 2026-10-14 QA (#143, #159).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateMultiFamilyLoad,
  calculateSingleFamilyLoad,
} from '../services/calculations/residentialLoad';

describe('#143 multifamily neutral (NEC 220.61)', () => {
  // QA 12-unit building: 850 ft² units, electric range/dryer/WH, heat pump 3.5 / 5 kW.
  const result = calculateMultiFamilyLoad({
    unitTemplates: [{
      id: 't', name: '1BR', squareFootage: 850, unitCount: 12,
      appliances: {
        range: { enabled: true, kw: 8, type: 'electric' },
        dryer: { enabled: true, kw: 5, type: 'electric' },
        waterHeater: { enabled: true, kw: 4.5, type: 'electric' },
        dishwasher: { enabled: true, kw: 1.2 },
        disposal: { enabled: true, kw: 0.5 },
        hvac: { enabled: true, type: 'heat_pump', coolingKw: 3.5, heatingKw: 5 },
      },
    }],
    housePanelLoad: 15_000,
  } as Parameters<typeof calculateMultiFamilyLoad>[0]);

  it('takes the 220.84 factor and excludes 240 V-only appliances', () => {
    // Units 375,000 VA × 41% = 153,750 + house 15,000 = 168,750 VA (703 A).
    expect(result.totalDemandVA).toBe(168_750);
    // Neutral: (375,000 − 12 × 17,500 range/dryer/WH) × 41% + 15,000 = 82,650 VA
    // = 344.4 A → 200 + 144.4 × 70% = 301.1 A (was 1,145 A).
    expect(result.neutralAmps).toBeCloseTo(301.1, 1);
  });

  it('neutral never exceeds the phase demand', () => {
    expect(result.neutralLoadVA).toBeLessThanOrEqual(result.totalDemandVA);
  });
});

describe('#159 heat-pump connected load = the larger of heat/cool', () => {
  it('HVAC row connected matches its demand (10 kW, not 15 kW)', () => {
    const r = calculateSingleFamilyLoad({
      squareFootage: 2000, smallApplianceCircuits: 2, laundryCircuit: true,
      appliances: { hvac: { enabled: true, type: 'heat_pump', coolingKw: 5, heatingKw: 10 } },
    });
    const hvac = r.breakdown.find(b => b.category === 'HVAC')!;
    expect(hvac.connectedVA).toBe(10_000);
    expect(hvac.demandVA).toBe(10_000);
  });
});
