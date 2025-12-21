/**
 * Short Circuit Calculations Data Management Hook
 *
 * Provides CRUD operations for storing and retrieving short circuit/fault current
 * calculations with real-time synchronization. Enables project-integrated tracking
 * of fault currents at service entrance and multiple panels.
 *
 * @module hooks/useShortCircuitCalculations
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ShortCircuitCalculation, ShortCircuitCalculationInsert, ShortCircuitCalculationUpdate } from '@/lib/database.types';

/**
 * Return type for useShortCircuitCalculations hook
 */
export interface UseShortCircuitCalculationsReturn {
  /** Array of calculations for the current project, sorted by creation date (newest first) */
  calculations: ShortCircuitCalculation[];

  /** True during initial fetch, false once data loaded */
  loading: boolean;

  /** Error message if any operation failed, null otherwise */
  error: string | null;

  /**
   * Creates a new short circuit calculation in the database
   *
   * @param calculation - Calculation data (id and user_id auto-generated)
   * @returns Created calculation with database-generated fields, or null if error
   */
  createCalculation: (calculation: Omit<ShortCircuitCalculationInsert, 'id' | 'user_id'>) => Promise<ShortCircuitCalculation | null>;

  /**
   * Updates an existing calculation
   *
   * @param id - Calculation UUID
   * @param updates - Partial calculation data to update
   */
  updateCalculation: (id: string, updates: ShortCircuitCalculationUpdate) => Promise<void>;

  /**
   * Deletes a calculation from the database
   *
   * @param id - Calculation UUID
   */
  deleteCalculation: (id: string) => Promise<void>;

  /**
   * Gets calculations filtered by panel ID
   *
   * @param panelId - Panel UUID to filter by
   * @returns Array of calculations for the specified panel
   */
  getCalculationsByPanel: (panelId: string) => ShortCircuitCalculation[];

  /**
   * Gets the service entrance calculation (if exists)
   *
   * @returns Service calculation or null
   */
  getServiceCalculation: () => ShortCircuitCalculation | null;
}

/**
 * Custom hook for managing short circuit calculations with real-time synchronization
 *
 * @param projectId - UUID of project to fetch calculations for (undefined = no fetch)
 * @returns Hook interface with calculations data and CRUD operations
 *
 * @remarks
 * - Stores multiple calculations per project (service + panels)
 * - Real-time subscriptions automatically refetch when database changes
 * - Optimistic updates: UI updates immediately before database confirms
 * - Multi-tab sync: Changes propagate across browser tabs
 * - RLS protected: Row Level Security ensures users only see own calculations
 *
 * @example
 * ```typescript
 * const { calculations, loading, createCalculation, getServiceCalculation } = useShortCircuitCalculations(projectId);
 *
 * // Create service calculation
 * await createCalculation({
 *   project_id: projectId,
 *   panel_id: null,
 *   location_name: "Service Entrance",
 *   calculation_type: "service",
 *   service_amps: 400,
 *   service_voltage: 240,
 *   service_phase: 1,
 *   transformer_kva: 100,
 *   transformer_impedance: 2.5,
 *   results: shortCircuitResult,
 *   notes: "Main service calculation"
 * });
 *
 * // Get service calculation
 * const serviceCalc = getServiceCalculation();
 * console.log(`Service fault current: ${serviceCalc?.results.faultCurrent} A`);
 * ```
 */
export function useShortCircuitCalculations(projectId: string | undefined): UseShortCircuitCalculationsReturn {
  const [calculations, setCalculations] = useState<ShortCircuitCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setCalculations([]);
      setLoading(false);
      return;
    }

    fetchCalculations();

    // Set up real-time subscription for live updates
    const subscription = supabase
      .channel(`short_circuit_calculations_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'short_circuit_calculations',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchCalculations();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const fetchCalculations = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('short_circuit_calculations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCalculations(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch short circuit calculations');
    } finally {
      setLoading(false);
    }
  };

  const createCalculation = async (
    calculation: Omit<ShortCircuitCalculationInsert, 'id' | 'user_id'>
  ): Promise<ShortCircuitCalculation | null> => {
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const calculationData: Omit<ShortCircuitCalculationInsert, 'id'> = {
        ...calculation,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('short_circuit_calculations')
        .insert(calculationData)
        .select()
        .single();

      if (error) throw error;

      // Optimistically update local state immediately
      if (data) {
        setCalculations(prev => [data, ...prev]);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create calculation';
      setError(errorMessage);
      return null;
    }
  };

  const updateCalculation = async (id: string, updates: ShortCircuitCalculationUpdate) => {
    try {
      // OPTIMISTIC UPDATE: Update local state immediately for instant UI feedback
      const previousCalculations = [...calculations];
      setCalculations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

      const { error } = await supabase
        .from('short_circuit_calculations')
        .update(updates)
        .eq('id', id);

      if (error) {
        // ROLLBACK: Restore previous state on error
        setCalculations(previousCalculations);
        throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update calculation');
    }
  };

  const deleteCalculation = async (id: string) => {
    try {
      // OPTIMISTIC UPDATE: Remove from local state immediately
      const previousCalculations = [...calculations];
      setCalculations(prev => prev.filter(c => c.id !== id));

      const { error } = await supabase
        .from('short_circuit_calculations')
        .delete()
        .eq('id', id);

      if (error) {
        // ROLLBACK: Restore previous state on error
        setCalculations(previousCalculations);
        throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete calculation');
    }
  };

  const getCalculationsByPanel = (panelId: string): ShortCircuitCalculation[] => {
    return calculations.filter(c => c.panel_id === panelId);
  };

  const getServiceCalculation = (): ShortCircuitCalculation | null => {
    return calculations.find(c => c.calculation_type === 'service' && c.panel_id === null) || null;
  };

  return {
    calculations,
    loading,
    error,
    createCalculation,
    updateCalculation,
    deleteCalculation,
    getCalculationsByPanel,
    getServiceCalculation,
  };
}
