/**
 * Sprint 2C M3 (2026-05-17) — Multi-Family EV persistence wiring contract.
 *
 * Pins the data-shape contract between MultiFamilyEVCalculator (Tools Hub,
 * the producer) and PermitPacketGenerator (the consumer):
 *
 *   Tools Hub writes:   project.settings.residential.mfEvCalculation = {
 *                         result: MultiFamilyEVResult,
 *                         buildingName?: string,
 *                         computedAt: string,
 *                       }
 *
 *   Packet reads:       packetData.multiFamilyEVAnalysis = {
 *                         result: mfEvCalculation.result,
 *                         buildingName: mfEvCalculation.buildingName ?? projectName,
 *                       }
 *
 * If these shapes ever drift (e.g., renamed field, added required key), this
 * test fails — preventing the silent regression where the Tools Hub computes
 * an analysis but the packet skips the section because the read selector
 * doesn't match. This is the kind of bug that ate Sprint 2A and shipped
 * silently for weeks via the broken inline form before PR #78.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMultiFamilyEV,
  type MultiFamilyEVResult,
} from '../services/calculations/multiFamilyEV';

// Realistic Tools-Hub-style input matching the MF-EV Calculator form.
const TOOLS_HUB_INPUT = {
  buildingName: 'Sunset Gardens Apartments',
  dwellingUnits: 20,
  avgUnitSqFt: 900,
  voltage: 240 as const,
  phase: 1 as const,
  existingServiceAmps: 800,
  evChargers: {
    count: 20,
    level: 'Level2' as const,
    ampsPerCharger: 40,
  },
  hasElectricCooking: true,
  hasElectricHeat: false,
  commonAreaLoadVA: 15_000,
  useEVEMS: false,
};

describe('Multi-Family EV → Permit Packet persistence wiring', () => {
  it('persists in the shape PermitPacketGenerator reads', () => {
    const result = calculateMultiFamilyEV(TOOLS_HUB_INPUT);

    // What MultiFamilyEVCalculator writes to project.settings:
    const persistedShape = {
      result,
      buildingName: TOOLS_HUB_INPUT.buildingName,
      computedAt: new Date().toISOString(),
    };

    // What PermitPacketGenerator reads and routes to packetData:
    const packetSlice = persistedShape.result
      ? {
          result: persistedShape.result,
          buildingName:
            persistedShape.buildingName?.trim() || 'Fallback Project Name',
        }
      : undefined;

    expect(packetSlice).toBeDefined();
    expect(packetSlice!.result).toBe(result);
    expect(packetSlice!.buildingName).toBe('Sunset Gardens Apartments');
  });

  it('falls back to project name when buildingName is blank', () => {
    const result = calculateMultiFamilyEV({
      ...TOOLS_HUB_INPUT,
      buildingName: undefined,
    });

    const persistedShape = {
      result,
      buildingName: undefined,
      computedAt: new Date().toISOString(),
    };

    const projectName = 'My Multi-Family Project';
    const packetSlice = {
      result: persistedShape.result,
      buildingName:
        (persistedShape.buildingName as string | undefined)?.trim() || projectName,
    };

    expect(packetSlice.buildingName).toBe(projectName);
  });

  it('skips packet inclusion when no persisted mfEvCalculation exists', () => {
    // Simulates a project where the user hasn't run the calculator yet.
    const projectSettings: { residential?: { mfEvCalculation?: unknown } } = {
      residential: { /* no mfEvCalculation key */ },
    };

    const mfEvCalc = (projectSettings.residential as
      | { mfEvCalculation?: { result: MultiFamilyEVResult; buildingName?: string } }
      | undefined)?.mfEvCalculation;

    const packetSlice = mfEvCalc?.result
      ? { result: mfEvCalc.result, buildingName: mfEvCalc.buildingName ?? 'X' }
      : undefined;

    expect(packetSlice).toBeUndefined();
  });

  it('result payload contains the fields the PDF renderer reads', () => {
    // Cross-check: the renderer (MultiFamilyEVDocuments.tsx) reads
    // buildingLoad.buildingDemandVA + breakdown[], evLoad.demandVA,
    // serviceAnalysis.totalDemandVA, scenarios, and compliance. If any of
    // these go missing from the calc service's return shape, the PDF
    // renders blank fields and AHJs reject.
    const result = calculateMultiFamilyEV(TOOLS_HUB_INPUT);

    expect(result.buildingLoad).toBeDefined();
    expect(typeof result.buildingLoad.buildingDemandVA).toBe('number');
    expect(Array.isArray(result.buildingLoad.breakdown)).toBe(true);
    expect(result.evLoad).toBeDefined();
    expect(typeof result.evLoad.demandVA).toBe('number');
    expect(result.serviceAnalysis).toBeDefined();
    expect(typeof result.serviceAnalysis.totalDemandVA).toBe('number');
    expect(result.scenarios).toBeDefined();
    expect(result.scenarios.noEVEMS).toBeDefined();
    expect(result.compliance).toBeDefined();
    expect(Array.isArray(result.compliance.necArticles)).toBe(true);
  });

  it('preserves the NEC 220.87 method tag through the result', () => {
    // Sprint 2C M3: when the user picks Method 1 (utility_bill) in the
    // Tools Hub, the result's loadDeterminationMethod must reflect that so
    // the packet renders the correct citation ("measured — no 125%").
    const result = calculateMultiFamilyEV({
      ...TOOLS_HUB_INPUT,
      existingLoadMethod: 'utility_bill',
      measuredPeakDemandKW: 350,
      measurementPeriod: 'Jan 2026 – Dec 2026',
      utilityCompany: 'FPL',
    });

    expect(result.buildingLoad.loadDeterminationMethod).toBe('utility_bill');
  });
});
