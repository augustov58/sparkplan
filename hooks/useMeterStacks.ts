/**
 * Meter Stacks Data Management Hook
 *
 * Provides CRUD operations for CT cabinet / meter stack entities
 * with real-time synchronization. Follows same pattern as usePanels.ts.
 *
 * @module hooks/useMeterStacks
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';

type MeterStack = Database['public']['Tables']['meter_stacks']['Row'];
type MeterStackInsert = Database['public']['Tables']['meter_stacks']['Insert'];
type MeterStackUpdate = Database['public']['Tables']['meter_stacks']['Update'];

export interface UseMeterStacksReturn {
  meterStacks: MeterStack[];
  loading: boolean;
  error: string | null;
  createMeterStack: (meterStack: Omit<MeterStackInsert, 'id'>) => Promise<MeterStack | null>;
  updateMeterStack: (id: string, updates: MeterStackUpdate) => Promise<void>;
  deleteMeterStack: (id: string) => Promise<void>;
}

export function useMeterStacks(projectId: string | undefined): UseMeterStacksReturn {
  const [meterStacks, setMeterStacks] = useState<MeterStack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeterStacks = useCallback(async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('meter_stacks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMeterStacks(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch meter stacks');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setMeterStacks([]);
      setLoading(false);
      return;
    }

    fetchMeterStacks();

    // Real-time subscription
    const subscription = supabase
      .channel(`meter_stacks_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meter_stacks',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchMeterStacks();
        }
      )
      .subscribe();

    // Manual refresh events
    const unsubscribeRefresh = dataRefreshEvents.subscribe('meter_stacks', () => {
      fetchMeterStacks();
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeRefresh();
    };
  }, [projectId, fetchMeterStacks]);

  const createMeterStack = async (meterStack: Omit<MeterStackInsert, 'id'>): Promise<MeterStack | null> => {
    try {
      const { data, error } = await supabase.from('meter_stacks').insert(meterStack).select().single();

      if (error) throw error;

      if (data) {
        setMeterStacks(prev => [...prev, data]);
      }

      showToast.success(toastMessages.meterStack.created);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meter stack');
      showToast.error(toastMessages.meterStack.error);
      return null;
    }
  };

  const updateMeterStack = async (id: string, updates: MeterStackUpdate) => {
    try {
      const previousMeterStacks = [...meterStacks];
      setMeterStacks(prev => prev.map(ms => ms.id === id ? { ...ms, ...updates } : ms));

      const { error } = await supabase.from('meter_stacks').update(updates).eq('id', id);

      if (error) {
        setMeterStacks(previousMeterStacks);
        throw error;
      }
      showToast.success(toastMessages.meterStack.updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update meter stack');
      showToast.error(toastMessages.meterStack.error);
    }
  };

  const deleteMeterStack = async (id: string) => {
    try {
      const { error } = await supabase.from('meter_stacks').delete().eq('id', id);

      if (error) throw error;
      showToast.success(toastMessages.meterStack.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meter stack');
      showToast.error(toastMessages.meterStack.error);
    }
  };

  return {
    meterStacks,
    loading,
    error,
    createMeterStack,
    updateMeterStack,
    deleteMeterStack,
  };
}
