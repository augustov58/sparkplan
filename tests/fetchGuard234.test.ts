/**
 * #234: a list hook's refetch that started before (or during) an optimistic
 * write could land after it and bring a deleted row back. FetchGuard drops
 * such a result and refetches once the writes settle.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { FetchGuard } from '../lib/fetchGuard';

afterEach(() => { vi.useRealTimers(); });

describe('#234 FetchGuard', () => {
  it('drops a fetch that started before a write, or returns while one runs', () => {
    const g = new FetchGuard();
    const before = g.token();
    g.begin();
    const during = g.token();
    expect(g.stale(before)).toBe(true);
    expect(g.stale(during)).toBe(true); // a write is still in flight
    g.end();
    expect(g.stale(during)).toBe(true); // started before the write settled
    expect(g.stale(g.token())).toBe(false); // started after: applied
  });

  it('refetches once after a burst of writes (a loop of creates)', async () => {
    vi.useFakeTimers();
    const g = new FetchGuard();
    const refetch = vi.fn();
    g.refetch = refetch;
    const create = g.wrap(async (n: number) => n * 2);
    for (let i = 0; i < 6; i++) expect(await create(i)).toBe(i * 2);
    expect(refetch).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('settles and refetches when the write throws, and keeps a stable wrapper per function', async () => {
    vi.useFakeTimers();
    const g = new FetchGuard();
    const refetch = vi.fn();
    g.refetch = refetch;
    const fail = async () => { throw new Error('insert failed'); };
    await expect(g.wrap(fail)()).rejects.toThrow('insert failed');
    expect(g.stale(g.token())).toBe(false); // not stuck in flight
    await vi.runAllTimersAsync();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(g.wrap(fail)).toBe(g.wrap(fail));
  });
});
