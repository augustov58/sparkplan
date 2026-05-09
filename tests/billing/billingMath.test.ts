/**
 * Unit tests — services/billing/billingMath.ts
 *
 * Money math is silent and expensive when wrong. These tests pin every
 * rounding edge and the aggregate flow: row totals, sum, tax, profit margin.
 */

import { describe, it, expect } from 'vitest';
import {
  roundTo,
  roundCurrency,
  computeTimeEntryBillable,
  computeTimeEntryCost,
  computeMaterialBillingUnitPrice,
  computeMaterialBillingAmount,
  computeMaterialCostAmount,
  sumTimeEntries,
  sumMaterialEntries,
  computeTaxAmount,
  summarizeProfit,
  formatUSD,
  formatHours,
  formatPct,
  type TimeEntry,
  type MaterialEntry,
} from '../../services/billing/billingMath';

// Helper: build a minimum-viable TimeEntry row for sum tests.
function timeRow(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'te-1',
    project_id: 'p-1',
    user_id: 'u-1',
    worker_name: 'Worker',
    work_date: '2026-05-08',
    hours: 8,
    description: null,
    cost_code: null,
    billable_rate: 95,
    cost_rate: 45,
    billable_amount: 760,
    cost_amount: 360,
    invoice_id: null,
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
    ...overrides,
  };
}

function matRow(overrides: Partial<MaterialEntry> = {}): MaterialEntry {
  return {
    id: 'me-1',
    project_id: 'p-1',
    user_id: 'u-1',
    installed_date: '2026-05-08',
    description: 'Material',
    cost_code: null,
    quantity: 1,
    unit: 'ea',
    invoice_unit_cost: 10,
    markup_pct: 20,
    billing_unit_price: 12,
    taxable: true,
    billing_amount: 12,
    cost_amount: 10,
    receipt_url: null,
    supplier_name: null,
    supplier_invoice_number: null,
    invoice_id: null,
    created_at: '2026-05-08T00:00:00Z',
    updated_at: '2026-05-08T00:00:00Z',
    ...overrides,
  };
}

describe('roundTo / roundCurrency', () => {
  it('rounds 0.5 cents up (half-away-from-zero)', () => {
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(roundCurrency(0.005)).toBe(0.01);
    expect(roundCurrency(2.345)).toBe(2.35);
  });

  it('handles negative values symmetrically', () => {
    expect(roundCurrency(-1.005)).toBe(-1.01);
    expect(roundCurrency(-0.005)).toBe(-0.01);
  });

  it('rounds 4-decimal precision for unit prices', () => {
    expect(roundTo(0.08316667, 4)).toBe(0.0832);
    expect(roundTo(0.083, 4)).toBe(0.083);
  });

  it('treats NaN / Infinity as 0', () => {
    expect(roundCurrency(NaN)).toBe(0);
    expect(roundCurrency(Infinity)).toBe(0);
  });
});

describe('computeTimeEntryBillable / computeTimeEntryCost', () => {
  it('multiplies hours × rate and rounds to cents', () => {
    expect(computeTimeEntryBillable(8, 95)).toBe(760);
    expect(computeTimeEntryBillable(6.5, 95)).toBe(617.5);
    expect(computeTimeEntryBillable(7.33, 92.50)).toBe(678.03); // 678.0249... → 678.03 (half-up after epsilon)
  });

  it('returns null cost when cost_rate is null/undefined (no fabricated $0)', () => {
    expect(computeTimeEntryCost(8, null)).toBe(null);
    expect(computeTimeEntryCost(8, undefined)).toBe(null);
  });

  it('computes cost when cost_rate provided', () => {
    expect(computeTimeEntryCost(8, 45)).toBe(360);
  });
});

describe('computeMaterialBillingUnitPrice', () => {
  it('applies markup to invoice cost at 4-decimal precision', () => {
    expect(computeMaterialBillingUnitPrice(10, 20)).toBe(12);
    expect(computeMaterialBillingUnitPrice(0.083, 20)).toBe(0.0996);
    expect(computeMaterialBillingUnitPrice(2.50, 25)).toBe(3.125);
  });

  it('zero markup → cost', () => {
    expect(computeMaterialBillingUnitPrice(15, 0)).toBe(15);
  });

  it('100% markup → 2× cost', () => {
    expect(computeMaterialBillingUnitPrice(7, 100)).toBe(14);
  });
});

describe('computeMaterialBillingAmount / computeMaterialCostAmount', () => {
  it('multiplies qty × unit price, rounds to cents', () => {
    expect(computeMaterialBillingAmount(500, 0.0996)).toBe(49.8);
    expect(computeMaterialBillingAmount(125, 12)).toBe(1500);
  });

  it('cost amount uses invoice unit cost not billing price', () => {
    expect(computeMaterialCostAmount(500, 0.083)).toBe(41.5);
  });
});

describe('sumTimeEntries', () => {
  it('aggregates hours / billable / cost', () => {
    const entries = [
      timeRow({ hours: 8, billable_amount: 760, cost_amount: 360 }),
      timeRow({ hours: 6.5, billable_amount: 617.5, cost_amount: 292.5 }),
    ];
    const totals = sumTimeEntries(entries);
    expect(totals.hours).toBe(14.5);
    expect(totals.billable).toBe(1377.5);
    expect(totals.cost).toBe(652.5);
  });

  it('reports null cost when ANY entry has null cost_amount (no silent zeroes)', () => {
    const entries = [
      timeRow({ cost_amount: 360 }),
      timeRow({ cost_amount: null }),
    ];
    const totals = sumTimeEntries(entries);
    expect(totals.cost).toBe(null);
  });

  it('handles empty list cleanly', () => {
    expect(sumTimeEntries([])).toEqual({ hours: 0, billable: 0, cost: 0 });
  });

  it('sums many small line items without $0.01 drift', () => {
    // 100 entries of $13.33 should be exactly $1,333.00 (13.33 is exact in cents)
    const entries = Array.from({ length: 100 }, () =>
      timeRow({ hours: 1, billable_amount: 13.33, cost_amount: 0 }),
    );
    expect(sumTimeEntries(entries).billable).toBe(1333);
  });
});

describe('sumMaterialEntries', () => {
  it('splits taxable vs non-taxable for tax math', () => {
    const entries = [
      matRow({ billing_amount: 100, cost_amount: 80, taxable: true }),
      matRow({ billing_amount: 50, cost_amount: 40, taxable: false }),
      matRow({ billing_amount: 25.5, cost_amount: 20, taxable: true }),
    ];
    const totals = sumMaterialEntries(entries);
    expect(totals.billing).toBe(175.5);
    expect(totals.taxable).toBe(125.5);
    expect(totals.nonTaxable).toBe(50);
    expect(totals.cost).toBe(140);
  });

  it('handles empty list', () => {
    expect(sumMaterialEntries([])).toEqual({ billing: 0, taxable: 0, nonTaxable: 0, cost: 0 });
  });
});

describe('computeTaxAmount', () => {
  it('applies tax % as a percent (6.5 means 6.5%)', () => {
    expect(computeTaxAmount(1000, 6.5)).toBe(65);
    expect(computeTaxAmount(150.50, 6.5)).toBe(9.78);
  });

  it('rounds to cents', () => {
    // $99.97 × 7% = 6.9979 → $7.00
    expect(computeTaxAmount(99.97, 7)).toBe(7);
  });

  it('zero tax → zero amount', () => {
    expect(computeTaxAmount(1000, 0)).toBe(0);
  });
});

describe('summarizeProfit', () => {
  it('computes revenue / cost / profit / margin pct', () => {
    const summary = summarizeProfit(
      { hours: 100, billable: 9500, cost: 4500 },
      { billing: 2000, taxable: 2000, nonTaxable: 0, cost: 1600 },
    );
    expect(summary.revenue).toBe(11500);
    expect(summary.cost).toBe(6100);
    expect(summary.profit).toBe(5400);
    expect(summary.marginPct).toBe(47); // 5400 / 11500 ≈ 0.4696 → 47.0% (1-decimal margin)
  });

  it('returns null margin when revenue is 0 (no divide-by-zero)', () => {
    const summary = summarizeProfit(
      { hours: 0, billable: 0, cost: 0 },
      { billing: 0, taxable: 0, nonTaxable: 0, cost: 0 },
    );
    expect(summary.marginPct).toBe(null);
  });

  it('flags costPartial when time aggregate cost is null', () => {
    const summary = summarizeProfit(
      { hours: 8, billable: 760, cost: null },
      { billing: 100, taxable: 100, nonTaxable: 0, cost: 80 },
    );
    expect(summary.costPartial).toBe(true);
    expect(summary.marginPct).toBe(null); // can't compute when cost is partial
  });
});

describe('format helpers', () => {
  it('formatUSD adds $ + thousands separator', () => {
    expect(formatUSD(1234.5)).toBe('$1,234.50');
    expect(formatUSD(0)).toBe('$0.00');
    expect(formatUSD(null)).toBe('$0.00');
    expect(formatUSD(NaN)).toBe('$0.00');
  });

  it('formatHours always shows 1 decimal', () => {
    expect(formatHours(8)).toBe('8.0 hr');
    expect(formatHours(8.5)).toBe('8.5 hr');
    expect(formatHours(0)).toBe('0.0 hr');
    expect(formatHours(null)).toBe('0.0 hr');
  });

  it('formatPct trims integer trailing decimals', () => {
    expect(formatPct(20)).toBe('20%');
    expect(formatPct(6.5)).toBe('6.5%');
    expect(formatPct(0)).toBe('0%');
  });
});
