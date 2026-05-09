/**
 * Invoices Hook
 *
 * CRUD for `invoices` plus the `generate_invoice_atomic` RPC for the
 * transactional create-invoice-and-link-entries flow.
 *
 * Status auto-derivation: on every fetch, runs `deriveInvoiceStatus` against
 * each non-terminal invoice and flips status to `overdue` when due_date is
 * in the past. This is a client-side check (no cron in Phase 1) — the
 * status update is fire-and-forget; the realtime subscription will pull the
 * persisted change back.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';
import {
  deriveInvoiceStatus,
  type InvoiceStatus,
} from '@/services/billing/invoiceStatusTransitions';
import type { GenerateInvoiceResult } from '@/services/billing/invoiceGenerator';

type Invoice = Database['public']['Tables']['invoices']['Row'];
type InvoiceUpdate = Database['public']['Tables']['invoices']['Update'];

export interface GenerateInvoiceArgs {
  /** Result of `generateInvoiceDraft(...)` — has the line entry IDs + totals. */
  draft: GenerateInvoiceResult;
  /** The invoice number to issue (call `nextInvoiceNumber()` to compute). */
  invoiceNumber: string;
  /** Issue date. */
  invoiceDate: string;
  /** Optional override; otherwise null. */
  dueDate?: string | null;
  /** Period covered. */
  periodStart: string;
  periodEnd: string;
  /** Optional description / notes shown on the invoice header. */
  description?: string | null;
  notes?: string | null;
  /** When true, status starts as 'sent' instead of 'draft'. */
  markSent: boolean;
}

export interface UseInvoicesReturn {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  /** Create + link entries via RPC. Returns the new invoice id. */
  generateInvoice: (projectId: string, args: GenerateInvoiceArgs) => Promise<string | null>;
  /** Patch an invoice (typically: status, notes, internal_notes). */
  updateInvoice: (id: string, updates: InvoiceUpdate) => Promise<void>;
  /** Delete an invoice. The DB cascades payments; SET NULL on linked entries. */
  deleteInvoice: (id: string) => Promise<void>;
  /** Mark an invoice as sent (status + sent_at). */
  markInvoiceSent: (id: string) => Promise<void>;
  /** Cancel an invoice (status + unlink the entries so they're billable again). */
  cancelInvoice: (id: string) => Promise<void>;
}

export function useInvoices(projectId: string | undefined): UseInvoicesReturn {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!projectId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_id', projectId)
        .order('invoice_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (err) throw err;
      const list = data || [];
      setInvoices(list);
      setError(null);

      // Phase 1: auto-derive overdue client-side. Fire-and-forget.
      const today = new Date();
      for (const inv of list) {
        const next = deriveInvoiceStatus(
          inv.status as InvoiceStatus,
          inv.paid_amount,
          inv.total,
          inv.due_date,
          today,
        );
        if (next !== inv.status && next === 'overdue') {
          // Async, no await — the realtime subscription will refetch
          supabase
            .from('invoices')
            .update({ status: next })
            .eq('id', inv.id)
            .then(() => undefined);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    fetchInvoices();

    const channel = supabase
      .channel(`invoices_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchInvoices();
        },
      )
      .subscribe();

    const unsubscribeRefresh = dataRefreshEvents.subscribe('invoices', () => {
      fetchInvoices();
    });

    return () => {
      channel.unsubscribe();
      unsubscribeRefresh();
    };
  }, [projectId, fetchInvoices]);

  const generateInvoice = async (
    projectIdLocal: string,
    args: GenerateInvoiceArgs,
  ): Promise<string | null> => {
    try {
      const { draft, invoiceNumber, invoiceDate, dueDate, periodStart, periodEnd } = args;

      const { data, error: err } = await supabase.rpc('generate_invoice_atomic', {
        p_project_id: projectIdLocal,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_invoice_number: invoiceNumber,
        p_invoice_date: invoiceDate,
        p_due_date: dueDate ?? draft.resolvedDueDate ?? null,
        p_subtotal_labor: draft.subtotalLabor,
        p_subtotal_materials: draft.subtotalMaterials,
        p_subtotal: draft.subtotal,
        p_tax_amount: draft.taxAmount,
        p_total: draft.total,
        p_customer_name: draft.customerSnapshot.name,
        p_customer_email: draft.customerSnapshot.email,
        p_customer_address: draft.customerSnapshot.address,
        p_customer_po_number: draft.customerSnapshot.poNumber,
        p_description: args.description ?? null,
        p_notes: args.notes ?? null,
        p_time_entry_ids: draft.timeEntries.map((t) => t.id),
        p_material_entry_ids: draft.materialEntries.map((m) => m.id),
        p_mark_sent: args.markSent,
      });
      if (err) throw err;

      showToast.success(toastMessages.invoice.created);
      // Several tables touched — ping all so peer hooks refetch.
      dataRefreshEvents.emit('invoices');
      dataRefreshEvents.emit('time_entries');
      dataRefreshEvents.emit('material_entries');
      dataRefreshEvents.emit('project_billing_settings');
      return (data as string) ?? null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoice');
      showToast.error(toastMessages.invoice.error);
      return null;
    }
  };

  const updateInvoice = async (id: string, updates: InvoiceUpdate) => {
    try {
      const previous = [...invoices];
      setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } as Invoice : i)));

      const { error: err } = await supabase.from('invoices').update(updates).eq('id', id);
      if (err) {
        setInvoices(previous);
        throw err;
      }
      showToast.success(toastMessages.invoice.updated);
      dataRefreshEvents.emit('invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice');
      showToast.error(toastMessages.invoice.error);
    }
  };

  const deleteInvoice = async (id: string) => {
    try {
      const previous = [...invoices];
      setInvoices((prev) => prev.filter((i) => i.id !== id));

      const { error: err } = await supabase.from('invoices').delete().eq('id', id);
      if (err) {
        setInvoices(previous);
        throw err;
      }
      showToast.success(toastMessages.invoice.deleted);
      dataRefreshEvents.emit('invoices');
      // Time/material entries may have been unlinked (FK ON DELETE SET NULL)
      dataRefreshEvents.emit('time_entries');
      dataRefreshEvents.emit('material_entries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
      showToast.error(toastMessages.invoice.deleteError);
    }
  };

  const markInvoiceSent = async (id: string) => {
    try {
      const updates: InvoiceUpdate = {
        status: 'sent',
        sent_at: new Date().toISOString(),
      };
      const previous = [...invoices];
      setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } as Invoice : i)));

      const { error: err } = await supabase.from('invoices').update(updates).eq('id', id);
      if (err) {
        setInvoices(previous);
        throw err;
      }
      showToast.success(toastMessages.invoice.sent);
      dataRefreshEvents.emit('invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark invoice sent');
      showToast.error(toastMessages.invoice.error);
    }
  };

  const cancelInvoice = async (id: string) => {
    try {
      // 1. Update invoice status
      const { error: invErr } = await supabase
        .from('invoices')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (invErr) throw invErr;

      // 2. Unlink time + material entries so they become billable again
      await supabase.from('time_entries').update({ invoice_id: null }).eq('invoice_id', id);
      await supabase
        .from('material_entries')
        .update({ invoice_id: null })
        .eq('invoice_id', id);

      showToast.success(toastMessages.invoice.cancelled);
      dataRefreshEvents.emit('invoices');
      dataRefreshEvents.emit('time_entries');
      dataRefreshEvents.emit('material_entries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invoice');
      showToast.error(toastMessages.invoice.error);
    }
  };

  return {
    invoices,
    loading,
    error,
    generateInvoice,
    updateInvoice,
    deleteInvoice,
    markInvoiceSent,
    cancelInvoice,
  };
}
