/**
 * Sprint 2C M1 — City of Miami manifest tests.
 *
 * Regression guards for City of Miami's distinct manifest position vs the
 * Miami-Dade County (Unincorporated — RER) manifest:
 *
 *  1. City of Miami is an INDEPENDENT AHJ inside Miami-Dade County. It is
 *     NOT covered by `miamiDadeManifest`. Both manifests co-exist in the
 *     registry; the registry must resolve "City of Miami" → city-of-miami
 *     (NOT miami-dade), and "Miami-Dade County" → miami-dade.
 *  2. City of Miami uses uniform NEC 2020 (no H34-style residential /
 *     commercial PRG fork — that's MD-County-RER-specific).
 *  3. City of Miami uses the standard `E-` sheet prefix (no `EL-` mandate
 *     — that's MD-County-RER-specific).
 *  4. City of Miami still enforces HVHZ wind-anchoring statewide-in-MD
 *     (same H19 scope as the County RER manifest).
 *  5. City of Miami declares the Private Provider Program artifact slot
 *     (FL Statute 553.791).
 */
import { describe, it, expect } from 'vitest';
import { cityOfMiamiManifest } from '../data/ahj/city-of-miami';
import {
  findManifestForJurisdiction,
  getManifestById,
} from '../data/ahj/registry';
import type {
  AHJContext,
  AHJManifest,
  AHJRequirement,
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

describe('City of Miami manifest — structural shape', () => {
  it('conforms to the AHJManifest interface', () => {
    const m: AHJManifest = cityOfMiamiManifest;
    expect(m.id).toBe('city-of-miami');
    expect(m.name).toBe('City of Miami');
    expect(m.jurisdictionType).toBe('city');
  });

  it('leaves subjurisdiction undefined (City of Miami does not fork on sub-area)', () => {
    expect(cityOfMiamiManifest.subjurisdiction).toBeUndefined();
  });

  it('uses E- sheet ID prefix (no Miami-Dade-RER-style EL- mandate)', () => {
    expect(cityOfMiamiManifest.sheetIdPrefix).toBe('E-');
  });

  it('uniformly cites NEC 2020 across all building types (no H34-style PRG fork)', () => {
    expect(cityOfMiamiManifest.necEdition.single_family_residential).toBe(
      'NEC 2020',
    );
    expect(cityOfMiamiManifest.necEdition.multi_family).toBe('NEC 2020');
    expect(cityOfMiamiManifest.necEdition.commercial).toBe('NEC 2020');
  });

  it('cites FBC 8th edition (2023)', () => {
    expect(cityOfMiamiManifest.fbcEdition).toBe('FBC 8th ed (2023)');
  });

  it('has HVHZ-aware general notes (175 mph 3-sec gust callout)', () => {
    const joined = cityOfMiamiManifest.generalNotes.join('\n').toLowerCase();
    expect(joined).toContain('hvhz');
    expect(joined).toContain('175 mph');
    expect(joined).toContain('city of miami');
  });

  it('references NEC 2020, FBC 8th ed (2023), FL 713, and Private Provider FL 553.791 in code references', () => {
    const joined = cityOfMiamiManifest.codeReferences.join('\n');
    expect(joined).toContain('2020 NEC');
    expect(joined).toContain('Florida Building Code, 8th edition (2023)');
    expect(joined).toContain('Florida Statute 713');
    expect(joined).toContain('553.791');
  });
});

// ----------------------------------------------------------------------------
// Visibility — relevantSections + relevantArtifactTypes
// ----------------------------------------------------------------------------

describe('City of Miami manifest — visibility defaults', () => {
  it('declares the core engineering sections (riser, load calc, panel schedules, equipment specs)', () => {
    expect(cityOfMiamiManifest.relevantSections).toContain('riserDiagram');
    expect(cityOfMiamiManifest.relevantSections).toContain('loadCalculation');
    expect(cityOfMiamiManifest.relevantSections).toContain('panelSchedules');
    expect(cityOfMiamiManifest.relevantSections).toContain('equipmentSpecs');
  });

  it('declares Miami-specific upload slots (HVHZ anchoring, HOA letter, NOC, Private Provider)', () => {
    expect(cityOfMiamiManifest.relevantArtifactTypes).toContain(
      'hvhz_anchoring',
    );
    expect(cityOfMiamiManifest.relevantArtifactTypes).toContain('hoa_letter');
    expect(cityOfMiamiManifest.relevantArtifactTypes).toContain('noc');
    expect(cityOfMiamiManifest.relevantArtifactTypes).toContain(
      'private_provider_documentation',
    );
    expect(cityOfMiamiManifest.relevantArtifactTypes).toContain('site_plan');
    expect(cityOfMiamiManifest.relevantArtifactTypes).toContain('cut_sheet');
  });

  it('does NOT include Pompano/Davie/Hillsborough-specific artifact slots by default', () => {
    expect(cityOfMiamiManifest.relevantArtifactTypes).not.toContain(
      'zoning_application',
    );
    expect(cityOfMiamiManifest.relevantArtifactTypes).not.toContain(
      'fire_review_application',
    );
    expect(cityOfMiamiManifest.relevantArtifactTypes).not.toContain(
      'notarized_addendum',
    );
    expect(cityOfMiamiManifest.relevantArtifactTypes).not.toContain(
      'property_ownership_search',
    );
    expect(cityOfMiamiManifest.relevantArtifactTypes).not.toContain(
      'flood_elevation_certificate',
    );
    expect(cityOfMiamiManifest.relevantArtifactTypes).not.toContain('survey');
  });
});

// ----------------------------------------------------------------------------
// Section predicates — scope and building-type forks
// ----------------------------------------------------------------------------

describe('City of Miami manifest — section predicates', () => {
  it('gates nec22087Narrative to existing-service path', () => {
    const pred = cityOfMiamiManifest.sectionPredicates?.nec22087Narrative;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(false);
  });

  it('gates availableFaultCurrent to new-service path (City of Miami follows Orlando pattern, not MD-County-RER)', () => {
    const pred = cityOfMiamiManifest.sectionPredicates?.availableFaultCurrent;
    expect(pred).toBeDefined();
    expect(pred!(commercialNewServicePe)).toBe(true);
    expect(pred!(sfrExistingExempt)).toBe(false);
  });

  it('gates grounding plan to new-service path', () => {
    const pred = cityOfMiamiManifest.sectionPredicates?.grounding;
    expect(pred).toBeDefined();
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
    expect(pred!(sfrExistingExempt)).toBe(false);
  });

  it('gates multi-family sections to buildingType === multi_family', () => {
    const meterPred = cityOfMiamiManifest.sectionPredicates?.meterStack;
    const mfevPred = cityOfMiamiManifest.sectionPredicates?.multiFamilyEV;
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
// Artifact-type predicates — HVHZ scope, NOC threshold, HOA, Private Provider
// ----------------------------------------------------------------------------

describe('City of Miami manifest — artifact-type predicates', () => {
  it('hvhz_anchoring default-ON for every City of Miami project (HVHZ scope)', () => {
    const pred = cityOfMiamiManifest.artifactTypePredicates?.hvhz_anchoring;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(true);
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
  });

  it('noc default-OFF for SFR, default-ON for non-SFR (FL 713 > $5k defensible default)', () => {
    const pred = cityOfMiamiManifest.artifactTypePredicates?.noc;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(commercialNewServicePe)).toBe(true);
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
  });

  it('hoa_letter default-OFF for SFR, default-ON for non-SFR (Brickell/condo norm)', () => {
    const pred = cityOfMiamiManifest.artifactTypePredicates?.hoa_letter;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
  });

  it('private_provider_documentation default-ON for all contexts (optional intake slot)', () => {
    const pred =
      cityOfMiamiManifest.artifactTypePredicates
        ?.private_provider_documentation;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Requirements — count + uniqueness + categories
// ----------------------------------------------------------------------------

describe('City of Miami manifest — requirements list', () => {
  it('declares exactly 17 requirement entries (regression guard against silent drift)', () => {
    // Snapshot-style count assertion — bumping this number is intentional
    // and forces the M1 reviewer to confirm the new line was sourced from
    // City of Miami published forms (or marked as a research gap in
    // docs/ahj-source-checklists/city-of-miami.md).
    expect(cityOfMiamiManifest.requirements.length).toBe(17);
  });

  it('every requirement has a unique ID (no duplicate keys)', () => {
    const ids = cityOfMiamiManifest.requirements.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('namespaces every requirement ID with the city-of-miami- prefix', () => {
    for (const req of cityOfMiamiManifest.requirements) {
      expect(req.id.startsWith('city-of-miami-')).toBe(true);
    }
  });

  it('every requirement supplies a `required` and `detect` function (pure-shape contract)', () => {
    for (const req of cityOfMiamiManifest.requirements) {
      expect(typeof req.required).toBe('function');
      expect(typeof req.detect).toBe('function');
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
    for (const req of cityOfMiamiManifest.requirements) {
      expect(allowed.has(req.category)).toBe(true);
    }
  });

  it('covers application + plan + narrative + inspection categories at least once', () => {
    const categoriesSeen = new Set(
      cityOfMiamiManifest.requirements.map((r) => r.category),
    );
    expect(categoriesSeen.has('application')).toBe(true);
    expect(categoriesSeen.has('plan')).toBe(true);
    expect(categoriesSeen.has('narrative')).toBe(true);
    expect(categoriesSeen.has('inspection')).toBe(true);
    expect(categoriesSeen.has('upload')).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Requirement predicates — representative behavior
// ----------------------------------------------------------------------------

function find(id: string): AHJRequirement {
  const req = cityOfMiamiManifest.requirements.find((r) => r.id === id);
  if (!req) throw new Error(`Test setup error: requirement ${id} not found`);
  return req;
}

describe('City of Miami manifest — requirement predicates (representative)', () => {
  it('PE seal requirement only fires on pe_required lane (H17)', () => {
    const req = find('city-of-miami-pe-seal');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('NOC required only for non-SFR (defensible default; FL 713 > $5k)', () => {
    const req = find('city-of-miami-noc');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('HVHZ anchoring required on every City of Miami project (HVHZ scope)', () => {
    const req = find('city-of-miami-hvhz-anchoring');
    expect(req.required(sfrExistingExempt)).toBe(true);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('Available fault current required only on new-service path (City of Miami follows Orlando; differs from MD-County-RER)', () => {
    const req = find('city-of-miami-available-fault-current');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
  });

  it('Grounding plan required only on new-service path', () => {
    const req = find('city-of-miami-grounding-electrode');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
  });

  it('Private Provider NTBO defaults to optional (never strictly required without ctx info)', () => {
    const req = find('city-of-miami-private-provider-ntbo');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(false);
  });

  it('Base required-always: riser, load calc, electrical plan, site plan, anchoring', () => {
    expect(find('city-of-miami-riser-diagram').required(sfrExistingExempt)).toBe(
      true,
    );
    expect(
      find('city-of-miami-load-calculation').required(sfrExistingExempt),
    ).toBe(true);
    expect(
      find('city-of-miami-electrical-plan').required(sfrExistingExempt),
    ).toBe(true);
    expect(find('city-of-miami-site-plan').required(sfrExistingExempt)).toBe(
      true,
    );
    expect(
      find('city-of-miami-hvhz-anchoring').required(sfrExistingExempt),
    ).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Requirement detect() behavior
// ----------------------------------------------------------------------------

describe('City of Miami manifest — requirement detection', () => {
  const emptyPacket: PacketAST = { sheetIds: [], sectionKeys: [] };
  const emptyAttachments: AttachmentSummary[] = [];

  it('detects site plan via the site_plan artifact slot', () => {
    const req = find('city-of-miami-site-plan');
    expect(req.detect(emptyPacket, emptyAttachments)).toBe(false);
    expect(
      req.detect(emptyPacket, [
        { artifactType: 'site_plan', displayTitle: 'Site Plan', sheetId: 'C-201' },
      ]),
    ).toBe(true);
  });

  it('detects HVHZ anchoring via the hvhz_anchoring artifact slot', () => {
    const req = find('city-of-miami-hvhz-anchoring');
    expect(req.detect(emptyPacket, emptyAttachments)).toBe(false);
    expect(
      req.detect(emptyPacket, [
        {
          artifactType: 'hvhz_anchoring',
          displayTitle: 'FL Product Approval',
          sheetId: 'X-205',
        },
      ]),
    ).toBe(true);
  });

  it('detects NOC via the noc artifact slot', () => {
    const req = find('city-of-miami-noc');
    expect(req.detect(emptyPacket, [{ artifactType: 'noc' }])).toBe(true);
    expect(req.detect(emptyPacket, [{ artifactType: 'site_plan' }])).toBe(
      false,
    );
  });

  it('detects HOA letter via the hoa_letter artifact slot', () => {
    const req = find('city-of-miami-hoa-letter');
    expect(req.detect(emptyPacket, [{ artifactType: 'hoa_letter' }])).toBe(
      true,
    );
    expect(req.detect(emptyPacket, emptyAttachments)).toBe(false);
  });

  it('detects electrical-plan requirement only when BOTH panel + equipment schedule sections are present', () => {
    const req = find('city-of-miami-electrical-plan');
    expect(req.detect(emptyPacket, emptyAttachments)).toBe(false);
    expect(req.detect({ sectionKeys: ['panelSchedules'] }, [])).toBe(false);
    expect(
      req.detect(
        { sectionKeys: ['panelSchedules', 'equipmentSchedule'] },
        [],
      ),
    ).toBe(true);
  });

  it('detects installation manual via cut_sheet OR manufacturer_data OR equipmentSpecs section', () => {
    const req = find('city-of-miami-installation-manual');
    expect(req.detect(emptyPacket, [])).toBe(false);

    expect(
      req.detect(emptyPacket, [{ artifactType: 'cut_sheet', sheetId: 'X-201' }]),
    ).toBe(true);
    expect(
      req.detect(emptyPacket, [
        { artifactType: 'manufacturer_data', sheetId: 'X-202' },
      ]),
    ).toBe(true);
    expect(req.detect({ sectionKeys: ['equipmentSpecs'] }, [])).toBe(true);
  });

  it('detects Private Provider NTBO via the private_provider_documentation artifact slot', () => {
    const req = find('city-of-miami-private-provider-ntbo');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(
      req.detect(emptyPacket, [
        { artifactType: 'private_provider_documentation' },
      ]),
    ).toBe(true);
  });

  it('locator for site_plan returns first C- prefixed sheet ID', () => {
    const req = find('city-of-miami-site-plan');
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
// Registry — id lookup + fuzzy jurisdiction-name matching
// ----------------------------------------------------------------------------

describe('City of Miami manifest — registry integration', () => {
  it('getManifestById("city-of-miami") returns the City of Miami manifest', () => {
    expect(getManifestById('city-of-miami')).toBe(cityOfMiamiManifest);
  });

  it('getManifestById is case-insensitive for the City of Miami id', () => {
    expect(getManifestById('City-Of-Miami')).toBe(cityOfMiamiManifest);
    expect(getManifestById('CITY-OF-MIAMI')).toBe(cityOfMiamiManifest);
  });

  it('findManifestForJurisdiction matches "City of Miami" by jurisdiction_name', () => {
    const m = findManifestForJurisdiction({
      jurisdiction_name: 'City of Miami',
      ahj_name: null,
    });
    expect(m).toBe(cityOfMiamiManifest);
  });

  it('findManifestForJurisdiction matches "City of Miami" by ahj_name', () => {
    const m = findManifestForJurisdiction({
      jurisdiction_name: null,
      ahj_name: 'City of Miami Building Department',
    });
    expect(m).toBe(cityOfMiamiManifest);
  });

  it('does NOT resolve "Miami-Dade County" jurisdiction to the City of Miami manifest', () => {
    // Regression guard for the City-of-Miami / Miami-Dade independent-AHJ
    // distinction. Substring lookup must NOT route MD County jurisdictions
    // through the city-of-miami manifest.
    const m = findManifestForJurisdiction({
      jurisdiction_name: 'Miami-Dade County (Unincorporated)',
      ahj_name: null,
    });
    // Should resolve to miami-dade (or null) — never to city-of-miami.
    expect(m?.id).not.toBe('city-of-miami');
  });
});
