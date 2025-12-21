/**
 * NEC Chapter 9, Table 4 - Dimensions and Percent Area of Conduit and Tubing
 * Areas of conduit or tubing for the combinations of wires permitted in Table 1, Chapter 9
 *
 * Trade sizes in inches, areas in square inches
 */

export interface ConduitDimensions {
  tradeSize: string;
  /** Internal diameter in inches */
  internalDiameter: number;
  /** Total area in square inches (100%) */
  totalArea: number;
  /** Maximum fill area at 53% (1 wire) */
  area53: number;
  /** Maximum fill area at 31% (2 wires) */
  area31: number;
  /** Maximum fill area at 40% (3+ wires) */
  area40: number;
}

/**
 * EMT (Electrical Metallic Tubing) dimensions
 * NEC Chapter 9, Table 4
 */
export const EMT_DIMENSIONS: ConduitDimensions[] = [
  { tradeSize: '1/2', internalDiameter: 0.622, totalArea: 0.304, area53: 0.161, area31: 0.094, area40: 0.122 },
  { tradeSize: '3/4', internalDiameter: 0.824, totalArea: 0.533, area53: 0.283, area31: 0.165, area40: 0.213 },
  { tradeSize: '1', internalDiameter: 1.049, totalArea: 0.864, area53: 0.458, area31: 0.268, area40: 0.346 },
  { tradeSize: '1-1/4', internalDiameter: 1.380, totalArea: 1.496, area53: 0.793, area31: 0.464, area40: 0.598 },
  { tradeSize: '1-1/2', internalDiameter: 1.610, totalArea: 2.036, area53: 1.079, area31: 0.631, area40: 0.814 },
  { tradeSize: '2', internalDiameter: 2.067, totalArea: 3.356, area53: 1.779, area31: 1.040, area40: 1.342 },
  { tradeSize: '2-1/2', internalDiameter: 2.731, totalArea: 5.858, area53: 3.105, area31: 1.816, area40: 2.343 },
  { tradeSize: '3', internalDiameter: 3.356, totalArea: 8.846, area53: 4.688, area31: 2.742, area40: 3.538 },
  { tradeSize: '3-1/2', internalDiameter: 3.834, totalArea: 11.545, area53: 6.119, area31: 3.579, area40: 4.618 },
  { tradeSize: '4', internalDiameter: 4.334, totalArea: 14.753, area53: 7.819, area31: 4.573, area40: 5.901 },
];

/**
 * PVC Schedule 40 dimensions
 * NEC Chapter 9, Table 4
 */
export const PVC_SCH40_DIMENSIONS: ConduitDimensions[] = [
  { tradeSize: '1/2', internalDiameter: 0.622, totalArea: 0.304, area53: 0.161, area31: 0.094, area40: 0.122 },
  { tradeSize: '3/4', internalDiameter: 0.824, totalArea: 0.533, area53: 0.283, area31: 0.165, area40: 0.213 },
  { tradeSize: '1', internalDiameter: 1.049, totalArea: 0.864, area53: 0.458, area31: 0.268, area40: 0.346 },
  { tradeSize: '1-1/4', internalDiameter: 1.380, totalArea: 1.496, area53: 0.793, area31: 0.464, area40: 0.598 },
  { tradeSize: '1-1/2', internalDiameter: 1.610, totalArea: 2.036, area53: 1.079, area31: 0.631, area40: 0.814 },
  { tradeSize: '2', internalDiameter: 2.067, totalArea: 3.356, area53: 1.779, area31: 1.040, area40: 1.342 },
  { tradeSize: '2-1/2', internalDiameter: 2.469, totalArea: 4.788, area53: 2.538, area31: 1.484, area40: 1.915 },
  { tradeSize: '3', internalDiameter: 3.068, totalArea: 7.393, area53: 3.918, area31: 2.292, area40: 2.957 },
  { tradeSize: '3-1/2', internalDiameter: 3.548, totalArea: 9.887, area53: 5.240, area31: 3.065, area40: 3.955 },
  { tradeSize: '4', internalDiameter: 4.026, totalArea: 12.729, area53: 6.746, area31: 3.946, area40: 5.092 },
];

/**
 * RMC (Rigid Metal Conduit) dimensions
 * NEC Chapter 9, Table 4
 */
export const RMC_DIMENSIONS: ConduitDimensions[] = [
  { tradeSize: '1/2', internalDiameter: 0.622, totalArea: 0.304, area53: 0.161, area31: 0.094, area40: 0.122 },
  { tradeSize: '3/4', internalDiameter: 0.824, totalArea: 0.533, area53: 0.283, area31: 0.165, area40: 0.213 },
  { tradeSize: '1', internalDiameter: 1.049, totalArea: 0.864, area53: 0.458, area31: 0.268, area40: 0.346 },
  { tradeSize: '1-1/4', internalDiameter: 1.380, totalArea: 1.496, area53: 0.793, area31: 0.464, area40: 0.598 },
  { tradeSize: '1-1/2', internalDiameter: 1.610, totalArea: 2.036, area53: 1.079, area31: 0.631, area40: 0.814 },
  { tradeSize: '2', internalDiameter: 2.067, totalArea: 3.356, area53: 1.779, area31: 1.040, area40: 1.342 },
  { tradeSize: '2-1/2', internalDiameter: 2.469, totalArea: 4.788, area53: 2.538, area31: 1.484, area40: 1.915 },
  { tradeSize: '3', internalDiameter: 3.068, totalArea: 7.393, area53: 3.918, area31: 2.292, area40: 2.957 },
  { tradeSize: '3-1/2', internalDiameter: 3.548, totalArea: 9.887, area53: 5.240, area31: 3.065, area40: 3.955 },
  { tradeSize: '4', internalDiameter: 4.026, totalArea: 12.729, area53: 6.746, area31: 3.946, area40: 5.092 },
];

/**
 * Get conduit dimensions by trade size and type
 */
export function getConduitDimensions(
  tradeSize: string,
  conduitType: 'EMT' | 'PVC-40' | 'RMC'
): ConduitDimensions | null {
  const dimensionsTable = {
    'EMT': EMT_DIMENSIONS,
    'PVC-40': PVC_SCH40_DIMENSIONS,
    'RMC': RMC_DIMENSIONS,
  };

  const table = dimensionsTable[conduitType];
  return table.find(d => d.tradeSize === tradeSize) || null;
}
