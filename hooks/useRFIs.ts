import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { RFI } from '../types';

export interface UseRFIsReturn {
  rfis: RFI[];
  loading: boolean;
  error: string | null;
  createRFI: (rfi: Omit<RFI, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<RFI | null>;
  updateRFI: (id: string, updates: Partial<RFI>) => Promise<void>;
  deleteRFI: (id: string) => Promise<void>;
  answerRFI: (id: string, answer: string, respondedBy: string) => Promise<void>;
  closeRFI: (id: string) => Promise<void>;
  generateRFINumber: () => Promise<string>;
}

export function useRFIs(projectId: string | undefined): UseRFIsReturn {
  const [rfis, setRfis] = useState<RFI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRFIs = async () => {
    if (!projectId) {
      setRfis([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('rfis')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setRfis(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch RFIs');
      console.error('Error fetching RFIs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRFIs();
  }, [projectId]);

  // Real-time subscription
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`rfis_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rfis',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchRFIs(); // Refetch on any change
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [projectId]);

  /**
   * Generate next RFI number (RFI-001, RFI-002, etc.)
   */
  const generateRFINumber = async (): Promise<string> => {
    if (!projectId) return 'RFI-001';

    try {
      const { data, error } = await supabase.rpc('generate_rfi_number', {
        p_project_id: projectId,
      });

      if (error) throw error;
      return data || 'RFI-001';
    } catch (err) {
      console.error('Error generating RFI number:', err);
      // Fallback: count existing RFIs
      const nextNum = rfis.length + 1;
      return `RFI-${String(nextNum).padStart(3, '0')}`;
    }
  };

  /**
   * Create new RFI
   */
  const createRFI = async (
    rfi: Omit<RFI, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<RFI | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('rfis')
        .insert({
          ...rfi,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Optimistic update
      setRfis((prev) => [data, ...prev]);
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to create RFI');
      console.error('Error creating RFI:', err);
      return null;
    }
  };

  /**
   * Update existing RFI
   */
  const updateRFI = async (id: string, updates: Partial<RFI>): Promise<void> => {
    try {
      // Optimistic update
      const previousRfis = [...rfis];
      setRfis((prev) => prev.map((rfi) => (rfi.id === id ? { ...rfi, ...updates } : rfi)));

      const { error } = await supabase.from('rfis').update(updates).eq('id', id);

      if (error) {
        // Rollback on error
        setRfis(previousRfis);
        throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update RFI');
      console.error('Error updating RFI:', err);
    }
  };

  /**
   * Delete RFI
   */
  const deleteRFI = async (id: string): Promise<void> => {
    try {
      // Optimistic update
      const previousRfis = [...rfis];
      setRfis((prev) => prev.filter((rfi) => rfi.id !== id));

      const { error } = await supabase.from('rfis').delete().eq('id', id);

      if (error) {
        // Rollback on error
        setRfis(previousRfis);
        throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete RFI');
      console.error('Error deleting RFI:', err);
    }
  };

  /**
   * Answer RFI (change status to Answered)
   */
  const answerRFI = async (id: string, answer: string, respondedBy: string): Promise<void> => {
    await updateRFI(id, {
      answer,
      responded_by: respondedBy,
      status: 'Answered',
      response_date: new Date().toISOString(),
    });
  };

  /**
   * Close RFI (change status to Closed)
   */
  const closeRFI = async (id: string): Promise<void> => {
    await updateRFI(id, {
      status: 'Closed',
      closed_date: new Date().toISOString(),
    });
  };

  return {
    rfis,
    loading,
    error,
    createRFI,
    updateRFI,
    deleteRFI,
    answerRFI,
    closeRFI,
    generateRFINumber,
  };
}
