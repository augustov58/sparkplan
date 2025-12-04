/**
 * Grounding Data Management Hook
 *
 * Provides CRUD operations for grounding and bonding details with real-time synchronization.
 * Implements NEC Article 250 requirements for grounding electrode systems.
 *
 * @module hooks/useGrounding
 *
 * ## Architecture Pattern
 *
 * This hook implements the **Optimistic UI + Real-Time Sync** pattern:
 * 1. **Optimistic Update**: Local state updated immediately on mutations
 * 2. **Async Database Operation**: Insert/update/delete sent to Supabase
 * 3. **Real-Time Subscription**: WebSocket subscription refetches on database changes
 * 4. **Self-Correcting**: Subscription overwrites optimistic update with server truth
 *
 * @see {@link /docs/architecture.md} - State management architecture
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type GroundingDetail = Database['public']['Tables']['grounding_details']['Row'];
type GroundingInsert = Database['public']['Tables']['grounding_details']['Insert'];
type GroundingUpdate = Database['public']['Tables']['grounding_details']['Update'];

/**
 * Return type for useGrounding hook
 */
export interface UseGroundingReturn {
  /** Grounding details for the current project, or null if not yet created */
  grounding: GroundingDetail | null;

  /** True during initial fetch, false once data loaded */
  loading: boolean;

  /** Error message if any operation failed, null otherwise */
  error: string | null;

  /**
   * Creates or updates grounding details for the project
   * @param data - Grounding data to save
   */
  saveGrounding: (data: Partial<GroundingUpdate>) => Promise<GroundingDetail | null>;

  /**
   * Toggles an electrode type in the list
   * @param electrode - Electrode type name to toggle
   */
  toggleElectrode: (electrode: string) => Promise<void>;

  /**
   * Toggles a bonding target in the list
   * @param target - Bonding target name to toggle
   */
  toggleBonding: (target: string) => Promise<void>;

  /**
   * Updates the GEC size
   * @param size - New GEC size (e.g., "6 AWG")
   */
  setGecSize: (size: string) => Promise<void>;

  /**
   * Updates grounding notes
   * @param notes - Notes text
   */
  setNotes: (notes: string) => Promise<void>;

  /**
   * Deletes grounding details for the project
   */
  deleteGrounding: () => Promise<void>;
}

/**
 * Hook for managing grounding and bonding data
 *
 * @param projectId - UUID of the project to manage grounding for
 * @returns Object with grounding data and CRUD operations
 *
 * @example
 * ```typescript
 * const { grounding, loading, toggleElectrode, setGecSize } = useGrounding(projectId);
 *
 * // Toggle an electrode
 * await toggleElectrode("Concrete-Encased Electrode (Ufer)");
 *
 * // Update GEC size
 * await setGecSize("4 AWG");
 * ```
 */
export function useGrounding(projectId: string): UseGroundingReturn {
  const [grounding, setGrounding] = useState<GroundingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch grounding details
  const fetchGrounding = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('grounding_details')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (which is fine for new projects)
        throw fetchError;
      }

      setGrounding(data || null);
      setError(null);
    } catch (err) {
      console.error('Error fetching grounding:', err);
      setError(err instanceof Error ? err.message : 'Failed to load grounding data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial fetch and subscription
  useEffect(() => {
    fetchGrounding();

    // Subscribe to changes
    const subscription = supabase
      .channel(`grounding-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grounding_details',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          fetchGrounding();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId, fetchGrounding]);

  // Create or update grounding details
  const saveGrounding = async (data: Partial<GroundingUpdate>): Promise<GroundingDetail | null> => {
    try {
      if (grounding) {
        // Update existing
        const { data: updated, error: updateError } = await supabase
          .from('grounding_details')
          .update({
            ...data,
            updated_at: new Date().toISOString()
          })
          .eq('id', grounding.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Optimistic update
        setGrounding(updated);
        return updated;
      } else {
        // Create new
        const insertData: GroundingInsert = {
          project_id: projectId,
          gec_size: data.gec_size || '6 AWG',
          electrodes: data.electrodes || [],
          bonding: data.bonding || [],
          notes: data.notes || null,
        };

        const { data: created, error: insertError } = await supabase
          .from('grounding_details')
          .insert(insertData)
          .select()
          .single();

        if (insertError) throw insertError;

        // Optimistic update
        setGrounding(created);
        return created;
      }
    } catch (err) {
      console.error('Error saving grounding:', err);
      setError(err instanceof Error ? err.message : 'Failed to save grounding data');
      return null;
    }
  };

  // Toggle electrode
  const toggleElectrode = async (electrode: string): Promise<void> => {
    const currentElectrodes = grounding?.electrodes || [];
    const hasElectrode = currentElectrodes.includes(electrode);
    const newElectrodes = hasElectrode
      ? currentElectrodes.filter(e => e !== electrode)
      : [...currentElectrodes, electrode];

    // Optimistic update
    if (grounding) {
      setGrounding({ ...grounding, electrodes: newElectrodes });
    }

    await saveGrounding({ electrodes: newElectrodes });
  };

  // Toggle bonding
  const toggleBonding = async (target: string): Promise<void> => {
    const currentBonding = grounding?.bonding || [];
    const hasBonding = currentBonding.includes(target);
    const newBonding = hasBonding
      ? currentBonding.filter(b => b !== target)
      : [...currentBonding, target];

    // Optimistic update
    if (grounding) {
      setGrounding({ ...grounding, bonding: newBonding });
    }

    await saveGrounding({ bonding: newBonding });
  };

  // Set GEC size
  const setGecSize = async (size: string): Promise<void> => {
    // Optimistic update
    if (grounding) {
      setGrounding({ ...grounding, gec_size: size });
    }

    await saveGrounding({ gec_size: size });
  };

  // Set notes
  const setNotes = async (notes: string): Promise<void> => {
    // Optimistic update
    if (grounding) {
      setGrounding({ ...grounding, notes });
    }

    await saveGrounding({ notes });
  };

  // Delete grounding details
  const deleteGrounding = async (): Promise<void> => {
    if (!grounding) return;

    try {
      const { error: deleteError } = await supabase
        .from('grounding_details')
        .delete()
        .eq('id', grounding.id);

      if (deleteError) throw deleteError;

      setGrounding(null);
    } catch (err) {
      console.error('Error deleting grounding:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete grounding data');
    }
  };

  return {
    grounding,
    loading,
    error,
    saveGrounding,
    toggleElectrode,
    toggleBonding,
    setGecSize,
    setNotes,
    deleteGrounding,
  };
}

