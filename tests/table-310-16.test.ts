/**
 * NEC Table 310.16 data checks.
 *
 * Every stored row is pinned to NEC Table 310.16 as printed in the NEC 2023
 * code book (same values in NEC 2020). Four rows were once stored above the
 * code value (unsafe) and six aluminum cells below it.
 */

import { describe, it, expect } from 'vitest';
import { getAmpacity, findConductorByAmpacity, TABLE_310_16 } from '../data/nec/table-310-16';

// [size, 60°C, 75°C, 90°C] from the code book.
const CODE_BOOK_CU: [string, number, number, number][] = [
  ['14 AWG', 15, 20, 25], ['12 AWG', 20, 25, 30], ['10 AWG', 30, 35, 40], ['8 AWG', 40, 50, 55],
  ['6 AWG', 55, 65, 75], ['4 AWG', 70, 85, 95], ['3 AWG', 85, 100, 115], ['2 AWG', 95, 115, 130],
  ['1 AWG', 110, 130, 145], ['1/0 AWG', 125, 150, 170], ['2/0 AWG', 145, 175, 195],
  ['3/0 AWG', 165, 200, 225], ['4/0 AWG', 195, 230, 260], ['250 kcmil', 215, 255, 290],
  ['300 kcmil', 240, 285, 320], ['350 kcmil', 260, 310, 350], ['400 kcmil', 280, 335, 380],
  ['500 kcmil', 320, 380, 430], ['600 kcmil', 350, 420, 475], ['750 kcmil', 400, 475, 535],
  ['1000 kcmil', 455, 545, 615],
];
const CODE_BOOK_AL: [string, number, number, number][] = [
  ['12 AWG', 15, 20, 25], ['10 AWG', 25, 30, 35], ['8 AWG', 35, 40, 45], ['6 AWG', 40, 50, 55],
  ['4 AWG', 55, 65, 75], ['3 AWG', 65, 75, 85], ['2 AWG', 75, 90, 100], ['1 AWG', 85, 100, 115],
  ['1/0 AWG', 100, 120, 135], ['2/0 AWG', 115, 135, 150], ['3/0 AWG', 130, 155, 175],
  ['4/0 AWG', 150, 180, 205], ['250 kcmil', 170, 205, 230], ['300 kcmil', 195, 230, 260],
  ['350 kcmil', 210, 250, 280], ['400 kcmil', 225, 270, 305], ['500 kcmil', 260, 310, 350],
  ['600 kcmil', 285, 340, 385], ['750 kcmil', 320, 385, 435], ['1000 kcmil', 375, 445, 500],
];

describe('NEC Table 310.16 ampacities', () => {
  it('every stored row matches the code book', () => {
    const expected = [
      ...CODE_BOOK_CU.map(([size, t60, t75, t90]) => ({ size, material: 'Cu', temp60C: t60, temp75C: t75, temp90C: t90 })),
      ...CODE_BOOK_AL.map(([size, t60, t75, t90]) => ({ size, material: 'Al', temp60C: t60, temp75C: t75, temp90C: t90 })),
    ];
    expect(TABLE_310_16).toEqual(expected);
  });

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
