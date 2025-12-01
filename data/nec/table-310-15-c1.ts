import { BundlingAdjustmentFactor } from '../../types/nec-types';

/**
 * NEC Table 310.15(C)(1) - Adjustment Factors for More Than Three
 * Current-Carrying Conductors in a Raceway or Cable
 * 2023 NEC Edition
 *
 * When more than three current-carrying conductors are installed in the same
 * raceway or cable, the ampacity of each conductor must be reduced. This accounts
 * for heat buildup from multiple conductors in close proximity.
 *
 * Note: Grounding/bonding conductors and neutral conductors that carry only
 * unbalanced current are not counted as current-carrying conductors.
 */
export const TABLE_310_15_C1: BundlingAdjustmentFactor[] = [
  { minConductors: 1, maxConductors: 3, adjustmentFactor: 1.00 },
  { minConductors: 4, maxConductors: 6, adjustmentFactor: 0.80 },
  { minConductors: 7, maxConductors: 9, adjustmentFactor: 0.70 },
  { minConductors: 10, maxConductors: 20, adjustmentFactor: 0.50 },
  { minConductors: 21, maxConductors: 30, adjustmentFactor: 0.45 },
  { minConductors: 31, maxConductors: 40, adjustmentFactor: 0.40 },
  { minConductors: 41, maxConductors: Infinity, adjustmentFactor: 0.35 }
];

/**
 * Get bundling adjustment factor for number of current-carrying conductors
 *
 * @param numConductors - Number of current-carrying conductors in raceway/cable
 * @returns Adjustment factor (multiply by ampacity after temperature correction)
 *
 * @example
 * // For 6 conductors in same conduit:
 * const factor = getBundlingAdjustmentFactor(6); // 0.80
 * // Adjusted ampacity = baseAmpacity * tempCorrection * bundlingFactor
 */
export function getBundlingAdjustmentFactor(numConductors: number): number {
  const entry = TABLE_310_15_C1.find(
    e => numConductors >= e.minConductors && numConductors <= e.maxConductors
  );
  return entry ? entry.adjustmentFactor : 0.35; // Default to most conservative
}
