# CLAUDE.md

## Session Context

**Check first**: `/docs/SESSION_LOG.md` for current work and context.
**Current Phase**: 2.5 (Multi-Family EV) - Complete. See [ROADMAP.md](./ROADMAP.md).
**Latest Change**: 2026-02-04 - NEC 220.87 measurement path & building presets.

---

## Project Overview

**NEC Pro Compliance**: SaaS dashboard for electrical contractors. Modern alternative to ETAP/SKM ($15-50k/yr). React + TypeScript + Supabase + Gemini AI.

---

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server (localhost:3000)
npm run build        # Production build
npm test             # Run tests
```

---

## Documentation Index

**Start Here**
- [Session Log](/docs/SESSION_LOG.md) - Current session status
- [Roadmap](./ROADMAP.md) - Phase status & feature list
- [Changelog](/docs/CHANGELOG.md) - Recent changes
- [Strategic Analysis](./STRATEGIC_ANALYSIS.md) - Market focus (Multi-Family EV)

**Architecture**
- [Architecture Overview](/docs/architecture.md) - State management, optimistic updates
- [Database Architecture](/docs/database-architecture.md) - Schema, RLS policies
- [AI Agent Architecture](/docs/AI_AGENT_ARCHITECTURE.md) - Dual AI systems (Gemini Q&A + Pydantic agents)

**ADRs**: [001-Optimistic UI](/docs/adr/001-optimistic-ui-updates.md) | [005-Panel Hierarchy](/docs/adr/005-panel-hierarchy-discriminated-union.md)

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

---

## Development Patterns

### Adding Calculations
1. Types → `types.ts`
2. Service → `/services/calculations/`
3. Component → `/components/`
4. Route → `App.tsx`
5. Add NEC article references in comments

### Adding AI Features
**System 1 (Quick Q&A)**: `services/geminiService.ts` → `callGeminiProxy()`
**System 2 (Complex Analysis)**: `/backend/agents/` → Pydantic AI with approval workflow

### Database Changes
1. Migration → `/supabase/migrations/`
2. Run in Supabase SQL Editor
3. Update `lib/database.types.ts`

---

## Codebase Pitfalls

### Multi-Pole Slot Formula
Slots occupied: `baseSlot + (i × 2)` for each pole.
- 2-pole at slot 1 → occupies 1, 3
- 3-pole at slot 1 → occupies 1, 3, 5
See: `components/PanelSchedule.tsx:getOccupiedSlots()`

### Panel Hierarchy (Discriminated Union)
```typescript
fed_from_type: 'service' | 'panel' | 'transformer'  // Discriminator
fed_from: UUID              // Only if type='panel'
fed_from_transformer_id: UUID  // Only if type='transformer'
```
See: [ADR-005](/docs/adr/005-panel-hierarchy-discriminated-union.md)

### Optimistic Updates
UI updates immediately, DB syncs async. All hooks (`usePanels`, `useCircuits`, etc.) follow this pattern. See: [ADR-001](/docs/adr/001-optimistic-ui-updates.md)

### Stable Modules (Don't Modify Without Good Reason)
- `services/calculations/shortCircuit.ts` - IEEE 141 compliant, safety-critical
- `services/calculations/serviceUpgrade.ts` - NEC 220.87 compliant
- `components/OneLineDiagram.tsx` - Complex SVG rendering, easily broken
- `lib/database.types.ts` - Auto-generated, regenerate via Supabase CLI

### NEC 220.57 (EVSE Load)
Per-EVSE load = `max(7,200 VA, nameplate)`. This is NOT a demand factor.

### EVEMS Sizing (NEC 625.42)
Size to setpoint, not full connected load. EVEMS allows service capacity reduction.

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
