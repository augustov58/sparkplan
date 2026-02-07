/**
 * Project Population Orchestrator
 *
 * Handles ordered database insertion of generated multi-family project entities.
 * Respects foreign key dependencies by inserting in the correct order and
 * replacing placeholder references with real database UUIDs.
 *
 * Insertion order:
 * 1. MDP panel → get real ID
 * 2. Meter Stack → get real ID, link to MDP
 * 3. Downstream panels (house, EV, unit) → set fed_from = MDP ID
 * 4. Meters → reference meter_stack.id + panel.id
 * 5. Circuits → reference panel.id
 * 6. Feeders → reference source/destination panel IDs
 *
 * @module services/autogeneration/projectPopulationOrchestrator
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { GeneratedProject } from './multiFamilyProjectGenerator';

type Panel = Database['public']['Tables']['panels']['Row'];
type MeterStack = Database['public']['Tables']['meter_stacks']['Row'];

export interface PopulationProgress {
  step: string;
  current: number;
  total: number;
}

export interface PopulationResult {
  success: boolean;
  error?: string;
  createdEntities: {
    mdpId: string;
    meterStackId: string;
    housePanelId: string;
    evPanelId: string;
    unitPanelIds: string[];
    meterIds: string[];
    circuitCount: number;
    feederCount: number;
  };
}

/**
 * Populate a project with generated multi-family entities.
 *
 * @param generated - Output from generateMultiFamilyProject()
 * @param onProgress - Optional callback for progress updates
 */
export async function populateProject(
  generated: GeneratedProject,
  onProgress?: (progress: PopulationProgress) => void
): Promise<PopulationResult> {
  const totalSteps = 6;
  let step = 0;

  const report = (stepName: string) => {
    step++;
    onProgress?.({ step: stepName, current: step, total: totalSteps });
  };

  try {
    // ================================================================
    // Step 1: Create MDP (insert as 'service' type to satisfy check constraint,
    // then update to 'meter_stack' after meter stack exists)
    // ================================================================
    report('Creating Main Distribution Panel...');

    const { data: mdp, error: mdpError } = await supabase
      .from('panels')
      .insert({ ...generated.mdp, fed_from_type: 'service' })
      .select()
      .single();

    if (mdpError || !mdp) {
      throw new Error(`Failed to create MDP: ${mdpError?.message || 'Unknown error'}`);
    }

    // ================================================================
    // Step 2: Create Meter Stack, link MDP to it
    // ================================================================
    report('Creating Meter Stack...');

    const { data: meterStack, error: msError } = await supabase
      .from('meter_stacks')
      .insert(generated.meterStack)
      .select()
      .single();

    if (msError || !meterStack) {
      throw new Error(`Failed to create meter stack: ${msError?.message || 'Unknown error'}`);
    }

    // Link MDP to meter stack and set correct fed_from_type
    const { error: linkError } = await supabase
      .from('panels')
      .update({
        fed_from_type: 'meter_stack',
        fed_from_meter_stack_id: meterStack.id,
      })
      .eq('id', mdp.id);

    if (linkError) {
      console.warn('Failed to link MDP to meter stack:', linkError.message);
    }

    // ================================================================
    // Step 3: Create downstream panels (house, EV, units)
    // ================================================================
    report('Creating sub-panels...');

    // House Panel
    const housePanelData = { ...generated.housePanel, fed_from: mdp.id };
    const { data: housePanel, error: hpError } = await supabase
      .from('panels')
      .insert(housePanelData)
      .select()
      .single();

    if (hpError || !housePanel) {
      throw new Error(`Failed to create house panel: ${hpError?.message || 'Unknown error'}`);
    }

    // EV Panel
    const evPanelData = { ...generated.evPanel, fed_from: mdp.id };
    const { data: evPanel, error: epError } = await supabase
      .from('panels')
      .insert(evPanelData)
      .select()
      .single();

    if (epError || !evPanel) {
      throw new Error(`Failed to create EV panel: ${epError?.message || 'Unknown error'}`);
    }

    // Unit Panels (batch insert)
    const unitPanelInserts = generated.unitPanels.map(p => ({
      ...p,
      fed_from: mdp.id,
    }));

    const unitPanelIds: string[] = [];
    // Insert in batches of 10 to avoid large payloads
    for (let i = 0; i < unitPanelInserts.length; i += 10) {
      const batch = unitPanelInserts.slice(i, i + 10);
      const { data: unitPanels, error: upError } = await supabase
        .from('panels')
        .insert(batch)
        .select();

      if (upError) {
        throw new Error(`Failed to create unit panels: ${upError.message}`);
      }

      unitPanelIds.push(...(unitPanels || []).map(p => p.id));
    }

    // ================================================================
    // Step 4: Create Meters
    // ================================================================
    report('Creating meters...');

    // Build panel ID lookup from meter references
    const meterInserts = generated.meters.map(m => {
      let panelId: string | null = null;
      if (m.panelRef === 'house') panelId = housePanel.id;
      else if (m.panelRef === 'ev') panelId = evPanel.id;
      else if (typeof m.panelRef === 'object' && 'unitIndex' in m.panelRef) {
        panelId = unitPanelIds[m.panelRef.unitIndex] || null;
      }

      return {
        project_id: generated.mdp.project_id,
        meter_stack_id: meterStack.id,
        name: m.name,
        meter_type: m.type,
        position_number: m.position,
        panel_id: panelId,
        breaker_amps: m.breakerAmps || null,
      };
    });

    const meterIds: string[] = [];
    for (let i = 0; i < meterInserts.length; i += 10) {
      const batch = meterInserts.slice(i, i + 10);
      const { data: meters, error: mError } = await supabase
        .from('meters')
        .insert(batch)
        .select();

      if (mError) {
        console.warn('Failed to create some meters:', mError.message);
      }
      meterIds.push(...(meters || []).map(m => m.id));
    }

    // ================================================================
    // Step 5: Create Circuits
    // ================================================================
    report('Creating circuits...');

    let circuitCount = 0;

    // House panel circuits
    if (generated.houseCircuits.length > 0) {
      const houseCircuitInserts = generated.houseCircuits.map(c => ({
        ...c,
        project_id: generated.mdp.project_id,
        panel_id: housePanel.id,
      }));
      const { error: hcError } = await supabase.from('circuits').insert(houseCircuitInserts);
      if (hcError) console.warn('Failed to create house circuits:', hcError.message);
      else circuitCount += houseCircuitInserts.length;
    }

    // EV panel circuits
    if (generated.evCircuits.length > 0) {
      const evCircuitInserts = generated.evCircuits.map(c => ({
        ...c,
        project_id: generated.mdp.project_id,
        panel_id: evPanel.id,
      }));
      const { error: ecError } = await supabase.from('circuits').insert(evCircuitInserts);
      if (ecError) console.warn('Failed to create EV circuits:', ecError.message);
      else circuitCount += evCircuitInserts.length;
    }

    // Unit panel circuits (batch by panel)
    for (const [unitIndex, circuits] of generated.unitCircuits) {
      const panelId = unitPanelIds[unitIndex];
      if (!panelId || circuits.length === 0) continue;

      const unitCircuitInserts = circuits.map(c => ({
        ...c,
        project_id: generated.mdp.project_id,
        panel_id: panelId,
      }));
      const { error: ucError } = await supabase.from('circuits').insert(unitCircuitInserts);
      if (ucError) console.warn(`Failed to create circuits for unit ${unitIndex}:`, ucError.message);
      else circuitCount += unitCircuitInserts.length;
    }

    // ================================================================
    // Step 6: Create Feeders
    // ================================================================
    report('Creating feeders...');

    let feederCount = 0;
    const feederInserts = generated.feeders.map(f => {
      let destPanelId: string | null = null;
      if (f.destRef === 'house') destPanelId = housePanel.id;
      else if (f.destRef === 'ev') destPanelId = evPanel.id;
      else if (typeof f.destRef === 'object' && 'unitIndex' in f.destRef) {
        destPanelId = unitPanelIds[f.destRef.unitIndex] || null;
      }

      return {
        project_id: generated.mdp.project_id,
        name: f.name,
        source_panel_id: mdp.id,
        destination_panel_id: destPanelId,
        distance_ft: f.distance_ft,
        conductor_material: 'Cu' as const,
      };
    }).filter(f => f.destination_panel_id !== null);

    if (feederInserts.length > 0) {
      for (let i = 0; i < feederInserts.length; i += 10) {
        const batch = feederInserts.slice(i, i + 10);
        const { error: fError } = await supabase.from('feeders').insert(batch);
        if (fError) console.warn('Failed to create some feeders:', fError.message);
        else feederCount += batch.length;
      }
    }

    return {
      success: true,
      createdEntities: {
        mdpId: mdp.id,
        meterStackId: meterStack.id,
        housePanelId: housePanel.id,
        evPanelId: evPanel.id,
        unitPanelIds,
        meterIds,
        circuitCount,
        feederCount,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to populate project',
      createdEntities: {
        mdpId: '',
        meterStackId: '',
        housePanelId: '',
        evPanelId: '',
        unitPanelIds: [],
        meterIds: [],
        circuitCount: 0,
        feederCount: 0,
      },
    };
  }
}

/**
 * Clear all electrical entities from a project before re-populating.
 * Deletes in FK-safe order: feeders → meters → meter_stacks → circuits → panels → transformers.
 */
export async function clearProjectElectricalData(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete in FK-safe order
    const tables = ['feeders', 'meters', 'meter_stacks', 'circuits', 'panels', 'transformers'] as const;

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('project_id', projectId);

      if (error) {
        throw new Error(`Failed to clear ${table}: ${error.message}`);
      }
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to clear project data',
    };
  }
}

/**
 * Check if a project already has panels (to warn before overwriting)
 */
export async function projectHasPanels(projectId: string): Promise<boolean> {
  const { count } = await supabase
    .from('panels')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);

  return (count || 0) > 0;
}
