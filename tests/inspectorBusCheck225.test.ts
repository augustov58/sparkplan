/**
 * #225: the NEC 408.30 bus check compares each panel's design load (demand +
 * 25% of continuous loads, the Feeder Manager's `feederDesignLoadVA`; the
 * MDP's = the service check) with its bus rating, in the panel's own phase.
 * It read only the panel's own circuits at connected load, so an MDP with
 * feeders always passed. Values: the hand calculation in the issue's
 * Acceptance section ("QA Service check").
 */
import { describe, it, expect } from 'vitest';
import { panelDesignAmps, scheduleServiceCheck } from '../lib/storedCalcs';
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
  id: `c${n++}`, panel_id, description, load_type, load_watts, breaker_amps: 60, project_id: 'p',
  circuit_number: n, pole: 2, is_proposed: true,
} as unknown as Circuit);

const project = {
  id: 'p', name: 'QA Service check', type: 'Commercial', serviceVoltage: 240, servicePhase: 1, serviceAmps: 200,
  settings: { occupancyType: 'commercial', service_modification_type: 'new-service' },
} as unknown as Project;
const panels = [
  panel({ id: 'mdp', name: 'MDP', is_main: true, fed_from: null, fed_from_type: 'service' }),
  panel({ id: 'ev', name: 'EV Panel' }),
  panel({ id: 'office', name: 'Office Panel' }),
];
const circuits = [
  ...[1, 2, 3].map(i => circuit('ev', `EV Charger #${i}`, 'O', 11_520)),
  circuit('ev', 'Receptacles', 'R', 1_800),
  circuit('office', 'Lighting', 'L', 6_000),
  circuit('office', 'Receptacles', 'R', 6_000),
  circuit('office', 'Exterior sign', 'O', 1_500),
];
const amps = panelDesignAmps(project, panels, circuits, [], '2020');

describe('panel design amps for the 408.30 bus check (#225)', () => {
  it('MDP = the service check; sub-panels = demand + 25% of continuous loads', () => {
    expect(amps.mdp).toBeCloseTo(scheduleServiceCheck(project, panels, circuits, [], '2020')!.checkAmps, 9);
    expect(amps.mdp).toBeCloseTo(58_875 / 240, 6); // 245.3 A
    expect(amps.ev).toBeCloseTo(45_000 / 240, 6); // 36,360 + 25% × 34,560 = 187.5 A
    expect(amps.office).toBeCloseTo(13_875 / 240, 6); // 13,500 + 25% × 1,500 = 57.8 A
  });
});

describe('Inspector Mode bus check (#225)', () => {
  const busItems = (panelDesignAmps?: Record<string, number>) => {
    const r = runInspection({
      projectId: 'p', projectType: 'Commercial', serviceVoltage: 240, servicePhase: 1,
      panels, circuits, feeders: [], transformers: [], panelDesignAmps,
    });
    return {
      issues: r.issues.filter(i => i.necArticle === 'NEC 408.30'),
      passed: r.passedChecks.filter(c => c.necArticle === 'NEC 408.30').map(c => c.description),
    };
  };

  it('MDP critical at 245 A on 200 A; EV Panel warning at 94%; Office Panel passes', () => {
    const { issues, passed } = busItems(amps);
    expect(issues.find(i => i.location === 'MDP')).toMatchObject({
      severity: 'critical', title: 'Panel Overloaded Beyond Bus Rating', currentValue: '245 A', requiredValue: '≤ 200 A',
    });
    expect(issues.find(i => i.location === 'EV Panel')).toMatchObject({ severity: 'warning', currentValue: '94%' });
    expect(passed).toEqual(['Panel Office Panel: Bus loading acceptable (58 A of 200 A)']);
  });

  it('on main every panel passed: the MDP had no direct circuits (the fallback, still in the panel\'s phase)', () => {
    const { issues } = busItems(undefined);
    expect(issues.some(i => i.location === 'MDP')).toBe(false);
    expect(issues.some(i => i.location === 'EV Panel')).toBe(false); // 36,360 VA = 151.5 A, 76%
  });
});

describe('Copilot run_quick_inspection reads the same loads (#225)', () => {
  it('flags the MDP and the EV Panel from the design amps', async () => {
    const context: ToolContext = {
      projectId: 'p',
      projectContext: buildProjectContext(
        'p', 'QA Service check', 'Commercial', 240, 1, panels, circuits, [], [],
        undefined, undefined, undefined, undefined, undefined, '2020', false, null, amps,
      ),
    };
    const r = await executeTool('run_quick_inspection', { category: 'panels' }, context);
    const issues = (r.data as { issues: Array<{ severity: string; description: string }> }).issues;
    expect(issues).toContainEqual(expect.objectContaining({ severity: 'critical', description: expect.stringContaining('MDP') }));
    expect(issues).toContainEqual(expect.objectContaining({ severity: 'warning', description: expect.stringContaining('EV Panel') }));
    expect(issues.some(i => i.description.includes('Office Panel'))).toBe(false);
  });
});
