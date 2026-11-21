/**
 * #276: short circuit takes a steel-conduit run's R and XL straight from NEC
 * Chapter 9 Table 9's steel column. That column already includes the steel
 * raceway's effect, so the old "× 1.5 for steel" counted it twice and
 * understated fault current (owner-approved 2026-11-20).
 *
 * Hand calcs (book Table 9, Ω/1000 ft; point-to-point, arithmetic sum):
 * - Service: 500 kVA, 480 V 3Φ, 5.75% → 10,459 A at the transformer;
 *   100 ft of 500 kcmil Cu in steel (R 0.029, XL 0.048) → 8,632 A
 *   (8,089 A with the ×1.5).
 * - 250 kcmil Cu, steel (R 0.054, XL 0.052), 100 ft, 208 V 3Φ, from 30 kA → 10,443 A.
 * - 3/0 Cu, steel (R 0.079, XL 0.052), 50 ft, 240 V 1Φ, from 22 kA → 11,784 A.
 * - 1000 kcmil Cu, steel (R 0.018, XL 0.046), 50 ft, 480 V 3Φ, from 65 kA → 41,158 A.
 * - No conduit factor in PVC or aluminum conduit: 500 kcmil Cu service case,
 *   PVC (R 0.027, XL 0.039) → 8,871 A; aluminum conduit (R 0.032, XL 0.039) → 8,786 A.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateServiceFaultCurrent,
  calculateDownstreamFaultCurrent,
} from '../services/calculations/shortCircuit';

const tx = { kva: 500, primaryVoltage: 12470, secondaryVoltage: 480, impedance: 5.75 };

describe('#276 steel conduit uses Table 9 steel R/XL once', () => {
  it('service entrance, 500 kcmil Cu in steel: 8,632 A', () => {
    const r = calculateServiceFaultCurrent(tx, 480, 3, {
      length: 100, conductorSize: '500 kcmil', material: 'Cu', conduitType: 'Steel', setsInParallel: 1,
    });
    expect(r.faultCurrent).toBeCloseTo(8632.2, 0);
  });

  it('service entrance, same run in PVC: 8,871 A (no conduit factor)', () => {
    const r = calculateServiceFaultCurrent(tx, 480, 3, {
      length: 100, conductorSize: '500 kcmil', material: 'Cu', conduitType: 'PVC', setsInParallel: 1,
    });
    expect(r.faultCurrent).toBeCloseTo(8871.1, 0);
  });

  it('service entrance, same run in aluminum conduit: 8,786 A (no conduit factor)', () => {
    const r = calculateServiceFaultCurrent(tx, 480, 3, {
      length: 100, conductorSize: '500 kcmil', material: 'Cu', conduitType: 'Aluminum', setsInParallel: 1,
    });
    expect(r.faultCurrent).toBeCloseTo(8786.3, 0);
  });

  it.each([
    ['250 kcmil', 100, 208, 3 as const, 30000, 10442.8],
    ['3/0 AWG', 50, 240, 1 as const, 22000, 11783.8],
    ['1000 kcmil', 50, 480, 3 as const, 65000, 41157.7],
  ])('downstream %s Cu in steel, %i ft, %i V', (size, length, voltage, phase, src, expected) => {
    const r = calculateDownstreamFaultCurrent(
      { length, conductorSize: size, material: 'Cu', conduitType: 'Steel', voltage, phase },
      src,
    );
    expect(r.faultCurrent).toBeCloseTo(expected, 0);
  });
});
