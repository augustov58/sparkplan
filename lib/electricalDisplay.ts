/**
 * Shared formatters for electrical-system display labels.
 *
 * Two functions that solve common UI bugs:
 *
 * 1. `lineToNeutralVoltage(voltage, phase)` — given a panel's L-L voltage
 *    and phase configuration, return the correct L-N voltage. Replaces
 *    the buggy ad-hoc ternaries (e.g., `phase === 3 ? '120V' : '120V'`)
 *    that hardcoded the wrong value.
 *
 * 2. `SYSTEM_TYPE_OPTIONS` + `systemTypeFromVP` / `vpFromSystemType` —
 *    canonical 3-option system-type selector matching ProjectSetup's
 *    existing pattern. Use this in any panel/equipment form that needs
 *    voltage+phase as a single user choice rather than two cascading
 *    dropdowns (which let users pick electrically-invalid pairs like
 *    480V single-phase or 277V three-phase).
 *
 * @module lib/electricalDisplay
 */

/**
 * Compute line-to-neutral voltage from line-to-line + phase configuration.
 *
 * - 3-phase wye: L-N = L-L / √3  (208 → 120, 480 → 277)
 * - Single-phase split: L-N = L-L / 2  (240 → 120)
 * - 120V (no split): returns 120
 * - Anything else: returns L-L unchanged (e.g., 277V single-phase has
 *   no L-N split in any common service config)
 *
 * Rounded to the nearest integer for display.
 */
export function lineToNeutralVoltage(voltage: number, phase: number): number {
  if (phase === 3) {
    return Math.round(voltage / Math.sqrt(3));
  }
  if (voltage === 240 || voltage === 480) {
    return voltage / 2;
  }
  return voltage;
}

/**
 * Format a panel's voltage as "L-L / L-N" for display, e.g. "480V / 277V".
 * For single-voltage systems (120V), drops the "/" entirely.
 */
export function formatPanelVoltageDisplay(voltage: number, phase: number): string {
  const ln = lineToNeutralVoltage(voltage, phase);
  if (ln === voltage) return `${voltage}V`;
  return `${voltage}V / ${ln}V`;
}

// ============================================================================
// SYSTEM-TYPE SELECTOR (panel/equipment forms)
// ============================================================================

/**
 * The three canonical service configurations 99% of contractors actually
 * deploy. Matches ProjectSetup.tsx's existing system-type selector so the
 * Add Panel form and the project-level service config use identical labels.
 *
 * Each entry maps a user-facing label → the stored {voltage, phase} pair
 * (and vice versa). Edge cases (240V 1Ø no-neutral, 480V 1Ø, custom delta
 * configurations) fall back to "120/240-1" today; widen this constant when
 * a real user scenario surfaces them.
 */
export const SYSTEM_TYPE_OPTIONS = [
  { key: '120/240-1', label: '120/240V Single-Phase (Residential)', voltage: 240, phase: 1 as const },
  { key: '120/208-3', label: '120/208V Three-Phase (Commercial)', voltage: 208, phase: 3 as const },
  { key: '277/480-3', label: '277/480V Three-Phase (Industrial)', voltage: 480, phase: 3 as const },
] as const;

export type SystemTypeKey = (typeof SYSTEM_TYPE_OPTIONS)[number]['key'];

/** Map an existing {voltage, phase} back to a system-type key for `<select value>`. */
export function systemTypeFromVP(voltage: number, phase: number): SystemTypeKey {
  if (voltage === 240 && phase === 1) return '120/240-1';
  if (voltage === 208 && phase === 3) return '120/208-3';
  if (voltage === 480 && phase === 3) return '277/480-3';
  return '120/240-1'; // safe default
}

/** Map a system-type key from a `<select>` to its {voltage, phase} pair. */
export function vpFromSystemType(key: string): { voltage: number; phase: 1 | 3 } {
  const found = SYSTEM_TYPE_OPTIONS.find(o => o.key === key);
  return found ? { voltage: found.voltage, phase: found.phase } : { voltage: 240, phase: 1 };
}
