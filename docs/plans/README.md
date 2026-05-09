# Implementation Plans

Self-contained planning docs for upcoming features. Each is written for handoff to a **fresh Claude Code context** after `/clear` — they reproduce the surrounding decisions baked into earlier conversations (market research, tier gating, validation philosophy, hook/toast patterns, NEC compliance posture, etc.) so a new agent can pick up without re-deriving anything.

## How to use

After clearing context, hand the new Claude this prompt verbatim:

> Implement the **<feature>** feature per `docs/plans/<feature>-implementation.md`. Phase 1 only. Branch off `main` as `feat/<feature>-beta-v1`.

Each plan's §8 ("Quick context for fresh claude") is a standalone briefing that gives the new agent everything it needs.

## Available plans

| Plan | Pain rank | LOC estimate | Recommended order |
|---|---|---|---|
| [`permits-implementation.md`](permits-implementation.md) | #2 (HIGH) | ~1,800 | **First** — smallest scope, absorbs existing `IssuesLog` UI, fastest win |
| [`estimating-implementation.md`](estimating-implementation.md) | **#1 (CRITICAL)** | ~3,300 | Second — biggest user-pain ranking; auto-takeoff from project model is the differentiator vs IntelliBid/Accubid |
| [`tm-billing-implementation.md`](tm-billing-implementation.md) | #3 (HIGH) | ~4,900 | **Last** — financial-precision risk, 5 new tables, biggest scope. Strongly consider splitting into Phase 1a + Phase 1b as two PRs. |

## Why this order (not by pain rank)

The market research ranks Estimating #1 in pain severity. We're recommending Permits first anyway because:

1. **Permits absorbs already-built code.** The existing `IssuesLog` component becomes a tab inside the new Permits page. ~30% of the work is already done.
2. **Permits has a clear lifecycle.** Status transitions are well-defined; the data model is small (2 new tables).
3. **Permits is a short feedback loop.** ~1,800 LOC in one PR vs Estimating's ~3,300 or Billing's ~4,900. Faster to ship → faster to learn.
4. **Permits informs the others.** Inspection results often drive change orders (T&M) and re-estimates (Estimating). Building the permit-tracking layer first gives the other two features more to integrate against later.

Pain rank tells you what users want. Implementation order optimizes for **shipping cadence + risk**.

## Shared assumptions across all three plans

These come from the codebase (CLAUDE.md + existing patterns) and prior session decisions. Don't re-derive them:

- **Tier gating is already done** in PR #29 — `permits`, `estimating`, `tm-billing` are all in `FEATURE_TIERS` as `['business', 'enterprise']`. Trial users get access automatically via `effectivePlan`.
- **Sidebar entries already exist** as `(beta)`-chipped items in `Layout.tsx`. Don't touch the sidebar.
- **Stub pages currently render `BetaFeatureStub`** with a "Tell us" feedback CTA. Each implementation replaces the stub with a real component.
- **All hooks follow `hooks/usePanels.ts` pattern**: optimistic updates + Supabase realtime subscription + toast on each operation.
- **All toasts route through `lib/toast.ts`** — never call `toast.success(...)` directly.
- **All forms use React Hook Form + Zod** — schemas in `lib/validation-schemas.ts`. **Validation is advisory, not blocking** (per user memory) — soft warnings, save partial drafts.
- **Tests don't mock the database** — integration tests hit real Supabase (per user memory).
- **PDF generation uses `@react-pdf/renderer`** — `services/pdfExport/PermitPacketDocuments.tsx` is the reference for component structure. Reuse `BrandBar` and `BrandFooter` from `permitPacketTheme.tsx`.
- **`feature_interest` table exists** for capturing demand signal across all three betas. Not needed during implementation but worth knowing.
- **NEVER commit directly to `main`.** Each plan specifies the branch name.
- **Run `npm run build && npm test` after each significant change** per CLAUDE.md verification protocol.

## Plan structure (consistent across all three)

Each plan has 10 sections:

1. **Why this feature** — market context, competitive landscape
2. **Domain model** — workflow diagram, observations from real-world use
3. **Phase split** — 4-phase breakdown so MVP doesn't sprawl
4. **Phase 1 detailed plan** — data model, file tree, ASCII UI mockups, status transitions, math, tests, docs
5. **Decisions to confirm** — yes/no calls to resolve before code
6. **Out of scope** — explicitly deferred items (with phase ownership)
7. **File-by-file implementation order** — keep-build-green sequencing
8. **Quick context for fresh claude** — standalone briefing for context-blank agents
9. **Estimated PR size** — LOC + commit count
10. **Phase 1 Definition of Done** — completion checklist

This structure is intentional: §8 lets a fresh agent self-bootstrap; §5 + §6 let you (the human) push back on assumptions before code starts.

## When to update these plans

- **Before starting implementation**: review §5 decisions, push back on anything wrong, edit the plan in-place. The plan is a contract with future-Claude.
- **During implementation**: if reality diverges from the plan, update the plan as you go. Don't let the doc rot.
- **After implementation**: archive (rename to `*-implemented.md` or move to `docs/plans/archive/`). Don't delete — the rationale is useful for retrospectives.

## Phase 0 — already shipped

- **PR #29** (merged 2026-05-09) — sidebar contractor pivot. Adds the three `(beta)` entries (Estimating / Permits / T&M Billing), creates `feature_interest` table, sets up Business+ tier gating. **Phase 0 IS the demand-discovery step**; the three Phase-1 builds are the demand-fulfillment step.
