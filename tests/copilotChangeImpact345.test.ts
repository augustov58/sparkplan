/**
 * #345: the Copilot's analyze_change_impact tool declared its loads as bare
 * objects, so Gemini named the fields itself (`load_type`) and the backend
 * (ProposedLoad: type, amps, quantity) answered 422. The Copilot then asked
 * the user for voltage and poles, as if information were missing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api/pythonBackend', () => ({
  analyzeChangeImpact: vi.fn(),
  draftRFI: vi.fn(),
  predictInspection: vi.fn(),
}));

import { analyzeChangeImpact } from '../services/api/pythonBackend';
import { executeTool, getToolDefinitionsForGemini, type ToolContext } from '../services/ai/chatTools';

const analyze = vi.mocked(analyzeChangeImpact);
const ctx = { projectId: 'p1', projectContext: {} } as unknown as ToolContext;
const description = 'Adding 2 Level 2 EV chargers at 40A each';

beforeEach(() => {
  analyze.mockReset();
  analyze.mockResolvedValue({ title: 't', description: 'd', reasoning: 'r', impact_analysis: {}, confidence_score: 0.9 } as never);
});

describe('#345 analyze_change_impact sends the backend its load shape', () => {
  it('declares each load as {type, amps, quantity} for Gemini', () => {
    const tool = getToolDefinitionsForGemini().find(t => t.name === 'analyze_change_impact')!;
    const items = (tool.parameters.properties.loads as { items: Record<string, unknown> }).items;
    expect(Object.keys(items.properties as object)).toEqual(['type', 'amps', 'quantity']); // main: no properties
    expect(items.required).toEqual(['type', 'amps']);
  });

  it('maps a load given as load_type to type (the 2026-11-25 request)', async () => {
    const r = await executeTool('analyze_change_impact', {
      change_description: description,
      loads: [{ quantity: 2, load_type: 'ev_charger', amps: 40 }],
    }, ctx);
    expect(r.success).toBe(true);
    expect(analyze).toHaveBeenCalledWith('p1', description, [{ type: 'ev_charger', amps: 40, quantity: 2 }]);
  });

  it('turns numbers given as text into numbers and defaults quantity to 1', async () => {
    await executeTool('analyze_change_impact', {
      change_description: description,
      loads: [{ type: 'heat_pump', amps: '30' }],
    }, ctx);
    expect(analyze).toHaveBeenCalledWith('p1', description, [{ type: 'heat_pump', amps: 30, quantity: 1 }]);
  });

  it('names the missing field instead of sending a load the backend rejects', async () => {
    const r = await executeTool('analyze_change_impact', {
      change_description: description,
      loads: [{ type: 'ev_charger' }],
    }, ctx);
    expect(analyze).not.toHaveBeenCalled();
    expect(r).toEqual({ success: false, error: 'Load 1 needs a type and its amps (got type "ev_charger", amps missing).' });
  });

  it('a backend failure reads as a failure, not as missing user input', async () => {
    analyze.mockRejectedValueOnce(new Error('The AI service is unavailable right now. Please try again in a few minutes.'));
    const r = await executeTool('analyze_change_impact', {
      change_description: description,
      loads: [{ type: 'ev_charger', amps: 40, quantity: 2 }],
    }, ctx);
    expect(r).toEqual({
      success: false,
      error: 'Failed to analyze change impact: The AI service is unavailable right now. Please try again in a few minutes. '
        + 'This is a SparkPlan error, not missing information: tell the user the analysis failed; do not ask them for more details.',
    });
  });
});
