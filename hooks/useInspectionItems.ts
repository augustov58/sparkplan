/**
 * Inspection Items Data Management Hook
 *
 * Provides CRUD operations for pre-inspection checklist items
 * with real-time synchronization.
 *
 * @module hooks/useInspectionItems
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { InspectionItem, InspectionItemInsert, InspectionItemUpdate } from '@/lib/database.types';

/**
 * Return type for useInspectionItems hook
 */
export interface UseInspectionItemsReturn {
  /** Array of inspection items for the current project, sorted by creation date */
  items: InspectionItem[];

  /** True during initial fetch, false once data loaded */
  loading: boolean;

  /** Error message if any operation failed, null otherwise */
  error: string | null;

  /**
   * Creates a new inspection item in the database
   *
   * @param item - Inspection item data (id and user_id auto-generated)
   * @returns Created item with database-generated fields, or null if error
   */
  createItem: (item: Omit<InspectionItemInsert, 'id' | 'user_id'>) => Promise<InspectionItem | null>;

  /**
   * Creates multiple inspection items at once (bulk insert)
   *
   * @param items - Array of inspection items to create
   * @returns Array of created items, or null if error
   */
  createItems: (items: Omit<InspectionItemInsert, 'id' | 'user_id'>[]) => Promise<InspectionItem[] | null>;

  /**
   * Updates an existing inspection item
   *
   * @param id - Item UUID
   * @param updates - Partial item data to update
   */
  updateItem: (id: string, updates: InspectionItemUpdate) => Promise<void>;

  /**
   * Deletes an inspection item from the database
   *
   * @param id - Item UUID
   */
  deleteItem: (id: string) => Promise<void>;

  /**
   * Updates the status of an inspection item
   *
   * @param id - Item UUID
   * @param status - New status
   */
  updateItemStatus: (id: string, status: InspectionItem['status']) => Promise<void>;
}

/**
 * Custom hook for managing inspection items with real-time synchronization
 *
 * @param projectId - UUID of project to fetch items for (undefined = no fetch)
 * @returns Hook interface with items data and CRUD operations
 *
 * @remarks
 * - Real-time subscriptions automatically refetch when database changes
 * - Optimistic updates: UI updates immediately before database confirms
 * - Multi-tab sync: Changes propagate across browser tabs
 * - RLS protected: Row Level Security ensures users only see own items
 *
 * @example
 * ```typescript
 * const { items, loading, createItems, updateItemStatus } = useInspectionItems(projectId);
 *
 * // Bulk create items from AI
 * await createItems([
 *   { project_id: projectId, category: 'Grounding', requirement: 'Check GEC size', status: 'Pending' },
 *   { project_id: projectId, category: 'Wiring', requirement: 'Verify conductor fill', status: 'Pending' }
 * ]);
 *
 * // Update status
 * await updateItemStatus(itemId, 'Pass');
 * ```
 */
export function useInspectionItems(projectId: string | undefined): UseInspectionItemsReturn {
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }

    fetchItems();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`inspection_items_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inspection_items',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const fetchItems = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('inspection_items')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setItems(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inspection items');
    } finally {
      setLoading(false);
    }
  };

  const createItem = async (item: Omit<InspectionItemInsert, 'id' | 'user_id'>): Promise<InspectionItem | null> => {
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('inspection_items')
        .insert({ ...item, user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      // Optimistically update local state immediately
      if (data) {
        setItems(prev => [...prev, data]);
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create inspection item');
      return null;
    }
  };

  const createItems = async (items: Omit<InspectionItemInsert, 'id' | 'user_id'>[]): Promise<InspectionItem[] | null> => {
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Add user_id to all items
      const itemsWithUserId = items.map(item => ({ ...item, user_id: user.id }));

      const { data, error } = await supabase
        .from('inspection_items')
        .insert(itemsWithUserId)
        .select();

      if (error) throw error;

      // Optimistically update local state immediately
      if (data) {
        setItems(prev => [...prev, ...data]);
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create inspection items');
      return null;
    }
  };

  const updateItem = async (id: string, updates: InspectionItemUpdate) => {
    try {
      // OPTIMISTIC UPDATE: Update local state immediately for instant UI feedback
      const previousItems = [...items];
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));

      const { error } = await supabase
        .from('inspection_items')
        .update(updates)
        .eq('id', id);

      if (error) {
        // ROLLBACK: Restore previous state on error
        setItems(previousItems);
        throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inspection item');
    }
  };

  const deleteItem = async (id: string) => {
    try {
      // OPTIMISTIC UPDATE: Remove from local state immediately
      const previousItems = [...items];
      setItems(prev => prev.filter(i => i.id !== id));

      const { error } = await supabase
        .from('inspection_items')
        .delete()
        .eq('id', id);

      if (error) {
        // ROLLBACK: Restore previous state on error
        setItems(previousItems);
        throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inspection item');
    }
  };

  const updateItemStatus = async (id: string, status: InspectionItem['status']) => {
    await updateItem(id, { status });
  };

  return {
    items,
    loading,
    error,
    createItem,
    createItems,
    updateItem,
    deleteItem,
    updateItemStatus,
  };
}
