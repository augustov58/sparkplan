/**
 * Project Export/Import Service
 * Allows users to backup projects as JSON and restore them
 */

import { supabase } from '../lib/supabase';
import { ProjectType, ProjectStatus, type Project } from '../types';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];
type Feeder = Database['public']['Tables']['feeders']['Row'];
type RFI = Database['public']['Tables']['rfis']['Row'];
type SiteVisit = Database['public']['Tables']['site_visits']['Row'];
type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];

// Each export-array entry is a Partial<> of the corresponding DB row so the
// export function can pick a stable subset of columns without listing every
// nullable/auto-managed column. Supabase fills defaults for absent fields at
// import-insert time. version='1.0' frames the snapshot; bump on incompatible
// changes to the picked subset.
export interface ProjectExportData {
  version: string; // Format version for future compatibility
  exportDate: string;
  project: Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>;
  panels: Partial<Omit<Panel, 'id' | 'project_id' | 'created_at'>>[];
  circuits: Partial<Omit<Circuit, 'id' | 'project_id' | 'panel_id' | 'created_at'>>[];
  transformers: Partial<Omit<Transformer, 'id' | 'project_id' | 'created_at'>>[];
  feeders: Partial<Omit<Feeder, 'id' | 'project_id' | 'created_at' | 'updated_at'>>[];
  rfis?: Partial<Omit<RFI, 'id' | 'project_id' | 'created_at' | 'updated_at'>>[];
  siteVisits?: Partial<Omit<SiteVisit, 'id' | 'project_id' | 'created_at' | 'updated_at'>>[];
  calendarEvents?: Partial<Omit<CalendarEvent, 'id' | 'project_id' | 'created_at' | 'updated_at'>>[];
}

/**
 * Export a complete project to JSON
 */
export async function exportProjectToJSON(projectId: string, projectName: string): Promise<void> {
  try {
    // Fetch all project data
    const [
      { data: panels },
      { data: circuits },
      { data: transformers },
      { data: feeders },
      { data: rfis },
      { data: siteVisits },
      { data: calendarEvents }
    ] = await Promise.all([
      supabase.from('panels').select('*').eq('project_id', projectId),
      supabase.from('circuits').select('*').eq('project_id', projectId),
      supabase.from('transformers').select('*').eq('project_id', projectId),
      supabase.from('feeders').select('*').eq('project_id', projectId),
      supabase.from('rfis').select('*').eq('project_id', projectId),
      supabase.from('site_visits').select('*').eq('project_id', projectId),
      supabase.from('calendar_events').select('*').eq('project_id', projectId)
    ]);

    // Get project metadata from first panel or use defaults. Fields use the
    // Project interface shape (camelCase), not the DB columns — backup/restore
    // works at the frontend type level so callers don't have to re-run the
    // DB → frontend adapter on import.
    const firstPanelPhase = panels?.[0]?.phase;
    const project: ProjectExportData['project'] = {
      name: projectName,
      address: '',
      type: ProjectType.COMMERCIAL,
      necEdition: '2023',
      status: ProjectStatus.IN_PROGRESS,
      progress: 0,
      loads: [],
      issues: [],
      serviceVoltage: panels?.[0]?.voltage || 480,
      servicePhase: (firstPanelPhase === 1 || firstPanelPhase === 3) ? firstPanelPhase : 3,
      serviceAmps: panels?.[0]?.bus_rating || 400,
      jurisdiction_id: undefined
    };

    const exportData: ProjectExportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      project,
      panels: (panels || []).map(p => ({
        name: p.name,
        voltage: p.voltage,
        phase: p.phase,
        bus_rating: p.bus_rating,
        main_breaker_amps: p.main_breaker_amps,
        is_main: p.is_main,
        is_proposed: p.is_proposed,
        location: p.location,
        fed_from_type: p.fed_from_type,
        fed_from: p.fed_from,
        fed_from_transformer_id: p.fed_from_transformer_id,
        feeder_breaker_amps: p.feeder_breaker_amps,
      })),
      circuits: (circuits || []).map(c => ({
        circuit_number: c.circuit_number,
        description: c.description,
        load_type: c.load_type,
        pole: c.pole,
        breaker_amps: c.breaker_amps,
        load_watts: c.load_watts,
        conductor_size: c.conductor_size,
        egc_size: c.egc_size,
        is_proposed: c.is_proposed,
      })),
      transformers: (transformers || []).map(t => ({
        name: t.name,
        kva_rating: t.kva_rating,
        primary_voltage: t.primary_voltage,
        secondary_voltage: t.secondary_voltage,
        primary_phase: t.primary_phase,
        secondary_phase: t.secondary_phase,
        impedance_percent: t.impedance_percent,
        fed_from_panel_id: t.fed_from_panel_id,
        fed_from_circuit_number: t.fed_from_circuit_number,
        primary_breaker_amps: t.primary_breaker_amps,
        secondary_breaker_amps: t.secondary_breaker_amps,
        primary_conductor_size: t.primary_conductor_size,
        secondary_conductor_size: t.secondary_conductor_size,
        connection_type: t.connection_type,
        cooling_type: t.cooling_type,
        winding_type: t.winding_type,
        impedance_percent_tested: null,
      })),
      feeders: (feeders || []).map(f => ({
        name: f.name,
        source_panel_id: f.source_panel_id,
        source_transformer_id: f.source_transformer_id,
        destination_panel_id: f.destination_panel_id,
        destination_transformer_id: f.destination_transformer_id,
        design_load_va: f.design_load_va,
        phase_conductor_size: f.phase_conductor_size,
        neutral_conductor_size: f.neutral_conductor_size,
        egc_size: f.egc_size,
        conductor_material: f.conductor_material,
        conduit_size: f.conduit_size,
        conduit_type: f.conduit_type,
        distance_ft: f.distance_ft,
        voltage_drop_percent: f.voltage_drop_percent,
        ambient_temperature_c: f.ambient_temperature_c,
        sets_in_parallel: f.sets_in_parallel,
        is_service_entrance: f.is_service_entrance,
        continuous_load_va: f.continuous_load_va,
        noncontinuous_load_va: f.noncontinuous_load_va,
        total_load_va: f.total_load_va,
        num_current_carrying: f.num_current_carrying,
      })),
      rfis: (rfis || []).map(r => ({
        rfi_number: r.rfi_number,
        subject: r.subject,
        question: r.question,
        answer: r.answer,
        status: r.status,
        priority: r.priority,
        assigned_to: r.assigned_to,
        requested_by: r.requested_by,
        responded_by: r.responded_by,
        due_date: r.due_date,
        closed_date: r.closed_date,
        notes: r.notes,
      })),
      siteVisits: (siteVisits || []).map(v => ({
        visit_date: v.visit_date,
        visit_type: v.visit_type,
        attendees: v.attendees,
        weather_conditions: v.weather_conditions,
        description: v.description,
        issues_found: v.issues_found,
        action_items: v.action_items,
        status: v.status,
      })),
      calendarEvents: (calendarEvents || []).map(e => ({
        title: e.title,
        description: e.description,
        event_type: e.event_type,
        event_date: e.event_date,
        location: e.location,
        completed: e.completed,
        related_rfi_id: e.related_rfi_id,
        related_site_visit_id: e.related_site_visit_id,
      }))
    };

    // Create JSON file and download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error('Failed to export project');
  }
}

/**
 * Import a project from JSON file
 */
export async function importProjectFromJSON(
  file: File,
  userId: string
): Promise<{ projectId: string; projectName: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data: ProjectExportData = JSON.parse(content);

        // Validate format version
        if (!data.version || data.version !== '1.0') {
          throw new Error('Unsupported export format version');
        }

        // Create project. Map the Project (camelCase) shape from the JSON
        // back to the DB columns (snake_case) — symmetric to the export
        // which captured the frontend Project shape. Defensive `?? null`
        // ensures missing optional fields don't blow up the insert. Insert
        // payload is typed loosely via `as never` because the projects table
        // has many non-nullable columns this minimal restore path doesn't
        // populate; the DB fills defaults.
        const projectInsert = {
          user_id: userId,
          name: `${data.project.name ?? 'Imported Project'} (Imported)`,
          address: data.project.address ?? '',
          type: data.project.type ?? null,
          nec_edition: data.project.necEdition ?? '2023',
          status: data.project.status ?? null,
          service_voltage: data.project.serviceVoltage ?? null,
          service_phase: data.project.servicePhase ?? null,
          service_amps: data.project.serviceAmps ?? null,
        };
        const { data: newProject, error: projectError } = await supabase
          .from('projects')
          .insert([projectInsert as never])
          .select()
          .single();

        if (projectError || !newProject) {
          throw new Error('Failed to create project');
        }

        const projectId = newProject.id;

        // Create ID mappings for relationships
        const panelIdMap = new Map<number, string>();
        const transformerIdMap = new Map<number, string>();

        // Import panels. Partial fields the export wrote are forwarded
        // verbatim; the DB fills defaults for the rest. Insert payload is
        // typed `as never[]` to satisfy the strict Insert overload while
        // tolerating partial shapes.
        if (data.panels.length > 0) {
          const { data: newPanels, error: panelsError } = await supabase
            .from('panels')
            .insert(
              data.panels.map(p => ({
                ...p,
                project_id: projectId
              })) as never[]
            )
            .select();

          if (panelsError) throw new Error('Failed to import panels');

          // Build panel ID mapping
          newPanels?.forEach((panel, index) => {
            panelIdMap.set(index, panel.id);
          });
        }

        // Import transformers (same Partial-as-never pattern as panels).
        if (data.transformers.length > 0) {
          const { data: newTransformers, error: transformersError } = await supabase
            .from('transformers')
            .insert(
              data.transformers.map(t => ({
                ...t,
                project_id: projectId
              })) as never[]
            )
            .select();

          if (transformersError) throw new Error('Failed to import transformers');

          newTransformers?.forEach((transformer, index) => {
            transformerIdMap.set(index, transformer.id);
          });
        }

        // Import circuits (map panel IDs). All four supabase.insert calls
        // use `as never[]` casts for the same reason as panels above.
        if (data.circuits.length > 0) {
          const { error: circuitsError } = await supabase
            .from('circuits')
            .insert(
              data.circuits.map(c => ({
                ...c,
                project_id: projectId,
                panel_id: panelIdMap.get(0) // Assign to first panel (simplified)
              })) as never[]
            );

          if (circuitsError) throw new Error('Failed to import circuits');
        }

        // Import feeders
        if (data.feeders.length > 0) {
          const { error: feedersError } = await supabase
            .from('feeders')
            .insert(
              data.feeders.map(f => ({
                ...f,
                project_id: projectId
              })) as never[]
            );

          if (feedersError) console.warn('Some feeders failed to import');
        }

        // Import RFIs (optional)
        if (data.rfis && data.rfis.length > 0) {
          await supabase.from('rfis').insert(
            data.rfis.map(r => ({ ...r, project_id: projectId })) as never[]
          );
        }

        // Import site visits (optional)
        if (data.siteVisits && data.siteVisits.length > 0) {
          await supabase.from('site_visits').insert(
            data.siteVisits.map(v => ({ ...v, project_id: projectId })) as never[]
          );
        }

        // Import calendar events (optional)
        if (data.calendarEvents && data.calendarEvents.length > 0) {
          await supabase.from('calendar_events').insert(
            data.calendarEvents.map(e => ({ ...e, project_id: projectId })) as never[]
          );
        }

        resolve({
          projectId,
          projectName: newProject.name
        });
      } catch (error) {
        console.error('Import failed:', error);
        reject(error instanceof Error ? error : new Error('Failed to import project'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
