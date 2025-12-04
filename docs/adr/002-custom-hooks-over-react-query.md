# ADR-002: Custom Hooks Over React Query

**Status**: Accepted
**Date**: 2025-12-03
**Decision Makers**: Development Team

---

## Context

The application needs a data fetching strategy for interacting with Supabase PostgreSQL. Standard options include:

1. **React Query** - Popular data fetching/caching library (43K GitHub stars)
2. **SWR** - Vercel's data fetching library (29K stars)
3. **Custom hooks** - Build our own using React hooks + Supabase client

**Requirements**:
- Fetch data on component mount
- Provide CRUD operations (create, read, update, delete)
- Real-time synchronization across browser tabs
- Type-safe integration with Supabase
- Simple mental model for team

**Existing pattern**: Supabase provides **real-time subscriptions** via WebSocket that push database changes to clients. This is fundamentally different from REST/GraphQL polling that React Query/SWR optimize for.

---

## Decision

**Build custom React hooks for all data operations, NOT React Query or SWR.**

**Pattern**:
```typescript
export function useResource(projectId?: string) {
  const [data, setData] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch on mount
  useEffect(() => {
    fetchData();

    // Real-time subscription
    const subscription = supabase
      .channel(`resource_${projectId}`)
      .on('postgres_changes', { ... }, fetchData)
      .subscribe();

    return () => subscription.unsubscribe();
  }, [projectId]);

  // CRUD operations
  const create = async (...) => { /* optimistic + insert */ };
  const update = async (...) => { /* optimistic + update */ };
  const del = async (...) => { /* optimistic + delete */ };

  return { data, loading, error, create, update, delete: del };
}
```

**All hooks follow this interface for consistency.**

---

## Alternatives Considered

### Option A: React Query
**Description**: Use `@tanstack/react-query` for data fetching and caching

**Pros**:
- ✅ Mature library with extensive features
- ✅ Automatic background refetching
- ✅ Request deduplication
- ✅ Optimistic updates built-in
- ✅ DevTools for debugging

**Cons**:
- ❌ **Polling-based**: React Query optimized for REST/GraphQL, not real-time push
- ❌ **Redundant with Supabase real-time**: We already have push notifications (subscriptions)
- ❌ **Added complexity**: Need to bridge React Query's cache with Supabase subscriptions
- ❌ **Bundle size**: +45KB (gzipped: ~13KB)
- ❌ **Learning curve**: Team needs to learn React Query concepts (stale time, cache time, etc.)

**Example issue**: React Query refetches on window focus. But Supabase subscriptions already push changes real-time. This creates redundant fetches.

**Why rejected**: Over-engineered for our use case. Supabase subscriptions provide 90% of React Query benefits with zero config.

### Option B: SWR
**Description**: Use Vercel's `swr` library for data fetching

**Pros**:
- ✅ Simpler than React Query
- ✅ Automatic revalidation
- ✅ Smaller bundle (+12KB gzipped)

**Cons**:
- ❌ Same fundamental issue: Optimized for polling, not push
- ❌ Still redundant with Supabase real-time
- ❌ Less feature-complete than React Query

**Why rejected**: Same rationale as React Query. Solves the wrong problem.

### Option C: Apollo Client (if using GraphQL)
**Description**: Use Apollo Client with Supabase GraphQL endpoint

**Pros**:
- ✅ GraphQL query flexibility
- ✅ Normalized cache

**Cons**:
- ❌ Supabase REST API simpler than GraphQL for our use case
- ❌ Massive bundle size (+150KB)
- ❌ Overkill complexity

**Why rejected**: We don't need GraphQL. REST + real-time subscriptions sufficient.

---

## Consequences

### Positive Consequences
- ✅ **Simple mental model**: One hook per resource, standard interface
- ✅ **Zero bundle size cost**: No external library (React hooks only)
- ✅ **Perfect Supabase integration**: Custom hooks designed for real-time subscriptions
- ✅ **No redundant fetches**: Subscription-based, not polling-based
- ✅ **Easy debugging**: Straightforward useEffect + subscription logic
- ✅ **Type safety**: Direct Supabase TypeScript types, no mapping layer

### Negative Consequences
- ❌ **Manual implementation**: Features like retry, deduplication not built-in
- ❌ **No DevTools**: React Query DevTools useful for debugging cache
- ❌ **Code duplication**: Each hook implements similar patterns (mitigated by consistent template)
- ❌ **No global cache**: Data refetched when component remounts (acceptable for our use case)

### Neutral Consequences
- ℹ️ **Team must learn Supabase patterns**: Instead of learning React Query
- ℹ️ **Less community examples**: React Query has more Stack Overflow answers

---

## Implementation Notes

**Hook template used across codebase**:

```typescript
// Template: /hooks/useResource.ts
export function useResource(projectId: string | undefined) {
  // 1. State management
  const [data, setData] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2. Fetch function
  const fetchData = async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('project_id', projectId);
    setData(data || []);
    setError(error?.message || null);
    setLoading(false);
  };

  // 3. Mount + subscription
  useEffect(() => {
    fetchData();
    const sub = supabase.channel(`table_${projectId}`)
      .on('postgres_changes', { ... }, fetchData)
      .subscribe();
    return () => sub.unsubscribe();
  }, [projectId]);

  // 4. CRUD operations (optimistic)
  const create = async (item) => { ... };
  const update = async (id, updates) => { ... };
  const del = async (id) => { ... };

  return { data, loading, error, create, update, delete: del };
}
```

**Files implementing custom hooks**:
- `/hooks/useProjects.ts` - 120 lines
- `/hooks/usePanels.ts` - 150 lines
- `/hooks/useCircuits.ts` - 140 lines
- `/hooks/useTransformers.ts` - 130 lines
- `/hooks/useLoads.ts` - 100 lines

**Total code**: ~640 lines (equivalent to React Query setup + custom hooks bridge)

---

## Compliance & Standards

**React patterns**:
- Follows React hooks best practices
- Custom hooks named with `use` prefix
- Cleanup functions in useEffect return

**Supabase patterns**:
- Uses Supabase recommended real-time subscription API
- Filters subscriptions by `project_id` for performance

---

## Monitoring & Validation

**Metrics to track**:
- Hook implementation consistency (% following template)
- Bundle size savings vs React Query baseline
- Developer time to add new hooks (target: <20 minutes)

**Success criteria**:
- ✅ All data hooks follow same interface
- ✅ No reported issues with data staleness
- ✅ Bundle size < 1MB gzipped

**Review date**: 2026-06-01 (if data fetching patterns prove problematic, reconsider React Query)

---

## References

- [Supabase real-time docs](https://supabase.com/docs/guides/realtime/subscriptions)
- [Custom hooks in React](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [When NOT to use React Query](https://tkdodo.eu/blog/when-not-to-use-react-query)

---

## Notes

**When to reconsider React Query**:
- If we add offline support (React Query + Persist plugin)
- If we add non-Supabase data sources (external APIs)
- If polling becomes necessary (background sync every N minutes)

**Current verdict**: Custom hooks working well, no need to change.
