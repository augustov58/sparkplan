/**
 * City of Orlando manifest tests — populated `requirements[]` follow-up.
 *
 * Backports the M1 schema onto the manifest that originally defined it
 * (PR-4 shipped Orlando empty; the other 4 AHJs populated their lists in
 * PR #56). Validates the manifest shape, requirement predicates, and
 * detection logic against representative contexts.
 */
import { describe, it, expect } from 'vitest';
import { orlandoManifest } from '../data/ahj/orlando';
import type {
  AHJContext,
  AttachmentSummary,
  PacketAST,
} from '../data/ahj/types';

// ----------------------------------------------------------------------------
// Representative contexts (Orlando's checklist forks on scope, not lane)
// ----------------------------------------------------------------------------

const sfrExistingExempt: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
};

const sfrNewServiceExempt: AHJContext = {
  scope: 'new-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
};

const multiFamilyNewServicePe: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'multi_family',
};

const commercialExistingPe: AHJContext = {
  scope: 'existing-service',
  lane: 'pe_required',
  buildingType: 'commercial',
};

const commercialNewServicePe: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'commercial',
};

// ----------------------------------------------------------------------------
// Structural / shape assertions
// ----------------------------------------------------------------------------

describe('Orlando manifest — structural shape', () => {
  it('declares core identity fields', () => {
    expect(orlandoManifest.id).toBe('orlando');
    expect(orlandoManifest.name).toBe('City of Orlando');
    expect(orlandoManifest.jurisdictionType).toBe('city');
    expect(orlandoManifest.subjurisdiction).toBeUndefined();
  });

  it('uses E- sheet ID prefix (Orlando convention; no Miami-Dade EL- fork)', () => {
    expect(orlandoManifest.sheetIdPrefix).toBe('E-');
  });

  it('uniformly cites NEC 2020 across all building types (no H34 fork)', () => {
    expect(orlandoManifest.necEdition.single_family_residential).toBe(
      'NEC 2020',
    );
    expect(orlandoManifest.necEdition.multi_family).toBe('NEC 2020');
    expect(orlandoManifest.necEdition.commercial).toBe('NEC 2020');
  });

  it('cites FBC 8th edition (2023) statewide', () => {
    expect(orlandoManifest.fbcEdition).toBe('FBC 8th ed (2023)');
  });
});

// ----------------------------------------------------------------------------
// Visibility — relevantSections + relevantArtifactTypes
// ----------------------------------------------------------------------------

describe('Orlando manifest — visibility defaults', () => {
  it('declares the core engineering sections (riser, load calc, panel schedules, equip specs)', () => {
    expect(orlandoManifest.relevantSections).toContain('riserDiagram');
    expect(orlandoManifest.relevantSections).toContain('loadCalculation');
    expect(orlandoManifest.relevantSections).toContain('panelSchedules');
    expect(orlandoManifest.relevantSections).toContain('equipmentSpecs');
  });

  it('declares Orlando-specific upload slots (site_plan, cut_sheet, fire_stopping, NOC, HVHZ)', () => {
    expect(orlandoManifest.relevantArtifactTypes).toContain('site_plan');
    expect(orlandoManifest.relevantArtifactTypes).toContain('cut_sheet');
    expect(orlandoManifest.relevantArtifactTypes).toContain('fire_stopping');
    expect(orlandoManifest.relevantArtifactTypes).toContain('noc');
    expect(orlandoManifest.relevantArtifactTypes).toContain('hvhz_anchoring');
  });

  it('does NOT include Pompano / Davie / Hillsborough artifact types by default', () => {
    expect(orlandoManifest.relevantArtifactTypes).not.toContain('hoa_letter');
    expect(orlandoManifest.relevantArtifactTypes).not.toContain(
      'zoning_application',
    );
    expect(orlandoManifest.relevantArtifactTypes).not.toContain(
      'fire_review_application',
    );
    expect(orlandoManifest.relevantArtifactTypes).not.toContain(
      'notarized_addendum',
    );
    expect(orlandoManifest.relevantArtifactTypes).not.toContain(
      'flood_elevation_certificate',
    );
  });
});

// ----------------------------------------------------------------------------
// Requirements — count + uniqueness + categories
// ----------------------------------------------------------------------------

describe('Orlando manifest — requirements list', () => {
  it('declares exactly 17 requirement entries (regression guard against silent drift)', () => {
    // Snapshot-style count assertion — bumping this number is intentional
    // and forces the reviewer to confirm the new line was sourced from the
    // Orlando "EV Charging Station Permit Checklist" (validated 2026-05-08).
    expect(orlandoManifest.requirements.length).toBe(17);
  });

  it('has unique requirement IDs', () => {
    const ids = orlandoManifest.requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('namespaces every requirement ID with the orlando- prefix', () => {
    for (const req of orlandoManifest.requirements) {
      expect(req.id.startsWith('orlando-')).toBe(true);
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
    for (const req of orlandoManifest.requirements) {
      expect(allowed.has(req.category)).toBe(true);
    }
  });

  it('covers all 5 categories at least once', () => {
    const categoriesSeen = new Set(
      orlandoManifest.requirements.map((r) => r.category),
    );
    expect(categoriesSeen.has('plan')).toBe(true);
    expect(categoriesSeen.has('application')).toBe(true);
    expect(categoriesSeen.has('narrative')).toBe(true);
    expect(categoriesSeen.has('inspection')).toBe(true);
    expect(categoriesSeen.has('upload')).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Requirements — predicate behavior (Orlando's two-path fork)
// ----------------------------------------------------------------------------

describe('Orlando manifest — requirement predicates', () => {
  function find(id: string) {
    const req = orlandoManifest.requirements.find((r) => r.id === id);
    if (!req) throw new Error(`Requirement ${id} not found`);
    return req;
  }

  it('revised panel schedule required ONLY on existing-service path', () => {
    const req = find('orlando-revised-panel-schedule');
    expect(req.required(sfrExistingExempt)).toBe(true);
    expect(req.required(commercialExistingPe)).toBe(true);
    expect(req.required(sfrNewServiceExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(false);
  });

  it('available fault current required ONLY on new-service path', () => {
    const req = find('orlando-available-fault-current');
    expect(req.required(sfrNewServiceExempt)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(commercialExistingPe)).toBe(false);
  });

  it('grounding detail required ONLY on new-service path', () => {
    const req = find('orlando-grounding-detail');
    expect(req.required(sfrNewServiceExempt)).toBe(true);
    expect(req.required(sfrExistingExempt)).toBe(false);
  });

  it('NEC 220.87 narrative required ONLY on existing-service path', () => {
    const req = find('orlando-nec-22087-narrative');
    expect(req.required(sfrExistingExempt)).toBe(true);
    expect(req.required(commercialExistingPe)).toBe(true);
    expect(req.required(sfrNewServiceExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(false);
  });

  it('PE seal required ONLY on pe_required lane (Sprint 2A H17 + Orlando #1b 277/480V)', () => {
    const req = find('orlando-pe-seal');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(sfrNewServiceExempt)).toBe(false);
    expect(req.required(commercialExistingPe)).toBe(true);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('NOC required for non-SFR (defensible default; FL Statute 713 > $5k)', () => {
    const req = find('orlando-noc');
    expect(req.required(sfrExistingExempt)).toBe(false);
    expect(req.required(sfrNewServiceExempt)).toBe(false);
    expect(req.required(commercialNewServicePe)).toBe(true);
    expect(req.required(multiFamilyNewServicePe)).toBe(true);
  });

  it('base required-always items: one-line, load calc, site plan, cut sheets, fire stopping, HVHZ anchoring', () => {
    const alwaysRequired = [
      'orlando-one-line-aic',
      'orlando-load-calculation',
      'orlando-site-plan',
      'orlando-evse-cut-sheets',
      'orlando-fire-stopping',
      'orlando-hvhz-anchoring',
      'orlando-code-basis-block',
      'orlando-vd-narrative',
      'orlando-contractor-license-block',
    ];
    for (const id of alwaysRequired) {
      const req = find(id);
      expect(req.required(sfrExistingExempt)).toBe(true);
      expect(req.required(commercialNewServicePe)).toBe(true);
    }
  });

  it('PE seal is detected as missing until Sprint 3 (C5) ships', () => {
    const req = find('orlando-pe-seal');
    // Detect always returns false today — desired visibility for the M1
    // checklist page until PAdES infrastructure lands.
    expect(req.detect({ sheetIds: ['E-001'] }, [])).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Requirements — detect() behavior
// ----------------------------------------------------------------------------

describe('Orlando manifest — requirement detection', () => {
  function find(id: string) {
    const req = orlandoManifest.requirements.find((r) => r.id === id);
    if (!req) throw new Error(`Requirement ${id} not found`);
    return req;
  }

  const emptyPacket: PacketAST = { sheetIds: [], sectionKeys: [] };

  it('detects site plan via site_plan attachment', () => {
    const req = find('orlando-site-plan');
    expect(req.detect(emptyPacket, [])).toBe(false);

    const withSitePlan: AttachmentSummary[] = [
      { artifactType: 'site_plan', displayTitle: 'Site Plan', sheetId: 'C-201' },
    ];
    expect(req.detect(emptyPacket, withSitePlan)).toBe(true);
  });

  it('detects fire stopping ONLY via fire_stopping attachment (not equipmentSpecs section)', () => {
    const req = find('orlando-fire-stopping');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(
      req.detect({ sectionKeys: ['equipmentSpecs'] }, []),
    ).toBe(false);
    expect(
      req.detect(emptyPacket, [
        { artifactType: 'fire_stopping', sheetId: 'X-301' },
      ]),
    ).toBe(true);
  });

  it('detects EVSE cut sheets via cut_sheet OR manufacturer_data OR equipmentSpecs section', () => {
    const req = find('orlando-evse-cut-sheets');
    expect(req.detect(emptyPacket, [])).toBe(false);

    // Upload-only paths
    expect(
      req.detect(emptyPacket, [{ artifactType: 'cut_sheet', sheetId: 'X-201' }]),
    ).toBe(true);
    expect(
      req.detect(emptyPacket, [
        { artifactType: 'manufacturer_data', sheetId: 'X-202' },
      ]),
    ).toBe(true);

    // Section-only path
    expect(req.detect({ sectionKeys: ['equipmentSpecs'] }, [])).toBe(true);
  });

  it('detects HVHZ anchoring via hvhz_anchoring attachment', () => {
    const req = find('orlando-hvhz-anchoring');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(
      req.detect(emptyPacket, [
        { artifactType: 'hvhz_anchoring', sheetId: 'X-401' },
      ]),
    ).toBe(true);
  });

  it('detects available fault current via either availableFaultCurrent OR shortCircuit section', () => {
    const req = find('orlando-available-fault-current');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(
      req.detect({ sectionKeys: ['availableFaultCurrent'] }, []),
    ).toBe(true);
    expect(req.detect({ sectionKeys: ['shortCircuit'] }, [])).toBe(true);
  });

  it('detects VD narrative via either generalNotes OR voltageDrop section', () => {
    const req = find('orlando-vd-narrative');
    expect(req.detect(emptyPacket, [])).toBe(false);
    expect(req.detect({ sectionKeys: ['generalNotes'] }, [])).toBe(true);
    expect(req.detect({ sectionKeys: ['voltageDrop'] }, [])).toBe(true);
  });

  it('detects code-basis + contractor-license blocks whenever any sheet exists (cover always present)', () => {
    const code = find('orlando-code-basis-block');
    const license = find('orlando-contractor-license-block');
    expect(code.detect(emptyPacket, [])).toBe(false);
    expect(license.detect(emptyPacket, [])).toBe(false);
    expect(code.detect({ sheetIds: ['E-001'] }, [])).toBe(true);
    expect(license.detect({ sheetIds: ['E-001'] }, [])).toBe(true);
  });

  it('locator for site_plan returns first C- prefixed sheet ID', () => {
    const req = find('orlando-site-plan');
    expect(req.locator).toBeDefined();
    const packet: PacketAST = {
      sheetIds: ['E-001', 'E-100', 'C-201', 'X-205'],
    };
    expect(req.locator!(packet)).toBe('C-201');

    const noCivil: PacketAST = { sheetIds: ['E-001', 'E-100'] };
    expect(req.locator!(noCivil)).toBeNull();
  });
});
