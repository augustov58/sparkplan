/**
 * NEC 2023 Chapter 9, Table 5 - Dimensions of Insulated Conductors and Fixture Wires
 * Conductor areas including insulation
 *
 * Areas in square inches
 *
 * IMPORTANT: Copper and aluminum conductors have DIFFERENT dimensions for the
 * same insulation type due to different strand diameters. Aluminum entries are
 * provided separately where they differ from copper per NEC Table 5.
 */

export interface ConductorDimensions {
  size: string;
  /** Conductor type/insulation */
  type: string;
  /** Conductor material */
  material: 'Cu' | 'Al';
  /** Total area including insulation (sq in) */
  area: number;
  /** Approximate diameter (inches) */
  diameter?: number;
}

// ==================== COPPER CONDUCTORS ====================

/**
 * THHN/THWN-2 Copper Conductor Dimensions
 * NEC 2023 Chapter 9, Table 5
 */
export const THHN_CU_DIMENSIONS: ConductorDimensions[] = [
  { size: '14 AWG', type: 'THHN', material: 'Cu', area: 0.0097, diameter: 0.111 },
  { size: '12 AWG', type: 'THHN', material: 'Cu', area: 0.0133, diameter: 0.130 },
  { size: '10 AWG', type: 'THHN', material: 'Cu', area: 0.0211, diameter: 0.164 },
  { size: '8 AWG', type: 'THHN', material: 'Cu', area: 0.0366, diameter: 0.216 },
  { size: '6 AWG', type: 'THHN', material: 'Cu', area: 0.0507, diameter: 0.254 },
  { size: '4 AWG', type: 'THHN', material: 'Cu', area: 0.0824, diameter: 0.324 },
  { size: '3 AWG', type: 'THHN', material: 'Cu', area: 0.0973, diameter: 0.352 },
  { size: '2 AWG', type: 'THHN', material: 'Cu', area: 0.1158, diameter: 0.384 },
  { size: '1 AWG', type: 'THHN', material: 'Cu', area: 0.1562, diameter: 0.446 },
  { size: '1/0 AWG', type: 'THHN', material: 'Cu', area: 0.1855, diameter: 0.486 },
  { size: '2/0 AWG', type: 'THHN', material: 'Cu', area: 0.2223, diameter: 0.532 },
  { size: '3/0 AWG', type: 'THHN', material: 'Cu', area: 0.2679, diameter: 0.584 },
  { size: '4/0 AWG', type: 'THHN', material: 'Cu', area: 0.3237, diameter: 0.642 },
  { size: '250 kcmil', type: 'THHN', material: 'Cu', area: 0.3970, diameter: 0.711 },
  { size: '300 kcmil', type: 'THHN', material: 'Cu', area: 0.4536, diameter: 0.760 },
  { size: '350 kcmil', type: 'THHN', material: 'Cu', area: 0.5113, diameter: 0.806 },
  { size: '400 kcmil', type: 'THHN', material: 'Cu', area: 0.5863, diameter: 0.864 },
  { size: '500 kcmil', type: 'THHN', material: 'Cu', area: 0.7073, diameter: 0.949 },
  { size: '600 kcmil', type: 'THHN', material: 'Cu', area: 0.8316, diameter: 1.030 },
  { size: '750 kcmil', type: 'THHN', material: 'Cu', area: 1.0038, diameter: 1.131 },
  { size: '1000 kcmil', type: 'THHN', material: 'Cu', area: 1.2752, diameter: 1.274 },
];

/**
 * THW/THW-2 Copper Conductor Dimensions
 * NEC 2023 Chapter 9, Table 5
 */
export const THW_CU_DIMENSIONS: ConductorDimensions[] = [
  { size: '14 AWG', type: 'THW', material: 'Cu', area: 0.0139, diameter: 0.133 },
  { size: '12 AWG', type: 'THW', material: 'Cu', area: 0.0181, diameter: 0.152 },
  { size: '10 AWG', type: 'THW', material: 'Cu', area: 0.0260, diameter: 0.182 },
  { size: '8 AWG', type: 'THW', material: 'Cu', area: 0.0437, diameter: 0.236 },
  { size: '6 AWG', type: 'THW', material: 'Cu', area: 0.0726, diameter: 0.304 },
  { size: '4 AWG', type: 'THW', material: 'Cu', area: 0.1041, diameter: 0.364 },
  { size: '3 AWG', type: 'THW', material: 'Cu', area: 0.1290, diameter: 0.405 },
  { size: '2 AWG', type: 'THW', material: 'Cu', area: 0.1519, diameter: 0.440 },
  { size: '1 AWG', type: 'THW', material: 'Cu', area: 0.1901, diameter: 0.492 },
  { size: '1/0 AWG', type: 'THW', material: 'Cu', area: 0.2290, diameter: 0.540 },
  { size: '2/0 AWG', type: 'THW', material: 'Cu', area: 0.2733, diameter: 0.590 },
  { size: '3/0 AWG', type: 'THW', material: 'Cu', area: 0.3288, diameter: 0.647 },
  { size: '4/0 AWG', type: 'THW', material: 'Cu', area: 0.3971, diameter: 0.711 },
  { size: '250 kcmil', type: 'THW', material: 'Cu', area: 0.4848, diameter: 0.786 },
  { size: '300 kcmil', type: 'THW', material: 'Cu', area: 0.5544, diameter: 0.840 },
  { size: '350 kcmil', type: 'THW', material: 'Cu', area: 0.6219, diameter: 0.890 },
  { size: '400 kcmil', type: 'THW', material: 'Cu', area: 0.6888, diameter: 0.937 },
  { size: '500 kcmil', type: 'THW', material: 'Cu', area: 0.8316, diameter: 1.030 },
  { size: '600 kcmil', type: 'THW', material: 'Cu', area: 0.9723, diameter: 1.113 },
  { size: '750 kcmil', type: 'THW', material: 'Cu', area: 1.1770, diameter: 1.225 },
  { size: '1000 kcmil', type: 'THW', material: 'Cu', area: 1.5003, diameter: 1.383 },
];

/**
 * XHHW-2 Copper Conductor Dimensions
 * NEC 2023 Chapter 9, Table 5
 */
export const XHHW_CU_DIMENSIONS: ConductorDimensions[] = [
  { size: '14 AWG', type: 'XHHW', material: 'Cu', area: 0.0097, diameter: 0.111 },
  { size: '12 AWG', type: 'XHHW', material: 'Cu', area: 0.0133, diameter: 0.130 },
  { size: '10 AWG', type: 'XHHW', material: 'Cu', area: 0.0211, diameter: 0.164 },
  { size: '8 AWG', type: 'XHHW', material: 'Cu', area: 0.0366, diameter: 0.216 },
  { size: '6 AWG', type: 'XHHW', material: 'Cu', area: 0.0507, diameter: 0.254 },
  { size: '4 AWG', type: 'XHHW', material: 'Cu', area: 0.0824, diameter: 0.324 },
  { size: '3 AWG', type: 'XHHW', material: 'Cu', area: 0.0973, diameter: 0.352 },
  { size: '2 AWG', type: 'XHHW', material: 'Cu', area: 0.1158, diameter: 0.384 },
  { size: '1 AWG', type: 'XHHW', material: 'Cu', area: 0.1562, diameter: 0.446 },
  { size: '1/0 AWG', type: 'XHHW', material: 'Cu', area: 0.1855, diameter: 0.486 },
  { size: '2/0 AWG', type: 'XHHW', material: 'Cu', area: 0.2223, diameter: 0.532 },
  { size: '3/0 AWG', type: 'XHHW', material: 'Cu', area: 0.2679, diameter: 0.584 },
  { size: '4/0 AWG', type: 'XHHW', material: 'Cu', area: 0.3237, diameter: 0.642 },
  { size: '250 kcmil', type: 'XHHW', material: 'Cu', area: 0.3970, diameter: 0.711 },
  { size: '300 kcmil', type: 'XHHW', material: 'Cu', area: 0.4536, diameter: 0.760 },
  { size: '350 kcmil', type: 'XHHW', material: 'Cu', area: 0.5113, diameter: 0.806 },
  { size: '400 kcmil', type: 'XHHW', material: 'Cu', area: 0.5863, diameter: 0.864 },
  { size: '500 kcmil', type: 'XHHW', material: 'Cu', area: 0.7073, diameter: 0.949 },
  { size: '600 kcmil', type: 'XHHW', material: 'Cu', area: 0.8316, diameter: 1.030 },
  { size: '750 kcmil', type: 'XHHW', material: 'Cu', area: 1.0038, diameter: 1.131 },
  { size: '1000 kcmil', type: 'XHHW', material: 'Cu', area: 1.2752, diameter: 1.274 },
];

/**
 * RHW-2 / RHH Copper Conductor Dimensions
 * NEC 2023 Chapter 9, Table 5
 * Thicker insulation wall than XHHW-2
 */
export const RHW2_CU_DIMENSIONS: ConductorDimensions[] = [
  { size: '14 AWG', type: 'RHW-2', material: 'Cu', area: 0.0209, diameter: 0.163 },
  { size: '12 AWG', type: 'RHW-2', material: 'Cu', area: 0.0260, diameter: 0.182 },
  { size: '10 AWG', type: 'RHW-2', material: 'Cu', area: 0.0333, diameter: 0.206 },
  { size: '8 AWG', type: 'RHW-2', material: 'Cu', area: 0.0556, diameter: 0.266 },
  { size: '6 AWG', type: 'RHW-2', material: 'Cu', area: 0.0726, diameter: 0.304 },
  { size: '4 AWG', type: 'RHW-2', material: 'Cu', area: 0.1041, diameter: 0.364 },
  { size: '3 AWG', type: 'RHW-2', material: 'Cu', area: 0.1290, diameter: 0.405 },
  { size: '2 AWG', type: 'RHW-2', material: 'Cu', area: 0.1519, diameter: 0.440 },
  { size: '1 AWG', type: 'RHW-2', material: 'Cu', area: 0.1901, diameter: 0.492 },
  { size: '1/0 AWG', type: 'RHW-2', material: 'Cu', area: 0.2290, diameter: 0.540 },
  { size: '2/0 AWG', type: 'RHW-2', material: 'Cu', area: 0.2733, diameter: 0.590 },
  { size: '3/0 AWG', type: 'RHW-2', material: 'Cu', area: 0.3288, diameter: 0.647 },
  { size: '4/0 AWG', type: 'RHW-2', material: 'Cu', area: 0.3971, diameter: 0.711 },
  { size: '250 kcmil', type: 'RHW-2', material: 'Cu', area: 0.4848, diameter: 0.786 },
  { size: '300 kcmil', type: 'RHW-2', material: 'Cu', area: 0.5544, diameter: 0.840 },
  { size: '350 kcmil', type: 'RHW-2', material: 'Cu', area: 0.6219, diameter: 0.890 },
  { size: '400 kcmil', type: 'RHW-2', material: 'Cu', area: 0.6888, diameter: 0.937 },
  { size: '500 kcmil', type: 'RHW-2', material: 'Cu', area: 0.8316, diameter: 1.030 },
  { size: '600 kcmil', type: 'RHW-2', material: 'Cu', area: 0.9723, diameter: 1.113 },
  { size: '750 kcmil', type: 'RHW-2', material: 'Cu', area: 1.1770, diameter: 1.225 },
  { size: '1000 kcmil', type: 'RHW-2', material: 'Cu', area: 1.5003, diameter: 1.383 },
];

/**
 * USE-2 Copper Conductor Dimensions
 * NEC 2023 Chapter 9, Table 5
 * Underground Service Entrance cable
 */
export const USE2_CU_DIMENSIONS: ConductorDimensions[] = [
  { size: '14 AWG', type: 'USE-2', material: 'Cu', area: 0.0139, diameter: 0.133 },
  { size: '12 AWG', type: 'USE-2', material: 'Cu', area: 0.0181, diameter: 0.152 },
  { size: '10 AWG', type: 'USE-2', material: 'Cu', area: 0.0260, diameter: 0.182 },
  { size: '8 AWG', type: 'USE-2', material: 'Cu', area: 0.0437, diameter: 0.236 },
  { size: '6 AWG', type: 'USE-2', material: 'Cu', area: 0.0726, diameter: 0.304 },
  { size: '4 AWG', type: 'USE-2', material: 'Cu', area: 0.1041, diameter: 0.364 },
  { size: '3 AWG', type: 'USE-2', material: 'Cu', area: 0.1290, diameter: 0.405 },
  { size: '2 AWG', type: 'USE-2', material: 'Cu', area: 0.1519, diameter: 0.440 },
  { size: '1 AWG', type: 'USE-2', material: 'Cu', area: 0.1901, diameter: 0.492 },
  { size: '1/0 AWG', type: 'USE-2', material: 'Cu', area: 0.2290, diameter: 0.540 },
  { size: '2/0 AWG', type: 'USE-2', material: 'Cu', area: 0.2733, diameter: 0.590 },
  { size: '3/0 AWG', type: 'USE-2', material: 'Cu', area: 0.3288, diameter: 0.647 },
  { size: '4/0 AWG', type: 'USE-2', material: 'Cu', area: 0.3971, diameter: 0.711 },
  { size: '250 kcmil', type: 'USE-2', material: 'Cu', area: 0.4848, diameter: 0.786 },
  { size: '300 kcmil', type: 'USE-2', material: 'Cu', area: 0.5544, diameter: 0.840 },
  { size: '350 kcmil', type: 'USE-2', material: 'Cu', area: 0.6219, diameter: 0.890 },
  { size: '400 kcmil', type: 'USE-2', material: 'Cu', area: 0.6888, diameter: 0.937 },
  { size: '500 kcmil', type: 'USE-2', material: 'Cu', area: 0.8316, diameter: 1.030 },
  { size: '600 kcmil', type: 'USE-2', material: 'Cu', area: 0.9723, diameter: 1.113 },
  { size: '750 kcmil', type: 'USE-2', material: 'Cu', area: 1.1770, diameter: 1.225 },
  { size: '1000 kcmil', type: 'USE-2', material: 'Cu', area: 1.5003, diameter: 1.383 },
];

// ==================== ALUMINUM CONDUCTORS ====================
// Per NEC 2023 Table 5, aluminum conductors have larger OD than copper
// due to larger strand package for the same kcmil rating.
// Differences are most significant at 4 AWG and larger.

/**
 * THHN/THWN-2 Aluminum Conductor Dimensions
 * NEC 2023 Chapter 9, Table 5
 */
export const THHN_AL_DIMENSIONS: ConductorDimensions[] = [
  { size: '12 AWG', type: 'THHN', material: 'Al', area: 0.0133, diameter: 0.130 },
  { size: '10 AWG', type: 'THHN', material: 'Al', area: 0.0211, diameter: 0.164 },
  { size: '8 AWG', type: 'THHN', material: 'Al', area: 0.0366, diameter: 0.216 },
  { size: '6 AWG', type: 'THHN', material: 'Al', area: 0.0507, diameter: 0.254 },
  { size: '4 AWG', type: 'THHN', material: 'Al', area: 0.0845, diameter: 0.328 },
  { size: '3 AWG', type: 'THHN', material: 'Al', area: 0.0994, diameter: 0.356 },
  { size: '2 AWG', type: 'THHN', material: 'Al', area: 0.1182, diameter: 0.388 },
  { size: '1 AWG', type: 'THHN', material: 'Al', area: 0.1590, diameter: 0.450 },
  { size: '1/0 AWG', type: 'THHN', material: 'Al', area: 0.1885, diameter: 0.490 },
  { size: '2/0 AWG', type: 'THHN', material: 'Al', area: 0.2265, diameter: 0.537 },
  { size: '3/0 AWG', type: 'THHN', material: 'Al', area: 0.2733, diameter: 0.590 },
  { size: '4/0 AWG', type: 'THHN', material: 'Al', area: 0.3316, diameter: 0.650 },
  { size: '250 kcmil', type: 'THHN', material: 'Al', area: 0.4050, diameter: 0.718 },
  { size: '300 kcmil', type: 'THHN', material: 'Al', area: 0.4608, diameter: 0.766 },
  { size: '350 kcmil', type: 'THHN', material: 'Al', area: 0.5242, diameter: 0.817 },
  { size: '400 kcmil', type: 'THHN', material: 'Al', area: 0.5958, diameter: 0.871 },
  { size: '500 kcmil', type: 'THHN', material: 'Al', area: 0.7163, diameter: 0.955 },
  { size: '600 kcmil', type: 'THHN', material: 'Al', area: 0.8676, diameter: 1.051 },
  { size: '750 kcmil', type: 'THHN', material: 'Al', area: 1.0496, diameter: 1.157 },
  { size: '1000 kcmil', type: 'THHN', material: 'Al', area: 1.3478, diameter: 1.310 },
];

/**
 * XHHW-2 Aluminum Conductor Dimensions
 * NEC 2023 Chapter 9, Table 5
 */
export const XHHW_AL_DIMENSIONS: ConductorDimensions[] = [
  { size: '12 AWG', type: 'XHHW', material: 'Al', area: 0.0133, diameter: 0.130 },
  { size: '10 AWG', type: 'XHHW', material: 'Al', area: 0.0211, diameter: 0.164 },
  { size: '8 AWG', type: 'XHHW', material: 'Al', area: 0.0366, diameter: 0.216 },
  { size: '6 AWG', type: 'XHHW', material: 'Al', area: 0.0507, diameter: 0.254 },
  { size: '4 AWG', type: 'XHHW', material: 'Al', area: 0.0845, diameter: 0.328 },
  { size: '3 AWG', type: 'XHHW', material: 'Al', area: 0.0994, diameter: 0.356 },
  { size: '2 AWG', type: 'XHHW', material: 'Al', area: 0.1182, diameter: 0.388 },
  { size: '1 AWG', type: 'XHHW', material: 'Al', area: 0.1590, diameter: 0.450 },
  { size: '1/0 AWG', type: 'XHHW', material: 'Al', area: 0.1885, diameter: 0.490 },
  { size: '2/0 AWG', type: 'XHHW', material: 'Al', area: 0.2265, diameter: 0.537 },
  { size: '3/0 AWG', type: 'XHHW', material: 'Al', area: 0.2733, diameter: 0.590 },
  { size: '4/0 AWG', type: 'XHHW', material: 'Al', area: 0.3316, diameter: 0.650 },
  { size: '250 kcmil', type: 'XHHW', material: 'Al', area: 0.4050, diameter: 0.718 },
  { size: '300 kcmil', type: 'XHHW', material: 'Al', area: 0.4608, diameter: 0.766 },
  { size: '350 kcmil', type: 'XHHW', material: 'Al', area: 0.5242, diameter: 0.817 },
  { size: '400 kcmil', type: 'XHHW', material: 'Al', area: 0.5958, diameter: 0.871 },
  { size: '500 kcmil', type: 'XHHW', material: 'Al', area: 0.7163, diameter: 0.955 },
  { size: '600 kcmil', type: 'XHHW', material: 'Al', area: 0.8676, diameter: 1.051 },
  { size: '750 kcmil', type: 'XHHW', material: 'Al', area: 1.0496, diameter: 1.157 },
  { size: '1000 kcmil', type: 'XHHW', material: 'Al', area: 1.3478, diameter: 1.310 },
];

// ==================== WIRE TYPE DEFINITIONS ====================

export type WireType = 'THHN' | 'THW' | 'XHHW' | 'RHW-2' | 'USE-2';
export type ConductorMaterial = 'Cu' | 'Al';

export const WIRE_TYPES: { value: WireType; label: string }[] = [
  { value: 'THHN', label: 'THHN/THWN-2 (90°C)' },
  { value: 'THW', label: 'THW/THW-2 (75°C)' },
  { value: 'XHHW', label: 'XHHW-2 (90°C)' },
  { value: 'RHW-2', label: 'RHW-2/RHH (90°C)' },
  { value: 'USE-2', label: 'USE-2 (90°C Underground)' },
];

// ==================== LOOKUP FUNCTIONS ====================

/**
 * Get conductor dimensions by size, type, and material
 * Returns copper dimensions by default; aluminum when specified
 */
export function getConductorDimensions(
  size: string,
  type: WireType,
  material: ConductorMaterial = 'Cu'
): ConductorDimensions | null {
  // Copper tables
  const cuTables: Record<WireType, ConductorDimensions[]> = {
    'THHN': THHN_CU_DIMENSIONS,
    'THW': THW_CU_DIMENSIONS,
    'XHHW': XHHW_CU_DIMENSIONS,
    'RHW-2': RHW2_CU_DIMENSIONS,
    'USE-2': USE2_CU_DIMENSIONS,
  };

  // Aluminum tables (only THHN and XHHW have separate Al data; others use Cu dimensions)
  const alTables: Record<WireType, ConductorDimensions[]> = {
    'THHN': THHN_AL_DIMENSIONS,
    'THW': THW_CU_DIMENSIONS, // THW Al same dimensions as Cu in NEC Table 5 for most sizes
    'XHHW': XHHW_AL_DIMENSIONS,
    'RHW-2': RHW2_CU_DIMENSIONS, // RHW-2 Al uses same insulation dimensions
    'USE-2': USE2_CU_DIMENSIONS, // USE-2 Al uses same insulation dimensions
  };

  const table = material === 'Al' ? alTables[type] : cuTables[type];
  return table.find(d => d.size === size) || null;
}

/**
 * Standard wire sizes for selection
 */
export const STANDARD_WIRE_SIZES = [
  '14 AWG', '12 AWG', '10 AWG', '8 AWG', '6 AWG', '4 AWG', '3 AWG', '2 AWG', '1 AWG',
  '1/0 AWG', '2/0 AWG', '3/0 AWG', '4/0 AWG',
  '250 kcmil', '300 kcmil', '350 kcmil', '400 kcmil', '500 kcmil', '600 kcmil', '750 kcmil', '1000 kcmil'
] as const;

/** @deprecated Use WIRE_TYPES instead */
export const CONDUIT_TYPES = ['THHN', 'THW', 'XHHW'] as const;

// Legacy compatibility — keep old array names as aliases
export const THHN_DIMENSIONS = THHN_CU_DIMENSIONS;
export const THW_DIMENSIONS = THW_CU_DIMENSIONS;
export const XHHW_DIMENSIONS = XHHW_CU_DIMENSIONS;
