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

/**
 * PR-1 Bug 2 (2026-05-26) — EVEMS scenario must clamp service demand.
 *
 * Per NEC 625.42, "the feeder or service demand load shall be permitted
 * to be the maximum load permitted by the ALMS." Before this fix,
 * calculateMultiFamilyEV unconditionally set evDemandVA = totalEVConnectedVA
 * (full nameplate) regardless of useEVEMS — so projects with EVEMS configured
 * showed false "Service capacity exceeded by Xa" + "Upgrade Required" warnings
 * on E-402 MF EV Readiness page, even when EVEMS was the whole point.
 *
 * Live-verified on 'new 4-plex' permit packet 2026-05-26 (400A service,
 * 269A building, 4×48A chargers): pre-fix E-402 showed 115.2% utilization
 * + "Upgrade Required: Yes — Panel Only to 600A"; post-fix should show
 * ~96.85% utilization + no upgrade required because EV demand clamps to
 * the EVEMS setpoint of ~118A (~28.3 kVA).
 */
describe('MF-EV service analysis → EVEMS clamping (NEC 625.42)', () => {
  // Fixture sized so EVEMS clamping is both (a) necessary and (b) sufficient:
  // 4 units × ~64 kVA building demand on a 400A/96 kVA service leaves
  // ~32 kVA available → setpoint ~29 kVA. 8 chargers × 48A = 92 kVA full
  // nameplate (well above the setpoint, so clamping engages). With EVEMS,
  // total = 64 + 29 = 93 kVA → ~97% utilization, no upgrade required.
  // Without EVEMS, total = 64 + 92 = 156 kVA → ~162%, upgrade required.
  // This pins both the clamping behavior AND the worst-case fallback.
  const FOURPLEX_EVEMS_INPUT = {
    buildingName: 'EVEMS Clamping Fixture',
    dwellingUnits: 4,
    avgUnitSqFt: 950,
    voltage: 240 as const,
    phase: 1 as const,
    existingServiceAmps: 400,
    evChargers: { count: 8, level: 'Level2' as const, ampsPerCharger: 48 },
    hasElectricCooking: true,
    hasElectricHeat: false,
    commonAreaLoadVA: 5_000,
  };

  it('clamps EV demand to the EVEMS setpoint when useEVEMS=true', () => {
    const withEVEMS = calculateMultiFamilyEV({ ...FOURPLEX_EVEMS_INPUT, useEVEMS: true });
    const withoutEVEMS = calculateMultiFamilyEV({ ...FOURPLEX_EVEMS_INPUT, useEVEMS: false });

    // EV demand should be smaller with EVEMS than without (clamped to setpoint).
    expect(withEVEMS.evLoad.demandVA).toBeLessThan(withoutEVEMS.evLoad.demandVA);

    // Service utilization should be lower with EVEMS.
    expect(withEVEMS.serviceAnalysis.utilizationPercent).toBeLessThan(
      withoutEVEMS.serviceAnalysis.utilizationPercent,
    );
  });

  it('does not trigger upgrade-required warning when EVEMS keeps utilization below 100%', () => {
    const result = calculateMultiFamilyEV({ ...FOURPLEX_EVEMS_INPUT, useEVEMS: true });

    // The whole point of EVEMS is to avoid the upgrade.
    expect(result.serviceAnalysis.utilizationPercent).toBeLessThanOrEqual(100);
    expect(result.serviceAnalysis.upgradeRequired).toBe(false);
    expect(result.compliance.warnings).not.toContain(
      expect.stringMatching(/service capacity exceeded/i),
    );
  });

  it('preserves worst-case math when useEVEMS=false (regression guard)', () => {
    // Without EVEMS, the worst-case math must still fire for projects that
    // genuinely cannot accommodate the chargers. 4-plex + 4×48A direct is
    // ~192A on top of ~269A building = 461A on a 400A service → upgrade required.
    const result = calculateMultiFamilyEV({ ...FOURPLEX_EVEMS_INPUT, useEVEMS: false });
    expect(result.serviceAnalysis.upgradeRequired).toBe(true);
    expect(result.serviceAnalysis.utilizationPercent).toBeGreaterThan(100);
  });
});

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
