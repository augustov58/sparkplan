/**
 * Grounding Electrode Conductor (GEC) Sizing Service
 *
 * Pure calculation service per NEC 250.66 + electrode/bonding cataloguing
 * per NEC 250.50 / 250.52 / 250.94 / 250.104. Used by the permit-packet PDF
 * grounding section to render project-specific GEC sizing instead of generic
 * boilerplate (Sprint 2A PR 4 / M3).
 *
 * Pure function rules (per CLAUDE.md):
 * - No DB calls, no hooks, no side effects.
 * - Returns `necReferences` and `warnings`. Never throws.
 * - Defers to NEC table data in `/data/nec/table-250-66.ts`.
 */

import {
  getGecSizeDetailed,
  getGecSizeForServiceAmps,
  formatConductorSize,
} from '../../data/nec/table-250-66';

export type ConductorMaterial = 'Cu' | 'Al';

/**
 * Standard NEC 250.52(A) electrode catalogue. The permit-packet PDF
 * lists which of these are PRESENT/REQUIRED for the project. Selections
 * default to a conservative best-practice set when no per-project data
 * exists yet.
 */
export interface GroundingElectrode {
  key: string;
  /** Display label printed in the PDF. */
  label: string;
  /** NEC reference for this electrode type. */
  necReference: string;
  /** Whether this electrode is included for the project. */
  present: boolean;
}

/**
 * Standard NEC 250 bonding requirements catalogue. Same shape as electrodes.
 */
export interface BondingRequirement {
  key: string;
  label: string;
  necReference: string;
  required: boolean;
}

export interface GroundingDetailInput {
  /** Service ampacity in amperes (e.g., 200, 400, 1000). */
  serviceAmps: number;
  /** Conductor material — defaults to Cu when not provided. */
  conductorMaterial?: ConductorMaterial;
  /**
   * Optional: actual installed service conductor size (e.g., "500 kcmil",
   * "2/0 AWG"). When provided, GEC sizing uses NEC 250.66 directly. When
   * omitted, the helper derives a typical service conductor size from
   * `serviceAmps` and notes the assumption.
   */
  serviceConductorSize?: string;
  /**
   * Optional: explicit electrode list (string keys from
   * `STANDARD_ELECTRODES`) marking which electrodes are present. If omitted,
   * the FL pilot defaults are used (rod + concrete-encased + water-pipe).
   */
  presentElectrodeKeys?: string[];
  /**
   * Optional explicit GEC override (e.g., user-confirmed installed size).
   * When provided this is reported as the GEC size, but the table-derived
   * value is still computed and surfaced as `tableMinimumGecSize` for audit.
   */
  installedGecSize?: string;
}

export interface GroundingDetailResult {
  /** GEC size that should be printed on the permit packet. */
  gecSize: string;
  /** GEC size derived from NEC Table 250.66 (the code-minimum). */
  tableMinimumGecSize: string;
  /** Conductor material the GEC is rated for. */
  conductorMaterial: ConductorMaterial;
  /** Service conductor size used for the lookup (assumed if not provided). */
  serviceConductorSize: string;
  /** Whether the service conductor size was assumed from ampacity. */
  serviceConductorAssumed: boolean;
  /** Electrode catalogue with `present` flags resolved. */
  electrodes: GroundingElectrode[];
  /** Bonding requirement catalogue. All NEC 250.94 / 250.104 items required. */
  bondingRequirements: BondingRequirement[];
  /** NEC reference list (audit trail). */
  necReferences: string[];
  /** Warnings (INFO / WARNING / CRITICAL) per CLAUDE.md result-contract rule. */
  warnings: string[];
}

/**
 * Standard catalogue of grounding electrodes per NEC 250.52(A).
 * `defaultPresent` reflects FL pilot best practice (most new construction
 * with concrete slabs has both a Ufer and supplemental ground rod).
 */
const STANDARD_ELECTRODES: Array<Omit<GroundingElectrode, 'present'> & { defaultPresent: boolean }> = [
  {
    key: 'metal-water-pipe',
    label: 'Metal underground water pipe (10 ft minimum, supplemented)',
    necReference: 'NEC 250.52(A)(1)',
    defaultPresent: true,
  },
  {
    key: 'metal-frame-building',
    label: 'Metal frame of the building/structure',
    necReference: 'NEC 250.52(A)(2)',
    defaultPresent: false,
  },
  {
    key: 'concrete-encased-electrode',
    label: 'Concrete-encased electrode (Ufer, 20 ft #4 bare Cu in footing)',
    necReference: 'NEC 250.52(A)(3)',
    defaultPresent: true,
  },
  {
    key: 'ground-ring',
    label: 'Ground ring (20 ft of 2 AWG bare Cu encircling building)',
    necReference: 'NEC 250.52(A)(4)',
    defaultPresent: false,
  },
  {
    key: 'rod-pipe-electrode',
    label: 'Ground rod / pipe electrode (8 ft minimum, 5/8 in Cu-clad)',
    necReference: 'NEC 250.52(A)(5)',
    defaultPresent: true,
  },
  {
    key: 'plate-electrode',
    label: 'Plate electrode (2 sq ft minimum)',
    necReference: 'NEC 250.52(A)(7)',
    defaultPresent: false,
  },
];

/**
 * Standard NEC 250 bonding requirements. All marked `required` by default
 * because they apply to virtually every service per NEC 250.92 / 250.94 /
 * 250.104. AHJ-specific overrides come later.
 */
const STANDARD_BONDING: BondingRequirement[] = [
  {
    key: 'service-bonding-jumper',
    label: 'Main bonding jumper at service disconnect',
    necReference: 'NEC 250.28 / 250.92',
    required: true,
  },
  {
    key: 'intersystem-bonding-terminal',
    label: 'Intersystem bonding terminal (telco / CATV / satellite)',
    necReference: 'NEC 250.94',
    required: true,
  },
  {
    key: 'interior-water-piping',
    label: 'Interior metal water piping bonded back to service',
    necReference: 'NEC 250.104(A)',
    required: true,
  },
  {
    key: 'metal-gas-piping',
    label: 'Interior metal gas piping bonded (where present)',
    necReference: 'NEC 250.104(B)',
    required: true,
  },
  {
    key: 'structural-metal',
    label: 'Exposed structural metal building frame bonded (where present)',
    necReference: 'NEC 250.104(C)',
    required: true,
  },
];

/**
 * Calculate project-specific grounding detail (GEC size + electrode list +
 * bonding requirements). Pure function — no side effects.
 */
export function calculateGroundingDetail(
  input: GroundingDetailInput
): GroundingDetailResult {
  const material: ConductorMaterial = input.conductorMaterial ?? 'Cu';
  const necReferences: string[] = ['NEC 250.66 - Grounding Electrode Conductor'];
  const warnings: string[] = [];

  // 1. Resolve service conductor size + GEC size.
  let serviceConductorSize: string;
  let serviceConductorAssumed: boolean;
  let tableMinimumGecSize: string;

  if (input.serviceConductorSize) {
    serviceConductorSize = formatConductorSize(input.serviceConductorSize);
    serviceConductorAssumed = false;
    const detailed = getGecSizeDetailed(input.serviceConductorSize, material);
    tableMinimumGecSize = detailed.gecSize;
    detailed.notes.forEach(n => warnings.push(n));
  } else {
    // Derive from ampacity.
    const helper = getGecSizeForServiceAmps(input.serviceAmps, material);
    serviceConductorSize = helper.assumedServiceConductorSize;
    serviceConductorAssumed = true;
    tableMinimumGecSize = helper.gecSize;
    helper.notes.forEach(n => warnings.push(n));
  }

  // 2. Honour an installed GEC override if provided. We never undersize: if
  //    the installed GEC is smaller than the code minimum we flag CRITICAL.
  let gecSize = tableMinimumGecSize;
  if (input.installedGecSize && input.installedGecSize.trim()) {
    gecSize = formatConductorSize(input.installedGecSize.trim());
    // We don't try to compare conductor sizes here — that's a future
    // enhancement. Just note the override in the audit trail.
    warnings.push(
      `INFO: Installed GEC override "${gecSize}" reported. NEC 250.66 minimum for this service is ${tableMinimumGecSize}.`
    );
  }

  // 3. Resolve electrode list.
  const presentSet = new Set(input.presentElectrodeKeys ?? []);
  const usePresentOverride = !!input.presentElectrodeKeys;
  const electrodes: GroundingElectrode[] = STANDARD_ELECTRODES.map(e => ({
    key: e.key,
    label: e.label,
    necReference: e.necReference,
    present: usePresentOverride ? presentSet.has(e.key) : e.defaultPresent,
  }));
  necReferences.push('NEC 250.50 - Grounding Electrode System');
  necReferences.push('NEC 250.52(A) - Grounding Electrode Types');

  // 4. Bonding requirements (always the same standard set today).
  const bondingRequirements: BondingRequirement[] = STANDARD_BONDING.map(b => ({ ...b }));
  necReferences.push('NEC 250.92 - Bonding of Services');
  necReferences.push('NEC 250.94 - Intersystem Bonding Termination');
  necReferences.push('NEC 250.104 - Bonding of Metal Piping & Structural Steel');

  // 5. Compliance warnings per NEC 250.50 / 250.53(D)(2).
  const presentElectrodes = electrodes.filter(e => e.present);
  if (presentElectrodes.length === 0) {
    warnings.push(
      'CRITICAL: No grounding electrodes selected. NEC 250.50 requires at least one electrode at the service.'
    );
  }
  const hasWaterPipe = electrodes.some(e => e.key === 'metal-water-pipe' && e.present);
  const hasSupplemental = electrodes.some(
    e =>
      e.present &&
      (e.key === 'rod-pipe-electrode' ||
        e.key === 'concrete-encased-electrode' ||
        e.key === 'ground-ring' ||
        e.key === 'plate-electrode'),
  );
  if (hasWaterPipe && !hasSupplemental) {
    warnings.push(
      'WARNING: Metal underground water pipe used as electrode but no supplemental electrode present. NEC 250.53(D)(2) requires a supplemental electrode.'
    );
  }

  if (input.serviceAmps <= 0) {
    warnings.push('CRITICAL: Service ampacity must be > 0.');
  }

  return {
    gecSize,
    tableMinimumGecSize,
    conductorMaterial: material,
    serviceConductorSize,
    serviceConductorAssumed,
    electrodes,
    bondingRequirements,
    necReferences,
    warnings,
  };
}
