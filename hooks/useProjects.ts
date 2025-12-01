/**
 * Projects Data Hook
 * CRUD operations for projects with Supabase
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { Project } from '@/types';
import { useAuthContext } from '@/components/Auth/AuthProvider';
import { dbProjectToFrontend, frontendProjectToDbInsert, frontendProjectToDbUpdate } from '@/lib/typeAdapters';

type DbProject = Database['public']['Tables']['projects']['Row'];

export interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  createProject: (project: Partial<Project>) => Promise<Project | null>;
  updateProject: (project: Project) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProjectById: (id: string) => Project | undefined;
}

export function useProjects(): UseProjectsReturn {
  const { user } = useAuthContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    fetchProjects();

    // Set up real-time subscription
    const subscription = supabase
      .channel('projects_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchProjects();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const fetchProjects = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert database projects to frontend format
      const frontendProjects = (data || []).map(dbProjectToFrontend);
      setProjects(frontendProjects);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (
    project: Partial<Project>
  ): Promise<Project | null> => {
    if (!user) return null;

    try {
      const dbProject = frontendProjectToDbInsert(project);

      const { data, error } = await supabase
        .from('projects')
        .insert([{
          ...dbProject,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      // Convert back to frontend format
      const frontendProject = dbProjectToFrontend(data as DbProject);

      // Optimistically update local state immediately (real-time subscription will sync later)
      setProjects(prev => [frontendProject, ...prev]);

      return frontendProject;
    } catch (err) {
      console.error('Failed to create project:', err);
      setError(err instanceof Error ? err.message : 'Failed to create project');
      return null;
    }
  };

  const updateProject = async (project: Project) => {
    try {
      const dbUpdates = frontendProjectToDbUpdate(project);

      const { error } = await supabase
        .from('projects')
        .update({
          ...dbUpdates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', project.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update project:', err);
      setError(err instanceof Error ? err.message : 'Failed to update project');
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const getProjectById = (id: string) => {
    return projects.find((p: Project) => p.id === id);
  };

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    getProjectById,
  };
}
