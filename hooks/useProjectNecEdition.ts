import { useMemo } from 'react';
import type { Project } from '../types';
import { useJurisdictions } from './useJurisdictions';
import {
  findManifestForJurisdiction,
  getManifestById,
  resolveNecEdition,
} from '../data/ahj/registry';
import type { BuildingType } from '../data/ahj/types';
import type { NecEdition } from '../data/nec/evse-load';

/**
 * NEC edition a project is designed under: AHJ manifest (template pick or
 * jurisdiction match) → project `necEdition` → '2020'. Same resolution as the
 * permit packet, so in-app calculations match the printed citations.
 */
export function useProjectNecEdition(
  project: Project | null | undefined,
  buildingType: BuildingType,
): NecEdition {
  const { getJurisdictionById } = useJurisdictions();
  return useMemo(() => {
    const jurisdiction = project?.jurisdiction_id
      ? getJurisdictionById(project.jurisdiction_id)
      : undefined;
    const manifest =
      getManifestById(project?.settings?.manifest_template_id)
      ?? findManifestForJurisdiction(jurisdiction);
    return resolveNecEdition(manifest, buildingType, project?.necEdition);
  }, [project?.jurisdiction_id, project?.settings?.manifest_template_id, project?.necEdition, buildingType, getJurisdictionById]);
}
