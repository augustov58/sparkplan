/**
 * #249: a 150 kW DC fast charger is 150,000 VA in every calc, so its circuit
 * is sized from that load (625.41, 125%, PE ruling 2026-10-14):
 * 150,000 / (480 × √3) = 180.4 A → 225.5 A → 250 A (next standard size), and a
 * conductor rated for the breaker, as the Level 2 override sizes: 250 kcmil Cu
 * (255 A at 75 °C). It was a fixed 225 A breaker on 3/0 Cu (200 A).
 */
import { describe, it, expect } from 'vitest';
import { generateCustomEVPanel, EV_PANEL_TEMPLATES, type ChargerTypeOption } from '../data/ev-panel-templates';
import { findConductorByAmpacity, terminationTempC } from '../data/nec/table-310-16';

const chargers = (chargerType: ChargerTypeOption) =>
  generateCustomEVPanel({
    projectId: 'p',
    config: { chargerType, numberOfChargers: 2, useEVEMS: false, includeSpare: false, includeLighting: false },
  }).circuits.filter(c => c.isEvCharger);

describe('#249 DC fast charger circuit sizing', () => {
  it('EV Panel Builder: 250 A breaker, 250 kcmil Cu, 180.4 A', () => {
    for (const c of chargers('DC Fast Charge (150kW)')) {
      expect(c.loadVA).toBe(150_000);
      expect(c.evChargerAmps).toBe(180.4);
      expect(c.breakerAmps).toBe(250);
      expect(c.conductorSize).toBe('250 kcmil Cu');
    }
  });

  it('every charger type: breaker ≥ 125% of the charger current, conductor rated for the breaker', () => {
    for (const type of ['Level 2 (48A)', 'Level 2 (80A)', 'DC Fast Charge (150kW)'] as ChargerTypeOption[]) {
      for (const c of chargers(type)) {
        expect(c.breakerAmps).toBeGreaterThanOrEqual(c.evChargerAmps! * 1.25);
        // 110.14(C)(1) column: 60 °C up to 100 A, 75 °C above (#271)
        const rated = findConductorByAmpacity(c.breakerAmps, 'Cu', terminationTempC(c.breakerAmps))!;
        expect(c.conductorSize).toBe(`${rated.size} Cu`);
      }
    }
  });

  it('Level 2 sizes at 60 °C (#271): 60 A / 4 AWG, 100 A / 1 AWG', () => {
    expect(chargers('Level 2 (48A)')[0]).toMatchObject({ breakerAmps: 60, conductorSize: '4 AWG Cu' });   // 6 AWG is 55 A at 60 °C
    expect(chargers('Level 2 (80A)')[0]).toMatchObject({ breakerAmps: 100, conductorSize: '1 AWG Cu' });  // 2 AWG is 95 A
  });

  it('the premade "2× DC Fast Chargers" template matches the builder', () => {
    const dc = EV_PANEL_TEMPLATES.flatMap(t => t.circuits).filter(c => c.isEvCharger && c.voltage === 480);
    expect(dc).toHaveLength(2);
    for (const c of dc) {
      expect(c).toMatchObject({ breakerAmps: 250, conductorSize: '250 kcmil Cu', evChargerAmps: 180.4, loadVA: 150_000 });
    }
  });
});
