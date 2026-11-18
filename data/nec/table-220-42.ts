import { OccupancyLightingDemand } from '../../types/nec-types';

/**
 * NEC Table 220.42 - Lighting Load Demand Factors (NEC 2020 numbering;
 * the edition question is #237)
 *
 * Read today: 'dwelling' and 'all_others'. The hotel / warehouse / store
 * rows don't match the book and nothing reads them (#236) — check them
 * against the code book before wiring any occupancy to them.
 *
 * This table provides demand factors for general lighting loads
 * based on occupancy type. Demand factors reduce the total connected
 * lighting load to account for diversity (not all lights on simultaneously).
 */
export const TABLE_220_42: OccupancyLightingDemand[] = [
  {
    occupancyType: 'dwelling',
    firstVA: 3000,
    firstDemand: 1.0, // 100%
    remainderDemand: 0.35, // 35%
    necReference: 'Table 220.42 (Dwelling Units)'
  },
  {
    occupancyType: 'hotel',
    firstVA: 20000,
    firstDemand: 0.50, // 50%
    remainderDemand: 0.40, // 40%
    necReference: 'Table 220.42 (Hotels and Motels)'
  },
  {
    occupancyType: 'warehouse',
    firstVA: Infinity,
    firstDemand: 1.0, // 100% - no demand factor
    remainderDemand: 1.0,
    necReference: 'Table 220.42 (Warehouses - Storage)'
  },
  {
    // The table's catch-all row: every occupancy it doesn't list (offices,
    // stores, industrial, common areas). There is no "office" row (#218).
    occupancyType: 'all_others',
    firstVA: Infinity,
    firstDemand: 1.0, // 100% - total volt-amperes
    remainderDemand: 1.0,
    necReference: 'Table 220.42 (All others)'
  },
  {
    occupancyType: 'store',
    firstVA: 12500,
    firstDemand: 1.0, // 100%
    remainderDemand: 0.50, // 50%
    necReference: 'Table 220.42 (Stores)'
  }
];

/**
 * Get lighting demand factor for a given occupancy type and total VA
 *
 * @param occupancyType - Type of occupancy (dwelling, all_others, hotel, warehouse, store)
 * @param totalVA - Total connected lighting load in VA
 * @returns Object with demand VA, demand factor, and NEC reference
 */
export function getLightingDemandFactor(occupancyType: string, totalVA: number): {
  demandVA: number;
  demandFactor: number;
  necReference: string;
} {
  const entry = TABLE_220_42.find(e => e.occupancyType === occupancyType);
  if (!entry) {
    // Default to 100% demand if not found
    return { demandVA: totalVA, demandFactor: 1.0, necReference: 'Table 220.42 (Default - No Demand Factor)' };
  }

  if (totalVA <= entry.firstVA) {
    return {
      demandVA: totalVA * entry.firstDemand,
      demandFactor: entry.firstDemand,
      necReference: entry.necReference
    };
  } else {
    const firstPortion = entry.firstVA * entry.firstDemand;
    const remainder = (totalVA - entry.firstVA) * entry.remainderDemand;
    return {
      demandVA: firstPortion + remainder,
      demandFactor: (firstPortion + remainder) / totalVA,
      necReference: entry.necReference
    };
  }
}
