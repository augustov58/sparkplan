/**
 * InvoiceDetailDrawer — full-screen overlay showing an invoice's lines,
 * payments, and actions (mark sent, record payment, download PDF, cancel,
 * delete).
 */

import React, { useMemo, useState } from 'react';
import { X, Send, DollarSign, Download, XCircle, Trash2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { Button } from '../ui/Button';
import { AmountDisplay } from './AmountDisplay';
import { InvoiceStatusPill } from './InvoiceStatusPill';
import { RecordPaymentModal } from './RecordPaymentModal';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useMaterialEntries } from '@/hooks/useMaterialEntries';
import { useInvoicePayments, type PaymentInput } from '@/hooks/useInvoicePayments';
import type { Database } from '@/lib/database.types';
import { formatUSD, formatHours } from '@/services/billing/billingMath';
import { canTransition, type InvoiceStatus } from '@/services/billing/invoiceStatusTransitions';
import { InvoicePdfDocument } from '@/services/pdfExport/InvoicePdfDocument';

type Invoice = Database['public']['Tables']['invoices']['Row'];

interface InvoiceDetailDrawerProps {
  invoice: Invoice;
  projectId: string;
  projectName: string;
  contractorName?: string;
  contractorLicense?: string;
  onClose: () => void;
  onMarkSent: () => Promise<void>;
  onCancel: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export const InvoiceDetailDrawer: React.FC<InvoiceDetailDrawerProps> = ({
  invoice,
  projectId,
  projectName,
  contractorName,
  contractorLicense,
  onClose,
  onMarkSent,
  onCancel,
  onDelete,
}) => {
  const { timeEntries } = useTimeEntries(projectId);
  const { materialEntries } = useMaterialEntries(projectId);
  const { payments, createPayment, deletePayment } = useInvoicePayments(invoice.id);

  const linkedTime = useMemo(
    () => timeEntries.filter((t) => t.invoice_id === invoice.id),
    [timeEntries, invoice.id],
  );
  const linkedMat = useMemo(
    () => materialEntries.filter((m) => m.invoice_id === invoice.id),
    [materialEntries, invoice.id],
  );

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const status = invoice.status as InvoiceStatus;
  const canSend = canTransition(status, 'sent');
  const canRecordPayment =
    status === 'sent' || status === 'partial_paid' || status === 'overdue';
  const canCancel = canTransition(status, 'cancelled');
  const isTerminal = status === 'paid' || status === 'cancelled';

  const handleRecordPayment = async (values: PaymentInput) => {
    await createPayment(values);
    setPaymentOpen(false);
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = await pdf(
        <InvoicePdfDocument
          invoice={invoice}
          timeEntries={linkedTime}
          materialEntries={linkedMat}
          projectName={projectName}
          contractorName={contractorName}
          contractorLicense={contractorLicense}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Close drawer"
        className="flex-1 bg-black/40"
        onClick={onClose}
      />
      <aside className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl">
        <header className="sticky top-0 bg-white border-b border-[#e8e6e3] px-5 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#1a1a1a]">
                Invoice {invoice.invoice_number}
              </h2>
              <InvoiceStatusPill status={invoice.status} />
            </div>
            <p className="text-xs text-[#666]">
              {invoice.period_start} → {invoice.period_end}
              {invoice.due_date && ` • Due ${invoice.due_date}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#f0eeeb] text-[#666]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-5 space-y-5">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              loading={downloading}
              onClick={handleDownloadPdf}
            >
              Download PDF
            </Button>
            {canSend && (
              <Button
                variant="primary"
                size="sm"
                icon={<Send className="w-4 h-4" />}
                onClick={onMarkSent}
              >
                Mark sent
              </Button>
            )}
            {canRecordPayment && (
              <Button
                variant="primary"
                size="sm"
                icon={<DollarSign className="w-4 h-4" />}
                onClick={() => setPaymentOpen(true)}
              >
                Record payment
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              {canCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<XCircle className="w-4 h-4" />}
                  onClick={async () => {
                    if (
                      window.confirm(
                        'Cancel this invoice? Linked time and materials will become billable again.',
                      )
                    ) {
                      await onCancel();
                    }
                  }}
                >
                  Cancel
                </Button>
              )}
              {isTerminal || status === 'draft' ? (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={async () => {
                    if (
                      window.confirm(
                        'Delete this invoice? Payments are permanently removed; linked entries will be unlinked.',
                      )
                    ) {
                      await onDelete();
                      onClose();
                    }
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          </div>

          {/* Customer */}
          <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
            <h3 className="text-xs uppercase tracking-wide text-[#666] mb-2">Bill to</h3>
            <p className="text-sm font-semibold text-[#1a1a1a]">
              {invoice.customer_name || '—'}
            </p>
            {invoice.customer_address && (
              <p className="text-sm text-[#444] whitespace-pre-line">
                {invoice.customer_address}
              </p>
            )}
            {invoice.customer_email && (
              <p className="text-sm text-[#666]">{invoice.customer_email}</p>
            )}
            {invoice.customer_po_number && (
              <p className="text-xs text-[#666] mt-1">PO #: {invoice.customer_po_number}</p>
            )}
          </section>

          {/* Lines */}
          <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">Line items</h3>

            {linkedTime.length > 0 && (
              <>
                <h4 className="text-xs uppercase tracking-wide text-[#666] mb-1">Labor</h4>
                <ul className="divide-y divide-[#f0eeeb] text-sm mb-3">
                  {linkedTime.map((t) => (
                    <li key={t.id} className="py-1.5 flex items-center gap-3">
                      <span className="text-[#888] tabular-nums w-24">{t.work_date}</span>
                      <span className="flex-1 truncate">
                        {t.worker_name}
                        {t.cost_code && ` • ${t.cost_code}`}
                        {t.description && ` — ${t.description}`}
                      </span>
                      <span className="text-[#666] tabular-nums w-16 text-right">
                        {formatHours(t.hours)}
                      </span>
                      <AmountDisplay value={t.billable_amount} className="w-20 text-right" />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {linkedMat.length > 0 && (
              <>
                <h4 className="text-xs uppercase tracking-wide text-[#666] mb-1">Materials</h4>
                <ul className="divide-y divide-[#f0eeeb] text-sm">
                  {linkedMat.map((m) => (
                    <li key={m.id} className="py-1.5 flex items-center gap-3">
                      <span className="text-[#888] tabular-nums w-24">{m.installed_date}</span>
                      <span className="flex-1 truncate">
                        {m.description}
                        {m.cost_code && ` • ${m.cost_code}`}
                      </span>
                      <span className="text-[#666] tabular-nums w-20 text-right">
                        {m.quantity} {m.unit || ''}
                      </span>
                      <AmountDisplay value={m.billing_amount} className="w-20 text-right" />
                    </li>
                  ))}
                </ul>
              </>
            )}

            {linkedTime.length === 0 && linkedMat.length === 0 && (
              <p className="text-sm text-[#666]">No line items.</p>
            )}
          </section>

          {/* Totals */}
          <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
            <dl className="space-y-1 text-sm">
              <Row label="Labor subtotal" value={<AmountDisplay value={invoice.subtotal_labor} />} />
              <Row
                label="Materials subtotal"
                value={<AmountDisplay value={invoice.subtotal_materials} />}
              />
              <Row label="Subtotal" value={<AmountDisplay value={invoice.subtotal} />} />
              <Row label="Tax" value={<AmountDisplay value={invoice.tax_amount} />} />
              <div className="border-t border-[#e8e6e3] pt-2 mt-2">
                <Row
                  label={<span className="font-semibold">Total</span>}
                  value={<AmountDisplay value={invoice.total} className="font-semibold" />}
                />
              </div>
              {invoice.paid_amount > 0 && (
                <>
                  <Row
                    label="Paid"
                    value={<AmountDisplay value={invoice.paid_amount} tone="positive" />}
                  />
                  <Row
                    label={<span className="font-semibold">Balance due</span>}
                    value={
                      <AmountDisplay
                        value={invoice.balance_due}
                        tone={invoice.balance_due > 0 ? 'negative' : 'positive'}
                        className="font-semibold"
                      />
                    }
                  />
                </>
              )}
            </dl>
          </section>

          {/* Payments */}
          {payments.length > 0 && (
            <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
              <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">Payments</h3>
              <ul className="divide-y divide-[#f0eeeb] text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="py-2 flex items-center gap-3">
                    <span className="text-[#888] tabular-nums w-24">{p.payment_date}</span>
                    <span className="flex-1">
                      {p.payment_method ? (
                        <span className="text-xs uppercase tracking-wide bg-[#f0eeeb] text-[#666] px-1.5 py-0.5 rounded mr-2">
                          {p.payment_method}
                        </span>
                      ) : null}
                      {p.reference || ''}
                      {p.notes ? <span className="text-[#888] ml-2">— {p.notes}</span> : null}
                    </span>
                    <AmountDisplay value={p.amount} tone="positive" />
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-[#f0eeeb] text-[#888]"
                      onClick={async () => {
                        if (window.confirm('Remove this payment?')) {
                          await deletePayment(p.id);
                        }
                      }}
                      aria-label="Remove payment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {invoice.notes && (
            <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="text-xs uppercase tracking-wide text-amber-700 mb-1">
                Notes (printed on PDF)
              </h3>
              <p className="text-sm text-[#444] whitespace-pre-line">{invoice.notes}</p>
            </section>
          )}
        </div>

        {paymentOpen && (
          <RecordPaymentModal
            invoice={invoice}
            onSubmit={handleRecordPayment}
            onClose={() => setPaymentOpen(false)}
          />
        )}
      </aside>
    </div>
  );
};

const Row: React.FC<{ label: React.ReactNode; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between">
    <dt className="text-[#666]">{label}</dt>
    <dd className="text-[#1a1a1a]">{value}</dd>
  </div>
);
