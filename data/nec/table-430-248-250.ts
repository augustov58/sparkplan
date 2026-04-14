/**
 * NEC 2023 Tables 430.248 & 430.250 - Motor Full-Load Currents
 *
 * Table 430.248 — Full-Load Currents in Amperes, Single-Phase AC Motors
 * Table 430.250 — Full-Load Current, Three-Phase AC Motors (Induction type)
 *
 * These values are used to determine circuit conductor sizes, ampere ratings of
 * switches, branch-circuit short-circuit and ground-fault protection in lieu of
 * motor nameplate values (per NEC 430.6(A)(1)).
 *
 * IMPORTANT: Actual motor nameplate FLA is often LOWER than these table values
 * (high-efficiency motors). NEC requires use of TABLE values for overcurrent
 * protection and conductor sizing per 430.6(A)(1) — nameplate is only used for
 * overload protection sizing per 430.6(A)(2).
 *
 * Safety-critical data — verified against NEC 2023 printed code book.
 */

export type MotorPhase = 1 | 3;

export interface MotorFLAEntry {
  hp: number;
  /** Full-load current by voltage. Keys are standard motor nameplate voltages. */
  byVoltage: Record<number, number>;
}

/**
 * NEC Table 430.248 — Single-Phase AC Motors
 * Voltages: 115V, 200V, 208V, 230V
 */
export const TABLE_430_248_SINGLE_PHASE: MotorFLAEntry[] = [
  { hp: 1 / 6, byVoltage: { 115: 4.4, 200: 2.5, 208: 2.4, 230: 2.2 } },
  { hp: 1 / 4, byVoltage: { 115: 5.8, 200: 3.3, 208: 3.2, 230: 2.9 } },
  { hp: 1 / 3, byVoltage: { 115: 7.2, 200: 4.1, 208: 4.0, 230: 3.6 } },
  { hp: 1 / 2, byVoltage: { 115: 9.8, 200: 5.6, 208: 5.4, 230: 4.9 } },
  { hp: 3 / 4, byVoltage: { 115: 13.8, 200: 7.9, 208: 7.6, 230: 6.9 } },
  { hp: 1, byVoltage: { 115: 16, 200: 9.2, 208: 8.8, 230: 8.0 } },
  { hp: 1.5, byVoltage: { 115: 20, 200: 11.5, 208: 11.0, 230: 10 } },
  { hp: 2, byVoltage: { 115: 24, 200: 13.8, 208: 13.2, 230: 12 } },
  { hp: 3, byVoltage: { 115: 34, 200: 19.6, 208: 18.7, 230: 17 } },
  { hp: 5, byVoltage: { 115: 56, 200: 32.2, 208: 30.8, 230: 28 } },
  { hp: 7.5, byVoltage: { 115: 80, 200: 46.0, 208: 44.0, 230: 40 } },
  { hp: 10, byVoltage: { 115: 100, 200: 57.5, 208: 55.0, 230: 50 } },
];

/**
 * NEC Table 430.250 — Three-Phase AC Motors (Induction type, squirrel-cage / wound-rotor)
 * Voltages: 208V, 230V, 460V, 575V, 2300V
 *
 * Note: 115V and 200V columns from the full NEC table are omitted as they are
 * uncommon for 3-phase industrial installations. For 200V, scale 208V values by
 * 208/200 = 1.04 (NEC permits this adjustment).
 */
export const TABLE_430_250_THREE_PHASE: MotorFLAEntry[] = [
  { hp: 1 / 2, byVoltage: { 208: 2.4, 230: 2.2, 460: 1.1, 575: 0.9 } },
  { hp: 3 / 4, byVoltage: { 208: 3.5, 230: 3.2, 460: 1.6, 575: 1.3 } },
  { hp: 1, byVoltage: { 208: 4.6, 230: 4.2, 460: 2.1, 575: 1.7 } },
  { hp: 1.5, byVoltage: { 208: 6.6, 230: 6.0, 460: 3.0, 575: 2.4 } },
  { hp: 2, byVoltage: { 208: 7.5, 230: 6.8, 460: 3.4, 575: 2.7 } },
  { hp: 3, byVoltage: { 208: 10.6, 230: 9.6, 460: 4.8, 575: 3.9 } },
  { hp: 5, byVoltage: { 208: 16.7, 230: 15.2, 460: 7.6, 575: 6.1 } },
  { hp: 7.5, byVoltage: { 208: 24.2, 230: 22, 460: 11, 575: 9 } },
  { hp: 10, byVoltage: { 208: 30.8, 230: 28, 460: 14, 575: 11 } },
  { hp: 15, byVoltage: { 208: 46.2, 230: 42, 460: 21, 575: 17 } },
  { hp: 20, byVoltage: { 208: 59.4, 230: 54, 460: 27, 575: 22 } },
  { hp: 25, byVoltage: { 208: 74.8, 230: 68, 460: 34, 575: 27 } },
  { hp: 30, byVoltage: { 208: 88, 230: 80, 460: 40, 575: 32 } },
  { hp: 40, byVoltage: { 208: 114, 230: 104, 460: 52, 575: 41 } },
  { hp: 50, byVoltage: { 208: 143, 230: 130, 460: 65, 575: 52 } },
  { hp: 60, byVoltage: { 208: 169, 230: 154, 460: 77, 575: 62, 2300: 16 } },
  { hp: 75, byVoltage: { 208: 211, 230: 192, 460: 96, 575: 77, 2300: 20 } },
  { hp: 100, byVoltage: { 208: 273, 230: 248, 460: 124, 575: 99, 2300: 26 } },
  { hp: 125, byVoltage: { 208: 343, 230: 312, 460: 156, 575: 125, 2300: 31 } },
  { hp: 150, byVoltage: { 208: 396, 230: 360, 460: 180, 575: 144, 2300: 37 } },
  { hp: 200, byVoltage: { 208: 528, 230: 480, 460: 240, 575: 192, 2300: 49 } },
  { hp: 250, byVoltage: { 460: 302, 575: 242, 2300: 60 } },
  { hp: 300, byVoltage: { 460: 361, 575: 289, 2300: 72 } },
  { hp: 350, byVoltage: { 460: 414, 575: 336, 2300: 83 } },
  { hp: 400, byVoltage: { 460: 477, 575: 382, 2300: 95 } },
  { hp: 450, byVoltage: { 460: 515, 575: 412, 2300: 103 } },
  { hp: 500, byVoltage: { 460: 590, 575: 472, 2300: 118 } },
];

/**
 * Find the nearest voltage column in a table row.
 * NEC motor tables are organized by nominal voltage; real installations may
 * use adjacent nominal voltages (e.g., 240V system → 230V column).
 */
function getNearestVoltage(available: number[], target: number): number {
  return available.reduce((closest, v) =>
    Math.abs(v - target) < Math.abs(closest - target) ? v : closest
  );
}

/**
 * Find the nearest HP row to the requested value (exact match preferred).
 * If HP is between two table rows, we use the HIGHER row per NEC convention
 * (motor is sized to the next-larger standard).
 */
function findHpRow(table: MotorFLAEntry[], hp: number): MotorFLAEntry | null {
  if (hp <= 0 || table.length === 0) return null;

  // Exact match
  const exact = table.find((entry) => Math.abs(entry.hp - hp) < 0.01);
  if (exact) return exact;

  // Next larger HP
  const nextLarger = table.find((entry) => entry.hp >= hp);
  if (nextLarger) return nextLarger;

  // HP exceeds table — use largest available (fallback)
  return table[table.length - 1] ?? null;
}

/**
 * Look up motor full-load amps from NEC Tables 430.248 / 430.250.
 *
 * @param hp Motor horsepower (1/6 through 500)
 * @param voltage Nominal system voltage (115, 120, 200, 208, 230, 240, 277, 460, 480, 575, 600, 2300)
 * @param phase 1 (single-phase) or 3 (three-phase)
 * @returns FLA in amps, or null if no table applies (e.g., invalid HP)
 */
export function getMotorFLA(
  hp: number,
  voltage: number,
  phase: MotorPhase
): number | null {
  if (!hp || hp <= 0 || !voltage || voltage <= 0) return null;

  const table = phase === 1 ? TABLE_430_248_SINGLE_PHASE : TABLE_430_250_THREE_PHASE;
  const row = findHpRow(table, hp);
  if (!row) return null;

  const availableVoltages = Object.keys(row.byVoltage).map(Number);
  if (availableVoltages.length === 0) return null;

  // Map common system voltages to nearest NEC table column:
  // 120 → 115, 240 → 230, 480 → 460, 600 → 575
  const mappedVoltage = (() => {
    if (phase === 1) {
      if (voltage === 120) return 115;
      if (voltage === 240) return 230;
    } else {
      if (voltage === 240) return 230;
      if (voltage === 480) return 460;
      if (voltage === 600) return 575;
    }
    return voltage;
  })();

  const nearest = availableVoltages.includes(mappedVoltage)
    ? mappedVoltage
    : getNearestVoltage(availableVoltages, mappedVoltage);

  return row.byVoltage[nearest] ?? null;
}

/**
 * Returns the list of supported HP values for a given phase — useful for
 * dropdown rendering.
 */
export function getSupportedHpValues(phase: MotorPhase): number[] {
  const table = phase === 1 ? TABLE_430_248_SINGLE_PHASE : TABLE_430_250_THREE_PHASE;
  return table.map((row) => row.hp);
}
