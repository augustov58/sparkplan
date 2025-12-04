# ADR-001: Optimistic UI Updates with Real-Time Sync

**Status**: Accepted
**Date**: 2025-12-03
**Decision Makers**: Development Team

---

## Context

Users expect instant feedback when performing actions (creating panels, editing circuits, etc.). However, database operations over the network introduce latency:

- **Network round-trip**: 50-500ms depending on connection
- **Database processing**: 10-50ms for INSERT/UPDATE
- **Total perceived delay**: 60-550ms from click to UI update

**Without optimistic updates**, users experience:
- ❌ Button click → spinner → wait → finally see result (sluggish feel)
- ❌ Uncertainty whether action succeeded (did my click register?)
- ❌ Multiple clicks due to no immediate feedback (duplicate submissions)

**Alternative approaches**:
1. Wait for database confirmation (simple but slow)
2. Optimistic updates only (fast but inconsistent)
3. Optimistic updates + real-time sync (chosen)

---

## Decision

**Implement optimistic UI updates combined with Supabase real-time subscriptions.**

**Flow**:
1. User action → Update local React state immediately (optimistic)
2. Async database operation (INSERT/UPDATE/DELETE) in parallel
3. Real-time subscription refetches data on `postgres_changes` event
4. Local state overwritten with server truth (self-correcting)

**Implementation**:
```typescript
const createPanel = async (panel: Omit<Panel, 'id'>) => {
  // 1. OPTIMISTIC: Instant UI update
  const tempPanel = { ...panel, id: nanoid() };
  setPanels(prev => [...prev, tempPanel]);

  // 2. ASYNC: Database insert
  const { error } = await supabase.from('panels').insert(panel);

  // 3. REAL-TIME: Subscription fires, refetches (corrects optimistic data)
  // No explicit code needed - subscription handles it
};
```

---

## Alternatives Considered

### Option A: Wait for Database Confirmation
**Description**: Only update UI after database confirms success

**Pros**:
- ✅ Always shows accurate data
- ✅ Simple to reason about
- ✅ No rollback complexity

**Cons**:
- ❌ Perceived latency (200-500ms delay)
- ❌ Feels unresponsive
- ❌ User uncertainty ("did it work?")

**Why rejected**: User experience suffers. Modern apps feel instant.

### Option B: Optimistic Only (No Sync)
**Description**: Update local state, hope database succeeds

**Pros**:
- ✅ Instant UI feedback
- ✅ Simple implementation

**Cons**:
- ❌ If database fails, optimistic data persists (incorrect state)
- ❌ No multi-tab sync (tabs drift apart)
- ❌ Page refresh required to see truth

**Why rejected**: Data consistency issues. No collaboration support.

### Option C: Local-First Architecture (CRDT)
**Description**: Use Conflict-Free Replicated Data Types (e.g., Yjs, Automerge)

**Pros**:
- ✅ Offline-first capabilities
- ✅ Sophisticated conflict resolution
- ✅ Real-time collaboration

**Cons**:
- ❌ Significant complexity (steep learning curve)
- ❌ Large bundle size (100-300KB)
- ❌ Overkill for our use case (SaaS with reliable internet)

**Why rejected**: Over-engineered for needs. Supabase real-time sufficient.

---

## Consequences

### Positive Consequences
- ✅ **Instant user feedback**: Actions feel immediate (0-5ms perceived latency)
- ✅ **Multi-tab sync**: Changes appear across all tabs within 50-200ms
- ✅ **Self-correcting**: If optimistic update is wrong, subscription fixes it
- ✅ **Simple mental model**: Local state mirrors database, subscriptions keep in sync

### Negative Consequences
- ❌ **Brief inconsistency**: User sees temporary ID before database UUID arrives
- ❌ **Failed operations not obvious**: If INSERT fails, optimistic update stays until next subscription event
- ❌ **Subscription overhead**: WebSocket connection per project (negligible cost)

### Neutral Consequences
- ℹ️ **Requires real-time subscriptions**: Optimistic pattern depends on subscriptions for correction
- ℹ️ **Temporary IDs differ from final IDs**: Use `nanoid()` for temp, database provides UUID

---

## Implementation Notes

**All custom hooks follow this pattern**:

```typescript
// /hooks/usePanels.ts
const createPanel = async (panel: Omit<Panel, 'id'>) => {
  // Optimistic update
  const tempPanel = { ...panel, id: nanoid() } as Panel;
  setPanels(prev => [...prev, tempPanel]);

  // Async database operation
  const { error } = await supabase.from('panels').insert(panel);

  if (error) {
    setError(error.message);
    // Real-time subscription will still correct optimistic update
  }
};

// Subscription setup (in useEffect)
const subscription = supabase
  .channel(`panels_${projectId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'panels',
    filter: `project_id=eq.${projectId}`
  }, () => {
    fetchPanels();  // Refetch = overwrite optimistic with truth
  })
  .subscribe();
```

**Files implementing this pattern**:
- `/hooks/usePanels.ts` - Panel CRUD operations
- `/hooks/useCircuits.ts` - Circuit CRUD operations
- `/hooks/useTransformers.ts` - Transformer CRUD operations
- `/hooks/useProjects.ts` - Project CRUD operations

---

## Compliance & Standards

**React best practices**:
- Follows React 19 concurrent features
- Compatible with React Suspense (future enhancement)

**Supabase patterns**:
- Uses standard Supabase real-time subscriptions
- Follows Supabase docs recommendations

---

## Monitoring & Validation

**Metrics to track**:
- Perceived latency: Time from click to UI update (target: <10ms)
- Real-time sync latency: Time for other tabs to see changes (target: <200ms)
- Subscription reliability: % of changes that trigger subscription (target: 100%)

**Success criteria**:
- ✅ Users report "instant" feel
- ✅ No complaints about data disappearing (optimistic updates corrected)
- ✅ Multi-tab sync works reliably

**Review date**: 2026-06-01 (re-evaluate after 6 months production use)

---

## References

- [Optimistic UI patterns (React docs)](https://react.dev/reference/react-dom/hooks/useOptimistic)
- [Supabase real-time subscriptions](https://supabase.com/docs/guides/realtime)
- [When to use optimistic updates (Kent C. Dodds)](https://kentcdodds.com/blog/optimistic-ui-in-react)

---

## Notes

**Edge case - slow network**:
If database operation takes >2 seconds, user may see optimistic update for extended period. This is acceptable; subscription will eventually correct.

**Future enhancement**:
Consider using React 19 `useOptimistic` hook when stable (currently experimental).
