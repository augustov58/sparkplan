/**
 * EV Charging calculator — EV load at 100% (no EVSE demand factor); the
 * simultaneous-use % is a design assumption outside the NEC load
 * (PE ruling 2026-11-13, #198). Values are the issue's Acceptance section.
 */
import { describe, it, expect } from 'vitest';
import { calculateEVCharging, type EVChargingInput } from '../services/calculations/evCharging';

const base = (over: Partial<EVChargingInput> = {}): EVChargingInput => ({
  chargerLevel: 'Level2',
  chargerAmps: 32,
  voltage: 240,
  phase: 1,
  numChargers: 1,
  simultaneousUse: 100,
  circuitLength_ft: 50,
  conductorMaterial: 'Cu',
  necEdition: '2023',
  ...over,
});

describe('EV Charging calculator — NEC load (#198)', () => {
  it('takes 4 chargers at 100% (the old 4–10 bucket was 95%)', () => {
    const r = calculateEVCharging(base({ numChargers: 4 }));
    expect(r.totalConnectedLoad_kVA).toBe(30.72);
    expect(r.necLoad_kVA).toBe(30.72);
    expect(r.expectedPeak_kVA).toBe(30.72);
    expect(r.necLoadReference).toBe('NEC 220.57(A)');
  });

  it('keeps simultaneous use out of the NEC load, at exactly the entered %', () => {
    const r12 = calculateEVCharging(base({ numChargers: 12, simultaneousUse: 60 }));
    expect(r12.necLoad_kVA).toBe(92.16);
    expect(r12.expectedPeak_kVA).toBe(55.3); // 92.16 × 0.60, no × 0.85

    const r2 = calculateEVCharging(base({ numChargers: 2, simultaneousUse: 50 }));
    expect(r2.necLoad_kVA).toBe(15.36);
    expect(r2.expectedPeak_kVA).toBe(7.68); // 15.36 × 0.50, no × 1.1
  });

  it('applies the 220.57(A) floor under NEC 2023 and not under NEC 2020', () => {
    const l1 = { chargerLevel: 'Level1' as const, voltage: 120, chargerAmps: 16 };
    const r23 = calculateEVCharging(base(l1));
    expect(r23.totalConnectedLoad_kVA).toBe(1.92);
    expect(r23.necLoad_kVA).toBe(7.2);
    expect(r23.expectedPeak_kVA).toBe(1.92);

    const r20 = calculateEVCharging(base({ ...l1, necEdition: '2020' }));
    expect(r20.necLoad_kVA).toBe(1.92);
    expect(r20.necLoadReference).toBe('NEC 220.14(A)');
  });

  it('cites 625.41 / 625.42, never 625.44, and keeps circuit sizing', () => {
    const r = calculateEVCharging(base({ numChargers: 4 }));
    const refs = r.necReferences.join(' | ');
    expect(refs).toContain('NEC 625.41');
    expect(refs).toContain('NEC 625.42');
    expect(refs).not.toContain('625.44');
    expect(r.notes.join(' ')).not.toMatch(/demand factor of/i);
    expect(r.circuitBreakerAmps).toBe(40);
    expect(r.conductorSize).toBe('8 AWG');
    expect(r.egcSize).toBe('10 AWG');
  });
});
