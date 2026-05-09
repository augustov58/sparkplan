/**
 * Billing math — pure helpers for time entries, material lines, and invoices.
 *
 * **Money precision contract** (per CLAUDE.md, calculation-service rules):
 *   - Numbers in TS are plain `number`.
 *   - Multiply/add at full float precision; round only at final-output boundaries.
 *   - Use `roundCurrency(n)` (banker's-style 2-decimal half-up) before persisting
 *     a column whose DB type is `NUMERIC(12,2)` and before showing on a PDF.
 *   - Never re-round a value that was already rounded at display time.
 *
 * Phase 1a exposes:
 *   - row-level totals (`computeTimeEntryBillable`, `computeMaterialBilling*`)
 *   - aggregate totals (`sumTimeEntries`, `sumMaterialEntries`)
 *   - tax math (`computeTaxAmount`)
 *
 * Phase 1b will extend this module with `computeInvoiceTotals` and
 * `computeBalanceDue` (exported here as no-op TODOs so importers don't break
 * when the v1b branch lands).
 *
 * No throws. No side effects. No DB. No hooks.
 */

import type { Database } from '@/lib/database.types';

export type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
export type MaterialEntry = Database['public']['Tables']['material_entries']['Row'];

// ---------------------------------------------------------------------------
// Rounding
// ---------------------------------------------------------------------------

/**
 * Round to N decimal places using half-up. Avoids the IEEE-754 surprise where
 * `Math.round(1.005 * 100) / 100 === 1` (0.5 rounds DOWN due to bit-rep).
 *
 * Implementation: scale → epsilon-bump → round → unscale. The 1e-9 nudge is
 * smaller than any USD currency amount we care about and bigger than the
 * float representation error for cents.
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  // Add a tiny epsilon to push exact-half cases over the rounding threshold,
  // matching the "half away from zero" behavior that humans expect for money.
  const sign = value >= 0 ? 1 : -1;
  return sign * Math.round(Math.abs(value) * factor + 1e-9) / factor;
}

/** 2-decimal currency rounding for USD ($XX.XX). */
export function roundCurrency(value: number): number {
  return roundTo(value, 2);
}

// ---------------------------------------------------------------------------
// Row-level computations
// ---------------------------------------------------------------------------

/**
 * Billable amount = hours × billable_rate, rounded to cents. Rate / hours
 * stored at higher precision in the DB (NUMERIC(6,2) and NUMERIC(8,2)
 * respectively) but the persisted billable_amount is the rounded $.
 */
export function computeTimeEntryBillable(hours: number, billableRate: number): number {
  return roundCurrency(safeNum(hours) * safeNum(billableRate));
}

/**
 * Cost amount mirrors billable but for the internal cost rate. `null`-in →
 * `null`-out so we don't fabricate a $0.00 cost when the contractor declined
 * to track payroll cost.
 */
export function computeTimeEntryCost(hours: number, costRate: number | null | undefined): number | null {
  if (costRate === null || costRate === undefined) return null;
  return roundCurrency(safeNum(hours) * safeNum(costRate));
}

/**
 * Billing unit price = invoice_unit_cost × (1 + markup_pct / 100). Stored at
 * 4-decimal precision (NUMERIC(10,4)) because some materials (#12 wire at
 * 0.083 $/ft) lose meaningful precision at 2 decimals.
 */
export function computeMaterialBillingUnitPrice(invoiceUnitCost: number, markupPct: number): number {
  const cost = safeNum(invoiceUnitCost);
  const markup = safeNum(markupPct);
  return roundTo(cost * (1 + markup / 100), 4);
}

/**
 * Billing line total = qty × billing_unit_price, rounded to cents. Use the
 * stored `billing_unit_price` (already 4-decimal rounded) — we compound at
 * full float precision but round the *line total* to 2.
 */
export function computeMaterialBillingAmount(quantity: number, billingUnitPrice: number): number {
  return roundCurrency(safeNum(quantity) * safeNum(billingUnitPrice));
}

/** Cost amount = qty × invoice_unit_cost, rounded to cents. */
export function computeMaterialCostAmount(quantity: number, invoiceUnitCost: number): number {
  return roundCurrency(safeNum(quantity) * safeNum(invoiceUnitCost));
}

// ---------------------------------------------------------------------------
// Aggregate computations
// ---------------------------------------------------------------------------

export interface TimeAggregateTotals {
  hours: number;
  billable: number;
  cost: number | null; // null if any entry has a null cost_rate (don't fabricate)
}

/**
 * Sum a list of time entries. Rounds each line individually before summing
 * (matches how the DB persists denormalized billable_amount), then rounds the
 * sum once more — this is the pattern that prevents $0.01 drift between the
 * UI display and the invoice PDF.
 *
 * If ANY entry has a null cost_amount, the aggregate cost is reported as null
 * — the contractor either tracks cost on every entry or none. Mixed → unknown.
 */
export function sumTimeEntries(entries: ReadonlyArray<Pick<TimeEntry, 'hours' | 'billable_amount' | 'cost_amount'>>): TimeAggregateTotals {
  let hours = 0;
  let billable = 0;
  let cost = 0;
  let anyCostNull = false;
  for (const e of entries) {
    hours += safeNum(e.hours);
    billable += safeNum(e.billable_amount);
    if (e.cost_amount === null || e.cost_amount === undefined) {
      anyCostNull = true;
    } else {
      cost += safeNum(e.cost_amount);
    }
  }
  return {
    hours: roundTo(hours, 2),
    billable: roundCurrency(billable),
    cost: anyCostNull ? null : roundCurrency(cost),
  };
}

export interface MaterialAggregateTotals {
  billing: number;
  taxable: number;
  nonTaxable: number;
  cost: number;
}

/**
 * Sum a list of material entries. Splits the billing-side total into taxable
 * vs non-taxable so callers (and the invoice generator) can apply tax to the
 * right slice. Stored billing_amount is already cents-rounded; we sum then
 * re-round.
 */
export function sumMaterialEntries(
  entries: ReadonlyArray<
    Pick<MaterialEntry, 'billing_amount' | 'cost_amount' | 'taxable'>
  >,
): MaterialAggregateTotals {
  let billing = 0;
  let taxable = 0;
  let nonTaxable = 0;
  let cost = 0;
  for (const m of entries) {
    const b = safeNum(m.billing_amount);
    billing += b;
    cost += safeNum(m.cost_amount);
    if (m.taxable) taxable += b;
    else nonTaxable += b;
  }
  return {
    billing: roundCurrency(billing),
    taxable: roundCurrency(taxable),
    nonTaxable: roundCurrency(nonTaxable),
    cost: roundCurrency(cost),
  };
}

// ---------------------------------------------------------------------------
// Tax
// ---------------------------------------------------------------------------

/**
 * Tax amount on a taxable subtotal. Tax % expressed as a percent (6.5 means
 * 6.5%, NOT 0.065). Returned rounded to cents.
 *
 * In US electrical contracting, tax applies to *materials only* (most states),
 * not labor. The caller supplies the taxable subtotal — we don't apply
 * any business rules here about which items are taxable.
 */
export function computeTaxAmount(taxableSubtotal: number, taxPct: number): number {
  return roundCurrency(safeNum(taxableSubtotal) * (safeNum(taxPct) / 100));
}

// ---------------------------------------------------------------------------
// Profit / margin (overview surface)
// ---------------------------------------------------------------------------

export interface ProfitSummary {
  /** Sum of billable amounts (labor + materials × markup) — what the customer owes. */
  revenue: number;
  /** Sum of internal cost amounts (payroll-loaded labor + supplier invoice cost). */
  cost: number;
  /** revenue − cost. Negative when overrunning. */
  profit: number;
  /**
   * Percent margin = profit / revenue × 100. `null` if revenue is 0 (avoid
   * divide-by-zero infinity) or if any cost piece is missing (mixed null).
   */
  marginPct: number | null;
  /** True when any time entry omitted cost_rate. UI should disclose. */
  costPartial: boolean;
}

export function summarizeProfit(
  timeAgg: TimeAggregateTotals,
  materialAgg: MaterialAggregateTotals,
): ProfitSummary {
  const revenue = roundCurrency(timeAgg.billable + materialAgg.billing);
  const costPartial = timeAgg.cost === null;
  const cost = roundCurrency((timeAgg.cost ?? 0) + materialAgg.cost);
  const profit = roundCurrency(revenue - cost);

  let marginPct: number | null = null;
  if (revenue > 0 && !costPartial) {
    marginPct = roundTo((profit / revenue) * 100, 1);
  }

  return { revenue, cost, profit, marginPct, costPartial };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Coerce nullish / NaN to 0. The DB returns numeric columns as `number` for
 * NOT NULL columns and `number | null` for nullable, but a freshly inserted
 * row mid-optimistic-update can race with the realtime refetch — being
 * defensive here keeps the UI from displaying NaN dollar amounts.
 */
function safeNum(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return v;
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a number as USD: `$1,234.50`. Negative values get a leading minus. */
export function formatUSD(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '$0.00';
  return USD_FORMATTER.format(value);
}

/** Format hours: 8.5 → "8.5 hr", 1 → "1.0 hr". Always 1 decimal. */
export function formatHours(hours: number | null | undefined): string {
  const n = safeNum(hours);
  return `${n.toFixed(1)} hr`;
}

/** Format a percent: 6.5 → "6.5%", 0 → "0%". 1 decimal max, trims trailing zero. */
export function formatPct(pct: number | null | undefined): string {
  const n = safeNum(pct);
  // Strip trailing zero on whole numbers ("20%" not "20.0%").
  return `${Number.isInteger(n) ? n.toString() : n.toFixed(1)}%`;
}
