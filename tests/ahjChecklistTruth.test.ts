/**
 * #140 / #147 / #148: the jurisdiction checklist and general notes describe
 * the packet that was built and the equipment on the job.
 *
 * - The checklist engine sees the sections whose pages were built, not the
 *   section toggles (a toggled-on voltage-drop section with no feeders has no
 *   page).
 * - A specs sheet that only cites UL listings is 'partial' for a cut-sheet
 *   item; a riser without AIC ratings is 'partial' for the AIC one-line item.
 * - EV / EVEMS / transformer items and notes drop out on a job without them;
 *   new-service notes drop out on an existing-service job.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { AHJContext, PacketAST } from '../data/ahj/types';
import { ALL_MANIFESTS, getManifestById } from '../data/ahj/registry';
import { manifestTextForEdition } from '../data/ahj/codeCycle';
import { ahjEquipmentFlags, serviceScope } from '../data/ahj/checks';
import type { ChecklistResult } from '../services/jurisdictionChecklist/types';

const captured: Array<{ packet: PacketAST; ctx: AHJContext; result: ChecklistResult }> = [];
vi.mock('../services/jurisdictionChecklist/checklistEngine', async (importActual) => {
  const actual = await importActual<typeof import('../services/jurisdictionChecklist/checklistEngine')>();
  return {
    ...actual,
    evaluatePacket: (...args: Parameters<typeof actual.evaluatePacket>) => {
      const result = actual.evaluatePacket(...args);
      captured.push({ packet: args[0], ctx: args[3], result });
      return result;
    },
  };
});

const { generatePermitPacket } = await import('../services/pdfExport/permitPacketGenerator');
const { evaluatePacket } = await import('../services/jurisdictionChecklist/checklistEngine');

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

const panel = (o: Record<string, unknown> = {}): any => ({
  id: 'mdp', project_id: 'p', name: 'MDP', voltage: 208, phase: 3, bus_rating: 400,
  main_breaker_amps: 400, is_main: true, aic_rating: null, fed_from: null, fed_from_type: 'service',
  location: 'Electrical Room', ...o,
});
const circuit = (n: number, description: string, load_watts: number): any => ({
  id: `c${n}`, panel_id: 'mdp', circuit_number: n, description, load_watts, breaker_amps: 20,
  pole: 1, conductor_size: '12 AWG', load_type: 'O',
});

const cafe = (o: Record<string, unknown> = {}): any => ({
  projectId: 'p', projectName: 'Cafe build-out', projectAddress: '1 Main St, Miami FL',
  projectType: 'Commercial', serviceVoltage: 208, servicePhase: 3,
  panels: [panel()], circuits: [circuit(1, 'Espresso machine', 3000), circuit(3, 'Lighting', 1200)],
  feeders: [], transformers: [], preparedBy: 'Tester', contractorLicense: 'EC000',
  scopeOfWork: 'Cafe build-out.', serviceModificationType: 'existing',
  buildingType: 'commercial',
  manifest: getManifestById('city-of-miami')!,
  jurisdiction: {
    id: 'j', jurisdiction_name: 'Miami, Miami-Dade County, FL', city: 'Miami', county: 'Miami-Dade', state: 'FL',
    ahj_name: 'City of Miami Building Department', required_documents: [], required_calculations: [],
  },
  ...o,
});

describe('#140: the checklist reads the pages that were built', () => {
  it('a section toggled on without its data is not in sectionKeys', async () => {
    captured.length = 0;
    await generatePermitPacket(cafe());
    const { packet, ctx, result } = captured.at(-1)!;
    // No feeders → no voltage-drop page; no SC calcs → no fault-current page;
    // no EVEMS / EV panel → no 625.42 / 625.43 pages.
    for (const key of ['voltageDrop', 'availableFaultCurrent', 'evemsNarrative', 'evseLabeling'] as const) {
      expect(packet.sectionKeys).not.toContain(key);
    }
    expect(packet.sectionKeys).toEqual(expect.arrayContaining(['riserDiagram', 'jurisdiction', 'panelSchedules']));
    expect(packet.riserAIC).toBe(false);
    expect(ctx).toMatchObject({ scope: 'existing-service', hasEV: false, hasEVEMS: false, hasTransformer: false });

    const sev = Object.fromEntries(result.items.map((i) => [i.id, i.severity]));
    expect(sev['city-of-miami-installation-manual']).toBe('na');
    expect(sev['city-of-miami-hvhz-anchoring']).toBe('na');
    expect(sev['city-of-miami-available-fault-current']).toBe('na');
    // Riser present, no panel AIC rating → partial, not [X].
    expect(sev['city-of-miami-riser-diagram']).toBe('partial');
  }, 60_000);

  it('the same job with EV chargers and AIC ratings', async () => {
    captured.length = 0;
    await generatePermitPacket(cafe({
      panels: [panel({ aic_rating: 22000 })],
      circuits: [circuit(1, 'Espresso machine', 3000), circuit(3, 'EV Charger - Level 2', 7680)],
    }));
    const { packet, ctx, result } = captured.at(-1)!;
    expect(ctx.hasEV).toBe(true);
    // A charger on a panel not named "EV…" still gets the 625.43 labeling page.
    expect(packet.sectionKeys).toContain('evseLabeling');
    const item = (id: string) => result.items.find((i) => i.id === id)!;
    expect(item('city-of-miami-riser-diagram').severity).toBe('pass');
    // Specs sheet cites listings; no cut sheet uploaded → partial with a note.
    expect(item('city-of-miami-installation-manual')).toMatchObject({
      severity: 'partial',
      note: 'listings cited on the equipment specs sheet; manufacturer cut sheet not attached',
    });
    expect(result.summary.partial).toBeGreaterThan(0);
  }, 60_000);
});

describe('#148: AHJContext equipment flags', () => {
  it('derives EV / EVEMS / transformer from circuits and transformers', () => {
    expect(ahjEquipmentFlags([{ description: 'Lighting' }], 0)).toEqual({ hasEV: false, hasEVEMS: false, hasTransformer: false });
    expect(ahjEquipmentFlags([{ description: 'EVSE #1' }], 1)).toEqual({ hasEV: true, hasEVEMS: false, hasTransformer: true });
    expect(ahjEquipmentFlags([{ description: 'EVEMS Aggregate Setpoint' }], 0)).toEqual({ hasEV: true, hasEVEMS: true, hasTransformer: false });
    // "EV Area Lighting" isn't a charger (#164).
    expect(ahjEquipmentFlags([{ description: 'EV Area Lighting' }], 0).hasEV).toBe(false);
    // A saved MF EV analysis puts EV in scope before the chargers are circuits.
    expect(ahjEquipmentFlags([], 0, true).hasEV).toBe(true);
  });

  it('maps service modification to scope like the UI', () => {
    expect(serviceScope('new-service')).toBe('new-service');
    expect(serviceScope('service-upgrade')).toBe('existing-service');
    expect(serviceScope(undefined)).toBe('existing-service');
  });

  const noEquipment: AHJContext = {
    scope: 'existing-service', lane: 'contractor_exemption', buildingType: 'commercial',
    hasEV: false, hasEVEMS: false, hasTransformer: false,
  };

  it('no EVSE / EVEMS note survives on a job without them', () => {
    for (const m of ALL_MANIFESTS) {
      for (const edition of ['2020', '2023'] as const) {
        const notes = manifestTextForEdition(m, edition, noEquipment).generalNotes ?? [];
        expect(notes.filter((n) => /\bEVSE\b|EVEMS/.test(n)), `${m.id} ${edition}`).toEqual([]);
      }
    }
  });

  it('notes are all kept when the context does not say (legacy callers)', () => {
    for (const m of ALL_MANIFESTS) {
      expect(manifestTextForEdition(m, '2020').generalNotes).toHaveLength(m.generalNotes.length);
    }
  });

  it('#147: Orlando and City of Miami fault-current notes only on new service', () => {
    const fc = /fault current/i;
    for (const id of ['orlando', 'city-of-miami']) {
      const m = getManifestById(id)!;
      const existing = manifestTextForEdition(m, '2020', { ...noEquipment, hasEV: true }).generalNotes!;
      const fresh = manifestTextForEdition(m, '2020', { ...noEquipment, hasEV: true, scope: 'new-service' }).generalNotes!;
      expect(existing.filter((n) => fc.test(n)), id).toEqual([]);
      expect(fresh.filter((n) => fc.test(n)), id).toHaveLength(1);
    }
  });

  it('EV-subject requirements are N/A without EV; those left are generic plan items', () => {
    // What still names EV after gating: plan-set items every packet carries
    // (site plan, load calc, riser) written for the AHJs' EV checklists.
    const stillRequired = ALL_MANIFESTS.flatMap((m) =>
      evaluatePacket({}, [], m, noEquipment).items
        .filter((i) => i.required && /\bEV(SE)?\b|EVEMS|charger|625\.4/i.test(i.name))
        .map((i) => i.id));
    expect(stillRequired.sort()).toEqual([
      'city-of-miami-load-calculation', 'city-of-miami-site-plan',
      'davie-electrical-floor-plan', 'davie-riser-and-load-calc',
      'hillsborough-tampa-site-plan',
      'jacksonville-duval-equipment-schedule', 'jacksonville-duval-load-calculations', 'jacksonville-duval-site-plan',
      'md-site-plan',
      'orange-county-load-calculation', 'orange-county-site-plan',
      'orlando-load-calculation', 'orlando-site-plan',
      'pompano-load-calculation', 'pompano-site-plan',
      'st-petersburg-site-plan',
    ]);
  });

  it('a transformer puts Miami-Dade 450.3 back on the checklist', () => {
    const md = getManifestById('miami-dade')!;
    const req = (ctx: AHJContext) => evaluatePacket({}, [], md, ctx).items.find((i) => i.id === 'md-transformer-ocpd')!.required;
    expect(req(noEquipment)).toBe(false);
    expect(req({ ...noEquipment, hasTransformer: true })).toBe(true);
  });

  it('Miami-Dade 450.3 and wet-location items look for their content, not just the page', () => {
    const md = getManifestById('miami-dade')!;
    const detect = (id: string, packet: PacketAST) => md.requirements.find((r) => r.id === id)!.detect(packet, []);
    expect(detect('md-transformer-ocpd', { sectionKeys: ['equipmentSchedule'], transformerCount: 0 })).toBe(false);
    expect(detect('md-transformer-ocpd', { sectionKeys: ['equipmentSchedule'], transformerCount: 1 })).toBe(true);
    const notes = (ctx: AHJContext) => manifestTextForEdition(md, '2020', ctx).generalNotes!;
    expect(detect('md-wet-location', { sectionKeys: ['generalNotes'], generalNotes: notes(noEquipment) })).toBe(false);
    expect(detect('md-wet-location', { sectionKeys: ['generalNotes'], generalNotes: notes({ ...noEquipment, hasEV: true }) })).toBe(true);
  });
});
