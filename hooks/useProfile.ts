/**
 * User Profile Hook
 * Fetch and update the current user's profile (single row, no realtime).
 * RLS on the profiles table scopes SELECT/UPDATE to auth.uid().
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export interface UseProfileReturn {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (updates: Pick<ProfileUpdate, 'full_name' | 'company_name' | 'license_number'>) => Promise<boolean>;
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .single();

      if (error) {
        // PGRST116 = no rows found — profile hasn't been created yet
        if (error.code === 'PGRST116') {
          setProfile(null);
        } else {
          throw error;
        }
      } else {
        setProfile(data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (
    updates: Pick<ProfileUpdate, 'full_name' | 'company_name' | 'license_number'>
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      showToast.success(toastMessages.userProfile.updated);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      showToast.error(toastMessages.userProfile.error);
      return false;
    }
  };

  return { profile, loading, error, updateProfile };
}
