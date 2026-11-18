import { useRef } from 'react';

/**
 * Keeps a list hook's realtime refetches from undoing its optimistic writes (#234).
 *
 * The data hooks refetch the whole list on every realtime event and change
 * local state optimistically before each write. A fetch that started before
 * (or during) a write can return after it with the old rows — a deleted row
 * comes back and stays until something refetches again.
 *
 * - `fetch`: take `token()` when it starts; if `stale(token)` when it returns,
 *   drop the result.
 * - mutations: return them through `wrap()`. A wrapped call marks a write in
 *   flight; when the last one settles, the list is refetched once (so it
 *   converges even if the realtime event is late or lost).
 */
export class FetchGuard {
  private seq = 0;
  private inFlight = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private wrapped = new WeakMap<object, unknown>();
  /** The hook's fetch, assigned each render. */
  refetch: () => unknown = () => undefined;

  token(): number {
    return this.seq;
  }

  /** True when a local write began, ended or is running since `token` was taken. */
  stale(token: number): boolean {
    return token !== this.seq || this.inFlight > 0;
  }

  begin(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.seq++;
    this.inFlight++;
  }

  end(): void {
    this.seq++;
    this.inFlight = Math.max(0, this.inFlight - 1);
    if (this.inFlight > 0) return;
    // One refetch after a burst of writes (a loop of creates refetches once)
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.refetch(); }, 0);
  }

  /** The same wrapper for the same function, so a memoized mutation stays stable. */
  wrap<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
    const cached = this.wrapped.get(fn);
    if (cached) return cached as (...args: A) => Promise<R>;
    const guarded = async (...args: A): Promise<R> => {
      this.begin();
      try {
        return await fn(...args);
      } finally {
        this.end();
      }
    };
    this.wrapped.set(fn, guarded);
    return guarded;
  }
}

/** One FetchGuard per hook instance. */
export function useFetchGuard(): FetchGuard {
  const ref = useRef<FetchGuard | null>(null);
  if (!ref.current) ref.current = new FetchGuard();
  return ref.current;
}
