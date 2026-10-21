/**
 * NEC Table 310.16 data checks.
 *
 * Rows below were corrected against NEC Table 310.16 (2020/2023): each was
 * stored ABOVE the code value, the unsafe direction for conductor sizing.
 */

import { describe, it, expect } from 'vitest';
import { getAmpacity, findConductorByAmpacity } from '../data/nec/table-310-16';

describe('NEC Table 310.16 ampacities', () => {
  it('14 AWG Cu is 15 A at 60°C', () => {
    expect(getAmpacity('14 AWG', 'Cu', 60)).toBe(15);
    expect(getAmpacity('14 AWG', 'Cu', 75)).toBe(20);
    expect(getAmpacity('14 AWG', 'Cu', 90)).toBe(25);
  });

  it('12 AWG Al is 15 A at 60°C', () => {
    expect(getAmpacity('12 AWG', 'Al', 60)).toBe(15);
  });

  it('6 AWG Al is 55 A at 90°C', () => {
    expect(getAmpacity('6 AWG', 'Al', 90)).toBe(55);
  });

  it('600 kcmil Cu is 350 A at 60°C', () => {
    expect(getAmpacity('600 kcmil', 'Cu', 60)).toBe(350);
  });

  it('a 20 A load on 60°C terminals needs 12 AWG Cu, not 14 AWG', () => {
    expect(findConductorByAmpacity(20, 'Cu', 60)?.size).toBe('12 AWG');
    expect(findConductorByAmpacity(15, 'Cu', 60)?.size).toBe('14 AWG');
  });
});
