/**
 * Meters Data Management Hook
 *
 * Provides CRUD operations for individual meters within meter stacks
 * with real-time synchronization. Follows same pattern as usePanels.ts.
 *
 * @module hooks/useMeters
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';

type Meter = Database['public']['Tables']['meters']['Row'];
type MeterInsert = Database['public']['Tables']['meters']['Insert'];
type MeterUpdate = Database['public']['Tables']['meters']['Update'];

export interface UseMetersReturn {
  meters: Meter[];
  loading: boolean;
  error: string | null;
  createMeter: (meter: Omit<MeterInsert, 'id'>) => Promise<Meter | null>;
  createMeters: (meters: Omit<MeterInsert, 'id'>[]) => Promise<Meter[]>;
  updateMeter: (id: string, updates: MeterUpdate) => Promise<void>;
  deleteMeter: (id: string) => Promise<void>;
  getMetersByStack: (meterStackId: string) => Meter[];
}

export function useMeters(projectId: string | undefined): UseMetersReturn {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeters = useCallback(async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('meters')
        .select('*')
        .eq('project_id', projectId)
        .order('position_number', { ascending: true });

      if (error) throw error;
      setMeters(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch meters');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setMeters([]);
      setLoading(false);
      return;
    }

    fetchMeters();

    // Real-time subscription
    const subscription = supabase
      .channel(`meters_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meters',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchMeters();
        }
      )
      .subscribe();

    // Manual refresh events
    const unsubscribeRefresh = dataRefreshEvents.subscribe('meters', () => {
      fetchMeters();
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeRefresh();
    };
  }, [projectId, fetchMeters]);

  const createMeter = async (meter: Omit<MeterInsert, 'id'>): Promise<Meter | null> => {
    try {
      const { data, error } = await supabase.from('meters').insert(meter).select().single();

      if (error) throw error;

      if (data) {
        setMeters(prev => [...prev, data]);
      }

      showToast.success(toastMessages.meter.created);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meter');
      showToast.error(toastMessages.meter.error);
      return null;
    }
  };

  const createMeters = async (metersToCreate: Omit<MeterInsert, 'id'>[]): Promise<Meter[]> => {
    try {
      const { data, error } = await supabase.from('meters').insert(metersToCreate).select();

      if (error) throw error;

      if (data) {
        setMeters(prev => [...prev, ...data]);
      }

      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meters');
      showToast.error(toastMessages.meter.error);
      return [];
    }
  };

  const updateMeter = async (id: string, updates: MeterUpdate) => {
    try {
      const previousMeters = [...meters];
      setMeters(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));

      const { error } = await supabase.from('meters').update(updates).eq('id', id);

      if (error) {
        setMeters(previousMeters);
        throw error;
      }
      showToast.success(toastMessages.meter.updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update meter');
      showToast.error(toastMessages.meter.error);
    }
  };

  const deleteMeter = async (id: string) => {
    try {
      const { error } = await supabase.from('meters').delete().eq('id', id);

      if (error) throw error;
      showToast.success(toastMessages.meter.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meter');
      showToast.error(toastMessages.meter.error);
    }
  };

  const getMetersByStack = (meterStackId: string): Meter[] => {
    return meters.filter(m => m.meter_stack_id === meterStackId);
  };

  return {
    meters,
    loading,
    error,
    createMeter,
    createMeters,
    updateMeter,
    deleteMeter,
    getMetersByStack,
  };
}
