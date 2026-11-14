/**
 * EV Charging Calculator - NEC Article 625
 * Electric Vehicle Power Transfer System
 * 2023 NEC Edition
 */

import { getNextStandardBreakerSize } from '../../data/nec/standard-breakers';
import { getEvseLoadVA, type NecEdition } from '../../data/nec/evse-load';

/**
 * EV Charger levels and typical characteristics
 */
export type EVChargerLevel = 'Level1' | 'Level2' | 'Level3_DCFC';

export interface EVChargerSpec {
  level: EVChargerLevel;
  voltage: number;
  phase: 1 | 3;
  maxAmps: number;
  power_kw: number;
  description: string;
}

/**
 * Standard EV charger specifications
 */
export const EV_CHARGER_SPECS: Record<EVChargerLevel, EVChargerSpec[]> = {
  Level1: [
    { level: 'Level1', voltage: 120, phase: 1, maxAmps: 12, power_kw: 1.4, description: 'Standard 120V outlet (NEMA 5-15)' },
    { level: 'Level1', voltage: 120, phase: 1, maxAmps: 16, power_kw: 1.9, description: 'Dedicated 120V circuit (NEMA 5-20)' },
  ],
  Level2: [
    { level: 'Level2', voltage: 240, phase: 1, maxAmps: 16, power_kw: 3.8, description: '16A EVSE (3.8 kW)' },
    { level: 'Level2', voltage: 240, phase: 1, maxAmps: 24, power_kw: 5.8, description: '24A EVSE (5.8 kW)' },
    { level: 'Level2', voltage: 240, phase: 1, maxAmps: 32, power_kw: 7.7, description: '32A EVSE (7.7 kW)' },
    { level: 'Level2', voltage: 240, phase: 1, maxAmps: 40, power_kw: 9.6, description: '40A EVSE (9.6 kW)' },
    { level: 'Level2', voltage: 240, phase: 1, maxAmps: 48, power_kw: 11.5, description: '48A EVSE (11.5 kW)' },
    { level: 'Level2', voltage: 240, phase: 1, maxAmps: 80, power_kw: 19.2, description: '80A EVSE (19.2 kW)' },
  ],
  Level3_DCFC: [
    { level: 'Level3_DCFC', voltage: 480, phase: 3, maxAmps: 63, power_kw: 50, description: '50 kW DC Fast Charger' },
    { level: 'Level3_DCFC', voltage: 480, phase: 3, maxAmps: 100, power_kw: 100, description: '100 kW DC Fast Charger' },
    { level: 'Level3_DCFC', voltage: 480, phase: 3, maxAmps: 160, power_kw: 150, description: '150 kW DC Fast Charger' },
    { level: 'Level3_DCFC', voltage: 480, phase: 3, maxAmps: 250, power_kw: 250, description: '250 kW DC Fast Charger' },
    { level: 'Level3_DCFC', voltage: 480, phase: 3, maxAmps: 400, power_kw: 350, description: '350 kW DC Fast Charger' },
  ],
};

export interface EVChargingInput {
  chargerLevel: EVChargerLevel;
  chargerAmps: number;
  voltage: number;
  phase: 1 | 3;
  numChargers: number;
  /** Design assumption (0-100), never applied to the NEC load (PE ruling 2026-11-13, #198) */
  simultaneousUse: number;
  circuitLength_ft: number;
  conductorMaterial: 'Cu' | 'Al';
  necEdition: NecEdition;
}

export interface EVChargingResult {
  // Individual circuit sizing
  circuitBreakerAmps: number;
  conductorSize: string;
  egcSize: string;
  
  // Total system load
  totalConnectedLoad_kVA: number;
  /** Article 220 load: chargers × getEvseLoadVA at 100% (no EVSE demand factor exists) */
  necLoad_kVA: number;
  /** 220.14(A) (NEC 2020) or 220.57(A) (NEC 2023) */
  necLoadReference: string;
  /** Design assumption: connected load × simultaneous use %. Not an NEC load. */
  expectedPeak_kVA: number;
  
  // Voltage drop
  voltageDropPercent: number;
  meetsVoltageDrop: boolean;
  
  // NEC references
  necReferences: string[];
  warnings: string[];
  notes: string[];
}

/**
 * Calculate EV Charging circuit requirements per NEC Article 625
 * 
 * Key NEC requirements:
 * - NEC 625.41: Overcurrent protection at 125% of the maximum load (continuous duty)
 * - NEC 625.42: EV charging is a continuous load
 * - NEC 220.14(A) / 220.57(A): per-EVSE load at 100%, by edition. The NEC has
 *   no EVSE demand factor; only an EVEMS setpoint (625.42) lowers it (#198).
 * 
 * @param input - EV charging calculation parameters
 * @returns Complete EV charging calculation result
 */
export function calculateEVCharging(input: EVChargingInput): EVChargingResult {
  const necReferences: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  // NEC 625.42: EV charging is a continuous load; 625.41 sizes the OCPD
  // (and the circuit it protects) at 125% of the maximum load
  const continuousLoadFactor = 1.25;
  const requiredAmps = input.chargerAmps * continuousLoadFactor;
  const circuitBreakerAmps = getNextStandardBreakerSize(requiredAmps);
  necReferences.push('NEC 625.41 - Overcurrent Protection (125%, continuous duty)');
  necReferences.push('NEC 625.42 - EV charging is a continuous load');

  // Conductor sizing based on breaker size
  const conductorSize = getConductorSizeForAmps(circuitBreakerAmps, input.conductorMaterial);
  const egcSize = getEGCSizeForBreaker(circuitBreakerAmps, input.conductorMaterial);

  // Calculate single charger load
  const singleChargerVA = input.phase === 1 
    ? input.voltage * input.chargerAmps
    : Math.sqrt(3) * input.voltage * input.chargerAmps;
  const singleChargerKVA = singleChargerVA / 1000;

  // Total connected load
  const totalConnectedLoad_kVA = singleChargerKVA * input.numChargers;

  // Article 220 load: every charger at 100% (220.57(A) floor under NEC 2023)
  const evse = getEvseLoadVA(singleChargerVA, input.necEdition);
  const necLoad_kVA = (evse.loadVA / 1000) * input.numChargers;
  necReferences.push(`${evse.necReference} - EVSE load at 100% (the NEC has no EVSE demand factor)`);

  // Design assumption only (PE ruling 2026-11-13, #198): never the NEC load
  const expectedPeak_kVA = totalConnectedLoad_kVA * (input.simultaneousUse / 100);
  notes.push(
    `Expected peak at ${input.simultaneousUse}% simultaneous use is a design assumption, ` +
    `not an NEC load. Only an EVEMS (NEC 625.42) lowers the load used for sizing.`
  );

  // Voltage drop calculation
  const voltageDropPercent = calculateSimpleVoltageDrop(
    conductorSize,
    input.conductorMaterial,
    input.circuitLength_ft,
    input.chargerAmps,
    input.voltage,
    input.phase
  );
  const meetsVoltageDrop = voltageDropPercent <= 3.0;
  
  if (!meetsVoltageDrop) {
    warnings.push(
      `⚠️ Voltage drop ${voltageDropPercent.toFixed(2)}% exceeds 3% recommendation. ` +
      `Consider increasing conductor size or reducing circuit length.`
    );
  }
  necReferences.push('NEC 210.19(A) Informational Note - 3% voltage drop recommended');

  // Level-specific notes
  if (input.chargerLevel === 'Level3_DCFC') {
    notes.push('DC Fast Chargers require coordination with utility for demand charges.');
    notes.push('Consider energy storage or load management for peak demand reduction.');
  }

  if (input.chargerLevel === 'Level2' && input.chargerAmps >= 40) {
    notes.push('High-power Level 2 chargers (≥40A) may benefit from load management systems.');
  }

  // Warnings for common issues
  if (input.numChargers > 4 && input.simultaneousUse > 80) {
    warnings.push(
      '⚠️ High simultaneous use factor may cause peak demand issues. ' +
      'Consider implementing load management/scheduling.'
    );
  }

  return {
    circuitBreakerAmps,
    conductorSize,
    egcSize,
    totalConnectedLoad_kVA: Math.round(totalConnectedLoad_kVA * 100) / 100,
    necLoad_kVA: Math.round(necLoad_kVA * 100) / 100,
    necLoadReference: evse.necReference,
    expectedPeak_kVA: Math.round(expectedPeak_kVA * 100) / 100,
    voltageDropPercent: Math.round(voltageDropPercent * 100) / 100,
    meetsVoltageDrop,
    necReferences,
    warnings,
    notes
  };
}

/**
 * Get conductor size based on ampacity
 * Simplified lookup for EV circuits
 */
function getConductorSizeForAmps(amps: number, material: 'Cu' | 'Al'): string {
  const copperSizes: [number, string][] = [
    [15, '14 AWG'], [20, '12 AWG'], [30, '10 AWG'],
    [40, '8 AWG'], [55, '6 AWG'], [70, '4 AWG'],
    [85, '3 AWG'], [95, '2 AWG'], [110, '1 AWG'],
    [130, '1/0 AWG'], [150, '2/0 AWG'], [175, '3/0 AWG'],
    [200, '4/0 AWG'], [230, '250 kcmil'], [255, '300 kcmil'],
    [285, '350 kcmil'], [310, '400 kcmil'], [380, '500 kcmil'],
  ];

  const aluminumSizes: [number, string][] = [
    [15, '12 AWG'], [20, '10 AWG'], [30, '8 AWG'],
    [40, '6 AWG'], [55, '4 AWG'], [65, '3 AWG'],
    [75, '2 AWG'], [85, '1 AWG'], [100, '1/0 AWG'],
    [115, '2/0 AWG'], [130, '3/0 AWG'], [150, '4/0 AWG'],
    [170, '250 kcmil'], [190, '300 kcmil'], [210, '350 kcmil'],
    [230, '400 kcmil'], [260, '500 kcmil'],
  ];

  const sizes = material === 'Cu' ? copperSizes : aluminumSizes;
  
  for (const [capacity, size] of sizes) {
    if (capacity >= amps) return size;
  }
  
  return material === 'Cu' ? '500 kcmil' : '500 kcmil';
}

/**
 * Get EGC size based on breaker rating
 * Per NEC Table 250.122
 */
function getEGCSizeForBreaker(breakerAmps: number, material: 'Cu' | 'Al'): string {
  const copperEGC: [number, string][] = [
    [15, '14 AWG'], [20, '12 AWG'], [60, '10 AWG'],
    [100, '8 AWG'], [200, '6 AWG'], [300, '4 AWG'],
    [400, '3 AWG'], [500, '2 AWG'], [600, '1 AWG'],
    [800, '1/0 AWG'], [1000, '2/0 AWG'], [1200, '3/0 AWG'],
  ];

  const aluminumEGC: [number, string][] = [
    [15, '12 AWG'], [20, '10 AWG'], [60, '8 AWG'],
    [100, '6 AWG'], [200, '4 AWG'], [300, '2 AWG'],
    [400, '1 AWG'], [500, '1/0 AWG'], [600, '2/0 AWG'],
    [800, '3/0 AWG'], [1000, '4/0 AWG'], [1200, '250 kcmil'],
  ];

  const sizes = material === 'Cu' ? copperEGC : aluminumEGC;
  
  for (const [maxBreaker, size] of sizes) {
    if (breakerAmps <= maxBreaker) return size;
  }
  
  return material === 'Cu' ? '3/0 AWG' : '250 kcmil';
}

/**
 * Simple voltage drop calculation
 */
function calculateSimpleVoltageDrop(
  conductorSize: string,
  material: 'Cu' | 'Al',
  length_ft: number,
  amps: number,
  voltage: number,
  phase: 1 | 3
): number {
  // K factor (ohms per circular mil-foot at 75°C)
  const K = material === 'Cu' ? 12.9 : 21.2;
  
  // Circular mils for common sizes
  const circularMils: Record<string, number> = {
    '14 AWG': 4110, '12 AWG': 6530, '10 AWG': 10380,
    '8 AWG': 16510, '6 AWG': 26240, '4 AWG': 41740,
    '3 AWG': 52620, '2 AWG': 66360, '1 AWG': 83690,
    '1/0 AWG': 105600, '2/0 AWG': 133100, '3/0 AWG': 167800,
    '4/0 AWG': 211600, '250 kcmil': 250000, '300 kcmil': 300000,
    '350 kcmil': 350000, '400 kcmil': 400000, '500 kcmil': 500000,
  };
  
  const cm = circularMils[conductorSize] || 100000;
  const multiplier = phase === 1 ? 2 : Math.sqrt(3);
  
  const vdVolts = (K * length_ft * amps * multiplier) / cm;
  return (vdVolts / voltage) * 100;
}

/**
 * Get recommended charger specs by level
 */
export function getEVChargerOptions(level: EVChargerLevel): EVChargerSpec[] {
  return EV_CHARGER_SPECS[level];
}

/**
 * Estimate charging time based on charger power and battery size
 */
export function estimateChargingTime(
  chargerPower_kW: number,
  batteryCapacity_kWh: number,
  currentSOC: number, // State of charge 0-100
  targetSOC: number   // Target state of charge 0-100
): { hours: number; minutes: number } {
  const energyNeeded = batteryCapacity_kWh * ((targetSOC - currentSOC) / 100);
  
  // Account for charging efficiency (~90% for Level 2, ~95% for DC)
  const efficiency = chargerPower_kW > 20 ? 0.95 : 0.90;
  const effectivePower = chargerPower_kW * efficiency;
  
  const totalHours = energyNeeded / effectivePower;
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  
  return { hours, minutes };
}

