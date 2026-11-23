/**
 * #294 (owner ruling 2026-11-22, b): the panel templates' circuits carry their
 * own load and are code-legal on their breaker by the #280 rule (Table 310.16
 * Cu at 60 °C for ≤ 100 A, 75 °C above; 240.4(B)/(D)). Eight rows had a
 * conductor smaller than their stored load; they now carry what their breaker
 * serves continuously (breaker ÷ 1.25; the transformer at its 75 kVA rating),
 * with 1 AWG on the three 100 A rows and 3 AWG on the 80 A row.
 * Expected values: the issue's Acceptance section (hand-calculated).
 */
import { describe, it, expect } from 'vitest';
import { getAllTemplates } from '../data/project-templates';
import { conductorCodeLegal } from '../data/nec/table-310-16';

const all = Object.values(getAllTemplates()).flat();
const circuits = all.flatMap((t) => t.panels.flatMap((p) => p.circuits.map((c) => ({ template: t.name, panel: p, c }))));

/** Line current: 3-pole on a 3Φ panel I = W ÷ (√3·V); 2-pole I = W ÷ V; 1-pole I = W ÷ 120 (≥ 208 V panel) or ÷ V. */
function amps(panel: { voltage: number; phase: number }, pole: number, watts: number) {
  if (pole === 3) return watts / (Math.sqrt(3) * panel.voltage);
  if (pole === 2) return watts / panel.voltage;
  return watts / (panel.voltage >= 208 ? 120 : panel.voltage);
}

describe('#294 every template circuit carries its load and is legal on its breaker', () => {
  it('checks all 51 circuits', () => {
    expect(circuits).toHaveLength(51);
    const failures = circuits.flatMap(({ template, panel, c }) => {
      const check = conductorCodeLegal({
        conductor: c.conductor_size, material: 'Cu', breakerAmps: c.breaker_amps,
        loadAmps: amps(panel, c.pole, c.load_watts),
      });
      return check.legal ? [] : [`${template} / ${c.description}: ${check.reasons.join('; ')}`];
    });
    expect(failures).toEqual([]);
  });

  it.each([
    ['Retail Store (2500 sq ft)', 'Sales Floor Lighting Zone 1', 1920, '12 AWG'],
    ['Retail Store (2500 sq ft)', 'Sales Floor Lighting Zone 2', 1920, '12 AWG'],
    ['Office Building (5000 sq ft)', 'Transformer 1 (75 kVA)', 75000, '1 AWG'],
    ['Office Building (5000 sq ft)', 'Chiller (100A)', 66500, '1 AWG'],
    ['Small Workshop/Light Manufacturing', 'CNC Mill (60A)', 39900, '6 AWG'],
    ['Small Workshop/Light Manufacturing', 'CNC Lathe (60A)', 39900, '6 AWG'],
    ['Small Workshop/Light Manufacturing', 'Compressor (100A)', 66500, '1 AWG'],
    ['Small Workshop/Light Manufacturing', 'HVAC Unit (80A)', 53200, '3 AWG'],
  ])('%s → %s: %i W, %s', (template, description, watts, conductor) => {
    const row = circuits.find((r) => r.template === template && r.c.description === description)!;
    expect(row.c.load_watts).toBe(watts);
    expect(row.c.conductor_size).toBe(conductor);
  });

  it('the loads sit at or under the breaker ÷ 1.25: 100 A → 80.0 A, 80 A → 64.0 A, 60 A → 48.0 A, 20 A → 16.0 A', () => {
    const office = all.find((t) => t.name === 'Office Building (5000 sq ft)')!.panels[0];
    expect(amps(office, 3, 66500)).toBeCloseTo(79.99, 2);
    expect(amps(office, 3, 53200)).toBeCloseTo(63.99, 2);
    expect(amps(office, 3, 39900)).toBeCloseTo(47.99, 2);
    expect(1920 / 120).toBe(16);
  });
});
