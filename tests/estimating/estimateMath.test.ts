/**
 * Tests for services/estimating/estimateMath.ts.
 *
 * Covers:
 *  - Empty estimate -> $0 total + advisory warning.
 *  - Single material line, no markup, no tax.
 *  - Mixed material/labor with markup applied to subtotal.
 *  - Tax applied only to taxable lines.
 *  - Non-finite / negative inputs are clamped, not thrown.
 *  - Per CLAUDE.md: warnings array always present, no exceptions thrown.
 */

import { describe, it, expect } from 'vitest';
import {
  computeEstimateTotals,
  computeLineTotal,
  totalsForPersistence,
  type LineItemForMath,
} from '../../services/estimating/estimateMath';

const mat = (qty: number, price: number, taxable = true): LineItemForMath => ({
  category: 'material',
  quantity: qty,
  unit_price: price,
  taxable,
});

const lab = (qty: number, price: number, taxable = false): LineItemForMath => ({
  category: 'labor',
  quantity: qty,
  unit_price: price,
  taxable,
});

describe('computeLineTotal', () => {
  it('multiplies qty by unit price and rounds to cents', () => {
    expect(computeLineTotal(3, 1.234)).toBe(3.7);
    expect(computeLineTotal(2, 7.5)).toBe(15);
  });

  it('returns 0 for non-finite or negative inputs', () => {
    expect(computeLineTotal(NaN, 5)).toBe(0);
    expect(computeLineTotal(-2, 5)).toBe(0);
    expect(computeLineTotal(2, -5)).toBe(0);
  });
});

describe('computeEstimateTotals — empty / edge cases', () => {
  it('zero line items yields all-zero totals and an advisory warning', () => {
    const r = computeEstimateTotals({ lineItems: [], markupPct: 25, taxPct: 6.5 });
    expect(r.subtotal).toBe(0);
    expect(r.markupAmount).toBe(0);
    expect(r.taxAmount).toBe(0);
    expect(r.total).toBe(0);
    expect(r.warnings.some((w) => w.includes('no line items'))).toBe(true);
  });

  it('clamps negative markup_pct and reports a WARNING', () => {
    const r = computeEstimateTotals({
      lineItems: [mat(1, 100)],
      markupPct: -10,
      taxPct: 0,
    });
    expect(r.markupAmount).toBe(0);
    expect(r.warnings.some((w) => w.startsWith('WARNING:'))).toBe(true);
  });

  it('clamps markup_pct above 100 and reports a WARNING', () => {
    const r = computeEstimateTotals({
      lineItems: [mat(1, 100)],
      markupPct: 250,
      taxPct: 0,
    });
    expect(r.markupAmount).toBe(100); // 100% of 100 = 100
    expect(r.warnings.some((w) => w.startsWith('WARNING:'))).toBe(true);
  });

  it('treats NaN markup_pct as 0 with an info note', () => {
    const r = computeEstimateTotals({
      lineItems: [mat(1, 100)],
      markupPct: NaN,
      taxPct: 0,
    });
    expect(r.markupAmount).toBe(0);
    expect(r.warnings.some((w) => w.includes('not a finite number'))).toBe(true);
  });

  it('clamps negative line-item qty/unit_price to 0', () => {
    const r = computeEstimateTotals({
      lineItems: [
        { category: 'material', quantity: -5, unit_price: 10, taxable: true },
        { category: 'material', quantity: 5, unit_price: -10, taxable: true },
      ],
      markupPct: 0,
      taxPct: 0,
    });
    expect(r.subtotal).toBe(0);
  });
});

describe('computeEstimateTotals — math', () => {
  it('single material line, no markup/tax', () => {
    const r = computeEstimateTotals({
      lineItems: [mat(10, 5)],
      markupPct: 0,
      taxPct: 0,
    });
    expect(r.subtotalMaterials).toBe(50);
    expect(r.subtotal).toBe(50);
    expect(r.total).toBe(50);
  });

  it('mixed materials + labor, total-job markup, no tax', () => {
    const r = computeEstimateTotals({
      lineItems: [mat(100, 10), lab(20, 95)],
      markupPct: 25,
      taxPct: 0,
    });
    expect(r.subtotalMaterials).toBe(1000);
    expect(r.subtotalLabor).toBe(1900);
    expect(r.subtotal).toBe(2900);
    expect(r.markupAmount).toBe(725);
    expect(r.taxAmount).toBe(0);
    expect(r.total).toBe(3625);
  });

  it('tax applies only to taxable lines, not to labor', () => {
    const r = computeEstimateTotals({
      lineItems: [
        mat(100, 10, true), // taxable $1,000
        lab(20, 95, false), // non-taxable $1,900
      ],
      markupPct: 0,
      taxPct: 6.5,
    });
    expect(r.taxableBasis).toBe(1000);
    expect(r.taxAmount).toBe(65); // 6.5% of 1000
    expect(r.total).toBe(2965); // 2900 + 65
  });

  it('tax applies to materials BEFORE markup (per plan §5 decision 1)', () => {
    const r = computeEstimateTotals({
      lineItems: [mat(100, 10)], // $1,000 taxable
      markupPct: 25,
      taxPct: 6.5,
    });
    // subtotal 1000, markup 250, tax 65 (on 1000, not 1250). total 1315.
    expect(r.subtotal).toBe(1000);
    expect(r.markupAmount).toBe(250);
    expect(r.taxAmount).toBe(65);
    expect(r.total).toBe(1315);
  });

  it('all categories tracked separately', () => {
    const r = computeEstimateTotals({
      lineItems: [
        { category: 'material', quantity: 1, unit_price: 100, taxable: true },
        { category: 'labor', quantity: 1, unit_price: 200, taxable: false },
        { category: 'equipment', quantity: 1, unit_price: 300, taxable: true },
        { category: 'subcontract', quantity: 1, unit_price: 400, taxable: false },
        { category: 'other', quantity: 1, unit_price: 500, taxable: false },
      ],
      markupPct: 0,
      taxPct: 0,
    });
    expect(r.subtotalMaterials).toBe(100);
    expect(r.subtotalLabor).toBe(200);
    expect(r.subtotalEquipment).toBe(300);
    expect(r.subtotalSubcontract).toBe(400);
    expect(r.subtotalOther).toBe(500);
    expect(r.subtotal).toBe(1500);
  });

  it('all-labor (no taxable basis) zeroes tax even if tax_pct > 0', () => {
    const r = computeEstimateTotals({
      lineItems: [lab(10, 95, false), lab(5, 80, false)],
      markupPct: 25,
      taxPct: 6.5,
    });
    expect(r.taxableBasis).toBe(0);
    expect(r.taxAmount).toBe(0);
    expect(r.total).toBe(r.subtotal + r.markupAmount);
  });
});

describe('totalsForPersistence', () => {
  it('rolls equipment/subcontract/other into subtotal_other for the DB row', () => {
    const r = computeEstimateTotals({
      lineItems: [
        { category: 'equipment', quantity: 1, unit_price: 300, taxable: false },
        { category: 'subcontract', quantity: 1, unit_price: 200, taxable: false },
        { category: 'other', quantity: 1, unit_price: 50, taxable: false },
      ],
      markupPct: 10,
      taxPct: 0,
    });
    const persist = totalsForPersistence(r);
    expect(persist.subtotal_other).toBe(550);
    expect(persist.subtotal_materials).toBe(0);
    expect(persist.subtotal_labor).toBe(0);
    expect(persist.markup_amount).toBe(55);
    expect(persist.total).toBe(605);
  });
});
