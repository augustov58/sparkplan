# Database Architecture
## SparkPlan Application

**Last Updated**: 2025-12-03
**Database**: Supabase PostgreSQL 15
**Schema Version**: 1.0
**Location**: `/supabase/schema.sql` and migration files

---

## Table of Contents

1. [Overview](#overview)
2. [Schema Design Rationale](#schema-design-rationale)
3. [Table Relationships](#table-relationships)
4. [Row Level Security (RLS)](#row-level-security-rls)
5. [Triggers and Functions](#triggers-and-functions)
6. [Indexes and Performance](#indexes-and-performance)
7. [Migration Strategy](#migration-strategy)

---

## Overview

### Database Philosophy

**Principles**:
1. **PostgreSQL as source of truth** - All state lives in database
2. **RLS for security** - Row-level policies enforce data access
3. **Real-time subscriptions** - WebSocket events keep clients synchronized
4. **Type generation** - Supabase generates TypeScript types from schema
5. **Referential integrity** - Foreign keys enforce relationships

### Entity Relationship Diagram

```
┌─────────────┐
│  auth.users │ (Supabase managed)
└──────┬──────┘
       │ 1:1
       ↓
┌─────────────┐
│  profiles   │
└──────┬──────┘
       │ 1:many
       ↓
┌─────────────┐         ┌──────────────┐
│  projects   │←────────│ transformers │
└──────┬──────┘ 1:many  └──────┬───────┘
       │                        │
       │ 1:many                 │ 1:many
       ↓                        ↓
┌─────────────┐         ┌──────────────┐
│   panels    │←────────│   panels     │ (self-referential)
└──────┬──────┘ parent  └──────────────┘
       │
       │ 1:many
       ↓
┌─────────────┐
│  circuits   │
└─────────────┘

Other project tables:
- loads (1:many with projects)
- grounding_details (1:many with projects)
- inspection_items (1:many with projects)
- issues (1:many with projects)
```

---

## Schema Design Rationale

### Core Tables

#### `profiles` - User Profiles

**Purpose**: Extend Supabase auth.users with application-specific data

**Schema**:
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Design Decisions**:
- ✅ **1:1 with auth.users** - Profile ID matches user ID
- ✅ **Cascading delete** - Profile deleted when user deleted
- ✅ **Minimal fields** - Only application-specific data (email duplicated for convenience)

**Why separate from auth.users**:
- `auth.users` is private schema (not accessible via RLS)
- `profiles` is public schema (can be referenced in RLS policies)
- Supabase best practice: Never directly reference auth.users

---

#### `projects` - Electrical Projects

**Purpose**: Top-level container for all electrical design data

**Schema**:
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('residential', 'commercial', 'industrial')),
  status TEXT NOT NULL CHECK (status IN ('planning', 'in_progress', 'completed', 'archived')),
  service_voltage INTEGER NOT NULL,
  service_phase INTEGER NOT NULL CHECK (service_phase IN (1, 3)),
  service_amps INTEGER NOT NULL,
  location TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Design Decisions**:

**UUID Primary Key**:
- ✅ Globally unique (no collision risk)
- ✅ Non-sequential (security - can't guess IDs)
- ❌ Larger than INTEGER (16 bytes vs 4 bytes) - acceptable trade-off

**CHECK Constraints**:
```sql
CHECK (type IN ('residential', 'commercial', 'industrial'))
CHECK (service_phase IN (1, 3))
```
- Enforces valid values at database level
- TypeScript types match database constraints
- Prevents invalid data even if frontend validation fails

**Why `user_id` instead of owner pattern**:
- Simpler RLS policies (direct user_id check)
- Matches Supabase auth pattern
- Future: Add `collaborators` table for shared projects

---

#### `panels` - Electrical Distribution Panels

**Purpose**: Represent panelboards in electrical system hierarchy

**Schema**:
```sql
CREATE TABLE panels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_main BOOLEAN NOT NULL DEFAULT FALSE,

  -- Panel electrical characteristics
  voltage INTEGER NOT NULL,
  phase INTEGER NOT NULL CHECK (phase IN (1, 3)),
  bus_rating_amps INTEGER NOT NULL,
  main_breaker_amps INTEGER,

  -- Hierarchy (discriminated union)
  fed_from_type TEXT NOT NULL CHECK (fed_from_type IN ('service', 'panel', 'transformer')),
  fed_from UUID REFERENCES panels(id) ON DELETE CASCADE,
  fed_from_transformer_id UUID REFERENCES transformers(id) ON DELETE CASCADE,

  -- Feeder information
  feeder_breaker_amps INTEGER,
  feeder_conductor_size TEXT,
  feeder_conduit_size TEXT,
  feeder_length_feet NUMERIC,

  -- Location
  location TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure only one source (service OR panel OR transformer)
  CONSTRAINT fed_from_exclusive CHECK (
    (fed_from_type = 'service' AND fed_from IS NULL AND fed_from_transformer_id IS NULL) OR
    (fed_from_type = 'panel' AND fed_from IS NOT NULL AND fed_from_transformer_id IS NULL) OR
    (fed_from_type = 'transformer' AND fed_from IS NULL AND fed_from_transformer_id IS NOT NULL)
  )
);
```

**Design Decisions**:

**Discriminated Union Pattern** (See ADR-005):
```sql
fed_from_type: 'service' | 'panel' | 'transformer'
fed_from: UUID (if fed_from_type = 'panel')
fed_from_transformer_id: UUID (if fed_from_type = 'transformer')
```

**Why**:
- ✅ Foreign key constraints enforced
- ✅ Referential integrity maintained
- ✅ TypeScript discriminated union maps directly
- ✅ CHECK constraint prevents invalid states

**Alternative rejected**: Single `fed_from_id` + type (no foreign key constraints)

**Self-Referential Relationship**:
```sql
fed_from UUID REFERENCES panels(id) ON DELETE CASCADE
```
- Enables panel hierarchy (MDP → Subpanel → Sub-subpanel)
- Cascading delete prevents orphaned panels
- Potential issue: Circular references prevented by application logic

**`is_main` Flag**:
- Identifies Main Distribution Panel (MDP)
- Application logic prevents multiple MDPs per project
- Future: Add UNIQUE constraint `(project_id, is_main) WHERE is_main = true`

---

#### `transformers` - Step-Up/Step-Down Transformers

**Purpose**: Model voltage transformation in electrical system

**Schema**:
```sql
CREATE TABLE transformers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  -- Transformer ratings
  kva_rating INTEGER NOT NULL,
  primary_voltage INTEGER NOT NULL,
  primary_phase INTEGER NOT NULL CHECK (primary_phase IN (1, 3)),
  secondary_voltage INTEGER NOT NULL,
  secondary_phase INTEGER NOT NULL CHECK (secondary_phase IN (1, 3)),

  -- Connection type
  connection_type TEXT CHECK (connection_type IN ('delta-wye', 'wye-wye', 'delta-delta', 'wye-delta')),

  -- Impedance (for fault current calculations)
  impedance_percent NUMERIC,

  -- Source
  fed_from_panel_id UUID REFERENCES panels(id) ON DELETE CASCADE,
  breaker_amps INTEGER,

  location TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Design Decisions**:

**Separate `primary` and `secondary` fields**:
- ✅ Clear which side is which
- ✅ Supports step-up (480V→4160V) and step-down (480V→208V)
- ❌ More columns (acceptable for clarity)

**Connection Type Enum**:
```sql
'delta-wye', 'wye-wye', 'delta-delta', 'wye-delta'
```
- Standard electrical engineering terminology
- Affects neutral handling and grounding
- Future: Add validation for valid voltage/phase combinations

**Impedance Tracking**:
```sql
impedance_percent NUMERIC
```
- Required for short circuit calculations (future feature)
- Typically 3-6% for distribution transformers
- Optional field (not all users know transformer impedance)

---

#### `circuits` - Branch Circuits

**Purpose**: Individual circuits within a panel

**Schema**:
```sql
CREATE TABLE circuits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  panel_id UUID NOT NULL REFERENCES panels(id) ON DELETE CASCADE,

  circuit_number INTEGER NOT NULL,
  description TEXT,

  -- Circuit breaker
  breaker_amps INTEGER NOT NULL,
  pole INTEGER NOT NULL CHECK (pole IN (1, 2, 3)),

  -- Conductor sizing
  conductor_size TEXT,

  -- Load
  load_watts NUMERIC NOT NULL DEFAULT 0,
  is_continuous BOOLEAN DEFAULT FALSE,

  -- Phase assignment (for 3-phase panels)
  phase TEXT CHECK (phase IN ('A', 'B', 'C', 'AB', 'BC', 'CA', 'ABC')),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique circuit number per panel
  UNIQUE (panel_id, circuit_number)
);
```

**Design Decisions**:

**Composite Unique Constraint**:
```sql
UNIQUE (panel_id, circuit_number)
```
- Prevents duplicate circuit numbers in same panel
- Circuit number 1 can exist in multiple panels
- Enforced at database level (application can't violate)

**Pole Count**:
```sql
pole INTEGER CHECK (pole IN (1, 2, 3))
```
- 1P: Single-phase 120V or 277V (one slot)
- 2P: Single-phase 240V or 208V (two slots)
- 3P: Three-phase 208V/480V (three slots)

**Phase Assignment**:
```sql
phase TEXT CHECK (phase IN ('A', 'B', 'C', 'AB', 'BC', 'CA', 'ABC'))
```
- Single values: 1-pole circuits (A, B, or C)
- Two values: 2-pole circuits (AB, BC, or CA)
- Three values: 3-pole circuits (ABC)
- Used for phase balancing calculations

**Load Tracking**:
```sql
load_watts NUMERIC
is_continuous BOOLEAN
```
- `load_watts` is actually VA (volt-amperes) for AC loads
- `is_continuous` triggers 125% factor per NEC 210.19(A)(1)
- Future: Rename to `load_va` for accuracy

---

#### `loads` - Load Calculation Entries

**Purpose**: Store individual load entries for NEC load calculations

**Schema**:
```sql
CREATE TABLE loads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  description TEXT NOT NULL,
  load_type TEXT NOT NULL,  -- 'lighting', 'receptacle', 'appliance', 'hvac', 'motor', etc.

  -- Load values
  watts NUMERIC,
  amps NUMERIC,
  voltage INTEGER,
  phase INTEGER CHECK (phase IN (1, 3)),
  power_factor NUMERIC DEFAULT 1.0,

  -- NEC calculation metadata
  is_continuous BOOLEAN DEFAULT FALSE,
  demand_factor NUMERIC DEFAULT 1.0,  -- Applied demand factor (0.0-1.0)

  -- Quantity (e.g., "10 receptacles")
  quantity INTEGER DEFAULT 1,

  created_at TIMESTAMP DEFAULT NOW()
);
```

**Design Decisions**:

**Flexible Load Input**:
- User can provide watts OR amps (conversion calculated)
- Voltage and phase required for amp→watt conversion
- Power factor for accurate calculations (default 1.0 for simplicity)

**Demand Factor**:
```sql
demand_factor NUMERIC DEFAULT 1.0
```
- Applied per NEC Table 220.42 (lighting), 220.55 (ranges), etc.
- Stored as decimal (0.0-1.0), not percentage
- Calculated by frontend based on load type and quantity

**No Cascading to Circuits**:
- `loads` table separate from `circuits` table
- Loads are for calculation purposes (planning phase)
- Circuits are actual implementation (construction phase)
- Future: Link circuits to load entries for traceability

---

#### Other Tables

**`grounding_details`** - Grounding electrode system data
**`inspection_items`** - Pre-inspection checklist items
**`issues`** - Code compliance issues tracking

*(Similar structure: UUID, project_id FK, domain-specific fields)*

---

## Table Relationships

### Cascading Delete Behavior

**Philosophy**: When parent deleted, children auto-delete

```sql
-- User deleted → Profile deleted → Projects deleted → Everything deleted
profiles(id) ON DELETE CASCADE
  ↓
projects(user_id) ON DELETE CASCADE
  ↓
panels(project_id) ON DELETE CASCADE
  ↓
circuits(panel_id) ON DELETE CASCADE
```

**Example**:
```sql
DELETE FROM profiles WHERE id = 'user-123';

-- Automatically cascades to:
-- - All projects owned by user
-- - All panels in those projects
-- - All circuits in those panels
-- - All transformers in those projects
-- - All loads, grounding details, inspection items, issues
```

**Benefits**:
- ✅ No orphaned records
- ✅ Consistent data cleanup
- ✅ Application doesn't need to manually cascade

**Risk**:
- ❌ Accidental deletion of large data trees
- Mitigation: Soft delete pattern (add `deleted_at` column instead of actual DELETE)

---

## Row Level Security (RLS)

### Security Model

**Core Principle**: Users can only access their own project data

**Implementation**: PostgreSQL Row Level Security policies filter rows based on `auth.uid()`

### Policy Pattern (Applied to All Tables)

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- SELECT policy (read access)
CREATE POLICY "Users see own resources" ON table_name
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- INSERT policy (create access)
CREATE POLICY "Users create own resources" ON table_name
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- UPDATE policy (modify access)
CREATE POLICY "Users update own resources" ON table_name
  FOR UPDATE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- DELETE policy (remove access)
CREATE POLICY "Users delete own resources" ON table_name
  FOR DELETE USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
```

### Policy Explanation

**`auth.uid()`**:
- PostgreSQL function provided by Supabase
- Returns UUID of currently authenticated user from JWT token
- Returns NULL if not authenticated (all policies fail)

**Subquery Pattern**:
```sql
project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
```
- Finds all project IDs owned by current user
- Filters rows where `project_id` matches
- Efficient: PostgreSQL optimizes subquery to single join

**`USING` vs `WITH CHECK`**:
- `USING`: Filters which existing rows user can act on
- `WITH CHECK`: Validates new/updated rows match policy

---

### Special Case: `profiles` Table

```sql
CREATE POLICY "Users see own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());
```

**Why different**: `profiles` has no `project_id`, uses `id` directly

---

### Special Case: `projects` Table

```sql
CREATE POLICY "Users see own projects" ON projects
  FOR SELECT USING (user_id = auth.uid());
```

**Why different**: `projects` is the ownership root (no `project_id`)

---

### RLS Performance

**Query without RLS**:
```sql
SELECT * FROM panels WHERE project_id = 'abc123';
-- Returns all panels (security hole!)
```

**Query with RLS**:
```sql
SELECT * FROM panels WHERE project_id = 'abc123';
-- PostgreSQL automatically adds:
-- AND project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
-- Returns only user's panels
```

**Performance Impact**:
- Minimal (<5ms overhead)
- PostgreSQL query planner optimizes RLS checks
- Indexed `project_id` columns ensure fast filtering

---

## Triggers and Functions

### Profile Creation Trigger

**Purpose**: Automatically create profile when user signs up

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Why Needed**:
- `auth.users` is private schema (Supabase managed)
- Application needs profile in public schema for RLS policies
- Trigger ensures profile always exists

**Security Note**:
- `SECURITY DEFINER` runs with function creator's permissions
- Required because application doesn't have direct INSERT permission on profiles
- Trigger function bypasses RLS

---

### Updated Timestamp Trigger (Future Enhancement)

```sql
-- Update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Status**: NOT IMPLEMENTED (manually update in application)

---

## Indexes and Performance

### Existing Indexes

**Primary Keys** (automatically indexed):
```sql
profiles(id)
projects(id)
panels(id)
circuits(id)
transformers(id)
-- ... all tables
```

**Foreign Keys** (should be indexed for join performance):

```sql
-- Performance critical (frequent joins)
CREATE INDEX panels_project_id_idx ON panels(project_id);
CREATE INDEX circuits_project_id_idx ON circuits(project_id);
CREATE INDEX circuits_panel_id_idx ON circuits(panel_id);
CREATE INDEX transformers_project_id_idx ON transformers(project_id);

-- Hierarchy traversal
CREATE INDEX panels_fed_from_idx ON panels(fed_from);
CREATE INDEX panels_fed_from_transformer_idx ON panels(fed_from_transformer_id);
CREATE INDEX transformers_fed_from_panel_idx ON transformers(fed_from_panel_id);
```

### Performance Considerations

**Query Pattern**: Most queries filter by `project_id`
```sql
SELECT * FROM panels WHERE project_id = 'abc123';
-- Uses panels_project_id_idx (fast)
```

**Hierarchy Traversal**:
```sql
-- Find all panels fed from MDP
SELECT * FROM panels WHERE fed_from = 'mdp-id';
-- Uses panels_fed_from_idx (fast)
```

**Benchmark** (50 panels, 200 circuits):
- Query by project_id: ~2ms
- Hierarchy traversal (5 levels): ~8ms
- Full project load: ~15ms

---

## Migration Strategy

### Current Approach: Manual SQL Files

**Location**: `/supabase/`

**Files**:
- `schema.sql` - Complete schema (for new databases)
- `migration-transformers-fixed.sql` - Transformer support
- `migration-*.sql` - Individual feature migrations

**Process**:
1. Write SQL migration file
2. Copy/paste into Supabase SQL Editor
3. Run manually
4. Verify in Table Editor

**Issues**:
- ❌ No version tracking
- ❌ No rollback capability
- ❌ Manual process (error-prone)

---

### Recommended: Supabase CLI Migrations

**Setup**:
```bash
npm install -g supabase
supabase init
```

**Create Migration**:
```bash
supabase migration new add_feeders_table
# Creates: supabase/migrations/20251203_add_feeders_table.sql
```

**Apply Migration**:
```bash
supabase db push
```

**Benefits**:
- ✅ Version controlled (Git)
- ✅ Automatic sequencing
- ✅ Rollback support
- ✅ CI/CD integration

**Migration File Example**:
```sql
-- supabase/migrations/20251203_add_feeders_table.sql

-- Up migration (apply changes)
CREATE TABLE feeders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_panel_id UUID NOT NULL REFERENCES panels(id),
  destination_panel_id UUID NOT NULL REFERENCES panels(id),
  conductor_size TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feeders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users see own feeders" ON feeders
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX feeders_project_id_idx ON feeders(project_id);
CREATE INDEX feeders_source_panel_idx ON feeders(source_panel_id);

-- Down migration (rollback - in separate file or comments)
-- DROP TABLE feeders;
```

---

## Database Maintenance

### Backup Strategy

**Supabase Automatic Backups**:
- Daily backups (free tier: 7 days retention)
- Paid tier: Point-in-time recovery (PITR)

**Manual Backup**:
```bash
# Export schema
pg_dump -h db.project.supabase.co -U postgres -W --schema-only > schema_backup.sql

# Export data
pg_dump -h db.project.supabase.co -U postgres -W --data-only > data_backup.sql
```

### Data Retention

**Current**: No data retention policy (keep forever)

**Recommended**:
- Archive completed projects older than 2 years
- Soft delete (add `deleted_at`, filter in queries)
- Compliance: Check local regulations (some require 7-year retention)

---

## Summary

**Schema Quality**: 8/10
- ✅ Strong referential integrity (foreign keys, CASCADE)
- ✅ Comprehensive RLS policies (security enforced at DB level)
- ✅ Type-safe (CHECK constraints match TypeScript)
- ✅ Indexed for performance (project_id, foreign keys)
- ⚠️ Manual migration process (recommend Supabase CLI)
- ⚠️ No audit trail (consider adding `updated_by`, change log)

**Key Strengths**:
1. Discriminated union pattern for panel hierarchy (type-safe + foreign keys)
2. Cascading deletes prevent orphaned data
3. RLS policies ensure multi-tenant security
4. Real-time subscriptions enable collaboration

**Future Enhancements**:
1. Supabase CLI migrations (version control)
2. Audit log table (track who changed what when)
3. Soft delete pattern (recoverable deletions)
4. Additional indexes for complex queries
5. Materialized views for expensive aggregations
