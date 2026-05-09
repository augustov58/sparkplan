/**
 * Permit Status Transition Rules — Phase 1 Permits Beta
 *
 * Pure function. Given a current permit status, returns the array of
 * statuses the user is allowed to transition to next via the detail-drawer
 * status picker.
 *
 * Backwards transitions (e.g. approved -> in_review) are intentionally
 * NOT permitted from the dropdown — they preserve audit trail honesty.
 * If a permit really needs to be reopened, the user can use the explicit
 * Reopen button (Phase 2) which sets status to 'in_review'.
 *
 * Reference: docs/plans/permits-implementation.md §4.5
 */

export const PERMIT_STATUSES = [
  'draft',
  'submitted',
  'in_review',
  'returned',
  'approved',
  'expired',
  'closed',
  'cancelled',
] as const;

export type PermitStatus = (typeof PERMIT_STATUSES)[number];

const TRANSITIONS: Record<PermitStatus, PermitStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['in_review', 'returned', 'approved', 'cancelled'],
  in_review: ['approved', 'returned', 'cancelled'],
  returned: ['submitted', 'cancelled'], // resubmit after corrections
  approved: ['expired', 'closed', 'cancelled'],
  expired: ['closed'], // late closure if work was completed
  closed: [], // terminal
  cancelled: [], // terminal
};

/**
 * Returns the permit statuses the user may transition to from `current`.
 *
 * @param current - the current permit status
 * @returns array of valid next statuses (may be empty for terminal states)
 *
 * @example
 * getValidNextStatuses('draft')
 * // -> ['submitted', 'cancelled']
 *
 * getValidNextStatuses('closed')
 * // -> []
 */
export function getValidNextStatuses(current: PermitStatus): PermitStatus[] {
  return TRANSITIONS[current] ?? [];
}

/**
 * @returns true if a transition from `from` -> `to` is permitted via the
 *   forward-only state machine, false otherwise.
 */
export function isValidTransition(from: PermitStatus, to: PermitStatus): boolean {
  return getValidNextStatuses(from).includes(to);
}

/**
 * @returns true if `status` is terminal (no valid forward transitions).
 */
export function isTerminalStatus(status: PermitStatus): boolean {
  return getValidNextStatuses(status).length === 0;
}

/**
 * Human-readable label for a permit status. Centralized so list/detail
 * UIs render consistent strings.
 */
export function getStatusLabel(status: PermitStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'submitted':
      return 'Submitted';
    case 'in_review':
      return 'In Review';
    case 'returned':
      return 'Returned';
    case 'approved':
      return 'Approved';
    case 'expired':
      return 'Expired';
    case 'closed':
      return 'Closed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}
