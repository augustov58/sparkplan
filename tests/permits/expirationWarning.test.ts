/**
 * Tests — permitExpirationWarning service (Phase 1 Permits Beta)
 *
 * Pure functions; no I/O. Run with `npm test`.
 */

import { describe, it, expect } from 'vitest';
import {
  getExpirationStatus,
  getDaysUntilExpiration,
  formatExpirationLabel,
} from '../../services/permits/permitExpirationWarning';

const NOW = new Date('2026-05-09T12:00:00Z');

describe('getExpirationStatus', () => {
  it('returns null when expires_at is null', () => {
    expect(getExpirationStatus(null, NOW)).toBeNull();
  });

  it('returns null when expires_at is undefined', () => {
    expect(getExpirationStatus(undefined, NOW)).toBeNull();
  });

  it('returns null when expires_at is far in the future (>30 days)', () => {
    const future = '2026-08-01T00:00:00Z'; // 84 days out
    expect(getExpirationStatus(future, NOW)).toBeNull();
  });

  it("returns 'expiring_soon' at exactly 30 days remaining", () => {
    const expiry = '2026-06-08T12:00:00Z'; // exactly 30 days from NOW
    expect(getExpirationStatus(expiry, NOW)).toBe('expiring_soon');
  });

  it("returns 'expiring_soon' for 1 day remaining", () => {
    const expiry = '2026-05-10T12:00:00Z';
    expect(getExpirationStatus(expiry, NOW)).toBe('expiring_soon');
  });

  it("returns 'expiring_soon' at exactly 0 days (today)", () => {
    const expiry = '2026-05-09T20:00:00Z'; // later same day
    expect(getExpirationStatus(expiry, NOW)).toBe('expiring_soon');
  });

  it("returns 'expired' when expires_at is in the past", () => {
    const expiry = '2026-05-06T12:00:00Z'; // 3 days ago
    expect(getExpirationStatus(expiry, NOW)).toBe('expired');
  });

  it('returns null for invalid date strings (gracefully)', () => {
    expect(getExpirationStatus('not-a-date', NOW)).toBeNull();
  });
});

describe('getDaysUntilExpiration', () => {
  it('returns null for null input', () => {
    expect(getDaysUntilExpiration(null, NOW)).toBeNull();
  });

  it('returns positive number for future expiry', () => {
    const expiry = '2026-06-08T12:00:00Z';
    expect(getDaysUntilExpiration(expiry, NOW)).toBe(30);
  });

  it('returns negative number for past expiry', () => {
    const expiry = '2026-05-06T12:00:00Z';
    expect(getDaysUntilExpiration(expiry, NOW)).toBe(-3);
  });

  it('returns null for invalid date string', () => {
    expect(getDaysUntilExpiration('garbage', NOW)).toBeNull();
  });
});

describe('formatExpirationLabel', () => {
  it('returns null for missing expiration', () => {
    expect(formatExpirationLabel(null, NOW)).toBeNull();
  });

  it('formats future expirations with day count', () => {
    expect(formatExpirationLabel('2026-06-08T12:00:00Z', NOW)).toBe(
      'Expires in 30 days',
    );
  });

  it('renders singular day correctly', () => {
    expect(formatExpirationLabel('2026-05-10T12:00:00Z', NOW)).toBe(
      'Expires in 1 day',
    );
  });

  it("formats today as 'Expires today'", () => {
    expect(formatExpirationLabel('2026-05-09T20:00:00Z', NOW)).toBe(
      'Expires today',
    );
  });

  it('formats past expirations with elapsed days', () => {
    expect(formatExpirationLabel('2026-05-06T12:00:00Z', NOW)).toBe(
      'Expired 3 days ago',
    );
  });

  it('renders singular elapsed day correctly', () => {
    expect(formatExpirationLabel('2026-05-08T12:00:00Z', NOW)).toBe(
      'Expired 1 day ago',
    );
  });
});
