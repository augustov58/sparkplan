/**
 * #334: when the AI backend is down, the four AI features said "Failed to …:"
 * followed by the raw platform response (Railway's 502 JSON) or "Failed to
 * fetch". They now say the AI service is unavailable; the backend's own
 * error messages (`detail`) still pass through.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) } },
}));

import { analyzePhoto, draftRFI } from '../services/api/pythonBackend';

// The literal, not the export: on main the export doesn't exist, and toThrow(undefined) accepts any error
const AI_SERVICE_UNAVAILABLE = 'The AI service is unavailable right now. Please try again in a few minutes.';

const respond = (status: number, body: string) => vi.fn(async () => new Response(body, { status }));

describe('#334 AI backend errors', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('backend unreachable → AI service unavailable (main: "Failed to fetch")', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(draftRFI('p', 'topic')).rejects.toThrow(AI_SERVICE_UNAVAILABLE);
  });

  it("Railway's 502 → AI service unavailable (main: the raw JSON)", async () => {
    vi.stubGlobal('fetch', respond(502, '{"status":"error","code":502,"message":"Application failed to respond"}'));
    await expect(draftRFI('p', 'topic')).rejects.toThrow(AI_SERVICE_UNAVAILABLE);
  });

  it('a 500 that is not JSON → AI service unavailable (main: "Unknown error")', async () => {
    vi.stubGlobal('fetch', respond(500, 'Internal Server Error'));
    await expect(draftRFI('p', 'topic')).rejects.toThrow(AI_SERVICE_UNAVAILABLE);
  });

  it("the backend's own message passes through", async () => {
    vi.stubGlobal('fetch', respond(404, '{"detail":"Project not found"}'));
    await expect(draftRFI('p', 'topic')).rejects.toThrow('Project not found');
    const validation = [{ loc: ['body', 'topic'], msg: 'field required' }];
    vi.stubGlobal('fetch', respond(422, JSON.stringify({ detail: validation })));
    await expect(draftRFI('p', 'topic')).rejects.toThrow(JSON.stringify(validation));
  });

  it('photo analysis (its own upload path) says the same', async () => {
    vi.stubGlobal('fetch', respond(502, '{"status":"error","code":502,"message":"Application failed to respond"}'));
    await expect(analyzePhoto('p', new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).rejects.toThrow(AI_SERVICE_UNAVAILABLE);
  });
});
