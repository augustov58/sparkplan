/**
 * Project Billing Settings Hook
 *
 * Singleton-per-project wrapper around `project_billing_settings`. Unlike the
 * other entity hooks (panels, time entries, etc.) there is exactly **one row
 * per project** — keyed by `project_id`. Use `upsertSettings` instead of
 * separate create/update.
 *
 * Default-ed result: when the project has no billing settings row yet,
 * `settings` is `null` and `loading` is false. Callers display defaults from
 * the form (markup 20%, tax 0%, terms 30) until the user saves once.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { showToast, toastMessages } from '@/lib/toast';
import { dataRefreshEvents } from '@/lib/dataRefreshEvents';

type ProjectBillingSettings = Database['public']['Tables']['project_billing_settings']['Row'];
type ProjectBillingSettingsInsert = Database['public']['Tables']['project_billing_settings']['Insert'];

export interface UseProjectBillingSettingsReturn {
  settings: ProjectBillingSettings | null;
  loading: boolean;
  error: string | null;
  /**
   * Upsert the project billing settings row. `user_id` and `project_id` are
   * set automatically — callers pass only the editable fields.
   */
  upsertSettings: (
    patch: Omit<ProjectBillingSettingsInsert, 'project_id' | 'user_id'>,
  ) => Promise<ProjectBillingSettings | null>;
}

export function useProjectBillingSettings(
  projectId: string | undefined,
): UseProjectBillingSettingsReturn {
  const [settings, setSettings] = useState<ProjectBillingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!projectId) {
      setSettings(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error: err } = await supabase
        .from('project_billing_settings')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();
      if (err) throw err;
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch billing settings');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setSettings(null);
      setLoading(false);
      return;
    }

    fetchSettings();

    const channel = supabase
      .channel(`project_billing_settings_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_billing_settings',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchSettings();
        },
      )
      .subscribe();

    const unsubscribeRefresh = dataRefreshEvents.subscribe('project_billing_settings', () => {
      fetchSettings();
    });

    return () => {
      channel.unsubscribe();
      unsubscribeRefresh();
    };
  }, [projectId, fetchSettings]);

  const upsertSettings = async (
    patch: Omit<ProjectBillingSettingsInsert, 'project_id' | 'user_id'>,
  ): Promise<ProjectBillingSettings | null> => {
    if (!projectId) return null;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: err } = await supabase
        .from('project_billing_settings')
        .upsert(
          { ...patch, project_id: projectId, user_id: user.id },
          { onConflict: 'project_id' },
        )
        .select()
        .single();

      if (err) throw err;

      setSettings(data);
      showToast.success(toastMessages.billingSettings.saved);
      dataRefreshEvents.emit('project_billing_settings');
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save billing settings');
      showToast.error(toastMessages.billingSettings.error);
      return null;
    }
  };

  return { settings, loading, error, upsertSettings };
}
