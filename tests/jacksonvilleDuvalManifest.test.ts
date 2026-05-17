/**
 * Sprint 2C M1 (post-PR-#69 follow-up) — Jacksonville/Duval manifest tests.
 *
 * Mirrors the Pompano test structure (`tests/pompanoManifest.test.ts`).
 * Validates manifest shape, requirement predicates, and detection logic
 * against representative contexts.
 */
import { describe, it, expect } from 'vitest';
import { jacksonvilleDuvalManifest } from '../data/ahj/jacksonville-duval';
import { getManifestById } from '../data/ahj/registry';
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

describe('Jacksonville/Duval manifest — structural shape', () => {
  it('declares core identity fields (consolidated city-county)', () => {
    expect(jacksonvilleDuvalManifest.id).toBe('jacksonville-duval');
    expect(jacksonvilleDuvalManifest.name).toBe(
      'City of Jacksonville / Duval County (Consolidated)',
    );
    // Consolidated since 1968 — modeled as a city government that absorbed
    // county functions. NOT 'county'.
    expect(jacksonvilleDuvalManifest.jurisdictionType).toBe('city');
    expect(jacksonvilleDuvalManifest.subjurisdiction).toBeUndefined();
  });

  it('uses E- sheet ID prefix (standard FL convention)', () => {
    expect(jacksonvilleDuvalManifest.sheetIdPrefix).toBe('E-');
  });

  it('uniformly cites NEC 2020 across all building types (no H34-style fork)', () => {
    expect(
      jacksonvilleDuvalManifest.necEdition.single_family_residential,
    ).toBe('NEC 2020');
    expect(jacksonvilleDuvalManifest.necEdition.multi_family).toBe('NEC 2020');
    expect(jacksonvilleDuvalManifest.necEdition.commercial).toBe('NEC 2020');
  });

  it('cites FBC 8th edition (2023) statewide', () => {
    expect(jacksonvilleDuvalManifest.fbcEdition).toBe('FBC 8th ed (2023)');
  });

  it('has Jacksonville-specific general notes (JaxEPICS, sub-permit, FFPC, flood)', () => {
    const notes = jacksonvilleDuvalManifest.generalNotes.join(' ');
    expect(notes).toMatch(/NFPA-70\s*\(2020 NEC\)/);
    expect(notes).toMatch(/Jacksonville Building Inspection Division/);
    expect(notes).toMatch(/JaxEPICS/);
    expect(notes).toMatch(/electrical sub-permit/);
    expect(notes).toMatch(/Duval County Clerk of Courts/);
    expect(notes).toMatch(/Special Flood Hazard Area/);
  });

  it('cites Jacksonville Ordinance Code + FL statutes in code references', () => {
    expect(jacksonvilleDuvalManifest.codeReferences).toContain(
      'NFPA-70 (2020 NEC)',
    );
    expect(jacksonvilleDuvalManifest.codeReferences).toContain(
      'Florida Statute 713.13 (Notice of Commencement)',
    );
    expect(
      jacksonvilleDuvalManifest.codeReferences.some((c) =>
        c.toLowerCase().includes('jacksonville'),
      ),
    ).toBe(true);
    expect(
      jacksonvilleDuvalManifest.codeReferences.some((c) =>
        c.toLowerCase().includes('florida fire prevention code'),
      ),
    ).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Registry wiring
// ----------------------------------------------------------------------------

describe('Jacksonville/Duval manifest — registry wiring', () => {
  it('is registered under id "jacksonville-duval"', () => {
    expect(getManifestById('jacksonville-duval')).toBe(
      jacksonvilleDuvalManifest,
    );
  });

  it('registry lookup is case-insensitive', () => {
    expect(getManifestById('JACKSONVILLE-DUVAL')).toBe(
      jacksonvilleDuvalManifest,
    );
  });
});

// ----------------------------------------------------------------------------
// Visibility — relevantSections + relevantArtifactTypes
// ----------------------------------------------------------------------------

describe('Jacksonville/Duval manifest — visibility defaults', () => {
  it('declares the core engineering sections (riser, load calc, panel schedules)', () => {
    expect(jacksonvilleDuvalManifest.relevantSections).toContain(
      'riserDiagram',
    );
    expect(jacksonvilleDuvalManifest.relevantSections).toContain(
      'loadCalculation',
    );
    expect(jacksonvilleDuvalManifest.relevantSections).toContain(
      'panelSchedules',
    );
    expect(jacksonvilleDuvalManifest.relevantSections).toContain(
      'equipmentSpecs',
    );
    expect(jacksonvilleDuvalManifest.relevantSections).toContain(
      'evseLabeling',
    );
  });

  it('declares Jacksonville intake upload slots (site_plan, cut_sheet, NOC, flood-cert)', () => {
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).toContain(
      'site_plan',
    );
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).toContain(
      'cut_sheet',
    );
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).toContain('noc');
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).toContain(
      'manufacturer_data',
    );
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).toContain(
      'fire_stopping',
    );
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).toContain(
      'flood_elevation_certificate',
    );
  });

  it('does NOT include Pompano/Davie-specific artifact types by default', () => {
    // Pompano-specific (Zoning Compliance form + Fire Review form):
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).not.toContain(
      'zoning_application',
    );
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).not.toContain(
      'fire_review_application',
    );
    // Davie-specific:
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).not.toContain(
      'notarized_addendum',
    );
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).not.toContain(
      'property_ownership_search',
    );
    // HVHZ is South-FL-only — Jacksonville is North FL, not in HVHZ.
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).not.toContain(
      'hvhz_anchoring',
    );
    // HOA letter: not a Jacksonville-AHJ-level requirement.
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).not.toContain(
      'hoa_letter',
    );
  });
});

// ----------------------------------------------------------------------------
// Section predicates — scope forks (no lane downgrade like Hillsborough H31)
// ----------------------------------------------------------------------------

describe('Jacksonville/Duval manifest — section predicates', () => {
  it('gates nec22087Narrative to existing-service path', () => {
    const pred = jacksonvilleDuvalManifest.sectionPredicates?.nec22087Narrative;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(false);
  });

  it('gates availableFaultCurrent to new-service path', () => {
    const pred =
      jacksonvilleDuvalManifest.sectionPredicates?.availableFaultCurrent;
    expect(pred).toBeDefined();
    expect(pred!(commercialNewServicePe)).toBe(true);
    expect(pred!(sfrExistingExempt)).toBe(false);
  });

  it('gates grounding plan to new-service path', () => {
    const pred = jacksonvilleDuvalManifest.sectionPredicates?.grounding;
    expect(pred).toBeDefined();
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
    expect(pred!(sfrExistingExempt)).toBe(false);
  });

  it('gates multi-family sections to buildingType === multi_family', () => {
    const meterPred = jacksonvilleDuvalManifest.sectionPredicates?.meterStack;
    const mfevPred =
      jacksonvilleDuvalManifest.sectionPredicates?.multiFamilyEV;
    expect(meterPred).toBeDefined();
    expect(mfevPred).toBeDefined();
    expect(meterPred!(multiFamilyNewServicePe)).toBe(true);
    expect(meterPred!(commercialNewServicePe)).toBe(false);
    expect(meterPred!(sfrExistingExempt)).toBe(false);
    expect(mfevPred!(multiFamilyNewServicePe)).toBe(true);
    expect(mfevPred!(sfrExistingExempt)).toBe(false);
  });

  it('does NOT downgrade SFR to a trade-permit-only lane (unlike Hillsborough H31)', () => {
    // riserDiagram, loadCalculation, panelSchedules etc. have NO section
    // predicate — they ride through for SFR too. This is a structural
    // distinction from Hillsborough/Tampa where these gate behind
    // `isFullPlanReviewLane`.
    expect(
      jacksonvilleDuvalManifest.sectionPredicates?.riserDiagram,
    ).toBeUndefined();
    expect(
      jacksonvilleDuvalManifest.sectionPredicates?.loadCalculation,
    ).toBeUndefined();
    expect(
      jacksonvilleDuvalManifest.sectionPredicates?.panelSchedules,
    ).toBeUndefined();
  });
});

// ----------------------------------------------------------------------------
// Artifact-type predicates — NOC + fire-stopping + flood-cert gates
// ----------------------------------------------------------------------------

describe('Jacksonville/Duval manifest — artifact-type predicates', () => {
  it('excludes NOC slot by default for SFR (FS 713.13 > $5k defensible default)', () => {
    const pred = jacksonvilleDuvalManifest.artifactTypePredicates?.noc;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(multiFamilyNewServicePe)).toBe(true);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });

  it('gates fire-stopping to commercial only', () => {
    const pred =
      jacksonvilleDuvalManifest.artifactTypePredicates?.fire_stopping;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(multiFamilyNewServicePe)).toBe(false);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });

  it('gates flood-elevation-certificate to commercial only (manual verification default)', () => {
    const pred =
      jacksonvilleDuvalManifest.artifactTypePredicates
        ?.flood_elevation_certificate;
    expect(pred).toBeDefined();
    expect(pred!(sfrExistingExempt)).toBe(false);
    expect(pred!(multiFamilyNewServicePe)).toBe(false);
    expect(pred!(commercialNewServicePe)).toBe(true);
  });

  it('does NOT default HVHZ anchoring ON (Jacksonville is North FL, not in HVHZ)', () => {
    // hvhz_anchoring is NOT in relevantArtifactTypes and there is no
    // predicate defaulting it ON for Jacksonville. Layer-2 user override
    // can still surface it per Sprint 2C H19 statewide pattern.
    expect(jacksonvilleDuvalManifest.relevantArtifactTypes).not.toContain(
      'hvhz_anchoring',
    );
    expect(
      jacksonvilleDuvalManifest.artifactTypePredicates?.hvhz_anchoring,
    ).toBeUndefined();
  });
});

// ----------------------------------------------------------------------------
// Requirements — count + uniqueness + categories
// ----------------------------------------------------------------------------

describe('Jacksonville/Duval manifest — requirements list', () => {
  it('declares exactly 25 requirement entries (regression guard against silent drift)', () => {
    // Snapshot-style count assertion — bumping this number is intentional
    // and forces the reviewer to confirm the new line was sourced from
    // the Jacksonville BID published guidance (see
    // docs/ahj-source-checklists/jacksonville-duval.md).
    expect(jacksonvilleDuvalManifest.requirements.length).toBe(25);
  });

  it('has unique requirement IDs', () => {
    const ids = jacksonvilleDuvalManifest.requirements.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('namespaces every requirement ID with the jacksonville-duval- prefix', () => {
    for (const req of jacksonvilleDuvalManifest.requirements) {
      expect(req.id.startsWith('jacksonville-duval-')).toBe(true);
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
    for (const req of jacksonvilleDuvalManifest.requirements) {
      expect(allowed.has(req.category)).toBe(true);
    }
  });

  it('covers all 5 categories at least once', () => {
    const categoriesSeen = new Set(
      jacksonvilleDuvalManifest.requirements.map((r) => r.category),
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

describe('Jacksonville/Duval manifest — requirement predicates (representative)', () => {
  function find(id: string) {
    const req = jacksonvilleDuvalManifest.requirements.find(
      (r) => r.id === id,
    );
    if (!req) throw new Error(`Requirement ${id} not found`);
    return req;
  }

  it('PE-lane gate: PE seal requirement only fires on pe_required lane (H17)', () => {
    const req = find('jacksonville-duval-pe-seal');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
    expect(req.required(sfrNewServicePe)).toBe(true);
  });

  it('always-required baseline: site_plan, riser, panel schedule, load calc, equipment schedule', () => {
    for (const id of [
      'jacksonville-duval-site-plan',
      'jacksonville-duval-riser-diagram',
      'jacksonville-duval-panel-schedule',
      'jacksonville-duval-load-calculations',
      'jacksonville-duval-equipment-schedule',
      'jacksonville-duval-voltage-drop',
      'jacksonville-duval-evse-cut-sheet',
    ]) {
      const req = find(id);
      expect(req.required(sfrExistingExempt)).toBe(true);
      expect(req.required(commercialNewServicePe)).toBe(true);
    }
  });

  it('NOC required for non-SFR (defensible default; FL Statute 713.13 > $5k)', () => {
    const req = find('jacksonville-duval-noc');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('scope-fork: NEC 220.87 narrative only on existing-service', () => {
    const req = find('jacksonville-duval-existing-service-nec22087');
    expect(req.required(sfrExistingExempt)).toBe(true);
    expect(req.required(commercialExistingExempt)).toBe(true);
    expect(req.required(commercialNewServicePe)).toBe(false);
  });

  it('scope-fork: fault current + grounding only on new-service', () => {
    const fault = find('jacksonville-duval-fault-current');
    const grounding = find('jacksonville-duval-grounding');
    expect(fault.required(sfrExistingExempt)).toBe(false);
    expect(fault.required(commercialNewServicePe)).toBe(true);
    expect(grounding.required(sfrExistingExempt)).toBe(false);
    expect(grounding.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('Fire-final inspection only required on non-SFR', () => {
    const req = find('jacksonville-duval-inspection-fire-final');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('Flood-zone DFE + elevation cert only required on commercial (manual verification baseline)', () => {
    const dfe = find('jacksonville-duval-design-flood-elevation');
    const slab = find('jacksonville-duval-inspection-floodplain-slab');
    const finalIns = find('jacksonville-duval-inspection-floodplain-final');
    expect(dfe.required(sfrExistingExempt)).toBe(false);
    expect(dfe.required(commercialNewServicePe)).toBe(true);
    expect(slab.required(commercialNewServicePe)).toBe(true);
    expect(finalIns.required(commercialNewServicePe)).toBe(true);
    expect(slab.required(sfrExistingExempt)).toBe(false);
  });

  it('Private Provider documentation is OFF-by-default (optional opt-in)', () => {
    const req = find('jacksonville-duval-private-provider-doc');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Requirements — detect() behavior
// ----------------------------------------------------------------------------

describe('Jacksonville/Duval manifest — requirement detection', () => {
  function find(id: string) {
    const req = jacksonvilleDuvalManifest.requirements.find(
      (r) => r.id === id,
    );
    if (!req) throw new Error(`Requirement ${id} not found`);
    return req;
  }

  const emptyPacket: PacketAST = { sheetIds: [], sectionKeys: [] };

  it('detects site_plan via the site_plan artifact slot', () => {
    const req = find('jacksonville-duval-site-plan');
    expect(req.detect(emptyPacket, [])).toBe(false);

    const withSitePlan: AttachmentSummary[] = [
      { artifactType: 'site_plan', displayTitle: 'Site Plan', sheetId: 'C-201' },
    ];
    expect(req.detect(emptyPacket, withSitePlan)).toBe(true);
  });

  it('detects EVSE cut sheet via the cut_sheet artifact slot', () => {
    const req = find('jacksonville-duval-evse-cut-sheet');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(
      req.detect(emptyPacket, [
        { artifactType: 'cut_sheet', sheetId: 'X-201' },
      ]),
    ).toBe(true);
  });

  it('detects NOC via the noc artifact slot', () => {
    const req = find('jacksonville-duval-noc');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(
      req.detect(emptyPacket, [{ artifactType: 'noc', sheetId: 'X-202' }]),
    ).toBe(true);
  });

  it('detects riser diagram via section key', () => {
    const req = find('jacksonville-duval-riser-diagram');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(req.detect({ sectionKeys: ['riserDiagram'] }, [])).toBe(true);
  });

  it('detects panel schedule via section key', () => {
    const req = find('jacksonville-duval-panel-schedule');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(req.detect({ sectionKeys: ['panelSchedules'] }, [])).toBe(true);
  });

  it('detects flood elevation cert via flood_elevation_certificate artifact slot', () => {
    const req = find('jacksonville-duval-design-flood-elevation');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(
      req.detect(emptyPacket, [
        {
          artifactType: 'flood_elevation_certificate',
          sheetId: 'X-205',
        },
      ]),
    ).toBe(true);
  });

  it('locator for site_plan returns first C- prefixed sheet ID', () => {
    const req = find('jacksonville-duval-site-plan');
    expect(req.locator).toBeDefined();
    const packet: PacketAST = {
      sheetIds: ['E-001', 'E-100', 'C-201', 'X-205'],
    };
    expect(req.locator!(packet)).toBe('C-201');

    const noCivil: PacketAST = { sheetIds: ['E-001', 'E-100'] };
    expect(req.locator!(noCivil)).toBeNull();
  });

  it('PE seal: detect returns false until Sprint 3 C5 seal-stamping lands', () => {
    const req = find('jacksonville-duval-pe-seal');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(
      req.detect({ sheetIds: ['E-001'], sectionKeys: ['generalNotes'] }, []),
    ).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Predicate-safety: predicates never throw on degenerate ctx
// ----------------------------------------------------------------------------

describe('Jacksonville/Duval manifest — predicate safety', () => {
  // Build a degenerate-but-typed context to exercise the predicates without
  // crashing. AHJContext requires scope/lane/buildingType to be set; we
  // confirm none of the predicates rely on optional `subjurisdiction`.
  const ctxNoSubjurisdiction: AHJContext = {
    scope: 'new-service',
    lane: 'contractor_exemption',
    buildingType: 'commercial',
  };

  it('all section predicates evaluate without throwing on a no-subjurisdiction context', () => {
    const preds = Object.values(
      jacksonvilleDuvalManifest.sectionPredicates ?? {},
    );
    for (const pred of preds) {
      expect(() => pred?.(ctxNoSubjurisdiction)).not.toThrow();
    }
  });

  it('all artifact-type predicates evaluate without throwing on a no-subjurisdiction context', () => {
    const preds = Object.values(
      jacksonvilleDuvalManifest.artifactTypePredicates ?? {},
    );
    for (const pred of preds) {
      expect(() => pred?.(ctxNoSubjurisdiction)).not.toThrow();
    }
  });

  it('all requirement `required` predicates evaluate without throwing on a no-subjurisdiction context', () => {
    for (const req of jacksonvilleDuvalManifest.requirements) {
      expect(() => req.required(ctxNoSubjurisdiction)).not.toThrow();
    }
  });
});
