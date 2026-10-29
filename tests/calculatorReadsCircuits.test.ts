/**
 * #184: once the service panel has circuits, the Dwelling Load Calculator
 * computes from them — the packet's input, through the packet's function —
 * instead of the appliance toggles (which a project template never sets).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSingleFamilyLoad,
  calculateSingleFamilyLoadFromCircuits,
  calculateSingleFamilyPanelLoad,
  calculateDwellingDemandSplit,
  hasProposedHvac,
} from '../services/calculations/residentialLoad';
import { DEFAULT_APPLIANCES, circuitsWithPendingProposed, type ProposedLoad } from '../lib/storedCalcs';

const settings = { squareFootage: 2000, smallApplianceCircuits: 2, laundryCircuit: true, voltage: 240 };

// The "2000 sq ft Single-Family Home" template's circuits, all load type 'O'.
const o = (description: string, load_watts: number) => ({ description, load_watts, load_type: 'O', is_proposed: false });
const template = [
  o('Kitchen Receptacles 1', 1800), o('Kitchen Receptacles 2', 1800), o('Refrigerator', 600),
  o('Dishwasher', 1200), o('Garbage Disposal', 900), o('Microwave', 1500),
  o('Living Room Receptacles', 1200), o('Bedroom 1 Receptacles', 1200), o('Bedroom 2 Receptacles', 1200),
  o('Bedroom 3 Receptacles', 1200), o('General Lighting', 800), o('Exterior Lighting', 300),
  o('Bathroom 1 Receptacles (GFCI)', 1500), o('Bathroom 2 Receptacles (GFCI)', 1500),
  o('Electric Range (40A)', 8000), o('Electric Dryer (30A)', 5000), o('Water Heater (30A)', 4500),
  o('Air Conditioner (30A)', 5000), o('Furnace/Air Handler (15A)', 1200),
];

describe('Dwelling Load Calculator from the service panel circuits', () => {
  it('templated new house: the packet number (30.9 kVA), not the toggles\' general loads only', () => {
    const r = calculateSingleFamilyLoadFromCircuits({ ...settings, circuits: template, existingDwelling: false });
    expect(r.totalDemandVA).toBe(30_900);
    expect(r.serviceAmps).toBe(Math.round(30_900 / 240));
    expect(r.breakdown.reduce((sum, row) => sum + row.demandVA, 0)).toBe(r.totalDemandVA);

    const toggles = calculateSingleFamilyLoad({ ...settings, appliances: DEFAULT_APPLIANCES });
    expect(toggles.totalDemandVA).toBeLessThan(11_000);
  });

  it('every method: the same total as the packet function', () => {
    for (const [existingDwelling, useOptionalMethod] of [[false, false], [false, true], [true, false]] as const) {
      const opts = { ...settings, circuits: template, existingDwelling, useOptionalMethod };
      const r = calculateSingleFamilyLoadFromCircuits(opts);
      const packet = calculateSingleFamilyPanelLoad(opts);
      expect(r.totalDemandVA).toBe(packet.totalDemandVA);
      expect(r.totalConnectedVA).toBe(packet.totalConnectedVA);
      expect(r.necReferences[0]).toBe(packet.necReferences[0]);
    }
  });

  it('typed circuits: service, neutral and conductors as the toggle path sizes them', () => {
    const t = (description: string, load_watts: number, load_type: string) => ({ description, load_watts, load_type, is_proposed: false });
    const circuits = [
      t('General lighting', 6000, 'L'), t('Small appliance', 3000, 'R'), t('Laundry', 1500, 'R'),
      t('Range', 12000, 'K'), t('Dishwasher', 1200, 'K'), t('Dryer', 5000, 'D'), t('Water heater', 4500, 'W'),
      t('AC condenser', 5000, 'C'), t('Heat strip', 10000, 'H'), t('EV charger 40A', 9600, 'O'),
    ];
    const r = calculateSingleFamilyLoadFromCircuits({ ...settings, circuits, existingDwelling: false });
    const toggles = calculateSingleFamilyLoad({
      ...settings,
      appliances: {
        ...DEFAULT_APPLIANCES,
        range: { enabled: true, kw: 12, type: 'electric' },
        dishwasher: { enabled: true, kw: 1.2 },
        dryer: { enabled: true, kw: 5, type: 'electric' },
        waterHeater: { enabled: true, kw: 4.5, type: 'electric' },
        hvac: { enabled: true, type: 'electric_heat', coolingKw: 5, heatingKw: 10 },
        evCharger: { enabled: true, kw: 9.6, level: 2 },
      },
    });
    expect(r.totalDemandVA).toBe(toggles.totalDemandVA);
    // Neutral: general 5,625 + dishwasher 1,200 + HVAC 10,000 — range, dryer,
    // water heater and EVSE are 240 V-only on both paths.
    expect(r.neutralLoadVA).toBe(16_825);
    expect(r.neutralLoadVA).toBe(toggles.neutralLoadVA);
    expect(r.recommendedServiceSize).toBe(toggles.recommendedServiceSize);
    expect(r.serviceConductorSize).toBe(toggles.serviceConductorSize);
    expect(r.neutralConductorSize).toBe(toggles.neutralConductorSize);
    expect(r.gecSize).toBe(toggles.gecSize);
  });
});

describe('proposed loads not yet applied to the schedule', () => {
  const ev: ProposedLoad = { id: 'p1', description: 'EV Charger (48A)', kw: 11.5, voltage: 240, continuous: true, category: 'EV' };

  it('count as proposed circuits until applied, then not twice', () => {
    const pending = circuitsWithPendingProposed(template, [ev]);
    expect(pending).toHaveLength(template.length + 1);
    expect(pending.at(-1)).toMatchObject({ description: ev.description, load_watts: 11_500, is_proposed: true });

    const applied = [...template, { description: ev.description, load_watts: 11_500, load_type: 'O', is_proposed: true }];
    expect(circuitsWithPendingProposed(applied, [ev])).toHaveLength(applied.length);

    // An existing circuit with the same description is not the applied proposed load.
    const sameName = [...template, { ...o(ev.description, 11_500) }];
    expect(circuitsWithPendingProposed(sameName, [ev])).toHaveLength(sameName.length + 1);
  });

  it('existing house: the 220.83 result is the same before and after Apply', () => {
    const before = calculateSingleFamilyLoadFromCircuits({
      ...settings, existingDwelling: true, circuits: circuitsWithPendingProposed(template, [ev]),
    });
    const after = calculateSingleFamilyLoadFromCircuits({
      ...settings, existingDwelling: true,
      circuits: [...template, { description: ev.description, load_watts: 11_500, load_type: 'O', is_proposed: true }],
    });
    expect(before.totalDemandVA).toBe(after.totalDemandVA);
    expect(before.totalDemandVA).toBeGreaterThan(
      calculateSingleFamilyLoadFromCircuits({ ...settings, existingDwelling: true, circuits: template }).totalDemandVA,
    );
  });

  it('a proposed HVAC load takes 220.83(B), as Generate writes it (type C)', () => {
    const heatPump: ProposedLoad = { id: 'p2', description: 'New heat pump', kw: 6, voltage: 240, continuous: false, category: 'HVAC' };
    const circuits = circuitsWithPendingProposed(template, [heatPump]);
    expect(hasProposedHvac(circuits)).toBe(true);
  });
});

describe('Service Upgrade Wizard existing load', () => {
  it('existing circuits only, with the 220.83(A)/(B) decision of the whole panel: E-102\'s existing load', () => {
    const circuits = [...template, { description: 'New heat pump', load_watts: 6000, load_type: 'C', is_proposed: true }];
    const wizard = calculateSingleFamilyLoadFromCircuits({
      ...settings, existingDwelling: true,
      circuits: circuits.filter(c => !c.is_proposed),
      hvacProposed: hasProposedHvac(circuits),
    });
    const split = calculateDwellingDemandSplit({ ...settings, existingDwelling: true, circuits });
    expect(wizard.totalDemandVA).toBe(split.existingDemandVA);
  });
});
