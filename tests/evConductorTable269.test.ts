/**
 * #269: the EV Charging calculator sizes its conductor (rated for the breaker)
 * from Table 310.16 in data/nec at the NEC 110.14(C) column the conductor
 * sizing service uses: 60 °C for ≤ 100 A, 75 °C above. Past one conductor,
 * parallel sets (310.10(G)). Its inline list matched neither column from 1/0
 * up and stopped at 500 kcmil.
 *
 * Hand calcs (Table 310.16, Cu): 60 °C 6 AWG 55 / 4 AWG 70 / 1 AWG 110;
 * 75 °C 2/0 175, 250 kcmil 255, 500 kcmil 380, 600 kcmil 420, 1000 kcmil 545,
 * 350 kcmil 310 (× 2 = 620).
 */
import { describe, it, expect } from 'vitest';
import { sizeEvConductor, calculateEVCharging } from '../services/calculations/evCharging';

describe('#269 EV conductor sizing', () => {
  it('≤ 100 A uses the 60 °C column (unchanged)', () => {
    expect(sizeEvConductor(60, 'Cu')).toEqual({ size: '4 AWG', sets: 1 });   // 6 AWG 55 A < 60
    expect(sizeEvConductor(100, 'Cu')).toEqual({ size: '1 AWG', sets: 1 });  // 110 A
  });

  it('> 100 A uses the 75 °C column', () => {
    expect(sizeEvConductor(175, 'Cu')).toEqual({ size: '2/0 AWG', sets: 1 });   // was 3/0
    expect(sizeEvConductor(250, 'Cu')).toEqual({ size: '250 kcmil', sets: 1 }); // was 300 kcmil
    expect(sizeEvConductor(400, 'Cu')).toEqual({ size: '600 kcmil', sets: 1 }); // was 500 kcmil (380 A)
  });

  it('past 1000 kcmil: parallel sets', () => {
    expect(sizeEvConductor(600, 'Cu')).toEqual({ size: '350 kcmil', sets: 2 }); // 2 × 310 = 620 A; was 500 kcmil (380 A)
  });

  it('the 350 kW preset prints 2 parallel sets on its 600 A breaker', () => {
    const r = calculateEVCharging({
      chargerLevel: 'Level3_DCFC', chargerAmps: 421, voltage: 480, phase: 3, numChargers: 1,
      simultaneousUse: 100, circuitLength_ft: 100, conductorMaterial: 'Cu', necEdition: '2020',
    } as Parameters<typeof calculateEVCharging>[0]);
    expect(r.circuitBreakerAmps).toBe(600);
    expect(r.conductorSize).toBe('2 × 350 kcmil (parallel)');
    expect(r.necReferences.join(' ')).toContain('310.10(G)');
    // VD per set: 12.9 × 100 × 210.5 × √3 / 350,000 = 1.344 V → 0.28% of 480 V
    expect(r.voltageDropPercent).toBeCloseTo(0.28, 2);
  });
});
