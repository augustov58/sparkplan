/**
 * PermitStatusPill — color-coded status pill for permits.
 *
 * Centralized so the list, drawer, and overview tabs share visuals.
 * Phase 1 Permits Beta — see docs/plans/permits-implementation.md §4.4.
 */
import React from 'react';
import {
  type PermitStatus,
  getStatusLabel,
} from '../../services/permits/permitStatusTransitions';

interface PermitStatusPillProps {
  status: PermitStatus | string; // string fallback so DB drift can't crash render
  size?: 'sm' | 'md';
}

const STYLES: Record<PermitStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  in_review: 'bg-blue-50 text-blue-700 border-blue-200',
  returned: 'bg-orange-50 text-orange-700 border-orange-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
  closed: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

export const PermitStatusPill: React.FC<PermitStatusPillProps> = ({
  status,
  size = 'sm',
}) => {
  const cls = STYLES[status as PermitStatus] || STYLES.draft;
  const sizing =
    size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  const label = getStatusLabel(status as PermitStatus);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider ${cls} ${sizing}`}
    >
      {label}
    </span>
  );
};
