# Implementation Plan — Estimating (beta) Feature

**Status**: Ready for implementation
**Created**: 2026-05-09
**Owner**: Augusto (FL-licensed PE + platform owner)
**Predecessor**: PR #29 (`feat/sidebar-contractor-betas`) — adds the beta sidebar entry + `/estimating` stub route + `feature_interest` table for demand discovery
**Tier gating**: Business + Enterprise (matches sibling PM features). Trial users have full access via `effectivePlan` when `status === 'trialing'`.

---

## 1. Why this feature

External market research ranked **estimating + job costing** as the **#1 CRITICAL** unmet pain point for SparkPlan's target persona ($1M–$10M small electrical shops). Specific findings:

- A 200A panel upgrade alone is $800-$1,500 in material. Add wire, conduit, breakers, and a single residential job has $1,000-$3,000 in parts.
- Most small shops estimate in spreadsheets. They don't know if they're making or losing money until the project closes.
- Existing solutions: **IntelliBid** ($3,000+ perpetual license, desktop-only, built for large commercial), **Trimble Accubid** (enterprise pricing). Nothing modern and affordable for small shops.
- **Gap**: A cloud-based estimating tool with electrical-specific assemblies (panel schedules, circuit runs, device counts) at $99-$199/month.

SparkPlan's electrical-specific data model (panels, circuits, feeders, transformers) is the differentiator — every other estimating tool starts from a blank takeoff. SparkPlan starts from a project that already knows what's in it.

---

## 2. Domain model — the workflow we're modeling

```
SCOPE INTAKE
   │
   ▼
TAKEOFF (count materials, measure runs, identify assemblies)
   │     ─ pulled automatically from existing panels/circuits/feeders
   │       where possible; manually added for fixtures/devices/rough-in
   ▼
MATERIAL PRICING (per-line price × qty, possibly with category markup)
   │
   ▼
LABOR HOURS (per-line hours from NECA labor units OR per-assembly OR custom)
   │
   ▼
MARKUP (overhead + profit, typically 15-30% combined)
   │
   ▼
BID OUTPUT (PDF, line-item breakdown OR lump-sum, customer-facing)
   │
   ▼
WIN/LOSS TRACKING (post-bid status; informs future markup tuning)
```

Critical observations from contractor workflow:
- **Estimates are revisable.** Customer asks "what if we drop the EV charger?" — contractor needs to clone the estimate, modify, regenerate. **Plan for revision history.**
- **Material prices are volatile.** Copper alone moves 5-15% monthly. Estimates have a "valid through" date; quoted price honored only within that window. **Plan for price snapshots, not live lookups.**
- **Labor units are personal.** Some shops use NECA Manual of Labor Units (industry standard); some have their own time studies; some just guess. Hard-coding NECA values is wrong — let the contractor configure their own labor rate (per-circuit, per-fixture, per-foot-of-conduit).
- **Markup happens at multiple levels.** Material markup (typically 25%), then overall job markup (overhead 10-15% + profit 10-15%). Some contractors apply per-category markup (material 25%, labor 0%); some apply blended markup. **Plan for both.**
- **Tax differs by jurisdiction.** Material is sales-taxable in most states; labor isn't. Estimate must call out tax line-item.

---

## 3. Phase split

| Phase | Scope | Effort | Ships when |
|---|---|---|---|
| **Phase 1 (MVP)** — this plan | Manual line-item estimate. Per-project material catalog (no global price list yet). Labor as hours × rate. Simple total-job markup. PDF bid output. Estimate status: draft / submitted / accepted / rejected / expired. Auto-populate from existing project (panels, circuits, feeders). | ~2 weeks | First |
| **Phase 2** | Pre-built assemblies (200A service upgrade, kitchen remodel circuit, EV charger install — bundle materials + labor). User can save custom assemblies. Per-category markup. Tax handling per jurisdiction. | ~2 weeks | After Phase 1 |
| **Phase 3** | AI-assisted takeoff — chatbot tools `generate_estimate_from_project`, `add_assembly`, `tune_markup`. Auto-suggest assemblies based on project shape (multi-family detected → suggest meter stack assembly). | ~2 weeks | After Phase 2 |
| **Phase 4** (deferred) | External price feeds (Lowe's Pro API, Home Depot, supplier integrations like Graybar/Rexel). Real-time price snapshots on estimate creation. Revision diff visualization. | ~3-4 weeks | Post-validation |

**This document plans Phase 1 only.**

---

## 4. Phase 1 — Detailed plan

### 4.1 Goal

Replace the current `/estimating` stub (in `components/EstimatingStub.tsx`) with a real estimating page. The new page is a **tabbed interface** with five tabs:

1. **Overview** — bid summary, total $, breakdown card (materials / labor / markup / tax)
2. **Takeoff** — auto-populated from project (one row per panel, one per feeder, etc.) + manually-added items
3. **Materials** — flat list of all material line items, qty × unit price
4. **Labor** — hours per task or per assembly, rate × hours
5. **Bid output** — PDF preview, generate button, download link

Each project can have multiple estimates (initial, revised, final). Estimate status flows: `draft → submitted → accepted | rejected | expired`.

### 4.2 Data model — new tables

#### `estimates`

```sql
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,                              -- e.g. "Initial bid", "Revision 2"
  estimate_number TEXT,                            -- nullable; auto-generated by app on submit
  revision INTEGER NOT NULL DEFAULT 1,             -- 1 for initial, increments on clone

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
                                                   -- 'draft' | 'submitted' | 'accepted'
                                                   -- | 'rejected' | 'expired' | 'cancelled'
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,                          -- accepted_at OR rejected_at
  expires_at TIMESTAMPTZ,                          -- bid validity, often submitted + 30 days

  -- Customer
  customer_name TEXT,
  customer_email TEXT,
  customer_address TEXT,

  -- Math (denormalized totals for sort/filter; recompute from line items on save)
  subtotal_materials NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_labor NUMERIC(12,2) NOT NULL DEFAULT 0,
  markup_pct NUMERIC(5,2) NOT NULL DEFAULT 25.00,  -- total-job markup (overhead + profit)
  markup_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(5,2) NOT NULL DEFAULT 0,         -- sales tax on materials
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Notes
  scope_summary TEXT,                              -- shown on bid PDF as scope of work
  exclusions TEXT,                                 -- "permits not included", etc.
  payment_terms TEXT,                              -- "Net 30", "50% upfront", etc.
  internal_notes TEXT,                             -- not on PDF; for the contractor only

  -- PDF cache
  bid_pdf_url TEXT,                                -- supabase storage URL of last generated PDF
  bid_pdf_generated_at TIMESTAMPTZ,

  -- Win/loss reason (for post-bid analysis)
  outcome_reason TEXT,                             -- "lost on price", "spec changed", etc.

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT estimates_status_known
    CHECK (status IN ('draft','submitted','accepted','rejected','expired','cancelled')),
  CONSTRAINT estimates_markup_range
    CHECK (markup_pct >= 0 AND markup_pct <= 100),
  CONSTRAINT estimates_tax_range
    CHECK (tax_pct >= 0 AND tax_pct <= 100),
  CONSTRAINT estimates_total_nonneg
    CHECK (total >= 0)
);

CREATE INDEX idx_estimates_project ON public.estimates(project_id);
CREATE INDEX idx_estimates_status ON public.estimates(status, expires_at) WHERE status = 'submitted';
CREATE INDEX idx_estimates_user ON public.estimates(user_id);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estimates_select_own" ON public.estimates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "estimates_insert_own" ON public.estimates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "estimates_update_own" ON public.estimates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "estimates_delete_own" ON public.estimates FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

#### `estimate_line_items`

```sql
CREATE TABLE public.estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Position in the estimate
  position INTEGER NOT NULL DEFAULT 0,             -- ordering for display

  -- Categorization
  category TEXT NOT NULL,
                                                   -- 'material' | 'labor' | 'equipment' | 'subcontract' | 'other'
  description TEXT NOT NULL,                       -- "12 AWG THHN Cu, 500 ft", "Rough-in labor, kitchen"

  -- Pricing
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT,                                       -- 'ea' | 'ft' | 'hr' | 'lf' | etc
  unit_cost NUMERIC(10,4) NOT NULL DEFAULT 0,      -- internal cost per unit
  unit_price NUMERIC(10,4) NOT NULL DEFAULT 0,     -- billed price per unit (cost + line markup)
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,     -- = quantity * unit_price

  -- Source linkage (for auto-populated rows)
  source_kind TEXT,                                -- 'panel' | 'feeder' | 'circuit' | 'transformer' | 'manual' | 'assembly'
  source_id UUID,                                  -- nullable FK to the source row (no constraint — soft link)
  assembly_key TEXT,                               -- nullable; identifies which assembly emitted this row

  -- Tax/markup flags (for per-line override of estimate-level markup)
  taxable BOOLEAN NOT NULL DEFAULT TRUE,
  markup_overridden BOOLEAN NOT NULL DEFAULT FALSE,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT estimate_line_items_category_known
    CHECK (category IN ('material','labor','equipment','subcontract','other')),
  CONSTRAINT estimate_line_items_qty_nonneg
    CHECK (quantity >= 0),
  CONSTRAINT estimate_line_items_pricing_nonneg
    CHECK (unit_cost >= 0 AND unit_price >= 0 AND line_total >= 0)
);

CREATE INDEX idx_estimate_line_items_estimate ON public.estimate_line_items(estimate_id, position);
CREATE INDEX idx_estimate_line_items_category ON public.estimate_line_items(estimate_id, category);

ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estimate_line_items_select_own" ON public.estimate_line_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "estimate_line_items_insert_own" ON public.estimate_line_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "estimate_line_items_update_own" ON public.estimate_line_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "estimate_line_items_delete_own" ON public.estimate_line_items FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER estimate_line_items_updated_at
  BEFORE UPDATE ON public.estimate_line_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

#### Migration filename

`supabase/migrations/20260511_estimates_and_line_items.sql`

> **Verify** `public.set_updated_at()` exists before running. Same caveat as the Permits plan.

### 4.3 File tree

#### New files

```
components/Estimating/
  EstimatingPage.tsx               -- Top-level tabs (Overview/Takeoff/Materials/Labor/Bid output)
  EstimatesListView.tsx            -- List of estimates for a project (when no estimate selected)
  EstimateDetailView.tsx           -- The 5-tab interface for a single estimate
  EstimateOverviewTab.tsx          -- Summary card + breakdown
  TakeoffTab.tsx                   -- Auto-populated rows from project + add/edit
  MaterialsTab.tsx                 -- Material-only line-item list
  LaborTab.tsx                     -- Labor-only line-item list
  BidOutputTab.tsx                 -- PDF preview + generate
  EstimateLineItemRow.tsx          -- Editable row used across tabs
  EstimateStatusPill.tsx           -- Reusable status pill
  EstimateMarkupCard.tsx           -- Markup % editor
  CloneEstimateModal.tsx           -- "Create revision" flow

hooks/
  useEstimates.ts                  -- CRUD, optimistic+realtime, pattern of usePanels
  useEstimateLineItems.ts          -- Same pattern, scoped to estimate_id

services/
  estimating/
    estimateMath.ts                -- Pure functions: subtotal, applyMarkup, computeTotal
    autoTakeoffFromProject.ts      -- Pure: project → suggested line items array
    estimateStatusTransitions.ts   -- Pure: valid next-status from current
    estimatePdfGenerator.ts        -- React-PDF Document for bid output
  pdfExport/
    BidPdfDocuments.tsx            -- Page components for the bid PDF (mirrors PermitPacketDocuments.tsx pattern)

lib/
  validation-schemas.ts            -- Add estimateSchema + estimateLineItemSchema (Zod)

supabase/migrations/
  20260511_estimates_and_line_items.sql

tests/estimating/
  estimateMath.test.ts             -- pure function unit tests
  autoTakeoffFromProject.test.ts   -- pure function unit tests
  estimateStatusTransitions.test.ts
  estimatesCrud.test.ts            -- integration test
```

#### Modified files

| File | Change |
|---|---|
| `App.tsx` | Replace `<EstimatingStub>` with `<EstimatingPage>` for `/estimating` route. Keep `<FeatureGate feature="estimating">`. Lazy import update. |
| `components/EstimatingStub.tsx` | Delete (functionality moved into `EstimatingPage`). |
| `lib/database.types.ts` | Regenerate after migration (or manually patch). |
| `lib/dataRefreshEvents.ts` | Add `estimates` and `estimate_line_items` event types. |
| `lib/toast.ts` | Add `toastMessages.estimate` and `toastMessages.estimateLineItem`. |
| `services/ai/projectContextBuilder.ts` | Phase 1: surface estimate count + most-recent estimate status in AI context. Phase 3 will add full detail. |
| `docs/database-architecture.md` | New `estimates` + `estimate_line_items` table sections. |
| `docs/CHANGELOG.md` | New entry. |
| `docs/SESSION_LOG.md` | New session entry. |
| `ROADMAP.md` | Add Phase 3.7 (Estimating Beta v1) section. |

### 4.4 UI structure

#### List view (when no estimate selected)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Estimating  (beta)                                  [+ New estimate] │
├──────────────────────────────────────────────────────────────────────┤
│ Estimates for this project (3)                                       │
│                                                                      │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Initial bid           [SUBMITTED]   $24,150   Expires in 12 d  │   │
│ │ Customer: Smith Residence                                      │   │
│ │ Created 2026-04-22 · Submitted 2026-04-25                      │   │
│ └────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ ┌────────────────────────────────────────────────────────────────┐   │
│ │ Revision 2 (no EVSE)  [DRAFT]       $18,400                    │   │
│ │ Cloned from "Initial bid" · Created 2026-04-28                 │   │
│ └────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

#### Detail view (estimate selected) — Overview tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ Initial bid · Smith Residence       [SUBMITTED ▾]  [Clone] [Generate]│
├──────────────────────────────────────────────────────────────────────┤
│ [Overview] [Takeoff] [Materials] [Labor] [Bid Output]                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Materials       $11,400                                            │
│   Labor            6,250                                             │
│   ─────────────                                                      │
│   Subtotal       $17,650                                             │
│   Markup (25%)    +4,413                                             │
│   Tax (6.5%)        +740                                             │
│   ─────────────                                                      │
│   TOTAL          $22,803                                             │
│                                                                      │
│   Customer: Smith Residence                                          │
│   Email:    smith@example.com                                        │
│   Address:  123 Oak Ln, Orlando FL 32801                             │
│                                                                      │
│   Scope: 200A service upgrade with EV charger circuit. Includes...   │
│                                                                      │
│   Exclusions: Permits and impact fees are billed separately.         │
│                                                                      │
│   Payment terms: 50% deposit, balance due on completion.             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Takeoff tab

Auto-populated rows from the project at creation time (snapshot). User can add/remove/edit:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Takeoff (auto-populated from project)                                │
│                                                                      │
│ Description                       Qty   Unit  Unit$    Line$         │
│ ──────────────────────────────────────────────────────────────────── │
│ MDP, 200A 1Φ panel + main         1     ea    $620.00  $620.00       │
│ Branch panel H1, 100A             1     ea    $185.00  $185.00       │
│ Feeder F1, #2 Cu THHN, 35 ft      35    ft    $4.85    $169.75       │
│ EMT 1", 35 ft + fittings          35    ft    $3.20    $112.00       │
│ Branch circuit, 20A 1P, x12       12    ea    $24.50   $294.00       │
│ ...                                                                  │
│                                                                      │
│ + Add line                                                           │
└──────────────────────────────────────────────────────────────────────┘
```

#### Bid Output tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ Bid PDF                                                              │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────┐     │
│ │ [PDF preview iframe of generated bid]                        │     │
│ └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│ Last generated: 2026-05-09 11:42                                     │
│ [Regenerate PDF]  [Download]                                         │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.5 Auto-takeoff from project

Pure function `autoTakeoffFromProject(project, panels, circuits, feeders, transformers): EstimateLineItem[]`:

- For each panel: emit a row with default unit cost from a tiny built-in table (200A panel = $620, 100A = $185, etc. — start small, ~10 entries; user can override per-line)
- For each feeder: emit a "feeder conductor" row (qty = `distance_ft × sets_in_parallel`, unit = ft, cost from another tiny table by AWG/material). Emit a separate "conduit" row (same qty in ft) and a "labor" row (hours = ft × NECA-style 0.05 hr/ft default, but user-editable).
- For each circuit: emit a generic "branch circuit" line (qty = 1, unit = ea, default $24.50 for the wire+breaker+rough-in bundle). Emit one labor row per category (e.g. all lighting circuits = one bundled labor line).
- For each transformer: emit panel-board cost + setting-and-hookup labor.

**Defaults are hard-coded constants in `services/estimating/defaultPricing.ts`.** Phase 4 replaces these with live lookups; Phase 1 ships with reasonable starting values the user can override per-estimate.

### 4.6 Status transitions

`services/estimating/estimateStatusTransitions.ts`:

```typescript
const TRANSITIONS: Record<EstimateStatus, EstimateStatus[]> = {
  draft:      ['submitted', 'cancelled'],
  submitted:  ['accepted', 'rejected', 'expired', 'draft'],   // can revert to draft
  accepted:   ['cancelled'],                                    // terminal-ish
  rejected:   ['draft'],                                        // can rework + resubmit
  expired:    ['draft', 'submitted'],                           // can refresh or just resubmit
  cancelled:  [],                                               // terminal
};
```

### 4.7 Math (pure functions)

`services/estimating/estimateMath.ts`:

```typescript
export interface LineItem {
  category: 'material' | 'labor' | 'equipment' | 'subcontract' | 'other';
  quantity: number;
  unit_price: number;
  taxable: boolean;
}

export interface EstimateMathInput {
  lineItems: LineItem[];
  markupPct: number;
  taxPct: number;
}

export interface EstimateMathResult {
  subtotalMaterials: number;   // sum of (qty × unit_price) for category='material'
  subtotalLabor: number;       // sum of (qty × unit_price) for category='labor'
  subtotalOther: number;       // equipment + subcontract + other
  subtotal: number;            // sum of all
  taxableSubtotal: number;     // sum of taxable lines
  markupAmount: number;        // subtotal × markupPct / 100
  taxAmount: number;           // taxableSubtotal × taxPct / 100  (tax applied AFTER markup? or BEFORE? — see decision §5)
  total: number;
}
```

**Round only at final output.** Preserve precision in intermediate steps. Per CLAUDE.md calculation-service rules.

### 4.8 PDF generation

`services/estimating/estimatePdfGenerator.tsx` builds a `<Document>` using `@react-pdf/renderer` (same library as permit packet). Pages:

1. Cover — customer info, scope, total
2. Detailed line items (one or more pages) — grouped by category
3. Terms & conditions — exclusions, payment terms, validity date
4. Signature page — signature line for customer + contractor

Reuse the `BrandBar` and `BrandFooter` from `permitPacketTheme.tsx` but with a different brand-strip text ("ESTIMATE" instead of "PERMIT PACKET").

PDF stored in Supabase storage at `{user_id}/estimates/{estimate_id}/bid-{revision}.pdf`. URL stored in `estimates.bid_pdf_url`.

### 4.9 Hooks pattern

`useEstimates` and `useEstimateLineItems` follow `usePanels.ts` exactly: optimistic update, realtime subscription, scoped to project_id (estimates) or estimate_id (line items).

### 4.10 Tests

| Test file | Covers |
|---|---|
| `tests/estimating/estimateMath.test.ts` | Subtotals by category, markup application, tax application (taxable lines only), total round at final, zero-line edge case, all-labor (no taxable) edge case |
| `tests/estimating/autoTakeoffFromProject.test.ts` | Empty project, single MDP, MDP + 2 sub-panels + transformer, feeder distance-to-LF math, multi-pole circuit handling |
| `tests/estimating/estimateStatusTransitions.test.ts` | Every state pair; backwards transitions allowed only where explicit; terminal states have empty next-state arrays |
| `tests/estimating/estimatesCrud.test.ts` | Integration: create estimate, add line items, recompute totals, change status, clone for revision |

Acceptance: ~25 new tests on top of the existing 208 = ~233 passing.

### 4.11 Documentation updates

After merging, per CLAUDE.md "Linked Documents" rules:

| File | Update |
|---|---|
| `docs/CHANGELOG.md` | New "2026-05-XX: Estimating beta v1 (PR #XX)" entry |
| `docs/SESSION_LOG.md` | New session entry; rotate older one |
| `docs/database-architecture.md` | New `estimates` + `estimate_line_items` table sections |
| `ROADMAP.md` | Add **Phase 3.7: Estimating Beta v1** section |
| `business/STRATEGIC_ANALYSIS.md` | Update feature inventory: "Estimating + bid generation" added |
| `business/DISTRIBUTION_PLAYBOOK.md` | Update demo script to include estimate generation |

---

## 5. Decisions to confirm before starting

1. **Tax applied AFTER markup, not before.** Markup compounds on the cost basis (material cost + labor cost = subtotal → +markup → +tax on materials only). Confirmed pattern in residential bidding. Don't tax the markup itself.
2. **Material catalog is per-project for Phase 1.** No global catalog yet. Phase 2 may add one. Avoids the "where do prices come from" question for now.
3. **Default unit prices come from `services/estimating/defaultPricing.ts`** — a hard-coded TS module of ~30 common items. User overrides per-line. Phase 4 replaces with live feeds.
4. **Auto-takeoff is a one-time snapshot, not a live binding.** When the user creates a new estimate, the takeoff populates from the project at that moment. Subsequent project changes (e.g. user adds a panel after creating the estimate) DO NOT propagate. Snapshots are explicit; revisions require cloning.
5. **Revisions clone the entire estimate.** New `estimate.revision = old.revision + 1`. New `estimate.id`. Prior revisions stay as-is for audit trail.
6. **No payment integration in Phase 1.** Stripe is for SparkPlan subscriptions only. Customer payments are out of scope; the estimate just records an `accepted_at` timestamp.
7. **No e-signature in Phase 1.** PDF has a signature line; customer signs offline and sends back. Phase 4 can add DocuSign integration if demand warrants.
8. **Markup is total-job in Phase 1.** Single percentage applied to the post-tax subtotal. Phase 2 adds per-category markup (materials at 25%, labor at 0%, etc.).
9. **Line items have soft FKs to source rows (panel/feeder/etc.) but no hard constraint.** If the user deletes a panel after the estimate is created, the line item's `source_id` becomes orphaned but the estimate is preserved. Acceptable.
10. **Phase 1 has no chatbot tools.** Defer all `generate_estimate_from_project` / `tune_markup` AI tools to Phase 3.

---

## 6. Out of scope for Phase 1

- AI-assisted takeoff (Phase 3)
- Pre-built assemblies (Phase 2)
- Per-category markup (Phase 2)
- Live material price feeds (Phase 4)
- E-signature integration (deferred)
- Customer portal (deferred)
- Win/loss analytics dashboard (deferred — for now just the `outcome_reason` field)
- Multi-currency (US only)
- Partial-payment tracking (T&M Billing's territory, not Estimating's)
- Sales-tax tables per US zip code (Phase 2; Phase 1 has manual tax_pct field)

---

## 7. File-by-file implementation order

1. **Migration** → apply locally → confirm schema.
2. **Types** → regenerate `lib/database.types.ts`.
3. **Toasts + refresh events** → add the new event keys.
4. **Validation schemas** → Zod.
5. **Pure services** in order: `estimateMath.ts` (most foundational) → `estimateStatusTransitions.ts` → `defaultPricing.ts` → `autoTakeoffFromProject.ts`. Add tests for each.
6. **Hooks** → `useEstimates`, `useEstimateLineItems`.
7. **Status pill** → smallest reusable piece.
8. **Tab components** → start with `EstimatesListView`, then `EstimateDetailView`, then each tab inside.
9. **PDF generator** → after UI works.
10. **Routing** → swap `<EstimatingStub>` for `<EstimatingPage>` in App.tsx.
11. **Project context** → surface estimate count.
12. **Tests** → integration test.
13. **Docs**.

After each step: `npm run build && npm test`.

---

## 8. Quick context for fresh claude

If you're picking this up after a context clear:

- **You're working on a Phase-3.7 PR.** Phase 3.5 (sidebar pivot) and Phase 3.6 (Permits) precede this. Phase 3.6 may or may not be merged — check ROADMAP.md.
- **Augusto is the platform owner AND a Florida-licensed PE.** SparkPlan offers PE-as-service as paid upsell.
- **Validation is advisory, not blocking.** Save partial estimates. Don't gate on missing fields. See feedback memory.
- **Don't mock the database in tests.** Integration tests hit a real Supabase.
- **NEVER commit directly to main.** Branch off main as `feat/estimating-beta-v1`.
- **Run `npm run build` and `npm test` after each significant change.**
- **All hooks follow `hooks/usePanels.ts` pattern.** Don't reinvent.
- **All toast messages route through `lib/toast.ts`.**
- **PDF generation uses `@react-pdf/renderer`** — `services/pdfExport/PermitPacketDocuments.tsx` is the reference for component structure.
- **Tier gating is done.** PR #29 added `'estimating': ['business', 'enterprise']` to `FEATURE_TIERS`. Trial users have access automatically.
- **Sidebar entry exists.** Don't touch `Layout.tsx`.
- **Decimal math**: prefer `NUMERIC(12,2)` in DB; use plain `number` in TS but round only at final output. CLAUDE.md calculation-service rules apply.

---

## 9. Estimated PR size

- Migration: ~200 LOC SQL
- Hooks: ~250 LOC TS
- Pure services + tests: ~600 LOC TS (this is the largest chunk — math, takeoff, status, defaults)
- React components: ~1,200 LOC TSX (12 components — bigger than Permits because of the 5 tabs)
- PDF generator: ~400 LOC TSX
- Routing + cleanup: ~30 LOC
- Tests: ~400 LOC TS
- Docs: ~200 LOC markdown

**Total: ~3,300 LOC** across one branch. ~5-6 commits. Single PR but lean toward asking for a draft review halfway.

Build target: 5-6 second clean build, ~233 tests passing.

---

## 10. Phase 1 Definition of Done

- [ ] Migration applied to Supabase
- [ ] `estimates` + `estimate_line_items` tables present, RLS enforced, indexes created
- [ ] `/estimating` route renders `EstimatingPage` (not the stub)
- [ ] Estimates list view + detail view both functional
- [ ] All 5 tabs functional with tab-switching via URL `?tab=` param
- [ ] Estimate CRUD + line item CRUD
- [ ] Status transitions enforced
- [ ] Auto-takeoff from project on new estimate
- [ ] Math is correct: subtotal → markup → tax → total. Tax applied to taxable lines only.
- [ ] PDF generation works; bid PDF is downloadable; Supabase storage URL persists
- [ ] Clone-for-revision flow creates a new estimate with `revision = parent + 1`
- [ ] Sidebar `Estimating (beta)` chip renders correctly (no regression)
- [ ] FeatureGate still in place (Business + Enterprise + trial)
- [ ] `npm run build` clean
- [ ] `npm test` — 230+ tests passing
- [ ] Manual smoke: create project with 2 panels + 1 transformer → new estimate → auto-takeoff populates → edit a line price → markup updates → generate PDF → download → looks right
- [ ] Docs updated

---

**End of plan.** Hand to fresh context with: *"Implement the Estimating feature per `docs/plans/estimating-implementation.md`. Phase 1 only. Branch off main."*
