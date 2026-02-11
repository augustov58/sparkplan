# CLAUDE.md

## Project Overview

**SparkPlan**: SaaS dashboard for electrical contractors. Modern alternative to ETAP/SKM ($15-50k/yr). React + TypeScript + Supabase + Gemini AI.

**Roadmap**: See [ROADMAP.md](./ROADMAP.md) for current phase and feature list.

---

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npm test             # Run tests
```

---

## Critical NEC Rules

### NEC 220.87 - Service Upgrade Sizing
```
CRITICAL: 125% multiplier for calculated loads, NOT for measured loads.
- Measured (utility bill, load study): Use value directly
- Calculated (panel schedule, manual): Apply 125% multiplier
```
Implementation: `services/calculations/serviceUpgrade.ts`

### Short Circuit Analysis
```
CRITICAL: 3-phase impedance multiplier is 1× (not 1.732×).
Incorrect value causes 40-50% underestimation of fault currents.
```
Implementation: `services/calculations/shortCircuit.ts`

### NEC 220.57 (EVSE Load)
Per-EVSE load = `max(7,200 VA, nameplate)`. This is NOT a demand factor.

### EVEMS Sizing (NEC 625.42)
Size to setpoint, not full connected load. EVEMS allows service capacity reduction.

---

## Architecture Patterns

### Hooks Pattern
All data hooks (`usePanels`, `useCircuits`, `useFeeders`, etc.) follow optimistic update + realtime subscription pattern via Supabase. New hooks should copy this pattern exactly.

### Database Types
Use `Database['public']['Tables'][table]['Row']` pattern for types. The `types.ts` file has separate interfaces that may not match DB exactly.

### Panel Hierarchy (Discriminated Union)
```typescript
fed_from_type: 'service' | 'panel' | 'transformer' | 'meter_stack'  // Discriminator
fed_from: UUID                    // Only if type='panel'
fed_from_transformer_id: UUID     // Only if type='transformer'
```
- MDP is found via `p.is_main`, not by `fed_from_type`
- MDP is always the structural root in tree layout
- Meter stack is visual-only in OneLineDiagram, not a tree node
- See: [ADR-005](/docs/adr/005-panel-hierarchy-discriminated-union.md)

### PDF Generation
Uses `@react-pdf/renderer`. Components are Page-level fragments (`<>...</>`), assembled in `permitPacketGenerator.tsx` Document.

### OneLineDiagram.tsx
Has **TWO SVG renderings** — interactive (~line 2340) and print/export (~line 3290). Both must be updated for visual changes.

---

## Calculation Service Rules

### Pure Functions Only
Calculation services (`/services/calculations/`) are **pure functions** — no DB calls, no hooks, no side effects. Input → output. Components and hooks call them.

### Result Contract
Every calculation result **must** include:
- `necReferences: string[]` — which NEC articles were applied (audit trail)
- `warnings: string[]` — escalating severity (INFO → WARNING → CRITICAL)
- `breakdown` or `details` — itemized sub-results for transparency

### Never Throw
Calculations **never throw** on bad results. Return the result with warnings instead. Let the UI decide how to present it. Example: a voltage drop of 8% returns `{ isCompliant: false, warnings: ['CRITICAL: ...'] }`.

### NEC Tables
NEC lookup tables live in `/data/nec/` as typed array constants + lookup functions. Never inline magic numbers. Pattern:
```typescript
const TABLE_250_122: EgcSizeEntry[] = [
  { maxOcpdRating: 15, copperEgcSize: '14', aluminumEgcSize: '12' },
  // ...
];
export function getEgcSize(ocpdRating: number, material: 'Cu' | 'Al'): string { ... }
```
Table lookups always have a **fallback** (return largest size if input exceeds table).

### Demand Factors Are Non-Cascading
Demand factors apply **once per load type to system-wide totals**, never chained through panel hierarchy. Wrong: apply 35% per panel. Right: collect all lighting VA across hierarchy, apply NEC 220.42 tiers once.

### Rounding
Round **only at final output**, preserve precision in intermediate steps:
- Power: 2 decimals (kVA)
- Current: 0 decimals (amps) for service sizing, 1 decimal for intermediate
- Percentages: 1 decimal
- Conductor sizes: never rounded (string enum)

### Unit Suffixes
Use suffixes in variable names for clarity: `_VA`, `_kVA`, `_kW`, `_pct`, `_ft`. No implicit unit conversions.

---

## Development Patterns

### Adding Calculations
1. Types → `types.ts`
2. Service → `/services/calculations/` (pure function, follows rules above)
3. Component → `/components/`
4. Route → `App.tsx`
5. Add NEC article references in comments and in result `necReferences` array

### Adding AI Features
**System 1 (Quick Q&A)**: `services/geminiService.ts` → `callGeminiProxy()`
**System 2 (Complex Analysis)**: `/backend/agents/` → Pydantic AI with approval workflow

### Database Changes
1. Migration → `/supabase/migrations/`
2. Run in Supabase SQL Editor
3. Update `lib/database.types.ts`

### Adding New Entity Hooks
- Follow optimistic update + realtime subscription pattern (copy existing hooks)
- Add event type to `dataRefreshEvents.ts`
- Add toast messages for CRUD operations in `toast.ts`
- Update `fed_from_type` enum in `validation-schemas.ts` if adding new feed types

---

## Frontend Conventions

### Imports
Use `@/` alias for absolute imports. Order: React/externals → Supabase/DB types → components → hooks → services → types → icons (lucide-react).

### Routing
Uses **HashRouter** (not BrowserRouter). Heavy components are lazy-loaded with `Suspense`:
```typescript
const Calculator = lazy(() => import('./components/Calculator'));
<Suspense fallback={<LoadingSpinner />}><Calculator /></Suspense>
```

### Forms
React Hook Form + Zod schemas (`lib/validation-schemas.ts`). Use `zodResolver`. Inline error display.

### Toasts
All user-facing messages centralized in `lib/toast.ts`. Use `showToast.success(toastMessages.panel.created)`, never raw toast calls. Add entries for new entities.

### Styling
Tailwind v4 with custom theme. Brand color: `electric-500` (#FFCC00). No CSS modules. Variants via `Record<Variant, string>` objects.

### Auth
`AuthProvider` wraps app → access via `useAuthContext()`. Supabase RLS scopes all queries to `auth.uid()` automatically — never pass user_id manually.

### Feature Gating
Premium features wrapped in `<FeatureGate feature="feature-name">`. Access tiers defined in `useSubscription` hook.

### Type Adapters
Database uses snake_case, frontend uses camelCase. Convert via adapters in `lib/typeAdapters.ts`. Don't mix conventions.

---

## Codebase Pitfalls

### Multi-Pole Slot Formula
Slots occupied: `baseSlot + (i × 2)` for each pole.
- 2-pole at slot 1 → occupies 1, 3
- 3-pole at slot 1 → occupies 1, 3, 5
See: `components/PanelSchedule.tsx:getOccupiedSlots()`

### Stable Modules (Don't Modify Without Good Reason)
- `services/calculations/shortCircuit.ts` - IEEE 141 compliant, safety-critical
- `services/calculations/serviceUpgrade.ts` - NEC 220.87 compliant
- `components/OneLineDiagram.tsx` - Complex SVG rendering, easily broken
- `lib/database.types.ts` - Auto-generated, regenerate via Supabase CLI

---

## Key Files

**Configuration**: `vite.config.ts`, `.env.local`
**Types**: `types.ts`, `lib/database.types.ts`
**Calculations**: `/services/calculations/`
**AI (System 1)**: `services/geminiService.ts`
**AI (System 2)**: `/backend/agents/`, `services/api/pythonBackend.ts`
**Database**: `/supabase/migrations/`

---

## Environment

See [`.env.example`](./.env.example) and [`backend/.env.example`](./backend/.env.example).

**Key**: Gemini API key needed in BOTH Supabase Edge Functions AND Python backend.

---

## Resources

- **GitHub**: `augustov58/nec_compliance`
- **Backend**: https://neccompliance-production.up.railway.app

---

## Session Log Maintenance

`/docs/SESSION_LOG.md` tracks recent work for handoff continuity. **Keep only the last 2 sessions.** At the start of each new session, archive older entries by deleting them — the git history preserves everything.
