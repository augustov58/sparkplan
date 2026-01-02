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
    necEdition: dbProject.nec_edition,
    status: dbProject.status as any,
    progress: dbProject.progress,
    serviceVoltage: dbProject.service_voltage,
    servicePhase: dbProject.service_phase,
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
  return {
    name: project.name || 'Untitled Project',
    address: project.address || 'TBD',
    type: project.type || 'Residential',
    nec_edition: project.necEdition || '2023',
    status: project.status || 'Planning',
    progress: project.progress || 0,
    service_voltage: project.serviceVoltage || 120,
    service_phase: (project.servicePhase || 1) as 1 | 3,
    settings: project.settings || {
      serviceVoltage: project.serviceVoltage || 120,
      servicePhase: project.servicePhase || 1,
      conductorMaterial: 'Cu',
      temperatureRating: 75
    }
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
    settings: project.settings,
    jurisdiction_id: project.jurisdiction_id  // BUGFIX: Include jurisdiction_id
  };
}
