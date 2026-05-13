/**
 * Tests the short-circuit slice of the chatbot's project context.
 *
 * Why: the chatbot needs to answer NEC 110.9 / AIC questions from any tab
 * (Estimating, Load Calc, etc.) without forcing the user to navigate to
 * the Short Circuit tab and read numbers off the cards. These tests pin
 * the prompt shape so a refactor doesn't silently strip the SC block.
 */
import { describe, it, expect } from 'vitest';
import {
  buildProjectContext,
  formatContextForAI,
} from '../services/ai/projectContextBuilder';

// Loose factories — only the fields the context builder actually reads are
// populated. Cast through `any` to keep setup terse (the same pattern other
// test files use against the DB Row types).
const makeProject = () => ({
  service_voltage: 240,
  service_phase: 1 as 1 | 3,
  utility_available_fault_current_a: null,
});

const makePanel = (overrides: any = {}) =>
  ({
    id: 'mdp-1',
    name: 'MDP',
    is_main: true,
    voltage: 240,
    phase: 1,
    bus_rating: 400,
    main_breaker_amps: 400,
    num_spaces: 30,
    fed_from_type: 'service',
    fed_from: null,
    fed_from_transformer_id: null,
    location: null,
    ...overrides,
  });

const makeSubPanel = (overrides: any = {}) =>
  makePanel({
    id: 'sub-1',
    name: 'Sub-A',
    is_main: false,
    bus_rating: 200,
    main_breaker_amps: 200,
    fed_from_type: 'panel',
    fed_from: 'mdp-1',
    ...overrides,
  });

const makeServiceCalc = (overrides: any = {}) => ({
  id: 'sc-svc',
  calculation_type: 'service',
  panel_id: null,
  location_name: 'Service Entrance',
  source_fault_current: null,
  updated_at: '2026-05-13T12:00:00Z',
  results: {
    faultCurrent: 22000,
    requiredAIC: 25,
    compliance: {
      necArticle: 'NEC 110.9',
      compliant: true,
      message: 'Compliant — 25 kA AIC adequate for 22.0 kA fault',
    },
  },
  ...overrides,
});

const makePanelCalc = (overrides: any = {}) => ({
  id: 'sc-sub-a',
  calculation_type: 'panel',
  panel_id: 'sub-1',
  location_name: 'Sub-A Bus',
  source_fault_current: 22000,
  updated_at: '2026-05-13T12:30:00Z',
  results: {
    faultCurrent: 14500,
    requiredAIC: 22,
    compliance: {
      necArticle: 'NEC 110.9',
      compliant: true,
      message: 'Compliant — 22 kA AIC adequate for 14.5 kA fault',
    },
  },
  ...overrides,
});

describe('buildProjectContext: short-circuit calculations', () => {
  it('omits the shortCircuits field when no calculations are passed', () => {
    const ctx = buildProjectContext(
      'p1',
      'Test Project',
      'Commercial',
      240,
      1,
      [makePanel() as any],
      [],
      [],
      [],
    );
    expect(ctx.shortCircuits).toBeUndefined();
  });

  it('hydrates shortCircuits with audit-trail fields from each calc', () => {
    const ctx = buildProjectContext(
      'p1',
      'Test Project',
      'Commercial',
      240,
      1,
      [makePanel() as any, makeSubPanel() as any],
      [],
      [],
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      [makeServiceCalc(), makePanelCalc()] as any,
    );

    expect(ctx.shortCircuits).toHaveLength(2);

    const svc = ctx.shortCircuits!.find((s) => s.calculationType === 'service')!;
    expect(svc.faultCurrentA).toBe(22000);
    expect(svc.requiredAicKa).toBe(25);
    expect(svc.panelName).toBeUndefined(); // service calc has no panel
    expect(svc.compliance).toContain('Compliant');

    const sub = ctx.shortCircuits!.find((s) => s.calculationType === 'panel')!;
    expect(sub.panelName).toBe('Sub-A');
    expect(sub.faultCurrentA).toBe(14500);
    expect(sub.sourceFaultCurrentA).toBe(22000);
  });

  it('handles malformed results JSON without crashing (returns 0 If)', () => {
    const ctx = buildProjectContext(
      'p1',
      'Test Project',
      'Commercial',
      240,
      1,
      [makePanel() as any],
      [],
      [],
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      [makeServiceCalc({ results: null })] as any,
    );
    expect(ctx.shortCircuits).toHaveLength(1);
    expect(ctx.shortCircuits![0].faultCurrentA).toBe(0);
    expect(ctx.shortCircuits![0].requiredAicKa).toBeUndefined();
  });
});

describe('formatContextForAI: SHORT CIRCUIT ANALYSIS block', () => {
  it('skips the block when no SC calculations exist', () => {
    const ctx = buildProjectContext(
      'p1',
      'Test',
      'Commercial',
      240,
      1,
      [makePanel() as any],
      [],
      [],
      [],
    );
    const prompt = formatContextForAI(ctx);
    expect(prompt).not.toContain('SHORT CIRCUIT ANALYSIS');
  });

  it('renders service-entrance calc first, then panels alphabetical', () => {
    // Build with the panel calc first to confirm sort puts service ahead.
    const ctx = buildProjectContext(
      'p1',
      'Test',
      'Commercial',
      240,
      1,
      [makePanel() as any, makeSubPanel() as any],
      [],
      [],
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      [makePanelCalc(), makeServiceCalc()] as any,
    );
    const prompt = formatContextForAI(ctx);
    // Scope the position checks to inside the SHORT CIRCUIT block — panel
    // names appear earlier in the PANELS listing and would skew indexOf().
    const scBlockStart = prompt.indexOf('SHORT CIRCUIT ANALYSIS');
    expect(scBlockStart).toBeGreaterThan(-1);
    const scBlock = prompt.slice(scBlockStart);
    const svcIdx = scBlock.indexOf('SERVICE ENTRANCE');
    const subIdx = scBlock.indexOf('Sub-A');
    expect(svcIdx).toBeGreaterThan(-1);
    expect(subIdx).toBeGreaterThan(-1);
    expect(svcIdx).toBeLessThan(subIdx);
  });

  it('formats fault current in kA, required AIC in kA, and upstream source If', () => {
    const ctx = buildProjectContext(
      'p1',
      'Test',
      'Commercial',
      240,
      1,
      [makePanel() as any, makeSubPanel() as any],
      [],
      [],
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      [makeServiceCalc(), makePanelCalc()] as any,
    );
    const prompt = formatContextForAI(ctx);
    // Service: 22000 A → "22.0 kA available fault current"
    expect(prompt).toMatch(/22\.0 kA available fault current/);
    // NEC 110.9 AIC tag present
    expect(prompt).toMatch(/required AIC 25 kA \(NEC 110\.9\)/);
    // Sub-panel: source If shown
    expect(prompt).toMatch(/calculated from 22\.0 kA upstream/);
    // Compliance line emitted
    expect(prompt).toMatch(/Compliant — 22 kA AIC adequate/);
  });
});
