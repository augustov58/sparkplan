/**
 * #230: the EV Panel Builder's template codes its lighting circuit as
 * lighting (1-pole, 'L'; it was a 2-pole row with the column default 'O') and
 * puts the hidden EVEMS setpoint marker after the real circuits (it sat at
 * slots 10/12, which looked empty between real circuits).
 */
import { describe, it, expect } from 'vitest';
import { generateCustomEVPanel, templateCircuitRow } from '../data/ev-panel-templates';

const build = (useEVEMS: boolean) => generateCustomEVPanel({
  projectId: 'p',
  config: {
    chargerType: 'Level 2 (48A)', numberOfChargers: 4, useEVEMS, includeSpare: true, includeLighting: true,
    ...(useEVEMS ? { simultaneousChargers: 3, evemsSetpointVA: 3 * 11_520 } : {}),
  },
}).circuits.map(c => templateCircuitRow(c, 'panel', 'p'));

describe('#230 EV Panel Builder template', () => {
  it('codes the lighting circuit as a 1-pole lighting load', () => {
    const lighting = build(false).find(r => r.description === 'Lighting Circuit');
    expect(lighting).toMatchObject({ pole: 1, load_type: 'L', load_watts: 1_800 });
    expect(build(false).filter(r => r.description.startsWith('EV Charger')).every(r => r.load_type === 'O')).toBe(true);
  });

  it('puts the setpoint marker after the real circuits', () => {
    const rows = build(true);
    const slot = (d: string) => rows.find(r => r.description === d)?.circuit_number;
    expect([slot('Spare Circuit'), slot('Lighting Circuit'), slot('EVEMS Aggregate Setpoint (NEC 625.42)')]).toEqual([10, 14, 16]);
    expect(rows.find(r => r.description === 'EVEMS Aggregate Setpoint (NEC 625.42)')?.load_watts).toBe(34_560);
  });
});
