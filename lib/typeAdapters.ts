/**
 * Type Adapters
 * Convert between database types (snake_case) and frontend types (camelCase)
 */

import type { Database } from './database.types';
import type { Project } from '../types';

type DbProject = Database['public']['Tables']['projects']['Row'];
type DbProjectInsert = Database['public']['Tables']['projects']['Insert'];

/**
 * Convert database project to frontend project
 */
export function dbProjectToFrontend(dbProject: DbProject): Project {
  return {
    id: dbProject.id,
    name: dbProject.name,
    address: dbProject.address,
    type: dbProject.type as any,
    necEdition: dbProject.nec_edition as '2020' | '2023',
    status: dbProject.status as any,
    progress: dbProject.progress ?? 0,
    serviceVoltage: dbProject.service_voltage,
    servicePhase: dbProject.service_phase as 1 | 3,
    serviceAmps: dbProject.service_amps,
    utilityAvailableFaultCurrentA: dbProject.utility_available_fault_current_a,
    utilityTransformerKva: dbProject.utility_transformer_kva,
    utilityTransformerImpedancePct: dbProject.utility_transformer_impedance_pct,
    jurisdiction_id: dbProject.jurisdiction_id,  // BUGFIX: Include jurisdiction_id
    settings: (dbProject.settings as any) || {
      serviceVoltage: dbProject.service_voltage,
      servicePhase: dbProject.service_phase,
      conductorMaterial: 'Cu',
      temperatureRating: 75
    },
    loads: [],
    circuits: [],
    issues: [],
    inspectionList: [],
    grounding: {
      electrodes: [],
      gecSize: '6 AWG',
      bonding: [],
      notes: ''
    }
  };
}

/**
 * Convert frontend project to database insert
 */
export function frontendProjectToDbInsert(project: Partial<Project>): Omit<DbProjectInsert, 'id' | 'user_id'> {
  // PR-2 Polish B (2026-05-26): defense-in-depth default for
  // service_modification_type. PR-2 Step 1 coerces null/undefined to
  // 'existing' at the packet generator, but writing the explicit default
  // at INSERT time means future projects never have a NULL in the column
  // — UI display, AHJ-visibility predicates, and downstream consumers all
  // see a deterministic value from creation. Matches the UI default at
  // ProjectSetup.tsx:286 (`value={... ?? 'existing'}`).
  const baseSettings = (project.settings as any) || {
    serviceVoltage: project.serviceVoltage || 120,
    servicePhase: project.servicePhase || 1,
    conductorMaterial: 'Cu',
    temperatureRating: 75,
  };
  const settingsWithDefault = {
    ...baseSettings,
    service_modification_type:
      baseSettings.service_modification_type ?? 'existing',
  };

  return {
    name: project.name || 'Untitled Project',
    address: project.address || 'TBD',
    type: project.type || 'Residential',
    nec_edition: project.necEdition || '2023',
    status: project.status || 'Planning',
    progress: project.progress || 0,
    service_voltage: project.serviceVoltage || 120,
    service_phase: (project.servicePhase || 1) as 1 | 3,
    settings: settingsWithDefault,
  };
}

/**
 * Convert frontend project to database update
 */
export function frontendProjectToDbUpdate(project: Project): Database['public']['Tables']['projects']['Update'] {
  return {
    name: project.name,
    address: project.address,
    type: project.type,
    nec_edition: project.necEdition,
    status: project.status,
    progress: project.progress,
    service_voltage: project.serviceVoltage,
    service_phase: project.servicePhase,
    service_amps: project.serviceAmps,
    utility_available_fault_current_a: project.utilityAvailableFaultCurrentA,
    utility_transformer_kva: project.utilityTransformerKva,
    utility_transformer_impedance_pct: project.utilityTransformerImpedancePct,
    settings: project.settings as any,
    jurisdiction_id: project.jurisdiction_id  // BUGFIX: Include jurisdiction_id
  };
}
