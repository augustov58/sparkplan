/**
 * Circuits Data Hook
 * CRUD operations for project circuits with Supabase
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Circuit = Database['public']['Tables']['circuits']['Row'];
type CircuitInsert = Database['public']['Tables']['circuits']['Insert'];
type CircuitUpdate = Database['public']['Tables']['circuits']['Update'];

export interface UseCircuitsReturn {
  circuits: Circuit[];
  loading: boolean;
  error: string | null;
  createCircuit: (circuit: Omit<CircuitInsert, 'id'>) => Promise<Circuit | null>;
  updateCircuit: (id: string, updates: CircuitUpdate) => Promise<void>;
  deleteCircuit: (id: string) => Promise<void>;
}

export function useCircuits(projectId: string | undefined): UseCircuitsReturn {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setCircuits([]);
      setLoading(false);
      return;
    }

    fetchCircuits();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`circuits_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circuits',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchCircuits();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const fetchCircuits = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('circuits')
        .select('*')
        .eq('project_id', projectId)
        .order('circuit_number', { ascending: true });

      if (error) throw error;
      setCircuits(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch circuits');
    } finally {
      setLoading(false);
    }
  };

  const createCircuit = async (circuit: Omit<CircuitInsert, 'id'>): Promise<Circuit | null> => {
    try {
      const { data, error } = await supabase.from('circuits').insert(circuit).select().single();

      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create circuit');
      return null;
    }
  };

  const updateCircuit = async (id: string, updates: CircuitUpdate) => {
    try {
      const { error } = await supabase.from('circuits').update(updates).eq('id', id);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update circuit');
    }
  };

  const deleteCircuit = async (id: string) => {
    try {
      const { error } = await supabase.from('circuits').delete().eq('id', id);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete circuit');
    }
  };

  return {
    circuits,
    loading,
    error,
    createCircuit,
    updateCircuit,
    deleteCircuit,
  };
}
