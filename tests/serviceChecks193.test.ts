/**
 * #193: tools that answer "is the service sufficient?" read the shared check
 * (`scheduleServiceCheck`: the Article 220 load + 25% of the continuous loads,
 * NEC 230.42(A)(1), PE ruling 2026-11-07, #192) — the check E-102 makes on
 * the calculated method — not a rough rule of their own (connected × 0.8,
 * breaker sums, 80% thresholds). Values: the hand calculation in the issue's
 * Acceptance section ("QA Service check").
 */
import { describe, it, expect } from 'vitest';
import { scheduleServiceCheck } from '../lib/storedCalcs';
import { runInspection } from '../services/inspection/inspectorMode';
import { executeTool, type ToolContext } from '../services/ai/chatTools';
import { buildProjectContext } from '../services/ai/projectContextBuilder';
import type { Project } from '../types';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];

const panel = (o: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel => ({
  bus_rating: 200, main_breaker_amps: 200, voltage: 240, phase: 1, num_spaces: 42, project_id: 'p',
  is_main: false, fed_from: 'mdp', fed_from_type: 'panel', fed_from_transformer_id: null, ...o,
} as unknown as Panel);
let n = 0;
const circuit = (panel_id: string, description: string, load_type: string, load_watts: number): Circuit => ({
  id: `c${n++}`, panel_id, description, load_type, load_watts, breaker_amps: 20, project_id: 'p',
  circuit_number: n, pole: 1, is_proposed: true,
} as unknown as Circuit);

const project = {
  id: 'p', name: 'QA Service check', type: 'Commercial', serviceVoltage: 240, servicePhase: 1, serviceAmps: 200,
  settings: { occupancyType: 'commercial', service_modification_type: 'new-service' },
} as unknown as Project;
const mdp = panel({ id: 'mdp', name: 'MDP', is_main: true, fed_from: null, fed_from_type: 'service' });
const panels = [mdp, panel({ id: 'ev', name: 'EV Panel' }), panel({ id: 'office', name: 'Office Panel' })];
const circuits = [
  ...[1, 2, 3].map(i => circuit('ev', `EV Charger #${i}`, 'O', 11_520)),
  circuit('ev', 'Receptacles', 'R', 1_800),
  circuit('office', 'Lighting', 'L', 6_000),
  circuit('office', 'Receptacles', 'R', 6_000),
  circuit('office', 'Exterior sign', 'O', 1_500),
];
const check = scheduleServiceCheck(project, panels, circuits, [], '2020')!;

describe('the shared service check (#193)', () => {
  it('QA Service check: 49,860 VA + 25% × 36,060 VA = 58,875 VA = 245.3 A on 200 A', () => {
    expect(check.loadKVA).toBeCloseTo(49.86, 6);
    expect(check.adderKVA).toBeCloseTo(9.015, 6);
    expect(check.checkAmps).toBeCloseTo(58_875 / 240, 6);
    expect(check.serviceAmps).toBe(200);
    expect(check.sufficient).toBe(false);
    expect(Math.round(check.utilizationPct)).toBe(123);
  });

  it('rates against the MDP main breaker when the project has no service amps', () => {
    const p = { ...project, serviceAmps: undefined } as unknown as Project;
    const big = panels.map(x => (x.is_main ? { ...x, main_breaker_amps: 400, bus_rating: 400 } : x));
    const c = scheduleServiceCheck(p, big, circuits, [], '2020')!;
    expect(c.serviceAmps).toBe(400);
    expect(c.sufficient).toBe(true);
  });

  it('null without an MDP or circuits', () => {
    expect(scheduleServiceCheck(project, panels.filter(p => !p.is_main), circuits, [], '2020')).toBeNull();
    expect(scheduleServiceCheck(project, panels, [], [], '2020')).toBeNull();
  });
});

describe('Inspector Mode reads the shared check (#193)', () => {
  const inspect = (serviceCheck: typeof check | null) => runInspection({
    projectId: 'p', projectType: 'Commercial', serviceVoltage: 240, servicePhase: 1,
    panels, circuits, feeders: [], transformers: [], serviceCheck,
  }).issues.filter(i => i.category === 'service');

  it('a 245 A check on 200 A is critical (was a warning at 83%, connected × 0.8)', () => {
    const [issue] = inspect(check);
    expect(issue).toMatchObject({
      severity: 'critical', title: 'Service Undersized for Load', necArticle: 'NEC 230.42(A)(1)',
      currentValue: '245 A', requiredValue: '≤ 200 A',
    });
    expect(issue!.description).toContain('49.9 kVA');
    expect(issue!.description).toContain('9.0 kVA');
  });

  it('between 80% and 100% of the rating is an advisory warning', () => {
    const [issue] = inspect({ ...check, checkAmps: 170, utilizationPct: 85, sufficient: true });
    expect(issue).toMatchObject({ severity: 'warning', title: 'Service Nearing Capacity', currentValue: '85%' });
  });

  it('without the check, no service issue (never the connected × 0.8 estimate)', () => {
    expect(inspect(null)).toHaveLength(0);
  });
});

describe('the Copilot reads the shared check (#193)', () => {
  const context = (serviceCheck: typeof check | null): ToolContext => ({
    projectId: 'p',
    projectContext: buildProjectContext(
      'p', 'QA Service check', 'Commercial', 240, 1, panels, circuits, [], [],
      undefined, undefined, undefined, undefined, undefined, '2020', false, serviceCheck,
    ),
  });

  it('check_service_upgrade: 245 A now; a 7,680 W EV charger adds 125% → 285 A, upgrade needed', async () => {
    const r = await executeTool('check_service_upgrade',
      { proposed_load_watts: 7_680, proposed_load_description: 'EV charger' }, context(check));
    expect(r.data).toMatchObject({
      currentServiceAmps: 200, currentCheckAmps: 245, proposedTakenAsContinuous: true,
      proposedCheckAmps: 40, projectedCheckAmps: 285, needsUpgrade: true,
    });
  });

  it('a non-continuous proposed load is taken at 100%', async () => {
    const r = await executeTool('check_service_upgrade',
      { proposed_load_watts: 4_500, proposed_load_description: 'Water heater' }, context(check));
    expect(r.data).toMatchObject({ proposedTakenAsContinuous: false, projectedCheckAmps: 264 }); // 245.3 + 18.75
  });

  it('sufficiency is the rating, not 80% of it', async () => {
    const ok = { ...check, checkAmps: 180, utilizationPct: 90, sufficient: true };
    const r = await executeTool('check_service_upgrade', {}, context(ok));
    expect(r.data).toMatchObject({ currentCheckAmps: 180, needsUpgrade: false });
  });

  it('without project data the tool labels its number a rough estimate', async () => {
    const r = await executeTool('check_service_upgrade', {}, context(null));
    expect((r.data as { basis: string }).basis).toContain('ROUGH ESTIMATE');
  });

  it('the context summary states the check, not "Estimated Demand Load"', () => {
    const summary = context(check).projectContext.summary;
    expect(summary).toContain('NEC 220 Demand Load: 49.9 kVA');
    expect(summary).toContain('245 A of 200 A');
    expect(summary).toContain('INSUFFICIENT');
    expect(context(null).projectContext.summary).toContain('rough: connected × 0.8');
  });
});
