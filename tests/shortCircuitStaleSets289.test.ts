/**
 * #289 (owner rulings 2026-11-22): (1)(a) the packet's short-circuit table
 * marks a panel row whose upstream changed, the way the Short Circuit page
 * does (same `detectStaleCalculations`); (2) the sets in parallel print
 * wherever the conductor prints. Folded in: the references line says where
 * the service fault current came from. Expected values: the issue's
 * Acceptance section (hand-calculated): 1,000 kVA, 5.75 %, 480 V 3Φ, 20 ft
 * 500 kcmil Cu steel — 3 sets 20,344 A, 2 sets 20,069 A.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { recomputeShortCircuitRow, shortCircuitConductorText } from '../lib/storedCalcs';
import { detectStaleCalculations } from '../services/calculations/shortCircuitHierarchy';
import { ShortCircuitTablePages, ShortCircuitCalculationPages } from '../services/pdfExport/ShortCircuitDocuments';
import { AvailableFaultCurrentPage } from '../services/pdfExport/PermitPacketDocuments';

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
  notes: null, created_at: '2026-11-22T00:00:00Z', updated_at: '2026-11-22T00:00:00Z', user_id: 'u', project_id: 'p',
};
const service = (sets: number): any => ({
  ...blank, id: 'svc', panel_id: null, location_name: 'Service Entrance', calculation_type: 'service',
  service_amps: 1200, service_voltage: 480, service_phase: 3, transformer_kva: 1000, transformer_impedance: 5.75,
  service_conductor_length: 20, service_conductor_size: '500 kcmil', service_conductor_material: 'Cu', service_conduit_type: 'Steel',
  results: { setsInParallel: sets },
});
const dp1: any = {
  ...blank, id: 'dp1calc', panel_id: 'dp1', location_name: 'DP-1', calculation_type: 'panel',
  source_fault_current: 20344.355, feeder_length: 100, feeder_conductor_size: '4/0 AWG', feeder_material: 'Cu',
  feeder_conduit_type: 'Steel', feeder_voltage: 480, feeder_phase: 3, results: { setsInParallel: 2 },
};
const project = { service_voltage: 480, service_phase: 3 as const, utility_available_fault_current_a: null };
const mdp: any = { id: 'mdp', name: 'MDP', is_main: true, voltage: 480, phase: 3, fed_from_type: 'service', fed_from: null, fed_from_transformer_id: null };
const dp1Panel: any = { id: 'dp1', name: 'DP-1', is_main: false, voltage: 480, phase: 3, bus_rating: 400, fed_from_type: 'panel', fed_from: 'mdp', fed_from_transformer_id: null };

describe('#289 shortCircuitConductorText', () => {
  it('prefixes the sets when more than one', () => {
    expect(shortCircuitConductorText(service(3))).toBe('3 × 500 kcmil Cu');
    expect(shortCircuitConductorText(dp1)).toBe('2 × 4/0 AWG Cu');
    expect(shortCircuitConductorText(service(1))).toBe('500 kcmil Cu');
    expect(shortCircuitConductorText({ ...service(1), results: {} })).toBe('500 kcmil Cu'); // saved before sets were recorded
    expect(shortCircuitConductorText({ ...service(1), service_conductor_size: null })).toBeNull();
  });
});

describe('#289 the packet table', () => {
  it('3 sets: no stale row; conductors with their sets; the source line names the transformer', () => {
    const calcs = [service(3), dp1].map(recomputeShortCircuitRow);
    const stale = detectStaleCalculations({ project, panels: [mdp, dp1Panel], transformers: [], calculations: calcs });
    expect(stale.size).toBe(0);
    const text = textOf(ShortCircuitTablePages({ calculations: calcs, stale, panels: [mdp, dp1Panel], projectName: 'P' }) as React.ReactElement);
    expect(text).toMatch(/3 × 500 kcmil Cu · 20 ft/);
    expect(text).toMatch(/2 × 4\/0 AWG Cu · 100 ft/);
    expect(text).toMatch(/Service fault current calculated from the utility transformer \(1000 kVA, 5\.75 % Z\) through the service conductors/);
    expect(text).not.toMatch(/utility-provided/);
    expect(text).not.toMatch(/Stale/);
  });

  it('2 sets: DP-1 is stale (was 20,344 A, now 20,069 A), marked and counted, not "Compliant"', () => {
    const calcs = [service(2), dp1].map(recomputeShortCircuitRow);
    const stale = detectStaleCalculations({ project, panels: [mdp, dp1Panel], transformers: [], calculations: calcs });
    expect(stale.get('dp1calc')?.reason).toBe('Upstream chain changed: was 20,344 A, now 20,069 A');
    const text = textOf(ShortCircuitTablePages({ calculations: calcs, stale, panels: [mdp, dp1Panel], projectName: 'P' }) as React.ReactElement);
    expect(text).toMatch(/DP-1[\s\S]*?2 × 4\/0 AWG Cu · 100 ft[\s\S]*?Stale, re-run/);
    expect(text).toMatch(/Stale, re-run:\s+1/);
    expect(text).toMatch(/DP-1: was 20,344 A, now 20,069 A/);
    expect(text).toMatch(/Rating not entered:\s+1 \(50%\)/); // #307: the service row, no rating entered
    expect(text).not.toMatch(/All panels meet NEC 110\.9/);
    expect(text).toMatch(/2 × 500 kcmil Cu · 20 ft/);
  });
});

describe('#289 the other surfaces print the sets', () => {
  it('single-calculation PDF: "2 × 4/0 AWG Cu"', () => {
    const text = textOf(ShortCircuitCalculationPages({ calculation: recomputeShortCircuitRow(dp1) as any, projectName: 'P' }) as React.ReactElement);
    expect(text).toMatch(/Feeder Conductor:\s+2 × 4\/0 AWG Cu/);
  });

  it('E-102: "3 × 500 kcmil Cu" and "22 kA" with a space', () => {
    const svc = recomputeShortCircuitRow(service(3));
    const text = textOf(AvailableFaultCurrentPage({
      projectName: 'P',
      input: {
        equipmentAic: [], serviceAmps: 1200, serviceVoltage: 480, servicePhase: 3, sourceFaultCurrent: null, transformerKVA: 1000,
        transformerImpedance: 5.75, serviceConductorSize: '500 kcmil', serviceConductorMaterial: 'Cu',
        serviceConductorLength: 20, serviceConductorSets: 3, results: svc.results as any,
      },
    }) as React.ReactElement);
    expect(text).toMatch(/3 × 500 kcmil Cu/);
    expect(text).toMatch(/22\s+kA/);
    expect(text).not.toMatch(/22kA/);
  });
});
