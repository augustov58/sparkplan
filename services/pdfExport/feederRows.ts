/**
 * Synthesized schedule rows for a panel's downstream feeds — one rule for
 * the permit packet and the Panel Schedule page's PDF exports (#228, #238).
 *
 * As the in-app schedule draws them (`PanelSchedule.tsx` breakerFedPanels /
 * lugFedPanels): a panel fed from a breaker (`fed_from_circuit_number`) is a
 * row at that slot; any other panel — and every transformer — is on feed-thru
 * lugs: slot 0 keeps it out of the breaker grid while its load stays in the
 * phase totals, and the schedule lists it under FEED-THRU LUGS. The load is
 * the downstream panel's NEC 220 aggregate demand.
 *
 * Pure: no DB, no hooks.
 */
import type { Panel, Circuit, Transformer } from '../../lib/database.types';
import { calculateAggregatedLoad, type DwellingAggregateOptions } from '../calculations/upstreamLoadAggregation';
import type { NecEdition } from '../../data/nec/evse-load';
import { SYNTH_FEEDER_PREFIX, SYNTH_LUG_PREFIX } from './PanelScheduleDocuments';

export interface FeederRowContext {
  panels: Panel[];
  circuits: Circuit[];
  transformers: Transformer[];
  occupancy: 'dwelling' | 'commercial' | 'industrial';
  necEdition: NecEdition;
  dwelling?: DwellingAggregateOptions;
  /** Transformer feeds as lug rows (the exports). The packet lists panels only. */
  includeTransformers?: boolean;
}

export function feederRowsFor(panel: Panel, existing: Circuit[], ctx: FeederRowContext): Circuit[] {
  const demandVA = (panelId: string) => calculateAggregatedLoad(
    panelId, ctx.panels, ctx.circuits, ctx.transformers, ctx.occupancy, undefined, ctx.necEdition, ctx.dwelling,
  ).totalDemandVA;
  // A feeder the user drew as a real circuit at the fed-from slot isn't repeated
  const realSlots = new Set(existing.map(c => c.circuit_number));
  const row = (id: string, circuitNumber: number, description: string, pole: number, breakerAmps: number, loadVA: number, loadType: string) => ({
    id,
    project_id: panel.project_id,
    panel_id: panel.id,
    circuit_number: circuitNumber,
    description,
    breaker_amps: breakerAmps,
    pole,
    load_watts: loadVA,
    load_type: loadType,
    conductor_size: null,
    conductor_type: null,
    conductor_material: null,
    feeder_id: null,
    is_continuous_load: null,
    is_proposed: false,
    notes: 'Synthesized feeder row — represents downstream demand (NEC 408)',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }) as unknown as Circuit;

  const panelRows = ctx.panels
    .filter(p => p.fed_from_type === 'panel' && p.fed_from === panel.id)
    .flatMap(dp => {
      const fedFromSlot = dp.fed_from_circuit_number;
      if (typeof fedFromSlot === 'number' && realSlots.has(fedFromSlot)) return [];
      const lugFed = typeof fedFromSlot !== 'number';
      return [row(
        `${lugFed ? SYNTH_LUG_PREFIX : SYNTH_FEEDER_PREFIX}${panel.id}-${dp.id}`,
        lugFed ? 0 : fedFromSlot,
        `→ PANEL ${dp.name}`,
        dp.phase === 3 ? 3 : 2,
        dp.feeder_breaker_amps || dp.main_breaker_amps || 100,
        demandVA(dp.id),
        'O',
      )];
    });
  if (!ctx.includeTransformers) return panelRows;

  const transformerRows = ctx.transformers
    .filter(t => t.fed_from_panel_id === panel.id)
    .map(t => {
      const fed = ctx.panels.filter(p => p.fed_from_transformer_id === t.id);
      const loadVA = fed.length > 0
        ? fed.reduce((sum, p) => sum + demandVA(p.id), 0)
        : (t.kva_rating || 0) * 1000;
      const divisor = (panel.voltage || 480) * (panel.phase === 3 ? Math.sqrt(3) : 1);
      return row(
        `${SYNTH_LUG_PREFIX}${panel.id}-xfmr-${t.id}`,
        0,
        `→ XFMR ${t.name || `${t.kva_rating}kVA`}`,
        panel.phase === 3 ? 3 : 2,
        Math.ceil(loadVA / divisor) || 100,
        loadVA,
        'M',
      );
    });
  return [...panelRows, ...transformerRows];
}
