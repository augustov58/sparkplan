/**
 * Time Entries Hook
 *
 * CRUD for the `time_entries` table with optimistic updates + Supabase
 * realtime subscription. Mirrors the `usePanels` pattern.
 *
 * Computed totals (`billable_amount`, `cost_amount`) are filled in here from
 * `services/billing/billingMath` so the persisted denormalized values stay
 * consistent with how the UI displays them.
 *
 * Sort order: `work_date DESC, created_at DESC` — most-recent entries first.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';
import {
  computeTimeEntryBillable,
  computeTimeEntryCost,
} from '@/services/billing/billingMath';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
type TimeEntryInsert = Database['public']['Tables']['time_entries']['Insert'];
type TimeEntryUpdate = Database['public']['Tables']['time_entries']['Update'];

/** Editable fields a caller supplies. id, user_id, totals are computed. */
export type TimeEntryInput = Omit<
  TimeEntryInsert,
  'id' | 'user_id' | 'project_id' | 'billable_amount' | 'cost_amount' | 'invoice_id' | 'created_at' | 'updated_at'
>;

export interface UseTimeEntriesReturn {
  timeEntries: TimeEntry[];
  loading: boolean;
  error: string | null;
  createTimeEntry: (entry: TimeEntryInput) => Promise<TimeEntry | null>;
  updateTimeEntry: (id: string, updates: Partial<TimeEntryInput>) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;
}

export function useTimeEntries(projectId: string | undefined): UseTimeEntriesReturn {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!projectId) {
      setTimeEntries([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await supabase
        .from('time_entries')
        .select('*')
        .eq('project_id', projectId)
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (err) throw err;
      setTimeEntries(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch time entries');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setTimeEntries([]);
      setLoading(false);
      return;
    }
    fetchEntries();

    const channel = supabase
      .channel(`time_entries_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchEntries();
        },
      )
      .subscribe();

    const unsubscribeRefresh = dataRefreshEvents.subscribe('time_entries', () => {
      fetchEntries();
    });

    return () => {
      channel.unsubscribe();
      unsubscribeRefresh();
    };
  }, [projectId, fetchEntries]);

  const createTimeEntry = async (entry: TimeEntryInput): Promise<TimeEntry | null> => {
    if (!projectId) return null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const billableAmount = computeTimeEntryBillable(entry.hours, entry.billable_rate);
      const costAmount = computeTimeEntryCost(entry.hours, entry.cost_rate ?? null);

      const { data, error: err } = await supabase
        .from('time_entries')
        .insert({
          ...entry,
          project_id: projectId,
          user_id: user.id,
          billable_amount: billableAmount,
          cost_amount: costAmount,
        })
        .select()
        .single();

      if (err) throw err;

      if (data) {
        setTimeEntries((prev) => [data, ...prev]);
      }
      showToast.success(toastMessages.timeEntry.created);
      dataRefreshEvents.emit('time_entries');
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create time entry');
      showToast.error(toastMessages.timeEntry.error);
      return null;
    }
  };

  const updateTimeEntry = async (id: string, updates: Partial<TimeEntryInput>) => {
    try {
      // We need hours + billable_rate + cost_rate together to recompute totals.
      // Pull the current row from local state and merge.
      const current = timeEntries.find((t) => t.id === id);
      if (!current) throw new Error('Time entry not found');

      const merged = { ...current, ...updates };
      const billableAmount = computeTimeEntryBillable(merged.hours, merged.billable_rate);
      const costAmount = computeTimeEntryCost(merged.hours, merged.cost_rate ?? null);

      const patch: TimeEntryUpdate = {
        ...updates,
        billable_amount: billableAmount,
        cost_amount: costAmount,
      };

      const previous = [...timeEntries];
      setTimeEntries((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } as TimeEntry : t)),
      );

      const { error: err } = await supabase.from('time_entries').update(patch).eq('id', id);
      if (err) {
        setTimeEntries(previous);
        throw err;
      }
      showToast.success(toastMessages.timeEntry.updated);
      dataRefreshEvents.emit('time_entries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update time entry');
      showToast.error(toastMessages.timeEntry.error);
    }
  };

  const deleteTimeEntry = async (id: string) => {
    try {
      const previous = [...timeEntries];
      setTimeEntries((prev) => prev.filter((t) => t.id !== id));

      const { error: err } = await supabase.from('time_entries').delete().eq('id', id);
      if (err) {
        setTimeEntries(previous);
        throw err;
      }
      showToast.success(toastMessages.timeEntry.deleted);
      dataRefreshEvents.emit('time_entries');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete time entry');
      showToast.error(toastMessages.timeEntry.deleteError);
    }
  };

  return {
    timeEntries,
    loading,
    error,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
  };
}
