/**
 * InvoicesTab — list of invoices with status pills and quick actions.
 *
 * "Generate invoice" launches GenerateInvoiceModal. Clicking a row opens
 * the InvoiceDetailDrawer. Empty state nudges the user to add time/materials
 * first.
 */

import React, { useState } from 'react';
import { Plus, FileText, Inbox } from 'lucide-react';
import { Button } from '../ui/Button';
import { AmountDisplay } from './AmountDisplay';
import { InvoiceStatusPill } from './InvoiceStatusPill';
import { GenerateInvoiceModal } from './GenerateInvoiceModal';
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer';
import { useInvoices } from '@/hooks/useInvoices';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useMaterialEntries } from '@/hooks/useMaterialEntries';
import { useProjects } from '@/hooks/useProjects';
import { useProfile } from '@/hooks/useProfile';
import type { Database } from '@/lib/database.types';

type Invoice = Database['public']['Tables']['invoices']['Row'];

interface InvoicesTabProps {
  projectId: string;
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({ projectId }) => {
  const {
    invoices,
    loading,
    markInvoiceSent,
    cancelInvoice,
    deleteInvoice,
  } = useInvoices(projectId);
  const { timeEntries } = useTimeEntries(projectId);
  const { materialEntries } = useMaterialEntries(projectId);
  const { projects } = useProjects();
  const { profile } = useProfile();

  const project = projects.find((p) => p.id === projectId);
  const projectName = project?.name ?? 'Project';
  const contractorName = profile?.full_name ?? undefined;
  const contractorLicense = profile?.license_number ?? undefined;

  const [generating, setGenerating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const hasUnbilled =
    timeEntries.some((t) => !t.invoice_id) || materialEntries.some((m) => !m.invoice_id);

  // Keep selection in sync with refetched data so updates appear without re-clicking.
  React.useEffect(() => {
    if (selectedInvoice) {
      const fresh = invoices.find((i) => i.id === selectedInvoice.id);
      if (fresh && fresh !== selectedInvoice) setSelectedInvoice(fresh);
    }
  }, [invoices, selectedInvoice]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-[#1a1a1a]">Invoices</h2>
          <p className="text-xs text-[#666]">
            {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'} on this project
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setGenerating(true)}
          disabled={!hasUnbilled && invoices.length === 0}
        >
          Generate invoice
        </Button>
      </div>

      <div className="bg-white border border-[#e8e6e3] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[#666]">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-10 text-center">
            <Inbox className="w-8 h-8 text-[#aaa] mx-auto mb-3" />
            <p className="text-sm text-[#666] mb-3">
              {hasUnbilled
                ? 'No invoices yet. Generate one from your unbilled time and materials.'
                : 'Log time or materials first, then come back to generate an invoice.'}
            </p>
            {hasUnbilled && (
              <Button
                variant="primary"
                size="sm"
                icon={<FileText className="w-4 h-4" />}
                onClick={() => setGenerating(true)}
              >
                Generate first invoice
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#faf9f7] text-[#444]">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Invoice #</th>
                <th className="px-3 py-2 text-left font-medium">Period</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Due</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eeeb]">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-[#faf9f7] cursor-pointer"
                  onClick={() => setSelectedInvoice(inv)}
                >
                  <td className="px-3 py-2 font-medium text-[#1a1a1a]">
                    {inv.invoice_number}
                    {inv.description && (
                      <div className="text-xs text-[#888] font-normal truncate max-w-xs">
                        {inv.description}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#666]">
                    {inv.period_start} → {inv.period_end}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#444]">{inv.invoice_date}</td>
                  <td className="px-3 py-2 tabular-nums text-[#666]">{inv.due_date || '—'}</td>
                  <td className="px-3 py-2">
                    <InvoiceStatusPill status={inv.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AmountDisplay value={inv.total} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <AmountDisplay
                      value={inv.balance_due}
                      tone={
                        inv.balance_due === 0
                          ? 'positive'
                          : inv.status === 'overdue'
                            ? 'negative'
                            : 'default'
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {generating && (
        <GenerateInvoiceModal
          projectId={projectId}
          onClose={() => setGenerating(false)}
          onGenerated={() => setGenerating(false)}
        />
      )}

      {selectedInvoice && (
        <InvoiceDetailDrawer
          invoice={selectedInvoice}
          projectId={projectId}
          projectName={projectName}
          contractorName={contractorName}
          contractorLicense={contractorLicense}
          onClose={() => setSelectedInvoice(null)}
          onMarkSent={async () => {
            await markInvoiceSent(selectedInvoice.id);
          }}
          onCancel={async () => {
            await cancelInvoice(selectedInvoice.id);
          }}
          onDelete={async () => {
            await deleteInvoice(selectedInvoice.id);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
};
