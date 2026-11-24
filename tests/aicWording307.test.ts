/**
 * #307 (owner ruling 2026-11-23, a): the packet never says an equipment
 * interrupting rating is shown or "confirmed" without a comparison.
 * - E-201 legend: "AIC shown where an equipment rating is entered."
 * - E-102 closing note: the ruled sentence when no rating is entered; with
 *   ratings, each one compared with the fault current at its own point.
 * - E-103 row status: "OK (r ≥ If kA)" / "Under-rated" / "Required ≥ N kA";
 *   Outdated and Stale first; the summary counts follow; Source If in whole amps.
 *
 * "QA Short circuit" (hand calc, issue #307 Acceptance): 500 kVA, 5.75 %,
 * 100 ft 500 kcmil Cu, 1 set, steel → source 10,459 A; at the service main
 * (the MDP's line-side terminals) 8,632 A = 8.6 kA; required 10 kA.
 * The PDF font prints "≥" as ">=" (PdfText).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { calculateServiceFaultCurrent } from '../services/calculations/shortCircuit';
import { RiserDiagram, AvailableFaultCurrentPage } from '../services/pdfExport/PermitPacketDocuments';
import { ShortCircuitTablePages } from '../services/pdfExport/ShortCircuitDocuments';
import { availableFaultCurrentInputFor } from '../services/pdfExport/permitPacketGenerator';
import { aicStatus } from '../services/pdfExport/permitPacketTheme';

/** Every string in the tree, expanding function components (PdfText included). */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (React.isValidElement(node)) {
    const { type, props } = node as React.ReactElement<{ children?: React.ReactNode }>;
    if (typeof type === 'function' && !(type.prototype && type.prototype.isReactComponent)) {
      return textOf((type as (p: unknown) => React.ReactNode)(props));
    }
    return textOf(props.children);
  }
  return '';
}
const flat = (s: string) => s.replace(/\s+/g, ' ');

const mdp = (aic_rating: number | null): any => ({
  id: 'mdp', project_id: 'p', name: 'MDP', voltage: 480, phase: 3, bus_rating: 800, main_breaker_amps: 800,
  is_main: true, aic_rating, fed_from: null, fed_from_type: 'service', fed_from_transformer_id: null,
  fed_from_meter_stack_id: null, fed_from_circuit_number: null, feeder_breaker_amps: null,
});

/** The fixture's service row, results from the calculator (as the app saves them). */
function serviceRow(kva = 500): any {
  const result = calculateServiceFaultCurrent(
    { kva, primaryVoltage: 12470, secondaryVoltage: 480, impedance: 5.75 }, 480, 3,
    { length: 100, conductorSize: '500 kcmil', material: 'Cu', conduitType: 'Steel', setsInParallel: 1 },
  );
  return {
    id: 'svc', project_id: 'p', calculation_type: 'service', panel_id: null, location_name: 'Service Entrance',
    service_amps: 200, service_voltage: 480, service_phase: 3, transformer_kva: kva, transformer_impedance: 5.75,
    service_conductor_size: '500 kcmil', service_conductor_material: 'Cu', service_conductor_length: 100,
    service_conduit_type: 'Steel', source_fault_current: null, results: { ...result, setsInParallel: 1 }, notes: null,
  };
}

const packet = (panels: any[], calcs: any[]): any => ({
  projectName: 'QA Short circuit', serviceVoltage: 480, servicePhase: 3, projectServiceAmps: null,
  panels, circuits: [], feeders: [], transformers: [], shortCircuitCalculations: calcs,
});

function e102(panels: any[], row: any) {
  const input = availableFaultCurrentInputFor(packet(panels, [row]), row);
  return flat(textOf(React.createElement(AvailableFaultCurrentPage, { projectName: 'QA Short circuit', input })));
}
const e103 = (panels: any[], rows: any[]) =>
  flat(textOf(React.createElement(ShortCircuitTablePages, { calculations: rows, panels, projectName: 'QA Short circuit' } as any)));

describe('#307 hand-calculated fixture', () => {
  it('500 kVA → 10,459 A source, 8,632 A at the service main, 10 kA required', () => {
    const r = serviceRow().results;
    expect(Math.round(r.details.sourceFaultCurrent)).toBe(10459);
    expect(Math.round(r.faultCurrent)).toBe(8632);
    expect(r.requiredAIC).toBe(10);
  });
});

describe('#307 no rating entered', () => {
  it('E-201 legend says AIC shows only where a rating is entered', () => {
    const text = flat(textOf(React.createElement(RiserDiagram, {
      panels: [mdp(null)], transformers: [], feeders: [], projectName: 'QA Short circuit', serviceVoltage: 480, servicePhase: 3,
    } as any)));
    expect(text).toContain('AIC shown where an equipment rating is entered.');
    expect(text).not.toContain('Per-node AIC ratings shown'); // main
  });

  it('E-102 states the requirement and the minimum standard rating, confirms nothing', () => {
    const text = e102([mdp(null)], serviceRow());
    expect(text).toContain("Equipment interrupting ratings are not entered. Each device's interrupting rating shall be at least the available fault current at its line-side terminals (NEC 110.9); minimum standard rating 10 kA.");
    expect(text).not.toContain('confirmed'); // main: "… are confirmed against the value above."
  });

  it('E-103: "Required >= 10 kA", counts follow, whole-amp Source If, no "All panels meet"', () => {
    const text = e103([mdp(null)], [serviceRow()]);
    expect(text).toMatch(/Service Entrance Service 10,459 500 kcmil Cu · 100 ft 480V 3Ø 0\.0321 8\.6 10 Required >= 10 kA/); // main: 10,459.244 … Compliant
    expect(text).toMatch(/Rating entered, OK \(NEC 110\.9\): 0 \(0%\)/);
    expect(text).toMatch(/Under-rated: 0 \(0%\)/);
    expect(text).toMatch(/Rating not entered: 1 \(100%\)/);
    expect(text).toContain('Equipment interrupting ratings are not entered for one point.');
    expect(text).not.toContain('All panels meet NEC 110.9'); // main
    expect(text).not.toContain('Compliant');
  });
});

describe('#307 MDP rated 42 kA', () => {
  it('E-103: OK (42 >= 8.6 kA), counted OK', () => {
    const text = e103([mdp(42)], [serviceRow()]);
    expect(text).toContain('8.6 10 OK (42 >= 8.6 kA)');
    expect(text).toMatch(/Rating entered, OK \(NEC 110\.9\): 1 \(100%\)/);
    expect(text).toMatch(/Rating not entered: 0 \(0%\)/);
    expect(text).toContain('Every entered equipment interrupting rating is at least the fault current at its point (NEC 110.9).');
  });

  it('E-102 compares the MDP rating with its point (8.6 kA), never "not entered" or "confirmed"', () => {
    const text = e102([mdp(42)], serviceRow());
    expect(text).toContain('Entered ratings compared with the fault current at each point: MDP 42 kA >= 8.6 kA, OK.');
    expect(text).not.toContain('not entered');
    expect(text).not.toContain('confirmed');
  });
});

describe('#307 under-rated and precedence', () => {
  it('a 10 kA MDP on a 750 kVA service (11.9 kA at the main) is Under-rated, on E-103 and E-102', () => {
    const row = serviceRow(750);
    expect(Math.round(row.results.faultCurrent)).toBe(11908);
    const t103 = e103([mdp(10)], [row]);
    expect(t103).toContain('11.9 14 Under-rated');
    expect(t103).toMatch(/Under-rated: 1 \(100%\)/);
    expect(t103).not.toContain('Every entered equipment interrupting rating');
    expect(e102([mdp(10)], row)).toContain('MDP 10 kA < 11.9 kA, under-rated.');
  });

  it('Outdated comes before the rating status', () => {
    const row = serviceRow();
    row.results = { ...row.results, outdated: 'Saved before the number of conductor sets in parallel was recorded' };
    const text = e103([mdp(42)], [row]);
    expect(text).toContain('8.6 10 Outdated, re-run');
    expect(text).not.toContain('OK (42');
    expect(text).toMatch(/Rating entered, OK \(NEC 110\.9\): 0 \(0%\)/);
  });

  it('aicStatus: exact boundary is OK; above 200 kA with no rating is Review', () => {
    expect(aicStatus(10, 10_000, 10).text).toBe('OK (10 ≥ 10.0 kA)');
    expect(aicStatus(10, 10_001, 14).kind).toBe('under');
    expect(aicStatus(null, 250_000, 200, false).text).toBe('Review');
  });
});
