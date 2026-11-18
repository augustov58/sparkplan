/**
 * NEC Table Data Structure Types
 * TypeScript interfaces for National Electrical Code reference tables
 * NEC 2023 Edition
 */

export interface OccupancyLightingDemand {
  occupancyType: string;
  /** Tiers in order: the VA up to `upTo` (cumulative) at `factor` (#236). */
  tiers: { upTo: number; factor: number }[];
  /** The table's row name; the table number comes from the edition (#237). */
  row: string;
}

export interface RangeDemand {
  numberOfRanges: number;
  demandKW: number;
  necReference: string;
}

export interface AmpacityEntry {
  size: string; // e.g., "12 AWG", "250 kcmil"
  material: 'Cu' | 'Al';
  temp60C: number; // Ampacity at 60°C
  temp75C: number; // Ampacity at 75°C
  temp90C: number; // Ampacity at 90°C
}

export interface TemperatureCorrectionFactor {
  ambientTempC: number;
  temp60C: number; // Correction factor
  temp75C: number;
  temp90C: number;
}

export interface BundlingAdjustmentFactor {
  minConductors: number;
  maxConductors: number;
  adjustmentFactor: number;
}

export interface ConductorImpedance {
  size: string;
  material: 'Cu' | 'Al';
  conduitType: 'PVC' | 'Aluminum' | 'Steel';
  resistanceOhmsPerKFt: number; // Ohms per 1000 ft
  reactanceXLOhmsPerKFt: number; // Inductive reactance per 1000 ft
  effectiveZ: number; // Impedance for PF=0.85
}
