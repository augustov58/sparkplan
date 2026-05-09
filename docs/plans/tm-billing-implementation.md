# Implementation Plan — T&M Billing (beta) Feature

**Status**: Ready for implementation
**Created**: 2026-05-09
**Owner**: Augusto (FL-licensed PE + platform owner)
**Predecessor**: PR #29 (`feat/sidebar-contractor-betas`) — adds the beta sidebar entry + `/billing` stub route + `feature_interest` table for demand discovery
**Tier gating**: Business + Enterprise (matches sibling PM features). Trial users have full access via `effectivePlan` when `status === 'trialing'`.

---

## 1. Why this feature

External market research ranked **T&M billing + financial tracking** as the **#3 HIGH** unmet pain point for SparkPlan's target persona ($1M–$10M small electrical shops). Specific findings:

- Commercial electrical subcontracting is frequently **Time & Materials billing** tied to project phases, change orders, and AIA pay applications.
- **Jobber** and **Housecall Pro** handle flat-rate residential billing well but struggle with commercial T&M.
- **Knowify** ($149-$549/month) is the only tool specifically targeting this niche for trade contractors. Room for competition.
- Most small commercial shops track time on paper or in spreadsheets, then assemble invoices manually at month-end. Loss of billable hours due to imprecise tracking is real revenue leakage.

**SparkPlan's angle**: invoices generated against the project's actual electrical work model (panels installed, feeder runs completed) — auditable trail from estimate to invoice without spreadsheet round-trips.

---

## 2. Domain model — the workflow we're modeling

```
ESTIMATE / CONTRACT (from Estimating, OR external)
   │
   ▼
PROJECT KICKOFF — billable rate set, cost codes defined
   │
   ▼
DAILY:
  TIME ENTRIES (per worker, per day, per cost code, hours)
  MATERIALS LOG (qty installed, supplier invoice, marked-up billing rate)
  EQUIPMENT (rental hours OR ownership cost)
   │
   ▼
WEEKLY/MONTHLY:
  INVOICE GENERATED — selects unbilled time + materials in window
  CHANGE ORDERS — separate invoices, customer-signed
   │
   ▼
SUBMITTED → CUSTOMER REVIEW → PAID (full or partial) → CLOSED
   │
   │  large jobs: AIA G702/G703 pay-application format with retention
   ▼
PROJECT CLOSE — retention released, final reconciliation
```

Critical observations:
- **T&M is not flat-rate.** It bills *actual* time at a *contracted* rate, plus *actual* materials with markup. The contractor's risk: tracking accurately, not estimating accurately.
- **Cost codes vary.** Some shops use AIA's MasterFormat divisions (16xxx for electrical). Some use NECA. Some have custom codes. **Plan for user-defined cost codes per project or per company.**
- **Billable rate ≠ cost rate.** A journeyman costs $45/hr in payroll but bills at $95/hr. Both numbers matter — billable for the invoice, cost for profitability tracking. **Store both.**
- **Materials get marked up.** Typically 15-25% over invoice price. Sometimes contract-specified. Markup is a separate field per line, defaulting to a per-project setting.
- **Change orders are first-class.** The customer signs a CO before the work proceeds; the CO becomes its own line on subsequent invoices. **Plan for CO entity, not just an invoice line.**
- **Retention is standard for commercial work.** 5-10% withheld until project completion. Tracked across invoices; released as final.
- **AIA G702/G703 format** is the industry standard for pay applications on jobs over ~$50k. The forms are copyrighted by AIA but the *layout* is widely reproduced. SparkPlan can ship a "G702-style" PDF without using AIA's actual forms — same layout, different header.

---

## 3. Phase split

| Phase | Scope | Effort | Ships when |
|---|---|---|---|
| **Phase 1 (MVP)** — this plan | Time entries (per user, per day, per cost code, billable hours). Materials log (qty, invoice price, billing markup). Per-project billable rate + cost rate. Simple T&M invoice generation as PDF. Invoice statuses: draft / sent / partial-paid / paid / overdue / cancelled. | ~2 weeks | First |
| **Phase 2** | Cost codes (project-scoped library). Change orders as first-class entity. Equipment rental tracking. Retention support (% withheld + balance). | ~2 weeks | After Phase 1 |
| **Phase 3** | AIA G702/G703-style PDF format. Multi-period pay applications. AI tools (`add_time_entry`, `summarize_unbilled`, `generate_invoice`). | ~2 weeks | After Phase 2 |
| **Phase 4** (deferred) | Stripe payment-intent integration for invoice payment. Email-invoice flow with click-to-pay. QuickBooks export. Project profitability dashboards. | ~3-4 weeks | Post-validation |

**This document plans Phase 1 only.**

---

## 4. Phase 1 — Detailed plan

### 4.1 Goal

Replace the current `/billing` stub (in `components/TmBillingStub.tsx`) with a real T&M billing page. The new page is a **tabbed interface** with five tabs:

1. **Overview** — project total billed, unbilled, paid, outstanding. Visual breakdown.
2. **Time** — daily time entries, filterable by week/month/worker
3. **Materials** — material lines with invoice price + billing markup
4. **Invoices** — list of invoices, status, totals
5. **Settings** — project billing rates (billable + cost), default markup, payment terms

Each project can have multiple invoices (typically one per billing period). Invoice status flows: `draft → sent → partial-paid → paid | overdue | cancelled`.

### 4.2 Data model — new tables

#### `project_billing_settings`

```sql
CREATE TABLE public.project_billing_settings (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Default rates (can be overridden per time entry)
  default_billable_rate NUMERIC(8,2),                -- $/hr to customer
  default_cost_rate NUMERIC(8,2),                    -- $/hr internal cost (payroll-loaded)

  -- Material markup
  default_material_markup_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,

  -- Tax
  tax_pct NUMERIC(5,2) NOT NULL DEFAULT 0,           -- material tax only; labor not taxed in most states

  -- Invoice defaults
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  invoice_prefix TEXT,                               -- e.g. "INV-2026-" → INV-2026-0001
  next_invoice_number INTEGER NOT NULL DEFAULT 1,

  -- Customer (for header on invoices)
  customer_name TEXT,
  customer_email TEXT,
  customer_address TEXT,
  customer_po_number TEXT,                           -- their purchase order #

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pbs_billable_rate_pos
    CHECK (default_billable_rate IS NULL OR default_billable_rate >= 0),
  CONSTRAINT pbs_cost_rate_pos
    CHECK (default_cost_rate IS NULL OR default_cost_rate >= 0),
  CONSTRAINT pbs_markup_range
    CHECK (default_material_markup_pct >= 0 AND default_material_markup_pct <= 100),
  CONSTRAINT pbs_tax_range
    CHECK (tax_pct >= 0 AND tax_pct <= 100),
  CONSTRAINT pbs_terms_range
    CHECK (payment_terms_days >= 0 AND payment_terms_days <= 365),
  CONSTRAINT pbs_invoice_number_pos
    CHECK (next_invoice_number > 0)
);

ALTER TABLE public.project_billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pbs_select_own" ON public.project_billing_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pbs_insert_own" ON public.project_billing_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pbs_update_own" ON public.project_billing_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER pbs_updated_at
  BEFORE UPDATE ON public.project_billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

#### `time_entries`

```sql
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who + when
  worker_name TEXT NOT NULL,                         -- can be self or another worker
  work_date DATE NOT NULL,
  hours NUMERIC(6,2) NOT NULL,

  -- What
  description TEXT,
  cost_code TEXT,                                    -- free-text in Phase 1 (Phase 2 = lookup table)

  -- Rates (snapshot at entry time — survive rate changes)
  billable_rate NUMERIC(8,2) NOT NULL,
  cost_rate NUMERIC(8,2),

  -- Computed (denormalized for sort/filter)
  billable_amount NUMERIC(12,2) NOT NULL DEFAULT 0,  -- = hours × billable_rate
  cost_amount NUMERIC(12,2),                          -- = hours × cost_rate

  -- Billing state
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,  -- forward-declared; FK created after invoices table

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT time_entries_hours_pos
    CHECK (hours > 0 AND hours <= 24),
  CONSTRAINT time_entries_rates_pos
    CHECK (billable_rate >= 0 AND (cost_rate IS NULL OR cost_rate >= 0)),
  CONSTRAINT time_entries_amounts_pos
    CHECK (billable_amount >= 0 AND (cost_amount IS NULL OR cost_amount >= 0))
);

CREATE INDEX idx_time_entries_project_date ON public.time_entries(project_id, work_date DESC);
CREATE INDEX idx_time_entries_unbilled ON public.time_entries(project_id) WHERE invoice_id IS NULL;
CREATE INDEX idx_time_entries_invoice ON public.time_entries(invoice_id) WHERE invoice_id IS NOT NULL;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "time_entries_select_own" ON public.time_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "time_entries_insert_own" ON public.time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "time_entries_update_own" ON public.time_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "time_entries_delete_own" ON public.time_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

#### `material_entries`

```sql
CREATE TABLE public.material_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What + when
  installed_date DATE NOT NULL,
  description TEXT NOT NULL,
  cost_code TEXT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT,                                          -- 'ea' | 'ft' | 'lb' | etc

  -- Pricing (snapshot)
  invoice_unit_cost NUMERIC(10,4) NOT NULL,           -- supplier invoice $/unit
  markup_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  billing_unit_price NUMERIC(10,4) NOT NULL,          -- = invoice_unit_cost × (1 + markup_pct/100)
  taxable BOOLEAN NOT NULL DEFAULT TRUE,

  -- Computed (denormalized)
  billing_amount NUMERIC(12,2) NOT NULL DEFAULT 0,    -- qty × billing_unit_price
  cost_amount NUMERIC(12,2) NOT NULL DEFAULT 0,       -- qty × invoice_unit_cost

  -- Receipt linkage
  receipt_url TEXT,                                   -- supabase storage URL
  supplier_name TEXT,
  supplier_invoice_number TEXT,

  -- Billing state
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT material_entries_qty_pos CHECK (quantity > 0),
  CONSTRAINT material_entries_pricing_pos
    CHECK (invoice_unit_cost >= 0 AND billing_unit_price >= 0
           AND billing_amount >= 0 AND cost_amount >= 0),
  CONSTRAINT material_entries_markup_range
    CHECK (markup_pct >= 0 AND markup_pct <= 200)
);

CREATE INDEX idx_material_entries_project_date ON public.material_entries(project_id, installed_date DESC);
CREATE INDEX idx_material_entries_unbilled ON public.material_entries(project_id) WHERE invoice_id IS NULL;

ALTER TABLE public.material_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "material_entries_select_own" ON public.material_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "material_entries_insert_own" ON public.material_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "material_entries_update_own" ON public.material_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "material_entries_delete_own" ON public.material_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER material_entries_updated_at
  BEFORE UPDATE ON public.material_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

#### `invoices`

```sql
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity
  invoice_number TEXT NOT NULL,                       -- e.g. "INV-2026-0001"
  description TEXT,                                   -- "Invoice for May 2026 work"

  -- Period covered
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
                                                      -- 'draft' | 'sent' | 'partial_paid'
                                                      -- | 'paid' | 'overdue' | 'cancelled'
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Math (denormalized; recompute from line items)
  subtotal_labor NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_materials NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Customer snapshot at invoice time (so changes to project_billing_settings don't mutate history)
  customer_name TEXT,
  customer_email TEXT,
  customer_address TEXT,
  customer_po_number TEXT,

  -- PDF cache
  invoice_pdf_url TEXT,
  invoice_pdf_generated_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,                                         -- shown on PDF
  internal_notes TEXT,                                -- not shown

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT invoices_status_known
    CHECK (status IN ('draft','sent','partial_paid','paid','overdue','cancelled')),
  CONSTRAINT invoices_period_valid
    CHECK (period_end >= period_start),
  CONSTRAINT invoices_amounts_nonneg
    CHECK (subtotal >= 0 AND total >= 0 AND paid_amount >= 0 AND balance_due >= 0),
  CONSTRAINT invoices_paid_le_total
    CHECK (paid_amount <= total)
);

-- Unique invoice number per user (not per project, since invoice numbers are typically global per business)
CREATE UNIQUE INDEX idx_invoices_number_per_user ON public.invoices(user_id, invoice_number);
CREATE INDEX idx_invoices_project ON public.invoices(project_id);
CREATE INDEX idx_invoices_status ON public.invoices(status, due_date) WHERE status IN ('sent','partial_paid');

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_select_own" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_update_own" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "invoices_delete_own" ON public.invoices FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

#### `payments`

```sql
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  amount NUMERIC(12,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,                                -- 'check' | 'ach' | 'wire' | 'cash' | 'other'
  reference TEXT,                                     -- check #, transaction ID, etc.
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payments_amount_pos CHECK (amount > 0)
);

CREATE INDEX idx_payments_invoice ON public.payments(invoice_id, payment_date);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payments_insert_own" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payments_update_own" ON public.payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "payments_delete_own" ON public.payments FOR DELETE USING (auth.uid() = user_id);
```

#### Migration filename

`supabase/migrations/20260512_tm_billing.sql` — bundled because the tables are deeply interrelated and FKs cross-reference (the `time_entries.invoice_id` and `material_entries.invoice_id` columns are added AFTER `invoices` table is created in the same migration). Use `ALTER TABLE … ADD CONSTRAINT` at the bottom of the migration to add the FKs after both tables exist.

> **Verify** `public.set_updated_at()` exists; same caveat as the other plans.

### 4.3 File tree

#### New files

```
components/Billing/
  BillingPage.tsx                     -- Top-level tabs (Overview/Time/Materials/Invoices/Settings)
  BillingOverviewTab.tsx              -- Project totals + breakdown
  TimeEntriesTab.tsx                  -- Day-grid or list of time entries
  TimeEntryEditor.tsx                 -- Single-entry create/edit form
  MaterialEntriesTab.tsx              -- List of material entries
  MaterialEntryEditor.tsx             -- Single-entry create/edit form
  InvoicesTab.tsx                     -- List of invoices
  InvoiceDetailDrawer.tsx             -- Single-invoice view + payments
  GenerateInvoiceModal.tsx            -- "Create invoice from unbilled in date range" flow
  RecordPaymentModal.tsx              -- Record a payment against an invoice
  BillingSettingsTab.tsx              -- Per-project billing rates + customer info
  InvoiceStatusPill.tsx
  AmountDisplay.tsx                   -- Reusable formatter (USD, with cents, color-coded)

hooks/
  useTimeEntries.ts                   -- CRUD optimistic+realtime
  useMaterialEntries.ts               -- CRUD optimistic+realtime
  useInvoices.ts                      -- CRUD optimistic+realtime
  usePayments.ts                      -- CRUD optimistic+realtime
  useProjectBillingSettings.ts        -- Get/upsert (singleton per project)

services/
  billing/
    billingMath.ts                    -- Pure: subtotals, tax, balance due, paid status
    invoiceGenerator.ts               -- Pure: given (project, period_start, period_end) → invoice draft + line set
    invoiceStatusTransitions.ts       -- Pure: valid next-status transitions
    invoicePdfGenerator.tsx           -- React-PDF Document
  pdfExport/
    InvoicePdfDocuments.tsx           -- Page components for invoice PDF

lib/
  validation-schemas.ts               -- Zod schemas (5 new)

supabase/migrations/
  20260512_tm_billing.sql

tests/billing/
  billingMath.test.ts                 -- Subtotals, tax, balance, partial payments
  invoiceGenerator.test.ts            -- Time + material aggregation across periods
  invoiceStatusTransitions.test.ts
  paymentReconciliation.test.ts       -- Multiple payments adding to total
  billingCrud.test.ts                 -- Integration test
```

#### Modified files

| File | Change |
|---|---|
| `App.tsx` | Replace `<TmBillingStub>` with `<BillingPage>` for `/billing` route. Keep `<FeatureGate feature="tm-billing">`. Lazy import update. |
| `components/TmBillingStub.tsx` | Delete. |
| `lib/database.types.ts` | Regenerate. |
| `lib/dataRefreshEvents.ts` | Add 5 new event types. |
| `lib/toast.ts` | Add `toastMessages.timeEntry`, `materialEntry`, `invoice`, `payment`, `billingSettings`. |
| `services/ai/projectContextBuilder.ts` | Phase 1: surface unbilled total + open invoice count. Phase 3 will add full detail. |
| `docs/database-architecture.md` | New 5 table sections. |
| `docs/CHANGELOG.md`, `SESSION_LOG.md`, `ROADMAP.md` | New entries. |

### 4.4 UI structure

#### Overview tab

```
┌──────────────────────────────────────────────────────────────────────┐
│ T&M Billing  (beta)                              [+ Generate invoice]│
├──────────────────────────────────────────────────────────────────────┤
│ [Overview] [Time] [Materials] [Invoices] [Settings]                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   THIS PROJECT                                                       │
│                                                                      │
│   Billed to date         $48,200.00                                  │
│   Paid                    32,800.00                                  │
│   Outstanding (sent)      15,400.00                                  │
│   Unbilled                 6,200.00     ← can generate invoice now   │
│                                                                      │
│   Total to-be-billed     $54,400.00                                  │
│                                                                      │
│   Profit (so far)         12,150.00     (24.8% margin)               │
│   ────────────                                                       │
│                                                                      │
│   Recent activity                                                    │
│   · 2026-05-08  Time: J. Smith — 8.0 hrs (rough-in)                  │
│   · 2026-05-08  Materials: 500 ft #12 THHN — $185 + 20% markup       │
│   · 2026-05-05  Invoice INV-2026-0008 sent — $9,400                  │
│   · 2026-05-03  Payment received — $7,400 on INV-2026-0007           │
└──────────────────────────────────────────────────────────────────────┘
```

#### Time tab

Day-grid view (week or month) OR flat list (toggle):

```
┌──────────────────────────────────────────────────────────────────────┐
│ Time entries          May 2026 ▾   Worker: All ▾    [+ Add entry]    │
│                                                                      │
│ Date       Worker       Hours  Cost code   Description       Bill$   │
│ ──────────────────────────────────────────────────────────────────── │
│ 2026-05-08 J. Smith     8.0    16-2050     Rough-in lighting $760    │
│ 2026-05-08 R. Garcia    8.0    16-2050     Rough-in lighting $720    │
│ 2026-05-07 J. Smith     6.5    16-2100     Service trim out  $617.50 │
│ ...                                                                  │
│ ──────────────────────────────────────────────────────────────────── │
│ Period total: 47.5 hrs                            Billable: $4,212.50│
└──────────────────────────────────────────────────────────────────────┘
```

#### Generate invoice modal

```
┌────────────────────────────────────────┐
│ Generate invoice                    [×]│
│ ──────────────────────────────────────│
│ Period:                                │
│   From: [2026-05-01]                   │
│   To:   [2026-05-31]                   │
│                                        │
│ Will include:                          │
│   ✓ 47.5 unbilled hours    $4,212.50   │
│   ✓ 12 unbilled materials  $1,985.45   │
│                                        │
│ Tax (6.5% on materials):       $129.05 │
│ ──────────────────────────────────────│
│ Invoice total:               $6,327.00 │
│                                        │
│ Invoice number: [INV-2026-0009     ]   │
│ Due date:       [2026-06-30 (Net 30)]  │
│                                        │
│ Notes (shown on PDF):                  │
│ [Final invoice for kitchen circuit  ]  │
│ [rough-in and service trim work     ]  │
│                                        │
│ ☐ Mark invoice as 'sent' immediately   │
│                                        │
│ [Cancel]                  [Generate]   │
└────────────────────────────────────────┘
```

### 4.5 Invoice generation logic

`services/billing/invoiceGenerator.ts`:

```typescript
export interface GenerateInvoiceInput {
  projectId: string;
  periodStart: string;     // ISO date
  periodEnd: string;       // ISO date inclusive
  unbilledTimeEntries: TimeEntry[];
  unbilledMaterialEntries: MaterialEntry[];
  billingSettings: ProjectBillingSettings;
  invoiceNumber: string;
  customerSnapshot: { name?: string; email?: string; address?: string; po?: string; };
}

export interface GenerateInvoiceResult {
  invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>;
  timeEntryIds: string[];      // IDs to set invoice_id on after invoice insert
  materialEntryIds: string[];
}
```

Pure function:
- Filter entries by period (`work_date >= periodStart && <= periodEnd` for time; `installed_date` for materials).
- Filter to those with `invoice_id IS NULL`.
- Sum subtotals.
- Apply tax to taxable materials only.
- Compute total = labor + materials + tax.
- Return the draft invoice + the IDs of entries to be linked.

The hook layer (`useInvoices.createFromGenerated`) does the transactional INSERT on the invoice, then UPDATE on the time/material entries to set their `invoice_id`. **Use a Supabase RPC function for atomicity** — define `generate_invoice_atomic(...)` in a SQL function so a partial failure doesn't leave entries unlinked.

### 4.6 Status transitions

`services/billing/invoiceStatusTransitions.ts`:

```typescript
const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft:        ['sent', 'cancelled'],
  sent:         ['partial_paid', 'paid', 'overdue', 'cancelled'],
  partial_paid: ['paid', 'overdue', 'cancelled'],
  paid:         [],                            // terminal
  overdue:      ['partial_paid', 'paid', 'cancelled'],
  cancelled:    [],                            // terminal
};
```

Auto-transitions:
- On creation, status = `draft`.
- On user clicking "Send invoice", status = `sent`, `sent_at = now()`.
- On payment recording: if `paid_amount + new_payment >= total`, status = `paid`, `paid_at = now()`. Else status = `partial_paid`.
- Daily cron (or on-page-load check, no cron infra in Phase 1) — if `due_date < today` and `status IN ('sent','partial_paid')`, flag as `overdue`. **Phase 1: simple client-side check that updates status on next page load.** No backend job.

### 4.7 Math (pure functions)

`services/billing/billingMath.ts`:

```typescript
export function computeInvoiceTotals(
  timeEntries: TimeEntry[],
  materialEntries: MaterialEntry[],
  taxPct: number,
): {
  subtotalLabor: number;
  subtotalMaterials: number;
  subtotal: number;
  taxableSubtotal: number;
  taxAmount: number;
  total: number;
}

export function computeBalanceDue(
  invoice: Invoice,
  payments: Payment[],
): number   // total - sum(payments)

export function deriveInvoiceStatus(
  current: InvoiceStatus,
  paidAmount: number,
  total: number,
  dueDate: string | null,
  today: Date,
): InvoiceStatus
```

**All money is `number` (cents-as-dollars float) in TS for ease of UI but stored as `NUMERIC(12,2)` in DB.** Round to 2 decimals only at final output. CLAUDE.md calculation-service rules apply (this is financial math — extra precision matters).

### 4.8 PDF generation

Standard T&M invoice format (NOT AIA-style — that's Phase 3). Pages:

1. Header — company info, customer info, invoice #, period, due date
2. Labor lines — date, worker, hours, rate, amount
3. Material lines — date, description, qty, unit price, amount
4. Subtotal / tax / total breakdown
5. Payment terms + remit-to address

Reuse `BrandBar` and `BrandFooter` from `permitPacketTheme.tsx`. Brand strip text "INVOICE".

PDF stored at `{user_id}/invoices/{invoice_id}/invoice.pdf`.

### 4.9 Hooks pattern

All five new hooks (`useTimeEntries`, `useMaterialEntries`, `useInvoices`, `usePayments`, `useProjectBillingSettings`) follow `usePanels.ts`. Settings is a singleton (one row per project) — use `upsert` instead of `insert`.

### 4.10 Tests

| Test file | Covers |
|---|---|
| `tests/billing/billingMath.test.ts` | Subtotals (labor only, materials only, mixed), tax (taxable + non-taxable mix), partial-payment math, exact-cent rounding, zero-line edge case |
| `tests/billing/invoiceGenerator.test.ts` | Period-window filtering, only-unbilled filter, multi-worker time aggregation, multi-tax-rate edge case, empty-period edge case |
| `tests/billing/invoiceStatusTransitions.test.ts` | Every state pair; `paid` is terminal; `overdue` auto-derived from `due_date < today` |
| `tests/billing/paymentReconciliation.test.ts` | Multiple partial payments summing to total, overpayment edge case (rejected by DB constraint), refund edge case (deferred to Phase 4) |
| `tests/billing/billingCrud.test.ts` | Integration: create time entry, create material entry, generate invoice, record payment, mark paid |

Acceptance: ~30 new tests on top of existing 208 = ~238 passing.

### 4.11 Documentation updates

| File | Update |
|---|---|
| `docs/CHANGELOG.md` | New "T&M Billing beta v1" entry |
| `docs/SESSION_LOG.md` | New session entry |
| `docs/database-architecture.md` | 5 new table sections |
| `ROADMAP.md` | Add **Phase 3.8: T&M Billing Beta v1** section |
| `business/STRATEGIC_ANALYSIS.md` | Update feature inventory: "T&M billing + invoicing" |
| `business/DISTRIBUTION_PLAYBOOK.md` | Update demo script |

---

## 5. Decisions to confirm before starting

1. **Invoice numbers are user-scoped, not project-scoped.** A contractor's invoices INV-2026-0001..INV-2026-9999 are sequential across all their projects, not per-project. Matches industry convention. Enforced by unique index on `(user_id, invoice_number)`.
2. **Customer info snapshotted at invoice creation.** Changes to `project_billing_settings.customer_*` after the invoice is generated DO NOT mutate the issued invoice. Per accounting integrity.
3. **Time-entry `invoice_id` and `material_entry.invoice_id` are nullable and set atomically.** A row is "unbilled" if `invoice_id IS NULL`. Use a Supabase RPC for the multi-table transaction; do not split the writes between the client.
4. **Phase 1 has no AIA G702/G703 format.** Standard T&M invoice only. AIA-style is Phase 3.
5. **Phase 1 has no Stripe payment integration.** Payments are recorded manually (`payments` table). Stripe payment-intent collection is Phase 4.
6. **Phase 1 has no cost code lookup table.** `cost_code` is free-text on time entries and material entries. Phase 2 introduces a per-project cost code library.
7. **Phase 1 has no change orders.** Change orders are a separate entity in Phase 2 (`change_orders` table linked to invoices).
8. **No retention support in Phase 1.** Retention requires invoice-to-invoice math (cumulative withholding across pay applications) — Phase 2.
9. **No equipment rental tracking in Phase 1.** Phase 2.
10. **Money math precision**: store `NUMERIC(12,2)` in DB; use plain `number` in TS; round only at final output; never operate on display-rounded values. Especially critical for invoice subtotaling — drift of $0.01 across line items adds up to noticeable discrepancies on a $50k invoice.
11. **No multi-currency** — USD only. International is out of SparkPlan's market for now.
12. **Phase 1 has no chatbot tools.** AI integration is Phase 3.

---

## 6. Out of scope for Phase 1

- Stripe payment-intent integration (Phase 4)
- AIA G702/G703-style PDFs (Phase 3)
- Change orders as first-class entity (Phase 2)
- Cost code lookup library (Phase 2)
- Retention / pay applications (Phase 2)
- Equipment rental tracking (Phase 2)
- QuickBooks export (Phase 4)
- Profitability dashboards (Phase 4)
- Multi-user time entry (each project's `user_id` owns all entries; team support is a separate Phase)
- Email-invoice click-to-pay (Phase 4)
- Tax tables per zip code (Phase 2)
- Refunds (Phase 4)
- Recurring invoices (deferred indefinitely — T&M is project-period bound, not recurring)

---

## 7. File-by-file implementation order

Order matters more here than in Permits/Estimating because of the cross-table FKs and money-math precision.

1. **Migration** — write all 5 tables in one file. Apply locally. Verify FKs.
2. **Types** — regenerate.
3. **Toasts + refresh events** — 5 new keys.
4. **Validation schemas** — 5 new Zod schemas.
5. **Pure services** in order:
   - `billingMath.ts` (foundational; everything else uses these helpers)
   - `invoiceStatusTransitions.ts`
   - `invoiceGenerator.ts` (depends on billingMath)
   - Add unit tests for each. Run `npm test`.
6. **Supabase RPC** — define `generate_invoice_atomic(project_id, period_start, period_end, invoice_data)` SQL function for the transactional flow. Ship in same migration.
7. **Hooks** — `useProjectBillingSettings` (foundational; settings drive the editors), then `useTimeEntries`, `useMaterialEntries`, `useInvoices`, `usePayments`. Each uses `usePanels.ts` pattern.
8. **Reusable components** — `AmountDisplay`, `InvoiceStatusPill`. Smallest first.
9. **Settings tab** (foundational — the rates have to exist before time entries can use them as defaults).
10. **Time + Material tabs** — independent CRUD.
11. **Invoice tab + detail drawer** — depends on time + material.
12. **Generate invoice modal** — uses RPC.
13. **Record payment modal**.
14. **Overview tab** — aggregates everything; do last so all pieces exist.
15. **PDF generator** — after UI works.
16. **Routing** — swap stub for real page.
17. **Project context** — surface unbilled total + open invoice count.
18. **Tests** — integration test with full CRUD lifecycle.
19. **Docs**.

After each step: `npm run build && npm test`. Money math errors are silent and expensive — extra emphasis on running the math tests at every step.

---

## 8. Quick context for fresh claude

If you're picking this up after a context clear:

- **You're working on a Phase-3.8 PR.** Phase 3.5 (sidebar pivot, merged), Phase 3.6 (Permits) and Phase 3.7 (Estimating) precede this. Phase 3.6 and 3.7 may or may not be merged — check ROADMAP.md.
- **Augusto is the platform owner AND a Florida-licensed PE.**
- **Validation is advisory, not blocking.** Save partial drafts. See feedback memory.
- **Money math is exact.** Use `NUMERIC(12,2)` in DB. In TS, do math on raw `number` but round only at final output. Never operate on display-rounded values. CLAUDE.md calculation rules apply with extra emphasis.
- **Don't mock the database.** Integration tests hit real Supabase.
- **NEVER commit directly to main.** Branch `feat/tm-billing-beta-v1`.
- **All hooks follow `usePanels.ts` pattern.**
- **All toasts via `lib/toast.ts`.**
- **PDF via `@react-pdf/renderer`** — `services/pdfExport/PermitPacketDocuments.tsx` is the reference.
- **Tier gating done.** PR #29 added `'tm-billing': ['business', 'enterprise']`.
- **Sidebar entry exists.** Don't touch `Layout.tsx`.
- **Multi-table writes use Supabase RPC.** The invoice-generation flow updates 1 invoice + N time entries + M material entries atomically. Don't split the writes; define a SQL function.
- **There is no payment-integration infrastructure yet.** Recording payments is manual `INSERT INTO payments`. Stripe is for SparkPlan subscriptions only — not customer payments.

---

## 9. Estimated PR size

- Migration (5 tables + 1 RPC function): ~400 LOC SQL
- Hooks: ~600 LOC TS (5 hooks)
- Pure services + tests: ~700 LOC TS
- React components: ~1,800 LOC TSX (15 components — biggest of the three plans)
- PDF generator: ~500 LOC TSX
- Routing + cleanup: ~30 LOC
- Tests: ~600 LOC TS
- Docs: ~250 LOC markdown

**Total: ~4,900 LOC** across one branch. ~6-8 commits. **This is the biggest of the three Phase 1 implementations.** Strongly consider splitting into Phase 1a (time + materials + settings, no invoicing) and Phase 1b (invoicing + payments) as two PRs.

Build target: 5-7 second clean build, ~238 tests passing.

---

## 10. Phase 1 Definition of Done

- [ ] Migration applied (all 5 tables + RPC function)
- [ ] RLS enforced on all 5 tables
- [ ] `/billing` route renders `BillingPage` (not the stub)
- [ ] All 5 tabs functional with URL `?tab=` param
- [ ] Settings tab: billable rate, cost rate, material markup default, tax %, customer info — saves via upsert
- [ ] Time entry CRUD with date / worker / hours / cost-code / billable rate fields
- [ ] Material entry CRUD with invoice cost / markup / billing price (computed)
- [ ] Invoice generation flow: pick date range, see preview of unbilled, click Generate → invoice created + entries linked
- [ ] Invoice statuses transition correctly; payments tracked; balance-due updates
- [ ] PDF generation works for invoices
- [ ] Auto-derived overdue status (client-side check; no cron in Phase 1)
- [ ] Money math is exact across all operations (no floating-point drift)
- [ ] FeatureGate still in place (Business + Enterprise + trial)
- [ ] Sidebar `T&M Billing (beta)` chip renders correctly
- [ ] `npm run build` clean
- [ ] `npm test` — 235+ tests passing
- [ ] Manual smoke: full lifecycle — log time + materials for a project → generate invoice → mark sent → record partial payment → record final payment → status flips to paid → PDF downloads
- [ ] Docs updated

---

**End of plan.** Hand to fresh context with: *"Implement the T&M Billing feature per `docs/plans/tm-billing-implementation.md`. Phase 1 only. Branch off main. Strongly consider splitting into Phase 1a (time + materials + settings) and Phase 1b (invoicing + payments) as two PRs given the ~4,900 LOC scope."*
