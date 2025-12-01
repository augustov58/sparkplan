/**
 * NEC Conductor Properties
 *
 * Circular mil areas for conductors used in proportional EGC sizing
 * calculations per NEC 250.122(B).
 *
 * Circular Mil (CM) = (diameter in mils)²
 * where 1 mil = 0.001 inches
 *
 * Source: NEC Chapter 9, Table 8 - Conductor Properties
 */

export interface ConductorProperties {
  size: string;
  circularMils: number;
  /** Stranding: 'solid' or 'stranded' */
  stranding: 'solid' | 'stranded';
  /** Area in square inches (for reference) */
  areaSquareInches?: number;
}

/**
 * Circular mil areas for copper and aluminum conductors
 * Used for proportional EGC upsizing calculations
 */
export const CONDUCTOR_CIRCULAR_MILS: Record<string, number> = {
  // AWG sizes (14-1)
  '14': 4110,
  '12': 6530,
  '10': 10380,
  '8': 16510,
  '6': 26240,
  '4': 41740,
  '3': 52620,
  '2': 66360,
  '1': 83690,

  // 0 AWG sizes (1/0 - 4/0)
  '1/0': 105600,
  '2/0': 133100,
  '3/0': 167800,
  '4/0': 211600,

  // kcmil sizes (250-1000)
  '250': 250000,
  '300': 300000,
  '350': 350000,
  '400': 400000,
  '500': 500000,
  '600': 600000,
  '700': 700000,
  '750': 750000,
  '800': 800000,
  '900': 900000,
  '1000': 1000000,
};

/**
 * Standard conductor sizes in order from smallest to largest
 */
export const STANDARD_CONDUCTOR_SIZES = [
  '14', '12', '10', '8', '6', '4', '3', '2', '1',
  '1/0', '2/0', '3/0', '4/0',
  '250', '300', '350', '400', '500', '600', '700', '750', '800', '900', '1000'
] as const;

export type ConductorSize = typeof STANDARD_CONDUCTOR_SIZES[number];

/**
 * Get circular mil area for a conductor size
 * @param size - Conductor size (e.g., '12', '1/0', '250')
 * @returns Circular mil area, or null if size not found
 */
export function getCircularMils(size: string): number | null {
  const normalizedSize = size.trim();
  return CONDUCTOR_CIRCULAR_MILS[normalizedSize] ?? null;
}

/**
 * Find the next larger standard conductor size
 * @param currentSize - Current conductor size
 * @returns Next larger size, or null if at maximum
 */
export function getNextLargerSize(currentSize: string): string | null {
  const index = STANDARD_CONDUCTOR_SIZES.indexOf(currentSize as ConductorSize);
  if (index === -1 || index === STANDARD_CONDUCTOR_SIZES.length - 1) {
    return null;
  }
  return STANDARD_CONDUCTOR_SIZES[index + 1];
}

/**
 * Find the nearest standard conductor size equal to or larger than target circular mils
 * Used for proportional EGC upsizing
 * @param targetCircularMils - Target circular mil area
 * @returns Standard conductor size that meets or exceeds target
 */
export function findConductorSizeByCircularMils(targetCircularMils: number): string | null {
  for (const size of STANDARD_CONDUCTOR_SIZES) {
    const cm = CONDUCTOR_CIRCULAR_MILS[size];
    if (cm >= targetCircularMils) {
      return size;
    }
  }
  // If target exceeds 1000 kcmil, return largest available
  return '1000';
}

/**
 * Compare two conductor sizes
 * @returns -1 if a < b, 0 if equal, 1 if a > b, null if either size invalid
 */
export function compareConductorSizes(a: string, b: string): number | null {
  const indexA = STANDARD_CONDUCTOR_SIZES.indexOf(a as ConductorSize);
  const indexB = STANDARD_CONDUCTOR_SIZES.indexOf(b as ConductorSize);

  if (indexA === -1 || indexB === -1) {
    return null;
  }

  if (indexA < indexB) return -1;
  if (indexA > indexB) return 1;
  return 0;
}

/**
 * Calculate proportional circular mil area based on size increase
 * Used for EGC proportional upsizing per NEC 250.122(B)
 *
 * Formula: New CM = Base CM × (New Phase CM / Base Phase CM)
 *
 * @param baseEgcSize - Original EGC size from Table 250.122
 * @param basePhaseConductorSize - Phase conductor size used in table lookup
 * @param actualPhaseConductorSize - Actual phase conductor size installed
 * @returns Required EGC size after proportional adjustment
 */
export function calculateProportionalEgcSize(
  baseEgcSize: string,
  basePhaseConductorSize: string,
  actualPhaseConductorSize: string
): string | null {
  const baseEgcCm = getCircularMils(baseEgcSize);
  const basePhaseCm = getCircularMils(basePhaseConductorSize);
  const actualPhaseCm = getCircularMils(actualPhaseConductorSize);

  if (!baseEgcCm || !basePhaseCm || !actualPhaseCm) {
    return null;
  }

  // If actual phase conductor same as base, no adjustment needed
  if (actualPhaseConductorSize === basePhaseConductorSize) {
    return baseEgcSize;
  }

  // Calculate proportional EGC circular mils
  const proportionalEgcCm = baseEgcCm * (actualPhaseCm / basePhaseCm);

  // Find standard conductor size that meets or exceeds required CM
  return findConductorSizeByCircularMils(proportionalEgcCm);
}
