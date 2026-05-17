/**
 * Sprint 2C follow-up — Orange County (Unincorporated) manifest tests.
 *
 * Regression guards for the axes that distinguish Orange County from its
 * Orlando-metro neighbour (City of Orlando manifest) and from the other
 * county-level AHJ already in the registry (Miami-Dade):
 *
 * 1. `subjurisdiction === 'unincorporated'` (mirrors miami-dade.ts —
 *    OC Division of Building Safety only covers unincorporated areas,
 *    NOT the City of Orlando or any of the incorporated municipalities).
 * 2. NOC threshold = $2,500 (encoded as `noc` predicate returning `true`
 *    for ALL building types, unlike Orlando / Miami-Dade where the $5,000
 *    threshold lets the predicate gate non-SFR only).
 * 3. NOT in HVHZ — `hvhz_anchoring` predicate gates to non-SFR only,
 *    contrasting Pompano / Miami-Dade where the slot defaults ON for all.
 * 4. Uniform NEC 2020 across building types (no H34-style residential/
 *    commercial fork — that's Miami-Dade only).
 * 5. `sheetIdPrefix === 'E-'` (Central FL convention, mirrors Orlando).
 *
 * Plus predicate-level tests covering scope / lane / building_type splits
 * in the requirements list.
 */
import { describe, it, expect } from 'vitest';
import { orangeCountyManifest } from '../data/ahj/orange-county';
import type {
  AHJContext,
  AHJManifest,
  AHJRequirement,
  PacketAST,
  AttachmentSummary,
} from '../data/ahj/types';

// ----------------------------------------------------------------------------
// Representative contexts
// ----------------------------------------------------------------------------

const ctxSFRExistingExempt: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
  subjurisdiction: 'unincorporated',
};

const ctxSFRNewServicePe: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'single_family_residential',
  subjurisdiction: 'unincorporated',
};

const ctxMultiFamilyNewServicePe: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'multi_family',
  subjurisdiction: 'unincorporated',
};

const ctxCommercialNewServicePe: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'commercial',
  subjurisdiction: 'unincorporated',
};

const ctxCommercialExistingExempt: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'commercial',
  subjurisdiction: 'unincorporated',
};

// ----------------------------------------------------------------------------
// Structural / shape assertions
// ----------------------------------------------------------------------------

describe('Orange County manifest — structural shape', () => {
  it('conforms to the AHJManifest interface', () => {
    const m: AHJManifest = orangeCountyManifest;
    expect(m.id).toBe('orange-county');
    expect(m.name).toBe('Orange County (Unincorporated)');
    expect(m.jurisdictionType).toBe('county');
  });

  it('sets subjurisdiction to "unincorporated" (regression guard — distinguishes from City of Orlando)', () => {
    expect(orangeCountyManifest.subjurisdiction).toBe('unincorporated');
  });

  it('uses the "E-" sheet ID prefix (Central FL convention; mirrors Orlando)', () => {
    expect(orangeCountyManifest.sheetIdPrefix).toBe('E-');
  });

  it('uniformly cites NEC 2020 across all building types (no H34 fork — that is Miami-Dade only)', () => {
    expect(orangeCountyManifest.necEdition.single_family_residential).toBe(
      'NEC 2020',
    );
    expect(orangeCountyManifest.necEdition.multi_family).toBe('NEC 2020');
    expect(orangeCountyManifest.necEdition.commercial).toBe('NEC 2020');
  });

  it('cites FBC 8th edition (2023) statewide', () => {
    expect(orangeCountyManifest.fbcEdition).toBe('FBC 8th ed (2023)');
  });

  it('has Orange-County-specific general notes (Section 9-86, NOC $2,500, FastTrack, non-HVHZ)', () => {
    const notes = orangeCountyManifest.generalNotes.join(' ');
    expect(notes).toMatch(/NFPA-70\s*\(2020 NEC\)/);
    expect(notes).toMatch(/Section 9-86/);
    expect(notes).toMatch(/\$2,500/);
    expect(notes).toMatch(/FastTrack/);
    expect(notes).toMatch(/NOT within the High-Velocity Hurricane Zone/);
  });

  it('cites OC Chapter 9 Article III (Electrical Code) and FBC 8th ed in code references', () => {
    expect(orangeCountyManifest.codeReferences).toContain('NFPA-70 (2020 NEC)');
    expect(orangeCountyManifest.codeReferences).toContain(
      'Florida Building Code, 8th edition (2023)',
    );
    expect(
      orangeCountyManifest.codeReferences.some((c) =>
        c.includes('Chapter 9, Article III'),
      ),
    ).toBe(true);
    expect(
      orangeCountyManifest.codeReferences.some((c) =>
        c.toLowerCase().includes('orange county'),
      ),
    ).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Visibility — relevantSections + relevantArtifactTypes
// ----------------------------------------------------------------------------

describe('Orange County manifest — visibility defaults', () => {
  it('declares the core engineering sections (riser, load calc, panel schedules, equipment specs)', () => {
    expect(orangeCountyManifest.relevantSections).toContain('riserDiagram');
    expect(orangeCountyManifest.relevantSections).toContain('loadCalculation');
    expect(orangeCountyManifest.relevantSections).toContain('panelSchedules');
    expect(orangeCountyManifest.relevantSections).toContain('equipmentSpecs');
  });

  it('declares OC intake upload slots (site_plan, cut_sheet, NOC, manufacturer_data, anchoring)', () => {
    expect(orangeCountyManifest.relevantArtifactTypes).toContain('site_plan');
    expect(orangeCountyManifest.relevantArtifactTypes).toContain('cut_sheet');
    expect(orangeCountyManifest.relevantArtifactTypes).toContain('noc');
    expect(orangeCountyManifest.relevantArtifactTypes).toContain(
      'manufacturer_data',
    );
    expect(orangeCountyManifest.relevantArtifactTypes).toContain(
      'hvhz_anchoring',
    );
  });

  it('does NOT include Pompano / Davie / Hillsborough artifact types by default', () => {
    expect(orangeCountyManifest.relevantArtifactTypes).not.toContain(
      'hoa_letter',
    );
    expect(orangeCountyManifest.relevantArtifactTypes).not.toContain(
      'zoning_application',
    );
    expect(orangeCountyManifest.relevantArtifactTypes).not.toContain(
      'fire_review_application',
    );
    expect(orangeCountyManifest.relevantArtifactTypes).not.toContain(
      'notarized_addendum',
    );
    expect(orangeCountyManifest.relevantArtifactTypes).not.toContain(
      'property_ownership_search',
    );
    expect(orangeCountyManifest.relevantArtifactTypes).not.toContain(
      'flood_elevation_certificate',
    );
    expect(orangeCountyManifest.relevantArtifactTypes).not.toContain(
      'private_provider_documentation',
    );
  });
});

// ----------------------------------------------------------------------------
// Section predicates — scope / building_type forks
// ----------------------------------------------------------------------------

describe('Orange County manifest — section predicates', () => {
  it('gates nec22087Narrative to existing-service path (same as Orlando)', () => {
    const pred = orangeCountyManifest.sectionPredicates?.nec22087Narrative;
    expect(pred).toBeDefined();
    expect(pred!(ctxSFRExistingExempt)).toBe(true);
    expect(pred!(ctxCommercialNewServicePe)).toBe(false);
  });

  it('gates availableFaultCurrent to new-service path (same as Orlando, NOT both paths like MD)', () => {
    const pred = orangeCountyManifest.sectionPredicates?.availableFaultCurrent;
    expect(pred).toBeDefined();
    expect(pred!(ctxCommercialNewServicePe)).toBe(true);
    expect(pred!(ctxSFRExistingExempt)).toBe(false);
  });

  it('gates grounding plan to new-service path (same as Orlando)', () => {
    const pred = orangeCountyManifest.sectionPredicates?.grounding;
    expect(pred).toBeDefined();
    expect(pred!(ctxMultiFamilyNewServicePe)).toBe(true);
    expect(pred!(ctxSFRExistingExempt)).toBe(false);
  });

  it('gates multi-family sections to buildingType === multi_family', () => {
    const meterPred = orangeCountyManifest.sectionPredicates?.meterStack;
    const mfevPred = orangeCountyManifest.sectionPredicates?.multiFamilyEV;
    expect(meterPred).toBeDefined();
    expect(mfevPred).toBeDefined();
    expect(meterPred!(ctxMultiFamilyNewServicePe)).toBe(true);
    expect(meterPred!(ctxCommercialNewServicePe)).toBe(false);
    expect(meterPred!(ctxSFRExistingExempt)).toBe(false);
    expect(mfevPred!(ctxMultiFamilyNewServicePe)).toBe(true);
    expect(mfevPred!(ctxSFRExistingExempt)).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Artifact-type predicates — OC-specific divergences
// ----------------------------------------------------------------------------

describe('Orange County manifest — artifact-type predicates (OC-specific divergences)', () => {
  it('NOC defaults ON for ALL building types (Orange County $2,500 threshold — LOWER than the $5,000 default that gates Orlando/MD non-SFR-only)', () => {
    const pred = orangeCountyManifest.artifactTypePredicates?.noc;
    expect(pred).toBeDefined();
    expect(pred!(ctxSFRExistingExempt)).toBe(true);
    expect(pred!(ctxMultiFamilyNewServicePe)).toBe(true);
    expect(pred!(ctxCommercialNewServicePe)).toBe(true);
  });

  it('hvhz_anchoring gated to non-SFR ONLY (OC NOT in HVHZ — contrasts MD/Pompano default-ON-everywhere)', () => {
    const pred = orangeCountyManifest.artifactTypePredicates?.hvhz_anchoring;
    expect(pred).toBeDefined();
    expect(pred!(ctxSFRExistingExempt)).toBe(false);
    expect(pred!(ctxSFRNewServicePe)).toBe(false);
    expect(pred!(ctxMultiFamilyNewServicePe)).toBe(true);
    expect(pred!(ctxCommercialNewServicePe)).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Requirements — count + uniqueness + categories
// ----------------------------------------------------------------------------

describe('Orange County manifest — requirements list', () => {
  it('declares exactly 15 requirement entries (regression guard against silent drift)', () => {
    // Snapshot-style count assertion — bumping this number is intentional
    // and forces the reviewer to confirm the new line was sourced from
    // the OC Electrical Permit application / Section 9-86 / Chapter 9.
    expect(orangeCountyManifest.requirements).toHaveLength(15);
  });

  it('every requirement has a unique ID (no duplicate keys)', () => {
    const ids = orangeCountyManifest.requirements.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every requirement ID is prefixed "orange-county-" (manifest-id namespacing convention)', () => {
    for (const req of orangeCountyManifest.requirements) {
      expect(req.id.startsWith('orange-county-')).toBe(true);
    }
  });

  it('every requirement carries a category from the allowed enum', () => {
    const allowed = new Set([
      'plan',
      'application',
      'narrative',
      'inspection',
      'upload',
    ]);
    for (const req of orangeCountyManifest.requirements) {
      expect(allowed.has(req.category)).toBe(true);
    }
  });

  it('every requirement supplies a `required` and `detect` function (pure-shape contract)', () => {
    for (const req of orangeCountyManifest.requirements) {
      expect(typeof req.required).toBe('function');
      expect(typeof req.detect).toBe('function');
    }
  });
});

// ----------------------------------------------------------------------------
// Requirement predicates — building_type / scope / lane splits
// ----------------------------------------------------------------------------

function getRequirement(id: string): AHJRequirement {
  const req = orangeCountyManifest.requirements.find((r) => r.id === id);
  if (!req) throw new Error(`Test setup error: requirement ${id} not found`);
  return req;
}

describe('Orange County manifest — requirement predicates', () => {
  it('PE seal required only when lane === "pe_required" (H17 contractor-exemption gate)', () => {
    const req = getRequirement('orange-county-pe-seal');
    expect(req.required(ctxSFRExistingExempt)).toBe(false);
    expect(req.required(ctxCommercialExistingExempt)).toBe(false);
    expect(req.required(ctxCommercialNewServicePe)).toBe(true);
    expect(req.required(ctxMultiFamilyNewServicePe)).toBe(true);
  });

  it('NOC required for ALL building types (OC $2,500 threshold — does NOT gate on building type unlike other AHJs)', () => {
    const req = getRequirement('orange-county-noc');
    expect(req.required(ctxSFRExistingExempt)).toBe(true);
    expect(req.required(ctxMultiFamilyNewServicePe)).toBe(true);
    expect(req.required(ctxCommercialNewServicePe)).toBe(true);
  });

  it('Anchoring detail required only for non-SFR (OC NOT in HVHZ — contrasts Pompano/MD default-required-everywhere)', () => {
    const req = getRequirement('orange-county-anchoring-detail');
    expect(req.required(ctxSFRExistingExempt)).toBe(false);
    expect(req.required(ctxSFRNewServicePe)).toBe(false);
    expect(req.required(ctxMultiFamilyNewServicePe)).toBe(true);
    expect(req.required(ctxCommercialNewServicePe)).toBe(true);
  });

  it('Grounding required only on new-service path (matches Orlando gating)', () => {
    const req = getRequirement('orange-county-grounding');
    expect(req.required(ctxSFRExistingExempt)).toBe(false);
    expect(req.required(ctxCommercialExistingExempt)).toBe(false);
    expect(req.required(ctxSFRNewServicePe)).toBe(true);
    expect(req.required(ctxCommercialNewServicePe)).toBe(true);
  });

  it('Available fault current required only on new-service path (matches Orlando; differs from MD which mandates both paths)', () => {
    const req = getRequirement('orange-county-available-fault-current');
    expect(req.required(ctxSFRExistingExempt)).toBe(false);
    expect(req.required(ctxCommercialNewServicePe)).toBe(true);
  });

  it('Base required-always: electrical permit application, riser, load calc, electrical plan, site plan, code basis, contractor block', () => {
    expect(
      getRequirement('orange-county-electrical-permit-application').required(
        ctxSFRExistingExempt,
      ),
    ).toBe(true);
    expect(
      getRequirement('orange-county-riser-diagram').required(ctxSFRExistingExempt),
    ).toBe(true);
    expect(
      getRequirement('orange-county-load-calculation').required(
        ctxSFRExistingExempt,
      ),
    ).toBe(true);
    expect(
      getRequirement('orange-county-electrical-plan').required(
        ctxSFRExistingExempt,
      ),
    ).toBe(true);
    expect(
      getRequirement('orange-county-site-plan').required(ctxSFRExistingExempt),
    ).toBe(true);
    expect(
      getRequirement('orange-county-code-basis-block').required(
        ctxSFRExistingExempt,
      ),
    ).toBe(true);
    expect(
      getRequirement('orange-county-contractor-license-block').required(
        ctxSFRExistingExempt,
      ),
    ).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Requirement detect — sample packet evaluations
// ----------------------------------------------------------------------------

describe('Orange County manifest — requirement detect()', () => {
  const emptyPacket: PacketAST = { sheetIds: [], sectionKeys: [] };
  const emptyAttachments: AttachmentSummary[] = [];

  it('"E-" sheet-id-prefix requirement detects E- prefix and rejects EL-', () => {
    const req = getRequirement('orange-county-sheet-id-prefix');
    expect(req.detect({ sheetIds: ['EL-001', 'EL-100'] }, emptyAttachments)).toBe(
      false,
    );
    expect(req.detect({ sheetIds: ['E-001', 'E-100'] }, emptyAttachments)).toBe(
      true,
    );
    // Mixed (transitional) — should still detect E- presence
    expect(req.detect({ sheetIds: ['E-001', 'C-201'] }, emptyAttachments)).toBe(
      true,
    );
  });

  it('NOC detect() looks for the artifact_type upload', () => {
    const req = getRequirement('orange-county-noc');
    expect(req.detect(emptyPacket, [{ artifactType: 'noc' }])).toBe(true);
    expect(req.detect(emptyPacket, [{ artifactType: 'site_plan' }])).toBe(
      false,
    );
  });

  it('Anchoring detect() looks for hvhz_anchoring artifact slot', () => {
    const req = getRequirement('orange-county-anchoring-detail');
    expect(req.detect(emptyPacket, emptyAttachments)).toBe(false);
    expect(
      req.detect(emptyPacket, [{ artifactType: 'hvhz_anchoring' }]),
    ).toBe(true);
    expect(req.detect(emptyPacket, [{ artifactType: 'site_plan' }])).toBe(
      false,
    );
  });

  it('Electrical-plan requirement requires BOTH panel + equipment schedule sections', () => {
    const req = getRequirement('orange-county-electrical-plan');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(req.detect({ sectionKeys: ['panelSchedules'] }, [])).toBe(false);
    expect(
      req.detect(
        { sectionKeys: ['panelSchedules', 'equipmentSchedule'] },
        [],
      ),
    ).toBe(true);
  });

  it('Equipment-listing detect() accepts equipmentSpecs section OR cut_sheet/manufacturer_data upload', () => {
    const req = getRequirement('orange-county-equipment-listing');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(req.detect({ sectionKeys: ['equipmentSpecs'] }, [])).toBe(true);
    expect(req.detect(emptyPacket, [{ artifactType: 'cut_sheet' }])).toBe(
      true,
    );
    expect(
      req.detect(emptyPacket, [{ artifactType: 'manufacturer_data' }]),
    ).toBe(true);
  });

  it('Site-plan locator returns the first C- prefixed sheet ID when present', () => {
    const req = getRequirement('orange-county-site-plan');
    expect(req.locator).toBeDefined();
    const packet: PacketAST = {
      sheetIds: ['E-001', 'E-100', 'C-201', 'X-205'],
    };
    expect(req.locator!(packet)).toBe('C-201');

    const noCivil: PacketAST = { sheetIds: ['E-001', 'E-100'] };
    expect(req.locator!(noCivil)).toBeNull();
  });
});
