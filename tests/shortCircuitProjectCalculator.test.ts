/**
 * Unit tests for the pure helpers behind ShortCircuitProjectCalculator.
 *
 * The component itself isn't rendered (the project's test env doesn't load
 * jsdom — see tests/attachmentUploadCard.test.ts for the same pattern). We
 * cover the bits where bugs would actually live: the panel→feeder→form
 * mapping (`derivePanelFormState`) and the source-If resolution chain
 * (`deriveSourceFaultCurrent`).
 */

// Note: `deriveSourceFaultCurrent` was removed when this component switched
// to the hierarchy resolver (services/calculations/shortCircuitHierarchy.ts).
// Its behavior is now covered by tests/shortCircuitHierarchy.test.ts.
import { describe, it, expect } from 'vitest';
import { derivePanelFormState } from '../components/ShortCircuitProjectCalculator';

// Loose factories — only the fields the helpers actually touch are populated.
// Cast through `any` to keep the test setup terse; the helpers are typed
// against the real Row interfaces so the production types still constrain
// callers.
const makePanel = (overrides: any = {}) => ({
  id: 'panel-1',
  name: 'Test Panel',
  bus_rating: 200,
  voltage: 240,
  ...overrides,
});

const makeProject = (overrides: any = {}) => ({
  service_voltage: 240,
  service_phase: 1,
  utility_available_fault_current_a: null,
  ...overrides,
});

const makeFeeder = (overrides: any = {}) => ({
  id: 'feeder-1',
  distance_ft: 75,
  phase_conductor_size: '4/0 AWG',
  conductor_material: 'Cu',
  conduit_type: 'PVC',
  sets_in_parallel: 1,
  ...overrides,
});

describe('derivePanelFormState', () => {
  it('hydrates from the supplying feeder when one exists', () => {
    const panel = makePanel({ voltage: 208 });
    const project = makeProject({ service_voltage: 240, service_phase: 3 });
    const feeder = makeFeeder({
      distance_ft: 120,
      phase_conductor_size: '350 kcmil',
      conductor_material: 'Aluminum',
      conduit_type: 'PVC',
      sets_in_parallel: 2,
    });

    const out = derivePanelFormState(panel as any, project as any, feeder as any);

    expect(out).toEqual({
      feederLength: 120,
      feederSize: '350 kcmil',
      feederMaterial: 'Al',
      feederConduit: 'PVC',
      feederSets: 2,
      feederVoltage: 208, // panel.voltage wins over project.service_voltage
      feederPhase: 3,
    });
  });

  it('falls back to safe defaults when no feeder is supplied', () => {
    const panel = makePanel({ voltage: 240 });
    const project = makeProject();

    const out = derivePanelFormState(panel as any, project as any, undefined);

    expect(out.feederLength).toBe(50);
    expect(out.feederSize).toBe('3/0 AWG');
    expect(out.feederMaterial).toBe('Cu');
    expect(out.feederConduit).toBe('Steel');
    expect(out.feederSets).toBe(1);
  });

  it('inherits voltage from project when panel.voltage is missing', () => {
    const panel = makePanel({ voltage: 0 }); // 0 is falsy → fall back
    const project = makeProject({ service_voltage: 480 });

    const out = derivePanelFormState(panel as any, project as any, undefined);

    expect(out.feederVoltage).toBe(480);
  });

  it('normalizes loose conduit + material strings from the DB', () => {
    const feeder = makeFeeder({
      conductor_material: 'aluminum-XHHW',
      conduit_type: 'Rigid PVC Schedule 40',
    });
    const out = derivePanelFormState(makePanel() as any, makeProject() as any, feeder as any);

    expect(out.feederMaterial).toBe('Al');
    expect(out.feederConduit).toBe('PVC');
  });

  it('treats unknown conduit strings as Steel (most-common default)', () => {
    const feeder = makeFeeder({ conduit_type: 'Mystery Conduit XYZ' });
    const out = derivePanelFormState(makePanel() as any, makeProject() as any, feeder as any);
    expect(out.feederConduit).toBe('Steel');
  });
});

