/**
 * GenerateInvoiceModal — pick a date range, preview unbilled, click Generate.
 *
 * Uses `generateInvoiceDraft` (pure function) to compute totals as the user
 * tweaks the period dates, then `useInvoices.generateInvoice` to call the
 * RPC for the atomic write.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { generateInvoiceSchema, type GenerateInvoiceFormData } from '@/lib/validation-schemas';
import {
  generateInvoiceDraft,
  nextInvoiceNumber,
  type GenerateInvoiceResult,
} from '@/services/billing/invoiceGenerator';
import { formatUSD } from '@/services/billing/billingMath';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useMaterialEntries } from '@/hooks/useMaterialEntries';
import { useProjectBillingSettings } from '@/hooks/useProjectBillingSettings';
import { useInvoices } from '@/hooks/useInvoices';

interface GenerateInvoiceModalProps {
  projectId: string;
  /** Optional initial period (defaults to current calendar month). */
  initialPeriodStart?: string;
  initialPeriodEnd?: string;
  onClose: () => void;
  /** Called with the new invoice ID after a successful generate. */
  onGenerated?: (invoiceId: string) => void;
}

function startOfMonthISO(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 7)}-01`;
}

function endOfMonthISO(): string {
  const d = new Date();
  // Day 0 of next month = last day of current month
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const GenerateInvoiceModal: React.FC<GenerateInvoiceModalProps> = ({
  projectId,
  initialPeriodStart,
  initialPeriodEnd,
  onClose,
  onGenerated,
}) => {
  const { timeEntries } = useTimeEntries(projectId);
  const { materialEntries } = useMaterialEntries(projectId);
  const { settings } = useProjectBillingSettings(projectId);
  const { generateInvoice } = useInvoices(projectId);

  const defaultInvoiceDate = new Date().toISOString().slice(0, 10);
  const defaultDueDate = settings?.payment_terms_days
    ? addDaysISO(defaultInvoiceDate, settings.payment_terms_days)
    : null;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<GenerateInvoiceFormData>({
    resolver: zodResolver(generateInvoiceSchema),
    defaultValues: {
      period_start: initialPeriodStart ?? startOfMonthISO(),
      period_end: initialPeriodEnd ?? endOfMonthISO(),
      invoice_number: nextInvoiceNumber(settings),
      invoice_date: defaultInvoiceDate,
      due_date: defaultDueDate,
      description: '',
      notes: '',
      mark_sent: false,
    },
  });

  // Re-derive default invoice number when settings load
  useEffect(() => {
    if (settings) {
      setValue('invoice_number', nextInvoiceNumber(settings));
      if (settings.payment_terms_days != null) {
        setValue('due_date', addDaysISO(defaultInvoiceDate, settings.payment_terms_days));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.next_invoice_number, settings?.invoice_prefix]);

  const periodStart = watch('period_start');
  const periodEnd = watch('period_end');
  const invoiceDate = watch('invoice_date');
  const dueDate = watch('due_date');

  // Live preview of totals
  const draft: GenerateInvoiceResult | null = useMemo(() => {
    if (!periodStart || !periodEnd || periodEnd < periodStart) return null;
    return generateInvoiceDraft({
      projectId,
      periodStart,
      periodEnd,
      allTimeEntries: timeEntries,
      allMaterialEntries: materialEntries,
      settings: settings ?? null,
      invoiceNumber: watch('invoice_number') || 'TMP',
      invoiceDate: invoiceDate || defaultInvoiceDate,
      dueDate: dueDate ?? null,
    });
  }, [
    periodStart,
    periodEnd,
    timeEntries,
    materialEntries,
    settings,
    invoiceDate,
    dueDate,
    projectId,
    watch,
    defaultInvoiceDate,
  ]);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async (values: GenerateInvoiceFormData) => {
    setSubmitError(null);
    if (!draft) {
      setSubmitError('Adjust the period to compute totals.');
      return;
    }
    const id = await generateInvoice(projectId, {
      draft,
      invoiceNumber: values.invoice_number,
      invoiceDate: values.invoice_date,
      dueDate: values.due_date ?? null,
      periodStart: values.period_start,
      periodEnd: values.period_end,
      description: values.description ?? null,
      notes: values.notes ?? null,
      markSent: values.mark_sent,
    });
    if (id) {
      onGenerated?.(id);
      onClose();
    } else {
      setSubmitError('Failed to generate invoice. Check the invoice number is unique.');
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500';
  const labelCls = 'block text-xs font-medium text-[#444] mb-1';
  const errCls = 'mt-1 text-xs text-red-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#e8e6e3]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#666]" />
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Generate invoice</h2>
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
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#666] mb-2">
              Period
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>From</label>
                <input type="date" {...register('period_start')} className={inputCls} />
                {errors.period_start && (
                  <p className={errCls}>{errors.period_start.message}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>To</label>
                <input type="date" {...register('period_end')} className={inputCls} />
                {errors.period_end && (
                  <p className={errCls}>{errors.period_end.message}</p>
                )}
              </div>
            </div>
          </section>

          {/* Live preview */}
          <section className="bg-[#faf9f7] border border-[#e8e6e3] rounded-lg p-3 text-sm space-y-1">
            {draft ? (
              <>
                <div className="flex justify-between">
                  <span className="text-[#666]">
                    {draft.timeEntries.length} unbilled time{' '}
                    {draft.timeEntries.length === 1 ? 'entry' : 'entries'}
                  </span>
                  <span className="tabular-nums">{formatUSD(draft.subtotalLabor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666]">
                    {draft.materialEntries.length} unbilled material{' '}
                    {draft.materialEntries.length === 1 ? 'item' : 'items'}
                  </span>
                  <span className="tabular-nums">{formatUSD(draft.subtotalMaterials)}</span>
                </div>
                <div className="flex justify-between text-[#666]">
                  <span>Tax ({draft.taxPct}% on materials)</span>
                  <span className="tabular-nums">{formatUSD(draft.taxAmount)}</span>
                </div>
                <div className="border-t border-[#e8e6e3] pt-1 flex justify-between font-semibold">
                  <span>Invoice total</span>
                  <span className="tabular-nums">{formatUSD(draft.total)}</span>
                </div>
                {draft.warnings.length > 0 && (
                  <div className="border-t border-[#e8e6e3] pt-2 mt-2">
                    {draft.warnings.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 text-xs text-amber-800"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-[#888] text-xs">Pick a valid date range to preview totals.</p>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#666] mb-2">
              Invoice details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Invoice #</label>
                <input type="text" {...register('invoice_number')} className={inputCls} />
                {errors.invoice_number && (
                  <p className={errCls}>{errors.invoice_number.message}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Invoice date</label>
                <input type="date" {...register('invoice_date')} className={inputCls} />
                {errors.invoice_date && (
                  <p className={errCls}>{errors.invoice_date.message}</p>
                )}
              </div>
              <div>
                <label className={labelCls}>Due date</label>
                <input
                  type="date"
                  {...register('due_date', {
                    setValueAs: (v) => (v === '' || v == null ? null : v),
                  })}
                  className={inputCls}
                />
                {errors.due_date && <p className={errCls}>{errors.due_date.message}</p>}
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-[#444]">
                  <input type="checkbox" {...register('mark_sent')} className="rounded" />
                  Mark as sent immediately
                </label>
              </div>
            </div>

            <div className="mt-3">
              <label className={labelCls}>Description</label>
              <input
                type="text"
                {...register('description')}
                className={inputCls}
                placeholder='e.g., "May 2026 work — kitchen rough-in"'
              />
            </div>
            <div className="mt-3">
              <label className={labelCls}>Notes (shown on PDF)</label>
              <textarea {...register('notes')} rows={2} className={inputCls} />
            </div>
          </section>

          {submitError && (
            <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-2">
              {submitError}
            </p>
          )}

          <footer className="flex items-center justify-end gap-2 pt-2 border-t border-[#e8e6e3]">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={<FileText className="w-4 h-4" />}
              loading={isSubmitting}
              disabled={!draft || draft.total === 0}
            >
              Generate invoice
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
};
