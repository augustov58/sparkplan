import { AmpacityEntry } from '../../types/nec-types';

/**
 * NEC Table 310.16 - Allowable Ampacities of Insulated Conductors
 * Based on 30°C (86°F) ambient temperature
 * NEC 2020 and 2023 (numbered Table 310.15(B)(16) in NEC 2017 and earlier)
 *
 * Sizes: the ones Chapter 9 Table 9 lists (14 AWG – 1000 kcmil; no 700, 800,
 * 900 or > 1000 kcmil). Table 310.16 goes further, but every conductor the
 * sizing tools pick must have Table 9 impedance for its voltage drop (#272).
 * Keep the two size sets equal (tests/table-310-16.test.ts). Every row here
 * matches the NEC 2023 book, p. 70-187 (checked for #272).
 *
 * This table shows the maximum current-carrying capacity (ampacity) of
 * insulated conductors based on conductor size, material, and insulation
 * temperature rating. Values must be corrected for ambient temperature
 * and number of conductors in raceway.
 */
export const TABLE_310_16: AmpacityEntry[] = [
  // Copper conductors
  { size: '14 AWG', material: 'Cu', temp60C: 15, temp75C: 20, temp90C: 25 },
  { size: '12 AWG', material: 'Cu', temp60C: 20, temp75C: 25, temp90C: 30 },
  { size: '10 AWG', material: 'Cu', temp60C: 30, temp75C: 35, temp90C: 40 },
  { size: '8 AWG', material: 'Cu', temp60C: 40, temp75C: 50, temp90C: 55 },
  { size: '6 AWG', material: 'Cu', temp60C: 55, temp75C: 65, temp90C: 75 },
  { size: '4 AWG', material: 'Cu', temp60C: 70, temp75C: 85, temp90C: 95 },
  { size: '3 AWG', material: 'Cu', temp60C: 85, temp75C: 100, temp90C: 115 },
  { size: '2 AWG', material: 'Cu', temp60C: 95, temp75C: 115, temp90C: 130 },
  { size: '1 AWG', material: 'Cu', temp60C: 110, temp75C: 130, temp90C: 145 },
  { size: '1/0 AWG', material: 'Cu', temp60C: 125, temp75C: 150, temp90C: 170 },
  { size: '2/0 AWG', material: 'Cu', temp60C: 145, temp75C: 175, temp90C: 195 },
  { size: '3/0 AWG', material: 'Cu', temp60C: 165, temp75C: 200, temp90C: 225 },
  { size: '4/0 AWG', material: 'Cu', temp60C: 195, temp75C: 230, temp90C: 260 },
  { size: '250 kcmil', material: 'Cu', temp60C: 215, temp75C: 255, temp90C: 290 },
  { size: '300 kcmil', material: 'Cu', temp60C: 240, temp75C: 285, temp90C: 320 },
  { size: '350 kcmil', material: 'Cu', temp60C: 260, temp75C: 310, temp90C: 350 },
  { size: '400 kcmil', material: 'Cu', temp60C: 280, temp75C: 335, temp90C: 380 },
  { size: '500 kcmil', material: 'Cu', temp60C: 320, temp75C: 380, temp90C: 430 },
  { size: '600 kcmil', material: 'Cu', temp60C: 350, temp75C: 420, temp90C: 475 },
  { size: '750 kcmil', material: 'Cu', temp60C: 400, temp75C: 475, temp90C: 535 },
  { size: '1000 kcmil', material: 'Cu', temp60C: 455, temp75C: 545, temp90C: 615 },

  // Aluminum/Copper-Clad Aluminum conductors
  { size: '12 AWG', material: 'Al', temp60C: 15, temp75C: 20, temp90C: 25 },
  { size: '10 AWG', material: 'Al', temp60C: 25, temp75C: 30, temp90C: 35 },
  { size: '8 AWG', material: 'Al', temp60C: 35, temp75C: 40, temp90C: 45 },
  { size: '6 AWG', material: 'Al', temp60C: 40, temp75C: 50, temp90C: 55 },
  { size: '4 AWG', material: 'Al', temp60C: 55, temp75C: 65, temp90C: 75 },
  { size: '3 AWG', material: 'Al', temp60C: 65, temp75C: 75, temp90C: 85 },
  { size: '2 AWG', material: 'Al', temp60C: 75, temp75C: 90, temp90C: 100 },
  { size: '1 AWG', material: 'Al', temp60C: 85, temp75C: 100, temp90C: 115 },
  { size: '1/0 AWG', material: 'Al', temp60C: 100, temp75C: 120, temp90C: 135 },
  { size: '2/0 AWG', material: 'Al', temp60C: 115, temp75C: 135, temp90C: 150 },
  { size: '3/0 AWG', material: 'Al', temp60C: 130, temp75C: 155, temp90C: 175 },
  { size: '4/0 AWG', material: 'Al', temp60C: 150, temp75C: 180, temp90C: 205 },
  { size: '250 kcmil', material: 'Al', temp60C: 170, temp75C: 205, temp90C: 230 },
  { size: '300 kcmil', material: 'Al', temp60C: 195, temp75C: 230, temp90C: 260 },
  { size: '350 kcmil', material: 'Al', temp60C: 210, temp75C: 250, temp90C: 280 },
  { size: '400 kcmil', material: 'Al', temp60C: 225, temp75C: 270, temp90C: 305 },
  { size: '500 kcmil', material: 'Al', temp60C: 260, temp75C: 310, temp90C: 350 },
  { size: '600 kcmil', material: 'Al', temp60C: 285, temp75C: 340, temp90C: 385 },
  { size: '750 kcmil', material: 'Al', temp60C: 320, temp75C: 385, temp90C: 435 },
  { size: '1000 kcmil', material: 'Al', temp60C: 375, temp75C: 445, temp90C: 500 }
];

/**
 * Get ampacity for a specific conductor size, material, and temperature rating
 *
 * @param size - Conductor size (e.g., "12 AWG", "250 kcmil")
 * @param material - Conductor material ('Cu' or 'Al')
 * @param temp - Temperature rating (60, 75, or 90 degrees C)
 * @returns Ampacity in amperes, or 0 if not found
 */
export function getAmpacity(
  size: string,
  material: 'Cu' | 'Al',
  temp: 60 | 75 | 90
): number {
  const entry = TABLE_310_16.find(e => e.size === size && e.material === material);
  if (!entry) return 0;

  if (temp === 60) return entry.temp60C;
  if (temp === 75) return entry.temp75C;
  return entry.temp90C;
}

/**
 * Find the smallest conductor that meets or exceeds the target ampacity
 *
 * @param targetAmpacity - Required ampacity in amperes
 * @param material - Conductor material ('Cu' or 'Al')
 * @param temp - Temperature rating (60, 75, or 90 degrees C)
 * @returns AmpacityEntry for the smallest conductor that meets requirements, or null if none found
 */
export function findConductorByAmpacity(
  targetAmpacity: number,
  material: 'Cu' | 'Al',
  temp: 60 | 75 | 90
): AmpacityEntry | null {
  const candidates = TABLE_310_16.filter(e => e.material === material);

  for (const entry of candidates) {
    let ampacity = 0;
    if (temp === 60) ampacity = entry.temp60C;
    else if (temp === 75) ampacity = entry.temp75C;
    else ampacity = entry.temp90C;

    if (ampacity >= targetAmpacity) {
      return entry;
    }
  }

  return null; // No conductor large enough
}

/**
 * NEC 110.14(C)(1): the Table 310.16 column a circuit's conductor is rated
 * from. 60 °C for a circuit of 100 A or less (14–1 AWG), 75 °C above. A
 * circuit of 100 A or less may use 75 °C only when its terminals are listed
 * for it (110.14(C)(1)(a)(3)): EV branch circuits take 60 °C and note that
 * option (PE ruling 2026-11-20, #271).
 */
export function terminationTempC(circuitAmps: number): 60 | 75 {
  return circuitAmps <= 100 ? 60 : 75;
}

/**
 * NEC 240.4(D)(4)–(8) (same values in 2020 and 2023, book-checked): the
 * largest overcurrent protection a small conductor may have, whatever its
 * Table 310.16 ampacity (14 AWG Cu is 20 A at 75 °C but takes 15 A at most).
 */
const SMALL_CONDUCTOR_MAX_OCPD: Record<'Cu' | 'Al', Record<string, number>> = {
  Cu: { '14 AWG': 15, '12 AWG': 20, '10 AWG': 30 },
  Al: { '12 AWG': 15, '10 AWG': 25 },
};

/**
 * The smaller conductor a circuit of 100 A or less may use when its terminals
 * are listed for 75 °C (110.14(C)(1)(a)(3)), or null when there is none: the
 * 75 °C column gives the same size, or the circuit is above 100 A (already
 * 75 °C). Never below the 240.4(D) limit for the circuit's breaker.
 */
export function conductor75COption(circuitAmps: number, material: 'Cu' | 'Al'): string | null {
  if (circuitAmps > 100) return null;
  const allowed = (e: AmpacityEntry) =>
    e.material === material && (SMALL_CONDUCTOR_MAX_OCPD[material][e.size] ?? Infinity) >= circuitAmps;
  const at60 = TABLE_310_16.find(e => allowed(e) && e.temp60C >= circuitAmps);
  const at75 = TABLE_310_16.find(e => allowed(e) && e.temp75C >= circuitAmps);
  return at75 && at75.size !== at60?.size ? at75.size : null;
}
