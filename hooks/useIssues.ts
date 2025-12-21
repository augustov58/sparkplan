/**
 * Issues Data Management Hook
 *
 * Provides CRUD operations for NEC code violations and punch list items
 * with real-time synchronization.
 *
 * @module hooks/useIssues
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Issue, IssueInsert, IssueUpdate } from '@/lib/database.types';

/**
 * Return type for useIssues hook
 */
export interface UseIssuesReturn {
  /** Array of issues for the current project, sorted by creation date (newest first) */
  issues: Issue[];

  /** True during initial fetch, false once data loaded */
  loading: boolean;

  /** Error message if any operation failed, null otherwise */
  error: string | null;

  /**
   * Creates a new issue in the database
   *
   * @param issue - Issue data (id and user_id auto-generated)
   * @returns Created issue with database-generated fields, or null if error
   */
  createIssue: (issue: Omit<IssueInsert, 'id' | 'user_id'>) => Promise<Issue | null>;

  /**
   * Updates an existing issue
   *
   * @param id - Issue UUID
   * @param updates - Partial issue data to update
   */
  updateIssue: (id: string, updates: IssueUpdate) => Promise<void>;

  /**
   * Deletes an issue from the database
   *
   * @param id - Issue UUID
   */
  deleteIssue: (id: string) => Promise<void>;

  /**
   * Toggles issue status between Open and Resolved
   *
   * @param id - Issue UUID
   */
  toggleIssueStatus: (id: string) => Promise<void>;
}

/**
 * Custom hook for managing issues with real-time synchronization
 *
 * @param projectId - UUID of project to fetch issues for (undefined = no fetch)
 * @returns Hook interface with issues data and CRUD operations
 *
 * @remarks
 * - Real-time subscriptions automatically refetch when database changes
 * - Optimistic updates: UI updates immediately before database confirms
 * - Multi-tab sync: Changes propagate across browser tabs
 * - RLS protected: Row Level Security ensures users only see own issues
 *
 * @example
 * ```typescript
 * const { issues, loading, createIssue, toggleIssueStatus } = useIssues(projectId);
 *
 * // Create new issue
 * await createIssue({
 *   project_id: projectId,
 *   description: 'Panel lacks proper labeling',
 *   article: '408.4',
 *   severity: 'Warning',
 *   status: 'Open'
 * });
 *
 * // Toggle status
 * await toggleIssueStatus(issueId);
 * ```
 */
export function useIssues(projectId: string | undefined): UseIssuesReturn {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setIssues([]);
      setLoading(false);
      return;
    }

    fetchIssues();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`issues_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'issues',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchIssues();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const fetchIssues = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIssues(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  };

  const createIssue = async (issue: Omit<IssueInsert, 'id' | 'user_id'>): Promise<Issue | null> => {
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user);

      if (!user) {
        throw new Error('User not authenticated');
      }

      const issueData = {
        ...issue,
        user_id: user.id,
        assigned_to: issue.assigned_to || null // Ensure it's explicitly null if not provided
      };
      console.log('Attempting to insert issue:', issueData);

      const { data, error } = await supabase
        .from('issues')
        .insert(issueData)
        .select()
        .single();

      console.log('Supabase insert response:', { data, error });

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      // Optimistically update local state immediately
      if (data) {
        setIssues(prev => [data, ...prev]);
      }

      return data;
    } catch (err) {
      console.error('Full error object:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create issue';
      setError(errorMessage);
      return null;
    }
  };

  const updateIssue = async (id: string, updates: IssueUpdate) => {
    try {
      // OPTIMISTIC UPDATE: Update local state immediately for instant UI feedback
      const previousIssues = [...issues];
      setIssues(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));

      const { error } = await supabase
        .from('issues')
        .update(updates)
        .eq('id', id);

      if (error) {
        // ROLLBACK: Restore previous state on error
        setIssues(previousIssues);
        throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update issue');
    }
  };

  const deleteIssue = async (id: string) => {
    try {
      // OPTIMISTIC UPDATE: Remove from local state immediately
      const previousIssues = [...issues];
      setIssues(prev => prev.filter(i => i.id !== id));

      const { error } = await supabase
        .from('issues')
        .delete()
        .eq('id', id);

      if (error) {
        // ROLLBACK: Restore previous state on error
        setIssues(previousIssues);
        throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete issue');
    }
  };

  const toggleIssueStatus = async (id: string) => {
    const issue = issues.find(i => i.id === id);
    if (!issue) return;

    const newStatus = issue.status === 'Open' ? 'Resolved' : 'Open';
    await updateIssue(id, { status: newStatus });
  };

  return {
    issues,
    loading,
    error,
    createIssue,
    updateIssue,
    deleteIssue,
    toggleIssueStatus,
  };
}
