/**
 * #278 — saved short-circuit results are recomputed from the saved inputs
 * through the calculator's own functions (owner ruling 2026-11-21, option a).
 * A row that can't be recomputed exactly (a service conductor saved before
 * the number of sets in parallel was recorded) keeps its stored values and is
 * flagged "Outdated, re-run" — never recomputed with a guessed 1 set.
 * Expected values: the issue's Acceptance section (hand-calculated).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { recomputeShortCircuitRow, shortCircuitResultsOf } from '../lib/storedCalcs';
import { resolveUpstreamSourceIf } from '../services/calculations/shortCircuitHierarchy';
import { buildProjectContext, formatContextForAI } from '../services/ai/projectContextBuilder';
import { AvailableFaultCurrentPage } from '../services/pdfExport/PermitPacketDocuments';
import { ShortCircuitTablePages, ShortCircuitCalculationPages } from '../services/pdfExport/ShortCircuitDocuments';

/** Every string in a component's own element tree (child components are not expanded). */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return '';
}

const blank = {
  service_amps: null, service_voltage: null, service_phase: null, transformer_kva: null, transformer_impedance: null,
  service_conductor_length: null, service_conductor_size: null, service_conductor_material: null, service_conduit_type: null,
  source_fault_current: null, feeder_length: null, feeder_conductor_size: null, feeder_material: null,
  feeder_conduit_type: null, feeder_voltage: null, feeder_phase: null,
  notes: null, created_at: '2026-11-21T00:00:00Z', updated_at: '2026-11-21T00:00:00Z', user_id: 'u', project_id: 'p',
};

// Saved before this fix with the pre-#258/#276/#279 formula (steel XL × 1.5, AIC from fault × 1.25).
const legacyService: any = {
  ...blank, id: 'svc', panel_id: null, location_name: 'Service Entrance', calculation_type: 'service',
  service_amps: 200, service_voltage: 480, service_phase: 3, transformer_kva: 500, transformer_impedance: 5.75,
  service_conductor_length: 100, service_conductor_size: '500 kcmil', service_conductor_material: 'Cu', service_conduit_type: 'Steel',
  results: {
    faultCurrent: 8275.367, requiredAIC: 14,
    details: { sourceFaultCurrent: 10459.244, conductorImpedance: 0.006992, totalImpedance: 0.033488, faultCurrentAtPoint: 8275.367, safetyFactor: 1.25 },
    compliance: { necArticle: 'NEC 110.9 - Interrupting Rating', compliant: true, message: 'Use 14 kA AIC rated breakers or higher' },
  },
};
const legacyPanel: any = {
  ...blank, id: 'lp1calc', panel_id: 'lp1', location_name: 'LP-1', calculation_type: 'panel',
  source_fault_current: 10000, feeder_length: 50, feeder_conductor_size: '3/0 AWG', feeder_material: 'Cu',
  feeder_conduit_type: 'Steel', feeder_voltage: 480, feeder_phase: 3,
  results: {
    faultCurrent: 8401.966, requiredAIC: 14,
    details: { sourceFaultCurrent: 10000, conductorImpedance: 0.005271, totalImpedance: 0.032984, faultCurrentAtPoint: 8401.966, safetyFactor: 1.25 },
    compliance: { necArticle: 'NEC 110.9 - Interrupting Rating', compliant: true, message: 'Use 14 kA AIC rated breakers or higher' },
  },
};

// The same LP-1 save, made after #278 recorded the feeder's sets (one). Since
// #286 a panel row without them is Outdated (tests/shortCircuitParallel286.test.ts).
const savedPanel: any = { ...legacyPanel, results: { ...legacyPanel.results, setsInParallel: 1 } };

describe('#278 recomputeShortCircuitRow', () => {
  it('a service conductor saved without its sets in parallel is Outdated and keeps its stored values', () => {
    const r = shortCircuitResultsOf(recomputeShortCircuitRow(legacyService));
    expect(r.outdated).toMatch(/sets in parallel/);
    expect(r.faultCurrent).toBe(8275.367); // not 8,632 (a guessed 1 set)
    expect(r.requiredAIC).toBe(14);
  });

  it('a panel row is recomputed from its saved inputs: 8,402 A / 14 kA → 8,542 A / 10 kA', () => {
    const r = shortCircuitResultsOf(recomputeShortCircuitRow(savedPanel));
    expect(r.outdated).toBeUndefined();
    expect(r.faultCurrent).toBeCloseTo(8542.3, 0);
    expect(r.requiredAIC).toBe(10);
    expect(r.details).not.toHaveProperty('safetyFactor');
  });

  it('a service save that recorded 2 sets is recomputed with them: 9,458 A / 10 kA', () => {
    const saved = { ...legacyService, results: { ...legacyService.results, setsInParallel: 2 } };
    const r = shortCircuitResultsOf(recomputeShortCircuitRow(saved));
    expect(r.outdated).toBeUndefined();
    expect(r.faultCurrent).toBeCloseTo(9458.3, 0);
    expect(r.requiredAIC).toBe(10);
    expect(r.setsInParallel).toBe(2);
  });

  it('a service save without a conductor is recomputed at the transformer: 10,459 A / 14 kA', () => {
    const noConductor = { ...legacyService, service_conductor_length: null, service_conductor_size: null,
      service_conductor_material: null, service_conduit_type: null };
    const r = shortCircuitResultsOf(recomputeShortCircuitRow(noConductor));
    expect(r.outdated).toBeUndefined();
    expect(r.faultCurrent).toBeCloseTo(10459.2, 0);
    expect(r.requiredAIC).toBe(14);
  });

  it('an estimated transformer (no kVA saved) is re-estimated from the service: 200 A 240 V 1Φ → 50 kVA, 2.5 % → 8,333 A', () => {
    // 200 × 240 = 48 kVA → next standard 50 kVA; 50,000 ÷ 240 ÷ 0.025 = 8,333 A
    const estimated = { ...legacyService, service_voltage: 240, service_phase: 1, transformer_kva: null, transformer_impedance: 2.5,
      service_conductor_length: null, service_conductor_size: null, service_conductor_material: null, service_conduit_type: null };
    const r = shortCircuitResultsOf(recomputeShortCircuitRow(estimated));
    expect(r.faultCurrent).toBeCloseTo(8333.3, 0);
    expect(r.requiredAIC).toBe(10);
  });

  it('is idempotent', () => {
    for (const row of [legacyService, legacyPanel, savedPanel]) {
      const once = recomputeShortCircuitRow(row);
      expect(recomputeShortCircuitRow(once)).toEqual(once);
    }
  });
});

const project = { service_voltage: 480, service_phase: 3 as const, utility_available_fault_current_a: null };
const mdp: any = { id: 'mdp', name: 'MDP', is_main: true, voltage: 480, phase: 3, fed_from_type: 'service', fed_from: null, fed_from_transformer_id: null };
const lp1: any = { id: 'lp1', name: 'LP-1', is_main: false, voltage: 480, phase: 3, bus_rating: 225, fed_from_type: 'panel', fed_from: 'mdp', fed_from_transformer_id: null };

describe('#278 an Outdated save is no source for a new calculation', () => {
  it('the chain is incomplete and says why; it falls back instead of using the stale value', () => {
    const calcs = [legacyService, legacyPanel].map(recomputeShortCircuitRow);
    const res = resolveUpstreamSourceIf(lp1, { project, panels: [mdp, lp1], transformers: [], calculations: calcs });
    expect(res.isComplete).toBe(false);
    expect(res.sourceFaultCurrent).toBe(10_000); // the 10 kA default, not the stored 8,275 A
    expect(res.warnings.join(' ')).toMatch(/Outdated, re-run/);
  });
});

describe('#278 readers print recomputed values and mark Outdated rows', () => {
  const calcs = [legacyService, savedPanel].map(recomputeShortCircuitRow);

  it('Copilot / Pre-Inspection context: LP-1 8.5 kA / 10 kA; the service marked OUTDATED', () => {
    const ctx = buildProjectContext('p', 'QA SC saved', 'Commercial', 480, 3, [mdp, lp1], [], [], [],
      undefined, undefined, undefined, undefined, calcs);
    const text = formatContextForAI(ctx);
    expect(text).toMatch(/LP-1 \(LP-1\): 8\.5 kA available fault current, required AIC 10 kA/);
    expect(text).toMatch(/Service Entrance \[SERVICE ENTRANCE\]: 8\.3 kA[^\n]*OUTDATED, re-run/);
  });

  it('Available Fault Current page: notice on an Outdated service row', () => {
    const svc = calcs[0]!;
    const text = textOf(AvailableFaultCurrentPage({
      projectName: 'P',
      input: {
        equipmentAic: [], serviceAmps: 200, serviceVoltage: 480, servicePhase: 3, sourceFaultCurrent: null, transformerKVA: 500,
        transformerImpedance: 5.75, serviceConductorSize: '500 kcmil', serviceConductorMaterial: 'Cu',
        serviceConductorLength: 100, results: svc.results as any,
      },
    }) as React.ReactElement);
    expect(text).toMatch(/OUTDATED, RE-RUN/);
    expect(text).toMatch(/sets in parallel/);
  });

  it('short-circuit table: the Outdated row is marked, LP-1 prints 8.5 kA / 10 kA', () => {
    const text = textOf(ShortCircuitTablePages({ calculations: calcs, panels: [], projectName: 'P' }) as React.ReactElement);
    expect(text).toMatch(/Service Entrance\s+Service[\s\S]*?8\.3\s+14\s+Outdated, re-run/);
    expect(text).toMatch(/LP-1\s+Panel[\s\S]*?8\.5\s+10\s+Required (≥|>=) 10 kA/); // #307: no rating entered
    expect(text).not.toMatch(/All panels meet NEC 110\.9/);
  });

  it('single-calculation PDF: LP-1 prints the recomputed values', () => {
    const text = textOf(ShortCircuitCalculationPages({ calculation: calcs[1] as any, projectName: 'P' }) as React.ReactElement);
    expect(text).toMatch(/REQUIRED AIC RATING\s+10/);
    expect(text).toMatch(/8,542\.\d+\s+A RMS/);
    expect(text).not.toMatch(/OUTDATED/);
  });
});
