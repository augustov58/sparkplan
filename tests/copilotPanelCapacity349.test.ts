/**
 * #349 (owner ruling 2026-11-25, option a): the Copilot's panel capacity tool
 * compared connected load with 80 % of the bus "per NEC". It now compares the
 * panel's design load (#225, `designAmps`) plus the proposed load with the bus
 * rating (NEC 408.30); a proposed load takes +25 % only when it's on the
 * service check's continuous list (EV charging, signs, show windows).
 * Values are the issue's hand calculation ("QA Commercial panel", MDP 200 A,
 * 208 V 3Φ, design load 21,300 VA).
 */
import { describe, expect, it } from 'vitest';
import { executeTool, type ToolContext } from '../services/ai/chatTools';

const designAmps = 21_300 / (208 * Math.sqrt(3)); // 59.12 A
const mdp = {
  id: 'mdp', name: 'MDP', isMain: true, voltage: 208, phase: 3 as const, busRating: 200,
  numSpaces: 30, circuitCount: 7, totalLoadVA: 21_300, designAmps,
};
const ctx = (panel: Record<string, unknown> = mdp): ToolContext => ({
  projectId: 'p1',
  projectContext: { projectId: 'p1', panels: [panel], circuits: [], feeders: [], transformers: [], totalLoad: { connectedVA: 21_300, demandVA: 21_300 } },
} as unknown as ToolContext);
const capacity = async (params: Record<string, unknown>, context = ctx()) =>
  (await executeTool('check_panel_capacity', { panel_name: 'MDP', ...params }, context)) as { success: boolean; data?: Record<string, unknown>; error?: string };

describe('#349 check_panel_capacity: design load vs the bus (NEC 408.30)', () => {
  it('current load: 59.1 A of 200 A, 29.6 %, no 80 % figure', async () => {
    const r = await capacity({});
    expect(r.data).toMatchObject({ designLoadAmps: 59.1, utilizationPercent: 29.6, availableAmps: 140.9 }); // main: currentUtilization 37
    expect(r.data).not.toHaveProperty('maxContinuousLoadVA'); // main: 57,641 VA "80% rule"
    expect(JSON.stringify(r.data)).not.toMatch(/80 ?%/);
  });

  it('step 1: a 30 A 3-phase load (10,808 VA) → 89.1 A, 44.6 %, fits', async () => {
    const r = await capacity({ additional_load_watts: 10_808 });
    expect(r.data).toMatchObject({ additionalLoadContinuous: false, additionalLoadAmps: 30, projectedLoadAmps: 89.1, projectedUtilizationPercent: 44.6, canAccommodate: true });
  });

  it('step 2: the same as an EV charger takes 125 % → 96.6 A, 48.3 %', async () => {
    const r = await capacity({ additional_load_watts: 10_808, additional_load_description: 'EV charger' });
    expect(r.data).toMatchObject({ additionalLoadContinuous: true, additionalLoadAmps: 37.5, projectedLoadAmps: 96.6, projectedUtilizationPercent: 48.3, canAccommodate: true });
  });

  it('signs and show windows are continuous; a water heater is not (the service check\'s list)', async () => {
    expect((await capacity({ additional_load_watts: 10_808, additional_load_description: 'storefront sign' })).data?.additionalLoadAmps).toBe(37.5);
    expect((await capacity({ additional_load_watts: 10_808, additional_load_description: 'water heater' })).data?.additionalLoadAmps).toBe(30);
  });

  it('step 3: a 150 A 3-phase load (54,040 VA) → 209.1 A on a 200 A bus: does not fit', async () => {
    const r = await capacity({ additional_load_watts: 54_040 });
    expect(r.data).toMatchObject({ projectedLoadAmps: 209.1, canAccommodate: false });
  });

  it('single-phase panel: no √3', async () => {
    const r = await capacity({ additional_load_watts: 4_800 }, ctx({ ...mdp, voltage: 240, phase: 1, busRating: 100, designAmps: 50 }));
    expect(r.data).toMatchObject({ additionalLoadAmps: 20, projectedLoadAmps: 70, projectedUtilizationPercent: 70 });
  });

  it('no design load: says so instead of guessing from connected load', async () => {
    const r = await capacity({}, ctx({ ...mdp, designAmps: undefined }));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/design load isn't available/);
  });
});

describe('#349 folded in: the same 80 % rule in two more Copilot tools', () => {
  it('get_project_summary: utilization is design amps ÷ bus (29.6 %), not connected ÷ 80 % of the bus (37 %)', async () => {
    const r = (await executeTool('get_project_summary', {}, ctx())) as { data?: { panels: Array<{ utilization: number | null }> } };
    expect(r.data?.panels[0]?.utilization).toBe(29.6);
    const none = (await executeTool('get_project_summary', {}, ctx({ ...mdp, designAmps: undefined }))) as { data?: { panels: Array<{ utilization: number | null }> } };
    expect(none.data?.panels[0]?.utilization).toBeNull();
  });

  it('run_quick_inspection: no design amps, no capacity verdict (main: 21,300 VA connected on a 60 A bus read 123 %, "overloaded")', async () => {
    // 21,300 ÷ (60 × 208 × √3 × 0.8) = 123 %; against the full bus it would be 98.5 %
    const small = { ...mdp, busRating: 60, designAmps: undefined };
    const r = (await executeTool('run_quick_inspection', { category: 'panels' }, ctx(small))) as { data?: { issues?: Array<{ description: string }> } };
    expect((r.data?.issues ?? []).filter(i => /capacity|overloaded/i.test(i.description))).toEqual([]);
  });
});
