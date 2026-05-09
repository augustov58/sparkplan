/**
 * Invoice status state machine.
 *
 * Lifecycle:
 *   draft  ──send──→  sent
 *   sent   ──record payment, partial──→  partial_paid
 *   sent / partial_paid ──record payment, full──→  paid (terminal)
 *   sent / partial_paid ──due_date passed──→  overdue
 *   any non-terminal ──cancel──→  cancelled (terminal)
 *
 * `paid` and `cancelled` are terminal. `overdue` is NOT terminal — recording
 * a payment can still flip it back to partial_paid → paid.
 *
 * Pure functions only. No DB. No side effects.
 */

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partial_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'draft',
  'sent',
  'partial_paid',
  'paid',
  'overdue',
  'cancelled',
];

/**
 * Allowed manual transitions from each status. The state machine is *more*
 * permissive than the typical send→pay→done flow because the contractor
 * sometimes needs to manually correct status (e.g., un-cancelling is
 * disallowed; bouncing a payment requires deleting the payment record).
 */
const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['partial_paid', 'paid', 'overdue', 'cancelled'],
  partial_paid: ['paid', 'overdue', 'cancelled'],
  paid: [], // terminal
  overdue: ['partial_paid', 'paid', 'cancelled'],
  cancelled: [], // terminal
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: InvoiceStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * Derive what the status SHOULD be given current paid_amount, total, and
 * (optional) due_date. Used by `useInvoices` to auto-update overdue status
 * on page load (no cron in Phase 1).
 *
 * Rules (in priority order):
 *   1. If `current` is `cancelled` or `draft`, leave it alone — manual states.
 *   2. If paid_amount + epsilon >= total, return `paid`.
 *   3. If paid_amount > 0, return `partial_paid` (or `overdue` if past due).
 *   4. If paid_amount === 0 and due_date < today, return `overdue`.
 *   5. Otherwise return `sent`.
 *
 * `epsilon` is $0.01 — guards against floating-point drift on cleanly paid
 * invoices.
 */
export function deriveInvoiceStatus(
  current: InvoiceStatus,
  paidAmount: number,
  total: number,
  dueDate: string | null,
  today: Date,
): InvoiceStatus {
  if (current === 'draft' || current === 'cancelled') return current;

  const epsilon = 0.01;
  if (paidAmount + epsilon >= total && total > 0) return 'paid';

  const pastDue =
    dueDate !== null && dueDate !== undefined && dueDate.length === 10
      ? dueDate < today.toISOString().slice(0, 10)
      : false;

  if (paidAmount > 0) {
    // Partially paid + past due still shows as overdue (same as invoice not paid)
    return pastDue ? 'overdue' : 'partial_paid';
  }

  return pastDue ? 'overdue' : 'sent';
}

/** Human-readable label. Used in pills, dropdowns, PDF headers. */
export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partial_paid: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};
