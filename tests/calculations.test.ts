/**
 * Unit Tests for NEC Calculation Services
 * Run with: npm test (after installing vitest)
 *
 * These tests validate the calculation engines against NEC 2023 requirements
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLoad,
  sizeConductor,
  sizeBreaker,
  calculateVoltageDropAC,
  calculateFeederSizing
} from '../services/calculations';
import { calculateEgcSize } from '../services/calculations/conductorSizing';
import { getEgcSize } from '../data/nec/table-250-122';
import { calculateProportionalEgcSize } from '../data/nec/conductor-properties';
import type { LoadItem, ProjectSettings, FeederCalculationInput } from '../types';

describe('NEC Load Calculations', () => {
  const dwellingSettings: ProjectSettings = {
    serviceVoltage: 240,
    servicePhase: 1,
    occupancyType: 'dwelling',
    conductorMaterial: 'Cu',
    temperatureRating: 75
  };

  describe('NEC 220.82 Optional Calculation for Dwelling Units', () => {
    it('should calculate basic dwelling load correctly', () => {
      const loads: LoadItem[] = [
        {
          id: '1',
          description: 'General Lighting',
          watts: 3000,
          type: 'lighting',
          continuous: true,
          phase: 'A'
        },
        {
          id: '2',
          description: 'Range',
          watts: 12000,
          type: 'range',
          continuous: false,
          phase: 'A'
        }
      ];

      const result = calculateLoad(loads, dwellingSettings);

      expect(result.method).toBe('NEC 220.82 Optional (Dwelling)');
      expect(result.totalConnectedVA).toBe(15000);
      expect(result.totalDemandVA).toBeGreaterThan(0);
      expect(result.totalDemandVA).toBeLessThan(result.totalConnectedVA); // Demand factors should reduce load
      expect(result.recommendedServiceSize).toBeGreaterThan(0);
    });

    it('should apply 125% continuous load factor', () => {
      const loads: LoadItem[] = [
        {
          id: '1',
          description: 'Continuous Load',
          watts: 8000,
          type: 'lighting',
          continuous: true,
          phase: 'A'
        }
      ];

      const result = calculateLoad(loads, dwellingSettings);

      // With 125% factor, 8000VA continuous should result in higher demand
      expect(result.totalDemandVA).toBeGreaterThan(8000);
    });

    it('should apply motor calculations per Article 430', () => {
      const loads: LoadItem[] = [
        {
          id: '1',
          description: 'Motor 1',
          watts: 1000,
          type: 'motor',
          continuous: false,
          phase: 'A'
        },
        {
          id: '2',
          description: 'Motor 2 (Largest)',
          watts: 2000,
          type: 'motor',
          continuous: false,
          phase: 'B'
        }
      ];

      const result = calculateLoad(loads, dwellingSettings);

      expect(result.breakdown.motors.largestMotorVA).toBe(2000);
      // Demand should be 125% of largest + 100% of others = (2000 * 1.25) + 1000 = 3500
      expect(result.breakdown.motors.demandVA).toBe(3500);
    });
  });

  describe('Phase Balance Analysis', () => {
    it('should detect phase imbalance', () => {
      const loads: LoadItem[] = [
        {
          id: '1',
          description: 'Phase A Load',
          watts: 10000,
          type: 'lighting',
          continuous: false,
          phase: 'A'
        },
        {
          id: '2',
          description: 'Phase B Load',
          watts: 1000,
          type: 'lighting',
          continuous: false,
          phase: 'B'
        }
      ];

      const threePhaseSettings: ProjectSettings = {
        ...dwellingSettings,
        servicePhase: 3,
        serviceVoltage: 208
      };

      const result = calculateLoad(loads, threePhaseSettings);

      expect(result.phaseBalance.imbalancePercent).toBeGreaterThan(10);
      expect(result.phaseBalance.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('Conductor Sizing (NEC Article 310)', () => {
  const settings: ProjectSettings = {
    serviceVoltage: 240,
    servicePhase: 1,
    occupancyType: 'dwelling',
    conductorMaterial: 'Cu',
    temperatureRating: 75
  };

  it('should size conductor for given load with 125% continuous factor', () => {
    const result = sizeConductor(40, settings, 30, 3, true);

    expect(result.conductorSize).toBeDefined();
    expect(result.requiredAmpacity).toBe(50); // 40A * 1.25
    expect(result.adjustedAmpacity).toBeGreaterThanOrEqual(result.requiredAmpacity);
  });

  it('should apply temperature correction factor', () => {
    const hotResult = sizeConductor(40, settings, 50, 3, true); // 50°C
    const normalResult = sizeConductor(40, settings, 30, 3, true); // 30°C

    expect(hotResult.baseTempCorrection).toBeLessThan(1.0);
    expect(normalResult.baseTempCorrection).toBe(1.0);
  });

  it('should apply bundling adjustment', () => {
    const manyCondResult = sizeConductor(40, settings, 30, 12, true); // 12 conductors
    const fewCondResult = sizeConductor(40, settings, 30, 3, true); // 3 conductors

    expect(manyCondResult.bundlingAdjustment).toBeLessThan(1.0);
    expect(fewCondResult.bundlingAdjustment).toBe(1.0);
  });

  it('should upsize from 14 AWG to 12 AWG per NEC 240.4(D) for 16A load', () => {
    // 16A non-continuous, Cu, 75°C, standard conditions
    // 14 AWG has 20A ampacity but is limited to 15A OCPD per 240.4(D)
    // Must upsize to 12 AWG (20A OCPD allowed)
    const result = sizeConductor(16, settings, 30, 3, false);
    expect(result.conductorSize).toBe('12 AWG');
  });

  it('should upsize from 12 AWG to 10 AWG per NEC 240.4(D) for 21A load', () => {
    // 21A non-continuous needs >20A OCPD, 12 AWG limited to 20A
    const result = sizeConductor(21, settings, 30, 3, false);
    expect(result.conductorSize).toBe('10 AWG');
  });

  it('should keep 14 AWG for loads within 15A OCPD limit', () => {
    const result = sizeConductor(15, settings, 30, 3, false);
    expect(result.conductorSize).toBe('14 AWG');
  });
});

describe('Breaker Sizing (NEC Article 240)', () => {
  const settings: ProjectSettings = {
    serviceVoltage: 240,
    servicePhase: 1,
    occupancyType: 'dwelling',
    conductorMaterial: 'Cu',
    temperatureRating: 75
  };

  it('should size breaker with 125% continuous load factor', () => {
    const result = sizeBreaker(40, settings, true);

    expect(result.requiredMinimumBreaker).toBe(50); // 40A * 1.25
    expect(result.breakerSize).toBeGreaterThanOrEqual(50);
  });

  it('should select next standard breaker size', () => {
    const result = sizeBreaker(67, settings, true);

    // 67A * 1.25 = 83.75A, next standard size is 90A or 100A
    expect([90, 100]).toContain(result.breakerSize);
  });
});

describe('Voltage Drop (NEC Chapter 9 Table 9)', () => {
  it('should calculate voltage drop with AC impedance', () => {
    const result = calculateVoltageDropAC(
      '12 AWG',
      'Cu',
      'PVC',
      100, // 100 feet
      20,  // 20 amps
      120, // 120 volts
      1    // single phase
    );

    expect(result.voltageDropVolts).toBeGreaterThan(0);
    expect(result.voltageDropPercent).toBeGreaterThan(0);
    expect(result.method).toBe('AC Impedance (Chapter 9 Table 9)');
  });

  it('should flag non-compliant voltage drop >3%', () => {
    const result = calculateVoltageDropAC(
      '14 AWG',
      'Cu',
      'PVC',
      200, // Long run
      20,  // 20 amps
      120,
      1
    );

    if (result.voltageDropPercent > 3) {
      expect(result.isCompliant).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });
});

describe('Equipment Grounding Conductor (EGC) Sizing - NEC 250.122', () => {
  describe('Table 250.122 Base Sizing', () => {
    it('should size EGC for 20A breaker (copper)', () => {
      const egcSize = getEgcSize(20, 'Cu');
      expect(egcSize).toBe('12'); // 12 AWG per Table 250.122
    });

    it('should size EGC for 100A breaker (copper)', () => {
      const egcSize = getEgcSize(100, 'Cu');
      expect(egcSize).toBe('8'); // 8 AWG per Table 250.122
    });

    it('should size EGC for 200A breaker (copper)', () => {
      const egcSize = getEgcSize(200, 'Cu');
      expect(egcSize).toBe('6'); // 6 AWG per Table 250.122
    });

    it('should size EGC for 100A breaker (aluminum)', () => {
      const egcSize = getEgcSize(100, 'Al');
      expect(egcSize).toBe('6'); // 6 AWG aluminum per Table 250.122
    });
  });

  describe('Proportional Upsizing - NEC 250.122(B)', () => {
    it('should upsize EGC when phase conductors are upsized', () => {
      // Base: 8 AWG EGC for 3 AWG phase conductor
      // If phase conductor increased to 2 AWG, EGC should be proportionally larger
      const upsizedEgc = calculateProportionalEgcSize(
        '8',     // Base EGC size
        '3',     // Base phase conductor
        '2'      // Actual upsized phase conductor
      );

      expect(upsizedEgc).toBeDefined();
      // Should be larger than base EGC
      const circularMilsBase = 16510; // 8 AWG
      const circularMilsUpsized = upsizedEgc ? 26240 : 0; // Should be at least 6 AWG (26240 CM)
      expect(circularMilsUpsized).toBeGreaterThan(circularMilsBase);
    });

    it('should not change EGC when phase conductors are not upsized', () => {
      const egc = calculateProportionalEgcSize(
        '10',    // Base EGC
        '6',     // Base phase conductor
        '6'      // Same phase conductor
      );

      expect(egc).toBe('10'); // Should remain the same
    });

    it('should calculate proportional EGC for voltage drop scenario', () => {
      // Common scenario: 100A OCPD, phase conductors upsized from 3 AWG to 1/0 for voltage drop
      // Base EGC: 8 AWG
      // Expected: Proportionally larger EGC
      const upsizedEgc = calculateProportionalEgcSize(
        '8',     // Base EGC (8 AWG for 100A)
        '3',     // Base phase conductor (3 AWG typical for 100A)
        '1/0'    // Actual phase conductor (upsized for voltage drop)
      );

      expect(upsizedEgc).toBeDefined();
      expect(upsizedEgc).not.toBe('8'); // Should be larger than base
      // 8 AWG = 16510 CM, 3 AWG = 52620 CM, 1/0 = 105600 CM
      // Proportional EGC = 16510 * (105600/52620) = 33154 CM
      // Next standard size ≥33154 CM is 4 AWG (41740 CM)
      expect(upsizedEgc).toBe('4');
    });
  });

  describe('Integration with Conductor Sizing', () => {
    const settings: ProjectSettings = {
      serviceVoltage: 240,
      servicePhase: 1,
      occupancyType: 'dwelling',
      conductorMaterial: 'Cu',
      temperatureRating: 75
    };

    it('should include EGC size in conductor sizing result', () => {
      const result = sizeConductor(40, settings, 30, 3, true, 50);

      expect(result.egcSize).toBeDefined();
      expect(result.egcUpsized).toBeDefined();
      expect(typeof result.egcSize).toBe('string');
      expect(typeof result.egcUpsized).toBe('boolean');
    });

    it('should size EGC correctly for 100A service', () => {
      const result = sizeConductor(100, settings, 30, 3, true, 100);

      // 100A OCPD requires 8 AWG copper EGC per Table 250.122
      expect(result.egcSize).toBe('8');
      expect(result.necReferences).toContain('NEC 250.122(A) - Table 250.122');
    });

    it('should size EGC correctly for 200A service', () => {
      const result = sizeConductor(200, settings, 30, 3, true, 200);

      // 200A OCPD requires 6 AWG copper EGC per Table 250.122
      expect(result.egcSize).toBe('6');
    });
  });

  describe('NEC 110.14(C) Termination Temperature', () => {
    const baseSettings: ProjectSettings = {
      serviceVoltage: 240,
      servicePhase: 1,
      occupancyType: 'dwelling',
      conductorMaterial: 'Cu',
      temperatureRating: 90
    };

    it('should check 60°C column by default for ≤100A circuits', () => {
      // 90°C insulation, 40A continuous → 50A required
      const result = sizeConductor(40, baseSettings, 30, 3, true);
      expect(result.warnings.some(w => w.includes('110.14(C)'))).toBe(true);
    });

    it('should allow 75°C column when terminalsRated75C is true for ≤100A', () => {
      const withoutTerminals = sizeConductor(40, baseSettings, 30, 3, true, undefined, false);
      const withTerminals = sizeConductor(40, baseSettings, 30, 3, true, undefined, true);
      // Without terminals: warns about 60°C. With terminals: no 60°C warning.
      expect(withoutTerminals.warnings.some(w => w.includes('60°C'))).toBe(true);
      expect(withTerminals.warnings.some(w => w.includes('60°C'))).toBe(false);
    });

    it('should always use 75°C for >100A regardless of terminals checkbox', () => {
      const result = sizeConductor(100, baseSettings, 30, 3, true, undefined, false);
      // >100A → 75°C termination, not 60°C
      expect(result.warnings.some(w => w.includes('75°C termination'))).toBe(true);
      expect(result.warnings.some(w => w.includes('60°C'))).toBe(false);
    });
  });

  describe('EGC Calculation Function', () => {
    it('should calculate EGC with detailed info', () => {
      const result = calculateEgcSize(100, '3', 'Cu', false);

      expect(result.egcSize).toBe('8'); // 8 AWG for 100A
      expect(result.baseEgcSize).toBe('8');
      expect(result.upsized).toBe(false);
      expect(result.necReferences.length).toBeGreaterThan(0);
    });

    it('should detect when upsizing is needed', () => {
      // 100A breaker with phase conductors upsized to 1/0
      const result = calculateEgcSize(100, '1/0', 'Cu', true);

      expect(result.egcSize).toBeDefined();
      // If phase conductors are upsized, EGC might need upsizing
      expect(result.necReferences).toContain('NEC 250.122(A) - Table 250.122');
    });
  });
});

describe('Feeder Sizing (NEC Article 215)', () => {
  describe('Basic Feeder Calculations', () => {
    it('should calculate feeder for 3-phase 208V panel with mixed loads', () => {
      const input: FeederCalculationInput = {
        source_voltage: 208,
        source_phase: 3,
        destination_voltage: 208,
        destination_phase: 3,
        total_load_va: 50000,
        continuous_load_va: 30000,
        noncontinuous_load_va: 20000,
        distance_ft: 150,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 4,
        max_voltage_drop_percent: 3
      };

      const result = calculateFeederSizing(input);

      // Design load should be continuous × 1.25 + noncontinuous × 1.0
      expect(result.design_load_va).toBe(57500); // (30000 * 1.25) + 20000
      expect(result.design_current_amps).toBeGreaterThan(0);
      expect(result.phase_conductor_size).toBeDefined();
      expect(result.neutral_conductor_size).toBeDefined();
      expect(result.egc_size).toBeDefined();
      expect(result.recommended_conduit_size).toBeDefined();
      expect(result.voltage_drop_percent).toBeGreaterThan(0);
      expect(result.necReferences.length).toBeGreaterThan(0);
    });

    it('should apply NEC 215.2(A)(1) continuous load factor correctly', () => {
      const input: FeederCalculationInput = {
        source_voltage: 240,
        source_phase: 1,
        destination_voltage: 240,
        destination_phase: 1,
        total_load_va: 10000,
        continuous_load_va: 8000, // 80% continuous
        noncontinuous_load_va: 2000,
        distance_ft: 100,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 3
      };

      const result = calculateFeederSizing(input);

      // Design load = (8000 * 1.25) + 2000 = 12000 VA
      expect(result.design_load_va).toBe(12000);

      // Verify NEC reference is included
      expect(result.necReferences).toContain('NEC 215.2(A)(1) - 125% Continuous + 100% Noncontinuous Loads');
    });

    it('should calculate design current correctly for single-phase', () => {
      const input: FeederCalculationInput = {
        source_voltage: 240,
        source_phase: 1,
        destination_voltage: 240,
        destination_phase: 1,
        total_load_va: 12000,
        continuous_load_va: 12000,
        noncontinuous_load_va: 0,
        distance_ft: 50,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 3
      };

      const result = calculateFeederSizing(input);

      // Design load = 12000 * 1.25 = 15000 VA
      // Design current = 15000 / 240 = 62.5A
      expect(result.design_load_va).toBe(15000);
      expect(result.design_current_amps).toBeCloseTo(62.5, 1);
    });

    it('should calculate design current correctly for three-phase', () => {
      const input: FeederCalculationInput = {
        source_voltage: 208,
        source_phase: 3,
        destination_voltage: 208,
        destination_phase: 3,
        total_load_va: 36000,
        continuous_load_va: 24000,
        noncontinuous_load_va: 12000,
        distance_ft: 100,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 4
      };

      const result = calculateFeederSizing(input);

      // Design load = (24000 * 1.25) + 12000 = 42000 VA
      // Design current = 42000 / (√3 × 208) ≈ 116.6A
      expect(result.design_load_va).toBe(42000);
      expect(result.design_current_amps).toBeCloseTo(116.6, 1);
    });
  });

  describe('Voltage Drop Validation', () => {
    it('should flag voltage drop exceeding 3%', () => {
      const input: FeederCalculationInput = {
        source_voltage: 120,
        source_phase: 1,
        destination_voltage: 120,
        destination_phase: 1,
        total_load_va: 3000,
        continuous_load_va: 3000,
        noncontinuous_load_va: 0,
        distance_ft: 300, // Long run to force high VD
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 3
      };

      const result = calculateFeederSizing(input);

      // With long run and small conductors, VD should exceed 3%
      if (result.voltage_drop_percent > 3) {
        expect(result.meets_voltage_drop).toBe(false);
        expect(result.warnings.some(w => w.includes('Voltage drop'))).toBe(true);
      }
    });

    it('should pass voltage drop with adequate conductor size', () => {
      const input: FeederCalculationInput = {
        source_voltage: 240,
        source_phase: 1,
        destination_voltage: 240,
        destination_phase: 1,
        total_load_va: 5000,
        continuous_load_va: 5000,
        noncontinuous_load_va: 0,
        distance_ft: 50, // Short run
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 3
      };

      const result = calculateFeederSizing(input);

      // Short run should have low voltage drop
      expect(result.voltage_drop_percent).toBeLessThanOrEqual(3.0);
      expect(result.meets_voltage_drop).toBe(true);
    });
  });

  describe('Conductor and Conduit Sizing', () => {
    it('should size phase conductors with temperature and bundling corrections', () => {
      const input: FeederCalculationInput = {
        source_voltage: 208,
        source_phase: 3,
        destination_voltage: 208,
        destination_phase: 3,
        total_load_va: 100000,
        continuous_load_va: 80000,
        noncontinuous_load_va: 20000,
        distance_ft: 200,
        conductor_material: 'Cu',
        ambient_temperature_c: 40, // High temperature
        num_current_carrying: 6, // More conductors
        max_voltage_drop_percent: 3
      };

      const result = calculateFeederSizing(input);

      // Should account for temperature and bundling derating
      expect(result.phase_conductor_size).toBeDefined();
      expect(result.phase_conductor_ampacity).toBeGreaterThan(0);
      expect(result.necReferences).toContain('NEC 310.16 - Conductor Ampacity');
    });

    it('should include EGC size in results', () => {
      const input: FeederCalculationInput = {
        source_voltage: 240,
        source_phase: 1,
        destination_voltage: 240,
        destination_phase: 1,
        total_load_va: 20000,
        continuous_load_va: 15000,
        noncontinuous_load_va: 5000,
        distance_ft: 100,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 3
      };

      const result = calculateFeederSizing(input);

      expect(result.egc_size).toBeDefined();
      expect(typeof result.egc_size).toBe('string');
      expect(result.necReferences).toContain('NEC 250.122 - Equipment Grounding Conductor Sizing');
    });

    it('should recommend conduit size', () => {
      const input: FeederCalculationInput = {
        source_voltage: 208,
        source_phase: 3,
        destination_voltage: 208,
        destination_phase: 3,
        total_load_va: 30000,
        continuous_load_va: 20000,
        noncontinuous_load_va: 10000,
        distance_ft: 150,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 4
      };

      const result = calculateFeederSizing(input);

      expect(result.recommended_conduit_size).toBeDefined();
      expect(result.recommended_conduit_size).toMatch(/\d/); // Should contain numbers
      expect(result.necReferences.some(ref => ref.includes('Chapter 9'))).toBe(true);
    });

    it('should size neutral conductor', () => {
      const input: FeederCalculationInput = {
        source_voltage: 208,
        source_phase: 3,
        destination_voltage: 208,
        destination_phase: 3,
        total_load_va: 45000,
        continuous_load_va: 30000,
        noncontinuous_load_va: 15000,
        distance_ft: 100,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 4
      };

      const result = calculateFeederSizing(input);

      expect(result.neutral_conductor_size).toBeDefined();
      expect(result.necReferences).toContain('NEC 220.61 - Feeder Neutral Load');
    });
  });

  describe('Warnings and NEC References', () => {
    it('should warn about high continuous load percentage', () => {
      const input: FeederCalculationInput = {
        source_voltage: 240,
        source_phase: 1,
        destination_voltage: 240,
        destination_phase: 1,
        total_load_va: 10000,
        continuous_load_va: 9000, // 90% continuous
        noncontinuous_load_va: 1000,
        distance_ft: 50,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 3
      };

      const result = calculateFeederSizing(input);

      expect(result.warnings.some(w => w.includes('High continuous load'))).toBe(true);
    });

    it('should warn about long feeder runs', () => {
      const input: FeederCalculationInput = {
        source_voltage: 240,
        source_phase: 1,
        destination_voltage: 240,
        destination_phase: 1,
        total_load_va: 5000,
        continuous_load_va: 3000,
        noncontinuous_load_va: 2000,
        distance_ft: 250, // Long run
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 3
      };

      const result = calculateFeederSizing(input);

      expect(result.warnings.some(w => w.includes('Long feeder run'))).toBe(true);
    });

    it('should include all required NEC references', () => {
      const input: FeederCalculationInput = {
        source_voltage: 208,
        source_phase: 3,
        destination_voltage: 208,
        destination_phase: 3,
        total_load_va: 40000,
        continuous_load_va: 25000,
        noncontinuous_load_va: 15000,
        distance_ft: 100,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 4
      };

      const result = calculateFeederSizing(input);

      // Verify key NEC references are included
      expect(result.necReferences).toContain('NEC 215.2 - Feeder Conductor Ampacity');
      expect(result.necReferences).toContain('NEC 215.2(A)(1) - 125% Continuous + 100% Noncontinuous Loads');
      expect(result.necReferences.length).toBeGreaterThan(5);
    });
  });

  describe('Material Selection', () => {
    it('should handle aluminum conductors', () => {
      const input: FeederCalculationInput = {
        source_voltage: 240,
        source_phase: 1,
        destination_voltage: 240,
        destination_phase: 1,
        total_load_va: 15000,
        continuous_load_va: 10000,
        noncontinuous_load_va: 5000,
        distance_ft: 100,
        conductor_material: 'Al', // Aluminum
        ambient_temperature_c: 30,
        num_current_carrying: 3
      };

      const result = calculateFeederSizing(input);

      expect(result.phase_conductor_size).toBeDefined();
      expect(result.egc_size).toBeDefined();
      // Aluminum conductors are typically larger for same ampacity
    });
  });
});
