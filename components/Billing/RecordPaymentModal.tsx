/**
 * RecordPaymentModal — record a manual payment against an invoice.
 *
 * The DB trigger handles paid_amount / balance_due / status flips after the
 * payment is INSERTed; the UI just collects the values.
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { paymentSchema, type PaymentFormData } from '@/lib/validation-schemas';
import { formatUSD } from '@/services/billing/billingMath';
import type { Database } from '@/lib/database.types';

type Invoice = Database['public']['Tables']['invoices']['Row'];

interface RecordPaymentModalProps {
  invoice: Invoice;
  onSubmit: (values: PaymentFormData) => Promise<void>;
  onClose: () => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  invoice,
  onSubmit,
  onClose,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: invoice.balance_due,
      payment_date: todayISO(),
      payment_method: 'check',
      reference: '',
      notes: '',
    },
  });

  const submit = async (values: PaymentFormData) => {
    await onSubmit({
      ...values,
      reference: values.reference?.trim() || null,
      notes: values.notes?.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#e8e6e3]">
          <div>
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Record payment</h2>
            <p className="text-xs text-[#666]">
              {invoice.invoice_number} • Balance due {formatUSD(invoice.balance_due)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#f0eeeb] text-[#666]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit(submit)} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                {...register('amount', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
                autoFocus
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">Payment date</label>
              <input
                type="date"
                {...register('payment_date')}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              />
              {errors.payment_date && (
                <p className="mt-1 text-xs text-red-600">{errors.payment_date.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444] mb-1">Method</label>
            <select
              {...register('payment_method')}
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded bg-white focus:outline-none focus:ring-2 focus:ring-electric-500"
            >
              <option value="check">Check</option>
              <option value="ach">ACH</option>
              <option value="wire">Wire</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444] mb-1">
              Reference / check #
            </label>
            <input
              type="text"
              {...register('reference')}
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              placeholder="e.g., Check #1234"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444] mb-1">Notes</label>
            <textarea
              {...register('notes')}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
            />
          </div>

          <footer className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8e6e3]">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={<Save className="w-4 h-4" />}
              loading={isSubmitting}
            >
              Record payment
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
};
