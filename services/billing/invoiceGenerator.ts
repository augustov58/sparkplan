/**
 * Invoice generator — pure function.
 *
 * Given (project_id, period, settings, all unbilled time/material entries) →
 * the invoice "draft" record + the IDs of entries that should be linked.
 *
 * Filters:
 *   - Time entries where `work_date` ∈ [periodStart, periodEnd] AND invoice_id IS NULL
 *   - Material entries where `installed_date` ∈ [periodStart, periodEnd] AND invoice_id IS NULL
 *
 * Math (delegated to billingMath):
 *   - subtotalLabor = sum of billable_amount
 *   - subtotalMaterials = sum of billing_amount
 *   - subtotal = subtotalLabor + subtotalMaterials
 *   - taxAmount = computeTaxAmount(taxableMaterials, settings.tax_pct)
 *   - total = subtotal + taxAmount
 *
 * No side effects. The hook layer takes the result and calls
 * `generate_invoice_atomic` RPC for the actual write.
 */

import type { Database } from '@/lib/database.types';
import {
  sumTimeEntries,
  sumMaterialEntries,
  computeTaxAmount,
  roundCurrency,
} from './billingMath';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
type MaterialEntry = Database['public']['Tables']['material_entries']['Row'];
type ProjectBillingSettings = Database['public']['Tables']['project_billing_settings']['Row'];

export interface GenerateInvoiceInput {
  projectId: string;
  /** ISO date YYYY-MM-DD, inclusive. */
  periodStart: string;
  /** ISO date YYYY-MM-DD, inclusive. */
  periodEnd: string;
  /** All time entries for the project — generator filters by period + unbilled. */
  allTimeEntries: ReadonlyArray<TimeEntry>;
  /** All material entries for the project — generator filters by period + unbilled. */
  allMaterialEntries: ReadonlyArray<MaterialEntry>;
  /** Project billing settings (or null if user hasn't saved any). */
  settings: ProjectBillingSettings | null;
  /** Pre-computed invoice number ("INV-2026-0009"). Caller resolves this. */
  invoiceNumber: string;
  /** Invoice issue date. Defaults to today on the form. */
  invoiceDate: string;
  /** Optional. Computed from invoiceDate + payment_terms_days when undefined. */
  dueDate?: string | null;
  /** Free-text description shown on the invoice ("May 2026 work"). */
  description?: string | null;
  /** Free-text notes shown on the PDF. */
  notes?: string | null;
}

export interface GenerateInvoiceResult {
  /** Time entries that fall in the period and are unbilled. */
  timeEntries: TimeEntry[];
  /** Material entries that fall in the period and are unbilled. */
  materialEntries: MaterialEntry[];

  /** Computed totals — what the invoice header will store. */
  subtotalLabor: number;
  subtotalMaterials: number;
  subtotalTaxable: number;
  subtotalNonTaxable: number;
  subtotal: number;
  taxAmount: number;
  taxPct: number;
  total: number;

  /** Customer snapshot derived from settings. */
  customerSnapshot: {
    name: string | null;
    email: string | null;
    address: string | null;
    poNumber: string | null;
  };

  /** Resolved due date (input dueDate, or invoiceDate + terms_days, or null). */
  resolvedDueDate: string | null;

  /** Warnings — purely advisory; UI shows them but doesn't block generation. */
  warnings: string[];
}

function isInPeriod(date: string, start: string, end: string): boolean {
  // Lexicographic compare on ISO YYYY-MM-DD is correct.
  return date >= start && date <= end;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Pure function: produces an invoice draft from in-memory entries + settings.
 * Caller is responsible for:
 *   1. Verifying the invoice_number is unique (DB unique index will reject otherwise)
 *   2. Calling the `generate_invoice_atomic` RPC with the result
 */
export function generateInvoiceDraft(input: GenerateInvoiceInput): GenerateInvoiceResult {
  const warnings: string[] = [];

  const timeEntries = input.allTimeEntries.filter(
    (t) => t.invoice_id === null && isInPeriod(t.work_date, input.periodStart, input.periodEnd),
  );
  const materialEntries = input.allMaterialEntries.filter(
    (m) =>
      m.invoice_id === null &&
      isInPeriod(m.installed_date, input.periodStart, input.periodEnd),
  );

  const timeAgg = sumTimeEntries(timeEntries);
  const matAgg = sumMaterialEntries(materialEntries);

  const subtotalLabor = timeAgg.billable;
  const subtotalMaterials = matAgg.billing;
  const subtotalTaxable = matAgg.taxable;
  const subtotalNonTaxable = matAgg.nonTaxable;
  const subtotal = roundCurrency(subtotalLabor + subtotalMaterials);

  const taxPct = input.settings?.tax_pct ?? 0;
  const taxAmount = computeTaxAmount(subtotalTaxable, taxPct);
  const total = roundCurrency(subtotal + taxAmount);

  // Warnings (advisory)
  if (timeEntries.length === 0 && materialEntries.length === 0) {
    warnings.push('No unbilled time or materials in this period — the invoice will be empty.');
  }
  if (total === 0 && (timeEntries.length > 0 || materialEntries.length > 0)) {
    warnings.push('Invoice total is $0.00 — check your rates and quantities.');
  }
  if (!input.settings?.customer_name) {
    warnings.push('No customer name set — the invoice header will be blank.');
  }
  if (taxPct > 0 && subtotalTaxable === 0 && subtotalMaterials > 0) {
    warnings.push('Tax % is set but no materials are marked taxable — no tax will apply.');
  }

  // Customer snapshot from settings (frozen when invoice writes)
  const customerSnapshot = {
    name: input.settings?.customer_name ?? null,
    email: input.settings?.customer_email ?? null,
    address: input.settings?.customer_address ?? null,
    poNumber: input.settings?.customer_po_number ?? null,
  };

  // Resolve due date
  let resolvedDueDate: string | null = null;
  if (input.dueDate !== undefined && input.dueDate !== null) {
    resolvedDueDate = input.dueDate;
  } else if (input.settings?.payment_terms_days != null) {
    resolvedDueDate = addDays(input.invoiceDate, input.settings.payment_terms_days);
  }

  return {
    timeEntries,
    materialEntries,
    subtotalLabor,
    subtotalMaterials,
    subtotalTaxable,
    subtotalNonTaxable,
    subtotal,
    taxAmount,
    taxPct,
    total,
    customerSnapshot,
    resolvedDueDate,
    warnings,
  };
}

/**
 * Helper: given billing settings (which carry `invoice_prefix` and
 * `next_invoice_number`), compute the next invoice number string.
 *
 * Format: `${prefix}${zero-padded number}` — matches industry convention.
 * If no settings or no prefix, falls back to "INV-{number with 4-digit pad}".
 */
export function nextInvoiceNumber(
  settings: ProjectBillingSettings | null,
): string {
  const num = settings?.next_invoice_number ?? 1;
  const prefix = settings?.invoice_prefix ?? 'INV-';
  const padded = num.toString().padStart(4, '0');
  return `${prefix}${padded}`;
}
