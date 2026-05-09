/**
 * Permit Inspections Data Management Hook (Phase 1 Permits Beta)
 *
 * Mirrors usePermits / usePanels — optimistic update + realtime
 * subscription. Accepts an optional `permitId` filter so:
 *   - Inspections tab passes `projectId` only and gets all inspections
 *     across permits in the project.
 *   - Permit detail drawer passes both `projectId` and `permitId` and
 *     gets the inspections scoped to that permit.
 *
 * @module hooks/usePermitInspections
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';

export type PermitInspection =
  Database['public']['Tables']['permit_inspections']['Row'];
export type PermitInspectionInsert =
  Database['public']['Tables']['permit_inspections']['Insert'];
export type PermitInspectionUpdate =
  Database['public']['Tables']['permit_inspections']['Update'];

export interface UsePermitInspectionsReturn {
  inspections: PermitInspection[];
  loading: boolean;
  error: string | null;
  createInspection: (
    inspection: Omit<
      PermitInspectionInsert,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >,
  ) => Promise<PermitInspection | null>;
  updateInspection: (id: string, updates: PermitInspectionUpdate) => Promise<void>;
  deleteInspection: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePermitInspections(
  projectId: string | undefined,
  permitId?: string | undefined,
): UsePermitInspectionsReturn {
  const [inspections, setInspections] = useState<PermitInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInspections = useCallback(async () => {
    if (!projectId) return;
    try {
      let query = supabase
        .from('permit_inspections')
        .select('*')
        .eq('project_id', projectId)
        .order('scheduled_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (permitId) {
        query = query.eq('permit_id', permitId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInspections(data || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch inspections',
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, permitId]);

  useEffect(() => {
    if (!projectId) {
      setInspections([]);
      setLoading(false);
      return;
    }

    fetchInspections();

    // Subscribe to all permit_inspection events scoped to this project,
    // then let fetchInspections re-filter in memory if permitId is set.
    const subscription = supabase
      .channel(`permit_inspections_${projectId}_${permitId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'permit_inspections',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchInspections();
        },
      )
      .subscribe();

    const unsubscribeRefresh = dataRefreshEvents.subscribe(
      'permit_inspections',
      () => {
        fetchInspections();
      },
    );

    return () => {
      subscription.unsubscribe();
      unsubscribeRefresh();
    };
  }, [projectId, permitId, fetchInspections]);

  const createInspection = async (
    inspection: Omit<
      PermitInspectionInsert,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >,
  ): Promise<PermitInspection | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const payload: PermitInspectionInsert = {
        ...inspection,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('permit_inspections')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      if (data) {
        setInspections(prev => [...prev, data]);
      }

      showToast.success(toastMessages.inspection.created);
      dataRefreshEvents.emit('permit_inspections');
      return data;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to create inspection';
      setError(msg);
      showToast.error(toastMessages.inspection.error);
      return null;
    }
  };

  const updateInspection = async (
    id: string,
    updates: PermitInspectionUpdate,
  ) => {
    const previous = [...inspections];
    try {
      setInspections(prev =>
        prev.map(i => (i.id === id ? { ...i, ...updates } : i)),
      );
      const { error } = await supabase
        .from('permit_inspections')
        .update(updates)
        .eq('id', id);
      if (error) {
        setInspections(previous);
        throw error;
      }
      showToast.success(toastMessages.inspection.updated);
      dataRefreshEvents.emit('permit_inspections');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update inspection';
      setError(msg);
      showToast.error(toastMessages.inspection.error);
    }
  };

  const deleteInspection = async (id: string) => {
    const previous = [...inspections];
    try {
      setInspections(prev => prev.filter(i => i.id !== id));
      const { error } = await supabase
        .from('permit_inspections')
        .delete()
        .eq('id', id);
      if (error) {
        setInspections(previous);
        throw error;
      }
      showToast.success(toastMessages.inspection.deleted);
      dataRefreshEvents.emit('permit_inspections');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to delete inspection';
      setError(msg);
      showToast.error(toastMessages.inspection.deleteError);
    }
  };

  return {
    inspections,
    loading,
    error,
    createInspection,
    updateInspection,
    deleteInspection,
    refresh: fetchInspections,
  };
}
