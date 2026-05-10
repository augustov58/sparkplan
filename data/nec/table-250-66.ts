/**
 * NEC Table 250.66 - Grounding Electrode Conductor (GEC) for Alternating-Current Systems
 *
 * Sizes the GEC based on the size of the largest ungrounded service-entrance
 * conductor (or equivalent area for parallel conductors). Note this differs
 * from NEC 250.122 (EGC) which is sized by OCPD rating.
 *
 * Important Notes:
 * - For parallel conductors, use the SUM of the cross-sectional areas
 *   (in kcmil) of the largest ungrounded conductors per NEC 250.66 informational
 *   note + standard practice (e.g., NEC Handbook).
 * - "Over X" means strictly greater than X kcmil.
 * - When the service conductor is exactly at a transition (e.g., 350 kcmil),
 *   the smaller bucket applies. Example: 350 kcmil Cu falls in
 *   "Over 3/0 through 350 kcmil" → 2 AWG GEC.
 * - Source: NEC 2017 / 2020 / 2023 Table 250.66 — values are unchanged
 *   across these editions. Florida currently adopts NEC 2020 via FBC 8th
 *   ed. (2023); the table is forward-compatible with the 2023 edition that
 *   FBC 9th ed. will adopt (anticipated ~2027). Project-level NEC edition
 *   is read from `projects.settings.nec_edition` (default '2020').
 *
 * Cross-checked against the NEC 2020 + 2023 code books (CLAUDE.md "NEC
 * table data is safety-critical" rule).
 */

/**
 * Internal numeric representation of a conductor size in circular mils
 * (kcmil × 1000). AWG sizes are converted using NEC Chapter 9 Table 8 values.
 */
const CIRCULAR_MILS: Record<string, number> = {
  // AWG sizes — circular mils per NEC Chapter 9 Table 8
  '14': 4110,
  '12': 6530,
  '10': 10380,
  '8': 16510,
  '6': 26240,
  '4': 41740,
  '3': 52620,
  '2': 66360,
  '1': 83690,
  '1/0': 105600,
  '2/0': 133100,
  '3/0': 167800,
  '4/0': 211600,
  // kcmil sizes — multiply by 1000
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
  '1100': 1100000,
  '1250': 1250000,
  '1500': 1500000,
  '1750': 1750000,
  '2000': 2000000,
};

/**
 * Normalize a conductor size string ("2 AWG", "1/0", "500 kcmil", "500")
 * to a circular mils value. Returns null if the size is unrecognized.
 */
function conductorSizeToCircularMils(size: string): number | null {
  if (!size) return null;
  const normalized = size
    .replace(/AWG/i, '')
    .replace(/kcmil/i, '')
    .replace(/MCM/i, '')
    .trim();
  return CIRCULAR_MILS[normalized] ?? null;
}

export interface GecSizeEntry {
  /** Maximum copper service conductor size, in circular mils, that maps to this GEC. */
  maxCopperCircularMils: number;
  /** Maximum aluminum service conductor size, in circular mils, that maps to this GEC. */
  maxAluminumCircularMils: number;
  /** Human-readable copper service conductor range (for display). */
  copperServiceRange: string;
  /** Human-readable aluminum service conductor range (for display). */
  aluminumServiceRange: string;
  /** Required copper GEC size. */
  copperGecSize: string;
  /** Required aluminum GEC size. */
  aluminumGecSize: string;
}

/**
 * NEC Table 250.66 - GEC sizing
 * Ordered ascending by service conductor size. Each row's max is the
 * inclusive upper bound for that bucket; the next row covers everything
 * strictly above it.
 */
export const TABLE_250_66: GecSizeEntry[] = [
  {
    // 2 AWG or smaller Cu / 1/0 AWG or smaller Al
    maxCopperCircularMils: CIRCULAR_MILS['2']!, // 66,360
    maxAluminumCircularMils: CIRCULAR_MILS['1/0']!, // 105,600
    copperServiceRange: '2 AWG or smaller',
    aluminumServiceRange: '1/0 AWG or smaller',
    copperGecSize: '8 AWG',
    aluminumGecSize: '6 AWG',
  },
  {
    // 1 or 1/0 AWG Cu / 2/0 or 3/0 Al
    maxCopperCircularMils: CIRCULAR_MILS['1/0']!, // 105,600
    maxAluminumCircularMils: CIRCULAR_MILS['3/0']!, // 167,800
    copperServiceRange: '1 or 1/0 AWG',
    aluminumServiceRange: '2/0 or 3/0 AWG',
    copperGecSize: '6 AWG',
    aluminumGecSize: '4 AWG',
  },
  {
    // 2/0 or 3/0 AWG Cu / 4/0 AWG or 250 kcmil Al
    maxCopperCircularMils: CIRCULAR_MILS['3/0']!, // 167,800
    maxAluminumCircularMils: CIRCULAR_MILS['250']!, // 250,000
    copperServiceRange: '2/0 or 3/0 AWG',
    aluminumServiceRange: '4/0 AWG or 250 kcmil',
    copperGecSize: '4 AWG',
    aluminumGecSize: '2 AWG',
  },
  {
    // Over 3/0 through 350 kcmil Cu / Over 250 through 500 kcmil Al
    maxCopperCircularMils: CIRCULAR_MILS['350']!, // 350,000
    maxAluminumCircularMils: CIRCULAR_MILS['500']!, // 500,000
    copperServiceRange: 'Over 3/0 AWG through 350 kcmil',
    aluminumServiceRange: 'Over 250 kcmil through 500 kcmil',
    copperGecSize: '2 AWG',
    aluminumGecSize: '1/0 AWG',
  },
  {
    // Over 350 through 600 kcmil Cu / Over 500 through 900 kcmil Al
    maxCopperCircularMils: CIRCULAR_MILS['600']!, // 600,000
    maxAluminumCircularMils: CIRCULAR_MILS['900']!, // 900,000
    copperServiceRange: 'Over 350 kcmil through 600 kcmil',
    aluminumServiceRange: 'Over 500 kcmil through 900 kcmil',
    copperGecSize: '1/0 AWG',
    aluminumGecSize: '3/0 AWG',
  },
  {
    // Over 600 through 1100 kcmil Cu / Over 900 through 1750 kcmil Al
    maxCopperCircularMils: CIRCULAR_MILS['1100']!, // 1,100,000
    maxAluminumCircularMils: CIRCULAR_MILS['1750']!, // 1,750,000
    copperServiceRange: 'Over 600 kcmil through 1100 kcmil',
    aluminumServiceRange: 'Over 900 kcmil through 1750 kcmil',
    copperGecSize: '2/0 AWG',
    aluminumGecSize: '4/0 AWG',
  },
  {
    // Over 1100 kcmil Cu / Over 1750 kcmil Al
    maxCopperCircularMils: Number.POSITIVE_INFINITY,
    maxAluminumCircularMils: Number.POSITIVE_INFINITY,
    copperServiceRange: 'Over 1100 kcmil',
    aluminumServiceRange: 'Over 1750 kcmil',
    copperGecSize: '3/0 AWG',
    aluminumGecSize: '250 kcmil',
  },
];

/**
 * Get GEC size from NEC Table 250.66 based on service conductor size.
 *
 * @param serviceConductorSize - Human-readable conductor size: "2 AWG", "1/0",
 *   "500 kcmil", "500" — case-insensitive, with or without unit suffix.
 *   For parallel conductor sets, pass the equivalent total kcmil
 *   (e.g., 2 × 500 kcmil = "1000").
 * @param material - Conductor material ('Cu' or 'Al')
 * @returns The required GEC size as a string (e.g., "2/0 AWG"). Falls back
 *   to the largest GEC in the table if the input is unrecognized.
 */
export function getGecSize(
  serviceConductorSize: string,
  material: 'Cu' | 'Al'
): string {
  const cm = conductorSizeToCircularMils(serviceConductorSize);
  if (cm === null) {
    // Unrecognized size — fall back to the largest GEC for safety.
    const last = TABLE_250_66[TABLE_250_66.length - 1]!;
    return material === 'Cu' ? last.copperGecSize : last.aluminumGecSize;
  }
  for (const entry of TABLE_250_66) {
    const max =
      material === 'Cu' ? entry.maxCopperCircularMils : entry.maxAluminumCircularMils;
    if (cm <= max) {
      return material === 'Cu' ? entry.copperGecSize : entry.aluminumGecSize;
    }
  }
  // Should never reach here (last row is +Infinity), but stay safe.
  const last = TABLE_250_66[TABLE_250_66.length - 1]!;
  return material === 'Cu' ? last.copperGecSize : last.aluminumGecSize;
}

/**
 * Detailed GEC sizing result with table entry, NEC reference, and notes.
 */
export interface GecSizeDetailedResult {
  /** Required GEC size (e.g., "2/0 AWG"). */
  gecSize: string;
  /** The matching table row (or last row if input was out of range). */
  tableEntry: GecSizeEntry;
  /** NEC reference for the audit trail. */
  necReference: string;
  /** Warnings or informational notes. Always non-null. */
  notes: string[];
}

export function getGecSizeDetailed(
  serviceConductorSize: string,
  material: 'Cu' | 'Al'
): GecSizeDetailedResult {
  const notes: string[] = [];
  const cm = conductorSizeToCircularMils(serviceConductorSize);

  if (cm === null) {
    const last = TABLE_250_66[TABLE_250_66.length - 1]!;
    notes.push(
      `INFO: Unrecognized service conductor size "${serviceConductorSize}". Returning largest GEC for safety; verify input.`
    );
    return {
      gecSize: material === 'Cu' ? last.copperGecSize : last.aluminumGecSize,
      tableEntry: last,
      necReference: 'NEC 250.66 - Table 250.66',
      notes,
    };
  }

  for (const entry of TABLE_250_66) {
    const max =
      material === 'Cu' ? entry.maxCopperCircularMils : entry.maxAluminumCircularMils;
    if (cm <= max) {
      return {
        gecSize: material === 'Cu' ? entry.copperGecSize : entry.aluminumGecSize,
        tableEntry: entry,
        necReference: 'NEC 250.66 - Table 250.66',
        notes,
      };
    }
  }

  const last = TABLE_250_66[TABLE_250_66.length - 1]!;
  return {
    gecSize: material === 'Cu' ? last.copperGecSize : last.aluminumGecSize,
    tableEntry: last,
    necReference: 'NEC 250.66 - Table 250.66',
    notes,
  };
}

/**
 * Internal: typical service conductor sizing by ampacity.
 *
 * For ampacities <= 400A this maps to NEC Table 310.12 (single dwelling-style
 * service conductor table). For higher ampacities single-conductor sizing is
 * impractical so we map to the equivalent total kcmil of a representative
 * parallel-set design. These mappings line up with NEC 250.66 buckets such
 * that the resulting GEC matches industry practice.
 *
 * Use only when the actual service conductor size isn't known. Prefer
 * `getGecSize(serviceConductorSize, ...)` whenever possible.
 */
const TYPICAL_SERVICE_BY_AMPS: { maxAmps: number; copperSize: string; aluminumSize: string }[] = [
  // Per NEC Table 310.12 (75°C dwelling service)
  { maxAmps: 100, copperSize: '4', aluminumSize: '2' },
  { maxAmps: 125, copperSize: '2', aluminumSize: '1/0' },
  { maxAmps: 150, copperSize: '1', aluminumSize: '2/0' },
  { maxAmps: 175, copperSize: '1/0', aluminumSize: '3/0' },
  { maxAmps: 200, copperSize: '2/0', aluminumSize: '4/0' },
  { maxAmps: 225, copperSize: '3/0', aluminumSize: '250' },
  { maxAmps: 250, copperSize: '4/0', aluminumSize: '300' },
  { maxAmps: 300, copperSize: '250', aluminumSize: '350' },
  { maxAmps: 350, copperSize: '350', aluminumSize: '500' },
  { maxAmps: 400, copperSize: '400', aluminumSize: '600' },
  // Above 400A — typical parallel-set equivalent kcmil. Aluminum mapping
  // tracks the matching Cu GEC bucket from NEC Table 250.66 so the helper
  // returns the same GEC the table would for an actual parallel design.
  { maxAmps: 500, copperSize: '500', aluminumSize: '750' },
  { maxAmps: 600, copperSize: '600', aluminumSize: '900' },
  // 800A — 2 sets ~500 kcmil Cu (1000 kcmil equiv) → 2/0 Cu / 4/0 Al
  { maxAmps: 800, copperSize: '1000', aluminumSize: '1500' },
  // 1000A — 2 sets ~500 kcmil Cu (1000 kcmil equiv) → 2/0 Cu / 4/0 Al
  { maxAmps: 1000, copperSize: '1000', aluminumSize: '1500' },
  // 1200A — 2 sets ~600 kcmil Cu (1200 kcmil equiv) → 3/0 Cu / 250 kcmil Al
  { maxAmps: 1200, copperSize: '1250', aluminumSize: '2000' },
  // 1600A and up — > 1100 kcmil equiv → 3/0 Cu / 250 kcmil Al
  { maxAmps: 2000, copperSize: '1500', aluminumSize: '2000' },
  { maxAmps: 4000, copperSize: '2000', aluminumSize: '2000' },
];

/**
 * Convenience helper: derive a typical service conductor size from service
 * ampacity, then look up the GEC size. Use this only when the actual service
 * conductor size isn't known. Prefer `getGecSize(serviceConductorSize, ...)`.
 *
 * @param serviceAmps - Service ampacity in amperes
 * @param material - Conductor material ('Cu' or 'Al')
 * @returns Detailed result including the assumed service conductor size,
 *   GEC size, NEC reference, and informational notes.
 */
export function getGecSizeForServiceAmps(
  serviceAmps: number,
  material: 'Cu' | 'Al'
): GecSizeDetailedResult & { assumedServiceConductorSize: string } {
  const notes: string[] = [];

  // Pick the smallest row whose maxAmps >= serviceAmps. Fallback to last row.
  let entry = TYPICAL_SERVICE_BY_AMPS[TYPICAL_SERVICE_BY_AMPS.length - 1]!;
  for (const candidate of TYPICAL_SERVICE_BY_AMPS) {
    if (serviceAmps <= candidate.maxAmps) {
      entry = candidate;
      break;
    }
  }

  if (serviceAmps > 4000) {
    notes.push(
      `WARNING: Service ampacity ${serviceAmps}A exceeds the typical-service mapping (4000A). Engineering judgment required.`
    );
  }
  if (serviceAmps > 400) {
    notes.push(
      `INFO: Service > 400A typically uses parallel conductor sets. Assumed equivalent area ${entry.copperSize} kcmil (Cu) — verify against actual installed conductors per NEC 250.66.`
    );
  }

  const assumed = material === 'Cu' ? entry.copperSize : entry.aluminumSize;
  const detailed = getGecSizeDetailed(assumed, material);

  return {
    ...detailed,
    notes: [...notes, ...detailed.notes],
    assumedServiceConductorSize:
      material === 'Cu'
        ? formatConductorSize(entry.copperSize)
        : formatConductorSize(entry.aluminumSize),
  };
}

/**
 * Pretty-print a normalized conductor size: "2/0" → "2/0 AWG", "500" → "500 kcmil".
 * Recognized AWG sizes get the AWG suffix; numeric kcmil values get "kcmil".
 */
export function formatConductorSize(size: string): string {
  if (!size) return size;
  const trimmed = size.replace(/AWG/i, '').replace(/kcmil/i, '').replace(/MCM/i, '').trim();
  const awgSizes = new Set([
    '14', '12', '10', '8', '6', '4', '3', '2', '1',
    '1/0', '2/0', '3/0', '4/0',
  ]);
  if (awgSizes.has(trimmed)) return `${trimmed} AWG`;
  if (/^\d+$/.test(trimmed)) return `${trimmed} kcmil`;
  return size;
}
