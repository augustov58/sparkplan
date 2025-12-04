/**
 * Solar PV Calculator - NEC Article 690
 * Photovoltaic Systems
 * 2023 NEC Edition
 */

import { getNextStandardBreakerSize } from '../../data/nec/standard-breakers';

/**
 * Inverter types for grid-tied systems
 */
export type InverterType = 'string' | 'microinverter' | 'dc_optimized';

export interface SolarPVInput {
  // System sizing
  systemSize_kW: number;           // Total DC system size
  numPanels: number;               // Number of PV panels
  panelWatts: number;              // Watts per panel
  panelVoc: number;                // Open circuit voltage per panel
  panelIsc: number;                // Short circuit current per panel
  
  // String configuration
  panelsPerString: number;         // Panels in series per string
  numStrings: number;              // Number of parallel strings
  
  // Inverter
  inverterType: InverterType;
  inverterPower_kW: number;        // Inverter AC output
  inverterMaxVdc: number;          // Maximum DC input voltage
  inverterMaxIdc: number;          // Maximum DC input current
  
  // AC connection
  acVoltage: number;               // 240 or 208 typically
  acPhase: 1 | 3;
  
  // Installation
  roofType: 'flush_mount' | 'rack_mount' | 'ground_mount';
  conductorMaterial: 'Cu' | 'Al';
  dcCircuitLength_ft: number;      // One-way DC wiring length
  acCircuitLength_ft: number;      // AC connection length to panel
}

export interface SolarPVResult {
  // DC Side
  stringVoc: number;               // String open circuit voltage
  stringVocCorrected: number;      // Temperature corrected Voc
  stringIsc: number;               // String short circuit current
  dcOcpdRating: number;            // DC overcurrent protection rating
  dcConductorSize: string;         // DC wiring size
  dcVoltageDrop: number;           // DC voltage drop %
  
  // AC Side
  acCurrent: number;               // Inverter output current
  acOcpdRating: number;            // AC breaker rating
  acConductorSize: string;         // AC wiring size
  acVoltageDrop: number;           // AC voltage drop %
  
  // System Compliance
  meetsNec120Rule: boolean;        // NEC 705.12(B)(2) - 120% rule check
  maxBackfeedAmps: number;         // Maximum backfeed current allowed
  
  // Efficiency estimates
  estimatedAnnualProduction_kWh: number;
  estimatedMonthlyProduction_kWh: number;
  
  // NEC references and notes
  necReferences: string[];
  warnings: string[];
  notes: string[];
}

/**
 * Temperature correction factors for Voc
 * Per NEC 690.7(A) - based on lowest expected ambient temperature
 */
const TEMPERATURE_CORRECTION_VOC: Record<number, number> = {
  '-40': 1.25,
  '-35': 1.21,
  '-30': 1.18,
  '-25': 1.14,
  '-20': 1.11,
  '-15': 1.08,
  '-10': 1.05,
  '-5': 1.02,
  '0': 1.00,
  '5': 0.97,
  '10': 0.94,
  '15': 0.91,
  '20': 0.88,
  '25': 0.85,
};

/**
 * Calculate Solar PV system requirements per NEC Article 690
 * 
 * Key NEC requirements:
 * - NEC 690.7: Maximum Voltage
 * - NEC 690.8: Circuit Sizing and Current
 * - NEC 690.9: Overcurrent Protection
 * - NEC 705.12: Point of Connection (120% rule)
 * 
 * @param input - Solar PV calculation parameters
 * @returns Complete PV system calculation result
 */
export function calculateSolarPV(input: SolarPVInput): SolarPVResult {
  const necReferences: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  // ============================================
  // DC SIDE CALCULATIONS
  // ============================================

  // NEC 690.7: Maximum System Voltage
  // String Voc = panels per string × panel Voc
  const stringVoc = input.panelsPerString * input.panelVoc;
  necReferences.push('NEC 690.7(A) - Maximum System Voltage');

  // Temperature correction for Voc (assume -10°C lowest ambient)
  const tempCorrection = TEMPERATURE_CORRECTION_VOC['-10'] || 1.05;
  const stringVocCorrected = stringVoc * tempCorrection;
  
  notes.push(
    `String Voc corrected for low temperature (-10°C): ${stringVoc.toFixed(1)}V × ${tempCorrection} = ${stringVocCorrected.toFixed(1)}V`
  );

  // Verify inverter voltage compatibility
  if (stringVocCorrected > input.inverterMaxVdc) {
    warnings.push(
      `⚠️ CRITICAL: Corrected string Voc (${stringVocCorrected.toFixed(1)}V) exceeds inverter max DC voltage (${input.inverterMaxVdc}V). ` +
      `Reduce panels per string.`
    );
  }

  // NEC 690.8: Circuit Current
  // String Isc with 1.25 multiplier for continuous load
  const stringIsc = input.panelIsc; // For series string, current is same as single panel
  const totalDcCurrent = stringIsc * input.numStrings;
  const dcDesignCurrent = totalDcCurrent * 1.25;
  necReferences.push('NEC 690.8(A)(1) - DC Circuit Current (125% of Isc)');

  // NEC 690.9: DC Overcurrent Protection
  // Size at 1.56 × Isc for series fuse (1.25 × 1.25)
  const dcOcpdRating = getNextStandardBreakerSize(stringIsc * 1.56);
  necReferences.push('NEC 690.9(B) - DC OCPD Rating (156% of Isc)');

  // DC Conductor Sizing (at 156% of Isc)
  const dcConductorSize = getConductorSize(dcDesignCurrent, input.conductorMaterial);

  // DC Voltage Drop
  const dcVoltageDrop = calculateVoltageDrop(
    dcConductorSize,
    input.conductorMaterial,
    input.dcCircuitLength_ft,
    totalDcCurrent,
    stringVoc,
    1 // DC is single-phase
  );

  if (dcVoltageDrop > 2) {
    warnings.push(
      `⚠️ DC voltage drop (${dcVoltageDrop.toFixed(2)}%) exceeds 2% recommendation. ` +
      `Consider upsizing DC conductors.`
    );
  }

  // ============================================
  // AC SIDE CALCULATIONS
  // ============================================

  // AC Current from inverter
  let acCurrent: number;
  if (input.acPhase === 1) {
    acCurrent = (input.inverterPower_kW * 1000) / input.acVoltage;
  } else {
    acCurrent = (input.inverterPower_kW * 1000) / (Math.sqrt(3) * input.acVoltage);
  }

  // NEC 690.8: AC circuit sizing at 125% continuous
  const acDesignCurrent = acCurrent * 1.25;
  necReferences.push('NEC 690.8(A)(3) - AC Circuit Current (125% continuous)');

  // AC OCPD Rating
  const acOcpdRating = getNextStandardBreakerSize(acDesignCurrent);

  // AC Conductor Sizing
  const acConductorSize = getConductorSize(acOcpdRating, input.conductorMaterial);

  // AC Voltage Drop
  const acVoltageDrop = calculateVoltageDrop(
    acConductorSize,
    input.conductorMaterial,
    input.acCircuitLength_ft,
    acCurrent,
    input.acVoltage,
    input.acPhase
  );

  if (acVoltageDrop > 2) {
    warnings.push(
      `⚠️ AC voltage drop (${acVoltageDrop.toFixed(2)}%) exceeds 2% recommendation.`
    );
  }

  // ============================================
  // NEC 705.12 - 120% RULE CHECK
  // ============================================

  // For standard residential 200A panel:
  // Maximum PV backfeed = (Bus Rating × 1.20) - Main Breaker Rating
  // Example: (200A × 1.20) - 200A = 40A maximum PV breaker
  const assumedBusRating = 200; // Default assumption for residential
  const maxBackfeedAmps = (assumedBusRating * 1.20) - assumedBusRating;
  const meetsNec120Rule = acOcpdRating <= maxBackfeedAmps;
  
  necReferences.push('NEC 705.12(B)(2) - 120% Rule for Busbar Rating');
  
  if (!meetsNec120Rule) {
    warnings.push(
      `⚠️ PV breaker (${acOcpdRating}A) may exceed 120% rule for standard 200A panel. ` +
      `Verify panel bus rating or consider supply-side connection (NEC 705.12(A)).`
    );
    notes.push(
      'Alternative: Supply-side connection ahead of main breaker per NEC 705.12(A) - ' +
      'no 120% rule limitation but requires separate OCPD.'
    );
  }

  // ============================================
  // PRODUCTION ESTIMATES
  // ============================================

  // Estimate based on typical capacity factor (15-20% for residential)
  const capacityFactor = input.roofType === 'ground_mount' ? 0.18 : 0.16;
  const estimatedAnnualProduction_kWh = input.systemSize_kW * 8760 * capacityFactor;
  const estimatedMonthlyProduction_kWh = estimatedAnnualProduction_kWh / 12;

  notes.push(
    `Production estimate based on ${(capacityFactor * 100).toFixed(0)}% capacity factor. ` +
    `Actual production varies by location, orientation, and shading.`
  );

  // ============================================
  // ADDITIONAL NOTES BY INVERTER TYPE
  // ============================================

  if (input.inverterType === 'microinverter') {
    notes.push('Microinverters: Each panel has independent MPPT. String calculations not applicable.');
    notes.push('NEC 690.9(D): Microinverter output circuits may use 690.9(D) for simplified OCPD.');
  } else if (input.inverterType === 'dc_optimized') {
    notes.push('DC Optimizers: Fixed string voltage output reduces temperature correction concerns.');
  }

  // Rapid shutdown requirement
  necReferences.push('NEC 690.12 - Rapid Shutdown of PV Systems on Buildings');
  notes.push('Rapid shutdown required for building-mounted PV per NEC 690.12.');

  return {
    stringVoc: Math.round(stringVoc * 10) / 10,
    stringVocCorrected: Math.round(stringVocCorrected * 10) / 10,
    stringIsc: Math.round(stringIsc * 100) / 100,
    dcOcpdRating,
    dcConductorSize,
    dcVoltageDrop: Math.round(dcVoltageDrop * 100) / 100,
    
    acCurrent: Math.round(acCurrent * 10) / 10,
    acOcpdRating,
    acConductorSize,
    acVoltageDrop: Math.round(acVoltageDrop * 100) / 100,
    
    meetsNec120Rule,
    maxBackfeedAmps,
    
    estimatedAnnualProduction_kWh: Math.round(estimatedAnnualProduction_kWh),
    estimatedMonthlyProduction_kWh: Math.round(estimatedMonthlyProduction_kWh),
    
    necReferences,
    warnings,
    notes
  };
}

/**
 * Get conductor size based on ampacity (75°C column)
 */
function getConductorSize(amps: number, material: 'Cu' | 'Al'): string {
  const copperSizes: [number, string][] = [
    [15, '14 AWG'], [20, '12 AWG'], [30, '10 AWG'],
    [40, '8 AWG'], [55, '6 AWG'], [70, '4 AWG'],
    [85, '3 AWG'], [95, '2 AWG'], [110, '1 AWG'],
    [130, '1/0 AWG'], [150, '2/0 AWG'], [175, '3/0 AWG'],
    [200, '4/0 AWG'], [230, '250 kcmil'],
  ];

  const aluminumSizes: [number, string][] = [
    [15, '12 AWG'], [25, '10 AWG'], [35, '8 AWG'],
    [45, '6 AWG'], [60, '4 AWG'], [75, '2 AWG'],
    [85, '1 AWG'], [100, '1/0 AWG'], [115, '2/0 AWG'],
    [130, '3/0 AWG'], [155, '4/0 AWG'], [180, '250 kcmil'],
  ];

  const sizes = material === 'Cu' ? copperSizes : aluminumSizes;
  
  for (const [capacity, size] of sizes) {
    if (capacity >= amps) return size;
  }
  
  return '4/0 AWG';
}

/**
 * Calculate voltage drop
 */
function calculateVoltageDrop(
  conductorSize: string,
  material: 'Cu' | 'Al',
  length_ft: number,
  amps: number,
  voltage: number,
  phase: 1 | 3
): number {
  const K = material === 'Cu' ? 12.9 : 21.2;
  
  const circularMils: Record<string, number> = {
    '14 AWG': 4110, '12 AWG': 6530, '10 AWG': 10380,
    '8 AWG': 16510, '6 AWG': 26240, '4 AWG': 41740,
    '3 AWG': 52620, '2 AWG': 66360, '1 AWG': 83690,
    '1/0 AWG': 105600, '2/0 AWG': 133100, '3/0 AWG': 167800,
    '4/0 AWG': 211600, '250 kcmil': 250000,
  };
  
  const cm = circularMils[conductorSize] || 100000;
  const multiplier = phase === 1 ? 2 : Math.sqrt(3);
  
  const vdVolts = (K * length_ft * amps * multiplier) / cm;
  return (vdVolts / voltage) * 100;
}

/**
 * Common PV panel specifications for quick selection
 */
export const COMMON_PV_PANELS = [
  { watts: 300, voc: 39.7, isc: 9.8, name: '300W Standard' },
  { watts: 350, voc: 41.5, isc: 10.5, name: '350W High Efficiency' },
  { watts: 400, voc: 44.5, isc: 11.1, name: '400W Premium' },
  { watts: 450, voc: 46.0, isc: 12.0, name: '450W High Output' },
  { watts: 500, voc: 51.0, isc: 12.3, name: '500W Commercial' },
];

/**
 * Calculate maximum panels per string based on inverter voltage
 */
export function calculateMaxPanelsPerString(
  panelVoc: number,
  inverterMaxVdc: number,
  lowestAmbientTemp: number = -10
): number {
  const tempCorrection = TEMPERATURE_CORRECTION_VOC[lowestAmbientTemp.toString()] || 1.05;
  const correctedVoc = panelVoc * tempCorrection;
  return Math.floor(inverterMaxVdc / correctedVoc);
}

/**
 * Calculate minimum panels per string based on inverter MPPT range
 */
export function calculateMinPanelsPerString(
  panelVmp: number, // Voltage at max power
  inverterMinMpptVoltage: number
): number {
  // Account for high temperature reducing voltage
  const highTempFactor = 0.85; // Worst case at high temp
  const correctedVmp = panelVmp * highTempFactor;
  return Math.ceil(inverterMinMpptVoltage / correctedVmp);
}

