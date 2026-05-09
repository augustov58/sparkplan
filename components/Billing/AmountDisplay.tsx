/**
 * AmountDisplay — formats USD with cents, optionally color-coded by sign or
 * by `tone`. Used everywhere on the billing pages so positive/negative/zero
 * money values render consistently.
 */

import React from 'react';
import { formatUSD } from '@/services/billing/billingMath';

export type AmountTone =
  | 'default'   // no color
  | 'positive' // green (e.g., paid, profit)
  | 'negative' // red (e.g., overdue balance)
  | 'muted'    // grey (e.g., zero / placeholder)
  | 'auto';    // green if > 0, red if < 0, grey if 0

interface AmountDisplayProps {
  value: number | null | undefined;
  tone?: AmountTone;
  /** When true, prefixes a `+` sign for non-negative values (useful for diffs). */
  showSign?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<Exclude<AmountTone, 'auto'>, string> = {
  default: 'text-[#1a1a1a]',
  positive: 'text-emerald-700',
  negative: 'text-red-600',
  muted: 'text-[#888]',
};

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  value,
  tone = 'default',
  showSign = false,
  className = '',
}) => {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : 0;

  let resolvedTone: Exclude<AmountTone, 'auto'>;
  if (tone === 'auto') {
    if (num > 0) resolvedTone = 'positive';
    else if (num < 0) resolvedTone = 'negative';
    else resolvedTone = 'muted';
  } else {
    resolvedTone = tone;
  }

  const formatted = formatUSD(num);
  const display = showSign && num > 0 ? `+${formatted}` : formatted;

  return (
    <span className={`tabular-nums ${TONE_CLASSES[resolvedTone]} ${className}`}>{display}</span>
  );
};
