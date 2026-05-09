-- Migration: Estimating beta v1 — estimates + line items
-- Date: 2026-05-11
-- Purpose: Phase 1 of the Estimating feature. Adds two tables that let a
--          contractor build a per-project bid: `estimates` (header) and
--          `estimate_line_items` (detail). Auto-takeoff from existing panels,
--          feeders, and circuits is implemented in the application layer; this
--          migration just creates the storage.
--
-- Design notes:
--   * Each project may have many estimates (initial, revision 2, etc.).
--   * Status flow: draft -> submitted -> accepted | rejected | expired |
--     cancelled. App-level state machine (estimateStatusTransitions.ts) is the
--     source of truth; the CHECK constraint just rejects unknown values.
--   * Subtotals on `estimates` are denormalized for sort/filter speed — the
--     frontend recomputes from line items on save (see estimateMath.ts).
--   * Markup is total-job in Phase 1; per-category markup is Phase 2.
--   * Line items have a soft FK (`source_id`) to the source row (panel /
--     feeder / circuit / transformer). No DB-level FK — if the user deletes the
--     panel later, the estimate stays intact with an orphaned `source_id`. See
--     plan §5 decision 9.
--
-- Plan: docs/plans/estimating-implementation.md (Phase 1)
-- ============================================================================

-- ============================================
-- 1. estimates (header)
-- ============================================

CREATE TABLE IF NOT EXISTS public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  estimate_number TEXT,
  revision INTEGER NOT NULL DEFAULT 1,

  -- Status + lifecycle
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Customer (denormalized for the bid PDF; not a separate `customers` table
  -- yet — Phase 2 may extract one when CRM-style features arrive).
  customer_name TEXT,
  customer_email TEXT,
  customer_address TEXT,

  -- Money (denormalized totals; recomputed from line items on save)
  subtotal_materials NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_labor NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_other NUMERIC(12,2) NOT NULL DEFAULT 0,
  markup_pct NUMERIC(5,2) NOT NULL DEFAULT 25.00,
  markup_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Notes
  scope_summary TEXT,
  exclusions TEXT,
  payment_terms TEXT,
  internal_notes TEXT,

  -- PDF cache
  bid_pdf_url TEXT,
  bid_pdf_generated_at TIMESTAMPTZ,

  -- Win/loss
  outcome_reason TEXT,

  -- Lineage (for clone-as-revision flow)
  parent_estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT estimates_status_known
    CHECK (status IN ('draft','submitted','accepted','rejected','expired','cancelled')),
  CONSTRAINT estimates_markup_range
    CHECK (markup_pct >= 0 AND markup_pct <= 100),
  CONSTRAINT estimates_tax_range
    CHECK (tax_pct >= 0 AND tax_pct <= 100),
  CONSTRAINT estimates_total_nonneg
    CHECK (total >= 0),
  CONSTRAINT estimates_revision_positive
    CHECK (revision >= 1)
);

CREATE INDEX IF NOT EXISTS idx_estimates_project
  ON public.estimates (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimates_status_expires
  ON public.estimates (status, expires_at)
  WHERE status = 'submitted';
CREATE INDEX IF NOT EXISTS idx_estimates_user
  ON public.estimates (user_id);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimates_select_own"
  ON public.estimates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "estimates_insert_own"
  ON public.estimates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "estimates_update_own"
  ON public.estimates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "estimates_delete_own"
  ON public.estimates FOR DELETE
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.estimates;

COMMENT ON TABLE public.estimates IS
  'Per-project estimate / bid header. Phase 1 (manual takeoff + total-job markup). Multiple estimates per project for initial vs. revisions.';
COMMENT ON COLUMN public.estimates.revision IS
  'Revision number. 1 = initial bid; clone-for-revision creates parent.revision+1.';
COMMENT ON COLUMN public.estimates.parent_estimate_id IS
  'Lineage pointer for clone-as-revision flow. Soft link (ON DELETE SET NULL) so audit trail is preserved.';
COMMENT ON COLUMN public.estimates.bid_pdf_url IS
  'Supabase storage URL of last generated bid PDF. Regenerated each time the user clicks Generate.';

-- ============================================
-- 2. estimate_line_items (detail)
-- ============================================

CREATE TABLE IF NOT EXISTS public.estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Display order within the estimate
  position INTEGER NOT NULL DEFAULT 0,

  -- Categorization
  category TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Pricing
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT,
  unit_cost NUMERIC(10,4) NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Source linkage for auto-populated rows. Soft FK (no DB constraint) so
  -- deleting the source panel/feeder doesn't cascade through the estimate.
  source_kind TEXT,
  source_id UUID,
  assembly_key TEXT,

  -- Per-line tax / markup overrides
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
    CHECK (unit_cost >= 0 AND unit_price >= 0 AND line_total >= 0),
  CONSTRAINT estimate_line_items_source_kind_known
    CHECK (source_kind IS NULL OR source_kind IN
           ('panel','feeder','circuit','transformer','manual','assembly'))
);

CREATE INDEX IF NOT EXISTS idx_estimate_line_items_estimate
  ON public.estimate_line_items (estimate_id, position);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_category
  ON public.estimate_line_items (estimate_id, category);
CREATE INDEX IF NOT EXISTS idx_estimate_line_items_user
  ON public.estimate_line_items (user_id);

ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimate_line_items_select_own"
  ON public.estimate_line_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "estimate_line_items_insert_own"
  ON public.estimate_line_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "estimate_line_items_update_own"
  ON public.estimate_line_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "estimate_line_items_delete_own"
  ON public.estimate_line_items FOR DELETE
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.estimate_line_items;

COMMENT ON TABLE public.estimate_line_items IS
  'Line-item detail rows for an estimate. Auto-populated rows (source_kind != ''manual'') link softly back to panels/feeders/circuits/transformers.';
COMMENT ON COLUMN public.estimate_line_items.unit_cost IS
  'Internal cost per unit (what the contractor pays). Used for margin calculation.';
COMMENT ON COLUMN public.estimate_line_items.unit_price IS
  'Billed price per unit (what the customer sees). line_total = quantity * unit_price.';
COMMENT ON COLUMN public.estimate_line_items.taxable IS
  'Whether this line is subject to sales tax. Materials typically TRUE, labor typically FALSE (varies by state).';
