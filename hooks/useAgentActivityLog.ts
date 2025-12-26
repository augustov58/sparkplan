import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AgentActivityLog {
  id: string;
  project_id: string;
  user_id: string;
  agent_action_id: string | null;
  event_type: string;
  agent_name: string;
  details: Record<string, any> | null;
  created_at: string;
}

export interface UseAgentActivityLogReturn {
  logs: AgentActivityLog[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAgentActivityLog(
  projectId: string | undefined,
  options?: {
    limit?: number;
    agentName?: string;
    eventType?: string;
  }
): UseAgentActivityLogReturn {
  const [logs, setLogs] = useState<AgentActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!projectId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('agent_activity_log')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (options?.agentName) {
        query = query.eq('agent_name', options.agentName);
      }

      if (options?.eventType) {
        query = query.eq('event_type', options.eventType);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setLogs(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch activity logs');
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, options?.agentName, options?.eventType, options?.limit]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Real-time subscription
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`agent_activity_log_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_activity_log',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          console.log('New activity log entry:', payload);
          fetchLogs(); // Refetch on new log
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [projectId, fetchLogs]);

  return {
    logs,
    loading,
    error,
    refresh: fetchLogs,
  };
}
