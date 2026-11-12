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
    expect(r.maxChargersWithEVEMS).toBe(2);
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
    expect(r23.maxChargersWithEVEMS).toBe(2);

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
