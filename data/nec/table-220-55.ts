import { RangeDemand } from '../../types/nec-types';

/**
 * NEC Table 220.55 - Electric Range and Cooking Appliance Demand Factors
 * Column C (for ranges not over 12 kW rating)
 * 2023 NEC Edition
 *
 * This table provides demand factors for household electric cooking appliances.
 * The demand factors account for diversity - not all ranges operate at full
 * capacity simultaneously.
 */
export const TABLE_220_55: RangeDemand[] = [
  { numberOfRanges: 1, demandKW: 8, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 2, demandKW: 11, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 3, demandKW: 14, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 4, demandKW: 17, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 5, demandKW: 20, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 6, demandKW: 21, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 7, demandKW: 22, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 8, demandKW: 23, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 9, demandKW: 24, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 10, demandKW: 25, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 11, demandKW: 26, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 12, demandKW: 27, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 13, demandKW: 28, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 14, demandKW: 29, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 15, demandKW: 30, necReference: 'Table 220.55 Column C' },
  // 16-20: 15 kW + 1 kW per range
  { numberOfRanges: 16, demandKW: 31, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 17, demandKW: 32, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 18, demandKW: 33, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 19, demandKW: 34, necReference: 'Table 220.55 Column C' },
  { numberOfRanges: 20, demandKW: 35, necReference: 'Table 220.55 Column C' }
];

/**
 * Get range demand for a given number of ranges
 *
 * @param numberOfRanges - Number of household electric ranges
 * @returns Object with number of ranges, demand kW, and NEC reference
 */
export function getRangeDemand(numberOfRanges: number): RangeDemand {
  const entry = TABLE_220_55.find(e => e.numberOfRanges === numberOfRanges);
  if (entry) return entry;

  // For more than 20 ranges: 15 kW + 1 kW per range
  if (numberOfRanges > 20) {
    return {
      numberOfRanges,
      demandKW: 15 + numberOfRanges,
      necReference: 'Table 220.55 Column C (extrapolated)'
    };
  }

  // Default to 1 range if invalid input
  return { numberOfRanges: 1, demandKW: 8, necReference: 'Table 220.55 Column C (default)' };
}

/** Table 220.55 covers household cooking appliances rated over 1¾ kW. */
export const COOKING_APPLIANCE_TABLE_MIN_VA = 1750;
const COLUMN_C_MAX_RATING_VA = 12_000;
const NOTE_1_MAX_RATING_VA = 27_000;
const NOTE_1_INCREASE_PER_KW = 0.05;

/**
 * Demand for the household cooking appliances of a dwelling feeder, by
 * Column C — used in all cases (Note 3's Column A/B option is not taken;
 * PE ruling 2026-10-26, #155).
 *
 * - All rated 12 kW or less: Column C for the count.
 * - Any over 12 kW (Notes 1–2): average rating, counting each appliance under
 *   12 kW as 12 kW; Column C raised 5% per kW or major fraction the average
 *   exceeds 12 kW.
 * - Any over 27 kW is outside the table: nameplate sum, with a warning.
 *
 * Callers pass only appliances rated over 1¾ kW.
 */
export function getCookingDemandVA(ratingsVA: number[]): {
  demandVA: number;
  necReference: string;
  warnings: string[];
} {
  const count = ratingsVA.length;
  if (count === 0) return { demandVA: 0, necReference: 'Table 220.55 Column C', warnings: [] };
  const columnC_VA = getRangeDemand(count).demandKW * 1000;
  const maxRatingVA = Math.max(...ratingsVA);

  if (maxRatingVA > NOTE_1_MAX_RATING_VA) {
    return {
      demandVA: ratingsVA.reduce((a, b) => a + b, 0),
      necReference: 'NEC 220.55 (over 27 kW — nameplate)',
      warnings: ['WARNING: A cooking appliance over 27 kW is outside Table 220.55; taken at nameplate.'],
    };
  }
  if (maxRatingVA <= COLUMN_C_MAX_RATING_VA) {
    return { demandVA: columnC_VA, necReference: 'Table 220.55 Column C', warnings: [] };
  }

  const averageVA = ratingsVA.reduce((sum, va) => sum + Math.max(va, COLUMN_C_MAX_RATING_VA), 0) / count;
  const excessKW = (averageVA - COLUMN_C_MAX_RATING_VA) / 1000;
  // "each kilowatt or major fraction thereof"
  const steps = Math.floor(excessKW) + (excessKW % 1 > 0.5 ? 1 : 0);
  return {
    demandVA: Math.round(columnC_VA * (1 + NOTE_1_INCREASE_PER_KW * steps)),
    necReference: `Table 220.55 Column C, Note ${count > 1 ? '2' : '1'} (+${steps * 5}%)`,
    warnings: [],
  };
}
