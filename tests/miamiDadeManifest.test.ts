/**
 * Sprint 2C M1 — Miami-Dade manifest tests.
 *
 * Regression guards for the three Miami-Dade-specific axes that don't fire
 * on Orlando (the only other PR-4 manifest):
 *
 * 1. `subjurisdiction === 'unincorporated'` (MD County RER covers ONLY
 *    unincorporated areas; 34 munis are independent AHJs)
 * 2. `necEdition` SFR=2014 vs Commercial=2020 (H34 PRG split)
 * 3. `sheetIdPrefix === 'EL-'` (H20; vs Orlando's `E-`)
 *
 * Plus predicate-level tests covering building_type / scope splits in the
 * requirements list.
 */
import { describe, it, expect } from 'vitest';
import { miamiDadeManifest } from '../data/ahj/miami-dade';
import type {
  AHJContext,
  AHJManifest,
  AHJRequirement,
  PacketAST,
  AttachmentSummary,
} from '../data/ahj/types';

// ----------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------

const ctxSFRExisting: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
  subjurisdiction: 'unincorporated',
};

const ctxCommercialNewService: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'commercial',
  subjurisdiction: 'unincorporated',
};

const ctxMultiFamilyExisting: AHJContext = {
  scope: 'existing-service',
  lane: 'pe_required',
  buildingType: 'multi_family',
  subjurisdiction: 'unincorporated',
};

// ----------------------------------------------------------------------------
// Manifest shape
// ----------------------------------------------------------------------------

describe('Miami-Dade manifest — shape', () => {
  it('conforms to the AHJManifest interface', () => {
    // TypeScript already enforces this at compile time; the runtime check
    // documents intent + catches the "exported as `any`" regression.
    const m: AHJManifest = miamiDadeManifest;
    expect(m.id).toBe('miami-dade');
    expect(m.name).toBe('Miami-Dade County (Unincorporated — RER)');
    expect(m.jurisdictionType).toBe('county');
  });

  it('sets subjurisdiction to "unincorporated" (regression guard — MD County RER scope)', () => {
    expect(miamiDadeManifest.subjurisdiction).toBe('unincorporated');
  });

  it('uses the "EL-" sheet-ID prefix (H20 — regression guard vs Orlando "E-")', () => {
    expect(miamiDadeManifest.sheetIdPrefix).toBe('EL-');
  });

  it('carries the dual-NEC-edition split (H34 — Residential 2014 / Commercial 2020)', () => {
    expect(miamiDadeManifest.necEdition.single_family_residential).toBe(
      'NEC 2014',
    );
    expect(miamiDadeManifest.necEdition.multi_family).toBe('NEC 2020');
    expect(miamiDadeManifest.necEdition.commercial).toBe('NEC 2020');
  });

  it('cites FBC 8th ed (2023)', () => {
    expect(miamiDadeManifest.fbcEdition).toBe('FBC 8th ed (2023)');
  });

  it('lists at least one HVHZ-related general note (regression guard for H19/HVHZ-statewide-in-MD scope)', () => {
    const joined = miamiDadeManifest.generalNotes.join('\n').toLowerCase();
    expect(joined).toContain('hvhz');
    expect(joined).toContain('175 mph');
  });

  it('includes both NEC editions in codeReferences (H34 dual-cite)', () => {
    const joined = miamiDadeManifest.codeReferences.join('\n');
    // Format follows the NFPA-70 (YYYY NEC) canonical citation per Orlando.
    expect(joined).toContain('2020 NEC');
    expect(joined).toContain('2014 NEC');
    expect(joined).toContain('Florida Building Code, 8th edition (2023)');
  });
});

// ----------------------------------------------------------------------------
// Requirements — count + category coverage
// ----------------------------------------------------------------------------

describe('Miami-Dade manifest — requirements', () => {
  it('exposes 22 requirements (regression guard — count locked from MD cross-walk audit)', () => {
    expect(miamiDadeManifest.requirements).toHaveLength(22);
  });

  it('every requirement has a unique ID (no duplicate keys)', () => {
    const ids = miamiDadeManifest.requirements.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every requirement ID is prefixed "md-" (manifest-id namespacing convention)', () => {
    for (const req of miamiDadeManifest.requirements) {
      expect(req.id.startsWith('md-')).toBe(true);
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
    for (const req of miamiDadeManifest.requirements) {
      expect(allowed.has(req.category)).toBe(true);
    }
  });

  it('every requirement supplies a `required` and `detect` function (pure-shape contract)', () => {
    for (const req of miamiDadeManifest.requirements) {
      expect(typeof req.required).toBe('function');
      expect(typeof req.detect).toBe('function');
    }
  });
});

// ----------------------------------------------------------------------------
// Requirement predicates — building_type / scope / lane splits
// ----------------------------------------------------------------------------

function getRequirement(id: string): AHJRequirement {
  const req = miamiDadeManifest.requirements.find((r) => r.id === id);
  if (!req) throw new Error(`Test setup error: requirement ${id} not found`);
  return req;
}

describe('Miami-Dade manifest — requirement predicates', () => {
  it('PE seal required only when lane === "pe_required" (H17 contractor-exemption gate)', () => {
    const peSeal = getRequirement('md-pe-seal');
    expect(peSeal.required(ctxSFRExisting)).toBe(false);
    expect(peSeal.required(ctxCommercialNewService)).toBe(true);
    expect(peSeal.required(ctxMultiFamilyExisting)).toBe(true);
  });

  it('Working space (NEC 110.26) commercial-only — SFR Residential PRG omits it', () => {
    const workingSpace = getRequirement('md-working-space');
    expect(workingSpace.required(ctxSFRExisting)).toBe(false);
    expect(workingSpace.required(ctxCommercialNewService)).toBe(true);
    expect(workingSpace.required(ctxMultiFamilyExisting)).toBe(true);
  });

  it('Wet-location callout (NEC 210.8/210.63/625.50) commercial / multi-family only', () => {
    const wet = getRequirement('md-wet-location');
    expect(wet.required(ctxSFRExisting)).toBe(false);
    expect(wet.required(ctxCommercialNewService)).toBe(true);
    expect(wet.required(ctxMultiFamilyExisting)).toBe(true);
  });

  it('Transformer OCPD (NEC 450.3) commercial / multi-family only', () => {
    const xfmr = getRequirement('md-transformer-ocpd');
    expect(xfmr.required(ctxSFRExisting)).toBe(false);
    expect(xfmr.required(ctxCommercialNewService)).toBe(true);
    expect(xfmr.required(ctxMultiFamilyExisting)).toBe(true);
  });

  it('HVHZ anchoring required on every MD project (statewide-in-MD scope, gap closure 2026-05-12)', () => {
    const hvhz = getRequirement('md-hvhz-anchoring');
    expect(hvhz.required(ctxSFRExisting)).toBe(true);
    expect(hvhz.required(ctxCommercialNewService)).toBe(true);
    expect(hvhz.required(ctxMultiFamilyExisting)).toBe(true);
  });

  it('Available fault current required on BOTH service paths (MD differs from Orlando which gates by scope)', () => {
    const afc = getRequirement('md-available-fault-current');
    expect(afc.required(ctxSFRExisting)).toBe(true);
    expect(afc.required(ctxCommercialNewService)).toBe(true);
  });

  it('NOC slot defaults ON for non-SFR (FL 713.13 — defensible for >$5k jobs)', () => {
    const noc = getRequirement('md-noc');
    expect(noc.required(ctxSFRExisting)).toBe(false);
    expect(noc.required(ctxCommercialNewService)).toBe(true);
    expect(noc.required(ctxMultiFamilyExisting)).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Requirement detect — sample packet evaluations
// ----------------------------------------------------------------------------

describe('Miami-Dade manifest — requirement detect()', () => {
  const emptyPacket: PacketAST = { sheetIds: [], sectionKeys: [] };
  const emptyAttachments: AttachmentSummary[] = [];

  it('"EL-" sheet-id-prefix requirement detects EL- prefix and rejects E-', () => {
    const req = getRequirement('md-sheet-id-prefix');
    expect(req.detect({ sheetIds: ['E-001', 'E-100'] }, emptyAttachments)).toBe(
      false,
    );
    expect(req.detect({ sheetIds: ['EL-001', 'EL-100'] }, emptyAttachments)).toBe(
      true,
    );
    // Mixed (transitional) — should still detect EL- presence
    expect(
      req.detect({ sheetIds: ['EL-001', 'C-201'] }, emptyAttachments),
    ).toBe(true);
  });

  it('HVHZ anchoring detect() looks for the artifact_type upload', () => {
    const req = getRequirement('md-hvhz-anchoring');
    expect(req.detect(emptyPacket, emptyAttachments)).toBe(false);
    expect(
      req.detect(emptyPacket, [{ artifactType: 'hvhz_anchoring' }]),
    ).toBe(true);
    expect(
      req.detect(emptyPacket, [{ artifactType: 'site_plan' }]),
    ).toBe(false);
  });

  it('NOC detect() looks for the artifact_type upload', () => {
    const req = getRequirement('md-noc');
    expect(req.detect(emptyPacket, [{ artifactType: 'noc' }])).toBe(true);
    expect(
      req.detect(emptyPacket, [{ artifactType: 'site_plan' }]),
    ).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Section predicates
// ----------------------------------------------------------------------------

describe('Miami-Dade manifest — section predicates', () => {
  it('NEC 220.87 narrative gated by existing-service scope (same as Orlando)', () => {
    const pred = miamiDadeManifest.sectionPredicates?.nec22087Narrative;
    expect(pred).toBeDefined();
    expect(pred!(ctxSFRExisting)).toBe(true);
    expect(pred!(ctxCommercialNewService)).toBe(false);
  });

  it('meterStack + multiFamilyEV gated by multi_family buildingType', () => {
    const meterPred = miamiDadeManifest.sectionPredicates?.meterStack;
    const mfevPred = miamiDadeManifest.sectionPredicates?.multiFamilyEV;
    expect(meterPred).toBeDefined();
    expect(mfevPred).toBeDefined();
    expect(meterPred!(ctxMultiFamilyExisting)).toBe(true);
    expect(meterPred!(ctxSFRExisting)).toBe(false);
    expect(mfevPred!(ctxMultiFamilyExisting)).toBe(true);
    expect(mfevPred!(ctxCommercialNewService)).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Artifact-type predicates
// ----------------------------------------------------------------------------

describe('Miami-Dade manifest — artifactTypePredicates', () => {
  it('hvhz_anchoring default-ON for every MD project (HVHZ scope)', () => {
    const pred = miamiDadeManifest.artifactTypePredicates?.hvhz_anchoring;
    expect(pred).toBeDefined();
    expect(pred!(ctxSFRExisting)).toBe(true);
    expect(pred!(ctxCommercialNewService)).toBe(true);
    expect(pred!(ctxMultiFamilyExisting)).toBe(true);
  });

  it('noc gated by non-SFR (defensible default for FL 713.13)', () => {
    const pred = miamiDadeManifest.artifactTypePredicates?.noc;
    expect(pred).toBeDefined();
    expect(pred!(ctxSFRExisting)).toBe(false);
    expect(pred!(ctxCommercialNewService)).toBe(true);
    expect(pred!(ctxMultiFamilyExisting)).toBe(true);
  });
});
