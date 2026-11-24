/**
 * #285 (owner ruling 2026-11-22, a): one service short-circuit calculation per
 * project. Every reader (the Short Circuit page, E-102, the packet's
 * short-circuit table, the Copilot, Pre-Inspection) gets the rows through
 * `useShortCircuitCalculations`, which keeps all panel rows and only the
 * newest service row; a new service save deletes the older ones.
 * Expected values: the issue's Acceptance section (hand-calculated).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { currentShortCircuitRows, recomputeShortCircuitRow } from '../lib/storedCalcs';
import { ShortCircuitTablePages } from '../services/pdfExport/ShortCircuitDocuments';

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
  notes: null, updated_at: '2026-11-22T00:00:00Z', user_id: 'u', project_id: 'p',
};
const service = (id: string, kva: number, created_at: string): any => ({
  ...blank, id, panel_id: null, location_name: 'Service Entrance', calculation_type: 'service', created_at,
  service_amps: 1200, service_voltage: 480, service_phase: 3, transformer_kva: kva, transformer_impedance: 5.75,
  service_conductor_length: 100, service_conductor_size: '500 kcmil', service_conductor_material: 'Cu', service_conduit_type: 'Steel',
  results: { faultCurrent: 0, requiredAIC: 0, setsInParallel: 1 },
});
const panel: any = {
  ...blank, id: 'lp1', panel_id: 'lp1-panel', location_name: 'LP-1', calculation_type: 'panel', created_at: '2026-11-20T00:00:00Z',
  source_fault_current: 10000, feeder_length: 50, feeder_conductor_size: '3/0 AWG', feeder_material: 'Cu',
  feeder_conduit_type: 'Steel', feeder_voltage: 480, feeder_phase: 3, results: { setsInParallel: 1 },
};
const older = service('svc-500', 500, '2026-11-21T20:16:43.644843+00:00');
const newer = service('svc-750', 750, '2026-11-23T01:07:10.000000+00:00');

describe('#285 currentShortCircuitRows', () => {
  it('keeps every panel row and only the newest service row, in either order', () => {
    expect(currentShortCircuitRows([newer, older, panel]).map(r => r.id)).toEqual(['svc-750', 'lp1']);
    expect(currentShortCircuitRows([older, panel, newer]).map(r => r.id)).toEqual(['lp1', 'svc-750']);
  });

  it('a single service row and service-type rows tied to a panel are kept', () => {
    const tied = { ...older, id: 'xfmr-secondary', panel_id: 'p2' };
    expect(currentShortCircuitRows([older, tied]).map(r => r.id)).toEqual(['svc-500', 'xfmr-secondary']);
  });

  it('the packet table prints one Service Entrance row: 750 kVA → 11.9 kA / 14 kA, Total Panels 1', () => {
    // 750 kVA: I_xfmr = 15,688.9 A, Zs 0.017664 + Zc 0.005608 → 11,908 A → 14 kA
    const rows = currentShortCircuitRows([newer, older]).map(recomputeShortCircuitRow);
    const text = textOf(ShortCircuitTablePages({ calculations: rows, panels: [], projectName: 'QA Short circuit' }) as React.ReactElement);
    expect(text.match(/Service Entrance/g)).toHaveLength(1);
    expect(text).toMatch(/11\.9\s+14\s+Required (≥|>=) 14 kA/); // #307: no rating entered
    expect(text).not.toMatch(/8\.6\s+10/);
    expect(text).toMatch(/Total Panels:\s+1\b/);
    expect(text).toMatch(/Highest Required AIC:\s+14\s+kA/);
  });
});
