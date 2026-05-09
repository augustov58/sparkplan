/**
 * Estimates Data Management Hook
 *
 * Mirrors the optimistic-update + realtime-subscription pattern from
 * hooks/usePanels.ts. Scoped to project_id; lists every estimate (any
 * revision, any status) for a project.
 *
 * @see hooks/usePanels.ts — canonical pattern, including rollback on error
 *      and dataRefreshEvents bus integration.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';
import { useAuthContext } from '@/components/Auth/AuthProvider';

type Estimate = Database['public']['Tables']['estimates']['Row'];
type EstimateInsert = Database['public']['Tables']['estimates']['Insert'];
type EstimateUpdate = Database['public']['Tables']['estimates']['Update'];

export interface UseEstimatesReturn {
  estimates: Estimate[];
  loading: boolean;
  error: string | null;

  /**
   * Create a new estimate. The hook injects user_id from the current auth
   * session — callers must NOT pass user_id explicitly.
   */
  createEstimate: (
    estimate: Omit<EstimateInsert, 'id' | 'user_id'>
  ) => Promise<Estimate | null>;

  updateEstimate: (id: string, updates: EstimateUpdate) => Promise<void>;

  deleteEstimate: (id: string) => Promise<void>;

  /**
   * Clone an estimate as a new revision. Copies header fields, increments
   * `revision`, sets `parent_estimate_id`, resets status to 'draft' and
   * clears the PDF cache. Line items are NOT copied here — the caller (the
   * clone modal) calls `cloneLineItemsForEstimate()` from useEstimateLineItems
   * after this resolves.
   */
  cloneAsRevision: (
    sourceId: string,
    overrides?: Partial<Pick<EstimateInsert, 'name' | 'scope_summary' | 'internal_notes'>>
  ) => Promise<Estimate | null>;
}

export function useEstimates(projectId: string | undefined): UseEstimatesReturn {
  const { user } = useAuthContext();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEstimates = useCallback(async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEstimates((data as Estimate[]) || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch estimates');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setEstimates([]);
      setLoading(false);
      return;
    }

    fetchEstimates();

    const subscription = supabase
      .channel(`estimates_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estimates',
          filter: `project_id=eq.${projectId}`,
        },
        () => fetchEstimates()
      )
      .subscribe();

    const unsubscribeRefresh = dataRefreshEvents.subscribe('estimates', () => {
      fetchEstimates();
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeRefresh();
    };
  }, [projectId, fetchEstimates]);

  const createEstimate = async (
    estimate: Omit<EstimateInsert, 'id' | 'user_id'>
  ): Promise<Estimate | null> => {
    if (!user) {
      setError('Not authenticated');
      showToast.error(toastMessages.estimate.error);
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('estimates')
        .insert({ ...estimate, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setEstimates((prev) => [data as Estimate, ...prev]);
      }

      showToast.success(toastMessages.estimate.created);
      dataRefreshEvents.emit('estimates');
      return data as Estimate;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create estimate');
      showToast.error(toastMessages.estimate.error);
      return null;
    }
  };

  const updateEstimate = async (id: string, updates: EstimateUpdate) => {
    try {
      const previous = [...estimates];
      setEstimates((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } as Estimate : e)));

      const { error } = await supabase.from('estimates').update(updates).eq('id', id);

      if (error) {
        setEstimates(previous);
        throw error;
      }
      showToast.success(toastMessages.estimate.updated);
      dataRefreshEvents.emit('estimates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update estimate');
      showToast.error(toastMessages.estimate.error);
    }
  };

  const deleteEstimate = async (id: string) => {
    try {
      const previous = [...estimates];
      setEstimates((prev) => prev.filter((e) => e.id !== id));

      const { error } = await supabase.from('estimates').delete().eq('id', id);

      if (error) {
        setEstimates(previous);
        throw error;
      }
      showToast.success(toastMessages.estimate.deleted);
      dataRefreshEvents.emit('estimates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete estimate');
      showToast.error(toastMessages.estimate.deleteError);
    }
  };

  const cloneAsRevision = async (
    sourceId: string,
    overrides: Partial<Pick<EstimateInsert, 'name' | 'scope_summary' | 'internal_notes'>> = {}
  ): Promise<Estimate | null> => {
    if (!user) return null;
    const source = estimates.find((e) => e.id === sourceId);
    if (!source) {
      setError('Source estimate not found');
      return null;
    }
    const cloneName = overrides.name ?? `${source.name} — revision ${source.revision + 1}`;
    const insert: Omit<EstimateInsert, 'id' | 'user_id'> = {
      project_id: source.project_id,
      name: cloneName,
      revision: source.revision + 1,
      parent_estimate_id: source.id,
      status: 'draft',
      customer_name: source.customer_name,
      customer_email: source.customer_email,
      customer_address: source.customer_address,
      markup_pct: source.markup_pct,
      tax_pct: source.tax_pct,
      scope_summary: overrides.scope_summary ?? source.scope_summary,
      exclusions: source.exclusions,
      payment_terms: source.payment_terms,
      internal_notes: overrides.internal_notes ?? null,
    };
    const created = await createEstimate(insert);
    if (created) {
      showToast.success(toastMessages.estimate.cloned);
    }
    return created;
  };

  return {
    estimates,
    loading,
    error,
    createEstimate,
    updateEstimate,
    deleteEstimate,
    cloneAsRevision,
  };
}
