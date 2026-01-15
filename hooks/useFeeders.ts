/**
 * useFeeders Custom Hook
 * Manages feeder data with real-time Supabase subscriptions
 * Provides CRUD operations for NEC Article 215 feeder sizing
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Feeder } from '../types';
import { showToast, toastMessages } from '@/lib/toast';

// Custom event name for feeder updates - allows cross-component communication
const FEEDER_UPDATE_EVENT = 'feeder-data-updated';

export function useFeeders(projectId: string | undefined) {
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all feeders for a project
   */
  const fetchFeeders = useCallback(async () => {
    if (!projectId) {
      setFeeders([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('feeders')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setFeeders(data || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch feeders';
      setError(message);
      console.error('Error fetching feeders:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  /**
   * Emit custom event to notify other components using this hook
   */
  const emitFeederUpdate = useCallback(() => {
    window.dispatchEvent(new CustomEvent(FEEDER_UPDATE_EVENT, { detail: { projectId } }));
  }, [projectId]);

  /**
   * Set up real-time subscription, custom event listener, and initial fetch
   */
  useEffect(() => {
    fetchFeeders();

    if (!projectId) return;

    // Subscribe to real-time changes from Supabase
    const subscription = supabase
      .channel(`feeders_${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feeders',
        filter: `project_id=eq.${projectId}`
      }, () => {
        fetchFeeders();
      })
      .subscribe();

    // Listen for custom events from other components (cross-component sync)
    const handleFeederUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ projectId: string }>;
      if (customEvent.detail.projectId === projectId) {
        fetchFeeders();
      }
    };
    window.addEventListener(FEEDER_UPDATE_EVENT, handleFeederUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener(FEEDER_UPDATE_EVENT, handleFeederUpdate);
    };
  }, [projectId, fetchFeeders]);

  /**
   * Create a new feeder
   */
  const createFeeder = async (feeder: Omit<Feeder, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('feeders')
        .insert([feeder])
        .select()
        .single();

      if (error) throw error;

      // Optimistic update
      setFeeders(prev => [...prev, data]);
      setError(null);
      showToast.success(toastMessages.feeder.created);

      // Notify other components (e.g., OneLineDiagram) to refresh
      emitFeederUpdate();

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create feeder';
      setError(message);
      console.error('Error creating feeder:', err);
      showToast.error(toastMessages.feeder.error);
      throw err;
    }
  };

  /**
   * Update an existing feeder
   */
  const updateFeeder = async (id: string, updates: Partial<Feeder>) => {
    try {
      const { data, error } = await supabase
        .from('feeders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Optimistic update
      setFeeders(prev => prev.map(f => f.id === id ? { ...f, ...data } : f));
      setError(null);
      showToast.success(toastMessages.feeder.updated);

      // Notify other components (e.g., OneLineDiagram) to refresh
      emitFeederUpdate();

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update feeder';
      setError(message);
      console.error('Error updating feeder:', err);
      showToast.error(toastMessages.feeder.error);
      throw err;
    }
  };

  /**
   * Delete a feeder
   */
  const deleteFeeder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('feeders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Optimistic update
      setFeeders(prev => prev.filter(f => f.id !== id));
      setError(null);
      showToast.success(toastMessages.feeder.deleted);

      // Notify other components (e.g., OneLineDiagram) to refresh
      emitFeederUpdate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete feeder';
      setError(message);
      console.error('Error deleting feeder:', err);
      showToast.error(toastMessages.feeder.error);
      throw err;
    }
  };

  /**
   * Get a specific feeder by ID
   */
  const getFeederById = (id: string): Feeder | undefined => {
    return feeders.find(f => f.id === id);
  };

  /**
   * Get feeders by source panel
   */
  const getFeedersBySourcePanel = (panelId: string): Feeder[] => {
    return feeders.filter(f => f.source_panel_id === panelId);
  };

  /**
   * Get feeders by destination panel
   */
  const getFeedersByDestinationPanel = (panelId: string): Feeder[] => {
    return feeders.filter(f => f.destination_panel_id === panelId);
  };

  /**
   * Get feeder supplying a specific panel or transformer
   */
  const getSupplyingFeeder = (panelId?: string, transformerId?: string): Feeder | undefined => {
    if (panelId) {
      return feeders.find(f => f.destination_panel_id === panelId);
    }
    if (transformerId) {
      return feeders.find(f => f.destination_transformer_id === transformerId);
    }
    return undefined;
  };

  return {
    feeders,
    loading,
    error,
    createFeeder,
    updateFeeder,
    deleteFeeder,
    getFeederById,
    getFeedersBySourcePanel,
    getFeedersByDestinationPanel,
    getSupplyingFeeder,
    refetch: fetchFeeders
  };
}
