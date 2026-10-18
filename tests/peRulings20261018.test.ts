/**
 * PE rulings 2026-10-18 (Augusto, FL PE) on the 2026-10-14 QA questions.
 *
 * #131 — the EVEMS setpoint takes the NEC 220.87(2) 125% continuous factor.
 * #132 — existing dwelling: 220.83(A) when the permit adds no HVAC; any
 *        proposed HVAC (incl. a like-for-like replacement) → 220.83(B);
 *        a heat pump counts the larger of heat/cool only.
 * #133 — 220.84(C)(5): the larger of A/C or electric heat at nameplate; no
 *        65% heat factor inside 220.84.
 */
import { describe, it, expect } from 'vitest';
import { calculateMultiFamilyEV, type MultiFamilyEVInput } from '../services/calculations/multiFamilyEV';
import {
  calculateSingleFamilyLoad,
  calculateMultiFamilyLoad,
} from '../services/calculations/residentialLoad';
import { calculateProposedNewLoadVA } from '../services/calculations/upstreamLoadAggregation';
import type { ResidentialAppliances } from '../types';

describe('#131 EVEMS setpoint × 1.25 in the 220.87(2) comparison', () => {
  // QA St. Pete: 800 A / 240 V 1Ø, 120 kW measured, 8 × 48 A EVSE on EVEMS.
  const stPete: MultiFamilyEVInput = {
    dwellingUnits: 12,
    avgUnitSqFt: 850,
    voltage: 240,
    phase: 1,
    existingServiceAmps: 800,
    evChargers: { count: 8, level: 'Level2', ampsPerCharger: 48 },
    necEdition: '2020',
    existingLoadMethod: 'utility_bill',
    measuredPeakDemandKW: 120,
    useEVEMS: true,
  };

  it('sizes the setpoint to available × 0.90 ÷ 1.25 (126 A) and passes at 97.8%', () => {
    const r = calculateMultiFamilyEV(stPete);
    // Existing 120 × 1.25 = 150 kVA; available 42 kVA (175 A).
    expect(r.serviceAnalysis.availableCapacityAmps).toBe(175);
    // Setpoint 175 × 0.9 / 1.25 = 126 A = 30,240 VA; × 1.25 = 37,800 VA.
    expect(r.evLoad.demandFactor).toBe(1.25);
    expect(r.evLoad.demandVA).toBeCloseTo(37_800, 0);
    expect(r.serviceAnalysis.totalDemandVA).toBeCloseTo(187_800, 0);
    expect(r.serviceAnalysis.upgradeRequired).toBe(false);
    expect(r.scenarios.withEVEMS.notes.some(n => n.includes('EVEMS setpoint: 126A'))).toBe(true);
  });

  it('calculated (220.84) path keeps the setpoint at 100%', () => {
    const r = calculateMultiFamilyEV({ ...stPete, existingLoadMethod: 'calculated', measuredPeakDemandKW: undefined });
    expect(r.evLoad.demandFactor).toBe(1);
  });
});

describe('#131/#137 calculateProposedNewLoadVA (E-102 prefill)', () => {
  const evse = (id: number) => ({
    panel_id: 'ev', description: `Level 2 EV Charger #${id} (48A)`, load_watts: 11_520, is_proposed: true,
  });
  const chargers = Array.from({ length: 8 }, (_, i) => evse(i + 1));
  const lighting = { panel_id: 'ev', description: 'Lighting Circuit', load_watts: 1_800, is_proposed: true };
  const marker = { panel_id: 'ev', description: 'EVEMS Aggregate Setpoint (NEC 625.42)', load_watts: 30_240, is_proposed: true };

  it('EVEMS panel: marker is not load; EVSE clamped to the setpoint, × 1.25', () => {
    // min(92,160, 30,240) × 1.25 + 1,800 = 39,600 VA (was 154,800 before #137).
    expect(calculateProposedNewLoadVA([...chargers, lighting, marker])).toBe(39_600);
  });

  it('no EVEMS: every EVSE at 125%, other loads at nameplate', () => {
    expect(calculateProposedNewLoadVA([...chargers, lighting])).toBe(8 * 11_520 * 1.25 + 1_800);
  });

  it('existing circuits are ignored', () => {
    expect(calculateProposedNewLoadVA([{ ...evse(1), is_proposed: false }])).toBe(0);
  });
});

describe('#132 single-family existing dwelling: 220.83(A) vs (B)', () => {
  // QA Orlando house: 2,000 ft², heat pump 5 kW cool / 10 kW heat, adding a 48 A EVSE.
  const appliances: ResidentialAppliances = {
    range: { enabled: true, kw: 12, type: 'electric' },
    dryer: { enabled: true, kw: 5.5, type: 'electric' },
    waterHeater: { enabled: true, kw: 4.5, type: 'electric' },
    dishwasher: { enabled: true, kw: 1.5 },
    disposal: { enabled: true, kw: 0.5 },
    hvac: { enabled: true, type: 'heat_pump', coolingKw: 5, heatingKw: 10 },
    otherAppliances: [
      { description: 'Level 2 EV Charger (48A)', kw: 11.5, voltage: 240, continuous: true, proposed: true, category: 'EV' },
    ],
  };
  const input = {
    squareFootage: 2000, smallApplianceCircuits: 2, laundryCircuit: true,
    existingDwelling: true, necEdition: '2020' as const, appliances,
  };

  it('EV-only permit → 220.83(A): HVAC (larger of heat/cool) in the bucket = 27.2 kVA', () => {
    const r = calculateSingleFamilyLoad(input);
    // 46,000 general + 10,000 HVAC = 56,000 → 8,000 + 40% × 48,000 = 27,200.
    expect(r.totalDemandVA).toBe(27_200);
    expect(r.necReferences.some(ref => ref.startsWith('NEC 220.83(A)'))).toBe(true);
    expect(r.necReferences.some(ref => ref.startsWith('NEC 220.83(B)'))).toBe(false);
  });

  it('proposed HVAC (replacement counts) → 220.83(B): HVAC at 100%', () => {
    const r = calculateSingleFamilyLoad({
      ...input,
      appliances: {
        ...appliances,
        otherAppliances: [
          ...appliances.otherAppliances!,
          { description: 'Heat Pump (3 Ton) — replacement', kw: 3.5, voltage: 240, continuous: false, proposed: true, category: 'HVAC' },
        ],
      },
    });
    // General 46,000 → 8,000 + 40% × 38,000 = 23,200; HVAC 10,000 (existing,
    // larger of heat/cool) + 3,500 (proposed) at 100% = 36,700.
    expect(r.totalDemandVA).toBe(36_700);
    expect(r.necReferences.some(ref => ref.startsWith('NEC 220.83(B)'))).toBe(true);
  });
});

describe('#133 NEC 220.84(C)(5): larger of A/C or heat at nameplate', () => {
  it('calculateMultiFamilyLoad counts a 10 kW heat strip at 10 kW, not 6.5 kW', () => {
    const unit = (heatingKw: number) => calculateMultiFamilyLoad({
      unitTemplates: [{
        id: 't', name: '1BR', squareFootage: 850, unitCount: 12,
        appliances: { hvac: { enabled: true, type: 'heat_pump', coolingKw: 3.5, heatingKw } },
      }],
    } as Parameters<typeof calculateMultiFamilyLoad>[0]);
    const appliancesRow = (r: ReturnType<typeof calculateMultiFamilyLoad>) =>
      r.breakdown.find(b => b.category === 'Appliance Loads (Nameplate)')!.connectedVA;
    // 12 units × max(3.5, 10) kW = 120 kVA (the retired 65% rule gave 78 kVA).
    expect(appliancesRow(unit(10))).toBe(120_000);
    // Cooling larger → cooling counts: 12 × 3.5 = 42 kVA.
    expect(appliancesRow(unit(2))).toBe(42_000);
  });

  it('multiFamilyEV simplified path: assumed 10 kW/unit heat at nameplate', () => {
    const r = calculateMultiFamilyEV({
      dwellingUnits: 12, avgUnitSqFt: 850, voltage: 240, phase: 1, existingServiceAmps: 800,
      evChargers: { count: 2, level: 'Level2', ampsPerCharger: 32 }, hasElectricHeat: true,
    });
    const heat = r.buildingLoad.breakdown.find(b => b.category === 'Electric Heat')!;
    expect(heat.demandVA).toBe(120_000);
    expect(heat.demandFactor).toBe(1);
    expect(heat.necReference).toBe('NEC 220.84(C)(5)');
  });
});
