/**
 * InvoiceStatusPill — small color-coded pill for invoice status.
 */

import React from 'react';
import {
  STATUS_LABEL,
  type InvoiceStatus,
} from '@/services/billing/invoiceStatusTransitions';

const STATUS_CLASSES: Record<InvoiceStatus, string> = {
  draft: 'bg-[#f0eeeb] text-[#666] border-[#d8d4cf]',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  partial_paid: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-[#f0eeeb] text-[#888] border-[#d8d4cf] line-through',
};

interface InvoiceStatusPillProps {
  status: InvoiceStatus | string;
  className?: string;
}

export const InvoiceStatusPill: React.FC<InvoiceStatusPillProps> = ({ status, className = '' }) => {
  // Defensive: if the DB returns a status we don't know, render it raw.
  const known = (STATUS_LABEL as Record<string, string>)[status as string]
    ? (status as InvoiceStatus)
    : null;
  const label = known ? STATUS_LABEL[known] : (status as string);
  const cls = known ? STATUS_CLASSES[known] : 'bg-[#f0eeeb] text-[#888] border-[#d8d4cf]';

  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-medium ${cls} ${className}`}
    >
      {label}
    </span>
  );
};
