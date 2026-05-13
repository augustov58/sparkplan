/**
 * Tests for the SC hierarchy resolver.
 *
 * Exercises the panel→panel and panel→transformer→panel chain walks that
 * pick the correct upstream source If for the point-to-point method.
 * Reference: Bussmann/Eaton SPD-2014 page 237 (downstream-xfmr formula)
 * and page 238 System A (X3 uses X2's If, not the service If).
 */

import { describe, it, expect } from 'vitest';
import {
  resolveUpstreamSourceIf,
  detectStaleCalculations,
} from '../services/calculations/shortCircuitHierarchy';

// Loose factories — only the columns the resolver touches are populated.
const mdp = (overrides: any = {}) => ({
  id: 'panel-mdp',
  name: 'MDP',
  is_main: true,
  fed_from_type: 'service',
  fed_from: null,
  fed_from_transformer_id: null,
  voltage: 240,
  bus_rating: 200,
  ...overrides,
});

const subPanel = (id: string, name: string, parentId: string, overrides: any = {}) => ({
  id,
  name,
  is_main: false,
  fed_from_type: 'panel',
  fed_from: parentId,
  fed_from_transformer_id: null,
  voltage: 240,
  bus_rating: 125,
  ...overrides,
});

const xfmrFedPanel = (id: string, name: string, xfmrId: string, overrides: any = {}) => ({
  id,
  name,
  is_main: false,
  fed_from_type: 'transformer',
  fed_from: null,
  fed_from_transformer_id: xfmrId,
  voltage: 208,
  bus_rating: 100,
  ...overrides,
});

const makeXfmr = (id: string, overrides: any = {}) => ({
  id,
  name: `Xfmr-${id}`,
  kva_rating: 75,
  primary_voltage: 480,
  primary_phase: 3,
  impedance_percent: 2.0,
  fed_from_panel_id: null,
  ...overrides,
});

const serviceCalc = (faultCurrent: number) => ({
  id: 'calc-svc',
  calculation_type: 'service',
  panel_id: null,
  results: { faultCurrent },
  source_fault_current: null,
});

const panelCalc = (id: string, panelId: string, faultCurrent: number, sourceFaultCurrent = 0) => ({
  id,
  calculation_type: 'panel',
  panel_id: panelId,
  results: { faultCurrent },
  source_fault_current: sourceFaultCurrent || faultCurrent * 2,
});

const baseProject = {
  service_voltage: 240,
  service_phase: 1,
  utility_available_fault_current_a: null,
};

describe('resolveUpstreamSourceIf — service-fed panels', () => {
  it('uses the service-entrance calc when the target is fed directly from service', () => {
    const target = subPanel('p1', 'Unit 110', 'panel-mdp');
    const out = resolveUpstreamSourceIf(target as any, {
      project: baseProject as any,
      panels: [mdp(), target] as any,
      transformers: [],
      calculations: [serviceCalc(22_000)] as any,
    });
    expect(out.sourceFaultCurrent).toBe(22_000);
    expect(out.upstreamChain).toEqual(['MDP']);
    expect(out.isComplete).toBe(true);
  });

  it('falls back to project utility AFC when no service calc exists', () => {
    const target = subPanel('p1', 'Unit 110', 'panel-mdp');
    const out = resolveUpstreamSourceIf(target as any, {
      project: { ...baseProject, utility_available_fault_current_a: 12_500 } as any,
      panels: [mdp(), target] as any,
      transformers: [],
      calculations: [], // nothing saved
    });
    expect(out.sourceFaultCurrent).toBe(12_500);
    expect(out.isComplete).toBe(false);
    expect(out.warnings.length).toBeGreaterThan(0);
  });
});

describe('resolveUpstreamSourceIf — multi-level panel chain (SPD System A pattern)', () => {
  it('uses the IMMEDIATE upstream panel calc, not the service entrance, when deeper than 2 levels', () => {
    // MDP → Sub-A → Sub-B
    // Service If = 50 kA, Sub-A's saved If = 35 kA.
    // Sub-B's source must be 35 kA (Sub-A's value), not 50 kA (service value).
    const A = subPanel('p-A', 'Sub-Panel A', 'panel-mdp');
    const B = subPanel('p-B', 'Sub-Panel B', 'p-A');
    const out = resolveUpstreamSourceIf(B as any, {
      project: baseProject as any,
      panels: [mdp(), A, B] as any,
      transformers: [],
      calculations: [serviceCalc(50_000), panelCalc('calc-A', 'p-A', 35_000)] as any,
    });
    expect(out.sourceFaultCurrent).toBe(35_000);
    expect(out.upstreamChain).toEqual(['Sub-Panel A']);
    expect(out.isComplete).toBe(true);
  });

  it('flags incomplete chain when an intermediate panel is not yet calculated', () => {
    const A = subPanel('p-A', 'Sub-Panel A', 'panel-mdp');
    const B = subPanel('p-B', 'Sub-Panel B', 'p-A');
    // Service calc exists but Sub-A doesn't.
    const out = resolveUpstreamSourceIf(B as any, {
      project: baseProject as any,
      panels: [mdp(), A, B] as any,
      transformers: [],
      calculations: [serviceCalc(50_000)] as any,
    });
    expect(out.isComplete).toBe(false);
    expect(out.warnings.some((w) => w.includes('Sub-Panel A'))).toBe(true);
    // Fallback chooses the service-entrance If so the calc still produces a
    // number, but the UI is warned to fix the chain.
    expect(out.sourceFaultCurrent).toBe(50_000);
  });

  it('treats a panel fed directly from the MDP correctly (service If is canonical)', () => {
    const unit = subPanel('p-unit', 'Unit 110', 'panel-mdp');
    // No panel calc exists for the MDP because the MDP IS the service entrance.
    const out = resolveUpstreamSourceIf(unit as any, {
      project: baseProject as any,
      panels: [mdp(), unit] as any,
      transformers: [],
      calculations: [serviceCalc(22_000)] as any,
    });
    expect(out.sourceFaultCurrent).toBe(22_000);
    expect(out.isComplete).toBe(true);
  });
});

describe('resolveUpstreamSourceIf — transformer mid-chain (SPD page 237 formula)', () => {
  it('derives secondary If from primary using calculateDownstreamTransformerFaultCurrent', () => {
    // MDP → 75 kVA 480→208V 3φ xfmr at 2%Z → 208V sub-panel
    // Primary If from MDP = 30 kA. Expect secondary If well below 30 kA
    // (turns-ratio amplification × M-factor attenuation; net effect at these
    // numbers is a moderate reduction).
    const xfmr = makeXfmr('xfmr-1', {
      kva_rating: 75,
      primary_voltage: 480,
      primary_phase: 3,
      impedance_percent: 2.0,
      fed_from_panel_id: 'panel-mdp',
    });
    const downstream = xfmrFedPanel('p-dn', 'Sub-208V', 'xfmr-1');
    const out = resolveUpstreamSourceIf(downstream as any, {
      project: baseProject as any,
      panels: [mdp()] as any,
      transformers: [xfmr] as any,
      calculations: [serviceCalc(30_000)] as any,
    });
    expect(out.isComplete).toBe(true);
    expect(out.upstreamChain).toEqual(['75 kVA — Xfmr-xfmr-1', 'MDP']);
    // SPD formula collapses the primary current through the xfmr impedance;
    // the result should be well-defined and positive.
    expect(out.sourceFaultCurrent).toBeGreaterThan(0);
    // Sanity: shouldn't exceed primary If by orders of magnitude (turns ratio
    // would amplify by ~2.3 ideally, M-factor pulls it back down).
    expect(out.sourceFaultCurrent).toBeLessThan(30_000 * 3);
  });

  it('flags incomplete chain when the panel feeding the transformer has no calc', () => {
    // Sub-Panel A → 75 kVA xfmr → Sub-Panel B. A is not yet calculated.
    const A = subPanel('p-A', 'Sub-Panel A', 'panel-mdp');
    const xfmr = makeXfmr('xfmr-1', { fed_from_panel_id: 'p-A' });
    const B = xfmrFedPanel('p-B', 'Sub-Panel B', 'xfmr-1');
    const out = resolveUpstreamSourceIf(B as any, {
      project: baseProject as any,
      panels: [mdp(), A] as any,
      transformers: [xfmr] as any,
      calculations: [serviceCalc(40_000)] as any,
    });
    expect(out.isComplete).toBe(false);
    expect(out.warnings.some((w) => w.toLowerCase().includes('transformer'))).toBe(true);
  });
});

describe('detectStaleCalculations', () => {
  it('flags a panel calc whose stored source_fault_current no longer matches the resolved upstream value', () => {
    const A = subPanel('p-A', 'Sub-Panel A', 'panel-mdp');
    const B = subPanel('p-B', 'Sub-Panel B', 'p-A');
    // Originally Sub-A's If was 50 kA → Sub-B was calculated with source=50000
    // Then Sub-A was recalculated and is now 35 kA → Sub-B is stale
    const out = detectStaleCalculations({
      project: baseProject as any,
      panels: [mdp(), A, B] as any,
      transformers: [],
      calculations: [
        serviceCalc(55_000),
        panelCalc('calc-A', 'p-A', 35_000), // current If at Sub-A
        panelCalc('calc-B', 'p-B', 20_000, 50_000), // B's stored source = old A's If
      ] as any,
    });
    expect(out.has('calc-B')).toBe(true);
    expect(out.get('calc-B')?.expectedIf).toBe(35_000);
    expect(out.get('calc-B')?.storedIf).toBe(50_000);
  });

  it('does not flag calcs whose source matches (within 1 A tolerance)', () => {
    const unit = subPanel('p-unit', 'Unit 110', 'panel-mdp');
    const out = detectStaleCalculations({
      project: baseProject as any,
      panels: [mdp(), unit] as any,
      transformers: [],
      calculations: [
        serviceCalc(22_000),
        panelCalc('calc-unit', 'p-unit', 18_000, 22_000), // stored = current = 22000
      ] as any,
    });
    expect(out.has('calc-unit')).toBe(false);
  });
});
