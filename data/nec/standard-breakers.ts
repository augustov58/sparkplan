/**
 * NEC 240.6(A) - Standard Ampere Ratings for Fuses and Inverse Time Circuit Breakers
 * 2023 NEC Edition
 *
 * This section specifies the standard current ratings for overcurrent protection devices.
 * When sizing breakers, you must select from these standard ratings. If the calculated
 * load is between two standard sizes, generally round up to the next standard size
 * (unless specific exceptions apply, such as 240.4(B) for small conductors).
 */
export const STANDARD_BREAKER_SIZES = [
  15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200,
  225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000,
  2500, 3000, 4000, 5000, 6000
];

/**
 * Get the next standard breaker size that meets or exceeds the minimum requirement
 *
 * @param minimumAmps - Minimum required amperage (typically load × 1.25 for continuous)
 * @returns Next standard breaker size in amperes
 *
 * @example
 * // Load requires 67A breaker
 * const breaker = getNextStandardBreakerSize(67); // Returns 70A
 *
 * @example
 * // Continuous load: 40A × 1.25 = 50A required
 * const breaker = getNextStandardBreakerSize(50); // Returns 50A (exact match)
 */
export function getNextStandardBreakerSize(minimumAmps: number): number {
  for (const size of STANDARD_BREAKER_SIZES) {
    if (size >= minimumAmps) {
      return size;
    }
  }
  // If larger than largest standard size, return the minimum requested
  // (In practice, this would require special equipment)
  return minimumAmps;
}

/**
 * Check if a given amperage is a standard breaker size
 *
 * @param amps - Amperage to check
 * @returns true if it's a standard size, false otherwise
 *
 * @example
 * isStandardBreakerSize(20); // true
 * isStandardBreakerSize(75); // false
 */
export function isStandardBreakerSize(amps: number): boolean {
  return STANDARD_BREAKER_SIZES.includes(amps);
}
