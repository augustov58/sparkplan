import { AmpacityEntry } from '../../types/nec-types';
import { STANDARD_BREAKER_SIZES } from './standard-breakers';

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

/**
 * The conductor for a circuit's breaker (PE ruling 2026-11-20, #271; owner
 * ruling 2026-11-21, #280): the smallest Table 310.16 size whose ampacity at
 * `terminationTempC(breaker)` is at least the breaker — 60 °C for a circuit of
 * 100 A or less (branch circuit or feeder), 75 °C above. At 60 °C the 240.4(D)
 * small-conductor limits are met by the column itself. Null when the table has
 * no conductor large enough (never a silent "largest row").
 */
export function conductorForBreaker(breakerAmps: number, material: 'Cu' | 'Al'): string | null {
  return findConductorByAmpacity(breakerAmps, material, terminationTempC(breakerAmps))?.size ?? null;
}

/** "6 AWG", "#6 AWG Cu", "500 kcmil Al" → the table's size and the material it names, if any. */
export function parseConductor(text: string): { size: string; material?: 'Cu' | 'Al' } | null {
  // A bare number ("8", "#6", "1/0", "250") is a gauge: AWG up to 4/0, kcmil from 250
  const m = text.match(/(\d+\/0|\d+)\s*(AWG|kcmil|MCM)?/i);
  if (!m) return null;
  const unit = m[2] ? (m[2].toLowerCase() === 'awg' ? 'AWG' : 'kcmil') : (Number(m[1]) >= 250 ? 'kcmil' : 'AWG');
  const material = /\bal\b|alum/i.test(text) ? 'Al' : /\bcu\b|copper/i.test(text) ? 'Cu' : undefined;
  return { size: `${m[1]} ${unit}`, material };
}

export interface ConductorLegality {
  /** Legal at the circuit's termination temperature (60 °C ≤ 100 A, 75 °C above; 110.14(C)(1)). */
  legal: boolean;
  /** Not legal at 60 °C but legal at 75 °C: allowed only when the terminations are listed for 75 °C (110.14(C)(1)(a)(3)). */
  legalWith75CTerminals: boolean;
  terminationC: 60 | 75;
  /** Ampacity at `terminationC`. */
  ampacityA: number;
  /** The conductor `conductorForBreaker` gives this circuit (rated for the breaker and the load). */
  minimumSize: string | null;
  reasons: string[];
  necReferences: string[];
}

/**
 * Is a conductor code-legal on its breaker (owner ruling 2026-11-21, #280)?
 * Not "ampacity ≥ breaker", but:
 * - 110.14(C)(1): the ampacity at the termination temperature (`terminationTempC`);
 * - 210.19(A)(1): at least the non-continuous load plus 125 % of the continuous load;
 * - 240.4: the breaker protects the conductor — ampacity ≥ breaker, or 240.4(B):
 *   the ampacity isn't a standard rating, the breaker is the next standard rating
 *   above it, ≤ 800 A, and the circuit isn't a multi-outlet receptacle branch
 *   circuit for cord-and-plug-connected portable loads;
 * - 240.4(D): 14 / 12 / 10 AWG (and Al 12 / 10 AWG) breaker limits.
 */
export function conductorCodeLegal(opts: {
  conductor: string;
  material: 'Cu' | 'Al';
  breakerAmps: number;
  loadAmps?: number;
  continuous?: boolean;
  multiOutletReceptacle?: boolean;
  /** Conductors in parallel per phase (310.10(G)); their ampacities add. */
  sets?: number;
}): ConductorLegality {
  const parsed = parseConductor(opts.conductor);
  const material = parsed?.material ?? opts.material;
  const size = parsed?.size ?? opts.conductor;
  const { breakerAmps, loadAmps, continuous = false, multiOutletReceptacle = false } = opts;
  const sets = Math.max(1, Math.floor(opts.sets ?? 1));
  const requiredA = loadAmps !== undefined ? loadAmps * (continuous ? 1.25 : 1) : 0;
  const terminationC = terminationTempC(breakerAmps);
  const necReferences = ['NEC 110.14(C)(1)', 'NEC 240.4', 'NEC Table 310.16'];
  if (loadAmps !== undefined) necReferences.push('NEC 210.19(A)(1)');

  const evaluate = (temp: 60 | 75, conductorSize: string = size) => {
    const size = conductorSize;
    const ampacity = getAmpacity(size, material, temp) * sets;
    const reasons: string[] = [];
    if (!ampacity) return { ok: false, ampacity, reasons: [`${size} ${material} is not in NEC Table 310.16`] };
    if (requiredA > ampacity) {
      reasons.push(`NEC 210.19(A)(1): ${ampacity} A at ${temp} °C is below the ${Math.round(requiredA * 10) / 10} A load${continuous ? ' (125 % of a continuous load)' : ''}`);
    }
    const smallMax = SMALL_CONDUCTOR_MAX_OCPD[material][size];
    if (smallMax !== undefined && breakerAmps > smallMax) {
      reasons.push(`NEC 240.4(D): ${size} ${material} may have at most a ${smallMax} A breaker`);
    }
    if (ampacity < breakerAmps) {
      const nextAbove = STANDARD_BREAKER_SIZES.find((r) => r >= ampacity);
      const nextSizeUp = !STANDARD_BREAKER_SIZES.includes(ampacity) && nextAbove === breakerAmps && breakerAmps <= 800;
      if (!nextSizeUp || multiOutletReceptacle) {
        reasons.push(
          `NEC 240.4: ${ampacity} A at ${temp} °C is not protected by a ${breakerAmps} A breaker` +
          (nextSizeUp && multiOutletReceptacle
            ? ' (240.4(B) excludes multi-outlet receptacle circuits for cord-and-plug loads)'
            : ` (240.4(B) allows only the next standard rating above ${ampacity} A, ${nextAbove ?? '—'} A)`),
        );
      }
    }
    return { ok: reasons.length === 0, ampacity, reasons };
  };

  const atTermination = evaluate(terminationC);
  const at75 = terminationC === 60 && !atTermination.ok ? evaluate(75) : null;
  // The smallest size that passes the same checks (240.4(B) included), so the
  // minimum never contradicts the verdict
  const minimum = TABLE_310_16
    .filter((e) => e.material === material)
    .find((e) => evaluate(terminationC, e.size).ok);
  return {
    legal: atTermination.ok,
    legalWith75CTerminals: !!at75?.ok,
    terminationC,
    ampacityA: atTermination.ampacity,
    minimumSize: minimum?.size ?? null,
    reasons: atTermination.reasons,
    necReferences,
  };
}

/**
 * NEC 240.4 / 240.4(B): the smallest total ampacity a breaker protects. At or
 * below 800 A, any ampacity above the standard rating just below the breaker
 * (240.4(B): the breaker is then the next standard rating above it); above
 * 800 A, the breaker itself (240.4(C)).
 */
export function minimumProtectedAmpacity(breakerAmps: number): number {
  if (breakerAmps > 800) return breakerAmps;
  const below = [...STANDARD_BREAKER_SIZES].reverse().find((r) => r < breakerAmps);
  return below !== undefined ? below + 0.1 : breakerAmps;
}
