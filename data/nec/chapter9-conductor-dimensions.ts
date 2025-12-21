/**
 * NEC Chapter 9, Table 5 - Dimensions of Insulated Conductors and Fixture Wires
 * Conductor areas including insulation
 *
 * Areas in square inches
 */

export interface ConductorDimensions {
  size: string;
  /** Conductor type/insulation */
  type: string;
  /** Total area including insulation (sq in) */
  area: number;
  /** Approximate diameter (inches) */
  diameter?: number;
}

/**
 * THHN/THWN-2 Conductor Dimensions (most common)
 * NEC Chapter 9, Table 5
 */
export const THHN_DIMENSIONS: ConductorDimensions[] = [
  { size: '14 AWG', type: 'THHN', area: 0.0097, diameter: 0.111 },
  { size: '12 AWG', type: 'THHN', area: 0.0133, diameter: 0.130 },
  { size: '10 AWG', type: 'THHN', area: 0.0211, diameter: 0.164 },
  { size: '8 AWG', type: 'THHN', area: 0.0366, diameter: 0.216 },
  { size: '6 AWG', type: 'THHN', area: 0.0507, diameter: 0.254 },
  { size: '4 AWG', type: 'THHN', area: 0.0824, diameter: 0.324 },
  { size: '3 AWG', type: 'THHN', area: 0.0973, diameter: 0.352 },
  { size: '2 AWG', type: 'THHN', area: 0.1158, diameter: 0.384 },
  { size: '1 AWG', type: 'THHN', area: 0.1562, diameter: 0.446 },
  { size: '1/0 AWG', type: 'THHN', area: 0.1855, diameter: 0.486 },
  { size: '2/0 AWG', type: 'THHN', area: 0.2223, diameter: 0.532 },
  { size: '3/0 AWG', type: 'THHN', area: 0.2679, diameter: 0.584 },
  { size: '4/0 AWG', type: 'THHN', area: 0.3237, diameter: 0.642 },
  { size: '250 kcmil', type: 'THHN', area: 0.3970, diameter: 0.711 },
  { size: '300 kcmil', type: 'THHN', area: 0.4536, diameter: 0.760 },
  { size: '350 kcmil', type: 'THHN', area: 0.5113, diameter: 0.806 },
  { size: '400 kcmil', type: 'THHN', area: 0.5863, diameter: 0.864 },
  { size: '500 kcmil', type: 'THHN', area: 0.7073, diameter: 0.949 },
  { size: '600 kcmil', type: 'THHN', area: 0.8316, diameter: 1.030 },
  { size: '750 kcmil', type: 'THHN', area: 1.0038, diameter: 1.131 },
  { size: '1000 kcmil', type: 'THHN', area: 1.2752, diameter: 1.274 },
];

/**
 * THW/THW-2 Conductor Dimensions
 * NEC Chapter 9, Table 5
 */
export const THW_DIMENSIONS: ConductorDimensions[] = [
  { size: '14 AWG', type: 'THW', area: 0.0139, diameter: 0.133 },
  { size: '12 AWG', type: 'THW', area: 0.0181, diameter: 0.152 },
  { size: '10 AWG', type: 'THW', area: 0.0260, diameter: 0.182 },
  { size: '8 AWG', type: 'THW', area: 0.0437, diameter: 0.236 },
  { size: '6 AWG', type: 'THW', area: 0.0726, diameter: 0.304 },
  { size: '4 AWG', type: 'THW', area: 0.1041, diameter: 0.364 },
  { size: '3 AWG', type: 'THW', area: 0.1290, diameter: 0.405 },
  { size: '2 AWG', type: 'THW', area: 0.1519, diameter: 0.440 },
  { size: '1 AWG', type: 'THW', area: 0.1901, diameter: 0.492 },
  { size: '1/0 AWG', type: 'THW', area: 0.2290, diameter: 0.540 },
  { size: '2/0 AWG', type: 'THW', area: 0.2733, diameter: 0.590 },
  { size: '3/0 AWG', type: 'THW', area: 0.3288, diameter: 0.647 },
  { size: '4/0 AWG', type: 'THW', area: 0.3971, diameter: 0.711 },
  { size: '250 kcmil', type: 'THW', area: 0.4848, diameter: 0.786 },
  { size: '300 kcmil', type: 'THW', area: 0.5544, diameter: 0.840 },
  { size: '350 kcmil', type: 'THW', area: 0.6219, diameter: 0.890 },
  { size: '400 kcmil', type: 'THW', area: 0.6888, diameter: 0.937 },
  { size: '500 kcmil', type: 'THW', area: 0.8316, diameter: 1.030 },
  { size: '600 kcmil', type: 'THW', area: 0.9723, diameter: 1.113 },
  { size: '750 kcmil', type: 'THW', area: 1.1770, diameter: 1.225 },
  { size: '1000 kcmil', type: 'THW', area: 1.5003, diameter: 1.383 },
];

/**
 * XHHW-2/RHW-2 Conductor Dimensions
 * NEC Chapter 9, Table 5
 */
export const XHHW_DIMENSIONS: ConductorDimensions[] = [
  { size: '14 AWG', type: 'XHHW', area: 0.0097, diameter: 0.111 },
  { size: '12 AWG', type: 'XHHW', area: 0.0133, diameter: 0.130 },
  { size: '10 AWG', type: 'XHHW', area: 0.0211, diameter: 0.164 },
  { size: '8 AWG', type: 'XHHW', area: 0.0366, diameter: 0.216 },
  { size: '6 AWG', type: 'XHHW', area: 0.0507, diameter: 0.254 },
  { size: '4 AWG', type: 'XHHW', area: 0.0824, diameter: 0.324 },
  { size: '3 AWG', type: 'XHHW', area: 0.0973, diameter: 0.352 },
  { size: '2 AWG', type: 'XHHW', area: 0.1158, diameter: 0.384 },
  { size: '1 AWG', type: 'XHHW', area: 0.1562, diameter: 0.446 },
  { size: '1/0 AWG', type: 'XHHW', area: 0.1855, diameter: 0.486 },
  { size: '2/0 AWG', type: 'XHHW', area: 0.2223, diameter: 0.532 },
  { size: '3/0 AWG', type: 'XHHW', area: 0.2679, diameter: 0.584 },
  { size: '4/0 AWG', type: 'XHHW', area: 0.3237, diameter: 0.642 },
  { size: '250 kcmil', type: 'XHHW', area: 0.3970, diameter: 0.711 },
  { size: '300 kcmil', type: 'XHHW', area: 0.4536, diameter: 0.760 },
  { size: '350 kcmil', type: 'XHHW', area: 0.5113, diameter: 0.806 },
  { size: '400 kcmil', type: 'XHHW', area: 0.5863, diameter: 0.864 },
  { size: '500 kcmil', type: 'XHHW', area: 0.7073, diameter: 0.949 },
  { size: '600 kcmil', type: 'XHHW', area: 0.8316, diameter: 1.030 },
  { size: '750 kcmil', type: 'XHHW', area: 1.0038, diameter: 1.131 },
  { size: '1000 kcmil', type: 'XHHW', area: 1.2752, diameter: 1.274 },
];

/**
 * Get conductor dimensions by size and type
 */
export function getConductorDimensions(
  size: string,
  type: 'THHN' | 'THW' | 'XHHW'
): ConductorDimensions | null {
  const dimensionsTable = {
    'THHN': THHN_DIMENSIONS,
    'THW': THW_DIMENSIONS,
    'XHHW': XHHW_DIMENSIONS,
  };

  const table = dimensionsTable[type];
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

export const CONDUIT_TYPES = ['THHN', 'THW', 'XHHW'] as const;
