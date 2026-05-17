/**
 * Sprint 2C M1 follow-up — City of St. Petersburg manifest tests.
 *
 * Validates the manifest shape, requirement predicates, and detection
 * logic against representative contexts. Pattern mirrors
 * `pompanoManifest.test.ts` — structural shape, visibility defaults,
 * predicates, requirement count regression guard, requirement
 * predicates, requirement detection.
 *
 * St. Petersburg-specific test cases:
 *   - HVHZ verdict: Pinellas is OUT (not in HVHZ)
 *   - Hillsborough H31 trade-permit-lane pattern: SFR +
 *     contractor_exemption bypasses engineering-heavy sections
 *   - Anchoring slot ON for non-SFR (WBDR 140 mph FL Product Approval)
 *   - Flood elevation slot ON for commercial (coastal AE zones)
 */
import { describe, it, expect } from 'vitest';
import { stPetersburgManifest } from '../data/ahj/st-petersburg';
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

const sfrNewServicePe: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
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

describe('St. Petersburg manifest — structural shape', () => {
  it('declares core identity fields', () => {
    expect(stPetersburgManifest.id).toBe('st-petersburg');
    expect(stPetersburgManifest.name).toBe('City of St. Petersburg');
    expect(stPetersburgManifest.jurisdictionType).toBe('city');
    expect(stPetersburgManifest.subjurisdiction).toBeUndefined();
  });

  it('uses E- sheet ID prefix (Pinellas / FL standard convention)', () => {
    expect(stPetersburgManifest.sheetIdPrefix).toBe('E-');
  });

  it('uniformly cites NEC 2020 across all building types (no Miami-Dade fork)', () => {
    expect(stPetersburgManifest.necEdition.single_family_residential).toBe(
      'NEC 2020',
    );
    expect(stPetersburgManifest.necEdition.multi_family).toBe('NEC 2020');
    expect(stPetersburgManifest.necEdition.commercial).toBe('NEC 2020');
  });

  it('cites FBC 8th edition (2023) statewide', () => {
    expect(stPetersburgManifest.fbcEdition).toBe('FBC 8th ed (2023)');
  });

  it('has St. Pete-specific general notes (NEC 2020 + Click2Gov + WBDR + AE flood)', () => {
    const notes = stPetersburgManifest.generalNotes.join(' ');
    expect(notes).toMatch(/NFPA-70\s*\(2020 NEC\)/);
    expect(notes).toMatch(/St\.\s*Petersburg/);
    expect(notes).toMatch(/Click2Gov/);
    expect(notes).toMatch(/Wind-Borne Debris Region/);
    expect(notes).toMatch(/140 mph/);
    expect(notes).toMatch(/Florida Product Approval/);
    expect(notes).toMatch(/Pinellas County Construction Licensing Board/);
  });

  it('explicitly notes Pinellas is OUT of HVHZ (anchoring via FL Product Approval, not NOA)', () => {
    const notes = stPetersburgManifest.generalNotes.join(' ');
    expect(notes).toMatch(/NOT within the High-Velocity Hurricane Zone/);
  });

  it('cites Pinellas + St. Pete + FS 713.135 in code references', () => {
    expect(stPetersburgManifest.codeReferences).toContain('NFPA-70 (2020 NEC)');
    expect(stPetersburgManifest.codeReferences).toContain(
      'Florida Building Code, 8th edition (2023)',
    );
    expect(
      stPetersburgManifest.codeReferences.some((c) =>
        c.toLowerCase().includes('713.135'),
      ),
    ).toBe(true);
    expect(
      stPetersburgManifest.codeReferences.some((c) =>
        c.toLowerCase().includes('st. petersburg'),
      ),
    ).toBe(true);
    expect(
      stPetersburgManifest.codeReferences.some((c) =>
        c.toLowerCase().includes('pcclb'),
      ),
    ).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Visibility — relevantSections + relevantArtifactTypes
// ----------------------------------------------------------------------------

describe('St. Petersburg manifest — visibility defaults', () => {
  it('declares the core engineering sections (riser, load calc, panel schedules)', () => {
    expect(stPetersburgManifest.relevantSections).toContain('riserDiagram');
    expect(stPetersburgManifest.relevantSections).toContain('loadCalculation');
    expect(stPetersburgManifest.relevantSections).toContain('panelSchedules');
    expect(stPetersburgManifest.relevantSections).toContain('equipmentSpecs');
  });

  it('declares St. Pete-relevant upload slots (HOA, HVHZ anchoring, flood, NOC)', () => {
    expect(stPetersburgManifest.relevantArtifactTypes).toContain('hoa_letter');
    expect(stPetersburgManifest.relevantArtifactTypes).toContain(
      'hvhz_anchoring',
    );
    expect(stPetersburgManifest.relevantArtifactTypes).toContain(
      'flood_elevation_certificate',
    );
    expect(stPetersburgManifest.relevantArtifactTypes).toContain('site_plan');
    expect(stPetersburgManifest.relevantArtifactTypes).toContain('noc');
    expect(stPetersburgManifest.relevantArtifactTypes).toContain('cut_sheet');
    expect(stPetersburgManifest.relevantArtifactTypes).toContain(
      'fire_stopping',
    );
  });

  it('does NOT include Pompano / Davie / Hillsborough-only artifact types by default', () => {
    expect(stPetersburgManifest.relevantArtifactTypes).not.toContain(
      'zoning_application',
    );
    expect(stPetersburgManifest.relevantArtifactTypes).not.toContain(
      'fire_review_application',
    );
    expect(stPetersburgManifest.relevantArtifactTypes).not.toContain(
      'notarized_addendum',
    );
    expect(stPetersburgManifest.relevantArtifactTypes).not.toContain(
      'property_ownership_search',
    );
    expect(stPetersburgManifest.relevantArtifactTypes).not.toContain(
      'private_provider_documentation',
    );
    expect(stPetersburgManifest.relevantArtifactTypes).not.toContain('survey');
  });
});

// ----------------------------------------------------------------------------
// Section predicates — H31 trade-permit lane + scope forks
// ----------------------------------------------------------------------------

describe('St. Petersburg manifest — section predicates (H31 trade-permit pattern)', () => {
  it('gates loadCalculation OFF on SFR contractor-exemption lane', () => {
    const pred = stPetersburgManifest.sectionPredicates?.loadCalculation;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(commercialNewServicePe)).toBe(true);
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
  });

  it('gates riserDiagram OFF on SFR contractor-exemption lane', () => {
    const pred = stPetersburgManifest.sectionPredicates?.riserDiagram;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });

  it('gates panelSchedules OFF on SFR contractor-exemption lane', () => {
    const pred = stPetersburgManifest.sectionPredicates?.panelSchedules;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });

  it('keeps engineering ON for SFR + PE-required (full-plan-review lane)', () => {
    const pred = stPetersburgManifest.sectionPredicates?.loadCalculation;
    // SFR + pe_required is treated as full-plan-review (rare but
    // defensible — if a PE is on the project, contractor wants full
    // packet)
    expect(pred!(sfrNewServicePe)).toBe(true);
  });

  it('gates nec22087Narrative to existing-service path AND full-plan-review lane', () => {
    const pred = stPetersburgManifest.sectionPredicates?.nec22087Narrative;
    expect(pred).toBeDefined();
    expect(pred!(commercialExistingExempt)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(false);
    expect(pred!(sfrExistingExempt)).toBe(false); // trade-permit lane
  });

  it('gates availableFaultCurrent to new-service path AND full-plan-review lane', () => {
    const pred = stPetersburgManifest.sectionPredicates?.availableFaultCurrent;
    expect(pred).toBeDefined();
    expect(pred!(commercialNewServicePe)).toBe(true);
    expect(pred!(sfrExistingExempt)).toBe(false);
  });

  it('gates grounding to new-service path AND full-plan-review lane', () => {
    const pred = stPetersburgManifest.sectionPredicates?.grounding;
    expect(pred).toBeDefined();
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
    expect(pred!(sfrExistingExempt)).toBe(false);
  });

  it('gates multi-family sections to buildingType === multi_family', () => {
    const meterPred = stPetersburgManifest.sectionPredicates?.meterStack;
    const mfevPred = stPetersburgManifest.sectionPredicates?.multiFamilyEV;
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
// Artifact-type predicates — HVHZ verdict, HOA, flood
// ----------------------------------------------------------------------------

describe('St. Petersburg manifest — artifact-type predicates', () => {
  it('excludes HOA letter slot by default for single-family residences', () => {
    const pred = stPetersburgManifest.artifactTypePredicates?.hoa_letter;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });

  it('excludes hvhz_anchoring slot for SFR (wall-mount default) but ON for non-SFR', () => {
    const pred = stPetersburgManifest.artifactTypePredicates?.hvhz_anchoring;
    expect(pred).toBeDefined();
    // Pinellas is NOT HVHZ — but FL Product Approval anchoring path
    // still applies to outdoor pedestal / bollard EVSE. SFR wall-mount
    // typically does not need a separate anchoring detail.
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });

  it('flood_elevation_certificate slot ON for commercial only (coastal AE zones)', () => {
    const pred =
      stPetersburgManifest.artifactTypePredicates?.flood_elevation_certificate;
    expect(pred).toBeDefined();
    expect(pred!(commercialNewServicePe)).toBe(true);
    expect(pred!(multiFamilyNewServicePe)).toBe(false);
    expect(pred!(sfrExistingExempt)).toBe(false);
  });

  it('NOC slot ON for non-SFR (FS 713.135 > $5k threshold)', () => {
    const pred = stPetersburgManifest.artifactTypePredicates?.noc;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(commercialNewServicePe)).toBe(true);
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
  });

  it('site_plan + fire_stopping gated to full-plan-review lane (H31 pattern)', () => {
    const sitePred = stPetersburgManifest.artifactTypePredicates?.site_plan;
    const firePred = stPetersburgManifest.artifactTypePredicates?.fire_stopping;
    expect(sitePred).toBeDefined();
    expect(firePred).toBeDefined();
    expect(sitePred!(sfrExistingExempt)).toBe(false);
    expect(sitePred!(commercialNewServicePe)).toBe(true);
    expect(firePred!(sfrExistingExempt)).toBe(false);
    expect(firePred!(commercialNewServicePe)).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Predicate safety — never throw on bad ctx
// ----------------------------------------------------------------------------

describe('St. Petersburg manifest — predicate safety', () => {
  it('section predicates never throw on undefined/null ctx', () => {
    // Pure-data manifest constraint — predicates are wrapped with
    // optional chaining so a bad ctx returns false (not a throw).
    for (const pred of Object.values(
      stPetersburgManifest.sectionPredicates ?? {},
    )) {
      if (!pred) continue;
      expect(() => pred(undefined as unknown as AHJContext)).not.toThrow();
      expect(() => pred(null as unknown as AHJContext)).not.toThrow();
    }
  });

  it('artifact-type predicates never throw on undefined/null ctx', () => {
    for (const pred of Object.values(
      stPetersburgManifest.artifactTypePredicates ?? {},
    )) {
      if (!pred) continue;
      expect(() => pred(undefined as unknown as AHJContext)).not.toThrow();
      expect(() => pred(null as unknown as AHJContext)).not.toThrow();
    }
  });

  it('requirement.required() never throws on undefined/null ctx', () => {
    for (const req of stPetersburgManifest.requirements) {
      expect(() =>
        req.required(undefined as unknown as AHJContext),
      ).not.toThrow();
      expect(() => req.required(null as unknown as AHJContext)).not.toThrow();
    }
  });
});

// ----------------------------------------------------------------------------
// Requirements — count + uniqueness + categories
// ----------------------------------------------------------------------------

describe('St. Petersburg manifest — requirements list', () => {
  it('declares exactly 24 requirement entries (regression guard against silent drift)', () => {
    // Snapshot-style count assertion — bumping this number is
    // intentional and forces the reviewer to confirm the new line was
    // sourced from the St. Pete Residential / Commercial Plan Review
    // Checklists (no published EV-specific checklist exists).
    expect(stPetersburgManifest.requirements.length).toBe(24);
  });

  it('has unique requirement IDs', () => {
    const ids = stPetersburgManifest.requirements.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('namespaces every requirement ID with the st-petersburg- prefix', () => {
    for (const req of stPetersburgManifest.requirements) {
      expect(req.id.startsWith('st-petersburg-')).toBe(true);
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
    for (const req of stPetersburgManifest.requirements) {
      expect(allowed.has(req.category)).toBe(true);
    }
  });

  it('covers all 5 categories at least once', () => {
    const categoriesSeen = new Set(
      stPetersburgManifest.requirements.map((r) => r.category),
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

describe('St. Petersburg manifest — requirement predicates (representative)', () => {
  function find(id: string) {
    const req = stPetersburgManifest.requirements.find((r) => r.id === id);
    if (!req) throw new Error(`Requirement ${id} not found`);
    return req;
  }

  it('H31 lane split: trade-permit application ONLY on SFR + contractor_exemption', () => {
    const req = find('st-petersburg-trade-permit-application');
    expect(req.required(sfrExistingExempt)).toBe(true);
    expect(req.required(sfrNewServicePe)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(false);
    expect(req.required(multiFamilyNewServicePe)).toBe(false);
  });

  it('Commercial Electrical Permit application: required EXCEPT on SFR + contractor_exemption', () => {
    const req = find('st-petersburg-commercial-electrical-permit');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
    expect(req.required(sfrNewServicePe)).toBe(true); // SFR + PE = full review
  });

  it('PE seal: required on full-plan-review lane only', () => {
    const req = find('st-petersburg-pe-seal');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('Anchoring detail: required for non-SFR (WBDR 140 mph FL Product Approval path)', () => {
    const req = find('st-petersburg-anchoring-detail');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
    expect(req.required(commercialNewServicePe)).toBe(true);
  });

  it('Design Flood Elevation: required for commercial in full-plan-review lane (coastal AE zones)', () => {
    const req = find('st-petersburg-design-flood-elevation');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(multiFamilyNewServicePe)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
  });

  it('NOC required for non-SFR (FS 713.135 > $5k)', () => {
    const req = find('st-petersburg-noc');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('EVSE labeling, cut sheet, code-reference block all required regardless of lane', () => {
    expect(find('st-petersburg-evse-labeling').required(sfrExistingExempt)).toBe(
      true,
    );
    expect(find('st-petersburg-evse-cut-sheet').required(sfrExistingExempt)).toBe(
      true,
    );
    expect(
      find('st-petersburg-code-reference-block').required(sfrExistingExempt),
    ).toBe(true);
  });

  it('Existing-service NEC 220.87 narrative gated to existing-service + full plan review', () => {
    const req = find('st-petersburg-existing-service-nec22087');
    expect(req.required(sfrExistingExempt)).toBe(false); // trade-permit lane
    expect(req.required(commercialExistingExempt)).toBe(true);
    expect(req.required(commercialNewServicePe)).toBe(false);
  });

  it('New-service fault current gated to new-service + full plan review', () => {
    const req = find('st-petersburg-fault-current');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(commercialExistingExempt)).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Requirements — detect() behavior
// ----------------------------------------------------------------------------

describe('St. Petersburg manifest — requirement detection', () => {
  function find(id: string) {
    const req = stPetersburgManifest.requirements.find((r) => r.id === id);
    if (!req) throw new Error(`Requirement ${id} not found`);
    return req;
  }

  const emptyPacket: PacketAST = { sheetIds: [], sectionKeys: [] };

  it('detects site_plan via attachment slot', () => {
    const req = find('st-petersburg-site-plan');
    expect(req.detect(emptyPacket, [])).toBe(false);

    const withSitePlan: AttachmentSummary[] = [
      { artifactType: 'site_plan', displayTitle: 'Site Plan', sheetId: 'C-201' },
    ];
    expect(req.detect(emptyPacket, withSitePlan)).toBe(true);
  });

  it('detects anchoring documentation via hvhz_anchoring slot (FL Product Approval)', () => {
    const req = find('st-petersburg-anchoring-detail');
    expect(req.detect(emptyPacket, [])).toBe(false);

    const withAnchoring: AttachmentSummary[] = [
      {
        artifactType: 'hvhz_anchoring',
        displayTitle: 'FL Product Approval — EVSE Pedestal',
        sheetId: 'X-205',
      },
    ];
    expect(req.detect(emptyPacket, withAnchoring)).toBe(true);
  });

  it('detects flood elevation via flood_elevation_certificate slot', () => {
    const req = find('st-petersburg-design-flood-elevation');
    expect(req.detect(emptyPacket, [])).toBe(false);

    const withFlood: AttachmentSummary[] = [
      {
        artifactType: 'flood_elevation_certificate',
        displayTitle: 'FEMA Elevation Certificate',
        sheetId: 'X-301',
      },
    ];
    expect(req.detect(emptyPacket, withFlood)).toBe(true);
  });

  it('detects panel schedule via packet section', () => {
    const req = find('st-petersburg-panel-schedule');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(req.detect({ sectionKeys: ['panelSchedules'] }, [])).toBe(true);
  });

  it('detects load calculations via packet section', () => {
    const req = find('st-petersburg-load-calculations');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(req.detect({ sectionKeys: ['loadCalculation'] }, [])).toBe(true);
  });

  it('detects riser diagram via packet section', () => {
    const req = find('st-petersburg-riser-diagram');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(req.detect({ sectionKeys: ['riserDiagram'] }, [])).toBe(true);
  });

  it('detects EVSE cut sheet via attachment', () => {
    const req = find('st-petersburg-evse-cut-sheet');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(
      req.detect(emptyPacket, [
        { artifactType: 'cut_sheet', sheetId: 'X-201' },
      ]),
    ).toBe(true);
  });

  it('locator for site_plan returns first C- prefixed sheet ID', () => {
    const req = find('st-petersburg-site-plan');
    expect(req.locator).toBeDefined();
    const packet: PacketAST = {
      sheetIds: ['E-001', 'E-100', 'C-201', 'X-205'],
    };
    expect(req.locator!(packet)).toBe('C-201');

    const noCivil: PacketAST = { sheetIds: ['E-001', 'E-100'] };
    expect(req.locator!(noCivil)).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// Registry integration — manifest is wired in registry.ts
// ----------------------------------------------------------------------------

describe('St. Petersburg manifest — registry integration', () => {
  it('is registered under id "st-petersburg" via getManifestById', async () => {
    const { getManifestById } = await import('../data/ahj/registry');
    const found = getManifestById('st-petersburg');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('st-petersburg');
  });

  it('case-insensitive lookup works (ST-PETERSBURG, St-Petersburg)', async () => {
    const { getManifestById } = await import('../data/ahj/registry');
    expect(getManifestById('ST-PETERSBURG')?.id).toBe('st-petersburg');
    expect(getManifestById('St-Petersburg')?.id).toBe('st-petersburg');
  });

  it('is discoverable via findManifestForJurisdiction (substring match)', async () => {
    const { findManifestForJurisdiction } = await import(
      '../data/ahj/registry'
    );
    const found = findManifestForJurisdiction({
      jurisdiction_name: 'City of St. Petersburg, FL',
      ahj_name: null,
    });
    expect(found?.id).toBe('st-petersburg');
  });
});
