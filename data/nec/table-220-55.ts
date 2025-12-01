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
