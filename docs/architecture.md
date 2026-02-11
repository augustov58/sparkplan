# Software Architecture Documentation
## SparkPlan Application

**Last Updated**: 2026-01-15
**Version**: 1.0
**Technology Stack**: React 19.2.0 + TypeScript 5.8.3 + Supabase + Vite 6.4.1

---

## Table of Contents

1. [Overview](#overview)
2. [State Management Strategy](#state-management-strategy)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Component Architecture](#component-architecture)
5. [Routing Architecture](#routing-architecture)
6. [Custom Hooks Pattern](#custom-hooks-pattern)
7. [Error Handling Patterns](#error-handling-patterns)
8. [Performance Strategy](#performance-strategy)

---

## Overview

SparkPlan is a **database-first SaaS application** built on Supabase PostgreSQL with real-time synchronization. The architecture prioritizes:

1. **Data persistence** - All state lives in Supabase, not React
2. **Real-time collaboration** - Changes sync across browser tabs via WebSocket subscriptions
3. **Optimistic UI** - Immediate user feedback before database confirmation
4. **Type safety** - Strict TypeScript with auto-generated database types
5. **NEC compliance** - Professionally accurate electrical calculations

### Key Architectural Decisions

- **No Redux/Zustand** - Supabase real-time subscriptions provide state sync
- **No React Query** - Custom hooks optimized for Supabase patterns
- **No global state** - Data fetched per route, shared via React Context when needed
- **Database-first** - PostgreSQL is source of truth, React is view layer

---

## State Management Strategy

### Philosophy: Database as Single Source of Truth

**Core Principle**: React state is ephemeral; database is permanent.

```
┌─────────────────────────────────────────┐
│     Supabase PostgreSQL Database        │  ← SINGLE SOURCE OF TRUTH
│  (Projects, Panels, Circuits, etc.)     │
└──────────────┬──────────────────────────┘
               │
               │ Real-time WebSocket Subscription
               │ (postgres_changes events)
               │
               ↓
┌─────────────────────────────────────────┐
│    Custom React Hooks                   │
│  (usePanels, useCircuits, etc.)         │
│  - Fetches data on mount                │
│  - Subscribes to real-time changes      │
│  - Provides CRUD operations             │
└──────────────┬──────────────────────────┘
               │
               │ Data + Operations
               │
               ↓
┌─────────────────────────────────────────┐
│    React Components                     │
│  - Render data                          │
│  - Call hook operations (create/update) │
│  - React to real-time updates           │
└─────────────────────────────────────────┘
```

### Why Not Redux/Zustand?

**Problem Redux/Zustand solve**: Centralized state management, avoiding props drilling

**Why we don't need them**:
1. **Data already centralized** - PostgreSQL is our "Redux store"
2. **Real-time sync built-in** - Supabase subscriptions handle state updates
3. **No props drilling** - Each route fetches its own data via hooks
4. **Reduced complexity** - No action creators, reducers, selectors

**Trade-off**: More network requests (fetch data per route) vs simpler mental model

### Why Not React Query?

**Problem React Query solves**: Data fetching, caching, synchronization, background refetching

**Why we don't need it**:
1. **Real-time subscriptions** - Database pushes changes, no polling needed
2. **Optimistic updates** - Custom hooks implement optimistic pattern
3. **Simple cache strategy** - Fetch on mount, subscription keeps fresh
4. **Supabase-specific** - React Query not optimized for real-time subscriptions

**Trade-off**: Manual subscription management vs automatic React Query caching

### Optimistic Updates Pattern

**Goal**: Instant UI feedback without waiting for database round-trip

**Implementation**:
```typescript
const createPanel = async (panel: Omit<Panel, 'id'>) => {
  // 1. OPTIMISTIC: Update local state immediately
  const tempPanel = { ...panel, id: nanoid() };  // Temporary ID
  setPanels(prev => [...prev, tempPanel]);

  // 2. ASYNC: Insert to database
  const { error } = await supabase.from('panels').insert(panel);

  // 3. REAL-TIME: Subscription refetches (overwrites optimistic update)
  // No explicit code needed - subscription fires automatically
};
```

**Benefits**:
- ✅ Perceived instant response (200-500ms network latency hidden)
- ✅ Works even if database insert is slow
- ✅ Self-correcting (real-time subscription overwrites with server truth)

**Trade-offs**:
- ❌ Brief inconsistency if insert fails (user sees item, then disappears)
- ❌ Temporary ID differs from final database ID
- ⚠️ Mitigation: Real-time subscription refetch resolves within 50-200ms

### Real-Time Synchronization

**Mechanism**: Supabase WebSocket subscriptions to `postgres_changes` events

**Example**:
```typescript
useEffect(() => {
  const subscription = supabase
    .channel(`panels_${projectId}`)  // Unique channel per project
    .on(
      'postgres_changes',
      {
        event: '*',                  // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'panels',
        filter: `project_id=eq.${projectId}`  // Only this project's panels
      },
      (payload) => {
        console.log('Database change detected:', payload);
        fetchPanels();  // Re-fetch to get latest data
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();  // Cleanup on unmount
  };
}, [projectId]);
```

**How it works**:
1. Component mounts → Custom hook establishes subscription
2. User A creates panel → INSERT into database
3. Database triggers `postgres_changes` event
4. Supabase broadcasts event to all subscribed clients (User A, User B, etc.)
5. Each client's hook calls `fetchPanels()` to refetch
6. All UIs update with new panel (multi-tab sync)

**Latency**: 50-200ms for other tabs/users to see changes

**Conflict Resolution**: Last write wins (PostgreSQL timestamp order)

---

## Data Flow Architecture

### Read Path (Database → UI)

```
┌──────────────┐
│   Component  │
│    Mounts    │
└──────┬───────┘
       │
       ↓
┌──────────────────────────────────────┐
│  Custom Hook (e.g., usePanels)       │
│  - useState for local state          │
│  - useEffect to fetch on mount       │
└──────┬───────────────────────────────┘
       │
       ↓ fetchPanels()
┌──────────────────────────────────────┐
│  Supabase Client Query               │
│  const { data } = await supabase     │
│    .from('panels')                   │
│    .select('*')                      │
│    .eq('project_id', projectId)      │
└──────┬───────────────────────────────┘
       │
       ↓ PostgreSQL query
┌──────────────────────────────────────┐
│  Supabase PostgreSQL Database        │
│  - RLS policies filter by user_id    │
│  - Returns only user's panels        │
└──────┬───────────────────────────────┘
       │
       ↓ data array
┌──────────────────────────────────────┐
│  Hook sets state                     │
│  setPanels(data || [])               │
└──────┬───────────────────────────────┘
       │
       ↓ Re-render triggered
┌──────────────────────────────────────┐
│  Component Re-renders                │
│  - Displays panels from hook.data    │
│  - loading=false, error=null         │
└──────────────────────────────────────┘
```

### Write Path (UI → Database → Real-Time Sync)

```
┌──────────────┐
│     User     │
│    Action    │  (e.g., "Create Panel" button click)
└──────┬───────┘
       │
       ↓ createPanel(newPanel)
┌───────────────────────────────────────┐
│  Custom Hook Function                 │
│  1. Optimistic: setPanels([...prev])  │
│  2. Async: supabase.insert()          │
└──────┬────────────────────────────────┘
       │
       ↓ UI updates immediately (optimistic)
┌───────────────────────────────────────┐
│  Component Re-renders                 │
│  - Shows new panel instantly          │
│  - Still waiting for DB confirmation  │
└───────────────────────────────────────┘
       │
       │ (parallel async path)
       ↓
┌───────────────────────────────────────┐
│  Supabase Database Insert             │
│  - Validates data                     │
│  - Checks RLS policies                │
│  - Inserts row with UUID              │
│  - Returns { data, error }            │
└──────┬────────────────────────────────┘
       │
       ↓ postgres_changes event triggered
┌───────────────────────────────────────┐
│  Supabase Broadcasts Event            │
│  - Sends to ALL subscribed clients    │
│  - Includes User A (creator)          │
│  - Includes User B (other tab/user)   │
└──────┬────────────────────────────────┘
       │
       ↓ subscription callback fires
┌───────────────────────────────────────┐
│  All Hooks Call fetchPanels()         │
│  - User A: Overwrites optimistic data │
│  - User B: Receives new panel         │
│  - Temp ID replaced with real UUID    │
└──────┬────────────────────────────────┘
       │
       ↓
┌───────────────────────────────────────┐
│  All UIs Update Simultaneously        │
│  - Multi-tab sync complete (50-200ms) │
│  - Database UUID now displayed        │
└───────────────────────────────────────┘
```

### Multi-Tab Synchronization

**Scenario**: User has SparkPlan open in 2 browser tabs

**Flow**:
1. **Tab 1**: User creates panel
2. **Tab 1**: Optimistic update shows panel immediately
3. **Database**: INSERT completes (150ms)
4. **Supabase**: Broadcasts `postgres_changes` event
5. **Tab 1**: Subscription refetches (replaces optimistic with real data)
6. **Tab 2**: Subscription refetches (receives new panel)
7. **Result**: Both tabs show identical data (synchronized)

**Conflict Scenario**:
1. **Tab 1 & Tab 2**: User edits same panel simultaneously
2. **Database**: Both UPDATEs arrive (Tab 1 at T=100ms, Tab 2 at T=120ms)
3. **PostgreSQL**: Last write wins (Tab 2 overwrites Tab 1)
4. **Supabase**: Broadcasts final UPDATE event
5. **Both Tabs**: Refetch, see Tab 2's changes
6. **Tab 1 User**: Sees their changes overwritten (expected behavior - last write wins)

### Cross-Component Synchronization (Custom Events)

**Added**: January 15, 2026

**Problem**: Components using the same data hook don't automatically sync when one updates data. Supabase real-time handles cross-tab sync, but same-tab cross-component sync requires additional logic.

**Solution**: Browser CustomEvents for intra-application communication.

**Example**: When FeederManager creates a feeder, OneLineDiagram needs to refresh.

**Implementation in `useFeeders.ts`**:
```typescript
const FEEDER_UPDATE_EVENT = 'feeder-data-updated';

// Emit after mutations
const emitFeederUpdate = useCallback(() => {
  window.dispatchEvent(new CustomEvent(FEEDER_UPDATE_EVENT, {
    detail: { projectId }
  }));
}, [projectId]);

// Listen in useEffect
useEffect(() => {
  const handleFeederUpdate = (event: Event) => {
    const customEvent = event as CustomEvent<{ projectId: string }>;
    if (customEvent.detail.projectId === projectId) {
      fetchFeeders();
    }
  };
  window.addEventListener(FEEDER_UPDATE_EVENT, handleFeederUpdate);
  return () => window.removeEventListener(FEEDER_UPDATE_EVENT, handleFeederUpdate);
}, [projectId, fetchFeeders]);
```

**Why Not Use Global State?**
- ✅ No additional dependencies (Redux, Zustand, Jotai)
- ✅ Works with existing hook-based architecture
- ✅ Lightweight (DOM events are native)
- ✅ Components remain self-contained
- ❌ Requires manual setup in each hook

**Currently Implemented**:
- `useFeeders.ts` - `feeder-data-updated` event

---

## Component Architecture

### Principles

1. **Feature-based organization** - Components grouped by feature, not type
2. **No atomic design** - No `/components/ui/Button/` directory
3. **Self-contained** - Each component manages its own state and logic
4. **Data via hooks** - Components fetch data via custom hooks, not props
5. **Presentational separation** - Large components may split presentational parts

### Component Types

#### Container Components
**Responsibility**: Data fetching, state management, side effects

**Example**: `CircuitDesign.tsx`
```typescript
export default function CircuitDesign() {
  const { projectId } = useParams();
  const { panels, loading, createPanel } = usePanels(projectId);
  const { transformers } = useTransformers(projectId);
  const { circuits, createCircuit } = useCircuits(projectId);

  // Business logic
  const handleCreatePanel = async (data) => {
    await createPanel(data);
  };

  return (
    <div>
      <PanelList panels={panels} />
      <OneLineDiagram panels={panels} transformers={transformers} />
      <CircuitEditor circuits={circuits} onCreate={createCircuit} />
    </div>
  );
}
```

#### Presentational Components
**Responsibility**: Render UI, emit events via callbacks

**Example**: `PanelList.tsx`
```typescript
interface PanelListProps {
  panels: Panel[];
  onSelect?: (panel: Panel) => void;
}

export default function PanelList({ panels, onSelect }: PanelListProps) {
  return (
    <div>
      {panels.map(panel => (
        <div key={panel.id} onClick={() => onSelect?.(panel)}>
          {panel.name} - {panel.voltage}V {panel.phase}φ
        </div>
      ))}
    </div>
  );
}
```

### When to Split Components

**Heuristics**:
1. **File size > 500 lines** - Consider extracting sections
2. **Multiple concerns** - If handling >2 responsibilities, split
3. **Reusability** - If same UI pattern used elsewhere, extract
4. **Performance** - If expensive rendering, extract and memoize

**Exception**: `OneLineDiagram.tsx` (~3,342 lines) - Justified monolith

**Why OneLineDiagram.tsx is ~3,342 lines**:
- **Tightly coupled logic**: SVG rendering directly tied to electrical hierarchy traversal
- **Performance**: Avoids 10+ levels of props drilling (X/Y coordinates, colors, line styles)
- **Debugging**: All diagram logic in one place (easier to trace rendering bugs)
- **Rare changes**: Diagram format is stable (IEEE Std 315), infrequent modifications

**When to refactor OneLineDiagram.tsx**:
- If we add another diagram type (riser diagram, panel schedule diagram)
- Then extract shared logic to `/lib/electrical/diagramRenderer.ts`
- Each diagram type becomes thin wrapper around core renderer

### Props Drilling vs Context

**Current Strategy**: Avoid Context, prefer props drilling

**Rationale**:
- Most components shallow (2-3 levels)
- Context adds indirection (harder to trace data flow)
- TypeScript autocomplete works better with props

**Exception**: `ProjectWrapper` uses Context to provide `project` to nested routes

**When to use Context**:
- Data needed by 5+ levels of nested components
- Data changes infrequently (project settings, theme, auth user)
- Multiple sibling components need same data

---

## Routing Architecture

### Router Choice: HashRouter

**Decision**: Use `HashRouter` instead of `BrowserRouter`

**Rationale**:
```typescript
// HashRouter - URLs look like: https://example.com/#/project/123
<HashRouter>
  <Routes>
    <Route path="/project/:id" element={<ProjectWrapper />} />
  </Routes>
</HashRouter>
```

**Why HashRouter**:
- ✅ **GitHub Pages compatibility** - No server-side routing required
- ✅ **Static deployment** - Works with any static host (Netlify, Vercel)
- ✅ **No 404 issues** - Hash routes handled client-side

**Trade-offs**:
- ❌ **Ugly URLs** - `#` in URL (cosmetic issue)
- ❌ **SEO impact** - Google ignores hash fragments (not relevant for auth-protected SaaS)

**Alternative considered**: `BrowserRouter` with server rewrites
**Why rejected**: Adds deployment complexity, not worth it for internal tool

### Routing Structure

**Two-tier routing**:

```typescript
// Top-level routes (App.tsx)
<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/project/:id/*" element={<ProjectWrapper />} />
</Routes>

// Nested project routes (ProjectWrapper component)
<Routes>
  <Route path="overview" element={<ProjectOverview project={project} />} />
  <Route path="load-calc" element={<LoadCalculator project={project} />} />
  <Route path="circuits" element={<CircuitDesign project={project} />} />
  <Route path="grounding" element={<GroundingBonding project={project} />} />
  <Route path="inspection" element={<InspectionChecklist project={project} />} />
</Routes>
```

**Why two-tier**:
1. **Data fetching boundary** - `ProjectWrapper` fetches project once, passes to all sub-routes
2. **Shared layout** - Project header/sidebar shared across sub-routes
3. **URL structure** - Clean paths like `/project/abc123/circuits`

### ProjectWrapper Pattern

**Purpose**: Extract `projectId` from URL, fetch project, provide to nested routes

**Implementation**:
```typescript
export function ProjectWrapper() {
  const { id } = useParams<{ id: string }>();
  const { projects, loading } = useProjects();

  const project = projects.find(p => p.id === id);

  if (loading) return <div>Loading...</div>;
  if (!project) return <div>Project not found</div>;

  return (
    <ProjectContext.Provider value={project}>
      <Routes>
        <Route path="overview" element={<ProjectOverview />} />
        {/* ... more routes */}
      </Routes>
    </ProjectContext.Provider>
  );
}
```

**Benefits**:
- Single project fetch (not re-fetched on sub-route navigation)
- Type-safe project access via Context
- Centralized loading/error handling

---

## Custom Hooks Pattern

### Philosophy: Custom Hooks for All Data Operations

**Why custom hooks**:
1. **Encapsulation** - Data fetching logic separate from UI
2. **Reusability** - Multiple components can use same data
3. **Type safety** - TypeScript infers return types automatically
4. **Testability** - Hooks testable in isolation (no UI needed)

### Standard Hook Interface

All data hooks follow this pattern:

```typescript
interface UseResourceReturn<T> {
  data: T[];                  // Resource array
  loading: boolean;           // Initial fetch loading state
  error: string | null;       // Error message
  create: (item: Omit<T, 'id'>) => Promise<void>;
  update: (id: string, item: Partial<T>) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
}

function useResource<T>(projectId?: string): UseResourceReturn<T> {
  // Implementation
}
```

**Naming convention**: `use<Resource>` (e.g., `usePanels`, `useCircuits`)

**Return value naming**: Plural for data, singular for operations

### Example: usePanels Hook

**Full implementation breakdown**:

```typescript
export function usePanels(projectId: string | undefined) {
  // 1. LOCAL STATE
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2. FETCH FUNCTION
  const fetchPanels = async () => {
    if (!projectId) return;

    const { data, error: fetchError } = await supabase
      .from('panels')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setPanels(data || []);
      setError(null);
    }
    setLoading(false);
  };

  // 3. INITIAL FETCH + SUBSCRIPTION
  useEffect(() => {
    fetchPanels();  // Fetch on mount

    // Real-time subscription
    const subscription = supabase
      .channel(`panels_${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'panels',
        filter: `project_id=eq.${projectId}`
      }, () => {
        fetchPanels();  // Refetch when changes detected
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();  // Cleanup
    };
  }, [projectId]);

  // 4. CREATE OPERATION (Optimistic)
  const createPanel = async (panel: Omit<Panel, 'id'>) => {
    // Optimistic update
    const tempPanel = { ...panel, id: nanoid() } as Panel;
    setPanels(prev => [...prev, tempPanel]);

    // Async insert
    const { error: insertError } = await supabase
      .from('panels')
      .insert(panel);

    if (insertError) {
      setError(insertError.message);
      // Real-time subscription will correct optimistic update
    }
  };

  // 5. UPDATE OPERATION (Optimistic)
  const updatePanel = async (id: string, updates: Partial<Panel>) => {
    // Optimistic update
    setPanels(prev => prev.map(p =>
      p.id === id ? { ...p, ...updates } : p
    ));

    // Async update
    const { error: updateError } = await supabase
      .from('panels')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
    }
  };

  // 6. DELETE OPERATION (Optimistic)
  const deletePanel = async (id: string) => {
    // Optimistic update
    setPanels(prev => prev.filter(p => p.id !== id));

    // Async delete
    const { error: deleteError } = await supabase
      .from('panels')
      .eq('id', id)
      .delete();

    if (deleteError) {
      setError(deleteError.message);
      fetchPanels();  // Revert on error
    }
  };

  // 7. RETURN INTERFACE
  return {
    panels,
    loading,
    error,
    createPanel,
    updatePanel,
    deletePanel
  };
}
```

### Subscription Lifecycle

**Mount**:
1. Component mounts → Hook called
2. `useEffect` runs → `fetchPanels()` called
3. `useEffect` runs → Subscription established

**Database Change**:
1. Any client modifies data (INSERT/UPDATE/DELETE)
2. PostgreSQL triggers event
3. Supabase broadcasts to all subscribed clients
4. `on('postgres_changes')` callback fires
5. `fetchPanels()` re-runs
6. `setPanels(newData)` triggers re-render

**Unmount**:
1. Component unmounts
2. `useEffect` cleanup function runs
3. `subscription.unsubscribe()` called
4. WebSocket closed (if no other subscriptions)

### Race Conditions and Mitigations

**Scenario 1: Slow insert + fast subscription**
```
T=0ms:   User clicks "Create Panel"
T=1ms:   Optimistic update (panel shows in UI)
T=50ms:  Database event (subscription fires, refetch starts)
T=200ms: INSERT completes
T=250ms: Refetch completes (panel now has real UUID)
```
**Result**: Works correctly, optimistic update overwritten by refetch

**Scenario 2: Failed insert**
```
T=0ms:   User clicks "Create Panel"
T=1ms:   Optimistic update (panel shows in UI)
T=200ms: INSERT fails (e.g., RLS policy violation)
T=201ms: No postgres_changes event (no insert happened)
```
**Problem**: Optimistic panel stays in UI (not corrected)
**Mitigation**: Next refetch removes it (happens on next DB change or component remount)
**Better solution**: Check `error` in hook, manually revert optimistic update

---

## Error Handling Patterns

### Current Strategy

**Philosophy**: Fail gracefully, show user-friendly errors, don't retry automatically

### Async Error Pattern

All async operations follow this pattern:

```typescript
const performOperation = async (data: Data) => {
  try {
    const { data: result, error: dbError } = await supabase
      .from('table')
      .insert(data);

    if (dbError) throw dbError;  // Supabase errors in `error` field

    setError(null);  // Clear previous errors
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    setError(message);  // Store error in state
    console.error('Operation failed:', err);  // Log for debugging
    // DO NOT retry automatically (user may have canceled intentionally)
  }
};
```

### Error State Management

**Pattern**: Each hook maintains its own error state

```typescript
const [error, setError] = useState<string | null>(null);

// On success
setError(null);

// On failure
setError(errorMessage);
```

**Display in UI**:
```typescript
{error && (
  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
    {error}
  </div>
)}
```

### Error Boundaries ✅ IMPLEMENTED

**Status**: Implemented (January 2025)

**Components**:
1. `ErrorBoundary` - Full-page fallback with reload options
2. `FeatureErrorBoundary` - Inline error UI for specific features

**Implementation** (`components/ErrorBoundary.tsx`):
```typescript
// Full-page error boundary
export class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}

// Feature-specific error boundary (inline)
export function FeatureErrorBoundary({ children, featureName }: FeatureProps) {
  return (
    <ErrorBoundary fallback={<FeatureErrorFallback featureName={featureName} />}>
      {children}
    </ErrorBoundary>
  );
}
```

**Usage in App.tsx**:
```typescript
<ErrorBoundary>
  <Routes>
    <Route path="/project/:id/circuits" element={
      <FeatureErrorBoundary featureName="Circuit Design">
        <CircuitDesign />
      </FeatureErrorBoundary>
    } />
  </Routes>
</ErrorBoundary>
```

**Benefits**:
- ✅ Prevents white screen of death
- ✅ User-friendly error messages
- ✅ Reload/retry options
- ✅ Dev mode shows error details

### Retry Logic

**Current Policy**: NO automatic retries

**Rationale**:
- User may have intentionally canceled action
- Network issues should be obvious (don't hide behind retries)
- Failed database writes usually indicate data issue (retrying won't fix)

**Manual retry**: User refreshes page or re-attempts action

### Logging Strategy

**Current**: Console logging only

```typescript
console.error('Failed to create panel:', error);
```

**Future**: External error tracking (Sentry, LogRocket)

---

## Performance Strategy

### Current Approach: React 19 Auto-Optimization

**Philosophy**: Avoid premature optimization, trust React 19 compiler

**React 19 Improvements**:
- Automatic memoization of components
- Optimized reconciliation algorithm
- Automatic batching of state updates

**Result**: No manual `React.memo`, `useMemo`, or `useCallback` needed for typical workloads

### Thresholds for Manual Optimization

**When to add React.memo**:
- Component render time > 100ms (measured via React DevTools Profiler)
- Component re-renders frequently but props rarely change
- Parent component updates often but child should stay static

**When to add useMemo**:
- Calculation time > 50ms (measured)
- Calculation result used in render
- Calculation inputs (dependencies) change infrequently

**When to add useCallback**:
- Function passed to memoized child component
- Function identity matters (e.g., used in useEffect dependencies)

### Bundle Size Strategy

**Current** (January 2026):
- Main bundle: **900 kB** (257 kB gzipped) ✅ Under target
- react-pdf chunk: **1,492 kB** (499 kB gzipped) - PDF export dependency
- Total: ~756 kB gzipped (excluding code-split chunks)

**Target**: <1000 kB gzipped for main bundle ✅ ACHIEVED

**Completed Optimizations**:
1. ✅ **Tailwind compiled locally** - No longer using CDN
2. ✅ **Tree shaking** - Vite handles automatically
3. ✅ **React 19 optimizations** - Automatic memoization improvements

**Known Large Dependencies**:
- `@react-pdf/renderer` - ~1.5 MB (required for PDF export feature)
- Consider lazy loading PDF export to reduce initial bundle

**Future Optimization**:
```typescript
// Lazy load PDF export (not yet implemented)
const PDFExport = React.lazy(() => import('./services/pdfExport'));
```

### Lazy Loading Strategy

**Current**: Route-level code splitting implemented

**Candidates for additional lazy loading**:
1. **PDF Export** - Only needed when user clicks export button
2. **OneLineDiagram** - Large component (~3,342 lines), used in Circuit Design
3. **Calculators** - Multiple calculators, could lazy load per tab

**Expected savings**: 20-30% faster initial page load if PDF export lazy loaded

### Performance Monitoring

**Current**: No performance monitoring

**Recommended**: Add React DevTools Profiler + Web Vitals

```typescript
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

onCLS(console.log);  // Cumulative Layout Shift
onFID(console.log);  // First Input Delay
onFCP(console.log);  // First Contentful Paint
onLCP(console.log);  // Largest Contentful Paint
onTTFB(console.log); // Time to First Byte
```

### SVG Rendering Performance

**OneLineDiagram.tsx rendering characteristics**:

**Typical project** (20 panels, 5 transformers):
- Render time: <50ms (measured in Chrome DevTools)
- SVG elements: ~100-150 (lines, rectangles, text)
- Re-render triggers: Panel/transformer CRUD, circuit updates

**Large project** (50+ panels):
- Render time: Estimated 100-200ms (not yet measured)
- SVG elements: 300-500
- **Potential issue**: Layout thrashing on resize

**Optimization if needed**:
1. **Virtualization** - Only render visible portion of diagram
2. **Canvas API** - Replace SVG with Canvas for >100 panels
3. **Web Workers** - Calculate positions in background thread

**Current verdict**: Performance adequate, no optimization needed yet

---

## Summary

This architecture prioritizes:

1. **Simplicity** - Database-first, minimal abstractions
2. **Real-time collaboration** - WebSocket subscriptions for multi-tab sync
3. **Type safety** - Strict TypeScript with auto-generated database types
4. **Developer experience** - Predictable patterns, minimal magic
5. **Professional accuracy** - NEC-compliant calculations (100% test coverage)

**Key Trade-offs Made**:
- ❌ More network requests (no global state cache) → ✅ Simpler mental model
- ❌ No automatic retries → ✅ Transparent error handling
- ❌ Optimistic updates can briefly show wrong data → ✅ Instant UI feedback
- ❌ Ugly URLs (hash router) → ✅ Simple deployment (static hosting)

**Completed Improvements**:
- ✅ Error Boundaries (prevents white screen crashes)
- ✅ Tailwind compiled locally (reduced bundle size)

**Future Improvements**:
- Add Sentry logging (production error tracking)
- Lazy load PDF export (reduce initial bundle)
- Add React Query (if real-time subscriptions prove problematic)
