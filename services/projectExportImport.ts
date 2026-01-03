/**
 * Project Export/Import Service
 * Allows users to backup projects as JSON and restore them
 */

import { supabase } from '../lib/supabase';
import type { Project } from '../types';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];
type Feeder = Database['public']['Tables']['feeders']['Row'];
type RFI = Database['public']['Tables']['rfis']['Row'];
type SiteVisit = Database['public']['Tables']['site_visits']['Row'];
type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];

export interface ProjectExportData {
  version: string; // Format version for future compatibility
  exportDate: string;
  project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
  panels: Omit<Panel, 'id' | 'project_id' | 'created_at'>[];
  circuits: Omit<Circuit, 'id' | 'project_id' | 'panel_id' | 'created_at'>[];
  transformers: Omit<Transformer, 'id' | 'project_id' | 'created_at'>[];
  feeders: Omit<Feeder, 'id' | 'project_id' | 'created_at' | 'updated_at'>[];
  rfis?: Omit<RFI, 'id' | 'project_id' | 'created_at' | 'updated_at'>[];
  siteVisits?: Omit<SiteVisit, 'id' | 'project_id' | 'created_at' | 'updated_at'>[];
  calendarEvents?: Omit<CalendarEvent, 'id' | 'project_id' | 'created_at' | 'updated_at'>[];
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

    // Get project metadata from first panel or use defaults
    const project: ProjectExportData['project'] = {
      name: projectName,
      address: '',
      type: 'COMMERCIAL',
      necEdition: '2023',
      status: 'IN_PROGRESS',
      progress: 0,
      loads: [],
      issues: [],
      service_voltage: panels?.[0]?.voltage || 480,
      service_phase: panels?.[0]?.phase || 3,
      service_amps: panels?.[0]?.bus_rating_amps || 400,
      occupancy_type: 'Office',
      building_area_sqft: 0,
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
        bus_rating_amps: p.bus_rating_amps,
        main_breaker_amps: p.main_breaker_amps,
        is_main: p.is_main,
        location: p.location,
        fed_from_type: p.fed_from_type,
        fed_from: p.fed_from,
        fed_from_transformer_id: p.fed_from_transformer_id,
        feeder_breaker_amps: p.feeder_breaker_amps,
        manual_position_x: p.manual_position_x,
        manual_position_y: p.manual_position_y
      })),
      circuits: (circuits || []).map(c => ({
        circuit_number: c.circuit_number,
        description: c.description,
        load_type: c.load_type,
        poles: c.poles,
        breaker_rating_amps: c.breaker_rating_amps,
        load_watts: c.load_watts,
        load_va: c.load_va,
        voltage: c.voltage,
        notes: c.notes
      })),
      transformers: (transformers || []).map(t => ({
        name: t.name,
        kva_rating: t.kva_rating,
        primary_voltage: t.primary_voltage,
        secondary_voltage: t.secondary_voltage,
        phase: t.phase,
        impedance_percent: t.impedance_percent,
        fed_from_type: t.fed_from_type,
        fed_from_panel_id: t.fed_from_panel_id,
        manual_position_x: t.manual_position_x,
        manual_position_y: t.manual_position_y
      })),
      feeders: (feeders || []).map(f => ({
        name: f.name,
        source_panel_id: f.source_panel_id,
        source_transformer_id: f.source_transformer_id,
        destination_panel_id: f.destination_panel_id,
        destination_transformer_id: f.destination_transformer_id,
        design_current_amps: f.design_current_amps,
        conductor_size_awg: f.conductor_size_awg,
        conductor_material: f.conductor_material,
        conduit_size_inches: f.conduit_size_inches,
        length_feet: f.length_feet,
        voltage_drop_percent: f.voltage_drop_percent,
        sizing_basis: f.sizing_basis
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
        answered_date: r.answered_date,
        closed_date: r.closed_date
      })),
      siteVisits: (siteVisits || []).map(v => ({
        visit_date: v.visit_date,
        visit_type: v.visit_type,
        attendees: v.attendees,
        weather_conditions: v.weather_conditions,
        observations: v.observations,
        issues_found: v.issues_found,
        action_items: v.action_items,
        photo_urls: v.photo_urls,
        status: v.status
      })),
      calendarEvents: (calendarEvents || []).map(e => ({
        title: e.title,
        description: e.description,
        event_type: e.event_type,
        event_date: e.event_date,
        location: e.location,
        is_completed: e.is_completed,
        related_rfi_id: e.related_rfi_id,
        related_site_visit_id: e.related_site_visit_id
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

        // Create project (using dbProjectToFrontend adapters would be needed here)
        const { data: newProject, error: projectError } = await supabase
          .from('projects')
          .insert([{
            user_id: userId,
            name: `${data.project.name} (Imported)`,
            address: data.project.address,
            type: data.project.type,
            nec_edition: data.project.necEdition,
            status: data.project.status,
            service_voltage: data.project.service_voltage,
            service_phase: data.project.service_phase,
            service_amps: data.project.service_amps,
            occupancy_type: data.project.occupancy_type,
            building_area_sqft: data.project.building_area_sqft
          }])
          .select()
          .single();

        if (projectError || !newProject) {
          throw new Error('Failed to create project');
        }

        const projectId = newProject.id;

        // Create ID mappings for relationships
        const panelIdMap = new Map<number, string>();
        const transformerIdMap = new Map<number, string>();

        // Import panels
        if (data.panels.length > 0) {
          const { data: newPanels, error: panelsError } = await supabase
            .from('panels')
            .insert(
              data.panels.map(p => ({
                ...p,
                project_id: projectId
              }))
            )
            .select();

          if (panelsError) throw new Error('Failed to import panels');

          // Build panel ID mapping
          newPanels?.forEach((panel, index) => {
            panelIdMap.set(index, panel.id);
          });
        }

        // Import transformers
        if (data.transformers.length > 0) {
          const { data: newTransformers, error: transformersError } = await supabase
            .from('transformers')
            .insert(
              data.transformers.map(t => ({
                ...t,
                project_id: projectId
              }))
            )
            .select();

          if (transformersError) throw new Error('Failed to import transformers');

          newTransformers?.forEach((transformer, index) => {
            transformerIdMap.set(index, transformer.id);
          });
        }

        // Import circuits (map panel IDs)
        if (data.circuits.length > 0) {
          const { error: circuitsError } = await supabase
            .from('circuits')
            .insert(
              data.circuits.map(c => ({
                ...c,
                project_id: projectId,
                panel_id: panelIdMap.get(0) // Assign to first panel (simplified)
              }))
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
              }))
            );

          if (feedersError) console.warn('Some feeders failed to import');
        }

        // Import RFIs (optional)
        if (data.rfis && data.rfis.length > 0) {
          await supabase.from('rfis').insert(
            data.rfis.map(r => ({ ...r, project_id: projectId }))
          );
        }

        // Import site visits (optional)
        if (data.siteVisits && data.siteVisits.length > 0) {
          await supabase.from('site_visits').insert(
            data.siteVisits.map(v => ({ ...v, project_id: projectId }))
          );
        }

        // Import calendar events (optional)
        if (data.calendarEvents && data.calendarEvents.length > 0) {
          await supabase.from('calendar_events').insert(
            data.calendarEvents.map(e => ({ ...e, project_id: projectId }))
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
