/**
 * #301 (owner ruling 2026-11-23, c):
 * - E-102 "Service Rating" is the project's rating: its service amps, else the
 *   MDP main breaker — not the calculator's Service Amps input.
 * - A saved service row whose utility transformer was estimated (no kVA) from
 *   service amps other than the project's rating is "Stale, re-run" in the app
 *   and on the packet (same `detectStaleCalculations`, as #289).
 *
 * "QA Short circuit": 480 V 3Φ, project service amps empty, MDP main 800 A.
 * Service conductors 100 ft 500 kcmil Cu, 1 set, steel (Table 9: R 0.029,
 * XL 0.048 Ω/kft → Zc 0.005608 Ω). Hand calcs (issue #301 Acceptance):
 *   500 kVA entered        → 10,459 A secondary →  8,632 A at the main → 10 kA
 *   estimated from 200 A   → 225 kVA →  4,707 A →  4,297 A               → 10 kA
 *   estimated from 800 A   → 750 kVA → 15,689 A → 11,908 A               → 14 kA
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import {
  calculateServiceFaultCurrent,
  estimateUtilityTransformer,
} from '../services/calculations/shortCircuit';
import {
  detectStaleCalculations,
  projectServiceRatingAmps,
} from '../services/calculations/shortCircuitHierarchy';
import { availableFaultCurrentInputFor } from '../services/pdfExport/permitPacketGenerator';
import { AvailableFaultCurrentPage } from '../services/pdfExport/PermitPacketDocuments';
import { ShortCircuitTablePages } from '../services/pdfExport/ShortCircuitDocuments';

/** Every string in the tree, expanding function components (these pages are pure). */
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

const mdp: any = {
  id: 'mdp', project_id: 'p', name: 'MDP', voltage: 480, phase: 3, bus_rating: 800, main_breaker_amps: 800,
  is_main: true, aic_rating: null, fed_from: null, fed_from_type: 'service', fed_from_transformer_id: null,
};

const conductor = { length: 100, conductorSize: '500 kcmil', material: 'Cu' as const, conduitType: 'Steel' as const, setsInParallel: 1 };

/** A service row as the Tools calculator saves it (results from the calculator itself). */
function serviceRow(id: string, serviceAmps: number, kva: number | null): any {
  const transformer = kva
    ? { kva, primaryVoltage: 12470, secondaryVoltage: 480, impedance: 5.75 }
    : estimateUtilityTransformer(serviceAmps, 480, 3, 5.75);
  const result = calculateServiceFaultCurrent(transformer, 480, 3, conductor);
  return {
    id, project_id: 'p', calculation_type: 'service', panel_id: null, location_name: 'Service Entrance',
    service_amps: serviceAmps, service_voltage: 480, service_phase: 3,
    transformer_kva: kva, transformer_impedance: 5.75,
    service_conductor_size: '500 kcmil', service_conductor_material: 'Cu', service_conductor_length: 100,
    service_conduit_type: 'Steel', source_fault_current: null,
    results: { ...result, setsInParallel: 1 }, notes: null,
  };
}

const project = { service_amps: null, service_voltage: 480, service_phase: 3 as const, utility_available_fault_current_a: null };

function packetData(calcs: any[]): any {
  return {
    projectName: 'QA Short circuit', serviceVoltage: 480, servicePhase: 3, projectServiceAmps: null,
    panels: [mdp], circuits: [], feeders: [], transformers: [], shortCircuitCalculations: calcs,
  };
}

describe('#301 the project service rating', () => {
  it('is the project service amps, else the MDP main breaker', () => {
    expect(projectServiceRatingAmps({ service_amps: null }, [mdp])).toBe(800);
    expect(projectServiceRatingAmps({ service_amps: 400 }, [mdp])).toBe(400);
    expect(projectServiceRatingAmps({ service_amps: null }, [{ ...mdp, main_breaker_amps: null }])).toBeNull();
  });

  it('E-102 prints 800 A for the QA row (500 kVA entered, saved with 200 A in the amps field), not Stale', () => {
    const row = serviceRow('svc', 200, 500);
    expect(Math.round(row.results.faultCurrent)).toBe(8632);
    const input = availableFaultCurrentInputFor(packetData([row]), row);
    expect(input.serviceAmps).toBe(800); // main: 200
    expect(input.staleReason).toBeNull();
    const text = textOf(React.createElement(AvailableFaultCurrentPage, { projectName: 'QA Short circuit', input }));
    expect(text).toMatch(/Service Rating\s+800\s+A/);
    expect(text).not.toMatch(/STALE/);
  });
});

describe('#301 a service row estimated from other amps is Stale', () => {
  it('estimated from 200 A on an 800 A project: Stale, now 11,908 A at the main', () => {
    const row = serviceRow('svc', 200, null);
    expect(Math.round(row.results.faultCurrent)).toBe(4297);
    expect(Math.round(row.results.details.sourceFaultCurrent)).toBe(4707);
    const stale = detectStaleCalculations({ project, panels: [mdp], transformers: [], calculations: [row] });
    expect(stale.get('svc')?.reason).toBe(
      "Service rating changed: the utility transformer was estimated from a 200 A service; the project's service rating is 800 A (11,908 A at the service main)",
    );

    const input = availableFaultCurrentInputFor(packetData([row]), row);
    expect(input.serviceAmps).toBe(800);
    const e102 = textOf(React.createElement(AvailableFaultCurrentPage, { projectName: 'QA Short circuit', input }));
    expect(e102).toContain('STALE, RE-RUN');
    expect(e102).toContain('estimated from a 200 A service');

    const e103 = textOf(React.createElement(ShortCircuitTablePages, { calculations: [row], stale, panels: [mdp], projectName: 'QA Short circuit' } as any));
    expect(e103).toMatch(/Stale, re-run:\s+1/);
    expect(e103).toContain("Service Entrance: Service rating changed: the utility transformer was estimated from a 200 A service");
    expect(e103).not.toContain('upstream fault current changed');
  });

  it('estimated from the project rating (800 A): 11,908 A / 14 kA, not Stale', () => {
    const row = serviceRow('svc', 800, null);
    expect(Math.round(row.results.faultCurrent)).toBe(11908);
    expect(Math.round(row.results.details.sourceFaultCurrent)).toBe(15689);
    expect(row.results.requiredAIC).toBe(14);
    const stale = detectStaleCalculations({ project, panels: [mdp], transformers: [], calculations: [row] });
    expect(stale.size).toBe(0);
  });

  it('a kVA entered: never Stale on this rule, whatever the amps field holds', () => {
    const stale = detectStaleCalculations({ project, panels: [mdp], transformers: [], calculations: [serviceRow('svc', 200, 500)] });
    expect(stale.size).toBe(0);
  });

  it('the project service amps win over the MDP main', () => {
    const row = serviceRow('svc', 800, null);
    const stale = detectStaleCalculations({ project: { ...project, service_amps: 400 }, panels: [mdp], transformers: [], calculations: [row] });
    expect(stale.get('svc')?.reason).toContain("the project's service rating is 400 A");
  });
});
