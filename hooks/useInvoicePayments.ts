/**
 * Invoice Payments Hook — payments scoped to a single invoice.
 *
 * Optimistic CRUD + Supabase realtime. The DB trigger
 * `sync_invoice_paid_totals` keeps invoices.paid_amount and balance_due
 * in sync server-side; this hook fires a `dataRefreshEvents.emit('invoices')`
 * after each mutation so the parent invoice list refetches.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';

type Payment = Database['public']['Tables']['payments']['Row'];
type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
type PaymentUpdate = Database['public']['Tables']['payments']['Update'];

export type PaymentInput = Omit<
  PaymentInsert,
  'id' | 'user_id' | 'invoice_id' | 'created_at'
>;

export interface UseInvoicePaymentsReturn {
  payments: Payment[];
  loading: boolean;
  error: string | null;
  createPayment: (input: PaymentInput) => Promise<Payment | null>;
  updatePayment: (id: string, updates: Partial<PaymentInput>) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
}

export function useInvoicePayments(invoiceId: string | undefined): UseInvoicePaymentsReturn {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!invoiceId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (err) throw err;
      setPayments(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (!invoiceId) {
      setPayments([]);
      setLoading(false);
      return;
    }
    fetchPayments();

    const channel = supabase
      .channel(`payments_${invoiceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `invoice_id=eq.${invoiceId}`,
        },
        () => {
          fetchPayments();
        },
      )
      .subscribe();

    const unsubscribeRefresh = dataRefreshEvents.subscribe('payments', () => {
      fetchPayments();
    });

    return () => {
      channel.unsubscribe();
      unsubscribeRefresh();
    };
  }, [invoiceId, fetchPayments]);

  const createPayment = async (input: PaymentInput): Promise<Payment | null> => {
    if (!invoiceId) return null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: err } = await supabase
        .from('payments')
        .insert({ ...input, invoice_id: invoiceId, user_id: user.id })
        .select()
        .single();
      if (err) throw err;

      if (data) setPayments((prev) => [data, ...prev]);
      showToast.success(toastMessages.payment.created);
      dataRefreshEvents.emit('payments');
      // Trigger updates invoices.paid_amount/balance_due/status; pull fresh.
      dataRefreshEvents.emit('invoices');
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
      showToast.error(toastMessages.payment.error);
      return null;
    }
  };

  const updatePayment = async (id: string, updates: Partial<PaymentInput>) => {
    try {
      const previous = [...payments];
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } as Payment : p)));

      const { error: err } = await supabase
        .from('payments')
        .update(updates as PaymentUpdate)
        .eq('id', id);
      if (err) {
        setPayments(previous);
        throw err;
      }
      showToast.success(toastMessages.payment.updated);
      dataRefreshEvents.emit('payments');
      dataRefreshEvents.emit('invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment');
      showToast.error(toastMessages.payment.error);
    }
  };

  const deletePayment = async (id: string) => {
    try {
      const previous = [...payments];
      setPayments((prev) => prev.filter((p) => p.id !== id));

      const { error: err } = await supabase.from('payments').delete().eq('id', id);
      if (err) {
        setPayments(previous);
        throw err;
      }
      showToast.success(toastMessages.payment.deleted);
      dataRefreshEvents.emit('payments');
      dataRefreshEvents.emit('invoices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete payment');
      showToast.error(toastMessages.payment.error);
    }
  };

  return {
    payments,
    loading,
    error,
    createPayment,
    updatePayment,
    deletePayment,
  };
}
