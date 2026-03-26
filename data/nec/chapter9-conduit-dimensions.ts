/**
 * NEC 2023 Chapter 9, Table 4 - Dimensions and Percent Area of Conduit and Tubing
 * Areas of conduit or tubing for the combinations of wires permitted in Table 1, Chapter 9
 *
 * Fill percentages per NEC Chapter 9 Table 1:
 *   1 conductor: 53%
 *   2 conductors: 31%
 *   3+ conductors: 40%
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
 * NEC 2023 Chapter 9, Table 4
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
  { tradeSize: '5', internalDiameter: 5.391, totalArea: 22.824, area53: 12.097, area31: 7.075, area40: 9.130 },
  { tradeSize: '6', internalDiameter: 6.403, totalArea: 32.180, area53: 17.055, area31: 9.976, area40: 12.872 },
];

/**
 * PVC Schedule 40 dimensions
 * NEC 2023 Chapter 9, Table 4
 */
export const PVC_SCH40_DIMENSIONS: ConduitDimensions[] = [
  { tradeSize: '1/2', internalDiameter: 0.602, totalArea: 0.285, area53: 0.151, area31: 0.088, area40: 0.114 },
  { tradeSize: '3/4', internalDiameter: 0.804, totalArea: 0.508, area53: 0.269, area31: 0.157, area40: 0.203 },
  { tradeSize: '1', internalDiameter: 1.029, totalArea: 0.832, area53: 0.441, area31: 0.258, area40: 0.333 },
  { tradeSize: '1-1/4', internalDiameter: 1.360, totalArea: 1.453, area53: 0.770, area31: 0.450, area40: 0.581 },
  { tradeSize: '1-1/2', internalDiameter: 1.590, totalArea: 1.986, area53: 1.053, area31: 0.616, area40: 0.794 },
  { tradeSize: '2', internalDiameter: 2.047, totalArea: 3.291, area53: 1.744, area31: 1.020, area40: 1.316 },
  { tradeSize: '2-1/2', internalDiameter: 2.445, totalArea: 4.695, area53: 2.488, area31: 1.455, area40: 1.878 },
  { tradeSize: '3', internalDiameter: 3.042, totalArea: 7.268, area53: 3.852, area31: 2.253, area40: 2.907 },
  { tradeSize: '3-1/2', internalDiameter: 3.521, totalArea: 9.737, area53: 5.161, area31: 3.018, area40: 3.895 },
  { tradeSize: '4', internalDiameter: 3.998, totalArea: 12.554, area53: 6.654, area31: 3.892, area40: 5.022 },
  { tradeSize: '5', internalDiameter: 5.016, totalArea: 19.761, area53: 10.473, area31: 6.126, area40: 7.904 },
  { tradeSize: '6', internalDiameter: 6.031, totalArea: 28.567, area53: 15.140, area31: 8.856, area40: 11.427 },
];

/**
 * PVC Schedule 80 dimensions
 * NEC 2023 Chapter 9, Table 4
 * Thicker walls = smaller ID than Schedule 40
 */
export const PVC_SCH80_DIMENSIONS: ConduitDimensions[] = [
  { tradeSize: '1/2', internalDiameter: 0.526, totalArea: 0.217, area53: 0.115, area31: 0.067, area40: 0.087 },
  { tradeSize: '3/4', internalDiameter: 0.722, totalArea: 0.409, area53: 0.217, area31: 0.127, area40: 0.164 },
  { tradeSize: '1', internalDiameter: 0.936, totalArea: 0.688, area53: 0.365, area31: 0.213, area40: 0.275 },
  { tradeSize: '1-1/4', internalDiameter: 1.255, totalArea: 1.237, area53: 0.656, area31: 0.383, area40: 0.495 },
  { tradeSize: '1-1/2', internalDiameter: 1.476, totalArea: 1.711, area53: 0.907, area31: 0.530, area40: 0.684 },
  { tradeSize: '2', internalDiameter: 1.913, totalArea: 2.874, area53: 1.523, area31: 0.891, area40: 1.150 },
  { tradeSize: '2-1/2', internalDiameter: 2.290, totalArea: 4.119, area53: 2.183, area31: 1.277, area40: 1.647 },
  { tradeSize: '3', internalDiameter: 2.864, totalArea: 6.442, area53: 3.414, area31: 1.997, area40: 2.577 },
  { tradeSize: '3-1/2', internalDiameter: 3.326, totalArea: 8.688, area53: 4.605, area31: 2.693, area40: 3.475 },
  { tradeSize: '4', internalDiameter: 3.786, totalArea: 11.258, area53: 5.967, area31: 3.490, area40: 4.503 },
  { tradeSize: '5', internalDiameter: 4.768, totalArea: 17.855, area53: 9.463, area31: 5.535, area40: 7.142 },
  { tradeSize: '6', internalDiameter: 5.709, totalArea: 25.598, area53: 13.567, area31: 7.935, area40: 10.239 },
];

/**
 * RMC (Rigid Metal Conduit) dimensions
 * NEC 2023 Chapter 9, Table 4
 * Note: RMC has DIFFERENT internal diameters from PVC Schedule 40
 */
export const RMC_DIMENSIONS: ConduitDimensions[] = [
  { tradeSize: '1/2', internalDiameter: 0.632, totalArea: 0.314, area53: 0.166, area31: 0.097, area40: 0.125 },
  { tradeSize: '3/4', internalDiameter: 0.836, totalArea: 0.549, area53: 0.291, area31: 0.170, area40: 0.220 },
  { tradeSize: '1', internalDiameter: 1.063, totalArea: 0.887, area53: 0.470, area31: 0.275, area40: 0.355 },
  { tradeSize: '1-1/4', internalDiameter: 1.394, totalArea: 1.526, area53: 0.809, area31: 0.473, area40: 0.610 },
  { tradeSize: '1-1/2', internalDiameter: 1.624, totalArea: 2.071, area53: 1.098, area31: 0.642, area40: 0.829 },
  { tradeSize: '2', internalDiameter: 2.083, totalArea: 3.408, area53: 1.806, area31: 1.056, area40: 1.363 },
  { tradeSize: '2-1/2', internalDiameter: 2.489, totalArea: 4.866, area53: 2.579, area31: 1.508, area40: 1.946 },
  { tradeSize: '3', internalDiameter: 3.090, totalArea: 7.499, area53: 3.974, area31: 2.325, area40: 3.000 },
  { tradeSize: '3-1/2', internalDiameter: 3.570, totalArea: 10.010, area53: 5.305, area31: 3.103, area40: 4.004 },
  { tradeSize: '4', internalDiameter: 4.050, totalArea: 12.882, area53: 6.827, area31: 3.994, area40: 5.153 },
  { tradeSize: '5', internalDiameter: 5.073, totalArea: 20.212, area53: 10.712, area31: 6.266, area40: 8.085 },
  { tradeSize: '6', internalDiameter: 6.093, totalArea: 29.158, area53: 15.454, area31: 9.039, area40: 11.663 },
];

/**
 * IMC (Intermediate Metal Conduit) dimensions
 * NEC 2023 Chapter 9, Table 4
 */
export const IMC_DIMENSIONS: ConduitDimensions[] = [
  { tradeSize: '1/2', internalDiameter: 0.660, totalArea: 0.342, area53: 0.181, area31: 0.106, area40: 0.137 },
  { tradeSize: '3/4', internalDiameter: 0.864, totalArea: 0.586, area53: 0.311, area31: 0.182, area40: 0.235 },
  { tradeSize: '1', internalDiameter: 1.105, totalArea: 0.959, area53: 0.508, area31: 0.297, area40: 0.384 },
  { tradeSize: '1-1/4', internalDiameter: 1.448, totalArea: 1.647, area53: 0.873, area31: 0.510, area40: 0.659 },
  { tradeSize: '1-1/2', internalDiameter: 1.683, totalArea: 2.225, area53: 1.179, area31: 0.690, area40: 0.890 },
  { tradeSize: '2', internalDiameter: 2.150, totalArea: 3.630, area53: 1.924, area31: 1.125, area40: 1.452 },
  { tradeSize: '2-1/2', internalDiameter: 2.557, totalArea: 5.135, area53: 2.722, area31: 1.592, area40: 2.054 },
  { tradeSize: '3', internalDiameter: 3.176, totalArea: 7.922, area53: 4.199, area31: 2.456, area40: 3.169 },
  { tradeSize: '3-1/2', internalDiameter: 3.671, totalArea: 10.584, area53: 5.610, area31: 3.281, area40: 4.234 },
  { tradeSize: '4', internalDiameter: 4.166, totalArea: 13.631, area53: 7.224, area31: 4.226, area40: 5.452 },
];

/**
 * Get conduit dimensions by trade size and type
 */
export function getConduitDimensions(
  tradeSize: string,
  conduitType: 'EMT' | 'PVC-40' | 'PVC-80' | 'RMC' | 'IMC'
): ConduitDimensions | null {
  const dimensionsTable = {
    'EMT': EMT_DIMENSIONS,
    'PVC-40': PVC_SCH40_DIMENSIONS,
    'PVC-80': PVC_SCH80_DIMENSIONS,
    'RMC': RMC_DIMENSIONS,
    'IMC': IMC_DIMENSIONS,
  };

  const table = dimensionsTable[conduitType];
  return table.find(d => d.tradeSize === tradeSize) || null;
}
