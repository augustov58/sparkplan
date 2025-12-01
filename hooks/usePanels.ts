/**
 * Panels Data Hook
 * CRUD operations for electrical panels with Supabase
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type PanelInsert = Database['public']['Tables']['panels']['Insert'];
type PanelUpdate = Database['public']['Tables']['panels']['Update'];

export interface UsePanelsReturn {
  panels: Panel[];
  loading: boolean;
  error: string | null;
  createPanel: (panel: Omit<PanelInsert, 'id'>) => Promise<Panel | null>;
  updatePanel: (id: string, updates: PanelUpdate) => Promise<void>;
  deletePanel: (id: string) => Promise<void>;
  getMainPanel: () => Panel | undefined;
}

export function usePanels(projectId: string | undefined): UsePanelsReturn {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setPanels([]);
      setLoading(false);
      return;
    }

    fetchPanels();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`panels_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'panels',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchPanels();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const fetchPanels = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('panels')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPanels(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch panels');
    } finally {
      setLoading(false);
    }
  };

  const createPanel = async (panel: Omit<PanelInsert, 'id'>): Promise<Panel | null> => {
    try {
      const { data, error } = await supabase.from('panels').insert(panel).select().single();

      if (error) throw error;

      // Optimistically update local state immediately
      if (data) {
        setPanels(prev => [...prev, data]);
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create panel');
      return null;
    }
  };

  const updatePanel = async (id: string, updates: PanelUpdate) => {
    try {
      const { error } = await supabase.from('panels').update(updates).eq('id', id);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update panel');
    }
  };

  const deletePanel = async (id: string) => {
    try {
      const { error } = await supabase.from('panels').delete().eq('id', id);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete panel');
    }
  };

  const getMainPanel = () => {
    return panels.find(p => p.is_main);
  };

  return {
    panels,
    loading,
    error,
    createPanel,
    updatePanel,
    deletePanel,
    getMainPanel,
  };
}
