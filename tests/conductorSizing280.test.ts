/**
 * #280 — owner ruling 2026-11-21: the Copilot (add_circuit, check_conductor_sizing,
 * run_quick_inspection), Circuit Sharing and the multifamily generator use the
 * #271 rule. Breaker = next standard size ≥ 125 % of a continuous load;
 * conductor from Table 310.16 at terminationTempC (60 °C ≤ 100 A, 75 °C above);
 * a check passes anything code-legal (210.19(A)(1) + 240.4 incl. (B) and (D)).
 * Expected values: the issue's Acceptance section (hand-calculated).
 */
import { describe, it, expect } from 'vitest';
import { conductorForBreaker, conductorCodeLegal } from '../data/nec/table-310-16';
import { executeTool, type ToolContext } from '../services/ai/chatTools';
import { calculateCircuitSharing } from '../services/calculations/circuitSharing';
import { generateBasicMultiFamilyProject } from '../services/autogeneration/multiFamilyProjectGenerator';

describe('#280 conductorForBreaker', () => {
  it('60 °C up to 100 A, 75 °C above', () => {
    expect(conductorForBreaker(100, 'Cu')).toBe('1 AWG');  // 2 AWG 95 A < 100 at 60 °C
    expect(conductorForBreaker(60, 'Cu')).toBe('4 AWG');   // 6 AWG 55 A < 60
    expect(conductorForBreaker(150, 'Cu')).toBe('1/0 AWG'); // 75 °C: 1/0 = 150
    expect(conductorForBreaker(20, 'Cu')).toBe('12 AWG');
    expect(conductorForBreaker(45, 'Cu')).toBe('6 AWG');
  });
});

describe('#280 conductorCodeLegal', () => {
  it('8 AWG on 60 A with a 48 A EV load: not legal, minimum 4 AWG', () => {
    const r = conductorCodeLegal({ conductor: '8 AWG', material: 'Cu', breakerAmps: 60, loadAmps: 48, continuous: true });
    expect(r.legal).toBe(false);
    expect(r.legalWith75CTerminals).toBe(false); // 50 A at 75 °C, and 50 is a standard rating (no 240.4(B))
    expect(r.minimumSize).toBe('4 AWG');
  });
  it('6 AWG on 60 A with 44 A non-continuous: legal under 240.4(B) (55 A → next rating 60)', () => {
    expect(conductorCodeLegal({ conductor: '6 AWG', material: 'Cu', breakerAmps: 60, loadAmps: 44 }).legal).toBe(true);
  });
  it('…but not on a multi-outlet receptacle circuit (240.4(B)(1))', () => {
    expect(conductorCodeLegal({ conductor: '6 AWG', material: 'Cu', breakerAmps: 60, multiOutletReceptacle: true }).legal).toBe(false);
  });
  it('8 AWG on 50 A: not legal (40 A at 60 °C; 40 is a standard rating)', () => {
    expect(conductorCodeLegal({ conductor: '8 AWG', material: 'Cu', breakerAmps: 50 }).legal).toBe(false);
  });
  it('1 AWG on 150 A: legal (130 A at 75 °C → next rating 150)', () => {
    expect(conductorCodeLegal({ conductor: '1 AWG', material: 'Cu', breakerAmps: 150 }).legal).toBe(true);
  });
  it('240.4(D): 12 AWG on 25 A is not legal; parses "#6 AWG Cu"', () => {
    expect(conductorCodeLegal({ conductor: '12 AWG', material: 'Cu', breakerAmps: 25 }).legal).toBe(false);
    expect(conductorCodeLegal({ conductor: '#6 AWG Cu', material: 'Al', breakerAmps: 55 }).ampacityA).toBe(55);
  });
});

const ctx = (circuits: unknown[]): ToolContext => ({
  projectId: 'p',
  projectContext: { panels: [{ name: 'P', voltage: 240, phase: 1, busRating: 400, totalLoadVA: 0 }], circuits } as never,
});

describe('#280 Copilot tools', () => {
  it('check_conductor_sizing: 8 AWG on a 60 A breaker, 48 A EV load → not compliant, minimum 4 AWG', async () => {
    const r = await executeTool('check_conductor_sizing', { conductor_size: '8 AWG', breaker_amps: 60, load_amps: 48, continuous: true }, ctx([]));
    expect(r.data!.compliant).toBe(false); // main: "properly sized" (50 A at 75 °C ≥ 48)
    expect(r.data!.minimumRequiredSize).toBe('4 AWG');
  });
  it('check_conductor_sizing: 6 AWG on 60 A, 44 A → compliant (240.4(B))', async () => {
    const r = await executeTool('check_conductor_sizing', { conductor_size: '6 AWG', breaker_amps: 60, load_amps: 44 }, ctx([]));
    expect(r.data!.compliant).toBe(true);
  });
  const inspect = async (conductorSize: string, breakerAmps: number) => {
    const r = await executeTool('run_quick_inspection', { category: 'circuits' },
      ctx([{ circuitNumber: 1, description: 'Feeder test', panelName: 'P', breakerAmps, conductorSize, loadWatts: 2400 }]));
    return (r.data!.issues as { severity: string; description: string }[]).filter(i => /conductor/.test(i.description));
  };
  it('run_quick_inspection: 8 AWG on 50 A is flagged (legal only with 75 °C terminations); 8 AWG on 60 A critical; 1 AWG on 150 A fine', async () => {
    // 8 AWG: 40 A at 60 °C; 50 A at 75 °C — legal only if both terminations are listed for 75 °C
    expect((await inspect('8 AWG', 50)).map(i => i.severity)).toEqual(['warning']);   // main: no issue
    expect((await inspect('8 AWG', 60)).map(i => i.severity)).toEqual(['critical']);  // 40 / 50 A, both standard ratings: no 240.4(B)
    expect((await inspect('6 AWG', 70)).map(i => i.severity)).toEqual(['warning']);   // 65 A at 75 °C → 240.4(B) next rating 70
    expect(await inspect('1 AWG', 150)).toEqual([]);                                  // main: critical
  });
});

describe('#280 Circuit Sharing and the multifamily generator', () => {
  it('Circuit Sharing: a 48 A charger → 60 A circuit, 4 AWG Cu (6 AWG with 75 °C terminations)', () => {
    const r = calculateCircuitSharing({
      serviceRating: 200, currentUtilization: 70, proposedEVChargerAmps: 48, shareWith: 'dryer',
      existingCircuitAmps: 30, dryerUsagePattern: 'evening', evChargingSchedule: 'overnight',
    } as never);
    expect(r.circuitRequirements.circuitAmps).toBe(60); // main: 48
    expect(r.circuitRequirements.wireSize).toBe('#4 AWG Cu'); // main: #8 AWG Cu
    expect(r.circuitRequirements.wireSize75COption).toMatch(/#6 AWG Cu/);
  });
  const heat = (kw: number) => {
    const g = generateBasicMultiFamilyProject({
      projectId: 'x', voltage: 240, phase: 1, dwellingUnits: 2, avgUnitSqFt: 1000, serviceAmps: 400,
      commonAreaLoadVA: 5000, hasElectricCooking: true, hasElectricHeat: true, applianceConfig: { heatingKW: kw },
    } as never);
    const unit = Array.from((g.unitCircuits as unknown as Map<number, { description: string; breaker_amps: number; conductor_size: string }[]>).values())[0]!;
    return Object.fromEntries(unit.map(c => [c.description, `${c.breaker_amps} ${c.conductor_size}`]));
  };
  it('generator: 100 A → 1 AWG Cu; 150 A → 1/0 AWG Cu; 15–90 A unchanged', () => {
    expect(heat(19.2)['Electric Heat / Heat Pump']).toBe('100 1 AWG Cu');  // main: 2 AWG Cu
    expect(heat(28.8)['Electric Heat / Heat Pump']).toBe('150 1/0 AWG Cu'); // main: 2/0 AWG Cu
    expect(heat(19.2)['Range/Oven']).toBe('45 6 AWG Cu');
    expect(heat(19.2)['Water Heater']).toBe('25 10 AWG Cu');
  });
});

describe('#280 verifier findings', () => {
  it('a bare gauge ("8", "6", "1", "#4", "250") reads as AWG / kcmil, not "not in the table"', async () => {
    expect(conductorCodeLegal({ conductor: '6', material: 'Cu', breakerAmps: 60, loadAmps: 44 }).legal).toBe(true);
    expect(conductorCodeLegal({ conductor: '1', material: 'Cu', breakerAmps: 150 }).legal).toBe(true);
    expect(conductorCodeLegal({ conductor: '#8', material: 'Cu', breakerAmps: 60 }).ampacityA).toBe(40);
    expect(conductorCodeLegal({ conductor: '250', material: 'Cu', breakerAmps: 250 }).ampacityA).toBe(255);
    const r = await executeTool('check_conductor_sizing', { conductor_size: '6', breaker_amps: 60, load_amps: 44 }, ctx([]));
    expect(r.data!.compliant).toBe(true);
  });
  it('the minimum is the smallest legal size (240.4(B) included), never contradicting the verdict', () => {
    expect(conductorCodeLegal({ conductor: '6 AWG', material: 'Cu', breakerAmps: 60, loadAmps: 44 }).minimumSize).toBe('6 AWG');
    expect(conductorCodeLegal({ conductor: '8 AWG', material: 'Cu', breakerAmps: 60, loadAmps: 48, continuous: true }).minimumSize).toBe('4 AWG');
    expect(conductorCodeLegal({ conductor: '8 AWG', material: 'Cu', breakerAmps: 60 }).minimumSize).toBe('6 AWG');
  });
});
