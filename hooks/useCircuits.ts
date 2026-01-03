/**
 * Circuits Data Hook
 * CRUD operations for project circuits with Supabase
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';

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
  /** Delete all circuits for a specific panel - useful for regenerating panel schedules */
  deleteCircuitsByPanel: (panelId: string) => Promise<void>;
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
      // OPTIMISTIC UPDATE: Add circuit to local state immediately
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const optimisticCircuit: Circuit = {
        id: tempId,
        created_at: new Date().toISOString(),
        ...circuit,
      } as Circuit;

      // Add to local state before database insert
      setCircuits(prev => [...prev, optimisticCircuit]);

      // Insert to database
      const { data, error } = await supabase.from('circuits').insert(circuit).select().single();

      if (error) {
        // ROLLBACK: Remove optimistic circuit on error
        setCircuits(prev => prev.filter(c => c.id !== tempId));
        throw error;
      }

      // REPLACE: Replace temp circuit with real one from database
      setCircuits(prev => prev.map(c => c.id === tempId ? data : c));

      showToast.success(toastMessages.circuit.created);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create circuit');
      showToast.error(toastMessages.circuit.error);
      return null;
    }
  };

  const updateCircuit = async (id: string, updates: CircuitUpdate) => {
    try {
      // OPTIMISTIC UPDATE: Update local state immediately
      const previousCircuits = [...circuits];
      setCircuits(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

      // Update in database
      const { error } = await supabase.from('circuits').update(updates).eq('id', id);

      if (error) {
        // ROLLBACK: Restore previous state on error
        setCircuits(previousCircuits);
        throw error;
      }
      showToast.success(toastMessages.circuit.updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update circuit');
      showToast.error(toastMessages.circuit.error);
    }
  };

  const deleteCircuit = async (id: string) => {
    try {
      // OPTIMISTIC UPDATE: Remove from local state immediately
      const previousCircuits = [...circuits];
      setCircuits(prev => prev.filter(c => c.id !== id));

      // Delete from database
      const { error } = await supabase.from('circuits').delete().eq('id', id);

      if (error) {
        // ROLLBACK: Restore previous state on error
        setCircuits(previousCircuits);
        throw error;
      }
      showToast.success(toastMessages.circuit.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete circuit');
      showToast.error(toastMessages.circuit.error);
    }
  };

  /**
   * Delete all circuits for a specific panel
   * Used when regenerating panel schedules (e.g., from Dwelling Calculator)
   */
  const deleteCircuitsByPanel = async (panelId: string) => {
    try {
      // OPTIMISTIC UPDATE: Remove all panel circuits from local state immediately
      const previousCircuits = [...circuits];
      const panelCircuits = circuits.filter(c => c.panel_id === panelId);
      const count = panelCircuits.length;
      setCircuits(prev => prev.filter(c => c.panel_id !== panelId));

      // Delete from database - delete all circuits matching the panel
      const { error } = await supabase
        .from('circuits')
        .delete()
        .eq('panel_id', panelId);

      if (error) {
        // ROLLBACK: Restore previous state on error
        setCircuits(previousCircuits);
        throw error;
      }
      if (count > 0) {
        showToast.success(`${count} circuit${count === 1 ? '' : 's'} deleted`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete panel circuits');
      showToast.error(toastMessages.circuit.error);
    }
  };

  return {
    circuits,
    loading,
    error,
    createCircuit,
    updateCircuit,
    deleteCircuit,
    deleteCircuitsByPanel,
  };
}
