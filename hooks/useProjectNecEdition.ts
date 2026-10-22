import { useMemo } from 'react';
import type { ProjectSettings } from '../types';
import { useJurisdictions } from './useJurisdictions';
import { projectNecEdition } from '../data/ahj/codeCycle';
import type { NecEdition } from '../data/nec/evse-load';

/**
 * NEC edition a project is designed under: the project-page pick, else
 * Automatic (Florida's code cycle by date; a non-Florida jurisdiction's own
 * edition). Same resolution as the permit packet, so in-app calculations
 * match the printed citations.
 */
export function useProjectNecEdition(
  project: { settings?: Pick<ProjectSettings, 'nec_edition_override'> | null; jurisdiction_id?: string | null } | null | undefined,
): NecEdition {
  const { getJurisdictionById } = useJurisdictions();
  const override = project?.settings?.nec_edition_override;
  const jurisdictionId = project?.jurisdiction_id;
  return useMemo(() => {
    const jurisdiction = jurisdictionId ? getJurisdictionById(jurisdictionId) : undefined;
    return projectNecEdition({ settings: { nec_edition_override: override } }, jurisdiction);
  }, [override, jurisdictionId, getJurisdictionById]);
}
