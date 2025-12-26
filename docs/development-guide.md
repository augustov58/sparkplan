# Development Guide
## NEC Pro Compliance Application

**Last Updated**: 2025-12-03
**For**: Developers, LLMs continuing development
**Prerequisites**: TypeScript, React, PostgreSQL basics

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Adding New Features](#adding-new-features)
3. [Working with Supabase](#working-with-supabase)
4. [Common Patterns](#common-patterns)
5. [TypeScript Conventions](#typescript-conventions)
6. [Common Pitfalls](#common-pitfalls)

---

## Project Structure

### Directory Organization

```
NEC-Compliance/
├── components/          # React UI components (feature-based)
│   ├── Calculators.tsx         # Voltage drop, conduit fill calculators
│   ├── CircuitDesign.tsx       # Main circuit design interface
│   ├── Dashboard.tsx           # Project list and overview
│   ├── GroundingBonding.tsx    # Grounding system validation
│   ├── InspectionChecklist.tsx # Pre-inspection checklist
│   ├── Layout.tsx              # App shell with sidebar navigation
│   ├── LoadCalculator.tsx      # NEC load calculation interface
│   ├── OneLineDiagram.tsx      # SVG electrical one-line diagram (1614 lines)
│   ├── ProjectOverview.tsx     # Project details and settings
│   └── FeederManager.tsx       # Feeder sizing tool (NEW)
│
├── hooks/               # Custom React hooks for data operations
│   ├── useProjects.ts   # Projects CRUD + real-time sync
│   ├── usePanels.ts     # Panels CRUD + hierarchy management
│   ├── useCircuits.ts   # Circuits CRUD + phase assignment
│   ├── useTransformers.ts  # Transformers CRUD + voltage tracking
│   └── useLoads.ts      # Load entries for load calculations
│
├── services/            # Business logic (no React dependencies)
│   ├── geminiService.ts         # Google Gemini AI integration
│   └── calculations/            # NEC calculation engines
│       ├── loadCalculation.ts   # NEC 220 load calculations
│       ├── conductorSizing.ts   # NEC 310 conductor ampacity
│       ├── voltageDrop.ts       # AC impedance voltage drop
│       ├── breakerSizing.ts     # NEC 240.6(A) standard breakers
│       └── feederSizing.ts      # NEC 215 feeder calculations
│
├── lib/                 # Utilities and generated types
│   ├── supabase.ts      # Supabase client initialization
│   └── database.types.ts  # Auto-generated from Supabase schema
│
├── data/nec/            # NEC reference tables (read-only data)
│   ├── table-220-42.ts  # Lighting demand factors
│   ├── table-220-55.ts  # Range/oven demand factors
│   ├── table-310-16.ts  # Conductor ampacity tables
│   ├── table-310-15-B-1.ts  # Temperature correction factors
│   ├── table-310-15-C-1.ts  # Bundling adjustment factors
│   ├── table-chapter-9-table-9.ts  # AC impedance data
│   └── standard-breakers.ts  # NEC 240.6(A) breaker sizes
│
├── types/               # TypeScript type definitions
│   ├── types.ts         # Frontend types (Project, Panel, Circuit, etc.)
│   └── nec-types.ts     # NEC-specific types (ConductorEntry, etc.)
│
├── tests/               # Unit and integration tests
│   ├── calculations.test.ts  # NEC calculation accuracy tests (11/11 passing)
│   └── examples/        # Test pattern examples for developers
│
├── supabase/            # Database migrations and schema
│   ├── schema.sql       # Complete database schema
│   └── migration-*.sql  # Individual migrations
│
├── docs/                # Documentation (this file!)
│   ├── architecture.md  # Software architecture patterns
│   ├── development-guide.md  # This file
│   ├── security.md      # Security architecture and vulnerabilities
│   ├── testing-strategy.md  # Testing patterns and guidelines
│   ├── deployment.md    # Build and deployment guide
│   ├── database-architecture.md  # Database schema rationale
│   ├── electrical-engineering-primer.md  # EE concepts for developers
│   └── adr/             # Architecture Decision Records
│
├── App.tsx              # Root component with routing
├── types.ts             # Global TypeScript types
├── index.css            # Global CSS styles
├── vite.config.ts       # Vite build configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

### File Naming Conventions

- **Components**: PascalCase (e.g., `LoadCalculator.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `usePanels.ts`)
- **Services**: camelCase (e.g., `conductorSizing.ts`)
- **Types**: camelCase (e.g., `types.ts`, `nec-types.ts`)
- **Tests**: `*.test.ts` or `*.test.tsx`

### Import Path Alias

**Alias**: `@/` maps to project root

```typescript
// ✅ CORRECT: Use path alias
import { supabase } from '@/lib/supabase';
import type { Panel } from '@/types';

// ❌ WRONG: Relative paths
import { supabase } from '../../../lib/supabase';
```

**Configuration**: Set in `vite.config.ts` and `tsconfig.json`

---

## Adding New Features

### Step-by-Step Workflow

#### Example: Adding a "Feeder Sizing" feature

**1. Define Frontend Types** (`/types.ts`)

```typescript
export interface Feeder {
  id: string;
  project_id: string;
  source_panel_id: string;
  destination_panel_id: string;
  breaker_amps: number;
  phase_conductor_size: string;  // e.g., "1/0 AWG"
  neutral_conductor_size: string;
  egc_size: string;  // Equipment Grounding Conductor
  conduit_size: string;
  length_feet: number;
  voltage_drop_percent: number;
  created_at: string;
}
```

**2. Create Database Migration** (`/supabase/migration-feeders.sql`)

```sql
-- Create feeders table
CREATE TABLE feeders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_panel_id UUID NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
  destination_panel_id UUID NOT NULL REFERENCES panels(id) ON DELETE CASCADE,
  breaker_amps INTEGER NOT NULL,
  phase_conductor_size TEXT NOT NULL,
  neutral_conductor_size TEXT NOT NULL,
  egc_size TEXT NOT NULL,
  conduit_size TEXT NOT NULL,
  length_feet NUMERIC NOT NULL,
  voltage_drop_percent NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE feeders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see feeders for their own projects
CREATE POLICY "Users see own feeders" ON feeders
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert feeders for their own projects
CREATE POLICY "Users create own feeders" ON feeders
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own feeders
CREATE POLICY "Users update own feeders" ON feeders
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete their own feeders
CREATE POLICY "Users delete own feeders" ON feeders
  FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX feeders_project_id_idx ON feeders(project_id);
CREATE INDEX feeders_source_panel_idx ON feeders(source_panel_id);
CREATE INDEX feeders_destination_panel_idx ON feeders(destination_panel_id);
```

**3. Run Migration in Supabase**
- Copy SQL to Supabase SQL Editor
- Click "Run"
- Verify table exists in Table Editor

**4. Create Custom Hook** (`/hooks/useFeeders.ts`)

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { nanoid } from 'nanoid';
import type { Feeder } from '@/types';

export function useFeeders(projectId: string | undefined) {
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeeders = async () => {
    if (!projectId) return;

    const { data, error: fetchError } = await supabase
      .from('feeders')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setFeeders(data || []);
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFeeders();

    const subscription = supabase
      .channel(`feeders_${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feeders',
        filter: `project_id=eq.${projectId}`
      }, () => {
        fetchFeeders();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const createFeeder = async (feeder: Omit<Feeder, 'id' | 'created_at'>) => {
    const tempFeeder = { ...feeder, id: nanoid(), created_at: new Date().toISOString() } as Feeder;
    setFeeders(prev => [...prev, tempFeeder]);

    const { error: insertError } = await supabase
      .from('feeders')
      .insert(feeder);

    if (insertError) {
      setError(insertError.message);
    }
  };

  const updateFeeder = async (id: string, updates: Partial<Feeder>) => {
    setFeeders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

    const { error: updateError } = await supabase
      .from('feeders')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
    }
  };

  const deleteFeeder = async (id: string) => {
    setFeeders(prev => prev.filter(f => f.id !== id));

    const { error: deleteError } = await supabase
      .from('feeders')
      .eq('id', id)
      .delete();

    if (deleteError) {
      setError(deleteError.message);
      fetchFeeders();
    }
  };

  return { feeders, loading, error, createFeeder, updateFeeder, deleteFeeder };
}
```

**5. Create Component** (`/components/FeederManager.tsx`)

```typescript
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFeeders } from '@/hooks/useFeeders';
import { usePanels } from '@/hooks/usePanels';

export default function FeederManager() {
  const { id: projectId } = useParams<{ id: string }>();
  const { feeders, loading, error, createFeeder } = useFeeders(projectId);
  const { panels } = usePanels(projectId);

  const [sourcePanelId, setSourcePanelId] = useState('');
  const [destPanelId, setDestPanelId] = useState('');

  const handleCreate = async () => {
    await createFeeder({
      project_id: projectId!,
      source_panel_id: sourcePanelId,
      destination_panel_id: destPanelId,
      breaker_amps: 100,
      phase_conductor_size: '1/0 AWG',
      neutral_conductor_size: '1/0 AWG',
      egc_size: '6 AWG',
      conduit_size: '1.25"',
      length_feet: 50,
      voltage_drop_percent: 2.1
    });
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Feeder Sizing</h1>

      <div className="space-y-4">
        <div>
          <label>Source Panel:</label>
          <select value={sourcePanelId} onChange={(e) => setSourcePanelId(e.target.value)}>
            {panels.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <button onClick={handleCreate}>Calculate Feeder</button>
      </div>

      <div className="mt-6">
        {feeders.map(feeder => (
          <div key={feeder.id} className="border p-4">
            {feeder.phase_conductor_size} phase conductors
          </div>
        ))}
      </div>
    </div>
  );
}
```

**6. Add Route in App.tsx**

```typescript
// In ProjectWrapper Routes (App.tsx line ~100)
<Route path="feeders" element={<FeederManager />} />
```

**7. Add Navigation Link in Layout.tsx**

```typescript
// In sidebar navigation (Layout.tsx line ~80)
<Link
  to={`/project/${projectId}/feeders`}
  className="flex items-center space-x-2"
>
  <Zap className="w-4 h-4" />
  <span>Feeders</span>
</Link>
```

**8. Write Tests** (`/tests/feederSizing.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';
import { calculateFeederSize } from '@/services/calculations/feederSizing';

describe('Feeder Sizing', () => {
  it('should size feeder conductors per NEC 215.2(A)(1)', () => {
    const result = calculateFeederSize({
      loadAmps: 80,
      continuousAmps: 50,
      voltage: 480,
      phase: 3,
      lengthFeet: 100,
      temperatureCelsius: 30
    });

    expect(result.breakerAmps).toBe(100);  // 80 * 1.25 = 100A
    expect(result.conductorSize).toBe('3 AWG');
  });
});
```

---

## Working with Supabase

### Database Schema Modifications

#### Adding a New Column

```sql
-- 1. Add column
ALTER TABLE panels ADD COLUMN main_breaker_amps INTEGER;

-- 2. Set default value for existing rows
UPDATE panels SET main_breaker_amps = 200 WHERE main_breaker_amps IS NULL;

-- 3. Make non-nullable (if required)
ALTER TABLE panels ALTER COLUMN main_breaker_amps SET NOT NULL;
```

#### Adding a Foreign Key

```sql
-- Add foreign key with cascading delete
ALTER TABLE circuits
ADD CONSTRAINT circuits_panel_id_fkey
FOREIGN KEY (panel_id)
REFERENCES panels(id)
ON DELETE CASCADE;  -- Delete circuits when panel deleted
```

#### Creating an Index

```sql
-- Speed up queries filtering by project_id
CREATE INDEX panels_project_id_idx ON panels(project_id);

-- Speed up join queries
CREATE INDEX circuits_panel_id_idx ON circuits(panel_id);
```

### RLS Policy Templates

#### Standard CRUD Policies

```sql
-- SELECT policy (read)
CREATE POLICY "Users see own resources" ON table_name
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- INSERT policy (create)
CREATE POLICY "Users create own resources" ON table_name
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy (modify)
CREATE POLICY "Users update own resources" ON table_name
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- DELETE policy (remove)
CREATE POLICY "Users delete own resources" ON table_name
  FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
```

### Real-Time Subscription Patterns

#### Basic Subscription

```typescript
useEffect(() => {
  const subscription = supabase
    .channel(`table_${projectId}`)
    .on('postgres_changes', {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'table_name',
      filter: `project_id=eq.${projectId}`
    }, (payload) => {
      console.log('Change detected:', payload);
      refetchData();
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, [projectId]);
```

#### Subscription to Specific Events

```typescript
// Listen only to INSERT events
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'panels'
}, (payload) => {
  const newPanel = payload.new as Panel;
  setPanels(prev => [...prev, newPanel]);
})

// Listen only to DELETE events
.on('postgres_changes', {
  event: 'DELETE',
  schema: 'public',
  table: 'panels'
}, (payload) => {
  const deletedId = payload.old.id;
  setPanels(prev => prev.filter(p => p.id !== deletedId));
})
```

### Type Generation (Regenerating `database.types.ts`)

**When to regenerate**:
- After adding/removing tables
- After adding/removing columns
- After changing column types

**How to regenerate**:
1. Go to Supabase Dashboard → Settings → API
2. Copy TypeScript types from "Generated Types" section
3. Paste into `/lib/database.types.ts`
4. TypeScript errors will guide necessary frontend updates

**Alternative**: Use Supabase CLI
```bash
npx supabase gen types typescript --project-id your-project-id > lib/database.types.ts
```

---

## Common Patterns

### Creating Calculation Services

**Pattern**: Pure functions, no React dependencies, 100% testable

**Template**:
```typescript
// /services/calculations/myCalculation.ts

/**
 * Calculates X per NEC Article YYY
 *
 * @param input - Input parameters
 * @returns Calculation result with NEC compliance details
 */
export function calculateMyThing(input: MyInput): MyOutput {
  // 1. VALIDATION
  if (input.value < 0) {
    throw new Error('Value must be positive');
  }

  // 2. NEC CALCULATION
  // NEC Article XXX.YY: Explanation of requirement
  const result = input.value * 1.25;  // 125% continuous load factor

  // 3. COMPLIANCE CHECK
  const isCompliant = result <= input.maxValue;

  // 4. RETURN STRUCTURED RESULT
  return {
    calculatedValue: result,
    isNecCompliant: isCompliant,
    necReference: 'NEC Article XXX.YY',
    warnings: isCompliant ? [] : ['Exceeds NEC limit']
  };
}
```

**Test**:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateMyThing } from './myCalculation';

describe('My Calculation', () => {
  it('should apply 125% factor per NEC', () => {
    const result = calculateMyThing({ value: 80, maxValue: 100 });
    expect(result.calculatedValue).toBe(100);  // 80 * 1.25
  });

  it('should detect NEC violations', () => {
    const result = calculateMyThing({ value: 100, maxValue: 100 });
    expect(result.isNecCompliant).toBe(false);  // 100 * 1.25 = 125 > 100
    expect(result.warnings).toHaveLength(1);
  });
});
```

### Adding AI Features (Gemini Integration)

**Pattern**: Add function to `geminiService.ts`

```typescript
// In /services/geminiService.ts

export async function validateMyFeature(data: MyData): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;

  if (!apiKey) {
    return "Gemini API key not configured. AI validation unavailable.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `${NEC_SYSTEM_INSTRUCTION}

Validate this electrical design:
${JSON.stringify(data, null, 2)}

Provide NEC compliance analysis and recommendations.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    return "AI validation failed. Check console for details.";
  }
}
```

**Usage in Component**:
```typescript
const handleAIValidation = async () => {
  setLoading(true);
  const validation = await validateMyFeature(myData);
  setAIResponse(validation);
  setLoading(false);
};
```

---

## TypeScript Conventions

### Interface vs Type

**Use `interface` for**:
- Object shapes (Panel, Circuit, Transformer)
- Types that may be extended (base interfaces)
- Types that will be implemented by classes

**Use `type` for**:
- Unions (`type Status = 'active' | 'inactive'`)
- Primitives (`type ID = string`)
- Utility types (`type PartialPanel = Partial<Panel>`)
- Mapped types, conditional types

**Rationale**: Interfaces provide better error messages in TypeScript

**Examples**:
```typescript
// ✅ CORRECT: Interface for object shape
export interface Panel {
  id: string;
  name: string;
  voltage: number;
}

// ✅ CORRECT: Type for union
export type ProjectType = 'residential' | 'commercial' | 'industrial';

// ✅ CORRECT: Type for utility type
export type CreatePanel = Omit<Panel, 'id' | 'created_at'>;
```

### Discriminated Unions

**Pattern**: Use for mutually exclusive fields

**Example**: Panel can be fed from service OR panel OR transformer (not multiple)

```typescript
export interface Panel {
  id: string;
  name: string;

  // Discriminated union for hierarchy
  fed_from_type: 'service' | 'panel' | 'transformer';  // Discriminator
  fed_from?: string;  // Panel ID (if fed_from_type = 'panel')
  fed_from_transformer_id?: string;  // Transformer ID (if fed_from_type = 'transformer')
}
```

**Type-safe usage**:
```typescript
function getPanelSource(panel: Panel): string {
  switch (panel.fed_from_type) {
    case 'service':
      return 'Service entrance';
    case 'panel':
      return `Panel ${panel.fed_from}`;  // TypeScript knows fed_from exists
    case 'transformer':
      return `Transformer ${panel.fed_from_transformer_id}`;
  }
}
```

### Optional Chaining Policy

**Use `?.` for**:
- User-provided data (may be null/undefined)
- External API responses
- Optional function parameters

**Avoid `?.` for**:
- Required database fields (Supabase types enforce non-null)
- After null checks

**Examples**:
```typescript
// ✅ CORRECT: User-provided optional field
const description = circuit.description?.trim() || 'No description';

// ✅ CORRECT: Optional callback prop
onUpdate?.(newValue);

// ❌ WRONG: Database field is non-nullable (Supabase type enforces)
const name = panel.name?.toUpperCase();  // Unnecessary ?.

// ✅ CORRECT: Database field is required
const name = panel.name.toUpperCase();  // Direct access
```

### Type Guards

**Pattern**: Runtime type checking for unknown data

```typescript
// Type guard function
export function isPanel(obj: unknown): obj is Panel {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'project_id' in obj &&
    'voltage' in obj &&
    typeof (obj as any).voltage === 'number'
  );
}

// Usage
const data: unknown = await fetchSomeData();
if (isPanel(data)) {
  // TypeScript now knows data is Panel
  console.log(data.voltage);  // ✅ Type-safe access
}
```

### Avoiding `any`

**Policy**: Avoid `any` except in justified cases

**Acceptable uses of `any`**:
1. **External SDK types incomplete** (Gemini AI response)
2. **Generic JSON storage** (Supabase `settings` JSONB column)
3. **Legacy code migration** (temporarily during refactor)

**Alternatives to `any`**:
```typescript
// ❌ WRONG
function process(data: any) { ... }

// ✅ BETTER: Use generic
function process<T>(data: T) { ... }

// ✅ BETTER: Use union
function process(data: Panel | Circuit | Transformer) { ... }

// ✅ BETTER: Use unknown + type guard
function process(data: unknown) {
  if (isPanel(data)) { ... }
}
```

---

## Common Pitfalls

### 1. Forgetting RLS Policies

**Problem**: Create table but forget RLS policies → Users can't see data

**Symptom**: Empty arrays returned, but rows exist in database

**Example**:
```sql
-- ❌ WRONG: RLS enabled but no policies
CREATE TABLE new_table (...);
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
-- OOPS: Forgot to add SELECT/INSERT/UPDATE/DELETE policies!
```

**Fix**: Always add all 4 policies (SELECT, INSERT, UPDATE, DELETE)

```sql
-- ✅ CORRECT: Full CRUD policies
CREATE POLICY "Users see own resources" ON new_table
  FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
-- ... repeat for INSERT, UPDATE, DELETE
```

**Debugging**: Check Supabase logs for "permission denied" errors

---

### 2. Not Filtering Subscriptions by Project

**Problem**: Subscription receives ALL changes, not just current project

**Symptom**: Component re-renders on changes to OTHER projects (performance issue)

**Example**:
```typescript
// ❌ WRONG: No filter - receives all panels from all projects
supabase
  .channel('panels')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'panels'
  }, () => { refetch(); })
  .subscribe();
```

**Fix**: Always filter by project_id

```typescript
// ✅ CORRECT: Filter by project_id
supabase
  .channel(`panels_${projectId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'panels',
    filter: `project_id=eq.${projectId}`  // Only this project
  }, () => { refetch(); })
  .subscribe();
```

---

### 3. Using React State for Derived Data

**Problem**: Store calculated values in state instead of deriving them

**Symptom**: State out of sync with source data (stale calculations)

**Example**:
```typescript
// ❌ WRONG: Store total in state
const [circuits, setCircuits] = useState([]);
const [totalLoad, setTotalLoad] = useState(0);

useEffect(() => {
  const total = circuits.reduce((sum, c) => sum + c.load, 0);
  setTotalLoad(total);  // Out of sync if circuits update
}, [circuits]);
```

**Fix**: Calculate on the fly

```typescript
// ✅ CORRECT: Derive from source data
const [circuits, setCircuits] = useState([]);
const totalLoad = circuits.reduce((sum, c) => sum + c.load, 0);
```

**When to use state**: Only for data that can't be derived

---

### 4. Hardcoding Coordinates in Diagrams

**Problem**: Magic numbers scattered throughout rendering code

**Symptom**: Difficult to adjust layout, change viewBox size

**Example**:
```typescript
// ❌ WRONG: Hardcoded coordinates
<rect x={400} y={170} width={60} height={40} />
<line x1={400} y1={210} x2={300} y2={320} />
```

**Fix**: Use constants

```typescript
// ✅ CORRECT: Named constants
const DIAGRAM_CONSTANTS = {
  MDP_X: 400,
  MDP_Y: 170,
  MDP_WIDTH: 60,
  MDP_HEIGHT: 40,
  LEVEL1_Y: 320
};

<rect x={DIAGRAM_CONSTANTS.MDP_X} y={DIAGRAM_CONSTANTS.MDP_Y} width={DIAGRAM_CONSTANTS.MDP_WIDTH} height={DIAGRAM_CONSTANTS.MDP_HEIGHT} />
```

---

### 5. Infinite Loops in useEffect

**Problem**: useEffect dependency causes re-trigger

**Symptom**: Browser freezes, console floods with logs

**Example**:
```typescript
// ❌ WRONG: Object dependency changes every render
useEffect(() => {
  fetchData(config);  // config is object literal
}, [config]);  // New object reference every render → infinite loop
```

**Fix**: Use primitive dependencies or useMemo

```typescript
// ✅ CORRECT: Primitive dependencies
useEffect(() => {
  fetchData({ id: projectId });
}, [projectId]);  // String primitive, stable reference

// ✅ CORRECT: Memoized object
const config = useMemo(() => ({ id: projectId }), [projectId]);
useEffect(() => {
  fetchData(config);
}, [config]);
```

---

### 6. Not Handling Loading States

**Problem**: Component renders before data loads

**Symptom**: "Cannot read property of undefined" errors

**Example**:
```typescript
// ❌ WRONG: No loading check
const { panels } = usePanels(projectId);
return (
  <div>
    {panels.map(p => <div>{p.name}</div>)}  // Error if panels undefined
  </div>
);
```

**Fix**: Check loading state

```typescript
// ✅ CORRECT: Handle loading
const { panels, loading } = usePanels(projectId);

if (loading) return <div>Loading...</div>;
if (!panels) return <div>No panels found</div>;

return (
  <div>
    {panels.map(p => <div key={p.id}>{p.name}</div>)}
  </div>
);
```

---

### 7. Missing Cleanup in useEffect

**Problem**: Subscription not unsubscribed on unmount

**Symptom**: Memory leaks, warnings in console

**Example**:
```typescript
// ❌ WRONG: No cleanup
useEffect(() => {
  const subscription = supabase.channel('data').subscribe();
  // OOPS: Forgot to unsubscribe!
}, []);
```

**Fix**: Return cleanup function

```typescript
// ✅ CORRECT: Cleanup on unmount
useEffect(() => {
  const subscription = supabase.channel('data').subscribe();

  return () => {
    subscription.unsubscribe();  // Cleanup
  };
}, []);
```

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Type check (no emit)
npm run type-check
```

---

## Getting Help

**Documentation**:
- Architecture patterns → `/docs/architecture.md`
- Security guidelines → `/docs/security.md`
- Testing patterns → `/docs/testing-strategy.md`
- Database schema → `/docs/database-architecture.md`
- Electrical concepts → `/docs/electrical-engineering-primer.md`

**External Resources**:
- React 19 docs: https://react.dev
- Supabase docs: https://supabase.com/docs
- TypeScript handbook: https://www.typescriptlang.org/docs/
- NEC 2023 online: https://nfpa.org/70

**Project-Specific**:
- Read `/CLAUDE.md` for comprehensive project overview
- Check `/CASCADING_HIERARCHY_FIX.md` for one-line diagram details
- Review `/tests/calculations.test.ts` for calculation examples

---

## Testing Strategy

**Last Updated**: 2025-12-03
**Current Coverage**: ~20% (calculation services only)
**Target Coverage**: 75%
**Framework**: Vitest 4.0.14 + React Testing Library

### Testing Pyramid

```
                    E2E Tests
                   /         \
                  /  (Future) \
                 /______________\
                /                \
               /  Integration     \
              /    Tests           \
             /     (Planned)        \
            /_______________________ \
           /                          \
          /      Unit Tests            \
         /   (Current: calculations)   \
        /________________________________\
```

#### Layer Breakdown

**Unit Tests** (Foundation):
- **Purpose**: Test individual functions in isolation
- **Speed**: Very fast (<1ms per test)
- **Coverage target**: 100% for calculation services, 80% for utilities
- **Current**: 11/11 passing (calculation services only)

**Integration Tests** (Middle):
- **Purpose**: Test multiple components/hooks working together
- **Speed**: Fast (10-100ms per test)
- **Coverage target**: 80% for custom hooks, 60% for components
- **Current**: NOT IMPLEMENTED

**E2E Tests** (Top):
- **Purpose**: Test complete user workflows
- **Speed**: Slow (1-10 seconds per test)
- **Coverage target**: Critical user paths only
- **Current**: NOT IMPLEMENTED

### Current Test Coverage

#### ✅ What's Tested (11 tests, 100% passing)

**File**: `/tests/calculations.test.ts`

**Load Calculations (5 tests)**:
```typescript
describe('Load Calculations', () => {
  it('calculates dwelling load per NEC 220.82') // ✅ PASSING
  it('applies lighting demand factors per NEC Table 220.42') // ✅ PASSING
  it('applies range demand factors per NEC Table 220.55') // ✅ PASSING
  it('applies 125% continuous load factor') // ✅ PASSING
  it('calculates commercial load per NEC 220.40') // ✅ PASSING
});
```

**Conductor Sizing (3 tests)**:
```typescript
describe('Conductor Sizing', () => {
  it('sizes conductors with temperature correction') // ✅ PASSING
  it('applies bundling adjustment factors') // ✅ PASSING
  it('selects correct conductor size from NEC Table 310.16') // ✅ PASSING
});
```

**Breaker Sizing (2 tests)**:
```typescript
describe('Breaker Sizing', () => {
  it('selects next standard breaker size per NEC 240.6(A)') // ✅ PASSING
  it('applies 125% factor for continuous loads') // ✅ PASSING
});
```

**Voltage Drop (1 test)**:
```typescript
describe('Voltage Drop', () => {
  it('calculates voltage drop using AC impedance method') // ✅ PASSING
});
```

#### ❌ What's NOT Tested

**Custom Hooks** (0% coverage):
- `usePanels`, `useCircuits`, `useTransformers`, `useLoads`, `useProjects`
- Real-time subscriptions
- Optimistic updates
- Error handling

**Components** (0% coverage):
- `OneLineDiagram`, `CircuitDesign`, `LoadCalculator`, etc.
- User interactions
- Rendering logic

**Database Logic** (0% coverage):
- RLS policies
- Triggers
- Constraints

### Unit Testing Strategy

#### What to Unit Test

**✅ Pure functions** (no side effects):
- Calculation services (`/services/calculations/`)
- Utility functions (`/lib/utils/`)
- Type guards (`isPanel`, `isValidVoltage`)

**✅ Business logic**:
- NEC compliance checks
- Validation rules
- Formatting functions

**❌ Don't unit test**:
- React components (use integration tests)
- Database queries (use integration tests with test DB)
- External API calls (mock at integration level)

#### Unit Test Template

```typescript
// /tests/myCalculation.test.ts
import { describe, it, expect } from 'vitest';
import { myCalculation } from '@/services/calculations/myCalculation';

describe('My Calculation', () => {
  describe('NEC compliance', () => {
    it('should apply 125% continuous load factor per NEC 215.2(A)(1)', () => {
      const result = myCalculation({
        loadAmps: 80,
        isContinuous: true
      });

      expect(result.adjustedAmps).toBe(100);  // 80 * 1.25
      expect(result.necReference).toBe('NEC 215.2(A)(1)');
    });

    it('should not apply factor for non-continuous loads', () => {
      const result = myCalculation({
        loadAmps: 80,
        isContinuous: false
      });

      expect(result.adjustedAmps).toBe(80);  // No factor
    });
  });

  describe('edge cases', () => {
    it('should handle zero load', () => {
      const result = myCalculation({ loadAmps: 0, isContinuous: true });
      expect(result.adjustedAmps).toBe(0);
    });

    it('should throw error for negative load', () => {
      expect(() => {
        myCalculation({ loadAmps: -10, isContinuous: true });
      }).toThrow('Load must be positive');
    });
  });

  describe('boundary conditions', () => {
    it('should handle maximum safe load (10000A)', () => {
      const result = myCalculation({ loadAmps: 10000, isContinuous: true });
      expect(result.adjustedAmps).toBe(12500);  // 10000 * 1.25
    });
  });
});
```

#### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on file change)
npm test -- --watch

# Run specific test file
npm test calculations.test.ts

# Run tests with coverage report
npm test -- --coverage
```

### Mocking Patterns

#### Mocking Supabase Client

**Pattern**: Mock at module level, reset between tests

```typescript
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { supabase } from '@/lib/supabase';

// Mock Supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn()
  }
}));

describe('usePanels hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();  // Reset mocks between tests
  });

  it('should fetch panels on mount', async () => {
    // Setup mock response
    const mockPanels = [
      { id: '1', name: 'MDP', voltage: 480 }
    ];

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockPanels,
            error: null
          })
        })
      })
    });

    // Test hook
    const { result } = renderHook(() => usePanels('project-123'));

    // Wait for async fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Assert
    expect(result.current.panels).toEqual(mockPanels);
    expect(supabase.from).toHaveBeenCalledWith('panels');
  });
});
```

#### Mocking Gemini AI Service

**Pattern**: Mock entire service module

```typescript
import { vi } from 'vitest';

// Mock Gemini service
vi.mock('@/services/geminiService', () => ({
  validateLoadCalculation: vi.fn().mockResolvedValue(
    'Load calculation is valid per NEC 220.82'
  ),
  generateOneLineDescription: vi.fn().mockResolvedValue(
    'Electrical system: 480V 3-phase service with step-down transformers'
  ),
  askNecAssistant: vi.fn().mockResolvedValue(
    'Per NEC Article 215, feeder conductors must be sized...'
  )
}));

// In test
it('should display AI validation result', async () => {
  render(<LoadCalculator />);

  fireEvent.click(screen.getByText('Validate with AI'));

  await waitFor(() => {
    expect(screen.getByText(/Load calculation is valid/)).toBeInTheDocument();
  });
});
```

### Coverage Goals

#### Target Coverage by Layer

| Layer | Current | Target | Priority |
|-------|---------|--------|----------|
| **Calculation Services** | 100% | 100% | ✅ DONE |
| **Custom Hooks** | 0% | 80% | 🔴 HIGH |
| **Components** | 0% | 60% | 🟡 MEDIUM |
| **Utilities** | 0% | 80% | 🟡 MEDIUM |
| **Overall** | ~20% | 75% | 🎯 GOAL |

#### Coverage Thresholds (Vitest Config)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75
      },
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts',
        '**/*.test.tsx'
      ]
    }
  }
});
```

#### Viewing Coverage Report

```bash
# Generate coverage report
npm test -- --coverage

# Open HTML report
open coverage/index.html
```

### Test Organization

#### File Structure

```
/tests/
  ├── calculations.test.ts       # ✅ Unit tests (calculations)
  ├── usePanels.test.ts          # ❌ Integration tests (hooks) - TODO
  ├── useCircuits.test.ts        # ❌ Integration tests (hooks) - TODO
  ├── CircuitDesign.test.tsx     # ❌ Component tests - TODO
  ├── OneLineDiagram.test.tsx    # ❌ Component tests - TODO
  ├── setup.ts                   # Test setup and mocks
  └── examples/                  # Example test patterns
      ├── hook-testing-example.test.ts
      └── component-testing-example.test.tsx
```

#### Naming Conventions

- **Unit tests**: `functionName.test.ts`
- **Hook tests**: `useHookName.test.ts`
- **Component tests**: `ComponentName.test.tsx`

### Summary

**Current State**: 11 tests (calculations only), 100% passing
**Target State**: 100+ tests across all layers, 75% coverage

**Immediate Priorities**:
1. Add hook tests (`usePanels`, `useCircuits`, `useTransformers`)
2. Add component integration tests (`CircuitDesign`, `LoadCalculator`)
3. Set up coverage thresholds in CI/CD

**Long-Term Goals**:
1. E2E tests for critical workflows (Playwright)
2. Visual regression tests (Percy, Chromatic)
3. Performance testing (React DevTools Profiler)
