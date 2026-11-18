/**
 * #238 / #228: one rule for a panel's downstream feeds as schedule rows, for
 * the packet and both Panel Schedule exports: a breaker-fed panel at its
 * `fed_from_circuit_number`, a lug-fed panel at slot 0 (listed under
 * FEED-THRU LUGS), a real circuit at the fed-from slot not repeated, and
 * transformers as lug rows when asked.
 */
import { describe, it, expect } from 'vitest';
import { feederRowsFor } from '../services/pdfExport/feederRows';
import { SYNTH_FEEDER_PREFIX, SYNTH_LUG_PREFIX } from '../services/pdfExport/PanelScheduleDocuments';
import type { Database } from '../lib/database.types';

type Panel = Database['public']['Tables']['panels']['Row'];
type Circuit = Database['public']['Tables']['circuits']['Row'];
type Transformer = Database['public']['Tables']['transformers']['Row'];

const panel = (o: Partial<Panel> & Pick<Panel, 'id' | 'name'>): Panel => ({
  bus_rating: 200, main_breaker_amps: 200, voltage: 240, phase: 1, num_spaces: 42, project_id: 'p',
  is_main: false, fed_from: 'mdp', fed_from_type: 'panel', fed_from_transformer_id: null, fed_from_circuit_number: null, ...o,
} as unknown as Panel);
const circuit = (id: string, panel_id: string, circuit_number: number, load_watts: number): Circuit =>
  ({ id, panel_id, circuit_number, load_watts, description: 'Load', load_type: 'O', pole: 1, breaker_amps: 20, project_id: 'p' }) as unknown as Circuit;

const mdp = panel({ id: 'mdp', name: 'MDP', is_main: true, fed_from: null, fed_from_type: 'service', bus_rating: 400 });
const lugFed = panel({ id: 'a', name: 'Lug Panel' });
const breakerFed = panel({ id: 'b', name: 'Breaker Panel', fed_from_circuit_number: 7, feeder_breaker_amps: 60 } as Partial<Panel> & Pick<Panel, 'id' | 'name'>);
const xfmrPanel = panel({ id: 'x', name: 'Xfmr Panel', fed_from: null, fed_from_type: 'transformer', fed_from_transformer_id: 't1' });
const xfmr = { id: 't1', name: 'T1', kva_rating: 45, fed_from_panel_id: 'mdp' } as unknown as Transformer;
const panels = [mdp, lugFed, breakerFed, xfmrPanel];
const circuits = [circuit('c1', 'a', 1, 6_000), circuit('c2', 'b', 1, 3_000), circuit('c3', 'x', 1, 2_000)];
const ctx = { panels, circuits, transformers: [xfmr], occupancy: 'commercial' as const, necEdition: '2020' as const };

describe('#238 feederRowsFor', () => {
  it('a lug-fed panel at slot 0, a breaker-fed one at its own slot, each at its demand', () => {
    const rows = feederRowsFor(mdp, [], ctx);
    expect(rows.map(r => [r.id.startsWith(SYNTH_LUG_PREFIX) ? 'lug' : r.id.startsWith(SYNTH_FEEDER_PREFIX) ? 'breaker' : '?', r.circuit_number, r.description, r.load_watts]))
      .toEqual([
        ['lug', 0, '→ PANEL Lug Panel', 6_000],
        ['breaker', 7, '→ PANEL Breaker Panel', 3_000],
      ]);
    expect(rows.find(r => r.circuit_number === 7)?.breaker_amps).toBe(60);
  });

  it('does not repeat a feeder the user drew as a real circuit at the fed-from slot', () => {
    const rows = feederRowsFor(mdp, [circuit('real', 'mdp', 7, 3_000)], ctx);
    expect(rows.map(r => r.description)).toEqual(['→ PANEL Lug Panel']);
  });

  it('adds transformers as lug rows only when asked (exports yes, packet no)', () => {
    const withX = feederRowsFor(mdp, [], { ...ctx, includeTransformers: true });
    const x = withX.find(r => r.description === '→ XFMR T1');
    expect(x).toMatchObject({ circuit_number: 0, load_watts: 2_000 });
    expect(x?.id.startsWith(SYNTH_LUG_PREFIX)).toBe(true);
    expect(feederRowsFor(mdp, [], ctx).some(r => r.description.startsWith('→ XFMR'))).toBe(false);
  });
});
