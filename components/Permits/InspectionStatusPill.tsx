/**
 * InspectionStatusPill — color-coded status pill for permit inspections.
 */
import React from 'react';

const STYLES: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  passed: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  conditional_pass: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200',
  no_show: 'bg-orange-50 text-orange-700 border-orange-200',
};

const LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  passed: 'Passed',
  failed: 'Failed',
  conditional_pass: 'Conditional',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

interface InspectionStatusPillProps {
  status: string;
  size?: 'sm' | 'md';
}

export const InspectionStatusPill: React.FC<InspectionStatusPillProps> = ({
  status,
  size = 'sm',
}) => {
  const cls = STYLES[status] || STYLES.scheduled;
  const sizing =
    size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  const label = LABELS[status] || status;
  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold uppercase tracking-wider ${cls} ${sizing}`}
    >
      {label}
    </span>
  );
};
