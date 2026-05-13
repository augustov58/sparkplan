/**
 * Sprint 2C M1 — Pompano Beach manifest tests.
 *
 * Validates the manifest shape, requirement predicates, and detection
 * logic against representative contexts. The full checklist-engine
 * end-to-end test lives in `tests/` and consumes this manifest via the
 * registry (Sprint 2C M1 stitch PR).
 */
import { describe, it, expect } from 'vitest';
import { pompanoManifest } from '../data/ahj/pompano';
import type {
  AHJContext,
  AttachmentSummary,
  PacketAST,
} from '../data/ahj/types';

// ----------------------------------------------------------------------------
// Representative contexts
// ----------------------------------------------------------------------------

const sfrExistingExempt: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
};

const multiFamilyNewServicePe: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'multi_family',
};

const commercialNewServicePe: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'commercial',
};

const commercialExistingExempt: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'commercial',
};

// ----------------------------------------------------------------------------
// Structural / shape assertions
// ----------------------------------------------------------------------------

describe('Pompano manifest — structural shape', () => {
  it('declares core identity fields', () => {
    expect(pompanoManifest.id).toBe('pompano');
    expect(pompanoManifest.name).toBe('City of Pompano Beach');
    expect(pompanoManifest.jurisdictionType).toBe('city');
    expect(pompanoManifest.subjurisdiction).toBeUndefined();
  });

  it('uses E- sheet ID prefix (Broward / FL standard convention)', () => {
    expect(pompanoManifest.sheetIdPrefix).toBe('E-');
  });

  it('uniformly cites NEC 2020 across all building types (no H34 fork)', () => {
    expect(pompanoManifest.necEdition.single_family_residential).toBe(
      'NEC 2020',
    );
    expect(pompanoManifest.necEdition.multi_family).toBe('NEC 2020');
    expect(pompanoManifest.necEdition.commercial).toBe('NEC 2020');
  });

  it('cites FBC 8th edition (2023) statewide', () => {
    expect(pompanoManifest.fbcEdition).toBe('FBC 8th ed (2023)');
  });

  it('has Pompano-specific general notes (NEC 2020 + 3-form intake + HVHZ anchoring)', () => {
    const notes = pompanoManifest.generalNotes.join(' ');
    expect(notes).toMatch(/NFPA-70\s*\(2020 NEC\)/);
    expect(notes).toMatch(/Broward County Uniform Permit Application/);
    expect(notes).toMatch(/Zoning Compliance/);
    expect(notes).toMatch(/Florida Product Approval/);
    expect(notes).toMatch(/Miami-Dade Notice of Acceptance/);
  });

  it('cites Pompano + Broward + FL Statute 713 in code references', () => {
    expect(pompanoManifest.codeReferences).toContain('NFPA-70 (2020 NEC)');
    expect(pompanoManifest.codeReferences).toContain(
      'Florida Building Code, 8th edition (2023)',
    );
    expect(pompanoManifest.codeReferences).toContain(
      'Florida Statute 713 (Notice of Commencement)',
    );
    expect(
      pompanoManifest.codeReferences.some((c) =>
        c.toLowerCase().includes('pompano beach'),
      ),
    ).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Visibility — relevantSections + relevantArtifactTypes
// ----------------------------------------------------------------------------

describe('Pompano manifest — visibility defaults', () => {
  it('declares the core engineering sections (riser, load calc, panel schedules)', () => {
    expect(pompanoManifest.relevantSections).toContain('riserDiagram');
    expect(pompanoManifest.relevantSections).toContain('loadCalculation');
    expect(pompanoManifest.relevantSections).toContain('panelSchedules');
    expect(pompanoManifest.relevantSections).toContain('equipmentSpecs');
  });

  it('declares Pompano-specific upload slots (HOA, zoning, fire-review, HVHZ anchoring)', () => {
    expect(pompanoManifest.relevantArtifactTypes).toContain('hoa_letter');
    expect(pompanoManifest.relevantArtifactTypes).toContain(
      'zoning_application',
    );
    expect(pompanoManifest.relevantArtifactTypes).toContain(
      'fire_review_application',
    );
    expect(pompanoManifest.relevantArtifactTypes).toContain(
      'hvhz_anchoring',
    );
    expect(pompanoManifest.relevantArtifactTypes).toContain('site_plan');
    expect(pompanoManifest.relevantArtifactTypes).toContain('survey');
    expect(pompanoManifest.relevantArtifactTypes).toContain('noc');
  });

  it('does NOT include Davie / Hillsborough artifact types by default', () => {
    expect(pompanoManifest.relevantArtifactTypes).not.toContain(
      'notarized_addendum',
    );
    expect(pompanoManifest.relevantArtifactTypes).not.toContain(
      'property_ownership_search',
    );
    expect(pompanoManifest.relevantArtifactTypes).not.toContain(
      'flood_elevation_certificate',
    );
    expect(pompanoManifest.relevantArtifactTypes).not.toContain(
      'private_provider_documentation',
    );
  });
});

// ----------------------------------------------------------------------------
// Section predicates — scope and building-type forks
// ----------------------------------------------------------------------------

describe('Pompano manifest — section predicates', () => {
  it('gates nec22087Narrative to existing-service path', () => {
    const pred = pompanoManifest.sectionPredicates?.nec22087Narrative;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(false);
  });

  it('gates availableFaultCurrent to new-service path', () => {
    const pred = pompanoManifest.sectionPredicates?.availableFaultCurrent;
    expect(pred).toBeDefined();
    expect(pred!(commercialNewServicePe)).toBe(true);
    expect(pred!(sfrExistingExempt)).toBe(false);
  });

  it('gates grounding plan to new-service path', () => {
    const pred = pompanoManifest.sectionPredicates?.grounding;
    expect(pred).toBeDefined();
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
    expect(pred!(sfrExistingExempt)).toBe(false);
  });

  it('gates multi-family sections to buildingType === multi_family', () => {
    const meterPred = pompanoManifest.sectionPredicates?.meterStack;
    const mfevPred = pompanoManifest.sectionPredicates?.multiFamilyEV;
    expect(meterPred).toBeDefined();
    expect(mfevPred).toBeDefined();
    expect(meterPred!(multiFamilyNewServicePe)).toBe(true);
    expect(meterPred!(commercialNewServicePe)).toBe(false);
    expect(meterPred!(sfrExistingExempt)).toBe(false);
    expect(mfevPred!(multiFamilyNewServicePe)).toBe(true);
    expect(mfevPred!(sfrExistingExempt)).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Artifact-type predicates — H22 fire-review fork, HOA logic
// ----------------------------------------------------------------------------

describe('Pompano manifest — artifact-type predicates (H22)', () => {
  it('excludes Fire Review Application for single-family residences', () => {
    const pred = pompanoManifest.artifactTypePredicates?.fire_review_application;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });

  it('excludes HOA letter slot by default for single-family residences', () => {
    const pred = pompanoManifest.artifactTypePredicates?.hoa_letter;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
  });

  it('always includes Zoning Compliance Permit Application (H21)', () => {
    const pred = pompanoManifest.artifactTypePredicates?.zoning_application;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });

  it('always includes HVHZ anchoring documentation (H19 statewide)', () => {
    const pred = pompanoManifest.artifactTypePredicates?.hvhz_anchoring;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Requirements — count + uniqueness + categories
// ----------------------------------------------------------------------------

describe('Pompano manifest — requirements list', () => {
  it('declares exactly 22 requirement entries (regression guard against silent drift)', () => {
    // Snapshot-style count assertion — bumping this number is intentional
    // and forces the M1 reviewer to confirm the new line was sourced from
    // the Pompano Vehicle Charging Station Checklist (01/29/2024).
    expect(pompanoManifest.requirements.length).toBe(22);
  });

  it('has unique requirement IDs', () => {
    const ids = pompanoManifest.requirements.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('namespaces every requirement ID with the pompano- prefix', () => {
    for (const req of pompanoManifest.requirements) {
      expect(req.id.startsWith('pompano-')).toBe(true);
    }
  });

  it('uses only the 5 allowed category strings', () => {
    const allowed = new Set([
      'plan',
      'application',
      'narrative',
      'inspection',
      'upload',
    ]);
    for (const req of pompanoManifest.requirements) {
      expect(allowed.has(req.category)).toBe(true);
    }
  });

  it('covers all 5 categories at least once', () => {
    const categoriesSeen = new Set(
      pompanoManifest.requirements.map((r) => r.category),
    );
    expect(categoriesSeen.has('plan')).toBe(true);
    expect(categoriesSeen.has('application')).toBe(true);
    expect(categoriesSeen.has('narrative')).toBe(true);
    expect(categoriesSeen.has('inspection')).toBe(true);
    expect(categoriesSeen.has('upload')).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Requirements — predicate behavior
// ----------------------------------------------------------------------------

describe('Pompano manifest — requirement predicates (representative)', () => {
  function find(id: string) {
    const req = pompanoManifest.requirements.find((r) => r.id === id);
    if (!req) throw new Error(`Requirement ${id} not found`);
    return req;
  }

  it('SFR / commercial split: fire-review application required only on non-SFR', () => {
    const req = find('pompano-fire-review-application');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
    expect(req.required(commercialNewServicePe)).toBe(true);
  });

  it('PE-lane gate: PE seal requirement only fires on pe_required lane (H17)', () => {
    const req = find('pompano-pe-seal');
    expect(req.required(sfrExistingExempt)).toBe(false);
    // contractor_exemption — exempt
    expect(req.required(commercialExistingExempt)).toBe(false);
    // pe_required — required
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('base required-always: zoning application, riser, load calc, anchoring all required regardless of context', () => {
    expect(find('pompano-zoning-application').required(sfrExistingExempt)).toBe(
      true,
    );
    expect(
      find('pompano-zoning-application').required(commercialNewServicePe),
    ).toBe(true);
    expect(find('pompano-riser-diagram').required(sfrExistingExempt)).toBe(true);
    expect(find('pompano-load-calculation').required(sfrExistingExempt)).toBe(
      true,
    );
    expect(find('pompano-anchoring-detail').required(sfrExistingExempt)).toBe(
      true,
    );
  });

  it('NOC required for non-SFR (defensible default; FL Statute 713 > $5k)', () => {
    const req = find('pompano-noc');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('Fire-final inspection only required on non-SFR', () => {
    const req = find('pompano-inspection-fire-final');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Requirements — detect() behavior
// ----------------------------------------------------------------------------

describe('Pompano manifest — requirement detection', () => {
  function find(id: string) {
    const req = pompanoManifest.requirements.find((r) => r.id === id);
    if (!req) throw new Error(`Requirement ${id} not found`);
    return req;
  }

  const emptyPacket: PacketAST = { sheetIds: [], sectionKeys: [] };

  it('detects site_plan OR survey for site-plan requirement (Pompano #9 "survey or site plan")', () => {
    const req = find('pompano-site-plan');
    expect(req.detect(emptyPacket, [])).toBe(false);

    const withSitePlan: AttachmentSummary[] = [
      { artifactType: 'site_plan', displayTitle: 'Site Plan', sheetId: 'C-201' },
    ];
    expect(req.detect(emptyPacket, withSitePlan)).toBe(true);

    const withSurvey: AttachmentSummary[] = [
      { artifactType: 'survey', displayTitle: 'Survey', sheetId: 'C-202' },
    ];
    expect(req.detect(emptyPacket, withSurvey)).toBe(true);
  });

  it('detects anchoring documentation via the hvhz_anchoring artifact slot', () => {
    const req = find('pompano-anchoring-detail');
    expect(req.detect(emptyPacket, [])).toBe(false);

    const withAnchoring: AttachmentSummary[] = [
      {
        artifactType: 'hvhz_anchoring',
        displayTitle: 'FL Product Approval',
        sheetId: 'X-205',
      },
    ];
    expect(req.detect(emptyPacket, withAnchoring)).toBe(true);
  });

  it('detects electrical-plan requirement only when BOTH panel + equipment schedule sections are present', () => {
    const req = find('pompano-electrical-plan');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(
      req.detect({ sectionKeys: ['panelSchedules'] }, []),
    ).toBe(false);
    expect(
      req.detect(
        { sectionKeys: ['panelSchedules', 'equipmentSchedule'] },
        [],
      ),
    ).toBe(true);
  });

  it('detects installation manual via cut_sheet OR manufacturer_data OR equipmentSpecs section', () => {
    const req = find('pompano-installation-manual');
    expect(req.detect(emptyPacket, [])).toBe(false);

    // Upload-only path
    expect(
      req.detect(emptyPacket, [
        { artifactType: 'cut_sheet', sheetId: 'X-201' },
      ]),
    ).toBe(true);
    expect(
      req.detect(emptyPacket, [
        { artifactType: 'manufacturer_data', sheetId: 'X-202' },
      ]),
    ).toBe(true);

    // Section-only path
    expect(
      req.detect({ sectionKeys: ['equipmentSpecs'] }, []),
    ).toBe(true);
  });

  it('locator for site_plan returns first C- prefixed sheet ID', () => {
    const req = find('pompano-site-plan');
    expect(req.locator).toBeDefined();
    const packet: PacketAST = {
      sheetIds: ['E-001', 'E-100', 'C-201', 'X-205'],
    };
    expect(req.locator!(packet)).toBe('C-201');

    const noCivil: PacketAST = { sheetIds: ['E-001', 'E-100'] };
    expect(req.locator!(noCivil)).toBeNull();
  });
});
