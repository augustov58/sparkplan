/**
 * Equipment Dependency Lookups
 *
 * Pure helpers that answer "what downstream equipment depends on this node?"
 * Used by OneLineDiagram remove handlers to block deletion of mid-tree nodes
 * and prompt the user to delete downstream branches first — the alternative
 * is a DB-level SET NULL that silently orphans panels (they persist in the DB
 * with fed_from=null and disappear from the tree-layout SVG).
 *
 * Dependency edges (from panels_fed_from_check + FK map):
 *   panel       → panels.fed_from, transformers.fed_from_panel_id
 *   transformer → panels.fed_from_transformer_id
 *   meter_stack → panels.fed_from_meter_stack_id
 */

import type { Database } from '@/lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

export interface DownstreamDependency {
  kind: 'panel' | 'transformer';
  id: string;
  name: string;
}

export function getPanelDownstream(
  panelId: string,
  state: { panels: Panel[]; transformers: Transformer[] }
): DownstreamDependency[] {
  const childPanels = state.panels
    .filter(p => p.fed_from === panelId)
    .map<DownstreamDependency>(p => ({ kind: 'panel', id: p.id, name: p.name }));

  const childTransformers = state.transformers
    .filter(t => t.fed_from_panel_id === panelId)
    .map<DownstreamDependency>(t => ({ kind: 'transformer', id: t.id, name: t.name }));

  return [...childPanels, ...childTransformers];
}

export function getTransformerDownstream(
  transformerId: string,
  state: { panels: Panel[] }
): DownstreamDependency[] {
  return state.panels
    .filter(p => p.fed_from_transformer_id === transformerId)
    .map(p => ({ kind: 'panel', id: p.id, name: p.name }));
}

export function getMeterStackDownstream(
  meterStackId: string,
  state: { panels: Panel[] }
): DownstreamDependency[] {
  return state.panels
    .filter(p => p.fed_from_meter_stack_id === meterStackId)
    .map(p => ({ kind: 'panel', id: p.id, name: p.name }));
}

export function formatDependencyMessage(
  parentName: string,
  deps: DownstreamDependency[]
): string {
  const panelNames = deps.filter(d => d.kind === 'panel').map(d => d.name);
  const xfmrNames = deps.filter(d => d.kind === 'transformer').map(d => d.name);

  const parts: string[] = [];
  if (panelNames.length > 0) {
    parts.push(`${panelNames.length} panel${panelNames.length === 1 ? '' : 's'}: ${panelNames.join(', ')}`);
  }
  if (xfmrNames.length > 0) {
    parts.push(`${xfmrNames.length} transformer${xfmrNames.length === 1 ? '' : 's'}: ${xfmrNames.join(', ')}`);
  }

  return (
    `Cannot delete "${parentName}" — downstream equipment still depends on it:\n\n` +
    parts.map(p => `  • ${p}`).join('\n') +
    `\n\nDelete the downstream branches first, starting from the leaves.`
  );
}
