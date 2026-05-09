/**
 * Tests — permitStatusTransitions service (Phase 1 Permits Beta)
 *
 * Pure functions; no I/O, no DB. Run with `npm test`.
 */

import { describe, it, expect } from 'vitest';
import {
  PERMIT_STATUSES,
  type PermitStatus,
  getValidNextStatuses,
  isValidTransition,
  isTerminalStatus,
  getStatusLabel,
} from '../../services/permits/permitStatusTransitions';

describe('getValidNextStatuses', () => {
  it('draft can advance to submitted or cancelled', () => {
    expect(getValidNextStatuses('draft')).toEqual(['submitted', 'cancelled']);
  });

  it('submitted has 4 forward states (in_review, returned, approved, cancelled)', () => {
    expect(getValidNextStatuses('submitted')).toEqual([
      'in_review',
      'returned',
      'approved',
      'cancelled',
    ]);
  });

  it('in_review can move to approved/returned/cancelled', () => {
    expect(getValidNextStatuses('in_review')).toEqual([
      'approved',
      'returned',
      'cancelled',
    ]);
  });

  it('returned permits the resubmission flow back to submitted', () => {
    expect(getValidNextStatuses('returned')).toContain('submitted');
  });

  it('approved permits closure or expiration', () => {
    const next = getValidNextStatuses('approved');
    expect(next).toContain('closed');
    expect(next).toContain('expired');
  });

  it('expired can be late-closed', () => {
    expect(getValidNextStatuses('expired')).toEqual(['closed']);
  });

  it('closed is terminal', () => {
    expect(getValidNextStatuses('closed')).toEqual([]);
  });

  it('cancelled is terminal', () => {
    expect(getValidNextStatuses('cancelled')).toEqual([]);
  });

  it('every status returns an array (no undefined)', () => {
    for (const s of PERMIT_STATUSES) {
      expect(Array.isArray(getValidNextStatuses(s))).toBe(true);
    }
  });
});

describe('isValidTransition', () => {
  it('forward transitions allowed', () => {
    expect(isValidTransition('draft', 'submitted')).toBe(true);
    expect(isValidTransition('submitted', 'approved')).toBe(true);
    expect(isValidTransition('approved', 'closed')).toBe(true);
  });

  it('backward transitions are blocked from the dropdown', () => {
    expect(isValidTransition('approved', 'in_review')).toBe(false);
    expect(isValidTransition('closed', 'approved')).toBe(false);
    expect(isValidTransition('submitted', 'draft')).toBe(false);
  });

  it('terminal states reject all transitions', () => {
    for (const target of PERMIT_STATUSES) {
      expect(isValidTransition('closed', target)).toBe(false);
      expect(isValidTransition('cancelled', target)).toBe(false);
    }
  });

  it('self-transitions are not allowed', () => {
    for (const s of PERMIT_STATUSES) {
      expect(isValidTransition(s, s)).toBe(false);
    }
  });
});

describe('isTerminalStatus', () => {
  it('closed and cancelled are terminal', () => {
    expect(isTerminalStatus('closed')).toBe(true);
    expect(isTerminalStatus('cancelled')).toBe(true);
  });

  it('non-terminal statuses are not terminal', () => {
    const nonTerminal: PermitStatus[] = [
      'draft',
      'submitted',
      'in_review',
      'returned',
      'approved',
      'expired',
    ];
    for (const s of nonTerminal) {
      expect(isTerminalStatus(s)).toBe(false);
    }
  });
});

describe('getStatusLabel', () => {
  it('returns Title Case display strings', () => {
    expect(getStatusLabel('draft')).toBe('Draft');
    expect(getStatusLabel('in_review')).toBe('In Review');
    expect(getStatusLabel('approved')).toBe('Approved');
  });

  it('renders every status to a non-empty string', () => {
    for (const s of PERMIT_STATUSES) {
      expect(getStatusLabel(s)).toBeTruthy();
    }
  });
});
