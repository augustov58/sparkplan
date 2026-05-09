/**
 * Unit tests — services/billing/invoiceStatusTransitions.ts
 */

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isTerminal,
  deriveInvoiceStatus,
  INVOICE_STATUSES,
  type InvoiceStatus,
} from '../../services/billing/invoiceStatusTransitions';

describe('canTransition', () => {
  it('allows the documented forward path', () => {
    expect(canTransition('draft', 'sent')).toBe(true);
    expect(canTransition('sent', 'partial_paid')).toBe(true);
    expect(canTransition('sent', 'paid')).toBe(true);
    expect(canTransition('partial_paid', 'paid')).toBe(true);
    expect(canTransition('overdue', 'paid')).toBe(true);
    expect(canTransition('overdue', 'partial_paid')).toBe(true);
  });

  it('treats paid + cancelled as terminal — no outbound transitions', () => {
    for (const next of INVOICE_STATUSES) {
      expect(canTransition('paid', next)).toBe(false);
      expect(canTransition('cancelled', next)).toBe(false);
    }
  });

  it('disallows skipping draft state directly to paid', () => {
    expect(canTransition('draft', 'paid')).toBe(false);
    expect(canTransition('draft', 'partial_paid')).toBe(false);
    expect(canTransition('draft', 'overdue')).toBe(false);
  });

  it('allows cancelling at any non-terminal stage', () => {
    expect(canTransition('draft', 'cancelled')).toBe(true);
    expect(canTransition('sent', 'cancelled')).toBe(true);
    expect(canTransition('partial_paid', 'cancelled')).toBe(true);
    expect(canTransition('overdue', 'cancelled')).toBe(true);
  });
});

describe('isTerminal', () => {
  it('paid + cancelled are terminal; everything else is not', () => {
    expect(isTerminal('paid')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('draft')).toBe(false);
    expect(isTerminal('sent')).toBe(false);
    expect(isTerminal('partial_paid')).toBe(false);
    expect(isTerminal('overdue')).toBe(false);
  });
});

describe('deriveInvoiceStatus', () => {
  const today = new Date('2026-05-15T00:00:00Z');

  it('leaves draft and cancelled alone (manual states)', () => {
    expect(deriveInvoiceStatus('draft', 0, 1000, '2026-05-01', today)).toBe('draft');
    expect(deriveInvoiceStatus('cancelled', 0, 1000, '2026-05-01', today)).toBe('cancelled');
  });

  it('flips to paid when paid_amount >= total (with 1¢ epsilon)', () => {
    expect(deriveInvoiceStatus('sent', 1000, 1000, null, today)).toBe('paid');
    // $0.005 short rounds up via the epsilon
    expect(deriveInvoiceStatus('sent', 999.995, 1000, null, today)).toBe('paid');
  });

  it('flips to partial_paid when 0 < paid < total', () => {
    expect(deriveInvoiceStatus('sent', 500, 1000, null, today)).toBe('partial_paid');
  });

  it('marks overdue when due_date < today and unpaid', () => {
    expect(deriveInvoiceStatus('sent', 0, 1000, '2026-05-01', today)).toBe('overdue');
    expect(deriveInvoiceStatus('partial_paid', 200, 1000, '2026-05-01', today)).toBe('overdue');
  });

  it('does not mark overdue when due_date is today (exclusive boundary)', () => {
    // Today is 2026-05-15; due_date = 2026-05-15 is NOT past due yet
    expect(deriveInvoiceStatus('sent', 0, 1000, '2026-05-15', today)).toBe('sent');
  });

  it('does not flip to overdue when due_date is null', () => {
    expect(deriveInvoiceStatus('sent', 0, 1000, null, today)).toBe('sent');
  });

  it('total-of-zero invoices do not auto-flip to paid', () => {
    expect(deriveInvoiceStatus('sent', 0, 0, null, today)).toBe('sent');
  });

  it('staleness: paid status survives even if due_date is in the past', () => {
    // Once paid, can't flip back to overdue
    const result = deriveInvoiceStatus('paid', 1000, 1000, '2026-05-01', today);
    expect(result).toBe('paid');
  });
});
