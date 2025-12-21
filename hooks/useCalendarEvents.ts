import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { CalendarEvent, CalendarEventType } from '../types';

export interface UseCalendarEventsReturn {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  createEvent: (event: Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<CalendarEvent | null>;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<boolean>;
  markCompleted: (id: string) => Promise<boolean>;
  markUncompleted: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useCalendarEvents(projectId: string | undefined): UseCalendarEventsReturn {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('calendar_events')
        .select(`
          *,
          projects:project_id (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .order('event_date', { ascending: true });

      // If projectId provided, filter to that project only
      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setEvents(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch calendar events');
      console.error('Error fetching calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [projectId]);

  // Real-time subscription
  useEffect(() => {
    const channelName = projectId ? `calendar_events_${projectId}` : 'calendar_events_all';

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          ...(projectId && { filter: `project_id=eq.${projectId}` }),
        },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [projectId]);

  const createEvent = async (event: Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<CalendarEvent | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: createError } = await supabase
        .from('calendar_events')
        .insert({
          ...event,
          user_id: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Optimistic update
      setEvents(prev => [...prev, data].sort((a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
      ));

      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to create calendar event');
      console.error('Error creating calendar event:', err);
      return null;
    }
  };

  const updateEvent = async (id: string, updates: Partial<CalendarEvent>): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;

      // Optimistic update
      setEvents(prev =>
        prev.map(event => (event.id === id ? { ...event, ...updates } : event))
          .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      );

      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update calendar event');
      console.error('Error updating calendar event:', err);
      return false;
    }
  };

  const deleteEvent = async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Optimistic update
      setEvents(prev => prev.filter(event => event.id !== id));

      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete calendar event');
      console.error('Error deleting calendar event:', err);
      return false;
    }
  };

  const markCompleted = async (id: string): Promise<boolean> => {
    return updateEvent(id, {
      completed: true,
      completed_at: new Date().toISOString(),
    });
  };

  const markUncompleted = async (id: string): Promise<boolean> => {
    return updateEvent(id, {
      completed: false,
      completed_at: undefined,
    });
  };

  return {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    markCompleted,
    markUncompleted,
    refresh: fetchEvents,
  };
}
