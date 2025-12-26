import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  getPendingActions,
  approveAction,
  rejectAction
} from '../services/ai/agentOrchestrator';
import type { AgentAction, AgentName } from '../types';

export interface UseAgentActionsReturn {
  actions: AgentAction[];
  loading: boolean;
  error: string | null;
  approve: (actionId: string, notes?: string) => Promise<void>;
  reject: (actionId: string, reason?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAgentActions(
  projectId: string | undefined,
  options?: { agentName?: AgentName; status?: string }
): UseAgentActionsReturn {
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActions = async () => {
    if (!projectId) {
      setActions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await getPendingActions(projectId, {
        agentName: options?.agentName,
      });

      setActions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch agent actions');
      console.error('Error fetching agent actions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchActions();
  }, [projectId, options?.agentName]);

  // Real-time subscription
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`agent_actions_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_actions',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchActions(); // Refetch on any change
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [projectId]);

  const approve = async (actionId: string, notes?: string) => {
    // Optimistic update
    setActions(prev => prev.filter(a => a.id !== actionId));

    const success = await approveAction(actionId, notes);

    if (!success) {
      // Rollback on error
      await fetchActions();
      setError('Failed to approve action');
    }
  };

  const reject = async (actionId: string, reason?: string) => {
    // Optimistic update
    setActions(prev => prev.filter(a => a.id !== actionId));

    const success = await rejectAction(actionId, reason);

    if (!success) {
      // Rollback on error
      await fetchActions();
      setError('Failed to reject action');
    }
  };

  return {
    actions,
    loading,
    error,
    approve,
    reject,
    refresh: fetchActions,
  };
}
