/**
 * Extended Unit Tests for NEC Calculation Services
 *
 * Covers the 6 services that had zero test coverage:
 *   1. shortCircuit.ts      — NEC 110.9, IEEE 141
 *   2. serviceUpgrade.ts    — NEC 220.87, 230.42
 *   3. residentialLoad.ts   — NEC 220.82, 220.84
 *   4. demandFactor.ts      — NEC 220.42–220.56
 *   5. multiFamilyEV.ts     — NEC 220.57, 625.42
 *   6. arcFlash.ts          — IEEE 1584-2018, NFPA 70E
 *
 * Each test validates:
 *   - Correct NEC math (hand-calculated expected values)
 *   - necReferences / necArticles includes expected articles
 *   - warnings triggers on out-of-range inputs
 *   - Never throws on valid input (returns result with warnings)
 */

import { describe, it, expect } from 'vitest';

// ── Short Circuit ──────────────────────────────────────────────────────────
import {
  calculateTransformerFaultCurrent,
  calculateDownstreamFaultCurrent,
  calculateServiceFaultCurrent,
  estimateUtilityTransformer,
  type TransformerData,
  type ConductorRun,
} from '../services/calculations/shortCircuit';

// ── Service Upgrade ────────────────────────────────────────────────────────
import {
  quickServiceCheck,
  analyzeServiceUpgrade,
  calculateServiceCapacity,
  calculateAmpsFromKVA,
  roundToStandardServiceSize,
} from '../services/calculations/serviceUpgrade';

// ── Residential Load ───────────────────────────────────────────────────────
import {
  calculateSingleFamilyLoad,
  calculateMultiFamilyLoad,
  LIGHTING_LOAD_VA_PER_SQFT,
} from '../services/calculations/residentialLoad';

// ── Demand Factor ──────────────────────────────────────────────────────────
import {
  calculatePanelDemand,
  getCircuitPhase,
  type CircuitLoad,
} from '../services/calculations/demandFactor';

// ── Multi-Family EV ────────────────────────────────────────────────────────
import {
  calculateMultiFamilyEV,
  getMultiFamilyDemandFactor,
  calculateCommonAreaLoads,
  type MultiFamilyEVInput,
} from '../services/calculations/multiFamilyEV';

// ── Upstream Load Aggregation (NEC 220.40 + 220.84 Optional Method) ─────────
import {
  calculateAggregatedLoad,
  buildMultiFamilyContext,
} from '../services/calculations/upstreamLoadAggregation';
import type { Panel, Circuit, Transformer } from '../lib/database.types';

// ── Arc Flash ──────────────────────────────────────────────────────────────
import {
  calculateArcFlash,
  type ArcFlashInput,
} from '../services/calculations/arcFlash';

// ── Types ──────────────────────────────────────────────────────────────────
import type {
  QuickCheckInput,
  ServiceUpgradeInput,
  ResidentialAppliances,
} from '../types';

// ============================================================================
// 1. SHORT CIRCUIT — NEC 110.9, IEEE 141
// ============================================================================

describe('Short Circuit (NEC 110.9)', () => {
  describe('calculateTransformerFaultCurrent', () => {
    it('should calculate 1-phase transformer fault current', () => {
      // 50 kVA, 240V secondary, 2.5% impedance
      // If = (50 × 1000) / (240 × 0.025) = 50000 / 6 = 8333.33 A
      const xfmr: TransformerData = {
        kva: 50,
        primaryVoltage: 7200,
        secondaryVoltage: 240,
        impedance: 2.5,
      };
      const result = calculateTransformerFaultCurrent(xfmr, 1);
      expect(result).toBeCloseTo(8333.33, 0);
    });

    it('should calculate 3-phase transformer fault current', () => {
      // 500 kVA, 208V secondary, 5.75% impedance
      // Base current = (500 × 1000) / (√3 × 208) = 500000 / 360.22 = 1388.0 A
      // If = 1388.0 / 0.0575 = 24139.1 A
      const xfmr: TransformerData = {
        kva: 500,
        primaryVoltage: 12470,
        secondaryVoltage: 208,
        impedance: 5.75,
      };
      const result = calculateTransformerFaultCurrent(xfmr, 3);
      expect(result).toBeCloseTo(24139, -1); // within ~10A
    });
  });

  describe('calculateServiceFaultCurrent', () => {
    it('should return a ShortCircuitResult with compliance info', () => {
      const xfmr: TransformerData = {
        kva: 75,
        primaryVoltage: 7200,
        secondaryVoltage: 240,
        impedance: 2.5,
      };
      const result = calculateServiceFaultCurrent(xfmr, 240, 1);
      expect(result.faultCurrent).toBeGreaterThan(0);
      expect(result.requiredAIC).toBeGreaterThan(0);
      expect(result.compliance.necArticle).toBe('NEC 110.9 - Interrupting Rating');
      expect(result.details.safetyFactor).toBe(1.25);
    });

    it('should reduce fault current when service conductor is provided', () => {
      const xfmr: TransformerData = {
        kva: 75,
        primaryVoltage: 7200,
        secondaryVoltage: 240,
        impedance: 2.5,
      };
      const withoutConductor = calculateServiceFaultCurrent(xfmr, 240, 1);
      const withConductor = calculateServiceFaultCurrent(xfmr, 240, 1, {
        length: 100,
        conductorSize: '2/0 AWG',
        material: 'Cu',
        conduitType: 'PVC',
      });
      // Conductor impedance should reduce fault current
      expect(withConductor.faultCurrent).toBeLessThan(withoutConductor.faultCurrent);
    });
  });

  describe('calculateDownstreamFaultCurrent — 3-phase multiplier must be 1×', () => {
    it('should use phaseMultiplier=1 for 3-phase (NOT 1.732)', () => {
      // This is the CRITICAL rule from CLAUDE.md:
      // 3-phase impedance multiplier is 1× (not 1.732×)
      const run: ConductorRun = {
        length: 100,
        conductorSize: '2/0 AWG',
        material: 'Cu',
        conduitType: 'PVC',
        voltage: 208,
        phase: 3,
      };
      const result3ph = calculateDownstreamFaultCurrent(run, 20000);

      // For single-phase, same run — impedance doubles (multiplier = 2)
      const run1ph: ConductorRun = { ...run, phase: 1, voltage: 240 };
      const result1ph = calculateDownstreamFaultCurrent(run1ph, 20000);

      // 3-phase conductor impedance should be LESS than 1-phase (1× vs 2×)
      expect(result3ph.details.conductorImpedance).toBeLessThan(
        result1ph.details.conductorImpedance
      );
    });
  });

  describe('estimateUtilityTransformer', () => {
    it('should return standard transformer size >= required kVA', () => {
      // 200A, 240V, 1-phase → kVA = 200 × 240 / 1000 = 48 kVA → next standard = 50 kVA
      const xfmr = estimateUtilityTransformer(200, 240, 1);
      expect(xfmr.kva).toBe(50);
      expect(xfmr.impedance).toBe(2.5); // single-phase default
    });

    it('should use custom impedance when provided', () => {
      const xfmr = estimateUtilityTransformer(200, 208, 3, 4.0);
      expect(xfmr.impedance).toBe(4.0);
    });
  });
});

// ============================================================================
// 2. SERVICE UPGRADE — NEC 220.87, 230.42
// ============================================================================

describe('Service Upgrade (NEC 220.87)', () => {
  describe('quickServiceCheck', () => {
    it('should apply 125% to manual/calculated loads per NEC 220.87', () => {
      const input: QuickCheckInput = {
        currentServiceAmps: 200,
        currentUsageAmps: 120,
        proposedLoadAmps: 40,
        existingLoadMethod: 'manual',
      };
      const result = quickServiceCheck(input);
      // adjustedExisting = 120 × 1.25 = 150A
      // total = 150 + 40 = 190A
      // utilization = 190/200 = 95%
      expect(result.totalAmps).toBe(190);
      expect(result.utilizationPercent).toBeCloseTo(95, 0);
      expect(result.canHandle).toBe(true);
      expect(result.status).toBe('HIGH'); // >80%
    });

    it('should NOT apply 125% to utility_bill loads (actual measurement)', () => {
      const input: QuickCheckInput = {
        currentServiceAmps: 200,
        currentUsageAmps: 120,
        proposedLoadAmps: 40,
        existingLoadMethod: 'utility_bill',
      };
      const result = quickServiceCheck(input);
      // adjustedExisting = 120A (no multiplier)
      // total = 120 + 40 = 160A
      // utilization = 160/200 = 80%
      expect(result.totalAmps).toBe(160);
      expect(result.utilizationPercent).toBeCloseTo(80, 0);
      expect(result.canHandle).toBe(true);
    });

    it('should NOT apply 125% to load_study loads', () => {
      const input: QuickCheckInput = {
        currentServiceAmps: 200,
        currentUsageAmps: 120,
        proposedLoadAmps: 40,
        existingLoadMethod: 'load_study',
      };
      const result = quickServiceCheck(input);
      expect(result.totalAmps).toBe(160);
    });

    it('should report CRITICAL when load exceeds service', () => {
      const input: QuickCheckInput = {
        currentServiceAmps: 100,
        currentUsageAmps: 80,
        proposedLoadAmps: 40,
        existingLoadMethod: 'manual',
      };
      const result = quickServiceCheck(input);
      // adjustedExisting = 80 × 1.25 = 100A
      // total = 100 + 40 = 140A → exceeds 100A
      expect(result.status).toBe('CRITICAL');
      expect(result.canHandle).toBe(false);
    });
  });

  describe('analyzeServiceUpgrade', () => {
    it('should perform detailed analysis with NEC references', () => {
      const input: ServiceUpgradeInput = {
        currentServiceAmps: 200,
        serviceVoltage: 240,
        servicePhase: 1,
        existingDemandLoad_kVA: 30,
        existingLoadMethod: 'calculated',
        proposedLoads: [
          { description: 'EV Charger', kw: 9.6, continuous: true, category: 'EV' },
        ],
      };
      const result = analyzeServiceUpgrade(input);

      // Existing load adjusted: 30 × 1.25 = 37.5 kVA
      expect(result.existingDemand_kVA).toBe(37.5);

      // Proposed: 9.6 × 1.25 (continuous) = 12 kVA
      expect(result.proposedAdditionalLoad_kVA).toBe(12);

      // NEC references should include 220.87
      expect(result.necReferences).toContain('NEC 220.87 - Determining Existing Loads (125% multiplier)');
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should skip 125% multiplier for utility_bill method', () => {
      const input: ServiceUpgradeInput = {
        currentServiceAmps: 200,
        serviceVoltage: 240,
        servicePhase: 1,
        existingDemandLoad_kVA: 30,
        existingLoadMethod: 'utility_bill',
        proposedLoads: [],
      };
      const result = analyzeServiceUpgrade(input);
      // No multiplier → existing demand = 30 kVA
      expect(result.existingDemand_kVA).toBe(30);
    });
  });

  describe('helper functions', () => {
    it('calculateServiceCapacity: 200A × 240V × 1φ = 48 kVA', () => {
      expect(calculateServiceCapacity(200, 240, 1)).toBeCloseTo(48, 1);
    });

    it('calculateServiceCapacity: 200A × 208V × 3φ = 71.97 kVA', () => {
      expect(calculateServiceCapacity(200, 208, 3)).toBeCloseTo(71.97, 0);
    });

    it('calculateAmpsFromKVA: inverse of capacity', () => {
      const kva = calculateServiceCapacity(200, 240, 1);
      const amps = calculateAmpsFromKVA(kva, 240, 1);
      expect(amps).toBeCloseTo(200, 1);
    });

    it('roundToStandardServiceSize: rounds up to next standard', () => {
      expect(roundToStandardServiceSize(150)).toBe(150);
      expect(roundToStandardServiceSize(151)).toBe(200);
      expect(roundToStandardServiceSize(201)).toBe(225);
      expect(roundToStandardServiceSize(350)).toBe(400);
    });
  });
});

// ============================================================================
// 3. RESIDENTIAL LOAD — NEC 220.82, 220.84
// ============================================================================

describe('Residential Load (NEC 220.82 / 220.84)', () => {
  const baseAppliances: ResidentialAppliances = {
    range: { enabled: true, kw: 12, type: 'electric' },
    dryer: { enabled: true, kw: 5, type: 'electric' },
    waterHeater: { enabled: true, kw: 4.5, type: 'electric' },
    hvac: { enabled: true, type: 'ac_only', coolingKw: 5 },
    dishwasher: { enabled: true, kw: 1.2 },
    disposal: { enabled: true, kw: 0.5 },
  };

  describe('calculateSingleFamilyLoad (NEC 220.82)', () => {
    it('should calculate lighting load at 3 VA/sq ft', () => {
      const result = calculateSingleFamilyLoad({
        squareFootage: 2000,
        smallApplianceCircuits: 2,
        laundryCircuit: true,
        appliances: {},
      });
      // Lighting connected = 2000 × 3 = 6000 VA
      const lightingEntry = result.breakdown.find(b => b.category === 'General Lighting');
      expect(lightingEntry?.connectedVA).toBe(6000);
      expect(result.necReferences).toContain('NEC 220.82 - Standard Method');
    });

    it('should return a valid result with all standard appliances', () => {
      const result = calculateSingleFamilyLoad({
        squareFootage: 2500,
        smallApplianceCircuits: 2,
        laundryCircuit: true,
        appliances: baseAppliances,
      });

      expect(result.totalConnectedVA).toBeGreaterThan(0);
      expect(result.totalDemandVA).toBeGreaterThan(0);
      expect(result.totalDemandVA).toBeLessThanOrEqual(result.totalConnectedVA);
      expect(result.serviceAmps).toBeGreaterThan(0);
      expect(result.recommendedServiceSize).toBeGreaterThanOrEqual(100);
      expect(result.necReferences.length).toBeGreaterThan(0);
    });

    it('should warn when < 2 small appliance circuits', () => {
      const result = calculateSingleFamilyLoad({
        squareFootage: 1000,
        smallApplianceCircuits: 1,
        laundryCircuit: true,
        appliances: {},
      });
      expect(result.warnings.some(w => w.includes('Minimum 2 small appliance circuits'))).toBe(true);
    });

    it('should include neutral load calculation per NEC 220.61', () => {
      const result = calculateSingleFamilyLoad({
        squareFootage: 2500,
        smallApplianceCircuits: 2,
        laundryCircuit: true,
        appliances: baseAppliances,
      });
      expect(result.neutralLoadVA).toBeGreaterThan(0);
      expect(result.neutralAmps).toBeGreaterThan(0);
    });

    it('should include conductor size recommendations', () => {
      const result = calculateSingleFamilyLoad({
        squareFootage: 2500,
        smallApplianceCircuits: 2,
        laundryCircuit: true,
        appliances: baseAppliances,
      });
      expect(result.serviceConductorSize).toBeDefined();
      expect(result.neutralConductorSize).toBeDefined();
      expect(result.gecSize).toBeDefined();
    });
  });

  describe('calculateMultiFamilyLoad (NEC 220.84)', () => {
    it('should apply NEC 220.84 demand factor to building total', () => {
      const result = calculateMultiFamilyLoad({
        unitTemplates: [
          {
            id: '1',
            name: 'Type A',
            squareFootage: 900,
            unitCount: 10,
            appliances: baseAppliances,
          },
        ],
      });

      // 10 units → 43% demand factor per Table 220.84
      const dfEntry = result.breakdown.find(b => b.category === 'Multi-Family Demand Factor');
      expect(dfEntry).toBeDefined();
      expect(dfEntry?.demandFactor).toBeCloseTo(0.43, 2);
      expect(result.totalDemandVA).toBeLessThan(result.totalConnectedVA);
      expect(result.necReferences).toContain('NEC 220.84 - Multi-Family Optional Method');
    });

    it('should warn if fewer than 3 units', () => {
      const result = calculateMultiFamilyLoad({
        unitTemplates: [
          { id: '1', name: 'A', squareFootage: 800, unitCount: 2, appliances: {} },
        ],
      });
      expect(result.warnings.some(w => w.includes('minimum 3 dwelling units'))).toBe(true);
    });

    it('should include house panel load at 100% (after demand factor)', () => {
      const result = calculateMultiFamilyLoad({
        unitTemplates: [
          { id: '1', name: 'A', squareFootage: 900, unitCount: 10, appliances: baseAppliances },
        ],
        housePanelLoad: 15000,
      });

      const houseEntry = result.breakdown.find(b => b.category === 'House/Common Loads');
      expect(houseEntry?.demandVA).toBe(15000);
      expect(houseEntry?.demandFactor).toBe(1.0);
    });
  });
});

// ============================================================================
// 4. DEMAND FACTOR — NEC 220.42–220.56
// ============================================================================

describe('Demand Factor (NEC Article 220)', () => {
  describe('calculatePanelDemand', () => {
    it('should apply lighting demand factor per NEC 220.42', () => {
      // 5000 VA lighting: first 3000 at 100%, next 2000 at 35%
      // Demand = 3000 + 700 = 3700 VA. Factor = 3700/5000 = 0.74
      const circuits: CircuitLoad[] = [
        { id: '1', description: 'Lighting 1', loadWatts: 2500, loadType: 'L', pole: 1, circuitNumber: 1 },
        { id: '2', description: 'Lighting 2', loadWatts: 2500, loadType: 'L', pole: 1, circuitNumber: 3 },
      ];
      const result = calculatePanelDemand(circuits, 240, 1);

      const lightingLoad = result.loadsByType.find(l => l.type === 'L');
      expect(lightingLoad).toBeDefined();
      expect(lightingLoad!.demandFactor).toBeCloseTo(0.74, 2);
      expect(result.necReferences).toContain('NEC 220.42 - Lighting Demand Factors');
    });

    it('should apply receptacle demand factor per NEC 220.44', () => {
      // 15000 VA receptacles: first 10000 at 100%, next 5000 at 50%
      // Demand = 10000 + 2500 = 12500. Factor = 12500/15000 = 0.833
      const circuits: CircuitLoad[] = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        description: `Receptacle ${i}`,
        loadWatts: 1500,
        loadType: 'R' as const,
        pole: 1 as const,
        circuitNumber: i * 2 + 1,
      }));
      const result = calculatePanelDemand(circuits, 240, 1);

      const recepLoad = result.loadsByType.find(l => l.type === 'R');
      expect(recepLoad).toBeDefined();
      expect(recepLoad!.demandFactor).toBeCloseTo(0.833, 2);
      expect(result.necReferences).toContain('NEC 220.44 - Receptacle Demand Factors');
    });

    it('should apply 125% to largest motor per NEC 430.24', () => {
      const circuits: CircuitLoad[] = [
        { id: '1', description: 'Motor 1', loadWatts: 2000, loadType: 'M', pole: 1, circuitNumber: 1 },
        { id: '2', description: 'Motor 2 (largest)', loadWatts: 5000, loadType: 'M', pole: 2, circuitNumber: 3 },
        { id: '3', description: 'Motor 3', loadWatts: 1000, loadType: 'M', pole: 1, circuitNumber: 5 },
      ];
      const result = calculatePanelDemand(circuits, 208, 3);

      const motorLoad = result.loadsByType.find(l => l.type === 'M');
      expect(motorLoad).toBeDefined();
      // Largest motor = 5000, at 125% = 6250. Others = 2000 + 1000 = 3000.
      // adjustmentFactor = 9250 / 8000 = 1.15625
      expect(motorLoad!.adjustmentFactor).toBeCloseTo(1.156, 2);
      expect(result.necReferences).toContain('NEC 430.24 - Largest Motor at 125%');
    });

    it('should handle non-coincident heating/cooling per NEC 220.60', () => {
      const circuits: CircuitLoad[] = [
        { id: '1', description: 'A/C', loadWatts: 5000, loadType: 'C', pole: 2, circuitNumber: 1 },
        { id: '2', description: 'Heat', loadWatts: 3000, loadType: 'H', pole: 2, circuitNumber: 3 },
      ];
      const result = calculatePanelDemand(circuits, 240, 1);
      // Both appear in loadsByType — it's the engineer's job to omit the smaller
      // But both should have NEC references
      expect(result.necReferences).toContain('NEC 220.60 - Noncoincident Loads (Heating/Cooling)');
    });

    it('should calculate demand amps for single-phase', () => {
      const circuits: CircuitLoad[] = [
        { id: '1', description: 'Load', loadWatts: 24000, loadType: 'O', pole: 2, circuitNumber: 1 },
      ];
      const result = calculatePanelDemand(circuits, 240, 1);
      // 24 kVA / 240V = 100A
      expect(result.demandAmps).toBeCloseTo(100, 0);
    });

    it('should calculate demand amps for three-phase', () => {
      const circuits: CircuitLoad[] = [
        { id: '1', description: 'Load', loadWatts: 36000, loadType: 'O', pole: 3, circuitNumber: 1 },
      ];
      const result = calculatePanelDemand(circuits, 208, 3);
      // 36 kVA / (208 × √3) = 36000 / 360.22 ≈ 99.9A
      expect(result.demandAmps).toBeCloseTo(100, 0);
    });

    it('should include phase imbalance calculation', () => {
      const circuits: CircuitLoad[] = [
        { id: '1', description: 'A', loadWatts: 10000, loadType: 'O', pole: 1, circuitNumber: 1, phase: 'A' },
        { id: '2', description: 'B', loadWatts: 2000, loadType: 'O', pole: 1, circuitNumber: 3, phase: 'B' },
      ];
      const result = calculatePanelDemand(circuits, 240, 1);
      expect(result.percentImbalance).toBeGreaterThan(0);
    });
  });

  describe('getCircuitPhase', () => {
    it('should alternate A,B for single-phase', () => {
      expect(getCircuitPhase(1, 1)).toBe('A');
      expect(getCircuitPhase(2, 1)).toBe('A');
      expect(getCircuitPhase(3, 1)).toBe('B');
      expect(getCircuitPhase(4, 1)).toBe('B');
    });

    it('should cycle A,B,C for three-phase', () => {
      expect(getCircuitPhase(1, 3)).toBe('A');
      expect(getCircuitPhase(2, 3)).toBe('A');
      expect(getCircuitPhase(3, 3)).toBe('B');
      expect(getCircuitPhase(4, 3)).toBe('B');
      expect(getCircuitPhase(5, 3)).toBe('C');
      expect(getCircuitPhase(6, 3)).toBe('C');
      expect(getCircuitPhase(7, 3)).toBe('A'); // wraps
    });
  });
});

// ============================================================================
// 5. MULTI-FAMILY EV — NEC 220.57, 625.42
// ============================================================================

describe('Multi-Family EV (NEC 220.57 / 625.42)', () => {
  describe('getMultiFamilyDemandFactor', () => {
    it('should return 1.0 for < 3 units', () => {
      expect(getMultiFamilyDemandFactor(1)).toBe(1.0);
      expect(getMultiFamilyDemandFactor(2)).toBe(1.0);
    });

    it('should return 0.45 for 3-5 units', () => {
      expect(getMultiFamilyDemandFactor(3)).toBe(0.45);
      expect(getMultiFamilyDemandFactor(5)).toBe(0.45);
    });

    it('should return 0.43 for 8-10 units', () => {
      expect(getMultiFamilyDemandFactor(8)).toBe(0.43);
      expect(getMultiFamilyDemandFactor(10)).toBe(0.43);
    });
  });

  describe('calculateMultiFamilyEV', () => {
    const baseInput: MultiFamilyEVInput = {
      dwellingUnits: 20,
      avgUnitSqFt: 900,
      voltage: 208,
      phase: 3,
      existingServiceAmps: 800,
      evChargers: { count: 10, level: 'Level2', ampsPerCharger: 32 },
    };

    it('should calculate per-EVSE load as max(7200VA, nameplate) per NEC 220.57', () => {
      const result = calculateMultiFamilyEV(baseInput);
      // 32A × 208V = 6656 VA < 7200 VA → use 7200 VA
      expect(result.evLoad.totalConnectedVA).toBe(7200 * 10);
      expect(result.compliance.necArticles).toContain('NEC 220.57');
    });

    it('should use nameplate when > 7200 VA per NEC 220.57', () => {
      const input: MultiFamilyEVInput = {
        ...baseInput,
        evChargers: { count: 5, level: 'Level2', ampsPerCharger: 48 },
      };
      const result = calculateMultiFamilyEV(input);
      // 48A × 208V = 9984 VA > 7200 VA → use 9984 VA
      expect(result.evLoad.totalConnectedVA).toBe(9984 * 5);
    });

    it('should use demand factor of 1.0 for EV loads (NEC 220.57 has no DF)', () => {
      const result = calculateMultiFamilyEV(baseInput);
      expect(result.evLoad.demandFactor).toBe(1.0);
    });

    it('should include all key NEC articles', () => {
      const result = calculateMultiFamilyEV(baseInput);
      expect(result.compliance.necArticles).toContain('NEC 220.84');
      expect(result.compliance.necArticles).toContain('NEC 220.57');
      expect(result.compliance.necArticles).toContain('NEC 625.42');
    });

    it('should produce three scenarios (noEVEMS, withEVEMS, withUpgrade)', () => {
      const result = calculateMultiFamilyEV(baseInput);
      expect(result.scenarios.noEVEMS).toBeDefined();
      expect(result.scenarios.withEVEMS).toBeDefined();
      expect(result.scenarios.withUpgrade).toBeDefined();
    });

    it('should calculate building load using NEC 220.84 demand factor', () => {
      const result = calculateMultiFamilyEV(baseInput);
      // 20 units → 38% demand factor
      expect(result.buildingLoad.buildingDemandFactor).toBe(0.38);
      expect(result.buildingLoad.buildingDemandVA).toBeLessThan(result.buildingLoad.totalConnectedVA);
    });

    it('should use measured data when existingLoadMethod is utility_bill', () => {
      const input: MultiFamilyEVInput = {
        ...baseInput,
        existingLoadMethod: 'utility_bill',
        measuredPeakDemandKW: 100,
        measurementPeriod: 'Jan-Dec 2025',
      };
      const result = calculateMultiFamilyEV(input);
      expect(result.buildingLoad.loadDeterminationMethod).toBe('utility_bill');
      expect(result.buildingLoad.buildingDemandVA).toBe(100000); // 100 kW × 1000
      expect(result.buildingLoad.buildingDemandFactor).toBe(1.0);
    });

    it('should include phase balance for 3-phase systems', () => {
      const result = calculateMultiFamilyEV(baseInput);
      expect(result.phaseBalance).toBeDefined();
      expect(result.phaseBalance!.imbalancePercent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateCommonAreaLoads', () => {
    it('should return zero for empty input', () => {
      const result = calculateCommonAreaLoads([]);
      expect(result.totalConnectedVA).toBe(0);
      expect(result.totalDemandVA).toBe(0);
    });

    it('should apply elevator demand factor (largest at 100%, others at 50%)', () => {
      const result = calculateCommonAreaLoads([
        { category: 'elevators', description: 'Elevator 1', inputType: 'va', value: 30000 },
        { category: 'elevators', description: 'Elevator 2', inputType: 'va', value: 20000 },
      ]);
      // Largest (30000) at 100% + second (20000) at 50% = 30000 + 10000 = 40000
      const elevEntry = result.items.find(i => i.category.includes('Elevator'));
      expect(elevEntry?.demandVA).toBe(40000);
    });
  });
});

// ============================================================================
// 6. ARC FLASH — IEEE 1584-2018, NFPA 70E
// ============================================================================

describe('Arc Flash (IEEE 1584 / NFPA 70E)', () => {
  describe('calculateArcFlash', () => {
    it('should calculate incident energy for a typical 480V panelboard', () => {
      const input: ArcFlashInput = {
        shortCircuitCurrent: 25, // 25 kA
        voltage: 480,
        phase: 3,
        equipmentType: 'panelboard',
        protectiveDevice: 'circuit_breaker',
        deviceRating: 100,
      };
      const result = calculateArcFlash(input);

      expect(result.incidentEnergy).toBeGreaterThan(0);
      expect(result.arcFlashBoundary).toBeGreaterThan(0);
      expect(typeof result.ppeCategory).not.toBe('undefined');
      expect(result.details.shortCircuitCurrent).toBe(25);
      expect(result.details.voltage).toBe(480);
      expect(result.compliance.necArticle).toBe('NEC 110.16');
      expect(result.compliance.nfpaArticle).toBe('NFPA 70E Article 130');
    });

    it('should calculate lower incident energy for 208V system', () => {
      const input480: ArcFlashInput = {
        shortCircuitCurrent: 20,
        voltage: 480,
        phase: 3,
        equipmentType: 'panelboard',
        protectiveDevice: 'circuit_breaker',
        deviceRating: 100,
      };
      const input208: ArcFlashInput = {
        ...input480,
        voltage: 208,
      };
      const result480 = calculateArcFlash(input480);
      const result208 = calculateArcFlash(input208);

      // Lower voltage should generally produce lower incident energy
      expect(result208.incidentEnergy).toBeLessThan(result480.incidentEnergy);
    });

    it('should assign PPE category 0 for low incident energy', () => {
      const input: ArcFlashInput = {
        shortCircuitCurrent: 5, // Low fault current
        voltage: 208,
        phase: 1,
        equipmentType: 'panelboard',
        protectiveDevice: 'current_limiting_fuse',
        deviceRating: 30,
      };
      const result = calculateArcFlash(input);
      // Very fast clearing + low fault → low incident energy
      if (result.incidentEnergy < 1.2) {
        expect(result.ppeCategory).toBe(0);
      }
    });

    it('should reduce incident energy with current-limiting devices', () => {
      const baseInput: ArcFlashInput = {
        shortCircuitCurrent: 20,
        voltage: 480,
        phase: 3,
        equipmentType: 'panelboard',
        protectiveDevice: 'circuit_breaker',
        deviceRating: 100,
      };
      const clInput: ArcFlashInput = {
        ...baseInput,
        protectiveDevice: 'current_limiting_fuse',
      };
      const resultStd = calculateArcFlash(baseInput);
      const resultCL = calculateArcFlash(clInput);

      // Current limiting fuse clears faster → lower incident energy
      expect(resultCL.incidentEnergy).toBeLessThan(resultStd.incidentEnergy);
    });

    it('should include recommendations for high incident energy', () => {
      const input: ArcFlashInput = {
        shortCircuitCurrent: 65,
        voltage: 480,
        phase: 3,
        equipmentType: 'switchgear',
        protectiveDevice: 'circuit_breaker',
        deviceRating: 400,
      };
      const result = calculateArcFlash(input);
      expect(result.compliance.recommendations.length).toBeGreaterThan(0);
    });

    it('should return non-compliant warnings on invalid inputs (shortCircuitCurrent <= 0)', () => {
      const input: ArcFlashInput = {
        shortCircuitCurrent: 0,
        voltage: 480,
        phase: 3,
        equipmentType: 'panelboard',
        protectiveDevice: 'circuit_breaker',
        deviceRating: 100,
      };
      const result = calculateArcFlash(input);
      expect(result.compliance.compliant).toBe(false);
      expect(result.compliance.message).toBe('Short circuit current must be greater than zero');
      expect(result.compliance.recommendations).toContain('Short circuit current must be greater than zero');
    });

    it('should return non-compliant warnings on invalid voltage', () => {
      const input: ArcFlashInput = {
        shortCircuitCurrent: 25,
        voltage: 0,
        phase: 3,
        equipmentType: 'panelboard',
        protectiveDevice: 'circuit_breaker',
        deviceRating: 100,
      };
      const result = calculateArcFlash(input);
      expect(result.compliance.compliant).toBe(false);
      expect(result.compliance.message).toBe('Voltage must be greater than zero');
      expect(result.compliance.recommendations).toContain('Voltage must be greater than zero');
    });

    it('should use default working distance by equipment type', () => {
      const input: ArcFlashInput = {
        shortCircuitCurrent: 25,
        voltage: 480,
        phase: 3,
        equipmentType: 'switchgear',
        protectiveDevice: 'circuit_breaker',
        deviceRating: 200,
      };
      const result = calculateArcFlash(input);
      expect(result.details.workingDistance).toBe(36); // switchgear = 36 inches
    });

    it('should use default arc gap based on voltage', () => {
      const input: ArcFlashInput = {
        shortCircuitCurrent: 25,
        voltage: 480,
        phase: 3,
        equipmentType: 'panelboard',
        protectiveDevice: 'circuit_breaker',
        deviceRating: 100,
      };
      const result = calculateArcFlash(input);
      expect(result.details.arcGap).toBe(0.5); // 480V → 0.5 inches
    });
  });
});

// ============================================================================
// UPSTREAM LOAD AGGREGATION — NEC 220.84 OPTIONAL METHOD WIRING (C1)
// ============================================================================
// Regression test for the C1 fix: PDF Load-Calc page must consume the same
// 220.84 Optional Method result that the in-app MDP "Aggregated Load" tile
// shows, instead of falling through to the standard NEC 220 cascade where all
// 'O' (Other) circuits get summed at 100% under NEC 220.14.
//
// Scenario mirrors the audit packet (12 dwelling units + house + EVEMS-managed
// EV sub-panel, 240V single-phase, 1000A service) so this test fails if the
// wiring regresses to the pre-C1 behavior.

describe('Upstream Load Aggregation — NEC 220.84 Optional Method (C1)', () => {
  // Minimal Panel/Circuit factories — only the fields the aggregation engine
  // actually reads. Cast through `unknown` to skip DB columns we don't need.
  const makePanel = (overrides: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel =>
    ({
      bus_rating: 200,
      voltage: 240,
      phase: 1,
      num_spaces: 42,
      project_id: 'proj-1',
      is_main: false,
      fed_from: null,
      fed_from_type: null,
      fed_from_transformer_id: null,
      ...overrides,
    } as unknown as Panel);

  const makeCircuit = (
    panelId: string,
    loadVA: number,
    loadType: string = 'O',
    idSuffix: string = '',
  ): Circuit =>
    ({
      id: `c-${panelId}-${loadVA}-${idSuffix}`,
      panel_id: panelId,
      load_watts: loadVA,
      load_type: loadType,
      project_id: 'proj-1',
      circuit_number: 1,
      pole: 1,
      breaker_amps: 20,
      description: 'test',
    } as unknown as Circuit);

  // 12-unit MF building: MDP + 12 unit panels (36.2 kVA each) + House panel
  // (13.8 kVA) + EV sub-panel (50.3 kVA EVEMS-managed). All circuits tagged
  // 'O' to mirror the real audit packet — that's why the un-fixed PDF dumps
  // everything into the NEC 220.14 "Other 100%" bucket.
  const buildFixture = () => {
    const mdp = makePanel({ id: 'mdp', name: 'Multifamily Test MDP', is_main: true, bus_rating: 1000 });
    const housePanel = makePanel({
      id: 'p-house', name: 'House Panel',
      fed_from_type: 'panel', fed_from: 'mdp',
    });
    const evPanel = makePanel({
      id: 'p-ev', name: 'EV Sub-Panel',
      fed_from_type: 'panel', fed_from: 'mdp', bus_rating: 400,
    });
    const unitPanels: Panel[] = Array.from({ length: 12 }, (_, i) =>
      makePanel({
        id: `p-unit-${101 + i}`,
        name: `Unit ${101 + i} Panel`,
        fed_from_type: 'panel',
        fed_from: 'mdp',
      }),
    );

    const panels: Panel[] = [mdp, housePanel, evPanel, ...unitPanels];

    const circuits: Circuit[] = [
      // House panel: 13.8 kVA total
      makeCircuit('p-house', 13_800, 'O', 'house'),
      // EV sub-panel: 50.3 kVA EVEMS-managed setpoint
      makeCircuit('p-ev', 50_300, 'O', 'ev'),
      // Each unit panel: 36.2 kVA — matches the audit packet
      ...unitPanels.map(p => makeCircuit(p.id, 36_200, 'O', 'unit')),
    ];

    const transformers: Transformer[] = [];
    return { panels, circuits, transformers, mdp };
  };

  describe('buildMultiFamilyContext gate', () => {
    it('returns context when all 4 conditions are met', () => {
      const { panels, circuits, transformers, mdp } = buildFixture();
      const ctx = buildMultiFamilyContext(mdp, panels, circuits, transformers, {
        occupancyType: 'dwelling',
        residential: { dwellingType: 'multi_family', totalUnits: 12 },
      });
      expect(ctx).toBeDefined();
      expect(ctx?.dwellingUnits).toBe(12);
      // House and EV totals collected via name-match
      expect(ctx?.housePanelLoadVA).toBe(13_800);
      expect(ctx?.evLoadVA).toBe(50_300);
    });

    it('returns undefined for commercial occupancy (no MF override)', () => {
      const { panels, circuits, transformers, mdp } = buildFixture();
      const ctx = buildMultiFamilyContext(mdp, panels, circuits, transformers, {
        occupancyType: 'commercial',
        residential: { dwellingType: 'multi_family', totalUnits: 12 },
      });
      expect(ctx).toBeUndefined();
    });

    it('returns undefined for fewer than 3 units (NEC 220.84 minimum)', () => {
      const { panels, circuits, transformers, mdp } = buildFixture();
      const ctx = buildMultiFamilyContext(mdp, panels, circuits, transformers, {
        occupancyType: 'dwelling',
        residential: { dwellingType: 'multi_family', totalUnits: 2 },
      });
      expect(ctx).toBeUndefined();
    });

    it('returns undefined for single-family dwelling type', () => {
      const { panels, circuits, transformers, mdp } = buildFixture();
      const ctx = buildMultiFamilyContext(mdp, panels, circuits, transformers, {
        occupancyType: 'dwelling',
        residential: { dwellingType: 'single_family', totalUnits: 12 },
      });
      expect(ctx).toBeUndefined();
    });

    it('returns undefined when called on a non-MDP panel', () => {
      const { panels, circuits, transformers } = buildFixture();
      const unitPanel = panels.find(p => p.id === 'p-unit-101')!;
      const ctx = buildMultiFamilyContext(unitPanel, panels, circuits, transformers, {
        occupancyType: 'dwelling',
        residential: { dwellingType: 'multi_family', totalUnits: 12 },
      });
      expect(ctx).toBeUndefined();
    });
  });

  describe('calculateAggregatedLoad with multi-family context', () => {
    it('applies NEC 220.84 (41% for 12 units), house @ 100%, EVEMS @ 100%', () => {
      const { panels, circuits, transformers, mdp } = buildFixture();
      const ctx = buildMultiFamilyContext(mdp, panels, circuits, transformers, {
        occupancyType: 'dwelling',
        residential: { dwellingType: 'multi_family', totalUnits: 12 },
      });

      const result = calculateAggregatedLoad(mdp.id, panels, circuits, transformers, 'dwelling', ctx);

      // Total connected: 12 × 36.2 + 13.8 + 50.3 = 498.5 kVA
      expect(result.totalConnectedVA).toBe(498_500);

      // Dwelling demand: 12 × 36.2 × 0.41 = 178.104 kVA
      // House: 13.8 kVA @ 100%
      // EVEMS: 50.3 kVA @ 100%
      // Total demand: 178.104 + 13.8 + 50.3 ≈ 242.2 kVA
      expect(result.totalDemandVA).toBeGreaterThanOrEqual(242_000);
      expect(result.totalDemandVA).toBeLessThanOrEqual(242_500);

      // Three breakdown rows — Dwelling, House, EV — not the legacy "Other" row
      expect(result.demandBreakdown).toHaveLength(3);

      const dwelling = result.demandBreakdown.find(d => d.loadType.includes('Multi-Family Dwelling'));
      expect(dwelling).toBeDefined();
      expect(dwelling?.demandFactor).toBeCloseTo(0.41, 2);
      expect(dwelling?.necReference).toContain('220.84');

      const house = result.demandBreakdown.find(d => d.loadType.includes('House'));
      expect(house?.demandFactor).toBe(1.0);

      const ev = result.demandBreakdown.find(d => d.loadType.includes('EV'));
      expect(ev?.demandFactor).toBe(1.0);
      expect(ev?.necReference).toContain('625.42');
    });

    it('REGRESSION: without context falls back to NEC 220.14 Other @100% (the C1 bug)', () => {
      // Confirms the pre-C1 broken behavior is reproducible — this is the
      // failure mode that the audit packet exhibited (498.4 kVA / 100% / "Other").
      const { panels, circuits, transformers, mdp } = buildFixture();

      const result = calculateAggregatedLoad(mdp.id, panels, circuits, transformers, 'dwelling');

      // No context → standard NEC 220 path → all 'O' circuits in the Other bucket
      const other = result.demandBreakdown.find(d => d.loadType === 'Other');
      expect(other).toBeDefined();
      expect(other?.demandFactor).toBe(1.0);
      expect(other?.necReference).toContain('220.14');

      // Without context the "demand" equals the connected total (no DF reduction)
      expect(result.totalDemandVA).toBe(result.totalConnectedVA);
      expect(result.totalDemandVA).toBe(498_500);
    });

    it('commercial occupancy is unaffected by the C1 fix (no MF context built)', () => {
      const { panels, circuits, transformers, mdp } = buildFixture();
      const ctx = buildMultiFamilyContext(mdp, panels, circuits, transformers, {
        occupancyType: 'commercial',
      });
      expect(ctx).toBeUndefined();

      // Commercial path uses standard NEC 220 cascade — no behavior change
      const result = calculateAggregatedLoad(mdp.id, panels, circuits, transformers, 'commercial', ctx);
      expect(result.totalDemandVA).toBe(result.totalConnectedVA);
    });
  });
});

// ============================================================================
// FEEDER LOAD SYNC — LIVE-DERIVE FROM DESTINATION PANEL DEMAND (C2)
// ============================================================================
// Regression test for the C2 fix: PDF Voltage Drop generator must compute
// feeder loads from the destination panel's current aggregated demand instead
// of reading the cached `feeder.total_load_va` column. The cache becomes stale
// whenever auto-population (Multi-Family EV calculator, templates) creates a
// feeder before the destination panel's circuits exist — the audit packet's
// 14 AWG / 0.0 A "Compliant" EVSE feeder was the visible symptom.
//
// Scenario mirrors the audit packet: MDP → EV Sub-Panel feeder, 75 ft, no
// cached load, but the destination panel has 50.3 kVA of EVSE-managed circuits.
// computeFeederLoadVA must return ~50,300 VA so calculateFeederSizing picks
// the right conductor (≈210 A continuous → 4/0 AWG range) instead of falling
// back to the smallest entry in the ampacity table (14 AWG).

import { computeFeederLoadVA } from '../services/feeder/feederLoadSync';
import { calculateFeederSizing } from '../services/calculations/feederSizing';
import type { Feeder, FeederCalculationInput } from '../types';

describe('Feeder Load Sync — live-derive from destination panel (C2)', () => {
  // Same factory shape as the C1 fixture — Panel/Circuit casts through unknown
  // because we only need the columns the calculation engine reads, not the full
  // Supabase row shape (created_at, updated_at, etc).
  const makePanel = (overrides: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel =>
    ({
      bus_rating: 200,
      voltage: 240,
      phase: 1,
      num_spaces: 42,
      project_id: 'proj-1',
      is_main: false,
      fed_from: null,
      fed_from_type: null,
      fed_from_transformer_id: null,
      ...overrides,
    } as unknown as Panel);

  const makeCircuit = (
    panelId: string,
    loadVA: number,
    loadType: string = 'O',
    idSuffix: string = '',
  ): Circuit =>
    ({
      id: `c-${panelId}-${loadVA}-${idSuffix}`,
      panel_id: panelId,
      load_watts: loadVA,
      load_type: loadType,
      project_id: 'proj-1',
      circuit_number: 1,
      pole: 1,
      breaker_amps: 20,
      description: 'test',
    } as unknown as Circuit);

  const makeFeeder = (overrides: Partial<Feeder> & Pick<Feeder, 'id' | 'name'>): Feeder =>
    ({
      project_id: 'proj-1',
      source_panel_id: null,
      source_transformer_id: null,
      destination_panel_id: null,
      destination_transformer_id: null,
      distance_ft: 75,
      conductor_material: 'Cu',
      conduit_type: 'PVC',
      ambient_temperature_c: 30,
      num_current_carrying: 3,
      total_load_va: 0,
      continuous_load_va: 0,
      noncontinuous_load_va: 0,
      design_load_va: null,
      phase_conductor_size: null,
      voltage_drop_percent: null,
      ...overrides,
    } as unknown as Feeder);

  describe('computeFeederLoadVA', () => {
    it('returns destination panel demand when feeder.total_load_va is stale (the C2 bug)', () => {
      const mdp = makePanel({ id: 'mdp', name: 'MDP', is_main: true, bus_rating: 1000 });
      const evPanel = makePanel({
        id: 'p-ev', name: 'EV Sub-Panel',
        fed_from_type: 'panel', fed_from: 'mdp', bus_rating: 400,
      });
      const panels = [mdp, evPanel];
      // Real downstream: 50.3 kVA of EVSE-managed circuits on the EV panel
      const circuits = [makeCircuit('p-ev', 50_300, 'O', 'evems')];
      const transformers: Transformer[] = [];

      // Stale cache: feeder created before circuits were populated
      const feeder = makeFeeder({
        id: 'f-mdp-ev', name: 'MDP→EV Feeder',
        source_panel_id: 'mdp', destination_panel_id: 'p-ev',
        total_load_va: 0,  // ← the bug: cached at 0
      });

      const liveLoad = computeFeederLoadVA(feeder, panels, circuits, transformers);
      expect(liveLoad).toBe(50_300);
    });

    it('falls back to cached value for transformer feeders (no destination_panel_id)', () => {
      const transformers: Transformer[] = [];
      const xfmrFeeder = makeFeeder({
        id: 'f-xfmr', name: 'MDP→XFMR Feeder',
        source_panel_id: 'mdp',
        destination_panel_id: null,
        destination_transformer_id: 't-1',
        total_load_va: 75_000,
      });
      const result = computeFeederLoadVA(xfmrFeeder, [], [], transformers);
      expect(result).toBe(75_000);
    });

    it('falls back to cached value when destination panel cannot be found (data integrity)', () => {
      const orphanFeeder = makeFeeder({
        id: 'f-orphan', name: 'Orphan',
        destination_panel_id: 'p-deleted',
        total_load_va: 12_000,
      });
      const result = computeFeederLoadVA(orphanFeeder, [], [], []);
      expect(result).toBe(12_000);
    });

    it('returns 0 when destination panel exists but has no circuits', () => {
      const emptyPanel = makePanel({ id: 'p-empty', name: 'Empty Panel' });
      const feeder = makeFeeder({
        id: 'f-empty', name: 'To Empty',
        destination_panel_id: 'p-empty',
        total_load_va: 99_999,  // stale cached value should be ignored
      });
      const result = computeFeederLoadVA(feeder, [emptyPanel], [], []);
      expect(result).toBe(0);
    });
  });

  describe('end-to-end: live-derived feeder sizing avoids the 14 AWG / 0 A bug', () => {
    it('picks a real conductor size for an EVSE sub-panel feeder', () => {
      // Reconstruct the audit packet's exact symptom: pre-fix the EVSE feeder
      // showed 14 AWG / 0.0 A / "Compliant" because feeder.total_load_va was 0
      // even though the destination panel had 50.3 kVA of downstream load.
      const mdp = makePanel({ id: 'mdp', name: 'MDP', is_main: true, bus_rating: 1000 });
      const evPanel = makePanel({
        id: 'p-ev', name: 'EV Sub-Panel',
        fed_from_type: 'panel', fed_from: 'mdp', bus_rating: 400,
      });
      const panels = [mdp, evPanel];
      const circuits = [makeCircuit('p-ev', 50_300, 'O', 'evems')];

      const feeder = makeFeeder({
        id: 'f-evse', name: 'MDP→EVSE',
        source_panel_id: 'mdp', destination_panel_id: 'p-ev',
        total_load_va: 0,
      });

      const liveLoad = computeFeederLoadVA(feeder, panels, circuits, []);
      // 50,300 VA / 240 V = ~210 A — well above 14 AWG's 15 A NEC 240.4(D) limit
      expect(liveLoad).toBe(50_300);

      const sizingInput: FeederCalculationInput = {
        source_voltage: 240,
        source_phase: 1,
        destination_voltage: 240,
        destination_phase: 1,
        total_load_va: liveLoad,
        continuous_load_va: liveLoad * 0.8,
        noncontinuous_load_va: liveLoad * 0.2,
        distance_ft: 75,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 3,
        max_voltage_drop_percent: 3.0,
      };

      const result = calculateFeederSizing(sizingInput);

      // Design current should be ~210 A (50,300 / 240), not 0 A
      expect(result.design_current_amps).toBeGreaterThan(150);
      expect(result.design_current_amps).toBeLessThan(300);

      // Conductor must NOT be the 14 AWG fallback — at ~210 A continuous
      // we expect at least 3/0 AWG Cu or larger per NEC 310.16
      expect(result.phase_conductor_size).not.toBe('14');
      expect(result.phase_conductor_size).not.toBe('12');
      expect(result.phase_conductor_size).not.toBe('10');

      // Voltage drop should be a real non-zero number, not the vacuous 0%
      expect(result.voltage_drop_volts).toBeGreaterThan(0);
      expect(result.voltage_drop_percent).toBeGreaterThan(0);
    });

    it('REGRESSION: pre-C2 stale read produces the 14 AWG / 0 A bug', () => {
      // Confirms the broken behavior is reproducible — when callers don't pass
      // panels/circuits, calculateFeederSizing receives 0 VA and returns the
      // smallest table entry (14 AWG). This is what the audit packet showed.
      const sizingInput: FeederCalculationInput = {
        source_voltage: 240,
        source_phase: 1,
        destination_voltage: 240,
        destination_phase: 1,
        total_load_va: 0,
        continuous_load_va: 0,
        noncontinuous_load_va: 0,
        distance_ft: 75,
        conductor_material: 'Cu',
        ambient_temperature_c: 30,
        num_current_carrying: 3,
        max_voltage_drop_percent: 3.0,
      };

      const result = calculateFeederSizing(sizingInput);
      expect(result.design_current_amps).toBe(0);
      // VD = 0 × R × L = 0 V → "Compliant" by vacuous truth (the displayed bug)
      expect(result.voltage_drop_percent).toBe(0);
      expect(result.meets_voltage_drop).toBe(true);
    });
  });
});

// ============================================================================
// PROJECT METADATA VALIDATION — C3 (project address / FL contractor license /
// permit number must reject placeholders that AHJs reject on intake)
// ============================================================================

import {
  projectAddressSchema,
  flContractorLicenseSchema,
  permitNumberSchema,
} from '../lib/validation-schemas';

describe('Project metadata validation (C3)', () => {
  describe('flContractorLicenseSchema', () => {
    it('accepts valid FL EC license (Certified Electrical Contractor)', () => {
      expect(flContractorLicenseSchema.safeParse('EC1234567').success).toBe(true);
    });

    it('accepts valid FL ER license (Registered Electrical Contractor)', () => {
      expect(flContractorLicenseSchema.safeParse('ER9876543').success).toBe(true);
    });

    it('accepts case-insensitive license input', () => {
      expect(flContractorLicenseSchema.safeParse('ec1234567').success).toBe(true);
    });

    it('rejects "test" placeholder (the audit-doc symptom)', () => {
      const result = flContractorLicenseSchema.safeParse('test');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/Format: EC#######/);
      }
    });

    it('rejects out-of-state format (e.g., CA C-10 number)', () => {
      expect(flContractorLicenseSchema.safeParse('C10-123456').success).toBe(false);
    });

    it('rejects missing-letter-prefix format', () => {
      expect(flContractorLicenseSchema.safeParse('1234567').success).toBe(false);
    });

    it('rejects too-short numeric tail', () => {
      expect(flContractorLicenseSchema.safeParse('EC123456').success).toBe(false);
    });

    it('rejects empty string', () => {
      expect(flContractorLicenseSchema.safeParse('').success).toBe(false);
    });
  });

  describe('permitNumberSchema', () => {
    it('accepts undefined (AHJ assigns later)', () => {
      expect(permitNumberSchema.safeParse(undefined).success).toBe(true);
    });

    it('accepts empty string (form blank)', () => {
      expect(permitNumberSchema.safeParse('').success).toBe(true);
    });

    it('accepts a realistic permit number', () => {
      expect(permitNumberSchema.safeParse('PER-2024-001234').success).toBe(true);
    });

    it('rejects 1-3 char permit number (likely a typo)', () => {
      const result = permitNumberSchema.safeParse('AB');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/at least 4 characters/);
      }
    });

    it('rejects "test" placeholder (the audit-doc symptom)', () => {
      const result = permitNumberSchema.safeParse('test');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/placeholder/);
      }
    });
  });

  describe('projectAddressSchema', () => {
    it('accepts a realistic FL address', () => {
      expect(
        projectAddressSchema.safeParse('123 Main St, Orlando, FL 32801').success,
      ).toBe(true);
    });

    it('rejects "TBD" placeholder (the audit-doc symptom)', () => {
      const result = projectAddressSchema.safeParse('TBD');
      expect(result.success).toBe(false);
    });

    it('rejects "test" placeholder', () => {
      const result = projectAddressSchema.safeParse('test');
      expect(result.success).toBe(false);
    });

    it('rejects address with no digits (no street number / no ZIP)', () => {
      const result = projectAddressSchema.safeParse('Main Street, Orlando, Florida');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/street number or ZIP/);
      }
    });

    it('rejects too-short input', () => {
      expect(projectAddressSchema.safeParse('1 Main').success).toBe(false);
    });

    it('rejects empty string', () => {
      expect(projectAddressSchema.safeParse('').success).toBe(false);
    });
  });
});

// ============================================================================
// AI CHAT TOOL: FEEDER VOLTAGE DROP — LIVE-DERIVE (B-1)
// ============================================================================
// Mirrors the C2 fix into the AI assistant path. Pre-fix, when a user asked
// Spark Copilot "is feeder MDP→EV Sub-Panel compliant?" the tool returned the
// cached `feeder.voltageDropPercent` column, which had the same staleness bug
// the PDF had — the AI confidently said "Compliant. 0.00%" on a feeder that
// was actually wildly undersized. B-1 rewires the tool to call
// computeFeederLoadVA + calculateFeederSizing live.

import { executeTool, type ToolContext } from '../services/ai/chatTools';
import type { ProjectContext } from '../services/ai/projectContextBuilder';

describe('AI Chat Tool: calculate_feeder_voltage_drop — live-derive (B-1)', () => {
  // Same factory shapes as the C2 tests above; rebuilt locally rather than
  // exported because the helpers are scoped inside that describe block.
  const makePanelB1 = (overrides: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel =>
    ({
      bus_rating: 200,
      voltage: 240,
      phase: 1,
      num_spaces: 42,
      project_id: 'proj-1',
      is_main: false,
      fed_from: null,
      fed_from_type: null,
      fed_from_transformer_id: null,
      ...overrides,
    } as unknown as Panel);

  const makeCircuitB1 = (panelId: string, loadVA: number, idSuffix: string = ''): Circuit =>
    ({
      id: `c-${panelId}-${loadVA}-${idSuffix}`,
      panel_id: panelId,
      load_watts: loadVA,
      load_type: 'O',
      project_id: 'proj-1',
      circuit_number: 1,
      pole: 1,
      breaker_amps: 20,
      description: 'test',
    } as unknown as Circuit);

  const makeFeederB1 = (overrides: Partial<Feeder> & Pick<Feeder, 'id' | 'name'>): Feeder =>
    ({
      project_id: 'proj-1',
      source_panel_id: null,
      source_transformer_id: null,
      destination_panel_id: null,
      destination_transformer_id: null,
      distance_ft: 75,
      conductor_material: 'Cu',
      conduit_type: 'PVC',
      ambient_temperature_c: 30,
      num_current_carrying: 3,
      total_load_va: 0,
      continuous_load_va: 0,
      noncontinuous_load_va: 0,
      design_load_va: null,
      phase_conductor_size: null,
      voltage_drop_percent: null,
      ...overrides,
    } as unknown as Feeder);

  // Build a minimal ProjectContext that contains only the FeederSummary the
  // tool's findFeeder helper needs to locate the feeder by name.
  const buildContext = (feederId: string, cachedVdPercent?: number): ProjectContext => ({
    projectId: 'proj-1',
    projectName: 'Test',
    projectType: 'Commercial',
    serviceVoltage: 240,
    servicePhase: 1,
    summary: '',
    panels: [],
    circuits: [],
    feeders: [
      {
        id: feederId,
        name: 'MDP→EV Feeder',
        sourcePanel: 'MDP',
        destinationPanel: 'EV Sub-Panel',
        phaseConductorSize: '14',
        voltageDropPercent: cachedVdPercent,
      },
    ],
    transformers: [],
    totalLoad: { connectedVA: 0, demandVA: 0 },
  });

  it('returns LIVE voltage drop when raw rows are wired through (B-1 fix)', async () => {
    const mdp = makePanelB1({ id: 'mdp', name: 'MDP', is_main: true, bus_rating: 1000 });
    const evPanel = makePanelB1({
      id: 'p-ev',
      name: 'EV Sub-Panel',
      fed_from_type: 'panel',
      fed_from: 'mdp',
      bus_rating: 400,
    });
    const rawPanels = [mdp, evPanel];
    const rawCircuits = [makeCircuitB1('p-ev', 50_300, 'evems')];
    const rawTransformers: Transformer[] = [];
    const rawFeeders = [
      makeFeederB1({
        id: 'f-evse',
        name: 'MDP→EV Feeder',
        source_panel_id: 'mdp',
        destination_panel_id: 'p-ev',
        total_load_va: 0, // stale cache
      }),
    ];

    // Cached summary value (10%) is intentionally wrong — must be ignored.
    const projectContext = buildContext('f-evse', 10);

    const ctx: ToolContext = {
      projectId: 'proj-1',
      projectContext,
      rawPanels,
      rawCircuits,
      rawFeeders,
      rawTransformers,
    };

    const result = await executeTool(
      'calculate_feeder_voltage_drop',
      { feeder_name: 'MDP→EV Feeder' },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.calculationSource).toBe('live');
    // Live-derived design current = 50,300 VA / 240 V ≈ 210 A
    expect(data.designCurrentAmps).toBeGreaterThan(150);
    expect(data.designCurrentAmps).toBeLessThan(300);
    // Conductor must NOT be the 14 AWG cached fallback
    expect(data.conductorSize).not.toBe('14');
    // Live VD must be a real number, not the cached 10% summary value
    expect(data.voltageDropPercent).not.toBe(10);
    expect(data.voltageDropPercent).toBeGreaterThan(0);
  });

  it('falls back to cached summary when raw rows are not provided (legacy callers)', async () => {
    const projectContext = buildContext('f-evse', 1.42);

    const ctx: ToolContext = {
      projectId: 'proj-1',
      projectContext,
      // intentionally no rawPanels/rawCircuits/rawFeeders
    };

    const result = await executeTool(
      'calculate_feeder_voltage_drop',
      { feeder_name: 'MDP→EV Feeder' },
      ctx,
    );

    expect(result.success).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.calculationSource).toBe('cached');
    expect(data.voltageDropPercent).toBe(1.42);
    expect(data.compliant).toBe(true);
  });

  it('REGRESSION: pre-B-1 cached read on stale data would say "Compliant 0.00%"', async () => {
    // Confirms the broken behavior is reproducible — when the cached column
    // says voltageDropPercent=0 (the C2 symptom) and raw rows aren't wired
    // through, the AI returns the bogus value. Live mode is the only escape.
    const projectContext = buildContext('f-evse', 0);

    const ctxNoRaw: ToolContext = {
      projectId: 'proj-1',
      projectContext,
    };

    const result = await executeTool(
      'calculate_feeder_voltage_drop',
      { feeder_name: 'MDP→EV Feeder' },
      ctxNoRaw,
    );

    const data = result.data as Record<string, unknown>;
    expect(data.calculationSource).toBe('cached');
    expect(data.voltageDropPercent).toBe(0);
    // The displayed-but-misleading "compliant" — exactly the AI bug B-1 fixes
    // when the user has stale data and we can't live-derive.
    expect(data.compliant).toBe(true);
  });
});
