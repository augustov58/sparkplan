---
name: nec-calc-service
description: Add or modify NEC calculation services in services/calculations/ and NEC lookup tables in data/nec/. Use for ANY change to load calcs, demand factors, conductor sizing, short circuit, voltage drop, EV/EVEMS, grounding, or service upgrade logic. Safety-critical — wrong values cascade into every user's permit documents.
---

# NEC Calculation Service

Electrical calculations here end up on permit documents reviewed by AHJs and stamped by a PE. A wrong constant is not a bug, it's a liability. Follow this procedure exactly.

## The Contract (every calc service, no exceptions)

1. **Pure function.** No DB calls, no hooks, no side effects, no imports from `lib/supabase` or `hooks/`. Input → output. Components and hooks call the service, never the reverse.
2. **Never throw.** Bad input or non-compliant results return a result object with warnings. Example: 8% voltage drop returns `{ isCompliant: false, warnings: ['CRITICAL: ...'] }` — it does not throw. The UI decides presentation.
3. **Result shape must include:**
   - `necReferences: string[]` — every NEC article actually applied (audit trail for the PE)
   - `warnings: string[]` — prefix severity: `INFO:` → `WARNING:` → `CRITICAL:`
   - `breakdown` or `details` — itemized sub-results so the narrative PDF can show its work

## Procedure: new calculation

1. Types in `types.ts` (input + result interfaces, unit-suffixed field names: `_VA`, `_kVA`, `_kW`, `_pct`, `_ft`).
2. Service in `services/calculations/<name>.ts`. Header comment lists NEC articles. Export from `services/calculations/index.ts`.
3. Tests in `tests/` (see `tests/calculations.test.ts` for the idiom). Cover: happy path, boundary at each table breakpoint, over-table fallback, non-compliant input returning warnings (not throwing).
4. Component in `components/`, route in `App.tsx` (lazy-loaded with `Suspense`).
5. Run `npm run build` and `npm test` before claiming done.

## Procedure: NEC table data (`data/nec/`)

- Typed array constants + a lookup function. Never inline magic numbers in services.
- **Cross-check every value against the actual NEC book or a verified reference before committing.** One wrong ampacity (25A vs 20A for 12 AWG Cu@60°C) mis-sizes conductors for every user.
- Lookup functions always have a fallback: input beyond table → return largest entry, plus a warning.
- **Upsize gotcha:** when writing "next size up" lookups, `>=` comparisons can return the same row you're upsizing from. Verify the result is actually a *different* entry.

## Domain rules that weaker models get wrong

- **NEC 220.87 (existing load):** only `calculated` skips the 1.25×. Measured demand (`utility_bill`, `load_study`) is taken **at 125%** per NEC 220.87(2) — "the maximum demand at 125 percent plus the new load" must not exceed the service rating. `calculated` (NEC 220 Part III) is used directly: its demand factors already provide diversity, and adding 1.25× double-counts. `manual` gets 1.25× as a defensive default. (PE-confirmed 2026-07-09, PR #118; supersedes both earlier interpretations. Three implementation sites must stay in sync: `serviceUpgrade.ts`, `PermitPacketDocuments.tsx::NEC22087NarrativePage`, `multiFamilyEV.ts`.)
- **Short circuit (`shortCircuit.ts`):** 3-phase impedance multiplier is **1×, not 1.732×**. The wrong value underestimates fault current 40–50%. IEEE 141 compliant — do not modify without a cited reason.
- **EVSE load is edition-specific:** NEC 2023 220.57(A) = `max(7,200 VA, nameplate)`; NEC 2020 (Florida) has **no 220.57** — nameplate per 220.14(A). Both at 100% in the load calc (625.41's 125% is OCPD/conductor sizing). Always call `getEvseLoadVA(nameplateVA, edition)` from `data/nec/evse-load.ts`; resolve the edition with `resolveNecEdition()` in `data/ahj/registry.ts`. (PE-confirmed 2026-09-27.)
- **EVEMS (NEC 625.42):** size to the EVEMS *setpoint*, not full connected load — that's the whole point of load management.
- **Demand factors are non-cascading.** Apply once per load type to *system-wide totals*, never per-panel through the hierarchy. Wrong: 35% at each panel. Right: sum all lighting VA across the hierarchy, apply the NEC 220.42 tiers once.
- **Rounding:** only at final output. kVA → 2 decimals; amps → 0 decimals for service sizing, 1 decimal intermediate; percentages → 1 decimal; conductor sizes are string enums, never rounded.

## Stable modules — do not touch without explicit user request

`shortCircuit.ts`, `serviceUpgrade.ts` (both safety-critical and PE-validated), `lib/database.types.ts` (auto-generated — regenerate via Supabase CLI instead).

## Done means

- [ ] `npm run build` exits 0, `npm test` all green
- [ ] Result has `necReferences`, severity-prefixed `warnings`, `breakdown`
- [ ] No magic numbers — every constant traceable to `data/nec/`
- [ ] Tests cover table boundaries and the over-table fallback
- [ ] If the calc feeds the permit packet, the narrative wording matches the method actually used (NEC 220 Part III language for calculated, 220.87 for measured)
