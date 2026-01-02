/**
 * useJurisdictions Hook
 *
 * Custom hook for accessing jurisdiction data (AHJ permit requirements)
 *
 * @remarks
 * Fetches all active jurisdictions from the database and provides
 * search/filter functionality. Jurisdictions are reference data
 * (no RLS) shared across all users.
 *
 * @example
 * ```tsx
 * const { jurisdictions, loading, searchJurisdictions, getJurisdictionById } = useJurisdictions();
 *
 * // Search for "Miami"
 * const results = searchJurisdictions('Miami');
 *
 * // Get by ID
 * const jurisdiction = getJurisdictionById(project.jurisdiction_id);
 * ```
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Jurisdiction } from '../types';

interface UseJurisdictionsReturn {
  jurisdictions: Jurisdiction[];
  loading: boolean;
  error: Error | null;
  searchJurisdictions: (query: string) => Jurisdiction[];
  getJurisdictionById: (id: string) => Jurisdiction | undefined;
}

export function useJurisdictions(): UseJurisdictionsReturn {
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch all active jurisdictions on mount
  useEffect(() => {
    const fetchJurisdictions = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('jurisdictions')
          .select('*')
          .eq('is_active', true)
          .order('state', { ascending: true })
          .order('city', { ascending: true });

        if (fetchError) throw fetchError;

        setJurisdictions(data || []);
      } catch (err) {
        console.error('Error fetching jurisdictions:', err);
        setError(err instanceof Error ? err : new Error('Unknown error fetching jurisdictions'));
      } finally {
        setLoading(false);
      }
    };

    fetchJurisdictions();
  }, []);

  /**
   * Search jurisdictions by query string
   * Searches across: jurisdiction_name, city, county, state
   *
   * @param query - Search string (minimum 2 characters)
   * @returns Filtered array of jurisdictions
   */
  const searchJurisdictions = (query: string): Jurisdiction[] => {
    if (!query || query.length < 2) return [];

    const lowerQuery = query.toLowerCase();
    return jurisdictions.filter(j =>
      j.jurisdiction_name.toLowerCase().includes(lowerQuery) ||
      j.city.toLowerCase().includes(lowerQuery) ||
      (j.county && j.county.toLowerCase().includes(lowerQuery)) ||
      j.state.toLowerCase().includes(lowerQuery) ||
      (j.ahj_name && j.ahj_name.toLowerCase().includes(lowerQuery))
    );
  };

  /**
   * Get jurisdiction by ID
   *
   * @param id - Jurisdiction UUID
   * @returns Jurisdiction object or undefined if not found
   */
  const getJurisdictionById = (id: string): Jurisdiction | undefined => {
    return jurisdictions.find(j => j.id === id);
  };

  return {
    jurisdictions,
    loading,
    error,
    searchJurisdictions,
    getJurisdictionById,
  };
}
