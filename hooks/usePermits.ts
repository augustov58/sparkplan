/**
 * Permits Data Management Hook (Phase 1 Permits Beta)
 *
 * Mirrors the optimistic-update + realtime-subscription pattern from
 * `hooks/usePanels.ts`. CRUD operations resolve immediately in local
 * state; the postgres_changes subscription overwrites with server truth
 * (50–200ms behind) and a manual `dataRefreshEvents` channel guarantees
 * peer hook instances on the same page also refetch.
 *
 * RLS scopes all reads/writes to auth.uid() = user_id; the createPermit
 * helper sets user_id server-side (required by RLS INSERT policy).
 *
 * @module hooks/usePermits
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';

export type Permit = Database['public']['Tables']['permits']['Row'];
export type PermitInsert = Database['public']['Tables']['permits']['Insert'];
export type PermitUpdate = Database['public']['Tables']['permits']['Update'];

export interface UsePermitsReturn {
  permits: Permit[];
  loading: boolean;
  error: string | null;
  createPermit: (
    permit: Omit<PermitInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  ) => Promise<Permit | null>;
  updatePermit: (id: string, updates: PermitUpdate) => Promise<void>;
  deletePermit: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePermits(projectId: string | undefined): UsePermitsReturn {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermits = useCallback(async () => {
    if (!projectId) return;
    try {
      const { data, error } = await supabase
        .from('permits')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPermits(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch permits');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setPermits([]);
      setLoading(false);
      return;
    }

    fetchPermits();

    const subscription = supabase
      .channel(`permits_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'permits',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchPermits();
        },
      )
      .subscribe();

    const unsubscribeRefresh = dataRefreshEvents.subscribe('permits', () => {
      fetchPermits();
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeRefresh();
    };
  }, [projectId, fetchPermits]);

  const createPermit = async (
    permit: Omit<PermitInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  ): Promise<Permit | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Strip empty-string emails so the DB CHECK constraint doesn't fail
      const cleaned: PermitInsert = {
        ...permit,
        user_id: user.id,
        ahj_contact_email:
          permit.ahj_contact_email && permit.ahj_contact_email.trim().length > 0
            ? permit.ahj_contact_email
            : null,
      };

      const { data, error } = await supabase
        .from('permits')
        .insert(cleaned)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setPermits(prev => [data, ...prev]);
      }

      showToast.success(toastMessages.permit.created);
      dataRefreshEvents.emit('permits');
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create permit';
      setError(msg);
      showToast.error(toastMessages.permit.error);
      return null;
    }
  };

  const updatePermit = async (id: string, updates: PermitUpdate) => {
    const previous = [...permits];
    try {
      // Optimistic
      setPermits(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));

      const cleaned: PermitUpdate = {
        ...updates,
        ahj_contact_email:
          updates.ahj_contact_email !== undefined
            ? updates.ahj_contact_email && updates.ahj_contact_email.trim().length > 0
              ? updates.ahj_contact_email
              : null
            : undefined,
      };

      const { error } = await supabase.from('permits').update(cleaned).eq('id', id);
      if (error) {
        setPermits(previous);
        throw error;
      }
      showToast.success(toastMessages.permit.updated);
      dataRefreshEvents.emit('permits');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update permit';
      setError(msg);
      showToast.error(toastMessages.permit.error);
    }
  };

  const deletePermit = async (id: string) => {
    const previous = [...permits];
    try {
      setPermits(prev => prev.filter(p => p.id !== id));
      const { error } = await supabase.from('permits').delete().eq('id', id);
      if (error) {
        setPermits(previous);
        throw error;
      }
      showToast.success(toastMessages.permit.deleted);
      dataRefreshEvents.emit('permits');
      // permit_inspections cascade-delete; nudge that hook too.
      dataRefreshEvents.emit('permit_inspections');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete permit';
      setError(msg);
      showToast.error(toastMessages.permit.deleteError);
    }
  };

  return {
    permits,
    loading,
    error,
    createPermit,
    updatePermit,
    deletePermit,
    refresh: fetchPermits,
  };
}
