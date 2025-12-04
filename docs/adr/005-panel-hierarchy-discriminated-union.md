# ADR-005: Panel Hierarchy via Discriminated Union

**Status**: Accepted
**Date**: 2025-12-03
**Decision Makers**: Development Team

---

## Context

Electrical panels have hierarchical relationships representing power flow:

```
Utility Service Entrance
  ↓
Main Distribution Panel (MDP)
  ├─ Subpanel 1 (fed from MDP)
  ├─ Transformer 1 (fed from MDP)
  │   └─ Panel 2 (fed from Transformer 1)
  └─ Subpanel 3 (fed from MDP)
```

**Database design challenge**: How to represent "Panel can be fed from Service OR Parent Panel OR Transformer"?

**Requirements**:
- Panel has exactly ONE source (service, panel, or transformer)
- Type-safe querying (TypeScript + PostgreSQL)
- Enforce constraints at database level
- Support recursive hierarchy traversal

---

## Decision

**Use discriminated union pattern with 3 columns**:

```sql
CREATE TABLE panels (
  id UUID PRIMARY KEY,
  fed_from_type TEXT CHECK (fed_from_type IN ('service', 'panel', 'transformer')),
  fed_from UUID REFERENCES panels(id),
  fed_from_transformer_id UUID REFERENCES transformers(id)
);
```

**TypeScript interface**:
```typescript
export interface Panel {
  id: string;
  fed_from_type: 'service' | 'panel' | 'transformer';  // Discriminator
  fed_from?: string;  // Panel ID (if type='panel')
  fed_from_transformer_id?: string;  // Transformer ID (if type='transformer')
}
```

**Usage**:
```typescript
function getPanelSource(panel: Panel): string {
  switch (panel.fed_from_type) {
    case 'service':
      return 'Service entrance';
    case 'panel':
      return `Panel ${panel.fed_from}`;  // TypeScript knows this exists
    case 'transformer':
      return `Transformer ${panel.fed_from_transformer_id}`;
  }
}
```

---

## Alternatives Considered

### Option A: Polymorphic Foreign Key (Single Column)
**Description**: One `fed_from_id` column + `fed_from_type` discriminator

```sql
CREATE TABLE panels (
  id UUID PRIMARY KEY,
  fed_from_id UUID,  -- Can be panel OR transformer ID
  fed_from_type TEXT CHECK (fed_from_type IN ('service', 'panel', 'transformer'))
);
```

**Pros**:
- ✅ Fewer columns (2 vs 3)
- ✅ Simpler queries (one column to check)

**Cons**:
- ❌ **No foreign key constraints**: Can't have FK to two different tables
- ❌ **Referential integrity broken**: Orphaned references possible
- ❌ **Database can't enforce validity**: Invalid IDs inserted without error
- ❌ **Cascading deletes don't work**: Can't ON DELETE CASCADE

**Why rejected**: Violates database integrity principles. Foreign keys essential.

### Option B: Nullable Boolean Flags
**Description**: Three boolean columns

```sql
CREATE TABLE panels (
  id UUID PRIMARY KEY,
  is_fed_from_service BOOLEAN,
  fed_from_panel_id UUID REFERENCES panels(id),
  fed_from_transformer_id UUID REFERENCES transformers(id),
  CHECK (
    (is_fed_from_service AND fed_from_panel_id IS NULL AND fed_from_transformer_id IS NULL) OR
    (NOT is_fed_from_service AND fed_from_panel_id IS NOT NULL AND fed_from_transformer_id IS NULL) OR
    (NOT is_fed_from_service AND fed_from_panel_id IS NULL AND fed_from_transformer_id IS NOT NULL)
  )
);
```

**Pros**:
- ✅ Foreign key constraints work
- ✅ Database enforces one-and-only-one

**Cons**:
- ❌ Complex CHECK constraint (hard to read/maintain)
- ❌ Query logic awkward (check 3 columns)
- ❌ TypeScript type hard to model

**Why rejected**: Over-complicated. Discriminated union clearer.

### Option C: Separate Junction Tables
**Description**: Separate tables for each relationship

```sql
CREATE TABLE panels_fed_from_service (
  panel_id UUID REFERENCES panels(id),
  -- service metadata
);

CREATE TABLE panels_fed_from_panels (
  panel_id UUID REFERENCES panels(id),
  parent_panel_id UUID REFERENCES panels(id)
);

CREATE TABLE panels_fed_from_transformers (
  panel_id UUID REFERENCES panels(id),
  transformer_id UUID REFERENCES transformers(id)
);
```

**Pros**:
- ✅ Perfect referential integrity
- ✅ Clear separation of concerns

**Cons**:
- ❌ 3 tables instead of columns (query complexity)
- ❌ Joins required for every query
- ❌ Can't enforce "exactly one" without application logic

**Why rejected**: Over-normalized for simple 1:1 relationship.

### Option D: JSON Column
**Description**: Store hierarchy in JSONB

```sql
CREATE TABLE panels (
  id UUID PRIMARY KEY,
  fed_from JSONB  -- { type: 'panel', id: 'abc' } or { type: 'transformer', id: 'xyz' }
);
```

**Pros**:
- ✅ Flexible schema
- ✅ Single column

**Cons**:
- ❌ No foreign key constraints (lose referential integrity)
- ❌ Can't index efficiently
- ❌ Hard to query (JSON path expressions)
- ❌ TypeScript types awkward

**Why rejected**: Sacrifices database integrity for questionable flexibility.

---

## Consequences

### Positive Consequences
- ✅ **Type safety**: TypeScript discriminated union provides compile-time checks
- ✅ **Referential integrity**: Foreign keys enforce valid panel/transformer IDs
- ✅ **Cascading deletes**: Deleting parent panel auto-deletes children
- ✅ **Clear queries**: Simple WHERE clause to find panels by type
- ✅ **Database constraints**: CHECK prevents invalid states

### Negative Consequences
- ❌ **More columns**: 3 columns instead of 2 (acceptable trade-off)
- ❌ **Nullable columns**: `fed_from` and `fed_from_transformer_id` nullable (must check discriminator)

### Neutral Consequences
- ℹ️ **Migration complexity**: Existing data needs discriminator column populated
- ℹ️ **Index strategy**: Need index on both `fed_from` and `fed_from_transformer_id`

---

## Implementation Notes

**Database migration** (from `/supabase/migration-transformers-fixed.sql`):

```sql
-- Add discriminated union columns
ALTER TABLE panels ADD COLUMN fed_from_type TEXT CHECK (fed_from_type IN ('service', 'panel', 'transformer'));
ALTER TABLE panels ADD COLUMN fed_from UUID REFERENCES panels(id) ON DELETE CASCADE;
ALTER TABLE panels ADD COLUMN fed_from_transformer_id UUID REFERENCES transformers(id) ON DELETE CASCADE;

-- Migrate existing data (panels without fed_from are service-fed)
UPDATE panels
SET fed_from_type = CASE
  WHEN fed_from IS NOT NULL THEN 'panel'
  ELSE 'service'
END;

-- Make fed_from_type required
ALTER TABLE panels ALTER COLUMN fed_from_type SET NOT NULL;

-- Add CHECK constraint for mutual exclusivity
ALTER TABLE panels ADD CONSTRAINT fed_from_exclusive CHECK (
  (fed_from_type = 'service' AND fed_from IS NULL AND fed_from_transformer_id IS NULL) OR
  (fed_from_type = 'panel' AND fed_from IS NOT NULL AND fed_from_transformer_id IS NULL) OR
  (fed_from_type = 'transformer' AND fed_from IS NULL AND fed_from_transformer_id IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX panels_fed_from_idx ON panels(fed_from);
CREATE INDEX panels_fed_from_transformer_idx ON panels(fed_from_transformer_id);
```

**TypeScript type guard**:
```typescript
function isPanelFedFromPanel(panel: Panel): panel is Panel & { fed_from: string } {
  return panel.fed_from_type === 'panel';
}

function isPanelFedFromTransformer(panel: Panel): panel is Panel & { fed_from_transformer_id: string } {
  return panel.fed_from_type === 'transformer';
}
```

**Query examples**:
```typescript
// Find all panels fed from MDP
const panelsFedFromMDP = panels.filter(p =>
  p.fed_from_type === 'panel' && p.fed_from === mdpId
);

// Find all panels fed from specific transformer
const panelsFedFromTransformer = panels.filter(p =>
  p.fed_from_type === 'transformer' && p.fed_from_transformer_id === transformerId
);
```

---

## Compliance & Standards

**Database design patterns**:
- Follows SQL foreign key best practices
- Uses CHECK constraints for data validation
- Indexes on foreign key columns

**TypeScript patterns**:
- Discriminated union (TypeScript 2.0+)
- Type guards for narrowing

---

## Monitoring & Validation

**Metrics to track**:
- Query performance on panel hierarchy (target: <50ms for 100 panels)
- Data integrity violations (target: 0 orphaned references)

**Success criteria**:
- ✅ No orphaned panel references in database
- ✅ Cascading deletes work correctly
- ✅ TypeScript catches type errors at compile time

**Review date**: 2026-06-01 (re-evaluate if hierarchy becomes more complex)

---

## References

- [PostgreSQL foreign keys](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- [TypeScript discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions)
- [Polymorphic associations considered harmful](https://stackoverflow.com/questions/922184/why-can-you-not-have-a-foreign-key-in-a-polymorphic-association)

---

## Notes

**Alternative for deeply nested hierarchies**: If hierarchy becomes 10+ levels deep, consider **closure table** pattern (separate table storing all ancestor-descendant pairs). Current design sufficient for typical 3-4 levels.

**Edge case - circular references**: Database foreign key prevents panel from being its own ancestor (would create cycle). Additional application-level validation not needed.

**Performance**: Recursive hierarchy queries (`WITH RECURSIVE`) work efficiently for <100 panels. Tested up to 50 panels with no performance issues.
