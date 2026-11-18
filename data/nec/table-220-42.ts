import { OccupancyLightingDemand } from '../../types/nec-types';
import type { NecEdition } from './evse-load';
import { article220Citations } from './article220-citations';

/**
 * General lighting demand factors: NEC 2020 Table 220.42, NEC 2023 Table
 * 220.45 (#237). The citation comes from the edition; the rows are the same.
 *
 * Only the rows the app reads (#236): dwelling units (the same tiers as the
 * Part III walk in residentialLoad.ts, PE ruling #155) and "All others"
 * (100%, every non-dwelling occupancy, #218). The hotel / warehouse / store
 * rows were removed: nothing read them, and they didn't match the table.
 * Add a row only from the code book, with a pinned test.
 */
export const TABLE_220_42: OccupancyLightingDemand[] = [
  {
    occupancyType: 'dwelling',
    tiers: [
      { upTo: 3000, factor: 1.0 },     // first 3,000 VA at 100%
      { upTo: 120000, factor: 0.35 },  // 3,001 to 120,000 VA at 35%
      { upTo: Infinity, factor: 0.25 }, // over 120,000 VA at 25%
    ],
    row: 'Dwelling Units'
  },
  {
    // The table's catch-all row: every occupancy it doesn't list (offices,
    // stores, industrial, common areas). There is no "office" row (#218).
    occupancyType: 'all_others',
    tiers: [{ upTo: Infinity, factor: 1.0 }], // total volt-amperes at 100%
    row: 'All others'
  },
];

/**
 * Get lighting demand factor for a given occupancy type and total VA
 *
 * @param occupancyType - 'dwelling' or 'all_others'
 * @param totalVA - Total connected lighting load in VA
 * @returns Object with demand VA, demand factor, and NEC reference
 */
export function getLightingDemandFactor(occupancyType: string, totalVA: number, edition: NecEdition): {
  demandVA: number;
  demandFactor: number;
  necReference: string;
} {
  const table = article220Citations(edition).lightingDemandTable;
  const entry = TABLE_220_42.find(e => e.occupancyType === occupancyType);
  if (!entry) {
    // Default to 100% demand if not found
    return { demandVA: totalVA, demandFactor: 1.0, necReference: `${table} (Default - No Demand Factor)` };
  }
  let demandVA = 0;
  let from = 0;
  for (const tier of entry.tiers) {
    if (totalVA <= from) break;
    demandVA += (Math.min(totalVA, tier.upTo) - from) * tier.factor;
    from = tier.upTo;
  }
  return {
    demandVA,
    demandFactor: totalVA > 0 ? demandVA / totalVA : entry.tiers[0]!.factor,
    necReference: `${table} (${entry.row})`,
  };
}
