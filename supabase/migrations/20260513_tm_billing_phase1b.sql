-- ============================================================================
-- T&M BILLING — PHASE 1B: Invoices + payments + invoice_id FKs
-- ============================================================================
-- Created: 2026-05-09
-- Branch:  feat/tm-billing-beta-v1b (stacked on feat/tm-billing-beta-v1a)
-- Plan:    docs/plans/tm-billing-implementation.md
--
-- Phase 1b adds the invoicing layer: an `invoices` row aggregates a snapshot
-- of customer info + period totals, with `time_entries.invoice_id` and
-- `material_entries.invoice_id` retrofitted with a real FK pointing here.
-- Payments are recorded against an invoice in a separate table — Phase 1
-- does NOT integrate Stripe; payments are manual entries (check / ACH / wire).
--
-- All money columns: NUMERIC(12,2). Total ≥ 0 enforced. paid_amount ≤ total.
--
-- Atomicity contract: the `generate_invoice_atomic(...)` RPC inserts an
-- invoice row AND links the picked time/material entries to it in a single
-- transaction. The hook layer calls the RPC; partial failures roll back.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: invoices
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  invoice_number TEXT NOT NULL,
  description TEXT,

  -- Period covered
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,

  -- Status: draft → sent → partial_paid → paid (terminal) | overdue | cancelled (terminal)
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Math (denormalized; recomputed from line items + payments)
  subtotal_labor NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_materials NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Customer snapshot (frozen at issuance — see plan §5.2)
  customer_name TEXT,
  customer_email TEXT,
  customer_address TEXT,
  customer_po_number TEXT,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- PDF cache (Phase 4 may overwrite when re-issuing)
  invoice_pdf_url TEXT,
  invoice_pdf_generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT invoices_status_known
    CHECK (status IN ('draft','sent','partial_paid','paid','overdue','cancelled')),
  CONSTRAINT invoices_period_valid
    CHECK (period_end >= period_start),
  CONSTRAINT invoices_amounts_nonneg
    CHECK (subtotal_labor >= 0 AND subtotal_materials >= 0 AND subtotal >= 0
           AND tax_amount >= 0 AND total >= 0 AND paid_amount >= 0
           AND balance_due >= 0),
  CONSTRAINT invoices_paid_le_total
    CHECK (paid_amount <= total + 0.01)  -- allow $0.01 floating-point grace
);

-- Invoice numbers are unique per user (not per project) — matches industry
-- convention where a contractor's invoices are sequential across all jobs.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_per_user
  ON public.invoices(user_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_project
  ON public.invoices(project_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due
  ON public.invoices(status, due_date)
  WHERE status IN ('sent', 'partial_paid');

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_own"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "invoices_insert_own"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices_update_own"
  ON public.invoices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "invoices_delete_own"
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_billing_updated_at();

COMMENT ON TABLE public.invoices IS
  'T&M invoice header. Links to time_entries and material_entries via their invoice_id FK. Customer info snapshotted at issuance.';
COMMENT ON COLUMN public.invoices.balance_due IS
  'total - paid_amount, denormalized. Never updated directly — triggered from payments INSERT/UPDATE/DELETE.';

-- ---------------------------------------------------------------------------
-- Retrofit FK constraints on time_entries.invoice_id and
-- material_entries.invoice_id now that public.invoices exists.
-- ---------------------------------------------------------------------------

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.material_entries
  ADD CONSTRAINT material_entries_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- TABLE: payments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,                 -- 'check' | 'ach' | 'wire' | 'cash' | 'other'
  reference TEXT,                      -- check #, transaction ID, etc.
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payments_amount_pos CHECK (amount > 0),
  CONSTRAINT payments_method_known
    CHECK (payment_method IS NULL OR payment_method IN ('check','ach','wire','cash','other'))
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice
  ON public.payments(invoice_id, payment_date DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select_own"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "payments_insert_own"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "payments_update_own"
  ON public.payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "payments_delete_own"
  ON public.payments FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.payments IS
  'Manual payment records against an invoice. Phase 4 will add Stripe payment-intent integration.';

-- ---------------------------------------------------------------------------
-- Trigger: keep invoices.paid_amount and balance_due in sync with payments
-- ---------------------------------------------------------------------------
-- Each payment INSERT/UPDATE/DELETE recomputes the parent invoice's
-- paid_amount (sum of payments on that invoice) and balance_due (total -
-- paid_amount). Status auto-flips to 'partial_paid' / 'paid' as appropriate
-- — but only when the invoice is currently in a payable state (not 'draft'
-- because drafts haven't been sent yet, and not 'cancelled').

CREATE OR REPLACE FUNCTION public.sync_invoice_paid_totals()
RETURNS TRIGGER AS $$
DECLARE
  target_invoice UUID;
  new_paid NUMERIC(12,2);
  inv_total NUMERIC(12,2);
  inv_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_invoice := OLD.invoice_id;
  ELSE
    target_invoice := NEW.invoice_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO new_paid
    FROM public.payments
    WHERE invoice_id = target_invoice;

  SELECT total, status INTO inv_total, inv_status
    FROM public.invoices WHERE id = target_invoice;

  -- Status: only auto-transition payable invoices. Drafts + cancelled stay put.
  IF inv_status IN ('sent', 'partial_paid', 'paid', 'overdue') THEN
    IF new_paid >= inv_total - 0.01 THEN
      UPDATE public.invoices
        SET paid_amount = new_paid,
            balance_due = GREATEST(0, inv_total - new_paid),
            status = 'paid',
            paid_at = COALESCE(paid_at, NOW())
        WHERE id = target_invoice;
    ELSIF new_paid > 0 THEN
      UPDATE public.invoices
        SET paid_amount = new_paid,
            balance_due = inv_total - new_paid,
            status = CASE
              WHEN status = 'paid' THEN 'partial_paid' -- payment removed/edited downward
              WHEN status = 'overdue' THEN 'overdue'   -- preserve overdue flag
              ELSE 'partial_paid'
            END,
            paid_at = NULL
        WHERE id = target_invoice;
    ELSE
      -- All payments removed → revert to sent
      UPDATE public.invoices
        SET paid_amount = 0,
            balance_due = inv_total,
            status = CASE WHEN status = 'paid' THEN 'sent' ELSE status END,
            paid_at = NULL
        WHERE id = target_invoice;
    END IF;
  ELSE
    -- Just keep the totals in sync, don't touch status.
    UPDATE public.invoices
      SET paid_amount = new_paid,
          balance_due = GREATEST(0, inv_total - new_paid)
      WHERE id = target_invoice;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_sync_invoice_aiud ON public.payments;
CREATE TRIGGER payments_sync_invoice_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_paid_totals();

-- ---------------------------------------------------------------------------
-- RPC: generate_invoice_atomic
-- ---------------------------------------------------------------------------
-- Single-transaction flow: create the invoice row, then link all unbilled
-- time/material entries within the period to it. If anything fails the entire
-- transaction rolls back so we never end up with an invoice without entries
-- or entries pointing at a non-existent invoice.
--
-- The CALLER computes subtotals + tax + total client-side and passes them in
-- (mirrors the pure invoiceGenerator service). The function itself doesn't do
-- math — it just executes the writes atomically.

CREATE OR REPLACE FUNCTION public.generate_invoice_atomic(
  p_project_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_invoice_number TEXT,
  p_invoice_date DATE,
  p_due_date DATE,
  p_subtotal_labor NUMERIC,
  p_subtotal_materials NUMERIC,
  p_subtotal NUMERIC,
  p_tax_amount NUMERIC,
  p_total NUMERIC,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_address TEXT,
  p_customer_po_number TEXT,
  p_description TEXT,
  p_notes TEXT,
  p_time_entry_ids UUID[],
  p_material_entry_ids UUID[],
  p_mark_sent BOOLEAN
)
RETURNS UUID AS $$
DECLARE
  v_user UUID;
  v_invoice_id UUID;
  v_status TEXT;
  v_sent_at TIMESTAMPTZ;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_mark_sent THEN
    v_status := 'sent';
    v_sent_at := NOW();
  ELSE
    v_status := 'draft';
    v_sent_at := NULL;
  END IF;

  INSERT INTO public.invoices (
    project_id, user_id, invoice_number, description,
    period_start, period_end, invoice_date, due_date,
    status, sent_at,
    subtotal_labor, subtotal_materials, subtotal, tax_amount, total,
    paid_amount, balance_due,
    customer_name, customer_email, customer_address, customer_po_number,
    notes
  ) VALUES (
    p_project_id, v_user, p_invoice_number, p_description,
    p_period_start, p_period_end, p_invoice_date, p_due_date,
    v_status, v_sent_at,
    p_subtotal_labor, p_subtotal_materials, p_subtotal, p_tax_amount, p_total,
    0, p_total,
    p_customer_name, p_customer_email, p_customer_address, p_customer_po_number,
    p_notes
  ) RETURNING id INTO v_invoice_id;

  -- Link time entries
  IF p_time_entry_ids IS NOT NULL AND array_length(p_time_entry_ids, 1) > 0 THEN
    UPDATE public.time_entries
      SET invoice_id = v_invoice_id
      WHERE id = ANY(p_time_entry_ids)
        AND user_id = v_user
        AND project_id = p_project_id
        AND invoice_id IS NULL;
  END IF;

  -- Link material entries
  IF p_material_entry_ids IS NOT NULL AND array_length(p_material_entry_ids, 1) > 0 THEN
    UPDATE public.material_entries
      SET invoice_id = v_invoice_id
      WHERE id = ANY(p_material_entry_ids)
        AND user_id = v_user
        AND project_id = p_project_id
        AND invoice_id IS NULL;
  END IF;

  -- Bump the project's next_invoice_number so the next call gets a fresh #
  UPDATE public.project_billing_settings
    SET next_invoice_number = GREATEST(next_invoice_number + 1, 1)
    WHERE project_id = p_project_id AND user_id = v_user;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.generate_invoice_atomic(
  UUID, DATE, DATE, TEXT, DATE, DATE,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  UUID[], UUID[], BOOLEAN
) FROM public;

GRANT EXECUTE ON FUNCTION public.generate_invoice_atomic(
  UUID, DATE, DATE, TEXT, DATE, DATE,
  NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  UUID[], UUID[], BOOLEAN
) TO authenticated;
