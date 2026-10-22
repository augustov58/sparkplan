/**
 * Generated dwelling branch circuits (Dwelling Calculator → panel schedule).
 *
 * PE decision 2026-10-21: the conductor comes from the shared
 * `sizeConductor` at 60 °C copper (NEC 110.14(C)(1)(a) default, NM-B's limit
 * per 334.80) with ampacity ≥ the breaker — no 240.4(B) next size up.
 * Breakers round up to a 240.6(A) standard size (no 55 / 65 / 75 A).
 */
import { describe, it, expect } from 'vitest';
import {
  dwellingBranchConductorSize,
  generateResidentialPanelSchedule,
} from '../services/calculations/residentialLoad';
import { isStandardBreakerSize } from '../data/nec/standard-breakers';

describe('dwellingBranchConductorSize (60 °C Cu, ampacity ≥ breaker)', () => {
  it.each([
    [15, '14 AWG'],
    [20, '12 AWG'],
    [30, '10 AWG'],
    [40, '8 AWG'],
    [50, '6 AWG'], // 55 A
    [60, '4 AWG'], // 6 AWG is 55 A at 60 °C — the old helper's answer
    [70, '4 AWG'],
    [100, '1 AWG'], // 3 AWG is 85 A at 60 °C — the old helper's answer
    [125, '1/0 AWG'],
    [150, '3/0 AWG'], // the old helper returned 1 AWG for anything over 100 A
  ])('%i A breaker → %s', (breakerAmps, size) => {
    expect(dwellingBranchConductorSize(breakerAmps)).toBe(size);
  });
});

describe('generated breakers are 240.6(A) standard sizes', () => {
  it('12 kW electric heat: 50 A × 1.25 = 62.5 A → 70 A (was 65 A)', () => {
    const circuits = generateResidentialPanelSchedule({
      squareFootage: 2000,
      smallApplianceCircuits: 2,
      laundryCircuit: true,
      appliances: { hvac: { enabled: true, type: 'electric_heat', heatingKw: 12, coolingKw: 0 } },
    } as Parameters<typeof generateResidentialPanelSchedule>[0]);
    const heat = circuits.find(c => c.description === 'Electric Heat / Heat Pump')!;
    expect(heat.breakerAmps).toBe(70);
  });

  it('every circuit for a fully loaded dwelling is a standard size', () => {
    const circuits = generateResidentialPanelSchedule({
      squareFootage: 3000,
      smallApplianceCircuits: 2,
      laundryCircuit: true,
      appliances: {
        range: { enabled: true, type: 'electric', kw: 12 },
        dryer: { enabled: true, type: 'electric', kw: 5 },
        waterHeater: { enabled: true, type: 'electric', kw: 5.5 },
        hvac: { enabled: true, type: 'heat_pump', coolingKw: 5.2, heatingKw: 15 },
        evCharger: { enabled: true, kw: 9.6, level: 2 },
        poolPump: { enabled: true, hp: 2 },
        poolHeater: { enabled: true, kw: 11 },
        hotTub: { enabled: true, kw: 6.5 },
        wellPump: { enabled: true, hp: 1.5 },
        otherAppliances: [{ description: 'Shop heater', kw: 13, voltage: 240, continuous: true }],
      },
    } as Parameters<typeof generateResidentialPanelSchedule>[0]);
    const nonStandard = circuits.filter(c => !isStandardBreakerSize(c.breakerAmps)).map(c => `${c.description}: ${c.breakerAmps} A`);
    expect(nonStandard).toEqual([]);
  });
});
