/**
 * Estimate Status Transitions — pure state machine.
 *
 * Plan §4.6:
 *
 *   draft      -> submitted, cancelled
 *   submitted  -> accepted, rejected, expired, draft   (revert to draft allowed)
 *   accepted   -> cancelled                            (terminal-ish)
 *   rejected   -> draft                                (rework + resubmit)
 *   expired    -> draft, submitted                     (refresh or just resubmit)
 *   cancelled  -> ()                                   (terminal)
 *
 * The DB CHECK constraint guarantees the *value* is one of the 6 known statuses
 * but does not enforce the transition graph. The application gates writes
 * through `canTransition()`; if a future migration wants harder enforcement
 * (e.g. a Postgres trigger), it can encode the same graph there.
 */

export type EstimateStatus =
  | 'draft'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'cancelled';

const TRANSITIONS: Record<EstimateStatus, EstimateStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['accepted', 'rejected', 'expired', 'draft'],
  accepted: ['cancelled'],
  rejected: ['draft'],
  expired: ['draft', 'submitted'],
  cancelled: [],
};

export const ALL_ESTIMATE_STATUSES: readonly EstimateStatus[] = [
  'draft',
  'submitted',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
];

/**
 * Whether `from -> to` is a legal transition. Same-status (`from === to`) is
 * always legal (no-op).
 */
export function canTransition(
  from: EstimateStatus,
  to: EstimateStatus
): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Allowed next statuses from `current` (excludes `current` itself).
 */
export function allowedNextStatuses(current: EstimateStatus): EstimateStatus[] {
  return [...(TRANSITIONS[current] ?? [])];
}

/**
 * Whether the status is terminal (no outgoing transitions).
 */
export function isTerminal(status: EstimateStatus): boolean {
  return (TRANSITIONS[status]?.length ?? 0) === 0;
}

/**
 * Human-readable labels. Used for status pills and dropdown menus.
 */
export const STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

/**
 * Tailwind class hint used by the status pill component. Centralizing here
 * keeps the visual palette consistent across list view, detail view, and PDF.
 */
export const STATUS_PILL_CLASSES: Record<EstimateStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 ring-gray-300',
  submitted: 'bg-blue-100 text-blue-700 ring-blue-300',
  accepted: 'bg-green-100 text-green-700 ring-green-300',
  rejected: 'bg-rose-100 text-rose-700 ring-rose-300',
  expired: 'bg-amber-100 text-amber-700 ring-amber-300',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-300',
};
