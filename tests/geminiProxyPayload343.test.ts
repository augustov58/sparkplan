/**
 * #343: on Gemini 3 (gemini-3.8-flash, and gemini-3.5-flash-lite, where
 * gemini-2.5-flash reroutes on 2026-12-01) the proxy's tool-result
 * continuation was a 400 ("Role 'function' is not supported"), and the panel
 * photo import's thinkingBudget 0 was a 400 on 3.5-flash-lite. Checked
 * against the deployed proxy on 2026-11-25.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GEMINI_MODEL, buildGeminiPayload, geminiUrl, readGeminiResponse } from '../supabase/functions/gemini-proxy/payload';

const callPart = {
  functionCall: { name: 'get_panel_load', args: { panel_name: 'MDP' }, id: 'call-1' },
  thoughtSignature: 'sig-abc',
};

describe('#343 the proxy speaks Gemini 3', () => {
  it('uses one model, gemini-3.8-flash, whatever the caller sends', () => {
    expect(GEMINI_MODEL).toBe('gemini-3.8-flash');
    expect(geminiUrl('k')).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=k');
    const payload = buildGeminiPayload({ prompt: 'q', model: 'gemini-2.0-flash-exp' } as never);
    expect(JSON.stringify(payload)).not.toContain('gemini');
  });

  it('sends no sampling parameters and no thinking budget', () => {
    const payload = buildGeminiPayload({ prompt: 'q', temperature: 0.1, thinkingBudget: 0 } as never);
    expect(payload.generationConfig).toEqual({ maxOutputTokens: 8192 }); // main: temperature 0.7, topK 40, topP 0.95
  });

  it('passes a thinking level and structured output through', () => {
    const payload = buildGeminiPayload({
      prompt: 'q', thinkingLevel: 'low', maxOutputTokens: 16384,
      responseMimeType: 'application/json', responseSchema: { type: 'object' },
    });
    expect(payload.generationConfig).toEqual({
      maxOutputTokens: 16384, responseMimeType: 'application/json',
      responseSchema: { type: 'object' }, thinkingConfig: { thinkingLevel: 'low' },
    });
  });

  it('sends a tool result as role user after the model call part, replayed unchanged', () => {
    const payload = buildGeminiPayload({
      prompt: 'What is the load on MDP?',
      toolResult: { toolName: 'get_panel_load', result: { load_va: 21300 }, modelPart: callPart },
    });
    expect(payload.contents).toEqual([
      { role: 'user', parts: [{ text: 'What is the load on MDP?' }] },
      { role: 'model', parts: [callPart] },
      { role: 'user', parts: [{ functionResponse: { name: 'get_panel_load', response: { load_va: 21300 }, id: 'call-1' } }] },
    ]); // main: role 'function', a bare functionCall with args {} and no signature
  });

  it('a client from before the fix (no call part) still gets a call with the documented stand-in signature', () => {
    const payload = buildGeminiPayload({ prompt: 'q', toolResult: { toolName: 'get_panel_load', result: {} } });
    expect(payload.contents[1]).toEqual({
      role: 'model',
      parts: [{ functionCall: { name: 'get_panel_load', args: {} }, thoughtSignature: 'skip_thought_signature_validator' }],
    });
    expect(payload.contents[2].role).toBe('user');
  });

  it('returns a function call with its part, and text without thought parts', () => {
    const call = readGeminiResponse({ candidates: [{ content: { role: 'model', parts: [callPart] } }] });
    expect(call).toEqual({ functionCall: { name: 'get_panel_load', args: { panel_name: 'MDP' } }, modelPart: callPart });

    const text = readGeminiResponse({ candidates: [{ content: { parts: [
      { text: 'thinking…', thought: true }, { text: 'The load is ' }, { text: '21,300 VA.', thoughtSignature: 's' },
    ] } }] });
    expect(text).toEqual({ response: 'The load is 21,300 VA.' });
  });
});

describe('#343 no caller pins a model or sends Gemini 2.5 parameters', () => {
  const callers = ['services/geminiService.ts', 'services/panelOcrService.ts', 'components/RFIPDFExtractor.tsx'];
  it.each(callers)('%s', file => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/model:\s*'gemini/); // main: gemini-2.5-flash ×4, gemini-2.0-flash-exp (shut down)
    expect(source).not.toMatch(/thinkingBudget:|temperature:/);
  });
});
