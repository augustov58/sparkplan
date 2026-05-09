/**
 * Unit tests — payment reconciliation math (services/billing/billingMath.ts).
 *
 * Covers `sumPayments` and `computeBalanceDue`. The DB trigger
 * (`sync_invoice_paid_totals`) does the same arithmetic server-side; these
 * tests pin the client-side helpers so the optimistic-update path matches.
 */

import { describe, it, expect } from 'vitest';
import {
  sumPayments,
  computeBalanceDue,
  type Payment,
} from '../../services/billing/billingMath';

function payment(amount: number, overrides: Partial<Payment> = {}): Payment {
  return {
    id: `pmt-${Math.random().toString(36).slice(2, 8)}`,
    invoice_id: 'inv-1',
    user_id: 'u-1',
    amount,
    payment_date: '2026-05-01',
    payment_method: 'check',
    reference: null,
    notes: null,
    created_at: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

describe('sumPayments', () => {
  it('adds amounts and rounds to cents', () => {
    expect(sumPayments([payment(100), payment(50.25), payment(25.50)])).toBe(175.75);
  });

  it('returns 0 for empty', () => {
    expect(sumPayments([])).toBe(0);
  });

  it('handles many small payments without floating-point drift', () => {
    // 10 payments of $10.10 = $101.00 exactly
    const ten = Array.from({ length: 10 }, () => payment(10.10));
    expect(sumPayments(ten)).toBe(101);
  });

  it('handles 100 payments of $0.01 = $1.00 (notorious drift case)', () => {
    const hundred = Array.from({ length: 100 }, () => payment(0.01));
    expect(sumPayments(hundred)).toBe(1);
  });
});

describe('computeBalanceDue', () => {
  it('total - sum(payments)', () => {
    expect(computeBalanceDue(1000, [payment(400), payment(600)])).toBe(0);
    expect(computeBalanceDue(1000, [payment(400)])).toBe(600);
    expect(computeBalanceDue(1000, [])).toBe(1000);
  });

  it('overpayment clamps to 0 (no negative balance shown to users)', () => {
    expect(computeBalanceDue(100, [payment(150)])).toBe(0);
  });

  it('rounds to cents on partial-cent amounts', () => {
    // 1000.005 rounds up half-away (cents), so balance after $500 paid is 500.01
    expect(computeBalanceDue(1000.005, [payment(500)])).toBe(500.01);
  });

  it('handles invoice total of 0 cleanly', () => {
    expect(computeBalanceDue(0, [])).toBe(0);
  });

  it('successive partial payments converge to 0', () => {
    const total = 1234.56;
    const payments = [payment(500), payment(500), payment(234.56)];
    expect(sumPayments(payments)).toBe(1234.56);
    expect(computeBalanceDue(total, payments)).toBe(0);
  });
});
