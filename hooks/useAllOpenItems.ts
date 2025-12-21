import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { OpenItem } from '../types';

export interface UseAllOpenItemsReturn {
  openItems: OpenItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to aggregate open items across ALL projects for the current user
 *
 * Fetches:
 * - Pending/Answered RFIs
 * - Open Issues
 * - Upcoming Site Visits
 * - Upcoming Calendar Events
 *
 * @returns Unified list of open items sorted by priority and due date
 */
export function useAllOpenItems(): UseAllOpenItemsReturn {
  const [openItems, setOpenItems] = useState<OpenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllOpenItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setOpenItems([]);
        setLoading(false);
        return;
      }

      // Fetch open RFIs (Pending or Answered)
      const { data: rfis, error: rfisError } = await supabase
        .from('rfis')
        .select(`
          *,
          projects:project_id (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['Pending', 'Answered'])
        .order('due_date', { ascending: true, nullsLast: true });

      if (rfisError) throw rfisError;

      // Fetch open Issues
      const { data: issues, error: issuesError } = await supabase
        .from('issues')
        .select(`
          *,
          projects:project_id (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'Open')
        .order('created_at', { ascending: false });

      if (issuesError) throw issuesError;

      // Fetch upcoming Site Visits (only Scheduled, exclude completed logs)
      const { data: visits, error: visitsError } = await supabase
        .from('site_visits')
        .select(`
          *,
          projects:project_id (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'Scheduled') // Only scheduled visits, not completed logs
        .gte('visit_date', new Date().toISOString()) // Only future visits
        .order('visit_date', { ascending: true });

      if (visitsError) throw visitsError;

      // Fetch upcoming Calendar Events
      const { data: events, error: eventsError } = await supabase
        .from('calendar_events')
        .select(`
          *,
          projects:project_id (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'Upcoming')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true });

      if (eventsError) throw eventsError;

      // Transform all items to unified OpenItem type
      const allItems: OpenItem[] = [];

      // Add RFIs
      if (rfis) {
        rfis.forEach((rfi: any) => {
          if (!rfi.projects) return;
          allItems.push({
            id: rfi.id,
            type: 'rfi',
            project_id: rfi.project_id,
            project_name: rfi.projects.name || 'Unknown Project',
            title: rfi.subject,
            description: rfi.question,
            status: rfi.status,
            priority: rfi.priority,
            due_date: rfi.due_date,
            url: `/project/${rfi.project_id}/rfis`,
            created_at: rfi.created_at
          });
        });
      }

      // Add Issues
      if (issues) {
        issues.forEach((issue: any) => {
          if (!issue.projects) return;
          allItems.push({
            id: issue.id,
            type: 'issue',
            project_id: issue.project_id,
            project_name: issue.projects.name || 'Unknown Project',
            title: `NEC ${issue.article}`,
            description: issue.description,
            status: issue.status,
            priority: issue.severity, // 'Critical', 'Warning', 'Info'
            url: `/project/${issue.project_id}/issues`,
            created_at: issue.created_at
          });
        });
      }

      // Add Site Visits
      if (visits) {
        visits.forEach((visit: any) => {
          if (!visit.projects) return;
          allItems.push({
            id: visit.id,
            type: 'site_visit',
            project_id: visit.project_id,
            project_name: visit.projects.name || 'Unknown Project',
            title: visit.title,
            description: visit.description,
            status: visit.status,
            priority: 'Medium', // Default priority for visits
            due_date: visit.visit_date,
            url: `/project/${visit.project_id}/site-visits`,
            created_at: visit.created_at
          });
        });
      }

      // Add Calendar Events
      if (events) {
        events.forEach((event: any) => {
          if (!event.projects) return;
          allItems.push({
            id: event.id,
            type: 'calendar_event',
            project_id: event.project_id,
            project_name: event.projects.name || 'Unknown Project',
            title: event.title,
            description: event.description || event.event_type,
            status: event.status,
            priority: event.priority,
            due_date: event.event_date,
            url: `/project/${event.project_id}`, // No calendar page yet
            created_at: event.created_at
          });
        });
      }

      // Sort by priority (Critical/Urgent first) then due date
      const priorityOrder: Record<string, number> = {
        'Critical': 1,
        'Urgent': 1,
        'High': 2,
        'Warning': 3,
        'Medium': 3,
        'Low': 4,
        'Info': 4
      };

      allItems.sort((a, b) => {
        // First sort by priority
        const aPriority = priorityOrder[a.priority] || 5;
        const bPriority = priorityOrder[b.priority] || 5;
        if (aPriority !== bPriority) return aPriority - bPriority;

        // Then by due date (items with due dates first)
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }

        // Finally by created date (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setOpenItems(allItems);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch open items');
      console.error('Error fetching open items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllOpenItems();

    // Set up real-time subscriptions for all tables
    const rfisChannel = supabase
      .channel('all_rfis')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rfis' },
        () => fetchAllOpenItems()
      )
      .subscribe();

    const issuesChannel = supabase
      .channel('all_issues')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        () => fetchAllOpenItems()
      )
      .subscribe();

    const visitsChannel = supabase
      .channel('all_site_visits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_visits' },
        () => fetchAllOpenItems()
      )
      .subscribe();

    const eventsChannel = supabase
      .channel('all_calendar_events')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        () => fetchAllOpenItems()
      )
      .subscribe();

    return () => {
      rfisChannel.unsubscribe();
      issuesChannel.unsubscribe();
      visitsChannel.unsubscribe();
      eventsChannel.unsubscribe();
    };
  }, []);

  return {
    openItems,
    loading,
    error,
    refresh: fetchAllOpenItems
  };
}
