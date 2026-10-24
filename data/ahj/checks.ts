/**
 * Shared AHJ predicates and the project facts behind them.
 *
 * #148: EV / EVEMS / transformer requirements and notes apply only when the
 * job has that equipment. #140: a requirement is satisfied by what the
 * packet contains, not by a section toggle or a page that only cites it.
 */
import type { Circuit } from '../../lib/database.types';
import { isEVEMSMarkerCircuit } from '../../services/calculations/upstreamLoadAggregation';
import { isEvseDescription } from '../nec/evse-load';
import type { AHJContext, AttachmentSummary, PacketAST, ServiceModificationType } from './types';

/** Project's `service_modification_type` → the manifest scope axis. 'service-upgrade' keeps the existing service. */
export function serviceScope(raw: string | null | undefined): ServiceModificationType {
  return raw === 'new-service' ? 'new-service' : 'existing-service';
}

/**
 * AHJContext equipment flags. `hasEvAnalysis`: a saved Multi-Family EV
 * analysis puts EV in scope before the charger circuits exist.
 */
export function ahjEquipmentFlags(
  circuits: Pick<Circuit, 'description'>[],
  transformerCount: number,
  hasEvAnalysis = false,
): Pick<AHJContext, 'hasEV' | 'hasEVEMS' | 'hasTransformer'> {
  const hasEVEMS = circuits.some(isEVEMSMarkerCircuit);
  return {
    hasEV: hasEVEMS || hasEvAnalysis || circuits.some((c) => isEvseDescription(c.description)),
    hasEVEMS,
    hasTransformer: transformerCount > 0,
  };
}

export const evInScope = (ctx: AHJContext): boolean => ctx?.hasEV !== false;
export const evemsInScope = (ctx: AHJContext): boolean => ctx?.hasEVEMS !== false;
export const transformerInScope = (ctx: AHJContext): boolean => ctx?.hasTransformer !== false;

/** A cut sheet / manufacturer data upload: the specs sheet's UL citations are not one. */
export const hasCutSheetUpload = (_packet: PacketAST, attachments: AttachmentSummary[]): boolean =>
  attachments.some((a) => a.artifactType === 'cut_sheet' || a.artifactType === 'manufacturer_data');

export const specsCitedOnly = (packet: PacketAST): string | null =>
  packet.sectionKeys?.includes('equipmentSpecs')
    ? 'listings cited on the equipment specs sheet; manufacturer cut sheet not attached'
    : null;

/** One-line with AIC per node (and conductors, when `conductors`). */
export const labeledOneLine = (conductors: boolean) => (packet: PacketAST): boolean =>
  !!packet.sectionKeys?.includes('riserDiagram') && packet.riserAIC === true
  && (!conductors || packet.riserConductors === true);

export const oneLineMissingLabels = (conductors: boolean) => (packet: PacketAST): string | null => {
  if (!packet.sectionKeys?.includes('riserDiagram')) return null;
  const missing = [
    ...(conductors && packet.riserConductors !== true ? ['feeder conductor sizes'] : []),
    ...(packet.riserAIC !== true ? ['panel AIC ratings'] : []),
  ];
  return missing.length ? `one-line present; ${missing.join(' and ')} missing` : null;
};
