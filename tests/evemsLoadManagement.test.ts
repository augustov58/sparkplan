/**
 * EVEMS Load Management tool — EV load at 100% (no EVSE demand factor), the
 * 25% service-check adder, and the EVEMS setpoint sized to fit (#194).
 * Values are the hand calculation in the issue's Acceptance section.
 */
import { describe, it, expect } from 'vitest';
import { calculateEVEMSLoadManagement, type EVEMSInput } from '../services/calculations/evemsLoadManagement';

const base = (over: Partial<EVEMSInput> & { qty?: number; amps?: number; volts?: number } = {}): EVEMSInput => {
  const { qty = 1, amps = 32, volts = 240, ...rest } = over;
  return {
    serviceAmps: 200,
    serviceVoltage: 240,
    servicePhase: 1,
    existingLoad_kVA: 30,
    existingDemand_kVA: 24,
    evChargers: [{ level: 'Level2', voltage: volts, phase: 1, chargerAmps: amps, quantity: qty }],
    useEVEMS: false,
    necEdition: '2023',
    ...rest,
  };
};

describe('EVEMS tool — EV load without EVEMS (#194)', () => {
  it('takes 4 chargers at 100% and adds 25% in the service check', () => {
    const r = calculateEVEMSLoadManagement(base({ qty: 4 }));
    expect(r.serviceCapacity_kVA).toBe(48);
    expect(r.availableCapacity_kVA).toBe(24);
    expect(r.evDemandLoad_kVA).toBe(30.72);
    expect(r.continuousAdder_kVA).toBe(7.68);
    expect(r.totalSystemDemand_kVA).toBe(62.4);
    expect(r.serviceUtilizationPercent).toBe(130);
    expect(r.serviceUpgradeNeeded).toBe(true);
    expect(r.recommendedServiceAmps).toBe(400);
    expect(r.maxChargersWithoutEVEMS).toBe(2);
    expect(r.maxChargersWithEVEMS).toBe(6); // 72 A setpoint ÷ 12 A (#202)
    expect(r.evemsRecommendations.evemsBenefit_kVA).toBe(16.8);
    expect(r.necReferences).toEqual(['NEC 220.57(A)', 'NEC 625.42', 'NEC 230.42(A)(1)']);
    expect(r.evemsRecommendations.notes.join(' ')).not.toMatch(/demand factor of|625\.44/i);
  });

  it('takes 12 chargers at 100% too (the old 11–25 bucket was 85%)', () => {
    const r = calculateEVEMSLoadManagement(base({ qty: 12 }));
    expect(r.evDemandLoad_kVA).toBe(92.16);
    expect(r.continuousAdder_kVA).toBe(23.04);
    expect(r.totalSystemDemand_kVA).toBe(139.2);
    expect(r.serviceUtilizationPercent).toBe(290);
    expect(r.recommendedServiceAmps).toBe(800);
    expect(r.evemsRecommendations.evemsBenefit_kVA).toBe(93.6);
  });

  it('applies the NEC 2023 220.57(A) floor to a Level 1 charger, and not under NEC 2020', () => {
    const l1 = { level: 'Level1' as const, voltage: 120, phase: 1 as const, chargerAmps: 12, quantity: 1 };
    const r23 = calculateEVEMSLoadManagement(base({ evChargers: [l1] }));
    expect(r23.evDemandLoad_kVA).toBe(7.2);
    expect(r23.continuousAdder_kVA).toBe(1.8);
    expect(r23.totalSystemDemand_kVA).toBe(33);
    expect(r23.serviceUtilizationPercent).toBe(68.8);
    expect(r23.maxChargersWithoutEVEMS).toBe(2);
    expect(r23.maxChargersWithEVEMS).toBe(12); // 17,280 VA ÷ 120 V = 144 A ÷ 12 A (#202)

    const r20 = calculateEVEMSLoadManagement(base({ evChargers: [l1], necEdition: '2020' }));
    expect(r20.evDemandLoad_kVA).toBe(1.44);
    expect(r20.totalSystemDemand_kVA).toBe(25.8);
    expect(r20.necReferences[0]).toBe('NEC 220.14(A)');
  });
});

describe('EVEMS tool — with EVEMS (#194)', () => {
  it('sizes the setpoint so its 125% fits 90% of the available capacity', () => {
    const r = calculateEVEMSLoadManagement(base({ qty: 4, useEVEMS: true }));
    expect(r.evDemandLoad_kVA).toBe(17.28);
    expect(r.continuousAdder_kVA).toBe(4.32);
    expect(r.totalSystemDemand_kVA).toBe(45.6);
    expect(r.serviceUtilizationPercent).toBe(95);
    expect(r.serviceUpgradeNeeded).toBe(false);
  });

  it('uses the full EV load when it already fits under the setpoint', () => {
    const r = calculateEVEMSLoadManagement(base({ qty: 1, useEVEMS: true }));
    expect(r.evDemandLoad_kVA).toBe(7.68);
    expect(r.totalSystemDemand_kVA).toBe(33.6);
  });

  it('never goes negative when the existing load already exceeds the service', () => {
    const r = calculateEVEMSLoadManagement(base({ qty: 4, useEVEMS: true, existingDemand_kVA: 50 }));
    expect(r.evDemandLoad_kVA).toBe(0);
    expect(r.serviceUpgradeNeeded).toBe(true);
  });
});

describe('EVEMS tool — load schedule (#199, ruling 2026-11-13)', () => {
  const row = (s: NonNullable<ReturnType<typeof calculateEVEMSLoadManagement>['loadSchedule']>[number]) => ({
    other: +s.otherLoads_kVA.toFixed(2),
    ev: +s.evCharging_kVA.toFixed(3),
    adder: +s.continuousAdder_kVA.toFixed(3),
    util: +s.utilizationPercent.toFixed(1),
    avail: +s.availableCapacity_kVA.toFixed(2),
  });

  it('caps each slot at the setpoint and includes the 25% adder (4 chargers)', () => {
    const r = calculateEVEMSLoadManagement(base({ qty: 4, useEVEMS: true }));
    expect(r.loadSchedule!.map(row)).toEqual([
      { other: 24, ev: 15.36, adder: 3.84, util: 90, avail: 4.8 },
      { other: 14.4, ev: 17.28, adder: 4.32, util: 75, avail: 12 },
      { other: 24, ev: 17.28, adder: 4.32, util: 95, avail: 2.4 },
    ]);
  });

  it('uses the time-of-day share when it is below the setpoint (2 chargers)', () => {
    const r = calculateEVEMSLoadManagement(base({ qty: 2, useEVEMS: true }));
    expect(r.loadSchedule!.map(row)).toEqual([
      { other: 24, ev: 7.68, adder: 1.92, util: 70, avail: 14.4 },
      { other: 14.4, ev: 13.824, adder: 3.456, util: 66, avail: 16.32 },
      { other: 24, ev: 10.752, adder: 2.688, util: 78, avail: 10.56 },
    ]);
  });

  it('never shows a slot above the result card', () => {
    for (const qty of [1, 2, 4, 12]) {
      for (const existingDemand_kVA of [10, 24, 30, 40]) {
        const r = calculateEVEMSLoadManagement(base({ qty, useEVEMS: true, existingDemand_kVA }));
        for (const s of r.loadSchedule!) {
          expect(s.evCharging_kVA).toBeLessThanOrEqual(r.evDemandLoad_kVA + 1e-9);
          expect(s.utilizationPercent).toBeLessThanOrEqual(r.serviceUtilizationPercent + 0.05);
        }
      }
    }
  });
});

describe('EVEMS tool — max chargers with EVEMS (#202, owner decision 2026-11-14)', () => {
  const text = (r: ReturnType<typeof calculateEVEMSLoadManagement>) =>
    [...r.evemsRecommendations.notes, ...r.compliance.warnings].join(' | ');

  it('counts chargers at the 12 A minimum under the largest setpoint, whatever the quantity', () => {
    for (const [qty, useEVEMS] of [[2, false], [2, true], [7, true]] as const) {
      const r = calculateEVEMSLoadManagement(base({ qty, useEVEMS }));
      expect(r.maxChargersWithoutEVEMS).toBe(2); // 24 ÷ 9.6
      expect(r.maxChargersWithEVEMS).toBe(6); // 17.28 kVA = 72 A ÷ 12 A
      expect(r.evemsMinChargingAmps).toBe(12);
    }
  });

  it('shows the current each charger gets, and warns below 12 A', () => {
    const cases: Array<[number, string, boolean]> = [
      [2, '64.0 A shared by 2 chargers: 32.0 A each', false],
      [4, '72.0 A shared by 4 chargers: 18.0 A each', false],
      [6, '72.0 A shared by 6 chargers: 12.0 A each', false],
      [7, '72.0 A shared by 7 chargers: 10.3 A each', true],
    ];
    for (const [qty, note, warn] of cases) {
      const r = calculateEVEMSLoadManagement(base({ qty, useEVEMS: true }));
      expect(text(r)).toContain(note);
      expect(/below the 12 A minimum/.test(text(r))).toBe(warn);
      expect(r.compliance.compliant).toBe(true); // advice only
    }
    expect(text(calculateEVEMSLoadManagement(base({ qty: 7, useEVEMS: true }))))
      .toContain('supports up to 6 chargers at 12 A');
  });

  it('shows "Consider EVEMS" only when EVEMS is off', () => {
    expect(text(calculateEVEMSLoadManagement(base({ qty: 2 })))).toContain('Consider EVEMS');
    expect(text(calculateEVEMSLoadManagement(base({ qty: 2, useEVEMS: true })))).not.toContain('Consider EVEMS');
  });

  it('converts the setpoint with √3 for a 3-phase charger', () => {
    const c = { level: 'Level2' as const, voltage: 208, phase: 3 as const, chargerAmps: 32, quantity: 1 };
    const r = calculateEVEMSLoadManagement(base({ evChargers: [c] }));
    expect(r.maxChargersWithEVEMS).toBe(3); // 17,280 ÷ (√3 × 208) = 47.96 A ÷ 12 A
  });
});
