/**
 * #258: Chapter 9 Table 9 R and XL match the NEC 2023 book (p. 70-726, NFPA
 * text in the Obsidian vault; each imperial row checked against its metric
 * row × 0.3048). Columns: XL (PVC and aluminum conduit), XL (steel),
 * R Cu (PVC, aluminum, steel), R Al (PVC, aluminum, steel), ohms per 1000 ft.
 * Before: XL low in 62 of 82 rows (12 AWG PVC 0.042 vs 0.054; steel carried
 * the PVC column), steel R reused PVC's, and no aluminum-conduit rows.
 */
import { describe, it, expect } from 'vitest';
import { CHAPTER_9_TABLE_9, getConductorImpedance } from '../data/nec/table-chapter9-table9';
import { calculateVoltageDropAC } from '../services/calculations/voltageDrop';

type Row = [string, number, number, (number | null)[], (number | null)[]];
const BOOK: Row[] = [
  ['14 AWG', 0.058, 0.073, [3.1, 3.1, 3.1], [null, null, null]],
  ['12 AWG', 0.054, 0.068, [2.0, 2.0, 2.0], [3.2, 3.2, 3.2]],
  ['10 AWG', 0.05, 0.063, [1.2, 1.2, 1.2], [2.0, 2.0, 2.0]],
  ['8 AWG', 0.052, 0.065, [0.78, 0.78, 0.78], [1.3, 1.3, 1.3]],
  ['6 AWG', 0.051, 0.064, [0.49, 0.49, 0.49], [0.81, 0.81, 0.81]],
  ['4 AWG', 0.048, 0.06, [0.31, 0.31, 0.31], [0.51, 0.51, 0.51]],
  ['3 AWG', 0.047, 0.059, [0.25, 0.25, 0.25], [0.4, 0.41, 0.4]],
  ['2 AWG', 0.045, 0.057, [0.19, 0.2, 0.2], [0.32, 0.32, 0.32]],
  ['1 AWG', 0.046, 0.057, [0.15, 0.16, 0.16], [0.25, 0.26, 0.25]],
  ['1/0 AWG', 0.044, 0.055, [0.12, 0.13, 0.12], [0.2, 0.21, 0.2]],
  ['2/0 AWG', 0.043, 0.054, [0.1, 0.1, 0.1], [0.16, 0.16, 0.16]],
  ['3/0 AWG', 0.042, 0.052, [0.077, 0.082, 0.079], [0.13, 0.13, 0.13]],
  ['4/0 AWG', 0.041, 0.051, [0.062, 0.067, 0.063], [0.1, 0.11, 0.1]],
  ['250 kcmil', 0.041, 0.052, [0.052, 0.057, 0.054], [0.085, 0.09, 0.086]],
  ['300 kcmil', 0.041, 0.051, [0.044, 0.049, 0.045], [0.071, 0.076, 0.072]],
  ['350 kcmil', 0.04, 0.05, [0.038, 0.043, 0.039], [0.061, 0.066, 0.063]],
  ['400 kcmil', 0.04, 0.049, [0.033, 0.038, 0.035], [0.054, 0.059, 0.055]],
  ['500 kcmil', 0.039, 0.048, [0.027, 0.032, 0.029], [0.043, 0.048, 0.045]],
  ['600 kcmil', 0.039, 0.048, [0.023, 0.028, 0.025], [0.036, 0.041, 0.038]],
  ['750 kcmil', 0.038, 0.048, [0.019, 0.024, 0.021], [0.029, 0.034, 0.031]],
  ['1000 kcmil', 0.037, 0.046, [0.015, 0.019, 0.018], [0.023, 0.027, 0.025]],
];

describe('#258 Table 9 matches the book', () => {
  it('every R and XL, Cu and Al, PVC / aluminum / steel conduit', () => {
    const expected = BOOK.flatMap(([size, xlPvc, xlSteel, rCu, rAl]) =>
      (['Cu', 'Al'] as const).flatMap(material =>
        (['PVC', 'Aluminum', 'Steel'] as const).flatMap((conduitType, i) => {
          const r = (material === 'Cu' ? rCu : rAl)[i];
          return r === null ? [] : [{ size, material, conduitType, r, xl: conduitType === 'Steel' ? xlSteel : xlPvc }];
        })));
    const stored = CHAPTER_9_TABLE_9.map(e => ({ size: e.size, material: e.material, conduitType: e.conduitType, r: e.resistanceOhmsPerKFt, xl: e.reactanceXLOhmsPerKFt }));
    expect(stored.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
      .toEqual(expected.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    expect(stored).toHaveLength(123); // 21 Cu + 20 Al sizes × 3 conduit types
  });

  it('aluminum conduit has rows (it returned 0 V before)', () => {
    expect(getConductorImpedance('1000 kcmil', 'Cu', 'Aluminum')).toMatchObject({ resistanceOhmsPerKFt: 0.019, reactanceXLOhmsPerKFt: 0.037 });
  });

  it('voltage drop with the book values (hand calcs, 0.85 PF)', () => {
    // 750 Cu PVC: Ze = 0.019·0.85 + 0.038·0.5268 = 0.03617; √3·400·100·Ze/1000 = 2.51 V (was 2.36)
    expect(calculateVoltageDropAC('750 kcmil', 'Cu', 'PVC', 100, 400, 480, 3).voltageDropVolts).toBe(2.51);
    // 1000 Cu steel: Ze = 0.018·0.85 + 0.046·0.5268 = 0.03953 → 2.74 V (was 2.34)
    expect(calculateVoltageDropAC('1000 kcmil', 'Cu', 'Steel', 100, 400, 480, 3).voltageDropVolts).toBe(2.74);
    // 1000 Cu aluminum conduit: Ze = 0.019·0.85 + 0.037·0.5268 = 0.03564 → 2.47 V (was 0 V, no data)
    expect(calculateVoltageDropAC('1000 kcmil', 'Cu', 'Aluminum', 100, 400, 480, 3).voltageDropVolts).toBe(2.47);
  });
});
