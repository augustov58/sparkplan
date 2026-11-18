/**
 * #224: the EV Panel Builder inserted the template's camelCase circuit shape
 * (`breakerAmps`, `loadVA`, …), so every circuit insert failed and an empty
 * panel was left behind. `templateCircuitRow` maps it to the `circuits`
 * columns; with EVEMS the Builder writes an explicit setpoint marker.
 */
import { describe, it, expect } from 'vitest';
import { generateCustomEVPanel, templateCircuitRow } from '../data/ev-panel-templates';
import type { Database } from '../lib/database.types';

type CircuitInsert = Database['public']['Tables']['circuits']['Insert'];

describe('EV Panel Builder rows (#224)', () => {
  const { circuits } = generateCustomEVPanel({
    projectId: 'p',
    config: { chargerType: 'Level 2 (48A)', numberOfChargers: 4, useEVEMS: false, includeSpare: true, includeLighting: true },
  });

  it('maps every template circuit to circuits columns (a wrong key fails tsc here)', () => {
    const rows: CircuitInsert[] = circuits.map(c => templateCircuitRow(c, 'panel-1', 'p'));
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({
      panel_id: 'panel-1', project_id: 'p', circuit_number: 1, description: 'EV Charger #1 - Level 2 (48A)',
      breaker_amps: 60, pole: 2, load_watts: 11_520, conductor_size: expect.any(String), is_proposed: true,
    });
    for (const row of rows) {
      expect(Object.keys(row).some(k => /[A-Z]/.test(k))).toBe(false); // no camelCase column
    }
    expect(rows.map(r => r.description)).toEqual(expect.arrayContaining(['Spare Circuit', 'Lighting Circuit']));
    expect(rows.find(r => r.description === 'Lighting Circuit')?.load_watts).toBe(1_800);
  });

  it('with EVEMS and a setpoint, the template writes the explicit NEC 625.42 marker', () => {
    const t = generateCustomEVPanel({
      projectId: 'p',
      config: { chargerType: 'Level 2 (48A)', numberOfChargers: 4, useEVEMS: true, simultaneousChargers: 2, evemsSetpointVA: 2 * 11_520, includeSpare: true, includeLighting: true },
    });
    const marker = t.circuits.find(c => c.description.startsWith('EVEMS'));
    expect(marker).toMatchObject({ description: 'EVEMS Aggregate Setpoint (NEC 625.42)', loadVA: 23_040 });
  });
});
