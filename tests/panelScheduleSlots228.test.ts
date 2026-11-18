/**
 * #228: the panel schedule PDF drew a multi-pole circuit only at its first
 * slot (a 2-pole at 13 left 15 blank), and counted the packet's synthesized
 * feeder rows as circuits (E-301 "19" vs the app's 18). Values: "QA SF
 * subpanel" (the issue's Acceptance section).
 */
import { describe, it, expect } from 'vitest';
import {
  slotCircuit, circuitCountLabel, SYNTH_FEEDER_PREFIX, SYNTH_LUG_PREFIX,
} from '../services/pdfExport/PanelScheduleDocuments';
import type { Database } from '../lib/database.types';

type Circuit = Database['public']['Tables']['circuits']['Row'];
const c = (id: string, circuit_number: number, pole: number) =>
  ({ id, circuit_number, pole, description: id, load_watts: 1_000 }) as unknown as Circuit;

describe('#228 slotCircuit', () => {
  const range = c('range', 13, 2);
  const threePole = c('rtu', 2, 3);
  const lug = c(`${SYNTH_LUG_PREFIX}mdp-garage`, 0, 2);
  const circuits = [range, threePole, lug, c('dw', 21, 1)];

  it('finds the circuit that starts in a slot', () => {
    expect(slotCircuit(circuits, 13)).toEqual({ circuit: range });
    expect(slotCircuit(circuits, 21).circuit?.id).toBe('dw');
  });
  it('marks the later poles of a multi-pole circuit', () => {
    expect(slotCircuit(circuits, 15)).toEqual({ continuationOf: range }); // was blank
    expect(slotCircuit(circuits, 4)).toEqual({ continuationOf: threePole });
    expect(slotCircuit(circuits, 6)).toEqual({ continuationOf: threePole });
    expect(slotCircuit(circuits, 8)).toEqual({ continuationOf: undefined }); // past its 3 poles
    expect(slotCircuit(circuits, 17)).toEqual({ continuationOf: undefined }); // past the 2-pole
  });
  it('never puts a feed-thru lug (slot 0) in the grid', () => {
    for (const slot of [1, 2, 3, 4]) expect(slotCircuit([lug], slot)).toEqual({ continuationOf: undefined });
  });
});

describe('#228 circuitCountLabel', () => {
  const branch = Array.from({ length: 18 }, (_, i) => c(`b${i}`, i + 1, 1));
  it('counts branch circuits as the app does, feeders apart', () => {
    expect(circuitCountLabel(branch)).toBe('18');
    expect(circuitCountLabel([...branch, c(`${SYNTH_LUG_PREFIX}x`, 0, 2)])).toBe('18 (+1 feeder)'); // was 19
    expect(circuitCountLabel([c(`${SYNTH_FEEDER_PREFIX}a`, 1, 2), c(`${SYNTH_LUG_PREFIX}b`, 0, 2)])).toBe('0 (+2 feeders)');
  });
});
