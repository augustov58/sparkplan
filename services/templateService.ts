/**
 * Template Service
 * Applies project templates by creating panels and circuits
 */

import type { ProjectTemplate } from '../data/project-templates';
import { supabase } from '../lib/supabase';

/**
 * Apply template to a project
 * Creates panels and circuits based on template configuration
 */
export async function applyTemplate(
  projectId: string,
  template: ProjectTemplate
): Promise<void> {
  try {
    console.log(`Applying template "${template.name}" to project ${projectId}`);

    // Create panels first
    for (const panelTemplate of template.panels) {
      const { data: panel, error: panelError } = await supabase
        .from('panels')
        .insert({
          project_id: projectId,
          name: panelTemplate.name,
          bus_rating: panelTemplate.bus_rating,
          voltage: panelTemplate.voltage,
          phase: panelTemplate.phase,
          main_breaker_amps: panelTemplate.main_breaker_amps,
          location: panelTemplate.location,
          is_main: panelTemplate.is_main,
          fed_from_type: panelTemplate.is_main ? 'service' : 'panel',
        })
        .select()
        .single();

      if (panelError) {
        console.error('Error creating panel:', panelError);
        throw new Error(`Failed to create panel: ${panelError.message}`);
      }

      if (!panel) {
        throw new Error('Panel created but no data returned');
      }

      console.log(`Created panel: ${panel.name} (${panel.id})`);

      // Create circuits for this panel
      const circuitInserts = panelTemplate.circuits.map((circuitTemplate) => ({
        project_id: projectId,
        panel_id: panel.id,
        circuit_number: circuitTemplate.circuit_number,
        description: circuitTemplate.description,
        breaker_amps: circuitTemplate.breaker_amps,
        pole: circuitTemplate.pole,
        load_watts: circuitTemplate.load_watts,
        conductor_size: circuitTemplate.conductor_size,
        egc_size: circuitTemplate.egc_size || null,
      }));

      if (circuitInserts.length > 0) {
        const { error: circuitsError } = await supabase
          .from('circuits')
          .insert(circuitInserts);

        if (circuitsError) {
          console.error('Error creating circuits:', circuitsError);
          throw new Error(`Failed to create circuits: ${circuitsError.message}`);
        }

        console.log(`Created ${circuitInserts.length} circuits for panel ${panel.name}`);
      }
    }

    console.log(`Template "${template.name}" applied successfully`);
  } catch (error) {
    console.error('Error applying template:', error);
    throw error;
  }
}
