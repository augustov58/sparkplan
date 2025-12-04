# ADR-003: Supabase Real-Time for State Management

**Status**: Accepted
**Date**: 2025-12-03
**Decision Makers**: Development Team

---

## Context

**Problem**: How should the application manage global state for projects, panels, circuits, and other electrical design data?

**Requirements**:
- Data must persist across page refreshes
- Multiple browser tabs must stay synchronized
- Changes by one user should be visible to collaborators (future multi-user)
- Simple developer experience

**Traditional approaches**:
1. Redux/Zustand for global state + localStorage for persistence
2. Context API for global state + manual sync
3. Database-first with real-time subscriptions (chosen)

---

## Decision

**Use Supabase PostgreSQL as the single source of truth, with real-time WebSocket subscriptions to keep React state synchronized.**

**Architecture**:
```
┌──────────────────────────────────────────┐
│  Supabase PostgreSQL (Source of Truth)  │
│  - projects, panels, circuits, etc.      │
└────────────┬─────────────────────────────┘
             │
             │ WebSocket Subscription
             │ (postgres_changes events)
             │
             ↓
┌──────────────────────────────────────────┐
│  React Components                        │
│  - useState for local cache              │
│  - useEffect for subscription setup      │
│  - Render data from local state          │
└──────────────────────────────────────────┘
```

**No Redux. No Zustand. No Context (except ProjectWrapper).**

---

## Alternatives Considered

### Option A: Redux + Redux Persist
**Description**: Use Redux Toolkit for global state, persist to localStorage

**Pros**:
- ✅ Mature ecosystem
- ✅ Powerful DevTools
- ✅ Time-travel debugging
- ✅ Centralized state updates

**Cons**:
- ❌ Significant boilerplate (actions, reducers, slices)
- ❌ Data still needs to sync with database (double source of truth)
- ❌ localStorage conflicts if multiple tabs write simultaneously
- ❌ Large bundle size (+30KB gzipped)
- ❌ Redux Persist adds complexity (migrations, version management)

**Why rejected**: Over-engineered. We need database sync anyway, so why maintain two sources of truth?

### Option B: Zustand + Persist Middleware
**Description**: Use Zustand for simpler global state management

**Pros**:
- ✅ Simpler than Redux
- ✅ Smaller bundle (+5KB gzipped)
- ✅ No boilerplate

**Cons**:
- ❌ Same fundamental issue: Still need database sync
- ❌ localStorage still has multi-tab race conditions
- ❌ Adds layer between database and UI (indirection)

**Why rejected**: Simpler than Redux, but still solves wrong problem.

### Option C: React Context API
**Description**: Use Context for global state, manually fetch from database

**Pros**:
- ✅ Built into React (no dependencies)
- ✅ Simple mental model

**Cons**:
- ❌ Manual synchronization logic required
- ❌ Re-renders entire subtree on state change (performance issue)
- ❌ No built-in persistence or real-time sync

**Why rejected**: Not designed for frequently-changing data.

### Option D: Firebase Realtime Database
**Description**: Use Firebase instead of Supabase

**Pros**:
- ✅ Real-time sync built-in
- ✅ Offline support

**Cons**:
- ❌ NoSQL document store (SQL more natural for relational data)
- ❌ Vendor lock-in (proprietary)
- ❌ More expensive at scale
- ❌ Weaker query capabilities than PostgreSQL

**Why rejected**: PostgreSQL better fit for structured electrical design data.

---

## Consequences

### Positive Consequences
- ✅ **Single source of truth**: PostgreSQL database is canonical state
- ✅ **Multi-tab sync automatic**: WebSocket broadcasts changes to all tabs
- ✅ **Simple mental model**: If it's in database, it's in UI (eventually consistent)
- ✅ **No serialization issues**: Database types match TypeScript types
- ✅ **Collaboration-ready**: Real-time sync enables future multi-user features
- ✅ **Zero bundle size cost**: No state management library needed

### Negative Consequences
- ❌ **Network dependency**: App useless without internet (no offline mode)
- ❌ **Eventual consistency**: Brief delay (50-200ms) before UI updates
- ❌ **More database queries**: Fetch data per route (no global cache)
- ❌ **Subscription overhead**: WebSocket connection per resource type

### Neutral Consequences
- ℹ️ **Database-first mindset**: Developers must think "database schema" before "React state"
- ℹ️ **RLS policies critical**: Row Level Security is security boundary (not React)

---

## Implementation Notes

**Subscription pattern used throughout app**:

```typescript
useEffect(() => {
  // 1. Fetch initial data
  fetchData();

  // 2. Subscribe to real-time changes
  const subscription = supabase
    .channel(`resource_${projectId}`)
    .on(
      'postgres_changes',
      {
        event: '*',  // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'table_name',
        filter: `project_id=eq.${projectId}`  // Only this project
      },
      (payload) => {
        console.log('Database change:', payload);
        fetchData();  // Refetch to get latest
      }
    )
    .subscribe();

  // 3. Cleanup on unmount
  return () => {
    subscription.unsubscribe();
  };
}, [projectId]);
```

**Components using this pattern**:
- `Dashboard.tsx` - Subscribes to projects
- `CircuitDesign.tsx` - Subscribes to panels, transformers, circuits
- `LoadCalculator.tsx` - Subscribes to load entries
- `GroundingBonding.tsx` - Subscribes to grounding details
- `InspectionChecklist.tsx` - Subscribes to inspection items

**Database tables with real-time subscriptions**:
- `projects` (global)
- `panels` (per project)
- `circuits` (per project)
- `transformers` (per project)
- `loads` (per project)
- `grounding_details` (per project)
- `inspection_items` (per project)

---

## Compliance & Standards

**Supabase best practices**:
- Filter subscriptions by `project_id` for performance
- Unsubscribe on component unmount (avoid memory leaks)
- Use RLS policies for security (subscriptions respect RLS)

**React patterns**:
- Subscriptions in `useEffect` with cleanup
- Local state (`useState`) caches database data
- Re-render triggered by `setState` after subscription event

---

## Monitoring & Validation

**Metrics to track**:
- WebSocket connection stability (target: 99.9% uptime)
- Average sync latency (target: <200ms)
- Database query count (ensure efficient fetching)

**Success criteria**:
- ✅ Multi-tab sync works reliably
- ✅ No "data disappeared" bugs
- ✅ Real-time updates feel instant

**Review date**: 2026-06-01 (re-evaluate if offline support becomes requirement)

---

## References

- [Supabase real-time subscriptions](https://supabase.com/docs/guides/realtime/subscriptions)
- [Why not Redux? (Dan Abramov)](https://medium.com/@dan_abramov/you-might-not-need-redux-be46360cf367)
- [Database-first architecture](https://www.scattered-thoughts.net/writing/database-as-frontend-framework/)

---

## Notes

**Trade-off accepted**: No offline support. For our use case (professional SaaS tool with reliable internet), this is acceptable. Offline-first architecture (CRDT, local-first sync) would add significant complexity for marginal benefit.

**Future consideration**: If offline support becomes critical, consider:
1. Supabase local storage + sync (experimental)
2. PGlite (PostgreSQL in browser via WASM)
3. Electric SQL (PostgreSQL sync engine)

**Current verdict**: Database-first working excellently, no need to change.
