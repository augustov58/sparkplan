/**
 * Permit Expiration Warning — Phase 1 Permits Beta
 *
 * Pure function. Given an `expires_at` ISO timestamp, returns a warning
 * level so the UI can render an amber/red chip.
 *
 * Threshold: 30 days = 'expiring_soon'. Per FBC 105.4 / NFPA 70 the FL
 * standard is 180 days from issuance unless work commenced and a passed
 * inspection is on file; 30 days of runway gives a contractor time to
 * either (a) get an inspection on the books or (b) ask the AHJ for an
 * extension.
 *
 * Reference: docs/plans/permits-implementation.md §4.6
 */

export type ExpirationStatus = null | 'expiring_soon' | 'expired';

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 30;

/**
 * @param expiresAt ISO 8601 timestamp string, or null (no expiry tracked)
 * @param now optional reference time (defaults to Date.now()) — accepted
 *   for testability so tests don't need to time-mock the clock.
 * @returns
 *   - `null` when expires_at is null or the permit has more than 30 days left
 *   - `'expiring_soon'` when 0 ≤ days remaining ≤ 30
 *   - `'expired'` when days remaining < 0
 */
export function getExpirationStatus(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): ExpirationStatus {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;

  const daysRemaining = Math.floor(
    (expiry.getTime() - now.getTime()) / MILLIS_PER_DAY,
  );

  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= EXPIRING_SOON_DAYS) return 'expiring_soon';
  return null;
}

/**
 * @returns days between `now` and `expiresAt`. Negative when expired.
 *   Returns null when expiresAt is missing/invalid.
 */
export function getDaysUntilExpiration(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!expiresAt) return null;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.floor((expiry.getTime() - now.getTime()) / MILLIS_PER_DAY);
}

/**
 * Render-friendly summary of a permit's expiration state.
 *
 * @example
 *   formatExpirationLabel('2026-06-01T00:00:00Z', new Date('2026-05-09'))
 *   // -> 'Expires in 22 days'
 *   formatExpirationLabel('2026-04-01T00:00:00Z', new Date('2026-05-09'))
 *   // -> 'Expired 38 days ago'
 */
export function formatExpirationLabel(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const days = getDaysUntilExpiration(expiresAt, now);
  if (days === null) return null;
  if (days < 0) {
    const abs = Math.abs(days);
    return `Expired ${abs} day${abs === 1 ? '' : 's'} ago`;
  }
  if (days === 0) return 'Expires today';
  return `Expires in ${days} day${days === 1 ? '' : 's'}`;
}
