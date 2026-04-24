# AGENTS.md

Last Updated: 2026-04-24

## Project Snapshot

SparkPlan is a SaaS dashboard for electrical contractors: React + TypeScript + Vite + Tailwind + Supabase, with Gemini-backed AI features and a Python agent backend.

Primary product areas:
- Electrical calculation tools and NEC compliance workflows
- Panel schedules, feeder/service equipment, and one-line diagrams
- Permit packet/PDF generation
- AI assistance for NEC Q&A, RFIs, photos, and inspection risk

Use `CLAUDE.md` as the source of truth for detailed project guidance. This file adapts the same rules for Codex-style agent work.

## Commands

```bash
npm install
npm run dev       # Vite dev server on localhost:3000
npm run build     # production build
npm test          # Vitest tests
```

Run commands from the repo root unless a task is explicitly backend-only.

## Verification Rules

Before calling work complete:
1. Run `npm run build`.
2. Run `npm test`.
3. Fix code failures before changing tests.
4. If calculation logic changed, verify or add focused tests for the changed paths.
5. If routes/components changed, confirm the build includes them.

For small docs-only edits, build/test may be skipped, but say so clearly in the final response.

## Safety-Critical NEC Rules

Treat electrical calculation code as safety-critical.

- NEC 220.87 service upgrades: apply the 125% multiplier only to calculated loads, not measured utility/load-study data.
- Short circuit analysis: 3-phase impedance multiplier is `1x`, not `1.732x`.
- NEC 220.57 EVSE: per-EVSE load is `max(7200 VA, nameplate)`.
- NEC 625.42 EVEMS: size to the EVEMS setpoint, not the full connected EVSE load.
- Demand factors are non-cascading: aggregate system-wide by load type, then apply once.
- Round only final outputs; preserve intermediate precision.
- Use unit suffixes in variable names: `_VA`, `_kVA`, `_kW`, `_pct`, `_ft`.

Key files:
- `services/calculations/serviceUpgrade.ts`
- `services/calculations/shortCircuit.ts`
- `services/calculations/evCharging.ts`
- `services/calculations/evemsLoadManagement.ts`
- `data/nec/`

Never edit NEC table values casually. Cross-check table data against the actual NEC or a verified reference before changing it.

## Calculation Service Contract

Files in `services/calculations/` must stay pure:
- No hooks
- No database calls
- No UI state
- No side effects

Calculation results must include:
- `necReferences: string[]`
- `warnings: string[]`
- `breakdown` or `details`

Do not throw for non-compliant or bad calculation outcomes. Return a result with warnings and compliance status so the UI can decide how to present it.

## Architecture Patterns

Data hooks such as `usePanels`, `useCircuits`, and `useFeeders` use optimistic updates plus Supabase realtime subscriptions. Copy an existing hook pattern when adding a new entity hook.

Use database row types with:

```ts
Database['public']['Tables'][table]['Row']
```

The root `types.ts` file contains app-level interfaces and may not exactly match database types.

Panel hierarchy uses a discriminated union:

```ts
fed_from_type: 'service' | 'panel' | 'transformer' | 'meter_stack'
fed_from: UUID
fed_from_transformer_id: UUID
```

Important hierarchy details:
- MDP is found with `p.is_main`, not `fed_from_type`.
- MDP is the structural root in tree layout.
- Meter stack is visual-only in `OneLineDiagram`, not a tree node.
- See `docs/adr/005-panel-hierarchy-discriminated-union.md`.

`components/OneLineDiagram.tsx` has two SVG renderings: interactive and print/export. Update both for visual or diagram changes.

## Frontend Conventions

- Use the `@/` alias for absolute imports.
- Import order: React/externals, Supabase/DB types, components, hooks, services, types, icons.
- Routing uses `HashRouter`.
- Heavy components should be lazy-loaded with `Suspense`.
- Forms use React Hook Form + Zod schemas from `lib/validation-schemas.ts`.
- Toast copy lives in `lib/toast.ts`; avoid raw user-facing toast strings.
- Tailwind v4 is configured through Vite; brand color is `electric-500` (`#FFCC00`).
- Use `useAuthContext()` from the auth provider.
- Supabase RLS scopes user data; do not manually pass `user_id` unless an existing API explicitly requires it.
- Premium features use `<FeatureGate feature="...">`.
- Database fields are snake_case; frontend model fields are camelCase. Use adapters in `lib/typeAdapters.ts`.

## Common Workflows

Adding a calculation:
1. Update types in `types.ts` if needed.
2. Add or change pure service code in `services/calculations/`.
3. Add or update UI in `components/`.
4. Wire routes in `App.tsx` if needed.
5. Add NEC references in code comments and result `necReferences`.
6. Add focused tests.

Adding a database-backed entity:
1. Add a migration in `supabase/migrations/`.
2. Update/regenerate `lib/database.types.ts`.
3. Add/update hooks following optimistic update + realtime patterns.
4. Add event types in `lib/dataRefreshEvents.ts`.
5. Add toast messages in `lib/toast.ts`.
6. Update validation schemas in `lib/validation-schemas.ts`.

Adding AI behavior:
- Quick Q&A and conversational tools: `services/geminiService.ts` and `services/ai/`.
- Structured agent analysis: `backend/agents/` plus `services/api/pythonBackend.ts`.
- AI must suggest changes for user approval; it should not silently mutate project data.

## Pitfalls

- Multi-pole slots use `baseSlot + (i * 2)`: a 2-pole breaker at slot 1 occupies slots 1 and 3.
- `components/OneLineDiagram.tsx` is large and fragile. Keep edits narrow and verify both render paths.
- `lib/database.types.ts` is generated. Prefer regeneration over manual edits.
- `services/calculations/shortCircuit.ts` and `services/calculations/serviceUpgrade.ts` are high-risk; edit only with tests.
- When renaming/rebranding, search all variants and verify no stale references remain.

## Documentation Maintenance

When work changes user-facing behavior, milestones, database structure, or project status, update the relevant docs before closing:
- `ROADMAP.md`
- `docs/SESSION_LOG.md`
- `docs/CHANGELOG.md`
- `business/STRATEGIC_ANALYSIS.md`
- `business/DISTRIBUTION_PLAYBOOK.md`
- `docs/database-architecture.md`

When updating docs with a "Last Updated" field, set it to the current date.

## Repo Notes

Current package reality from `package.json`:
- React 19
- Vite 6
- Vitest 4
- TypeScript 5.8
- Tailwind v4 via `@tailwindcss/vite`

Relevant directories:
- `components/` UI and feature screens
- `hooks/` Supabase-backed app state hooks
- `services/calculations/` pure NEC/electrical calculation services
- `services/pdfExport/` React PDF and export generation
- `services/ai/` frontend AI orchestration
- `backend/` Python AI backend
- `supabase/migrations/` database migrations
- `docs/adr/` architectural decisions
- `tests/` Vitest coverage
