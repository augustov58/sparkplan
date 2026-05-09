/**
 * Estimate Math — pure functions for bid totals.
 *
 * Per CLAUDE.md calculation-service rules:
 *   - No DB calls, no hooks, no side effects
 *   - Result includes a `warnings` array (escalating severity)
 *   - Round only at final output, preserve precision in intermediate steps
 *   - Never throw on bad input — return result with warnings
 *
 * Phase 1 math (plan §4.7):
 *
 *   subtotal       = sum(qty × unit_price) across all line items
 *   markup_amount  = subtotal × markup_pct / 100
 *   taxable_basis  = sum(qty × unit_price) for items with taxable=true
 *   tax_amount     = taxable_basis × tax_pct / 100
 *                     ^^ Tax applied to the *materials* basis BEFORE markup.
 *                     This matches typical residential/light-commercial bidding
 *                     in Florida and most other states. Plan §5 decision 1
 *                     codified the convention; the markup itself is not taxed.
 *   total          = subtotal + markup_amount + tax_amount
 *
 * Tax-on-pre-markup vs tax-on-post-markup is a known regional disagreement;
 * the result contract returns enough breakdown that the UI can re-shape it
 * if the convention changes in Phase 2.
 *
 * Phase 2 will add per-category markup and assembly bundling — both layered
 * on top of the same per-line totals computed here.
 */

import type { Database } from '@/lib/database.types';

type DbLineItem = Database['public']['Tables']['estimate_line_items']['Row'];

export type LineItemCategory =
  | 'material'
  | 'labor'
  | 'equipment'
  | 'subcontract'
  | 'other';

/**
 * Minimal line item shape required for math. Accepts the full DB row shape too.
 */
export interface LineItemForMath {
  category: LineItemCategory | string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
}

export interface EstimateMathInput {
  lineItems: LineItemForMath[];
  /** Total-job markup percent. 25 = 25%. */
  markupPct: number;
  /** Sales tax percent applied to the taxable basis. 6.5 = 6.5%. */
  taxPct: number;
}

export interface EstimateMathResult {
  subtotalMaterials: number;
  subtotalLabor: number;
  subtotalEquipment: number;
  subtotalSubcontract: number;
  subtotalOther: number;
  /** Sum of all category subtotals (pre-markup, pre-tax). */
  subtotal: number;
  /** Sum of (qty × unit_price) for line items where taxable === true. */
  taxableBasis: number;
  /** subtotal × markupPct / 100. */
  markupAmount: number;
  /** taxableBasis × taxPct / 100. */
  taxAmount: number;
  /** subtotal + markupAmount + taxAmount, rounded to 2 decimals. */
  total: number;
  warnings: string[];
}

/**
 * Compute the line total for a single item: quantity × unit_price.
 * Pure helper — UI uses this to recompute the cached `line_total` column on edit.
 */
export function computeLineTotal(quantity: number, unitPrice: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return 0;
  if (quantity < 0 || unitPrice < 0) return 0;
  return roundCurrency(quantity * unitPrice);
}

/**
 * Compute estimate totals from a list of line items.
 * Never throws. Bad inputs (NaN, negative pct) are clamped and reported as
 * warnings.
 */
export function computeEstimateTotals(input: EstimateMathInput): EstimateMathResult {
  const warnings: string[] = [];

  // Clamp bad pct inputs rather than throwing.
  let markupPct = input.markupPct;
  if (!Number.isFinite(markupPct)) {
    warnings.push('INFO: markup_pct is not a finite number; treating as 0.');
    markupPct = 0;
  } else if (markupPct < 0) {
    warnings.push(`WARNING: markup_pct ${markupPct}% is negative; clamping to 0.`);
    markupPct = 0;
  } else if (markupPct > 100) {
    warnings.push(`WARNING: markup_pct ${markupPct}% exceeds 100%; clamping to 100.`);
    markupPct = 100;
  }

  let taxPct = input.taxPct;
  if (!Number.isFinite(taxPct)) {
    warnings.push('INFO: tax_pct is not a finite number; treating as 0.');
    taxPct = 0;
  } else if (taxPct < 0) {
    warnings.push(`WARNING: tax_pct ${taxPct}% is negative; clamping to 0.`);
    taxPct = 0;
  } else if (taxPct > 100) {
    warnings.push(`WARNING: tax_pct ${taxPct}% exceeds 100%; clamping to 100.`);
    taxPct = 100;
  }

  let subtotalMaterials = 0;
  let subtotalLabor = 0;
  let subtotalEquipment = 0;
  let subtotalSubcontract = 0;
  let subtotalOther = 0;
  let taxableBasis = 0;

  for (const item of input.lineItems) {
    const q = Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0;
    const p = Number.isFinite(item.unit_price) ? Math.max(0, item.unit_price) : 0;
    const lineTotal = q * p;

    switch (item.category) {
      case 'material':
        subtotalMaterials += lineTotal;
        break;
      case 'labor':
        subtotalLabor += lineTotal;
        break;
      case 'equipment':
        subtotalEquipment += lineTotal;
        break;
      case 'subcontract':
        subtotalSubcontract += lineTotal;
        break;
      case 'other':
      default:
        subtotalOther += lineTotal;
        break;
    }

    if (item.taxable) {
      taxableBasis += lineTotal;
    }
  }

  const subtotal =
    subtotalMaterials +
    subtotalLabor +
    subtotalEquipment +
    subtotalSubcontract +
    subtotalOther;

  const markupAmount = subtotal * (markupPct / 100);
  const taxAmount = taxableBasis * (taxPct / 100);
  const total = subtotal + markupAmount + taxAmount;

  if (subtotal === 0) {
    warnings.push('INFO: Estimate has no line items yet — total is $0.');
  }

  return {
    subtotalMaterials: roundCurrency(subtotalMaterials),
    subtotalLabor: roundCurrency(subtotalLabor),
    subtotalEquipment: roundCurrency(subtotalEquipment),
    subtotalSubcontract: roundCurrency(subtotalSubcontract),
    subtotalOther: roundCurrency(subtotalOther),
    subtotal: roundCurrency(subtotal),
    taxableBasis: roundCurrency(taxableBasis),
    markupAmount: roundCurrency(markupAmount),
    taxAmount: roundCurrency(taxAmount),
    total: roundCurrency(total),
    warnings,
  };
}

/**
 * Round to nearest cent. Half-up. Use for final-output values only.
 */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Convenience: project the totals computed by `computeEstimateTotals` onto
 * the columns persisted on the `estimates` row. The hook calls this on save
 * to keep the denormalized totals in sync with the line-item detail.
 */
export function totalsForPersistence(result: EstimateMathResult): {
  subtotal_materials: number;
  subtotal_labor: number;
  subtotal_other: number;
  markup_amount: number;
  tax_amount: number;
  total: number;
} {
  return {
    subtotal_materials: result.subtotalMaterials,
    subtotal_labor: result.subtotalLabor,
    // The DB has a single subtotal_other column; bundle equipment + subcontract
    // + other into it in Phase 1. Phase 2 adds dedicated columns when per-
    // category markup arrives.
    subtotal_other: roundCurrency(
      result.subtotalEquipment + result.subtotalSubcontract + result.subtotalOther
    ),
    markup_amount: result.markupAmount,
    tax_amount: result.taxAmount,
    total: result.total,
  };
}

/**
 * Dev helper: run computeEstimateTotals over the full DB-shape line items.
 * Useful in components that already have the rows from the hook.
 */
export function totalsFromDbLineItems(
  lineItems: Pick<DbLineItem, 'category' | 'quantity' | 'unit_price' | 'taxable'>[],
  markupPct: number,
  taxPct: number
): EstimateMathResult {
  return computeEstimateTotals({
    lineItems: lineItems.map((li) => ({
      category: li.category,
      quantity: li.quantity,
      unit_price: li.unit_price,
      taxable: li.taxable,
    })),
    markupPct,
    taxPct,
  });
}
