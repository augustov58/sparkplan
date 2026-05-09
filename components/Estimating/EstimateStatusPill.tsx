import React from 'react';
import {
  STATUS_LABELS,
  STATUS_PILL_CLASSES,
  type EstimateStatus,
} from '@/services/estimating/estimateStatusTransitions';

/**
 * Inline status pill. Used in the estimates list and detail header.
 * Pure visual — no transition logic. The dropdown lives on
 * EstimateDetailView and uses allowedNextStatuses().
 */
export const EstimateStatusPill: React.FC<{ status: string; className?: string }> = ({
  status,
  className = '',
}) => {
  const known = (status as EstimateStatus) in STATUS_LABELS ? (status as EstimateStatus) : 'draft';
  const klass = STATUS_PILL_CLASSES[known] ?? STATUS_PILL_CLASSES.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${klass} ${className}`}
    >
      {STATUS_LABELS[known]}
    </span>
  );
};
