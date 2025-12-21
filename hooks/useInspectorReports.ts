/**
 * Inspector Reports Data Management Hook
 *
 * Provides operations for storing and retrieving Inspector Mode AI inspection reports
 * with real-time synchronization.
 *
 * @module hooks/useInspectorReports
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { InspectorReport, InspectorReportInsert } from '@/lib/database.types';
import type { InspectionResult } from '@/services/inspection/inspectorMode';

/**
 * Return type for useInspectorReports hook
 */
export interface UseInspectorReportsReturn {
  /** Most recent inspection report for the project, or null if none exists */
  latestReport: InspectorReport | null;

  /** True during initial fetch, false once data loaded */
  loading: boolean;

  /** Error message if any operation failed, null otherwise */
  error: string | null;

  /**
   * Saves a new inspection report to the database
   *
   * @param inspectionResult - Complete inspection result from runInspection()
   * @returns Created report with database-generated fields, or null if error
   */
  saveReport: (inspectionResult: InspectionResult) => Promise<InspectorReport | null>;

  /**
   * Deletes an inspection report from the database
   *
   * @param id - Report UUID
   */
  deleteReport: (id: string) => Promise<void>;
}

/**
 * Custom hook for managing inspector reports with real-time synchronization
 *
 * @param projectId - UUID of project to fetch reports for (undefined = no fetch)
 * @returns Hook interface with latest report and save/delete operations
 *
 * @remarks
 * - Only stores the most recent report per project (future: support history)
 * - Real-time subscriptions keep data synchronized across tabs
 * - RLS protected: Users only see their own reports
 *
 * @example
 * ```typescript
 * const { latestReport, loading, saveReport } = useInspectorReports(projectId);
 *
 * // Load previous report
 * if (latestReport) {
 *   console.log(`Last inspection: ${latestReport.inspected_at}`);
 *   console.log(`Score: ${latestReport.score}`);
 * }
 *
 * // Save new report
 * const result = runInspection(projectData);
 * await saveReport(result);
 * ```
 */
export function useInspectorReports(projectId: string | undefined): UseInspectorReportsReturn {
  const [latestReport, setLatestReport] = useState<InspectorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLatestReport(null);
      setLoading(false);
      return;
    }

    fetchLatestReport();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`inspector_reports_${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inspector_reports',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchLatestReport();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const fetchLatestReport = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from('inspector_reports')
        .select('*')
        .eq('project_id', projectId)
        .order('inspected_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLatestReport(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inspector reports');
    } finally {
      setLoading(false);
    }
  };

  const saveReport = async (inspectionResult: InspectionResult): Promise<InspectorReport | null> => {
    if (!projectId) {
      setError('No project ID provided');
      return null;
    }

    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const reportData: Omit<InspectorReportInsert, 'id'> = {
        project_id: projectId,
        user_id: user.id,
        score: inspectionResult.summary.score,
        total_checks: inspectionResult.summary.totalChecks,
        passed: inspectionResult.summary.passed,
        warnings: inspectionResult.summary.warnings,
        critical: inspectionResult.summary.critical,
        issues: inspectionResult.issues as any, // Cast to Json type
        passed_checks: inspectionResult.passedChecks as any, // Cast to Json type
        nec_articles_referenced: inspectionResult.necArticlesReferenced,
        inspected_at: inspectionResult.timestamp.toISOString(),
      };

      const { data, error } = await supabase
        .from('inspector_reports')
        .insert(reportData)
        .select()
        .single();

      if (error) throw error;

      // Optimistically update local state
      if (data) {
        setLatestReport(data);
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save inspector report');
      return null;
    }
  };

  const deleteReport = async (id: string) => {
    try {
      const { error } = await supabase
        .from('inspector_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Clear local state if deleted report was the latest
      if (latestReport?.id === id) {
        setLatestReport(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inspector report');
    }
  };

  return {
    latestReport,
    loading,
    error,
    saveReport,
    deleteReport,
  };
}
