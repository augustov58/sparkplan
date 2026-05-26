/**
 * PR-1 (2026-05-26) — MF-EV autogen must stamp is_proposed:true on
 * the EV panel + every EV circuit.
 *
 * The "Add EV Infrastructure" button in the Multi-Family EV Calculator only
 * fires when an MDP already exists in the project — by construction, the EV
 * panel + circuits it generates are post-existing-service additions and must
 * be flagged so the riser PDF renders a dashed outline + "NEW" badge and the
 * panel schedule shows the "*" marker. The flag is harmless on new-construction
 * projects because the renderers gate visibility upstream.
 *
 * Pre-PR-1, generateEVPanel + generateEVInfrastructure omitted is_proposed
 * entirely, so the column's NOT NULL DEFAULT false flowed through and every
 * EV entity rendered as "EXIST" on the packet (live-verified on 'new 4-plex'
 * permit packet 2026-05-26, page 8 riser + page 19 EV Sub-Panel schedule).
 *
 * If is_proposed gets dropped from the generator again, this test fails
 * loudly before the bug ships to PDFs.
 */

import { describe, it, expect } from 'vitest';
import { calculateMultiFamilyEV } from '../services/calculations/multiFamilyEV';
import { generateEVInfrastructure } from '../services/autogeneration/multiFamilyProjectGenerator';

const FOURPLEX_INPUT = {
  buildingName: 'new 4-plex',
  dwellingUnits: 4,
  avgUnitSqFt: 950,
  voltage: 240 as const,
  phase: 1 as const,
  existingServiceAmps: 400,
  evChargers: {
    count: 4,
    level: 'Level2' as const,
    ampsPerCharger: 48,
  },
  hasElectricCooking: true,
  hasElectricHeat: false,
  commonAreaLoadVA: 5_000,
  useEVEMS: true,
};

describe('MF-EV autogeneration → is_proposed contract', () => {
  it('stamps is_proposed:true on every generated EV circuit', () => {
    const result = calculateMultiFamilyEV(FOURPLEX_INPUT);
    const evInfra = generateEVInfrastructure(result, {
      scenario: 'withEVEMS',
      projectId: 'test-project-id',
      evAmpsPerCharger: 48,
      evChargerLevel: 'Level2',
    });

    expect(evInfra.evCircuits.length).toBeGreaterThan(0);
    for (const circuit of evInfra.evCircuits) {
      expect(circuit.is_proposed).toBe(true);
    }
  });

  it('stamps is_proposed:true on the generated EV sub-panel', () => {
    const result = calculateMultiFamilyEV(FOURPLEX_INPUT);
    const evInfra = generateEVInfrastructure(result, {
      scenario: 'withEVEMS',
      projectId: 'test-project-id',
      evAmpsPerCharger: 48,
      evChargerLevel: 'Level2',
    });

    expect(evInfra.evPanel.is_proposed).toBe(true);
  });

  it('keeps the flag on all three EV scenarios (noEVEMS / withEVEMS / withUpgrade)', () => {
    const result = calculateMultiFamilyEV(FOURPLEX_INPUT);
    const scenarios = ['noEVEMS', 'withEVEMS', 'withUpgrade'] as const;

    for (const scenario of scenarios) {
      const evInfra = generateEVInfrastructure(result, {
        scenario,
        projectId: 'test-project-id',
        evAmpsPerCharger: 48,
        evChargerLevel: 'Level2',
      });
      expect(evInfra.evPanel.is_proposed, `panel for scenario ${scenario}`).toBe(true);
      for (const c of evInfra.evCircuits) {
        expect(c.is_proposed, `circuit ${c.description} for scenario ${scenario}`).toBe(true);
      }
    }
  });
});
