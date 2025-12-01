/**
 * NEC Table 250.122 - Minimum Size Equipment Grounding Conductors for Grounding Raceway and Equipment
 *
 * Equipment grounding conductor (EGC) sizing based on overcurrent protective device rating
 *
 * Important Notes:
 * - Where phase conductors are increased in size for voltage drop or other reasons,
 *   EGC must be proportionally increased per NEC 250.122(B)
 * - For parallel conductors, see NEC 250.122(F)
 * - Copper conductors shown; for aluminum, consult NEC Table 250.122
 *
 * Source: NEC 2023, Table 250.122
 */

export interface EgcSizeEntry {
  /** Maximum OCPD rating in amperes */
  maxOcpdRating: number;
  /** Minimum copper EGC size */
  copperEgcSize: string;
  /** Minimum aluminum EGC size */
  aluminumEgcSize: string;
}

/**
 * NEC Table 250.122 - Equipment Grounding Conductor Sizing
 * Based on overcurrent protective device (OCPD) rating
 */
export const TABLE_250_122: EgcSizeEntry[] = [
  { maxOcpdRating: 15, copperEgcSize: '14', aluminumEgcSize: '12' },
  { maxOcpdRating: 20, copperEgcSize: '12', aluminumEgcSize: '10' },
  { maxOcpdRating: 30, copperEgcSize: '10', aluminumEgcSize: '8' },
  { maxOcpdRating: 40, copperEgcSize: '10', aluminumEgcSize: '8' },
  { maxOcpdRating: 60, copperEgcSize: '10', aluminumEgcSize: '8' },
  { maxOcpdRating: 100, copperEgcSize: '8', aluminumEgcSize: '6' },
  { maxOcpdRating: 200, copperEgcSize: '6', aluminumEgcSize: '4' },
  { maxOcpdRating: 300, copperEgcSize: '4', aluminumEgcSize: '2' },
  { maxOcpdRating: 400, copperEgcSize: '3', aluminumEgcSize: '1' },
  { maxOcpdRating: 500, copperEgcSize: '2', aluminumEgcSize: '1/0' },
  { maxOcpdRating: 600, copperEgcSize: '1', aluminumEgcSize: '2/0' },
  { maxOcpdRating: 800, copperEgcSize: '1/0', aluminumEgcSize: '3/0' },
  { maxOcpdRating: 1000, copperEgcSize: '2/0', aluminumEgcSize: '4/0' },
  { maxOcpdRating: 1200, copperEgcSize: '3/0', aluminumEgcSize: '250' },
  { maxOcpdRating: 1600, copperEgcSize: '4/0', aluminumEgcSize: '350' },
  { maxOcpdRating: 2000, copperEgcSize: '250', aluminumEgcSize: '400' },
  { maxOcpdRating: 2500, copperEgcSize: '350', aluminumEgcSize: '600' },
  { maxOcpdRating: 3000, copperEgcSize: '400', aluminumEgcSize: '600' },
  { maxOcpdRating: 4000, copperEgcSize: '500', aluminumEgcSize: '750' },
  { maxOcpdRating: 5000, copperEgcSize: '700', aluminumEgcSize: '1000' },
  { maxOcpdRating: 6000, copperEgcSize: '800', aluminumEgcSize: '1000' },
];

/**
 * Get minimum EGC size based on overcurrent device rating
 * Per NEC 250.122(A) - Base table lookup
 *
 * @param ocpdRating - Overcurrent protective device rating in amperes
 * @param material - Conductor material ('Cu' for copper, 'Al' for aluminum)
 * @returns Minimum EGC size
 *
 * @example
 * getEgcSize(100, 'Cu') // Returns '8' (8 AWG copper)
 * getEgcSize(200, 'Al') // Returns '4' (4 AWG aluminum)
 */
export function getEgcSize(ocpdRating: number, material: 'Cu' | 'Al'): string {
  // Find the first entry where OCPD rating is less than or equal to the table value
  for (const entry of TABLE_250_122) {
    if (ocpdRating <= entry.maxOcpdRating) {
      return material === 'Cu' ? entry.copperEgcSize : entry.aluminumEgcSize;
    }
  }

  // If OCPD exceeds table, return largest available size
  const lastEntry = TABLE_250_122[TABLE_250_122.length - 1];
  return material === 'Cu' ? lastEntry.copperEgcSize : lastEntry.aluminumEgcSize;
}

/**
 * Get EGC size with detailed calculation info
 * Includes NEC references and warnings
 *
 * @param ocpdRating - Overcurrent protective device rating in amperes
 * @param material - Conductor material
 * @returns Detailed EGC sizing result
 */
export function getEgcSizeDetailed(
  ocpdRating: number,
  material: 'Cu' | 'Al'
): {
  egcSize: string;
  tableEntry: EgcSizeEntry | null;
  necReference: string;
  notes: string[];
} {
  const notes: string[] = [];

  // Find matching table entry
  const tableEntry = TABLE_250_122.find(entry => ocpdRating <= entry.maxOcpdRating) || null;

  if (!tableEntry) {
    // OCPD exceeds table maximum
    const lastEntry = TABLE_250_122[TABLE_250_122.length - 1];
    notes.push(`⚠️ OCPD rating (${ocpdRating}A) exceeds NEC Table 250.122 maximum (${lastEntry.maxOcpdRating}A). Engineering judgment required.`);
    return {
      egcSize: material === 'Cu' ? lastEntry.copperEgcSize : lastEntry.aluminumEgcSize,
      tableEntry: lastEntry,
      necReference: 'NEC 250.122(A) - Table 250.122',
      notes
    };
  }

  const egcSize = material === 'Cu' ? tableEntry.copperEgcSize : tableEntry.aluminumEgcSize;

  return {
    egcSize,
    tableEntry,
    necReference: 'NEC 250.122(A) - Table 250.122',
    notes
  };
}
