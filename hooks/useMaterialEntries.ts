/**
 * Material Entries Hook
 *
 * CRUD for the `material_entries` table with optimistic updates + Supabase
 * realtime subscription. Mirrors the `usePanels` pattern.
 *
 * Computed fields filled in here from `services/billing/billingMath`:
 *   - billing_unit_price = invoice_unit_cost × (1 + markup/100)  (4-decimal)
 *   - billing_amount     = qty × billing_unit_price              (cents)
 *   - cost_amount        = qty × invoice_unit_cost               (cents)
 *
 * Sort: `installed_date DESC, created_at DESC`.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';
import {
  computeMaterialBillingUnitPrice,
  computeMaterialBillingAmount,
  computeMaterialCostAmount,
} from '@/services/billing/billingMath';

type MaterialEntry = Database['public']['Tables']['material_entries']['Row'];
type MaterialEntryInsert = Database['public']['Tables']['material_entries']['Insert'];
type MaterialEntryUpdate = Database['public']['Tables']['material_entries']['Update'];

/** Editable fields a caller supplies. The 3 computed price columns and ID
 *  / user_id / project_id / invoice_id / timestamps are filled in here. */
export type MaterialEntryInput = Omit<
  MaterialEntryInsert,
  | 'id'
  | 'user_id'
  | 'project_id'
  | 'billing_unit_price'
  | 'billing_amount'
  | 'cost_amount'
  | 'invoice_id'
  | 'created_at'
  | 'updated_at'
>;

export interface UseMaterialEntriesReturn {
  materialEntries: MaterialEntry[];
  loading: boolean;
  error: string | null;
  createMaterialEntry: (entry: MaterialEntryInput) => Promise<MaterialEntry | null>;
  updateMaterialEntry: (id: string, updates: Partial<MaterialEntryInput>) => Promise<void>;
  deleteMaterialEntry: (id: string) => Promise<void>;
}

export function useMaterialEntries(projectId: string | undefined): UseMaterialEntriesReturn {
  const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!projectId) {
      setMaterialEntries([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await supabase
        .from('material_entries')
        .select('*')
        .eq('project_id', projectId)
        .order('installed_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (err) throw err;
      setMaterialEntries(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch material entries');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setMaterialEntries([]);
      setLoading(false);
      return;
    }
    fetchEntries();

    const channel = supabase
      .channel(`material_entries_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'material_entries',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchEntries();
        },
      )
      .subscribe();

    const unsubscribeRefresh = dataRefreshEvents.subscribe('material_entries', () => {
      fetchEntries();
    });

    return () => {
      channel.unsubscribe();
      unsubscribeRefresh();
    };
  }, [projectId, fetchEntries]);

  /** Compute the three price columns from the editable inputs. */
  function computePrices(input: {
    quantity: number;
    invoice_unit_cost: number;
    markup_pct: number;
  }): { billing_unit_price: number; billing_amount: number; cost_amount: number } {
    const billingUnit = computeMaterialBillingUnitPrice(input.invoice_unit_cost, input.markup_pct);
    return {
      billing_unit_price: billingUnit,
      billing_amount: computeMaterialBillingAmount(input.quantity, billingUnit),
      cost_amount: computeMaterialCostAmount(input.quantity, input.invoice_unit_cost),
    };
  }

  const createMaterialEntry = async (entry: MaterialEntryInput): Promise<MaterialEntry | null> => {
    if (!projectId) return null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const prices = computePrices({
        quantity: entry.quantity ?? 1,
        invoice_unit_cost: entry.invoice_unit_cost,
        markup_pct: entry.markup_pct ?? 20,
      });

      const { data, error: err } = await supabase
        .from('material_entries')
        .insert({
          ...entry,
          project_id: projectId,
          user_id: user.id,
          ...prices,
        })
        .select()
        .single();

      if (err) throw err;

      if (data) {
        setMaterialEntries((prev) => [data, ...prev]);
      }
      showToast.success(toastMessages.materialEntry.created);
      dataRefreshEvents.emit('material_entries');
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create material entry');
      showToast.error(toastMessages.materialEntry.error);
      return null;
    }
  };

  const updateMaterialEntry = async (id: string, updates: Partial<MaterialEntryInput>) => {
    try {
      const current = materialEntries.find((m) => m.id === id);
      if (!current) throw new Error('Material entry not found');

      const merged = { ...current, ...updates };
      const prices = computePrices({
        quantity: merged.quantity,
        invoice_unit_cost: merged.invoice_unit_cost,
        markup_pct: merged.markup_pct,
      });

      const patch: MaterialEntryUpdate = {
        ...updates,
        ...prices,
      };

      const previous = [...materialEntries];
      setMaterialEntries((prev) =>
        prev.map((m) => (m.id === id ? ({ ...m, ...patch } as MaterialEntry) : m)),
      );

      const { error: err } = await supabase.from('material_entries').update(patch).eq('id', id);
      if (err) {
        setMaterialEntries(previous);
        throw err;
      }
      showToast.success(toastMessages.materialEntry.updated);
      dataRefreshEvents.emit('material_entries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update material entry');
      showToast.error(toastMessages.materialEntry.error);
    }
  };

  const deleteMaterialEntry = async (id: string) => {
    try {
      const previous = [...materialEntries];
      setMaterialEntries((prev) => prev.filter((m) => m.id !== id));

      const { error: err } = await supabase.from('material_entries').delete().eq('id', id);
      if (err) {
        setMaterialEntries(previous);
        throw err;
      }
      showToast.success(toastMessages.materialEntry.deleted);
      dataRefreshEvents.emit('material_entries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete material entry');
      showToast.error(toastMessages.materialEntry.deleteError);
    }
  };

  return {
    materialEntries,
    loading,
    error,
    createMaterialEntry,
    updateMaterialEntry,
    deleteMaterialEntry,
  };
}
