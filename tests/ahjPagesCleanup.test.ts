/**
 * #149 / #150 / #152: AHJ-facing packet pages print only what applies.
 *
 * - General Notes: the "will appear when bound to an AHJ" box prints only
 *   when no manifest resolved (#149).
 * - Compliance Summary: no Inspector Mode promo; an empty list is N/A, not
 *   Compliant; the grounding plan page counts as grounding (#150).
 * - Pages print in sheet-number order: panel schedules (300) before the
 *   400/500/600 sheets (#152).
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { PacketAST } from '../data/ahj/types';
import { getManifestById } from '../data/ahj/registry';
import { ComplianceSummary, GeneralNotesPage } from '../services/pdfExport/PermitPacketDocuments';

const captured: PacketAST[] = [];
vi.mock('../services/jurisdictionChecklist/checklistEngine', async (importActual) => {
  const actual = await importActual<typeof import('../services/jurisdictionChecklist/checklistEngine')>();
  return {
    ...actual,
    evaluatePacket: (...args: Parameters<typeof actual.evaluatePacket>) => {
      captured.push(args[0]);
      return actual.evaluatePacket(...args);
    },
  };
});

const complianceProps: Array<{ hasGrounding?: boolean }> = [];
vi.mock('../services/pdfExport/PermitPacketDocuments', async (importActual) => {
  const actual = await importActual<typeof import('../services/pdfExport/PermitPacketDocuments')>();
  return {
    ...actual,
    ComplianceSummary: (props: React.ComponentProps<typeof actual.ComplianceSummary>) => {
      complianceProps.push(props);
      return actual.ComplianceSummary(props);
    },
  };
});

const { generatePermitPacket } = await import('../services/pdfExport/permitPacketGenerator');

/** Every string in a component's own element tree (child components are not expanded). */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return '';
}

const panel = (o: Record<string, unknown> = {}): any => ({
  id: 'mdp', project_id: 'p', name: 'MDP', voltage: 208, phase: 3, bus_rating: 400,
  main_breaker_amps: 400, is_main: true, aic_rating: null, fed_from: null, fed_from_type: 'service',
  location: 'Electrical Room', ...o,
});
const circuit = (n: number, panel_id = 'mdp'): any => ({
  id: `c${n}`, panel_id, circuit_number: n, description: 'Lighting', load_watts: 1200,
  breaker_amps: 20, pole: 1, conductor_size: '12 AWG', load_type: 'L',
});

describe('#149: General Notes AHJ placeholder', () => {
  const box = /will appear\s+here when this packet is bound/;
  it('prints when no manifest resolved', () => {
    expect(textOf(GeneralNotesPage({ projectName: 'P' }) as React.ReactElement)).toMatch(box);
  });
  it('does not print on a bound packet', () => {
    expect(textOf(GeneralNotesPage({ projectName: 'P', ahjBound: true }) as React.ReactElement)).not.toMatch(box);
  });
});

describe('#150: Compliance Summary', () => {
  const rows = (props: Partial<React.ComponentProps<typeof ComplianceSummary>>) =>
    textOf(ComplianceSummary({ panels: [panel()], circuits: [circuit(1)], feeders: [], projectName: 'P', ...props }) as React.ReactElement);

  it('has no Inspector Mode promo', () => {
    expect(rows({})).not.toMatch(/Inspector Mode/);
  });

  it('an empty feeder list is N/A, not Compliant', () => {
    expect(rows({})).toMatch(/Feeder Sizing Calculated\s+N\/A/);
    expect(rows({ feeders: [{ phase_conductor_size: '3/0 AWG' } as any] })).toMatch(/Feeder Sizing Calculated\s+Compliant/);
    expect(rows({ feeders: [{ phase_conductor_size: null } as any] })).toMatch(/Feeder Sizing Calculated\s+Partial/);
  });

  it('empty panel / circuit lists are N/A', () => {
    const t = rows({ panels: [], circuits: [] });
    expect(t).toMatch(/Panel Bus Ratings Specified\s+N\/A/);
    expect(t).toMatch(/Circuit Overcurrent Protection\s+N\/A/);
    expect(t).toMatch(/Conductor Sizing Specified\s+N\/A/);
    expect(rows({ circuits: [{ ...circuit(1), breaker_amps: null }] })).toMatch(/Circuit Overcurrent Protection\s+Incomplete/);
  });
});

describe('generator: #150 grounding + #152 sheet order', () => {
  beforeAll(() => {
    (globalThis.URL as any).createObjectURL = () => 'blob:fake-url';
    (globalThis.URL as any).revokeObjectURL = () => {};
    (globalThis as any).document = {
      createElement: () => ({ click: () => {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
    };
  });
  afterAll(() => {
    delete (globalThis as any).document;
  });

  it('pages are in sheet-number order, panel schedules before E-5xx', async () => {
    captured.length = 0;
    complianceProps.length = 0;
    await generatePermitPacket({
      projectId: 'p', projectName: 'Cafe', projectAddress: '1 Main St, Miami FL',
      projectType: 'Commercial', serviceVoltage: 208, servicePhase: 3,
      panels: [panel(), panel({ id: 'p2', name: 'LP-1', is_main: false, fed_from: 'mdp', fed_from_type: 'panel', bus_rating: 100 })],
      circuits: [circuit(1), circuit(1, 'p2')],
      feeders: [], transformers: [], preparedBy: 'Tester', contractorLicense: 'EC000',
      serviceModificationType: 'existing', buildingType: 'commercial',
      manifest: getManifestById('city-of-miami')!,
      jurisdiction: {
        id: 'j', jurisdiction_name: 'Miami, Miami-Dade County, FL', city: 'Miami', county: 'Miami-Dade', state: 'FL',
        ahj_name: 'City of Miami Building Department', required_documents: [], required_calculations: [],
      },
    } as any);
    const ids = captured.at(-1)!.sheetIds!;
    const num = (id: string) => Number(id.replace(/^\D+-/, ''));
    expect(ids.some((id) => num(id) >= 300 && num(id) < 400)).toBe(true);
    expect(ids.some((id) => num(id) >= 500)).toBe(true);
    expect(ids.map(num)).toEqual([...ids.map(num)].sort((a, b) => a - b));
    // No grounding_details row (hasGrounding unset), but the grounding plan
    // page is built from Table 250.66: the summary counts it.
    expect(complianceProps.at(-1)!.hasGrounding).toBe(true);
  }, 60_000);
});
