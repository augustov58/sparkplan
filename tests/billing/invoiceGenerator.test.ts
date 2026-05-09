/**
 * Unit tests — services/billing/invoiceGenerator.ts
 */

import { describe, it, expect } from 'vitest';
import {
  generateInvoiceDraft,
  nextInvoiceNumber,
} from '../../services/billing/invoiceGenerator';
import type { Database } from '../../lib/database.types';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
type MaterialEntry = Database['public']['Tables']['material_entries']['Row'];
type Settings = Database['public']['Tables']['project_billing_settings']['Row'];

function te(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: `te-${Math.random().toString(36).slice(2, 8)}`,
    project_id: 'p-1',
    user_id: 'u-1',
    worker_name: 'J. Smith',
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

function me(overrides: Partial<MaterialEntry> = {}): MaterialEntry {
  return {
    id: `me-${Math.random().toString(36).slice(2, 8)}`,
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

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    project_id: 'p-1',
    user_id: 'u-1',
    default_billable_rate: 95,
    default_cost_rate: 45,
    default_material_markup_pct: 20,
    tax_pct: 6.5,
    payment_terms_days: 30,
    invoice_prefix: 'INV-2026-',
    next_invoice_number: 9,
    customer_name: 'Acme Corp',
    customer_email: 'ap@acme.com',
    customer_address: '123 Main St',
    customer_po_number: 'PO-12345',
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

describe('generateInvoiceDraft', () => {
  it('filters time entries by period and unbilled status', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [
        te({ id: 'in-period', work_date: '2026-05-15', billable_amount: 760 }),
        te({ id: 'before', work_date: '2026-04-30', billable_amount: 100 }),
        te({ id: 'after', work_date: '2026-06-01', billable_amount: 200 }),
        te({ id: 'already-billed', work_date: '2026-05-15', invoice_id: 'inv-1' }),
      ],
      allMaterialEntries: [],
      settings: settings({ tax_pct: 0 }),
      invoiceNumber: 'INV-2026-0009',
      invoiceDate: '2026-05-31',
    });

    expect(result.timeEntries.map((t) => t.id)).toEqual(['in-period']);
    expect(result.subtotalLabor).toBe(760);
  });

  it('filters material entries by period and unbilled status', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [],
      allMaterialEntries: [
        me({ id: 'in-period', installed_date: '2026-05-15', billing_amount: 100 }),
        me({ id: 'before', installed_date: '2026-04-30' }),
        me({ id: 'already-billed', installed_date: '2026-05-15', invoice_id: 'inv-1' }),
      ],
      settings: settings({ tax_pct: 0 }),
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
    });

    expect(result.materialEntries.map((m) => m.id)).toEqual(['in-period']);
    expect(result.subtotalMaterials).toBe(100);
  });

  it('applies tax to taxable materials only — not labor, not non-taxable items', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [te({ billable_amount: 1000 })],
      allMaterialEntries: [
        me({ billing_amount: 200, taxable: true }),
        me({ billing_amount: 50, taxable: false }),
      ],
      settings: settings({ tax_pct: 7 }),
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
    });

    expect(result.subtotalLabor).toBe(1000);
    expect(result.subtotalMaterials).toBe(250);
    expect(result.subtotalTaxable).toBe(200);
    expect(result.subtotalNonTaxable).toBe(50);
    expect(result.taxAmount).toBe(14); // 200 × 7% = 14
    expect(result.total).toBe(1264); // 1000 + 250 + 14
  });

  it('zero tax rate produces zero tax even on taxable materials', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [],
      allMaterialEntries: [me({ billing_amount: 1000, taxable: true })],
      settings: settings({ tax_pct: 0 }),
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
    });
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(1000);
  });

  it('warns on empty period', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [],
      allMaterialEntries: [],
      settings: settings(),
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
    });
    expect(result.warnings).toContain(
      'No unbilled time or materials in this period — the invoice will be empty.',
    );
    expect(result.total).toBe(0);
  });

  it('warns when no customer name set', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [te()],
      allMaterialEntries: [],
      settings: settings({ customer_name: null }),
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
    });
    expect(result.warnings.some((w) => w.includes('customer name'))).toBe(true);
  });

  it('warns when tax_pct > 0 but no taxable materials', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [],
      allMaterialEntries: [me({ billing_amount: 100, taxable: false })],
      settings: settings({ tax_pct: 6.5 }),
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
    });
    expect(result.warnings.some((w) => w.includes('Tax %'))).toBe(true);
    expect(result.taxAmount).toBe(0);
  });

  it('snapshots customer info from settings', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [te()],
      allMaterialEntries: [],
      settings: settings(),
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
    });
    expect(result.customerSnapshot).toEqual({
      name: 'Acme Corp',
      email: 'ap@acme.com',
      address: '123 Main St',
      poNumber: 'PO-12345',
    });
  });

  it('resolves due_date from invoice_date + payment_terms_days when not provided', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [te()],
      allMaterialEntries: [],
      settings: settings({ payment_terms_days: 30 }),
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
    });
    expect(result.resolvedDueDate).toBe('2026-06-30');
  });

  it('explicit due_date overrides settings terms', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [te()],
      allMaterialEntries: [],
      settings: settings({ payment_terms_days: 30 }),
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
      dueDate: '2026-08-15',
    });
    expect(result.resolvedDueDate).toBe('2026-08-15');
  });

  it('null settings → no tax, no customer, no due date', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [te({ billable_amount: 760 })],
      allMaterialEntries: [],
      settings: null,
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
    });
    expect(result.taxPct).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(760);
    expect(result.resolvedDueDate).toBe(null);
    expect(result.customerSnapshot.name).toBe(null);
  });

  it('boundary dates (period_start and period_end) are inclusive', () => {
    const result = generateInvoiceDraft({
      projectId: 'p-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      allTimeEntries: [
        te({ id: 'start', work_date: '2026-05-01' }),
        te({ id: 'end', work_date: '2026-05-31' }),
      ],
      allMaterialEntries: [],
      settings: settings({ tax_pct: 0 }),
      invoiceNumber: 'X',
      invoiceDate: '2026-05-31',
    });
    expect(result.timeEntries.map((t) => t.id).sort()).toEqual(['end', 'start']);
  });
});

describe('nextInvoiceNumber', () => {
  it('builds the next invoice number from prefix + zero-padded counter', () => {
    expect(nextInvoiceNumber(settings({ invoice_prefix: 'INV-2026-', next_invoice_number: 9 })))
      .toBe('INV-2026-0009');
    expect(nextInvoiceNumber(settings({ invoice_prefix: 'X-', next_invoice_number: 1 })))
      .toBe('X-0001');
  });

  it('falls back to INV- prefix when none set', () => {
    expect(nextInvoiceNumber(settings({ invoice_prefix: null, next_invoice_number: 5 })))
      .toBe('INV-0005');
  });

  it('handles null settings', () => {
    expect(nextInvoiceNumber(null)).toBe('INV-0001');
  });

  it('large numbers still left-pad to 4 digits minimum', () => {
    expect(nextInvoiceNumber(settings({ invoice_prefix: 'INV-', next_invoice_number: 12345 })))
      .toBe('INV-12345');
  });
});
