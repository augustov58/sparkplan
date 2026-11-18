import { ConductorImpedance } from '../../types/nec-types';

/**
 * NEC Chapter 9 Table 9 - AC Resistance and Reactance for 600V Cables
 * 3-Phase, 60 Hz, 75°C - Three Single Conductors in Conduit
 * Effective Z at 0.85 PF
 * 2023 NEC Edition
 *
 * R and XL per the NEC 2023 book, p. 70-726 (NFPA text in the Obsidian vault;
 * imperial rows checked against the metric rows), for PVC, aluminum and steel
 * conduit (#258). XL for PVC and aluminum conduit share the book's column.
 * effectiveZ is Note 2's R × 0.85 + XL × sin(arccos 0.85) from those values;
 * voltage drop computes it at the circuit's PF (#219), so the column is a
 * reference only. Pinned by tests/table9Book258.test.ts.
 *
 * This table provides the actual AC impedance values for conductors, which
 * is more accurate than DC resistance K-factors. AC impedance includes both
 * resistance (R) and inductive reactance (XL), which varies with conductor size.
 *
 * Using these values for voltage drop calculations is significantly more accurate
 * than simplified K-factor methods, especially for large conductors and long runs.
 */
export const CHAPTER_9_TABLE_9: ConductorImpedance[] = [
  // Copper in PVC conduit
  { size: '14 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 3.1, reactanceXLOhmsPerKFt: 0.058, effectiveZ: 2.6656 },
  { size: '12 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 2, reactanceXLOhmsPerKFt: 0.054, effectiveZ: 1.7284 },
  { size: '10 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 1.2, reactanceXLOhmsPerKFt: 0.05, effectiveZ: 1.0463 },
  { size: '8 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.78, reactanceXLOhmsPerKFt: 0.052, effectiveZ: 0.6904 },
  { size: '6 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.49, reactanceXLOhmsPerKFt: 0.051, effectiveZ: 0.4434 },
  { size: '4 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.31, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.2888 },
  { size: '3 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.25, reactanceXLOhmsPerKFt: 0.047, effectiveZ: 0.2373 },
  { size: '2 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.19, reactanceXLOhmsPerKFt: 0.045, effectiveZ: 0.1852 },
  { size: '1 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.15, reactanceXLOhmsPerKFt: 0.046, effectiveZ: 0.1517 },
  { size: '1/0 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.12, reactanceXLOhmsPerKFt: 0.044, effectiveZ: 0.1252 },
  { size: '2/0 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.1, reactanceXLOhmsPerKFt: 0.043, effectiveZ: 0.1077 },
  { size: '3/0 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.077, reactanceXLOhmsPerKFt: 0.042, effectiveZ: 0.0876 },
  { size: '4/0 AWG', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.062, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.0743 },
  { size: '250 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.052, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.0658 },
  { size: '300 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.044, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.059 },
  { size: '350 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.038, reactanceXLOhmsPerKFt: 0.04, effectiveZ: 0.0534 },
  { size: '400 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.033, reactanceXLOhmsPerKFt: 0.04, effectiveZ: 0.0491 },
  { size: '500 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.027, reactanceXLOhmsPerKFt: 0.039, effectiveZ: 0.0435 },
  { size: '600 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.023, reactanceXLOhmsPerKFt: 0.039, effectiveZ: 0.0401 },
  { size: '750 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.019, reactanceXLOhmsPerKFt: 0.038, effectiveZ: 0.0362 },
  { size: '1000 kcmil', material: 'Cu', conduitType: 'PVC', resistanceOhmsPerKFt: 0.015, reactanceXLOhmsPerKFt: 0.037, effectiveZ: 0.0322 },
  // Copper in aluminum conduit
  { size: '14 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 3.1, reactanceXLOhmsPerKFt: 0.058, effectiveZ: 2.6656 },
  { size: '12 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 2, reactanceXLOhmsPerKFt: 0.054, effectiveZ: 1.7284 },
  { size: '10 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 1.2, reactanceXLOhmsPerKFt: 0.05, effectiveZ: 1.0463 },
  { size: '8 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.78, reactanceXLOhmsPerKFt: 0.052, effectiveZ: 0.6904 },
  { size: '6 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.49, reactanceXLOhmsPerKFt: 0.051, effectiveZ: 0.4434 },
  { size: '4 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.31, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.2888 },
  { size: '3 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.25, reactanceXLOhmsPerKFt: 0.047, effectiveZ: 0.2373 },
  { size: '2 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.2, reactanceXLOhmsPerKFt: 0.045, effectiveZ: 0.1937 },
  { size: '1 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.16, reactanceXLOhmsPerKFt: 0.046, effectiveZ: 0.1602 },
  { size: '1/0 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.13, reactanceXLOhmsPerKFt: 0.044, effectiveZ: 0.1337 },
  { size: '2/0 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.1, reactanceXLOhmsPerKFt: 0.043, effectiveZ: 0.1077 },
  { size: '3/0 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.082, reactanceXLOhmsPerKFt: 0.042, effectiveZ: 0.0918 },
  { size: '4/0 AWG', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.067, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.0785 },
  { size: '250 kcmil', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.057, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.07 },
  { size: '300 kcmil', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.049, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.0632 },
  { size: '350 kcmil', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.043, reactanceXLOhmsPerKFt: 0.04, effectiveZ: 0.0576 },
  { size: '400 kcmil', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.038, reactanceXLOhmsPerKFt: 0.04, effectiveZ: 0.0534 },
  { size: '500 kcmil', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.032, reactanceXLOhmsPerKFt: 0.039, effectiveZ: 0.0477 },
  { size: '600 kcmil', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.028, reactanceXLOhmsPerKFt: 0.039, effectiveZ: 0.0443 },
  { size: '750 kcmil', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.024, reactanceXLOhmsPerKFt: 0.038, effectiveZ: 0.0404 },
  { size: '1000 kcmil', material: 'Cu', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.019, reactanceXLOhmsPerKFt: 0.037, effectiveZ: 0.0356 },
  // Copper in Steel conduit
  { size: '14 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 3.1, reactanceXLOhmsPerKFt: 0.073, effectiveZ: 2.6735 },
  { size: '12 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 2, reactanceXLOhmsPerKFt: 0.068, effectiveZ: 1.7358 },
  { size: '10 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 1.2, reactanceXLOhmsPerKFt: 0.063, effectiveZ: 1.0532 },
  { size: '8 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.78, reactanceXLOhmsPerKFt: 0.065, effectiveZ: 0.6972 },
  { size: '6 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.49, reactanceXLOhmsPerKFt: 0.064, effectiveZ: 0.4502 },
  { size: '4 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.31, reactanceXLOhmsPerKFt: 0.06, effectiveZ: 0.2951 },
  { size: '3 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.25, reactanceXLOhmsPerKFt: 0.059, effectiveZ: 0.2436 },
  { size: '2 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.2, reactanceXLOhmsPerKFt: 0.057, effectiveZ: 0.2 },
  { size: '1 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.16, reactanceXLOhmsPerKFt: 0.057, effectiveZ: 0.166 },
  { size: '1/0 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.12, reactanceXLOhmsPerKFt: 0.055, effectiveZ: 0.131 },
  { size: '2/0 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.1, reactanceXLOhmsPerKFt: 0.054, effectiveZ: 0.1134 },
  { size: '3/0 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.079, reactanceXLOhmsPerKFt: 0.052, effectiveZ: 0.0945 },
  { size: '4/0 AWG', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.063, reactanceXLOhmsPerKFt: 0.051, effectiveZ: 0.0804 },
  { size: '250 kcmil', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.054, reactanceXLOhmsPerKFt: 0.052, effectiveZ: 0.0733 },
  { size: '300 kcmil', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.045, reactanceXLOhmsPerKFt: 0.051, effectiveZ: 0.0651 },
  { size: '350 kcmil', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.039, reactanceXLOhmsPerKFt: 0.05, effectiveZ: 0.0595 },
  { size: '400 kcmil', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.035, reactanceXLOhmsPerKFt: 0.049, effectiveZ: 0.0556 },
  { size: '500 kcmil', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.029, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.0499 },
  { size: '600 kcmil', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.025, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.0465 },
  { size: '750 kcmil', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.021, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.0431 },
  { size: '1000 kcmil', material: 'Cu', conduitType: 'Steel', resistanceOhmsPerKFt: 0.018, reactanceXLOhmsPerKFt: 0.046, effectiveZ: 0.0395 },
  // Aluminum in PVC conduit
  { size: '12 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 3.2, reactanceXLOhmsPerKFt: 0.054, effectiveZ: 2.7484 },
  { size: '10 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 2, reactanceXLOhmsPerKFt: 0.05, effectiveZ: 1.7263 },
  { size: '8 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 1.3, reactanceXLOhmsPerKFt: 0.052, effectiveZ: 1.1324 },
  { size: '6 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.81, reactanceXLOhmsPerKFt: 0.051, effectiveZ: 0.7154 },
  { size: '4 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.51, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.4588 },
  { size: '3 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.4, reactanceXLOhmsPerKFt: 0.047, effectiveZ: 0.3648 },
  { size: '2 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.32, reactanceXLOhmsPerKFt: 0.045, effectiveZ: 0.2957 },
  { size: '1 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.25, reactanceXLOhmsPerKFt: 0.046, effectiveZ: 0.2367 },
  { size: '1/0 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.2, reactanceXLOhmsPerKFt: 0.044, effectiveZ: 0.1932 },
  { size: '2/0 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.16, reactanceXLOhmsPerKFt: 0.043, effectiveZ: 0.1587 },
  { size: '3/0 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.13, reactanceXLOhmsPerKFt: 0.042, effectiveZ: 0.1326 },
  { size: '4/0 AWG', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.1, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.1066 },
  { size: '250 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.085, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.0938 },
  { size: '300 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.071, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.0819 },
  { size: '350 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.061, reactanceXLOhmsPerKFt: 0.04, effectiveZ: 0.0729 },
  { size: '400 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.054, reactanceXLOhmsPerKFt: 0.04, effectiveZ: 0.067 },
  { size: '500 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.043, reactanceXLOhmsPerKFt: 0.039, effectiveZ: 0.0571 },
  { size: '600 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.036, reactanceXLOhmsPerKFt: 0.039, effectiveZ: 0.0511 },
  { size: '750 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.029, reactanceXLOhmsPerKFt: 0.038, effectiveZ: 0.0447 },
  { size: '1000 kcmil', material: 'Al', conduitType: 'PVC', resistanceOhmsPerKFt: 0.023, reactanceXLOhmsPerKFt: 0.037, effectiveZ: 0.039 },
  // Aluminum in aluminum conduit
  { size: '12 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 3.2, reactanceXLOhmsPerKFt: 0.054, effectiveZ: 2.7484 },
  { size: '10 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 2, reactanceXLOhmsPerKFt: 0.05, effectiveZ: 1.7263 },
  { size: '8 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 1.3, reactanceXLOhmsPerKFt: 0.052, effectiveZ: 1.1324 },
  { size: '6 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.81, reactanceXLOhmsPerKFt: 0.051, effectiveZ: 0.7154 },
  { size: '4 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.51, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.4588 },
  { size: '3 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.41, reactanceXLOhmsPerKFt: 0.047, effectiveZ: 0.3733 },
  { size: '2 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.32, reactanceXLOhmsPerKFt: 0.045, effectiveZ: 0.2957 },
  { size: '1 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.26, reactanceXLOhmsPerKFt: 0.046, effectiveZ: 0.2452 },
  { size: '1/0 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.21, reactanceXLOhmsPerKFt: 0.044, effectiveZ: 0.2017 },
  { size: '2/0 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.16, reactanceXLOhmsPerKFt: 0.043, effectiveZ: 0.1587 },
  { size: '3/0 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.13, reactanceXLOhmsPerKFt: 0.042, effectiveZ: 0.1326 },
  { size: '4/0 AWG', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.11, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.1151 },
  { size: '250 kcmil', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.09, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.0981 },
  { size: '300 kcmil', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.076, reactanceXLOhmsPerKFt: 0.041, effectiveZ: 0.0862 },
  { size: '350 kcmil', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.066, reactanceXLOhmsPerKFt: 0.04, effectiveZ: 0.0772 },
  { size: '400 kcmil', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.059, reactanceXLOhmsPerKFt: 0.04, effectiveZ: 0.0712 },
  { size: '500 kcmil', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.048, reactanceXLOhmsPerKFt: 0.039, effectiveZ: 0.0613 },
  { size: '600 kcmil', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.041, reactanceXLOhmsPerKFt: 0.039, effectiveZ: 0.0554 },
  { size: '750 kcmil', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.034, reactanceXLOhmsPerKFt: 0.038, effectiveZ: 0.0489 },
  { size: '1000 kcmil', material: 'Al', conduitType: 'Aluminum', resistanceOhmsPerKFt: 0.027, reactanceXLOhmsPerKFt: 0.037, effectiveZ: 0.0424 },
  // Aluminum in Steel conduit
  { size: '12 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 3.2, reactanceXLOhmsPerKFt: 0.068, effectiveZ: 2.7558 },
  { size: '10 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 2, reactanceXLOhmsPerKFt: 0.063, effectiveZ: 1.7332 },
  { size: '8 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 1.3, reactanceXLOhmsPerKFt: 0.065, effectiveZ: 1.1392 },
  { size: '6 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.81, reactanceXLOhmsPerKFt: 0.064, effectiveZ: 0.7222 },
  { size: '4 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.51, reactanceXLOhmsPerKFt: 0.06, effectiveZ: 0.4651 },
  { size: '3 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.4, reactanceXLOhmsPerKFt: 0.059, effectiveZ: 0.3711 },
  { size: '2 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.32, reactanceXLOhmsPerKFt: 0.057, effectiveZ: 0.302 },
  { size: '1 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.25, reactanceXLOhmsPerKFt: 0.057, effectiveZ: 0.2425 },
  { size: '1/0 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.2, reactanceXLOhmsPerKFt: 0.055, effectiveZ: 0.199 },
  { size: '2/0 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.16, reactanceXLOhmsPerKFt: 0.054, effectiveZ: 0.1644 },
  { size: '3/0 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.13, reactanceXLOhmsPerKFt: 0.052, effectiveZ: 0.1379 },
  { size: '4/0 AWG', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.1, reactanceXLOhmsPerKFt: 0.051, effectiveZ: 0.1119 },
  { size: '250 kcmil', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.086, reactanceXLOhmsPerKFt: 0.052, effectiveZ: 0.1005 },
  { size: '300 kcmil', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.072, reactanceXLOhmsPerKFt: 0.051, effectiveZ: 0.0881 },
  { size: '350 kcmil', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.063, reactanceXLOhmsPerKFt: 0.05, effectiveZ: 0.0799 },
  { size: '400 kcmil', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.055, reactanceXLOhmsPerKFt: 0.049, effectiveZ: 0.0726 },
  { size: '500 kcmil', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.045, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.0635 },
  { size: '600 kcmil', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.038, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.0576 },
  { size: '750 kcmil', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.031, reactanceXLOhmsPerKFt: 0.048, effectiveZ: 0.0516 },
  { size: '1000 kcmil', material: 'Al', conduitType: 'Steel', resistanceOhmsPerKFt: 0.025, reactanceXLOhmsPerKFt: 0.046, effectiveZ: 0.0455 }
];

/**
 * Get conductor impedance data for voltage drop calculations
 *
 * @param size - Conductor size (e.g., "12 AWG", "250 kcmil")
 * @param material - Conductor material ('Cu' or 'Al')
 * @param conduitType - Conduit type (defaults to 'PVC')
 * @returns ConductorImpedance object with R, XL, and effective Z values, or null if not found
 *
 * @example
 * const impedance = getConductorImpedance('12 AWG', 'Cu', 'PVC');
 * // impedance.resistanceOhmsPerKFt = 2.0
 * // impedance.reactanceXLOhmsPerKFt = 0.054
 * // impedance.effectiveZ = 1.7284
 */
export function getConductorImpedance(
  size: string,
  material: 'Cu' | 'Al',
  conduitType: 'PVC' | 'Aluminum' | 'Steel' = 'PVC'
): ConductorImpedance | null {
  return CHAPTER_9_TABLE_9.find(
    e => e.size === size && e.material === material && e.conduitType === conduitType
  ) || null;
}
