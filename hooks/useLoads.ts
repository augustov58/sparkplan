/**
 * Loads Data Hook
 * CRUD operations for project loads with Supabase
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Load = Database['public']['Tables']['loads']['Row'];
type LoadInsert = Database['public']['Tables']['loads']['Insert'];
type LoadUpdate = Database['public']['Tables']['loads']['Update'];

export interface UseLoadsReturn {
  loads: Load[];
  loading: boolean;
  error: string | null;
  createLoad: (load: Omit<LoadInsert, 'id'>) => Promise<Load | null>;
  updateLoad: (id: string, updates: LoadUpdate) => Promise<void>;
  deleteLoad: (id: string) => Promise<void>;
}

export function useLoads(projectId: string | undefined): UseLoadsReturn {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoads([]);
      setLoading(false);
      return;
    }

    fetchLoads();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`loads_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loads',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchLoads();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const fetchLoads = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('loads')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setLoads(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch loads');
    } finally {
      setLoading(false);
    }
  };

  const createLoad = async (load: Omit<LoadInsert, 'id'>): Promise<Load | null> => {
    try {
      const { data, error } = await supabase.from('loads').insert(load).select().single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create load');
      return null;
    }
  };

  const updateLoad = async (id: string, updates: LoadUpdate) => {
    try {
      const { error } = await supabase.from('loads').update(updates).eq('id', id);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update load');
    }
  };

  const deleteLoad = async (id: string) => {
    try {
      const { error } = await supabase.from('loads').delete().eq('id', id);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete load');
    }
  };

  return {
    loads,
    loading,
    error,
    createLoad,
    updateLoad,
    deleteLoad,
  };
}
