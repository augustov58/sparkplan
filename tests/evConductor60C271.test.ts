/**
 * #271 (PE ruling 2026-11-20): EV branch circuits of 100 A or less size their
 * conductor from Table 310.16's 60 °C column (NEC 110.14(C)(1)(a)) in both EV
 * tools, with a note giving the smaller 75 °C conductor allowed when the
 * charger and breaker terminals are listed for 75 °C (110.14(C)(1)(a)(3)).
 *
 * Hand calcs (Table 310.16): Cu 60 °C 8 AWG 40, 6 AWG 55, 4 AWG 70, 2 AWG 95,
 * 1 AWG 110; Cu 75 °C 8 AWG 50, 6 AWG 65, 3 AWG 100. Al 60 °C 3 AWG 65; Al
 * 75 °C 4 AWG 65. 240.4(D): 14 Cu ≤ 15 A, 12 Cu ≤ 20 A, 12 Al ≤ 15 A,
 * 10 Al ≤ 25 A — so the 75 °C option never drops below those.
 */
import { describe, it, expect } from 'vitest';
import { terminationTempC, conductor75COption, findConductorByAmpacity } from '../data/nec/table-310-16';
import { calculateEVCharging } from '../services/calculations/evCharging';
import { generateCustomEVPanel, EV_PANEL_TEMPLATES, type ChargerTypeOption } from '../data/ev-panel-templates';

const evCalc = (chargerAmps: number, conductorMaterial: 'Cu' | 'Al' = 'Cu') =>
  calculateEVCharging({
    chargerLevel: 'Level2', chargerAmps, voltage: 240, phase: 1, numChargers: 1,
    simultaneousUse: 100, circuitLength_ft: 50, conductorMaterial, necEdition: '2020',
  } as Parameters<typeof calculateEVCharging>[0]);

const builderEv = (chargerType: ChargerTypeOption, chargerAmps?: number) =>
  generateCustomEVPanel({
    projectId: 'p',
    config: { chargerType, numberOfChargers: 1, useEVEMS: false, includeSpare: false, includeLighting: false, chargerAmps },
  }).circuits.find(c => c.isEvCharger)!;

describe('#271 EV conductors at 60 °C with the 75 °C option', () => {
  it('110.14(C)(1) column: 60 °C up to 100 A, 75 °C above', () => {
    expect(terminationTempC(100)).toBe(60);
    expect(terminationTempC(101)).toBe(75);
  });

  it('75 °C option: smaller size when the column allows it, never below 240.4(D)', () => {
    expect(conductor75COption(60, 'Cu')).toBe('6 AWG');   // 60 °C: 4 AWG
    expect(conductor75COption(100, 'Cu')).toBe('3 AWG');  // 60 °C: 1 AWG
    expect(conductor75COption(50, 'Cu')).toBe('8 AWG');   // 60 °C: 6 AWG
    expect(conductor75COption(60, 'Al')).toBe('4 AWG');   // 60 °C: 3 AWG
    expect(conductor75COption(40, 'Cu')).toBeNull();      // 8 AWG either way
    expect(conductor75COption(20, 'Cu')).toBeNull();      // 14 AWG is 20 A at 75 °C, but 240.4(D) caps it at 15 A
    expect(conductor75COption(25, 'Cu')).toBeNull();      // 12 AWG capped at 20 A → 10 AWG either way
    expect(conductor75COption(20, 'Al')).toBeNull();      // 12 AWG Al capped at 15 A
    expect(conductor75COption(250, 'Cu')).toBeNull();     // above 100 A: already 75 °C
  });

  it('EV Charging calculator: 48 A → 60 A, 4 AWG Cu, note 6 AWG Cu', () => {
    const r = evCalc(48);
    expect(r.circuitBreakerAmps).toBe(60);
    expect(r.conductorSize).toBe('4 AWG');
    expect(r.conductor75COption).toBe('6 AWG');
    expect(r.notes.join(' ')).toContain('6 AWG Cu is allowed if the charger and breaker terminals are both listed for 75 °C');
    expect(r.necReferences.join(' ')).toContain('110.14(C)(1)(a)');
  });

  it('EV Charging calculator, aluminum: 48 A → 3 AWG Al, note 4 AWG Al', () => {
    const r = evCalc(48, 'Al');
    expect(r.conductorSize).toBe('3 AWG');
    expect(r.conductor75COption).toBe('4 AWG');
  });

  it('EV Panel Builder presets: 48A → 60 A / 4 AWG, 80A → 100 A / 1 AWG, DCFC 250 A / 250 kcmil', () => {
    expect(builderEv('Level 2 (48A)')).toMatchObject({ breakerAmps: 60, conductorSize: '4 AWG Cu' });  // was 6 AWG
    expect(builderEv('Level 2 (80A)')).toMatchObject({ breakerAmps: 100, conductorSize: '1 AWG Cu' }); // was 3 AWG
    expect(builderEv('DC Fast Charge (150kW)')).toMatchObject({ breakerAmps: 250, conductorSize: '250 kcmil Cu' });
  });

  it.each([16, 24, 32, 40, 48, 64, 80])('%i A charger: the builder and the calculator give the same conductor', (amps) => {
    const calc = evCalc(amps);
    const built = builderEv('Level 2 (48A)', amps);
    expect(built.breakerAmps).toBe(calc.circuitBreakerAmps);
    expect(built.conductorSize).toBe(`${calc.conductorSize} Cu`);
  });

  it('premade templates: every EV circuit sized in its 110.14(C)(1) column', () => {
    const ev = EV_PANEL_TEMPLATES.flatMap(t => t.circuits).filter(c => c.isEvCharger);
    expect(ev.length).toBeGreaterThan(0);
    for (const c of ev) {
      const rated = findConductorByAmpacity(c.breakerAmps, 'Cu', terminationTempC(c.breakerAmps))!;
      expect(c.conductorSize).toBe(`${rated.size} Cu`);
    }
  });
});
