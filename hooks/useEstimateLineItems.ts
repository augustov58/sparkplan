/**
 * Estimate Line Items Hook
 *
 * Mirrors hooks/usePanels.ts pattern, scoped to estimate_id.
 *
 * Includes a `bulkInsert` for the auto-takeoff flow (one round-trip instead
 * of N) and a `cloneLineItemsForEstimate` helper used by the
 * "clone-as-revision" flow.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';
import { useAuthContext } from '@/components/Auth/AuthProvider';
import { computeLineTotal } from '@/services/estimating/estimateMath';

type LineItem = Database['public']['Tables']['estimate_line_items']['Row'];
type LineItemInsert = Database['public']['Tables']['estimate_line_items']['Insert'];
type LineItemUpdate = Database['public']['Tables']['estimate_line_items']['Update'];

export interface UseEstimateLineItemsReturn {
  lineItems: LineItem[];
  loading: boolean;
  error: string | null;

  createLineItem: (
    item: Omit<LineItemInsert, 'id' | 'user_id' | 'line_total'>
  ) => Promise<LineItem | null>;

  updateLineItem: (id: string, updates: LineItemUpdate) => Promise<void>;

  deleteLineItem: (id: string) => Promise<void>;

  /** Insert many rows in one round-trip. Used by auto-takeoff. */
  bulkInsert: (
    rows: Array<Omit<LineItemInsert, 'id' | 'user_id' | 'line_total'>>
  ) => Promise<LineItem[]>;

  /**
   * Copy all line items from a source estimate onto another (for clone-as-
   * revision). Resets `id` and remaps `estimate_id`. source_id is preserved
   * so the new estimate keeps its lineage to the project rows.
   */
  cloneLineItemsForEstimate: (
    sourceEstimateId: string,
    targetEstimateId: string
  ) => Promise<number>;
}

/**
 * Recompute line_total for an item before persisting. The DB does NOT have a
 * computed column for this — we do it here so the cached value matches what
 * estimateMath.ts computes for the totals card.
 */
function withComputedTotal<T extends { quantity?: number | null; unit_price?: number | null }>(
  row: T
): T & { line_total: number } {
  const q = row.quantity ?? 0;
  const p = row.unit_price ?? 0;
  return { ...row, line_total: computeLineTotal(q, p) };
}

export function useEstimateLineItems(
  estimateId: string | undefined
): UseEstimateLineItemsReturn {
  const { user } = useAuthContext();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLineItems = useCallback(async () => {
    if (!estimateId) return;

    try {
      const { data, error } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('position', { ascending: true });

      if (error) throw error;
      setLineItems((data as LineItem[]) || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch line items');
    } finally {
      setLoading(false);
    }
  }, [estimateId]);

  useEffect(() => {
    if (!estimateId) {
      setLineItems([]);
      setLoading(false);
      return;
    }

    fetchLineItems();

    const subscription = supabase
      .channel(`estimate_line_items_${estimateId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estimate_line_items',
          filter: `estimate_id=eq.${estimateId}`,
        },
        () => fetchLineItems()
      )
      .subscribe();

    const unsubscribeRefresh = dataRefreshEvents.subscribe('estimate_line_items', () => {
      fetchLineItems();
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeRefresh();
    };
  }, [estimateId, fetchLineItems]);

  const createLineItem = async (
    item: Omit<LineItemInsert, 'id' | 'user_id' | 'line_total'>
  ): Promise<LineItem | null> => {
    if (!user) {
      showToast.error(toastMessages.estimateLineItem.error);
      return null;
    }
    try {
      const computed = withComputedTotal(item);
      const { data, error } = await supabase
        .from('estimate_line_items')
        .insert({ ...computed, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setLineItems((prev) => [...prev, data as LineItem].sort((a, b) => a.position - b.position));
      }
      showToast.success(toastMessages.estimateLineItem.created);
      dataRefreshEvents.emit('estimate_line_items');
      return data as LineItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create line item');
      showToast.error(toastMessages.estimateLineItem.error);
      return null;
    }
  };

  const updateLineItem = async (id: string, updates: LineItemUpdate) => {
    try {
      const previous = [...lineItems];
      // Recompute line_total if qty / price changed.
      const current = lineItems.find((li) => li.id === id);
      const merged = { ...current, ...updates } as LineItemUpdate;
      const computed = withComputedTotal(merged);
      setLineItems((prev) =>
        prev.map((li) => (li.id === id ? ({ ...li, ...computed } as LineItem) : li))
      );

      const { error } = await supabase
        .from('estimate_line_items')
        .update(computed)
        .eq('id', id);

      if (error) {
        setLineItems(previous);
        throw error;
      }
      dataRefreshEvents.emit('estimate_line_items');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update line item');
      showToast.error(toastMessages.estimateLineItem.error);
    }
  };

  const deleteLineItem = async (id: string) => {
    try {
      const previous = [...lineItems];
      setLineItems((prev) => prev.filter((li) => li.id !== id));

      const { error } = await supabase.from('estimate_line_items').delete().eq('id', id);
      if (error) {
        setLineItems(previous);
        throw error;
      }
      showToast.success(toastMessages.estimateLineItem.deleted);
      dataRefreshEvents.emit('estimate_line_items');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete line item');
      showToast.error(toastMessages.estimateLineItem.error);
    }
  };

  const bulkInsert = async (
    rows: Array<Omit<LineItemInsert, 'id' | 'user_id' | 'line_total'>>
  ): Promise<LineItem[]> => {
    if (!user || rows.length === 0) return [];
    try {
      const payload = rows.map((r) => ({ ...withComputedTotal(r), user_id: user.id }));
      const { data, error } = await supabase
        .from('estimate_line_items')
        .insert(payload)
        .select();

      if (error) throw error;
      const inserted = (data as LineItem[]) || [];
      setLineItems((prev) =>
        [...prev, ...inserted].sort((a, b) => a.position - b.position)
      );
      showToast.success(toastMessages.estimateLineItem.bulkCreated(inserted.length));
      dataRefreshEvents.emit('estimate_line_items');
      return inserted;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bulk-insert line items');
      showToast.error(toastMessages.estimateLineItem.error);
      return [];
    }
  };

  const cloneLineItemsForEstimate = async (
    sourceEstimateId: string,
    targetEstimateId: string
  ): Promise<number> => {
    if (!user) return 0;
    try {
      const { data, error } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', sourceEstimateId);
      if (error) throw error;

      const rows = (data as LineItem[]) || [];
      if (rows.length === 0) return 0;

      const payload: LineItemInsert[] = rows.map((r) => ({
        estimate_id: targetEstimateId,
        user_id: user.id,
        position: r.position,
        category: r.category,
        description: r.description,
        quantity: r.quantity,
        unit: r.unit,
        unit_cost: r.unit_cost,
        unit_price: r.unit_price,
        line_total: r.line_total,
        source_kind: r.source_kind,
        source_id: r.source_id,
        assembly_key: r.assembly_key,
        taxable: r.taxable,
        markup_overridden: r.markup_overridden,
        notes: r.notes,
      }));

      const { error: insertError, data: inserted } = await supabase
        .from('estimate_line_items')
        .insert(payload)
        .select();
      if (insertError) throw insertError;

      dataRefreshEvents.emit('estimate_line_items');
      return (inserted as LineItem[])?.length ?? 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone line items');
      return 0;
    }
  };

  return {
    lineItems,
    loading,
    error,
    createLineItem,
    updateLineItem,
    deleteLineItem,
    bulkInsert,
    cloneLineItemsForEstimate,
  };
}
