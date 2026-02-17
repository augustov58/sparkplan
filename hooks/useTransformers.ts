/**
 * Transformers Data Hook
 * CRUD operations for electrical transformers with Supabase
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';

type Transformer = Database['public']['Tables']['transformers']['Row'];
type TransformerInsert = Database['public']['Tables']['transformers']['Insert'];
type TransformerUpdate = Database['public']['Tables']['transformers']['Update'];

export interface UseTransformersReturn {
  transformers: Transformer[];
  loading: boolean;
  error: string | null;
  createTransformer: (transformer: Omit<TransformerInsert, 'id'>) => Promise<Transformer | null>;
  updateTransformer: (id: string, updates: TransformerUpdate) => Promise<void>;
  deleteTransformer: (id: string) => Promise<void>;
  getTransformerById: (id: string) => Transformer | undefined;
}

export function useTransformers(projectId: string | undefined): UseTransformersReturn {
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setTransformers([]);
      setLoading(false);
      return;
    }

    fetchTransformers();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`transformers_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transformers',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchTransformers();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const fetchTransformers = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('transformers')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTransformers(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transformers');
    } finally {
      setLoading(false);
    }
  };

  const createTransformer = async (transformer: Omit<TransformerInsert, 'id'>): Promise<Transformer | null> => {
    try {
      const { data, error } = await supabase
        .from('transformers')
        .insert(transformer)
        .select()
        .single();

      if (error) throw error;

      // Optimistically update local state immediately
      if (data) {
        setTransformers(prev => [...prev, data]);
      }

      showToast.success(toastMessages.transformer.created);
      return data;
    } catch (err) {
      console.error('Failed to create transformer:', err);
      setError(err instanceof Error ? err.message : 'Failed to create transformer');
      showToast.error('Failed to create transformer');
      return null;
    }
  };

  const updateTransformer = async (id: string, updates: TransformerUpdate) => {
    try {
      const { error } = await supabase
        .from('transformers')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      showToast.success(toastMessages.transformer.updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transformer');
      showToast.error(toastMessages.transformer.error);
    }
  };

  const deleteTransformer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('transformers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast.success(toastMessages.transformer.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transformer');
      showToast.error(toastMessages.transformer.error);
    }
  };

  const getTransformerById = (id: string) => {
    return transformers.find(t => t.id === id);
  };

  return {
    transformers,
    loading,
    error,
    createTransformer,
    updateTransformer,
    deleteTransformer,
    getTransformerById,
  };
}
