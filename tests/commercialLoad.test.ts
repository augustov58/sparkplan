/**
 * Commercial Load Calculator — continuous HVAC and special loads stay at 100%
 * in the Article 220 load total; their 125% is in service sizing only (#195).
 * Values are the hand calculation in the issue's Acceptance section.
 */
import { describe, it, expect } from 'vitest';
import { calculateCommercialLoad, type CommercialLoadInput } from '../services/calculations/commercialLoad';

const HVAC_VA = 42 * 208 * Math.sqrt(3); // 15,131.2 VA

const base = (over: Partial<CommercialLoadInput> = {}): CommercialLoadInput => ({
  occupancyType: 'office_buildings',
  totalFloorArea: 10000,
  generalReceptacleCount: 50,
  hvacLoads: [{ description: 'RTU-1', nameplateFLA: 42, voltage: 208, phase: 3, isContinuous: true }],
  motorLoads: [],
  serviceVoltage: 208,
  servicePhase: 3,
  necEdition: '2020',
  ...over,
});

const row = (r: ReturnType<typeof calculateCommercialLoad>, category: string) =>
  r.loadBreakdown.find(item => item.category.startsWith(category))!;

describe('Commercial Load Calculator — continuous loads (#195)', () => {
  it('takes continuous HVAC at 100% in the load total and 125% in service sizing', () => {
    const r = calculateCommercialLoad(base());
    const hvac = row(r, 'HVAC');
    expect(hvac.connectedLoad_VA).toBeCloseTo(15131.2, 1);
    expect(hvac.demandLoad_VA).toBeCloseTo(15131.2, 1);
    expect(hvac.demandFactor).toBe(100);
    expect(hvac.isContinuous).toBe(true);
    expect(hvac.serviceSizingLoad_VA).toBeCloseTo(18914.0, 1);
    expect(r.totalDemandLoad_VA).toBeCloseTo(37131.2, 1); // 13,000 + 9,000 + 15,131.2
    expect(r.hvacDemandLoad_VA).toBeCloseTo(15131.2, 1);
    expect(r.calculatedAmps).toBeCloseTo(113.6, 1); // 40,914.0 ÷ 360.267 — unchanged by #195
    expect(r.recommendedMainBreakerAmps).toBe(125);
  });

  it('leaves non-continuous HVAC without the 125% anywhere', () => {
    const r = calculateCommercialLoad(base({
      hvacLoads: [{ description: 'RTU-1', nameplateFLA: 42, voltage: 208, phase: 3, isContinuous: false }],
    }));
    const hvac = row(r, 'HVAC');
    expect(hvac.isContinuous).toBe(false);
    expect(hvac.serviceSizingLoad_VA).toBeCloseTo(HVAC_VA, 6);
    expect(r.totalDemandLoad_VA).toBeCloseTo(37131.2, 1);
    expect(r.calculatedAmps).toBeCloseTo(103.1, 1);
  });

  it('takes a continuous special load at 100% in the load total and 125% in service sizing', () => {
    const r = calculateCommercialLoad(base({
      specialLoads: [{ description: 'EV charger', load_VA: 10000, isContinuous: true }],
    }));
    const special = row(r, 'Special');
    expect(special.demandLoad_VA).toBe(10000);
    expect(special.demandFactor).toBe(100);
    expect(special.isContinuous).toBe(true);
    expect(special.serviceSizingLoad_VA).toBe(12500);
    expect(r.specialDemandLoad_VA).toBe(10000);
    expect(r.totalDemandLoad_VA).toBeCloseTo(47131.2, 1);
    expect(r.calculatedAmps).toBeCloseTo(148.3, 1);
  });

  it('applies the 125% per special load when continuous and non-continuous loads are mixed', () => {
    const r = calculateCommercialLoad(base({
      specialLoads: [
        { description: 'EV charger', load_VA: 10000, isContinuous: true },
        { description: 'Welder', load_VA: 5000, isContinuous: false },
      ],
    }));
    const special = row(r, 'Special');
    expect(special.connectedLoad_VA).toBe(15000);
    expect(special.demandLoad_VA).toBe(15000);
    expect(special.demandFactor).toBe(100);
    expect(special.isContinuous).toBe(true);
    expect(special.serviceSizingLoad_VA).toBe(17500); // 12,500 + 5,000
    expect(r.totalDemandLoad_VA).toBeCloseTo(52131.2, 1);
    expect(r.calculatedAmps).toBeCloseTo(162.1, 1);
    // The sizing note splits the mixed row: 9,000 + 5,000 non-continuous; 18,914 + 12,500 at 125%
    expect(r.notes.join(' | ')).toContain('Non-continuous (14000 VA) + Continuous loads at 125% (31414 VA)');
  });

  it('keeps signs and show windows as they were: 100% in the load, 125% in service sizing', () => {
    const r = calculateCommercialLoad(base({ signOutlets: 1, showWindowLighting_linearFeet: 10 }));
    expect(row(r, 'Sign').demandLoad_VA).toBe(1200);
    expect(row(r, 'Sign').serviceSizingLoad_VA).toBe(1500);
    expect(row(r, 'Show Window').demandLoad_VA).toBe(2000);
    expect(row(r, 'Show Window').serviceSizingLoad_VA).toBe(2500);
  });

  it('never puts more than the connected load in a row of the load total', () => {
    const r = calculateCommercialLoad(base({
      specialLoads: [{ description: 'EV charger', load_VA: 10000, isContinuous: true }],
      signOutlets: 2,
    }));
    for (const item of r.loadBreakdown) {
      if (item.category.startsWith('Motor')) continue; // 430.24: +25% of the largest motor is in the load
      expect(item.demandLoad_VA).toBeLessThanOrEqual(item.connectedLoad_VA + 1e-6);
    }
  });
});
