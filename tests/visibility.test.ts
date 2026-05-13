/**
 * Sprint 2B PR-4 — AHJ-aware visibility computation tests.
 *
 * Pure-function tests covering the two-layer visibility model:
 *   Layer 1 — manifest defaults + predicates
 *   Layer 2 — user overrides
 *
 * Plus the bridge helper that projects VisibilityState back into the
 * Sprint 2A `Partial<PacketSections>` shape.
 */
import { describe, it, expect } from 'vitest';
import {
  computeDefaultVisibility,
  applyUserOverrides,
  toPacketSectionsPartial,
  ALL_SECTION_KEYS,
  ALL_ARTIFACT_TYPE_KEYS,
} from '../data/ahj/visibility';
import { orlandoManifest } from '../data/ahj/orlando';
import type { AHJContext, AHJManifest } from '../data/ahj/types';

// ----------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------

const ctxOrlandoExistingSFR: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
};

const ctxOrlandoNewServiceCommercial: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'commercial',
};

const ctxOrlandoExistingMultiFamily: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'multi_family',
};

// ----------------------------------------------------------------------------
// computeDefaultVisibility
// ----------------------------------------------------------------------------

describe('computeDefaultVisibility — Orlando manifest', () => {
  it('marks every section + artifact-type with a boolean (no undefined holes)', () => {
    const state = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    for (const key of ALL_SECTION_KEYS) {
      expect(typeof state.sections[key]).toBe('boolean');
    }
    for (const key of ALL_ARTIFACT_TYPE_KEYS) {
      expect(typeof state.artifactTypes[key]).toBe('boolean');
    }
  });

  it('turns ON sections in relevantSections (no predicate)', () => {
    const state = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    // Front matter — listed in relevantSections, no predicate → always on
    expect(state.sections.tableOfContents).toBe(true);
    expect(state.sections.generalNotes).toBe(true);
    expect(state.sections.revisionLog).toBe(true);
    expect(state.sections.loadCalculation).toBe(true);
    expect(state.sections.riserDiagram).toBe(true);
    expect(state.sections.equipmentSchedule).toBe(true);
    expect(state.sections.complianceSummary).toBe(true);
  });

  it('turns OFF sections NOT in relevantSections', () => {
    const state = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    // arcFlash is intentionally NOT in Orlando's relevantSections
    expect(state.sections.arcFlash).toBe(false);
  });

  it('predicate: nec22087Narrative ON only on existing-service path', () => {
    const onExisting = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    expect(onExisting.sections.nec22087Narrative).toBe(true);

    const onNewService = computeDefaultVisibility(orlandoManifest, {
      ...ctxOrlandoExistingSFR,
      scope: 'new-service',
    });
    expect(onNewService.sections.nec22087Narrative).toBe(false);
  });

  it('predicate: availableFaultCurrent ON only on new-service path', () => {
    const onExisting = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    expect(onExisting.sections.availableFaultCurrent).toBe(false);

    const onNewService = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoNewServiceCommercial,
    );
    expect(onNewService.sections.availableFaultCurrent).toBe(true);
  });

  it('predicate: grounding ON only on new-service path', () => {
    const onExisting = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    expect(onExisting.sections.grounding).toBe(false);

    const onNewService = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoNewServiceCommercial,
    );
    expect(onNewService.sections.grounding).toBe(true);
  });

  it('predicate: meterStack + multiFamilyEV ON only for multi_family building type', () => {
    const sfr = computeDefaultVisibility(orlandoManifest, ctxOrlandoExistingSFR);
    expect(sfr.sections.meterStack).toBe(false);
    expect(sfr.sections.multiFamilyEV).toBe(false);

    const mf = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingMultiFamily,
    );
    expect(mf.sections.meterStack).toBe(true);
    expect(mf.sections.multiFamilyEV).toBe(true);
  });

  it('artifact predicate: noc ON for non-SFR projects', () => {
    const sfr = computeDefaultVisibility(orlandoManifest, ctxOrlandoExistingSFR);
    expect(sfr.artifactTypes.noc).toBe(false);

    const commercial = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoNewServiceCommercial,
    );
    expect(commercial.artifactTypes.noc).toBe(true);

    const mf = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingMultiFamily,
    );
    expect(mf.artifactTypes.noc).toBe(true);
  });

  it('artifact predicate: hvhz_anchoring ON always (Orlando default)', () => {
    const sfr = computeDefaultVisibility(orlandoManifest, ctxOrlandoExistingSFR);
    expect(sfr.artifactTypes.hvhz_anchoring).toBe(true);
  });

  it('artifact types NOT in relevantArtifactTypes default OFF', () => {
    const state = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    // These are reserved for Pompano / Davie / Hillsborough manifests
    expect(state.artifactTypes.zoning_application).toBe(false);
    expect(state.artifactTypes.fire_review_application).toBe(false);
    expect(state.artifactTypes.notarized_addendum).toBe(false);
    expect(state.artifactTypes.property_ownership_search).toBe(false);
    expect(state.artifactTypes.flood_elevation_certificate).toBe(false);
    expect(state.artifactTypes.private_provider_documentation).toBe(false);
    expect(state.artifactTypes.hoa_letter).toBe(false); // Pompano (H6)
    expect(state.artifactTypes.survey).toBe(false); // not Orlando intake
  });

  it('predicate that throws falls back to ON (conservative)', () => {
    const buggyManifest: AHJManifest = {
      ...orlandoManifest,
      sectionPredicates: {
        complianceSummary: () => {
          throw new Error('boom');
        },
      },
    };
    const state = computeDefaultVisibility(buggyManifest, ctxOrlandoExistingSFR);
    expect(state.sections.complianceSummary).toBe(true);
  });

  it('artifact predicate that throws falls back to ON (conservative)', () => {
    const buggyManifest: AHJManifest = {
      ...orlandoManifest,
      artifactTypePredicates: {
        site_plan: () => {
          throw new Error('boom');
        },
      },
    };
    const state = computeDefaultVisibility(buggyManifest, ctxOrlandoExistingSFR);
    expect(state.artifactTypes.site_plan).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// applyUserOverrides
// ----------------------------------------------------------------------------

describe('applyUserOverrides', () => {
  it('returns defaults unchanged when overrides is undefined', () => {
    const defaults = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    const result = applyUserOverrides(defaults, undefined);
    expect(result).toEqual(defaults);
  });

  it('returns defaults unchanged when overrides is null', () => {
    const defaults = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    const result = applyUserOverrides(defaults, null);
    expect(result).toEqual(defaults);
  });

  it('user OFF wins over manifest ON', () => {
    const defaults = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    // Defaults: tableOfContents ON. User toggles off.
    expect(defaults.sections.tableOfContents).toBe(true);
    const result = applyUserOverrides(defaults, {
      sections: { tableOfContents: false },
    });
    expect(result.sections.tableOfContents).toBe(false);
    // Other sections untouched
    expect(result.sections.generalNotes).toBe(true);
  });

  it('user ON wins over manifest OFF', () => {
    const defaults = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    // Defaults: arcFlash OFF (not in Orlando relevantSections). User opts in.
    expect(defaults.sections.arcFlash).toBe(false);
    const result = applyUserOverrides(defaults, {
      sections: { arcFlash: true },
    });
    expect(result.sections.arcFlash).toBe(true);
  });

  it('user ON wins over manifest OFF for artifact types', () => {
    const defaults = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    expect(defaults.artifactTypes.zoning_application).toBe(false);
    const result = applyUserOverrides(defaults, {
      artifactTypes: { zoning_application: true },
    });
    expect(result.artifactTypes.zoning_application).toBe(true);
  });

  it('does not mutate the defaults object', () => {
    const defaults = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    const snapshot = JSON.parse(JSON.stringify(defaults));
    applyUserOverrides(defaults, {
      sections: { tableOfContents: false, arcFlash: true },
      artifactTypes: { zoning_application: true },
    });
    expect(defaults).toEqual(snapshot);
  });

  it('ignores non-boolean override values gracefully', () => {
    const defaults = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    const result = applyUserOverrides(defaults, {
      // @ts-expect-error — intentionally bad input
      sections: { tableOfContents: 'yes' },
    });
    // Defaults preserved
    expect(result.sections.tableOfContents).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// toPacketSectionsPartial
// ----------------------------------------------------------------------------

describe('toPacketSectionsPartial — bridge to Sprint 2A generator', () => {
  it('emits ONLY the false keys (true keys omitted so resolveSections falls back)', () => {
    const defaults = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    const partial = toPacketSectionsPartial(defaults);
    // arcFlash defaulted off → present as false
    expect(partial.arcFlash).toBe(false);
    // tableOfContents defaulted on → omitted entirely
    expect('tableOfContents' in partial).toBe(false);
  });

  it('user-overridden off becomes false in the partial', () => {
    const defaults = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    const state = applyUserOverrides(defaults, {
      sections: { tableOfContents: false },
    });
    const partial = toPacketSectionsPartial(state);
    expect(partial.tableOfContents).toBe(false);
  });

  it('user-overridden on does NOT appear as true (off-only emission)', () => {
    const defaults = computeDefaultVisibility(
      orlandoManifest,
      ctxOrlandoExistingSFR,
    );
    const state = applyUserOverrides(defaults, {
      sections: { arcFlash: true },
    });
    const partial = toPacketSectionsPartial(state);
    // arcFlash now ON → omitted from partial (resolveSections defaults to ON)
    expect('arcFlash' in partial).toBe(false);
  });
});
