import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { SiteVisit } from '../types';

export interface UseSiteVisitsReturn {
  visits: SiteVisit[];
  loading: boolean;
  error: string | null;
  createVisit: (visit: Omit<SiteVisit, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<SiteVisit | null>;
  updateVisit: (id: string, updates: Partial<SiteVisit>) => Promise<void>;
  deleteVisit: (id: string) => Promise<void>;
  completeVisit: (id: string) => Promise<void>;
}

export function useSiteVisits(projectId: string | undefined): UseSiteVisitsReturn {
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVisits = async () => {
    if (!projectId) {
      setVisits([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('site_visits')
        .select('*')
        .eq('project_id', projectId)
        .order('visit_date', { ascending: false });

      if (fetchError) throw fetchError;

      setVisits(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch site visits');
      console.error('Error fetching site visits:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchVisits();
  }, [projectId]);

  // Real-time subscription
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`site_visits_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_visits',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchVisits(); // Refetch on any change
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [projectId]);

  /**
   * Create new site visit
   */
  const createVisit = async (
    visit: Omit<SiteVisit, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<SiteVisit | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('site_visits')
        .insert({
          ...visit,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistic update
      setVisits((prev) => [data, ...prev]);
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to create site visit');
      console.error('Error creating site visit:', err);
      return null;
    }
  };

  /**
   * Update existing site visit
   */
  const updateVisit = async (id: string, updates: Partial<SiteVisit>): Promise<void> => {
    try {
      // Optimistic update
      const previousVisits = [...visits];
      setVisits((prev) => prev.map((visit) => (visit.id === id ? { ...visit, ...updates } : visit)));

      const { error } = await supabase.from('site_visits').update(updates).eq('id', id);

      if (error) {
        // Rollback on error
        setVisits(previousVisits);
        throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update site visit');
      console.error('Error updating site visit:', err);
    }
  };

  /**
   * Delete site visit
   */
  const deleteVisit = async (id: string): Promise<void> => {
    try {
      // Optimistic update
      const previousVisits = [...visits];
      setVisits((prev) => prev.filter((visit) => visit.id !== id));

      const { error } = await supabase.from('site_visits').delete().eq('id', id);

      if (error) {
        // Rollback on error
        setVisits(previousVisits);
        throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete site visit');
      console.error('Error deleting site visit:', err);
    }
  };

  /**
   * Mark visit as completed
   */
  const completeVisit = async (id: string): Promise<void> => {
    await updateVisit(id, {
      status: 'Completed',
    });
  };

  return {
    visits,
    loading,
    error,
    createVisit,
    updateVisit,
    deleteVisit,
    completeVisit,
  };
}
