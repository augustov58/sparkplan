-- ============================================================================
-- T&M BILLING — PHASE 1A: Time entries, materials, project billing settings
-- ============================================================================
-- Created: 2026-05-09
-- Branch:  feat/tm-billing-beta-v1a
-- Plan:    docs/plans/tm-billing-implementation.md
--
-- Phase 1a covers the *capture* layer: workers logging hours, materials being
-- installed, and the per-project rate / customer settings that drive both.
-- Invoicing and payments arrive in Phase 1b (separate migration).
--
-- The `time_entries.invoice_id` and `material_entries.invoice_id` columns are
-- created here as plain UUID references-by-convention. The Phase 1b migration
-- adds the foreign-key constraint to `invoices(id) ON DELETE SET NULL` once
-- that table exists. Until then `invoice_id` simply stays NULL on every row.
--
-- All money is stored as NUMERIC(12,2) — exact arithmetic. The Phase 1b
-- migration extends this with invoices/payments/balance-due columns under the
-- same precision contract.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Shared helper: bump updated_at on UPDATE
-- ---------------------------------------------------------------------------
-- Every other migration in this codebase defines its own per-table trigger
-- function (`update_<table>_updated_at`). We follow the same pattern here so
-- there's no global naming collision.

CREATE OR REPLACE FUNCTION public.update_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE: project_billing_settings
-- ============================================================================
-- Singleton-per-project configuration: billable + cost rate defaults, material
-- markup default, tax %, payment terms, and the customer-info snapshot that
-- gets baked into invoices at generation time.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_billing_settings (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Default rates (per-entry override allowed)
  default_billable_rate NUMERIC(8,2),
  default_cost_rate NUMERIC(8,2),

  -- Materials
  default_material_markup_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,

  -- Tax (applied to taxable materials only — labor not taxed in most US states)
  tax_pct NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Invoice defaults
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  invoice_prefix TEXT,
  next_invoice_number INTEGER NOT NULL DEFAULT 1,

  -- Customer (header on invoices)
  customer_name TEXT,
  customer_email TEXT,
  customer_address TEXT,
  customer_po_number TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pbs_billable_rate_pos
    CHECK (default_billable_rate IS NULL OR default_billable_rate >= 0),
  CONSTRAINT pbs_cost_rate_pos
    CHECK (default_cost_rate IS NULL OR default_cost_rate >= 0),
  CONSTRAINT pbs_markup_range
    CHECK (default_material_markup_pct >= 0 AND default_material_markup_pct <= 200),
  CONSTRAINT pbs_tax_range
    CHECK (tax_pct >= 0 AND tax_pct <= 100),
  CONSTRAINT pbs_terms_range
    CHECK (payment_terms_days >= 0 AND payment_terms_days <= 365),
  CONSTRAINT pbs_invoice_number_pos
    CHECK (next_invoice_number > 0)
);

ALTER TABLE public.project_billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pbs_select_own"
  ON public.project_billing_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "pbs_insert_own"
  ON public.project_billing_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pbs_update_own"
  ON public.project_billing_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "pbs_delete_own"
  ON public.project_billing_settings FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS pbs_updated_at ON public.project_billing_settings;
CREATE TRIGGER pbs_updated_at
  BEFORE UPDATE ON public.project_billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_billing_updated_at();

COMMENT ON TABLE public.project_billing_settings IS
  'Per-project billing configuration: default rates, material markup, tax, customer info. Singleton — one row per project.';
COMMENT ON COLUMN public.project_billing_settings.default_billable_rate IS
  'Default $/hr billed to customer when creating new time entries on this project.';
COMMENT ON COLUMN public.project_billing_settings.default_cost_rate IS
  'Default internal $/hr (payroll-loaded) for profit tracking. Optional.';
COMMENT ON COLUMN public.project_billing_settings.tax_pct IS
  'Sales tax % applied to taxable material entries. Labor not taxed.';

-- ============================================================================
-- TABLE: time_entries
-- ============================================================================
-- One row per worker per day per cost-code. Rates snapshotted at entry time so
-- back-dated rate changes don't mutate already-logged history. Once attached
-- to an invoice (Phase 1b) `invoice_id` becomes non-null and the row is
-- considered "billed". Until then it counts as unbilled.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who + when
  worker_name TEXT NOT NULL,
  work_date DATE NOT NULL,
  hours NUMERIC(6,2) NOT NULL,

  -- What
  description TEXT,
  cost_code TEXT,                                     -- free-text in Phase 1; lookup table arrives in Phase 2

  -- Rates (snapshot)
  billable_rate NUMERIC(8,2) NOT NULL,
  cost_rate NUMERIC(8,2),

  -- Computed totals (denormalized for sort/filter without recomputing)
  billable_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_amount NUMERIC(12,2),

  -- Billing state. Phase 1b adds the FK constraint once `invoices` exists.
  invoice_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT time_entries_hours_pos
    CHECK (hours > 0 AND hours <= 24),
  CONSTRAINT time_entries_rates_pos
    CHECK (billable_rate >= 0 AND (cost_rate IS NULL OR cost_rate >= 0)),
  CONSTRAINT time_entries_amounts_pos
    CHECK (billable_amount >= 0 AND (cost_amount IS NULL OR cost_amount >= 0))
);

CREATE INDEX IF NOT EXISTS idx_time_entries_project_date
  ON public.time_entries(project_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_unbilled
  ON public.time_entries(project_id) WHERE invoice_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice
  ON public.time_entries(invoice_id) WHERE invoice_id IS NOT NULL;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select_own"
  ON public.time_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "time_entries_insert_own"
  ON public.time_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "time_entries_update_own"
  ON public.time_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "time_entries_delete_own"
  ON public.time_entries FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS time_entries_updated_at ON public.time_entries;
CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_billing_updated_at();

COMMENT ON TABLE public.time_entries IS
  'Daily labor log. One row per (worker, day, cost code). Rates snapshotted at entry time. Unbilled while invoice_id IS NULL.';

-- ============================================================================
-- TABLE: material_entries
-- ============================================================================
-- One row per material line installed: qty, supplier invoice $/unit, markup %,
-- billing $/unit (computed). Like time entries, snapshotted at entry time and
-- considered unbilled while invoice_id IS NULL.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.material_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What + when
  installed_date DATE NOT NULL,
  description TEXT NOT NULL,
  cost_code TEXT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT,

  -- Pricing (snapshot)
  invoice_unit_cost NUMERIC(10,4) NOT NULL,
  markup_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  billing_unit_price NUMERIC(10,4) NOT NULL,
  taxable BOOLEAN NOT NULL DEFAULT TRUE,

  -- Computed totals (denormalized)
  billing_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Receipt linkage
  receipt_url TEXT,
  supplier_name TEXT,
  supplier_invoice_number TEXT,

  -- Billing state. Phase 1b adds FK to invoices.
  invoice_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT material_entries_qty_pos CHECK (quantity > 0),
  CONSTRAINT material_entries_pricing_pos
    CHECK (invoice_unit_cost >= 0 AND billing_unit_price >= 0
           AND billing_amount >= 0 AND cost_amount >= 0),
  CONSTRAINT material_entries_markup_range
    CHECK (markup_pct >= 0 AND markup_pct <= 200)
);

CREATE INDEX IF NOT EXISTS idx_material_entries_project_date
  ON public.material_entries(project_id, installed_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_entries_unbilled
  ON public.material_entries(project_id) WHERE invoice_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_material_entries_invoice
  ON public.material_entries(invoice_id) WHERE invoice_id IS NOT NULL;

ALTER TABLE public.material_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_entries_select_own"
  ON public.material_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "material_entries_insert_own"
  ON public.material_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "material_entries_update_own"
  ON public.material_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "material_entries_delete_own"
  ON public.material_entries FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS material_entries_updated_at ON public.material_entries;
CREATE TRIGGER material_entries_updated_at
  BEFORE UPDATE ON public.material_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_billing_updated_at();

COMMENT ON TABLE public.material_entries IS
  'Material lines installed on a project. Qty, supplier cost, markup %, billing price. Unbilled while invoice_id IS NULL.';
