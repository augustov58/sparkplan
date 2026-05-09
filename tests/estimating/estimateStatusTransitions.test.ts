/**
 * Tests for services/estimating/estimateStatusTransitions.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  ALL_ESTIMATE_STATUSES,
  STATUS_LABELS,
  STATUS_PILL_CLASSES,
  allowedNextStatuses,
  canTransition,
  isTerminal,
  type EstimateStatus,
} from '../../services/estimating/estimateStatusTransitions';

describe('canTransition — explicit graph', () => {
  it('draft can go to submitted or cancelled', () => {
    expect(canTransition('draft', 'submitted')).toBe(true);
    expect(canTransition('draft', 'cancelled')).toBe(true);
    expect(canTransition('draft', 'accepted')).toBe(false);
    expect(canTransition('draft', 'rejected')).toBe(false);
    expect(canTransition('draft', 'expired')).toBe(false);
  });

  it('submitted can go to accepted, rejected, expired, or back to draft', () => {
    expect(canTransition('submitted', 'accepted')).toBe(true);
    expect(canTransition('submitted', 'rejected')).toBe(true);
    expect(canTransition('submitted', 'expired')).toBe(true);
    expect(canTransition('submitted', 'draft')).toBe(true);
    expect(canTransition('submitted', 'cancelled')).toBe(false);
  });

  it('accepted is terminal-ish — only cancelled allowed', () => {
    expect(canTransition('accepted', 'cancelled')).toBe(true);
    expect(canTransition('accepted', 'draft')).toBe(false);
    expect(canTransition('accepted', 'submitted')).toBe(false);
  });

  it('rejected can be reworked back to draft', () => {
    expect(canTransition('rejected', 'draft')).toBe(true);
    expect(canTransition('rejected', 'submitted')).toBe(false);
  });

  it('expired can be refreshed to draft or directly resubmitted', () => {
    expect(canTransition('expired', 'draft')).toBe(true);
    expect(canTransition('expired', 'submitted')).toBe(true);
  });

  it('cancelled is fully terminal', () => {
    for (const status of ALL_ESTIMATE_STATUSES) {
      if (status === 'cancelled') continue;
      expect(canTransition('cancelled', status)).toBe(false);
    }
  });

  it('same-status transitions are no-ops and always allowed', () => {
    for (const status of ALL_ESTIMATE_STATUSES) {
      expect(canTransition(status, status)).toBe(true);
    }
  });
});

describe('isTerminal', () => {
  it('cancelled is terminal', () => {
    expect(isTerminal('cancelled')).toBe(true);
  });

  it('all other statuses have outgoing edges', () => {
    const nonTerminal: EstimateStatus[] = [
      'draft',
      'submitted',
      'accepted',
      'rejected',
      'expired',
    ];
    for (const s of nonTerminal) {
      expect(isTerminal(s)).toBe(false);
    }
  });
});

describe('allowedNextStatuses', () => {
  it('returns a fresh array (mutating it does not affect later calls)', () => {
    const a = allowedNextStatuses('draft');
    a.push('accepted'); // mutate
    const b = allowedNextStatuses('draft');
    expect(b).toEqual(['submitted', 'cancelled']);
  });
});

describe('Status visual maps', () => {
  it('every status has a label and pill class', () => {
    for (const status of ALL_ESTIMATE_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_PILL_CLASSES[status]).toBeTruthy();
    }
  });
});
